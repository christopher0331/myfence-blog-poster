import type { SiteConfig } from "@/lib/types";
import { getAdminClient } from "@/lib/supabase-admin";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function siteSlotHour(site: SiteConfig): number {
  const h = site.posting_hour_utc;
  if (typeof h !== "number" || h < 0 || h > 23) return 16;
  return h;
}

function sitePostingDays(site: SiteConfig): number[] {
  const days = Array.isArray(site.posting_days) ? site.posting_days : [];
  const valid = days.filter((d) => typeof d === "number" && d >= 0 && d <= 6);
  return valid.length ? valid : [1, 4]; // Mon + Thu default
}

/**
 * Returns the timestamp of the next matching posting-day slot on or after
 * `from`, at the configured UTC hour. If `from` already matches the hour it
 * returns the same day.
 */
function nextDayAt(from: Date, targetDayOfWeek: number, hourUtc: number): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hourUtc, 0, 0, 0),
  );
  const currentDow = d.getUTCDay();
  let delta = targetDayOfWeek - currentDow;
  if (delta < 0) delta += 7;
  // If same day but target hour already passed, go to next week
  if (delta === 0 && d.getTime() <= from.getTime()) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

/**
 * Compute the next open scheduling slot for a site, avoiding collisions with
 * already-scheduled drafts. Returns an ISO timestamp string.
 */
export async function nextSlot(site: SiteConfig, from: Date = new Date()): Promise<string> {
  const hour = siteSlotHour(site);
  const days = sitePostingDays(site).sort((a, b) => a - b);

  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from("blog_drafts")
    .select("scheduled_publish_at")
    .eq("site_id", site.id)
    .in("status", ["scheduled", "draft", "review"])
    .not("scheduled_publish_at", "is", null)
    .gte("scheduled_publish_at", from.toISOString());

  const taken = new Set<number>(
    (existing || [])
      .map((r: any) => new Date(r.scheduled_publish_at).getTime())
      .filter((t: number) => !isNaN(t)),
  );

  // Walk forward week by week until we find an open slot
  for (let week = 0; week < 12; week++) {
    const base = new Date(from.getTime() + week * 7 * MS_PER_DAY);
    for (const dow of days) {
      const candidate = nextDayAt(base, dow, hour);
      if (candidate.getTime() < from.getTime()) continue;
      if (!taken.has(candidate.getTime())) {
        return candidate.toISOString();
      }
    }
  }

  // Fallback: just add a week to the very first day in `days`
  const fallback = nextDayAt(from, days[0], hour);
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  return fallback.toISOString();
}

/**
 * Loads all sites that have auto_publish_enabled = true.
 */
export async function getAutoEnabledSites(): Promise<SiteConfig[]> {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("sites")
    .select(
      "id, name, abbreviation, domain, github_repo_owner, github_repo_name, github_default_branch, business_description, location, notify_emails, blog_path_prefix, auto_publish_enabled, posts_per_week, posting_days, posting_hour_utc, timezone",
    )
    .eq("auto_publish_enabled", true);

  return (data || []) as SiteConfig[];
}
