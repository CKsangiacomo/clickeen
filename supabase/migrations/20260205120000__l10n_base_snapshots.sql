-- L10n base snapshots + diff metadata for generation state.
BEGIN;

CREATE TABLE IF NOT EXISTS public.l10n_base_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL,
  base_fingerprint TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  widget_type TEXT NULL,
  base_updated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.l10n_base_snapshots
    ADD CONSTRAINT l10n_base_snapshots_unique_key UNIQUE (public_id, base_fingerprint);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_base_snapshots
    ADD CONSTRAINT l10n_base_snapshots_snapshot_is_object CHECK (jsonb_typeof(snapshot) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_base_snapshots_public_id_idx
  ON public.l10n_base_snapshots (public_id);

CREATE INDEX IF NOT EXISTS l10n_base_snapshots_created_at_idx
  ON public.l10n_base_snapshots (created_at);

DROP TRIGGER IF EXISTS set_l10n_base_snapshots_updated_at ON public.l10n_base_snapshots;
CREATE TRIGGER set_l10n_base_snapshots_updated_at
  BEFORE UPDATE ON public.l10n_base_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.l10n_base_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l10n_base_snapshots_select ON public.l10n_base_snapshots;
CREATE POLICY l10n_base_snapshots_select ON public.l10n_base_snapshots
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_base_snapshots_insert ON public.l10n_base_snapshots;
CREATE POLICY l10n_base_snapshots_insert ON public.l10n_base_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_base_snapshots_update ON public.l10n_base_snapshots;
CREATE POLICY l10n_base_snapshots_update ON public.l10n_base_snapshots
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_base_snapshots_delete ON public.l10n_base_snapshots;
CREATE POLICY l10n_base_snapshots_delete ON public.l10n_base_snapshots
  FOR DELETE
  USING (auth.role() = 'service_role');

ALTER TABLE public.l10n_generate_state
  ADD COLUMN IF NOT EXISTS changed_paths JSONB NULL,
  ADD COLUMN IF NOT EXISTS removed_paths JSONB NULL;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_changed_paths_is_array CHECK (
      changed_paths IS NULL OR jsonb_typeof(changed_paths) = 'array'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_removed_paths_is_array CHECK (
      removed_paths IS NULL OR jsonb_typeof(removed_paths) = 'array'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
