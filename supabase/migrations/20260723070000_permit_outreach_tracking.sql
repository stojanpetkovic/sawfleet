CREATE TABLE IF NOT EXISTS permit_outreach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_lead_id UUID NOT NULL REFERENCES permit_leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tracking_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','opened','clicked','converted','bounced','complained','failed','unsubscribed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permit_outreach_event_lead ON permit_outreach_events(permit_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permit_outreach_event_email ON permit_outreach_events(lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permit_outreach_event_status ON permit_outreach_events(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_permit_outreach_event_resend
  ON permit_outreach_events(resend_email_id) WHERE resend_email_id IS NOT NULL;

ALTER TABLE permit_outreach_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read permit outreach events" ON permit_outreach_events;
CREATE POLICY "admins read permit outreach events" ON permit_outreach_events
  FOR SELECT USING (is_admin());

