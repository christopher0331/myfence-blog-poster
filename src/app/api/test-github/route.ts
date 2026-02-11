import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { commitBlogDirectly } from "@/lib/github";

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
 * POST /api/test-github
 * Test endpoint to manually commit a draft to GitHub
 * 
 * Body: { draftId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: "draftId is required" },
        { status: 400 }
      );
    }

    // Check environment variables
    const requiredEnvVars = {
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
      GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
      GITHUB_DEFAULT_BRANCH: process.env.GITHUB_DEFAULT_BRANCH || "main",
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required environment variables",
          missing: missingVars,
          current: {
            GITHUB_REPO_OWNER: requiredEnvVars.GITHUB_REPO_OWNER || "NOT SET",
            GITHUB_REPO_NAME: requiredEnvVars.GITHUB_REPO_NAME || "NOT SET",
            GITHUB_DEFAULT_BRANCH: requiredEnvVars.GITHUB_DEFAULT_BRANCH || "NOT SET",
            GITHUB_TOKEN: requiredEnvVars.GITHUB_TOKEN ? "SET (hidden)" : "NOT SET",
          },
        },
        { status: 500 }
      );
    }

    // Fetch the draft
    const supabase = getAdminClient();
    const { data: draft, error: draftError } = await supabase
      .from("blog_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: `Failed to fetch draft: ${draftError?.message}` },
        { status: 404 }
      );
    }

    if (!draft.body_mdx || !draft.title) {
      return NextResponse.json(
        { error: "Draft is missing required fields (title or body_mdx)" },
        { status: 400 }
      );
    }

    // Build MDX content with frontmatter
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
      `readTime: "${draft.read_time || "5 min read"}"`,
      `publishDate: "${publishDate}"`,
      `datePublished: "${today}"`,
      `dateModified: "${today}"`,
      "---",
    ].join("\n");

    const mdxContent = `${frontmatter}\n\n${draft.body_mdx}`;

    // Commit to GitHub
    console.log(`[Test] Committing draft ${draftId} to GitHub...`);
    const { commitUrl, sha } = await commitBlogDirectly({
      slug: draft.slug,
      mdxContent,
      title: draft.title,
      commitMessage: `Auto-generated blog: ${draft.title}`,
    });

    // Update draft with GitHub URL
    await supabase
      .from("blog_drafts")
      .update({
        github_pr_url: commitUrl,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", draftId);

    return NextResponse.json({
      success: true,
      message: "Successfully committed to GitHub",
      commitUrl,
      sha,
      draft: {
        id: draft.id,
        title: draft.title,
        slug: draft.slug,
      },
    });
  } catch (error: any) {
    console.error("[Test] GitHub commit error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to commit to GitHub",
        details: error.response?.data || error.stack,
      },
      { status: 500 }
    );
  }
}
