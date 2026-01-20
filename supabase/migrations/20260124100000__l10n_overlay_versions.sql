-- Version ledger for instance localization overlays.
BEGIN;

CREATE TABLE IF NOT EXISTS public.l10n_overlay_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  base_fingerprint TEXT NOT NULL,
  base_updated_at TIMESTAMPTZ NULL,
  r2_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    ADD CONSTRAINT l10n_overlay_versions_unique_version UNIQUE (public_id, locale, base_fingerprint);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_overlay_versions_public_id_idx
  ON public.l10n_overlay_versions (public_id, locale);

CREATE INDEX IF NOT EXISTS l10n_overlay_versions_workspace_id_idx
  ON public.l10n_overlay_versions (workspace_id);

-- RLS: service role only.
ALTER TABLE public.l10n_overlay_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l10n_overlay_versions_select ON public.l10n_overlay_versions;
CREATE POLICY l10n_overlay_versions_select ON public.l10n_overlay_versions
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_overlay_versions_insert ON public.l10n_overlay_versions;
CREATE POLICY l10n_overlay_versions_insert ON public.l10n_overlay_versions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_overlay_versions_update ON public.l10n_overlay_versions;
CREATE POLICY l10n_overlay_versions_update ON public.l10n_overlay_versions
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS l10n_overlay_versions_delete ON public.l10n_overlay_versions;
CREATE POLICY l10n_overlay_versions_delete ON public.l10n_overlay_versions
  FOR DELETE
  USING (auth.role() = 'service_role');

COMMIT;
