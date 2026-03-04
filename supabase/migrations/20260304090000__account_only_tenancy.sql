-- Account-only tenancy pivot (pre-GA).
-- Workspace is removed as a tenant concept.
-- Invariants:
-- 1) Brand/site/client = 1 account (payer), always.
-- 2) Curated instances are owned by the single admin account; only admin account members can mutate curated.
BEGIN;

-- ---------------------------------------------------------------------------
-- Accounts become the primary tenant record (name/slug/tier/settings move here)
-- ---------------------------------------------------------------------------

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS website_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS l10n_locales JSONB NULL,
  ADD COLUMN IF NOT EXISTS l10n_policy JSONB NULL;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_tier_allowed CHECK (tier IN ('free', 'tier1', 'tier2', 'tier3'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9_-]*$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_l10n_locales_is_array CHECK (l10n_locales IS NULL OR jsonb_typeof(l10n_locales) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_l10n_policy_is_object CHECK (l10n_policy IS NULL OR jsonb_typeof(l10n_policy) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill account tenant fields from the 1:1 workspace rows (account_id == workspace.id in PRD046 phase0).
UPDATE public.accounts a
SET
  name = COALESCE(a.name, w.name),
  slug = COALESCE(a.slug, w.slug),
  tier = COALESCE(w.tier, a.tier),
  website_url = COALESCE(a.website_url, w.website_url),
  l10n_locales = COALESCE(a.l10n_locales, w.l10n_locales),
  l10n_policy = COALESCE(a.l10n_policy, w.l10n_policy)
FROM public.workspaces w
WHERE w.account_id = a.id
  AND w.id = a.id;

-- Deterministic admin account (already seeded in PRD046).
UPDATE public.accounts
SET
  name = COALESCE(name, 'Clickeen Admin'),
  slug = COALESCE(slug, 'clickeen-admin'),
  tier = 'tier3'
WHERE id = '00000000-0000-0000-0000-000000000100';

-- In the legacy model ck-dev/ck-demo workspaces mapped to the platform account.
-- Preserve ck-dev locale/policy/website settings onto the admin account before workspaces are dropped.
UPDATE public.accounts a
SET
  website_url = COALESCE(a.website_url, w.website_url),
  l10n_locales = COALESCE(a.l10n_locales, w.l10n_locales),
  l10n_policy = COALESCE(a.l10n_policy, w.l10n_policy)
FROM public.workspaces w
WHERE a.id = '00000000-0000-0000-0000-000000000100'
  AND w.slug = 'ck-dev';

-- Backfill any remaining missing identity fields (pre-GA safety; should be rare).
UPDATE public.accounts
SET
  slug = COALESCE(slug, 'acct-' || replace(id::text, '-', '')),
  name = COALESCE(name, 'Account ' || substring(replace(id::text, '-', '') from 1 for 8))
WHERE slug IS NULL OR name IS NULL;

-- Default localization policy (v1) for any account missing it.
UPDATE public.accounts
SET l10n_policy = jsonb_build_object(
  'v', 1,
  'baseLocale', 'en',
  'ip', jsonb_build_object('enabled', false, 'countryToLocale', jsonb_build_object()),
  'switcher', jsonb_build_object('enabled', true)
)
WHERE l10n_policy IS NULL;

ALTER TABLE public.accounts
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_slug_unique UNIQUE (slug);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Account membership (replaces workspace_members)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_members (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

DO $$ BEGIN
  ALTER TABLE public.account_members
    ADD CONSTRAINT account_members_role_allowed CHECK (role IN ('viewer', 'editor', 'admin', 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_members_user_id_idx
  ON public.account_members (user_id);

ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_members_select_members ON public.account_members;
CREATE POLICY account_members_select_members ON public.account_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = account_members.account_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS account_members_manage_admin ON public.account_members;
CREATE POLICY account_members_manage_admin ON public.account_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = account_members.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = account_members.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Backfill account_members from existing workspace_members.
WITH ranked AS (
  SELECT
    w.account_id AS account_id,
    wm.user_id AS user_id,
    max(
      CASE wm.role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END
    ) AS max_rank,
    min(wm.created_at) AS created_at
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  GROUP BY w.account_id, wm.user_id
),
normalized AS (
  SELECT
    account_id,
    user_id,
    CASE max_rank
      WHEN 4 THEN 'owner'
      WHEN 3 THEN 'admin'
      WHEN 2 THEN 'editor'
      WHEN 1 THEN 'viewer'
      ELSE 'viewer'
    END AS role,
    created_at
  FROM ranked
)
INSERT INTO public.account_members (account_id, user_id, role, created_at)
SELECT account_id, user_id, role, created_at
FROM normalized
ON CONFLICT (account_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

-- ---------------------------------------------------------------------------
-- User instances become account-owned (workspace_id dropped)
-- ---------------------------------------------------------------------------

ALTER TABLE public.widget_instances
  ADD COLUMN IF NOT EXISTS account_id UUID;

DO $$ BEGIN
  ALTER TABLE public.widget_instances
    ADD CONSTRAINT widget_instances_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.widget_instances wi
SET account_id = w.account_id
FROM public.workspaces w
WHERE wi.account_id IS NULL
  AND wi.workspace_id = w.id;

ALTER TABLE public.widget_instances
  ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS widget_instances_account_id_idx
  ON public.widget_instances (account_id);

-- RLS (account-based)
ALTER TABLE public.widget_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS widget_instances_select_members ON public.widget_instances;
CREATE POLICY widget_instances_select_members ON public.widget_instances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = widget_instances.account_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS widget_instances_write_editors ON public.widget_instances;
CREATE POLICY widget_instances_write_editors ON public.widget_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = widget_instances.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = widget_instances.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- Instance overlays become account-owned (workspace_id dropped)
-- ---------------------------------------------------------------------------

ALTER TABLE public.widget_instance_overlays
  ADD COLUMN IF NOT EXISTS account_id UUID NULL;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.widget_instance_overlays o
SET account_id = w.account_id
FROM public.workspaces w
WHERE o.account_id IS NULL
  AND o.workspace_id IS NOT NULL
  AND o.workspace_id = w.id;

ALTER TABLE public.widget_instance_overlays
  DROP CONSTRAINT IF EXISTS widget_instance_overlays_user_requires_workspace;

DO $$ BEGIN
  ALTER TABLE public.widget_instance_overlays
    ADD CONSTRAINT widget_instance_overlays_user_requires_account CHECK (
      source <> 'user' OR account_id IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS (account-based)
ALTER TABLE public.widget_instance_overlays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS widget_instance_overlays_select ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_select ON public.widget_instance_overlays
  FOR SELECT
  USING (
    account_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = widget_instance_overlays.account_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS widget_instance_overlays_insert_curated ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_insert_curated ON public.widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    account_id IS NULL
    AND auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS widget_instance_overlays_insert_user ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_insert_user ON public.widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = widget_instance_overlays.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

DROP POLICY IF EXISTS widget_instance_overlays_update ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_update ON public.widget_instance_overlays
  FOR UPDATE
  USING (
    (
      account_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.account_members m
        WHERE m.account_id = widget_instance_overlays.account_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  )
  WITH CHECK (
    (
      account_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.account_members m
        WHERE m.account_id = widget_instance_overlays.account_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  );

DROP POLICY IF EXISTS widget_instance_overlays_delete ON public.widget_instance_overlays;
CREATE POLICY widget_instance_overlays_delete ON public.widget_instance_overlays
  FOR DELETE
  USING (
    (
      account_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.account_members m
        WHERE m.account_id = widget_instance_overlays.account_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'editor')
      )
    )
    OR auth.role() = 'service_role'
  );

ALTER TABLE public.widget_instance_overlays
  DROP COLUMN IF EXISTS workspace_id;

CREATE INDEX IF NOT EXISTS widget_instance_overlays_account_id_idx
  ON public.widget_instance_overlays (account_id);

-- ---------------------------------------------------------------------------
-- L10n state tables: replace workspace_id with account_id (service role only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.l10n_generate_state
  ADD COLUMN IF NOT EXISTS account_id UUID NULL;

DO $$ BEGIN
  ALTER TABLE public.l10n_generate_state
    ADD CONSTRAINT l10n_generate_state_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.l10n_generate_state s
SET account_id = w.account_id
FROM public.workspaces w
WHERE s.account_id IS NULL
  AND s.workspace_id IS NOT NULL
  AND s.workspace_id = w.id;

ALTER TABLE public.l10n_generate_state
  DROP COLUMN IF EXISTS workspace_id;

DROP INDEX IF EXISTS public.l10n_generate_state_workspace_id_idx;
CREATE INDEX IF NOT EXISTS l10n_generate_state_account_id_idx
  ON public.l10n_generate_state (account_id);

ALTER TABLE public.l10n_overlay_versions
  ADD COLUMN IF NOT EXISTS account_id UUID NULL;

DO $$ BEGIN
  ALTER TABLE public.l10n_overlay_versions
    ADD CONSTRAINT l10n_overlay_versions_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.l10n_overlay_versions v
SET account_id = w.account_id
FROM public.workspaces w
WHERE v.account_id IS NULL
  AND v.workspace_id IS NOT NULL
  AND v.workspace_id = w.id;

ALTER TABLE public.l10n_overlay_versions
  DROP COLUMN IF EXISTS workspace_id;

DROP INDEX IF EXISTS public.l10n_overlay_versions_workspace_id_idx;
CREATE INDEX IF NOT EXISTS l10n_overlay_versions_account_id_idx
  ON public.l10n_overlay_versions (account_id);

-- ---------------------------------------------------------------------------
-- Comments: replace workspace_id with account_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS account_id UUID;

DO $$ BEGIN
  ALTER TABLE public.comments
    ADD CONSTRAINT comments_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.comments c
SET account_id = w.account_id
FROM public.workspaces w
WHERE c.account_id IS NULL
  AND c.workspace_id = w.id;

ALTER TABLE public.comments
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.comments
  DROP COLUMN IF EXISTS workspace_id;

CREATE INDEX IF NOT EXISTS comments_account_id_idx
  ON public.comments (account_id);

-- RLS (account-based)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select_members ON public.comments;
CREATE POLICY comments_select_members ON public.comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = comments.account_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comments_write_members ON public.comments;
CREATE POLICY comments_write_members ON public.comments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = comments.account_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comments_update_editors ON public.comments;
CREATE POLICY comments_update_editors ON public.comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members m
      WHERE m.account_id = comments.account_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- Business profiles: move to account scope (service role only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile JSONB NOT NULL,
  sources JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_business_profiles
    ADD CONSTRAINT account_business_profiles_unique_account UNIQUE (account_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_business_profiles
    ADD CONSTRAINT account_business_profiles_profile_object CHECK (jsonb_typeof(profile) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_business_profiles
    ADD CONSTRAINT account_business_profiles_sources_object CHECK (sources IS NULL OR jsonb_typeof(sources) = 'object');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_business_profiles_account_id_idx
  ON public.account_business_profiles (account_id);

DROP TRIGGER IF EXISTS set_account_business_profiles_updated_at ON public.account_business_profiles;
CREATE TRIGGER set_account_business_profiles_updated_at
  BEFORE UPDATE ON public.account_business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_business_profiles_service_role_all ON public.account_business_profiles;
CREATE POLICY account_business_profiles_service_role_all ON public.account_business_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Backfill account business profiles from workspace scope.
INSERT INTO public.account_business_profiles (account_id, profile, sources, created_at, updated_at)
SELECT
  w.account_id,
  p.profile,
  p.sources,
  p.created_at,
  p.updated_at
FROM public.workspace_business_profiles p
JOIN public.workspaces w ON w.id = p.workspace_id
ON CONFLICT (account_id) DO NOTHING;

DROP TABLE IF EXISTS public.workspace_business_profiles CASCADE;

-- ---------------------------------------------------------------------------
-- Account assets: remove workspace projection (workspace removed)
-- ---------------------------------------------------------------------------

ALTER TABLE public.account_assets
  DROP COLUMN IF EXISTS workspace_id;

-- ---------------------------------------------------------------------------
-- Drop workspace tenant tables (final)
-- ---------------------------------------------------------------------------

-- Drop helper function that enforced workspace.account_id invariants.
DROP TRIGGER IF EXISTS ensure_workspace_account_id_before_insert ON public.workspaces;
DROP FUNCTION IF EXISTS public.ensure_workspace_account_id();

DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;

-- Remove the legacy workspace_id column from widget_instances last (ensures backfill ran).
ALTER TABLE public.widget_instances
  DROP COLUMN IF EXISTS workspace_id;

COMMIT;
