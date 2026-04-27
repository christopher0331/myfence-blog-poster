import { NextRequest, NextResponse } from "next/server";
import { getSiteFromRequest } from "@/lib/get-site";
import { getAdminClient } from "@/lib/supabase-admin";
import { publishScheduledDrafts } from "@/lib/publish-scheduled";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const site = await getSiteFromRequest(request);
    const supabase = getAdminClient();

    const { data: draft, error: fetchError } = await supabase
      .from("blog_drafts")
      .select("id, site_id, status, scheduled_publish_at")
      .eq("id", id)
      .eq("site_id", site.id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { success: false, error: fetchError?.message || "Draft not found" },
        { status: 404 },
      );
    }

    await supabase
      .from("blog_drafts")
      .update({
        status: "scheduled",
        scheduled_publish_at: draft.scheduled_publish_at || new Date().toISOString(),
      })
      .eq("id", id)
      .eq("site_id", site.id);

    const result = await publishScheduledDrafts(10);
    const entry = result.entries.find((item) => item.draftId === id);

    if (!entry) {
      return NextResponse.json({
        success: false,
        error: "Publish was triggered, but this draft was not picked up as due.",
        result,
      });
    }

    return NextResponse.json({
      success: !entry.error,
      error: entry.error,
      entry,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to publish draft" },
      { status: 500 },
    );
  }
}
