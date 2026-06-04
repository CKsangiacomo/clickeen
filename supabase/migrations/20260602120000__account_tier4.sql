BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'account_tier'
  ) THEN
    ALTER TYPE public.account_tier ADD VALUE IF NOT EXISTS 'tier4';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    ALTER TABLE public.accounts
      DROP CONSTRAINT IF EXISTS accounts_tier_allowed;

    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_tier_allowed CHECK (tier::text IN ('free', 'tier1', 'tier2', 'tier3', 'tier4'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    ALTER TABLE public.workspaces
      DROP CONSTRAINT IF EXISTS workspaces_tier_allowed;

    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_tier_allowed CHECK (tier::text IN ('free', 'tier1', 'tier2', 'tier3', 'tier4'));
  END IF;
END $$;

COMMIT;
