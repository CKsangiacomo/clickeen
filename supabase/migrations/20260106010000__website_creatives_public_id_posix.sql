-- Fix: Postgres uses POSIX regex; it does not support PCRE non-capturing groups `(?:...)`.
-- Replace the widget_instances.public_id format constraint with a POSIX-compatible pattern
-- that allows Prague website creatives:
--   wgt_web_{creativeKey}.{locale}
BEGIN;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\\.[a-z]{2}(-[a-z]{2})?$'
  );

COMMIT;
