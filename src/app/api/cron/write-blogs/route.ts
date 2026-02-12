import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBlogPost } from "@/lib/gemini";
import { commitBlogDirectly } from "@/lib/github";
import { getArticleBuildMode } from "@/lib/settings";

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

  let topicId: string | null = null;

  try {
    const supabase = getAdminClient();

    const articleBuildMode = await getArticleBuildMode(supabase);
    if (articleBuildMode === "manual") {
      return NextResponse.json({
        success: true,
        message: "Cron disabled – manual mode",
        processed: 0,
      });
    }

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
    topicId = topic.id;
    
    // Update topic status to in_progress with initial progress
    await supabase
      .from("blog_topics")
      .update({ 
        status: "in_progress",
        progress_status: "Starting research and content generation..."
      })
      .eq("id", topic.id);

    // Generate blog post using Gemini
    console.log(`[Cron] Generating blog post for topic: ${topic.title}`);
    
    // Update progress: Researching
    await supabase
      .from("blog_topics")
      .update({ progress_status: "Researching topic and gathering information..." })
      .eq("id", topic.id);
    
    let blogPost;
    try {
      // Update progress: Generating content
      await supabase
        .from("blog_topics")
        .update({ progress_status: "Generating blog content with AI..." })
        .eq("id", topic.id);
      
      blogPost = await generateBlogPost({
        topic: topic.title,
        keywords: topic.keywords || [],
        researchNotes: topic.research_notes || undefined,
        topicDescription: topic.description || undefined,
        topicImages: Array.isArray(topic.topic_images) ? topic.topic_images : undefined,
        targetLength: 1500,
      });
      console.log(`[Cron] Successfully generated blog post: ${blogPost.title}`);
      
      // Update progress: Saving draft
      await supabase
        .from("blog_topics")
        .update({ progress_status: "Saving draft to database..." })
        .eq("id", topic.id);
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
      // Update progress: Committing to GitHub
      await supabase
        .from("blog_topics")
        .update({ progress_status: "Committing to GitHub repository..." })
        .eq("id", topic.id);
      
      console.log(`[Cron] Committing to GitHub: ${slug}`);
      // Build MDX content with frontmatter (matching src/content/blog/*.mdx format)
      const today = new Date().toISOString().split("T")[0];
      const publishDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      // Get featured image from draft if available
      const { data: draftData } = await supabase
        .from("blog_drafts")
        .select("featured_image")
        .eq("id", draftId)
        .single();

      const imageValue = draftData?.featured_image || "";
      
      // Build keywords from topic keywords if available
      const keywords = topic.keywords && topic.keywords.length > 0
        ? topic.keywords.join(", ")
        : undefined;

      const frontmatterLines = [
        "---",
        `title: "${blogPost.title.replace(/"/g, '\\"')}"`,
        `description: "${blogPost.metaDescription.replace(/"/g, '\\"')}"`,
        `slug: "${slug}"`,
        `category: "${blogPost.category || ""}"`,
      ];

      // Add image only if it exists
      if (imageValue) {
        frontmatterLines.push(`image: "${imageValue.replace(/"/g, '\\"')}"`);
      }

      frontmatterLines.push(
        `readTime: "${blogPost.readTime || "5 min read"}"`,
        `publishDate: "${publishDate}"`,
        `datePublished: "${today}"`,
        `dateModified: "${today}"`
      );

      // Add keywords only if they exist
      if (keywords) {
        frontmatterLines.push(`keywords: "${keywords.replace(/"/g, '\\"')}"`);
      }

      frontmatterLines.push("---");
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
        .update({ 
          status: "completed",
          progress_status: "✓ Blog post successfully created and published!"
        })
        .eq("id", topic.id);
    } catch (githubError: any) {
      console.error("[Cron] GitHub commit error:", githubError);
      // Update progress with error but mark as completed since draft was created
      await supabase
        .from("blog_topics")
        .update({ 
          status: "completed",
          progress_status: "✓ Draft created, but GitHub commit failed. Check logs."
        })
        .eq("id", topic.id);
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
    
    // If we have a topic ID, update its status to show the error
    if (topicId) {
      try {
        await getAdminClient()
          .from("blog_topics")
          .update({ 
            status: "approved", // Reset to approved so it can be retried
            progress_status: `❌ Error: ${error.message || "Failed to process"}` 
          })
          .eq("id", topicId);
      } catch (updateError) {
        console.error("Failed to update topic error status:", updateError);
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process cron job",
      },
      { status: 500 }
    );
  }
}
