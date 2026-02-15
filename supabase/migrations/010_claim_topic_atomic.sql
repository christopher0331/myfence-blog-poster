-- Atomically claim the next approved topic for processing.
-- Uses FOR UPDATE SKIP LOCKED so concurrent cron runs cannot claim the same topic.
-- Returns the claimed topic row, or empty if no approved topics exist.
CREATE OR REPLACE FUNCTION public.claim_next_approved_topic()
RETURNS SETOF public.blog_topics
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.blog_topics
  SET status = 'in_progress', updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.blog_topics
    WHERE status = 'approved'
    ORDER BY priority DESC NULLS LAST, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
