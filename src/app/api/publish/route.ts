import { NextRequest, NextResponse } from "next/server";
import { commitBlogDirectly } from "@/lib/github";
import { buildMdxFile } from "@/lib/frontmatter";
import { notifyPostPublished } from "@/lib/notify";
import { createClient } from "@supabase/supabase-js";

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
 * POST /api/publish
 * Commits a draft directly to the main branch on GitHub.
 * Body: { draftId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { draftId } = await req.json();

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: draft, error: fetchError } = await supabase
      .from("blog_drafts")
      .select("*, blog_topics(keywords)")
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (!draft.title || !draft.slug || !draft.body_mdx) {
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
    });

    await supabase
      .from("blog_drafts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        github_pr_url: commitUrl,
      })
      .eq("id", draftId);

    await notifyPostPublished({
      title: draft.title,
      slug: draft.slug,
      commitUrl,
      scheduledPublish: false,
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
