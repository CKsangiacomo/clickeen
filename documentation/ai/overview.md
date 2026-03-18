STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes the current boundary between product/backend grant issuers and San Francisco.
Runtime code + `supabase/migrations/` + deployed Cloudflare config are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

# System: San Francisco — AI Workforce Operating System

## The Workforce OS

**Clickeen is an AI-first company.** San Francisco is not just a feature—it's the **operating system for the company's AI workforce**.

Traditional SaaS companies need full teams to operate at scale—sales, support, marketing, localization, ops. Clickeen operates with **1 human + AI agents**:

| Agent | Role | Replaces |
|-------|------|----------|
| SDR Copilot | Convert visitors in Minibob | Sales team |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team |
| Content Writer | Blog, SEO, help articles | Content team |
| UI Translator | Product localization | Localization team |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE |

**Every agent learns automatically** from outcomes—improving prompts, accumulating golden examples, and evolving over time. Day 1 agents are mediocre. Day 100 agents are excellent.

See also:
- `learning.md` — How agents learn from outcomes
- `infrastructure.md` — Sessions, jobs, state management
- `BUILD_Widget.md` — AI execution guide for widget definitions
- `BUILD_PraguePage.md` — AI execution guide for Prague page composition

---

## Technical Purpose

San Francisco is Clickeen's **AI execution service**: it runs copilots and operational agents at scale, calling LLM providers and returning strictly-structured outputs.

At GA scale (100s of widgets, millions of installs), San Francisco must be **isolated** from:
- product/auth/persistence authority in Roma/Berlin/Tokyo
- The editor’s real-time in-memory edit loop

## The Core Boundary (Non‑Negotiable)

### Product Backend Surfaces (Policy + Persistence)
Roma/Bob are the trusted backend surfaces that issue short-lived grants for their own product paths.
- Berlin mints auth/session/account truth
- Roma owns authenticated product-path grant issuance
- Bob owns public MiniBob grant issuance
- Tokyo/Tokyo-worker own saved/artifact truth
- Audit/billing-oriented usage records stay outside San Francisco

Boundary (explicit ownership):
- LLM provider keys and model execution live in San Francisco.
- Agent orchestration (routing, prompts, tools) lives in San Francisco.

### San Francisco (Execution + Orchestration)
San Francisco is the **AI runtime**.
- Holds provider keys
- Chooses provider/model for a given **Agent** within the constraints of the **AI Grant**
- Enforces AI execution limits (tokens/$ budgets, concurrency, timeouts)
- Executes agents (copilot, support, community manager, etc.)
- Returns **structured results + usage metadata**

Boundary (explicit ownership):
- Policy, entitlements, and persistence live outside San Francisco in the trusted product/account owners.
- San Francisco executes based on the AI Grant + request payload and returns structured results.

## Tiered Access Control (The "AI Profile")
As of PRD 041, LLM access is strictly tiered. The grant issuer resolves the caller's entitlement to an **AI Profile** during grant issuance:

| AI Profile | Target User | Default Access | Performance |
|------------|-------------|----------------|-------------|
| `free_low` | Free / Minibob | Policy default `deepseek -> deepseek-chat` (Minibob public mint may request `amazon -> nova-2-lite-v1`) | Fast, low-cost |
| `paid_standard` | Tier 1 (Basic) | Policy default `openai -> gpt-5-mini` (plus DeepSeek, Claude Sonnet, Groq Llama, Nova where agent allows) | Balanced |
| `paid_premium` | Tier 2+ (Pro) | Policy default `openai -> gpt-5.2` (plus DeepSeek Reasoner, Claude Sonnet, Groq Llama, Nova where agent allows) | Higher quality |
| `curated_premium`| Internal/Special | Policy default `openai -> gpt-5.2` (OpenAI curated set) | Max capability |

San Francisco enforces this profile by:
1.  Receiving the `ai.profile` in the Grant.
2.  Resolving the allowed `Provider` and `Model` list for that profile.
3.  Rejecting requests for providers/models not allowed by the profile.

Widget copilot routing (shipped):
- `minibob` + `free` resolve to `sdr.widget.copilot.v1`
- `tier1`/`tier2`/`tier3` resolve to `cs.widget.copilot.v1`
- Callers may request the alias `widget.copilot.v1`; the grant issuer resolves it by profile.
- DevStudio Entitlements now exposes both profile-level model access and per-agent runtime access so provider/model differences are explicit.
- Runtime behavior is policy-scoped by agent role (shared infra, separate behavior packs):
  - `sdr.widget.copilot.v1`: FAQ-only SDR workflow (rewrite existing Q&A or personalize from one website URL with consent). Non-supported requests return seller guidance + signup CTA.
  - `cs.widget.copilot.v1`: in-product editor copilot (control-driven edits, task-completion clarifications, no SDR website/seller loop).

Deployment status (code-synced on February 26, 2026; last cloud-dev smoke notes from February 11, 2026):
- Local target behavior: browser calls `POST /api/ai/widget-copilot`.
- Cloud-dev current behavior: `https://bob.dev.clickeen.com/api/ai/widget-copilot` is live (after Bob Pages deploy).
- Verified post-deploy routing on cloud-dev:
  - free workspace -> `meta.promptRole = "sdr"`
  - tier3 workspace -> `meta.promptRole = "cs"`
  - forcing `agentId = "sdr.widget.copilot.v1"` on paid tiers is canonicalized back to CS by the grant issuer.

## Why This Separation Exists (GA Reality)
At scale, AI workloads are bursty, slow, and failure-prone; instance APIs must remain boring and stable.
Keeping product/persistence owners and San Francisco separate prevents:
- AI incidents from degrading instance CRUD/publish
- Frequent AI changes from forcing risky deploys of core DB logic
- Agent-security concerns (prompt injection, tool permissions) from expanding product/backend attack surface

## Key Product Invariants
- **Editor is strict**: invalid edits are rejected immediately and surfaced.
- **AI edits are machine diffs**: editor agents return `ops[]` rather than prose instructions.
- **Provider selection is explicit**: outages return explicit errors.
- **Provider calls are server-side**: browsers talk only to Clickeen surfaces.

## Terms (Precise)
- **Agent**: A named AI capability (e.g. `editor.faqAnswer`, `support.reply`, `ops.communityModeration`).
- **AI Grant**: A signed authorization payload from a Clickeen backend surface (Roma for account-mode product flows, Bob for MiniBob/public flows) that defines what San Francisco is allowed to do for a subject for a short time window.
- **Execution Request**: The payload sent to San Francisco containing `agentId`, input, and the AI Grant.
- **Result**: Structured output from San Francisco (`ops[]` for editor agents, or a typed payload for non-editor agents).
- **Playbook**: A versioned runtime contract attached to an `agentId` via the registry (server-resolved, not client-selected).

## High‑Level Data Flow

### Editor agents (inside Clickeen app)
1) Core Builder open now loads through one Roma same-origin route (`GET /api/builder/:publicId/open`) that resolves the saved authoring revision + localization snapshot server-side for Roma message boot. Explicit localization refresh/status commands still use Roma same-origin account routes where needed; Bob URL boot remains only for non-account surfaces.
2) Account-mode Builder requests execute through Roma instance routes; public MiniBob requests execute through Bob same-origin routes. The owning surface mints the short-lived AI Grant inline for that request.
3) Bob calls San Francisco with `{ grant, agentId, input, context }`.
4) San Francisco returns `{ ops[], usage }`.
5) Bob applies `ops[]` locally as pure state transforms. If an op cannot be applied, Bob fails loudly (platform bug) and the developer fixes the widget/package or copilot output.

### Operational agents (Clickeen’s internal workforce)
- A worker (or scheduled job) triggers an execution request to San Francisco using a **service grant** issued by a trusted Clickeen backend surface.
- Result is used to create tickets, draft responses, or propose actions (depending on the agent’s permissions/tools).

## Runtime Reality (what’s actually shipped)

San Francisco is deployed as a **Cloudflare Worker** and currently ships:

- Endpoints:
  - `GET /healthz`
- `POST /v1/execute` (requires a Clickeen-signed AI Grant)
- `POST /v1/outcome` (outcome attach, signed by the calling Clickeen backend surface)
  - `POST /v1/personalization/onboarding` (internal legacy route name for post-signup account-context carry-forward; `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`)
  - `GET /v1/personalization/onboarding/:jobId` (internal legacy route name; polls the same post-signup account-context carry-forward job; `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`)
  - `POST /v1/l10n/account/ops/generate` (internal Tokyo-worker instance-sync path; `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`)
  - `POST /v1/l10n/translate` (local + cloud-dev only; `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`; `ENVIRONMENT in {local,dev}`)
- Cloudflare bindings:
  - `SF_KV` (sessions + job records)
  - `SF_EVENTS` (queue for async event ingestion)
  - `SF_D1` (queryable indexes)
  - `SF_R2` (raw event storage)
- Agent IDs currently recognized by the worker:
  - `sdr.copilot`
  - `sdr.widget.copilot.v1`
  - `cs.widget.copilot.v1`
  - `l10n.instance.v1`
  - `l10n.prague.strings.v1`
  - `agent.personalization.onboarding.v1`
  - `debug.grantProbe` (dev only)
  - `POST /v1/execute` currently wires executors for: `sdr.copilot`, `sdr.widget.copilot.v1`, `cs.widget.copilot.v1`, `debug.grantProbe`.

This matters because the “learning loop” is not theoretical: every `/v1/execute` call enqueues an `InteractionEvent`, and the queue consumer writes raw payloads to R2 + indexes a small subset into D1.

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
  iss: 'clickeen';
  jti?: string; // unique grant id (used for per-grant budget tracking)
  sub:
    | { kind: 'anon'; sessionId: string } // Minibob / public experiences
    | { kind: 'user'; userId: string; accountId: string } // Clickeen app
    | { kind: 'service'; serviceId: string }; // internal automation
  exp: number; // epoch seconds
  caps: string[]; // allowed capabilities, e.g. ['agent:sdr.copilot']
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number; // optional session window
  };
  mode: 'editor' | 'ops'; // editor copilots vs operational agents
  ai?: {
    profile: 'free_low' | 'paid_standard' | 'paid_premium' | 'curated_premium';
    allowedProviders: Array<'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon'>;
    selectedProvider?: 'deepseek' | 'openai' | 'anthropic' | 'groq' | 'amazon';
    selectedModel?: string;
    allowProviderChoice?: boolean;
    allowModelChoice?: boolean;
  };
  trace: { sessionId?: string; instancePublicId?: string };
};
```

#### Grant format (shipped)

San Francisco verifies grants using an HMAC signature shared across trusted Clickeen grant issuers (`AI_GRANT_HMAC_SECRET`).

Format:
`v1.<base64url(payloadJson)>.<base64url(hmacSha256("v1.<payloadB64>", AI_GRANT_HMAC_SECRET))>`

### Results (from San Francisco)
San Francisco always returns a **structured** result (never prose instructions).
- Editor agents return `ops[]` only.
- Non-editor agents return a typed JSON payload per agent.
```ts
type EditorAIResult = {
  requestId: string;
  ops: Array<{ op: 'set' | 'insert' | 'remove' | 'move'; path: string; value?: unknown; index?: number; from?: number; to?: number }>;
  usage: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd?: number;
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
  | { code: 'PROVIDER_ERROR'; message: string; provider: string }
  | { code: 'BAD_REQUEST'; message: string; issues?: Array<{ path: string; message: string }> };
```

## Public Interfaces

### Roma + Bob (current AI entry surfaces)
Shipped in this repo:
1) **Account-mode product AI**
   - Roma owns authenticated Builder Copilot execution on instance-scoped account routes.
   - Roma consumes Berlin-minted account truth, mints the request-scoped AI Grant, and calls San Francisco directly.
2) **MiniBob/public AI**
   - Bob owns `POST /api/ai/minibob/session`, `POST /api/ai/widget-copilot`, and `POST /api/ai/outcome` for public MiniBob flows.
   - Bob mints the MiniBob session token, mints the request-scoped MiniBob AI Grant inline, and forwards outcomes directly to San Francisco.

### San Francisco (AI execution service endpoints)
This is a separate deployable service (Cloudflare Workers) from day one.

#### `GET /healthz`
Health check for deploys and local dev.

Response: `{ ok: true, service: "sanfrancisco", env: "dev|prod|...", ts: <ms> }`

#### `POST /v1/execute`
Execute an agent under a Clickeen-issued grant.

Request:
```json
{
  "grant": "<string>",
  "agentId": "widget.copilot.v1",
  "input": {},
  "trace": { "requestId": "optional-uuid", "client": "minibob|bob|ops" }
}
```

Response:
```json
{ "requestId": "uuid", "agentId": "cs.widget.copilot.v1", "result": {}, "usage": {} }
```

Behavior:
- verifies grant signature + expiry
- asserts capability `agent:${agentId}` (aliases are resolved to canonical IDs)
- executes the agent
- enqueues an `InteractionEvent` into `SF_EVENTS` (non-blocking)

#### `POST /v1/outcome`
Attach post-execution outcomes (UX decisions, conversions) that San Francisco cannot infer.

- Request: `OutcomeAttachRequest` (see `sanfrancisco/src/types.ts`)
- Auth: required header `x-clickeen-signature` = `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`
- Writes: D1 rows in `copilot_outcomes_v1`

Why it exists: San Francisco can’t infer conversions; Roma/Bob are the sources of truth for those moments.

## Agent Orchestration (San Francisco Core)
Orchestration is San Francisco’s “meat” and is built incrementally behind the same execution interface.

Phase‑1 (shipped orchestration surface):
- Multiple agents behind the same `/v1/execute` interface:
  - `sdr.copilot`
  - `sdr.widget.copilot.v1` / `cs.widget.copilot.v1` (profile-resolved widget editing Copilot)
  - `debug.grantProbe` (dev only)
- Provider/model policy is explicit per agent/profile; runtime may retry retryable upstream failures across grant-allowed selections, and returns typed errors when retries are exhausted.
- No general “tool” system yet; any extra capabilities must be explicitly implemented inside the agent (for example: widget copilot includes bounded, SSRF-guarded single-page URL reads + Cloudflare HTML detection).
- Always returns structured JSON (never “go edit X” prose), plus usage metadata.

GA roadmap (still behind the same interface):
- Agent registry (configs in code or a San Francisco-owned store)
- Provider/model selection rules per agent (explicit, versioned)
- Tool allowlists per agent (e.g. `tool:analyzeUrl`, `tool:searchDocs`)
- Background execution for operational agents (queues/workers)

## Limits (Paris vs San Francisco)

### Paris limits (product policy)
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
- San Francisco enforces per-request budgets and concurrency.
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

- Raw event payloads (R2): `logs/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`
- Queryable indexes (D1):
  - `copilot_events_v1` (one row per interaction; versions + intent/outcome + basic deltas)
  - `copilot_outcomes_v1` (one row per `requestId+event`; attached by Paris/Bob)

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
  - Health endpoint and base `POST /v1/execute` handler exists (returns typed errors).

### Milestone 2 — Ship `sdr.copilot` (Minibob)
Status: shipped

Definition of done:
  - `agentId: sdr.copilot` works end-to-end in San Francisco
  - Response is structured JSON + usage metadata (no prose-only responses)

### Milestone 3 — Paris issues AI grants (anon + user)
Status: shipped (dev grants; user/workspace grants evolve with auth)

Definition of done:
  - Clickeen backend surfaces can issue signed grants for:
    - anon sessions (MiniBob via Bob)
    - account sessions (product app via Roma)
  - San Francisco verifies signature + expiry + capabilities

**Minibob public mint (shipped):**
- `POST /api/ai/minibob/session` on Bob → returns a server-signed `sessionToken` (prevents infinite client-generated sessionIds).
- `POST /api/ai/widget-copilot` on Bob verifies that token and mints the restricted MiniBob grant inline before calling San Francisco.
- Cloudflare edge rate limits + bot controls are required in non-local stages (manual ops).

### Milestone 4 — Bob uses San Francisco for AI
Status: shipped

Definition of done:
- Bob no longer calls provider APIs directly.
- Account-mode Builder calls San Francisco through Roma-owned backend routes.
- MiniBob/public calls San Francisco through Bob-owned same-origin routes.
- Errors are explicit; no silent behavior changes.

### Milestone 5 — Remove Bob-local AI route
Status: shipped (implemented as thin proxies)

Definition of done:
- Legacy compatibility AI routes are removed.
- `bob/app/api/ai/widget-copilot` is the only Copilot execution path.

## Open Questions (next)
- Where AI usage is recorded for billing: backend-owned ledger in Roma/Berlin, or a later aggregation pipeline.

## Links
- Paris system PRD: `documentation/services/paris.md`
- Bob system PRD: `documentation/services/bob.md`
- Widget Copilot rollout runbook: `documentation/ai/widget-copilot-rollout.md`
