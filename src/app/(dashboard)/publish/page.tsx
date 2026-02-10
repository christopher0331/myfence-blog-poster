"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { BlogDraft } from "@/lib/types";

export default function PublishPage() {
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; prUrl?: string; error?: string }>>({});

  useEffect(() => {
    loadPublishable();
  }, []);

  async function loadPublishable() {
    const { data } = await supabase
      .from("blog_drafts")
      .select("*")
      .in("status", ["review", "scheduled", "published"])
      .order("updated_at", { ascending: false });

    setDrafts((data || []) as BlogDraft[]);
    setLoading(false);
  }

  async function publishDraft(draftId: string) {
    setPublishing(draftId);
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      const data = await res.json();

      if (data.success) {
        setResults((prev) => ({ ...prev, [draftId]: { success: true, prUrl: data.prUrl } }));
        // Refresh the list
        loadPublishable();
      } else {
        setResults((prev) => ({ ...prev, [draftId]: { success: false, error: data.error } }));
      }
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [draftId]: { success: false, error: err.message },
      }));
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Publish Queue</h1>
        <p className="text-muted-foreground mt-1">
          Review and publish blog posts to myfence.com via GitHub PR
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Send className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nothing to publish</h3>
            <p className="text-muted-foreground">
              Submit posts for review from the Blog Posts editor to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const result = results[draft.id];
            return (
              <Card key={draft.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold truncate">
                          {draft.title || "Untitled"}
                        </h3>
                        <Badge
                          variant={
                            draft.status === "published"
                              ? "success"
                              : draft.status === "scheduled"
                              ? "warning"
                              : "secondary"
                          }
                        >
                          {draft.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        /blog/{draft.slug}
                        {draft.scheduled_date && ` · Scheduled: ${draft.scheduled_date}`}
                      </p>
                      {draft.github_pr_url && (
                        <a
                          href={draft.github_pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View PR
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {result?.success && (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          PR Created
                        </div>
                      )}
                      {result?.error && (
                        <div className="flex items-center gap-1 text-destructive text-sm max-w-[200px] truncate">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          {result.error}
                        </div>
                      )}
                      {draft.status !== "published" && (
                        <Button
                          onClick={() => publishDraft(draft.id)}
                          disabled={publishing === draft.id}
                          size="sm"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {publishing === draft.id ? "Publishing..." : "Publish"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
