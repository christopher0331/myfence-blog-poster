"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Plus,
  Zap,
  CheckCircle2,
  Pencil,
  TrendingUp,
} from "lucide-react";
import { draftsApi } from "@/lib/api";
import { useSite } from "@/lib/site-context";
import type { BlogDraft } from "@/lib/types";

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const target = new Date(iso);
  const today = new Date();
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((t.getTime() - n.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { currentSite } = useSite();
  const [drafts, setDrafts] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const all = await draftsApi.getAll({ order: "updated_at", ascending: false });
        setDrafts(all);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const metrics = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const in7days = drafts.filter((d) => {
      if (!d.scheduled_publish_at) return false;
      const t = new Date(d.scheduled_publish_at).getTime();
      return d.status === "scheduled" && t >= now && t - now <= weekMs;
    });
    const published = drafts.filter((d) => d.status === "published");
    const publishedLast30 = published.filter((d) => {
      if (!d.published_at) return false;
      return now - new Date(d.published_at).getTime() <= 30 * 24 * 60 * 60 * 1000;
    });
    const toWrite = drafts.filter((d) => d.status === "draft");
    const inReview = drafts.filter((d) => d.status === "review");
    return {
      in7days: in7days.length,
      publishedLast30: publishedLast30.length,
      toWrite: toWrite.length,
      inReview: inReview.length,
    };
  }, [drafts]);

  const scheduled = useMemo(
    () =>
      drafts
        .filter((d) => d.status === "scheduled" && d.scheduled_publish_at)
        .sort(
          (a, b) =>
            new Date(a.scheduled_publish_at!).getTime() -
            new Date(b.scheduled_publish_at!).getTime(),
        ),
    [drafts],
  );

  const recent = useMemo(
    () =>
      drafts
        .filter((d) => d.status === "published" && d.published_at)
        .slice(0, 5),
    [drafts],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {currentSite?.name || "Studio"} overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled content pipeline and recent activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/topics")}>
            Topics
          </Button>
          <Button size="sm" onClick={() => router.push("/posts")}>
            <Plus className="h-4 w-4" />
            New post
          </Button>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="This week"
          value={metrics.in7days}
          hint={metrics.in7days === 1 ? "scheduled" : "scheduled"}
          accent="info"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Published (30d)"
          value={metrics.publishedLast30}
          hint="articles"
          accent="success"
        />
        <MetricCard
          icon={<Pencil className="h-4 w-4" />}
          label="Drafts"
          value={metrics.toWrite}
          hint="in progress"
          accent="default"
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="In review"
          value={metrics.inReview}
          hint="awaiting approval"
          accent="warning"
        />
      </div>

      {/* Two-column: upcoming + recent */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Upcoming schedule</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/posts")}>
              View all
            </Button>
          </div>
          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </Card>
          ) : scheduled.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium mb-1">Nothing scheduled</p>
              <p className="text-xs text-muted-foreground mb-3">
                Mark topics as <span className="font-mono">ready</span> and the system will
                auto-schedule 2 posts/week
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/topics")}
              >
                Go to topics
              </Button>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {scheduled.map((post) => {
                const d = daysUntil(post.scheduled_publish_at);
                return (
                  <Card
                    key={post.id}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors"
                    onClick={() => router.push(`/posts/${post.id}`)}
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted/40 text-center">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {new Date(post.scheduled_publish_at!).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-sm font-semibold leading-tight">
                        {new Date(post.scheduled_publish_at!).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">
                        {post.title || "Untitled"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(post.scheduled_publish_at)}
                        {post.category && (
                          <>
                            <span>·</span>
                            <span className="truncate">{post.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {d !== null && d >= 0 && (
                      <Badge variant={d <= 1 ? "warning" : "default"}>
                        {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d}d`}
                      </Badge>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Recently published</h2>
          </div>
          {recent.length === 0 ? (
            <Card className="p-6 text-center text-xs text-muted-foreground">
              No published posts yet
            </Card>
          ) : (
            <div className="space-y-1.5">
              {recent.map((post) => (
                <Card
                  key={post.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors"
                  onClick={() => router.push(`/posts/${post.id}`)}
                >
                  <div className="h-8 w-8 shrink-0 rounded bg-success/15 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {post.title || "Untitled"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {post.published_at &&
                        new Date(post.published_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "success" | "warning" | "info";
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : accent === "info"
          ? "text-info"
          : "text-muted-foreground";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={accentClass}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
