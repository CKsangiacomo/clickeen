BEGIN;

GRANT UPDATE ON TABLE public.widget_instances TO authenticated;

COMMIT;
