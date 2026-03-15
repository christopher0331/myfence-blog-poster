import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { SiteConfig } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
const DEFAULT_SITE_ID = "11111111-1111-1111-1111-111111111111";

function getAdminClient() {
  if (!supabaseSecretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getSites(): Promise<SiteConfig[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("sites")
    .select(
      "id, name, abbreviation, domain, github_repo_owner, github_repo_name, github_default_branch, business_description, location, notify_emails, blog_path_prefix",
    )
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as SiteConfig[];
}

export async function getSiteById(siteId: string): Promise<SiteConfig | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("sites")
    .select(
      "id, name, abbreviation, domain, github_repo_owner, github_repo_name, github_default_branch, business_description, location, notify_emails, blog_path_prefix",
    )
    .eq("id", siteId)
    .single();

  if (error || !data) return null;
  return data as SiteConfig;
}

export async function getSiteFromRequest(req: NextRequest): Promise<SiteConfig> {
  const requestedSiteId =
    req.headers.get("x-site-id") ||
    req.nextUrl.searchParams.get("siteId") ||
    DEFAULT_SITE_ID;

  const site = await getSiteById(requestedSiteId);
  if (site) return site;

  const fallback = await getSiteById(DEFAULT_SITE_ID);
  if (!fallback) throw new Error("No site configuration found");
  return fallback;
}
