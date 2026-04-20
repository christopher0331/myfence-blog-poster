import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

const ALLOWED_FIELDS = new Set([
  "name",
  "abbreviation",
  "domain",
  "github_repo_owner",
  "github_repo_name",
  "github_default_branch",
  "business_description",
  "location",
  "notify_emails",
  "blog_path_prefix",
  "auto_publish_enabled",
  "posts_per_week",
  "posting_days",
  "posting_hour_utc",
  "timezone",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(k)) payload[k] = v;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("sites")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, site: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Update failed" },
      { status: 500 },
    );
  }
}
