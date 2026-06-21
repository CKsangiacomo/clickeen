# Peer Review A — 121G (Learning And Outcomes Foundation)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121G__PRD__Learning_And_Outcomes_Foundation.md`
Date: 2026-06-20
Verdict: **APPROVE WITH MINOR REVISIONS — the strongest of the future-scope PRDs.** Disciplined about the hardest problem: "execution is not learning," capture evidence now, learn later only under governance, never silently mutate production. That maps directly onto the research's eval-driven-development + "promote through review/eval/release/rollback" rule. Most of the §3 day-one trace is already shipped (SF telemetry). Two real gaps: **eval is named as a future promotion gate but not required as the day-one consumer of the trace** (so evidence piles up unused), and **day-one trace retention/privacy is unspecified** (the trace already holds user content).

Research lens applied (sources in the umbrella's Revision A.1; *Demystifying Evals* is directly on point).

---

## 0. Code surfaces (grounding, verified earlier this session)

| Surface | Verified reality | 121G relationship |
|---|---|---|
| SF telemetry — `copilot_events_v1` (D1) | Columns: requestId, agentId, sessionId, instancePublicId, widgetType, intent, outcome, promptVersion, policyVersion, taskClass, provider, model, latencyMs | §3 day-one fields largely **already captured** |
| Outcome attach — `/v1/outcome` | Attaches outcomes to `copilot_outcomes_v1` | §3/§4 outcome capture — **mechanism exists, unnamed in 121G** |
| Raw samples — R2 `learning/{env}/{agentId}/{date}/{requestId}.json` | Full prompt/output samples | §3 trace + privacy/retention concern (Omissions-B) |
| `learningCapture.rawSamplePercent` | Per-grant sampling knob in policy | §5 governed sampling — exists |

---

## 1. Elegant engineering and scalability — GOOD

"Execution is not learning; capture governed evidence now; learn later under promotion gates" is the correct, scalable foundation and avoids the two classic failure modes (treating usage as quality; silently self-tuning production). Because most capture infra already exists, the day-one cost is low and the optionality is high.

## 2. Compliance to architecture and tenets — STRONG

- §2 "execution is not learning" is exactly the V3/V6 guard (a successful call ≠ a good outcome).
- §4 "product surfaces own product outcomes; do not invent missing outcomes" — direct V1/V3 prevention (no fabricated ground truth).
- §5 edge stays AI-independent; visitor path never calls live LLMs; consent/privacy/retention decide — matches umbrella §3.5 and the research (async learning, no live inference in the runtime path).
- §6 no silent self-mutation; promotion requires evals/review/release/rollback — matches the research's promotion discipline and prevents V7.

## 3. Overarchitecture — LOW

§1 "does not build autonomous learning on day one." Correct discipline — this is a foundation, not a learning system.

## 3b. Academic abstraction / pre-work — LOW (best-behaved future-scope PRD)

Unlike 121E/121F, 121G has a **real day-one deliverable** (ensure the trace/outcome fields are captured) that is mostly shipped, so its `Status: EXECUTING` is more defensible — provided the scope is "trace capture + eval hooks," not "learning." The global widget-network moat (§5) is correctly deferred and async-governed, so the north-star weight that bloated the umbrella §3.4/3.5 is not repeated here.

## 4. Simple, boring, toward goals — GOOD

Capture now, attribute honestly, learn later under gates, never auto-mutate. That is the right boring foundation and it reuses existing infra.

---

## Omissions & blast radius

### A. Eval is a future gate, not a day-one consumer of the trace. (Main gap.)
§3 captures execution evidence; §6 says promotion requires evals. But nothing **requires the eval suite to exist as the day-one consumer of that evidence.** The research (Demystifying Evals) is explicit: evals are built alongside the agent, capability + regression, code + LLM-judge graders, pass@1/pass^k, read transcripts. Without the eval, the trace piles up unused and "promotion through eval" is a gate with no gate. **Fix:** make the eval suite (scoped in 121C) the named day-one consumer of this trace; require it for the first agent. Connect trace → eval → promotion explicitly.

### B. Day-one trace retention/privacy is unspecified.
§5 sets consent/privacy/retention for *future global learning*, but the §3 day-one trace already records user messages, draft state, and outputs (R2 raw samples at `rawSamplePercent`). The retention/privacy boundary on **today's** capture is not stated. **Fix:** specify day-one trace retention, redaction, and the sampling knob as part of the foundation, not deferred to global learning.

### C. Outcome attribution is the hard part and is unspecified.
§2 correctly says "a published widget does not prove which agent choice caused the outcome," and §4 lists outcomes — but not **how a later outcome is attributed to a specific agent turn** (the trace-id ↔ outcome linkage, and the time gap between an edit and a save/publish/undo). The research flags end-state evaluation + attribution as the hard problem. **Fix:** specify the attribution linkage (trace id carried through to the owning surface's outcome record) even if analysis is deferred.

### D. Reference the existing capture mechanism.
§3/§4 should name the shipped `/v1/outcome` + `copilot_outcomes_v1` path as the day-one outcome capture, so implementers reuse rather than reinvent.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V1 Silent substitution | Fabricating missing outcomes to fill trace gaps | Mitigated by §4 ("do not invent missing outcomes") — strong |
| V3 Silent omission | Trace captured but never consumed by an eval → "we measure learning" without measurement | Open — Omissions-A |
| V7 Masquerade | "Autonomous learning" implied by capturing lots of data | Mitigated by §6 (no silent self-mutation) — strong |

---

## Required revisions

1. **Make the eval suite the day-one consumer of the trace** — connect trace → eval → promotion; require the eval (121C) for the first agent. (Omissions-A)
2. **Specify day-one trace retention/privacy/redaction + sampling**, not just for future global learning. (Omissions-B)
3. **Specify outcome attribution linkage** (trace id ↔ owning-surface outcome), even if analysis is deferred. (Omissions-C)
4. **Name the shipped `/v1/outcome` + `copilot_outcomes_v1` path** as the day-one capture mechanism. (Omissions-D)
5. **Scope `Status: EXECUTING` to "trace capture + eval hooks"** — keep the learning loop explicitly deferred (it already is).

This is the right foundation; connecting it to the eval is what makes the evidence actually inform improvement.

---

# Revision B — Pre-GA + eval-flywell lens

This is the PRD the new lens hits hardest. Added source: [OpenAI agent-improvement-loop cookbook](https://cookbook.openai.com/examples/agents_sdk/agent_improvement_loop) (2026-05) — which **is** a reference implementation of the learning loop 121G describes.

## What changes for 121G

**The main gap ("eval is a future gate, not a day-one consumer of trace") is now decisively refuted by a shipped reference.** OpenAI's loop is exactly traces → human+LLM feedback → generated evals (Promptfoo) → eval gate → ranked improvement handoff → implement → re-run. That is the day-one consumer of the trace. 121G should adopt this shape explicitly as "the foundation," not defer eval to a future promotion gate.

**Pre-GA: build the flywheel, don't just lay evidence.** No back-compat reason to stage it slowly. The foundation = the flywheel: traces (already captured in SF telemetry) → feedback → generated evals → gate → improvement handoff. "Capture now, learn later" becomes "capture now, **eval now**, improve under gates."

## Revised bottom line
- 121G's §3 day-one trace fields are right and mostly shipped — keep them, and name `/v1/outcome` + `copilot_outcomes_v1` as the capture path.
- **Promote eval from "future gate" to "day-one consumer"** — adopt the traces→feedback→evals→gate→handoff shape (OpenAI cookbook as reference).
- Day-one trace retention/privacy + outcome attribution linkage still need specifying (original Omissions-B/C stand).
- Net: 121G is the strongest PRD, and the flywheel lens turns it from "evidence foundation" into "the improvement engine itself."
