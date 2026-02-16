import { NextRequest, NextResponse } from "next/server";
import { publishScheduledDrafts } from "@/lib/publish-scheduled";

/**
 * GET /api/cron/publish-blogs
 *
 * Publishes drafts whose scheduled_publish_at has passed.
 * This is also called automatically by the write-blogs cron,
 * but can be called independently if needed.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await publishScheduledDrafts();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Publish Cron] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to publish scheduled blogs" },
      { status: 500 }
    );
  }
}
