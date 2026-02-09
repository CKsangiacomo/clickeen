-- Seed deterministic internal workspace locales (ck-dev).
-- DevStudio runs against ck-dev (tier3) and should have all locales active by default.
-- This is intentionally explicit (no runtime fallbacks).
BEGIN;

UPDATE public.workspaces
SET l10n_locales = '[
  "es",
  "pt",
  "de",
  "fr",
  "it",
  "nl",
  "ja",
  "zh-hans",
  "zh-tw",
  "hi",
  "ko",
  "pl",
  "tr",
  "ar",
  "vi",
  "id",
  "th",
  "he",
  "uk",
  "cs",
  "ro",
  "hu",
  "sv",
  "da",
  "nb",
  "fi",
  "fil",
  "bn"
]'::jsonb
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND (l10n_locales IS NULL OR jsonb_array_length(l10n_locales) = 0);

COMMIT;
