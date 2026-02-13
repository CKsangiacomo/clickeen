-- PRD 046 Phase 0: account ownership foundation for asset domain convergence.
BEGIN;

-- Canonical account identity table.
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  is_platform BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_status_allowed CHECK (status IN ('active', 'disabled'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_accounts_updated_at ON public.accounts;
CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_service_role_all ON public.accounts;
CREATE POLICY accounts_service_role_all ON public.accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Internal platform account (ck-dev/ck-demo/curated ownership).
INSERT INTO public.accounts (id, status, is_platform)
VALUES ('00000000-0000-0000-0000-000000000100', 'active', true)
ON CONFLICT (id) DO UPDATE
SET
  status = 'active',
  is_platform = true,
  updated_at = now();

-- Workspace-to-account binding.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS account_id UUID;

-- If account_id is already present on any rows, ensure those account rows exist.
INSERT INTO public.accounts (id, status, is_platform)
SELECT DISTINCT w.account_id, 'active', false
FROM public.workspaces w
WHERE w.account_id IS NOT NULL
  AND w.account_id <> '00000000-0000-0000-0000-000000000100'
ON CONFLICT (id) DO NOTHING;

-- Internal workspaces always map to platform account.
UPDATE public.workspaces
SET account_id = '00000000-0000-0000-0000-000000000100'
WHERE slug IN ('ck-dev', 'ck-demo');

-- Deterministic backfill for non-internal workspaces: one account per workspace.
INSERT INTO public.accounts (id, status, is_platform)
SELECT w.id, 'active', false
FROM public.workspaces w
WHERE w.account_id IS NULL
  AND w.slug NOT IN ('ck-dev', 'ck-demo')
ON CONFLICT (id) DO NOTHING;

UPDATE public.workspaces w
SET account_id = w.id
WHERE w.account_id IS NULL
  AND w.slug NOT IN ('ck-dev', 'ck-demo');

-- Final account-row safety pass.
INSERT INTO public.accounts (id, status, is_platform)
SELECT DISTINCT w.account_id, 'active', false
FROM public.workspaces w
WHERE w.account_id IS NOT NULL
  AND w.account_id <> '00000000-0000-0000-0000-000000000100'
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

ALTER TABLE public.workspaces
  ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS workspaces_account_id_idx
  ON public.workspaces (account_id);

-- Workspace inserts must always land with a valid account_id.
CREATE OR REPLACE FUNCTION public.ensure_workspace_account_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    IF NEW.slug IN ('ck-dev', 'ck-demo') THEN
      NEW.account_id := '00000000-0000-0000-0000-000000000100';
    ELSE
      NEW.account_id := COALESCE(NEW.id, gen_random_uuid());
      IF NEW.id IS NULL THEN
        NEW.id := NEW.account_id;
      END IF;
      INSERT INTO public.accounts (id, status, is_platform)
      VALUES (NEW.account_id, 'active', false)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  IF NEW.account_id = '00000000-0000-0000-0000-000000000100' THEN
    INSERT INTO public.accounts (id, status, is_platform)
    VALUES ('00000000-0000-0000-0000-000000000100', 'active', true)
    ON CONFLICT (id) DO UPDATE
    SET
      status = 'active',
      is_platform = true,
      updated_at = now();
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'workspace.account_id % does not exist in accounts', NEW.account_id
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_workspace_account_id_before_insert ON public.workspaces;
CREATE TRIGGER ensure_workspace_account_id_before_insert
  BEFORE INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.ensure_workspace_account_id();

-- Curated ownership becomes explicit.
ALTER TABLE public.curated_widget_instances
  ADD COLUMN IF NOT EXISTS owner_account_id UUID;

UPDATE public.curated_widget_instances
SET owner_account_id = '00000000-0000-0000-0000-000000000100'
WHERE owner_account_id IS NULL;

INSERT INTO public.accounts (id, status, is_platform)
SELECT DISTINCT c.owner_account_id, 'active', false
FROM public.curated_widget_instances c
WHERE c.owner_account_id IS NOT NULL
  AND c.owner_account_id <> '00000000-0000-0000-0000-000000000100'
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  ALTER TABLE public.curated_widget_instances
    ADD CONSTRAINT curated_widget_instances_owner_account_id_fkey
      FOREIGN KEY (owner_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

ALTER TABLE public.curated_widget_instances
  ALTER COLUMN owner_account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS curated_widget_instances_owner_account_id_idx
  ON public.curated_widget_instances (owner_account_id);

-- Account-owned asset domain.
CREATE TABLE IF NOT EXISTS public.account_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  workspace_id UUID NULL REFERENCES public.workspaces(id) ON DELETE SET NULL,
  public_id TEXT NULL,
  widget_type TEXT NULL,
  source TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  normalized_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_assets
    ADD CONSTRAINT account_assets_source_allowed CHECK (
      source IN ('bob.publish', 'bob.export', 'devstudio', 'promotion', 'api')
    );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_assets
    ADD CONSTRAINT account_assets_widget_type_format CHECK (
      widget_type IS NULL OR widget_type ~ '^[a-z0-9][a-z0-9_-]*$'
    );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_assets
    ADD CONSTRAINT account_assets_size_nonnegative CHECK (size_bytes >= 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_assets
    ADD CONSTRAINT account_assets_sha256_format CHECK (
      sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'
    );
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_assets
    ADD CONSTRAINT account_assets_asset_account_unique UNIQUE (asset_id, account_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_account_assets_updated_at ON public.account_assets;
CREATE TRIGGER set_account_assets_updated_at
  BEFORE UPDATE ON public.account_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS account_assets_account_created_idx
  ON public.account_assets (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_assets_account_asset_idx
  ON public.account_assets (account_id, asset_id);

CREATE INDEX IF NOT EXISTS account_assets_account_sha256_idx
  ON public.account_assets (account_id, sha256)
  WHERE sha256 IS NOT NULL;

ALTER TABLE public.account_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_assets_service_role_all ON public.account_assets;
CREATE POLICY account_assets_service_role_all ON public.account_assets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.account_asset_variants (
  asset_id UUID NOT NULL,
  account_id UUID NOT NULL,
  variant TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.account_asset_variants
    ADD CONSTRAINT account_asset_variants_asset_account_fkey
      FOREIGN KEY (asset_id, account_id)
      REFERENCES public.account_assets(asset_id, account_id)
      ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_variants
    ADD CONSTRAINT account_asset_variants_asset_variant_unique UNIQUE (asset_id, variant);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_variants
    ADD CONSTRAINT account_asset_variants_variant_format CHECK (variant ~ '^[a-z0-9][a-z0-9_-]{0,31}$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_variants
    ADD CONSTRAINT account_asset_variants_size_nonnegative CHECK (size_bytes >= 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_asset_variants_account_created_idx
  ON public.account_asset_variants (account_id, created_at DESC);

ALTER TABLE public.account_asset_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_asset_variants_service_role_all ON public.account_asset_variants;
CREATE POLICY account_asset_variants_service_role_all ON public.account_asset_variants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
