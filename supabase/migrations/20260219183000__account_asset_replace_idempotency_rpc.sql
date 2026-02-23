-- PRD 049B: atomic replace-in-place with idempotency + serialization.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_asset_replace_idempotency (
  account_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  variant TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  previous_r2_key TEXT NULL,
  current_r2_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, asset_id, idempotency_key)
);

DO $$ BEGIN
  ALTER TABLE public.account_asset_replace_idempotency
    ADD CONSTRAINT account_asset_replace_idempotency_asset_fkey
      FOREIGN KEY (asset_id, account_id)
      REFERENCES public.account_assets(asset_id, account_id)
      ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_replace_idempotency
    ADD CONSTRAINT account_asset_replace_idempotency_variant_format
      CHECK (variant ~ '^[a-z0-9][a-z0-9_-]{0,31}$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_asset_replace_idempotency
    ADD CONSTRAINT account_asset_replace_idempotency_sha256_format
      CHECK (request_sha256 ~ '^[a-f0-9]{64}$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_asset_replace_idempotency_created_idx
  ON public.account_asset_replace_idempotency (created_at DESC);

ALTER TABLE public.account_asset_replace_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_asset_replace_idempotency_service_role_all ON public.account_asset_replace_idempotency;
CREATE POLICY account_asset_replace_idempotency_service_role_all ON public.account_asset_replace_idempotency
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.replace_account_asset_variant(
  p_account_id UUID,
  p_asset_id UUID,
  p_variant TEXT,
  p_new_r2_key TEXT,
  p_filename TEXT,
  p_content_type TEXT,
  p_size_bytes BIGINT,
  p_source TEXT,
  p_original_filename TEXT,
  p_sha256 TEXT,
  p_idempotency_key TEXT,
  p_request_sha256 TEXT
) RETURNS TABLE(
  previous_r2_key TEXT,
  current_r2_key TEXT,
  replay BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_key TEXT;
  v_existing RECORD;
BEGIN
  IF p_account_id IS NULL OR p_asset_id IS NULL THEN
    RAISE EXCEPTION 'account_id and asset_id are required' USING ERRCODE = '22023';
  END IF;
  IF p_variant IS NULL OR length(trim(p_variant)) = 0 THEN
    RAISE EXCEPTION 'variant is required' USING ERRCODE = '22023';
  END IF;
  IF p_new_r2_key IS NULL OR length(trim(p_new_r2_key)) = 0 THEN
    RAISE EXCEPTION 'new_r2_key is required' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required' USING ERRCODE = '22023';
  END IF;
  IF p_request_sha256 IS NULL OR p_request_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'request_sha256 must be 64-char hex' USING ERRCODE = '22023';
  END IF;

  -- Serialize all replace operations for this asset.
  PERFORM 1
  FROM public.account_assets a
  WHERE a.account_id = p_account_id
    AND a.asset_id = p_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'asset not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    i.previous_r2_key,
    i.current_r2_key,
    i.request_sha256
  INTO v_existing
  FROM public.account_asset_replace_idempotency i
  WHERE i.account_id = p_account_id
    AND i.asset_id = p_asset_id
    AND i.idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.request_sha256 <> p_request_sha256 THEN
      RAISE EXCEPTION 'idempotency key reused with different payload' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
      SELECT
        v_existing.previous_r2_key::text,
        v_existing.current_r2_key::text,
        TRUE;
    RETURN;
  END IF;

  SELECT v.r2_key
  INTO v_prev_key
  FROM public.account_asset_variants v
  WHERE v.account_id = p_account_id
    AND v.asset_id = p_asset_id
    AND v.variant = p_variant
  LIMIT 1
  FOR UPDATE;

  INSERT INTO public.account_asset_variants (
    asset_id,
    account_id,
    variant,
    r2_key,
    filename,
    content_type,
    size_bytes
  ) VALUES (
    p_asset_id,
    p_account_id,
    p_variant,
    p_new_r2_key,
    p_filename,
    p_content_type,
    GREATEST(0, p_size_bytes)
  )
  ON CONFLICT (asset_id, variant) DO UPDATE SET
    r2_key = EXCLUDED.r2_key,
    filename = EXCLUDED.filename,
    content_type = EXCLUDED.content_type,
    size_bytes = EXCLUDED.size_bytes;

  IF lower(p_variant) = 'original' THEN
    UPDATE public.account_assets
    SET
      source = COALESCE(NULLIF(trim(p_source), ''), source),
      original_filename = COALESCE(NULLIF(trim(p_original_filename), ''), original_filename),
      normalized_filename = COALESCE(NULLIF(trim(p_filename), ''), normalized_filename),
      content_type = COALESCE(NULLIF(trim(p_content_type), ''), content_type),
      size_bytes = GREATEST(0, p_size_bytes),
      sha256 = COALESCE(NULLIF(trim(p_sha256), ''), sha256),
      updated_at = now()
    WHERE account_id = p_account_id
      AND asset_id = p_asset_id;
  END IF;

  INSERT INTO public.account_asset_replace_idempotency (
    account_id,
    asset_id,
    idempotency_key,
    variant,
    request_sha256,
    previous_r2_key,
    current_r2_key
  ) VALUES (
    p_account_id,
    p_asset_id,
    p_idempotency_key,
    p_variant,
    p_request_sha256,
    v_prev_key,
    p_new_r2_key
  );

  RETURN QUERY
    SELECT
      v_prev_key,
      p_new_r2_key,
      FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_account_asset_variant(
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
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.replace_account_asset_variant(
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
) TO service_role;

COMMIT;
