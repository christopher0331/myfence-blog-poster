"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import type { BlogDraft } from "@/lib/types";

export default function PostsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDrafts();
  }, []);

  async function loadDrafts() {
    const { data, error } = await supabase
      .from("blog_drafts")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data) setDrafts(data as BlogDraft[]);
    setLoading(false);
  }

  async function createNewDraft() {
    const slug = `new-post-${Date.now()}`;
    const { data, error } = await supabase
      .from("blog_drafts")
      .insert({
        slug,
        title: "",
        status: "draft",
      })
      .select()
      .single();

    if (!error && data) {
      router.push(`/posts/${data.id}`);
    }
  }

  function getOverallCompleteness(completeness: BlogDraft["completeness"]) {
    if (!completeness) return 0;
    const values = Object.values(completeness);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "published": return "success" as const;
      case "scheduled": return "warning" as const;
      case "review": return "default" as const;
      case "failed": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  const filtered = drafts.filter(
    (d) =>
      d.title?.toLowerCase().includes(search.toLowerCase()) ||
      d.slug?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Posts</h1>
          <p className="text-muted-foreground mt-1">
            Create, edit, and publish blog content
          </p>
        </div>
        <Button onClick={createNewDraft}>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search posts..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Posts List */}
      {loading ? (
        <p className="text-muted-foreground">Loading posts...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first blog post to get started
            </p>
            <Button onClick={createNewDraft}>
              <Plus className="h-4 w-4 mr-2" />
              Create Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => {
            const completeness = getOverallCompleteness(draft.completeness);
            return (
              <Card
                key={draft.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/posts/${draft.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold truncate">
                          {draft.title || "Untitled Post"}
                        </h3>
                        <Badge variant={statusColor(draft.status)}>
                          {draft.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        /blog/{draft.slug}
                        {draft.category && ` · ${draft.category}`}
                        {draft.read_time && ` · ${draft.read_time}`}
                      </p>
                    </div>
                    <div className="w-32 flex-shrink-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Completeness</span>
                        <span>{completeness}%</span>
                      </div>
                      <Progress value={completeness} />
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
