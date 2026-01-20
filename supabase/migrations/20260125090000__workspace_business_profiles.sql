-- Workspace business profile store (personalization onboarding).
BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile JSONB NOT NULL,
  sources JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.workspace_business_profiles
    ADD CONSTRAINT workspace_business_profiles_unique_workspace UNIQUE (workspace_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.workspace_business_profiles
    ADD CONSTRAINT workspace_business_profiles_profile_object CHECK (jsonb_typeof(profile) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.workspace_business_profiles
    ADD CONSTRAINT workspace_business_profiles_sources_object CHECK (sources IS NULL OR jsonb_typeof(sources) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS workspace_business_profiles_workspace_id_idx
  ON public.workspace_business_profiles (workspace_id);

DROP TRIGGER IF EXISTS set_workspace_business_profiles_updated_at ON public.workspace_business_profiles;
CREATE TRIGGER set_workspace_business_profiles_updated_at
  BEFORE UPDATE ON public.workspace_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: service role only.
ALTER TABLE public.workspace_business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_business_profiles_select ON public.workspace_business_profiles;
CREATE POLICY workspace_business_profiles_select ON public.workspace_business_profiles
  FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS workspace_business_profiles_insert ON public.workspace_business_profiles;
CREATE POLICY workspace_business_profiles_insert ON public.workspace_business_profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS workspace_business_profiles_update ON public.workspace_business_profiles;
CREATE POLICY workspace_business_profiles_update ON public.workspace_business_profiles
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS workspace_business_profiles_delete ON public.workspace_business_profiles;
CREATE POLICY workspace_business_profiles_delete ON public.workspace_business_profiles
  FOR DELETE
  USING (auth.role() = 'service_role');

COMMIT;
