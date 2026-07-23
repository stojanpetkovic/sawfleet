CREATE TABLE IF NOT EXISTS truck_outreach_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 100),
  cooldown_days INTEGER NOT NULL DEFAULT 14 CHECK (cooldown_days BETWEEN 3 AND 365),
  max_attempts INTEGER NOT NULL DEFAULT 2 CHECK (max_attempts BETWEEN 1 AND 5),
  subject TEXT NOT NULL DEFAULT 'Claim your free SF Tree Removal equipment profile',
  email_template TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO truck_outreach_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS truck_profile_outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES unclaimed_truck_directory(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tracking_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained','failed','unsubscribed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_truck_outreach_profile ON truck_profile_outreach(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_outreach_email ON truck_profile_outreach(lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_outreach_status ON truck_profile_outreach(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_truck_outreach_resend_id
  ON truck_profile_outreach(resend_email_id) WHERE resend_email_id IS NOT NULL;

ALTER TABLE truck_outreach_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_profile_outreach ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage truck outreach settings" ON truck_outreach_settings;
CREATE POLICY "admins manage truck outreach settings" ON truck_outreach_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admins read truck outreach" ON truck_profile_outreach;
CREATE POLICY "admins read truck outreach" ON truck_profile_outreach
  FOR SELECT USING (is_admin());

