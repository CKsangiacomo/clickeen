-- PRD 057 Phase 0/2 unblock:
-- 1) Remove recursive account_members policy pattern.
-- 2) Enable authenticated flat reads for Category A tables via RLS + explicit grants.
BEGIN;

-- Helper predicates (SECURITY DEFINER) so policies can reference account membership
-- without self-recursive policy evaluation on account_members.
CREATE OR REPLACE FUNCTION public.is_account_member(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = target_account_id
      AND am.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_editor(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = target_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(target_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = target_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_account_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_account_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_account_admin(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_account_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_account_editor(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_account_admin(uuid) TO service_role;

-- Accounts: add member-read policy (service role all policy already exists).
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_select_members ON public.accounts;
CREATE POLICY accounts_select_members ON public.accounts
  FOR SELECT
  USING (public.is_account_member(id));

-- Account members: replace recursive self-query policies with helper predicates.
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_members_select_members ON public.account_members;
CREATE POLICY account_members_select_members ON public.account_members
  FOR SELECT
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS account_members_manage_admin ON public.account_members;
CREATE POLICY account_members_manage_admin ON public.account_members
  FOR ALL
  USING (public.is_account_admin(account_id))
  WITH CHECK (public.is_account_admin(account_id));

-- Widget instances: keep same semantics but route through helper predicates.
ALTER TABLE public.widget_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS widget_instances_select_members ON public.widget_instances;
CREATE POLICY widget_instances_select_members ON public.widget_instances
  FOR SELECT
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS widget_instances_write_editors ON public.widget_instances;
CREATE POLICY widget_instances_write_editors ON public.widget_instances
  FOR ALL
  USING (public.is_account_editor(account_id))
  WITH CHECK (public.is_account_editor(account_id));

-- Flat-read path requires explicit table privileges for authenticated role.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.accounts TO authenticated;
GRANT SELECT ON TABLE public.account_members TO authenticated;
GRANT SELECT ON TABLE public.widget_instances TO authenticated;

COMMIT;
