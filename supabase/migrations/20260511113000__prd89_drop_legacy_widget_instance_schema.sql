-- PRD 89 hard cut:
-- Tokyo is the account widget instance authority. Michael no longer keeps a
-- parallel account widget instance source/projection schema.

BEGIN;

DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.curated_widget_instances CASCADE;
DROP TABLE IF EXISTS public.widget_instance_locales CASCADE;
DROP TABLE IF EXISTS public.widget_instance_overlays CASCADE;
DROP TABLE IF EXISTS public.l10n_generate_state CASCADE;
DROP TABLE IF EXISTS public.l10n_publish_state CASCADE;
DROP TABLE IF EXISTS public.l10n_overlay_versions CASCADE;
DROP TABLE IF EXISTS public.l10n_base_snapshots CASCADE;
DROP TABLE IF EXISTS public.instance_enforcement_state CASCADE;
DROP TABLE IF EXISTS public.instance_render_health CASCADE;
DROP TABLE IF EXISTS public.widget_instances CASCADE;

DO $$
DECLARE
  legacy_table TEXT;
  legacy_column RECORD;
  legacy_constraint RECORD;
BEGIN
  SELECT candidate.table_name
    INTO legacy_table
  FROM (
    VALUES
      ('comments'),
      ('curated_widget_instances'),
      ('widget_instance_locales'),
      ('widget_instance_overlays'),
      ('l10n_generate_state'),
      ('l10n_publish_state'),
      ('l10n_overlay_versions'),
      ('l10n_base_snapshots'),
      ('instance_enforcement_state'),
      ('instance_render_health'),
      ('widget_instances')
  ) AS candidate(table_name)
  WHERE to_regclass('public.' || candidate.table_name) IS NOT NULL
  LIMIT 1;

  IF legacy_table IS NOT NULL THEN
    RAISE EXCEPTION 'PRD 89 legacy widget-instance table survived: public.%', legacy_table;
  END IF;

  SELECT table_name, column_name
    INTO legacy_column
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'widget_instance_id'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PRD 89 legacy widget_instance_id column survived: public.%.%', legacy_column.table_name, legacy_column.column_name;
  END IF;

  SELECT conrelid::regclass::text AS table_name, conname
    INTO legacy_constraint
  FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace
    AND pg_get_constraintdef(oid) ~ 'wgt_(curated|system|main)_'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PRD 89 legacy widget public_id constraint survived: %.%', legacy_constraint.table_name, legacy_constraint.conname;
  END IF;
END $$;

COMMIT;
