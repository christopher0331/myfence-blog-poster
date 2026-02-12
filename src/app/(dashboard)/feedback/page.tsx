"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Loader2,
  ImagePlus,
  ChevronRight,
  User,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

type FeedbackThread = {
  id: string;
  subject: string | null;
  author: "client" | "owner";
  status: string;
  message: string;
  image_urls: string[];
  created_at: string;
  replyCount?: number;
};

type ThreadWithReplies = FeedbackThread & { replies: FeedbackThread[] };

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBlock({
  author,
  message,
  image_urls,
  created_at,
}: {
  author: "client" | "owner";
  message: string;
  image_urls: string[];
  created_at: string;
}) {
  const isOwner = author === "owner";
  return (
    <div
      className={`rounded-lg border p-4 ${
        isOwner ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {isOwner ? (
          <ShieldCheck className="h-4 w-4 text-primary" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{isOwner ? "You" : "Client"}</span>
        <span className="text-xs text-muted-foreground">{formatDate(created_at)}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap mb-3">{message}</p>
      {image_urls && image_urls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {image_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md overflow-hidden border border-border hover:opacity-90"
            >
              <img src={url} alt="" className="h-24 w-auto object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadWithReplies | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      const data = await res.json();
      if (res.ok) setThreads(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = async (id: string) => {
    setSelectedThread(null);
    try {
      const res = await fetch(`/api/feedback?thread=${id}`);
      const data = await res.json();
      if (res.ok) setSelectedThread(data);
    } catch (e) {
      console.error(e);
    }
    setReplyMessage("");
    setReplyImages([]);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok && selectedThread?.id === id) {
        setSelectedThread((t) => (t ? { ...t, status } : null));
      }
      loadThreads();
    } catch (e) {
      console.error(e);
    }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/feedback/upload", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        setReplyImages((prev) => [...prev, data.url]);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread || !replyMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_id: selectedThread.id,
          message: replyMessage.trim(),
          image_urls: replyImages,
          author: "owner",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyMessage("");
        setReplyImages([]);
        openThread(selectedThread.id);
        loadThreads();
      } else {
        alert(data.error || "Failed to send reply");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const filteredThreads =
    statusFilter === "all"
      ? threads
      : threads.filter((t) => t.status === statusFilter);

  const clientSubmitUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/submit-feedback`
      : "/submit-feedback";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Client Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Change requests and suggestions from your client. Reply here and track status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Client submit link:</span>
          <Button variant="outline" size="sm" asChild>
            <a href={clientSubmitUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open submit page
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Requests</CardTitle>
            <div className="pt-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full"
              >
                <option value="all">All</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No feedback yet. Share the submit link with your client.
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredThreads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selectedThread?.id === t.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {t.subject || "No subject"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(t.replyCount ?? 0)} reply · {formatDate(t.created_at)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant={
                            t.status === "resolved"
                              ? "default"
                              : t.status === "in_progress"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px]"
                        >
                          {STATUS_OPTIONS.find((o) => o.value === t.status)?.label ?? t.status}
                        </Badge>
                        {t.author === "client" && (
                          <Badge variant="outline" className="text-[10px]">
                            Client
                          </Badge>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Thread detail + reply */}
        <Card className="lg:col-span-2">
          <CardHeader>
            {selectedThread ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg">
                  {selectedThread.subject || "No subject"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Select
                    value={selectedThread.status}
                    onChange={(e) => updateStatus(selectedThread.id, e.target.value)}
                    className="w-[140px]"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <CardTitle className="text-lg text-muted-foreground">
                Select a request to view and reply
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedThread ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Choose a thread from the list to read the full conversation and add your reply.
              </p>
            ) : (
              <>
                <MessageBlock
                  author={selectedThread.author}
                  message={selectedThread.message}
                  image_urls={selectedThread.image_urls || []}
                  created_at={selectedThread.created_at}
                />
                {(selectedThread.replies || []).map((r) => (
                  <MessageBlock
                    key={r.id}
                    author={r.author}
                    message={r.message}
                    image_urls={r.image_urls || []}
                    created_at={r.created_at}
                  />
                ))}

                <div className="border-t pt-4 mt-6">
                  <p className="text-sm font-medium mb-2">Your reply</p>
                  <Textarea
                    placeholder="Type your response…"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                    className="mb-3"
                  />
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {replyImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={url}
                          alt=""
                          className="h-20 w-auto rounded border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReplyImages((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(f);
                          e.target.value = "";
                        }}
                      />
                      <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        Add image
                      </span>
                    </label>
                  </div>
                  <Button
                    onClick={sendReply}
                    disabled={!replyMessage.trim() || sending}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send reply
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
