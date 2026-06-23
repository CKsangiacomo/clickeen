-- Migration number: 0002 	 2026-04-28T12:19:06.891Z

DROP TABLE IF EXISTS copilot_outcomes_without_workspace;

CREATE TABLE copilot_outcomes_without_workspace (
  requestId TEXT NOT NULL,
  event TEXT NOT NULL,
  day TEXT NOT NULL,
  occurredAtMs INTEGER NOT NULL,
  sessionId TEXT NOT NULL,
  timeToDecisionMs INTEGER,
  accountIdHash TEXT,
  PRIMARY KEY (requestId, event)
);

INSERT OR REPLACE INTO copilot_outcomes_without_workspace (
  requestId,
  event,
  day,
  occurredAtMs,
  sessionId,
  timeToDecisionMs,
  accountIdHash
)
SELECT
  requestId,
  event,
  day,
  occurredAtMs,
  sessionId,
  timeToDecisionMs,
  accountIdHash
FROM copilot_outcomes;

DROP TABLE copilot_outcomes;

ALTER TABLE copilot_outcomes_without_workspace
  RENAME TO copilot_outcomes;

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_day_event
  ON copilot_outcomes(day, event);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_request
  ON copilot_outcomes(requestId);
