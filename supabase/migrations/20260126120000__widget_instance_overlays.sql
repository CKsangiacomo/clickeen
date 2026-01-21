-- Layered overlay storage for instances (base + deterministic layers).
BEGIN;

CREATE TABLE IF NOT EXISTS public.widget_instance_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL,
  layer TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  ops JSONB NOT NULL,
  user_ops JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_fingerprint TEXT NOT NULL,
  base_updated_at TIMESTAMPTZ NULL,
  source TEXT NOT NULL,
  geo_targets TEXT[] NULL,
  workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_unique_layer UNIQUE (public_id, layer, layer_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_ops_is_array CHECK (jsonb_typeof(ops) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_user_ops_is_array CHECK (jsonb_typeof(user_ops) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_source_allowed CHECK (
      source IN ('agent', 'manual', 'import', 'user')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_layer_allowed CHECK (
      layer IN ('locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_layer_key_present CHECK (layer_key <> '');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_public_id_format CHECK (
      public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$'
      OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_user_requires_workspace CHECK (
      source <> 'user' OR workspace_id IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS widget_instance_overlays_public_id_idx
  ON public.widget_instance_overlays (public_id);

CREATE INDEX IF NOT EXISTS widget_instance_overlays_workspace_id_idx
  ON public.widget_instance_overlays (workspace_id);

DROP TRIGGER IF EXISTS set_widget_instance_overlays_updated_at ON public.widget_instance_overlays;
CREATE TRIGGER set_widget_instance_overlays_updated_at
  BEFORE UPDATE ON public.widget_instance_overlays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.widget_instance_overlays ENABLE ROW LEVEL SECURITY;

-- SELECT: curated (public) + own workspace overlays.
DROP POLICY IF EXISTS widget_instance_overlays_select ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_select ON public.widget_instance_overlays
  FOR SELECT
  USING (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = widget_instance_overlays.workspace_id
        AND m.user_id = auth.uid()
    )
  );

-- INSERT curated: service role only.
DROP POLICY IF EXISTS widget_instance_overlays_insert_curated ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_insert_curated ON public.widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    workspace_id IS NULL
    AND auth.role() = 'service_role'
  );

-- INSERT user: workspace editors only.
DROP POLICY IF EXISTS widget_instance_overlays_insert_user ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_insert_user ON public.widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = widget_instance_overlays.workspace_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

-- UPDATE: editors or service role, but block agent overwrites of user edits.
DROP POLICY IF EXISTS widget_instance_overlays_update ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_update ON public.widget_instance_overlays
  FOR UPDATE
  USING (
    (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members m
        WHERE m.workspace_id = widget_instance_overlays.workspace_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  )
  WITH CHECK (
    (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members m
        WHERE m.workspace_id = widget_instance_overlays.workspace_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  );

-- DELETE: editors or service role.
DROP POLICY IF EXISTS widget_instance_overlays_delete ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_delete ON public.widget_instance_overlays
  FOR DELETE
  USING (
    (
      workspace_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.workspace_members m
        WHERE m.workspace_id = widget_instance_overlays.workspace_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR auth.role() = 'service_role'
  );

COMMIT;
