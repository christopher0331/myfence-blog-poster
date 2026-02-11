"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Image as ImageIcon, Calendar, Clock, FileText, CheckCircle, Circle, AlertCircle } from "lucide-react";
import { draftsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
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
      d.slug?.toLowerCase().includes(search.toLowerCase()) ||
      d.category?.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByStatus = {
    scheduled: filtered.filter((d) => d.status === "scheduled"),
    review: filtered.filter((d) => d.status === "review"),
    draft: filtered.filter((d) => d.status === "draft"),
    published: filtered.filter((d) => d.status === "published"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Posts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your blog content library
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
          placeholder="Search posts by title, slug, or category..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading posts...</p>
        </div>
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
          {/* Scheduled Posts */}
          {groupedByStatus.scheduled.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Scheduled ({groupedByStatus.scheduled.length})
              </h2>
              <div className="space-y-3">
                {groupedByStatus.scheduled.map((post) => (
                  <PostRow key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* In Review */}
          {groupedByStatus.review.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                In Review ({groupedByStatus.review.length})
              </h2>
              <div className="space-y-3">
                {groupedByStatus.review.map((post) => (
                  <PostRow key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Drafts */}
          {groupedByStatus.draft.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Drafts ({groupedByStatus.draft.length})
              </h2>
              <div className="space-y-3">
                {groupedByStatus.draft.map((post) => (
                  <PostRow key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Published */}
          {groupedByStatus.published.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                Published ({groupedByStatus.published.length})
              </h2>
              <div className="space-y-3">
                {groupedByStatus.published.map((post) => (
                  <PostRow key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostRow({ post, onClick }: { post: BlogDraft; onClick: () => void }) {
  const statusColor = (status: string) => {
    switch (status) {
      case "published": return "success" as const;
      case "scheduled": return "warning" as const;
      case "review": return "default" as const;
      case "failed": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  const completenessFields = [
    { label: "Title", key: "title", value: post.completeness?.title ?? 0 },
    { label: "Body", key: "body", value: post.completeness?.body ?? 0 },
    { label: "Meta", key: "meta_description", value: post.completeness?.meta_description ?? 0 },
    { label: "Image", key: "image", value: post.completeness?.image ?? 0 },
    { label: "Category", key: "category", value: post.completeness?.category ?? 0 },
    { label: "Data", key: "structured_data", value: post.completeness?.structured_data ?? 0 },
  ];

  const overall = Math.round(
    completenessFields.reduce((sum, f) => sum + f.value, 0) / completenessFields.length
  );

  // Strip markdown for preview
  const contentPreview = post.body_mdx
    ? post.body_mdx
        .replace(/```[\s\S]*?```/g, "") // Remove code blocks
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Remove links but keep text
        .replace(/#{1,6}\s+/g, "") // Remove headers
        .replace(/\*\*([^\*]+)\*\*/g, "$1") // Remove bold
        .replace(/\*([^\*]+)\*/g, "$1") // Remove italic
        .replace(/\n+/g, " ") // Replace newlines with spaces
        .trim()
        .substring(0, 200)
    : "";

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex gap-4">
          {/* Completeness Sidebar - Far Left */}
          <div className="w-32 flex-shrink-0 border-r bg-muted/30 p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Complete
                </span>
                <span
                  className={cn(
                    "text-sm font-bold",
                    overall >= 80 ? "text-green-600" : overall >= 50 ? "text-yellow-600" : "text-red-500"
                  )}
                >
                  {overall}%
                </span>
              </div>
              <Progress value={overall} className="h-2" />
              <div className="space-y-1.5">
                {completenessFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-1.5 text-xs">
                    {field.value >= 100 ? (
                      <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                    ) : field.value > 0 ? (
                      <AlertCircle className="h-3 w-3 text-yellow-600 flex-shrink-0" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground truncate">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-4 space-y-3">
            {/* Row 1: Post Details */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg truncate">
                    {post.title || "Untitled Post"}
                  </h3>
                  <Badge variant={statusColor(post.status)} className="flex-shrink-0">
                    {post.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {post.category && (
                    <Badge variant="outline" className="text-xs">
                      {post.category}
                    </Badge>
                  )}
                  <span className="truncate">/blog/{post.slug}</span>
                  {post.scheduled_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(post.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {post.read_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{post.read_time}</span>
                    </div>
                  )}
                  {post.published_at && (
                    <span className="text-muted-foreground">
                      Published {new Date(post.published_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Preview (Meta Description) */}
            {post.meta_description && (
              <div className="pb-3 border-b">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {post.meta_description}
                </p>
              </div>
            )}

            {/* Row 3: Content Preview */}
            {contentPreview && (
              <div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {contentPreview}
                  {contentPreview.length >= 200 && "..."}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
