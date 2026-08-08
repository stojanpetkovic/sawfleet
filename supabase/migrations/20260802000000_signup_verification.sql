-- Admin-toggleable "require email verification before admin review" gate for
-- contractor/truck-owner signups, decoupled from Supabase's own project-level
-- "Confirm email" auth setting (which we don't touch — new users are always
-- created with email_confirm=true so Supabase itself never blocks login; our
-- own gate decides whether a profile row exists yet at all).

CREATE TABLE IF NOT EXISTS account_security_settings (
  id                          INT PRIMARY KEY DEFAULT 1,
  email_verification_required boolean NOT NULL DEFAULT false,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO account_security_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE account_security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage account security settings" ON account_security_settings;
CREATE POLICY "admins manage account security settings" ON account_security_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Public registration pages need to know this BEFORE the visitor has any
-- session at all, so it must be readable by anon.
CREATE OR REPLACE FUNCTION public.get_email_verification_required()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email_verification_required FROM account_security_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_verification_required() TO anon, authenticated;

-- Holds a signup's intended profile payload until the verification link is
-- clicked. The auth.users row is created immediately (always email_confirm
-- = true so Supabase login itself is never blocked); the contractors/
-- truck_owners row is only created once this record is consumed — so admin
-- never sees an unverified signup in their approval queue at all.
CREATE TABLE IF NOT EXISTS pending_signups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('contractor', 'truck_owner')),
  payload    JSONB NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours')
);
CREATE INDEX IF NOT EXISTS idx_pending_signups_user ON pending_signups(user_id);

ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage pending signups" ON pending_signups;
CREATE POLICY "admins manage pending signups" ON pending_signups
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
-- No end-user policy: signup.ts and verify-signup.ts run under the service
-- role — the verification link itself is the credential, not a session.
