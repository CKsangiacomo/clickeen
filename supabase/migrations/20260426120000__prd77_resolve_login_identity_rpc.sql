-- PRD 077: DB-owned provider identity resolution for Berlin direct-provider login.
BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_login_identity(
  p_provider TEXT,
  p_provider_subject TEXT,
  p_primary_email TEXT,
  p_email_verified BOOLEAN DEFAULT false,
  p_display_name TEXT DEFAULT NULL,
  p_given_name TEXT DEFAULT NULL,
  p_family_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_primary_language TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_legacy_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  login_identity_id UUID,
  created_user BOOLEAN,
  created_identity BOOLEAN,
  active_account_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider TEXT := lower(btrim(COALESCE(p_provider, '')));
  v_provider_subject TEXT := btrim(COALESCE(p_provider_subject, ''));
  v_primary_email TEXT := lower(NULLIF(btrim(COALESCE(p_primary_email, '')), ''));
  v_display_name TEXT := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_given_name TEXT := NULLIF(btrim(COALESCE(p_given_name, '')), '');
  v_family_name TEXT := NULLIF(btrim(COALESCE(p_family_name, '')), '');
  v_avatar_url TEXT := NULLIF(btrim(COALESCE(p_avatar_url, '')), '');
  v_primary_language TEXT := lower(NULLIF(btrim(COALESCE(p_primary_language, '')), ''));
  v_country TEXT := upper(NULLIF(btrim(COALESCE(p_country, '')), ''));
  v_timezone TEXT := NULLIF(btrim(COALESCE(p_timezone, '')), '');
  v_user_id UUID;
  v_login_identity_id UUID;
  v_profile_existed BOOLEAN;
  v_identity_existed BOOLEAN;
  v_active_account_id UUID;
BEGIN
  IF v_provider !~ '^[a-z0-9][a-z0-9_.-]{0,63}$' THEN
    RAISE EXCEPTION 'resolve_login_identity invalid provider';
  END IF;

  IF v_provider_subject = '' OR length(v_provider_subject) > 512 THEN
    RAISE EXCEPTION 'resolve_login_identity invalid provider_subject';
  END IF;

  IF v_primary_email IS NULL THEN
    RAISE EXCEPTION 'resolve_login_identity requires primary email';
  END IF;

  IF v_country IS NOT NULL AND v_country !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
    v_timezone := NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('clickeen.login_identity:' || v_provider || ':' || v_provider_subject, 0)
  );

  SELECT li.id, li.user_id
    INTO v_login_identity_id, v_user_id
  FROM public.login_identities li
  WHERE li.provider = v_provider
    AND li.provider_subject = v_provider_subject
  LIMIT 1;

  v_identity_existed := v_login_identity_id IS NOT NULL;
  v_user_id := COALESCE(v_user_id, p_legacy_user_id, gen_random_uuid());

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = v_user_id
  ) INTO v_profile_existed;

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
  VALUES (
    v_user_id,
    v_primary_email,
    COALESCE(p_email_verified, false),
    v_display_name,
    v_given_name,
    v_family_name,
    v_primary_language,
    v_country,
    v_timezone
  )
  ON CONFLICT (user_id) DO UPDATE SET
    primary_email = EXCLUDED.primary_email,
    email_verified = EXCLUDED.email_verified,
    display_name = COALESCE(NULLIF(btrim(public.user_profiles.display_name), ''), EXCLUDED.display_name),
    given_name = COALESCE(NULLIF(btrim(public.user_profiles.given_name), ''), EXCLUDED.given_name),
    family_name = COALESCE(NULLIF(btrim(public.user_profiles.family_name), ''), EXCLUDED.family_name),
    primary_language = COALESCE(NULLIF(btrim(public.user_profiles.primary_language), ''), EXCLUDED.primary_language),
    country = COALESCE(public.user_profiles.country, EXCLUDED.country),
    timezone = COALESCE(public.user_profiles.timezone, EXCLUDED.timezone)
  RETURNING public.user_profiles.active_account_id
    INTO v_active_account_id;

  IF v_identity_existed THEN
    UPDATE public.login_identities
    SET email = v_primary_email,
        email_verified = COALESCE(p_email_verified, false),
        display_name = v_display_name,
        given_name = v_given_name,
        family_name = v_family_name,
        avatar_url = v_avatar_url,
        last_used_at = now()
    WHERE id = v_login_identity_id
    RETURNING id
      INTO v_login_identity_id;
  ELSE
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
    VALUES (
      v_user_id,
      v_provider,
      v_provider_subject,
      v_primary_email,
      COALESCE(p_email_verified, false),
      v_display_name,
      v_given_name,
      v_family_name,
      v_avatar_url,
      now()
    )
    RETURNING id
      INTO v_login_identity_id;
  END IF;

  RETURN QUERY
  SELECT
    v_user_id,
    v_login_identity_id,
    NOT v_profile_existed,
    NOT v_identity_existed,
    v_active_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_identity(
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_login_identity(
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID
) TO service_role;

COMMIT;
