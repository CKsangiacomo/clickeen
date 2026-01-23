-- Durable generation state for instance localization jobs.
BEGIN;

CREATE TABLE IF NOT EXISTS public.l10n_generate_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  base_fingerprint TEXT NOT NULL,
  base_updated_at TIMESTAMPTZ NULL,
  widget_type TEXT NULL,
  workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'dirty',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NULL,
  last_attempt_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_unique_key UNIQUE (public_id, layer, layer_key, base_fingerprint);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_status_allowed CHECK (
      status IN ('dirty', 'queued', 'running', 'succeeded', 'failed', 'superseded')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_layer_allowed CHECK (
      layer IN ('locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_layer_key_present CHECK (layer_key <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_generate_state_public_id_idx
  ON public.l10n_generate_state (public_id);

CREATE INDEX IF NOT EXISTS l10n_generate_state_status_idx
  ON public.l10n_generate_state (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS l10n_generate_state_workspace_id_idx
  ON public.l10n_generate_state (workspace_id);

DROP TRIGGER IF EXISTS set_l10n_generate_state_updated_at ON public.l10n_generate_state;
CREATE TRIGGER set_l10n_generate_state_updated_at
  BEFORE UPDATE ON public.l10n_generate_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: service role only.
ALTER TABLE public.l10n_generate_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l10n_generate_state_select ON public.l10n_generate_state;
CREATE POLICY l10n_generate_state_select ON public.l10n_generate_state
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_generate_state_insert ON public.l10n_generate_state;
CREATE POLICY l10n_generate_state_insert ON public.l10n_generate_state
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_generate_state_update ON public.l10n_generate_state;
CREATE POLICY l10n_generate_state_update ON public.l10n_generate_state
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_generate_state_delete ON public.l10n_generate_state;
CREATE POLICY l10n_generate_state_delete ON public.l10n_generate_state
  FOR DELETE
  USING (auth.role() = 'service_role');

COMMIT;
