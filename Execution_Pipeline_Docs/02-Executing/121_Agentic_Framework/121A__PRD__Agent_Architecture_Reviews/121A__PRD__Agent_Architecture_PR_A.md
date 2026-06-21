# Peer Review A — 121A (Agent Architecture)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121A__PRD__Agent_Architecture.md`
Date: 2026-06-20
Verdict: **REVISE — NOT EXECUTION-READY AS WRITTEN.** The principles are correct and well-aligned with current best practice. The form is wrong: this is a premature, concrete-less framework spec that violates the umbrella's own "extract shared framework only from real repeated need" rule (OQ10) and the field's "simplest solution possible" consensus. Either make it concrete-and-minimal (typed contracts for Product Copilot only) or demote it from EXECUTING until a second agent justifies extraction.

Research lens applied (sources in the umbrella's Revision A.1): Building Effective Agents; Effective Context Engineering; Multi-Agent Research System; Demystifying Evals.

---

## 0. Code surfaces this PRD touches (grounding)

| Surface | Verified reality | What 121A requires of it |
|---|---|---|
| Agent registry — `packages/ck-contracts/src/ai.ts` | 2 agents; categories `copilot`/`system_agent`; surfaces `execute`/`endpoint`; **no durable/interactive axis, no per-agent tool/capsule fields, no child-agent concept** | §2/§4 require "agent identity," "capability/tool contract," "context contract" per agent — **the registry cannot express any of this today** |
| Model capability registry — `ck-contracts/src/ai.ts` `AI_MODEL_CAPABILITIES` | Declares `tokenParam` + `supportsTemperature` only; **`reasoningEffort` typed but unpopulated; no structured-output/tool-call capability** | §7 "the agent can reason about tools" implies native function-calling — **the model layer cannot declare that capability** |
| SF executor — `widgetCopilotCore.ts` | One `callChatCompletion` + JSON parse; no native tools; strictly request/response | §4 "tool invocation boundary" / §7 tool reasoning — **no tool-execution path exists** |
| Providers — `grants.ts` `AI_PROVIDER_SET` | Hardcoded `{deepseek, openai}` | §8 enumerates 6 model classes as if live — **only 2 wired** |

121A names none of these surfaces and scopes none of the registry/capability work its own rails depend on.

---

## 1. Elegant engineering and scalability — INTENT GOOD, MECHANISM UNDEFINED

The separating idea is sound and scales: **shared infrastructure-only rails; agent-specific behavior (purpose/context/tools/UX/risk) stays in each agent PRD.** Done right this is O(1) shared code per new agent and matches the "one plane, per-agent behavior" posture the 120 series ratified. §2's core correction — "an agent is a named worker with purpose, owner, invocation boundary, context contract, tool surface, reasoning step, output contract, validation, policy, trace, version" — is the correct mental model and directly kills the regex-as-brain masquerade.

But "elegant" requires a concrete contract. §4's architecture shape is an 11-item noun list (`agent identity`, `invocation envelope`, `context contract`, …) with zero types, schemas, or code surfaces. There is nothing here to scale because there is nothing here to build. Scalability of a concept list is not a property you can claim.

---

## 2. Compliance to architecture and tenets — STRONG ON THE PAGE

The non-negotiables are right and well-stated:
- §3/§10: product truth stays out of SF; product-owned code validates and executes side effects; trace is not product truth.
- §5: **the product surface chooses the agent; raw user text does not globally route.** This is correct and is itself a (deterministic) workflow — exactly the workflow-vs-agent split the research endorses.
- §7: "agent reasons about tools; product-owned code validates/executes side effects." This is the right brain-vs-execution separation and is consistent with the umbrella Revision A.1 (loop emits; product surface applies).

No tenet violations in the prose. The problem is what the prose enables, not what it says — see §3.

---

## 3. Overarchitecture / unnecessary complexity — MAIN FINDING

121A is the premature-framework pattern, stated as a positive. It defines the **full common execution architecture for four agent classes before a second agent exists.** Only Product Copilot is being built; SDR, Translation, and "future internal agents" are deferred (umbrella §9, 121E). The research is explicit and cited:

- *Building Effective Agents:* "find the simplest solution possible, and only increase complexity when needed… optimizing single LLM calls with retrieval and in-context examples is usually enough."
- The umbrella's own OQ10: "Do not build a broad framework module until two or more real agents repeat the same need."

121A pre-defines an 11-element rail set + 9-element agent shape + 9 tool-declaration fields + 9 trace fields + 6 model classes — none extracted from observed repetition. Specific over-reaches:

- **§4 "child-agent invocation boundary" in the core rails.** Agent-to-agent is deferred by the umbrella (OQ5) and the research (multi-agent = ~15× tokens; "LLMs not yet great at coordinating in real time"; Clickeen's work is focused, not breadth-research). Putting it in the shared architecture now invites building it. **Remove from core rails; add only when a second agent forces it.**
- **§8 enumerates six model classes** (hosted frontier, cheaper hosted, self-hosted, hybrid, fallback, classifier/judge) as architectural first-class concerns. Only two providers are wired; self-hosted is explicitly a deferred option (umbrella §3.4, 121H). This is designing the model plane for a fleet that doesn't exist.

---

## 3b. Academic abstraction / pre-work / meta-work / gold-plating — HIGH RISK

This is the PRD's defining weakness and the reason for the verdict.

- **It is a concept doc, not an architecture spec.** "Context contract" appears three times and is never typed. "Agent identity," "invocation envelope," "capability/tool contract," "model/provider adapter boundary" — none have a shape an engineer can implement. For a `Status: EXECUTING` P0, that is not executable. The lens (Context Engineering) calls for system prompts and tools at the *right altitude* — not brittle if/else at one extreme, not vague at the other. 121A sits at the vague extreme: it names categories without concretizing any.
- **It is meta-work:** defining the shape of the shape. The honest version of this PRD is one paragraph: "Product Copilot is the first agent; define exactly the envelope, context capsule, tool manifest, and trace record it needs; promote a field to shared `ck-contracts` only when the Translation agent (121D) reveals it is actually common." 121A instead writes the platform ahead of the proof.
- **Gold-plating:** §7's 9-field tool declaration, §9's 9-field trace record, §8's 6 model classes — all specified before one tool, one trace, or one extra provider is real. The research's ACI guidance says invest in *tool descriptions* (not tool-declaration taxonomies) and test how the model uses real tools.

---

## 4. Simple, boring, and toward intended architecture — INTENT YES, EXECUTION NO

The *intent* is simple and boring: infrastructure-only, agents don't share product logic, surface picks the agent. That is the right boring. But the *execution* (predefined full rail set, concrete-less) is the opposite of boring — it is speculative platform engineering dressed as plumbing. The simplest, most boring, goal-moving version is: ship the minimal typed envelope/capsule/tool/trace for Product Copilot, and let repetition do the extraction. 121A as written will either (a) block on "what is a context contract?" during implementation, or (b) get built as an empty framework that the first real agent ignores.

---

## Omissions & blast radius

### A. No concrete contract anywhere — the biggest omission.
A P0 EXECUTING architecture PRD must define at least the minimal typed shapes it governs: the invocation envelope, the context capsule, the tool manifest, the trace record. 121A defines none. **Blast radius:** every downstream PRD (121B–D) will invent its own shapes and drift; "shared infrastructure" becomes fictional. **Fix:** concretize the four minimal types Product Copilot needs, or demote.

### B. Loop-location is not decided — and 121A is the PRD that should decide it.
The umbrella (OQ1) pushed the topology call to "121A/121B." 121A lists "tool invocation boundary" and "child-agent invocation boundary" (§4) but never says where the agent loop runs. Per Revision A.1, this is *the* architectural decision: for Product Copilot the loop runs where its tools (in-memory edits) execute — **Bob (client)** — or SF reasons over a capsule and emits actions; either way there is no SF→product callback channel. 121A sidesteps it, so 121B/121C will each guess. **Fix:** decide loop-location here, or explicitly hand 121B a named decision with the two options and their capability tradeoffs (live tool feedback vs single round-trip).

### C. The rails have no home in the shipped registry.
121A's "agent identity," "context contract," and "capability/tool contract" require per-agent fields the registry (`ck-contracts/ai.ts`) does not have (verified: 2 categories, 2 surfaces, no capsule/tool/durability fields). **Blast radius:** the architecture cannot be implemented without registry changes that 121A neither names nor scopes. **Fix:** add a "Registry changes" section scoping the minimal `ck-contracts` extension, or explicitly defer it.

### D. Tool reasoning implies a model capability the layer can't declare.
§7 lets the agent reason about tools; that implies native function-calling. The capability registry cannot declare structured-output/tool-call support today (`reasoningEffort` is even unpopulated). **Blast radius:** the tool architecture is built on an unverified model assumption. **Fix:** name "model declares tool/structured-output capability" as a 121A/121B dependency and a capability-registry gap to close.

### E. Trace is named; eval is not.
§9 says trace exists for "observability, debugging, evals, cost, learning" — but trace ≠ eval. The lens (Demystifying Evals) is explicit: evals are day-one, architecture-level (capability + regression suites, code + LLM-as-judge + human graders, pass@1 and pass^k, read transcripts, eval-driven development). The architecture should name how evals consume trace and where the eval harness hooks in. **Fix:** add an eval contract (minimal grader types + the pass@1/pass^k tracking) to §9, not just a trace record.

---

## V1–V8 scan (induced-risk audit)

| ID | Risk induced by 121A | Status |
|---|---|---|
| V3 Silent omission | Shipping "the architecture supports agents" while zero concrete contract exists | **Open** — needs concretization (§Omissions-A) |
| V6 Partial-success masquerade | Presenting an 11-element rail list as built architecture when it is a concept inventory | **Open** — needs real types or demotion |
| V7 Masquerade/redress | Rails quietly re-include "child-agent invocation boundary," keeping the multi-agent path alive under a new name after deferral | **Open** — remove from core rails (§3) |
| V1/V2 | Capsule staleness / silent healing when an agent reasons over a context contract whose version/freshness is unspecified | **Open** — §6 lists "versioned" but no freshness/snapshot-hash contract |

---

## Required revisions before this PRD governs execution

1. **Concretize or demote.** Define the four minimal typed contracts Product Copilot needs (invocation envelope, context capsule, tool manifest, trace record) — or move this PRD to `01-Planning` until Translation (121D) proves what is actually shared.
2. **Decide loop-location** (Bob-client loop vs SF-capsule-reasoning) or hand 121B a named, two-option decision. Do not leave "tool invocation boundary" undefined.
3. **Remove "child-agent invocation boundary" from the core rails.** Defer agent-to-agent per the research and the umbrella.
4. **Scope the registry extension** (`ck-contracts`) the rails require, or state explicitly it is out of scope and why the rails are then unimplementable.
5. **Name the model-capability dependency** (tool/structured-output capability in the capability registry) as a 121A/121B prerequisite.
6. **Add eval to the architecture**, not just trace: minimal grader types and pass@1/pass^k tracking, consuming the trace record.
7. **Trim §8** to the two wired providers + the provider-agnostic pattern; stop enumerating self-hosted/hybrid/classifier as live first-class concerns.

None of this changes the (correct) principles. It converts a concept list into something an engineer can build — or honestly defers it until extraction is justified.

---

# Revision B — Pre-GA + eval-flywheel lens

Added source: [Build an Agent Improvement Loop with Traces, Evals, and Codex](https://cookbook.openai.com/examples/agents_sdk/agent_improvement_loop) (OpenAI cookbook, 2026-05), plus the **pre-GA, no-back-compat** freedom. Full lens in the umbrella's Revision B.

## What changes for 121A

**Pre-GA sharpens the verdict from "concretize or demote" to "concretize the minimal Product-Copilot contracts, or delete."** There is no legacy/back-compat reason to carry abstract concept rails — the "smallest set of high-signal tokens" principle (Anthropic) and "add complexity only when it demonstrably improves outcomes" apply to the architecture doc itself. Either ship the four minimal typed contracts (envelope, capsule, tool manifest, trace) Product Copilot needs, or delete the PRD and let 121B/121C own the shapes directly. No middle "framework" ground.

**The flywheel makes eval a first-class architecture rail, not a future use of trace.** OpenAI's loop treats the **harness** — prompt + tools + routing + output contract + validation — as the single unit that is traced, eval'd, and improved. 121A's trace fields (§9) are half of that; the other half is the eval that consumes them. Add an explicit eval hook to the architecture (the trace record's consumer), or the traces pile up unused (the exact failure OpenAI's loop exists to prevent).

## Revised bottom line
- Delete, don't "concretize-with-legacy-mindset." Four minimal typed contracts or remove the PRD.
- Promote eval to an architecture rail (trace→eval→improvement), citing the OpenAI harness/flywheel model.
- The loop-location + registry-extension + child-agent-removal fixes from the original review all stand, and pre-GA makes them cheaper to execute (no migration).
