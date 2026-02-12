export type ArticleBuildMode = "manual" | "cron";

const ARTICLE_BUILD_MODE_KEY = "article_build_mode";

/**
 * Returns the current article build mode from app_settings.
 * Uses SUPABASE_SECRET_KEY (service role). Defaults to "manual" if missing or invalid.
 * @param supabase - Supabase client (typed as any to avoid deep generic instantiation with createClient)
 */
export async function getArticleBuildMode(supabase: any): Promise<ArticleBuildMode> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", ARTICLE_BUILD_MODE_KEY)
    .single();

  const value = data?.value;
  if (value === "manual" || value === "cron") return value;
  return "manual";
}
