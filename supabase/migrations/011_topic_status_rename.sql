-- Rename topic statuses: suggested→preparing, approved→ready, remove rejected
-- Preparing: staged, do nothing
-- Ready: cron writes article when it runs
-- In Progress: currently being written, do nothing
-- Completed: done, do nothing

-- 1. Migrate existing data
UPDATE public.blog_topics
SET status = CASE status
  WHEN 'suggested' THEN 'preparing'
  WHEN 'approved' THEN 'ready'
  WHEN 'rejected' THEN 'preparing'
  ELSE status  -- in_progress, completed unchanged
END;

-- 2. Drop old check constraint (name may vary; try common pattern)
ALTER TABLE public.blog_topics DROP CONSTRAINT IF EXISTS blog_topics_status_check;

-- 3. Add new check constraint
ALTER TABLE public.blog_topics
ADD CONSTRAINT blog_topics_status_check
CHECK (status IN ('preparing', 'ready', 'in_progress', 'completed'));

-- 4. Update default for new rows
ALTER TABLE public.blog_topics ALTER COLUMN status SET DEFAULT 'preparing';

-- 5. Update claim function to select 'ready' topics
CREATE OR REPLACE FUNCTION public.claim_next_approved_topic()
RETURNS SETOF public.blog_topics
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.blog_topics
  SET status = 'in_progress', updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.blog_topics
    WHERE status = 'ready'
    ORDER BY priority DESC NULLS LAST, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
