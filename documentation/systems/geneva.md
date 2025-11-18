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
  - Paris — validates POST/PUT `/api/instance` payloads against Geneva schemas
  - Bob — fetches schema + template catalog via Paris endpoints (`GET /api/widgets`, `/api/templates`)
  - Venice — pulls descriptors (directly or via Atlas) to render SSR output
- **Schema Versioning:** Immutable per `widgetType`. Breaking changes require a new `schemaVersion` and migration in Michael + documentation update.

## 1) Data Model (Phase-1)
- `widget_schemas` (Michael) — columns: `id`, `widget_type`, `schema_version`, `schema` (JSONB), `created_at`. Unique constraint on (`widget_type`, `schema_version`).
- `widget_templates` — describes available templates: `widget_type`, `template_id`, `layout`, `skin`, `density`, `accents[]`, `premium`, `schema_version`, `defaults` JSON, `descriptor` JSON.
- Geneva exposes these via Paris helper functions located in `paris/lib/geneva.ts` (planned path) returning strongly typed payloads.

## 2) Validation Rules (NORMATIVE)
- Every widget instance must reference a valid (`widget_type`, `schemaVersion`) pair present in Geneva.
- Paris loads the JSON schema and validates instance `config` using AJV (or equivalent) before persisting to Michael. Validation errors produce `422 CONFIG_INVALID` with `[ { path, message } ]`.
- Template switches trigger re-validation against the target template’s `schemaVersion`. Unknown fields are dropped; defaults from Geneva are merged server-side.
- Premium templates (`premium=true`) require entitlements (`features.premiumTemplates=true`). Geneva marks premium templates; Paris enforces the gate.

### Template Switch Transform & Validation (Phase‑1)
- Order of operations (non‑destructive by default):
  1) Transform the incoming `config` to the target schema by removing non‑carryable/unknown fields.
  2) Apply target defaults from `widget_templates.defaults`.
  3) Validate against target `widget_schemas` using AJV; on failure return `422` with `[ { path, message } ]`.
- Dry‑run preview: Paris supports dry‑run template switches that return a deterministic `diff` (`dropped`, `added`) and a `proposedConfig` without persisting. Clients must confirm before committing (`confirm=true`).
- Unknown/missing `schemaVersion` returns `422` with `{ path: "schemaVersion", message: "unknown schema version" }`.

## 3) APIs & Contracts
| Endpoint | Purpose |
| --- | --- |
| `GET /api/widgets` | Returns catalog of widget types and summary metadata sourced from Geneva (`id`, `name`, `description`, `supportedTemplates`). |
| `GET /api/templates?widgetType=` | Returns template descriptors for the given widget type (id, schemaVersion, premium flag, defaults, preview asset). |
| `POST/PUT /api/instance` | Invokes Geneva validation before writing. |

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
