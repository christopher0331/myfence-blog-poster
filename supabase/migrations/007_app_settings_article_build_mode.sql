-- App settings (key-value). Used for article_build_mode and future settings.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow service role and anon (for app) to read/update
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert app_settings"
  ON public.app_settings FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Default: manual only (user must trigger write + commit from Studio)
INSERT INTO public.app_settings (key, value)
VALUES ('article_build_mode', 'manual')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.app_settings IS 'Key-value app configuration. article_build_mode: manual | cron';
