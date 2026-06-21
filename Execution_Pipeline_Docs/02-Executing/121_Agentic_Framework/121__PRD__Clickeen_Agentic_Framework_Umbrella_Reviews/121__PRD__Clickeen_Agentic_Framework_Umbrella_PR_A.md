# Peer Review A — 121 Umbrella (Clickeen Agentic Framework Umbrella)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
Date: 2026-06-20
Verdict: **APPROVE WITH REQUIRED REVISIONS.** The thesis and tenets are right; the build direction is right. But the umbrella hides one load-bearing architectural hole (no callback channel out of San Francisco), mis-describes the contract it tells 121A/121B to delete, and carries north-star weight that does not belong in a P0 build charter. Fix the items in §Required Revisions before this governs execution.

This review is grounded in code, not prose. Code facts cited below were verified against source this session.

---

## 0. Code surfaces this umbrella touches (grounding)

| Surface | Current reality (verified) | What the umbrella decides about it |
|---|---|---|
| Bob brain — `bob/lib/copilot/controlContract.ts` | Regex intent router (`resolveBobCopilotDeterministicTurn` etc.) + a reusable `buildCopilotControlSnapshot` action-surface projector | Kill the router; keep the projector as a capsule seed |
| Bob apply — `bob/lib/edit/ops.ts` | `applyWidgetOps`: strict path allowlist, prototype-pollution guard, typed `{ok, errors}` | Listed as candidate reuse (§7) — accurate |
| Request contract — `bob/components/CopilotPane.tsx` | `BuilderCopilotRequestEnvelope` carries `turnClass: controls.length===1 ? 'resolved_edit' : 'multi_op_plan'` | Umbrella calls this an "envelope" to kill (§7) — **mis-described, see §Omissions-B** |
| SF entry — `sanfrancisco/src/index.ts` `/v1/execute` | Strictly request→response. `TOKYO_PRODUCT_CONTROL` binding exists in `wrangler.toml` but is typed `Fetcher?` and **never called** | Umbrella wants SF to "orchestrate" and "call tools/agents" (OQ1/OQ4/OQ5) — **no channel exists, see §Omissions-A** |
| SF executor — `widgetCopilotCore.ts` | **One** `callChatCompletion` per turn, plain JSON parse, **no native tool/function-calling** | Umbrella's "decide answer/ask/suggest/apply/tool/child/refuse" brain implies a multi-step loop — unbuilt, see §Omissions-C |
| Routing — `sanfrancisco/src/ai/modelRouter.ts` | Pure policy lookup, **no string-prefix heuristics** | Umbrella OQ7 "routing is not regex" — **accurate** |
| Providers — `grants.ts` + `providers/` | Hardcoded set `{deepseek, openai}` only; Anthropic/Gemini/Groq/Workers-AI **absent from code** | Umbrella §3.3 names them as live options — **overstated, see §3b** |
| Policy — `packages/ck-policy/ai-runtime.matrix.json` | Data-driven JSON; **free tier = deepseek-chat, 650 maxTokens, 8 maxTurns, no picker** | Umbrella never connects "real brain" to this budget — **see §Omissions-C** |
| Registry — `packages/ck-contracts/src/ai.ts` | 2 agents; categories `copilot`/`system_agent`; surfaces `execute`/`endpoint`; **no durable/interactive axis, no tool registry, no capsule type** | Umbrella taxonomy maps loosely; can't yet express 121D durability |

---

## 1. Elegant engineering and scalability — STRONG

The core thesis is the right one and it scales: Clickeen is a closed, AI-legible system, so give the agent the product map + allowed tools + valid action space, and spend model reasoning on the user/outcome instead of product discovery. Separating **Ombra** (product AI layer) / **San Francisco** (execution+orchestration) / **models** (interchangeable under policy) is clean and keeps each swappable.

Verified win: the model/provider layer is already policy-driven and capability-aware, not regex. `modelRouter.resolveModelSelection` is pure grant-policy lookup (no `model.startsWith('gpt-5')`); providers consume a real `AiModelCapability` registry (`tokenParam`, `supportsTemperature`) to build requests. So "provider-agnostic by design" is true as a pattern, even though only two providers are wired today.

Scalability of the **Product-Copilot-first** sequencing is correct: one hard agent before any workforce machinery. This is the O(1)-shared-code-per-agent posture the 120 series recommended, preserved.

---

## 2. Compliance to architecture and tenets — STRONG (best part of the doc)

- Product law (§2) is intact: Bob owns the working copy, Roma owns account/persistence, Tokyo storage, Berlin auth, SF execution only. Agents never own truth.
- Anti-goals (§10) explicitly forbid the real failure modes: truth in SF, telemetry-as-truth, provider lock-in, regex-as-brain, internal-jobs-as-Copilots, live LLM in the widget visitor path.
- The §0 / §10 reframing — **"grant minting, provider routing, usage counters, policy envelopes, typed errors are table stakes, not intelligence"** — is the correct center of gravity and directly internalizes the tenet discussion. A correct grant is a permission check; a correct router is dispatch; a correct validator is a safety boundary. None is intelligence. This is the sentence that makes the umbrella honest.
- "Extract shared framework only from real repeated need" (OQ10) is the right anti-gold-plating guardrail — **if it is actually honored** (see §3b; the doc itself violates it in §3.4/§3.5).

This section is why the verdict is approve-with-revisions and not revse-and-resubmit.

---

## 3. Overarchitecture / unnecessary complexity — MODERATE RISK

Three concrete spots:

1. **Eight PRDs, all `Status: EXECUTING`, four of them admitted "future-scope guardrails, not build-now."** §9 and §12 explicitly say 121E/F/G/H are guardrails, not build commitments. That is a process contradiction with the pipeline movement gate: you do not *execute* a guardrail. As written, the folder reads as eight concurrent builds. **Fix:** move 121E/F/G/H to `01-Planning` (future-scope), keep 121A–D + umbrella as executing. Otherwise this invites exactly the "platform-before-proof" the doc warns against.

2. **§8 lists 9 build stages, 5 of them (6–9) explicitly "not build-now."** Same issue at a smaller scale. The staged path is fine as direction; the problem is presenting non-build stages beside the P0 without a hard visual/process separation.

3. **OQ7 option 5 ("hybrid Ombra routing by local-model fitness") specifies a detailed task→provider routing taxonomy** (local candidates vs hosted-frontier candidates) for a Clickeen-hosted inference layer that does not exist and that the doc itself defers. This is designing routing policy for an empty fleet. Trim to "provider class preserved, routing mechanism deferred."

---

## 3b. Academic abstraction / pre-work / meta-work / gold-plating — REAL, CONTAINABLE

- **§3.4 and §3.5 are north-star material living in a P0 build charter.** Self-hosted model strategy, the compounding learning loop diagram, the runtime/log/learning three-plane split, and a nine-item list of "possible async learning jobs" occupy ~90 lines of a document whose only P0 is *one working agent brain*. The doc even self-warns against fake abstraction in OQ10, then spends its longest technical section on the moat. This is the exact register-pull I flagged on the v1 umbrella and it survived the rewrite. **Fix:** move §3.4/§3.5 substance to `documentation/strategy/WhyClickeen.md`; leave a 3-line pointer here. A build charter should read like a build charter.
- **"Multi-LLM" is a two-provider pattern, not a fleet.** §3.3 lists Anthropic, Gemini, Groq, Cloudflare Workers AI, "a VPS model," and a future Clickeen-tuned model as interchangeable under Ombra. In code, only `deepseek` and `openai` are wired; the `AI_PROVIDER_SET` is a hardcoded two-element set; the capability registry does not even declare structured-output or tool-call support (the `reasoningEffort` field exists in the type and is unpopulated for every model). Naming six providers as if they are live is gold-plating by documentation. **Fix:** state plainly: two providers wired today; the *pattern* is provider-agnostic; adding a provider is a typed contract change, not a config flip.
- **The capability registry gap is load-bearing and unmentioned.** Because no model declares structured-output or native tool-call capability, the "real agent brain" cannot assume function-calling works. That is not academic — it decides whether the brain is a JSON-parsing loop or a native tool-call loop. The umbrella should name this as a 121A/121B dependency, not bury it.

---

## 4. Simple, boring, and moving toward intended architecture — GOOD, WITH ONE STRUCTURAL GAP

The boring path is right: gateway spine → execution envelope → one real Product Copilot brain → tools → (much later) child-agents/internal/learning. Product-Copilot-first is the correct proof because it is the hardest combination (open conversation + product context + validated action + user-facing failure).

**The structural gap:** "simple and boring" requires that each stage be *buildable with what exists*. Stage 3 (brain in SF) + Stage 4 (SF calls tool manifests) + Stage 5 (child-agent calls) are **not** buildable with what exists, because SF has no outbound channel to product surfaces (see §Omissions-A). So the "boring staged path" quietly depends on an unbuilt primitive in stage 2. Naming that primitive makes the path honest; leaving it implicit makes stage 3+ aspirational.

---

## Omissions & blast radius (the part that matters)

### A. San Francisco cannot orchestrate anything today — and the umbrella never names the missing channel. (Highest priority.)

The umbrella's central decision — OQ1 leaning "C→B," "San Francisco should become the orchestrator for agent execution" (§6), plus OQ4 "San Francisco can call only those tools" and OQ5 "explicit named child-agent calls" — requires SF to **initiate calls into product surfaces during a turn**. Verified reality: SF is strictly request→response. Its only outbound calls are to LLM providers and its own KV. The one service binding (`TOKYO_PRODUCT_CONTROL`) is declared in `wrangler.toml`, typed as an optional `Fetcher`, and **never invoked anywhere in the executor**.

Consequence: if the brain moves to SF and reasons "I should apply this op / fetch the user's tier / call the translation agent," **there is no path to do it**. Today the only "tool" — applying ops — executes **client-side in Bob** after SF returns `ops[]`. That is actually fine and correct under product law (Bob owns the working copy). But it directly contradicts OQ4/OQ5, which imagine SF as the tool-caller.

**Blast radius:** the entire "SF as orchestrator" direction. **Required resolution:** the umbrella must state the honest architecture explicitly — *SF is the brain that emits structured intents/actions; Bob and Roma execute them at their owned boundaries* — OR it must specify a new governed synchronous SF→Roma service-binding channel for tool/child-agent execution and put that in 121A/121B scope. Picking one is mandatory; the current text hovers between both and commits to neither.

### B. The "envelope" the umbrella tells 121A/121B to delete is mis-described.

§7 says the "current `resolved_edit | multi_op_plan` envelope … must not define the product-agent architecture." Verified: `resolved_edit | multi_op_plan` is `BuilderCopilotTurnClass`, an **input** field on the request envelope, set client-side in `CopilotPane.tsx` as `turnClass: editScope.controls.length === 1 ? 'resolved_edit' : 'multi_op_plan'`. The **response** is always `WidgetCopilotResult = { message, ops?, meta }` — there is no discriminated response union.

Why this matters beyond pedantry: that input field is **the regex matcher's verdict serialized into the contract** (single vs multi matched control). That is precisely the masquerade leaking past the brain into the wire format. So the umbrella is *right* that it must die — but it should describe it accurately as "the request carries the matcher's pre-decision as a turn-class hint," because that framing is what tells 121C exactly what to stop sending. As written, an implementer could "delete the response envelope" (which doesn't exist) and leave the input turn-class (the actual smell) in place.

### C. A real agent brain is multi-call, and the shipped free-tier budget will not survive it. (Product-model collision.)

Verified: SF does **one** `callChatCompletion` per turn, plain JSON parse, no native tool-calling. The umbrella's brain "decides whether to answer, ask, suggest, apply, call a tool, call another agent, or refuse" (§7) is a multi-step loop — at minimum a classify-then-act, often a reason→tool→reason cycle. That is N model calls per user turn where there is one today.

Verified free-tier policy: `deepseek-chat`, **650 maxTokens, 8 maxTurnsPerThread, no picker**. A reasoning loop routinely exceeds 650 tokens in a single planning call, let alone several. The umbrella lists "cost/budget ceiling" as an envelope field (OQ2) but never connects "real brain" to "this multiplies per-turn inference cost by N× on a product with a free tier."

**Blast radius:** free-tier economics, per-turn latency, and the `maxTurnsPerThread`/`maxTokens` enforcement in `grants.ts`. **Required:** 121B/121G must define the turn budget model for a multi-step brain *before* claiming Product Copilot is real, or the free tier silently 429s/fails mid-thought.

### D. No latency / streaming / multi-step UX story. (Shipped-feature UX collision.)

Verified: the Bob↔SF path is single request/response, no streaming. A multi-step agent turn is a long blocking call. The current CopilotPane UX is built for one fast round-trip. The umbrella lists "normal conversation" and "open-ended intent" as P0 proof with zero treatment of how the Builder UX handles a 5–15s variable-latency, possibly-clarifying turn. For a feature that is **already shipped and user-facing**, this is not a nice-to-have. **Required:** 121C must define streaming or progressive UX, or explicitly accept the latency budget.

### E. No eval / acceptance bar / cutover-rollback plan for replacing a shipped feature.

§7 lists aspirational proofs ("normal conversation," "open-ended intent understanding") but no measurable gate, no fixtures, no regression set, no rollout/cutover/rollback. The 120 series had earth-test scenarios and provider-conformance proofs; this umbrella drops that discipline. For an AI-first company that wants "best-in-class," evals are built *with* the agent, not after. **Required:** a concrete acceptance suite (the 120B earth-test prompts, extended to conversational/guide/account/help) and a cutover plan for the live Copilot.

### F. Capsule privacy and staleness are unaddressed.

OQ3 leans context capsules. A capsule is a **copy of product truth** (control values, account tier, limits, locales) serialized by Bob/Roma, sent to SF, and then forwarded to an external LLM provider. The umbrella mentions "privacy" once — only to reject raw-state option B. The chosen path (C) has no privacy boundary on capsule contents, no PII scoping, and no staleness handling if the user edits the working copy mid-turn while SF is reasoning. The capsule is the brain's entire world; leaving its contents and freshness unspecified is an omission. **Required:** 121A defines capsule field-level privacy class and a snapshot-hash/staleness contract (a `snapshotHash` already exists in the request envelope — extend it).

### G. Minor accuracy: §0 overstates the "real AI-legible editor/action surface."

The structured `EditorContract` tree exists as types in `editor-contract.ts`, but that file's runtime job is rendering ToolDrawer HTML (`buildEditorHtmlLines`); the actual flat action surface is `CompiledControl[]` consumed by `buildCopilotControlSnapshot`. Serving a structured capsule from the tree is new extraction work (120B admitted this). §0 reads as if the asset is ready to hand to an agent; it is ready as types, not as a served surface. Not wrong, but soften the claim so 121A doesn't assume a capsule is free.

---

## V1–V8 scan (induced-risk audit of the direction)

| ID | Risk induced by this umbrella | Status |
|---|---|---|
| V1 Silent substitution | Brain reasons over a capsule that may be stale; agent treats copy-of-truth as current truth | **Open** — needs staleness contract (§Omissions-F) |
| V2 Silent healing | Multi-step brain retries/normalizes malformed model output into a valid-looking op | Partially mitigated by `applyWidgetOps` strict validation; 121C must keep retries loud |
| V3 Silent omission | "First proof" ships without the eval bar, claiming Copilot works | **Open** — needs acceptance suite (§Omissions-E) |
| V4 Fail-open control | Free-tier budget silently truncates a multi-step turn | **Open** — needs turn-budget model (§Omissions-C) |
| V6 Partial-success masquerage | Celebrating the brain/orchestrator plumbing as proof of intelligence | **Mitigated** — §0/§10 explicitly forbid it |
| V7 Masquerade/redress | Regex brain survives under a new name | **Mitigated** — §7/§10 target it directly; enforce via §Omissions-B (kill the input turn-class, not a phantom response envelope) |

---

## Required revisions before this umbrella governs execution

1. **Name the SF orchestration channel gap (§Omissions-A) and commit to one of the two resolutions.** This is blocking. Without it, OQ1/OQ4/OQ5 are not buildable.
2. **Correct the "envelope" description (§Omissions-B)** so 121A/121B/121C kill the regex-derived input `turnClass`, not a nonexistent response union.
3. **Add the multi-step cost/latency/free-tier collision to OQ2/OQ8 scope (§Omissions-C/D)** and require 121B to define a turn-budget model.
4. **Add a measurable eval/acceptance suite + cutover/rollback plan to §7 (§Omissions-E).**
5. **Move 121E/F/G/H to `01-Planning`** and move §3.4/§3.5 substance to `WhyClickeen.md` (§3, §3b). Cut the OQ7 option-5 routing taxonomy.
6. **State the two-provider reality plainly (§3b)** and make model structured-output/tool-call capability a named 121A/121B dependency.
7. **Add capsule privacy class + staleness contract to OQ3 (§Omissions-F).**

None of these change the thesis. They make a correct charter buildable and honest about what the first real agent actually requires.

---

# Revision A.1 — Research lens (2025-2026 best practices)

This revision re-examines the review against current practitioner consensus. Sources (all Anthropic engineering, primary):

- [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) — workflow vs agent patterns, simplicity, tool design (ACI)
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — context as finite resource, system-prompt altitude, minimal tools, just-in-time retrieval
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — when multi-agent pays off, 15× token cost, production reliability, evals
- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — eval structure, graders, pass@k/pass^k, eval-driven development

## The lens (what the field says, in five lines)

1. **Simplicity first.** "Find the simplest solution possible, and only increase complexity when needed." A single LLM call + retrieval/examples is "usually enough." Add agentic complexity only when it "demonstrably improves outcomes." (Building Effective Agents)
2. **An agent = "LLM autonomously using tools in a loop."** The loop and its tools are co-located: the loop invokes tools and reads results. So *where the loop runs is decided by where its tools execute.* (Building Effective Agents, Context Engineering)
3. **Workflows vs agents are both legitimate.** Workflows (predefined code paths) give predictability on defined tasks; agents give flexibility. Don't force everything through one brain. (Building Effective Agents)
4. **Context is a finite resource.** Use the *smallest high-signal token set*; "context rot" degrades recall as tokens grow; tools must be token-efficient and non-overlapping; system prompts at the right altitude (not brittle if/else, not vague). (Context Engineering)
5. **Multi-agent is for breadth, not focus.** It pays off for parallel research that exceeds one context window; costs ~15× tokens; "LLM agents are not yet great at coordinating and delegating in real time" and most coding/product work has "fewer truly parallelizable tasks." (Multi-Agent Research System)

## CORRECTED — my §Omissions-A ("SF needs a callback channel") was overclaimed

This is the revision that matters most, and the research changes it.

The defining tool for Product Copilot is "mutate the open widget's in-memory working copy and read its live control values." That state lives in **Bob (the browser)** — only Bob can execute that tool synchronously. Per the lens (point 2), the loop must run where its tools execute. So the real topology choice is:

- **Option 1 — client loop (Claude Code / Cursor model):** the agent loop runs in **Bob**; each model inference is a round-trip to SF for inference + policy. Tools (apply op, read control) execute locally. SF is the **inference + policy provider, not the orchestrator.**
- **Option 2 — server reasoning over a capsule:** SF receives a self-sufficient capsule, reasons (possibly multi-step internally), and **emits a final structured action** (ops + message) that Bob applies. No tight tool loop with live feedback; one client round trip.

What is **not** standard and **not** needed: SF hosting a tight tool-loop that calls *back* into Bob (a browser can't be called) or into Roma mid-turn to execute product edits. My original "SF must build a callback channel or commit to emit-only" framed this as a missing channel to build. The research reframes it: **the umbrella must name *where the loop runs*, and for the interactive Product Copilot an SF callback-orchestrator is the wrong shape.** For durable agents (translation, analytics) whose tools are server-side, the loop can run in a worker — that is the legitimate SF/sibling-orchestrator case.

**Revised required revision (replaces original #1):** State the bimodal topology explicitly — *interactive loops run near their client state (Bob); durable loops run server-side.* Drop the implication that SF orchestrates the interactive Product Copilot via tool callbacks. Concretely commit Product Copilot to Option 1 or Option 2 above; do not build an SF→product synchronous callback channel for the interactive path.

## REINFORCED — with hard citations

- **Anti-gold-plating (my §3/§3b).** "Simplest solution possible; add complexity only when it demonstrably improves outcomes." The 9-stage path, 8 PRDs, §3.4/§3.5 moat, and OQ7 option-5 routing taxonomy now contradict an explicit, cited industry rule, not just my taste. Move the north-star to WhyClickeen.
- **Single-agent-first / defer agent-to-agent (OQ5).** Multi-agent = ~15× tokens, only for breadth/parallel research, and "LLMs are not yet great at coordinating in real time." Clickeen's work (editing, translation) is focused, not breadth-research. Agent-to-agent and the workforce fleet should be deferred **harder** than the umbrella does. One real agent; no child-agent machinery until a second agent is forced.
- **Evals are day-one, not nice-to-have (my §Omissions-E).** Concrete prescription: a ~20–50 task suite seeded from the 120B earth-test prompts + real user failures; **capability + regression** tracks; **deterministic op-validation graders + LLM-as-judge rubrics** (tone, grounding, correctness); track **pass@1 and pass^k** (consistency matters for a user-facing agent); **read the transcripts.** Eval-driven development = write the evals *before* the brain can pass them. This is now a hard required revision, not a suggestion.
- **Capsules must be minimal (my §Omissions-F).** A capsule is the "smallest high-signal token set," not a compact dump. Add the just-in-time option: for multi-step turns, prefer giving the agent lean tools to fetch product truth on demand (the Claude Code head/tail/grep model) over pre-shipping a fat capsule. For single-turn, a capsule is simpler.

## NEW — prescriptions the research adds

- **N1 — Mix workflows and agents; don't force one brain.** Deterministic product-help (Guide / Account / publish / upgrade answers) are legitimate *workflows* (deterministic, no model call) — Anthropic explicitly endorses workflows for predictability on defined tasks. The umbrella's "one brain decides everything" slightly overcorrects. Keep deterministic workflows for deterministic answers (this aligns with Rebuild PRD Slice 3/4); reserve the agent loop for open-ended intent and editing.
- **N2 — Tool-description engineering (ACI) is first-class.** For OQ4 tool manifests: "invest as much effort in the agent-computer interface as in a human-computer interface." Descriptions, examples, poka-yoke arguments, no overlapping tools — and *test how the model uses them*, iterating on failures. Budget this like HCI work, not a schema afterthought.
- **N3 — Production reliability for any multi-step turn.** Agents are stateful and "errors compound"; plan **resume from checkpoint, retry logic, and full tracing** from day one; use **rainbow/canary deploys** for the agent path. If the umbrella allows multi-step turns, these are not optional.
- **N4 — Keep routing simple.** Model routing by task class is endorsed — but as a *simple classifier → cheaper/stronger model* mapping (Haiku-for-easy / Sonnet-for-hard), not the elaborate "local-model fitness" taxonomy of OQ7 option 5.

## Net effect on the verdict

Still **APPROVE WITH REQUIRED REVISIONS.** The thesis survives and is well-supported by current best practice. But the revisions sharpen in one direction: the hard call is **where the loop runs** (almost certainly Bob for the interactive copilot, not an SF callback orchestrator), **evals are a concrete day-one requirement** (not aspirational), **agent-to-agent/workforce is deferred harder** than the umbrella currently does, and the **north-star weight must move out** of this charter. The single most important correction: my earlier "SF needs a callback channel" was wrong as stated — it's a loop-location decision, not a missing channel.

---

# Revision B — Pre-GA + eval-flywheel lens

Added source: [Build an Agent Improvement Loop with Traces, Evals, and Codex](https://cookbook.openai.com/examples/agents_sdk/agent_improvement_loop) (OpenAI cookbook, 2026-05). This makes the eval loop operational, not aspirational. Plus the **pre-GA, no-back-compat** freedom, which the user confirmed: "we can do pretty much whatever we want."

## What the new lens adds

**The eval flywheel is concrete now.** OpenAI's shipped loop is: real **traces** → human + LLM **feedback** → auto-generated **evals** → an eval **gate** (Promptfoo-style) → a ranked optimization **handoff** → implement → re-run the gate. This is exactly what "eval-driven development" means in practice and it is the spine that the umbrella's §7 "first proof" and §Omission-E were missing. It also reinforces the Anthropic rule (start with ~20–50 tasks, capability + regression, code + LLM-judge graders, pass@1/pass^k, read transcripts).

**Pre-GA reframes every verdict toward delete-don't-migrate.** No back-compat obligation changes three things in the umbrella:

1. **Hard-cut the regex Copilot.** The original §Omission-D (cutover/rollback plan) **drops to a one-liner** — pre-GA, rip-and-replace is fine; no feature-flag/canary ceremony needed. But the eval requirement does *not* drop — it's the only way to know the new brain isn't worse. So evals go from "recommended" to "the one non-negotiable gate."
2. **Delete the north-star weight outright, don't relocate it.** §3.4/§3.5 (learning moat, self-hosted, edge/log planes) — pre-GA, there's no "we might need it later" inertia. Cut it from this charter entirely; if/when it's real, write it then. This strengthens the §3b critique from "move to WhyClickeen" to "delete from the P0."
3. **Make the loop-location call with no migration cost.** Pre-GA, the cleanest target is unambiguous: the interactive Product Copilot loop runs where its tools (in-memory edits) execute — **Bob/client** — and SF is the inference+policy+trace provider. No callback channel to build, no legacy to preserve. Pick it and move.

## Revised required revisions (pre-GA version)

1. **State loop-location once, cleanly: Product Copilot = client loop (Bob) + SF inference/policy/trace.** No SF→product callback. (Carries Revision A.1, now with zero migration friction.)
2. **Make the eval flywheel the non-negotiable spine** — traces → feedback → evals (seed from 120B earth-test prompts) → gate → improvement. This replaces "add an eval suite" as a suggestion; it is the one thing that must exist for the first agent. (Absorbs §Omission-C/D/E.)
3. **Delete §3.4/§3.5 from this charter** — pre-GA, no reason to carry strategic moat weight in a P0 build charter.
4. **Demote 121E/F/G/H to `01-Planning`** and consolidate — still applies (process incoherence unchanged by pre-GA).
5. **Drop the cutover/rollback plan** to "hard-cut, eval-gated" — pre-GA freedom.

## Net

Pre-GA makes the umbrella *easier* to fix, not harder: less ceremony (no cutover), less inertia (delete the moat), a clean topology call. The one thing it makes *more* important is the eval flywheel — because "move fast and break things" only works when you can detect breakage.
