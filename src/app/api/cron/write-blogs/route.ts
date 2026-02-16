import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateBlogPost } from "@/lib/gemini";
import { sanitizeMdxBody } from "@/lib/utils";
import { publishScheduledDrafts } from "@/lib/publish-scheduled";

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
 * Scheduled cron job to automatically write blogs from ready topics
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

    // Atomically claim the next ready topic. Uses FOR UPDATE SKIP LOCKED
    // so concurrent cron runs cannot claim the same topic (prevents duplicate writes).
    const { data: claimedTopics, error: claimError } = await supabase
      .rpc("claim_next_approved_topic");

    if (claimError) {
      throw new Error(`Failed to claim topic: ${claimError.message}`);
    }

    const topic = Array.isArray(claimedTopics) && claimedTopics.length > 0
      ? claimedTopics[0]
      : null;

    if (!topic) {
      // No topics to write, but still check for scheduled drafts to publish
      let publishResult;
      try {
        publishResult = await publishScheduledDrafts();
        if (publishResult.published > 0) {
          console.log(`[Cron] Published scheduled draft: ${publishResult.message}`);
        }
      } catch (pubErr: any) {
        console.error("[Cron] Publish scheduled error (non-fatal):", pubErr.message);
      }

      return NextResponse.json({
        success: true,
        message: "No ready topics to process",
        processed: 0,
        scheduledPublish: publishResult || null,
      });
    }

    topicId = topic.id;

    // Topic is already set to in_progress by claim_next_approved_topic

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
          body_mdx: sanitizeMdxBody(blogPost.content),
          meta_description: blogPost.metaDescription,
          category: blogPost.category || "",
          read_time: blogPost.readTime || "5 min read",
          topic_id: topic.id,
          status: "draft",
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
          body_mdx: sanitizeMdxBody(blogPost.content),
          meta_description: blogPost.metaDescription,
          category: blogPost.category || "",
          read_time: blogPost.readTime || "5 min read",
          topic_id: topic.id,
          status: "draft",
        })
        .select()
        .single();

      if (createError || !newDraft) {
        throw new Error(`Failed to create draft: ${createError?.message}`);
      }
      draftId = newDraft.id;
    }

    // Mark topic as completed — article has been written.
    // The draft stays as "draft" until the user reviews and publishes it manually
    // via the "Publish to GitHub" button in the post editor.
    await supabase
      .from("blog_topics")
      .update({ status: "completed" })
      .eq("id", topic.id);

    console.log(`[Cron] Draft saved (id: ${draftId}). Awaiting manual publish.`);

    const result = {
      draftId,
      title: blogPost.title,
      slug,
    };

    // Also check for any scheduled drafts ready to publish
    let publishResult;
    try {
      publishResult = await publishScheduledDrafts();
      if (publishResult.published > 0) {
        console.log(`[Cron] Also published scheduled draft: ${publishResult.message}`);
      }
    } catch (pubErr: any) {
      console.error("[Cron] Publish scheduled error (non-fatal):", pubErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully wrote blog post: ${result.title}`,
      processed: 1,
      topicId: topic.id,
      ...result,
      scheduledPublish: publishResult || null,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    
    // If we have a topic ID, update its status to show the error
    if (topicId) {
      try {
        await getAdminClient()
          .from("blog_topics")
          .update({ status: "ready" }) // Reset so it can be retried
          .eq("id", topicId);
      } catch (updateError) {
        console.error("Failed to update topic error status:", updateError);
      }
    }

    // Even if writing failed, still try to publish any scheduled drafts
    let publishResult;
    try {
      publishResult = await publishScheduledDrafts();
      if (publishResult.published > 0) {
        console.log(`[Cron] Published scheduled draft despite write error: ${publishResult.message}`);
      }
    } catch (pubErr: any) {
      console.error("[Cron] Publish scheduled error (non-fatal):", pubErr.message);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process cron job",
        scheduledPublish: publishResult || null,
      },
      { status: 500 }
    );
  }
}
