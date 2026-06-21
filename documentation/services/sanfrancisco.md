# System: San Francisco - AI Engine

## Identity
- Tier: Core
- Purpose: governed model execution, provider routing, usage/trace capture, and
  AI outcome ingestion. San Francisco does not execute Product Copilot brain
  logic.

## Interfaces
- `GET /healthz`
- `POST /v1/model/chat` for governed model execution under a signed AI grant.
- `POST /v1/outcome` for post-execution Product Copilot outcomes.
- Queue consumers for agent jobs.
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

## Model execution (shipped)
- Endpoint: `POST /v1/model/chat`.
- Requires a Clickeen-signed grant; enforces `agent:*` caps and `ai` policy capsule.
- Grant verification accepts the active internal Clickeen issuers `roma` and `sanfrancisco`.
- Product Copilot brain execution lives in the `product-copilot` worker. Roma
  calls that worker; that worker calls San Francisco only for model execution.
- Agent/model routing uses registry canonical IDs.
- Provider execution does not silently switch models or providers. The current
  `/v1/model/chat` path makes one provider call per request; retry behavior is
  future explicit work.
- Provider request shape comes from the explicit shared AI model capability table (`ck-contracts`), not provider/model string heuristics.
- Provider errors returned to product callers are typed `PROVIDER_ERROR` responses with safe messages and optional upstream status; raw upstream bodies are not product payloads.
- OpenAI responses are normalized across string/array/refusal content shapes before being treated as empty output.
- Live product widget-copilot canonical ID:
  - `cs.widget.copilot.v1` (account Builder editor copilot)
- The Roma grant issuer mints the live account Builder copilot grant for `cs.widget.copilot.v1`.
- Product Copilot brain code and worker entrypoint live in the isolated
  `agents/product-copilot/` workspace.
- Translation Agent brain code lives in `agents/translation-agent/`. San
  Francisco keeps the existing translation diagnostic endpoint until the
  Translation Agent slice moves that execution path into its own worker home.
- Product Copilot uses the `product-copilot.context.v1` capsule and typed output
  union: `answer`, `clarification`, `suggestion`, `draft_edit`, `refusal`, or
  `error`.
- Bob no longer pre-routes user language with regex/control matching before the
  Product Copilot brain reasons. Bob still owns live draft validation/apply.
- The Product Copilot brain fails visibly when the context capsule is malformed
  or too large. It does not truncate controls or current values silently.
- **Runtime policy execution:** Enforces the signed `AgentRuntimePolicy` from the grant: `defaultModel`, `modelsByProvider`, optional `selectedModel`, request ceilings, and learning-capture rules. Product/account policy decides the allowed model set before grant issuance.
- Product Copilot model execution through `/v1/model/chat` is stateless per call.
  San Francisco verifies the signed Roma grant, applies runtime policy, routes
  the provider/model call, emits usage/trace metadata, and returns. Product
  Copilot conversation/thread state does not live in San Francisco KV.
- Contract coverage now explicitly guards grant verification, budget enforcement, provider routing, and concurrency ceilings before further AI-plane sophistication lands.

`POST /v1/execute` is deprecated in San Francisco and returns a visible 410.
Product Copilot must be called through its own home. Translation Agent's
remaining San Francisco diagnostic execution path is a known transitional
exception owned by the Translation Agent realignment slice.

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
- Richtext translation uses one structured path: `agents/translation-agent/` extracts visible text segments, translates those strings only, and rebuilds the original HTML; neutral `@clickeen/l10n` safety primitives validate placeholder parity, HTML tag parity, and anchor integrity.
- l10n translation calls go through the shared policy router via `callChatCompletion` (same request/token enforcement + provider/model allowlist). Instance Translation must not set local token or timeout caps that override the signed grant; `ck-policy` is the model and budget authority for each queued job.

## Prague posture
- Prague does not own the account-widget locale runtime.
- Public widget package files are public artifacts, not San Francisco output. San Francisco produces translated values only; it does not write public widget files.
- San Francisco must not write Prague overlay files or resurrect a Prague-specific widget localization path.
- Prague system-string l10n may reuse neutral `@clickeen/l10n` safety primitives, but Prague remains a separate system-owned flow and maps safety failures back to San Francisco `PROVIDER_ERROR` responses.

## Rules
- Agent writes must not invent paths, patch formats, readiness state, or layer
  authoring surfaces.
- The active locale overlay stores concrete primitive values only.
- Tokyo-worker must not own translation generation state, queue production, AI
  policy, or completion/failure state.

## Links
- AI overview: `documentation/ai/overview.md`
- Localization contract: `documentation/capabilities/localization.md`
