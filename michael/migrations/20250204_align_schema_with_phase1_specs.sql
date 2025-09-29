-- Migration: Align embed_tokens, events, and RLS with Phase-1 Specs
-- NOTE: run inside a transaction when applying via Supabase CLI or psql.

-- 1. embed_tokens: add public_id referencing widget_instances.public_id
ALTER TABLE public.embed_tokens
  ADD COLUMN IF NOT EXISTS public_id text;

UPDATE public.embed_tokens et
SET public_id = wi.public_id
FROM public.widget_instances wi
WHERE wi.id = et.widget_instance_id
  AND et.public_id IS NULL;

ALTER TABLE public.embed_tokens
  ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE public.embed_tokens
  ADD CONSTRAINT embed_tokens_public_id_fkey
    FOREIGN KEY (public_id)
    REFERENCES public.widget_instances(public_id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS embed_tokens_public_id_key
  ON public.embed_tokens(public_id);

-- 2. events: add idempotency hash column and unique index (nullable)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS idempotency_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency_hash_key
  ON public.events(idempotency_hash)
  WHERE idempotency_hash IS NOT NULL;

-- 3. Enable RLS and add policies where missing
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS profiles_upsert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS usage_events_select_members ON public.usage_events
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT m.workspace_id
      FROM public.workspace_members m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS widget_events_select_members ON public.widget_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.widgets w
      JOIN public.workspace_members m ON m.workspace_id = w.workspace_id
      WHERE w.id = public.widget_events.widget_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS plan_limits_select_all ON public.plan_limits
  FOR SELECT TO authenticated
  USING (true);
