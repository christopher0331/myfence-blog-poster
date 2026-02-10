import { NextRequest, NextResponse } from "next/server";
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
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.AUTH_URL || 
                   request.nextUrl.origin;

    // Call the write-blog API endpoint
    const writeResponse = await fetch(`${baseUrl}/api/write-blog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass cron secret if set
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({
        topicId: topic.id,
        commitToGitHub: true, // Auto-commit to GitHub
      }),
    });

    if (!writeResponse.ok) {
      const error = await writeResponse.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Failed to write blog: ${error.error || writeResponse.statusText}`);
    }

    const result = await writeResponse.json();

    return NextResponse.json({
      success: true,
      message: `Successfully wrote blog post: ${result.title}`,
      processed: 1,
      topicId: topic.id,
      draftId: result.draftId,
      githubUrl: result.githubUrl,
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
