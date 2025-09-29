# DB Change Request — Align embed_tokens, events, and RLS with Phase-1 Specs

## Motivation
Phase-1 specifications require:
- `embed_tokens` identified by `publicId` (unique per widget instance)
- `events` enforcing idempotent writes via `idempotency_hash`
- Row Level Security enabled across Phase-1 tables

Current Supabase snapshot diverges:
- `public.embed_tokens` lacks `public_id`
- `public.events` lacks `idempotency_hash`
- RLS is disabled on `profiles`, `usage_events`, `widget_events`, `plan_limits`

Aligning the schema removes spec drift and keeps the database consistent with PRDs.

## Proposed DDL
```sql
-- 1. embed_tokens: add public_id mapped to widget_instances.public_id
ALTER TABLE public.embed_tokens
  ADD COLUMN public_id text;

UPDATE public.embed_tokens et
SET public_id = wi.public_id
FROM public.widget_instances wi
WHERE wi.id = et.widget_instance_id;

ALTER TABLE public.embed_tokens
  ALTER COLUMN public_id SET NOT NULL,
  ADD CONSTRAINT embed_tokens_public_id_fkey
    FOREIGN KEY (public_id)
    REFERENCES public.widget_instances(public_id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX embed_tokens_public_id_key
  ON public.embed_tokens(public_id);

-- 2. events: add idempotency hash for deduplication
ALTER TABLE public.events
  ADD COLUMN idempotency_hash text;

CREATE UNIQUE INDEX events_idempotency_hash_key
  ON public.events(idempotency_hash)
  WHERE idempotency_hash IS NOT NULL;

-- 3. Enable/expand RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY profiles_upsert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_events_select_members ON public.usage_events
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT m.workspace_id FROM public.workspace_members m
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  ));

ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY widget_events_select_members ON public.widget_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.widgets w
    JOIN public.workspace_members m ON m.workspace_id = w.workspace_id
    WHERE w.id = public.widget_events.widget_id
      AND m.user_id = auth.uid() AND m.status = 'active'
  ));

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY plan_limits_select_all ON public.plan_limits
  FOR SELECT TO authenticated
  USING (true);
```

Service-role credentials bypass RLS automatically; no additional policies are required for Paris.

## Rollback Plan
```sql
ALTER TABLE public.embed_tokens DROP CONSTRAINT IF EXISTS embed_tokens_public_id_fkey;
ALTER TABLE public.embed_tokens DROP COLUMN IF EXISTS public_id;
DROP INDEX IF EXISTS embed_tokens_public_id_key;

ALTER TABLE public.events DROP COLUMN IF EXISTS idempotency_hash;
DROP INDEX IF EXISTS events_idempotency_hash_key;

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_upsert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

ALTER TABLE public.usage_events DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_events_select_members ON public.usage_events;

ALTER TABLE public.widget_events DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS widget_events_select_members ON public.widget_events;

ALTER TABLE public.plan_limits DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_limits_select_all ON public.plan_limits;
```

## Post-change Tasks
- Update `documentation/dbschemacontext.md` snapshot
- Confirm Paris uses `public_id` when inserting embed tokens
- Ensure analytics/usage read paths still succeed under new RLS policies
