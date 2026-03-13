BEGIN;

CREATE TABLE IF NOT EXISTS public.account_commercial_overrides (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_commercial_overrides
    ADD CONSTRAINT account_commercial_overrides_mode_allowed
      CHECK (mode IN ('standard', 'complimentary'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_account_commercial_overrides_updated_at ON public.account_commercial_overrides;
CREATE TRIGGER set_account_commercial_overrides_updated_at
  BEFORE UPDATE ON public.account_commercial_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_commercial_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_commercial_overrides_service_role_all ON public.account_commercial_overrides;
CREATE POLICY account_commercial_overrides_service_role_all ON public.account_commercial_overrides
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.internal_control_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  actor JSONB NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  account_id UUID NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.internal_control_events
    ADD CONSTRAINT internal_control_events_actor_is_object
      CHECK (jsonb_typeof(actor) = 'object');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.internal_control_events
    ADD CONSTRAINT internal_control_events_payload_is_object
      CHECK (jsonb_typeof(payload) = 'object');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.internal_control_events
    ADD CONSTRAINT internal_control_events_result_is_object
      CHECK (jsonb_typeof(result) = 'object');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS internal_control_events_created_at_idx
  ON public.internal_control_events (created_at DESC);

CREATE INDEX IF NOT EXISTS internal_control_events_account_created_at_idx
  ON public.internal_control_events (account_id, created_at DESC);

ALTER TABLE public.internal_control_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_control_events_service_role_all ON public.internal_control_events;
CREATE POLICY internal_control_events_service_role_all ON public.internal_control_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
