-- Ručno praćenje poslovnih troškova (Meta Ads, Google Ads, ili bilo koja
-- druga kategorija koju admin unese) — jednokratni unosi, prikazano na
-- Analytics strani pored Google/Meta efficiency kartica.
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage expenses" ON expenses;
CREATE POLICY "admins manage expenses" ON expenses
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
