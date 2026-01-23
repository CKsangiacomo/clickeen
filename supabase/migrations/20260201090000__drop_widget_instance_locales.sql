-- Drop legacy widget_instance_locales table (replaced by widget_instance_overlays).
BEGIN;

DROP TABLE IF EXISTS public.widget_instance_locales CASCADE;

COMMIT;
