STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes the current boundary between product/backend grant issuers and San Francisco.
Runtime code + `supabase/migrations/` + deployed Cloudflare config are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

# System: Clickeen AI

## The Workforce OS

**Clickeen is an AI-first company.** The AI workforce is built from named agent
homes plus San Francisco model execution. San Francisco is not the Product
Copilot brain.

Traditional SaaS companies need full teams to operate at scale—sales, support, marketing, localization, ops. Clickeen operates with **1 human + AI agents**:

| Agent | Role | Replaces |
|-------|------|----------|
| Builder Copilot | Help account users customize widgets | Product specialists |
| Widget Instance Translator | Translate saved widget instances into enabled locales | Localization team |

Agents do not silently learn in production. San Francisco captures traces and
surface-owned outcomes so evals/review can improve prompts, models, tools, and
policies through an explicit release/rollback path.

See also:
- `learning.md` — How agents learn from outcomes
- `infrastructure.md` — Sessions, agent execution state management
- `BUILD_Widget.md` — AI execution guide for widget definitions
- `BUILD_PraguePage.md` — AI execution guide for Prague widget marketing JSON

---

## Technical Purpose

San Francisco is Clickeen's **AI engine**: it verifies grants, routes model
calls, enforces runtime policy, records trace metadata, and returns governed
model output to named agent homes.

Product Copilot brain/runtime code lives in the isolated
`agents/product-copilot/` Cloudflare Worker. Bob/Roma invoke it for Builder
turns; San Francisco only executes its governed model calls.

Translation Agent brain code lives in `agents/translation-agent/`. Its current
diagnostic execution path still runs through San Francisco and is realigned in
the Translation Agent slice; product workflows own overlay acceptance and
storage.

At GA scale (100s of widgets, millions of installs), San Francisco must be **isolated** from:
- product/auth/persistence authority in Roma/Berlin/Tokyo
- The editor’s real-time in-memory edit loop

## The Core Boundary (Non‑Negotiable)

### Product Backend Surfaces (Policy + Persistence)
Roma and San Francisco internal services are the trusted backend surfaces that issue short-lived grants for their own product paths.
- Berlin mints auth/session/account truth
- Roma owns authenticated product-path grant issuance
- Tokyo/Tokyo-worker own saved/artifact truth
- Audit/billing-oriented usage records stay outside San Francisco

Boundary (explicit ownership):
- LLM provider keys and model execution live in San Francisco.
- Model/provider execution and runtime policy enforcement live in San Francisco.
  Product-specific agent brains live in their own homes.

### San Francisco (Execution + Orchestration)
San Francisco is the **AI engine and model-execution boundary**.
- Holds provider keys
- Chooses provider/model for a given **Agent** within the constraints of the **AI Grant**
- Enforces AI execution limits (tokens/$ budgets, concurrency, timeouts)
- Executes model calls for known agents
- Returns **model output + usage metadata**

Boundary (explicit ownership):
- Policy, entitlements, and persistence live outside San Francisco in the trusted product/account owners.
- San Francisco executes model calls based on the AI Grant + request payload and
  returns model output. Agent reasoning lives in the agent home.

## Runtime Policy Access Control
LLM access is strictly tiered, but San Francisco does not receive a hidden access label. The grant issuer resolves real account entitlements plus the agent ID into a signed `AgentRuntimePolicy` during grant issuance.

The policy contains direct execution truth:

- `defaultModel`
- `modelsByProvider`
- optional `selectedModel`
- model-picker permission
- token, turn, and timeout ceilings
- learning-capture rules
- `policyVersion`

San Francisco enforces this policy by:
1. Verifying the signed grant.
2. Rejecting providers/models outside `modelsByProvider`.
3. Rejecting selected models when the account policy does not allow a picker.
4. Enforcing token, turn, and timeout ceilings from the grant.

Widget copilot routing (shipped):
- Account Builder uses `cs.widget.copilot.v1`
- Roma mints the request grant server-side for the account route.
- DevStudio Entitlements exposes the model catalog and per-agent runtime policy by tier; it does not create a separate AI access truth.
- Runtime behavior is policy-scoped by agent id:
  - `cs.widget.copilot.v1`: Product Copilot in Builder, using the isolated
    `product-copilot` brain and Bob-owned draft validation/apply.

Deployment status (code-synced on February 26, 2026; last cloud-dev smoke notes from February 11, 2026):
- Local + cloud-dev target behavior: browser calls `POST /api/account/instances/:instanceId/copilot` on Roma.
- Verified post-deploy routing on cloud-dev:
  - account Builder requests execute through Roma instance routes
  - widget-copilot alias resolves to CS on the live product path

## Why This Separation Exists (GA Reality)
At scale, AI workloads are bursty, slow, and failure-prone; instance APIs must remain boring and stable.
Keeping product/persistence owners and San Francisco separate prevents:
- AI incidents from degrading instance CRUD/publish
- Frequent AI changes from forcing risky deploys of core DB logic
- Agent-security concerns (prompt injection, tool permissions) from expanding product/backend attack surface

## Key Product Invariants
- **Editor is strict**: invalid edits are rejected immediately and surfaced.
- **Product Copilot is conversational**: it returns one typed result kind:
  `answer`, `clarification`, `suggestion`, `draft_edit`, `refusal`, or `error`.
- **Draft edits are machine diffs**: `draft_edit` returns reversible ops that
  Bob validates against the live browser-memory draft before applying.
- **Provider selection is explicit**: outages return explicit errors.
- **Provider calls are server-side**: browsers talk only to Clickeen surfaces.

## Terms (Precise)
- **Agent**: A named Clickeen worker with an agent home, context contract,
  output contract, validation boundary, runtime policy, and trace/eval record.
- **AI Grant**: A signed authorization payload from a trusted Clickeen backend surface (Roma for account-mode product flows, San Francisco internal services for service work) that defines what model execution San Francisco is allowed to do for a subject for a short time window.
- **Agent Execution Request**: The payload sent to an agent home containing the agent input and AI Grant.
- **Model Call Request**: The payload an agent home sends to San Francisco containing `agentId`, model messages, and the AI Grant.
- **Result**: Structured output from an agent home (`draft_edit` ops for editor agents, or a typed payload for non-editor agents). San Francisco returns model content plus usage metadata to the agent home.
- **Playbook**: A versioned runtime contract attached to an `agentId` via the registry (server-resolved, not client-selected).

## High‑Level Data Flow

### Editor agents (inside Clickeen app)
1) Core Builder open now loads through one Roma same-origin route (`GET /api/builder/:instanceId/open`) that resolves the saved authoring revision server-side for Roma's host-open flow. Account-mode save delegates back to Roma through `PUT /api/account/instances/:instanceId`. Builder no longer carries localization refresh/status commands on the active account authoring path.
2) Account-mode Builder requests execute through Roma instance routes. Roma validates account/widget authority, mints the short-lived AI Grant inline for that request, and calls the Product Copilot worker.
3) The Product Copilot worker runs the agent brain and calls San Francisco with `{ grant, agentId, messages }` only when it needs governed model output.
4) San Francisco verifies the grant, applies policy, routes the model call, emits trace metadata, and returns model content plus usage metadata.
5) Product Copilot returns the typed agent result to Roma/Bob.
6) Bob validates/applies draft edit actions locally as pure state transforms. If an op cannot be applied, Bob fails loudly.

### System agents (Clickeen’s internal workforce)
- A trusted backend surface triggers an explicit system-agent execution request to San Francisco.
- Result is used by the owning system boundary, such as widget translation overlays or Prague copy output.

## Runtime Reality (what’s actually shipped)

San Francisco is deployed as a **Cloudflare Worker** and currently ships:

- Endpoints:
  - `GET /healthz`
- `POST /v1/model/chat` (requires a Clickeen-signed AI Grant)
- `POST /v1/execute` (deprecated; returns visible 410)
- `POST /v1/outcome` (outcome attach, signed by the calling Clickeen backend surface)
- Account-widget l10n generation currently returns unavailable until San
  Francisco owns a real async generation endpoint.
- `POST /v1/l10n/translate` (local + cloud-dev only; HMAC body signature; `ENVIRONMENT in {local,dev}`)
- Cloudflare bindings:
  - `SF_KV` (San Francisco-owned state needs; Product Copilot sessions are not stored in San Francisco KV)
  - `SF_EVENTS` (queue for async event ingestion)
  - `SF_D1` (queryable indexes)
  - `SF_R2` (raw event storage)
- AI surfaces currently recognized by the worker:
  - `cs.widget.copilot.v1`
  - `widget.instance.translator`

This matters because the trace/eval foundation is not theoretical: every
`/v1/model/chat` call enqueues an `InteractionEvent`, and the queue consumer writes
eligible raw payloads to R2 + indexes a small subset into D1. Captured traces do
not mutate prompts, models, tools, or policy without eval/review/release.

## Contracts

### AI Grant
A trusted Clickeen backend surface computes grants from paid/free entitlements and returns a **signed** token to the caller.

Requirements:
- San Francisco MUST verify the signature and expiry.
- Grants are short-lived (minutes), scoped (capabilities), and revocable by key rotation.
- Grants encode only allowed capabilities/budgets; pricing-tier rules live elsewhere.

Shape (conceptual):
```ts
type AIGrant = {
  v: 1;
  iss: 'roma' | 'sanfrancisco';
  jti?: string; // unique grant id (used for per-grant budget tracking)
  sub:
    | { kind: 'user'; userId: string; accountId: string } // Clickeen app
    | { kind: 'service'; serviceId: string }; // internal automation
  exp: number; // epoch seconds
  caps: string[]; // allowed capabilities, e.g. ['agent:cs.widget.copilot.v1']
  budgets: {
    maxTokens: number;
    timeoutMs: number;
  };
  mode: 'editor' | 'ops'; // editor copilots vs operational agents
  ai?: {
    agentId: string;
    enabled: boolean;
    defaultModel: { provider: string; model: string };
    modelsByProvider: Record<string, { defaultModel: string; allowed: string[] }>;
    allowModelPicker: boolean;
    selectedModel?: { provider: string; model: string };
    maxTokensPerCall: number;
    maxTurnsPerThread: number;
    maxMonthlyTurns: number | null;
    timeoutMs: number;
    policyVersion: string;
  };
  trace: { sessionId?: string; instanceId?: string; surfaceId?: string };
};
```

#### Grant format (shipped)

San Francisco verifies grants using an HMAC signature shared across trusted Clickeen grant issuers (`AI_GRANT_HMAC_SECRET`), currently Roma and San Francisco internal services.

Format:
`v1.<base64url(payloadJson)>.<base64url(hmacSha256("v1.<payloadB64>", AI_GRANT_HMAC_SECRET))>`

### Results (from agent homes)
Agent homes always return a **structured** result (never untyped prose
instructions).
- Product Copilot returns the typed union `answer | clarification | suggestion
  | draft_edit | refusal | error`; only `draft_edit` carries ops.
- Non-editor agents return a typed JSON payload per agent.
San Francisco returns governed model content plus usage metadata to agent homes;
it does not return Product Copilot's typed union to Roma/Bob.
```ts
type EditorAIResult = {
  requestId: string;
  ops: Array<{ op: 'set' | 'insert' | 'remove' | 'move'; path: string; value?: unknown; index?: number; from?: number; to?: number }>;
  usage: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    latencyMs: number;
  };
};
```

### Errors (explicit, typed)
No silent behavior changes. All failures are explicit.
```ts
type AIError =
  | { code: 'GRANT_INVALID'; message: string }
  | { code: 'GRANT_EXPIRED'; message: string }
  | { code: 'CAPABILITY_DENIED'; message: string }
  | { code: 'BUDGET_EXCEEDED'; message: string }
  | { code: 'PROVIDER_ERROR'; message: string; provider: string; upstreamStatus?: number }
  | { code: 'BAD_REQUEST'; message: string; issues?: Array<{ path: string; message: string }> };
```

## Public Interfaces

### Roma + Bob (current AI entry surfaces)
Shipped in this repo:
1) **Account-mode product AI**
   - Roma owns authenticated Builder Copilot execution on instance-scoped account routes.
   - Roma consumes Berlin-minted account truth, mints the request-scoped AI Grant, and calls the Product Copilot worker.
   - The Product Copilot worker calls San Francisco only for governed `/v1/model/chat`.
2) **Prague demo**
   - Prague demo is not a live AI execution surface in the current product path.
   - Minibob no longer has Bob-owned public Copilot/session routes.

### San Francisco (AI execution service endpoints)
This is a separate deployable service (Cloudflare Workers) from day one.

#### `GET /healthz`
Health check for deploys and local dev.

Response: `{ ok: true, service: "sanfrancisco", env: "dev|prod|...", ts: <ms> }`

#### `POST /v1/model/chat`
Execute one governed model call for an agent home under a Clickeen-issued grant.

Request:
```json
{
  "grant": "<string>",
  "agentId": "cs.widget.copilot.v1",
  "messages": [],
  "trace": { "requestId": "optional-uuid", "client": "product-copilot" }
}
```

Response:
```json
{ "requestId": "uuid", "agentId": "cs.widget.copilot.v1", "content": "...", "usage": {} }
```

Behavior:
- verifies grant signature + expiry
- asserts capability `agent:${agentId}` (aliases are resolved to canonical IDs)
- executes the provider/model call under the signed runtime policy
- enqueues an `InteractionEvent` into `SF_EVENTS` (non-blocking)

#### `POST /v1/outcome`
Attach post-execution outcomes (UX decisions, conversions) that San Francisco cannot infer.

- Request: `OutcomeAttachRequest` (see `sanfrancisco/src/types.ts`)
- Auth: required header `x-clickeen-signature` = `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`
- Writes: D1 rows in `copilot_outcomes_v1`

Why it exists: San Francisco can’t infer conversions; Roma/Bob are the sources of truth for those moments.

## Agent Homes And Model Execution

Phase-1 shipped surface:
- Product Copilot has its own worker home in `agents/product-copilot/`.
- Provider/model policy is explicit per agent and account tier. The current
  `/v1/model/chat` path makes one provider call per request, returns typed
  provider errors, and does not silently cross-switch providers or models.
  Retry behavior is future explicit work.
- No general tool system exists.
- San Francisco returns model content plus usage metadata; the agent home
  returns the typed agent result.

GA roadmap (still behind the same interface):
- Agent registry (configs in code or a San Francisco-owned store)
- Provider/model selection rules per agent (explicit, versioned)
- Tool allowlists per agent (e.g. `tool:analyzeUrl`, `tool:searchDocs`)
- Background execution for operational agents (queues/workers)

## Limits (Product Policy vs San Francisco)

### Product policy limits
Examples:
- can the user access Copilot at all?
- free vs paid feature gates
- product usage limits (views/installs/widgets)

### San Francisco limits (AI execution)
Examples:
- per-agent concurrency and throughput
- token/$ budgets per grant/session
- provider quotas and timeouts

These are different classes of limits and must not be mixed.

## Security
- San Francisco verifies grant signatures and expiry.
- San Francisco enforces capability allowlists from the grant.
- San Francisco enforces token limits, timeouts, and concurrency.
- Bob never receives provider keys.

## Operational Specs (shipped)

### Concurrency guard
San Francisco applies a per-isolate in-flight cap to fail fast under load.
If the cap is exceeded, the worker returns `429` with `BUDGET_EXCEEDED` (this prevents tail-latency collapse).

### Event ingestion (best-effort by design)
Execution responses must not block on logging/indexing. The queue pipeline is intentionally best-effort:
- failures are logged to console
- execution still returns a structured result

### Storage layout (shipped)

- Bounded raw learning samples (R2): `learning/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`
- Queryable indexes (D1):
  - `copilot_events_v1` (one row per interaction; versions + intent/outcome + basic deltas)
  - `copilot_outcomes_v1` (one row per `requestId+event`; attached by Roma/Bob)

## Roadmap (milestones)

This section is a planning artifact. The shipped reality is captured in:
- “Runtime Reality (what’s actually shipped)” (above)
- `documentation/ai/infrastructure.md`
- `documentation/ai/learning.md`

### Milestone 0 — Documentation cleanup
Status: shipped (ongoing)

Definition of done:
- System boundary docs exist and are kept in sync with shipped code.
- Older narrative docs remain allowed, but must not be mistaken for runtime truth.

### Milestone 1 — San Francisco service scaffold
Status: shipped

Definition of done:
  - New service deployable exists (Cloudflare Workers).
  - Health endpoint and base `POST /v1/model/chat` handler exists.

### Milestone 2 — Ship Builder Copilot
Status: shipped

Definition of done:
  - `agentId: cs.widget.copilot.v1` works end-to-end through the Product
    Copilot worker, with San Francisco only providing governed `/v1/model/chat`.
  - Response is structured JSON + usage metadata (no prose-only responses)

### Milestone 3 — Product backends issue AI grants
Status: shipped

Definition of done:
  - Clickeen backend surfaces can issue signed grants for:
    - account sessions (product app via Roma)
  - San Francisco verifies signature + expiry + capabilities

Minibob no longer owns a public AI grant/session mint on Bob.

### Milestone 4 — Bob uses Product Copilot through Roma
Status: shipped

Definition of done:
- Bob no longer calls provider APIs directly.
- Account-mode Builder calls the Product Copilot worker through Roma-owned
  backend routes. The Product Copilot worker calls San Francisco for governed
  `/v1/model/chat`.
- Errors are explicit; no silent behavior changes.

### Milestone 5 — Remove Bob-local AI route
Status: shipped (implemented as thin proxies)

Definition of done:
- Legacy compatibility AI routes are removed.
- Roma account instance routes are the only live Copilot execution path.

## Open Questions (next)
- Where AI usage is recorded for billing: backend-owned ledger in Roma/Berlin, or a later aggregation pipeline.

## Links
- Bob system PRD: `documentation/services/bob.md`
- Widget Copilot rollout runbook: `documentation/ai/widget-copilot-rollout.md`
