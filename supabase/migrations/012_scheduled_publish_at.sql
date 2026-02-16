-- Add scheduled_publish_at (TIMESTAMPTZ) for cron-based auto-publishing.
-- When a draft has status = 'scheduled' and scheduled_publish_at <= NOW(),
-- the publish cron commits it to GitHub.
ALTER TABLE blog_drafts ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

-- Copy existing scheduled_date values (DATE → TIMESTAMPTZ at midnight UTC)
UPDATE blog_drafts
  SET scheduled_publish_at = scheduled_date::timestamptz
  WHERE scheduled_date IS NOT NULL AND scheduled_publish_at IS NULL;

-- Index for the publish cron query
CREATE INDEX IF NOT EXISTS idx_blog_drafts_scheduled_publish
  ON blog_drafts(status, scheduled_publish_at)
  WHERE status = 'scheduled' AND scheduled_publish_at IS NOT NULL;
