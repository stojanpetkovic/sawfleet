-- Self-service credit purchases via PayPal. Contractors and truck owners can
-- top up their own credit_balance instead of waiting on an admin-reviewed
-- "request more credit" note. Client ID/Secret/mode live in a DB-backed
-- settings row (not .env) so the admin can configure/rotate them from
-- /admin/settings without a redeploy — same convention as credit_settings.

CREATE TABLE IF NOT EXISTS payment_settings (
  id                    INT PRIMARY KEY DEFAULT 1,
  paypal_enabled        boolean NOT NULL DEFAULT false,
  paypal_client_id      text,
  paypal_client_secret  text,
  paypal_mode           text NOT NULL DEFAULT 'sandbox' CHECK (paypal_mode IN ('sandbox', 'live')),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage payment settings" ON payment_settings;
CREATE POLICY "admins manage payment settings" ON payment_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Public-safe getter for the dashboards to know whether to render the PayPal
-- button and which client id to load the SDK with. NEVER returns the secret.
CREATE OR REPLACE FUNCTION public.get_paypal_client_config()
RETURNS TABLE(enabled boolean, client_id text, mode text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT paypal_enabled, paypal_client_id, paypal_mode FROM payment_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_paypal_client_config() TO authenticated;

-- Tracks each PayPal order we create, so capture-order.ts can verify the
-- expected amount/owner server-side and so a repeated capture call (retry,
-- double-click) can't double-credit the account.
CREATE TABLE IF NOT EXISTS credit_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type    TEXT NOT NULL CHECK (account_type IN ('contractor', 'truck_owner')),
  account_id      UUID NOT NULL,
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  paypal_order_id TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'completed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_account ON credit_purchases(account_type, account_id);

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage credit purchases" ON credit_purchases;
CREATE POLICY "admins manage credit purchases" ON credit_purchases
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
-- No contractor/truck-owner facing policy: create-order.ts and
-- capture-order.ts run under the service role and verify ownership in code.

ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_reason_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_reason_check
  CHECK (reason = ANY (ARRAY['lead_claim', 'truck_apply', 'admin_topup', 'admin_adjust', 'auto_refill', 'purchase', 'permit_lead_unlock', 'paypal_purchase']));
