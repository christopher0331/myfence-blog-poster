import { NextRequest, NextResponse } from "next/server";
import { generateBlogPost } from "@/lib/gemini";
import { sanitizeMdxBody } from "@/lib/utils";
import { getAdminClient } from "@/lib/supabase-admin";
import { getAutoEnabledSites, nextSlot } from "@/lib/scheduling";
import { publishScheduledDrafts } from "@/lib/publish-scheduled";
import type { SiteConfig } from "@/lib/types";

export const maxDuration = 60;

type WriteResult = {
  site: string;
  siteId: string;
  processed: number;
  draftId?: string;
  topicId?: string;
  title?: string;
  slug?: string;
  scheduledFor?: string;
  error?: string;
  skipped?: string;
};

/**
 * GET /api/cron/write-blogs
 *
 * Loops over every site with `auto_publish_enabled = true`, picks up to
 * `posts_per_week` ready topics per site that don't already have a scheduled
 * draft, writes the article with Gemini, and schedules the draft for the next
 * open posting slot (Mon/Thu by default).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publishResult = await publishScheduledDrafts();
  const results: WriteResult[] = [];
  const sites = await getAutoEnabledSites();

  if (sites.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No sites have auto_publish_enabled = true",
      publishResult,
      results,
    });
  }

  for (const site of sites) {
    try {
      const result = await processOneTopicForSite(site);
      results.push(result);
    } catch (err: any) {
      console.error(`[Cron][${site.name}] Failed:`, err);
      results.push({
        site: site.name,
        siteId: site.id,
        processed: 0,
        error: err.message || "unknown",
      });
    }
  }

  const totalWritten = results.reduce((n, r) => n + (r.processed || 0), 0);
  return NextResponse.json({
    success: true,
    message: `Published ${publishResult.published} due post(s), failed ${publishResult.failed}; wrote ${totalWritten} post(s) across ${sites.length} site(s)`,
    publishResult,
    results,
  });
}

async function processOneTopicForSite(site: SiteConfig): Promise<WriteResult> {
  const supabase = getAdminClient();

  // 1. Enforce weekly cap: how many drafts already scheduled or published this rolling week?
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: weekly } = await supabase
    .from("blog_drafts")
    .select("id", { count: "exact", head: true })
    .eq("site_id", site.id)
    .in("status", ["scheduled", "published"])
    .gte("updated_at", oneWeekAgo);

  const cap = site.posts_per_week ?? 2;
  if ((weekly ?? 0) >= cap) {
    return {
      site: site.name,
      siteId: site.id,
      processed: 0,
      skipped: `Weekly cap reached (${weekly}/${cap})`,
    };
  }

  // 2. Claim the highest-priority ready topic
  const { data: topic } = await supabase
    .from("blog_topics")
    .select("*")
    .eq("site_id", site.id)
    .eq("status", "ready")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!topic) {
    return {
      site: site.name,
      siteId: site.id,
      processed: 0,
      skipped: "No ready topics",
    };
  }

  await supabase
    .from("blog_topics")
    .update({
      status: "in_progress",
      progress_status: "Researching topic and gathering information…",
    })
    .eq("id", topic.id)
    .eq("site_id", site.id);

  try {
    await supabase
      .from("blog_topics")
      .update({ progress_status: "Generating blog content with AI…" })
      .eq("id", topic.id);

    const blogPost = await generateBlogPost({
      topic: topic.title,
      keywords: topic.keywords || [],
      researchNotes: topic.research_notes || undefined,
      topicDescription: topic.description || undefined,
      topicImages: Array.isArray(topic.topic_images) ? topic.topic_images : undefined,
      targetLength: 1500,
      site,
    });

    const slug = blogPost.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const scheduledFor = await nextSlot(site);

    await supabase
      .from("blog_topics")
      .update({ progress_status: "Scheduling draft…" })
      .eq("id", topic.id);

    // Upsert draft
    const { data: existing } = await supabase
      .from("blog_drafts")
      .select("id")
      .eq("slug", slug)
      .eq("site_id", site.id)
      .maybeSingle();

    const draftPayload = {
      title: blogPost.title,
      body_mdx: sanitizeMdxBody(blogPost.content),
      meta_description: blogPost.metaDescription,
      category: blogPost.category || "",
      read_time: blogPost.readTime || "5 min read",
      featured_image: (blogPost as any).featuredImage || null,
      structured_data: {
        imageCaption: (blogPost as any).imageCaption,
        layout: (blogPost as any).layout,
        showArticleSummary: (blogPost as any).showArticleSummary,
      },
      topic_id: topic.id,
      site_id: site.id,
      status: "scheduled",
      scheduled_publish_at: scheduledFor,
    };

    let draftId: string;
    if (existing) {
      const { data, error } = await supabase
        .from("blog_drafts")
        .update({ ...draftPayload, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed to update draft: ${error?.message}`);
      draftId = data.id;
    } else {
      const { data, error } = await supabase
        .from("blog_drafts")
        .insert({ slug, ...draftPayload })
        .select("id")
        .single();
      if (error || !data) throw new Error(`Failed to create draft: ${error?.message}`);
      draftId = data.id;
    }

    await supabase
      .from("blog_topics")
      .update({ status: "completed", progress_status: null })
      .eq("id", topic.id)
      .eq("site_id", site.id);

    console.log(
      `[Cron][${site.name}] Wrote "${blogPost.title}" → scheduled ${scheduledFor} (draft ${draftId})`,
    );

    return {
      site: site.name,
      siteId: site.id,
      processed: 1,
      draftId,
      topicId: topic.id,
      title: blogPost.title,
      slug,
      scheduledFor,
    };
  } catch (err: any) {
    await supabase
      .from("blog_topics")
      .update({ status: "ready", progress_status: null })
      .eq("id", topic.id)
      .eq("site_id", site.id);
    throw err;
  }
}
