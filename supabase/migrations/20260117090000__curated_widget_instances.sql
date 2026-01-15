-- Clickeen-authored instances (baseline + curated).
-- Stored separately from user instances to avoid bidirectional sync and RLS coupling.
BEGIN;

CREATE TABLE IF NOT EXISTS public.curated_widget_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE,
  widget_type TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'curated',
  status TEXT NOT NULL DEFAULT 'unpublished',
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_widget_type_format CHECK (widget_type ~ '^[a-z0-9][a-z0-9_-]*$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_kind_allowed CHECK (kind IN ('baseline', 'curated'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_status_allowed CHECK (status IN ('unpublished', 'published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_config_is_object CHECK (jsonb_typeof(config) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_public_id_format CHECK (
      public_id ~ '^wgt_main_[a-z0-9][a-z0-9_-]*$'
      OR public_id ~ '^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS curated_widget_instances_widget_type_idx
  ON public.curated_widget_instances (widget_type);

DROP TRIGGER IF EXISTS set_curated_widget_instances_updated_at ON public.curated_widget_instances;
CREATE TRIGGER set_curated_widget_instances_updated_at
  BEFORE UPDATE ON public.curated_widget_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: read is public; writes are service-role only.
ALTER TABLE public.curated_widget_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curated_widget_instances_select_public ON public.curated_widget_instances;
CREATE POLICY curated_widget_instances_select_public ON public.curated_widget_instances
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS curated_widget_instances_write_service ON public.curated_widget_instances;
CREATE POLICY curated_widget_instances_write_service ON public.curated_widget_instances
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
