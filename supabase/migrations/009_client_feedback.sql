-- Ensure updated_at trigger function exists (may already exist from 001_initial_schema).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Client feedback / change requests: client submits, owner replies, both can attach images.
CREATE TABLE IF NOT EXISTS public.client_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES public.client_feedback(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('client', 'owner')),
  subject TEXT,
  message TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only top-level items have status; replies use parent's status.
COMMENT ON TABLE public.client_feedback IS 'Client change requests and owner replies; parent_id null = request, non-null = reply';
COMMENT ON COLUMN public.client_feedback.image_urls IS 'Array of image URLs (e.g. from Supabase Storage)';

CREATE INDEX IF NOT EXISTS idx_client_feedback_parent ON public.client_feedback(parent_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_created ON public.client_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_feedback_status ON public.client_feedback(status) WHERE parent_id IS NULL;

CREATE TRIGGER update_client_feedback_updated_at
  BEFORE UPDATE ON public.client_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read client_feedback"
  ON public.client_feedback FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow insert client_feedback"
  ON public.client_feedback FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Allow update client_feedback"
  ON public.client_feedback FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Storage bucket "feedback-attachments" and policies: create in Supabase Dashboard (Storage → New bucket, name: feedback-attachments, public) or via API in upload route.
