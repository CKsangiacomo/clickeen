-- PRD 054C: Persist account lifecycle notices for in-app popups and future email triggers.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_notices (
  notice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_pending BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ NULL,
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_notices
    ADD CONSTRAINT account_notices_kind_nonempty CHECK (length(trim(kind)) > 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_notices
    ADD CONSTRAINT account_notices_status_allowed CHECK (status IN ('open', 'dismissed', 'resolved'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_account_notices_updated_at ON public.account_notices;
CREATE TRIGGER set_account_notices_updated_at
  BEFORE UPDATE ON public.account_notices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS account_notices_account_status_created_idx
  ON public.account_notices (account_id, status, created_at DESC);

ALTER TABLE public.account_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_notices_service_role_all ON public.account_notices;
CREATE POLICY account_notices_service_role_all ON public.account_notices
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;

