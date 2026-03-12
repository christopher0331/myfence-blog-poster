import { NextRequest, NextResponse } from "next/server";
import { analyzeCompetitorContent } from "@/lib/competitor-analysis";
import { createClient } from "@supabase/supabase-js";
import type { TopicStatus } from "@/lib/types";

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * POST /api/competitor-analysis
 * Accepts SEMrush CSV text, returns gap analysis with prioritized opportunities.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvText, action, opportunities } = body;

    // Action: analyze — parse CSV + run Gemini analysis
    if (action === "analyze" || (!action && csvText)) {
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json(
          { error: "csvText is required" },
          { status: 400 },
        );
      }

      const result = await analyzeCompetitorContent(csvText);
      return NextResponse.json({ success: true, ...result });
    }

    // Action: create-topics — bulk-create topics from selected opportunities
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
        // Skip already-covered topics
        if (opp.alreadyCovered) continue;

        // Check if topic with similar title already exists
        const { data: existing } = await supabase
          .from("blog_topics")
          .select("id")
          .ilike("title", `%${opp.suggestedTitle.slice(0, 30)}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const status: TopicStatus = opp.priority === "high" ? "ready" : "preparing";

        const { data, error } = await supabase
          .from("blog_topics")
          .insert({
            title: opp.suggestedTitle,
            description: opp.suggestedDescription,
            keywords: opp.suggestedKeywords || [],
            research_notes: `Competitor gap from ${opp.competitorUrl}\nEstimated traffic: ${opp.estimatedTraffic}\nCompetitor keywords: ${opp.competitorKeywordCount}`,
            source: "ai" as const,
            status,
            priority: opp.priority === "high" ? 9 : opp.priority === "medium" ? 6 : 3,
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
