-- 015 Auto-scheduling: per-site cadence (posts/week, days, hour)
-- Adds columns to sites and a helper view for the cron.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS auto_publish_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS posts_per_week integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS posting_days integer[] NOT NULL DEFAULT ARRAY[1,4]::integer[],
  ADD COLUMN IF NOT EXISTS posting_hour_utc integer NOT NULL DEFAULT 16,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles';

COMMENT ON COLUMN public.sites.posting_days IS
  'Day-of-week numbers (0=Sun .. 6=Sat). Default [1,4] = Monday + Thursday.';
COMMENT ON COLUMN public.sites.posting_hour_utc IS
  'Hour of day (0-23) in UTC when scheduled posts go live. Default 16 UTC (~09:00 Pacific).';
COMMENT ON COLUMN public.sites.posts_per_week IS
  'How many posts per week to auto-schedule from ready topics.';
COMMENT ON COLUMN public.sites.auto_publish_enabled IS
  'When true, the cron will claim topics, write drafts, and auto-publish at scheduled times.';

-- Seed sensible defaults for any pre-existing sites without values already set.
UPDATE public.sites
SET posting_days = ARRAY[1,4]::integer[]
WHERE posting_days IS NULL OR array_length(posting_days, 1) IS NULL;
