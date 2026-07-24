-- Kontraktor/vlasnik kamiona traži dopunu kredita (kad im nedostaje) —
-- admin dobija mejl i vidi zahtev na svojoj strani, pa ručno dopunjuje
-- preko postojećeg /api/credit-adjust.
CREATE TABLE IF NOT EXISTS credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL CHECK (account_type IN ('contractor','truck_owner')),
  account_id UUID NOT NULL,
  requested_amount INTEGER,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_requests_account ON credit_requests(account_type, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status, created_at DESC);

ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage credit requests" ON credit_requests;
CREATE POLICY "admins manage credit requests" ON credit_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Kontraktor/vlasnik kamiona sme SAMO da vidi i kreira svoje zahteve —
-- ne sme sam da ih menja na 'fulfilled' niti da ih briše (to je admin-only,
-- preko politike iznad).
DROP POLICY IF EXISTS "contractor reads own credit requests" ON credit_requests;
CREATE POLICY "contractor reads own credit requests" ON credit_requests
  FOR SELECT USING (account_type = 'contractor' AND account_id = auth.uid());

DROP POLICY IF EXISTS "contractor creates own credit requests" ON credit_requests;
CREATE POLICY "contractor creates own credit requests" ON credit_requests
  FOR INSERT WITH CHECK (account_type = 'contractor' AND account_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "owner reads own credit requests" ON credit_requests;
CREATE POLICY "owner reads own credit requests" ON credit_requests
  FOR SELECT USING (account_type = 'truck_owner' AND account_id = auth.uid());

DROP POLICY IF EXISTS "owner creates own credit requests" ON credit_requests;
CREATE POLICY "owner creates own credit requests" ON credit_requests
  FOR INSERT WITH CHECK (account_type = 'truck_owner' AND account_id = auth.uid() AND status = 'pending');

-- Kontraktor/vlasnik kamiona sme da označi SVOJ REŠENI zahtev kao viđen
-- (za notifikacije u headeru) — ne može da vrati status na 'pending'.
ALTER TABLE credit_requests ADD COLUMN IF NOT EXISTS seen_by_requester BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "contractor marks own resolved requests seen" ON credit_requests;
CREATE POLICY "contractor marks own resolved requests seen" ON credit_requests
  FOR UPDATE
  USING (account_type = 'contractor' AND account_id = auth.uid() AND status != 'pending')
  WITH CHECK (account_type = 'contractor' AND account_id = auth.uid() AND status IN ('fulfilled','dismissed'));

DROP POLICY IF EXISTS "owner marks own resolved requests seen" ON credit_requests;
CREATE POLICY "owner marks own resolved requests seen" ON credit_requests
  FOR UPDATE
  USING (account_type = 'truck_owner' AND account_id = auth.uid() AND status != 'pending')
  WITH CHECK (account_type = 'truck_owner' AND account_id = auth.uid() AND status IN ('fulfilled','dismissed'));
