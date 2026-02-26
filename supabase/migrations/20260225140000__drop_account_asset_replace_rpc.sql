-- PRD 051: remove mutable replace contract and idempotency store.
BEGIN;

DROP FUNCTION IF EXISTS public.replace_account_asset_variant(
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BIGINT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
);

DROP TABLE IF EXISTS public.account_asset_replace_idempotency;

COMMIT;
