-- Clickeen minimal schema (authoritative).
-- Goal: Keep local Docker DB and cloud DB in sync with a small, strict contract.
--
-- Public schema contract:
-- - widgets
-- - widget_instances
--
-- Editors are strict: configs must be present + valid; no legacy/back-compat tables.

BEGIN;

-- Ensure uuid generation is available.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Drop legacy/public tables (Clickeen pre-reset history).
-- NOTE: We do NOT drop `widgets` / `widget_instances` here because this migration
-- may be applied to a live environment. Instead we migrate-in-place below.
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.embed_tokens CASCADE;
DROP TABLE IF EXISTS public.widget_submissions CASCADE;
DROP TABLE IF EXISTS public.usage_events CASCADE;
DROP TABLE IF EXISTS public.plan_features CASCADE;
DROP TABLE IF EXISTS public.plan_limits CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.widget_templates CASCADE;
DROP TABLE IF EXISTS public.widget_schemas CASCADE;

DROP FUNCTION IF EXISTS public.set_ts_second CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at CASCADE;

-- Widgets (one per widget type)
CREATE TABLE IF NOT EXISTS public.widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widget instances (canonical state tree)
CREATE TABLE IF NOT EXISTS public.widget_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unpublished',
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remove legacy columns (if migrating from older schemas).
ALTER TABLE public.widgets DROP COLUMN IF EXISTS workspace_id CASCADE;
ALTER TABLE public.widgets DROP COLUMN IF EXISTS public_key CASCADE;
ALTER TABLE public.widgets DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE public.widgets DROP COLUMN IF EXISTS config CASCADE;

ALTER TABLE public.widget_instances DROP COLUMN IF EXISTS draft_token CASCADE;
ALTER TABLE public.widget_instances DROP COLUMN IF EXISTS claimed_at CASCADE;
ALTER TABLE public.widget_instances DROP COLUMN IF EXISTS expires_at CASCADE;

-- Constraints (added idempotently; no silent fallbacks).
DO $$ BEGIN
  ALTER TABLE public.widgets
    ADD CONSTRAINT widgets_type_format CHECK (type ~ '^[a-z0-9][a-z0-9_-]*$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_status_allowed CHECK (status IN ('unpublished', 'published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_config_is_object CHECK (jsonb_typeof(config) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Instance ID taxonomy (public_id is the one ID that crosses system boundaries).
--
-- public_id grammar:
--   wgt_<widgetType>_main
--   wgt_<widgetType>_tmpl_<templateKey>
--   wgt_<widgetType>_u_<instanceKey>
DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_public_id_format CHECK (
      public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_widget_instances_updated_at ON public.widget_instances;
CREATE TRIGGER set_widget_instances_updated_at
  BEFORE UPDATE ON public.widget_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
