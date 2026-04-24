-- PRD 076: Berlin-owned login identities and product-person boundary.
BEGIN;

CREATE TABLE IF NOT EXISTS public.login_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT NULL,
  given_name TEXT NULL,
  family_name TEXT NULL,
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT login_identities_provider_format
    CHECK (provider ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
  CONSTRAINT login_identities_provider_subject_present
    CHECK (btrim(provider_subject) <> ''),
  CONSTRAINT login_identities_email_lowercase
    CHECK (email IS NULL OR email = lower(email)),
  CONSTRAINT login_identities_provider_subject_unique
    UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS login_identities_user_id_idx
  ON public.login_identities (user_id);

DROP TRIGGER IF EXISTS set_login_identities_updated_at ON public.login_identities;
CREATE TRIGGER set_login_identities_updated_at
  BEFORE UPDATE ON public.login_identities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.login_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_identities_service_role_all ON public.login_identities;
CREATE POLICY login_identities_service_role_all ON public.login_identities
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DO $$
DECLARE
  missing_profile_count INTEGER;
BEGIN
  WITH referenced_users AS (
    SELECT user_id FROM public.account_members
    UNION
    SELECT created_by_user_id AS user_id FROM public.account_invitations
    UNION
    SELECT accepted_by_user_id AS user_id FROM public.account_invitations WHERE accepted_by_user_id IS NOT NULL
    UNION
    SELECT user_id FROM public.user_contact_methods
    UNION
    SELECT user_id FROM public.user_contact_verifications
  )
  SELECT count(*) INTO missing_profile_count
  FROM referenced_users ru
  LEFT JOIN public.user_profiles up ON up.user_id = ru.user_id
  LEFT JOIN auth.users au ON au.id = ru.user_id
  WHERE up.user_id IS NULL
    AND (au.id IS NULL OR au.email IS NULL OR btrim(au.email) = '');

  IF missing_profile_count > 0 THEN
    RAISE EXCEPTION 'PRD76 cannot migrate referenced users without user_profiles or auth email count=%', missing_profile_count;
  END IF;
END $$;

WITH referenced_users AS (
  SELECT user_id FROM public.account_members
  UNION
  SELECT created_by_user_id AS user_id FROM public.account_invitations
  UNION
  SELECT accepted_by_user_id AS user_id FROM public.account_invitations WHERE accepted_by_user_id IS NOT NULL
  UNION
  SELECT user_id FROM public.user_contact_methods
  UNION
  SELECT user_id FROM public.user_contact_verifications
)
INSERT INTO public.user_profiles (
  user_id,
  primary_email,
  email_verified,
  display_name,
  given_name,
  family_name,
  primary_language,
  country,
  timezone
)
SELECT
  au.id,
  lower(au.email),
  au.email_confirmed_at IS NOT NULL,
  NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')), ''),
  NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'given_name', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'givenName', '')), ''),
  NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'family_name', au.raw_user_meta_data->>'last_name', au.raw_user_meta_data->>'familyName', '')), ''),
  lower(NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'locale', au.raw_user_meta_data->>'language', '')), '')),
  CASE
    WHEN upper(NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'country', au.raw_user_meta_data->>'country_code', '')), '')) ~ '^[A-Z]{2}$'
      THEN upper(NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'country', au.raw_user_meta_data->>'country_code', '')), ''))
    ELSE NULL
  END,
  NULLIF(btrim(COALESCE(au.raw_user_meta_data->>'timezone', '')), '')
FROM referenced_users ru
JOIN auth.users au ON au.id = ru.user_id
LEFT JOIN public.user_profiles up ON up.user_id = ru.user_id
WHERE up.user_id IS NULL
  AND au.email IS NOT NULL
  AND btrim(au.email) <> ''
ON CONFLICT (user_id) DO NOTHING;

WITH auth_identity_rows AS (
  SELECT
    ai.user_id,
    lower(btrim(ai.provider)) AS provider,
    COALESCE(
      NULLIF(btrim(ai.identity_data->>'sub'), ''),
      NULLIF(btrim(ai.id::text), '')
    ) AS provider_subject,
    lower(NULLIF(btrim(COALESCE(ai.identity_data->>'email', au.email, '')), '')) AS email,
    CASE
      WHEN lower(NULLIF(btrim(ai.identity_data->>'email_verified'), '')) = 'true' THEN true
      WHEN lower(NULLIF(btrim(ai.identity_data->>'email_verified'), '')) = 'false' THEN false
      ELSE au.email_confirmed_at IS NOT NULL
    END AS email_verified,
    NULLIF(btrim(COALESCE(ai.identity_data->>'full_name', ai.identity_data->>'name', '')), '') AS display_name,
    NULLIF(btrim(COALESCE(ai.identity_data->>'given_name', ai.identity_data->>'first_name', ai.identity_data->>'givenName', '')), '') AS given_name,
    NULLIF(btrim(COALESCE(ai.identity_data->>'family_name', ai.identity_data->>'last_name', ai.identity_data->>'familyName', '')), '') AS family_name,
    NULLIF(btrim(COALESCE(ai.identity_data->>'avatar_url', ai.identity_data->>'picture', '')), '') AS avatar_url
  FROM auth.identities ai
  JOIN public.user_profiles up ON up.user_id = ai.user_id
  LEFT JOIN auth.users au ON au.id = ai.user_id
  WHERE ai.provider IS NOT NULL
)
INSERT INTO public.login_identities (
  user_id,
  provider,
  provider_subject,
  email,
  email_verified,
  display_name,
  given_name,
  family_name,
  avatar_url,
  last_used_at
)
SELECT
  user_id,
  provider,
  provider_subject,
  email,
  email_verified,
  display_name,
  given_name,
  family_name,
  avatar_url,
  now()
FROM auth_identity_rows
WHERE provider ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'
  AND provider_subject IS NOT NULL
  AND provider_subject <> ''
ON CONFLICT (provider, provider_subject) DO UPDATE SET
  email = EXCLUDED.email,
  email_verified = EXCLUDED.email_verified,
  display_name = EXCLUDED.display_name,
  given_name = EXCLUDED.given_name,
  family_name = EXCLUDED.family_name,
  avatar_url = EXCLUDED.avatar_url,
  last_used_at = now();

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.user_profiles'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.account_members'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.account_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_members
    ADD CONSTRAINT account_members_user_profile_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.account_invitations'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'created_by_user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.account_invitations DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.account_invitations'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'accepted_by_user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.account_invitations DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_invitations
    ADD CONSTRAINT account_invitations_created_by_profile_fk
    FOREIGN KEY (created_by_user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.account_invitations
    ADD CONSTRAINT account_invitations_accepted_by_profile_fk
    FOREIGN KEY (accepted_by_user_id) REFERENCES public.user_profiles(user_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.user_contact_methods'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_contact_methods DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.user_contact_verifications'::regclass
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_contact_verifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE public.user_contact_methods
    ADD CONSTRAINT user_contact_methods_user_profile_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.user_contact_verifications
    ADD CONSTRAINT user_contact_verifications_user_profile_fk
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
