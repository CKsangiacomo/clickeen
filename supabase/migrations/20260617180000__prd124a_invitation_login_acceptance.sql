BEGIN;

CREATE OR REPLACE FUNCTION public.accept_login_invitation_identity(
  p_invitation_id UUID,
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
  p_timezone TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  account_id TEXT,
  role public.user_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider TEXT := lower(btrim(COALESCE(p_provider, '')));
  v_provider_subject TEXT := btrim(COALESCE(p_provider_subject, ''));
  v_primary_email CITEXT := lower(NULLIF(btrim(COALESCE(p_primary_email, '')), ''))::citext;
  v_first_name TEXT := NULLIF(btrim(COALESCE(p_given_name, '')), '');
  v_last_name TEXT := NULLIF(btrim(COALESCE(p_family_name, '')), '');
  v_primary_language TEXT := lower(NULLIF(btrim(COALESCE(p_primary_language, '')), ''));
  v_country_raw TEXT := upper(NULLIF(btrim(COALESCE(p_country, '')), ''));
  v_country CHAR(2);
  v_timezone TEXT := NULLIF(btrim(COALESCE(p_timezone, '')), '');
  v_user_id UUID;
  v_account_id TEXT;
  v_role public.user_role;
  v_invitation_email CITEXT;
  v_status public.invitation_status;
  v_expires_at TIMESTAMPTZ;
  v_accepted_at TIMESTAMPTZ;
  v_revoked_at TIMESTAMPTZ;
BEGIN
  IF v_provider NOT IN ('google', 'email') THEN
    RAISE EXCEPTION 'accept_login_invitation_identity invalid_provider';
  END IF;

  IF v_provider_subject = '' OR length(v_provider_subject) > 512 THEN
    RAISE EXCEPTION 'accept_login_invitation_identity invalid_provider_subject';
  END IF;

  IF v_primary_email IS NULL THEN
    RAISE EXCEPTION 'accept_login_invitation_identity missing_primary_email';
  END IF;

  IF v_country_raw IS NOT NULL THEN
    IF v_country_raw !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'accept_login_invitation_identity invalid_country';
    END IF;
    v_country := v_country_raw::char(2);
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('clickeen.login_identity:' || v_provider || ':' || v_provider_subject, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('clickeen.user_email:' || v_primary_email::text, 0)
  );

  SELECT ai.account_id, ai.email, ai.role, ai.status, ai.expires_at, ai.accepted_at, ai.revoked_at
    INTO v_account_id, v_invitation_email, v_role, v_status, v_expires_at, v_accepted_at, v_revoked_at
  FROM public.account_invitations ai
  WHERE ai.id = p_invitation_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'accept_login_invitation_identity invitation_not_found';
  END IF;

  IF v_status <> 'pending'
    OR v_accepted_at IS NOT NULL
    OR v_revoked_at IS NOT NULL
    OR v_expires_at <= now()
  THEN
    RAISE EXCEPTION 'accept_login_invitation_identity invitation_invalid_or_expired';
  END IF;

  IF v_invitation_email <> v_primary_email THEN
    RAISE EXCEPTION 'accept_login_invitation_identity invitation_email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.primary_email = v_primary_email
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'accept_login_invitation_identity user_already_associated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.login_provider = v_provider::public.login_provider
      AND u.login_subject = v_provider_subject
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'accept_login_invitation_identity login_identity_already_exists';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO public.users (
    user_id,
    account_id,
    role,
    primary_email,
    login_provider,
    login_subject,
    first_name,
    middle_name,
    last_name,
    primary_language,
    country,
    timezone,
    phone,
    whatsapp,
    created_at
  )
  VALUES (
    v_user_id,
    v_account_id,
    v_role,
    v_primary_email,
    v_provider::public.login_provider,
    v_provider_subject,
    v_first_name,
    NULL,
    v_last_name,
    v_primary_language,
    v_country,
    v_timezone,
    NULL,
    NULL,
    now()
  );

  UPDATE public.account_invitations ai
  SET status = 'accepted',
      accepted_at = now()
  WHERE ai.id = p_invitation_id;

  RETURN QUERY SELECT v_user_id, v_account_id, v_role;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_login_invitation_identity(
  UUID,
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
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_login_invitation_identity(
  UUID,
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
  TEXT
) TO service_role;

COMMIT;
