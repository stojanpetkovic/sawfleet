ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS extra JSONB;

CREATE TABLE IF NOT EXISTS frontend_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  page_title TEXT,
  session_id TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frontend_page_views_created
  ON frontend_page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_page_views_path_created
  ON frontend_page_views(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_page_views_session_created
  ON frontend_page_views(session_id, created_at DESC);

ALTER TABLE frontend_page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users read frontend analytics" ON frontend_page_views;
CREATE POLICY "authenticated users read frontend analytics"
  ON frontend_page_views
  FOR SELECT
  TO authenticated
  USING (true);

