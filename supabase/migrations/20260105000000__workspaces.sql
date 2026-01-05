-- Clickeen multitenancy v1 (authoritative).
-- Adds workspaces + membership + optional comments table, and makes widget_instances workspace-owned.
--
-- IMPORTANT:
-- - This repo is PRE-GA: strict contracts, fail-fast, no back-compat.
-- - Paris uses the Supabase service role key (RLS bypass). RLS protects against future accidental DB exposure.

BEGIN;

-- Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  website_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_tier_allowed CHECK (tier IN ('free', 'tier1', 'tier2', 'tier3'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Membership (roles)
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_role_allowed CHECK (role IN ('viewer', 'editor', 'admin', 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_unique_member UNIQUE (workspace_id, user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Optional: comments table (provisioned now; UX can ship later)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  widget_instance_id UUID NOT NULL REFERENCES public.widget_instances(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  target JSONB NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.comments
    ADD CONSTRAINT comments_target_is_object CHECK (target IS NULL OR jsonb_typeof(target) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Updated-at triggers (reuses base migration function)
DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_comments_updated_at ON public.comments;
CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Widget instances become workspace-owned.
ALTER TABLE public.widget_instances
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Deterministic "internal" workspaces (dev + demo).
INSERT INTO public.workspaces (id, slug, name, tier)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ck-dev', 'Clickeen Dev', 'tier3'),
  ('00000000-0000-0000-0000-000000000002', 'ck-demo', 'Clickeen Demo', 'free')
ON CONFLICT DO NOTHING;

-- Backfill existing instances into ck-dev.
UPDATE public.widget_instances
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

ALTER TABLE public.widget_instances
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS widget_instances_workspace_id_idx ON public.widget_instances (workspace_id);

-- RLS (production-grade)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Workspaces: members can read; owner/admin can update.
DROP POLICY IF EXISTS workspaces_select_members ON public.workspaces;
CREATE POLICY workspaces_select_members ON public.workspaces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspaces.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspaces_update_admin ON public.workspaces;
CREATE POLICY workspaces_update_admin ON public.workspaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspaces.id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Workspace members: members can read; owner/admin can manage.
DROP POLICY IF EXISTS workspace_members_select_members ON public.workspace_members;
CREATE POLICY workspace_members_select_members ON public.workspace_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workspace_members_manage_admin ON public.workspace_members;
CREATE POLICY workspace_members_manage_admin ON public.workspace_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = workspace_members.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Widget instances: members can read; editors+ can write.
DROP POLICY IF EXISTS widget_instances_select_members ON public.widget_instances;
CREATE POLICY widget_instances_select_members ON public.widget_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = widget_instances.workspace_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS widget_instances_write_editors ON public.widget_instances;
CREATE POLICY widget_instances_write_editors ON public.widget_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = widget_instances.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

-- Comments: members can read/write; viewers can comment.
DROP POLICY IF EXISTS comments_select_members ON public.comments;
CREATE POLICY comments_select_members ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = comments.workspace_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comments_write_members ON public.comments;
CREATE POLICY comments_write_members ON public.comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = comments.workspace_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comments_update_editors ON public.comments;
CREATE POLICY comments_update_editors ON public.comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = comments.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

COMMIT;
