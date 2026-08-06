BEGIN;

UPDATE public.accounts
SET tier = 'tier4'::public.account_tier
WHERE id = 'CLICKEEN';

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_tier_allowed;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_tier_allowed CHECK (
    tier::text IN ('free', 'tier1', 'tier2', 'tier3', 'tier4')
  );

COMMIT;
