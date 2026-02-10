-- =============================================
-- MyFence Studio CMS - Initial Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Blog Topics
-- =============================================
CREATE TABLE IF NOT EXISTS blog_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'approved', 'in_progress', 'completed', 'rejected')),
  keywords TEXT[] DEFAULT '{}',
  research_notes TEXT,
  priority INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Blog Drafts
-- =============================================
CREATE TABLE IF NOT EXISTS blog_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID REFERENCES blog_topics(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  meta_description TEXT DEFAULT '',
  body_mdx TEXT DEFAULT '',
  category TEXT DEFAULT '',
  featured_image TEXT DEFAULT '',
  read_time TEXT DEFAULT '',
  structured_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'failed')),
  completeness JSONB DEFAULT '{"title": 0, "body": 0, "meta_description": 0, "image": 0, "category": 0, "structured_data": 0}',
  scheduled_date DATE,
  published_at TIMESTAMPTZ,
  github_pr_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Lighthouse Scores
-- =============================================
CREATE TABLE IF NOT EXISTS lighthouse_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_url TEXT NOT NULL,
  performance INT DEFAULT 0,
  accessibility INT DEFAULT 0,
  best_practices INT DEFAULT 0,
  seo INT DEFAULT 0,
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Auto-update updated_at triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_topics_updated_at
  BEFORE UPDATE ON blog_topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_drafts_updated_at
  BEFORE UPDATE ON blog_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE blog_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lighthouse_scores ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (this is an admin-only app)
CREATE POLICY "Authenticated users can manage topics"
  ON blog_topics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage drafts"
  ON blog_drafts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage lighthouse scores"
  ON lighthouse_scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon key access (for the CMS app using anon key with service role for writes)
CREATE POLICY "Anon can read topics" ON blog_topics FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read drafts" ON blog_drafts FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read scores" ON lighthouse_scores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert topics" ON blog_topics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update topics" ON blog_topics FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete topics" ON blog_topics FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can insert drafts" ON blog_drafts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update drafts" ON blog_drafts FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete drafts" ON blog_drafts FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can insert scores" ON lighthouse_scores FOR INSERT TO anon WITH CHECK (true);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_blog_drafts_status ON blog_drafts(status);
CREATE INDEX idx_blog_drafts_scheduled_date ON blog_drafts(scheduled_date);
CREATE INDEX idx_blog_drafts_slug ON blog_drafts(slug);
CREATE INDEX idx_blog_topics_status ON blog_topics(status);
CREATE INDEX idx_lighthouse_scores_url ON lighthouse_scores(page_url);
