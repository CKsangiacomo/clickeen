-- PRD 83 follow-up: nullable projection fields must not synthesize defaults.

BEGIN;

ALTER TABLE public.widget_instances
  ALTER COLUMN config DROP DEFAULT;

COMMIT;
