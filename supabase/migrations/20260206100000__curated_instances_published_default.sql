-- Curated/owned instances are always publishable.
-- Default curated -> published; user instances stay unpublished by default.
BEGIN;

ALTER TABLE public.curated_widget_instances
  ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE public.widget_instances
  ALTER COLUMN status SET DEFAULT 'unpublished';

UPDATE public.curated_widget_instances
  SET status = 'published'
  WHERE status IS DISTINCT FROM 'published';

COMMIT;
