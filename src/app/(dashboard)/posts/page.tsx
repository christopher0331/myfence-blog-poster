"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText } from "lucide-react";
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
            {drafts.length} posts total — preview how they'll look on myfence.com
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
        <div className="space-y-10">
          {groups.map((group) => (
            <div key={group.key}>
              <h2 className="text-xl font-semibold mb-4">
                {group.label} ({group.items.length})
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {group.items.map((post) => {
                  const overall = calcOverall(post);
                  return (
                    <Card
                      key={post.id}
                      className="group cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col"
                      onClick={() => router.push(`/posts/${post.id}`)}
                    >
                      <CardHeader className="p-0 relative">
                        {/* Image with 4:3 aspect ratio — matching myfence.com */}
                        <div className="relative" style={{ aspectRatio: "4/3" }}>
                          {post.featured_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.featured_image}
                              alt={post.title || "Post image"}
                              className="w-full h-full object-cover rounded-t-lg group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center rounded-t-lg text-muted-foreground text-sm">
                              No image
                            </div>
                          )}
                        </div>

                        {/* Status badge overlay */}
                        <Badge
                          variant={statusVariant(post.status)}
                          className="absolute top-2 right-2 text-xs shadow-sm"
                        >
                          {post.status}
                        </Badge>
                      </CardHeader>

                      <CardContent className="p-5 flex-1 flex flex-col">
                        {/* Category + read time */}
                        <div className="flex items-center gap-2 mb-3">
                          {post.category && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                              {post.category}
                            </span>
                          )}
                          {post.read_time && (
                            <span className="text-xs text-muted-foreground">
                              {post.read_time}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <CardTitle className="text-lg mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                          {post.title || "Untitled Post"}
                        </CardTitle>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                          {post.meta_description || "No description yet..."}
                        </p>

                        {/* Completeness bar */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
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
                            "text-xs font-semibold",
                            overall >= 80 ? "text-green-600" :
                            overall >= 50 ? "text-yellow-600" : "text-red-500"
                          )}>
                            {overall}%
                          </span>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t">
                          <span className="text-xs text-muted-foreground">
                            {post.published_at
                              ? new Date(post.published_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                              : post.scheduled_publish_at
                              ? `Scheduled: ${new Date(post.scheduled_publish_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                              : `Updated ${new Date(post.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                          </span>
                          <Button variant="outline" size="sm" className="text-xs">
                            Edit Post
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
