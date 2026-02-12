import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** PATCH /api/feedback/[id] — update status (top-level only). Body: { status } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body as { status?: string };

    if (!status || !["open", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "status must be open, in_progress, or resolved" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("client_feedback")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .is("parent_id", null)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found or not a thread" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Feedback PATCH error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Update failed" },
      { status: 500 }
    );
  }
}
