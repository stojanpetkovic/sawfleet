-- Permit Leads as a standalone contractor marketplace: contractors see
-- location/job-type teasers (blurred) and pay a per-lead credit to unlock
-- full owner contact info. Unlike claim_lead/apply_for_truck_lead/
-- accept_external_lead (all exclusive — one claimer, then gone), unlocking a
-- permit lead is NOT exclusive: multiple contractors may each independently
-- pay to see the same permit lead's contact info, since it's public permit
-- data rather than a mediated introduction.

-- Tracks who has unlocked which permit lead (many-to-many, non-exclusive).
CREATE TABLE IF NOT EXISTS permit_lead_unlocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_lead_id  UUID NOT NULL REFERENCES permit_leads(id) ON DELETE CASCADE,
  contractor_id   UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (permit_lead_id, contractor_id)
);
CREATE INDEX IF NOT EXISTS idx_permit_lead_unlocks_contractor ON permit_lead_unlocks(contractor_id);

ALTER TABLE permit_lead_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage permit lead unlocks" ON permit_lead_unlocks;
CREATE POLICY "admins manage permit lead unlocks" ON permit_lead_unlocks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "contractor reads own permit lead unlocks" ON permit_lead_unlocks;
CREATE POLICY "contractor reads own permit lead unlocks" ON permit_lead_unlocks
  FOR SELECT USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- SECURITY DEFINER helper — avoids the RLS-recursion bug hit earlier with
-- external_lead_routing: a raw EXISTS subquery against permit_lead_unlocks
-- inside a permit_leads policy would itself be subject to permit_lead_unlocks'
-- own RLS and silently return nothing for non-admins.
CREATE OR REPLACE FUNCTION public.has_unlocked_permit_lead(p_permit_lead_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permit_lead_unlocks u
    JOIN public.contractors c ON c.user_id = auth.uid()
    WHERE u.permit_lead_id = p_permit_lead_id AND u.contractor_id = c.id
  );
$$;

-- Additive SELECT policy: full row (including owner_* PII) visible to a
-- contractor only for permit leads they've unlocked. ORs with the existing
-- admin ALL policy — nothing existing is narrowed.
DROP POLICY IF EXISTS "contractor reads unlocked permit leads" ON permit_leads;
CREATE POLICY "contractor reads unlocked permit leads" ON permit_leads
  FOR SELECT USING (public.has_unlocked_permit_lead(id));

-- Safe "teaser" view — only location/job-type columns, NEVER owner_* PII.
-- security_invoker=false is deliberate: this view must show these columns to
-- any authenticated contractor regardless of permit_leads' restrictive RLS
-- (which stays admin-only + unlocked-only) — the view's own column list is
-- the only thing that can ever be exposed through it, so this cannot leak PII.
CREATE OR REPLACE VIEW permit_leads_marketplace WITH (security_invoker = false) AS
  SELECT id, jurisdiction, permit_type, permit_description, permit_date,
         discovered_at, lead_score, permit_status
  FROM permit_leads
  WHERE permit_status = 'qualified' AND archived_at IS NULL;

GRANT SELECT ON permit_leads_marketplace TO authenticated;

-- New settings (added to the existing credit_settings singleton row).
ALTER TABLE credit_settings
  ADD COLUMN IF NOT EXISTS permit_lead_unlock_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permit_lead_unlock_cost numeric NOT NULL DEFAULT 5;

-- New ledger reason.
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_reason_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_reason_check
  CHECK (reason = ANY (ARRAY['lead_claim','truck_apply','admin_topup','admin_adjust','auto_refill','purchase','permit_lead_unlock']));

-- Free if already unlocked (returns the existing row, no re-charge);
-- otherwise checks balance, deducts credit, logs the transaction, records
-- the unlock. Non-exclusive by design — no "already claimed by someone else"
-- check, unlike claim_lead/apply_for_truck_lead/accept_external_lead.
CREATE OR REPLACE FUNCTION public.unlock_permit_lead(p_permit_lead_id uuid)
RETURNS permit_leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contractor_id uuid;
  v_settings credit_settings;
  v_balance numeric;
  v_row permit_leads;
BEGIN
  SELECT id INTO v_contractor_id FROM contractors WHERE user_id = auth.uid() AND status = 'active';
  IF v_contractor_id IS NULL THEN
    RAISE EXCEPTION 'not_an_active_contractor';
  END IF;

  SELECT * INTO v_settings FROM credit_settings WHERE id = 1;
  IF NOT v_settings.permit_lead_unlock_enabled THEN
    RAISE EXCEPTION 'feature_disabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM permit_lead_unlocks
    WHERE permit_lead_id = p_permit_lead_id AND contractor_id = v_contractor_id
  ) THEN
    SELECT * INTO v_row FROM permit_leads WHERE id = p_permit_lead_id;
    RETURN v_row;
  END IF;

  IF v_settings.enabled THEN
    SELECT credit_balance INTO v_balance FROM contractors WHERE id = v_contractor_id;
    IF v_balance < v_settings.permit_lead_unlock_cost THEN
      RAISE EXCEPTION 'insufficient_credits';
    END IF;

    UPDATE contractors SET credit_balance = credit_balance - v_settings.permit_lead_unlock_cost WHERE id = v_contractor_id;

    INSERT INTO credit_transactions (account_type, account_id, amount, balance_after, reason, related_lead_id, created_by)
    VALUES ('contractor', v_contractor_id, -v_settings.permit_lead_unlock_cost,
            v_balance - v_settings.permit_lead_unlock_cost, 'permit_lead_unlock', NULL, v_contractor_id);
  END IF;

  INSERT INTO permit_lead_unlocks (permit_lead_id, contractor_id) VALUES (p_permit_lead_id, v_contractor_id);

  SELECT * INTO v_row FROM permit_leads WHERE id = p_permit_lead_id;
  RETURN v_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.unlock_permit_lead(uuid) TO authenticated;

-- credit_settings has admin-only RLS (verified live — no "authenticated read"
-- policy exists). Contractors need to know whether this feature is on and at
-- what price before attempting the RPC — same safe, narrow pattern as the
-- existing is_credit_system_enabled().
CREATE OR REPLACE FUNCTION public.get_permit_lead_unlock_settings()
RETURNS TABLE(enabled boolean, cost numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT permit_lead_unlock_enabled, permit_lead_unlock_cost FROM credit_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_permit_lead_unlock_settings() TO authenticated;
