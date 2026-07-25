-- Customer retention system
-- Customers get their own accounts (magic link auth), dashboard,
-- and automated follow-up reminders after job completion.

-- ---------------------------------------------------------------
-- 1. Customers table
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT         NOT NULL,
  full_name    TEXT,
  phone        TEXT,
  notes        TEXT,          -- internal notes visible only to admin
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customer reads/updates only their own row
DROP POLICY IF EXISTS "customer reads own profile" ON customers;
CREATE POLICY "customer reads own profile" ON customers
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "customer updates own profile" ON customers;
CREATE POLICY "customer updates own profile" ON customers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins manage all
DROP POLICY IF EXISTS "admins manage customers" ON customers;
CREATE POLICY "admins manage customers" ON customers
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------------------------------------------------------------
-- 2. Link leads to customers
-- ---------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id) WHERE customer_id IS NOT NULL;

-- ---------------------------------------------------------------
-- 3. Follow-up scheduling
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_followups (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id         UUID         REFERENCES leads(id) ON DELETE SET NULL,
  type            TEXT         NOT NULL DEFAULT 'annual_reminder'
                               CHECK (type IN ('annual_reminder', 'seasonal_reminder', 'custom')),
  subject         TEXT,        -- custom subject override
  message         TEXT,        -- custom message override
  scheduled_for   DATE         NOT NULL,
  sent_at         TIMESTAMPTZ,
  status          TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_by      TEXT,        -- 'system' or admin email
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_followups_due
  ON customer_followups(scheduled_for, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_customer_followups_customer
  ON customer_followups(customer_id, created_at DESC);

ALTER TABLE customer_followups ENABLE ROW LEVEL SECURITY;

-- Customers see their own follow-ups
DROP POLICY IF EXISTS "customer reads own followups" ON customer_followups;
CREATE POLICY "customer reads own followups" ON customer_followups
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Admins manage all
DROP POLICY IF EXISTS "admins manage followups" ON customer_followups;
CREATE POLICY "admins manage followups" ON customer_followups
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
