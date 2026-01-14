-- Update public_id grammar to wgt_main_* and wgt_curated_* (user remains wgt_*_u_*).
-- Includes the one-time rename for existing instances and locale overlays.
BEGIN;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

ALTER TABLE public.widget_instance_locales
  DROP CONSTRAINT IF EXISTS widget_instance_locales_public_id_format;

-- Rename existing curated/main instances (and any overlays) to the new prefixes.
UPDATE public.widget_instances
SET public_id = 'wgt_main_faq'
WHERE public_id = 'wgt_faq_main';

UPDATE public.widget_instances
SET public_id = 'wgt_curated_faq.overview.hero'
WHERE public_id = 'wgt_web_faq.overview.hero';

UPDATE public.widget_instances
SET public_id = 'wgt_main_logoshowcase'
WHERE public_id = 'wgt_logoshowcase_main';

UPDATE public.widget_instance_locales
SET public_id = 'wgt_main_faq'
WHERE public_id = 'wgt_faq_main';

UPDATE public.widget_instance_locales
SET public_id = 'wgt_curated_faq.overview.hero'
WHERE public_id = 'wgt_web_faq.overview.hero';

UPDATE public.widget_instance_locales
SET public_id = 'wgt_main_logoshowcase'
WHERE public_id = 'wgt_logoshowcase_main';

UPDATE public.widget_instances
SET kind = 'curated'
WHERE public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
   OR public_id ~ '^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$';

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
  );

ALTER TABLE public.widget_instance_locales
  ADD CONSTRAINT widget_instance_locales_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
  );

COMMIT;
