-- Blog / CMS system. Single-author (admin-only writes), public reads
-- published posts only. Category is free-text (no fixed taxonomy).
-- Content is stored as raw admin-authored HTML — no sanitizer needed since
-- the only write path is is_admin()-gated (no public submission anywhere).

CREATE TABLE IF NOT EXISTS blog_posts (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT         NOT NULL,
  slug              TEXT         NOT NULL,
  excerpt           TEXT,
  content           TEXT         NOT NULL DEFAULT '',
  category          TEXT,
  tags              TEXT[]       NOT NULL DEFAULT '{}',
  cover_image_url   TEXT,
  status            TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  meta_title        TEXT,
  meta_description  TEXT,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category) WHERE category IS NOT NULL;

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage blog posts" ON blog_posts;
CREATE POLICY "admins manage blog posts" ON blog_posts
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "public read published blog posts" ON blog_posts;
CREATE POLICY "public read published blog posts" ON blog_posts
  FOR SELECT USING (status = 'published');
