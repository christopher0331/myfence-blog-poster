-- Create blog_topics table for MyFence Studio
-- This table stores research topics that AI will use to write blog posts

CREATE TABLE IF NOT EXISTS public.blog_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'in_progress', 'completed', 'rejected')),
  keywords text[] DEFAULT '{}',
  research_notes text,
  priority integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_topics ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view blog_topics"
ON public.blog_topics
FOR SELECT
TO public
USING (true);

-- Only authenticated users can insert/update (for MyFence Studio)
CREATE POLICY "Authenticated users can manage blog_topics"
ON public.blog_topics
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow secret key to manage topics (for API routes)
CREATE POLICY "Service role can manage blog_topics"
ON public.blog_topics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create updated_at trigger (if the function doesn't exist, create it first)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_blog_topics_updated_at
BEFORE UPDATE ON public.blog_topics
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_blog_topics_status ON public.blog_topics(status);
CREATE INDEX IF NOT EXISTS idx_blog_topics_priority ON public.blog_topics(priority DESC);
