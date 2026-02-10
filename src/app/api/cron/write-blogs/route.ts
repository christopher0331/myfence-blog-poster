import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBlogPost } from "@/lib/gemini";
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
 * GET /api/cron/write-blogs
 * Scheduled cron job to automatically write blogs from approved topics
 * 
 * This endpoint should be called by Netlify's scheduled functions or an external cron service
 * 
 * To set up in Netlify:
 * 1. Go to Netlify → Functions → Scheduled Functions
 * 2. Create a new scheduled function that calls this endpoint
 * 3. Set schedule (e.g., "0 9 * * *" for daily at 9 AM)
 */
export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request (optional: add auth header check)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();

    // Find approved topics that haven't been written yet
    const { data: topics, error: topicsError } = await supabase
      .from("blog_topics")
      .select("*")
      .eq("status", "approved")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1); // Process one topic per cron run

    if (topicsError) {
      throw new Error(`Failed to fetch topics: ${topicsError.message}`);
    }

    if (!topics || topics.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No approved topics to process",
        processed: 0,
      });
    }

    const topic = topics[0];
    
    // Update topic status to in_progress
    await supabase
      .from("blog_topics")
      .update({ status: "in_progress" })
      .eq("id", topic.id);

    // Generate blog post using Gemini
    console.log(`[Cron] Generating blog post for topic: ${topic.title}`);
    let blogPost;
    try {
      blogPost = await generateBlogPost({
        topic: topic.title,
        keywords: topic.keywords || [],
        researchNotes: topic.research_notes || undefined,
        targetLength: 1500,
      });
      console.log(`[Cron] Successfully generated blog post: ${blogPost.title}`);
    } catch (geminiError: any) {
      console.error("[Cron] Gemini API error:", geminiError);
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
          topic_id: topic.id,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDraft.id)
        .select()
        .single();

      if (updateError || !updatedDraft) {
        throw new Error(`Failed to update draft: ${updateError?.message}`);
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
          topic_id: topic.id,
          status: "scheduled",
        })
        .select()
        .single();

      if (createError || !newDraft) {
        throw new Error(`Failed to create draft: ${createError?.message}`);
      }
      draftId = newDraft.id;
    }

    // Commit directly to GitHub
    let githubUrl: string | null = null;
    try {
      console.log(`[Cron] Committing to GitHub: ${slug}`);
      // Build MDX content with frontmatter
      const today = new Date().toISOString().split("T")[0];
      const publishDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      const frontmatter = [
        "---",
        `title: "${blogPost.title.replace(/"/g, '\\"')}"`,
        `description: "${blogPost.metaDescription.replace(/"/g, '\\"')}"`,
        `slug: "${slug}"`,
        `category: "${blogPost.category || ""}"`,
        `readTime: "${blogPost.readTime || "5 min read"}"`,
        `publishDate: "${publishDate}"`,
        `datePublished: "${today}"`,
        `dateModified: "${today}"`,
        "---",
      ].join("\n");

      const mdxContent = `${frontmatter}\n\n${blogPost.content}`;

      // Commit directly to main branch
      const { commitUrl } = await commitBlogDirectly({
        slug,
        mdxContent,
        title: blogPost.title,
        commitMessage: `Auto-generated blog: ${blogPost.title}`,
      });

      githubUrl = commitUrl;
      console.log(`[Cron] Successfully committed to GitHub: ${commitUrl}`);

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
        .eq("id", topic.id);
    } catch (githubError: any) {
      console.error("[Cron] GitHub commit error:", githubError);
      // Don't fail the whole request if GitHub fails, but log it
    }

    const result = {
      draftId,
      title: blogPost.title,
      slug,
      githubUrl,
    };

    return NextResponse.json({
      success: true,
      message: `Successfully wrote blog post: ${result.title}`,
      processed: 1,
      topicId: topic.id,
      ...result,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process cron job",
      },
      { status: 500 }
    );
  }
}
