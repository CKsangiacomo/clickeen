-- Enforce versionless curated public_id grammar and rename FAQ curated rows to canonical names.
BEGIN;

UPDATE public.curated_widget_instances
SET
  public_id = 'wgt_curated_faq_photo_hospitality_westcoast',
  meta = jsonb_set(
    jsonb_set(
      COALESCE(meta, '{}'::jsonb) - 'version',
      '{styleName}',
      to_jsonb('photo.hospitality.westcoast'::text),
      true
    ),
    '{styleSlug}',
    to_jsonb('photo_hospitality_westcoast'::text),
    true
  )
WHERE public_id IN ('wgt_curated_faq.hospitality.v01', 'wgt_curated_faq_hospitality');

UPDATE public.curated_widget_instances
SET
  public_id = 'wgt_curated_faq_lightblurs_generic',
  meta = jsonb_set(
    jsonb_set(
      COALESCE(meta, '{}'::jsonb) - 'version',
      '{styleName}',
      to_jsonb('lightblurs.generic'::text),
      true
    ),
    '{styleSlug}',
    to_jsonb('lightblurs_generic'::text),
    true
  )
WHERE public_id IN ('wgt_curated_faq.lightblurs.v01', 'wgt_curated_faq_lightblurs');

UPDATE public.widget_instance_overlays
SET public_id = 'wgt_curated_faq_photo_hospitality_westcoast'
WHERE public_id IN ('wgt_curated_faq.hospitality.v01', 'wgt_curated_faq_hospitality');

UPDATE public.widget_instance_overlays
SET public_id = 'wgt_curated_faq_lightblurs_generic'
WHERE public_id IN ('wgt_curated_faq.lightblurs.v01', 'wgt_curated_faq_lightblurs');

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
  );

ALTER TABLE public.curated_widget_instances
  DROP CONSTRAINT IF EXISTS curated_widget_instances_public_id_format;

ALTER TABLE public.curated_widget_instances
  ADD CONSTRAINT curated_widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9][a-z0-9_-]*$'
  );

ALTER TABLE public.widget_instance_overlays
  DROP CONSTRAINT IF EXISTS widget_instance_overlays_public_id_format;

ALTER TABLE public.widget_instance_overlays
  ADD CONSTRAINT widget_instance_overlays_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
  );

COMMIT;
