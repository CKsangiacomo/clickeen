-- PRD 65: Berlin-owned verified contact-method contract for phone and WhatsApp.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_contact_methods (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  value TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel),
  CONSTRAINT user_contact_methods_channel_check CHECK (channel IN ('phone', 'whatsapp')),
  CONSTRAINT user_contact_methods_value_format CHECK (value ~ '^\\+[1-9][0-9]{7,14}$')
);

CREATE TABLE IF NOT EXISTS public.user_contact_verifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  pending_value TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts_remaining INTEGER NOT NULL DEFAULT 5,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_contact_verifications_channel_check CHECK (channel IN ('phone', 'whatsapp')),
  CONSTRAINT user_contact_verifications_value_format CHECK (pending_value ~ '^\\+[1-9][0-9]{7,14}$'),
  CONSTRAINT user_contact_verifications_attempts_non_negative CHECK (attempts_remaining >= 0)
);

CREATE INDEX IF NOT EXISTS user_contact_verifications_user_channel_idx
  ON public.user_contact_verifications (user_id, channel, created_at DESC);

DROP TRIGGER IF EXISTS set_user_contact_methods_updated_at ON public.user_contact_methods;
CREATE TRIGGER set_user_contact_methods_updated_at
  BEFORE UPDATE ON public.user_contact_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_user_contact_verifications_updated_at ON public.user_contact_verifications;
CREATE TRIGGER set_user_contact_verifications_updated_at
  BEFORE UPDATE ON public.user_contact_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_contact_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_contact_methods_service_role_all ON public.user_contact_methods;
CREATE POLICY user_contact_methods_service_role_all ON public.user_contact_methods
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS user_contact_verifications_service_role_all ON public.user_contact_verifications;
CREATE POLICY user_contact_verifications_service_role_all ON public.user_contact_verifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
