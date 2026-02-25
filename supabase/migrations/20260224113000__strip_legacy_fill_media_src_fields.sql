-- Hard-cut migration: remove persisted legacy media URL fields from fill payloads.
-- Contract after cutover:
-- - fill.image.asset.versionId
-- - fill.video.asset.versionId
-- - fill.video.poster.versionId
-- Non-contract fields removed:
-- - fill.image.src
-- - fill.video.src
-- - fill.video.posterSrc
-- - fill.video.poster (when stored as string)
BEGIN;

CREATE OR REPLACE FUNCTION public.strip_legacy_fill_media_fields(
  p_json JSONB,
  p_path TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_type TEXT;
  v_key TEXT;
  v_value JSONB;
  v_out JSONB;
  v_depth INT;
  v_parent TEXT;
  v_grandparent TEXT;
BEGIN
  IF p_json IS NULL THEN
    RETURN NULL;
  END IF;

  v_type := jsonb_typeof(p_json);

  IF v_type = 'object' THEN
    v_out := '{}'::jsonb;
    v_depth := COALESCE(array_length(p_path, 1), 0);
    v_parent := CASE WHEN v_depth >= 1 THEN p_path[v_depth] ELSE NULL END;
    v_grandparent := CASE WHEN v_depth >= 2 THEN p_path[v_depth - 1] ELSE NULL END;

    FOR v_key, v_value IN
      SELECT key, value
      FROM jsonb_each(p_json)
    LOOP
      IF v_grandparent = 'fill' AND v_parent IN ('image', 'video') AND v_key = 'src' THEN
        CONTINUE;
      END IF;

      IF v_grandparent = 'fill' AND v_parent = 'video' AND v_key = 'posterSrc' THEN
        CONTINUE;
      END IF;

      IF v_grandparent = 'fill'
         AND v_parent = 'video'
         AND v_key = 'poster'
         AND jsonb_typeof(v_value) = 'string' THEN
        CONTINUE;
      END IF;

      v_out := v_out || jsonb_build_object(
        v_key,
        public.strip_legacy_fill_media_fields(v_value, p_path || v_key)
      );
    END LOOP;

    RETURN v_out;
  END IF;

  IF v_type = 'array' THEN
    RETURN COALESCE(
      (
        SELECT jsonb_agg(public.strip_legacy_fill_media_fields(value, p_path))
        FROM jsonb_array_elements(p_json)
      ),
      '[]'::jsonb
    );
  END IF;

  RETURN p_json;
END;
$$;

UPDATE public.widget_instances
SET config = public.strip_legacy_fill_media_fields(config)
WHERE config IS NOT NULL
  AND config IS DISTINCT FROM public.strip_legacy_fill_media_fields(config);

UPDATE public.curated_widget_instances
SET config = public.strip_legacy_fill_media_fields(config)
WHERE config IS NOT NULL
  AND config IS DISTINCT FROM public.strip_legacy_fill_media_fields(config);

DROP FUNCTION IF EXISTS public.strip_legacy_fill_media_fields(JSONB, TEXT[]);

COMMIT;
