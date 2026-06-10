# 108B1 — EXEC — Builder Copilot Operator

Status: EXECUTION SPEC v2 — revised 2026-06-09 after the three-perspective
pre-execution review; enters `02-Executing` when its Step 0 gate clears
Owner: Bob compiler + Bob UI + Roma copilot route + San Francisco copilot core
Parent: `108B__PRD__Builder_Copilot_Refactor.md` (108B-1 Operator slice)
Review authority: `108__REVIEW__Peer_Review_And_Execution_Augmentation.md`
(PR-3, PR-4, PR-6, PR-11, PR-13; decisions D2, D4, D6, D7, D8, Q1–Q6 — ratified
2026-06-09; round-2 review fixes applied same day)
Ship gate: `108A1__EXEC__…` green before release (not before starting — Steps 1–2
here are independent of the plane work).

Decisions consumed (ratified):

- **D2:** disambiguation is **compiler output**. Per-control vocabulary, aliases, and
  ambiguity groups live in the compiled contract; alias collisions without a
  disambiguation group fail compilation. Bob's resolver is a lookup; SF receives
  resolved targets; the SF keyword scorer is deleted.
- **D4:** budgeted, priority-ranked context assembly (industry "prompt crafting"
  pattern). Caps: resolved-edit ≤ ~2KB, capability turns = 0 (no model call). Visible
  truncation only.
- **D7:** `learningCapture.rawSamplePercent: 100` on **all tiers** pre-GA (the matrix
  has no account dimension; all accounts are internal). Set in 108A1 Step 7.
- **D8:** the resolver emits the turn class; the plane routes by it. SF never
  re-derives the class from content.
- **Q1:** **immediate apply + one-turn undo.** The shipped blocking Keep/Undo gate in
  `CopilotPane.tsx` is removed. Safety boundary = dirty state + normal Save path.
- **Q2:** user-facing copy is the fixed table below — canned strings, never
  model-generated, English-only pre-GA, product-owner-editable any time (non-blocker).
- **Q3 (amended round 5):** in-domain product questions are the routed `advice`
  class — grounded model answers about the user's actual widget, with an actionable
  offer, on all tiers (turn caps are the cost control). Only out-of-domain requests
  get the deterministic canned redirect. Tier differentiation = model/quantity/picker
  now; Guide (108B-2) is the paid lever later (free = Operator + advice, paid = +
  Guide).
- **Q5 (boundary rule, round-5/6 text):** if a request can land on a control it is
  an edit (possibly after one clarification — "write me a slogan" → "want that as
  your Header title?"); if it is about how Builder works it is Guide (108B-2;
  pre-Guide, redirect naming the panel); if it is about the user's widget/design/
  content without an edit target it is `advice`; **only out-of-domain** requests get
  the canned redirect. **Classification rule (R2-6): doubt falls to `advice`** — a
  non-matching prompt defaults to `advice` (a grounded answer to a strange question
  beats a wrong refusal); the redirect fires only on a small canned out-of-domain
  pattern list (persona/meta questions, off-product asks), maintained in
  `vocabulary.ts` beside the ambiguity groups.
- **Op semantics (PR-11):** *hide* = set the governing visibility toggle `false`;
  `remove` only on repeatable items addressed by item id (index fallback only where
  no id exists); never `remove` a scalar path.

## Turn classes (complete definitions — PM F2)

| Class | Definition | Output contract |
| --- | --- | --- |
| (deterministic) | Capability/where-is questions; Q3 refusals; clarification prompts | Rendered by Bob from the contract. Zero model calls, zero network. |
| `resolved_edit` | One grounded target (after ≤1 clarification); model may generate the value (rewrite text, pick a valid token) | Exactly the ops for that target; applied immediately (Q1); one-turn undo. |
| `multi_op_plan` | One compound intent resolving to N grounded targets (e.g. "make it look more premium" when targets ground deterministically) | N validated ops applied **all-or-nothing**; one summary; one undo for the whole set. If targets do not ground → one clarification, else treated as `advice`. |
| `advice` (Q3 round 5) | In-domain product questions with no edit target: "what do you think of my widget?", "what's the best color for this button?", "why might conversion be low?" | Model-backed, **grounded in the widget snapshot** (Guide-sized budget, ≤ ~16KB): answers about THIS widget using its actual state, bounded by the capability map (never promises features the contract lacks). **Output is plain text.** It may end by offering to make the change ("want me to try green?") — if the user replies "do it," that next message is a normal edit turn through the normal path. No suggestion buttons, no carried ops, no special accept mechanism (round 7: removed as AI-invented UI). Advice never applies ops. All tiers; free tier per Q6. |
| `guide` | Reserved for 108B-2. Pre-Guide, how-to questions get the Q3 redirect (which may name the panel: "that lives in Layout — I can also just do it: try 'make the pod wider'"). | n/a in this PRD. |

`freeform` does not exist as a routed class: it split into `advice` (routed) and
**out-of-domain** (meta-chat, off-product asks — the only category that gets the
canned `copilot.refusal.redirect`).

## Free-vs-paid conversion mode (Q6)

PAID tiers get the full structured Copilot above. FREE gets **one model call per
month — spent however the user chooses** (edit or advice), after which every
response is the fixed conversion template.

**The quota counts model calls. Nothing else. (round 7)** Limits count things, they
don't grade them — there is no "useful" judgment, no refund logic. Clarification
questions and canned answers don't call the model, so they cost nothing
automatically; no special rules needed. The number lives where every product number
lives: **entitlement key `copilot.calls.full.monthly.max` (free=1, paid=null)** in
`registry.ts` + `entitlements.matrix.json`. The counter reuses the existing
machinery (`roma/lib/account-limit-usage.ts` over `USAGE_KV`, the same pattern that
already counts `copilot.turns.monthly.max`). Roma derives the mode at grant mint:
`paid tier → 'full'; free ∧ calls used == 0 → 'full'; else 'conversion'`.
*(DevStudio note: the new key renders generically in its policy editor; its
write-path validators must learn the key.)*

**It works off policy like everything else.** The grant carries the mode; the
server refuses full model runs for a conversion-mode grant; every response path
renders per the mode — the same way every surface already respects every other
policy. No special enforcement doctrine. Conversion turns run on the agent's
`default` (cheap) model with the 2KB grounding tier; output is the template,
validated by the plane. The copy table's shared home is
`packages/ck-contracts/src/copilot-copy.ts` so Bob and SF read one source.

Template, enforced shape:

```text
[grounded encouragement]   one short model sentence referencing actual widget
                           state (same snapshot grounding as `advice`)
[feature recommendation]   deterministic: resolved intent/turn class → entitlement
                           key (l10n.locales.max, branding.remove,
                           copilot.turns.monthly.max, embed.seoGeo.enabled, …) →
                           canned feature line from the copy table
[upgrade CTA]
```

Rules: the template never performs the edit or leaks the full answer; honesty rule —
"that's a paid feature," never "I can't"; the template **opens with the quota
preamble** (`copilot.convert.preamble` — the user must know WHY they're getting an
upsell instead of an answer, R2-7); every conversion turn emits a learning event
(feature cited × question type × CTA click, wired through the existing
`/v1/outcome` path) so 108F can learn which upsell converts per intent.
Fixtures (Step 6): free-grant fixture — call 1 runs full (edit or advice, user's
choice); call 2 returns the conversion template with the preamble and the feature
matched to the question (translate → l10n, badge removal → branding, another edit →
turns); the template contains no ops and no full answer. Copy drift rule (N-10): the
`copilot.convert.*` strings hardcode matrix numbers (50/3/28 — verified correct
today); any entitlements-matrix change must update them (accepted pre-GA risk,
checked in the copy table's review).

**Build ownership (R2-1/N-1/N5 — the steps that implement Q6):**
- 108A1 Step 6: plane-side `copilotMode` enforcement + conversion routing rules +
  full-vs-conversion-grant unit test (added there).
- 108B1 **Step 5b** (below): the quota entitlement key + Roma mode derivation +
  counter wiring; Bob renders per mode + Upgrade CTA + outcome event; copy-table
  home in ck-contracts.

## Copy table (Q2 — canned strings; Pietro may edit any time; non-blocker)

| Key | String |
| --- | --- |
| `copilot.refusal.redirect` | "I edit this widget. I can change things like the title, button, colors, layout, and items — try 'make the title bigger' or 'change the button to green'." |
| `copilot.clarify.ambiguous` | "Which one do you mean — {options}?" (options = ambiguity-group labels, e.g. "the Header CTA or the Action button") |
| `copilot.clarify.giveup` | "I couldn't pin down what to change. Try naming the control, like 'the Header CTA' or 'the FAQ title'." |
| `copilot.error.model` | "Copilot couldn't run this model. Try again, or pick another model." |
| `copilot.error.invalid` | "Copilot couldn't produce a valid edit for this widget. Nothing was changed." |
| `copilot.error.timeout` | "Copilot timed out. Nothing was changed." |
| `copilot.error.conflict` | "The widget changed while Copilot was working. Nothing was applied — try again." |
| `copilot.applied.summary` | "Changed {labels}." (+ Undo button) |
| `copilot.explain.save` | "Copilot edits here in the Builder. To save or publish, use the Builder's Save and Publish controls." |
| `copilot.explain.translate` | "Translations are generated from the Translations panel after you save. I edit the original content only." |
| `copilot.progress.escalating` | "Taking another pass…" |
| `copilot.convert.turns` | "Editing together is what Copilot does all day on paid plans — Tier 1 gives you 50 Copilot edits a month." |
| `copilot.convert.l10n` | "Translations are a paid feature: Tier 1 unlocks 3 languages, Tier 2 goes to 28 — your widget in {language} is one click after upgrading." |
| `copilot.convert.branding` | "Removing the Made with Clickeen badge is a Tier 1 feature — it's the most popular reason people upgrade." |
| `copilot.convert.seogeo` | "SEO-ready embeds are a Tier 2 feature — your widget becomes crawlable on your own site." |
| `copilot.convert.advice` | "On paid plans I can dig into your whole widget and recommend specific changes, with plenty of turns to iterate together." |
| `copilot.convert.cta` | "Upgrade" |
| `copilot.convert.preamble` | "That's your free Copilot edit used this month — here's what I can tell you:" |
| `copilot.error.limitReached` | "You've used all your Copilot turns for this month. They reset on the 1st — or upgrade for more." |

## Clarification UX (PM F4)

Show the options from the ambiguity group as tappable choices (typing also works);
the answer is matched deterministically against the pending group (no fresh model
pass). One
clarification per turn; a second miss returns `copilot.clarify.giveup`. A new
unrelated request cancels the pending clarification. Clarifications never block the
pane (consistent with Q1 — nothing modal).

## Latency budgets (PM F7)

Deterministic turns: no network — instant. `resolved_edit` p95 ≤ 6s; `advice` p95
≤ 10s with a progress state; conversion turns p95 ≤ 4s (cheap model, 2KB grounding);
escalated turns show a distinct progress state ("trying a stronger model…" — copy
key `copilot.progress.escalating`: "Taking another pass…"). Asserted in the e2e
harness where scenarios are model-backed; deterministic scenarios assert zero
network. D4 budget entries: resolved-edit 2KB / advice+Guide 16KB / conversion 2KB
/ deterministic 0.

## Steps

| Step | Action | Completion evidence | NOT_ALLOWED |
| --- | --- | --- | --- |
| 0 | **Pre-req gate:** 106F committed (✓ as of 2026-06-09); **dieter object-manager drift fix with direction stated: the Tokyo artifact is truth — make `dieter/components/object-manager/{html,js,spec.json}` byte-identical to it** (the artifact carries `allow-structure`/`min-items` consumed by `cards/spec.json:778` and `stencils.ts:305`; source has zero occurrences; next `build:dieter` would erase the feature). Fixtures pin to certified 106F contracts. | Commit refs; `diff -q` clean per file source-vs-artifact; `pnpm build:dieter` round-trips byte-identical. | Porting source→artifact (the stale direction); starting on an uncommitted foundation. |
| 1a | **Shared-module IR refactor (the trenchcoat, opened — Dev B1):** today `EditorContract` compiles to HTML strings and the six shared Shell modules in `bob/lib/compiler/modules/` (`header.ts`, `stagePod.ts`, coreSize, settings, typography, `normalization.ts`) emit raw pre-escaped HTML; the flat `controls[]` is regex-recovered from that HTML (`bob/lib/compiler/controls.ts:250,315`; stencil expansion at `compiler.server.ts:329-371`). Refactor the shared-module layer to a structured intermediate representation that (i) renders to ToolDrawer HTML and (ii) projects to data. **Design-freeze-grade guard: rendered panel HTML for all 8 widgets is byte-identical before/after.** | Byte-identity check (hash of rendered editor HTML per widget, pre/post) green ×8; typecheck green. | Any rendered-HTML drift; assembling the projection from regex-parsed `controls[]` (the forbidden parallel-schema path). |
| 1b | **Projection:** `builderContract` on `CompiledWidget`, projected from the IR with current values + visibility from `currentConfig`: panels/groups/fields (path, kind, label, valueType, options, showIf, ownership, currentValue, visible, disabled), repeatables (path, itemLabel, identityKey, min/max, allowStructure, itemCount), forbidden paths. | Projection unit tests per shipped widget (8); typecheck green. | A schema parallel to the IR; widget-specific projection branches. |
| 1c | **Vocabulary layer (D2/B2):** Shell vocabulary + ambiguity-group definitions live in **`bob/lib/compiler/vocabulary.ts`** (new, the named home); per-widget terms derive only from `uiLabels` + labels already in the contract (no per-widget glue); disambiguation prompts are **English-only pre-GA** (i18n lane later). Compile-time validation: visible controls sharing an alias without an ambiguity group fail compilation. **Gate home (B3):** a new `scripts/widgets/compile-all.mjs` compiles all 8 widget contracts and is wired into `pnpm validate:widgets`/CI; the negative fixture (seeded alias collision fails) lives there. | compile-all green ×8; seeded collision fails (negative fixture); vocabulary in compiler output only. | Vocabulary/copy in Bob UI or SF; per-widget glue; spec.json schema changes. |
| 2 | **Bob deterministic surface + test harness:** stand up vitest in `bob/` (today `test` is `echo`). Capability answers + Q3 refusal (copy table) rendered from the projection, zero model calls; resolver as lookup with precedence (exact label > alias > group > panel context > ambiguity-group clarification); emits turn class per the definitions above; clarification UX per the spec above. | Unit fixtures: every earth-test phrase + the Q5 boundary examples ("write me a slogan" → clarify→edit; "what do you think?" → **`advice`**; "are you ChatGPT?" → redirect) + ≥5 in/out-of-domain boundary probes each side (R2-6) → resolved target / clarification / advice / redirect + expected turn class, per widget; zero-network assertion for deterministic turns. | Matching beyond lookup+precedence; model calls for capability/where-is/refusals; resolver code in SF. |
| 3 | **Payload swap through the real transport (Dev B5):** the chain is `CopilotPane.tsx:372` → `session.apiFetch('/api/ai/widget-copilot')` → `bob/lib/session/sessionTransport.ts:266-272` (`run-copilot` session command) → Roma session channel → `roma/app/api/account/instances/[instanceId]/copilot/route.ts` (the Bob-local route is a 409 stub — untouched). The request envelope (TPM F-5; types from ck-contracts): `{ instanceId: string; widgetType: string; activeLocale: string; snapshotHash: string; turnClass: TurnClass; resolvedTarget?: { path: string; valueType: string; currentValue: unknown }; snapshot: BuilderContractSnapshot; userMessage: string }`. Roma replaces its current `controls`/`widgetPackage`/`currentConfig` validation block (route.ts:60-76) with envelope-shape + turnClass-enum validation (typed 422 on failure); budgets (D4) enforced at assembly with visible truncation; flat `controls[]` survives only as apply-allowlist/outcome metadata. | Payload schema test; Roma 422 fixtures (malformed envelope; bad enum); budget test (oversized widget truncates visibly); telemetry fixture: turn class → routed model (with 108A1 Step 6). **Ordering note:** lands before 108A1 Step 8 (both edit `CopilotPane.tsx`). | Unbounded snapshots; raw widget source in payloads; SF re-deriving turn class; silent truncation; a second TurnClass definition outside ck-contracts. |
| 4 | **SF cleanup (deletions, not bypasses):** `widgetCopilotCore` accepts resolved targets + bounded context; **delete** the keyword scorer (`widgetCopilotCore.ts:~266-298`) and `csPromptPayload`'s widget-source padding (lines 28-30, 230-235); split the EB-007 `role` flattening. **Per-file disposition table covering the seven SF files + Bob/Roma surfaces (PM F5)** committed here before the step closes — including the Q1 decision: `CopilotPane.tsx`'s blocking Keep/Undo flow (lines ~116/283) is **removed**, replaced by apply+undo. | `rg` guards (scorer gone; no `widget.html` in prompt path) scoped to `sanfrancisco/`; disposition table filled (survives/rewritten/deleted per file incl. `CopilotPane.tsx`, `sessionTransport.ts`, Roma route, `account-copilot.ts`); EB-007 marked promoted. | Keeping the scorer as fallback; retaining source padding; keeping the blocking gate "as an option". |
| 5 | **Apply/undo/conflict (Q1):** immediate apply to the working copy + preview; Builder-label summary (`copilot.applied.summary`) + one-turn undo for the last op set (all-or-nothing for `multi_op_plan`); snapshot-hash conflict rejection (`copilot.error.conflict` — stale ops never replace user edits). **Op-module ownership (Dev B6):** the validation extension lands in the op module `CopilotPane`'s apply path actually imports — verify which of `bob/lib/ops.ts` / `bob/lib/edit/ops.ts` that is, record it in evidence, and **delete the dead one in the same step** if unused. PR-11 semantics enforced (hide=toggle; id-addressed removal; scalar-remove rejected). | Unit tests: apply+undo round-trip; multi-op all-or-nothing; stale-snapshot rejection; scalar-remove rejection; hide-resolves-to-toggle; dead ops module deleted with `rg` guard (or recorded as live — note: `bob/lib/ops.ts` is a 2-line facade over `bob/lib/edit/ops.ts`, which `CopilotPane` imports via `../lib/ops`). | Partial application; silent re-resolution; modal confirmation flows; Copilot writes to persistence. |
| 5b | **Conversion mode build (Q6 — R2-1/N5):** (i) ck-policy: add `copilot.calls.full.monthly.max` to `registry.ts` + `entitlements.matrix.json` (free=1, paid=null); (ii) Roma: mode derivation at grant mint per the Q6 section rule, using `reserveAccountLimitUse`/`USAGE_KV` — a call is a call, no refund logic; (iii) Bob: render responses per the grant's mode like every other policy; Upgrade CTA wired to the upgrade surface + outcome event via `/v1/outcome`; (iv) shared copy home `packages/ck-contracts/src/copilot-copy.ts` consumed by Bob and SF. SF-side enforcement lands in 108A1 Step 6 (cross-referenced). | Unit tests: mode derivation (paid→full; free first-call→full; free after→conversion); conversion response with preamble + matched feature; CTA outcome event captured; copy imported from the single ck-contracts home in both consumers. | Hardcoding the quota number; a second copy-table home; conversion rendering that performs the edit; mode logic anywhere but Roma mint + plane enforcement; "useful"-grading or refund logic. |
| 6 | **Fixtures/evals + KPIs:** earth tests as the eval suite — calltoaction first, then all 8 widgets, tracked per widget here. **Plus (PM F11/F12):** two repeatable fixtures (FAQ "add another question", cards "remove the second card") and structural assertions for generative scenarios ("make the title shorter" = op valid ∧ string shorter ∧ non-empty). **Environment (TPM F-8):** browser scenarios run on the root Playwright harness against cloud-dev with e2e secrets; deterministic scenarios must be flake-free (no model); model-backed scenarios assert structure, not exact text. **KPI block (PM F6 + R2-8):** eight queries over learning events — deterministic-resolution share, clarification rate, invalid-op rejection rate, undo rate, typed-error rate, advice share, advice-to-edit follow-through rate ("do it" after an advice answer), conversion CTR (feature cited × question type × upgrade click, captured via `/v1/outcome`) — defined here, with a checkpoint: after 1 week of internal use, review the eight numbers; failures triage into new fixtures. | Earth tests green on calltoaction (per-scenario evidence), then the 8-widget matrix; repeatable fixtures green; KPI queries documented and runnable. | Declaring green from unit tests where the scenario specifies preview behavior; skipping widgets; exact-text assertions on model output. |
| 7 | **Docs sync:** Builder Copilot + SF docs match shipped behavior (deterministic surface, compiler vocabulary, Q1 UX, copy table, budgets, KPIs, free-vs-paid posture per Q6: free = one model call (spent however the user chooses) then conversion template; paid = full Operator + advice now, + Guide at 108B-2). | Docs diff in final code PR. | Deferring docs. |

## Earth tests (binding product bar)

"What can you edit?" (no model call) · button blue→green · button label → "Book a
demo" · hide the button · title shorter · title bigger (content-vs-typography
clarification) · background to white (stage/pod/button/card clarification) ·
card/pod shadow softer · "Made with Clickeen" off · enable social share · turn off
Facebook sharing only · button opens in new tab · "Save it" → `copilot.explain.save`
· "Translate to French" → `copilot.explain.translate` · **plus:** FAQ "add another
question" (repeatable, id-addressed) · cards "remove the second card" (repeatable)
· "write me a slogan" (clarify → Header title edit) · "what do you think of my
widget?" (`advice`: grounded response referencing actual widget state + an
actionable offer) · "what's the best color for this button?" (`advice`: answer uses
the real current background/button values; the user replying "do it" runs as a
normal edit turn) · "why might conversion be low?" (`advice`: grounded, no invented features)
· negative advice fixture: advice on a widget without social share must **not**
offer to enable it (offers bounded by the contract) · **free tier turn 2** (binding
earth test, not just plumbing: conversion template with preamble + correctly
matched feature + CTA; no ops, no full answer) · "are you ChatGPT?" (out-of-domain
→ `copilot.refusal.redirect`, no model call).

## Out of scope

Guide layer (108B-2 — the paid lever). Durable agents (108C). Plane internals
(108A1, parallel). Widget schema changes. Per-widget prompt glue.
Translated-overlay writes (base-authoring only). Any interim work on the live
Copilot (Q4). i18n of Copilot copy (English-only pre-GA).

## Acceptance

- Earth tests + Q5 boundary fixtures green on all 8 widgets; the model is never the
  first system asked what "button" means.
- Capability/refusal/clarification turns: zero model calls, zero network.
- Compiler rejects alias collisions; vocabulary exists only in compiler output;
  rendered editor HTML byte-identical through the IR refactor (×8).
- Keyword scorer, source padding, blocking Keep/Undo gate, and the dead ops module
  deleted with guards; per-file disposition table complete; EB-007 resolved.
- Budgets enforced with visible truncation; turn class drives plane routing; copy
  table is the only source of user-facing strings.
- Apply/undo/conflict tests green; KPIs defined with a 1-week checkpoint; docs in
  sync.
