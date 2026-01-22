-- Align overlay public_id format with canonical instance/curated prefixes.
BEGIN;

ALTER TABLE public.widget_instance_overlays
  DROP CONSTRAINT IF EXISTS widget_instance_overlays_public_id_format;

ALTER TABLE public.widget_instance_overlays
  ADD CONSTRAINT widget_instance_overlays_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
  );

COMMIT;
