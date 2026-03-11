-- PRD 064 Phase 2b: persist active account preference in Berlin-owned user profile state.
BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS active_account_id UUID NULL
  REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_profiles_active_account_id_idx
  ON public.user_profiles (active_account_id);

WITH ranked_memberships AS (
  SELECT
    am.user_id,
    am.account_id,
    row_number() OVER (
      PARTITION BY am.user_id
      ORDER BY
        CASE am.role
          WHEN 'owner' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'editor' THEN 2
          WHEN 'viewer' THEN 1
          ELSE 0
        END DESC,
        am.created_at ASC,
        am.account_id ASC
    ) AS row_rank
  FROM public.account_members am
),
picked AS (
  SELECT user_id, account_id
  FROM ranked_memberships
  WHERE row_rank = 1
)
UPDATE public.user_profiles up
SET active_account_id = picked.account_id
FROM picked
WHERE up.user_id = picked.user_id
  AND up.active_account_id IS NULL;

COMMIT;
