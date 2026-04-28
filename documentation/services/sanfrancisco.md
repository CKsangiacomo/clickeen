# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- `GET /healthz`
- Queue consumers for agent jobs.
- HTTP endpoints for AI outcomes.
- Private WorkerEntrypoint method `generateAccountWidgetL10nOps` for Tokyo-worker account-widget locale ops generation.

## Dependencies
- Tokyo-worker (account-mode explicit instance-sync caller)
- Tokyo (widget localization allowlists)
- Cloudflare KV/R2/Queues (state, logs, scheduling)

## Deployment
- Cloudflare Workers (edge).
- Uses KV + R2 + Queues.
- Cloudflare Workers observability is the first boring production sink for San Francisco runtime errors and operator logs.

Health contract:
- `GET /healthz` -> `{ "ok": true, "service": "sanfrancisco", "env": "<stage>", "ts": <unix_ms> }`

## Copilot execution (shipped)
- Endpoint: `POST /v1/execute`.
- Requires a Clickeen-signed grant; enforces `agent:*` caps and `ai` policy capsule.
- Grant verification accepts the active internal Clickeen issuers `roma` and `sanfrancisco`.
- The live product Copilot path executes only from Roma account routes; Bob no longer owns a public Minibob copilot flow.
- Agent routing uses the registry canonical IDs (aliases accepted).
- Budget enforcement is centralized in `callChatCompletion` (`maxTokens`, `timeoutMs`, `maxRequests`, and `maxCostUsd` when present).
- Provider execution retries transient upstream failures once, then falls back across eligible model candidates (and across providers when the grant does not pin `selectedProvider`).
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Live product widget-copilot canonical ID:
  - `cs.widget.copilot.v1` (account Builder editor copilot)
- The Roma grant issuer resolves `widget.copilot.v1` to the CS editor copilot on the live product path.
- Prompt persona pack lives in `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`.
- Widget copilot now runs with shared execution plumbing + role-scoped policy behavior:
  - CS policy (`cs.widget.copilot.v1`): full in-product editor assistant behavior (control-driven edits), no public-signup CTA flow.
- CS prompt payload expands tokenized content paths into concrete FAQ entries for rewrite intents and forbids requesting control/config dumps from users.
- Runtime modules are split between a shared core and thin per-agent wrappers:
  - shared core: `sanfrancisco/src/agents/widgetCopilotCore.ts`
  - CS wrapper: `sanfrancisco/src/agents/csWidgetCopilot.ts` (KV namespace `copilot:cs:session:*`)
- **Tiered Execution:** Enforces `ai.profile` from the grant.
  - `free_low`: `deepseek-chat` by default (agent-scoped alternatives may include Nova Lite).
  - `paid_standard`: `gpt-4o-mini` default, with provider/model choices constrained by policy + agent support (DeepSeek, OpenAI, Anthropic, Groq, Amazon Nova).
  - `paid_premium`: `gpt-4o` default, with higher-capability choices constrained by policy + agent support.
  - `curated_premium`: OpenAI curated set (`gpt-5.2` default).
- Budget tracking persists to `SF_KV` per grant (requests + cost) with TTL aligned to grant expiry.
- Contract coverage now explicitly guards grant verification, budget enforcement, provider routing, and concurrency ceilings before further AI-plane sophistication lands.

## Entrypoint posture
- `sanfrancisco/src/index.ts` is now a thin route shell.
- The default export is a Cloudflare `WorkerEntrypoint` so Tokyo-worker can call private worker methods without a public HTTP route.
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
- Despite the route name, this is not a separate user-facing onboarding product. It is an internal post-signup/account-context helper for Prague demo carry-forward and other account-context jobs.
- This helper does not create a second editor identity or public AI execution path.

## Account-mode l10n flow (active)
- Triggered by explicit Tokyo-worker instance sync after Roma create/locale-management/publish flows request reconciliation.
- Tokyo owns saved-config l10n identity/staleness; San Francisco is generation-only.
- Tokyo-worker calls the private `generateAccountWidgetL10nOps` worker method through its `SANFRANCISCO_L10N` service binding.
- There is no public account-widget generation HTTP route and no `CK_INTERNAL_SERVICE_JWT` on this path.
- Request payloads contain only approved text items (`path`, `type`, `value`), existing locale ops, changed paths, removed paths, target locales, widget type, base locale, and policy profile.
- San Francisco does not receive widget configs, localization allowlists, account ids, storage paths, live pointer state, or publication state for account-widget generation.
- Incremental generation translates only changed current item paths when possible and preserves existing ops for unchanged current paths.
- Returns set-only locale ops to Tokyo-worker.
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext translation uses one structured path: San Francisco extracts visible text segments, translates those strings only, rebuilds the original HTML, then validates placeholder parity, HTML tag parity, and anchor integrity.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same budget enforcement + provider allowlist).
- Cost budgets (`maxCostUsd`) use the `AI_PRICE_TABLE_JSON` env var; a default deepseek price table is provided when unset.

## Prague localization translation (local + cloud-dev)
- Endpoint: `POST /v1/l10n/translate` (available only when `ENVIRONMENT` is `local` or `dev`; disabled elsewhere).
- Auth: `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`.
- Used by `scripts/prague-l10n/translate.mjs` to translate Prague base content.
- Prague-string prompts preserve source acronym style and do not add parenthetical acronym expansions that are absent in source text.
- Prague-string safety validation enforces placeholder parity, HTML tag parity, and anchor integrity for richtext items.
- Returns translated items; the caller writes overlay files under `tokyo/prague/l10n/**`.
- Provider: OpenAI via shared policy router (curated profile default: `gpt-5.2`; env overrides still apply).

## Rules
- Active account-mode l10n returns set-only locale ops to Tokyo-worker; San Francisco does not own Tokyo overlay writes.
- Agent writes must not invent or depend on a `layer=user` authoring surface. The active instance-localization path returns locale ops only; Tokyo/Tokyo-worker owns readiness and publication.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
