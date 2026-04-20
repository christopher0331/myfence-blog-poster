import { NextRequest } from "next/server";
import { getSiteFromRequest } from "@/lib/get-site";
import { TOOL_DECLARATIONS, runTool } from "@/lib/agent/tools";
import { geminiModel } from "@/lib/gemini-model";

// Needs full Node runtime for Supabase service role + Gemini SDK fetch.
export const maxDuration = 300;

const MAX_TOOL_ROUNDS = 8;

function systemInstruction(site: {
  name: string;
  domain: string;
  location?: string;
  posts_per_week?: number;
}) {
  return `You are the autonomous content operator for a multi-site blog CMS.

Active site context (use when the user doesn't specify another):
- name: ${site.name}
- domain: ${site.domain}
- location: ${site.location || "—"}
- cadence: ${site.posts_per_week || 2} posts/week

Capabilities via tools:
- Read: list_sites, list_topics, list_drafts, get_site_settings
- Write content: create_topic, write_blog
- Schedule / publish: schedule_draft, publish_draft
- Maintenance: delete_topic, delete_draft, update_site_schedule

Behaviour:
- When the user asks for a blog, prefer calling write_blog directly with a concrete title derived from their request (location, angle, product). Do not ask for permission first — just do it and describe the result.
- If they say "schedule it" after writing, immediately call schedule_draft with when="next_slot" unless they specified a date. Reply with the scheduled timestamp in a human-friendly way.
- If they say "publish now", call publish_draft (which commits to GitHub).
- Use site domains verbatim from the user (e.g. "myfence.com", "seattlefence.com"). If ambiguous, call list_sites first.
- Keep replies concise — 1 to 4 sentences unless the user asks for detail. Summaries, not walls of text.
- Never fabricate draft IDs; always call the relevant tool to fetch them.
- For destructive ops (delete_*, publish_draft) only proceed if the user clearly asked. Otherwise confirm in your reply.

Always call tools when action is needed; do not ask the user to run API calls themselves.`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const site = await getSiteFromRequest(req);
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
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

    const modelName = geminiModel("agent");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    type GeminiContent = {
      role: "user" | "model";
      parts: Array<
        | { text: string }
        | { functionCall: { name: string; args: Record<string, any> } }
        | {
            functionResponse: {
              name: string;
              response: Record<string, any>;
            };
          }
      >;
    };

    const contents: GeminiContent[] = (messages as Array<{ role: string; content: string }>)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content || "") }],
      }));

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
          } catch {
            // stream closed
          }
        };

        const keepalive = setInterval(() => send({ event: "ping" }), 4000);

        try {
          send({ event: "thinking" });

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [
                    {
                      text: systemInstruction({
                        name: site.name,
                        domain: site.domain,
                        location: site.location,
                        posts_per_week: site.posts_per_week,
                      }),
                    },
                  ],
                },
                contents,
                tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
                toolConfig: {
                  functionCallingConfig: { mode: "AUTO" },
                },
                generationConfig: {
                  temperature: 0.4,
                  maxOutputTokens: 2048,
                },
              }),
            });

            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              send({
                event: "error",
                error: err.error?.message || `Gemini: ${response.status}`,
              });
              break;
            }

            const data = await response.json();
            const cand = data.candidates?.[0];
            const parts: any[] = cand?.content?.parts || [];

            // Collect any function calls; otherwise emit text and stop.
            const toolCalls = parts.filter((p) => p.functionCall);
            const textParts = parts
              .filter((p) => typeof p.text === "string")
              .map((p) => p.text)
              .join("");

            if (toolCalls.length === 0) {
              if (textParts.trim()) {
                send({ event: "message", text: textParts.trim() });
              } else {
                send({ event: "message", text: "(no response)" });
              }
              break;
            }

            // Push model turn (with calls) onto transcript
            contents.push({
              role: "model",
              parts: parts.map((p) => {
                if (p.functionCall) return { functionCall: p.functionCall };
                if (typeof p.text === "string") return { text: p.text };
                return { text: "" };
              }),
            });

            // Execute each tool
            const functionResponses: any[] = [];
            for (const call of toolCalls) {
              const fname = call.functionCall.name;
              const fargs = call.functionCall.args || {};
              send({ event: "tool_call", name: fname, args: fargs });
              try {
                const result = await runTool(fname, fargs, { activeSite: site });
                send({ event: "tool_result", name: fname, result });
                functionResponses.push({
                  functionResponse: { name: fname, response: result },
                });
              } catch (err: any) {
                const errObj = { ok: false, error: err.message || "tool error" };
                send({ event: "tool_result", name: fname, result: errObj });
                functionResponses.push({
                  functionResponse: { name: fname, response: errObj },
                });
              }
            }

            // Feed results back as next user-role turn per Gemini function calling spec
            contents.push({
              role: "user",
              parts: functionResponses,
            });

            // loop for another model turn
          }
        } catch (err: any) {
          send({ event: "error", error: err.message || "agent failure" });
        } finally {
          clearInterval(keepalive);
          send({ event: "done" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "agent failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
