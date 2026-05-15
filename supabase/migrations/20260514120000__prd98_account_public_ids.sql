-- PRD 098A: account compact product/storage identity.
-- accounts.id remains the private relational UUID. accounts.public_id is the
-- fixed-width account segment used by overlay IDs and overlay-era storage keys.
BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS public_id CHAR(8);

CREATE OR REPLACE FUNCTION public.ck_prd98_random_base36(p_length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  bytes BYTEA;
  byte_value INTEGER;
  out TEXT := '';
  index INTEGER;
BEGIN
  IF p_length IS NULL OR p_length <= 0 THEN
    RAISE EXCEPTION 'p_length must be positive' USING ERRCODE = '22023';
  END IF;

  WHILE length(out) < p_length LOOP
    bytes := extensions.gen_random_bytes(greatest(16, (p_length - length(out)) * 2));
    FOR index IN 0..length(bytes) - 1 LOOP
      byte_value := get_byte(bytes, index);
      IF byte_value < 252 THEN
        out := out || substr(alphabet, (byte_value % 36) + 1, 1);
      END IF;
      IF length(out) = p_length THEN
        RETURN out;
      END IF;
    END LOOP;
  END LOOP;

  RETURN out;
END;
$$;

DO $$
DECLARE
  account_row RECORD;
  candidate TEXT;
BEGIN
  FOR account_row IN
    SELECT id
    FROM public.accounts
    WHERE public_id IS NULL OR public_id !~ '^[0-9A-Z]{8}$'
    ORDER BY id
  LOOP
    LOOP
      candidate := public.ck_prd98_random_base36(8);
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.accounts
        WHERE public_id = candidate::CHAR(8)
      );
    END LOOP;

    UPDATE public.accounts
    SET public_id = candidate::CHAR(8)
    WHERE id = account_row.id;
  END LOOP;
END $$;

DO $$ BEGIN
  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_public_id_format CHECK (public_id ~ '^[0-9A-Z]{8}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_public_id_unique
  ON public.accounts (public_id);

ALTER TABLE public.accounts
  ALTER COLUMN public_id SET NOT NULL;

DROP FUNCTION IF EXISTS public.ck_prd98_random_base36(INTEGER);

COMMENT ON COLUMN public.accounts.public_id IS
  'PRD 098 compact account product/storage identity; never derived from accounts.id.';

COMMIT;
