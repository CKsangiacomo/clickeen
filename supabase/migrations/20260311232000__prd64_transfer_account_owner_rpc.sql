-- PRD 064 Phase 5b: atomic owner transfer invariant.
BEGIN;

CREATE OR REPLACE FUNCTION public.transfer_account_owner(
  p_account_id UUID,
  p_current_owner_user_id UUID,
  p_next_owner_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_account_id IS NULL OR p_current_owner_user_id IS NULL OR p_next_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'transfer_account_owner requires non-null args';
  END IF;

  IF p_current_owner_user_id = p_next_owner_user_id THEN
    RAISE EXCEPTION 'next owner must differ from current owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_members
    WHERE account_id = p_account_id
      AND user_id = p_current_owner_user_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'current owner membership missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.account_members
    WHERE account_id = p_account_id
      AND user_id = p_next_owner_user_id
      AND role IN ('viewer', 'editor', 'admin')
  ) THEN
    RAISE EXCEPTION 'next owner membership missing';
  END IF;

  UPDATE public.account_members
  SET role = CASE
    WHEN user_id = p_current_owner_user_id THEN 'admin'
    WHEN user_id = p_next_owner_user_id THEN 'owner'
    ELSE role
  END
  WHERE account_id = p_account_id
    AND user_id IN (p_current_owner_user_id, p_next_owner_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_account_owner(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_account_owner(UUID, UUID, UUID) TO service_role;

COMMIT;
