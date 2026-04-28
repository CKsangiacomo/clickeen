# 081C PRD - San Francisco Telemetry And D1 Hygiene

Status: READY FOR EXECUTION
Owner: San Francisco
Priority: P1
Date: 2026-04-28

## 1. Product Truth

San Francisco is the AI workforce service.

Its telemetry stores AI execution events and outcome events. It is not account truth, workspace truth, billing truth, or product authorization truth.

Workspace is no longer a product owner in Clickeen. Any active San Francisco telemetry field that suggests workspace ownership is zombie architecture.

D1 schema is infrastructure. It must be applied before runtime through migrations, not created at Worker boot.

## 2. Problem

San Francisco has two cleanup issues:

1. `workspaceIdHash` still exists in active telemetry types and writes.
2. `ensureD1Schema` runs D1 DDL from Worker runtime code.

The current active code:

- accepts `workspaceIdHash` in `OutcomeAttachRequest`
- validates `workspaceIdHash` in `isOutcomeAttachRequest`
- creates `workspaceIdHash TEXT` in `copilot_outcomes_v1`
- inserts `workspaceIdHash` in `persistOutcomeAttach`
- calls `ensureD1Schema` on Worker startup and before outcome writes

This is wrong because:

- workspace is dead as a product ownership model
- telemetry should not keep zombie product nouns alive
- D1 schema changes should be deploy-time operations
- Worker boot should not run best-effort `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX`
- schema failure should not be silently swallowed while runtime continues

## 3. Scope

In scope:

- San Francisco telemetry type cleanup.
- San Francisco D1 schema migration ownership.
- Removal of runtime D1 DDL from San Francisco Worker code.
- Docs cleanup for stale `workspaceIdHash` language.

Out of scope:

- San Francisco grant model.
- AI provider routing.
- L10n translation execution.
- R2 log bucket deletion.
- `SanfranciscoCommandMessage` command-envelope cleanup.
- Tokyo/Roma/Bob behavior.

## 4. Surviving Architecture

### 4.1 Outcome telemetry shape

Final `OutcomeAttachRequest`:

```ts
type OutcomeAttachRequest = {
  requestId: string;
  sessionId: string;
  event: CopilotOutcomeEvent;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
};
```

Rules:

- No `workspaceIdHash`.
- `accountIdHash` is optional telemetry correlation only.
- Outcome telemetry must not be used as an authorization source.

### 4.2 D1 schema ownership

San Francisco D1 schema must live in migration files.

Target migration ownership:

```txt
sanfrancisco/
  migrations/
    0001__telemetry_schema.sql
    0002__drop_workspace_id_hash_from_outcomes.sql
```

Acceptable variation:

- If the repo already has or adopts a different D1 migrations directory convention during execution, use that convention.
- The final location must be configured in `sanfrancisco/wrangler.toml` and executable by Wrangler D1 migration commands.

Runtime code may assume the schema exists. If it does not, writes should fail loudly through the existing error path.

Telemetry insert behavior must be explicit:

- outcome telemetry (`persistOutcomeAttach`) is user/action feedback and must fail through the existing `HttpError` path when D1 is unavailable
- queued AI interaction indexing (`indexCopilotEvent`) may remain best-effort only if this PRD says so explicitly and the execution report records that choice
- if queued AI interaction indexing remains best-effort, this PRD's "no swallowed schema failures" rule applies to runtime DDL and outcome writes, not to intentionally best-effort event indexing

## 5. Required Code Changes

### 5.1 Remove workspace telemetry field

Patch:

- `sanfrancisco/src/types.ts`
  - remove `workspaceIdHash?: string` from `OutcomeAttachRequest`

- `sanfrancisco/src/telemetry.ts`
  - remove `workspaceIdHash` parsing from `isOutcomeAttachRequest`
  - remove validation for `workspaceIdHash`
  - remove `workspaceIdHash` from the outcome insert column list
  - remove the matching bind parameter

Search must return no active source hits for:

```txt
workspaceIdHash
workspace_id_hash
workspace hash
```

Allowed remaining hits:

- this PRD execution note
- historical executed PRDs if not imported by runtime

### 5.2 Remove runtime D1 DDL

Patch:

- `sanfrancisco/src/telemetry.ts`
  - delete `d1SchemaReady`
  - delete `ensureD1Schema`
  - remove `await ensureD1Schema(env)` from `persistOutcomeAttach`

- `sanfrancisco/src/index.ts`
  - remove Worker startup call to `ensureD1Schema`
  - remove `ensureD1Schema` import

Search must return no active source hits for:

```txt
ensureD1Schema
CREATE TABLE IF NOT EXISTS copilot
ALTER TABLE copilot
CREATE INDEX IF NOT EXISTS idx_copilot
```

Allowed remaining hits:

- D1 migration SQL files
- this PRD execution note

### 5.3 Add D1 migrations

Create D1 migration files for the active schema.

The schema must include:

```txt
copilot_events_v1
copilot_outcomes_v1
```

`copilot_outcomes_v1` must not include:

```txt
workspaceIdHash
```

The migration must also own indexes currently created at runtime:

```txt
idx_copilot_events_v1_day_agent
idx_copilot_events_v1_day_stage
idx_copilot_events_v1_day_widget
idx_copilot_events_v1_day_session
idx_copilot_events_v1_day_intent_outcome
idx_copilot_outcomes_v1_day_event
idx_copilot_outcomes_v1_request
```

If cloud-dev D1 already has `workspaceIdHash`, migration must rebuild or alter the table so the active schema no longer exposes it. Do not solve this by ignoring the old column in TypeScript while keeping the runtime schema definition in code.

### 5.4 Docs cleanup

Patch docs that still describe `workspaceIdHash` as active telemetry.

Known file:

- `documentation/ai/learning.md`

If docs need to mention the old field, they must call it historical and not part of the active contract.

## 6. Execution Gates

Do not move to the next gate until the current gate is green.

### Gate 1 - Source inventory

Green means:

- all active `workspaceIdHash` hits are listed
- all active `ensureD1Schema`/runtime DDL hits are listed
- D1 binding and migration configuration are understood from `sanfrancisco/wrangler.toml`

### Gate 2 - Type cleanup

Green means:

- `OutcomeAttachRequest` no longer has `workspaceIdHash`
- `isOutcomeAttachRequest` does not accept or validate it
- outcome insert does not write it
- San Francisco TypeScript compiles

### Gate 3 - D1 migration ownership

Green means:

- migration files create current telemetry schema
- indexes are in migrations
- `copilot_outcomes_v1` has no workspace column in the migration contract
- Wrangler D1 migration command is documented in the execution report

### Gate 4 - Runtime DDL removal

Green means:

- no runtime `CREATE TABLE`, `ALTER TABLE`, or `CREATE INDEX` remains in San Francisco source
- no startup schema mutator remains
- outcome telemetry write paths fail through normal errors if schema is absent
- if `indexCopilotEvent` remains best-effort, the execution report explicitly states that this is intentional and not a schema-migration fallback

### Gate 5 - Cloud-dev verification

Green means:

- D1 migrations apply to `sanfrancisco_d1_dev`
- San Francisco deploy/dry-run succeeds
- `/healthz` or equivalent health path still works
- one representative AI event/outcome write path still succeeds if a safe test path exists
- no active source or doc contract says `workspaceIdHash` is current

## 7. Blast Radius

Main files:

```txt
sanfrancisco/src/types.ts
sanfrancisco/src/telemetry.ts
sanfrancisco/src/index.ts
sanfrancisco/wrangler.toml
sanfrancisco/migrations/*.sql
documentation/ai/learning.md
```

Runtime risk:

- San Francisco telemetry writes.
- D1 migration workflow.
- Worker startup behavior.

Non-risk:

- Account auth.
- Roma/Bob Builder.
- Tokyo assets.
- Prague marketing l10n.
- San Francisco R2 logs bucket.

## 8. Non-Negotiable Tenets

1. **No workspace telemetry**
   - Do not preserve `workspaceIdHash` for compatibility.
   - Do not rename it to another workspace-shaped field.

2. **No runtime DDL**
   - Worker code must not create or alter D1 schema.
   - D1 schema changes belong in migration files.

3. **No swallowed schema failures**
   - Do not keep best-effort schema mutation with `catch {}`.
   - If schema is missing, the write should fail clearly.
   - Exception: queued AI event indexing may remain explicitly best-effort if execution documents that choice; outcome attach writes must not be swallowed.

4. **No mixed cleanup**
   - Do not combine this with Tokyo asset storage.
   - Do not combine this with Berlin/Tokyo file hygiene.
   - Do not delete R2 log buckets in this PRD.

## 9. Verification Commands

Required local checks:

```bash
./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit
pnpm --filter @clickeen/sanfrancisco exec wrangler deploy --dry-run
git diff --check
```

Required search checks:

```bash
rg -n "workspaceIdHash|workspace_id_hash|workspace hash" sanfrancisco documentation/ai --glob '!**/node_modules/**'
rg -n "ensureD1Schema|CREATE TABLE IF NOT EXISTS copilot|ALTER TABLE copilot|CREATE INDEX IF NOT EXISTS idx_copilot" sanfrancisco/src sanfrancisco/migrations --glob '!**/node_modules/**'
```

Allowed remaining hits:

- migration SQL files for schema DDL
- this PRD
- historical executed PRDs

Required D1 checks during execution:

```bash
pnpm --filter @clickeen/sanfrancisco exec wrangler d1 migrations list sanfrancisco_d1_dev
pnpm --filter @clickeen/sanfrancisco exec wrangler d1 migrations apply sanfrancisco_d1_dev
```

If Wrangler requires a binding name instead of database name in the current installed version, use the command form reported by local `wrangler d1 migrations --help` and record it in the execution report.

## 10. Definition Of Done

This PRD is done only when:

- `workspaceIdHash` is gone from active San Francisco source
- `workspaceIdHash` is not part of the active D1 outcome schema
- San Francisco source has no runtime D1 DDL
- D1 schema is owned by migrations
- San Francisco typecheck and deploy dry-run pass
- docs no longer describe workspace telemetry as active
