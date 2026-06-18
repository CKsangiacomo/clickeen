# Peer Review — PRD 120 Series (San Francisco Agent Platform) — Pass A

Review date: 2026-06-18
Reviewer scope: 120 (decision, 759L), 120A/120A1, 120B/120B1, 120C, 120R (review, 834L) —
**3,504 lines total**, all in `01-Planning`.
Basis: `documentation/architecture/CONTEXT.md`, `AGENTS.md`, the live
`sanfrancisco/` / `bob/` / `packages/ck-contracts/` tree, and post-124/125 execution state.

Method note: SF plane primitives, the missing translation queue, and the 124/125 translation
removal were verified directly in code. The 120A1/120B1/120C bodies and the full 834-line 120R
were characterized by structure and headers, not read line-by-line.

---

## Verdict

**Approve Option C as the architecture direction. Do not execute the series as written.**
Two things must happen first: (1) re-ground the one stale empirical anchor, and (2) cut the
series to the ~10% that is executable now. The chosen architecture is correct, code-grounded,
and tenet-compliant. The *document set* is the over-architecture the doc itself warns against.

---

## Code grounding — what verifies and what does not

### Verified present (Option C builds on real, shipped code)

| Doc claim | Evidence | Status |
| --- | --- | --- |
| Grants / capability spine | `sanfrancisco/src/grants.ts` | Present |
| Model routing from signed policy | `sanfrancisco/src/ai/modelRouter.ts` | Present |
| Concurrency guard `MAX_INFLIGHT_PER_ISOLATE = 8` → 429 `BUDGET_EXCEEDED` | `sanfrancisco/src/concurrency.ts:3-8` | Present |
| `AgentRuntimePolicy` with model-picker + pinned model | `packages/ck-contracts/src/ai.ts` | Present |
| Over-shared copilot core (EB-007) | `sanfrancisco/src/agents/csWidgetCopilot.ts` → `widgetCopilotCore` | Present |
| Bob `EditorContract` (Copilot's action surface) | `bob/lib/compiler/editor-contract.ts` | Present |

Option C generalizes shipped code, not theory. This is the series' biggest strength and it
holds up.

### The one load-bearing claim that is now false

The decision doc anchors Option C on *"Tokyo-worker already dispatches instance translation to
San Francisco through the `INSTANCE_TRANSLATION_JOBS` queue"* (§1.2, §3 Option C, §4.2, Open
Q1). Live tree:

- `INSTANCE_TRANSLATION_JOBS` → **0 hits.** SF's wrangler declares only the events queue.
- Instance translation is served over **HTTP** — `/v1/agents/instance-translation/*` routes in
  `sanfrancisco/src/index.ts`, not a queue.
- **124/125 (executed 2026-06-17/18, after this PRD's 2026-06-07 date) removed Tokyo
  translation orchestration entirely** — `sanfrancisco/src/tokyo-translation-client.ts` deleted;
  translation orchestration moved to **Roma** (`roma/lib/account-instance-translations.ts`).

The 120R review caught a sibling of this (PR-1: the `SANFRANCISCO_L10N` binding does not
exist), but the correction swapped one non-existent binding for another (the queue).

**Blast radius:** an implementer told "just do what translation already does" wires to a queue
that is not there, against an orchestrator (Tokyo) that no longer orchestrates. The Option C
*conclusion* survives — a product orchestrator (now **Roma**, over HTTP) dispatching to SF's
execution plane is exactly Option C — but the evidence must be re-grounded to post-124/125
reality before execution.

---

## Review against the four lenses

### 1. Elegant engineering and scalability — strong

The **bimodal-roster analysis** (Dimension A: interactive/synchronous vs durable/async) is the
correct load-bearing axis and forces the decision cleanly: one shared plane, per-agent
orchestration, **O(1) shared code per new agent**. Options A/B/D are dispatched on real
trade-offs — B's rejection ("the atomic sin multiplied by every agent: N provider-key homes")
is the right scaling argument. **Open Q10** (separate concurrency budgets for interactive vs
durable surfaces, because `MAX_INFLIGHT = 8` is a copilot guard that would let a long GTM run
429 a user's turn) is a sharp, code-grounded insight.

### 2. Compliance to architecture and tenets — strongest in the series

Option C is selected *because* it satisfies isolation + single-AI-plane + structured-outputs-
only + "no provider keys outside SF" simultaneously; each rejected option is killed precisely
where it breaks a tenet. The P0 correction — *Builder Copilot operating real Builder controls
is the proof; workforce-agent elegance is secondary* — is AGENTS.md §3 ("no fake generic
layers; model the agents you actually run") applied to the doc's own temptation. The "no
partial compliance" framing maps onto the CONTEXT.md authority table exactly: Bob/Roma/Tokyo
own product truth; SF owns AI execution.

### 3. Over-architecture / unnecessary complexity — the decision is clean; the document set is not

The chosen architecture is minimal. The **deliberation overhead** is not: 3,504 lines, **29
D-dispositions, 27 PR-corrections**, an 834-line review of a 759-line decision — to ship a
Copilot that can turn a button from blue to green. The decision doc embeds its own revision
history inline (`SUPERSEDED in part (PR-13/D8)`, `corrected per review PR-1`, `added Q3 round
5`), so an executor must reconstruct the current decision by diffing inline supersessions. It
reads as a negotiation transcript, not an implementable spec.

**Scope creep on the P0:** 120B started as **Operator** (execute control edits), then added
**Guide** (explain panels), then **Advice** ("added Q3 round 5") with free-tier conversion-
template logic. The "deliberately boring" P0 accreted two extra jobs and tier-conversion
behavior before the first job is green.

### 3b. Academic abstraction / pre-work / gold-plating — the series' biggest tax

- **§1.1.2** (agent-literature verdict table) and **§3.6** (the OpenAI guide's four
  checkpoints) are ~120 lines of literature review. The doc correctly flags them as "literature
  to test against, not a playbook" — right instinct — then spends a section on them anyway.
- **§3.5** (MCP / external-reach outbound layer) designs the integration shape for **GTM
  (120D)** — explicitly four-plus phases away and deferred. ~50 lines on intent-shaped tools,
  credential vaults, and code-orchestration for an API surface nobody touches until after the
  Copilot ships. "Adopt the principle, defer the build" is right; writing the principle at this
  resolution now is the pre-work it claims to avoid.
- **120F** ("learning loop — named direction, execution deferred") and **120D's "design-before-
  build note"** name and partially design phases that will not be built for months. Roughly
  **half the 3,504 lines design the durable/MCP/learning platform gated behind the P0.**

### 4. Simple, boring, moves toward the goal? — yes at the core, buried in practice

The core decision is simple and boring and moves toward the goal: keep San Francisco as the
one AI plane, and fix the shipped Copilot to operate the real `EditorContract` controls it
already has. The 120B1 first-green-bar (button color, label, hide, background, title) is the
right boring proof. The problem is that the ~30 lines that matter are buried under ~3,470 that
are deferred future work.

---

## Findings

| ID | Severity | Finding | Action |
| --- | --- | --- | --- |
| A120-1 | Blocker | Option C's empirical anchor (`INSTANCE_TRANSLATION_JOBS` queue, Tokyo dispatch) does not exist in code; translation is HTTP and 124/125 moved orchestration to Roma | Re-ground every translation-pattern citation to post-124/125 truth before execution |
| A120-2 | Major | ~Half the series designs deferred phases (durable plane, MCP/§3.5, anatomy/§3.6, 120D, 120F) at execution resolution | Collapse to one-paragraph "deferred — revisit at 120D" stubs |
| A120-3 | Major | Decision doc carries 29 dispositions + 27 PR-corrections + inline SUPERSEDED blocks in the body | Snapshot current decisions; move revision history to an appendix or git |
| A120-4 | Major | 120B P0 crept Operator → Guide → Advice + tier-conversion before the first job is green | Hold 120B to Operator (120B1); defer Guide; cut Advice/tier-conversion from the P0 |
| A120-5 | Major | 120B depends on 106-reshaped Builder surfaces, one flagged broken (120R PR-4) | Confirm those surfaces work before 120B1 starts |
| A120-6 | Keep | Option C itself: single AI plane + per-agent orchestration, code-grounded, tenet-selected | Approve as direction |

---

## Recommendation

1. **Re-ground the anchor (A120-1, blocker):** replace `INSTANCE_TRANSLATION_JOBS` / Tokyo-
   dispatch claims with Roma-orchestrates-over-HTTP (`/v1/agents/instance-translation/*`). Cite
   a pattern that exists today.
2. **Freeze the forward half (A120-2):** stub §3.5, §3.6, 120D design-before-build, 120F.
3. **Snapshot decisions, exile history (A120-3):** the body states the current decision only.
4. **Hold 120B to Operator (A120-4):** ship 120B1 against the real `EditorContract`; Guide
   after green; cut Advice + tier-conversion from the P0.
5. **Honor 120R PR-4 (A120-5):** verify the 106-reshaped surfaces before 120B1.

Approve Option C. Re-ground the translation anchor. Cut the series to the ~10% executable now.

---

## Relationship to 120R

120R is a strong, code-grounded review (Part II factual audit; PR-1 already caught the
non-existent `SANFRANCISCO_L10N` binding; PR-4 the 106-surface sequencing risk). This Pass A
overlaps 120R on the binding/sequencing findings but adds two it does not center: (a) the queue
correction swapped one ghost binding for another, now provably stale after 124/125; (b) the
dominant risk is document volume / deferred-phase gold-plating, not any single technical gap.
Not verified here: whether 120R's PR-1…PR-15 already fully cover recommendations 2–4. Reading
120R in full would confirm de-duplication; it was characterized by structure for this pass.
