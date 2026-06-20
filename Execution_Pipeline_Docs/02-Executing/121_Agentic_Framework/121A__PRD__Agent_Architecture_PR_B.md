# Peer Review B - 121A Agent Architecture

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121A__PRD__Agent_Architecture.md`, the 121 umbrella, and Clickeen
product law (widgets are software; Bob edits one in-memory instance; Roma owns
account/persist/publish; San Francisco owns AI execution).

## Verdict

Accept with edits. 121A is correctly scoped as an infrastructure-only rail
document and it makes the one decision that matters: an agent is a named worker
with a contract, not a regex router or a model call. That framing is sound and
on-tenet. The risk in this PRD is not over-ambition — it is that it lists nine
contract surfaces ("agent identity, invocation envelope, context contract,
capability/tool contract, model/provider adapter boundary, tool invocation
boundary, child-agent invocation boundary, trace/cost/error/version records,
outcome hooks, policy and validation gates") as if all of them must exist before
the first agent ships. Several should not be built until 121C forces them.

## 1. Elegant Engineering And Scalability

What is genuinely good here:

- **The agent definition (Section 2) is the right primitive.** Naming a worker
  with owner + invocation boundary + context contract + capability surface +
  output contract + trace is exactly the boring, durable shape. It scales
  because every later agent (Product Copilot, Translation, SDR) fills the same
  slots without inheriting each other's logic.
- **"The product surface chooses the agent" (Section 5) is the load-bearing
  scalability decision.** Killing global raw-text routing means you never build
  the brittle dispatcher that every generic agent framework dies on. Bob knows
  it is invoking Product Copilot; Roma knows it is invoking Translation. This is
  correct and it is the single most important sentence in the document.
- **Separating agent identity from model provider (Section 8, Acceptance)** is
  what lets you swap models without touching agent contracts. Cheap, correct,
  necessary.

## 2. Compliance To Architecture And Tenets

- **Product law: compliant.** Section 7 keeps side effects in product-owned
  code; the agent reasons about tools, product code validates and executes.
  Non-goals explicitly forbid moving product truth into San Francisco. Good.
- **No-fake-framework tenet: mostly compliant.** Section 3 non-goals ("do not
  build a universal agent personality / shared Copilot framework") are the right
  guardrails and they directly answer the umbrella's OQ10.
- **One gap against the "attack omissions" tenet:** the PRD says agents "may
  share only execution infrastructure where the commonality is real and boring"
  but never states the rule for *when* a contract gets extracted. Without a
  rule, "shared infrastructure" becomes a magnet — someone will build the
  child-agent boundary on day one because the list implies it. Add an explicit
  extraction rule: **a shared contract is created only after two real agents
  need it, never before.** The umbrella says this (OQ2: "extract only proven
  infrastructure pieces"); 121A must restate it as a hard rule, not a vibe.

## 3. Over-Architecture / Unnecessary Complexity

This is the main finding. The "Architecture Shape" block (Section 4) lists ten
infrastructure surfaces. Three of them are speculative on day one:

- **`child-agent invocation boundary`** — the umbrella (OQ5) and 121B both say
  child-agent calls come *after two real agents exist*. Listing it as a
  first-class architecture surface in the foundational rail PRD invites someone
  to build the contract before there is a caller or a callee. It should be named
  as **explicitly deferred**, not listed flat alongside the surfaces you need on
  day one.
- **`outcome hooks`** — correct to reserve a seam (121G needs it), but "hooks"
  with no consumer is a classic place to gold-plate. Specify it as *one nullable
  field on the trace record*, not a subsystem.
- **`capability/tool contract` as a generic surface** — 121C's first Product
  Copilot needs maybe one real tool (apply a validated draft edit, which Bob
  already owns). A full generic tool-contract schema (Section 7's nine declared
  fields per tool) before a second tool exists is the registry-before-tools
  trap the umbrella warns against in OQ4. Keep the *list* of fields as guidance,
  but do not require a central typed registry — the umbrella's leaning is
  "product-surface tool manifests," and 121A should say so to prevent a registry
  being built here.

None of this is fatal. The fix is one paragraph: mark which surfaces are
day-one (identity, invocation envelope, context contract, model adapter, trace)
and which are deferred-until-justified (child-agent boundary, tool registry,
outcome subsystem).

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **Low academic-jargon risk — good.** The prose is concrete and declarative.
  No invented abstractions, no "ontology of agents," no taxonomy theater. This
  is the right register.
- **The one pre-work smell** is that 121A is a pure rail document with no
  forcing function of its own. A rail PRD with no agent to validate it can
  quietly grow surfaces that no agent ever exercises. Mitigation: state that
  **121A's contracts are ratified by 121C, not before** — i.e., the architecture
  is provisional until the first real agent proves each contract is needed. This
  keeps 121A honest and prevents it from becoming a spec that implementation
  later contradicts.
- **Versioning (Section 9) is appropriately boring.** Tracing by agent id +
  version + context version + model route + validation result is the minimum
  that future evals need. Not gold-plated.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

Yes, with the trims above. The spine of 121A — *named agents, product surface
invokes, infrastructure shared only when real, product keeps truth and side
effects* — is the simplest correct foundation and it moves directly toward the
intended end state (San Francisco as orchestration plane, product surfaces as
truth owners). It is boring in the right way: it decides ownership and
invocation, and refuses to decide agent behavior.

The only way 121A gets un-boring is if the ten-surface list is read as a
build list. Make it a *menu with day-one vs deferred labels* and an *extraction
rule*, and this PRD is exactly the rail it should be.

## Required Edits Before Build

1. Add an explicit **extraction rule**: shared contracts are created only after
   two real agents need them.
2. **Label Section 4 surfaces** day-one vs deferred. Mark child-agent boundary,
   tool registry, and outcome subsystem as deferred-until-justified.
3. State that **121A contracts are ratified by 121C** (first real agent), not
   standalone — the architecture is provisional until an agent exercises it.
4. Replace any implied central tool registry with the umbrella's
   **product-surface tool manifest** leaning, so a registry is not built here.

---

## Addendum - Best-Practice / State-Of-The-Art Lens

Sourcing caveat: applied from the agentic-engineering canon current to ~Jan 2026
(Anthropic *Building Effective Agents*, *Effective context engineering for AI
agents*, multi-agent research write-up; *12-factor agents*; Cognition *Don't
Build Multi-Agents*). Live web pull was unavailable this session — re-verify the
contested points before locking. See the umbrella review's addendum for the full
canon; this addendum applies it to the architecture rail.

### What 121A gets right against the canon

- **Agent ≠ model call ≠ router ≠ validator (Section 2)** matches the field's
  hard-won definition: an agent is a worker with a purpose, a context contract, a
  tool surface, and a loop. 121A has all of these except the loop.
- **"Product surface invokes the agent"** aligns with *12-factor agents*' "own
  your control flow" and "small, focused agents" — invocation is deterministic
  code, reasoning is the model. Good.
- **Provider independence below the agent contract** is exactly right and ahead
  of frameworks that couple agent logic to a provider SDK.

### Best-practice gaps to add

- **A1 (critical) — Specify the agent loop as a first-class architecture
  surface.** The current "reasoning step" (Section 2) and the Section 4 shape
  list describe a single inference, not an agent. Add: iteration model,
  observation handling (tool result → re-reason), explicit stopping conditions,
  a max-step ceiling, and a per-invocation token/cost budget. This is *the*
  defining agent mechanic and it is the one infrastructure piece that genuinely
  is shared across all agents — it belongs in 121A more than the child-agent
  boundary does.

- **A2 — Reframe "context contract" toward just-in-time retrieval (Section 6).**
  121A says context must be "product-surface-provided, bounded, typed." Modern
  practice splits this: a thin **orientation capsule** (what/where/allowed) plus
  **context-fetch tools** the agent calls when it needs detail. Bake the seam for
  context-as-tools into the rail now, or every agent will default to fat
  pre-loaded payloads and hit context rot. This is cheap to state and expensive
  to retrofit.

- **A3 — Tool contract is missing the ergonomics half (Section 7).** The nine
  declared fields are the *machine* contract. Add the *agent* contract: what the
  tool returns to the model (high-signal, token-efficient), and error messages
  written to help the model recover. The ACI is as important as the schema.

- **A4 — Name the eval seam.** Trace/versioning (Section 9) is recorded for
  "future learning," but the same records feed a day-one eval harness. State that
  the architecture's trace is the substrate for evals from the first agent, so
  121C/121G don't build two capture paths.

These reinforce, not reverse, my main finding: 121A should be a thin rail
ratified by 121C. The loop (A1) and just-in-time context (A2) are the two things
that genuinely belong in the rail on day one; the child-agent boundary and tool
registry still do not.
