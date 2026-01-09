-- Website creatives are locale-free. Locale is a runtime parameter, not part of instance identity.
--
-- Canonical:
--   wgt_web_{creativeKey}
-- where creativeKey is lowercase, dot-separated, allowed chars: a-z 0-9 . - _
--
-- This migration collapses any legacy `wgt_web_{creativeKey}.{locale}` rows to a single locale-free row:
-- - If a locale-free row already exists, all locale-suffixed variants are deleted.
-- - Otherwise, the best candidate is renamed to the locale-free id (prefers `en`, then newest).
BEGIN;

ALTER TABLE public.widget_instances
  DROP CONSTRAINT IF EXISTS widget_instances_public_id_format;

-- 1) Rename a single canonical row per website creative key (if no locale-free row exists yet).
WITH candidates AS (
  SELECT
    id,
    workspace_id,
    public_id,
    updated_at,
    regexp_replace(regexp_replace(public_id, '^wgt_web_', ''), '[.][a-z]{2}(-[a-z]{2})?$', '') AS creative_key,
    substring(public_id from '[.]([a-z]{2}(-[a-z]{2})?)$') AS locale
  FROM public.widget_instances
  WHERE public_id LIKE 'wgt_web_%' AND public_id ~ '[.][a-z]{2}(-[a-z]{2})?$'
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY workspace_id, creative_key
      ORDER BY (locale = 'en') DESC, updated_at DESC NULLS LAST, id ASC
    ) AS rn
  FROM candidates
),
chosen AS (
  SELECT * FROM ranked WHERE rn = 1
)
UPDATE public.widget_instances wi
  SET public_id = 'wgt_web_' || c.creative_key
  FROM chosen c
  WHERE wi.id = c.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.widget_instances existing
      WHERE existing.workspace_id = c.workspace_id
        AND existing.public_id = 'wgt_web_' || c.creative_key
    );

-- 2) Delete any remaining locale-suffixed website creative rows.
DELETE FROM public.widget_instances
  WHERE public_id LIKE 'wgt_web_%' AND public_id ~ '[.][a-z]{2}(-[a-z]{2})?$';

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_public_id_format CHECK (
    public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$'
    OR public_id ~ '^wgt_web_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$'
  );

COMMIT;
