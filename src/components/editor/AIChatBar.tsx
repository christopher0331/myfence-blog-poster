"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, Loader2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  type?: "edit" | "note" | "error";
}

interface AIChatBarProps {
  bodyMdx: string;
  title: string;
  metaDescription: string;
  onApplyEdit: (newContent: string) => void;
}

export default function AIChatBar({
  bodyMdx,
  title,
  metaDescription,
  onApplyEdit,
}: AIChatBarProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [previousBody, setPreviousBody] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const instruction = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: instruction }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          bodyMdx,
          title,
          metaDescription,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI edit failed");
      }

      if (data.type === "note") {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: data.message, type: "note" },
        ]);
      } else {
        setPreviousBody(bodyMdx);
        onApplyEdit(data.content);
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: "Edit applied to article.", type: "edit" },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: err.message, type: "error" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (previousBody !== null) {
      onApplyEdit(previousBody);
      setPreviousBody(null);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Edit undone.", type: "note" },
      ]);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium transition-colors w-full"
      >
        <Sparkles className="h-4 w-4" />
        AI Editor — Click to give instructions for editing this article
      </button>
    );
  }

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-800">
            <Sparkles className="h-4 w-4" />
            AI Editor
          </div>
          <div className="flex items-center gap-1">
            {previousBody !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                className="h-7 text-xs text-purple-700 hover:text-purple-900"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Undo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 w-7 p-0 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat messages */}
        {messages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md px-3 py-1.5",
                  msg.role === "user"
                    ? "bg-purple-100 text-purple-900 ml-8"
                    : msg.type === "error"
                    ? "bg-red-100 text-red-800 mr-8"
                    : msg.type === "edit"
                    ? "bg-green-100 text-green-800 mr-8"
                    : "bg-white text-foreground mr-8 border"
                )}
              >
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Make the intro more engaging, add a section about vinyl fencing..."
            disabled={loading}
            className="flex-1 bg-white"
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
