-- Add brief description (AI-generated scope for the article) and topic images for article writing
ALTER TABLE public.blog_topics
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS topic_images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.blog_topics.description IS 'Brief description of what the article will cover (from AI research)';
COMMENT ON COLUMN public.blog_topics.topic_images IS 'Array of { url: string, description: string } for images to use in the article';
