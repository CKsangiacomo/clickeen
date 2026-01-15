-- Validate user-only constraint after curated rows have been removed.
BEGIN;

ALTER TABLE public.widget_instances
  VALIDATE CONSTRAINT widget_instances_user_public_id_only;

COMMIT;
