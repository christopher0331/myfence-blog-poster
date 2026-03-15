import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { commitBlogDirectly } from "@/lib/github";
import { buildMdxFile } from "@/lib/frontmatter";
import { notifyPostPublished } from "@/lib/notify";
import type { SiteConfig } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient(): SupabaseClient {
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface PublishResult {
  published: number;
  message: string;
  commitUrl?: string;
  draftId?: string;
  slug?: string;
}

/**
 * Checks for scheduled drafts whose scheduled_publish_at has passed
 * and publishes them to GitHub. Processes one draft per call.
 */
export async function publishScheduledDrafts(): Promise<PublishResult> {
  const supabase = getAdminClient();

  const { data: drafts, error: fetchError } = await supabase
    .from("blog_drafts")
    .select("*, blog_topics(keywords)")
    .eq("status", "scheduled")
    .not("scheduled_publish_at", "is", null)
    .lte("scheduled_publish_at", new Date().toISOString())
    .order("scheduled_publish_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to fetch scheduled drafts: ${fetchError.message}`);
  }

  if (!drafts || drafts.length === 0) {
    return { published: 0, message: "No scheduled drafts ready to publish" };
  }

  const draft = drafts[0];
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", draft.site_id)
    .single();

  if (!draft.title || !draft.body_mdx || !draft.slug) {
    await supabase
      .from("blog_drafts")
      .update({ status: "failed" })
      .eq("id", draft.id);

    throw new Error(
      `Draft "${draft.title || draft.id}" is missing required fields (title, body, or slug)`
    );
  }

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
    `[Publish] Publishing draft: ${draft.title} (scheduled for ${draft.scheduled_publish_at})`
  );
  const { commitUrl } = await commitBlogDirectly({
    slug: draft.slug,
    mdxContent,
    title: draft.title,
    commitMessage: `Scheduled blog: ${draft.title}`,
    site: (site || undefined) as SiteConfig | undefined,
  });

  await supabase
    .from("blog_drafts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      github_pr_url: commitUrl,
    })
    .eq("id", draft.id);

  console.log(`[Publish] Successfully published: ${commitUrl}`);

  await notifyPostPublished({
    title: draft.title,
    slug: draft.slug,
    commitUrl,
    scheduledPublish: true,
    site: (site || undefined) as SiteConfig | undefined,
  });

  return {
    published: 1,
    message: `Published: ${draft.title}`,
    commitUrl,
    draftId: draft.id,
    slug: draft.slug,
  };
}
