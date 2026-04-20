import { commitBlogDirectly } from "@/lib/github";
import { buildMdxFile } from "@/lib/frontmatter";
import { notifyPostPublished } from "@/lib/notify";
import { getAdminClient } from "@/lib/supabase-admin";
import type { SiteConfig } from "@/lib/types";

export interface PublishedEntry {
  draftId: string;
  slug: string;
  title: string;
  site: string;
  commitUrl?: string;
  error?: string;
}

export interface PublishResult {
  published: number;
  failed: number;
  message: string;
  entries: PublishedEntry[];
}

/**
 * Publishes every scheduled draft whose `scheduled_publish_at` has passed,
 * across all sites. Safe to call repeatedly.
 */
export async function publishScheduledDrafts(limit = 10): Promise<PublishResult> {
  const supabase = getAdminClient();

  const { data: drafts, error: fetchError } = await supabase
    .from("blog_drafts")
    .select("*, blog_topics(keywords)")
    .eq("status", "scheduled")
    .not("scheduled_publish_at", "is", null)
    .lte("scheduled_publish_at", new Date().toISOString())
    .order("scheduled_publish_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch scheduled drafts: ${fetchError.message}`);
  }

  if (!drafts || drafts.length === 0) {
    return {
      published: 0,
      failed: 0,
      message: "No scheduled drafts due",
      entries: [],
    };
  }

  const entries: PublishedEntry[] = [];
  let published = 0;
  let failed = 0;

  // Cache site lookups
  const siteCache = new Map<string, SiteConfig | null>();
  async function getSite(siteId: string): Promise<SiteConfig | null> {
    if (siteCache.has(siteId)) return siteCache.get(siteId)!;
    const { data } = await supabase.from("sites").select("*").eq("id", siteId).single();
    const cfg = (data || null) as SiteConfig | null;
    siteCache.set(siteId, cfg);
    return cfg;
  }

  for (const draft of drafts) {
    const site = await getSite(draft.site_id);

    if (!draft.title || !draft.body_mdx || !draft.slug) {
      await supabase.from("blog_drafts").update({ status: "failed" }).eq("id", draft.id);
      failed++;
      entries.push({
        draftId: draft.id,
        slug: draft.slug || "?",
        title: draft.title || "(untitled)",
        site: site?.name || "?",
        error: "Missing title, slug, or body",
      });
      continue;
    }

    try {
      const keywords = draft.blog_topics?.keywords?.length
        ? draft.blog_topics.keywords.join(", ")
        : undefined;

      const mdxContent = buildMdxFile(
        {
          title: draft.title,
          slug: draft.slug,
          meta_description: draft.meta_description,
          category: draft.category,
          featured_image: draft.featured_image,
          read_time: draft.read_time,
          keywords,
          structured_data: draft.structured_data,
        },
        draft.body_mdx,
      );

      console.log(
        `[Publish][${site?.name || "?"}] "${draft.title}" → scheduled ${draft.scheduled_publish_at}`,
      );

      const { commitUrl } = await commitBlogDirectly({
        slug: draft.slug,
        mdxContent,
        title: draft.title,
        commitMessage: `Scheduled blog: ${draft.title}`,
        site: site || undefined,
      });

      await supabase
        .from("blog_drafts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          github_pr_url: commitUrl,
        })
        .eq("id", draft.id);

      await notifyPostPublished({
        title: draft.title,
        slug: draft.slug,
        commitUrl,
        scheduledPublish: true,
        site: site || undefined,
      });

      published++;
      entries.push({
        draftId: draft.id,
        slug: draft.slug,
        title: draft.title,
        site: site?.name || "?",
        commitUrl,
      });
    } catch (err: any) {
      console.error(`[Publish] Error publishing ${draft.slug}:`, err);
      await supabase
        .from("blog_drafts")
        .update({ status: "failed" })
        .eq("id", draft.id);
      failed++;
      entries.push({
        draftId: draft.id,
        slug: draft.slug,
        title: draft.title,
        site: site?.name || "?",
        error: err.message || "Publish failed",
      });
    }
  }

  return {
    published,
    failed,
    message: `Published ${published}, failed ${failed}`,
    entries,
  };
}
