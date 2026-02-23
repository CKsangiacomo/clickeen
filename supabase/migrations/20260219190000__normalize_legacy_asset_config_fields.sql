-- PRD 049B: one-time normalization for legacy asset metadata/fallback fields.
BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_asset_config_string(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v TEXT := COALESCE(p_value, '');
  v_inner TEXT;
  v_inner_norm TEXT;
BEGIN
  IF v ~* '^url\(([''"]?)(.+)\1\)$' THEN
    v_inner := regexp_replace(v, '^url\(([''"]?)(.+)\1\)$', '\2', 'i');
    v_inner_norm := public.normalize_asset_config_string(v_inner);
    IF v_inner_norm <> v_inner THEN
      RETURN 'url("' || v_inner_norm || '")';
    END IF;
  END IF;

  -- Normalize absolute pointer/object URLs to root-relative forms.
  IF v ~* '^https?://[^/]+/arsenale/' THEN
    v := regexp_replace(v, '^https?://[^/]+', '', 'i');
  END IF;

  -- Normalize object-path references to canonical pointer references.
  IF v ~* '^/arsenale/o/[0-9a-f-]{36}/[0-9a-f-]{36}(/.*)?$' THEN
    RETURN regexp_replace(
      v,
      '^/arsenale/o/([0-9a-f-]{36})/([0-9a-f-]{36})(?:/(?:original|[a-z0-9_-]{1,32}))?/.*$',
      '/arsenale/a/\1/\2',
      'i'
    );
  END IF;

  RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_asset_config_json(p_json JSONB)
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
      -- Remove legacy non-contract metadata/fallback fields.
      IF lower(v_key) IN ('mime', 'source', 'fallback') THEN
        CONTINUE;
      END IF;
      v_out := v_out || jsonb_build_object(v_key, public.normalize_asset_config_json(v_value));
    END LOOP;
    RETURN v_out;
  END IF;

  IF v_type = 'array' THEN
    RETURN COALESCE(
      (
        SELECT jsonb_agg(public.normalize_asset_config_json(value))
        FROM jsonb_array_elements(p_json)
      ),
      '[]'::jsonb
    );
  END IF;

  IF v_type = 'string' THEN
    RETURN to_jsonb(public.normalize_asset_config_string(p_json #>> '{}'));
  END IF;

  RETURN p_json;
END;
$$;

UPDATE public.widget_instances
SET config = public.normalize_asset_config_json(config)
WHERE config IS NOT NULL;

UPDATE public.curated_widget_instances
SET config = public.normalize_asset_config_json(config)
WHERE config IS NOT NULL;

COMMIT;
