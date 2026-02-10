"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Plus,
  Lightbulb,
  Trash2,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { BlogTopic, TopicStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TopicStatus; label: string }[] = [
  { value: "suggested", label: "Suggested" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
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
    priority: 0,
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
    setForm({ title: "", keywords: "", research_notes: "", priority: 0, source: "user" });
    setEditingId(null);
    setShowForm(false);
  }

  async function saveTopic() {
    const payload = {
      title: form.title,
      keywords: form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      research_notes: form.research_notes || null,
      priority: form.priority,
      source: form.source,
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

  // Group topics by status for kanban-like display
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
          <h1 className="text-3xl font-bold">Topics Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Manage blog topic ideas and track their progress
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Topic
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Edit Topic" : "New Topic"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Blog topic title..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Keywords (comma-separated)
              </label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="fence cost, seattle, cedar..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Research Notes
              </label>
              <Textarea
                value={form.research_notes}
                onChange={(e) =>
                  setForm({ ...form, research_notes: e.target.value })
                }
                placeholder="Context, competitor articles, key points to cover..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
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
                <Select
                  value={form.source}
                  onChange={(e) =>
                    setForm({ ...form, source: e.target.value as "user" | "ai" })
                  }
                >
                  <option value="user">User</option>
                  <option value="ai">AI</option>
                </Select>
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
        <p className="text-muted-foreground">Loading topics...</p>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No topics yet</h3>
            <p className="text-muted-foreground mb-4">
              Add topic ideas to build your content pipeline
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {STATUS_OPTIONS.map((statusOpt) => (
            <div key={statusOpt.value}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={statusBadgeVariant(statusOpt.value)}>
                  {statusOpt.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {groupedTopics[statusOpt.value]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {groupedTopics[statusOpt.value]?.map((topic) => (
                  <Card key={topic.id} className="group">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate">
                            {topic.title}
                          </h4>
                          {topic.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {topic.keywords.slice(0, 3).map((kw) => (
                                <span
                                  key={kw}
                                  className="text-[10px] bg-muted px-1.5 py-0.5 rounded"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-2">
                            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              P{topic.priority}
                            </span>
                            {topic.source === "ai" && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={() => startEdit(topic)}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteTopic(topic.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {/* Quick status change */}
                      <Select
                        value={topic.status}
                        onChange={(e) =>
                          updateStatus(topic.id, e.target.value as TopicStatus)
                        }
                        className="mt-2 h-7 text-xs"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
