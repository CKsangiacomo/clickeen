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
- Budget enforcement is centralized in `callChatCompletion` (`maxTokens`, `timeoutMs`, `maxRequests`, and `maxCostUsd` when present).
- **Tiered Execution:** Enforces `ai.profile` from the grant.
  - `free_low`: `deepseek-chat` by default (agent-scoped alternatives may include Nova Lite).
  - `paid_standard`: `gpt-4o-mini` default, with provider/model choices constrained by policy + agent support (DeepSeek, OpenAI, Anthropic, Groq, Amazon Nova).
  - `paid_premium`: `gpt-4o` default, with higher-capability choices constrained by policy + agent support.
  - `curated_premium`: OpenAI curated set (`gpt-5.2` default).
- Budget tracking persists to `SF_KV` per grant (requests + cost) with TTL aligned to grant expiry.

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
- Translates only `changedPaths`, removes `removedPaths`, and writes set-only ops to Paris (layer=locale).
- Paris preserves user overrides in layer=user and enqueues publish to Tokyo-worker.
- Job schema v2 includes `agentId`, `grant`, `baseFingerprint`, `changedPaths`, `removedPaths`, and optional `baseUpdatedAt` metadata.
- SF verifies the Paris-minted grant and `agent:*` cap before executing l10n jobs.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same budget enforcement + provider allowlist).
- Reports job status back to Paris via `POST /api/l10n/jobs/report` (`running | succeeded | failed | superseded`).
- Local dev: `POST /v1/l10n` accepts job batches (Authorization: `Bearer ${PARIS_DEV_JWT}`) to bypass queues; jobs must still include a valid grant.
- Cost budgets (`maxCostUsd`) use the `AI_PRICE_TABLE_JSON` env var; a default deepseek price table is provided when unset.

## Prague localization translation (local + cloud-dev)
- Endpoint: `POST /v1/l10n/translate` (available only when `ENVIRONMENT` is `local` or `dev`; disabled elsewhere).
- Auth: `Authorization: Bearer ${PARIS_DEV_JWT}`.
- Used by `scripts/prague-l10n/translate.mjs` to translate Prague base content.
- Returns translated items; the caller writes overlay files under `tokyo/l10n/prague/**`.
- Provider: OpenAI via shared policy router (curated profile default: `gpt-5.2`; env overrides still apply).

## Rules
- Do not write directly to Tokyo for l10n (Paris is canonical).
- Reject invalid allowlist paths; stale fingerprints should be reported as `superseded` and retried, not hard failures.
- Agent writes must not touch layer=user; overrides remain in layer=user and are merged at publish time.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
