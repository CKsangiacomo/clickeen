# Peer Review A — 121C (Product Copilot Real Agent)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121C__PRD__Product_Copilot_Real_Agent.md`
Date: 2026-06-20
Verdict: **REVISE — SOUND DESIGN, NOT SAFELY EXECUTABLE AS WRITTEN.** The principles are right (conversation-first, capsule, Bob validates/executes, kill the regex brain). But this is the P0 that *replaces a shipped user-facing feature*, and it is missing the two things that separate "we built an agent" from "we shipped a better one safely": **an eval suite** and **a cutover/rollback plan.** It also inherits 121B's loop-location ambiguity. Add those and commit to single-pass reasoning for v1; then it's ready.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 0. Code surfaces this PRD touches (grounding)

| Surface | Verified reality | What 121C changes |
|---|---|---|
| Brain — `bob/lib/copilot/controlContract.ts` | Regex router (`resolveBobCopilotDeterministicTurn`) + reusable `buildCopilotControlSnapshot` | §3 removes the router from the brain path; snapshot projector is the capsule seed |
| Apply path — `bob/lib/edit/ops.ts` | Strict `applyWidgetOps` (allowlist, prototype guard, typed errors) | §7 keeps Bob as validator/executor — correct reuse |
| Request envelope — `CopilotPane.tsx` | Carries `turnClass: resolved_edit\|multi_op_plan` (regex verdict in the wire) | §3 removes the matcher; the turn-class field must go too (umbrella §Omissions-B) |
| SF executor — `widgetCopilotCore.ts` | One chat completion + JSON parse; no tools; req/resp | §8 "route allowed tool calls" — no tool path exists |
| Free-tier policy — `ai-runtime.matrix.json` | deepseek-chat, 650 maxTokens, 8 turns, no picker | §4's 7-outcome reasoning is heavier than today's single edit-call — budget collision unaddressed |

---

## 1. Elegant engineering and scalability — GOOD

§4 (reason over capsule → decide answer/ask/suggest/apply/tool/refuse) is the correct agent shape and matches the field's "LLM using tools in a loop" definition at the simplest viable altitude. §5 capsule lists the right minimal fields (widget type, draft summary, control map, selected element, save/publish boundary, available/unavailable actions) and correctly demands "explicit, bounded, versioned" — directly aligned with context-engineering's "smallest high-signal token set." §7's action ownership (Bob in-memory + validates + applies; user owns Save; Roma owns persistence) is exactly right and matches the verified apply path. As the first proof that scales to other agents, this is a sound skeleton.

---

## 2. Compliance to architecture and tenets — STRONG

- §3 non-goals: don't preserve `controlContract.ts` as brain, don't regex-route, don't force the user to name controls. Directly kills the masquerade.
- §7: model never bypasses Bob/Roma validation; saved data still goes through product routes. Tenet-aligned.
- §8: SF doesn't own Bob state or Roma account truth. Correct.
- §4 "conversation first, reasoning before routing" — no pre-agent regex gate; the surface (Builder) deterministically picks the agent, the agent reasons. This is the workflow-vs-agent split done right.

No tenet violations. The risks are omissions, not violations (see below).

---

## 3. Overarchitecture / unnecessary complexity — LOW (this PRD is appropriately scoped)

§6 is disciplined: initial capabilities (answer/guidance/suggest/edit/clarify/undo-aware/refuse) vs later (analytics/translation/QA tools), with "Later does not mean build now." This correctly resists scope creep and honors the research's simplicity-first principle. The only overreach is §8 "route allowed tool calls" for v1 — see Omissions-B.

---

## 3b. Academic abstraction / pre-work / gold-plating — LOW

121C is a behavior spec, not a framework spec, so the concreteness bar is lower than 121A/121B. §5 capsule and §6 capabilities are concretely enumerable. Minor: §4 "product docs/context where available" is vague (just-in-time retrieval vs pre-loaded? undefined) and "call another agent when allowed" (§4) is listed alongside v1 outcomes though §6 defers it — keep them clearly separated.

---

## 4. Simple, boring, toward goals — GOOD, WITH ONE COMMITMENT MISSING

The simplest viable first agent is: **single-pass capsule reasoning → emit one structured decision → Bob/Roma execute.** That is boring, matches shipped infra (one model call today), and is exactly what Building Effective Agents recommends ("optimizing single LLM calls… is usually enough"). 121C *almost* says this but lists "call a tool / call another agent" as peer outcomes of a single reasoning step without stating it's single-pass — leaving open a multi-step loop interpretation that the infra can't support for Bob-side tools. Commit to single-pass for v1 (see Omissions-A).

---

## Omissions & blast radius

### A. Loop-location / single-pass vs multi-step is still unresolved (inherited from 121B).

§4 reasons (where?) then decides among 7 outcomes including "call a tool / call another agent." §8 has SF "route allowed tool calls." For the interactive copilot the apply-edit tool executes **in Bob**; SF cannot run a tight tool-loop against it. The viable v1 shape is **single-pass capsule reasoning in SF → emit one decision (answer/ask/suggest/apply-ops/call-tool-intent/refuse) → Bob/Roma execute.** That is not stated. **Blast radius:** an implementer builds a multi-step SF loop that can't reach Bob's tools, or builds the SF→product callback channel the umbrella said not to build. **Fix:** state explicitly that v1 is single-pass capsule reasoning with emit-only actions; defer the multi-step tool-loop and child-agent calls.

### B. §8 "route allowed tool calls" is wrong for v1 Product Copilot.

SF routing model calls is shipped and fine. SF routing *tool* calls for the interactive copilot implies a channel/loop that doesn't exist and shouldn't for v1. **Fix:** for v1, SF emits tool-call *intents* in the structured result; the product surface (Bob) executes them. Reserve SF tool-routing for durable/server-side agents.

### C. No eval suite. (The biggest omission for a first agent.)

§9 acceptance is behavioral prose ("can converse normally," "can understand open-ended intent") — not measurable. The research (Demystifying Evals) is emphatic and cited: ship a **~20–50 task suite from real failures** (the 120B earth-test prompts are the perfect seed), **capability + regression** tracks, **deterministic op-validation graders + LLM-as-judge rubrics** (tone, grounding, safety, did-it-edit-the-right-control), track **pass@1 and pass^k** (consistency matters for a user-facing agent), and **read the transcripts.** Eval-driven development = write the evals *before* the brain passes them. Without this, "the new Copilot is better" is a guess. **Blast radius:** replacing a shipped feature with no way to detect regression = flying blind. **Fix:** make a concrete eval suite a blocking acceptance criterion.

### D. No cutover / rollback for replacing the shipped regex Copilot.

The current Copilot is live and user-facing. 121C removes the regex brain but says nothing about: cutover (flag? percentage?), fallback during build, or rollback if the new brain scores worse on the eval. **Blast radius:** a botched cutover degrades a live feature with no recovery. **Fix:** add a rollout/cutover/rollback section gated on the eval suite.

### E. Capsule privacy + staleness (carried from umbrella).

The capsule carries draft state + account context to an external LLM provider. No PII/privacy boundary on capsule contents; no staleness handling if the user edits mid-reasoning (a `snapshotHash` already exists in the request envelope — extend it to reject stale apply). **Fix:** define capsule field-level privacy class + a snapshot-hash/staleness contract.

### F. Cost / free-tier collision (carried from umbrella).

A 7-outcome reasoning pass is heavier than today's single edit-call; free tier is 650 tokens / 8 turns. **Fix:** define the per-turn budget for single-pass reasoning and confirm it fits the free tier, or accept a tiered model (cheap classifier for simple turns).

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V1 Silent substitution | Agent reasons over a capsule treated as live truth (stale) | Open — staleness contract (Omissions-E) |
| V3 Silent omission | Shipping "real agent" with no eval to detect regression | Open — eval suite (Omissions-C) |
| V4 Fail-open | Free-tier budget silently truncates a reasoning turn | Open — budget model (Omissions-F) |
| V6 Partial-success masquerade | Claiming Copilot "converses normally" without measurable bar | Open — eval (Omissions-C) |
| V7 Masquerade | Regex brain survives under a new name | Mitigated by §3 — enforce by also removing the `turnClass` field from the envelope (§0) |

---

## Required revisions before execution

1. **Commit to single-pass capsule reasoning for v1** (emit one structured decision; Bob/Roma execute). Defer the multi-step tool-loop and child-agent calls. (Omissions-A)
2. **Scope §8** to emit-only tool intents for v1; SF routes model calls (shipped), not interactive-copilot tool execution. (Omissions-B)
3. **Add a concrete eval suite as a blocking acceptance criterion** — ~20–50 tasks seeded from 120B earth-test prompts + real failures; capability + regression; code + LLM-judge graders; pass@1 and pass^k; read transcripts. (Omissions-C)
4. **Add a cutover/rollback plan** for replacing the live regex Copilot, gated on the eval. (Omissions-D)
5. **Define capsule privacy class + staleness contract** (extend the existing `snapshotHash`). (Omissions-E)
6. **Define the per-turn budget** and confirm it fits the free tier. (Omissions-F)
7. **Remove the `turnClass` field** from the request envelope when the regex matcher goes (kill the masquerade in the wire, not just the brain). (§0)

This is the right first agent with the right principles. The eval suite + cutover + single-pass commitment are what make it safe to actually ship.

---

# Revision B — Pre-GA + eval-flywheel lens

Added source: [Build an Agent Improvement Loop with Traces, Evals, and Codex](https://cookbook.openai.com/examples/agents_sdk/agent_improvement_loop) (OpenAI cookbook, 2026-05); pre-GA freedom. Full lens in the umbrella's Revision B.

## What changes for 121C (the biggest revisions)

**DROP the cutover/rollback requirement.** Pre-GA, no paying users depend on the dev Copilot — rip-and-replace the regex brain. No feature flag, no canary, no rollback ceremony. (Original Omission-D is withdrawn.)

**STRENGTHEN evals from "a suite" to "the flywheel," now with a concrete reference shape.** OpenAI's loop is the operational spec for 121C's "first proof":
1. **Traces** — SF telemetry already captures these (requestId, agentId, intent, outcome, promptVersion, model…). Free.
2. **Human + LLM feedback** — thumbs/edits/undos from real Builder sessions + an LLM-judge pass over traces.
3. **Generated evals** — turn feedback into a Promptfoo-style suite (deterministic op-validation assertions + `llm-rubric` judges for tone/grounding/did-it-edit-the-right-control). Seed from the 120B earth-test prompts.
4. **Eval gate** — pass@1 and pass^k on every harness change.
5. **Improvement handoff** — ranked changes to the harness (prompt/tools/routing/output contract).

This is what makes "the new Copilot is better" a measurement, not a guess — and pre-GA's freedom to move fast is only safe because the gate exists.

**Single-pass capsule reasoning still stands**, and pre-GA removes any reason to hedge it.

## Revised bottom line
- Cutover/rollback: **dropped** (pre-GA, hard-cut).
- Eval: **promoted to the flywheel** (traces→feedback→generated evals→gate→handoff), with the OpenAI cookbook as the reference implementation.
- Single-pass reasoning + loop-location (Bob client) + capsule privacy/staleness + free-tier budget: all stand from the original review.

Net: 121C gets *simpler* under pre-GA (no rollout ceremony) and *more rigorous* on evals (concrete flywheel, not a vague "suite").
