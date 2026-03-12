import { NextRequest, NextResponse } from "next/server";
import {
  parseSemrushCSV,
  filterContentPages,
  analyzeWithGemini,
  getExistingSlugs,
} from "@/lib/competitor-analysis";
import { createClient } from "@supabase/supabase-js";
import type { TopicStatus } from "@/lib/types";

export const runtime = "edge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SendFn = (data: Record<string, unknown>) => void;

function ndjsonStream(
  generator: (send: SendFn) => Promise<void>,
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendFn = (data) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };
      try {
        await generator(send);
      } catch (err: any) {
        send({ event: "error", error: err.message || "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

function withKeepalive<T>(
  promise: Promise<T>,
  send: SendFn,
  message: string,
  intervalMs = 3000,
): Promise<T> {
  let seconds = 0;
  const timer = setInterval(() => {
    seconds += Math.round(intervalMs / 1000);
    send({ event: "ping", message: `${message} (${seconds}s elapsed)` });
  }, intervalMs);

  return promise.finally(() => clearInterval(timer));
}

/**
 * POST /api/competitor-analysis
 * Streams NDJSON progress events for the analyze action.
 * Returns regular JSON for create-topics.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvText, action, opportunities } = body;

    if (action === "analyze" || (!action && csvText)) {
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json(
          { error: "csvText is required" },
          { status: 400 },
        );
      }

      return ndjsonStream(async (send) => {
        send({ event: "progress", step: "parsing", message: "Parsing CSV..." });

        const allRows = parseSemrushCSV(csvText);
        const contentRows = filterContentPages(allRows);
        const competitor = allRows[0]?.url
          ? new URL(allRows[0].url).hostname
          : "unknown";

        send({
          event: "progress",
          step: "fetching",
          message: `Found ${contentRows.length} content pages. Fetching existing blog posts...`,
        });

        const existingSlugs = await getExistingSlugs();

        send({
          event: "progress",
          step: "analyzing",
          message: `Analyzing ${Math.min(contentRows.length, 40)} pages with AI...`,
        });

        const opportunities = await withKeepalive(
          analyzeWithGemini(contentRows, existingSlugs, competitor),
          send,
          "AI is analyzing competitor content",
        );

        opportunities.sort((a, b) => {
          if (a.alreadyCovered !== b.alreadyCovered)
            return a.alreadyCovered ? 1 : -1;
          return b.estimatedTraffic - a.estimatedTraffic;
        });

        send({
          event: "complete",
          success: true,
          competitor,
          totalPages: allRows.length,
          contentPages: contentRows.length,
          opportunities,
          alreadyCovered: opportunities.filter((o) => o.alreadyCovered).length,
          gaps: opportunities.filter((o) => !o.alreadyCovered).length,
        });
      });
    }

    if (action === "create-topics") {
      if (!Array.isArray(opportunities) || opportunities.length === 0) {
        return NextResponse.json(
          { error: "opportunities array is required" },
          { status: 400 },
        );
      }

      const supabase = getAdminClient();
      const created: string[] = [];

      for (const opp of opportunities) {
        if (opp.alreadyCovered) continue;

        const { data: existing } = await supabase
          .from("blog_topics")
          .select("id")
          .ilike("title", `%${opp.suggestedTitle.slice(0, 30)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const status: TopicStatus =
          opp.priority === "high" ? "ready" : "preparing";

        const { data, error } = await supabase
          .from("blog_topics")
          .insert({
            title: opp.suggestedTitle,
            description: opp.suggestedDescription,
            keywords: opp.suggestedKeywords || [],
            research_notes: `Competitor gap from ${opp.competitorUrl}\nEstimated traffic: ${opp.estimatedTraffic}\nCompetitor keywords: ${opp.competitorKeywordCount}`,
            source: "ai" as const,
            status,
            priority:
              opp.priority === "high"
                ? 9
                : opp.priority === "medium"
                  ? 6
                  : 3,
          })
          .select("id")
          .single();

        if (!error && data) {
          created.push(data.id);
        }
      }

      return NextResponse.json({
        success: true,
        created: created.length,
        message: `Created ${created.length} new topics`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[Competitor Analysis] Error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 },
    );
  }
}
