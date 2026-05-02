-- System-instance cutover.
-- Admin-owned product instances are normal widget_instances rows.
-- The old curated table/prefix is migration residue and is removed here.

BEGIN;

ALTER TABLE public.widget_instances
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_user_public_id_only;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_kind_allowed;

DO $$
BEGIN
  IF to_regclass('public.curated_widget_instances') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.curated_widget_instances DROP CONSTRAINT IF EXISTS curated_widget_instances_public_id_format';
    EXECUTE 'ALTER TABLE public.curated_widget_instances DROP CONSTRAINT IF EXISTS curated_widget_instances_kind_allowed';
  END IF;
END $$;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOR target_table IN
    SELECT format('%I.%I', table_schema, table_name)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'public_id'
  LOOP
    EXECUTE format(
      'UPDATE %s SET public_id = regexp_replace(public_id, %L, %L) WHERE public_id LIKE %L',
      target_table,
      '^wgt_curated_',
      'wgt_system_',
      'wgt_curated_%'
    );
  END LOOP;
END $$;

UPDATE public.widget_instances
SET kind = 'system'
WHERE kind = 'curated'
   OR public_id LIKE 'wgt_main_%'
   OR public_id LIKE 'wgt_system_%';

DO $$
BEGIN
  IF to_regclass('public.curated_widget_instances') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.widget_instances (
        widget_id,
        public_id,
        status,
        config,
        created_at,
        updated_at,
        account_id,
        kind,
        display_name
      )
      SELECT
        w.id,
        c.public_id,
        COALESCE(c.status, 'published'),
        COALESCE(c.config, '{}'::jsonb),
        COALESCE(c.created_at, now()),
        COALESCE(c.updated_at, now()),
        COALESCE(c.owner_account_id, '00000000-0000-0000-0000-000000000100'::uuid),
        'system',
        COALESCE(
          NULLIF(c.meta ->> 'styleName', ''),
          NULLIF(c.meta ->> 'styleSlug', ''),
          c.public_id
        )
      FROM public.curated_widget_instances c
      JOIN public.widgets w ON w.type = c.widget_type
      ON CONFLICT (public_id) DO UPDATE
      SET
        widget_id = EXCLUDED.widget_id,
        status = CASE
          WHEN widget_instances.status = 'published' THEN widget_instances.status
          ELSE EXCLUDED.status
        END,
        config = CASE
          WHEN widget_instances.config = '{}'::jsonb THEN EXCLUDED.config
          ELSE widget_instances.config
        END,
        account_id = EXCLUDED.account_id,
        kind = 'system',
        display_name = COALESCE(widget_instances.display_name, EXCLUDED.display_name),
        updated_at = GREATEST(widget_instances.updated_at, EXCLUDED.updated_at)
    $sql$;

    EXECUTE 'DROP TABLE public.curated_widget_instances CASCADE';
  END IF;
END $$;

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_kind_allowed CHECK (kind IN ('system', 'user'));

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_system_[a-z0-9][a-z0-9_-]*$'
    OR public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
  );

COMMIT;
