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

## l10n Agent Flow (executed)
- Triggered by `instance-l10n-generate-{env}` jobs.
- Fetches instance config from Paris.
- Loads widget allowlist from Tokyo (`/widgets/{widgetType}/localization.json`).
- Generates set-only ops and writes to Paris (`widget_instance_locales.ops`).
- Paris preserves `user_ops` and enqueues publish to Tokyo-worker.

## Prague strings translation (local-only)
- Endpoint: `POST /v1/l10n/translate` (available only when `ENVIRONMENT=local`).
- Auth: `Authorization: Bearer ${PARIS_DEV_JWT}`.
- Used by `scripts/prague-strings/translate.mjs` to translate Prague base chunks.
- Returns translated items; the caller writes overlay files under `prague-strings/overlays/**`.
- Provider: OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`).

## Rules
- Do not write directly to Tokyo for l10n (Paris is canonical).
- Fail fast on invalid allowlist paths or stale base fingerprints.
- Agent writes must preserve user overrides (`user_ops`).

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
