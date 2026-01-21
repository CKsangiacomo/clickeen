-- Generalize l10n publish + version ledger to layered overlays.
BEGIN;

ALTER TABLE public.l10n_publish_state
  ADD COLUMN IF NOT EXISTS layer TEXT NOT NULL DEFAULT 'locale',
  ADD COLUMN IF NOT EXISTS layer_key TEXT NOT NULL DEFAULT '';

UPDATE public.l10n_publish_state
  SET layer = 'locale',
      layer_key = locale
  WHERE layer_key = '' OR layer_key IS NULL;

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    DROP CONSTRAINT l10n_publish_state_unique_locale;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    ADD CONSTRAINT l10n_publish_state_unique_layer UNIQUE (public_id, layer, layer_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    ADD CONSTRAINT l10n_publish_state_layer_allowed CHECK (
      layer IN ('locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_publish_state
    ADD CONSTRAINT l10n_publish_state_layer_key_present CHECK (layer_key <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_publish_state_layer_idx
  ON public.l10n_publish_state (public_id, layer, layer_key);

ALTER TABLE public.l10n_overlay_versions
  ADD COLUMN IF NOT EXISTS layer TEXT NOT NULL DEFAULT 'locale',
  ADD COLUMN IF NOT EXISTS layer_key TEXT NOT NULL DEFAULT '';

UPDATE public.l10n_overlay_versions
  SET layer = 'locale',
      layer_key = locale
  WHERE layer_key = '' OR layer_key IS NULL;

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    DROP CONSTRAINT l10n_overlay_versions_unique_version;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    ADD CONSTRAINT l10n_overlay_versions_unique_version UNIQUE (public_id, layer, layer_key, base_fingerprint);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    ADD CONSTRAINT l10n_overlay_versions_layer_allowed CHECK (
      layer IN ('locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    ADD CONSTRAINT l10n_overlay_versions_layer_key_present CHECK (layer_key <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS l10n_overlay_versions_layer_idx
  ON public.l10n_overlay_versions (public_id, layer, layer_key);

COMMIT;
