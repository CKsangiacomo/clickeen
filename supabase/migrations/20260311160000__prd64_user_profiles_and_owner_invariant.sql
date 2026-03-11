-- PRD 064 Phase 2a: canonical user profile store + single-owner guard.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  primary_email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT NOT NULL,
  given_name TEXT,
  family_name TEXT,
  preferred_language TEXT,
  country_code TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_country_code_format
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_service_role_all ON public.user_profiles;
CREATE POLICY user_profiles_service_role_all ON public.user_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE UNIQUE INDEX IF NOT EXISTS account_members_one_owner_per_account_idx
  ON public.account_members (account_id)
  WHERE role = 'owner';

COMMIT;
