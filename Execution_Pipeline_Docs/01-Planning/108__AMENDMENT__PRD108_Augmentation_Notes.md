# PRD 108 — Amendment & Augmentation Notes

**Status:** Ready for team review → merge into PRD 108 before 108A execution  
**Author:** Architecture Review (June 7, 2026)  
**Companion doc:** `108__PRD__San_Francisco_Agent_Platform_Architecture_Decision.md`  
**Purpose:** Five targeted additions to PRD 108 based on full codebase read, strategy doc review, and external world benchmarking. Each item below maps to a specific section of PRD 108 with exact placement guidance and ready-to-merge language.

---

## How to use this doc

Each section below:
1. Names the **target section** in PRD 108
2. States **why** the addition is needed
3. Provides **ready-to-merge text** the team can drop in directly

Nothing below changes the recommendation (Option C stands), the phasing, or the open questions. These are additive: context, a design direction, a sequencing constraint, and one new named concept. Do not edit these in unless at least two people on the architecture team have reviewed them.

---

## Amendment 1 — Add company-stakes framing to §1.1 (The company goal)

**Target:** §1.1, after the existing paragraph that ends with "…stacked into edge-served pages."

**Why this is missing:** §1.1 correctly describes what Clickeen is building, but it does not state why PRD 108 is existentially load-bearing for that thesis. A reader who hasn't internalized the strategy docs (investor whitepaper, `ClickeenVision.md`, `MarketPosition.md`) will treat this as an infrastructure PRD, not a company-defining one. The stakes need to be stated explicitly so every reviewer understands the cost of getting this wrong.

**Text to insert:**

> **Why PRD 108 is load-bearing for the company thesis, not just the codebase.**
>
> Clickeen's operating model is an AI-operated company: the GTM agent replaces a traditional marketing org; the UX Writer agent replaces a content team; the Support agent handles customer ops; the Localization agent makes global reach a property of the system rather than a project. This is not a roadmap aspiration — it is the reason the overlay model, the atomic data design, and the no-fallback principle exist. Every architectural decision in the codebase is downstream of this thesis.
>
> San Francisco is the constitutional layer that makes the fleet safe. The overlay model's guarantee — that agent writes can never overwrite user truth — only holds if every agent goes through the SF plane. One agent that mints its own grants, holds its own provider keys, or writes directly to account state breaks the guarantee for the entire system, not just that agent. PRD 108 is therefore not "how should we organize our agent infrastructure." It is "what is the single mechanism that makes autonomous execution safe, auditable, and scalable as the agent roster grows from 2 to 20."
>
> The corollary: the option that is cheapest to build today (Option A or B) is the option that makes the company thesis undeliverable tomorrow. The cost of Option C's upfront design is not overhead — it is the prerequisite for every agent that follows.

---

## Amendment 2 — Add the overlay/plane co-dependency to §4 (Recommendation)

**Target:** §4, after the existing explanation of why Option C was chosen over Options A and B.

**Why this is missing:** The recommendation section argues Option C from the atomic invariant (which is correct and should stay). But it never states the strongest corollary: the overlay model and the SF plane are co-dependent. This is the clearest way to explain why bypassing the plane is not just an architecture smell — it is a structural break of a guarantee the product explicitly makes to customers.

**Text to insert:**

> **The overlay/plane co-dependency (why there is no partial compliance).**
>
> The overlay architecture makes an explicit guarantee: agent writes live in a separate layer (`source = 'agent'`), RLS structurally prevents agent ops from overwriting user edits, and rollback is deleting a row. This guarantee is what makes it safe to let agents modify customer-facing content at all — it is the customer trust model, not just an implementation detail.
>
> This guarantee only holds under one condition: every agent that writes to customer state goes through the SF plane. The plane is the enforcement surface — it mints the grant, scopes the write permission, and ensures the `source` attribution is set correctly on every op. An agent that writes directly to account state, even with good intentions, bypasses the RLS boundary and makes the guarantee unverifiable.
>
> This means Option C is not a preference between architectural styles. It is the only option compatible with the overlay model's customer-facing promise. Any architecture that allows agents to self-govern their writes — including a "lite" version of Option B where agents share most infrastructure but self-mint grants for "small" writes — is incompatible with this constraint.

---

## Amendment 3 — Add the concurrency design direction to §7 Open Questions (new question #10)

**Target:** §7, as a new item after the existing nine open questions.

**Why this is missing:** The current 8-inflight copilot guard in `concurrency.ts` (`MAX_INFLIGHT_PER_ISOLATE = 8`) was designed for the interactive `/v1/execute` path — one turn, one user, latency-sensitive. When durable orchestrators begin calling SF via service binding (Open Question 1), they will share this ceiling with real-user copilot calls. A 4-hour GTM run making repeated model calls would exhaust the ceiling for Builder Copilot users. This is a different workload class and needs a different concurrency model. It must be resolved in 108A, not discovered during 108C.

**Text to insert:**

> **10. Concurrency model for the durable-agent calling pattern (resolve in 108A).**
>
> The current `MAX_INFLIGHT_PER_ISOLATE = 8` guard in `concurrency.ts` is a copilot guard: it protects the interactive `/v1/execute` path from being overwhelmed by concurrent user turns, and throws a 429 on overflow. It is the right primitive for that workload.
>
> When durable orchestrators begin calling SF via service binding (Open Question 1), they introduce a second workload class: long-running, multi-step, non-interactive calls that may run for hours and make many sequential model requests. These two classes should not share a concurrency ceiling — a saturated GTM run should not 429 a real user's Builder Copilot request, and vice versa.
>
> **Design direction for 108A:** SF should distinguish between the two calling surfaces at the binding layer (HTTP `/v1/execute` = interactive, service binding RPC = durable-agent) and apply separate concurrency budgets. The interactive ceiling stays tight (latency-sensitive, user-facing). The durable-agent budget is governed differently — likely by a Workflow-level queue rather than an in-isolate counter, which naturally fits the async nature of durable agent orchestration and aligns with Cloudflare Workflows v2's 50K concurrent workflow ceiling at the orchestration layer.
>
> This is a 108A design requirement, not a 108C discovery.

---

## Amendment 4 — Add the GTM design dependency to §5 (Phased evolution path), 108D entry

**Target:** §5, within the existing 108D description.

**Why this is missing:** The phasing correctly defers the GTM agent build to 108D on blast-radius grounds. But it does not state that 108D's external-reach and credential-custody architecture must be *designed* before 108C ships — even though the build happens after. If this design work is deferred until 108D starts, the outbound layer will be designed under time pressure with a live durable agent (108C) already running and potentially constraining the options. The design dependency runs earlier than the build dependency.

**Text to insert (add as a note under the 108D entry):**

> **Design-before-build note:** 108D's implementation follows 108C, but its architecture must be decided before 108C ships. Specifically: the outbound-layer shape (§3.5 — intent-shaped tools, one credential custodian, code-orchestration for large API surfaces) and the external credential custody model (vault-style store in the AI plane; OAuth/payment flows via browser handoff, never inline tool calls) will constrain what the SF plane contract can assume about any durable agent's outbound reach. Locking these as named design directions before 108C execution prevents 108D from arriving as a retrofit.
>
> Concretely: before 108C enters `02-Executing`, the team should have answered Open Questions 6 and 7 (outbound layer shape and external credential custody) at the design level — not necessarily built, but decided. 108D's execution PRD then implements against a known contract rather than inventing one.

---

## Amendment 5 — Add the self-improvement loop as a named future direction in §5 or a new §9

**Target:** End of §5 (Proposed evolution path), as a named future phase beyond 108E, or as a new §9 immediately before §7 Open Questions.

**Why this is missing:** The `/v1/outcome` endpoint exists today and writes learning signals to D1 after every copilot turn. The infrastructure for a self-improvement loop is already partially in place. But PRD 108 never names the loop or sets a direction for it. The risk: outcome data accumulates, nobody designs the loop, and the data becomes stale or deprioritized. The external world (2026 research on agent memory architectures) identifies the closed learning loop as the next frontier after governance — the thing that separates a fleet that improves from a fleet that stagnates. It should be named now even if its execution is deferred.

**Text to insert:**

> ### 108F — Learning loop (named direction, execution deferred)
>
> The infrastructure for a self-improvement loop already exists: `/v1/outcome` captures post-execution learning signals and persists them to D1. What does not yet exist is the closed loop that routes accumulated outcomes back into the signed policy — improving model selection per phase, refining tool descriptions, updating risk ratings — without requiring a full engineering PRD for each change.
>
> This is the architectural frontier beyond governance: a fleet that governs well but never improves is a static fleet. The combination of outcome data, per-phase policy (Open Question 9), and the overlay model's auditability creates the substrate for a loop where the SF plane can propose policy updates derived from observed outcomes, subject to human review before promotion.
>
> 108F is not in scope for the current phasing (108A–108E). It is named here so that:
> 1. Outcome data is treated as a first-class asset from 108A onward (not a telemetry afterthought).
> 2. The D1 schema for outcomes (designed in 108A) is forward-compatible with a query pattern that surfaces improvement signals.
> 3. The team does not need a future "discovery" phase to justify the loop — the direction is set.
>
> The concrete mechanism (who proposes updates, what the human review gate looks like, how policy versions are managed) is 108F execution work.

---

## Summary of changes

| Amendment | Target section | Type | Blocking for 108A? |
|---|---|---|---|
| 1 — Company stakes framing | §1.1 | Additive context | No — but strongly recommended before team review |
| 2 — Overlay/plane co-dependency | §4 | Additive reasoning | No — but strengthens the Option C argument |
| 3 — Concurrency model (OQ #10) | §7 | New open question | **Yes — must resolve in 108A design** |
| 4 — GTM design dependency | §5 / 108D | Sequencing constraint | **Yes — OQ 6 & 7 must be decided before 108C ships** |
| 5 — Self-improvement loop (108F) | §5 / new | Named future direction | No — named now, executed later |

---

*End of amendment doc. Questions or pushback → bring to architecture review before merging into PRD 108.*
