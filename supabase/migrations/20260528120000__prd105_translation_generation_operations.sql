BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instances_account_id_id_unique'
      AND conrelid = 'public.instances'::regclass
  ) THEN
    ALTER TABLE public.instances
      ADD CONSTRAINT instances_account_id_id_unique UNIQUE (account_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.translation_generation_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_public_id text NOT NULL,
  instance_id text NOT NULL,
  base_locale text NOT NULL CHECK (base_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  target_locales jsonb NOT NULL CHECK (jsonb_typeof(target_locales) = 'array'),
  base_content_marker text NOT NULL CHECK (base_content_marker ~ '^sha256:v[0-9]+:[a-f0-9]{64}$'),
  generation_request_marker text NOT NULL CHECK (generation_request_marker ~ '^sha256:v[0-9]+:[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'timed_out')),
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  reason_key text NULL,
  detail text NULL,
  CONSTRAINT translation_generation_operations_instance_fk
    FOREIGN KEY (account_public_id, instance_id)
    REFERENCES public.instances(account_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS translation_generation_operations_one_active_idx
  ON public.translation_generation_operations (account_public_id, instance_id)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS translation_generation_operations_instance_updated_idx
  ON public.translation_generation_operations (account_public_id, instance_id, updated_at DESC, id);

CREATE INDEX IF NOT EXISTS translation_generation_operations_status_expires_idx
  ON public.translation_generation_operations (status, expires_at, id)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS public.translation_generation_operation_locales (
  operation_id uuid NOT NULL REFERENCES public.translation_generation_operations(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'stale')),
  enqueue_status text NOT NULL CHECK (enqueue_status IN ('pending', 'sent', 'failed')),
  job_id text NULL,
  base_content_marker text NOT NULL CHECK (base_content_marker ~ '^sha256:v[0-9]+:[a-f0-9]{64}$'),
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  reason_key text NULL,
  detail text NULL,
  PRIMARY KEY (operation_id, locale)
);

CREATE INDEX IF NOT EXISTS translation_generation_operation_locales_status_idx
  ON public.translation_generation_operation_locales (operation_id, status, locale);

CREATE INDEX IF NOT EXISTS translation_generation_operation_locales_enqueue_idx
  ON public.translation_generation_operation_locales (enqueue_status, operation_id, locale)
  WHERE enqueue_status IN ('pending', 'failed');

ALTER TABLE public.translation_generation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_generation_operation_locales ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'translation_generation_operations'
      AND policyname = 'translation_generation_operations_service_role_all'
  ) THEN
    CREATE POLICY translation_generation_operations_service_role_all
      ON public.translation_generation_operations
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'translation_generation_operation_locales'
      AND policyname = 'translation_generation_operation_locales_service_role_all'
  ) THEN
    CREATE POLICY translation_generation_operation_locales_service_role_all
      ON public.translation_generation_operation_locales
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON public.translation_generation_operations FROM anon, authenticated;
REVOKE ALL ON public.translation_generation_operation_locales FROM anon, authenticated;

GRANT ALL ON public.translation_generation_operations TO service_role;
GRANT ALL ON public.translation_generation_operation_locales TO service_role;

COMMIT;
