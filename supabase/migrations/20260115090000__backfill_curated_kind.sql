-- Backfill curated instance kind for locale-free public_id grammar.
BEGIN;

UPDATE public.widget_instances
SET kind = 'curated'
WHERE kind <> 'curated'
  AND (
    public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*)$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
  );

COMMIT;
