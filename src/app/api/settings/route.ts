import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

function getAdminClient() {
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ARTICLE_BUILD_MODE_KEY = "article_build_mode";
export type ArticleBuildMode = "manual" | "cron";

/** GET /api/settings — returns public app settings (e.g. article_build_mode for UI gating) */
export async function GET() {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [ARTICLE_BUILD_MODE_KEY]);

    if (error) {
      throw new Error(error.message);
    }

    const mode =
      (data?.find((r) => r.key === ARTICLE_BUILD_MODE_KEY)?.value as ArticleBuildMode) ||
      "manual";

    return NextResponse.json({
      article_build_mode: mode === "cron" ? "cron" : "manual",
    });
  } catch (err: unknown) {
    console.error("Settings GET error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

/** PATCH /api/settings — update article_build_mode */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { article_build_mode } = body as { article_build_mode?: string };

    if (article_build_mode !== undefined) {
      if (article_build_mode !== "manual" && article_build_mode !== "cron") {
        return NextResponse.json(
          { error: "article_build_mode must be 'manual' or 'cron'" },
          { status: 400 }
        );
      }

      const supabase = getAdminClient();
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: ARTICLE_BUILD_MODE_KEY,
            value: article_build_mode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
