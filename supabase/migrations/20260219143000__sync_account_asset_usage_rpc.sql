-- Make account asset usage writes atomic per instance save/publish.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_account_asset_usage(
  p_account_id UUID,
  p_public_id TEXT,
  p_refs JSONB DEFAULT '[]'::jsonb
) RETURNS TABLE(count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF p_public_id IS NULL OR length(trim(p_public_id)) = 0 THEN
    RAISE EXCEPTION 'public_id must not be empty' USING ERRCODE = '22023';
  END IF;

  IF p_refs IS NULL THEN
    p_refs := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(p_refs) <> 'array' THEN
    RAISE EXCEPTION 'refs must be a JSON array' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.account_asset_usage
  WHERE account_id = p_account_id
    AND public_id = p_public_id;

  WITH parsed AS (
    SELECT
      p_account_id::uuid AS account_id,
      (item ->> 'asset_id')::uuid AS asset_id,
      p_public_id::text AS public_id,
      nullif(trim(item ->> 'config_path'), '') AS config_path
    FROM jsonb_array_elements(p_refs) AS item
  ),
  sanitized AS (
    SELECT DISTINCT account_id, asset_id, public_id, config_path
    FROM parsed
    WHERE asset_id IS NOT NULL
      AND config_path IS NOT NULL
  ),
  inserted AS (
    INSERT INTO public.account_asset_usage (account_id, asset_id, public_id, config_path)
    SELECT account_id, asset_id, public_id, config_path
    FROM sanitized
    ON CONFLICT (account_id, asset_id, public_id, config_path) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count
  FROM inserted;

  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_account_asset_usage(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_account_asset_usage(UUID, TEXT, JSONB) TO service_role;

COMMIT;
