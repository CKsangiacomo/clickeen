-- Hard-cut migration: convert legacy /arsenale/* config references to canonical /assets/v/* version refs.
BEGIN;

CREATE OR REPLACE FUNCTION public.canonicalize_asset_ref_string_to_version(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v TEXT := COALESCE(p_value, '');
  v_inner TEXT;
  v_inner_norm TEXT;
  m TEXT[];
  v_account_id TEXT;
  v_asset_id TEXT;
  v_rest TEXT;
  v_variant TEXT;
  v_filename TEXT;
  v_version_key TEXT;
  encoded_key TEXT;
BEGIN
  IF v = '' THEN
    RETURN p_value;
  END IF;

  IF v ~* '^url\(([''\"]?)(.+)\1\)$' THEN
    v_inner := regexp_replace(v, '^url\(([''\"]?)(.+)\1\)$', '\2', 'i');
    v_inner_norm := public.canonicalize_asset_ref_string_to_version(v_inner);
    IF v_inner_norm <> v_inner THEN
      RETURN 'url("' || v_inner_norm || '")';
    END IF;
    RETURN p_value;
  END IF;

  -- Normalize absolute asset URLs to root-relative paths before shape checks.
  IF v ~* '^https?://[^/]+/(arsenale|assets)/' THEN
    v := regexp_replace(v, '^https?://[^/]+', '', 'i');
  END IF;

  IF v ~* '^/assets/v/[^/?#]+$' THEN
    RETURN v;
  END IF;

  -- Legacy object path: /arsenale/o/{accountId}/{assetId}/{filename|variant/filename}
  m := regexp_match(v, '^/arsenale/o/([0-9a-f-]{36})/([0-9a-f-]{36})(?:/(.+))?$', 'i');
  IF m IS NOT NULL THEN
    v_account_id := lower(m[1]);
    v_asset_id := lower(m[2]);
    v_rest := COALESCE(m[3], '');

    IF v_rest = '' THEN
      SELECT av.r2_key
        INTO v_version_key
      FROM public.account_asset_variants av
      WHERE av.account_id = v_account_id::uuid
        AND av.asset_id = v_asset_id::uuid
      ORDER BY CASE WHEN lower(av.variant) = 'original' THEN 0 ELSE 1 END, av.created_at ASC
      LIMIT 1;

      IF v_version_key IS NULL OR v_version_key = '' THEN
        RETURN p_value;
      END IF;

      encoded_key := replace(replace(v_version_key, '%', '%25'), '/', '%2F');
      RETURN '/assets/v/' || encoded_key;
    END IF;

    IF v_rest ~* '^original/.+$' THEN
      v_filename := substring(v_rest FROM 10);
      v_version_key := 'assets/versions/' || v_account_id || '/' || v_asset_id || '/' || v_filename;
      encoded_key := replace(replace(v_version_key, '%', '%25'), '/', '%2F');
      RETURN '/assets/v/' || encoded_key;
    END IF;

    IF position('/' IN v_rest) > 0 THEN
      v_variant := split_part(v_rest, '/', 1);
      v_filename := substring(v_rest FROM char_length(v_variant) + 2);
      v_version_key :=
        'assets/versions/' || v_account_id || '/' || v_asset_id || '/' || lower(v_variant) || '/' || v_filename;
      encoded_key := replace(replace(v_version_key, '%', '%25'), '/', '%2F');
      RETURN '/assets/v/' || encoded_key;
    END IF;

    v_version_key := 'assets/versions/' || v_account_id || '/' || v_asset_id || '/' || v_rest;
    encoded_key := replace(replace(v_version_key, '%', '%25'), '/', '%2F');
    RETURN '/assets/v/' || encoded_key;
  END IF;

  -- Legacy pointer path: /arsenale/a/{accountId}/{assetId}
  m := regexp_match(v, '^/arsenale/a/([0-9a-f-]{36})/([0-9a-f-]{36})$', 'i');
  IF m IS NOT NULL THEN
    v_account_id := lower(m[1]);
    v_asset_id := lower(m[2]);

    SELECT av.r2_key
      INTO v_version_key
    FROM public.account_asset_variants av
    WHERE av.account_id = v_account_id::uuid
      AND av.asset_id = v_asset_id::uuid
    ORDER BY CASE WHEN lower(av.variant) = 'original' THEN 0 ELSE 1 END, av.created_at ASC
    LIMIT 1;

    IF v_version_key IS NOT NULL AND v_version_key <> '' THEN
      encoded_key := replace(replace(v_version_key, '%', '%25'), '/', '%2F');
      RETURN '/assets/v/' || encoded_key;
    END IF;

    RETURN p_value;
  END IF;

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonicalize_asset_ref_json_to_version(p_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_key TEXT;
  v_value JSONB;
  v_out JSONB;
BEGIN
  IF p_json IS NULL THEN
    RETURN NULL;
  END IF;

  v_type := jsonb_typeof(p_json);

  IF v_type = 'object' THEN
    v_out := '{}'::jsonb;
    FOR v_key, v_value IN
      SELECT key, value
      FROM jsonb_each(p_json)
    LOOP
      v_out := v_out || jsonb_build_object(v_key, public.canonicalize_asset_ref_json_to_version(v_value));
    END LOOP;
    RETURN v_out;
  END IF;

  IF v_type = 'array' THEN
    RETURN COALESCE(
      (
        SELECT jsonb_agg(public.canonicalize_asset_ref_json_to_version(value))
        FROM jsonb_array_elements(p_json)
      ),
      '[]'::jsonb
    );
  END IF;

  IF v_type = 'string' THEN
    RETURN to_jsonb(public.canonicalize_asset_ref_string_to_version(p_json #>> '{}'));
  END IF;

  RETURN p_json;
END;
$$;

UPDATE public.widget_instances
SET config = public.canonicalize_asset_ref_json_to_version(config)
WHERE config IS NOT NULL
  AND config::text ~* 'arsenale/';

UPDATE public.curated_widget_instances
SET config = public.canonicalize_asset_ref_json_to_version(config)
WHERE config IS NOT NULL
  AND config::text ~* 'arsenale/';

DROP FUNCTION IF EXISTS public.canonicalize_asset_ref_json_to_version(JSONB);
DROP FUNCTION IF EXISTS public.canonicalize_asset_ref_string_to_version(TEXT);

COMMIT;
