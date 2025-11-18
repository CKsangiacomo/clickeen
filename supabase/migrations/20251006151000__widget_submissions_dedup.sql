-- Deduplication index for submissions within time window and payload hash
-- Use a unique index to avoid duplicate rows during retry storms
DO $$ BEGIN
  CREATE UNIQUE INDEX widget_submissions_dedup_idx
    ON widget_submissions(widget_id, ts_second, payload_hash)
    WHERE payload_hash IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

