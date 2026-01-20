-- Publish state for instance localization overlays (dirty-set).
BEGIN;

CREATE TABLE IF NOT EXISTS public.l10n_publish_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  base_fingerprint TEXT NOT NULL,
  published_fingerprint TEXT NULL,
  publish_state TEXT NOT NULL DEFAULT 'dirty',
  publish_attempts INTEGER NOT NULL DEFAULT 0,
  publish_next_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    ADD CONSTRAINT l10n_publish_state_unique_locale UNIQUE (public_id, locale);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    ADD CONSTRAINT l10n_publish_state_state_allowed CHECK (
      publish_state IN ('dirty', 'clean', 'failed')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_publish_state_public_id_idx
  ON public.l10n_publish_state (public_id);

CREATE INDEX IF NOT EXISTS l10n_publish_state_dirty_idx
  ON public.l10n_publish_state (publish_state, publish_next_at);

DROP TRIGGER IF EXISTS set_l10n_publish_state_updated_at ON public.l10n_publish_state;
CREATE TRIGGER set_l10n_publish_state_updated_at
  BEFORE UPDATE ON public.l10n_publish_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: service role only.
ALTER TABLE public.l10n_publish_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l10n_publish_state_select ON public.l10n_publish_state;
CREATE POLICY l10n_publish_state_select ON public.l10n_publish_state
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_publish_state_insert ON public.l10n_publish_state;
CREATE POLICY l10n_publish_state_insert ON public.l10n_publish_state
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_publish_state_update ON public.l10n_publish_state;
CREATE POLICY l10n_publish_state_update ON public.l10n_publish_state
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_publish_state_delete ON public.l10n_publish_state;
CREATE POLICY l10n_publish_state_delete ON public.l10n_publish_state
  FOR DELETE
  USING (auth.role() = 'service_role');

COMMIT;
