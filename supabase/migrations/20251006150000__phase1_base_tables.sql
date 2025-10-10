-- CANONICAL BASE MIGRATION (Phase-1)
-- This file supersedes the historical shim 20251004100000__phase1_base_tables.sql.
-- Do not introduce new tables in the historical shim. New base-layer objects or
-- structural changes must be additive migrations referencing this canonical file.
-- Post Phase-1: plan to squash shim + canonical if migration history needs compaction.

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  kind TEXT DEFAULT 'business',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT DEFAULT 'owner',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Widgets
CREATE TABLE IF NOT EXISTS widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  public_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  config JSONB DEFAULT '{}',
  template_id TEXT,
  schema_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Widget instances
CREATE TABLE IF NOT EXISTS widget_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES widgets(id),
  public_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','inactive')),
  config JSONB NOT NULL DEFAULT '{}',
  template_id TEXT,
  schema_version TEXT,
  draft_token UUID,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Embed tokens
CREATE TABLE IF NOT EXISTS embed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_instance_id UUID NOT NULL REFERENCES widget_instances(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ
);

-- Widget submissions
-- DESIGN NOTE: widget_instance_id stores publicId (TEXT, e.g., "wgt_abc123") intentionally.
-- Rationale:
--   1. Cross-service compatibility (Venice SSR sends publicId, not internal UUID)
--   2. Survives instance deletion (submissions retained for audit/analytics)
--   3. No FK constraint to allow orphan submissions after instance cleanup
CREATE TABLE IF NOT EXISTS widget_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES widgets(id),
  widget_instance_id TEXT NOT NULL,  -- publicId (no FK by design)
  payload JSONB NOT NULL CHECK (pg_column_size(payload) <= 32768),
  payload_hash TEXT,
  ip TEXT,
  ua TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  ts_second TIMESTAMPTZ
);

-- Usage events
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  event_type TEXT DEFAULT 'widget_load',
  widget_instance_id TEXT,
  quantity INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  idempotency_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plan features / limits
CREATE TABLE IF NOT EXISTS plan_features (
  plan_id TEXT,
  feature_key TEXT,
  enabled BOOLEAN DEFAULT true,
  limit_value INTEGER,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS plan_limits (
  plan_id TEXT,
  limit_type TEXT,
  limit_value INTEGER NOT NULL,
  enforcement TEXT DEFAULT 'soft',
  grace_amount INTEGER DEFAULT 0,
  PRIMARY KEY (plan_id, limit_type)
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT NOT NULL,
  actor_id UUID,
  payload JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  idempotency_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_widget_instances_public_id ON widget_instances(public_id);
CREATE INDEX IF NOT EXISTS idx_widget_instances_status ON widget_instances(status);
CREATE INDEX IF NOT EXISTS idx_embed_tokens_active ON embed_tokens(token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_embed_tokens_expires_at ON embed_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_hash ON usage_events(idempotency_hash);

-- ts_second trigger for submissions (idempotent)
CREATE OR REPLACE FUNCTION set_ts_second() RETURNS TRIGGER AS $$
BEGIN
  NEW.ts_second = date_trunc('second', COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_submission_ts_second ON widget_submissions;
CREATE TRIGGER set_submission_ts_second
  BEFORE INSERT ON widget_submissions
  FOR EACH ROW EXECUTE FUNCTION set_ts_second();

-- Enable RLS where appropriate (errors ignored if already enabled)
DO $$ BEGIN ALTER TABLE widgets ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE widget_instances ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
