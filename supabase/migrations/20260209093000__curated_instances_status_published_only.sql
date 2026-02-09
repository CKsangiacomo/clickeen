-- Curated instances are always published.
-- "unpublished" is a user-instance draft concept and must not apply to curated templates.
BEGIN;

UPDATE public.curated_widget_instances
SET status = 'published'
WHERE status IS DISTINCT FROM 'published';

ALTER TABLE public.curated_widget_instances
  ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE public.curated_widget_instances
  DROP CONSTRAINT IF EXISTS curated_widget_instances_status_allowed;

ALTER TABLE public.curated_widget_instances
  ADD CONSTRAINT curated_widget_instances_status_allowed CHECK (status = 'published');

COMMIT;

