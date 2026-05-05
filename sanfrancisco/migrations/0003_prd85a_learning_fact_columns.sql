-- Migration number: 0003 	 2026-05-05T00:00:00.000Z

ALTER TABLE copilot_events_v1 ADD COLUMN touchedPaths TEXT;
ALTER TABLE copilot_events_v1 ADD COLUMN touchedControls TEXT;
ALTER TABLE copilot_events_v1 ADD COLUMN invalidReason TEXT;
ALTER TABLE copilot_events_v1 ADD COLUMN validationResult TEXT;
ALTER TABLE copilot_events_v1 ADD COLUMN promptTokens INTEGER;
ALTER TABLE copilot_events_v1 ADD COLUMN completionTokens INTEGER;
ALTER TABLE copilot_events_v1 ADD COLUMN costUsd REAL;
ALTER TABLE copilot_events_v1 ADD COLUMN subjectHash TEXT;
ALTER TABLE copilot_events_v1 ADD COLUMN learningCapture TEXT;

ALTER TABLE copilot_outcomes_v1 ADD COLUMN metadataJson TEXT;

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_learning
  ON copilot_events_v1(day, learningCapture);
