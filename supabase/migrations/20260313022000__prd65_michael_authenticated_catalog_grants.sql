BEGIN;

GRANT SELECT ON TABLE public.widgets TO authenticated;
GRANT SELECT ON TABLE public.curated_widget_instances TO authenticated;

COMMIT;
