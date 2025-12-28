STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for the AI system boundary between Paris and San Francisco.
It MUST NOT conflict with:
1) supabase/migrations/ (DB schema truth)
2) documentation/CONTEXT.md (Global terms and precedence)
3) documentation/systems/paris.md (Paris responsibilities + instance API)
If any conflict is found, STOP and escalate to CEO. Do not guess.

# System: San Francisco — AI Workforce Operating System

## The Workforce OS

**Clickeen is an AI-first company.** San Francisco is not just a feature—it's the **operating system for the company's AI workforce**.

Traditional SaaS companies need 30-100+ people to operate at scale. Clickeen operates with **1 human + AI agents**:

| Agent | Role | Traditional Equivalent |
|-------|------|------------------------|
| SDR Copilot | Convert visitors in Minibob | Sales team (5-20 people) |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team (5-15 people) |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team (3-10 people) |
| Content Writer | Blog, SEO, help articles | Content team (2-5 people) |
| UI Translator | Product localization | Localization team (5+ people) |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE (2-5 people) |

**Every agent learns automatically** from outcomes—improving prompts, accumulating golden examples, and evolving over time. Day 1 agents are mediocre. Day 100 agents are excellent.

See also:
- `sanfrancisco-learning.md` — How agents learn from outcomes
- `sanfrancisco-infrastructure.md` — Sessions, jobs, state management

---

## Technical Purpose

San Francisco is Clickeen's **AI execution service**: it runs copilots and operational agents at scale, calling LLM providers and returning strictly-structured outputs.

At GA scale (100s of widgets, millions of installs), San Francisco must be **isolated** from:
- Paris’s DB authority and product entitlements logic
- The editor’s real-time in-memory edit loop

## The Core Boundary (Non‑Negotiable)

### Paris (Policy + Persistence)
Paris is the **product authority** and **DB gateway**.
- Auth, workspace membership, paid/free entitlements
- View/install limits, widget count limits, publish permissions
- Instance read/write (Michael via Supabase service role)
- Audit/billing-oriented usage records
- Issues **AI Grants** (described below)

Paris must NOT:
- Hold LLM provider keys
- Run LLM calls
- Contain “agent orchestration” logic (routing, prompts, tools, etc.)

### San Francisco (Execution + Orchestration)
San Francisco is the **AI runtime**.
- Holds provider keys
- Chooses provider/model for a given **Agent** within the constraints of the **AI Grant**
- Enforces AI execution limits (tokens/$ budgets, concurrency, timeouts)
- Executes agents (copilot, support, community manager, etc.)
- Returns **structured results + usage metadata**

San Francisco must NOT:
- Query Michael directly
- Decide paid/free entitlements
- Silently change behavior (no hidden provider switching)

## Why This Separation Exists (GA Reality)
At scale, AI workloads are bursty, slow, and failure-prone; instance APIs must remain boring and stable.
Keeping Paris and San Francisco separate prevents:
- AI incidents from degrading instance CRUD/publish
- Frequent AI changes from forcing risky deploys of core DB logic
- Agent-security concerns (prompt injection, tool permissions) from expanding Paris’s attack surface

## Key Product Invariants
- **Editor is strict**: edits are valid or rejected immediately; no silent fixups.
- **AI edits are machine diffs**: San Francisco returns `ops[]` (never “go change X” prose).
- **No hidden provider switching**: if a provider is down, return an explicit error.
- **No browser provider calls**: browsers never talk to OpenAI/Anthropic/etc.

## Terms (Precise)
- **Agent**: A named AI capability (e.g. `editor.faqAnswer`, `support.reply`, `ops.communityModeration`).
- **AI Grant**: A signed authorization payload from Paris that defines what San Francisco is allowed to do for a subject (user/workspace) for a short time window.
- **Execution Request**: The payload sent to San Francisco containing `agentId`, input, and the AI Grant.
- **Result**: Structured output from San Francisco (`ops[]` for editor agents, or a typed payload for non-editor agents).

## High‑Level Data Flow

### Editor agents (inside Clickeen app)
1) Bob loads an instance via Paris (`GET /api/instance/:publicId`).
2) Paris returns instance + a short‑lived **AI Grant** for that editing session.
3) Bob calls San Francisco with `{ grant, agentId, input, context }`.
4) San Francisco returns `{ ops[], usage }`.
5) Bob applies `ops[]` via the strict edit engine (controls allowlist + type validation). If invalid → reject and show error.

### Operational agents (Clickeen’s internal workforce)
- A worker (or scheduled job) triggers an execution request to San Francisco using a **service grant** issued by Paris (or by an internal service issuer with Paris-level authority).
- Result is used to create tickets, draft responses, or propose actions (depending on the agent’s permissions/tools).

## Contracts

### AI Grant (issued by Paris)
Paris computes grants from paid/free entitlements and returns a **signed** token to the caller.

Requirements:
- San Francisco MUST verify the signature and expiry.
- Grants are short-lived (minutes), scoped (capabilities), and revocable by key rotation.
- Grants do not encode “paid/free rules” beyond allowed capabilities/budgets.

Shape (conceptual):
```ts
type AIGrant = {
  v: 1;
  iss: 'paris';
  sub:
    | { kind: 'anon'; sessionId: string } // Minibob / public experiences
    | { kind: 'user'; userId: string; workspaceId: string } // Clickeen app
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
  trace: { sessionId?: string; instancePublicId?: string };
};
```

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

### Paris (adds AI Grant issuance)
Paris remains the public boundary.

Minimum additions:
1) **Issue editor AI grant on instance load**
   - Extend `GET /api/instance/:publicId` response with:
     - `ai: { grant: string }`
   - This preserves Bob’s “load once” behavior while enabling AI calls without storing drafts in DB.

2) **Grant refresh endpoint (rare)**
   - `POST /api/ai/grant`
   - Used if an editing session is long-lived and the grant expires.

Paris does NOT execute AI calls. It only issues grants.

### San Francisco (AI execution service endpoints)
This is a separate deployable service (Cloudflare Workers) from day one.

Single endpoint (all agents):
- `POST /v1/execute`
  - Request: `{ grant: string, agentId: string, input: object, trace?: object }`
  - Response: `{ requestId, agentId, result, usage }` for non-editor agents, or `{ requestId, ops, usage }` for editor agents.

## Agent Orchestration (San Francisco Core)
Orchestration is San Francisco’s “meat” and is built incrementally behind the same execution interface.

Phase‑1 (minimum viable orchestration):
- One agent: `sdr.copilot` (Minibob)
- One provider + model (explicit), strict errors if unavailable
- No tool execution
- Returns structured JSON only

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

## Execution Plan (Milestones)

### Milestone 0 — Documentation cleanup (this PRD)
Definition of done:
- This document is the single execution PRD for AI.
- Any older “AI workforce” narrative docs are marked historical and linked to this PRD.

### Milestone 1 — San Francisco service scaffold
Definition of done:
  - New service deployable exists (Cloudflare Workers).
  - Health endpoint and base `POST /v1/execute` handler exists (returns typed errors).

### Milestone 2 — Ship `sdr.copilot` (Minibob)
Definition of done:
  - `agentId: sdr.copilot` works end-to-end in San Francisco
  - Response is structured JSON + usage metadata (no prose-only responses)

### Milestone 3 — Paris issues AI grants (anon + user)
Definition of done:
  - Paris can issue signed grants for:
    - anon sessions (Minibob)
    - user/workspace sessions (Clickeen app)
  - San Francisco verifies signature + expiry + capabilities

### Milestone 4 — Bob uses San Francisco for AI
Definition of done:
- Bob no longer calls provider APIs directly.
- Bob calls San Francisco with the Paris-issued grant.
- Errors are explicit; no silent behavior changes.

### Milestone 5 — Remove Bob-local AI route
Definition of done:
- Delete `bob/app/api/ai/faq-answer/route.ts` (or convert to a thin proxy if a same-origin path is required during transition).

## Open Questions (must be answered before Milestone 3)
- Grant transport: return grant in `GET /api/instance/:publicId` vs separate `POST /api/ai/grant` (the former is preferred to preserve minimal edit-session calls).
- Where AI usage is recorded for billing: Paris-only ledger via an internal San Francisco→Paris report, or a later aggregation pipeline. (Do not block Phase‑1 on billing.)

## Links
- Paris system PRD: `documentation/systems/paris.md`
- Bob system PRD: `documentation/systems/bob.md`
