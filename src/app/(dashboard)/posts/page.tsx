"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, Clock, Image as ImageIcon } from "lucide-react";
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">All Posts</h1>
          <p className="text-muted-foreground mt-1">
            {drafts.length} posts total
          </p>
        </div>
        <Button onClick={createNewDraft} className="w-full sm:w-auto min-h-[44px] touch-manipulation">
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title, slug, or category..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading posts...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Try a different search term" : "Create your first blog post to get started"}
            </p>
            {!search && (
              <Button onClick={createNewDraft}>
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="text-xl font-semibold mb-4">
                {group.label} ({group.items.length})
              </h2>
              <div className="space-y-3">
                {group.items.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    statusVariant={statusVariant}
                    onClick={() => router.push(`/posts/${post.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  statusVariant,
  onClick,
}: {
  post: BlogDraft;
  statusVariant: (s: string) => "success" | "warning" | "default" | "destructive" | "secondary";
  onClick: () => void;
}) {
  const overall = calcOverall(post);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          {post.featured_image ? (
            <div className="relative w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.featured_image}
                alt={post.title || "Post image"}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-28 h-20 flex-shrink-0 bg-muted rounded-lg flex items-center justify-center">
              <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-base sm:text-lg line-clamp-1">
                {post.title || "Untitled Post"}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={statusVariant(post.status)} className="text-xs">
                  {post.status}
                </Badge>
              </div>
            </div>

            {/* Meta description */}
            {post.meta_description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {post.meta_description}
              </p>
            )}

            {/* Bottom metadata row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              {/* Completeness */}
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overall >= 80 ? "bg-green-500" :
                      overall >= 50 ? "bg-yellow-500" : "bg-red-400"
                    )}
                    style={{ width: `${overall}%` }}
                  />
                </div>
                <span className={cn(
                  "font-medium",
                  overall >= 80 ? "text-green-600" :
                  overall >= 50 ? "text-yellow-600" : "text-red-500"
                )}>
                  {overall}%
                </span>
              </div>

              {post.category && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {post.category}
                </Badge>
              )}

              <span className="hidden sm:inline truncate">/blog/{post.slug}</span>

              {post.read_time && (
                <div className="hidden sm:flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{post.read_time}</span>
                </div>
              )}

              {post.scheduled_publish_at && post.status === "scheduled" && (
                <div className="hidden sm:flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(post.scheduled_publish_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}

              {post.published_at && (
                <span className="hidden sm:inline">
                  Published {new Date(post.published_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}

              <span className="ml-auto text-muted-foreground/50 hidden sm:inline">
                Updated {new Date(post.updated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
