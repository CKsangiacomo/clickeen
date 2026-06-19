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
- Tokyo-worker (exact translated locale overlay storage through `TOKYO_PRODUCT_CONTROL`)
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
- Provider execution does not silently switch models or providers. The current `/v1/execute` path makes one provider call per turn; retry behavior is future explicit work.
- Provider request shape comes from the explicit shared AI model capability table (`ck-contracts`), not provider/model string heuristics.
- Provider errors returned to product callers are typed `PROVIDER_ERROR` responses with safe messages and optional upstream status; raw upstream bodies are not product payloads.
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Live product widget-copilot canonical ID:
  - `cs.widget.copilot.v1` (account Builder editor copilot)
- The Roma grant issuer mints the live account Builder copilot grant for `cs.widget.copilot.v1`.
- Prompt persona pack lives in `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`.
- Widget copilot now runs with shared execution plumbing + role-scoped policy behavior:
  - CS policy (`cs.widget.copilot.v1`): full in-product editor assistant behavior (control-driven edits), no public-signup CTA flow.
- Builder capability/explain/clarification turns are handled by Bob from the current compiled control snapshot before a San Francisco request is made.
- CS prompt payload is built from the explicit Builder envelope that Roma forwards from Bob: `turnClass`, optional `resolvedTarget`, and the scoped current control snapshot. It does not accept the old free-form `currentConfig`/`controls` payload and does not include widget package source, widget HTML/CSS/client source, or keyword-ranked source padding.
- If the scoped Builder context is too large, San Francisco fails visibly instead of truncating controls or current values.
- Runtime modules are split between a shared core and thin per-agent wrappers:
  - shared core: `sanfrancisco/src/agents/widgetCopilotCore.ts`
  - CS wrapper: `sanfrancisco/src/agents/csWidgetCopilot.ts` (KV namespace `copilot:cs:session:*`)
- **Runtime policy execution:** Enforces the signed `AgentRuntimePolicy` from the grant: `defaultModel`, `modelsByProvider`, optional `selectedModel`, request ceilings, and learning-capture rules. Product/account policy decides the allowed model set before grant issuance.
- Copilot session memory persists in `SF_KV` for 24 hours under the
  role-specific session namespace. Signed Roma grants remain short-lived per
  request and are verified on each San Francisco execution.
- Contract coverage now explicitly guards grant verification, budget enforcement, provider routing, and concurrency ceilings before further AI-plane sophistication lands.

## Entrypoint posture
- `sanfrancisco/src/index.ts` is now a thin route shell.
- The default export is a Cloudflare `WorkerEntrypoint`; account-widget
  instance translation can consume queued jobs when a San Francisco-owned
  generation endpoint produces them.
- Extracted runtime modules own:
  - request-signature helpers: `sanfrancisco/src/signatures.ts`
  - concurrency limiting: `sanfrancisco/src/concurrency.ts`
  - telemetry and outcome persistence: `sanfrancisco/src/telemetry.ts`
  - account-widget instance translation handlers: `sanfrancisco/src/l10n-account-routes.ts`

## Account-widget Instance Translation
- Base Save does not enqueue translation.
- Roma owns account-command acceptance and account active-locale selection.
- San Francisco owns AI value production and is the required owner for any
  future async translation generation endpoint, queue production, and operation
  state.
- Tokyo-worker owns only exact translated locale overlay storage.
- There is no active account-widget translation generation queue binding.
- Runtime target payloads are widget-generic saved text fields, including stable
  identity keys, current paths, labels, roles, base text, source basis, and saved
  base content markers.
- The active product generation command currently returns unavailable because
  San Francisco does not yet expose the async generation owner endpoint.
- The HTTP `translate-saved-instance` endpoint remains for direct diagnostics and tests; it is not the active save/generate product orchestration boundary.
- Localization prompts preserve source acronym style and must not add parenthetical acronym expansions that were not present in source text (especially headings/titles).
- Richtext translation uses one structured path: San Francisco extracts visible text segments, translates those strings only, rebuilds the original HTML, then validates placeholder parity, HTML tag parity, and anchor integrity.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same request/token enforcement + provider/model allowlist). Instance Translation must not set local token or timeout caps that override the signed grant; `ck-policy` is the model and budget authority for each queued job.

## Prague posture
- Prague does not own the account-widget locale runtime.
- Public widget package files are public artifacts, not San Francisco output. San Francisco produces translated values only; it does not write public widget files.
- San Francisco must not write Prague overlay files or resurrect a Prague-specific widget localization path.

## Rules
- Agent writes must not invent paths, patch formats, readiness state, or layer
  authoring surfaces.
- The active locale overlay stores concrete primitive values only.
- Tokyo-worker must not own translation generation state, queue production, AI
  policy, or completion/failure state.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
