-- Person-scoped UI-language preference. Berlin remains the only product route
-- that reads or writes public.users; the preference is dormant until Roma
-- exposes the approved setting and UI-locale behavior.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN use_primary_language_for_ui boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.use_primary_language_for_ui IS
  'When true, product UI may use the user primary_language; false keeps English UI.';

COMMIT;
