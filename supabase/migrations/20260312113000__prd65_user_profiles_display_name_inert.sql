BEGIN;

ALTER TABLE public.user_profiles
  ALTER COLUMN display_name DROP NOT NULL;

COMMIT;
