-- Stores competitor analysis results so they persist across page loads
CREATE TABLE IF NOT EXISTS public.competitor_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor text NOT NULL,
  total_pages integer NOT NULL DEFAULT 0,
  content_pages integer NOT NULL DEFAULT 0,
  gaps integer NOT NULL DEFAULT 0,
  already_covered integer NOT NULL DEFAULT 0,
  opportunities jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view competitor_analyses"
ON public.competitor_analyses FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage competitor_analyses"
ON public.competitor_analyses FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage competitor_analyses"
ON public.competitor_analyses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_competitor_analyses_updated_at
BEFORE UPDATE ON public.competitor_analyses
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_competitor_analyses_created
ON public.competitor_analyses(created_at DESC);
