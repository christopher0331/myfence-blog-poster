"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Lightbulb, Trash2, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { BlogTopic, TopicStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TopicStatus; label: string; description: string }[] = [
  { value: "suggested", label: "Suggested", description: "New topic ideas" },
  { value: "approved", label: "Approved", description: "Ready for AI research" },
  { value: "in_progress", label: "Researching", description: "AI is gathering information" },
  { value: "completed", label: "Ready", description: "Research complete, ready to write" },
  { value: "rejected", label: "Rejected", description: "Not pursuing this topic" },
];

const statusBadgeVariant = (status: TopicStatus) => {
  switch (status) {
    case "completed": return "success" as const;
    case "approved": return "default" as const;
    case "in_progress": return "warning" as const;
    case "rejected": return "destructive" as const;
    default: return "secondary" as const;
  }
};

export default function TopicsPage() {
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    keywords: "",
    research_notes: "",
    priority: 5,
    source: "user" as "user" | "ai",
  });

  const loadTopics = useCallback(async () => {
    const { data } = await supabase
      .from("blog_topics")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    setTopics((data || []) as BlogTopic[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  function resetForm() {
    setForm({ title: "", keywords: "", research_notes: "", priority: 5, source: "user" });
    setEditingId(null);
    setShowForm(false);
  }

  async function saveTopic() {
    if (!form.title.trim()) return;

    const payload = {
      title: form.title,
      keywords: form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      research_notes: form.research_notes || null,
      priority: form.priority,
      source: form.source,
      status: editingId ? undefined : "suggested" as TopicStatus,
    };

    if (editingId) {
      await supabase.from("blog_topics").update(payload).eq("id", editingId);
    } else {
      await supabase.from("blog_topics").insert(payload);
    }

    resetForm();
    loadTopics();
  }

  async function updateStatus(id: string, status: TopicStatus) {
    await supabase.from("blog_topics").update({ status }).eq("id", id);
    loadTopics();
  }

  async function deleteTopic(id: string) {
    if (!confirm("Delete this topic?")) return;
    await supabase.from("blog_topics").delete().eq("id", id);
    loadTopics();
  }

  function startEdit(topic: BlogTopic) {
    setForm({
      title: topic.title,
      keywords: topic.keywords.join(", "),
      research_notes: topic.research_notes || "",
      priority: topic.priority,
      source: topic.source,
    });
    setEditingId(topic.id);
    setShowForm(true);
  }

  // Group topics by status
  const groupedTopics = STATUS_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.value] = topics.filter((t) => t.status === opt.value);
      return acc;
    },
    {} as Record<TopicStatus, BlogTopic[]>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Research Topics</h1>
          <p className="text-muted-foreground mt-1">
            Manage topics for AI to research and write about
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Topic
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Edit Topic" : "New Research Topic"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Topic Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Best Fence Materials for Seattle Weather"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Keywords (comma-separated)
              </label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="fence materials, seattle, cedar, weather resistance..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                AI will use these keywords for research
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Research Notes (Optional)
              </label>
              <Textarea
                value={form.research_notes}
                onChange={(e) => setForm({ ...form, research_notes: e.target.value })}
                placeholder="Context, competitor articles, key points to cover, target audience..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide context to help AI write better content
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Priority (0-10)</label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Source</label>
                <select
                  value={form.source}
                  onChange={(e) =>
                    setForm({ ...form, source: e.target.value as "user" | "ai" })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="user">Manual</option>
                  <option value="ai">AI Suggested</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTopic} disabled={!form.title.trim()}>
                {editingId ? "Update" : "Create"} Topic
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topics by Status */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading topics...</p>
        </div>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No topics yet</h3>
            <p className="text-muted-foreground mb-4">
              Add research topics to build your content pipeline. AI will research and write posts based on these topics.
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {STATUS_OPTIONS.map((statusOpt) => {
            const statusTopics = groupedTopics[statusOpt.value] || [];
            if (statusTopics.length === 0) return null;

            return (
              <div key={statusOpt.value}>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant={statusBadgeVariant(statusOpt.value)} className="text-sm">
                    {statusOpt.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {statusTopics.length} {statusTopics.length === 1 ? "topic" : "topics"}
                  </span>
                  <span className="text-xs text-muted-foreground">· {statusOpt.description}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {statusTopics.map((topic) => (
                    <Card key={topic.id} className="group hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1 line-clamp-2">
                              {topic.title}
                            </h4>
                            {topic.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {topic.keywords.slice(0, 4).map((kw) => (
                                  <span
                                    key={kw}
                                    className="text-[10px] bg-muted px-2 py-0.5 rounded"
                                  >
                                    {kw}
                                  </span>
                                ))}
                                {topic.keywords.length > 4 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{topic.keywords.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => startEdit(topic)}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Edit"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTopic(topic.id)}
                              className="text-muted-foreground hover:text-destructive p-1"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {topic.research_notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {topic.research_notes}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t">
                          <div className="flex items-center gap-2">
                            {topic.source === "ai" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              Priority {topic.priority}
                            </span>
                          </div>
                          <select
                            value={topic.status}
                            onChange={(e) =>
                              updateStatus(topic.id, e.target.value as TopicStatus)
                            }
                            className="text-xs px-2 py-1 border rounded bg-background"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
