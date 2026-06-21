# Peer Review A — 121B (San Francisco Orchestrator And Routing)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
Date: 2026-06-20
Verdict: **APPROVE WITH REQUIRED REVISIONS.** Better-scoped than 121A: honest about current state, correct non-goals, sound sequencing, and it correctly defers child-agents (slice 8). But the §5 Product Copilot example **encodes the wrong topology** (it implies SF hosts the brain and routes *tool* calls for the interactive copilot), and it shares 121A's concreteness gap — the "slices" are named but not shaped. Fix the §5 example and concretize before execution.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 0. Code surfaces this PRD touches (grounding)

| Surface | Verified reality | What 121B claims/needs |
|---|---|---|
| SF model routing — `sanfrancisco/src/ai/modelRouter.ts` | Pure grant-policy lookup; no string heuristics; no task-class/failover routing today | §4.2 model routing by 6 factors (task class, context size, eval-backed fitness, fallback…) — **richer than shipped** |
| SF executor — `widgetCopilotCore.ts` | One chat completion + JSON parse; no tool calls; request/response only | §3/§4.3 "tool-call routing," §5 "SF routes tool calls" — **no tool path exists** |
| SF bindings — `wrangler.toml` | Only `TOKYO_PRODUCT_CONTROL` (dead/unused) + providers + KV | §4.3/§4.4 tool & child-agent routing require **outbound channels SF does not have** |
| Apply path — `bob/lib/edit/ops.ts` | Ops validated + applied **in Bob (browser)** | §5 "SF routes tool calls → Bob applies" implies SF drives tools whose execution is client-side |

---

## 1. Elegant engineering and scalability — GOOD, WITH ONE STRUCTURAL FLAW

The routing taxonomy (§4.1–4.5: agent invocation, model, tool, child-agent, outcome) is a clean decomposition and the §1 pipeline (`surface → agent id → context → policy → model/tool/child route → governed result → trace`) is the right mental model. §7's sequencing — define shapes, prove on Product Copilot, prove on Translation, add child-agent **only after two real agents exist** — is correct and directly honors the research's single-agent-first principle. That last point is notably better than 121A (which put child-agents in the core rails).

The structural flaw is that **the same orchestrator model is applied to two agent classes that need different topologies** (see §3/Omissions-A). Scalability is fine *if* the routing is scoped per execution mode; it is currently written as one shape.

---

## 2. Compliance to architecture and tenets — STRONG

- §3 "must not": own product truth, mutate product artifacts, invent missing context, **decide that raw text belongs to Product Copilot vs SDR**, bypass Bob/Roma/Tokyo/Berlin. All correct and tenet-aligned.
- §2 honest: current SF is "transport and constraint infrastructure," not orchestration. Matches code.
- §1 "routing ≠ regexing raw user language" — correct; routing is over a *known agent execution*, not user prose. This is the workflow-vs-agent distinction done right (the surface does deterministic dispatch; the agent reasons).
- §4.5 outcome routing: product surfaces record product outcomes; learning consumes governed traces later, never silently rewriting production. Correct (umbrella §Omissions-F, OQ8).

---

## 3. Overarchitecture / unnecessary complexity — MODERATE

- **§4.2 model routing enumerates six factors** (agent policy, task class, context size, privacy/cost/latency, eval-backed fitness, fallback policy). Shipped routing is a single policy lookup. The research frames routing as a *simple classifier → cheaper/stronger model* (Haiku-for-easy / Sonnet-for-hard). "Eval-backed model fitness" is the right principle (cheapest model that passes evals) but specifying a six-factor router before evals exist is pre-work. **Trim to policy-lookup + simple task-class split; defer the rest.**
- **§4.3 tool routing + §4.4 child-agent routing as general SF responsibilities** are defined before there is a second agent or a real tool. Slice 8 defers child-agents correctly, but §4.3 (tool routing) is presented as day-one. For the interactive Product Copilot there is no server-side tool to route (the tool runs in Bob) — so a general "SF tool-call routing" capability is either unused or forces the callback channel we should not build (see Omissions-A).

---

## 3b. Academic abstraction / pre-work / gold-plating — MODERATE (BETTER THAN 121A)

- §7 slices are honestly framed as *work to do* ("Define invocation envelope," "Define tool routing interface," "Define trace record shape"), not as already-built architecture. That is more honest than 121A. But they are still un-shaped: an engineer reading "Define the invocation envelope" gets no contract to implement or review against. For a P0 EXECUTING PRD, at least the envelope and trace shapes should be sketched (fields + types), not just named.
- §6 Translation example is reasonable but also un-typed ("artifact context," "protected structure," "reviewable translated artifact" — none shaped).

---

## 4. Simple, boring, and toward intended architecture — GOOD

§2's "current SF is transport and constraint, not orchestration" is exactly the right boring starting point, and §7's "prove with Product Copilot, then Translation, child-agent last" is the correct boring sequence. This PRD moves toward the intended architecture more concretely than 121A. The one non-boring move is applying a single orchestrator shape to both interactive and durable agents (Omissions-A).

---

## Omissions & blast radius

### A. The §5 Product Copilot example encodes the wrong topology. (Highest priority.)

§5 says: *"agent brain reasons over the turn → San Francisco routes model/tool calls as needed → Bob validates/applies any draft edit."* Read literally, SF hosts the brain **and routes tool calls** for the interactive copilot. But the only Product Copilot tool — applying ops to the in-memory widget — executes **in Bob (browser)**; SF cannot call it. Per the umbrella Revision A.1 and the research (agent loop runs where its tools execute), the interactive copilot is either:

- **(i) SF reasons over a capsule and emits a draft action** (no tight tool loop; capsule must be self-sufficient), or
- **(ii) the loop runs in Bob**, SF is the inference+policy provider per call (Claude Code model).

§5's "SF routes tool calls" fits neither — it implies the SF→product callback channel Revision A.1 says not to build. **Blast radius:** 121C will inherit this example and build the wrong shape. **Fix:** rewrite §5 to state explicitly which of (i)/(ii) Product Copilot uses; drop "SF routes tool calls" for the interactive case (SF routes *model* calls — fine, that's shipped; tool execution stays in Bob).

### B. Tool/child-agent routing is only legitimate for durable agents; 121B writes it as general.

For the Translation Agent (§6), tools are server-side, so SF routing tool/model calls is correct. For Product Copilot, it is not. §4.3/§4.4 should scope tool-routing to server-side/durable agents and state that interactive-copilot tools execute at the product surface (Bob), not via SF. As written, a reader builds a general SF tool-execution channel. **Blast radius:** builds the callback channel we explicitly should not build for the interactive path.

### C. Same concreteness gap as 121A.

The §7 slices (envelope, model/tool routing interface, trace shape) are unnamed contracts. **Fix:** sketch the minimal invocation envelope and trace record fields here, or explicitly delegate the shapes to 121A and say so.

### D. No eval hook in routing.

§4.2 mentions "eval-backed model fitness" — good — but there is no eval contract anywhere (same gap as 121A §9). Routing that claims to be "eval-backed" needs the eval to exist. **Fix:** name where the eval suite feeds routing decisions, or drop "eval-backed" from day-one routing and make it a follow-on once 121G evals exist.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V1 Silent substitution | SF reasoning over a capsule treated as live product truth (stale capsule) | Open — capsule freshness still unspecified |
| V3 Silent omission | "SF routes tool calls" with no tool channel and no scoped topology | Open — §5 example (Omissions-A) |
| V4 Fail-open | Tool-routing "fallback behavior where allowed" (§3) could mask a failed tool as success | Open — define fallback as loud failure, not silent skip |
| V7 Masquerade | General SF orchestrator model re-introduces the SF-as-interactive-brain shape the umbrella corrected | Open — scope per execution mode (Omissions-B) |

---

## Required revisions before execution

1. **Rewrite §5** to pick topology (i) or (ii) for Product Copilot and drop "SF routes tool calls" for the interactive case. This is the blocking fix — it is the example 121C will copy.
2. **Scope §4.3 tool routing to durable/server-side agents**; state interactive-copilot tools execute at the product surface (Bob). Do not build a general SF→product tool/callback channel.
3. **Concretize the §7 slices** — sketch the minimal invocation envelope and trace record, or explicitly delegate shapes to 121A.
4. **Trim §4.2** to policy-lookup + simple task-class routing; defer the six-factor router and "eval-backed fitness" until 121G evals exist.
5. **Keep slice 8 (child-agent last)** — it is correct; ensure §4.4 is marked not-day-one.
6. **Define tool-routing fallback as loud failure**, not silent skip (V4).

Direction is right and sequencing is sound; the §5 topology fix is the one thing that must happen before 121C consumes this.

---

# Revision B — Pre-GA + eval-flywheel lens

Added source: OpenAI agent-improvement-loop cookbook (2026-05); pre-GA freedom. Full lens in the umbrella's Revision B.

## What changes for 121B

**Pre-GA makes the topology call trivially clean.** Zero migration cost means: just pick it. Product Copilot = **client loop in Bob**, SF = inference + policy + **trace** provider. The §5 example's "SF routes tool calls" line should be **deleted** (not carefully rewritten) — pre-GA, write the target shape directly.

**The flywheel reframes what SF's "orchestration" output actually is.** The one output that matters for improvement is the **trace** that feeds the eval loop (OpenAI's entire loop is trace-driven: traces → feedback → evals → gate → improvement). So SF's job, beyond model routing, is to emit rich, structured traces (agent id/version, context version, model route, tool-call intents, validation result, output) that the eval flywheel can consume. "Orchestration" = routing + trace emission; not tool-execution.

## Revised bottom line
- Delete the "SF routes tool calls" line from §5; state client-loop topology plainly.
- SF's orchestration output = governed **traces** that feed the eval flywheel (Revision B of 121C/121G). Model routing + trace emission; no tool-execution channel.
- Everything else from the original review stands; pre-GA just removes the migration friction from the topology pick.
