BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS selected_target_locales jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS locale_policy jsonb NOT NULL DEFAULT '{"v":1,"baseLocale":"en","ip":{"countryToLocale":{}}}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_selected_target_locales_is_array'
      AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_selected_target_locales_is_array
      CHECK (jsonb_typeof(selected_target_locales) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_locale_policy_is_object'
      AND conrelid = 'public.accounts'::regclass
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_locale_policy_is_object
      CHECK (jsonb_typeof(locale_policy) = 'object');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'l10n_locales'
  ) THEN
    UPDATE public.accounts
    SET selected_target_locales = COALESCE(l10n_locales, selected_target_locales)
    WHERE l10n_locales IS NOT NULL;

    ALTER TABLE public.accounts DROP COLUMN l10n_locales;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'l10n_policy'
  ) THEN
    UPDATE public.accounts
    SET locale_policy = COALESCE(l10n_policy, locale_policy)
    WHERE l10n_policy IS NOT NULL;

    ALTER TABLE public.accounts DROP COLUMN l10n_policy;
  END IF;
END $$;

UPDATE public.accounts
SET selected_target_locales = '[
  "es","pt","de","fr","it","nl","ja","zh-hans","zh-tw","hi","ko","pl","tr","ar",
  "vi","id","th","he","uk","cs","ro","hu","sv","da","nb","fi","fil","bn"
]'::jsonb
WHERE id = '00000001'
  AND tier = 'tier3'
  AND jsonb_array_length(selected_target_locales) = 0;

COMMIT;
