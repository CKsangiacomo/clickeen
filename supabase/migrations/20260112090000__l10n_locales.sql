-- Localization support (V0): workspace locale selection + curated/user instance kind.
BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS l10n_locales JSONB;

DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_l10n_locales_is_array CHECK (
      l10n_locales IS NULL OR jsonb_typeof(l10n_locales) = 'array'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.widget_instances
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'user';

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_kind_allowed CHECK (kind IN ('curated', 'user'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill curated instances using the canonical public_id grammar.
UPDATE public.widget_instances
SET kind = 'curated'
WHERE kind = 'user'
  AND (
    public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*)$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
  );

COMMIT;
