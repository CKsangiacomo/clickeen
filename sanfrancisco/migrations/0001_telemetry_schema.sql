-- Migration number: 0001 	 2026-04-28T12:19:06.891Z

CREATE TABLE IF NOT EXISTS copilot_events_v1 (
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
  promptVersion TEXT,
  policyVersion TEXT,
  dictionaryHash TEXT,
  aiProfile TEXT,
  taskClass TEXT,
  provider TEXT,
  model TEXT,
  latencyMs INTEGER
);

CREATE TABLE IF NOT EXISTS copilot_outcomes_v1 (
  requestId TEXT NOT NULL,
  event TEXT NOT NULL,
  day TEXT NOT NULL,
  occurredAtMs INTEGER NOT NULL,
  sessionId TEXT NOT NULL,
  timeToDecisionMs INTEGER,
  accountIdHash TEXT,
  PRIMARY KEY (requestId, event)
);

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_agent
  ON copilot_events_v1(day, agentId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_stage
  ON copilot_events_v1(day, envStage);

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_widget
  ON copilot_events_v1(day, widgetType);

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_session
  ON copilot_events_v1(day, sessionId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_v1_day_intent_outcome
  ON copilot_events_v1(day, intent, outcome);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_v1_day_event
  ON copilot_outcomes_v1(day, event);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_v1_request
  ON copilot_outcomes_v1(requestId);
