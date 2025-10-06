-- Phase-1: add missing columns per documentation/systems/michael.md
ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS idempotency_hash TEXT;

-- Ensure idempotency hash can dedupe when provided
DO $$ BEGIN
  CREATE UNIQUE INDEX events_idempotency_hash_key ON events(idempotency_hash) WHERE idempotency_hash IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN
  -- index exists
  NULL;
END $$;

