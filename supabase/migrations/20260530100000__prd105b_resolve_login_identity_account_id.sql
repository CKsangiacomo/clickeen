BEGIN;

DROP FUNCTION IF EXISTS public.resolve_login_identity(
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
);

CREATE FUNCTION public.resolve_login_identity(
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
  created_user BOOLEAN,
  account_id TEXT
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
  v_country CHAR(2) := upper(NULLIF(btrim(COALESCE(p_country, '')), ''))::char(2);
  v_timezone TEXT := NULLIF(btrim(COALESCE(p_timezone, '')), '');
  v_user_id UUID;
  v_account_id TEXT;
  v_created BOOLEAN := false;
  v_alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_candidate TEXT;
  i INTEGER;
  j INTEGER;
BEGIN
  IF v_provider NOT IN ('google', 'email') THEN
    RAISE EXCEPTION 'resolve_login_identity invalid provider';
  END IF;

  IF v_provider_subject = '' OR length(v_provider_subject) > 512 THEN
    RAISE EXCEPTION 'resolve_login_identity invalid provider_subject';
  END IF;

  IF v_primary_email IS NULL THEN
    RAISE EXCEPTION 'resolve_login_identity requires primary email';
  END IF;

  IF v_country IS NOT NULL AND v_country::text !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
    v_timezone := NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('clickeen.login_identity:' || v_provider || ':' || v_provider_subject, 0)
  );

  SELECT u.user_id, u.account_id
    INTO v_user_id, v_account_id
  FROM public.users u
  WHERE u.login_provider = v_provider::public.login_provider
    AND u.login_subject = v_provider_subject
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users u
    SET first_name = COALESCE(NULLIF(btrim(u.first_name), ''), v_first_name),
        last_name = COALESCE(NULLIF(btrim(u.last_name), ''), v_last_name),
        primary_language = COALESCE(NULLIF(btrim(u.primary_language), ''), v_primary_language),
        country = COALESCE(u.country, v_country),
        timezone = COALESCE(NULLIF(btrim(u.timezone), ''), v_timezone)
    WHERE u.user_id = v_user_id;

    RETURN QUERY SELECT v_user_id, false, v_account_id;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  FOR i IN 1..24 LOOP
    v_candidate := '';
    FOR j IN 1..8 LOOP
      v_candidate := v_candidate || substr(v_alphabet, (get_byte(gen_random_bytes(1), 0) % 36) + 1, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.accounts (id, status, status_changed_at, tier, created_at)
      VALUES (v_candidate, 'active', now(), 'free', now());
      v_account_id := v_candidate;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_account_id := NULL;
    END;
  END LOOP;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'resolve_login_identity account_id_generation_failed';
  END IF;

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
    'owner',
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
  v_created := true;

  RETURN QUERY SELECT v_user_id, v_created, v_account_id;
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
  TEXT
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
  TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_account_owner(
  p_account_id TEXT,
  p_current_owner_user_id UUID,
  p_next_owner_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role public.user_role;
  v_next_role public.user_role;
BEGIN
  IF p_account_id IS NULL OR p_account_id !~ '^[0-9A-Z]{8}$' THEN
    RAISE EXCEPTION 'transfer_account_owner invalid account id';
  END IF;

  IF p_current_owner_user_id IS NULL OR p_next_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'transfer_account_owner requires user ids';
  END IF;

  IF p_current_owner_user_id = p_next_owner_user_id THEN
    RAISE EXCEPTION 'transfer_account_owner next owner matches current owner';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('clickeen.account_owner:' || p_account_id, 0));

  SELECT u.role
    INTO v_current_role
  FROM public.users u
  WHERE u.account_id = p_account_id
    AND u.user_id = p_current_owner_user_id
  FOR UPDATE;

  IF v_current_role IS DISTINCT FROM 'owner'::public.user_role THEN
    RAISE EXCEPTION 'transfer_account_owner current user is not owner';
  END IF;

  SELECT u.role
    INTO v_next_role
  FROM public.users u
  WHERE u.account_id = p_account_id
    AND u.user_id = p_next_owner_user_id
  FOR UPDATE;

  IF v_next_role IS NULL THEN
    RAISE EXCEPTION 'transfer_account_owner next owner is not an account user';
  END IF;

  UPDATE public.users
  SET role = 'admin'::public.user_role
  WHERE account_id = p_account_id
    AND user_id = p_current_owner_user_id;

  UPDATE public.users
  SET role = 'owner'::public.user_role
  WHERE account_id = p_account_id
    AND user_id = p_next_owner_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_account_owner(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_account_owner(TEXT, UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
