-- Add per-field manual overrides to instance locale overlays.
BEGIN;

ALTER TABLE public.widget_instance_locales
  ADD COLUMN IF NOT EXISTS user_ops JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_locales
    ADD CONSTRAINT widget_instance_locales_user_ops_is_array CHECK (jsonb_typeof(user_ops) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
