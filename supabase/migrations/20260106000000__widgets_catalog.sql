-- Prague CMS v1: platform-owned per-widget marketing catalog.
-- Adds `public.widgets.catalog` as a strict versioned JSON blob.

BEGIN;

ALTER TABLE public.widgets
  ADD COLUMN IF NOT EXISTS catalog JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.widgets
    ADD CONSTRAINT widgets_catalog_is_object CHECK (jsonb_typeof(catalog) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

