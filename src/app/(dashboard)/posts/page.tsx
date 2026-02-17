"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, FileText, Calendar, Clock } from "lucide-react";
import { draftsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BlogDraft } from "@/lib/types";

function calcOverall(post: BlogDraft): number {
  const scores = [
    post.title?.trim() ? 100 : 0,
    post.body_mdx?.trim()
      ? post.body_mdx.length > 2000
        ? 100
        : Math.round((post.body_mdx.length / 2000) * 100)
      : 0,
    post.meta_description?.trim()
      ? post.meta_description.length >= 120
        ? 100
        : Math.round((post.meta_description.length / 120) * 100)
      : 0,
    post.featured_image?.trim() ? 100 : 0,
    post.category?.trim() ? 100 : 0,
    post.title && post.meta_description && post.category ? 100 : 0,
  ];
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export default function PostsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDrafts();
  }, []);

  async function loadDrafts() {
    try {
      const data = await draftsApi.getAll({
        order: "updated_at",
        ascending: false,
      });
      setDrafts(data);
    } catch (err) {
      console.error("Failed to load drafts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createNewDraft() {
    try {
      const data = await draftsApi.create({
        slug: `new-post-${Date.now()}`,
        title: "",
        status: "draft",
      });
      router.push(`/posts/${data.id}`);
    } catch (err) {
      console.error("Failed to create draft:", err);
    }
  }

  const statusVariant = (status: string) => {
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
      d.slug?.toLowerCase().includes(search.toLowerCase()) ||
      d.category?.toLowerCase().includes(search.toLowerCase())
  );

  const groups = [
    { key: "scheduled", label: "Scheduled", items: filtered.filter((d) => d.status === "scheduled") },
    { key: "review", label: "In Review", items: filtered.filter((d) => d.status === "review") },
    { key: "draft", label: "Drafts", items: filtered.filter((d) => d.status === "draft") },
    { key: "published", label: "Published", items: filtered.filter((d) => d.status === "published") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">All Posts</h1>
          <p className="text-sm text-muted-foreground">
            {drafts.length} posts total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={createNewDraft} size="sm" className="h-9 shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground mb-4">
            {search ? "No posts match your search" : "No posts yet"}
          </p>
          {!search && (
            <Button onClick={createNewDraft} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Create Post
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {group.label} ({group.items.length})
              </h2>
              <div className="border rounded-lg divide-y bg-card">
                {group.items.map((post) => {
                  const overall = calcOverall(post);
                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => router.push(`/posts/${post.id}`)}
                    >
                      {/* Completeness ring */}
                      <div className="w-10 h-10 shrink-0 relative flex items-center justify-center">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18" cy="18" r="15.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-muted/40"
                          />
                          <circle
                            cx="18" cy="18" r="15.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={`${overall * 0.974} 100`}
                            strokeLinecap="round"
                            className={cn(
                              overall >= 80 ? "text-green-500" :
                              overall >= 50 ? "text-yellow-500" : "text-red-400"
                            )}
                          />
                        </svg>
                        <span className="absolute text-[10px] font-bold">{overall}</span>
                      </div>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {post.title || "Untitled Post"}
                          </span>
                          <Badge variant={statusVariant(post.status)} className="text-[10px] px-1.5 py-0 shrink-0">
                            {post.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {post.category && (
                            <span className="truncate">{post.category}</span>
                          )}
                          <span className="truncate">/blog/{post.slug}</span>
                        </div>
                      </div>

                      {/* Right-side metadata */}
                      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        {post.read_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.read_time}
                          </div>
                        )}
                        {post.scheduled_publish_at && post.status === "scheduled" && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.scheduled_publish_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                        {post.published_at && (
                          <span>
                            {new Date(post.published_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        <span className="text-muted-foreground/60 w-20 text-right">
                          {new Date(post.updated_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
