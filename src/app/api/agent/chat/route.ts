import { NextRequest } from "next/server";
import { getSiteFromRequest } from "@/lib/get-site";
import { TOOL_DECLARATIONS, runTool } from "@/lib/agent/tools";

// Needs full Node runtime for Supabase service role + model API fetch.
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    type OpenAIMessage = {
      role: "system" | "user" | "assistant" | "tool";
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
    };

    const openaiMessages: OpenAIMessage[] = [
      {
        role: "system",
        content: systemInstruction({
          name: site.name,
          domain: site.domain,
          location: site.location,
          posts_per_week: site.posts_per_week,
        }),
      },
      ...(messages as Array<{ role: string; content: string }>)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content || ""),
      })),
    ];

    const tools = TOOL_DECLARATIONS.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
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
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: process.env.OPENAI_MODEL_AGENT || process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: openaiMessages,
                tools,
                tool_choice: "auto",
                temperature: 0.4,
                max_tokens: 2048,
              }),
            });

            if (!response.ok) {
              const err = await response.json().catch(() => ({}));
              send({
                event: "error",
                error: err.error?.message || `OpenAI: ${response.status}`,
              });
              break;
            }

            const data = await response.json();
            const message = data.choices?.[0]?.message;
            const toolCalls = message?.tool_calls || [];
            const text = String(message?.content || "");

            if (toolCalls.length === 0) {
              if (text.trim()) {
                send({ event: "message", text: text.trim() });
              } else {
                send({ event: "message", text: "(no response)" });
              }
              break;
            }

            openaiMessages.push({
              role: "assistant",
              content: message?.content || null,
              tool_calls: toolCalls,
            });

            for (const call of toolCalls) {
              const fname = call.function?.name;
              let fargs: Record<string, any> = {};
              try {
                fargs = JSON.parse(call.function?.arguments || "{}");
              } catch {
                fargs = {};
              }
              send({ event: "tool_call", name: fname, args: fargs });
              try {
                const result = await runTool(fname, fargs, { activeSite: site });
                send({ event: "tool_result", name: fname, result });
                openaiMessages.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify(result),
                });
              } catch (err: any) {
                const errObj = { ok: false, error: err.message || "tool error" };
                send({ event: "tool_result", name: fname, result: errObj });
                openaiMessages.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify(errObj),
                });
              }
            }
          }
        } catch (err: any) {
          const msg = err?.message || String(err) || "agent failure";
          const hint =
            msg.includes("403") || msg.toLowerCase().includes("permission")
              ? " — this may mean your OpenAI API key/project does not have access to the configured model."
              : msg.includes("429") || msg.toLowerCase().includes("quota")
              ? " — you've hit the API rate limit. Try again in a moment."
              : "";
          send({ event: "error", error: msg + hint });
        } finally {
          clearInterval(keepalive);
          try { send({ event: "done" }); } catch { /* stream already closed */ }
          try { controller.close(); } catch { /* already closed */ }
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
