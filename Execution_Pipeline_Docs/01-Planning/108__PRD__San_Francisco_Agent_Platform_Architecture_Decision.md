# PRD 108 - San Francisco Agent Platform: Architecture Decision

Status: PLANNING
Owner: Product + Architecture (San Francisco)
Priority: P0 for Builder Copilot proof; P1 for durable workforce architecture
Date: 2026-06-07
Stage: 01-Planning
Type: Architecture decision (understand → survey → recommend)

Related:
- `documentation/ai/overview.md` (San Francisco = AI Workforce OS)
- `documentation/ai/infrastructure.md` (bindings, budgets, endpoints)
- `documentation/services/sanfrancisco.md` (shipped runtime truth)
- `documentation/ai/agents/gtm.md` (GTM Agent spec — not implemented)
- `documentation/ai/agents/ux-writer.md` (UX Writer spec — not implemented)
- `packages/ck-contracts/src/ai.ts` (agent registry)
- EB-007 (Evergreen Backlog: copilot core re-separation)
- Anthropic, "Building agents that reach production systems with MCP"
  (claude.com/blog, 2026-04-22) — external reference informing §3.5 and §5
- OpenAI, "A practical guide to building AI agents"
  (openai.com, 2026-03-11) — external reference informing §3.6 (agent-internal
  design discipline), the guardrail/human-in-loop non-negotiables, and §5

---

## 0. What this PRD is and is not

This is **not** an execution spec. It does not hand engineering a contract to implement.

There is no single correct way to build an agentic platform. The right shape for
Clickeen falls out of three things, in order: (1) what Clickeen is actually trying to
do, (2) what the codebase and architecture already are, and (3) the real shape of every
agent Clickeen intends to run. This PRD does that work and then **recommends** an
evolution path for San Francisco, with the trade-offs made explicit so the team can
agree or push back before any code moves.

Movement gate honored: per the pipeline README, a doc reaches `01-Planning` only when we
intend to make it real. This PRD's deliverable is an agreed architecture direction and a
phased path — not merged code. Execution PRDs (108A, 108B, …) follow once the direction
is locked.

Peer-review correction applied on 2026-06-08: earlier drafts leaned on a stale
`widget_instance_overlays` / RLS model as the agent safety spine. That is not current
product truth. The current trust model is: San Francisco governs AI execution and returns
structured outputs; Bob/Roma/Tokyo and product-owned orchestrators accept, reject, review,
save, publish, or discard those outputs at their own named product boundaries.

Copilot-first correction applied on 2026-06-08: **Builder Copilot is the first proof that
the AI plane works.** If the shipped Copilot cannot understand visible Builder controls
and perform simple in-memory edits like "change the button from blue to green," Clickeen
does not yet have an AI-native Builder, no matter how elegant the future workforce-agent
architecture sounds. The durable workforce-agent platform remains the correct long-term
architecture, but it is secondary until PRD 108B proves that San Francisco + Bob can
operate the actual editor.

---

## 1. Understand Clickeen first

### 1.0 The immediate product proof

The immediate product proof for PRD 108 is not GTM, UX Writer, MCP, or a durable
orchestrator.

The proof is Builder Copilot operating Builder correctly.

Builder Copilot must be a **Builder control operator** before it is treated as an agent
platform showcase:

- Bob exposes the visible Builder controls as the action surface.
- Each visible control has user-facing vocabulary, label, group, panel, path, value type,
  allowed values, and current value.
- Copilot resolves user intent against that control vocabulary.
- Ambiguous requests ask one short clarification instead of guessing.
- Resolved requests produce validated structured ops.
- Bob applies valid ops to the in-memory working copy and preview.
- Save/publish stay on the normal Roma/Tokyo product path.

This is not a foundation rewrite. The addressable Builder contract is the reason this can
be fixed cleanly: controls already have labels, paths, groups, value types, allowed values,
and current values. The failure is that Copilot has not been wired to resolve user
language against that contract before model planning. PRD 108B must fix that grounding
layer; it must not turn this into schema redesign, per-widget prompt glue, or more
workforce-agent theory.

The required first proof is deliberately boring:

- "What can you edit?" returns the actual current Builder controls.
- "Change the button from blue to green" works.
- "Change the button label to Book a demo" works.
- "Hide the button" works.
- "Change the background to white" resolves or clarifies correctly.
- "Make the title bigger" resolves content-vs-typography ambiguity correctly.
- No raw provider JSON, no fake save/publish, no translation/base-locale confusion, and no
  stale Copilot result overwrites manual edits.

Until those pass across the shipped widgets, the rest of the workforce-agent architecture
is planning, not product proof.

That first proof is not the whole Copilot. Builder Copilot also needs a Guide capability:
when a user asks "what do I do in the panels?", "how do I add/remove/reorder this?", or
"why don't I see that setting?", Copilot should understand the whole current widget, not
only one isolated op. That requires a shaped whole-widget capability map: panels, groups,
visible controls, hidden/disabled dependencies, repeatable structures, and supported
workflows. It is not solved by vague source-code access. The Guide capability depends on
the Operator capability because "do it" follow-ups must become validated Builder ops.

### 1.1 The company goal

Clickeen is an AI-first company building AI-operated, embeddable widgets — software built
like organisms (atomic design), operated by AI, served in 29+ languages, stacked into
edge-served pages. The product thesis ("reimagining the webpage") is inseparable from an
operational thesis: **Clickeen runs as 1 human + an AI workforce.** Sales, support,
marketing, localization, and ops are agents, not teams (`documentation/ai/overview.md`).

That means agents are not a feature bolted onto the product. They are how the company
operates and how the product self-improves. The platform that runs them is core
infrastructure, not a side service.

**Why PRD 108 is load-bearing for the company thesis, not just the codebase.** Builder
Copilot is the first user-facing proof that AI can operate the product, not merely talk
about it. GTM, UX Writer, Support, Localization, and Moderation remain the long-term AI
workforce thesis, but they are not allowed to distract from the shipped editor failure.
San Francisco is the constitutional layer that makes that fleet safe: every agent gets
model access, grants, budgets, telemetry, capability checks, and typed failures through
one plane, while product truth remains owned by Bob/Roma/Tokyo or the specific
orchestrator/review boundary. One agent that mints its own grants, holds its own provider
keys, calls providers directly, or writes product state directly breaks the guarantee for
the whole system, not just itself. One Copilot that cannot operate Builder controls breaks
the product proof today. So PRD 108 is both: (1) fix the shipped Builder Copilot as a
control operator, and (2) preserve the single AI plane for the workforce that follows.

### 1.1.1 The Clickeen-specific constraint

The hard part is not the mechanics of calling a model. The hard part is keeping AI
execution inside the same product-truth discipline as the rest of Clickeen.

Clickeen already has named authorities:

- Bob owns the in-memory Builder working copy for one open widget instance.
- Roma owns the account Builder host and account-scoped product routes.
- Tokyo owns instance source, translation generation state, package files, publish state,
  and account-owned instance operations.
- Product-specific orchestrators own their own review artifacts and workflow state.
- San Francisco owns AI execution: provider keys, grants/policy, model routing,
  capability validation, budgets, typed errors, telemetry, eval signals, and learning
  event capture.

The agent platform must preserve those boundaries. Agents may produce structured outputs
that a product boundary applies or rejects. Agents may not become a second persistence
owner, a second policy owner, or a second provider-key owner.

### 1.1.2 Where the agent literature does and does not apply

| External idea | Verdict for Clickeen | Why (grounded in the codebase) |
|---|---|---|
| Model-swappability as table stakes for every agent | **Already ahead** | `AgentRuntimePolicy` already carries `allowModelPicker` + a pinned `selectedModel`, enforced by `modelRouter.ts`. User-facing copilot can swap from a catalogue; internal/durable agents pin an eval-locked default. This is a *policy setting per agent*, not a feature to build. |
| Do the deterministic part deterministically; use the model only for judgment (OpenAI) | **Transfers** | Restates AGENTS.md §3 ("no fake generic layers") at the per-task level. Fixed transforms (formatting an audit report) are code, not model calls. |
| Single-agent-first; split only when forced (OpenAI) | **Transfers** | Confirms the 108C guardrail (one real durable agent before any generalization). |
| Layered guardrails + risk-rated human-in-the-loop gate (OpenAI) | **Transfers, but keep authority clean** | Risk belongs in agent registry/policy. San Francisco can enforce risk/policy before AI execution or before returning an actionable result, but review state and product commits belong to the owning orchestrator/product boundary. |
| M×N integration / intent-shaped tools / one credential custody (Anthropic MCP) | **Applies only at the genuinely external edge** | Inside the company, agents should use native product-operation contracts owned by Roma/Tokyo/orchestrators. MCP-style mediation is warranted only for truly external, human-built systems (competitor pages, keyword APIs, Search Console). |
| Wrap fragile human-shaped SaaS APIs so agents can drive them (general SaaS canon) | **Does not apply** | Premised on opaque, non-addressable state. Clickeen's state is atom-addressable, so the wrapping problem the canon solves largely does not exist internally. |

### 1.2 What San Francisco already is

San Francisco is already named, in canonical docs, as the **"operating system for the
company's AI workforce"** (`documentation/ai/overview.md`). It is a Cloudflare Worker that
already owns the AI plane:

- **Grants:** HMAC-signed `AIGrant` from trusted issuers (`roma`, `sanfrancisco`),
  short-lived, capability-scoped, carrying a signed `AgentRuntimePolicy` (`grants.ts`).
- **Capability + boundary model:** `assertCap(grant, 'agent:<id>')`; registry declares
  `boundary` per agent (`editor_ops_only`, `account_widget_translated_values`).
- **Model/provider routing:** `modelRouter.ts` resolves provider+model strictly from the
  signed policy; no silent cross-switching.
- **Budgets, concurrency, timeouts:** per-grant token/turn/timeout ceilings; per-isolate
  in-flight cap returning `429 BUDGET_EXCEEDED`.
- **Telemetry + learning loop:** every `/v1/execute` enqueues an `InteractionEvent` to
  `SF_EVENTS`; the consumer writes raw samples to R2 and indexes to D1; `/v1/outcome`
  attaches conversions. Bindings already provisioned: `SF_KV`, `SF_EVENTS`, `SF_D1`,
  `SF_R2` (`documentation/ai/infrastructure.md`).
- **Two execution shapes already coexist:** synchronous `/v1/execute` (Builder Copilot)
  and queue-driven async work (account-widget instance translation via
  `INSTANCE_TRANSLATION_JOBS`).

This is the decisive fact: **the AI plane already exists and is disciplined.** The
question is not "where does the agent platform live" — it lives in San Francisco. The
question is **how San Francisco must evolve to host the full roster without forking its
own architecture per agent.**

### 1.3 The architectural tenets that constrain any answer

From `AGENTS.md` and `documentation/architecture/Tenets.md`, binding on this decision:

- San Francisco is **isolated** from product/auth/persistence authority (Roma/Berlin/
  Tokyo) and from the editor's in-memory edit loop. AI incidents must never degrade
  instance CRUD/publish.
- Agents return **structured results only** (editor agents return `ops[]`; system agents
  return typed payloads) — never prose instructions.
- **Policy/entitlements/persistence stay outside** San Francisco. San Francisco executes
  against a signed grant and returns results; it is not a product-truth owner.
- **No fake generic layers / no speculative frameworks** (AGENTS.md §3). The platform
  must model the agents we actually intend to run, not platform theory.
- **Fail at a named boundary**, never silently heal invalid state.

Any platform shape that violates isolation, smuggles product truth into San Francisco, or
adds a generic framework the roster doesn't need is disqualified regardless of elegance.

---

## 2. Understand the full roster (name + classify)

The canonical docs already name the agents Clickeen will run. Naming and classifying them
is what determines the platform shape — because they do **not** all have the same runtime
shape, and a one-size design would be wrong.

### 2.1 The roster

| Agent | Canonical / proposed id | Status | Owner surface | Source |
|---|---|---|---|---|
| Builder Copilot | `cs.widget.copilot.v1` | **Shipped** | Roma account Builder | overview, ai.ts |
| Widget Instance Translator | `widget.instance.translator` | **Shipped (queue)** | Tokyo-worker → SF queue | overview, ai.ts |
| GTM Agent ("AI VP of Marketing") | `ops.gtm.*` (proposed) | **Spec'd, not built** | internal/ops cron | `agents/gtm.md` |
| UX Writer | `ops.uxwriter.*` (proposed) | **Spec'd, not built** | internal/ops cron | `agents/ux-writer.md` |
| Support Reply | `support.reply` (named) | Future | (TBD) | overview "Terms" |
| Community Moderation | `ops.communityModeration` (named) | Future | (TBD) | overview "Terms" |

The overview's roster table ("replaces product specialists / localization team / marketing
org") and its Terms section naming `support.reply` and `ops.communityModeration` make the
intended end-state explicit: a workforce spanning **editor assistance, localization,
marketing, support, and ops moderation.**

Dispositions for the shipped roster (PR-14/D9, ratified 2026-06-09):

| Shipped agent | Disposition |
|---|---|
| Builder Copilot | **Rebuild** per 108B (earth tests as proof) |
| Widget Instance Translator | **Keep + protect** (29-locale regression gate on any plane change), then **re-base** onto the durable scaffold as the 108C reference agent (D5) |

### 2.2 Classification (the dimensions that matter for platform shape)

**Dimension A — Execution mode (the load-bearing one):**

- **Interactive / synchronous** — request→response, latency-bound (seconds), one grant
  per call, session in KV. Examples: Builder Copilot; future Support Reply (live).
  Fits today's `/v1/execute` model exactly.
- **Durable / async** — multi-phase, runs minutes→hours, survives crashes, resumes from
  checkpoint, cron- or event-triggered, fans work out to parallel tasks. Examples: GTM
  Agent, UX Writer (both spec'd with a Durable Object orchestrator + task queue + own
  D1/R2), and the instance translator (already queue-driven). This shape does **not** fit
  a single synchronous `/v1/execute` call.

**Dimension B — Subject / trust:**

- **Account-scoped** (acts for a user/account under a Roma-minted grant): Builder Copilot,
  Support Reply, Instance Translator.
- **Service-scoped** (acts for Clickeen itself under a service grant): GTM, UX Writer,
  Community Moderation.

**Dimension C — Output target / boundary:**

- `editor_ops_only` (returns `ops[]` into a widget): Builder Copilot.
- `account_widget_translated_values`: Instance Translator.
- **New boundaries the roster implies:** ops/marketing artifacts (GTM JSON, audit
  reports) written to a service-owned store for human review — not account truth, not
  product persistence.

**Dimension D — Autonomy / human-in-loop:** copilots are human-driven each turn; ops
agents are autonomous-with-human-review (propose → human accepts → committed).

### 2.3 The conclusion this forces

The roster is **bimodal**. Half of it (copilots, live support) is synchronous and already
fits San Francisco's execute path. The other half (GTM, UX Writer, moderation sweeps) is
**durable, long-running, orchestrated** — and the existing specs for those two were
written as *separate Cloudflare Worker services* with their own Durable Objects, queues,
D1, and R2.

So the central decision is not "what's the agent contract." It is:

> **Do durable agents live inside San Francisco, or as sibling workers that San Francisco
> governs?** And: **what, exactly, is the shared platform spine they all reuse?**

And because of §1.1.1, there is a test that decides it: **which option preserves the
system-wide atomic invariant — one atom per concept, no duplicate truth — as the workforce
scales?** An option that makes each agent re-implement the AI spine, or that lets an agent
become a second source of truth or a second healing path, fails the same rule the rest of
the codebase already lives by. This is why the choice is not aesthetic: it is the
architectural law applied to the workforce.

That is the decision §3–§5 resolve. One further axis sits underneath it for the
durable, service-scoped half of the roster: **how those agents reach the external systems
they have to act on** (GTM must read competitor pages, keyword APIs, Search Console).
That is a distinct question from the internal AI plane, and §3.5 treats it explicitly.

---

## 3. The design space (options, honestly stated)

### Option A — One monolith: every agent inside the San Francisco worker

San Francisco hosts interactive agents (execute path) **and** durable agents (Durable
Objects + cron + task queues) in one deployable.

- **Pros:** one grant/policy/model-router/telemetry spine, literally shared in-process;
  no cross-service auth; one place to reason about the AI plane.
- **Cons:** violates the shipped isolation tenet — a runaway 6-hour GTM run or a Durable
  Object hot-loop now shares an isolate and blast radius with the latency-critical Builder
  Copilot. Deploy cadence collapses: a marketing-agent change forces a redeploy of the
  copilot path. The docs explicitly separated San Francisco from product CRUD for exactly
  this reason; re-merging two volatility classes inside SF repeats the mistake one layer
  in. **Disqualified on tenets.**

### Option B — Sibling services, fully independent (the current spec'd default)

GTM and UX Writer ship as `services/gtm-agent` and `services/ux-writer`, each with its own
grant handling, model client, telemetry, D1/R2 — as their specs currently describe.

- **Pros:** maximal isolation; each agent deploys independently; matches the specs as
  written.
- **Cons:** **duplicate truth at scale — i.e. the atomic sin, multiplied by every agent.**
  Each new agent re-implements grant verification, provider keys, model routing, budget
  enforcement, and the learning loop. Per §1.1.1, the AI spine is itself a concept that
  must have exactly one atom/authority; sibling-per-agent gives it N copies, which is
  precisely the "duplicate truth / divergent behavior" AGENTS.md forbids — now committed at
  the platform layer instead of in a stray table. Provider keys spread across N workers.
  The "AI Workforce OS" becomes N disconnected workers with no shared spine — the OS
  framing dies. This is the option that most directly **violates the system-wide atomic
  invariant the whole codebase is built on.** **Rejected as the default**, though its
  isolation instinct is correct.

### Option C — San Francisco as control + execution plane; durable agents as governed workers (recommended)

San Francisco remains the **single AI plane**: it owns provider keys, model routing,
grant/capability/boundary enforcement, budgets, and the telemetry/learning loop. Two
execution surfaces sit behind that one plane:

1. **Interactive surface** (`/v1/execute`, as today) for synchronous agents.
2. **Durable surface** — orchestrated, long-running agents. Their orchestrator +
   task-fanout (Durable Object/queue/cron) may run as a **governed sibling worker per
   durable agent** (preserving isolation and independent deploy), but **all model calls,
   grant/policy enforcement, budget accounting, and learning-event emission route back
   through San Francisco's shared spine** (exactly like Tokyo-worker already dispatches
   instance translation to San Francisco through the `INSTANCE_TRANSLATION_JOBS` queue;
   corrected per review PR-1 — the previously cited `SANFRANCISCO_L10N` service binding
   exists only in stale docs, not in code).

In other words: **orchestration is per-agent and isolated; the AI plane is singular and
shared.** No agent re-implements grants, keys, routing, budgets, or learning. SF governs
every model call regardless of which worker orchestrated it.

- **Pros:** keeps isolation (durable runs can't degrade the copilot path; independent
  deploys); keeps a single AI plane (one provider-key home, one policy authority, one
  learning loop — the OS framing survives); matches what's *already shipped* (instance
  translation already orchestrates outside SF and routes execution through SF's binding);
  no speculative framework — it generalizes an existing, working pattern.
- **Cons:** requires a clean internal contract between orchestrators and the SF plane
  (a service-binding execute path for service-scoped agents, not just the HTTP/grant path).
  This is real work, but bounded and already half-present.

### Option D — Buy/adopt a third-party agent framework

- **Cons:** provider-key custody and policy enforcement are the whole point of San
  Francisco; outsourcing the plane breaks the isolation and grant model and imports a
  generic framework the roster doesn't need. **Disqualified on tenets** (AGENTS.md §3).

---

### 3.5 The external-reach question (where MCP belongs)

The options above settle the **internal** plane: how agents get governed model access,
grants, budgets, and learning. They do not settle how the *durable* agents reach the
**external** systems they must operate on. GTM alone must read competitor sites, pull
keyword/volume data (e.g. DataForSEO), and query Search Console; UX Writer is largely
internal but will grow outward. This is a different problem from model routing, and it is
the **one place** where the Anthropic MCP guidance is directly relevant — because it is the
one place Clickeen genuinely meets the substrate that literature assumes. Per §1.1.1–1.1.2,
MCP-style mediation does **not** apply to internal reach (which is native, addressable, and
atom-shaped); it applies only at the *genuinely external* edge — third-party, human-built
systems Clickeen does not control. We therefore treat it as a sub-decision of Option C,
scoped strictly to that outbound edge, rather than fold it in silently.

**The risk, named:** if every durable agent hand-rolls its own integration to each
external service (its own auth handling, its own tool descriptions, its own edge cases),
we recreate the **M×N integration problem** — N agents × M external services, each pair a
bespoke integration to build and maintain (Anthropic, MCP). This is the same
"duplicate truth / divergent behavior" failure AGENTS.md forbids, just pushed to the
outbound edge instead of the model edge.

**The principle to adopt now (not the build):** external reach should go through **one
common outbound layer**, not per-agent bespoke clients — mirroring how the internal plane
is singular. MCP is the standardized shape of that layer, and three of the article's
lessons translate cleanly to Clickeen without importing a generic framework:

- **Group tools around intent, not endpoints.** A GTM outbound tool should be
  `assess_competitor_page(url)` or `pull_keyword_demand(terms)` — task-shaped, returning
  structured results — not a 1:1 mirror of DataForSEO's or Search Console's REST surface.
  Fewer, well-described, intent-level tools outperform exhaustive API mirrors and keep the
  durable agent's context lean. This also keeps outputs structured, satisfying our
  "structured results only" tenet at the outbound boundary too.
- **Code orchestration for large/awkward surfaces.** Where an external API is large or
  needs filtering/aggregation before it's useful, prefer the search+execute shape
  (Anthropic cite Cloudflare exposing ~2,500 endpoints behind two tools in ~1K tokens):
  the agent emits a short script, it runs sandboxed against the API, and only the result
  returns. This is the outbound analogue of our internal discipline — process at the edge,
  return structured payloads, don't flood the orchestrator with raw API dumps.
- **Credential custody is the whole point — keep it singular.** The article's strongest
  parallel: just as provider keys live only in San Francisco, **external credentials
  (Search Console OAuth tokens, keyword-API keys) must not be smeared across N agent
  workers.** A vault-style model (register a token once; the plane injects/refreshes it
  per connection; nothing is passed per call) is the right target, and credentials that
  must never transit the agent (OAuth grants, payments) belong in a browser-handoff /
  URL-elicitation flow, never inline in a tool call.

**What we deliberately do NOT adopt yet:** Clickeen is not, today, publishing an MCP
server for *third parties* to drive our agents, nor consuming arbitrary external MCP
servers as a product feature. SF's interactive surface stays an internal `/v1/execute`
plane. MCP enters as the **outbound integration discipline for durable agents**, and only
when the first durable agent (108C/108D) actually needs an external system. We adopt the
principle now so we don't paint ourselves into per-agent bespoke clients; we defer the
implementation to the agent that first needs it. (No speculative framework — AGENTS.md §3.)

---

### 3.6 Agent-internal design discipline (what each agent must be, inside the plane)

§3.1–3.5 settle the **platform topology** — where agents live, what spine they share, how
they reach outward. They do not settle the **anatomy of a single agent** running on that
plane. The OpenAI practical guide is about that interior — and per §1.1.1 we read it as
**literature to test against, not a playbook to adopt.** It does not change the
recommendation; it gives us four checkpoints to hold Clickeen against, and on each the
honest verdict (per the §1.1.2 table) is either "transfers," "already ahead," or "build it
from the atoms we already have" — never "import the framework." Stated here as *direction*,
not as a build — the mechanics belong to the execution PRDs (108A onward), per §0.

**(a) Most work should stay deterministic; the model is for judgment, not plumbing.**
The guide's first test is when an agent is even the right tool: genuine judgment, unwieldy/
changing rulesets, or unstructured-data interpretation — everything else is better as plain
code. This is just AGENTS.md §3 ("no fake generic layers") at the per-task level: phases of
GTM or UX Writer that are fixed transforms (formatting an audit report) are code, not model
calls. *What this means for SF's evolution:* the plane should make the cheap, deterministic
path the default, so agents reach for the model only where judgment is actually required.

**(b) The model/tools/instructions triad is the unit of an agent — and SF already owns the
model side.** The guide frames every agent as three parts: model (reasoning), tools
(action), instructions (behavior). Clickeen already separates these — `modelRouter.ts`,
boundaries/outputs, prompts/persona — which is a strong sign Option C is the right shape.
The guide's sharpening: don't pin everything to the most capable model; use the cheapest
model that still passes evals. *What this means for SF's evolution:* the mechanism for
per-agent model policy **already exists and should simply be set deliberately, not grown
over time.** `AgentRuntimePolicy` already carries `allowModelPicker` and a pinned
`selectedModel`, enforced by `modelRouter.ts`. The correct posture is therefore a fixed
rule, not a future feature: the **user-facing copilot** runs `allowModelPicker: true` (a
swappable catalogue is genuinely table stakes for an end-user assistant), while every
**internal/durable agent** ships `allowModelPicker: false` with an eval-locked
`defaultModel` (for an internal agent, swapping the model is *not* table stakes — its
output is validated against a pinned model, and silent model drift would break that
guarantee). All three registered agents technically share the same picker pathway today;
the registry already has the lever, it just needs pulling per agent.

> **SUPERSEDED in part (PR-13 / D8, 2026-06-09):** "a policy setting, not new platform
> code" understated the need. The ratified routing contract adds a third plane atom —
> routing (turn-class → model tables, single-step escalation on invalid structured
> output, declared recorded failover, pinned user picks never overridden). The
> mechanism is `AgentRoutingPolicy` in the signed policy; `modelRouter.ts` becomes a
> real router. See `108A1__EXEC__…` Step 6. "No silent cross-switching" remains true:
> switching is declared, bounded, and recorded — never silent.

**(c) Single-agent-first — which is the discipline this doc already adopts.** The guide is
explicit that teams succeed by maximizing one agent before adding multi-agent complexity,
and split only when one agent provably can't follow its instructions or its tools overlap.
This simply confirms the **108C guardrail already in this doc** (one real durable agent
before any generalization). If a durable agent later outgrows a single prompt, the guide's
**manager pattern** (a coordinator calling sub-agents as tools) is the sanctioned next
step, and it would compose with Option C rather than fork the plane — but we don't build
toward it speculatively (AGENTS.md §3).

**(d) Guardrails are layered, and autonomous agents need declared risk plus human review
where impact requires it.** The guide treats guardrails as a layered defense (relevance,
safety/jailbreak, PII, harmful-content, brand) and rates each action by risk (read-only
vs. write, reversibility, impact), escalating high-risk actions to a human. Clickeen
already has the first layer (signed grants, capability/boundary enforcement, budgets,
timeouts). The durable *autonomous* agents — GTM publishing, Community Moderation acting
on user content — force the next layer: declared risk in registry/policy, product-safe
review artifacts, and approval before high-impact actions commit. *What this means for
SF's evolution:* San Francisco should enforce risk/policy so it cannot be skipped, but it
must not own review-state or product commits. The owning product/orchestrator boundary
keeps those authorities.

**What this is not:** we are not adopting the guide's SDK or runtime (its Agents SDK,
declarative-vs-code-first framing, optimistic-execution machinery) — those are vendor
tooling, and SF is its own runtime. We take the principles. And nothing here mandates new
frameworks now; (a)–(d) describe capabilities SF should be *able* to grow into as the
durable, autonomous agents actually arrive.

---

## 4. Recommendation

**Adopt Option C: San Francisco is the singular AI control + execution plane, with two
execution surfaces — interactive (`/v1/execute`) and durable (governed orchestrator
workers that route all model/policy/budget/learning through San Francisco).**

Execution priority correction: the interactive surface is not just "one of the surfaces."
Builder Copilot is the P0 proof gate. The concrete 108B Builder-contract projection work is
not blocked by 108A-1; Bob can start projecting `EditorContract` into Copilot immediately.
108A-1 runs in parallel as the release gate for model capability, picker eligibility, and
typed provider errors. Durable workforce scaffolding is sequenced after the Copilot proof.

Why this is the right fit for *Clickeen specifically*:

0. **It preserves named authority boundaries** (§1.1.1). Option B gives provider calls,
   grants, model routing, budgets, and telemetry N copies. Option A collapses two
   volatility classes into one deployable. Option C keeps the AI spine one authority while
   letting each product/orchestrator boundary keep its own persistence, review, and commit
   authority.
1. **It honors the shipped isolation tenet** while keeping the "AI Workforce OS" real —
   the two things the canonical docs insist on simultaneously.
2. **It generalizes a pattern already in production**, not a theory: account-widget
   instance translation is already an external orchestrator (Tokyo-worker) dispatching
   work to San Francisco's execution plane through the `INSTANCE_TRANSLATION_JOBS`
   queue. Option C is "do that, on purpose, for every durable agent."
3. **It refuses duplicate truth.** One provider-key home, one model router, one budget
   authority, one learning loop. Adding the GTM Agent does not re-implement any of that —
   it implements only its orchestration + its prompts + its boundary.
4. **It absorbs the bimodal roster cleanly.** Copilots stay synchronous; GTM/UX
   Writer/moderation run durable — both under one governed plane.
5. **It extends the same "singular plane" logic to the outbound edge** (§3.5): durable
   agents reach external systems through one common, intent-shaped integration layer with
   centralized credential custody, instead of N bespoke clients — refusing the M×N problem
   the same way Option C refuses duplicate internal truth.
6. **It matches the standard agent anatomy** (§3.6): the plane already separates model /
   tools / instructions and owns model resolution, so as the roster grows the capabilities
   the autonomous agents will need — finer model selection, layered guardrails, a human-in-
   the-loop gate — can mature *once, in the plane* and be inherited, rather than re-invented
   per agent. (How those mature is execution work, not decided here.)

This also resolves **EB-007** as a consequence, not as the goal: once the plane defines a
clean per-agent execution contract, the over-shared `widgetCopilotCore.ts` (currently
differentiated by a `role` flag) splits into shared plane primitives vs. per-agent
behavior. That split is in-scope for the first interactive-surface execution PRD, not this
decision doc.

**The AI-plane / product-boundary co-dependency (why there is no partial compliance).**
The customer-trust promise is current product truth, not a legacy overlay table: Bob edits
one in-memory working copy; Roma mediates account-scoped Builder operations; Tokyo owns
instance, translation, package, and publish operations; service orchestrators own their
own review artifacts. San Francisco is the AI execution plane that supplies governed,
typed, measurable AI results to those boundaries. An agent that bypasses San Francisco
for model access, grants, budgets, telemetry, or provider-key custody breaks the AI-plane
guarantee. An agent that bypasses Bob/Roma/Tokyo/orchestrator boundaries for persistence
breaks the product-truth guarantee. There is no partial compliance.

### What stays fixed (non-negotiable, regardless of agent)
- Provider keys live only in San Francisco.
- Grant verification, capability + boundary enforcement, model routing, budget/timeout
  ceilings, and learning-event emission are San Francisco's, used by every agent.
- Policy/entitlements/persistence stay in Roma/Berlin/Tokyo.
- Every agent returns structured output and fails at a named boundary.
- **External reach is shared, not per-agent** (§3.5): when a durable agent needs an
  outside system, it goes through a common, intent-shaped outbound layer with one credential
  custodian — not a bespoke per-agent client with its own key handling.
- **Safety is enforced by the plane, but review/commit authority stays outside it**
  (§3.6): risk class lives in registry/policy, San Francisco refuses unsafe AI execution
  or actionable results without the required policy/approval signal, and the owning
  product/orchestrator boundary owns review state, artifacts, and commits.
- **Model choice stays in the plane, not hard-coded in orchestrators** (§3.6): model
  selection lives in the signed policy SF resolves, leaving room for finer-grained (even
  per-phase) choice to grow over time.

### What is per-agent (owned, isolated)
- Orchestration shape (synchronous vs. Durable Object + queue + cron).
- Prompts/persona, phase logic, task fanout.
- The agent's declared boundary and its output target (ops, translated values, ops
  artifacts for review).
- Independent deploy cadence.

---

## 5. Proposed evolution path (phased — execution PRDs follow)

This decision doc proposes the sequence; each phase becomes its own `02-Executing` PRD.

- **108B-1 — P0 Interactive Builder Copilot Operator rescue (resolves EB-007).** Use Bob's
  compiled Builder control contract as Copilot's action surface; build the visible-control
  vocabulary; answer capability questions deterministically; validate structured ops
  against current editable paths; apply only to Bob's in-memory working copy; preserve
  dirty state; add fixture/eval scenarios for the shipped widgets. First code gate:
  project the existing `EditorContract` into Copilot instead of flattening it to
  keyword-ranked `controls[]`. The first green bar is not abstract: button green, button
  label, hide button, background, title, share, and branding edits must work or clarify
  correctly in preview.
- **108B-2 — Builder Copilot Guide layer.** After the Operator slice is green, add
  whole-widget/panel/workflow guidance for prompts like "what do I do in the panels?",
  "how do I add/remove/reorder this?", and "why don't I see that setting?" This is not
  grounding alone and not abstract advice. It requires a full current-widget capability
  map, panel/workflow map, repeatable structure map, conditional control map, and a
  Guide-to-op bridge so practical guidance can become validated Builder edits.
- **108A-1 — Parallel release gate for user-facing plane hardening.** Define model
  capability metadata, provider-conformance checks, typed provider errors, and picker
  eligibility so Builder Copilot cannot select or call an unsupported model shape. This
  runs alongside 108B-1/108B-2 and must be green before release, but it must not block the
  Bob `EditorContract` projection work.
- **108A-2 — Durable/service plane contract.** Define the service-binding execution
  interface San Francisco exposes to durable orchestrators: service-scoped policy/grant
  model, budget split, shared execution core, structured result + usage, telemetry,
  eval/observability fields, and learning-event capture. Extend the registry so
  durable/service agents are first-class (not just `execute` vs `endpoint`).
- **108C — Durable agent scaffold proven on the shipped reference agent.** Stand up the
  governed durable-agent pattern by **re-basing the Widget Instance Translator** — the
  internal agent already running in production — onto the formalized scaffold, guarded
  by the D9 29-locale regression gate. (SUPERSEDED per D5, 2026-06-09: an earlier
  draft recommended a greenfield UX Writer; building a speculative agent to validate a
  pattern production already runs was rejected. UX Writer waits for a real need.)
  Scaffold-only platform work remains explicitly rejected. 108C does not enter
  execution until 108B has proven the user-facing Builder Copilot.
- **108D — GTM Agent on the pattern.** Re-base the existing GTM spec onto the governed
  plane (drop its standalone grant/model/telemetry; reuse SF's). GTM is the **first agent
  that needs external reach**, so this is where §3.5's outbound layer gets built for real:
  intent-shaped tools for competitor/keyword/Search-Console access, centralized external
  credential custody, and — if any single API surface is large enough to warrant it — the
  search+execute code-orchestration shape. Pair the agent with a **skill** (a written
  playbook for *how* to use those tools well): per the MCP article, tools grant access
  while skills supply procedural know-how, and the most capable agents carry both.
  - **Design-before-build note:** 108D's *implementation* follows 108C, but its
    *architecture* must be decided before 108C ships. The outbound-layer shape (§3.5 —
    intent-shaped tools, one credential custodian, code-orchestration for large API
    surfaces) and the external credential-custody model (vault-style store in the AI
    plane; OAuth/payment flows via browser handoff, never inline tool calls) constrain
    what the SF plane contract can assume about any durable agent's outbound reach. The
    design dependency runs earlier than the build dependency: before 108C enters
    `02-Executing`, the team should have decided Open Questions 6 and 7 at the design
    level — not built, but decided — so 108D implements against a known contract instead
    of arriving as a retrofit.
- **108E+ — Support Reply, Community Moderation** onto whichever surface fits (Support
  Reply likely interactive; Moderation likely durable). These carry the roster's
  **highest-risk actions** (live customer-facing replies; acting on user content), so they
  are where §3.6's human-in-the-loop checkpoint matters most — sequenced after the plane's
  safety capability (designed in 108A) exists.

Each phase ships docs-in-sync with code before moving to `03-Executed`, per the pipeline.

- **108F — Learning loop (named direction, execution deferred).** Outcome capture and
  observability are first-class from 108A onward, but policy/prompt/model self-improvement
  is not built in 108A–108E. 108A must persist queryable metadata for
  `(agent_id, phase, model, capability_profile_version, prompt_version, policy_version)`
  and 108B/108C must ship eval scenarios/gates. The future 108F loop may use those records
  to propose policy, prompt, risk, or model changes, subject to human promotion. The closed
  loop itself remains separate execution work.

---

## 6. Planning-Stage Review (mandatory, per pipeline README)

1. **Elegant engineering, scales across 100s of widgets/agents?**
   Yes. One shared AI plane + per-agent orchestration is O(1) shared code per new agent.
   It generalizes a shipped pattern rather than inventing one.

2. **Compliant with architecture and tenets?**
   Yes — it is selected *because* it satisfies isolation, single-AI-plane, structured
   output, and "no provider keys outside SF" simultaneously. Options A, B, D were rejected
   precisely where they break a tenet.

3. **Avoids over-architecture / unnecessary complexity?**
   Yes, and this is the live risk to police in execution: the durable surface must reuse
   the SF plane, not grow a parallel framework. Guardrail — 108C ships exactly one real
   durable agent before any "platform" generalization is allowed to harden. The same
   guardrail applies to the outbound/MCP layer (§3.5): we adopt the *principles* now
   (intent tools, one credential custodian) but defer building the layer until GTM (108D)
   actually needs an external system — no MCP server or outbound framework gets built
   speculatively (AGENTS.md §3).

4. **Moves us toward the intended architecture and goals?**
   Yes. It makes "1 human + AI workforce" buildable as more than three agents, which is
   the company's operating thesis, while keeping the product CRUD path boring and safe.

5. **Safe, predictable, effective in production (per the OpenAI guide's deployment test)?**
   The direction is set up to be only if execution adds evals and observability early, not
   as a future flourish. 108A owns provider conformance and typed failures; 108B owns
   Builder fixture/eval scenarios; 108C owns reference-agent eval and review artifacts.
   No autonomous-write or customer-facing workforce action ships without risk policy,
   human review where required, and measurable pass/fail gates.

---

## 7. Open questions (resolve before 108A execution)

1. **Service-scoped execution transport:** RESOLVED (D5 dispositions, 2026-06-09):
   request/response durable calls → private service binding; fire-and-forget jobs →
   queue (matching the shipped `INSTANCE_TRANSLATION_JOBS` pattern — note the
   previously cited `SANFRANCISCO_L10N` binding never existed in code). No
   authenticated internal HTTP path.
2. **Where do ops-agent outputs live?** GTM JSON and UX audit reports are neither account
   truth nor SF telemetry. Proposed: a service-owned review store (R2 + D1) owned by the
   agent's orchestrator, explicitly outside product persistence. Confirm the boundary name.
3. **Registry model:** extend `ck-contracts` agent categories beyond
   `copilot`/`system_agent` and surfaces beyond `execute`/`endpoint` to express
   `durable`/`interactive` cleanly?
4. **Billing/usage aggregation** for service-scoped autonomous runs (the overview already
   flags "where AI usage is recorded for billing" as open).
5. **First durable agent:** SUPERSEDED (D5, 2026-06-09): the **Widget Instance
   Translator re-base** is the 108C reference — it is the shipped internal agent, and
   formalizing a production workload under the D9 regression gate beats building a
   speculative one. UX Writer waits until a real need exists.
6. **Outbound layer shape (§3.5):** when GTM (108D) first needs external systems, is the
   common outbound layer an internal MCP-style server SF/orchestrators consume, or a
   thinner shared client module? (Lean: adopt the *principles* — intent tools, one
   credential custodian, code-orchestration for big surfaces — and pick the concrete
   mechanism at 108D, not before an agent needs it.)
7. **External credential custody (§3.5):** where do Search Console OAuth tokens and
   keyword-API keys live, and what refreshes them? (Lean: a vault-style store owned by the
   AI plane, parallel to provider-key custody; OAuth/payment flows use browser handoff,
   never inline tool calls.)
8. **Risk-rating + human-gate model (§3.6):** which `riskClass` values belong in the
   registry/policy, what policy/approval signal must San Francisco require for each class,
   and which product/orchestrator boundary owns review artifacts, approval state, and
   commits? (Lean: risk declared in registry/policy; San Francisco enforces it; review
   state and product commits stay outside San Francisco.)
9. **Per-phase model selection (§3.6):** SUPERSEDED by PR-13/D8 (2026-06-09): routing
   is a first-class plane contract (`AgentRoutingPolicy`), not schema room. Interactive
   turn-class routing ships in 108A-1; the durable phase-class dimension ships in
   108A-2 and is mandatory for multi-phase durable agents.
10. **Concurrency model for the durable-agent calling pattern (resolve in 108A).** The
   current guard in `sanfrancisco/src/concurrency.ts` — `MAX_INFLIGHT_PER_ISOLATE = 8`, an
   in-isolate counter that throws 429 on overflow — is a *copilot* guard: it protects the
   interactive `/v1/execute` path from concurrent user turns, and is the right primitive
   for that workload. When durable orchestrators begin calling SF via service binding
   (Open Question 1), they introduce a second workload class: long-running, multi-step,
   non-interactive calls that may run for hours and make many sequential model requests.
   These classes must **not** share a ceiling — a saturated GTM run should not 429 a real
   user's copilot turn, and vice versa. *Design direction for 108A:* distinguish the two
   surfaces at the binding layer (HTTP `/v1/execute` = interactive; service-binding RPC =
   durable-agent) and apply separate concurrency budgets. The interactive ceiling stays
   tight (latency-sensitive, user-facing); the durable-agent budget is governed
   differently — likely a Workflow-level queue rather than an in-isolate counter, which
   fits the async nature of durable orchestration and aligns with Cloudflare Workflows V2's
   raised limits (50,000 concurrent running instances; 2M queued; waiting/sleeping
   instances don't count against concurrency — [Cloudflare Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)).
   This is a 108A design requirement, not a 108C discovery. (Lean: separate budgets keyed
   on calling surface; durable side queued at the orchestration layer.)

---

## 8. Decision sought from review

Approve, amend, or reject **Option C** as San Francisco's agent-platform direction —
including the §3.5 outbound-reach principles (one shared, intent-shaped external layer with
central credential custody) and the §3.6 agent-internal direction (keep work deterministic
where possible; treat model/tools/instructions as the unit with model choice owned by the
plane; single-agent-first; and make risk policy/evals/review gates explicit before
autonomous or customer-facing actions ship). These are stated as direction; their
mechanisms are for the execution PRDs to design. On approval, this doc graduates the
phased path (108B-1, 108B-2, parallel 108A-1 release gate, 108A-2, 108C, 108D, 108E+, with
108F named as a deferred direction) into the pipeline. EB-007 is marked
`promoted → PRD 108B`.
