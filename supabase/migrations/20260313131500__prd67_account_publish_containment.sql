BEGIN;

CREATE TABLE IF NOT EXISTS public.account_publish_containment (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_account_publish_containment_updated_at ON public.account_publish_containment;
CREATE TRIGGER set_account_publish_containment_updated_at
  BEFORE UPDATE ON public.account_publish_containment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.account_publish_containment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_publish_containment_service_role_all ON public.account_publish_containment;
CREATE POLICY account_publish_containment_service_role_all ON public.account_publish_containment
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS account_publish_containment_select_members ON public.account_publish_containment;
CREATE POLICY account_publish_containment_select_members ON public.account_publish_containment
  FOR SELECT
  USING (public.is_account_member(account_id));

GRANT SELECT ON TABLE public.account_publish_containment TO authenticated;

COMMIT;
