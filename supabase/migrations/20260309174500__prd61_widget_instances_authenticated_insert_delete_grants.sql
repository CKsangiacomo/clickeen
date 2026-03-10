BEGIN;

GRANT INSERT ON TABLE public.widget_instances TO authenticated;
GRANT DELETE ON TABLE public.widget_instances TO authenticated;

COMMIT;
