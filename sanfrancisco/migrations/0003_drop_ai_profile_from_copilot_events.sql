-- Migration number: 0003 	 2026-05-06T00:00:00.000Z

DROP TABLE IF EXISTS copilot_events_without_profile;

CREATE TABLE copilot_events_without_profile (
  requestId TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  occurredAtMs INTEGER NOT NULL,
  runtimeEnv TEXT,
  envStage TEXT,
  sessionId TEXT,
  instancePublicId TEXT,
  agentId TEXT NOT NULL,
  widgetType TEXT,
  intent TEXT,
  outcome TEXT,
  hasUrl INTEGER,
  controlCount INTEGER,
  opsCount INTEGER,
  uniquePathsTouched INTEGER,
  scopesTouched TEXT,
  ctaAction TEXT,
  promptId TEXT,
  policyId TEXT,
  dictionaryHash TEXT,
  taskClass TEXT,
  provider TEXT,
  model TEXT,
  latencyMs INTEGER
);

INSERT OR REPLACE INTO copilot_events_without_profile (
  requestId,
  day,
  occurredAtMs,
  runtimeEnv,
  envStage,
  sessionId,
  instancePublicId,
  agentId,
  widgetType,
  intent,
  outcome,
  hasUrl,
  controlCount,
  opsCount,
  uniquePathsTouched,
  scopesTouched,
  ctaAction,
  promptId,
  policyId,
  dictionaryHash,
  taskClass,
  provider,
  model,
  latencyMs
)
SELECT
  requestId,
  day,
  occurredAtMs,
  runtimeEnv,
  envStage,
  sessionId,
  instancePublicId,
  agentId,
  widgetType,
  intent,
  outcome,
  hasUrl,
  controlCount,
  opsCount,
  uniquePathsTouched,
  scopesTouched,
  ctaAction,
  promptId,
  policyId,
  dictionaryHash,
  taskClass,
  provider,
  model,
  latencyMs
FROM copilot_events;

DROP TABLE copilot_events;

ALTER TABLE copilot_events_without_profile
  RENAME TO copilot_events;

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_agent
  ON copilot_events(day, agentId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_stage
  ON copilot_events(day, envStage);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_widget
  ON copilot_events(day, widgetType);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_session
  ON copilot_events(day, sessionId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_intent_outcome
  ON copilot_events(day, intent, outcome);
