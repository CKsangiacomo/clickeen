-- PRD 064 Phase 5a: canonical account invitation persistence.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_invitations (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_invitations
    ADD CONSTRAINT account_invitations_role_allowed CHECK (role IN ('viewer', 'editor', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_invitations
    ADD CONSTRAINT account_invitations_email_lowercase CHECK (email = lower(email));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_invitations_account_id_idx
  ON public.account_invitations (account_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS account_invitations_active_email_idx
  ON public.account_invitations (account_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

DROP TRIGGER IF EXISTS set_account_invitations_updated_at ON public.account_invitations;
CREATE TRIGGER set_account_invitations_updated_at
  BEFORE UPDATE ON public.account_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_invitations_service_role_all ON public.account_invitations;
CREATE POLICY account_invitations_service_role_all ON public.account_invitations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
