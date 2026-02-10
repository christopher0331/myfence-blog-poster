"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Lightbulb, Calendar, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DashboardStats {
  totalDrafts: number;
  totalTopics: number;
  scheduledPosts: number;
  publishedPosts: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDrafts: 0,
    totalTopics: 0,
    scheduledPosts: 0,
    publishedPosts: 0,
  });
  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [draftsRes, topicsRes, scheduledRes, publishedRes, recentRes] =
          await Promise.all([
            supabase.from("blog_drafts").select("id", { count: "exact", head: true }),
            supabase.from("blog_topics").select("id", { count: "exact", head: true }),
            supabase.from("blog_drafts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
            supabase.from("blog_drafts").select("id", { count: "exact", head: true }).eq("status", "published"),
            supabase.from("blog_drafts").select("*").order("updated_at", { ascending: false }).limit(5),
          ]);

        setStats({
          totalDrafts: draftsRes.count || 0,
          totalTopics: topicsRes.count || 0,
          scheduledPosts: scheduledRes.count || 0,
          publishedPosts: publishedRes.count || 0,
        });
        setRecentDrafts(recentRes.data || []);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const statCards = [
    { label: "Total Drafts", value: stats.totalDrafts, icon: FileText, color: "text-blue-600" },
    { label: "Topics", value: stats.totalTopics, icon: Lightbulb, color: "text-yellow-600" },
    { label: "Scheduled", value: stats.scheduledPosts, icon: Calendar, color: "text-purple-600" },
    { label: "Published", value: stats.publishedPosts, icon: Send, color: "text-green-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Blog content management overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? "—" : stat.value}
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Drafts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Drafts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : recentDrafts.length === 0 ? (
            <p className="text-muted-foreground">
              No drafts yet. Create your first blog post from the{" "}
              <a href="/posts" className="text-primary hover:underline">
                Blog Posts
              </a>{" "}
              page.
            </p>
          ) : (
            <div className="space-y-3">
              {recentDrafts.map((draft: any) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/posts/${draft.id}`}
                      className="font-medium hover:text-primary transition-colors truncate block"
                    >
                      {draft.title || "Untitled"}
                    </a>
                    <p className="text-sm text-muted-foreground truncate">
                      /blog/{draft.slug || "—"}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
