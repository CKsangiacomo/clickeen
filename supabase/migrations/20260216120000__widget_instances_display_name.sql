-- Add persistent display name for workspace-owned user instances.
-- Curated instances keep using curated_widget_instances.meta styleName.

BEGIN;

ALTER TABLE public.widget_instances
  ADD COLUMN IF NOT EXISTS display_name TEXT;

DO $$
BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_display_name_length
    CHECK (
      display_name IS NULL
      OR (
        char_length(btrim(display_name)) >= 1
        AND char_length(btrim(display_name)) <= 120
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.widget_instances
SET display_name = public_id
WHERE display_name IS NULL;

COMMIT;
