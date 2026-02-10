-- Add progress_status field to track detailed progress during AI processing
ALTER TABLE public.blog_topics 
ADD COLUMN IF NOT EXISTS progress_status text;

-- Add index for faster queries on in_progress topics
CREATE INDEX IF NOT EXISTS idx_blog_topics_status_progress 
ON public.blog_topics(status, progress_status) 
WHERE status = 'in_progress';
