import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBlogPost } from "@/lib/gemini";
import { createBlogPR, commitBlogDirectly } from "@/lib/github";

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
 * POST /api/write-blog
 * Takes a topic ID, uses Gemini to write a blog post, creates a draft, and commits to GitHub
 */
export async function POST(req: NextRequest) {
  try {
    const { topicId, commitToGitHub = false } = await req.json();

    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch the topic
    const { data: topic, error: topicError } = await supabase
      .from("blog_topics")
      .select("*")
      .eq("id", topicId)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Check if topic is approved and ready
    if (topic.status !== "approved" && topic.status !== "in_progress") {
      return NextResponse.json(
        { error: `Topic status must be "approved" or "in_progress". Current status: ${topic.status}` },
        { status: 400 }
      );
    }

    // Update topic status to in_progress
    await supabase
      .from("blog_topics")
      .update({ status: "in_progress" })
      .eq("id", topicId);

    // Generate blog post using Gemini
    console.log(`Generating blog post for topic: ${topic.title}`);
    let blogPost;
    try {
      blogPost = await generateBlogPost({
        topic: topic.title,
        keywords: topic.keywords || [],
        researchNotes: topic.research_notes || undefined,
        targetLength: 1500,
      });
      console.log(`Successfully generated blog post: ${blogPost.title}`);
    } catch (geminiError: any) {
      console.error("Gemini API error details:", geminiError);
      throw new Error(`Gemini API failed: ${geminiError.message}`);
    }

    // Generate slug from title
    const slug = blogPost.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if draft with this slug already exists
    const { data: existingDraft } = await supabase
      .from("blog_drafts")
      .select("id")
      .eq("slug", slug)
      .single();

    let draftId: string;

    if (existingDraft) {
      // Update existing draft
      const { data: updatedDraft, error: updateError } = await supabase
        .from("blog_drafts")
        .update({
          title: blogPost.title,
          body_mdx: blogPost.content,
          meta_description: blogPost.metaDescription,
          category: blogPost.category || "",
          read_time: blogPost.readTime || "5 min read",
          featured_image: (blogPost as any).featuredImage || null,
          structured_data: {
            imageCaption: (blogPost as any).imageCaption,
            layout: (blogPost as any).layout,
            showArticleSummary: (blogPost as any).showArticleSummary,
          },
          topic_id: topicId,
          status: commitToGitHub ? "scheduled" : "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDraft.id)
        .select()
        .single();

      if (updateError || !updatedDraft) {
        throw new Error("Failed to update draft");
      }
      draftId = updatedDraft.id;
    } else {
      // Create new draft
      const { data: newDraft, error: createError } = await supabase
        .from("blog_drafts")
        .insert({
          title: blogPost.title,
          slug,
          body_mdx: blogPost.content,
          meta_description: blogPost.metaDescription,
          category: blogPost.category || "",
          read_time: blogPost.readTime || "5 min read",
          featured_image: (blogPost as any).featuredImage || null,
          structured_data: {
            imageCaption: (blogPost as any).imageCaption,
            layout: (blogPost as any).layout,
            showArticleSummary: (blogPost as any).showArticleSummary,
          },
          topic_id: topicId,
          status: commitToGitHub ? "scheduled" : "draft",
        })
        .select()
        .single();

      if (createError || !newDraft) {
        throw new Error(`Failed to create draft: ${createError?.message}`);
      }
      draftId = newDraft.id;
    }

    // If commitToGitHub is true, commit directly to GitHub
    let githubUrl: string | null = null;
    if (commitToGitHub) {
      try {
        // Build MDX content with frontmatter
        const today = new Date().toISOString().split("T")[0];
        const publishDate = new Date().toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        const bp = blogPost as any;
        const frontmatterLines = [
          "---",
          `title: "${blogPost.title.replace(/"/g, '\\"')}"`,
          `description: "${blogPost.metaDescription.replace(/"/g, '\\"')}"`,
          `slug: "${slug}"`,
          `category: "${blogPost.category || ""}"`,
          `image: "${bp.featuredImage || ""}"`,
          `readTime: "${blogPost.readTime || "5 min read"}"`,
          `publishDate: "${publishDate}"`,
          `datePublished: "${today}"`,
          `dateModified: "${today}"`,
          bp.imageCaption ? `imageCaption: "${String(bp.imageCaption).replace(/"/g, '\\"')}"` : null,
          bp.layout ? `layout: "${bp.layout}"` : null,
          bp.showArticleSummary !== undefined ? `showArticleSummary: ${bp.showArticleSummary}` : null,
        ].filter(Boolean);
        const frontmatter = frontmatterLines.join("\n");

        const mdxContent = `${frontmatter}\n\n${blogPost.content}`;

        // Commit directly to main branch
        const { commitUrl } = await commitBlogDirectly({
          slug,
          mdxContent,
          title: blogPost.title,
          commitMessage: `Auto-generated blog: ${blogPost.title}`,
        });

        githubUrl = commitUrl;

        // Update draft with GitHub URL
        await supabase
          .from("blog_drafts")
          .update({
            github_pr_url: commitUrl,
            status: "published",
            published_at: new Date().toISOString(),
          })
          .eq("id", draftId);

        // Mark topic as completed
        await supabase
          .from("blog_topics")
          .update({ status: "completed" })
          .eq("id", topicId);
      } catch (githubError: any) {
        console.error("GitHub commit error:", githubError);
        // Don't fail the whole request if GitHub fails
      }
    } else {
      // Mark topic as in_progress (blog written but not published)
      await supabase
        .from("blog_topics")
        .update({ status: "in_progress" })
        .eq("id", topicId);
    }

    return NextResponse.json({
      success: true,
      draftId,
      title: blogPost.title,
      slug,
      githubUrl,
      message: commitToGitHub
        ? "Blog post written and committed to GitHub"
        : "Blog post written and saved as draft",
    });
  } catch (error: any) {
    console.error("Write blog error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to write blog post" },
      { status: 500 }
    );
  }
}
