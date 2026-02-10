"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { BlogDraft } from "@/lib/types";

export default function SchedulePage() {
  const [scheduled, setScheduled] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("blog_drafts")
        .select("*")
        .not("scheduled_date", "is", null)
        .order("scheduled_date", { ascending: true });

      setScheduled((data || []) as BlogDraft[]);
      setLoading(false);
    }
    load();
  }, []);

  // Group by month
  const grouped = scheduled.reduce(
    (acc, draft) => {
      if (!draft.scheduled_date) return acc;
      const month = new Date(draft.scheduled_date).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      if (!acc[month]) acc[month] = [];
      acc[month].push(draft);
      return acc;
    },
    {} as Record<string, BlogDraft[]>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-1">
          View and manage scheduled blog posts
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading schedule...</p>
      ) : scheduled.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled posts</h3>
            <p className="text-muted-foreground">
              Set a schedule date on a blog post to see it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, drafts]) => (
            <div key={month}>
              <h2 className="text-xl font-semibold mb-4">{month}</h2>
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <Card key={draft.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-16 text-center">
                        <div className="text-2xl font-bold text-primary">
                          {draft.scheduled_date
                            ? new Date(draft.scheduled_date).getDate()
                            : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {draft.scheduled_date
                            ? new Date(draft.scheduled_date).toLocaleDateString("en-US", {
                                weekday: "short",
                              })
                            : ""}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/posts/${draft.id}`}
                          className="font-semibold hover:text-primary transition-colors truncate block"
                        >
                          {draft.title || "Untitled"}
                        </a>
                        <p className="text-sm text-muted-foreground truncate">
                          /blog/{draft.slug}
                          {draft.category && ` · ${draft.category}`}
                        </p>
                      </div>
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
