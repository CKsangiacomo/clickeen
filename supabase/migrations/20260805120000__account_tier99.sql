BEGIN;

ALTER TYPE public.account_tier ADD VALUE IF NOT EXISTS 'tier99';

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_tier_allowed;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_tier_allowed CHECK (
    tier::text IN ('free', 'tier1', 'tier2', 'tier3', 'tier4', 'tier99')
  );

COMMIT;
