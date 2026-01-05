-- Website creatives public_id grammar support (authoritative).
-- Expands widget_instances.public_id taxonomy to include Prague website creatives:
--   wgt_web_{creativeKey}.{locale}
--
-- creativeKey (v1) is lowercase, dot-separated, allowed chars: a-z 0-9 . -
-- locale (v1) is a BCP47-ish tag: "en" or "en-us" (lowercase).
BEGIN;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_public_id_format CHECK (
      public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$'
      OR public_id ~ '^wgt_web_[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\\.[a-z]{2}(?:-[a-z]{2})?$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

