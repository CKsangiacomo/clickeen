# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- `GET /healthz`
- Queue consumers for agent jobs.
- HTTP endpoints for AI outcomes.
- `POST /v1/babel/text-values` for Roma-orchestrated account-widget Babel text production.

## Dependencies
- Roma (account-mode save follow-up caller)
- Widget primitive graph from `spec.json.overlays.text[]` via Roma request payloads
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
- Agent routing uses registry canonical IDs.
- Provider execution retries transient upstream failures once against the same selected/default model. It does not silently switch models or providers.
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Live product widget-copilot canonical ID:
  - `cs.widget.copilot.v1` (account Builder editor copilot)
- The Roma grant issuer mints the live account Builder copilot grant for `cs.widget.copilot.v1`.
- Prompt persona pack lives in `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`.
- Widget copilot now runs with shared execution plumbing + role-scoped policy behavior:
  - CS policy (`cs.widget.copilot.v1`): full in-product editor assistant behavior (control-driven edits), no public-signup CTA flow.
- CS prompt payload expands tokenized content paths into concrete editable content entries for rewrite intents and forbids requesting control/config dumps from users.
- Runtime modules are split between a shared core and thin per-agent wrappers:
  - shared core: `sanfrancisco/src/agents/widgetCopilotCore.ts`
  - CS wrapper: `sanfrancisco/src/agents/csWidgetCopilot.ts` (KV namespace `copilot:cs:session:*`)
- **Runtime policy execution:** Enforces the signed `AgentRuntimePolicy` from the grant: `defaultModel`, `modelsByProvider`, optional `selectedModel`, request ceilings, and learning-capture rules. Product/account policy decides the allowed model set before grant issuance.
- Request tracking persists to `SF_KV` per grant with TTL aligned to grant expiry.
- Contract coverage now explicitly guards grant verification, budget enforcement, provider routing, and concurrency ceilings before further AI-plane sophistication lands.

## Entrypoint posture
- `sanfrancisco/src/index.ts` is now a thin route shell.
- The default export is a Cloudflare `WorkerEntrypoint`; account-widget Babel production uses the grant-protected HTTP endpoint owned by Roma's save follow-up.
- Extracted runtime modules own:
  - request-signature helpers: `sanfrancisco/src/signatures.ts`
  - concurrency limiting: `sanfrancisco/src/concurrency.ts`
  - telemetry and outcome persistence: `sanfrancisco/src/telemetry.ts`
  - account-widget Babel text handlers: `sanfrancisco/src/l10n-account-routes.ts`

## Account-widget Babel text flow (active)
- Triggered by Roma after a base widget save succeeds.
- Roma owns orchestration, San Francisco owns value production, and Tokyo-worker owns overlay storage.
- Endpoint: `POST /v1/babel/text-values`.
- Auth: `Authorization: Bearer <Roma-minted AI grant>` with capability `agent:widget.instance.translator`.
- Request payloads contain only `{ v, widgetType, sourceLanguage, targetLanguage, items }`, where each item is one concrete primitive text path and value from the current saved config.
- San Francisco does not receive widget configs, wildcard path declarations, account storage paths, selected-overlay pointers, live pointer state, publication state, previous values, or patch operations.
- San Francisco returns `{ v: 1, values }` with the exact same path set it received: no more and no fewer.
- Roma validates the exact path set before calling Tokyo-worker storage verbs. San Francisco does not write Tokyo overlay objects.
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext translation uses one structured path: San Francisco extracts visible text segments, translates those strings only, rebuilds the original HTML, then validates placeholder parity, HTML tag parity, and anchor integrity.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same request/token enforcement + provider/model allowlist).

## Prague posture
- Prague does not own the account-widget overlay runtime.
- Public widget locale overlays are generated from Builder saves and served by Venice from Tokyo published overlay IDs.
- San Francisco must not write Prague overlay files or resurrect a Prague-specific widget localization path.

## Rules
- Active account-widget Babel returns exact text value maps to Roma; San Francisco does not own Tokyo overlay writes.
- Agent writes must not invent paths, patch formats, readiness state, or layer authoring surfaces. The active instance-locale path returns concrete primitive values only; Roma orchestrates and Tokyo-worker stores.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
