import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { commitBlogDirectly } from "@/lib/github";
import { sanitizeMdxBody } from "@/lib/utils";

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

  if (!draft.title || !draft.body_mdx || !draft.slug) {
    await supabase
      .from("blog_drafts")
      .update({ status: "failed" })
      .eq("id", draft.id);

    throw new Error(
      `Draft "${draft.title || draft.id}" is missing required fields (title, body, or slug)`
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const publishDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const keywords = draft.blog_topics?.keywords?.length
    ? draft.blog_topics.keywords.join(", ")
    : undefined;

  const frontmatterLines = [
    "---",
    `title: "${draft.title.replace(/"/g, '\\"')}"`,
    `description: "${(draft.meta_description || "").replace(/"/g, '\\"')}"`,
    `slug: "${draft.slug}"`,
    `category: "${draft.category || ""}"`,
  ];

  if (draft.featured_image) {
    frontmatterLines.push(
      `image: "${draft.featured_image.replace(/"/g, '\\"')}"`
    );
  }

  frontmatterLines.push(
    `readTime: "${draft.read_time || "5 min read"}"`,
    `publishDate: "${publishDate}"`,
    `datePublished: "${today}"`,
    `dateModified: "${today}"`
  );

  if (keywords) {
    frontmatterLines.push(`keywords: "${keywords.replace(/"/g, '\\"')}"`);
  }

  const sd = (draft.structured_data || {}) as Record<string, unknown>;
  if (sd.layout) frontmatterLines.push(`layout: "${sd.layout}"`);
  if (sd.showArticleSummary !== undefined)
    frontmatterLines.push(`showArticleSummary: ${sd.showArticleSummary}`);

  frontmatterLines.push("---");
  const frontmatter = frontmatterLines.join("\n");
  const body = sanitizeMdxBody(draft.body_mdx);
  const mdxContent = `${frontmatter}\n\n${body}`;

  console.log(
    `[Publish] Publishing draft: ${draft.title} (scheduled for ${draft.scheduled_publish_at})`
  );
  const { commitUrl } = await commitBlogDirectly({
    slug: draft.slug,
    mdxContent,
    title: draft.title,
    commitMessage: `Scheduled blog: ${draft.title}`,
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

  return {
    published: 1,
    message: `Published: ${draft.title}`,
    commitUrl,
    draftId: draft.id,
    slug: draft.slug,
  };
}
