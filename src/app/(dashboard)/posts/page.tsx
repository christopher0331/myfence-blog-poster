"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Image as ImageIcon, Calendar, Clock, FileText } from "lucide-react";
import { draftsApi } from "@/lib/api";
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByStatus.scheduled.map((post) => (
                  <PostCard key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByStatus.review.map((post) => (
                  <PostCard key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByStatus.draft.map((post) => (
                  <PostCard key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedByStatus.published.map((post) => (
                  <PostCard key={post.id} post={post} onClick={() => router.push(`/posts/${post.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onClick }: { post: BlogDraft; onClick: () => void }) {
  const statusColor = (status: string) => {
    switch (status) {
      case "published": return "success" as const;
      case "scheduled": return "warning" as const;
      case "review": return "default" as const;
      case "failed": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
      onClick={onClick}
    >
      <CardContent className="p-0">
        {post.featured_image ? (
          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featured_image}
              alt={post.title || "Post image"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="h-48 w-full bg-muted flex items-center justify-center rounded-t-lg">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg line-clamp-2 flex-1">
              {post.title || "Untitled Post"}
            </h3>
            <Badge variant={statusColor(post.status)} className="flex-shrink-0">
              {post.status}
            </Badge>
          </div>
          {post.meta_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {post.meta_description}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
            {post.scheduled_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{new Date(post.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            )}
            {post.read_time && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{post.read_time}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {post.category && (
              <Badge variant="outline" className="text-xs">
                {post.category}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground truncate">/blog/{post.slug}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
