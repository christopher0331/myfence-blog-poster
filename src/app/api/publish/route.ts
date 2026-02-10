import { NextRequest, NextResponse } from "next/server";
import { createBlogPR } from "@/lib/github";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /api/publish
 * Takes a draft ID, generates the MDX file with frontmatter, and creates a GitHub PR.
 */
export async function POST(req: NextRequest) {
  try {
    const { draftId } = await req.json();

    if (!draftId) {
      return NextResponse.json({ error: "draftId is required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch the draft
    const { data: draft, error: fetchError } = await supabase
      .from("blog_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (!draft.title || !draft.slug || !draft.body_mdx) {
      return NextResponse.json(
        { error: "Draft must have a title, slug, and body content before publishing" },
        { status: 400 }
      );
    }

    // Build the MDX file with YAML frontmatter
    const today = new Date().toISOString().split("T")[0];
    const publishDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const frontmatter = [
      "---",
      `title: "${draft.title.replace(/"/g, '\\"')}"`,
      `description: "${(draft.meta_description || "").replace(/"/g, '\\"')}"`,
      `slug: "${draft.slug}"`,
      `category: "${draft.category || ""}"`,
      `image: "${draft.featured_image || ""}"`,
      `readTime: "${draft.read_time || ""}"`,
      `publishDate: "${publishDate}"`,
      `datePublished: "${today}"`,
      `dateModified: "${today}"`,
      draft.structured_data
        ? `keywords: "${(draft.structured_data as any).keywords || ""}"`
        : null,
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    const mdxContent = `${frontmatter}\n\n${draft.body_mdx}`;

    // Create the GitHub PR
    const { prUrl, prNumber } = await createBlogPR({
      slug: draft.slug,
      mdxContent,
      title: draft.title,
    });

    // Update the draft status
    await supabase
      .from("blog_drafts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        github_pr_url: prUrl,
      })
      .eq("id", draftId);

    return NextResponse.json({
      success: true,
      prUrl,
      prNumber,
    });
  } catch (error: any) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to publish" },
      { status: 500 }
    );
  }
}
