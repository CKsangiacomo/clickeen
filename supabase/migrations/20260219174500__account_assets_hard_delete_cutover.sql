-- PRD 049B: remove soft-delete semantics for account assets.
BEGIN;

-- Remove soft-deleted rows and related usage before dropping the column.
DELETE FROM public.account_asset_usage u
USING public.account_assets a
WHERE a.account_id = u.account_id
  AND a.asset_id = u.asset_id
  AND a.deleted_at IS NOT NULL;

DELETE FROM public.account_asset_variants v
USING public.account_assets a
WHERE a.account_id = v.account_id
  AND a.asset_id = v.asset_id
  AND a.deleted_at IS NOT NULL;

DELETE FROM public.account_assets
WHERE deleted_at IS NOT NULL;

ALTER TABLE public.account_assets
  DROP COLUMN IF EXISTS deleted_at;

COMMIT;
