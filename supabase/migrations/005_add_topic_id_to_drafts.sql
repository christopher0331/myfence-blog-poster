-- Ensure topic_id column exists in blog_drafts table
-- This links blog drafts to their source topics

-- Add topic_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'blog_drafts' 
    AND column_name = 'topic_id'
  ) THEN
    ALTER TABLE public.blog_drafts 
    ADD COLUMN topic_id UUID REFERENCES public.blog_topics(id) ON DELETE SET NULL;
    
    -- Add index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_blog_drafts_topic_id ON public.blog_drafts(topic_id);
  END IF;
END $$;
