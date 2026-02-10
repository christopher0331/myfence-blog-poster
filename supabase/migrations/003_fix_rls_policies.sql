-- Fix RLS policies to allow secret key (service_role) access
-- This is needed for API routes using SUPABASE_SECRET_KEY

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage blog_topics" ON public.blog_topics;
DROP POLICY IF EXISTS "Service role can manage blog_drafts" ON public.blog_drafts;

-- Allow service_role (secret key) full access to blog_topics
CREATE POLICY "Service role can manage blog_topics"
ON public.blog_topics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service_role (secret key) full access to blog_drafts
CREATE POLICY "Service role can manage blog_drafts"
ON public.blog_drafts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow anon (publishable key) to read, but service_role handles writes
-- These should already exist, but ensure they're there
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'blog_topics' 
    AND policyname = 'Anon can read topics'
  ) THEN
    CREATE POLICY "Anon can read topics" 
    ON public.blog_topics 
    FOR SELECT 
    TO anon 
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'blog_drafts' 
    AND policyname = 'Anon can read drafts'
  ) THEN
    CREATE POLICY "Anon can read drafts" 
    ON public.blog_drafts 
    FOR SELECT 
    TO anon 
    USING (true);
  END IF;
END $$;
