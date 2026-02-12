-- Ensure blog_drafts has structured_data (and featured_image) for cron/manual write-blog
ALTER TABLE public.blog_drafts
  ADD COLUMN IF NOT EXISTS structured_data JSONB,
  ADD COLUMN IF NOT EXISTS featured_image TEXT DEFAULT '';

COMMENT ON COLUMN public.blog_drafts.structured_data IS 'imageCaption, layout, showArticleSummary from Gemini';
COMMENT ON COLUMN public.blog_drafts.featured_image IS 'Hero/featured image URL for the post';
