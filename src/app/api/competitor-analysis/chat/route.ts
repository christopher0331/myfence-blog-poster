import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TopicStatus } from "@/lib/types";
import { getSiteFromRequest } from "@/lib/get-site";

export const runtime = "edge";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface CompactOpportunity {
  url: string;
  title: string;
  traffic: number;
  keywords: number;
  priority: string;
  trend: string;
  covered: boolean;
  selected: boolean;
}

function getSystemPrompt(siteName: string, location: string) {
  return `You are an AI assistant for the ${siteName} competitor analysis tool. The user has uploaded a SEMrush CSV and can see a list of competitor content pages (opportunities).

You can help the user by performing actions on the data. Respond with a JSON object containing:
- "message": A brief, helpful response to the user (1-3 sentences)
- "actions": An array of actions to execute (can be empty)

Available action types:

1. SELECT — select opportunities by URL
   {"type": "select", "urls": ["url1", "url2"]}

2. DESELECT — deselect opportunities
   {"type": "deselect", "urls": ["url1", "url2"]}

3. SELECT_ALL_GAPS — select all uncovered opportunities
   {"type": "select_all_gaps"}

4. DESELECT_ALL — clear selection
   {"type": "deselect_all"}

5. UPDATE — update an opportunity's title, description, priority, or keywords
   {"type": "update", "url": "the-url", "changes": {"suggestedTitle": "New Title", "priority": "high"}}

6. REMOVE — remove opportunities from the results
   {"type": "remove", "urls": ["url1", "url2"]}

7. CREATE_TOPICS — create blog topics from specified opportunity URLs (writes to database)
   {"type": "create_topics", "urls": ["url1", "url2"]}

Rules:
- Always reference opportunities by their exact competitorUrl
- When the user says "select the top 5", select the 5 with highest traffic
- When updating titles, make them SEO-friendly and relevant to ${location}
- For CREATE_TOPICS, only include uncovered (not already covered) opportunities
- Keep messages concise and action-oriented
- If the user asks a question, just respond with information (empty actions array)
- You can perform multiple actions in one response

Return ONLY valid JSON, no markdown fences.`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const site = await getSiteFromRequest(req);
    const { message, opportunities, selectedUrls } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const compact: CompactOpportunity[] = (opportunities || []).map(
      (o: any) => ({
        url: o.competitorUrl,
        title: o.suggestedTitle,
        traffic: o.estimatedTraffic,
        keywords: o.competitorKeywordCount,
        priority: o.priority,
        trend: o.trafficTrend,
        covered: o.alreadyCovered,
        selected: (selectedUrls || []).includes(o.competitorUrl),
      }),
    );

    const userPrompt = `CURRENT DATA (${compact.length} opportunities):
${JSON.stringify(compact)}

USER MESSAGE: ${message}`;

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        send({ event: "thinking" });

        let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
        try {
          keepaliveTimer = setInterval(() => {
            send({ event: "ping" });
          }, 3000);

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: getSystemPrompt(site.name, site.location) }],
              },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
              },
            }),
          });

          if (keepaliveTimer) clearInterval(keepaliveTimer);
          keepaliveTimer = null;

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            send({
              event: "error",
              error: err.error?.message || `Gemini API: ${response.status}`,
            });
            controller.close();
            return;
          }

          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            send({ event: "error", error: "Empty response from AI" });
            controller.close();
            return;
          }

          let parsed: { message: string; actions: any[] };
          try {
            let jsonText = text.trim();
            const fb = jsonText.indexOf("{");
            const lb = jsonText.lastIndexOf("}");
            if (fb !== -1 && lb > fb) jsonText = jsonText.slice(fb, lb + 1);
            parsed = JSON.parse(jsonText);
          } catch {
            send({
              event: "response",
              message: text.trim(),
              actions: [],
              serverResults: {},
            });
            controller.close();
            return;
          }

          const serverResults: Record<string, unknown> = {};

          for (const action of parsed.actions || []) {
            if (action.type === "create_topics") {
              try {
                const supabase = getAdminClient();
                const toCreate = (opportunities || []).filter(
                  (o: any) =>
                    (action.urls || []).includes(o.competitorUrl) &&
                    !o.alreadyCovered,
                );

                let created = 0;
                for (const opp of toCreate) {
                  const { data: existing } = await supabase
                    .from("blog_topics")
                    .select("id")
                    .eq("site_id", site.id)
                    .ilike("title", `%${opp.suggestedTitle.slice(0, 30)}%`)
                    .limit(1);

                  if (existing && existing.length > 0) continue;

                  const status: TopicStatus =
                    opp.priority === "high" ? "ready" : "preparing";

                  const { error } = await supabase.from("blog_topics").insert({
                    site_id: site.id,
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
                  });

                  if (!error) created++;
                }
                serverResults.topicsCreated = created;
              } catch (e: any) {
                serverResults.topicsError = e.message;
              }
            }
          }

          send({
            event: "response",
            message: parsed.message,
            actions: parsed.actions || [],
            serverResults,
          });
        } catch (err: any) {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          send({ event: "error", error: err.message || "Chat failed" });
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
