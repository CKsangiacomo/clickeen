-- Migration number: 0005 	 2026-06-23T13:50:00.000Z

CREATE TABLE IF NOT EXISTS copilot_events (
  requestId TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  occurredAtMs INTEGER NOT NULL,
  runtimeEnv TEXT,
  envStage TEXT,
  surfaceId TEXT,
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
  aiProfile TEXT,
  taskClass TEXT,
  provider TEXT,
  model TEXT,
  latencyMs INTEGER
);

CREATE TABLE IF NOT EXISTS copilot_outcomes (
  requestId TEXT NOT NULL,
  outcomeId TEXT,
  event TEXT NOT NULL,
  day TEXT NOT NULL,
  occurredAtMs INTEGER NOT NULL,
  sessionId TEXT NOT NULL,
  timeToDecisionMs INTEGER,
  accountIdHash TEXT,
  surfaceId TEXT,
  artifactId TEXT,
  PRIMARY KEY (requestId, event)
);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_agent
  ON copilot_events(day, agentId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_surface
  ON copilot_events(day, surfaceId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_stage
  ON copilot_events(day, envStage);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_widget
  ON copilot_events(day, widgetType);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_session
  ON copilot_events(day, sessionId);

CREATE INDEX IF NOT EXISTS idx_copilot_events_day_intent_outcome
  ON copilot_events(day, intent, outcome);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_day_event
  ON copilot_outcomes(day, event);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_request
  ON copilot_outcomes(requestId);

CREATE INDEX IF NOT EXISTS idx_copilot_outcomes_surface_artifact
  ON copilot_outcomes(surfaceId, artifactId);
