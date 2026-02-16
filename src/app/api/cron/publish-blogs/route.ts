import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { commitBlogDirectly } from "@/lib/github";
import { sanitizeMdxBody } from "@/lib/utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/cron/publish-blogs
 *
 * Publishes drafts whose scheduled_publish_at has passed.
 * Only processes drafts with status = 'scheduled' and scheduled_publish_at <= now().
 * Call this on the same schedule as write-blogs (e.g. every 2 minutes).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Find drafts that are scheduled and past their publish time
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
      return NextResponse.json({
        success: true,
        message: "No scheduled drafts ready to publish",
        published: 0,
      });
    }

    const draft = drafts[0];

    if (!draft.title || !draft.body_mdx || !draft.slug) {
      // Mark as failed — missing required fields
      await supabase
        .from("blog_drafts")
        .update({ status: "failed" })
        .eq("id", draft.id);

      return NextResponse.json({
        success: false,
        error: `Draft "${draft.title || draft.id}" is missing required fields (title, body, or slug)`,
      }, { status: 400 });
    }

    // Build MDX with frontmatter
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
      frontmatterLines.push(`image: "${draft.featured_image.replace(/"/g, '\\"')}"`);
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

    // Pull layout/showArticleSummary from structured_data if present
    const sd = (draft.structured_data || {}) as Record<string, unknown>;
    if (sd.layout) frontmatterLines.push(`layout: "${sd.layout}"`);
    if (sd.showArticleSummary !== undefined) frontmatterLines.push(`showArticleSummary: ${sd.showArticleSummary}`);

    frontmatterLines.push("---");
    const frontmatter = frontmatterLines.join("\n");
    const body = sanitizeMdxBody(draft.body_mdx);
    const mdxContent = `${frontmatter}\n\n${body}`;

    // Commit to GitHub
    console.log(`[Publish Cron] Publishing draft: ${draft.title} (scheduled for ${draft.scheduled_publish_at})`);
    const { commitUrl } = await commitBlogDirectly({
      slug: draft.slug,
      mdxContent,
      title: draft.title,
      commitMessage: `Scheduled blog: ${draft.title}`,
    });

    // Update draft status
    await supabase
      .from("blog_drafts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        github_pr_url: commitUrl,
      })
      .eq("id", draft.id);

    console.log(`[Publish Cron] Successfully published: ${commitUrl}`);

    return NextResponse.json({
      success: true,
      message: `Published: ${draft.title}`,
      published: 1,
      commitUrl,
      draftId: draft.id,
      slug: draft.slug,
    });
  } catch (error: any) {
    console.error("[Publish Cron] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to publish scheduled blogs" },
      { status: 500 }
    );
  }
}
