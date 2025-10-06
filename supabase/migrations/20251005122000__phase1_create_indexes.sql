-- Performance indexes per documentation/systems/michael.md
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_events_idempotency ON events(idempotency_hash);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_usage_events_idempotency ON usage_events(idempotency_hash);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_widget_submissions_ts ON widget_submissions(ts_second);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

