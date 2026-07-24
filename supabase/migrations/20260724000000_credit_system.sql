-- Kredit sistem: kontraktori i vlasnici kamiona troše kredite kad
-- klejmuju/apliciraju na lead. Podesivo u admin Settings (uključi/isključi,
-- cena po tipu naloga, automatska dopuna).

ALTER TABLE contractors ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS last_auto_refill_at TIMESTAMPTZ;
ALTER TABLE truck_owners ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE truck_owners ADD COLUMN IF NOT EXISTS last_auto_refill_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS credit_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  contractor_lead_cost INTEGER NOT NULL DEFAULT 1 CHECK (contractor_lead_cost >= 0),
  truck_lead_cost INTEGER NOT NULL DEFAULT 1 CHECK (truck_lead_cost >= 0),
  auto_refill_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_refill_amount INTEGER NOT NULL DEFAULT 10 CHECK (auto_refill_amount >= 0),
  auto_refill_interval_days INTEGER NOT NULL DEFAULT 30 CHECK (auto_refill_interval_days >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO credit_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Ledger — audit trag + spremno za buduće online plaćanje (metadata JSONB
-- može kasnije da nosi npr. Stripe payment_intent_id, reason='purchase').
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type TEXT NOT NULL CHECK (account_type IN ('contractor','truck_owner')),
  account_id UUID NOT NULL,
  amount INTEGER NOT NULL, -- pozitivno = dopuna, negativno = potrošnja
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('lead_claim','truck_apply','admin_topup','admin_adjust','auto_refill','purchase')),
  related_lead_id UUID,
  created_by TEXT, -- 'system' | admin email/naziv
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_account ON credit_transactions(account_type, account_id, created_at DESC);

ALTER TABLE credit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage credit settings" ON credit_settings;
CREATE POLICY "admins manage credit settings" ON credit_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins read credit transactions" ON credit_transactions;
CREATE POLICY "admins read credit transactions" ON credit_transactions
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "contractor reads own credit tx" ON credit_transactions;
CREATE POLICY "contractor reads own credit tx" ON credit_transactions
  FOR SELECT USING (account_type = 'contractor' AND account_id = auth.uid());

DROP POLICY IF EXISTS "owner reads own credit tx" ON credit_transactions;
CREATE POLICY "owner reads own credit tx" ON credit_transactions
  FOR SELECT USING (account_type = 'truck_owner' AND account_id = auth.uid());

-- ── claim_lead: dodata provera/naplata kredita (samo kad je enabled) ──────
CREATE OR REPLACE FUNCTION public.claim_lead(p_lead_id uuid)
 RETURNS leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contractor_id uuid;
  v_lead public.leads;
  v_settings public.credit_settings;
  v_balance integer;
  v_new_balance integer;
begin
  select user_id into v_contractor_id
  from public.contractors
  where user_id = auth.uid() and status = 'active';

  if v_contractor_id is null then
    raise exception 'not_an_active_contractor';
  end if;

  select * into v_settings from public.credit_settings where id = 1;

  if v_settings.enabled then
    select credit_balance into v_balance from public.contractors where user_id = v_contractor_id;
    if coalesce(v_balance, 0) < v_settings.contractor_lead_cost then
      raise exception 'insufficient_credits';
    end if;
  end if;

  update public.leads
     set status = 'claimed',
         contractor_id = auth.uid(),
         claimed_at = now()
   where id = p_lead_id
     and status = 'approved'
  returning * into v_lead;

  if v_lead.id is null then
    raise exception 'already_claimed';
  end if;

  if v_settings.enabled and v_settings.contractor_lead_cost > 0 then
    update public.contractors
       set credit_balance = credit_balance - v_settings.contractor_lead_cost
     where user_id = v_contractor_id
    returning credit_balance into v_new_balance;

    insert into public.credit_transactions (account_type, account_id, amount, balance_after, reason, related_lead_id, created_by)
    values ('contractor', v_contractor_id, -v_settings.contractor_lead_cost, v_new_balance, 'lead_claim', p_lead_id, 'system');
  end if;

  return v_lead;
end;
$function$;

-- ── apply_for_truck_lead: dodata provera/naplata kredita (svaki put, i na reapply) ──
CREATE OR REPLACE FUNCTION public.apply_for_truck_lead(p_lead_id uuid, p_truck_id uuid DEFAULT NULL::uuid, p_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  application_id UUID;
  lead_county TEXT;
  v_settings public.credit_settings;
  v_balance integer;
  v_new_balance integer;
BEGIN
  SELECT county INTO lead_county
  FROM leads
  WHERE id = p_lead_id AND status IN ('approved', 'claimed');

  IF lead_county IS NULL THEN
    RAISE EXCEPTION 'Lead is not available';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM truck_owners o
    JOIN grapple_saw_trucks t ON t.owner_user_id = o.id
    WHERE o.id = auth.uid()
      AND o.status = 'approved'
      AND t.approval_status = 'approved'
      AND lower(COALESCE(t.availability_status, 'available')) = 'available'
      AND lower(trim(t.location)) = lower(trim(lead_county))
      AND (p_truck_id IS NULL OR t.id = p_truck_id)
  ) THEN
    RAISE EXCEPTION 'No eligible truck in this territory';
  END IF;

  SELECT * INTO v_settings FROM public.credit_settings WHERE id = 1;

  IF v_settings.enabled THEN
    SELECT credit_balance INTO v_balance FROM public.truck_owners WHERE id = auth.uid();
    IF COALESCE(v_balance, 0) < v_settings.truck_lead_cost THEN
      RAISE EXCEPTION 'insufficient_credits';
    END IF;
  END IF;

  INSERT INTO truck_lead_applications (lead_id, truck_owner_id, truck_id, message)
  VALUES (p_lead_id, auth.uid(), p_truck_id, NULLIF(trim(p_message), ''))
  ON CONFLICT (lead_id, truck_owner_id)
  DO UPDATE SET
    truck_id = EXCLUDED.truck_id,
    message = EXCLUDED.message,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO application_id;

  IF v_settings.enabled AND v_settings.truck_lead_cost > 0 THEN
    UPDATE public.truck_owners
       SET credit_balance = credit_balance - v_settings.truck_lead_cost
     WHERE id = auth.uid()
    RETURNING credit_balance INTO v_new_balance;

    INSERT INTO public.credit_transactions (account_type, account_id, amount, balance_after, reason, related_lead_id, created_by)
    VALUES ('truck_owner', auth.uid(), -v_settings.truck_lead_cost, v_new_balance, 'truck_apply', p_lead_id, 'system');
  END IF;

  RETURN application_id;
END;
$function$;

-- Bezbedno, read-only otkrivanje da li je kredit sistem uključen — bez
-- ovoga, kontraktor/truck owner dashboard (anon klijent, RLS ograničava
-- credit_settings samo na admine) ne bi mogao da zna da li da prikaže
-- balans kredita.
CREATE OR REPLACE FUNCTION public.is_credit_system_enabled()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT enabled FROM public.credit_settings WHERE id = 1), false);
$function$;
