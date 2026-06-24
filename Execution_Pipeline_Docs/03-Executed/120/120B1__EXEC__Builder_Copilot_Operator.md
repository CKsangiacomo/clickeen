# 120B1 - EXEC - Builder Copilot Operator

Status: TECHNICAL OPERATOR SLICE COMPLETE - PRODUCT COPILOT/AGENT NOT DELIVERED — revised 2026-06-09 after the three-perspective
pre-execution review
Owner: Bob compiler + Bob UI + Roma copilot route + San Francisco copilot core
Parent: `120B__PRD__Builder_Copilot_Refactor.md` (120B-1 Operator slice)
Review authority: `120R__REVIEW__Peer_Review_And_Execution_Augmentation.md`
(PR-3, PR-4, PR-6, PR-11, PR-13; decisions D2, D4, D6, D7, D8, Q1–Q6 — ratified
2026-06-09; round-2 review fixes applied same day)
Ship gate: `120A1__EXEC__...` green before release (not before starting — Steps 1–2
here are independent of the plane work).

Execution amendment applied on 2026-06-18:

- This EXEC is narrowed to **Operator only**. Execute visible-control grounding,
  deterministic target resolution, structured ops, Bob validation/apply/undo, and the
  binding earth tests.
- Do not execute Advice, Guide, free-tier conversion mode, quota/counter changes, KPI
  learning loops, or new route-class machinery in this slice.
- The model is never the first system asked what a Builder word means. Bob resolves
  visible control targets from the compiled Builder contract; San Francisco may help with
  value generation only after the target is grounded.
- Product truth remains in Bob browser memory until user Save. Roma routes and mints the
  account grant. San Francisco executes AI. Tokyo/Tokyo-worker remain storage/R2.

Closeout amendment applied on 2026-06-19:

- 120B1 closes only the technical Operator slice: visible-control snapshots, target
  resolution, scoped request envelope, San Francisco edit execution, and Bob
  browser-memory apply/undo.
- It does not close product Copilot or deliver a real Builder Agent. Guide, Advice,
  account/tier/upgrade help, publish help, active-locale help, support behavior,
  conversion behavior, and workforce-agent behavior are out of scope here.
- Human product testing showed the current Copilot UX is below the product bar. That is
  not a reason to keep testing this PRD as product-success evidence; it is the reason the
  successor product-agent rebuild shipped as
  `Execution_Pipeline_Docs/03-Executed/121_Agentic_Framework/121C__PRD__Product_Copilot_Real_Agent.md`.

Decisions consumed (ratified):

- **D2:** disambiguation is **compiler output**. Per-control vocabulary, aliases, and
  ambiguity groups live in the compiled contract; alias collisions without a
  disambiguation group fail compilation. Bob's resolver is a lookup; SF receives
  resolved targets; the SF keyword scorer is deleted.
- **D4:** budgeted, priority-ranked context assembly (industry "prompt crafting"
  pattern). Caps: resolved-edit ≤ ~2KB, capability turns = 0 (no model call). Visible
  truncation only.
- **D7:** `learningCapture.rawSamplePercent: 100` on **all tiers** pre-GA (the matrix
  has no account dimension; all accounts are internal). Set in 120A1 Step 7.
- **D8:** the resolver emits the turn class; the plane routes by it. SF never
  re-derives the class from content.
- **Q1:** **immediate apply + one-turn undo.** The shipped blocking Keep/Undo gate in
  `CopilotPane.tsx` is removed. Safety boundary = dirty state + normal Save path.
- **Q2:** user-facing copy is the fixed table below — canned strings, never
  model-generated, English-only pre-GA, product-owner-editable any time (non-blocker).
- **Q3:** Advice is deferred. In this slice, no-target product questions receive a
  deterministic product-safe response from Bob; they do not create a routed Advice class.
- **Q5 (boundary rule):** if a request can land on a control it is
  an edit (possibly after one clarification — "write me a slogan" → "want that as
  your Header title?"); if it does not land on a visible control, Bob answers
  deterministically without a model call or says the current Builder controls cannot do
  that. Guide and Advice are deferred.
- **Op semantics (PR-11):** _hide_ = set the governing visibility toggle `false`;
  `remove` only on repeatable items addressed by item id (index fallback only where
  no id exists); never `remove` a scalar path.

## Turn classes (complete definitions — PM F2)

| Class                 | Definition                                                                                                                                                                 | Output contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (deterministic)       | Capability/where-is questions; Q3 refusals; clarification prompts                                                                                                          | Rendered by Bob from the contract. Zero model calls, zero network.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `resolved_edit`       | One grounded target (after ≤1 clarification); model may generate the value (rewrite text, pick a valid token)                                                              | Exactly the ops for that target; applied immediately (Q1); one-turn undo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `multi_op_plan`       | One compound intent resolving to N grounded targets (e.g. "make it look more premium" when targets ground deterministically)                                               | N validated ops applied **all-or-nothing**; one summary; one undo for the whole set. If targets do not ground, ask one clarification or return the deterministic no-control response.                                                                                                                                                                                                                                                                                                                                                                                        |
| deferred              | Advice and Guide                                                                                                                                                           | Not part of 120B1 Operator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

`freeform` does not exist as a routed class. In this slice, Bob either resolves a visible
control target, asks one clarification, or returns deterministic product-safe copy without
a model call.

## Deferred Free-vs-paid Conversion Mode

Free-vs-paid conversion mode is not part of 120B1 Operator. Do not add a new entitlement
key, quota counter, conversion grant mode, template schema, upgrade CTA event, or shared
conversion copy table in this slice. Tier behavior remains whatever current Roma policy
already enforces for Copilot access and model availability.

## Copy table (Q2 — canned strings; Pietro may edit any time; non-blocker)

| Key                           | String                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `copilot.refusal.redirect`    | "I edit this widget. I can change things like the title, button, colors, layout, and items — try 'make the title bigger' or 'change the button to green'." |
| `copilot.clarify.ambiguous`   | "Which one do you mean — {options}?" (options = ambiguity-group labels, e.g. "the Header CTA or the Action button")                                        |
| `copilot.clarify.giveup`      | "I couldn't pin down what to change. Try naming the control, like 'the Header CTA' or 'the FAQ title'."                                                    |
| `copilot.error.model`         | "Copilot couldn't run this model. Try again, or pick another model."                                                                                       |
| `copilot.error.invalid`       | "Copilot couldn't produce a valid edit for this widget. Nothing was changed."                                                                              |
| `copilot.error.timeout`       | "Copilot timed out. Nothing was changed."                                                                                                                  |
| `copilot.error.conflict`      | "The widget changed while Copilot was working. Nothing was applied — try again."                                                                           |
| `copilot.applied.summary`     | "Changed {labels}." (+ Undo button)                                                                                                                        |
| `copilot.explain.save`        | "Copilot edits here in the Builder. To save or publish, use the Builder's Save and Publish controls."                                                      |
| `copilot.explain.translate`   | "Translations are generated from the Translations panel after you save. I edit the original content only."                                                 |
| `copilot.progress.escalating` | "Taking another pass…"                                                                                                                                     |
| `copilot.error.limitReached`  | "You've used all your Copilot turns for this month. They reset on the 1st."                                                                                 |

## Clarification UX (PM F4)

Show the options from the ambiguity group as tappable choices (typing also works);
the answer is matched deterministically against the pending group (no fresh model
pass). One
clarification per turn; a second miss returns `copilot.clarify.giveup`. A new
unrelated request cancels the pending clarification. Clarifications never block the
pane (consistent with Q1 — nothing modal).

## Latency budgets (PM F7)

Deterministic turns: no network — instant. `resolved_edit` p95 ≤ 6s.
escalated turns show a distinct progress state ("trying a stronger model…" — copy
key `copilot.progress.escalating`: "Taking another pass…"). Asserted in the e2e
harness where scenarios are model-backed; deterministic scenarios assert zero
network. D4 budget entries for this slice: resolved-edit 2KB / deterministic 0.

## Steps

| Step | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Completion evidence                                                                                                                                                                                                                                                                                                                                                          | NOT_ALLOWED                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | **Pre-req gate:** 106F committed (✓ as of 2026-06-09); **dieter object-manager drift fix with direction stated: the Tokyo artifact is truth — make `dieter/components/object-manager/{html,js,spec.json}` byte-identical to it** (the artifact carries `allow-structure`/`min-items` consumed by `cards/spec.json:778` and `stencils.ts:305`; source has zero occurrences; next `build:dieter` would erase the feature). Fixtures pin to certified 106F contracts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Commit refs; `diff -q` clean per file source-vs-artifact; `pnpm build:dieter` round-trips byte-identical.                                                                                                                                                                                                                                                                    | Porting source→artifact (the stale direction); starting on an uncommitted foundation.                                                                                                        |
| 1a   | **Scope correction - no shared-module IR refactor in this Operator slice:** the 2026-06-18 execution narrowed 120B1 to the compiled-control Operator path. Do not refactor `EditorContract` or the shared module layer here. Use the existing compiled controls as the Builder authority, plus compiler-emitted Copilot vocabulary in Step 1c.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No IR/shared-module refactor diff in this slice; rendered widget/editor behavior remains owned by the existing compiler path.                                                                                                                                                                                                                                                | Treating the earlier IR projection idea as an active closure gate for 120B1; adding a parallel schema; changing rendered ToolDrawer HTML for this slice.                                      |
| 1b   | **Compiled-control snapshot:** Bob builds the Copilot snapshot from existing `compiled.controls` plus the current browser-memory instance state and `showIf` visibility. The snapshot carries only the visible controls, current values, aliases, ambiguity groups, and choice labels needed for Operator target resolution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Snapshot/direct proofs show hidden controls are excluded; visible controls carry current values; typecheck green.                                                                                                                                                                                                                                                           | Adding a new `builderContract`/IR projection in this slice; widget-specific projection branches.                                                                                             |
| 1c   | **Vocabulary layer (D2/B2):** Shell vocabulary + ambiguity-group definitions live in **`bob/lib/compiler/vocabulary.ts`** (new, the named home); per-widget terms derive only from `uiLabels` + labels already in the contract (no per-widget glue); disambiguation prompts are **English-only pre-GA** (i18n lane later). Compile-time validation: visible controls sharing an alias without an ambiguity group fail compilation. **Gate home (B3):** a new `scripts/widgets/compile-all.mjs` compiles all 8 widget contracts and is wired into `pnpm validate:widgets`/CI; the negative fixture (seeded alias collision fails) lives there.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | compile-all green ×8; seeded collision fails (negative fixture); vocabulary in compiler output only.                                                                                                                                                                                                                                                                         | Vocabulary/copy in Bob UI or SF; per-widget glue; spec.json schema changes.                                                                                                                  |
| 2    | **Bob deterministic surface + runtime proof harness:** add direct proof fixtures in `bob/` without package `test` scripts. Capability answers + Q3 refusal (copy table) rendered from the projection, zero model calls; resolver as lookup with precedence (exact label > alias > group > panel context > ambiguity-group clarification); emits the Operator turn shape; clarification UX per the spec above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Direct fixtures: every earth-test phrase + the Q5 boundary examples ("write me a slogan" → clarify→edit; "what do you think?" → deterministic no-control response; "are you ChatGPT?" → redirect) + ≥5 in/out-of-domain boundary probes each side → resolved target / clarification / deterministic response / redirect, per widget; zero-network assertion for deterministic turns. | Matching beyond lookup+precedence; model calls for capability/where-is/refusals; resolver code in SF; package `test` scripts; Advice/Guide routing.                                                                |
| 3    | **Payload swap through the real transport (Dev B5):** the chain is `CopilotPane.tsx:372` → `session.apiFetch('/api/ai/widget-copilot')` → `bob/lib/session/sessionTransport.ts:266-272` (`run-copilot` session command) → Roma session channel → `roma/app/api/account/instances/[instanceId]/copilot/route.ts` (the Bob-local route is a 409 stub — untouched). The request envelope (TPM F-5; types from ck-contracts): `{ instanceId: string; widgetType: string; activeLocale: string; snapshotHash: string; turnClass: TurnClass; resolvedTarget?: { path: string; valueType: string; currentValue: unknown }; snapshot: BuilderContractSnapshot; userMessage: string }`. Roma replaces its current `controls`/`widgetPackage`/`currentConfig` validation block (route.ts:60-76) with envelope-shape + turnClass-enum validation (typed 422 on failure); budgets (D4) enforced at assembly with visible truncation; flat `controls[]` survives only as apply-allowlist/outcome metadata.                                                                                                 | Payload schema test; Roma 422 fixtures (malformed envelope; bad enum); budget test (oversized widget truncates visibly); telemetry fixture: turn class → routed model (with 120A1 Step 6). **Ordering note:** lands before 120A1 Step 8 (both edit `CopilotPane.tsx`).                                                                                                       | Unbounded snapshots; raw widget source in payloads; SF re-deriving turn class; silent truncation; a second TurnClass definition outside ck-contracts.                                        |
| 4    | **SF cleanup (deletions, not bypasses):** `widgetCopilotCore` accepts resolved targets + bounded context; **delete** the keyword scorer (`widgetCopilotCore.ts:~266-298`) and `csPromptPayload`'s widget-source padding (lines 28-30, 230-235); split the EB-007 `role` flattening. **Per-file disposition table covering the seven SF files + Bob/Roma surfaces (PM F5)** committed here before the step closes — including the Q1 decision: `CopilotPane.tsx`'s blocking Keep/Undo flow (lines ~116/283) is **removed**, replaced by apply+undo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `rg` guards (scorer gone; no `widget.html` in prompt path) scoped to `sanfrancisco/`; disposition table filled (survives/rewritten/deleted per file incl. `CopilotPane.tsx`, `sessionTransport.ts`, Roma route, `account-copilot.ts`); EB-007 marked promoted.                                                                                                               | Keeping the scorer as fallback; retaining source padding; keeping the blocking gate "as an option".                                                                                          |
| 5    | **Apply/undo/conflict (Q1):** immediate apply to the working copy + preview; Builder-label summary (`copilot.applied.summary`) + one-turn undo for the last op set (all-or-nothing for `multi_op_plan`); snapshot-hash conflict rejection (`copilot.error.conflict` — stale ops never replace user edits). **Op-module ownership (Dev B6):** the validation extension lands in the op module `CopilotPane`'s apply path actually imports — verify which of `bob/lib/ops.ts` / `bob/lib/edit/ops.ts` that is, record it in evidence, and **delete the dead one in the same step** if unused. PR-11 semantics enforced (hide=toggle; id-addressed removal; scalar-remove rejected).                                                                                                                                                                                                                                                                                                                                                                                                             | Unit tests: apply+undo round-trip; multi-op all-or-nothing; stale-snapshot rejection; scalar-remove rejection; hide-resolves-to-toggle; dead ops module deleted with `rg` guard (or recorded as live — note: `bob/lib/ops.ts` is a 2-line facade over `bob/lib/edit/ops.ts`, which `CopilotPane` imports via `../lib/ops`).                                                  | Partial application; silent re-resolution; modal confirmation flows; Copilot writes to persistence.                                                                                          |
| 6    | **Fixtures/evals:** earth tests as the eval suite — calltoaction first, then all shipped widgets, tracked per widget here. **Plus (PM F11/F12):** two repeatable fixtures (FAQ "add another question", cards "remove the second card") and structural assertions for generative scenarios ("make the title shorter" = op valid ∧ string shorter ∧ non-empty). **Environment (TPM F-8):** browser scenarios run on the root Playwright harness against cloud-dev with e2e secrets; deterministic scenarios must be flake-free (no model); model-backed scenarios assert structure, not exact text. | Earth tests green on calltoaction (per-scenario evidence), then the shipped-widget matrix; repeatable fixtures green.                                                                                                                                                                                                                         | Declaring green from unit tests where the scenario specifies preview behavior; skipping widgets; exact-text assertions on model output; KPI/learning-loop expansion in this slice.                                                      |
| 7    | **Docs sync:** Builder Copilot + SF docs match shipped Operator behavior (deterministic surface, compiler vocabulary, Q1 UX, copy table, budgets).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Docs diff in final code PR.                                                                                                                                                                                                                                                                                                                                                  | Deferring docs; documenting Guide/Advice/conversion as shipped.                                                                                                                                                                              |

## Earth tests (binding product bar)

"What can you edit?" (no model call) · button blue→green · button label → "Book a
demo" · hide the button · title shorter · title bigger (content-vs-typography
clarification) · background to white (stage/pod/button/card clarification) ·
card/pod shadow softer · "Made with Clickeen" off · enable social share · turn off
Facebook sharing only · button opens in new tab · "Save it" → `copilot.explain.save`
· "Translate to French" → `copilot.explain.translate` · **plus:** FAQ "add another
question" (repeatable, id-addressed) · cards "remove the second card" (repeatable)
· "write me a slogan" (clarify → Header title edit) · "what do you think of my
widget?" (deterministic no-control response; no model call) · "what's the best color
for this button?" (clarifies the visible button target or returns the deterministic
no-control response; no Advice class) · "why might conversion be low?" (deterministic
no-control response; no model call) · "are you ChatGPT?" (out-of-domain →
`copilot.refusal.redirect`, no model call).

## Out of scope

Guide layer (120B-2). Advice. Conversion mode. New quota/counter work. Durable agents
(120C). Plane internals (120A1, parallel). Widget schema changes. Per-widget prompt
glue. Translated-overlay writes (base-authoring only). Any interim work on the live
Copilot (Q4). i18n of Copilot copy (English-only pre-GA).

## Current Execution Evidence - 2026-06-18

Status: technical Operator slice complete; product Copilot/agent not delivered.

Green local gates:

- `pnpm validate:widgets`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build` with cloud-dev public URLs
- Repeatable item remove proof: arrays with `itemIdPath` require `itemId`; index
  remove is accepted only for arrays without item identity.
- Copilot undo proof: undo uses the same compiled-control path matcher as apply
  and preserves `itemIdPath` identity for repeatable remove/insert inverses.
- Picker eligibility proof: runtime model picker options derive from signed
  policy plus explicit callable capability data; `proofRef` remains release
  evidence only and is not a runtime gate.
- Roma selected-model proof: the account Copilot route rejects a selected model
  unless the model capability is picker-eligible before minting the San
  Francisco grant.
- Invalid-edit proof: model-backed edit turns with no final ops fail with
  `coreui.errors.copilot.invalidEdit` and the fixed user copy:
  "Copilot couldn't produce a valid edit for this widget. Nothing was changed."
- San Francisco TTL doc proof: docs state the runtime truth that Copilot
  session memory persists in `SF_KV` for 24 hours, while Roma grants are
  short-lived per request.
- `pnpm exec playwright test e2e/smoke/roma-login.spec.ts`
- Three-agent focused re-audit: Staff Engineer PASS, Senior PM PASS, Principal
  TPM PASS for implementation/system cohesion/product law after the selected
  model, no-ops, and TTL-doc fixes.

Removed product-success gate:

- `pnpm exec playwright test e2e/widgets/builder-open.spec.ts` was previously listed as
  a red runtime closeout gate because Playwright authentication did not reach Builder.
- That gate is no longer a reason to keep 120B1 open. The human product finding is
  stronger and more direct: the shipped Copilot UX is not an acceptable product Copilot
  or real agent.
- Therefore 120B1 closes as a technical Operator slice only. Product Copilot/agent
  verification moves to the successor planning PRD and must not be claimed here.

## Acceptance

- Earth tests + Q5 boundary fixtures green on all shipped widgets; the model is never the
  first system asked what "button" means.
- Capability/refusal/clarification turns: zero model calls, zero network.
- Compiler rejects alias collisions; vocabulary exists only in compiler output from the
  existing compiled-control path.
- Keyword scorer, source padding, blocking Keep/Undo gate, and the dead ops module
  deleted with guards; per-file disposition table complete; EB-007 resolved.
- Budgets enforced with visible truncation; turn class drives plane routing; copy
  table is the only source of user-facing strings.
- Apply/undo/conflict checks green; docs in sync. KPI loops remain deferred beyond this
  Operator slice.
