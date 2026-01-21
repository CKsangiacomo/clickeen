# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- Queue consumers for agent jobs (e.g. instance localization).
- HTTP endpoints for AI outcomes (called by Paris).

## Dependencies
- Paris (instance data + l10n overlay writes)
- Tokyo (widget localization allowlists)
- Michael (indirectly via Paris)
- Cloudflare KV/R2/Queues (state, logs, scheduling)

## Deployment
- Cloudflare Workers (edge).
- Uses KV + R2 + Queues.

## Copilot execution (shipped)
- Endpoint: `POST /v1/execute`.
- Requires a Paris-minted grant; enforces `agent:*` caps and `ai` policy capsule.
- Agent routing uses the registry canonical IDs (aliases accepted).

## Personalization Preview (acquisition)
- Endpoint: `POST /v1/personalization/preview` (internal, requires `PARIS_DEV_JWT`).
- Status: `GET /v1/personalization/preview/:jobId` (internal).
- Jobs are stored in KV with TTL; execution uses the `agent.personalization.preview.v1` policy grant.

## Personalization Onboarding (workspace)
- Endpoint: `POST /v1/personalization/onboarding` (internal, requires `PARIS_DEV_JWT`).
- Status: `GET /v1/personalization/onboarding/:jobId` (internal).
- Jobs are stored in KV with TTL; execution uses the `agent.personalization.onboarding.v1` policy grant.
- On success, SF calls Paris to persist the workspace business profile.

## l10n Agent Flow (executed)
- Triggered by `instance-l10n-generate-{env}` jobs.
- Fetches instance config from Paris.
- Loads widget allowlist from Tokyo (`/widgets/{widgetType}/localization.json`).
- Generates set-only ops and writes to Paris (`widget_instance_locales.ops`).
- Paris preserves `user_ops` and enqueues publish to Tokyo-worker.

## Prague localization translation (local-only)
- Endpoint: `POST /v1/l10n/translate` (available only when `ENVIRONMENT=local`).
- Auth: `Authorization: Bearer ${PARIS_DEV_JWT}`.
- Used by `scripts/prague-l10n/translate.mjs` to translate Prague base content.
- Returns translated items; the caller writes overlay files under `tokyo/l10n/prague/**`.
- Provider: OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`).

## Rules
- Do not write directly to Tokyo for l10n (Paris is canonical).
- Fail fast on invalid allowlist paths or stale base fingerprints.
- Agent writes must preserve user overrides (`user_ops`).

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
