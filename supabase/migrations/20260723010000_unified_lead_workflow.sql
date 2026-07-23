-- Unified lead workflow
-- Permits remain opportunities; external submissions remain intake records.
-- Only rows in leads are publishable contractor marketplace leads.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'website';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origin_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'customer_submitted';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS website_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE external_leads ADD COLUMN IF NOT EXISTS quality_score INTEGER;

ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS website_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS outreach_token UUID DEFAULT gen_random_uuid();
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS outreach_clicked_at TIMESTAMPTZ;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS outreach_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS outreach_last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_leads_website_lead_id
  ON external_leads(website_lead_id) WHERE website_lead_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_permit_leads_website_lead_id
  ON permit_leads(website_lead_id) WHERE website_lead_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_permit_leads_outreach_token
  ON permit_leads(outreach_token) WHERE outreach_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_origin
  ON leads(origin_type, origin_id) WHERE origin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_marketplace
  ON leads(status, county, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_leads_publish_state
  ON external_leads(status, published_at);
CREATE INDEX IF NOT EXISTS idx_permit_leads_outreach_state
  ON permit_leads(permit_status, outreach_sent_at);
