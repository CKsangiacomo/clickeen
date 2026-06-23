-- Migration number: 0004     2026-06-20T00:00:00.000Z

ALTER TABLE copilot_outcomes ADD COLUMN outcomeId TEXT;
ALTER TABLE copilot_outcomes ADD COLUMN surfaceId TEXT;
ALTER TABLE copilot_outcomes ADD COLUMN artifactId TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_surface_artifact
  ON copilot_outcomes(surfaceId, artifactId);

ALTER TABLE copilot_events ADD COLUMN surfaceId TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_surface
  ON copilot_events(day, surfaceId);
