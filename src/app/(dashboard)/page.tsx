"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Image as ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { draftsApi } from "@/lib/api";
import type { BlogDraft } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [scheduled, setScheduled] = useState<BlogDraft[]>([]);
  const [upcoming, setUpcoming] = useState<BlogDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const now = new Date().toISOString();
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get scheduled posts
        const scheduledData = await draftsApi.getAll({
          status: "scheduled",
          scheduledDateNotNull: true,
          order: "scheduled_date",
          ascending: true,
        });

        // Get upcoming posts (next 7 days)
        const upcomingData = await draftsApi.getAll({
          status: "scheduled",
          scheduledDateGte: now,
          scheduledDateLte: nextWeek,
          order: "scheduled_date",
          ascending: true,
        });

        setScheduled(scheduledData);
        setUpcoming(upcomingData);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getDaysUntil = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Scheduled Posts</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your upcoming blog content
          </p>
        </div>
        <Button onClick={() => router.push("/posts")} className="w-full sm:w-auto min-h-[44px] touch-manipulation">
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading scheduled posts...</p>
        </div>
      ) : scheduled.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled posts</h3>
            <p className="text-muted-foreground mb-4">
              Schedule posts to see them here. Posts are automatically written by AI based on your research topics.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push("/topics")} variant="outline">
                Manage Topics
              </Button>
              <Button onClick={() => router.push("/posts")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Upcoming (Next 7 Days) */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Upcoming This Week</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((post) => {
                  const daysUntil = getDaysUntil(post.scheduled_date);
                  return (
                    <Card
                      key={post.id}
                      className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                      onClick={() => router.push(`/posts/${post.id}`)}
                    >
                      <CardContent className="p-0">
                        {post.featured_image ? (
                          <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.featured_image}
                              alt={post.title || "Post image"}
                              className="w-full h-full object-cover"
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
                            {daysUntil !== null && daysUntil >= 0 && (
                              <Badge variant={daysUntil <= 1 ? "warning" : "secondary"}>
                                {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                              </Badge>
                            )}
                          </div>
                          {post.meta_description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {post.meta_description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(post.scheduled_date)}</span>
                            </div>
                            {post.read_time && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{post.read_time}</span>
                              </div>
                            )}
                          </div>
                          {post.category && (
                            <Badge variant="outline" className="text-xs">
                              {post.category}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Scheduled Posts */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              All Scheduled Posts ({scheduled.length})
            </h2>
            <div className="space-y-3">
              {scheduled.map((post) => {
                const daysUntil = getDaysUntil(post.scheduled_date);
                return (
                  <Card
                    key={post.id}
                    className="cursor-pointer hover:shadow-md transition-all"
                    onClick={() => router.push(`/posts/${post.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {post.featured_image ? (
                          <div className="relative w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={post.featured_image}
                              alt={post.title || "Post image"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-32 h-24 flex-shrink-0 bg-muted rounded-lg flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">
                                {post.title || "Untitled Post"}
                              </h3>
                              {post.meta_description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                  {post.meta_description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {daysUntil !== null && daysUntil >= 0 && (
                                <Badge variant={daysUntil <= 1 ? "warning" : "secondary"}>
                                  {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                                </Badge>
                              )}
                              <Badge variant="outline">
                                {formatDate(post.scheduled_date)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {post.category && (
                              <Badge variant="outline" className="text-xs">
                                {post.category}
                              </Badge>
                            )}
                            {post.read_time && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{post.read_time}</span>
                              </div>
                            )}
                            <span className="text-xs">/blog/{post.slug}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
