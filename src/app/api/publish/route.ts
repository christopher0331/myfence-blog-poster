import { NextRequest, NextResponse } from "next/server";
import { commitBlogDirectly } from "@/lib/github";
import { buildMdxFile } from "@/lib/frontmatter";
import { notifyPostPublished } from "@/lib/notify";
import { getSiteFromRequest } from "@/lib/get-site";
import { getAdminClient } from "@/lib/supabase-admin";
import { appendDraftActivity } from "@/lib/draft-activity";

/**
 * POST /api/publish
 * Commits a draft directly to the main branch on GitHub.
 * Body: { draftId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const site = await getSiteFromRequest(req);
    const { draftId } = await req.json();

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: draft, error: fetchError } = await supabase
      .from("blog_drafts")
      .select("*, blog_topics(keywords)")
      .eq("id", draftId)
      .eq("site_id", site.id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (!draft.title || !draft.slug || !draft.body_mdx) {
      await supabase
        .from("blog_drafts")
        .update({
          structured_data: appendDraftActivity(draft.structured_data, {
            action: "publish",
            status: "error",
            message: "Rejected before manual publish: missing title, slug, or body.",
          }),
        })
        .eq("id", draftId)
        .eq("site_id", site.id);
      return NextResponse.json(
        { error: "Draft must have a title, slug, and body content before publishing" },
        { status: 400 },
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

    const { commitUrl } = await commitBlogDirectly({
      slug: draft.slug,
      mdxContent,
      title: draft.title,
      commitMessage: `Blog: ${draft.title}`,
      site,
    });

    await supabase
      .from("blog_drafts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        github_pr_url: commitUrl,
        structured_data: appendDraftActivity(draft.structured_data, {
          action: "publish",
          status: "success",
          message: "Manually published to GitHub successfully.",
          details: { commitUrl },
        }),
      })
      .eq("id", draftId)
      .eq("site_id", site.id);

    await notifyPostPublished({
      title: draft.title,
      slug: draft.slug,
      commitUrl,
      scheduledPublish: false,
      site,
    });

    return NextResponse.json({ success: true, commitUrl });
  } catch (error: any) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish" },
      { status: 500 },
    );
  }
}
