-- Add partial unique index to enforce idempotency when a hash is provided
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_hash_key
  ON usage_events(idempotency_hash)
  WHERE idempotency_hash IS NOT NULL;

