"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Image as ImageIcon, ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { draftsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSite } from "@/lib/site-context";
import type { BlogDraft } from "@/lib/types";

type StatusFilter = "all" | "draft" | "review" | "scheduled" | "published" | "failed";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

function statusBadge(status: string) {
  switch (status) {
    case "published":
      return <Badge variant="success">● Published</Badge>;
    case "scheduled":
      return <Badge variant="warning">● Scheduled</Badge>;
    case "review":
      return <Badge variant="info">● In review</Badge>;
    case "failed":
      return <Badge variant="destructive">● Failed</Badge>;
    default:
      return <Badge variant="default">● Draft</Badge>;
  }
}

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
  ];
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PostsPage() {
  const router = useRouter();
  const { currentSite } = useSite();
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.title?.toLowerCase().includes(q) ||
        d.slug?.toLowerCase().includes(q) ||
        d.category?.toLowerCase().includes(q)
      );
    });
  }, [drafts, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: drafts.length };
    for (const d of drafts) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [drafts]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {drafts.length} {drafts.length === 1 ? "post" : "posts"} on{" "}
            <span className="font-mono text-foreground/80">
              {currentSite?.domain || "your site"}
            </span>
          </p>
        </div>
        <Button onClick={createNewDraft} size="sm">
          <Plus className="h-4 w-4" />
          New post
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, slug, category…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded px-1 text-[10px]",
                  statusFilter === f.value
                    ? "bg-muted text-muted-foreground"
                    : "bg-muted/50 text-muted-foreground/70",
                )}
              >
                {counts[f.value] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Loading posts…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="text-sm font-semibold mb-1">No posts found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search || statusFilter !== "all"
              ? "Try changing filters"
              : "Start by creating your first post"}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={createNewDraft} size="sm">
              <Plus className="h-4 w-4" />
              Create post
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44%]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-32">Quality</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((post) => {
                const overall = calcOverall(post);
                const schedule = post.scheduled_publish_at;
                const published = post.published_at;
                return (
                  <TableRow
                    key={post.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/posts/${post.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-12 shrink-0 overflow-hidden rounded border border-border bg-muted">
                          {post.featured_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.featured_image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">
                            {post.title || <span className="text-muted-foreground italic">Untitled</span>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground font-mono">
                            /{post.slug}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(post.status)}</TableCell>
                    <TableCell>
                      {post.category ? (
                        <Badge variant="outline" className="font-normal">
                          {post.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              overall >= 80
                                ? "bg-success"
                                : overall >= 50
                                  ? "bg-warning"
                                  : "bg-destructive",
                            )}
                            style={{ width: `${overall}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {overall}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {published ? (
                        <span className="text-success">
                          Published {formatRelative(published)}
                        </span>
                      ) : schedule ? (
                        formatDateTime(schedule)
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatRelative(post.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground/60" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
