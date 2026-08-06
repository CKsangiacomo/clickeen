BEGIN;

DO $$
DECLARE
  matched integer;
BEGIN
  SELECT count(*) INTO matched
  FROM public.accounts
  WHERE id = 'CLICKEEN';

  IF matched <> 1 THEN
    RAISE EXCEPTION 'expected exactly one CLICKEEN account, found %', matched;
  END IF;

  UPDATE public.accounts
  SET tier = 'tier99'::public.account_tier
  WHERE id = 'CLICKEEN';

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = 'CLICKEEN' AND tier = 'tier99'
  ) THEN
    RAISE EXCEPTION 'CLICKEEN tier99 assignment failed';
  END IF;
END $$;

COMMIT;
