```markdown
STATUS: NORMATIVE – SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It must not conflict with:
1) supabase/migrations/ (DB schema truth) and
2) documentation/CONTEXT.md (Global terms and precedence).
If any conflict is found, STOP and escalate to CEO. Do not guess.

# Michael – Data Plane (Phase-1)

## AIs Quick Scan

**Purpose:** Supabase Postgres layer enforcing workspace isolation.  
**Owner:** Supabase project `ebmqwqdexmemhrdhkmwn`.  
**Dependencies:** Paris (service role access), Venice (read-only via Paris), Geneva (schemas).  
**Phase-1 Tables:** `widget_instances`, `widgets`, `embed_tokens`, `plan_features`, `plan_limits`, `widget_submissions`, `usage_events`, `events`.  
**Common mistakes:** Exposing internal UUIDs, letting clients write to protected tables, ignoring `23505` unique-violation handling.

## Purpose
Michael is Clickeen's PostgreSQL database layer hosted on Supabase, providing the authoritative data store with Row Level Security (RLS) enforcement, real-time subscriptions, and schema migrations. It serves as the single source of truth for all persistent data and enforces workspace-level isolation through RLS policies.

## Deployment & Runtime
- **Platform**: Supabase (Postgres 15)
- **Project**: `ebmqwqdexmemhrdhkmwn`
- **Region**: us-east-1 (primary)
- **Connection Pool**: PgBouncer (transaction mode)
- **URL Pattern**: `https://ebmqwqdexmemhrdhkmwn.supabase.co`

### API ↔ DB Identifier Mapping (NORMATIVE)
| API Field | DB Column/Source | Notes |
| --- | --- | --- |
| `publicId` | `widget_instances.public_id` | Stable identifier exposed via APIs |
| `widgetInstanceId` | `widget_instances.id` | Internal UUID; **never** exposed via API |
| `widgetId` | `widgets.id` | Links instances to parent widget |
| `draftToken` | `widget_instances.draft_token` | UUID issued on instance create; invalidated on claim |
| `workspaceId` | `workspaces.id` | Provided via auth context; used for RLS |
| `templateId` | `widget_instances.template_id` | Mirrors `templates.id` data-only identifiers |
| `schemaVersion` | `widget_instances.schema_version` | Validated against Geneva schemas |
| `embedToken` | `embed_tokens.token` | Returned only via Paris `/api/token` issue flow |
| `submissionId` | `widget_submissions.id` | Returned when viewing submissions in Bob |
| `widgetInstancePublicId` (submissions/events) | `widget_submissions.widget_instance_id` (TEXT) | Stores the **publicId** to avoid exposing internal UUIDs |
| `usageIdempotencyKey` | `usage_events.idempotency_hash` | Required for `/api/usage` deduplication |

> `widget_instances.id` must remain server-internal. All public surfaces use `publicId` and related aliases.

> `widget_submissions.widget_instance_id` intentionally stores the textual `publicId` for cross-service compatibility.

## Access Patterns
- **Anon Key**: Public operations (embed token validation only)
- **Service Role**: Paris-only (bypasses RLS for admin operations)
- **Authenticated**: Bob (builder app) via Supabase Auth JWT
- **Direct SQL**: Migrations and maintenance only (never runtime)

## Core Tables (Phase-1)

### widget_instances
**Purpose**: Stores widget configuration and state
**RLS**: Enabled - workspace members only
**Columns**:
```sql
id              UUID DEFAULT gen_random_uuid() PRIMARY KEY
widget_id       UUID NOT NULL REFERENCES widgets(id)
public_id       TEXT UNIQUE NOT NULL -- maps to API publicId
status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','inactive'))
config          JSONB DEFAULT '{}' NOT NULL
template_id     TEXT -- added per Phase-1 specs
schema_version  TEXT -- added per Phase-1 specs
draft_token     UUID -- temporary until claim
claimed_at      TIMESTAMPTZ
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**Indexes**:
```sql
CREATE INDEX idx_widget_instances_public_id ON widget_instances(public_id);
CREATE INDEX idx_widget_instances_status ON widget_instances(status);
CREATE INDEX idx_widget_instances_draft_token ON widget_instances(draft_token);
CREATE INDEX idx_widget_instances_widget_id ON widget_instances(widget_id);
```

**Constraint → API behavior (NORMATIVE)**
- Duplicate `public_id` raises Postgres `23505` → Paris returns **409 ALREADY_EXISTS** on `/api/instance`.
- `status` outside `draft|published|inactive` raises `23514` → Paris returns **422 CONFIG_INVALID**.
- Missing records return API 404 `NOT_FOUND` prior to database mutation when applicable.

**RLS Policies**:
```sql
-- Members can read their workspace's instances
CREATE POLICY "instances_select_workspace" ON widget_instances
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM widgets w
    JOIN workspace_members m ON m.workspace_id = w.workspace_id
    WHERE w.id = widget_instances.widget_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  )
);

-- Similar policies for INSERT, UPDATE, DELETE
```

### widgets
**Purpose**: Widget registry per workspace
**RLS**: Enabled - workspace isolation
**Columns**:
```sql
id              UUID DEFAULT gen_random_uuid() PRIMARY KEY
workspace_id    UUID NOT NULL REFERENCES workspaces(id)
name            TEXT NOT NULL
type            TEXT NOT NULL -- widget type identifier
public_key      TEXT UNIQUE NOT NULL
status          TEXT DEFAULT 'active'
config          JSONB DEFAULT '{}' -- default config
template_id     TEXT -- default template
schema_version  TEXT -- current schema version
created_at      TIMESTAMPTZ DEFAULT now()
```

### embed_tokens
**Purpose**: Long-lived embed tokens for instances
**RLS**: Enabled - service role writes, authenticated reads
**Columns**:
```sql
id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY
widget_instance_id   UUID NOT NULL REFERENCES widget_instances(id)
token               TEXT UNIQUE NOT NULL
expires_at          TIMESTAMPTZ NOT NULL
created_at          TIMESTAMPTZ DEFAULT now()
created_by          UUID REFERENCES auth.users(id)
revoked_at          TIMESTAMPTZ
```

**Token Generation**:
```sql
-- Generate cryptographically secure token
'cket_' || encode(gen_random_bytes(16), 'hex')
```

### workspaces
**Purpose**: Tenant isolation and plan management
**RLS**: Enabled - member access only
**Columns**:
```sql
id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY
name                  TEXT NOT NULL
plan                  TEXT DEFAULT 'free' CHECK (plan IN ('free','paid'))
created_at            TIMESTAMPTZ DEFAULT now()
kind                  TEXT DEFAULT 'business' CHECK (kind IN ('agency','business'))
parent_workspace_id   UUID REFERENCES workspaces(id) -- for future agency model
```

### workspace_members
**Purpose**: Authorization and role management
**RLS**: Enabled - complex role-based policies
**Columns**:
```sql
id           UUID DEFAULT gen_random_uuid() PRIMARY KEY
workspace_id UUID NOT NULL REFERENCES workspaces(id)
user_id      UUID NOT NULL REFERENCES auth.users(id)
role         TEXT DEFAULT 'owner' CHECK (role IN ('owner','admin','super_editor','editor','collaborator','viewer'))
status       TEXT DEFAULT 'active' CHECK (status IN ('active','invited','suspended'))
created_at   TIMESTAMPTZ DEFAULT now()
invited_by   UUID REFERENCES auth.users(id)
invited_at   TIMESTAMPTZ
accepted_at  TIMESTAMPTZ

UNIQUE(workspace_id, user_id)
```

### plan_features & plan_limits
**Purpose**: Entitlement configuration
**RLS**: Enabled - public read, service-role write
**plan_features**:
```sql
plan_id      TEXT
feature_key  TEXT  
enabled      BOOLEAN DEFAULT true
limit_value  INTEGER
metadata     JSONB DEFAULT '{}'
updated_at   TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (plan_id, feature_key)
```

**plan_limits**:
```sql
plan_id      TEXT
limit_type   TEXT
limit_value  INTEGER NOT NULL
enforcement  TEXT DEFAULT 'soft' CHECK (enforcement IN ('soft','hard'))
grace_amount INTEGER DEFAULT 0
PRIMARY KEY (plan_id, limit_type)
```

### widget_submissions
**Purpose**: Form submission storage
**RLS**: Enabled - workspace access
**Columns**:
```sql
id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY
widget_id          UUID NOT NULL REFERENCES widgets(id)
widget_instance_id TEXT -- public_id reference
payload           JSONB NOT NULL CHECK (pg_column_size(payload) <= 32768)
payload_hash      TEXT -- deduplication
ip                TEXT
ua                TEXT -- user agent
created_at        TIMESTAMPTZ DEFAULT now()
ts_second         TIMESTAMPTZ -- rate limit window

-- Anonymous submissions auto-deleted after 30 days via cron
```

Privacy (Phase‑1):
- The `ip` column stores a salted SHA‑256 hash of the client IP using `RATE_LIMIT_IP_SALT` (or `'v1'` when unset). Raw IPs are not persisted. SQL fallback rate limiting queries the hashed value; Redis keys also use the hash.

**Constraint → API behavior (NORMATIVE)**
- Payloads exceeding 32KB trigger Postgres `23514`; Paris returns **422 CONFIG_INVALID**.
- Duplicate `payload_hash` within the active rate-window yields acceptance without insert → Paris returns **202 { "recorded": false }**.
- Anonymous rows older than 30 days are removed by scheduled maintenance jobs (no client action required).
- The `form_submissions` view exposed to analytics surfaces returns published submissions only; draft/inactive submissions are still queryable from `widget_submissions` or via `insert_form_submission()` when a valid token is presented.

**Claim flow side-effect (non-normative SQL example)**
```sql
-- On successful claim (Paris /api/claim)
UPDATE widget_instances
SET draft_token = NULL,
    claimed_at = now()
WHERE draft_token = $1
RETURNING *;
```

### usage_events
**Purpose**: Analytics and usage tracking
**RLS**: Enabled - workspace scoped
**Columns**:
```sql
id               UUID DEFAULT gen_random_uuid() PRIMARY KEY
workspace_id     UUID REFERENCES workspaces(id)
event_type       TEXT DEFAULT 'widget_load'
widget_instance_id  TEXT -- public_id
quantity         INTEGER DEFAULT 1
metadata         JSONB DEFAULT '{}'
idempotency_hash TEXT UNIQUE -- deduplication key
created_at       TIMESTAMPTZ DEFAULT now()
```

**Constraint → API behavior (NORMATIVE)**
- Missing `idempotency_hash` triggers **422 CONFIG_INVALID** on `/api/usage`.
- Duplicate `idempotency_hash` raises `23505` → Paris returns **202 { "recorded": false }**.
- `quantity` must remain positive; negative values are rejected with **422 CONFIG_INVALID**.

### events (audit log)
**Purpose**: Attribution and audit trail
**RLS**: Enabled - workspace members only
**Columns**:
```sql
id              UUID DEFAULT gen_random_uuid() PRIMARY KEY
workspace_id    UUID NOT NULL REFERENCES workspaces(id)
entity_type     TEXT
entity_id       UUID
event_type      TEXT NOT NULL -- 'user_attribution' for viral tracking
actor_id        UUID REFERENCES auth.users(id)
payload         JSONB DEFAULT '{}'
metadata        JSONB DEFAULT '{}'
idempotency_hash TEXT UNIQUE -- added per Phase-1
created_at      TIMESTAMPTZ DEFAULT now()
```
**Constraint → API behavior (NORMATIVE)**
- `idempotency_hash` is honored for `event_type = 'user_attribution'`; duplicates return **202 { "recorded": false }**.
- Foreign key violations (e.g., orphaned `workspace_id`) raise `23503` → surfaced as **500 DB_ERROR** via Paris.

## RLS Policy Patterns

### Standard Workspace Isolation
```sql
-- Template for workspace-scoped tables
CREATE POLICY "{table}_workspace_select" ON {table}
FOR SELECT TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND status = 'active'
  )
);
```

### Owner-Only Operations
```sql
-- Template for destructive operations
CREATE POLICY "{table}_owner_delete" ON {table}
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = {table}.workspace_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);
```

### Service-Role Boundaries
```sql
-- Plan features: public read, service write
CREATE POLICY "plan_features_public_read" ON plan_features
FOR SELECT TO anon, authenticated
USING (true);

-- No policies for INSERT/UPDATE/DELETE (service-role only)
```

## Helper Functions

### is_workspace_owner
```sql
CREATE OR REPLACE FUNCTION is_workspace_owner(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = check_workspace_id
    AND user_id = auth.uid()
    AND role = 'owner'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### is_workspace_member
```sql
CREATE OR REPLACE FUNCTION is_workspace_member(check_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = check_workspace_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### get_user_workspace_ids
```sql
CREATE OR REPLACE FUNCTION get_user_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id 
  FROM workspace_members
  WHERE user_id = auth.uid()
  AND status = 'active';
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

## Database Triggers

### Updated At Timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_{table}_updated_at
BEFORE UPDATE ON {table}
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at();
```

### Submission Rate Window
```sql
CREATE OR REPLACE FUNCTION set_ts_second()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ts_second = date_trunc('second', NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_submission_ts_second
BEFORE INSERT ON widget_submissions
FOR EACH ROW
EXECUTE FUNCTION set_ts_second();
```

## Migration Strategy

> **AI implementation note:** The Supabase CLI only executes SQL files stored under `supabase/migrations/`. Draft migrations may live in `michael/sql-drafts/` during review, but **nothing runs** until you copy the approved SQL into a timestamped file inside `supabase/migrations/`. The CLI applies files in lexical order and records the applied state under `supabase/.branches`.

**Canonical workflow for AIs & humans:**
1. Prototype the migration in `michael/sql-drafts/<yyyymmdd_slug>.sql` and write the paired change request in `michael/db-change-requests/`.
2. After approval, duplicate the exact SQL into `supabase/migrations/<YYYYMMDDHHMMSS>__<slug>.sql` (keep snake_case, no spaces).
3. From repo root with Docker Desktop running:
   ```bash
   supabase start            # if local stack isn’t already running
   supabase migration up     # applies new files from supabase/migrations locally
   supabase db push          # replays the same migrations on the hosted project
   supabase stop             # optional once verification passes
   ```
4. Review the dump diff, update ADRdecisions.md/PRDs if required, and include the migration ID in commit notes.

### Phase-1 Required Migrations
```sql
-- 001_add_missing_columns.sql
ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE widget_instances ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS schema_version TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS idempotency_hash TEXT UNIQUE;

-- 002_enable_rls.sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

-- 003_create_indexes.sql
CREATE INDEX IF NOT EXISTS idx_events_idempotency ON events(idempotency_hash);
CREATE INDEX IF NOT EXISTS idx_usage_events_idempotency ON usage_events(idempotency_hash);
CREATE INDEX IF NOT EXISTS idx_widget_submissions_ts ON widget_submissions(ts_second);

-- 004_create_template_tables.sql
CREATE TABLE IF NOT EXISTS widget_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_type TEXT NOT NULL,
  template_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  layout TEXT CHECK (layout IN ('LIST','GRID','CAROUSEL','CARD','ACCORDION','MARQUEE','STACKED','INLINE')),
  skin TEXT CHECK (skin IN ('MINIMAL','SOFT','SHARP','GLASS')),
  density TEXT CHECK (density IN ('COZY','COMPACT')),
  accents TEXT[],
  premium BOOLEAN DEFAULT false,
  schema_version TEXT NOT NULL,
  defaults JSONB DEFAULT '{}',
  descriptor JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS widget_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  schema JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(widget_type, schema_version)
);
```

### Migration Execution Order
1. Add missing columns (non-breaking)
2. Enable RLS on unprotected tables
3. Create performance indexes
4. Add template/schema tables
5. Deploy RLS policies
6. Add helper functions
7. Create triggers
8. Verify with health checks

## Performance Optimization

### Critical Indexes
```sql
-- Widget lookups (Venice high frequency)
CREATE INDEX idx_widget_instances_public_status 
ON widget_instances(public_id, status) 
WHERE status = 'published';

-- Token validation (Venice auth)
CREATE INDEX idx_embed_tokens_token_active
ON embed_tokens(token)
WHERE revoked_at IS NULL AND expires_at > now();

-- Workspace member checks (all operations)
CREATE INDEX idx_workspace_members_user_active
ON workspace_members(user_id, workspace_id)
WHERE status = 'active';

-- Usage deduplication
CREATE INDEX idx_usage_events_hash
ON usage_events(idempotency_hash);
```

### Canonical SQL Queries (NORMATIVE — MUST USE EXACTLY)
```sql
-- Venice SSR instance fetch (public GET /e/:publicId)
SELECT wi.public_id,
       wi.status,
       wi.config,
       wi.schema_version,
       wi.updated_at,
       w.workspace_id,
       w.type AS widget_type
FROM widget_instances wi
JOIN widgets w ON w.id = wi.widget_id
WHERE wi.public_id = $1;
```

```sql
-- Free plan enforcement (Paris publish -> 403 PLAN_LIMIT when count >= limit)
SELECT COUNT(*)
FROM widget_instances wi
JOIN widgets w ON w.id = wi.widget_id
WHERE w.workspace_id = $1
  AND wi.status = 'published';
```

```sql
-- Embed token validation (Paris /api/token?action=list|revoke)
SELECT et.id,
       et.expires_at,
       wi.public_id,
       w.workspace_id
FROM embed_tokens et
JOIN widget_instances wi ON wi.id = et.widget_instance_id
JOIN widgets w ON w.id = wi.widget_id
WHERE et.token = $1
  AND et.revoked_at IS NULL
  AND et.expires_at > now();
```

```sql
-- Submission rate limit (per instance + IP)
SELECT COUNT(*)
FROM widget_submissions
WHERE widget_instance_id = $1
  AND ip = $2
  AND created_at >= now() - interval '1 minute';
```

```sql
-- Submission rate limit (per instance overall)
SELECT COUNT(*)
FROM widget_submissions
WHERE widget_instance_id = $1
  AND created_at >= now() - interval '1 minute';
```

```sql
-- Pixel event rate limit (Venice /embed/pixel -> Paris /api/usage)
SELECT COUNT(*)
FROM usage_events
WHERE widget_instance_id = $1
  AND event_type = $2 -- e.g. 'widget_load'
  AND created_at >= now() - interval '1 minute'
  AND metadata->>'ip' = $3;
```

> Any optimization MUST reuse these canonical queries. Deviations require explicit CEO approval.

## Monitoring & Maintenance

### Health Checks
```sql
-- Connection test
SELECT 1;

-- RLS verification
SELECT count(*) FROM widget_instances; -- Should return user's instances only

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0; -- Unused indexes
```

### Scheduled Jobs (via pg_cron)
```sql
-- Delete anonymous submissions after 30 days
SELECT cron.schedule(
  'delete-old-submissions',
  '0 2 * * *', -- 2 AM daily
  $$DELETE FROM widget_submissions 
    WHERE created_at < now() - interval '30 days'
    AND widget_id IS NULL$$
);

-- Vacuum analyze for performance
SELECT cron.schedule(
  'vacuum-analyze',
  '0 3 * * 0', -- 3 AM Sunday
  'VACUUM ANALYZE;'
);
```

### Backup Strategy
- **Frequency**: Daily automated backups (Supabase managed)
- **Retention**: 30 days point-in-time recovery
- **Testing**: Monthly restore verification
- **Export**: Weekly logical dumps for compliance

## Security Requirements

### Database Error Mapping (NORMATIVE)
| Postgres error | Typical cause | API mapping |
| --- | --- | --- |
| `23505` unique_violation | Duplicate key (e.g., `widget_instances.public_id`) | Paris returns **409 ALREADY_EXISTS**. For `usage_events`/`events` dedupe it returns **202 {"recorded": false }**.
| `23514` check_violation | CHECK constraint failed (status, payload size, quantity) | Paris returns **422 CONFIG_INVALID**.
| `23503` foreign_key_violation | Orphan references (deleted workspace/widget) | Paris returns **500 DB_ERROR**.
| `22001` / `22003` length or numeric overflow | Oversized metadata values | Paris returns **422 CONFIG_INVALID**.

### Connection Security
- SSL required for all connections
- Connection pooling via PgBouncer (transaction mode)
- IP allowlist for production access
- Service role key rotation quarterly

### Data Protection
- PII fields encrypted at rest (Supabase transparent encryption)
- No sensitive data in JSONB searchable fields
- Audit log for all mutations (events table)
- GDPR-compliant deletion procedures

### Access Control Matrix
| Role | widgets | instances | submissions | entitlements |
|------|---------|-----------|-------------|--------------|
| Anon | ❌ | ❌ | ❌ | Read |
| Authenticated | Workspace | Workspace | Workspace | Read |
| Service Role | All | All | All | All |

## Development Guidelines

### Local Development
```bash
# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Seed test data
supabase db seed

# Test RLS policies
supabase test db
```

### SQL Best Practices
```sql
-- Always use parameterized queries
SELECT * FROM widgets WHERE id = $1; -- Good
SELECT * FROM widgets WHERE id = '${id}'; -- Bad (SQL injection)

-- Use RETURNING for insert/update
INSERT INTO widget_instances (public_id, config)
VALUES ($1, $2)
RETURNING *;

-- Explicit column selection
SELECT id, public_id, config FROM widget_instances; -- Good
SELECT * FROM widget_instances; -- Bad (schema changes break code)
```

### Testing Requirements
- RLS policy tests for each table
- Performance benchmarks for critical queries
- Migration rollback verification
- Backup restore testing
- Connection pool exhaustion testing

#### RLS Test Cases (NORMATIVE)
```sql
-- Authenticated user (workspace_a) cannot see workspace_b rows
SET LOCAL ROLE authenticated;
SET LOCAL jwt.claims = '{"sub":"user-a","role":"authenticated","workspace_id":"workspace_a"}';
SELECT COUNT(*)
FROM widget_instances wi
JOIN widgets w ON w.id = wi.widget_id
WHERE w.workspace_id = 'workspace_b';
-- Expected: 0
```

```sql
-- Service role sees all rows (admin operations)
SET LOCAL ROLE service_role;
SELECT COUNT(*) FROM widget_instances;
-- Expected: >= total instances
```

```sql
-- Anon role limited to public tables (plan_features ok, instances blocked)
SET LOCAL ROLE anon;
SELECT COUNT(*) FROM plan_features; -- Expected: >= 0 (allowed)
SELECT COUNT(*) FROM widget_instances; -- Expected: ERROR: permission denied for table widget_instances
```

> Run the Supabase CLI (`supabase db remote commit --test`) manually during development to exercise these policies.

## Common AI Mistakes (NORMATIVE)

❌ **Wrong:** Returning internal `widget_instances.id` to clients
```typescript
const instance = await db.query('SELECT id, config FROM widget_instances WHERE id = $1', [id]);
return { publicId: instance.id, config: instance.config }; // WRONG
```
✅ **Right:** Use `public_id` for all external responses
```typescript
const instance = await db.query('SELECT public_id, config FROM widget_instances WHERE public_id = $1', [publicId]);
return { publicId: instance.public_id, config: instance.config }; // CORRECT
```

❌ **Wrong:** Clients insert directly into `usage_events`
```typescript
await supabase.from('usage_events').insert({ widget_instance_id: publicId, event_type: 'widget_load' });
```
✅ **Right:** Only Paris service-role writes usage via `/api/usage`
```typescript
await fetch('https://c-keen-api.vercel.app/api/usage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ publicId, event: 'load', idempotencyKey })
});
```

❌ **Wrong:** Ignoring Postgres `23505` errors from dedupe tables
```typescript
await insertUsageEvent(...); // throws unique_violation
```
✅ **Right:** Catch `23505` and map to API semantics
```typescript
try {
  await insertUsageEvent(...);
  return { recorded: true };
} catch (err) {
  if (isPgError(err, '23505')) return { recorded: false };
  throw err;
}
```

## Future Considerations (Post-Phase-1)

### Scalability Enhancements
- Read replicas for analytics queries
- Partitioning for widget_submissions by month
- Materialized views for dashboard aggregates
- Connection pooling optimization

### Schema Evolution
- Widget version history tracking
- Soft deletes with deleted_at timestamps
- Multi-tenant sharding preparation
- Time-series data optimization

This completes the Michael system specification. All database operations should follow these patterns to ensure proper RLS enforcement, performance, and data integrity.
```
