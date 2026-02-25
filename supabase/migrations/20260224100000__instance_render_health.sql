-- Tracks per-instance render pipeline health for publish/snapshot observability.
BEGIN;

CREATE TABLE IF NOT EXISTS public.instance_render_health (
  public_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'error')),
  reason TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instance_render_health_status_updated_idx
  ON public.instance_render_health (status, updated_at DESC);

DROP TRIGGER IF EXISTS set_instance_render_health_updated_at ON public.instance_render_health;
CREATE TRIGGER set_instance_render_health_updated_at
  BEFORE UPDATE ON public.instance_render_health
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.instance_render_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instance_render_health_service_role_all ON public.instance_render_health;
CREATE POLICY instance_render_health_service_role_all ON public.instance_render_health
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;
