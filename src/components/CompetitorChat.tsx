"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { CompetitorOpportunity } from "@/lib/types";

interface ChatAction {
  type: string;
  urls?: string[];
  url?: string;
  changes?: Partial<CompetitorOpportunity>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: ChatAction[];
  serverResults?: Record<string, unknown>;
}

interface CompetitorChatProps {
  opportunities: CompetitorOpportunity[];
  selectedUrls: string[];
  onAction: (action: ChatAction) => void;
}

export default function CompetitorChat({
  opportunities,
  selectedUrls,
  onAction,
}: CompetitorChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: 'I can help you manage these competitor opportunities. Try "select the top 5 by traffic", "create topics from selected", or "update titles to be SEO-friendly".',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/competitor-analysis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          opportunities,
          selectedUrls,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Chat request failed");
      }

      if (!response.body) {
        throw new Error("No response stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotResponse = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.event === "response") {
              gotResponse = true;
              const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                text: msg.message,
                actions: msg.actions,
                serverResults: msg.serverResults,
              };
              setMessages((prev) => [...prev, assistantMsg]);

              for (const action of msg.actions || []) {
                if (action.type !== "create_topics") {
                  onAction(action);
                }
              }
            } else if (msg.event === "error") {
              throw new Error(msg.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes("JSON")) {
              throw e;
            }
          }
        }
      }

      if (!gotResponse) {
        throw new Error("No response received");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          text: `Sorry, something went wrong: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, opportunities, selectedUrls, onAction]);

  const actionSummary = (msg: ChatMessage) => {
    if (!msg.actions?.length && !msg.serverResults) return null;
    const parts: string[] = [];
    for (const a of msg.actions || []) {
      switch (a.type) {
        case "select":
          parts.push(`Selected ${a.urls?.length || 0} items`);
          break;
        case "deselect":
          parts.push(`Deselected ${a.urls?.length || 0} items`);
          break;
        case "select_all_gaps":
          parts.push("Selected all gaps");
          break;
        case "deselect_all":
          parts.push("Cleared selection");
          break;
        case "update":
          parts.push(`Updated "${a.url?.split("/").pop()}"`);
          break;
        case "remove":
          parts.push(`Removed ${a.urls?.length || 0} items`);
          break;
        case "create_topics": {
          const created = msg.serverResults?.topicsCreated;
          if (typeof created === "number") {
            parts.push(`Created ${created} topics in database`);
          } else if (msg.serverResults?.topicsError) {
            parts.push(`Topic creation failed`);
          }
          break;
        }
      }
    }
    return parts.length > 0 ? parts : null;
  };

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center hover:scale-105"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[520px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}
                >
                  <div
                    className={`inline-block rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === "assistant" && (() => {
                    const summary = actionSummary(msg);
                    if (!summary) return null;
                    return (
                      <div className="mt-1.5 space-y-1">
                        {summary.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-xs text-green-600"
                          >
                            <CheckCircle className="h-3 w-3" />
                            {s}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="inline-block rounded-lg px-3 py-2 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to select, update, or create topics..."
                className="text-sm h-9"
                disabled={loading}
              />
              <Button
                type="submit"
                size="sm"
                className="h-9 px-3"
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
