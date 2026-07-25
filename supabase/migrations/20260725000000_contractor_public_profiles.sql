-- Contractor public profiles + reviews
-- Adds public-facing profile fields to contractors table and creates
-- a contractor_reviews table for customer ratings/feedback.

-- ---------------------------------------------------------------
-- 1. Public profile fields on contractors
-- ---------------------------------------------------------------
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS slug            TEXT UNIQUE;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS bio             TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS website         TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS license_number  TEXT;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT '{}';
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS is_public       BOOLEAN NOT NULL DEFAULT false;

-- Auto-generate slugs for existing contractors that don't have one yet.
-- Pattern: lowercase-company-name + first 8 chars of the contractor's UUID.
UPDATE contractors
SET slug = LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(COALESCE(NULLIF(TRIM(company_name), ''), 'contractor'), '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', '-', 'g'
    )
  ) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Future inserts should also get a slug if none provided.
-- (Application layer will generate one; this is a fallback trigger.)
CREATE OR REPLACE FUNCTION contractors_set_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(COALESCE(NULLIF(TRIM(NEW.company_name), ''), 'contractor'), '[^a-zA-Z0-9\s]', '', 'g'),
          '\s+', '-', 'g'
        )
      ) || '-' || SUBSTRING(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contractors_set_slug ON contractors;
CREATE TRIGGER trg_contractors_set_slug
  BEFORE INSERT ON contractors
  FOR EACH ROW EXECUTE FUNCTION contractors_set_slug();

-- ---------------------------------------------------------------
-- 2. contractor_reviews table
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contractor_reviews (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  UUID         NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  rating         INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           TEXT,
  reviewer_name  TEXT,
  status         TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash        TEXT,        -- SHA-256 of client IP for basic duplicate detection
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_reviews_contractor
  ON contractor_reviews(contractor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contractor_reviews_pending
  ON contractor_reviews(status, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE contractor_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read approved reviews on public contractor profiles
DROP POLICY IF EXISTS "public reads approved reviews" ON contractor_reviews;
CREATE POLICY "public reads approved reviews" ON contractor_reviews
  FOR SELECT USING (status = 'approved');

-- Contractors can see ALL their own reviews (including pending/rejected)
DROP POLICY IF EXISTS "contractor reads own reviews" ON contractor_reviews;
CREATE POLICY "contractor reads own reviews" ON contractor_reviews
  FOR SELECT USING (
    contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid())
  );

-- Anyone (including anonymous) can submit a pending review
DROP POLICY IF EXISTS "public inserts reviews" ON contractor_reviews;
CREATE POLICY "public inserts reviews" ON contractor_reviews
  FOR INSERT WITH CHECK (status = 'pending');

-- Admins can do everything
DROP POLICY IF EXISTS "admins manage reviews" ON contractor_reviews;
CREATE POLICY "admins manage reviews" ON contractor_reviews
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------------------------------------------------------------
-- 3. Helper: aggregate rating for a contractor (public view)
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW contractor_review_stats AS
SELECT
  contractor_id,
  COUNT(*)                        AS review_count,
  ROUND(AVG(rating)::NUMERIC, 1) AS avg_rating
FROM contractor_reviews
WHERE status = 'approved'
GROUP BY contractor_id;
