-- Instance enforcement state (Phase 1 / PRD 37).
-- Stores "Frozen Billboard" state for embeds when capped tiers exceed view limits.
-- Read by: Paris (enforcement decisions), Tokyo-worker (snapshot generation), Bob (editor gating).

BEGIN;

CREATE TABLE IF NOT EXISTS public.instance_enforcement_state (
  public_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('frozen')),
  period_key TEXT NOT NULL,
  frozen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instance_enforcement_state_reset_at_idx
  ON public.instance_enforcement_state (reset_at);

DROP TRIGGER IF EXISTS set_instance_enforcement_state_updated_at ON public.instance_enforcement_state;
CREATE TRIGGER set_instance_enforcement_state_updated_at
  BEFORE UPDATE ON public.instance_enforcement_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;

