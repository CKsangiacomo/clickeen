-- Workspace localization policy (PRD 54).
-- Stores base locale + viewer locale selection settings (IP auto + switcher).
BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS l10n_policy JSONB;

DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_l10n_policy_is_object CHECK (
      l10n_policy IS NULL OR jsonb_typeof(l10n_policy) = 'object'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill default policy (v1).
UPDATE public.workspaces
SET l10n_policy = jsonb_build_object(
  'v', 1,
  'baseLocale', 'en',
  'ip', jsonb_build_object('enabled', false, 'countryToLocale', jsonb_build_object()),
  'switcher', jsonb_build_object('enabled', true)
)
WHERE l10n_policy IS NULL;

COMMIT;

