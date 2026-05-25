# System: San Francisco - AI Workforce OS

## Identity
- Tier: Core
- Purpose: Agent execution and automation (localization, sales/support/ops agents, learning logs).

## Interfaces
- `GET /healthz`
- Queue consumers for agent jobs.
- HTTP endpoints for AI outcomes.
- `POST /v1/agents/instance-translation/translate-saved-instance` for direct diagnostics/tests of account-widget instance translation.
- `POST /v1/agents/instance-translation/runtime-status` for translator runtime diagnostics.

## Dependencies
- Roma (account command boundary and diagnostic caller)
- Tokyo-worker (translation generation owner, queue producer, translated locale value writes through `TOKYO_PRODUCT_CONTROL`; overlay file vocabulary is transitional storage only)
- Saved widget text fields expanded from widget `editable-fields.json` through Tokyo-produced queue payloads
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
- The default export is a Cloudflare `WorkerEntrypoint`; account-widget instance translation uses queued jobs produced by Tokyo and consumed by San Francisco.
- Extracted runtime modules own:
  - request-signature helpers: `sanfrancisco/src/signatures.ts`
  - concurrency limiting: `sanfrancisco/src/concurrency.ts`
  - telemetry and outcome persistence: `sanfrancisco/src/telemetry.ts`
  - account-widget instance translation handlers: `sanfrancisco/src/l10n-account-routes.ts`

## Account-widget Instance Translation flow (active)
- Triggered only by explicit Generate from Bob's Translations panel through Roma to Tokyo. Base Save does not enqueue translation.
- Roma owns account-command acceptance. Tokyo owns queue production, generation state, and saved locale value storage. San Francisco owns AI value production and terminal complete/fail reporting back to Tokyo.
- Queue binding: `INSTANCE_TRANSLATION_JOBS`.
- Runtime target payloads are widget-generic saved text fields from `editable-fields.json`, including stable identity keys, current paths, labels, roles, base text, source basis, and the PRD 103K saved base content marker.
- San Francisco translates only changed generic primitive fields, validates the exact returned changed path set, and reports one terminal completion or failure to Tokyo using `x-ck-internal-service: sanfrancisco.translation`.
- Tokyo validates and writes the complete current-language value object under the owning instance. Overlay IDs are not product vocabulary.
- The HTTP `translate-saved-instance` endpoint remains for direct diagnostics and tests; it is not the active save/generate product orchestration boundary.
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext translation uses one structured path: San Francisco extracts visible text segments, translates those strings only, rebuilds the original HTML, then validates placeholder parity, HTML tag parity, and anchor integrity.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same request/token enforcement + provider/model allowlist). Instance Translation must not set local token or timeout caps that override the signed grant; `ck-policy` is the model and budget authority for each queued job.

## Prague posture
- Prague does not own the account-widget locale runtime.
- Public widget locale pages are materialized by Tokyo-worker from saved instance source plus translated locale values during publish. San Francisco produces translated values only; it does not write public widget files.
- San Francisco must not write Prague overlay files or resurrect a Prague-specific widget localization path.

## Rules
- Active account-widget instance translation writes exact current-language value maps to Tokyo from San Francisco queue jobs after Tokyo generation acceptance.
- Agent writes must not invent paths, patch formats, readiness state, or layer authoring surfaces. The active instance-locale path stores concrete primitive values only; Roma forwards account intent, Tokyo owns generation state and queue production, San Francisco executes, and Tokyo-worker stores.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
