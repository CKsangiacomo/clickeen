-- Enforce user-only public_id pattern for widget_instances (curated/baseline live elsewhere).
-- NOT VALID keeps existing curated rows until backfill cleanup, but blocks new non-user writes.
BEGIN;

ALTER TABLE public.widget_instances
  ADD CONSTRAINT widget_instances_user_public_id_only CHECK (
    public_id ~ '^wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*$'
  ) NOT VALID;

COMMIT;
