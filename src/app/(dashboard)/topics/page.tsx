"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Lightbulb, Trash2, Sparkles, Loader2, ImagePlus, HelpCircle } from "lucide-react";
import { topicsApi } from "@/lib/api";
import type { BlogTopic, TopicStatus, TopicImage } from "@/lib/types";

const STATUS_OPTIONS: { value: TopicStatus; label: string; description: string }[] = [
  { value: "suggested", label: "Suggested", description: "New topic ideas" },
  { value: "approved", label: "Approved", description: "Ready to write" },
  { value: "in_progress", label: "In progress", description: "Draft being written" },
  { value: "completed", label: "Ready", description: "Published or ready" },
  { value: "rejected", label: "Rejected", description: "Not pursuing" },
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
  const [ideaInput, setIdeaInput] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
  const [researchResult, setResearchResult] = useState<{
    suggestedTitle: string;
    description: string;
    keywords: string[];
  } | null>(null);
  const [creatingFromResearch, setCreatingFromResearch] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    keywords: "",
    research_notes: "",
    priority: 5,
    source: "user" as "user" | "ai",
    topic_images: [] as TopicImage[],
  });
  const [expandedImagesId, setExpandedImagesId] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageDesc, setNewImageDesc] = useState("");

  const loadTopics = useCallback(async () => {
    try {
      const data = await topicsApi.getAll({ order: "priority", ascending: false });
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTopics(data.map((t) => ({
        ...t,
        topic_images: Array.isArray(t.topic_images) ? t.topic_images : [],
        description: t.description ?? null,
      })));
    } catch (err) {
      console.error("Failed to load topics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    const hasInProgress = topics.some((t) => t.status === "in_progress");
    if (!hasInProgress) return;
    const interval = setInterval(loadTopics, 3000);
    return () => clearInterval(interval);
  }, [topics, loadTopics]);

  function resetForm() {
    setForm({
      title: "",
      description: "",
      keywords: "",
      research_notes: "",
      priority: 5,
      source: "user",
      topic_images: [],
    });
    setEditingId(null);
    setShowManualForm(false);
    setResearchResult(null);
    setIdeaInput("");
    setSuggestedIdeas([]);
  }

  async function handleResearchIdea() {
    if (!ideaInput.trim()) return;
    setInvestigating(true);
    setResearchResult(null);
    try {
      const result = await topicsApi.investigate(ideaInput.trim());
      setResearchResult(result);
    } catch (err) {
      console.error(err);
      alert((err as Error).message || "Research failed");
    } finally {
      setInvestigating(false);
    }
  }

  async function handleSuggestIdeas() {
    setSuggesting(true);
    setSuggestedIdeas([]);
    try {
      const ideas = await topicsApi.suggestIdeas();
      setSuggestedIdeas(ideas);
    } catch (err) {
      console.error(err);
      alert((err as Error).message || "Failed to suggest ideas");
    } finally {
      setSuggesting(false);
    }
  }

  async function createTopicFromResearch() {
    if (!researchResult) return;
    setCreatingFromResearch(true);
    try {
      await topicsApi.create({
        title: researchResult.suggestedTitle,
        description: researchResult.description,
        keywords: researchResult.keywords,
        source: "user",
        status: "suggested",
        priority: 5,
      });
      resetForm();
      loadTopics();
    } catch (err) {
      console.error(err);
      alert((err as Error).message || "Failed to create topic");
    } finally {
      setCreatingFromResearch(false);
    }
  }

  async function saveTopic() {
    if (!form.title.trim()) return;
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        research_notes: form.research_notes || null,
        priority: form.priority,
        source: form.source,
        topic_images: form.topic_images,
        ...(editingId ? {} : { status: "suggested" as TopicStatus }),
      };
      if (editingId) {
        await topicsApi.update(editingId, payload);
      } else {
        await topicsApi.create(payload);
      }
      resetForm();
      loadTopics();
    } catch (err) {
      console.error("Failed to save topic:", err);
    }
  }

  async function updateStatus(id: string, status: TopicStatus) {
    try {
      await topicsApi.update(id, { status });
      loadTopics();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm("Delete this topic?")) return;
    try {
      await topicsApi.delete(id);
      loadTopics();
    } catch (err) {
      console.error("Failed to delete topic:", err);
    }
  }

  async function addImageToTopic(topicId: string, url: string, description: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;
    const images = [...(topic.topic_images || []), { url: url.trim(), description: description.trim() }];
    try {
      await topicsApi.update(topicId, { topic_images: images });
      setNewImageUrl("");
      setNewImageDesc("");
      loadTopics();
    } catch (err) {
      console.error("Failed to add image:", err);
    }
  }

  async function removeImageFromTopic(topicId: string, index: number) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic?.topic_images?.length) return;
    const images = topic.topic_images.filter((_, i) => i !== index);
    try {
      await topicsApi.update(topicId, { topic_images: images });
      loadTopics();
    } catch (err) {
      console.error("Failed to remove image:", err);
    }
  }

  function startEdit(topic: BlogTopic) {
    setForm({
      title: topic.title,
      description: topic.description || "",
      keywords: topic.keywords?.join(", ") || "",
      research_notes: topic.research_notes || "",
      priority: topic.priority,
      source: topic.source,
      topic_images: topic.topic_images || [],
    });
    setEditingId(topic.id);
    setShowManualForm(true);
  }

  const groupedTopics = STATUS_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.value] = topics.filter((t) => t.status === opt.value);
      return acc;
    },
    {} as Record<TopicStatus, BlogTopic[]>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Research Topics</h1>
        <p className="text-muted-foreground mt-1">
          Add your topic ideas. AI will research each one and suggest a title and description, then you can add images for the article.
        </p>
      </div>

      {/* User idea input + Research */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your topic idea</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a short idea (e.g. &quot;steel vs wood posts&quot; or &quot;fence staining in Seattle&quot;). AI will research it and suggest a title and article scope.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={ideaInput}
              onChange={(e) => setIdeaInput(e.target.value)}
              placeholder="e.g., steel vs wood fence posts, fence staining Seattle..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleResearchIdea()}
            />
            <Button onClick={handleResearchIdea} disabled={!ideaInput.trim() || investigating}>
              {investigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Research with AI
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSuggestIdeas} disabled={suggesting}>
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HelpCircle className="h-4 w-4 mr-2" />}
            I&apos;m stuck — suggest topic ideas
          </Button>
          {suggestedIdeas.length > 0 && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Pick one to research:</p>
              <ul className="flex flex-wrap gap-2">
                {suggestedIdeas.map((idea, i) => (
                  <li key={i}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIdeaInput(idea);
                        setSuggestedIdeas([]);
                      }}
                    >
                      {idea}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {researchResult && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Suggested topic card</p>
              <p className="font-semibold">{researchResult.suggestedTitle}</p>
              <p className="text-sm text-muted-foreground">{researchResult.description}</p>
              {researchResult.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {researchResult.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={createTopicFromResearch} disabled={creatingFromResearch}>
                  {creatingFromResearch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create topic
                </Button>
                <Button variant="outline" onClick={() => setResearchResult(null)}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual add (optional) */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowManualForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add topic manually
        </Button>
      </div>

      {/* Manual add/edit form */}
      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{editingId ? "Edit Topic" : "New Topic (manual)"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Topic title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Brief description (what the article will cover)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Keywords (comma-separated)</label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="fence, seattle, cedar..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Research notes (optional)</label>
              <Textarea
                value={form.research_notes}
                onChange={(e) => setForm({ ...form, research_notes: e.target.value })}
                placeholder="Extra context for the writer"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTopic} disabled={!form.title.trim()}>
                {editingId ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic list by status */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading topics...</div>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No topics yet</h3>
            <p className="text-muted-foreground mb-4">
              Enter a topic idea above and click &quot;Research with AI&quot; to create your first topic card.
            </p>
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
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-1 line-clamp-2">{topic.title}</h4>
                            {topic.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{topic.description}</p>
                            )}
                            {topic.keywords?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {topic.keywords.slice(0, 4).map((kw) => (
                                  <span key={kw} className="text-[10px] bg-muted px-2 py-0.5 rounded">{kw}</span>
                                ))}
                                {topic.keywords?.length > 4 && (
                                  <span className="text-[10px] text-muted-foreground">+{topic.keywords.length - 4}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 flex-shrink-0">
                            <button onClick={() => startEdit(topic)} className="text-muted-foreground hover:text-foreground p-1" title="Edit">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => deleteTopic(topic.id)} className="text-muted-foreground hover:text-destructive p-1" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {topic.status === "in_progress" && topic.progress_status && (
                          <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md">
                            <div className="flex items-start gap-2">
                              <Loader2 className="h-3 w-3 mt-0.5 text-yellow-600 dark:text-yellow-400 animate-spin flex-shrink-0" />
                              <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">{topic.progress_status}</p>
                            </div>
                          </div>
                        )}
                        {/* Images for this article */}
                        <div className="pt-3 border-t mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const next = expandedImagesId === topic.id ? null : topic.id;
                              setExpandedImagesId(next);
                              if (next) {
                                setNewImageUrl("");
                                setNewImageDesc("");
                              }
                            }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ImagePlus className="h-3.5 w-3.5" />
                            Images for article ({topic.topic_images?.length ?? 0})
                          </button>
                          {expandedImagesId === topic.id && (
                            <div className="mt-2 space-y-2">
                              {(topic.topic_images || []).map((img, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-xs bg-muted/50 rounded p-2">
                                  <img src={img.url} alt="" className="w-12 h-12 object-cover rounded flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{img.description || "No description"}</p>
                                    <p className="text-muted-foreground truncate">{img.url}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeImageFromTopic(topic.id, idx)}
                                    className="text-destructive hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Image URL"
                                  value={newImageUrl}
                                  onChange={(e) => setNewImageUrl(e.target.value)}
                                  className="flex-1 text-xs"
                                />
                                <Input
                                  placeholder="What it is / where to use"
                                  value={newImageDesc}
                                  onChange={(e) => setNewImageDesc(e.target.value)}
                                  className="flex-1 text-xs"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => addImageToTopic(topic.id, newImageUrl, newImageDesc)}
                                  disabled={!newImageUrl.trim()}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t mt-3">
                          <div className="flex items-center gap-2">
                            {topic.source === "ai" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">Priority {topic.priority}</span>
                          </div>
                          <select
                            value={topic.status}
                            onChange={(e) => updateStatus(topic.id, e.target.value as TopicStatus)}
                            className="text-xs px-2 py-1 border rounded bg-background"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
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
