STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (PHASE-1)
This document is authoritative for the Geneva system. It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) Other system PRDs in documentation/systems/
If any conflict is found, STOP and escalate to the CEO. Do not guess.

# System: Geneva — Schema Registry

## 0) Quick Facts
- **Surface:** Runs inside Paris (`paris/`) with Supabase backing tables (`widget_schemas`, `widget_templates`)
- **Purpose:** Authoritative registry for widget config schemas and template descriptors; enforces compatibility across Paris, Bob, and Venice
- **Consumers:**
  - Paris — validates `PUT /api/instance/:publicId` payloads against Geneva schemas
  - Bob — consumes compiled widget definitions from Denver; does not fetch Geneva catalogs in this repo snapshot
  - Venice — uses Paris instance responses; full SSR rendering + template catalogs are planned
- **Schema Versioning:** Immutable per `widgetType`. Breaking changes require a new `schemaVersion` and migration in Michael + documentation update.

## 1) Data Model (Phase-1)
- `widget_schemas` (Michael) — columns: `id`, `widget_type`, `schema_version`, `schema` (JSONB), `created_at`. Unique constraint on (`widget_type`, `schema_version`).
- `widget_templates` — describes available templates: `widget_type`, `template_id`, `layout`, `skin`, `density`, `accents[]`, `premium`, `schema_version`, `defaults` JSON, `descriptor` JSON.
- Geneva exposes these via Paris helper functions located in `paris/lib/geneva.ts`.

## 2) Validation Rules (NORMATIVE)
- Every widget instance must reference a valid (`widget_type`, `schemaVersion`) pair present in Geneva.
- Paris loads the JSON schema and validates instance `config` using AJV (or equivalent) before persisting to Michael. Validation errors return `422` with `[ { path, message } ]`.
- Template switches trigger re-validation against the target schema version. Unknown fields are dropped; schema defaults may be applied server-side.
- Premium templates (`premium=true`) entitlement gating is planned; do not assume enforcement in this repo snapshot.

### Template Switch Transform & Validation (Phase‑1)
- Order of operations (non‑destructive by default):
  1) Transform the incoming `config` to the target schema by removing non‑carryable/unknown fields.
  2) Apply schema defaults (template defaults application is planned).
  3) Validate against target `widget_schemas` using AJV; on failure return `422` with `[ { path, message } ]`.
- Dry‑run preview: Paris supports dry‑run template switches that return a deterministic `diff` (`dropped`, `added`) and a `proposedConfig` without persisting. Clients must confirm before committing (`confirm=true`).
- Unknown/missing `schemaVersion` returns `422` with `{ path: "schemaVersion", message: "unknown schema version" }`.

## 3) APIs & Contracts
Geneva is consumed as an internal library by Paris. There are no public “catalog” endpoints in this repo snapshot.

| Endpoint | Purpose |
| --- | --- |
| `PUT /api/instance/:publicId` | Uses Geneva schemas to transform/validate `config` before persisting. |

Response payloads include `schemaVersion` so clients can decide whether a draft needs migration.
#### Example error payload
```json
[
  { "path": "config.fields.email", "message": "must be boolean" },
  { "path": "schemaVersion", "message": "unknown schema version" }
]
```

## 4) Change Control
- Modifying schemas or templates requires:
  1. Update the schema under `supabase/migrations/` with the exact SQL.
  2. Update Geneva doc (this file) and Phase-1 specs if contracts change.
  3. Regenerate any cached Atlas payloads by running the Paris sync job.
- Never overwrite existing `schemaVersion` entries; create a new version and a migration path.

## 5) Tooling & Testing
- Local development: `pnpm --filter paris test:geneva` (placeholder) should cover schema validation fixtures.
- Include unit tests for each widget type ensuring both valid and invalid configs exercise the Geneva validators.
- Provide fixtures for Bob so UI forms align with schema constraints (kept under `bob/app/components/schema-fixtures/**`).

## 6) Common Mistakes (DO NOT DO)
- ❌ Mutating schemas in place — always bump `schemaVersion`.
- ❌ Allowing clients to bypass server validation — Paris is the single validation point.
- ❌ Diverging template descriptors between Geneva and Dieter previews — update both or pause feature work.

---
Links: back to `documentation/CONTEXT.md`
