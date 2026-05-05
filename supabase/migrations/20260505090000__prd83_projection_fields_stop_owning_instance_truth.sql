-- PRD 83: widget_instances is a relational projection only.
-- Tokyo owns editable config, display name, publish state, and user/system meaning.

BEGIN;

ALTER TABLE public.widget_instances
  ALTER COLUMN status DROP NOT NULL,
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN config DROP NOT NULL,
  ALTER COLUMN kind DROP NOT NULL,
  ALTER COLUMN kind DROP DEFAULT;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_status_allowed,
  DROP CONSTRAINT IF EXISTS widget_instances_config_is_object,
  DROP CONSTRAINT IF EXISTS widget_instances_kind_allowed;

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_status_allowed CHECK (
    status IS NULL OR status IN ('unpublished', 'published')
  ),
  ADD CONSTRAINT widget_instances_config_is_object CHECK (
    config IS NULL OR jsonb_typeof(config) = 'object'
  ),
  ADD CONSTRAINT widget_instances_kind_allowed CHECK (
    kind IS NULL OR kind IN ('system', 'user')
  );

COMMIT;
