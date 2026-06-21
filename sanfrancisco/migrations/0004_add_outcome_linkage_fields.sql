-- Migration number: 0004     2026-06-20T00:00:00.000Z

ALTER TABLE copilot_outcomes_v1 ADD COLUMN outcomeId TEXT;
ALTER TABLE copilot_outcomes_v1 ADD COLUMN surfaceId TEXT;
ALTER TABLE copilot_outcomes_v1 ADD COLUMN artifactId TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_v1_surface_artifact
  ON copilot_outcomes_v1(surfaceId, artifactId);

ALTER TABLE copilot_events_v1 ADD COLUMN surfaceId TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_surface
  ON copilot_events_v1(day, surfaceId);
