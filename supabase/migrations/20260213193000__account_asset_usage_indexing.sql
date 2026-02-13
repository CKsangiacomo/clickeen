-- PRD 046 follow-up: simplify asset metadata model by making "where used" first-class.
-- Adds account_asset_usage for deterministic instance/path usage tracking.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_asset_usage (
  account_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  public_id TEXT NOT NULL,
  config_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, asset_id, public_id, config_path)
);

DO $$ BEGIN
  ALTER TABLE public.account_asset_usage
    ADD CONSTRAINT account_asset_usage_asset_account_fkey
      FOREIGN KEY (asset_id, account_id)
      REFERENCES public.account_assets(asset_id, account_id)
      ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_usage
    ADD CONSTRAINT account_asset_usage_public_id_nonempty CHECK (length(trim(public_id)) > 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_usage
    ADD CONSTRAINT account_asset_usage_config_path_nonempty CHECK (length(trim(config_path)) > 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_account_asset_usage_updated_at ON public.account_asset_usage;
CREATE TRIGGER set_account_asset_usage_updated_at
  BEFORE UPDATE ON public.account_asset_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS account_asset_usage_account_public_idx
  ON public.account_asset_usage (account_id, public_id);

CREATE INDEX IF NOT EXISTS account_asset_usage_account_asset_idx
  ON public.account_asset_usage (account_id, asset_id);

CREATE INDEX IF NOT EXISTS account_asset_usage_public_id_idx
  ON public.account_asset_usage (public_id);

ALTER TABLE public.account_asset_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_asset_usage_service_role_all ON public.account_asset_usage;
CREATE POLICY account_asset_usage_service_role_all ON public.account_asset_usage
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Deterministic bootstrap for already-uploaded assets that had direct public_id trace metadata.
INSERT INTO public.account_asset_usage (account_id, asset_id, public_id, config_path, created_at, updated_at)
SELECT
  a.account_id,
  a.asset_id,
  a.public_id,
  'config',
  a.created_at,
  a.updated_at
FROM public.account_assets a
WHERE a.deleted_at IS NULL
  AND a.public_id IS NOT NULL
  AND length(trim(a.public_id)) > 0
ON CONFLICT (account_id, asset_id, public_id, config_path) DO NOTHING;

COMMIT;
