# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- `GET /healthz`
- Queue consumers for agent jobs.
- HTTP endpoints for AI outcomes.
- `POST /v1/l10n/account/ops/generate` (internal auth; account-mode locale ops generation for Roma aftermath)

## Dependencies
- Roma (account-mode l10n aftermath caller)
- Tokyo (widget localization allowlists)
- Cloudflare KV/R2/Queues (state, logs, scheduling)

## Deployment
- Cloudflare Workers (edge).
- Uses KV + R2 + Queues.

Health contract:
- `GET /healthz` -> `{ "ok": true, "service": "sanfrancisco", "env": "<stage>", "ts": <unix_ms> }`

## Copilot execution (shipped)
- Endpoint: `POST /v1/execute`.
- Requires a Clickeen-signed grant; enforces `agent:*` caps and `ai` policy capsule.
- Agent routing uses the registry canonical IDs (aliases accepted).
- Budget enforcement is centralized in `callChatCompletion` (`maxTokens`, `timeoutMs`, `maxRequests`, and `maxCostUsd` when present).
- Provider execution retries transient upstream failures once, then falls back across eligible model candidates (and across providers when the grant does not pin `selectedProvider`).
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Widget-copilot canonical IDs:
  - `sdr.widget.copilot.v1` (Minibob + free)
  - `cs.widget.copilot.v1` (paid tiers + DevStudio)
- The grant issuer resolves widget-copilot aliasing before SF execution (`widget.copilot.v1` and forced SDR/CS IDs are normalized by profile).
- Prompt persona pack lives in `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`.
- Widget copilot now runs with shared execution plumbing + role-scoped policy behavior:
  - SDR policy (`sdr.widget.copilot.v1`): FAQ-only sales workflow with two edit capabilities (rewrite existing Q&A, or personalize from one website URL with consent). Other requests return seller messaging + signup CTA.
  - CS policy (`cs.widget.copilot.v1`): full in-product editor assistant behavior (control-driven edits), no SDR website/sales clarification loop.
  - CS prompt payload expands tokenized content paths into concrete FAQ entries for rewrite intents and forbids requesting control/config dumps from users.
- Runtime modules are split between a shared core and thin per-agent wrappers:
  - shared core: `sanfrancisco/src/agents/widgetCopilotCore.ts`
  - SDR wrapper: `sanfrancisco/src/agents/sdrWidgetCopilot.ts` (KV namespace `copilot:sdr:session:*`)
  - CS wrapper: `sanfrancisco/src/agents/csWidgetCopilot.ts` (KV namespace `copilot:cs:session:*`)
- **Tiered Execution:** Enforces `ai.profile` from the grant.
  - `free_low`: `deepseek-chat` by default (agent-scoped alternatives may include Nova Lite).
  - `paid_standard`: `gpt-4o-mini` default, with provider/model choices constrained by policy + agent support (DeepSeek, OpenAI, Anthropic, Groq, Amazon Nova).
  - `paid_premium`: `gpt-4o` default, with higher-capability choices constrained by policy + agent support.
  - `curated_premium`: OpenAI curated set (`gpt-5.2` default).
- Budget tracking persists to `SF_KV` per grant (requests + cost) with TTL aligned to grant expiry.

## Entrypoint posture
- `sanfrancisco/src/index.ts` is now a thin route shell.
- Extracted runtime modules own:
  - internal auth helpers: `sanfrancisco/src/internalAuth.ts`
  - concurrency limiting: `sanfrancisco/src/concurrency.ts`
  - telemetry and outcome persistence: `sanfrancisco/src/telemetry.ts`
  - l10n route handlers: `sanfrancisco/src/l10n-routes.ts`
  - personalization job routes/queue handling: `sanfrancisco/src/personalization-jobs.ts`

## Account-context carry-forward (legacy route name: personalization/onboarding)
- Endpoint: `POST /v1/personalization/onboarding` (internal, requires `CK_INTERNAL_SERVICE_JWT`).
- Status: `GET /v1/personalization/onboarding/:jobId` (internal).
- Jobs are stored in KV with TTL; execution uses the `agent.personalization.onboarding.v1` policy grant.
- Despite the route name, this is not a separate user-facing onboarding product. It is an internal post-signup/account-context helper for users who started editing before they had an account.
- MiniBob remains one journey: edit a draft, click Publish, create an account, then continue in Roma. Draft context such as a captured website can travel with the claimed instance.

## Account-mode l10n flow (active)
- Triggered by Roma account save/publish/locale-settings aftermath.
- Loads widget allowlist from Tokyo (`/widgets/{widgetType}/localization.json`).
- Translates only `changedPaths`, removes `removedPaths`, and returns set-only locale ops to Roma.
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext safety validation enforces placeholder parity, HTML tag parity, and anchor integrity (text-bearing link + href parity); failed richtext parity falls back to segment translation.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same budget enforcement + provider allowlist).
- Cost budgets (`maxCostUsd`) use the `AI_PRICE_TABLE_JSON` env var; a default deepseek price table is provided when unset.

## Prague localization translation (local + cloud-dev)
- Endpoint: `POST /v1/l10n/translate` (available only when `ENVIRONMENT` is `local` or `dev`; disabled elsewhere).
- Auth: `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`.
- Used by `scripts/prague-l10n/translate.mjs` to translate Prague base content.
- Prague-string prompts preserve source acronym style and do not add parenthetical acronym expansions that are absent in source text.
- Prague-string safety validation enforces placeholder parity, HTML tag parity, and anchor integrity for richtext items.
- Returns translated items; the caller writes overlay files under `tokyo/l10n/prague/**`.
- Provider: OpenAI via shared policy router (curated profile default: `gpt-5.2`; env overrides still apply).

## Rules
- Reject invalid allowlist paths.
- Active account-mode l10n returns set-only locale ops to Roma; San Francisco does not own Tokyo overlay writes.
- Agent writes must not touch layer=user; overrides remain in layer=user and are merged at publish time.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
