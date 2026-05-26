BEGIN;

DO $$
DECLARE
  old_account_id CONSTANT text := '00000001';
  new_account_id CONSTANT text := 'CLICKEEN';
  old_account_count integer;
  new_account_count integer;
  moved_users integer;
  moved_invitations integer;
  moved_instances integer;
BEGIN
  SELECT count(*) INTO old_account_count
  FROM public.accounts
  WHERE id = old_account_id;

  SELECT count(*) INTO new_account_count
  FROM public.accounts
  WHERE id = new_account_id;

  IF old_account_count <> 1 THEN
    RAISE EXCEPTION 'prd104a expected exactly one old admin account %, found %', old_account_id, old_account_count;
  END IF;

  IF new_account_count <> 0 THEN
    RAISE EXCEPTION 'prd104a target admin account % already exists', new_account_id;
  END IF;

  INSERT INTO public.accounts (
    id,
    status,
    status_changed_at,
    tier,
    created_at,
    selected_target_locales,
    locale_policy
  )
  SELECT
    new_account_id,
    status,
    status_changed_at,
    tier,
    created_at,
    selected_target_locales,
    locale_policy
  FROM public.accounts
  WHERE id = old_account_id;

  UPDATE public.users
  SET account_id = new_account_id
  WHERE account_id = old_account_id;
  GET DIAGNOSTICS moved_users = ROW_COUNT;

  UPDATE public.account_invitations
  SET account_id = new_account_id
  WHERE account_id = old_account_id;
  GET DIAGNOSTICS moved_invitations = ROW_COUNT;

  UPDATE public.instances
  SET account_id = new_account_id
  WHERE account_id = old_account_id;
  GET DIAGNOSTICS moved_instances = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM public.users WHERE account_id = old_account_id) THEN
    RAISE EXCEPTION 'prd104a users still reference %', old_account_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.account_invitations WHERE account_id = old_account_id) THEN
    RAISE EXCEPTION 'prd104a account_invitations still reference %', old_account_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.instances WHERE account_id = old_account_id) THEN
    RAISE EXCEPTION 'prd104a instances still reference %', old_account_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = new_account_id
      AND tier = 'tier3'
      AND jsonb_typeof(selected_target_locales) = 'array'
      AND jsonb_array_length(selected_target_locales) > 0
      AND jsonb_typeof(locale_policy) = 'object'
  ) THEN
    RAISE EXCEPTION 'prd104a migrated admin account % is missing tier or locale settings', new_account_id;
  END IF;

  IF moved_users = 0 THEN
    RAISE EXCEPTION 'prd104a migration moved zero users for %', old_account_id;
  END IF;

  IF moved_instances = 0 THEN
    RAISE EXCEPTION 'prd104a migration moved zero instances for %', old_account_id;
  END IF;

  DELETE FROM public.accounts
  WHERE id = old_account_id;

  IF EXISTS (SELECT 1 FROM public.accounts WHERE id = old_account_id) THEN
    RAISE EXCEPTION 'prd104a old account % still exists after delete', old_account_id;
  END IF;

  RAISE NOTICE 'prd104a migrated admin account % to %: users=%, invitations=%, instances=%',
    old_account_id,
    new_account_id,
    moved_users,
    moved_invitations,
    moved_instances;
END $$;

COMMIT;
