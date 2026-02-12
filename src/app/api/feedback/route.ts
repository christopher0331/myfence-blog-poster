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

const BUCKET = "feedback-attachments";

/** GET /api/feedback — list threads (top-level) or one thread with replies when ?thread=id */
export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("thread");

    if (threadId) {
      const { data: thread, error: threadError } = await supabase
        .from("client_feedback")
        .select("*")
        .eq("id", threadId)
        .is("parent_id", null)
        .single();
      if (threadError || !thread) {
        return NextResponse.json({ error: "Thread not found" }, { status: 404 });
      }
      const { data: replies, error: repliesError } = await supabase
        .from("client_feedback")
        .select("*")
        .eq("parent_id", threadId)
        .order("created_at", { ascending: true });
      if (repliesError) throw repliesError;
      return NextResponse.json({
        ...thread,
        replies: replies || [],
      });
    }

    const { data: threads, error } = await supabase
      .from("client_feedback")
      .select("id, subject, author, status, message, image_urls, created_at")
      .is("parent_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const withCount = await Promise.all(
      (threads || []).map(async (t) => {
        const { count } = await supabase
          .from("client_feedback")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", t.id);
        return { ...t, replyCount: count ?? 0 };
      })
    );

    return NextResponse.json(withCount);
  } catch (err: unknown) {
    console.error("Feedback GET error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load feedback" },
      { status: 500 }
    );
  }
}

/** POST /api/feedback — create request (client) or reply (owner); body: { parent_id?, subject?, message, image_urls?, author } */
export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const body = await req.json();
    const { parent_id, subject, message, image_urls, author } = body as {
      parent_id?: string;
      subject?: string;
      message?: string;
      image_urls?: string[];
      author?: "client" | "owner";
    };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const resolvedAuthor = author === "owner" ? "owner" : "client";
    const isReply = !!parent_id;

    const row: Record<string, unknown> = {
      author: resolvedAuthor,
      message: message.trim(),
      image_urls: Array.isArray(image_urls) ? image_urls : [],
    };

    if (isReply) {
      row.parent_id = parent_id;
    } else {
      if (subject != null) row.subject = String(subject).trim() || null;
      row.status = "open";
    }

    const { data, error } = await supabase
      .from("client_feedback")
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Feedback POST error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create feedback" },
      { status: 500 }
    );
  }
}
