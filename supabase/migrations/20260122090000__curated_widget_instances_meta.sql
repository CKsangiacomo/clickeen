-- Optional metadata for curated instances (style name, tags, versioning, etc.).
BEGIN;

ALTER TABLE public.curated_widget_instances
  ADD COLUMN IF NOT EXISTS meta JSONB;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_meta_is_object CHECK (
      meta IS NULL OR jsonb_typeof(meta) = 'object'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
