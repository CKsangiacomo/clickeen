-- Rename FAQ curated instance to new taxonomy (lightblurs v01).
BEGIN;

UPDATE public.curated_widget_instances
SET public_id = 'wgt_curated_faq.lightblurs.v01'
WHERE public_id = 'wgt_curated_faq.overview.hero';

UPDATE public.widget_instances
SET public_id = 'wgt_curated_faq.lightblurs.v01'
WHERE public_id = 'wgt_curated_faq.overview.hero';

UPDATE public.widget_instance_locales
SET public_id = 'wgt_curated_faq.lightblurs.v01'
WHERE public_id = 'wgt_curated_faq.overview.hero';

COMMIT;
