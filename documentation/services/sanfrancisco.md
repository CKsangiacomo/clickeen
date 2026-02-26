# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- Queue consumers for agent jobs (e.g. instance localization).
- HTTP endpoints for AI outcomes (called by Paris).
- `POST /v1/l10n/plan` (internal auth; l10n planning snapshot for `{ widgetType, config }` or `{ widgetType, publicId, workspaceId }`)

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
- Provider execution retries transient upstream failures once, then falls back across eligible model candidates (and across providers when the grant does not pin `selectedProvider`).
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Widget-copilot canonical IDs:
  - `sdr.widget.copilot.v1` (Minibob + free)
  - `cs.widget.copilot.v1` (paid tiers + DevStudio)
- Paris resolves widget-copilot aliasing before SF execution (`widget.copilot.v1` and forced SDR/CS IDs are normalized by profile).
- Prompt persona pack lives in `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`.
- Widget copilot now runs with shared execution plumbing + role-scoped policy behavior:
  - SDR policy (`sdr.widget.copilot.v1`): FAQ-only sales workflow with two edit capabilities (rewrite existing Q&A, or personalize from one website URL with consent). Other requests return seller messaging + signup CTA.
  - CS policy (`cs.widget.copilot.v1`): full in-product editor assistant behavior (control-driven edits), no SDR website/sales clarification loop.
  - CS prompt payload expands tokenized content paths into concrete FAQ entries for rewrite intents and forbids requesting control/config dumps from users.
- Runtime modules are split per agent:
  - SDR executor: `sanfrancisco/src/agents/sdrWidgetCopilot.ts` (KV namespace `copilot:sdr:session:*`)
  - CS executor: `sanfrancisco/src/agents/csWidgetCopilot.ts` (KV namespace `copilot:cs:session:*`)
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
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext safety validation enforces placeholder parity, HTML tag parity, and anchor integrity (text-bearing link + href parity); failed richtext parity falls back to segment translation.
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
- Prague-string prompts preserve source acronym style and do not add parenthetical acronym expansions that are absent in source text.
- Prague-string safety validation enforces placeholder parity, HTML tag parity, and anchor integrity for richtext items.
- Returns translated items; the caller writes overlay files under `tokyo/l10n/prague/**`.
- Provider: OpenAI via shared policy router (curated profile default: `gpt-5.2`; env overrides still apply).

## Rules
- Do not write directly to Tokyo for l10n (Paris is canonical).
- Reject invalid allowlist paths; stale fingerprints should be reported as `superseded` and retried, not hard failures.
- Agent writes must not touch layer=user; overrides remain in layer=user and are merged at publish time.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
