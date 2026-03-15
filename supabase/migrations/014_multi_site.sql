-- Multi-site support: shared CMS managing multiple brands/sites

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  abbreviation text NOT NULL,
  domain text NOT NULL UNIQUE,
  github_repo_owner text NOT NULL,
  github_repo_name text NOT NULL,
  github_default_branch text NOT NULL DEFAULT 'main',
  business_description text NOT NULL,
  location text NOT NULL,
  notify_emails text[] NOT NULL DEFAULT '{}',
  blog_path_prefix text NOT NULL DEFAULT '/blog/',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sites"
ON public.sites FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage sites"
ON public.sites FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage sites"
ON public.sites FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_sites_updated_at'
  ) THEN
    CREATE TRIGGER set_sites_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Seed sites
INSERT INTO public.sites (
  id,
  name,
  abbreviation,
  domain,
  github_repo_owner,
  github_repo_name,
  github_default_branch,
  business_description,
  location,
  notify_emails,
  blog_path_prefix
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'MyFence',
    'MF',
    'myfence.com',
    'christopher0331',
    'myfence-clone',
    'main',
    'a fence installation and maintenance company',
    'Seattle/Pacific Northwest',
    ARRAY['info@myfence.com'],
    '/blog/'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'SeattleFence',
    'SF',
    'seattlefence.com',
    'christopher0331',
    'seattlefence',
    'main',
    'a fence installation and maintenance company',
    'Seattle/Pacific Northwest',
    ARRAY['info@seattlefence.com'],
    '/blog/'
  )
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.blog_topics') IS NOT NULL THEN
    ALTER TABLE public.blog_topics ADD COLUMN IF NOT EXISTS site_id uuid;
  END IF;
  IF to_regclass('public.blog_drafts') IS NOT NULL THEN
    ALTER TABLE public.blog_drafts ADD COLUMN IF NOT EXISTS site_id uuid;
  END IF;
  IF to_regclass('public.lighthouse_scores') IS NOT NULL THEN
    ALTER TABLE public.lighthouse_scores ADD COLUMN IF NOT EXISTS site_id uuid;
  END IF;
  IF to_regclass('public.competitor_analyses') IS NOT NULL THEN
    ALTER TABLE public.competitor_analyses ADD COLUMN IF NOT EXISTS site_id uuid;
  END IF;
END $$;

-- Backfill all existing rows to MyFence
DO $$
BEGIN
  IF to_regclass('public.blog_topics') IS NOT NULL THEN
    UPDATE public.blog_topics
    SET site_id = '11111111-1111-1111-1111-111111111111'
    WHERE site_id IS NULL;
  END IF;
  IF to_regclass('public.blog_drafts') IS NOT NULL THEN
    UPDATE public.blog_drafts
    SET site_id = '11111111-1111-1111-1111-111111111111'
    WHERE site_id IS NULL;
  END IF;
  IF to_regclass('public.lighthouse_scores') IS NOT NULL THEN
    UPDATE public.lighthouse_scores
    SET site_id = '11111111-1111-1111-1111-111111111111'
    WHERE site_id IS NULL;
  END IF;
  IF to_regclass('public.competitor_analyses') IS NOT NULL THEN
    UPDATE public.competitor_analyses
    SET site_id = '11111111-1111-1111-1111-111111111111'
    WHERE site_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.blog_topics') IS NOT NULL THEN
    ALTER TABLE public.blog_topics ALTER COLUMN site_id SET NOT NULL;
  END IF;
  IF to_regclass('public.blog_drafts') IS NOT NULL THEN
    ALTER TABLE public.blog_drafts ALTER COLUMN site_id SET NOT NULL;
  END IF;
  IF to_regclass('public.lighthouse_scores') IS NOT NULL THEN
    ALTER TABLE public.lighthouse_scores ALTER COLUMN site_id SET NOT NULL;
  END IF;
  IF to_regclass('public.competitor_analyses') IS NOT NULL THEN
    ALTER TABLE public.competitor_analyses ALTER COLUMN site_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.blog_topics') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'blog_topics'
      AND constraint_name = 'blog_topics_site_id_fkey'
  ) THEN
    ALTER TABLE public.blog_topics
      ADD CONSTRAINT blog_topics_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.blog_drafts') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'blog_drafts'
      AND constraint_name = 'blog_drafts_site_id_fkey'
  ) THEN
    ALTER TABLE public.blog_drafts
      ADD CONSTRAINT blog_drafts_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.lighthouse_scores') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'lighthouse_scores'
      AND constraint_name = 'lighthouse_scores_site_id_fkey'
  ) THEN
    ALTER TABLE public.lighthouse_scores
      ADD CONSTRAINT lighthouse_scores_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.competitor_analyses') IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'competitor_analyses'
      AND constraint_name = 'competitor_analyses_site_id_fkey'
  ) THEN
    ALTER TABLE public.competitor_analyses
      ADD CONSTRAINT competitor_analyses_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sites_domain ON public.sites(domain);
DO $$
BEGIN
  IF to_regclass('public.blog_topics') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_blog_topics_site_id ON public.blog_topics(site_id);
  END IF;
  IF to_regclass('public.blog_drafts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_blog_drafts_site_id ON public.blog_drafts(site_id);
  END IF;
  IF to_regclass('public.lighthouse_scores') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_lighthouse_scores_site_id ON public.lighthouse_scores(site_id);
  END IF;
  IF to_regclass('public.competitor_analyses') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_competitor_analyses_site_id ON public.competitor_analyses(site_id);
  END IF;
END $$;
