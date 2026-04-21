"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, Wrench, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSite } from "@/lib/site-context";
import Link from "next/link";

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  events?: AgentEvent[];
}

type AgentEvent =
  | { kind: "tool_call"; name: string; args: Record<string, any> }
  | { kind: "tool_result"; name: string; ok: boolean; summary: string; data: Record<string, any> };

const SUGGESTIONS = [
  "List all drafts for myfence.com",
  "Write a blog for myfence.com about picture frame fences in Maple Valley, then schedule it",
  "Show me ready topics",
  "Set seattlefence.com to 3 posts per week on Mon/Wed/Fri at 17:00 UTC",
];

export default function AgentDrawer() {
  const { currentSite } = useSite();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamIdRef = useRef(0);

  // Keyboard shortcut: ⌘J / Ctrl+J
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || busy) return;
      const myTurn = ++streamIdRef.current;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        events: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setBusy(true);

      try {
        const transcript = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: userMsg.role, content: userMsg.content },
        ];

        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(currentSite ? { "X-Site-Id": currentSite.id } : {}),
          },
          body: JSON.stringify({ messages: transcript }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          appendAssistant(assistantMsg.id, `⚠️ ${err.error || `HTTP ${res.status}`}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          if (streamIdRef.current !== myTurn) {
            reader.cancel().catch(() => {});
            break;
          }
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let evt: any;
            try {
              evt = JSON.parse(line);
            } catch {
              continue;
            }
            handleEvent(assistantMsg.id, evt);
          }
        }
      } catch (err: any) {
        const msg = err?.message || "request failed";
        // Fetch throws "Failed to fetch" when the connection drops mid-stream.
        // Give more context since the real cause is usually a slow/long AI call.
        const hint = msg.toLowerCase().includes("failed to fetch")
          ? " (connection dropped — the AI call may have timed out or the API key needs billing enabled for Gemini 3.1 Pro)"
          : "";
        appendAssistant(assistantMsg.id, `⚠️ ${msg}${hint}`);
      } finally {
        if (streamIdRef.current === myTurn) setBusy(false);
      }
    },
    [input, busy, messages, currentSite],
  );

  function handleEvent(id: string, evt: any) {
    if (evt.event === "ping" || evt.event === "thinking" || evt.event === "done") return;
    if (evt.event === "tool_call") {
      pushEvent(id, { kind: "tool_call", name: evt.name, args: evt.args });
      return;
    }
    if (evt.event === "tool_result") {
      const ok = !!evt.result?.ok || evt.result?.ok === undefined ? !evt.result?.error : false;
      pushEvent(id, {
        kind: "tool_result",
        name: evt.name,
        ok: ok && !evt.result?.error,
        summary: summarizeResult(evt.name, evt.result),
        data: evt.result || {},
      });
      return;
    }
    if (evt.event === "message") {
      appendAssistant(id, evt.text || "");
      return;
    }
    if (evt.event === "error") {
      appendAssistant(id, `⚠️ ${evt.error || "agent error"}`);
      return;
    }
  }

  function pushEvent(id: string, evt: AgentEvent) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, events: [...(m.events || []), evt] } : m,
      ),
    );
  }

  function appendAssistant(id: string, text: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + (m.content ? "\n\n" : "") + text } : m)),
    );
  }

  const canSend = input.trim().length > 0 && !busy;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all",
          open && "opacity-0 pointer-events-none scale-90",
        )}
        aria-label="Open agent"
        title="Agent (⌘J)"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Scrim */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 h-12 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">Studio Agent</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Active site · {currentSite?.domain || "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close agent"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {messages.length === 0 && (
            <EmptyState onPick={(s) => send(s)} />
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="border-t border-border p-3 shrink-0"
        >
          <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:border-primary/60 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask the agent to write, schedule, or manage content…"
              rows={1}
              disabled={busy}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 min-h-[20px] max-h-32"
              style={{ height: "auto" }}
            />
            <button
              type="submit"
              disabled={!canSend}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for newline · ⌘J to toggle
          </p>
        </form>
      </aside>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <h3 className="text-sm font-semibold">Hey, I'm your content operator.</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          I can write, schedule, and publish posts across your sites, manage
          topics, and tune the auto-posting cadence. Try one of these to get going:
        </p>
      </div>
      <div className="space-y-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="block w-full rounded-md border border-border bg-background/60 px-3 py-2 text-left text-xs text-foreground/90 hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      {message.events && message.events.length > 0 && !isUser && (
        <div className="w-full space-y-1">
          {message.events.map((ev, i) => (
            <EventPill key={i} event={ev} />
          ))}
        </div>
      )}
      {message.content && (
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed",
            isUser
              ? "rounded-lg bg-primary/15 text-foreground px-3 py-2"
              : "text-foreground/90",
          )}
        >
          {message.content}
        </div>
      )}
    </div>
  );
}

function EventPill({ event }: { event: AgentEvent }) {
  if (event.kind === "tool_call") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Wrench className="h-3 w-3 mt-0.5 shrink-0 text-info" />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-foreground/80">{event.name}</span>
          {Object.keys(event.args || {}).length > 0 && (
            <span className="ml-1.5 font-mono text-muted-foreground/80 truncate">
              {compactArgs(event.args)}
            </span>
          )}
        </div>
      </div>
    );
  }
  const Icon = event.ok ? CheckCircle2 : AlertTriangle;
  const color = event.ok ? "text-success" : "text-destructive";
  const draftLink = getDraftLink(event);
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-foreground/90">
      <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        <div className="truncate">{event.summary}</div>
        {draftLink && (
          <Link
            href={draftLink}
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
          >
            Open draft <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function compactArgs(args: Record<string, any>): string {
  const entries = Object.entries(args).slice(0, 3);
  return entries
    .map(([k, v]) => {
      const str = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
      return `${k}=${str.length > 40 ? str.slice(0, 37) + "…\"" : str}`;
    })
    .join(" ");
}

function getDraftLink(event: Extract<AgentEvent, { kind: "tool_result" }>): string | null {
  const id = event.data?.draftId;
  if (!id) return null;
  if (event.name === "write_blog" || event.name === "schedule_draft") {
    return `/posts/${id}`;
  }
  return null;
}

function summarizeResult(name: string, result: any): string {
  if (!result) return name;
  if (result.error) return `${name}: ${result.error}`;
  switch (name) {
    case "write_blog":
      return `Wrote “${result.title}” (${result.site}) — draft ${shortId(result.draftId)}`;
    case "schedule_draft":
      return `Scheduled for ${fmtDate(result.scheduled_publish_at)}`;
    case "publish_draft":
      return `Published — ${result.commitUrl ? "see commit" : "ok"}`;
    case "create_topic":
      return `Topic created: ${result.topic?.title || ""}`;
    case "delete_topic":
      return `Topic deleted ${shortId(result.deleted)}`;
    case "delete_draft":
      return `Draft deleted ${shortId(result.deleted)}`;
    case "move_draft":
      return `Moved "${result.draft?.title || result.draft?.id}" to ${result.movedTo}`;
    case "copy_draft":
      return `Copied to ${result.copiedTo} as "${result.slug}"`;
    case "list_sites":
      return `${(result.sites || []).length} sites`;
    case "list_topics":
      return `${(result.topics || []).length} topics (${result.site || ""})`;
    case "list_drafts":
      return `${(result.drafts || []).length} drafts (${result.site || ""})`;
    case "get_site_settings":
      return `Loaded ${result.site?.domain || "site"}`;
    case "update_site_schedule":
      return `Updated schedule for ${result.site?.domain || ""}`;
    default:
      return name;
  }
}

function shortId(id?: string): string {
  if (!id) return "";
  return id.slice(0, 8);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
