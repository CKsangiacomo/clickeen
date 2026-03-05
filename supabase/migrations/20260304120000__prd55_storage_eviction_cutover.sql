-- PRD 55 execution cutover:
-- - Collapse lifecycle notice state into accounts columns.
-- - Evict document/ephemeral workloads from Supabase.
BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS tier_changed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS tier_changed_from TEXT NULL,
  ADD COLUMN IF NOT EXISTS tier_changed_to TEXT NULL,
  ADD COLUMN IF NOT EXISTS tier_drop_dismissed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS tier_drop_email_sent_at TIMESTAMPTZ NULL;

DROP TABLE IF EXISTS public.widget_instance_overlays CASCADE;
DROP TABLE IF EXISTS public.account_asset_usage CASCADE;
DROP TABLE IF EXISTS public.account_asset_variants CASCADE;
DROP TABLE IF EXISTS public.account_assets CASCADE;
DROP TABLE IF EXISTS public.l10n_generate_state CASCADE;
DROP TABLE IF EXISTS public.l10n_base_snapshots CASCADE;
DROP TABLE IF EXISTS public.l10n_overlay_versions CASCADE;
DROP TABLE IF EXISTS public.l10n_publish_state CASCADE;
DROP TABLE IF EXISTS public.instance_enforcement_state CASCADE;
DROP TABLE IF EXISTS public.instance_render_health CASCADE;
DROP TABLE IF EXISTS public.account_business_profiles CASCADE;
DROP TABLE IF EXISTS public.account_notices CASCADE;

DROP FUNCTION IF EXISTS public.sync_account_asset_usage(UUID, TEXT, JSONB);

COMMIT;
