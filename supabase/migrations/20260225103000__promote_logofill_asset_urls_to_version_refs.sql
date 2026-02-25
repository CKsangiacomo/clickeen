-- Hard-cut migration: move LogoShowcase user-uploaded logoFill asset URLs to asset.versionId refs.
-- Contract after cutover:
-- - strips[].logos[].asset.versionId stores immutable asset identity
-- - strips[].logos[].logoFill does not persist /assets/v/* URLs
BEGIN;

CREATE OR REPLACE FUNCTION public.logo_fill_asset_version_key(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v TEXT := trim(coalesce(p_value, ''));
  m TEXT[];
  v_candidate TEXT;
  v_version_key TEXT;
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;

  m := regexp_match(v, 'url\(\s*([''\"]?)([^''\")]+)\1\s*\)', 'i');
  IF m IS NOT NULL THEN
    v_candidate := trim(coalesce(m[2], ''));
  ELSE
    v_candidate := v;
  END IF;

  IF v_candidate = '' THEN
    RETURN NULL;
  END IF;

  IF v_candidate ~* '^https?://[^/]+/assets/v/' THEN
    v_candidate := regexp_replace(v_candidate, '^https?://[^/]+', '', 'i');
  END IF;

  IF v_candidate !~* '^/assets/v/[^/?#]+$' THEN
    RETURN NULL;
  END IF;

  SELECT av.r2_key
    INTO v_version_key
  FROM public.account_asset_variants av
  WHERE '/assets/v/' || replace(replace(av.r2_key, '%', '%25'), '/', '%2F') = v_candidate
  ORDER BY CASE WHEN lower(av.variant) = 'original' THEN 0 ELSE 1 END, av.created_at DESC
  LIMIT 1;

  IF v_version_key IS NULL OR v_version_key = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_version_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_logofill_asset_urls_to_version_refs(p_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_key TEXT;
  v_value JSONB;
  v_out JSONB;
  v_logo_fill_raw TEXT;
  v_version_key TEXT;
  v_asset JSONB;
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
      v_out := v_out || jsonb_build_object(v_key, public.promote_logofill_asset_urls_to_version_refs(v_value));
    END LOOP;

    v_logo_fill_raw := coalesce(p_json->>'logoFill', '');
    v_version_key := public.logo_fill_asset_version_key(v_logo_fill_raw);
    IF v_version_key IS NOT NULL THEN
      v_asset := CASE
        WHEN jsonb_typeof(v_out->'asset') = 'object' THEN v_out->'asset'
        ELSE '{}'::jsonb
      END;
      v_asset := v_asset || jsonb_build_object('versionId', v_version_key);
      v_out := jsonb_set(v_out, '{asset}', v_asset, true);
      v_out := jsonb_set(v_out, '{logoFill}', to_jsonb('transparent'::text), true);
    END IF;

    RETURN v_out;
  END IF;

  IF v_type = 'array' THEN
    RETURN COALESCE(
      (
        SELECT jsonb_agg(public.promote_logofill_asset_urls_to_version_refs(value))
        FROM jsonb_array_elements(p_json)
      ),
      '[]'::jsonb
    );
  END IF;

  RETURN p_json;
END;
$$;

UPDATE public.widget_instances
SET config = public.promote_logofill_asset_urls_to_version_refs(config)
WHERE config IS NOT NULL
  AND config::text ~* '"logoFill"'
  AND config::text ~* '/assets/v/';

UPDATE public.curated_widget_instances
SET config = public.promote_logofill_asset_urls_to_version_refs(config)
WHERE config IS NOT NULL
  AND config::text ~* '"logoFill"'
  AND config::text ~* '/assets/v/';

DROP FUNCTION IF EXISTS public.promote_logofill_asset_urls_to_version_refs(JSONB);
DROP FUNCTION IF EXISTS public.logo_fill_asset_version_key(TEXT);

COMMIT;
