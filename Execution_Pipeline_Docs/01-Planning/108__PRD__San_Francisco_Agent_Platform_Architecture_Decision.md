# PRD 108 - San Francisco Agent Platform: Architecture Decision

Status: PLANNING
Owner: Product + Architecture (San Francisco)
Priority: P1
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

---

## 1. Understand Clickeen first

### 1.1 The company goal

Clickeen is an AI-first company building AI-operated, embeddable widgets — software built
like organisms (atomic design), operated by AI, served in 29+ languages, stacked into
edge-served pages. The product thesis ("reimagining the webpage") is inseparable from an
operational thesis: **Clickeen runs as 1 human + an AI workforce.** Sales, support,
marketing, localization, and ops are agents, not teams (`documentation/ai/overview.md`).

That means agents are not a feature bolted onto the product. They are how the company
operates and how the product self-improves. The platform that runs them is core
infrastructure, not a side service.

### 1.1.1 Why this is new territory (the actual complexity of this PRD)

The hard part of this decision is **not** the agents, and not the durable-vs-synchronous
orchestration plumbing — that is ordinary engineering. The genuine complexity is that
**Clickeen is charting territory the existing agent literature was not written for**, so
most "best practice" for building agents on top of SaaS either does not transfer to
Clickeen or describes a problem Clickeen has already solved at the substrate level.

The reason is a single architectural commitment, applied **system-wide, from the ground
up: atomic design — in Brad Frost's sense — not as a UI styling choice but as the law of
the entire codebase.** One canonical "atom" per concept, composed by reference, with
duplication treated as illegal and invalid state failing closed at a named boundary. This
shows up identically across layers that have nothing else in common:

- **State atoms.** Instance truth is split by *product meaning* into the smallest
  non-overlapping units — `instance.config.json` (structure/style/behavior/identity) vs.
  `instance.content.json` (base text in declared editable paths). Not one blob, not
  fanned-out columns. `instance.json` is explicitly demoted: "not a product source
  authority" (`documentation/architecture/CONTEXT.md`).
- **Truth atoms.** "Preview is not a second widget-shaped truth." "Locale is a runtime
  parameter… IDs must be locale-free… not DB fan-out" (`Overview.md`). Localization is an
  *overlay* on the atom, never a duplicated row per locale.
- **Addressable text atoms.** Every editable string is a dotted path with a role and a
  stable `identityKey` (`ck-contracts/translated-value-primitives.ts`); synonyms for an
  existing atom are *forbidden* by constant (`SHELL_FORBIDDEN_ALIAS_PATHS`).
- **Layered, source-tagged state atoms.** `widget_instance_overlays` stores `base + ops`
  layers keyed by `layer ∈ {locale, geo, industry, experiment, account, behavior, user}`,
  each tagged `source ∈ {agent, manual, import, user}`, with RLS that structurally blocks
  agent overwrites of user edits.
- **Service atoms.** Each concern has exactly one Product Authority (widget defs → Tokyo
  source; publish → Tokyo ops; translations → locale-value ops). "Orchestrators = Dumb
  Pipes." No concern has two owners.
- **Enforcement.** "No Fallbacks… the system fails visibly." "If code cannot be explained
  in that model, it is suspect by default." Duplicate truth is a *deletion target*
  (AGENTS.md §1A).

The consequence is the thing this PRD turns on: **because every concept is one atom with
one authority, composed by reference and fail-closed on duplication, the entire company's
truth is agent-addressable by construction.** An agent has exactly one place to read and
one place to write for any given truth. That is precisely what legacy SaaS cannot retrofit
— in an accreted system the same concept lives in five places (a column, a cache, a
denormalized table, a frontend constant, a key-value entry), none authoritative, and no
agent can safely mutate it.

This reframes how the rest of the document uses external references. The published agent
literature — OpenAI's *Practical guide to building AI agents*, Anthropic's *Building
agents that reach production systems with MCP*, and the broader "agents for SaaS" canon —
was written for the accreted, non-addressable substrate Clickeen does not have. So those
works are treated here as **literature to test against, not guidance to follow.** Where an
idea transfers, we say so; where Clickeen's substrate already solves the problem, we mark
it *already ahead*; where it assumes a substrate Clickeen lacks, we mark it *does not
apply*. §1.1.2 makes that explicit; §3.5 and §3.6 apply it.

### 1.1.2 Where the agent literature does and does not apply

| External idea | Verdict for Clickeen | Why (grounded in the codebase) |
|---|---|---|
| Model-swappability as table stakes for every agent | **Already ahead** | `AgentRuntimePolicy` already carries `allowModelPicker` + a pinned `selectedModel`, enforced by `modelRouter.ts`. User-facing copilot can swap from a catalogue; internal/durable agents pin an eval-locked default. This is a *policy setting per agent*, not a feature to build. |
| Do the deterministic part deterministically; use the model only for judgment (OpenAI) | **Transfers** | Restates AGENTS.md §3 ("no fake generic layers") at the per-task level. Fixed transforms (formatting an audit report) are code, not model calls. |
| Single-agent-first; split only when forced (OpenAI) | **Transfers** | Confirms the 108C guardrail (one real durable agent before any generalization). |
| Layered guardrails + risk-rated human-in-the-loop gate (OpenAI) | **Transfers, but build from the substrate** | The reversibility/blast-radius signal already lives in the overlay model (`source`, `base_fingerprint`, layer composition, the user-edit-protection RLS). The gate is derived from atoms we already have, not invented. |
| M×N integration / intent-shaped tools / one credential custody (Anthropic MCP) | **Applies only at the genuinely external edge** | *Inside* the company there is no M×N problem: internal reach is native, addressable contracts (overlay paths, single authorities). MCP-style mediation is warranted only for truly external, human-built systems (competitor pages, keyword APIs, Search Console). |
| Wrap fragile human-shaped SaaS APIs so agents can drive them (general SaaS canon) | **Does not apply** | Premised on opaque, non-addressable state. Clickeen's state is atom-addressable, so the wrapping problem the canon solves largely does not exist internally. |

### 1.2 What San Francisco already is

San Francisco is already named, in canonical docs, as the **"operating system for the
company's AI workforce"** (`documentation/ai/overview.md`). It is a Cloudflare Worker that
already owns the AI plane:

- **Grants:** HMAC-signed `AIGrant` from trusted issuers (`roma`, `sanfrancisco`),
  short-lived, capability-scoped, carrying a signed `AgentRuntimePolicy` (`grants.ts`).
- **Capability + boundary model:** `assertCap(grant, 'agent:<id>')`; registry declares
  `boundary` per agent (`editor_ops_only`, `account_widget_translated_values`,
  `prague_copy_tooling_output`).
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
| Prague Copy Translator | `website.prague.copy.translator` | **Shipped (endpoint)** | Prague l10n tooling | overview, ai.ts |
| GTM Agent ("AI VP of Marketing") | `ops.gtm.*` (proposed) | **Spec'd, not built** | internal/ops cron | `agents/gtm.md` |
| UX Writer | `ops.uxwriter.*` (proposed) | **Spec'd, not built** | internal/ops cron | `agents/ux-writer.md` |
| Support Reply | `support.reply` (named) | Future | (TBD) | overview "Terms" |
| Community Moderation | `ops.communityModeration` (named) | Future | (TBD) | overview "Terms" |

The overview's roster table ("replaces product specialists / localization team / marketing
org") and its Terms section naming `support.reply` and `ops.communityModeration` make the
intended end-state explicit: a workforce spanning **editor assistance, localization,
marketing, support, and ops moderation.**

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
  Community Moderation, Prague Copy.

**Dimension C — Output target / boundary:**

- `editor_ops_only` (returns `ops[]` into a widget): Builder Copilot.
- `account_widget_translated_values`: Instance Translator.
- `prague_copy_tooling_output`: Prague Copy.
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
   through San Francisco's shared spine** (e.g. a private service binding, exactly like
   Tokyo-worker → `SANFRANCISCO_L10N` already does for instance translation).

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
the registry already has the lever, it just needs pulling per agent. This is a policy
setting, not new platform code.

**(c) Single-agent-first — which is the discipline this doc already adopts.** The guide is
explicit that teams succeed by maximizing one agent before adding multi-agent complexity,
and split only when one agent provably can't follow its instructions or its tools overlap.
This simply confirms the **108C guardrail already in this doc** (one real durable agent
before any generalization). If a durable agent later outgrows a single prompt, the guide's
**manager pattern** (a coordinator calling sub-agents as tools) is the sanctioned next
step, and it would compose with Option C rather than fork the plane — but we don't build
toward it speculatively (AGENTS.md §3).

**(d) Guardrails are layered, and autonomous agents will need a human-in-the-loop gate —
and that gate wants to be a plane concern, not per-agent.** The guide treats guardrails as
a layered defense (relevance, safety/jailbreak, PII, harmful-content, brand) and rates each
action by risk (read-only vs. write, reversibility, impact), escalating high-risk actions
to a human. Clickeen already has the first layer (signed grants, capability/boundary
enforcement, budgets, timeouts). The durable *autonomous* agents — GTM publishing, Community
Moderation acting on user content — are the ones that force the next layer: a sense of how
risky an action is, and a human checkpoint before the riskiest ones commit. The roster
already assumes "propose → human accepts → committed" for ops agents. *What this means for
SF's evolution:* that human gate is most coherent as a shared plane capability rather than
re-invented inside each agent — so a uniform safety story holds as the roster grows. The
exact shape (where risk is declared, where the gate lives) is an execution question, noted
in §7, not decided here.

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

Why this is the right fit for *Clickeen specifically*:

0. **It is the only option that preserves the system-wide atomic invariant** (§1.1.1).
   Clickeen's whole codebase is one-atom-per-concept, no duplicate truth, fail-closed.
   Option B gives the AI spine N copies (the atomic sin at the platform layer); Option A
   collapses two volatility classes into one atom that should stay separate. Option C keeps
   the AI spine a single atom with one authority, and lets durable agents *compose over*
   the product's existing atoms (overlay paths, source-tagged layers, single Product
   Authorities) rather than become a second source of truth. The workforce obeys the same
   law as the rest of the system — which is the entire reason an agent workforce is
   tractable here at all.
1. **It honors the shipped isolation tenet** while keeping the "AI Workforce OS" real —
   the two things the canonical docs insist on simultaneously.
2. **It generalizes a pattern already in production**, not a theory: account-widget
   instance translation is already an external orchestrator (Tokyo-worker/queues) calling
   San Francisco's execution plane through a private binding. Option C is "do that, on
   purpose, for every durable agent."
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

### What stays fixed (non-negotiable, regardless of agent)
- Provider keys live only in San Francisco.
- Grant verification, capability + boundary enforcement, model routing, budget/timeout
  ceilings, and learning-event emission are San Francisco's, used by every agent.
- Policy/entitlements/persistence stay in Roma/Berlin/Tokyo.
- Every agent returns structured output and fails at a named boundary.
- **External reach is shared, not per-agent** (§3.5): when a durable agent needs an
  outside system, it goes through a common, intent-shaped outbound layer with one credential
  custodian — not a bespoke per-agent client with its own key handling.
- **Safety is a plane property, not a prompt** (§3.6): the riskiest autonomous actions
  (irreversible, externally publishing, acting on user content) get a human checkpoint that
  is owned by the plane, so one safety story holds across the whole roster. The mechanism
  is for execution to design (§7).
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

- **108A — Formalize the AI plane contract.** Define the internal execution interface San
  Francisco exposes to *both* surfaces: input validation, grant/policy/boundary
  enforcement, model resolution, budget accounting, structured result + usage, learning
  event. Make `/v1/execute` and the service-binding path both consume it. Extend the
  registry so durable/service agents are first-class (not just `execute` vs `endpoint`).
  This is also where the §3.6 capabilities get their concrete contract — how an action's
  risk is expressed, where the human-review gate lives, and how finer-grained model choice
  is carried in policy — designed then, not pre-decided here.
- **108B — Interactive surface cleanup (resolves EB-007).** Split `widgetCopilotCore.ts`
  into shared plane primitives vs. per-agent behavior; remove `role`-flag flattening; make
  "add an interactive agent" a registry + thin behavior-module operation.
- **108C — Durable agent pattern (reference implementation).** Stand up the governed
  durable-agent pattern end-to-end with **one** real agent (recommend **UX Writer** first:
  service-scoped, no account-truth risk, clear human-review output, smallest blast radius)
  — orchestrator worker + SF-routed execution. This becomes the template.
- **108D — GTM Agent on the pattern.** Re-base the existing GTM spec onto the governed
  plane (drop its standalone grant/model/telemetry; reuse SF's). GTM is the **first agent
  that needs external reach**, so this is where §3.5's outbound layer gets built for real:
  intent-shaped tools for competitor/keyword/Search-Console access, centralized external
  credential custody, and — if any single API surface is large enough to warrant it — the
  search+execute code-orchestration shape. Pair the agent with a **skill** (a written
  playbook for *how* to use those tools well): per the MCP article, tools grant access
  while skills supply procedural know-how, and the most capable agents carry both.
- **108E+ — Support Reply, Community Moderation** onto whichever surface fits (Support
  Reply likely interactive; Moderation likely durable). These carry the roster's
  **highest-risk actions** (live customer-facing replies; acting on user content), so they
  are where §3.6's human-in-the-loop checkpoint matters most — sequenced after the plane's
  safety capability (designed in 108A) exists.

Each phase ships docs-in-sync with code before moving to `03-Executed`, per the pipeline.

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
   The direction is set up to be. The doc names layered guardrails and a human checkpoint
   for irreversible actions as plane-level concerns (§3.6), and the phased path is
   deliberately incremental (one agent, validated, before generalizing) so the guide's
   "start small, validate, layer guardrails, escalate to humans" discipline is followed.
   The concrete safety mechanism is execution work (108A, §7), not settled here.

---

## 7. Open questions (resolve before 108A execution)

1. **Service-scoped execution transport:** do durable orchestrators call San Francisco via
   a private service binding (like `SANFRANCISCO_L10N`) only, or is there also an
   authenticated internal HTTP path? (Lean: binding-first.)
2. **Where do ops-agent outputs live?** GTM JSON and UX audit reports are neither account
   truth nor SF telemetry. Proposed: a service-owned review store (R2 + D1) owned by the
   agent's orchestrator, explicitly outside product persistence. Confirm the boundary name.
3. **Registry model:** extend `ck-contracts` agent categories beyond
   `copilot`/`system_agent` and surfaces beyond `execute`/`endpoint` to express
   `durable`/`interactive` cleanly?
4. **Billing/usage aggregation** for service-scoped autonomous runs (the overview already
   flags "where AI usage is recorded for billing" as open).
5. **First durable agent:** confirm UX Writer as the reference implementation over GTM
   (lower blast radius, no account-truth coupling).
6. **Outbound layer shape (§3.5):** when GTM (108D) first needs external systems, is the
   common outbound layer an internal MCP-style server SF/orchestrators consume, or a
   thinner shared client module? (Lean: adopt the *principles* — intent tools, one
   credential custodian, code-orchestration for big surfaces — and pick the concrete
   mechanism at 108D, not before an agent needs it.)
7. **External credential custody (§3.5):** where do Search Console OAuth tokens and
   keyword-API keys live, and what refreshes them? (Lean: a vault-style store owned by the
   AI plane, parallel to provider-key custody; OAuth/payment flows use browser handoff,
   never inline tool calls.)
8. **Risk-rating + human-gate model (§3.6):** is risk a fixed registry attribute per agent
   action, or computed (write-access × reversibility × impact)? And does the human-review
   gate live in the plane (uniform) or in each orchestrator (flexible)? (Lean: rating in
   the registry; gate primitive in the plane so it can't be skipped per agent.)
9. **Per-phase model selection (§3.6):** does the signed policy carry a single model per
   agent, or a model-per-phase map? (Lean: per-phase map, so cheap phases use cheap models
   once evals prove parity.)

---

## 8. Decision sought from review

Approve, amend, or reject **Option C** as San Francisco's agent-platform direction —
including the §3.5 outbound-reach principles (one shared, intent-shaped external layer with
central credential custody) and the §3.6 agent-internal direction (keep work deterministic
where possible; treat model/tools/instructions as the unit with model choice owned by the
plane; single-agent-first; and make layered guardrails + a human checkpoint for the
riskiest actions a plane concern rather than a per-agent one). These are stated as
direction; their mechanisms are for the execution PRDs to design. On approval, this doc
graduates the phased path (108A–108E) into the pipeline and the first execution PRD (108A)
enters `02-Executing`. EB-007 is marked `promoted → PRD 108B`.
