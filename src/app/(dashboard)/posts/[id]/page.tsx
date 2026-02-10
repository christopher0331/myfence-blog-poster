"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import CompletenessTracker from "@/components/editor/CompletenessTracker";
import MDXPreview from "@/components/editor/MDXPreview";
import { draftsApi } from "@/lib/api";
import { ArrowLeft, Save, Send, Trash2, Calendar } from "lucide-react";
import type { BlogDraft, DraftStatus } from "@/lib/types";

const CATEGORIES = [
  "Pricing",
  "Materials",
  "Legal",
  "Maintenance",
  "Fence Posts",
  "Premium Fencing",
  "DIY",
  "Design",
  "Installation",
  "Seasonal",
];

interface PostEditorPageProps {
  params: Promise<{ id: string }>;
}

export default function PostEditorPage({ params }: PostEditorPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await draftsApi.getById(id);
        setDraft(data);
      } catch (err) {
        console.error("Failed to load draft:", err);
        router.push("/posts");
      }
    }
    load();
  }, [id, router]);

  const calculateCompleteness = useCallback((d: BlogDraft) => {
    return {
      title: d.title?.trim() ? 100 : 0,
      body: d.body_mdx?.trim()
        ? d.body_mdx.length > 2000
          ? 100
          : Math.round((d.body_mdx.length / 2000) * 100)
        : 0,
      meta_description: d.meta_description?.trim()
        ? d.meta_description.length >= 120
          ? 100
          : Math.round((d.meta_description.length / 120) * 100)
        : 0,
      image: d.featured_image?.trim() ? 100 : 0,
      category: d.category?.trim() ? 100 : 0,
      structured_data: d.title && d.meta_description && d.category ? 100 : 0,
    };
  }, []);

  const updateField = useCallback(
    (field: string, value: any) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, [field]: value };
        updated.completeness = calculateCompleteness(updated);
        return updated;
      });
    },
    [calculateCompleteness]
  );

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    setSaving(true);

    try {
      const completeness = calculateCompleteness(draft);
      await draftsApi.update(draft.id, {
        title: draft.title,
        slug: draft.slug,
        meta_description: draft.meta_description,
        body_mdx: draft.body_mdx,
        category: draft.category,
        featured_image: draft.featured_image,
        read_time: draft.read_time,
        status: draft.status,
        scheduled_date: draft.scheduled_date,
        completeness,
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to save draft:", err);
    } finally {
      setSaving(false);
    }
  }, [draft, calculateCompleteness]);

  const deleteDraft = useCallback(async () => {
    if (!draft || !confirm("Are you sure you want to delete this post?")) return;
    try {
      await draftsApi.delete(draft.id);
      router.push("/posts");
    } catch (err) {
      console.error("Failed to delete draft:", err);
    }
  }, [draft, router]);

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveDraft]);

  if (!draft) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  const completenessFields = [
    { label: "Title", key: "title", value: draft.completeness?.title ?? 0 },
    { label: "Body Content", key: "body", value: draft.completeness?.body ?? 0 },
    { label: "Meta Description", key: "meta_description", value: draft.completeness?.meta_description ?? 0 },
    { label: "Featured Image", key: "image", value: draft.completeness?.image ?? 0 },
    { label: "Category", key: "category", value: draft.completeness?.category ?? 0 },
    { label: "Structured Data", key: "structured_data", value: draft.completeness?.structured_data ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/posts")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {draft.title || "Untitled Post"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
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
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Saved at {lastSaved}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={deleteDraft}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button variant="outline" onClick={saveDraft} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            onClick={() => {
              updateField("status", "review");
              setTimeout(saveDraft, 100);
            }}
            disabled={draft.status === "published"}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit for Review
          </Button>
        </div>
      </div>

      {/* Editor Layout: 3 columns */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Metadata + Editor */}
        <div className="col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Post Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input
                  value={draft.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Enter post title..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <Input
                    value={draft.slug}
                    onChange={(e) =>
                      updateField(
                        "slug",
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-")
                          .replace(/-+/g, "-")
                      )
                    }
                    placeholder="post-slug"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Meta Description
                  <span className="text-muted-foreground font-normal ml-1">
                    ({draft.meta_description?.length || 0}/160)
                  </span>
                </label>
                <Textarea
                  value={draft.meta_description}
                  onChange={(e) => updateField("meta_description", e.target.value)}
                  placeholder="Brief description for SEO..."
                  rows={3}
                  maxLength={160}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <Select
                    value={draft.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  >
                    <option value="">Select...</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Read Time</label>
                  <Input
                    value={draft.read_time}
                    onChange={(e) => updateField("read_time", e.target.value)}
                    placeholder="6 min read"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Featured Image URL</label>
                <Input
                  value={draft.featured_image}
                  onChange={(e) => updateField("featured_image", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select
                    value={draft.status}
                    onChange={(e) => updateField("status", e.target.value as DraftStatus)}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Schedule Date
                  </label>
                  <Input
                    type="date"
                    value={draft.scheduled_date || ""}
                    onChange={(e) => updateField("scheduled_date", e.target.value || null)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MDX Body Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Content (MDX)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.body_mdx}
                onChange={(e) => updateField("body_mdx", e.target.value)}
                placeholder="Write your blog post in Markdown / MDX..."
                className="font-mono text-sm min-h-[400px] resize-y"
                rows={20}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {draft.body_mdx?.split(/\s+/).filter(Boolean).length || 0} words ·{" "}
                {draft.body_mdx?.length || 0} characters
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Middle: Live Preview */}
        <div className="col-span-5">
          <MDXPreview
            content={draft.body_mdx}
            title={draft.title}
            description={draft.meta_description}
            category={draft.category}
          />
        </div>

        {/* Right: Completeness Sidebar */}
        <div className="col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <CompletenessTracker fields={completenessFields} />
            </CardContent>
          </Card>

          {draft.featured_image && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Image Preview
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.featured_image}
                  alt="Featured"
                  className="rounded-lg w-full object-cover aspect-video"
                />
              </CardContent>
            </Card>
          )}

          {draft.github_pr_url && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  GitHub PR
                </p>
                <a
                  href={draft.github_pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {draft.github_pr_url}
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
