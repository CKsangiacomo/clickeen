BEGIN;

-- Ownership: Michael/Supabase owns the atomic per-account monthly counter.
-- Roma is the only runtime caller through service_role; browsers and other
-- product surfaces have no direct table or function access.
CREATE TABLE public.account_copilot_monthly_usage (
  account_id TEXT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  turns_used BIGINT NOT NULL CHECK (turns_used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, period_start)
);

ALTER TABLE public.account_copilot_monthly_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_copilot_monthly_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_account_copilot_turn(
  p_account_id TEXT,
  p_max_turns BIGINT
) RETURNS TABLE(
  reserved BOOLEAN,
  turns_used BIGINT,
  period_start DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', timezone('UTC', now()))::date;
  v_turns_used BIGINT;
BEGIN
  IF p_account_id IS NULL OR p_account_id !~ '^[0-9A-Z]{8}$' THEN
    RAISE EXCEPTION 'account_id must be an exact compact account id' USING ERRCODE = '22023';
  END IF;
  IF p_max_turns IS NOT NULL AND p_max_turns < 0 THEN
    RAISE EXCEPTION 'max_turns must be null or non-negative' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.account_copilot_monthly_usage (
    account_id,
    period_start,
    turns_used,
    updated_at
  )
  SELECT
    p_account_id,
    v_period_start,
    1,
    now()
  WHERE p_max_turns IS NULL OR p_max_turns >= 1
  ON CONFLICT (account_id, period_start) DO UPDATE SET
    turns_used = account_copilot_monthly_usage.turns_used + 1,
    updated_at = now()
  WHERE p_max_turns IS NULL
    OR account_copilot_monthly_usage.turns_used + 1 <= p_max_turns
  RETURNING account_copilot_monthly_usage.turns_used
  INTO v_turns_used;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_turns_used, v_period_start;
    RETURN;
  END IF;

  SELECT usage.turns_used
  INTO v_turns_used
  FROM public.account_copilot_monthly_usage AS usage
  WHERE usage.account_id = p_account_id
    AND usage.period_start = v_period_start;

  RETURN QUERY SELECT FALSE, COALESCE(v_turns_used, 0), v_period_start;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_account_copilot_turn(TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_account_copilot_turn(TEXT, BIGINT)
  TO service_role;

COMMIT;
