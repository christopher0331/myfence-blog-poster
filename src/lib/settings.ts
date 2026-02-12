export type ArticleBuildMode = "manual" | "cron";

const ARTICLE_BUILD_MODE_KEY = "article_build_mode";

/** Minimal type so any Supabase client is accepted (avoids generic mismatch across createClient call sites). */
type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => { eq: (column: string, value: string) => { single: () => Promise<{ data: { value?: string } | null }> } };
  };
};

/**
 * Returns the current article build mode from app_settings.
 * Uses SUPABASE_SECRET_KEY (service role). Defaults to "manual" if missing or invalid.
 */
export async function getArticleBuildMode(
  supabase: SupabaseClientLike
): Promise<ArticleBuildMode> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ARTICLE_BUILD_MODE_KEY)
    .single();

  const value = data?.value;
  if (value === "manual" || value === "cron") return value;
  return "manual";
}
