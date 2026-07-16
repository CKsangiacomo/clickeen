# 126E - PRD: Interactions

Status: PRE-EXECUTION STEPS 6-7 COMPLETE - current-source gap audit and final executable ownership plan recorded; exact-tree step-8 review pending; no step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126E of 126A-126M.
KB doc: `documentation/engineering/UI/interactions.md`.

This PRD is the execution authority for 126E interactions. It is filled from
Codex and GLM Step 1 as-built evidence, Step 3 official-source research, and
human product direction. It decides the interaction standard, names the current
gaps, and defines the blast radius for execution.

126E execution must make source and docs match this PRD. It must not create a
new interaction framework, global state store, generic state machine,
toast/snackbar system, dialog framework, validation ritual, or cross-surface
feedback subsystem.

## Step Inputs

- Step 1 Codex as-built: `audits/126E__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126E__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126E_Research_Codex.md`.
- Step 3 GLM research: `research/126E_Research_GLM.md`.
- Step 6 Codex pre-execution audit: `audits/126E__Audit__Interactions.md`.
- Current living doc: `documentation/engineering/UI/interactions.md`.
- Roma account shell/domains and same-origin commands.
- Bob Builder session/edit/save/agent surfaces.

## Role

126E owns cross-cutting interaction behavior: loading, refreshing, empty,
unavailable, unauthorized, error, success, partial success, command pending and
result feedback, inline validation, transient feedback, dialogs/notices,
monetization feedback, destructive action feedback, undo, and Agent Activity.

126E does not own final visual styling. It owns the behavioral grammar that
prevents every surface from inventing its own interaction semantics.

## Pre-GA Cleanup Tenet

Clickeen is pre-GA. Once the 126E interactions standard is decided, execution
cleans source and docs to that standard.

- Fix source and docs to this PRD.
- Remove stale feedback paths, stale copy maps, and stale doc claims from active
  code/docs.
- Do not support old and new interaction behavior in parallel.
- Do not add guards/checks/deny lists to preserve behavior that should no
  longer exist.
- Do not document removed behavior as a living option.

Compliance reason: agents need one current interaction truth. A catalog of old
feedback paths gives agents leeway to reintroduce them.

## Current Reality Summary

Clickeen already has substantial interaction behavior, but it is fragmented by
surface.

The strong current evidence:

- `roma/components/roma-account-context.tsx:74-110` defines a real account-shell
  state boundary: loading, auth redirect, recoverable error/retry, no-context/
  reload, then account render.
- `roma/components/use-roma-me.ts:386-440` exposes the account-shell state shape
  as `loading`, `data`, `error`, and `reload`.
- `roma/components/widgets-domain.tsx:73-83` defines widget-domain loading,
  refreshing, error, mutation, rename, action, and upgrade state.
- `roma/components/assets-domain.tsx:131-141` defines asset loading, error,
  upload/delete, and bulk-upload state.
- `roma/components/pages-domain.tsx:129-144` defines page loading, error,
  selected source, draft/source, copy, and action state.
- `bob/lib/session/useSessionSaving.ts:45-116` confirms save success before
  clearing dirty/saving state.
- `bob/components/TranslationsPanel.tsx:251-271` renders Agent Activity with
  `role="status"` and `aria-live="polite"`.
- `bob/components/CopilotPane.tsx:510-648` confirms Copilot edit application and
  provides last-edit undo.

The split current reality:

- `home`, `ai`, and `billing` inherit account-shell state but have no local
  screen-level async state model.
- Widgets/assets/pages/settings/team/profile/usage each use local state fields.
- Roma widget monetization uses HTTP 402 `UPGRADE_REQUIRED` into a Roma modal.
- Bob entitlement upsell uses a separate `ck-upsellModal`.
- Asset upload/limit upsells render inline error copy.
- Translation generation has streamed activity; Copilot does not.
- Feedback is inline, modal, conversational, button-label mutation, or local
  timed copy/status; no shared toast/snackbar layer is proven in current code.
- Error/reason-key copy is handled by multiple local maps.

## Human Decision Authority

Interaction law is human-owned product judgment because it decides what the user
is told about product truth.

The human decides:

- which product states exist and which ones matter to the user;
- whether success is durable, transient, conversational, or implied by the new
  rendered state;
- when partial success must be shown instead of summarized away;
- when monetization feedback is blocking, inline, conversational, or routed to
  billing;
- when an agent operation deserves Agent Activity instead of a simple pending
  label;
- what reason-key copy means in product language.

AIs can audit current behavior, cite source evidence, compare first-party UI
systems, and propose deterministic standards. AIs must not choose a generic
interaction framework, add a toast system, or reinterpret Clickeen workflows
into an ideal system. The human owns these decisions because they encode
product trust, monetization, user confidence, and Clickeen's agent-operated
model.

## Human-Converged Product Reading

The 126E problem is not "add a toast system." The current system already has
interaction behavior where product work happens. The problem is that there is no
clear Clickeen interaction law explaining which state shape, feedback surface,
and command-result semantics belong to which product situation.

For Clickeen this matters because:

- Agents operate product workflows. If command result semantics are ambiguous,
  agents can claim success when work failed or only partially completed.
- Bob/Roma users need pending, error, success, partial-success, and undo states
  to match what actually happened.
- Monetization must remain product-law feedback from policy enforcement, not a
  precheck-only disabled UI.
- Agent Activity should reflect real agent work, not invented progress.
- Hosted agent UI has stricter host constraints and cannot rely on full-browser
  assumptions.

126E therefore defines interaction semantics, not a new framework.

The current systemic interaction patterns Clickeen keeps and expands are:

- Agent Activity for real agent operations.
- Entitlement/upgrade feedback for actions not allowed by the current account
  tier.
- Save action visibility and saving state for explicit persistence.
- Immediate browser-memory edit/preview with confirmed persistence at save.
- Copilot confirmed apply plus undo.
- Google Drive-style multi-item upload progress for assets and other bulk asset
  operations.

New interaction patterns may be added later only when a real product surface
needs them. They must be added as named product patterns, not invented local
one-offs or generic machinery.

## Converged Clickeen Interaction Standard

### State Vocabulary

Target law:

- Clickeen uses a shared interaction vocabulary:
  `loading`, `refreshing`, `empty`, `filtered-empty`, `unavailable`,
  `unauthorized`, `error`, `success`, `pending`, `partial-success`, and
  `recovery`.
- Every async surface must explicitly classify which states apply to that
  surface. A surface does not need to render every state, but it must not
  silently omit a relevant state.
- `empty`, `unavailable`, `unauthorized`, and `error` are different states.
  They must not be collapsed into one vague "unavailable" copy block when the
  user can act or when the reason matters.
- Loading visual treatment is a component/visual concern owned by 126I. 126E
  owns that loading is a named state with truthful command/state meaning; 126I
  owns the visual primitive and rendering pattern.
- Roma account shell is the reference grammar for account-boundary state:
  loading, auth redirect, recoverable error/retry, no-context/reload, then
  render.
- Domain surfaces may be simpler than the account shell only when their product
  work is actually simpler.

Compliance reason:

- This names the behavior agents must implement without adding a new state
  framework.
- It uses a working Clickeen pattern as the reference instead of importing an
  ideal external component model.

### Command Lifecycle

Target law:

- Product commands follow a declared lifecycle:
  intent -> pending -> result -> success | partial-success | failure ->
  recovery/undo where applicable.
- A command must not claim full success when only part of the requested work
  completed.
- Partial success is visible when the user has remaining work, failed items, or
  changed product state that needs attention.
- Pending labels must reflect the actual command in flight.
- Command feedback must come from the product route/session result, not from
  hopeful UI assumptions.
- This lifecycle is behavioral vocabulary agents implement in the owning
  surface. It is not a shared framework, global store, generic state machine, or
  abstraction mandate.

Compliance reason:

- This protects Clickeen from partial-success masquerade and keeps UI feedback
  tied to named product authorities.

### Confirmed Persistence And Browser-Memory Optimism

Target law:

- Bob save is confirmed persistence. Dirty/saving state clears only after the
  save command succeeds and session reconciliation passes.
- Save is an explicit action that appears when there is something to save,
  enters a `Saving...` state while persistence is in flight, and disappears when
  there is no save action to perform. A permanently dimmed save button is not
  the target pattern.
- Widget commands that mutate account state are confirmed by route response and
  refresh/routing evidence.
- Browser-memory editing and preview may be optimistic because Bob is the
  editor: control changes update the local session and preview immediately, but
  they do not become account truth until save succeeds.
- Copilot edit application remains confirmed-before-apply and undoable.
- A future optimistic mutation must be explicitly human-decided and must define
  rollback/recovery.

Compliance reason:

- This matches current Clickeen architecture: Bob edits in memory; Roma/Tokyo
  persistence is the boundary.
- It makes save availability match product truth: no unsaved changes means no
  save action; unsaved changes means save appears; persistence in flight means
  `Saving...`.
- It preserves the sophisticated Copilot apply/undo behavior instead of
  treating it as a gap.

### Feedback Durability

Target law:

- Durable failures, partial success, validation failures, entitlement failures,
  and save/publish failures must remain visible near the work until the user can
  understand or recover.
- Transient feedback is allowed for low-risk actions such as copy-to-clipboard
  or local status confirmation where no follow-up is required.
- Toast/snackbar is not a Clickeen doctrine. Do not add a shared toast/snackbar
  system unless a later human decision makes a concrete product use case
  product law.
- Dialogs/modals are for blocking, entitlement, account notice, destructive, or
  high-importance decisions where the user must choose or acknowledge.
- Conversational feedback is valid for Copilot-style agent conversation when it
  is the product surface of that operation.

Compliance reason:

- This avoids invented machinery and keeps important product truth from
  disappearing into transient UI.

### Monetization Feedback

Target law:

- Enforcement stays with product policy and product routes. Do not replace
  policy enforcement with disabled precheck UI.
- Entitlement failures must be visible, actionable, and consistent with the
  command surface.
- User-triggered monetization gates that can route to upgrade should present a
  clear upgrade action.
- Roma widget 402 modal, Bob upsell modal, and asset inline upsell copy are
  current fragmentation. Execution must converge their product meaning.
- Accepted D3 law keeps legitimate Upgrade entry points and gives them one
  honest destination: the shared pre-GA upsell dialog scaffold. The scaffold is
  a stable UI surface for developing plan comparison, benefits, pricing, and
  future checkout. It does not navigate to inactive Billing, mutate a plan,
  call a provider, claim success, or invent a sales/contact operation.
- When Upgrade originates inside a plan-limit prompt, transition to the upsell
  scaffold in the same dialog layer. Do not stack one modal over another.
- The transition is not navigation and preserves unsaved Builder work. Remove
  the current discard guard from the `bob:upsell` branch; keep that guard for
  real navigation away from Builder.
- Roma owns one small reusable account upsell scaffold component. Roma-native
  Upgrade entry points open it directly; Bob keeps its existing `bob:upsell`
  intent and Roma opens the same scaffold. Do not add a global upsell store,
  billing adapter, or dialog framework.
- Ordinary navigation to Billing remains valid for current-plan inspection.
  Upgrade alone must stop treating that read-only screen as a plan-change flow.
- Inline monetization copy is allowed only when the product situation is
  genuinely inline and the user has a clear next action. It must not become a
  silent failure or dead end.

Compliance reason:

- This preserves PRD 125 route/policy enforcement while making the user-facing
  limit experience deterministic across surfaces.

### Agent Activity

Target law:

- Agent Activity is for real agent operations with meaningful phases or visible
  operational narration.
- Agent Activity is not generic loading, job status, polling, or spinner
  theater.
- Translation generation currently uses Agent Activity.
- Copilot currently uses conversational feedback, confirmed apply, and undo.
  That remains product law for single-step chat/edit operations.
- Translation generation currently shows durable result feedback after Agent
  Activity for failure, no accepted work, package failure, skipped work,
  partial success, and success. Agent Activity is progress narration; it is not
  the durable command result.
- Short single-step agent commands can use pending/conversational feedback.
  Longer or multi-phase agent operations, including future Copilot operations
  with meaningful phases, expose real progress through the appropriate activity
  surface.

Compliance reason:

- Clickeen is agent-operated. Agent feedback must reflect real agent work, not
  invented progress.

### Multi-Item Upload Progress

Target law:

- Bulk asset uploads use a Google Drive-style progress pattern: a visible upload
  surface with per-item rows, per-item status, aggregate progress, failures,
  and recovery where the product supports recovery.
- Bulk upload feedback is non-blocking unless the operation itself requires a
  blocking decision.
- Partial success is first-class. Some files can succeed while others fail, and
  the UI must not collapse that into one generic success or failure.
- Completed upload status may be dismissed after the user can understand what
  happened.
- This pattern applies to assets and can later apply to uploaded custom fonts or
  other account-owned bulk asset operations.

Compliance reason:

- Asset upload is naturally multi-item work. Treating it as one command hides
  the actual product result and invites partial-success masquerade.
- The Google Drive-style pattern is familiar, non-blocking, and keeps per-file
  truth visible while the user continues working.

### Reason-Key Copy

Target law:

- Known reason keys must resolve through one product copy posture.
- Same reason key should not produce unrelated user-facing copy across surfaces
  unless the PRD documents a surface-specific reason.
- Raw implementation keys must not leak into user-facing copy.
- Fallback behavior must be consistent: known mapped reason -> product copy;
  hidden implementation prefix -> human-readable fallback; unknown safe text ->
  surface-owned fallback or explicit display only when product law allows.
- Shared implementation is preferred where surfaces can share it, but this PRD
  does not mandate a single mega-map.

Compliance reason:

- Reason-key copy is product language. Fragmented local maps make agents solve
  the same problem repeatedly and inconsistently.

### Interaction State Bridge To 126B

Target law:

- 126E defines interaction behavior: hover, pressed, disabled, pending,
  unavailable, error, success, partial-success, and recovery.
- 126B owns the color/state token mechanics for visual state rendering.
- When a component enters a visual interaction state, agents must use the
  126B-defined state color mechanics for that surface instead of inventing local
  color changes.
- 126E must not duplicate color formulas. It cross-references 126B for visual
  state color behavior.

Compliance reason:

- This connects behavior to color without crossing ownership boundaries.
- It gives agents a deterministic bridge: 126E says what state happened; 126B
  says how that state is colored.

## Step 6 Current-Source Result

The current-source audit at tree `cd3324dfe220ee4af80061d6e3a98ce15490dbdc`
is `audits/126E__Audit__Interactions.md`.

It proves that the broad interaction cleanup described by the earlier frozen
audit is no longer current work:

- Bob Save visibility and confirmed persistence are correct.
- Translation Agent Activity and durable terminal feedback are correct.
- Copilot's conversational apply/undo behavior is correct.
- Assets already expose per-item and aggregate partial-success truth.
- Roma domain states already distinguish the states relevant to their actual
  work; static domains do not need invented local state.
- Current user-facing copy maps or suppresses implementation reason keys.
- Living interaction doctrine already reflects the accepted product law.

These paths are regression evidence, not a license to rewrite them.

The one proven remaining interaction gap is D3: both current Upgrade paths still
route to `/billing`, and the Bob-host path additionally asks the user to discard
unsaved Builder work. No Roma-owned upsell scaffold exists.

## Final Execution Ownership

126E owns interaction meaning; it does not own all components that consume that
meaning. The final Step-9 plan must use this non-overlapping assignment:

| Concern | Execution owner | Required result |
| --- | --- | --- |
| Interaction vocabulary, feedback durability, D3 meaning, and acceptance assertions | 126E | One product law; no generic framework and no product-code write set. |
| Dialog lifecycle and same-layer transition mechanics | 126K | Escape/backdrop/focus/return-focus/no-stacking behavior follows the accepted D1/D3 matrix. |
| Roma upsell scaffold and the two current host transitions | 126M | One Roma component; Widgets and Bob intent open it in place; no `/billing` Upgrade route and no Builder discard prompt. |
| Route/policy enforcement | Existing route owners | Preserve 402 and entitlement enforcement unchanged. |

This is deliberate inside-out execution. 126E must not build a temporary Roma
modal that 126K or 126M would immediately replace.

## Detailed Blast Radius And Deletion Map

| Area | Current files | Final disposition | Must not change |
| --- | --- | --- | --- |
| Bob Save | `bob/components/TopDrawer.tsx`, `bob/lib/session/useSessionSaving.ts`, session types/transport | Preserve and regression-test only. | Dirty state must clear only after confirmed save and signature reconciliation. |
| Translation feedback | `bob/components/TranslationsPanel.tsx`, `bob/tests/run-translations-panel.ts`, translation docs | Preserve and regression-test only. | No Save coupling, polling theater, queue copy, or invented progress. |
| Copilot | `bob/components/CopilotPane.tsx`, Copilot session/route files | Preserve current conversation, confirmed apply, and undo. | No fake Agent Activity. |
| Bulk assets | `roma/components/assets-domain.tsx` and account asset routes | Preserve current rows, aggregate progress, terminal result, and visible failures. | No new upload subsystem or added Upgrade entry point without separate product law. |
| Roma state surfaces | account shell plus Roma domain components named in the Step-6 audit | Preserve current applicable-state behavior. | No global store/state machine and no fake states for static domains. |
| Widgets Upgrade | `roma/components/widgets-domain.tsx` | 126M replaces the `/billing` link with same-layer transition to the one scaffold. | Route/policy 402 and prompt facts remain unchanged. |
| Bob Upgrade host | `roma/components/builder-domain.tsx` | 126M opens the same scaffold from `bob:upsell`. Delete discard guard and `/billing` route from this branch only. | Real Builder navigation retains discard protection; Bob intent type remains. |
| Upsell component | one new Roma-owned component, exact name finalized by 126M | Render honest pre-GA content with no commercial operation. | No Bob duplicate, global store, billing adapter, fake checkout, or sales/contact flow. |
| Tests | `roma/tests/run-widget-command-gates.ts` | 126M deletes the old discard-and-route assertion and proves both entries reach one scaffold. | Route enforcement assertions remain. |
| Billing | `roma/components/settings-domain.tsx`, `billing-domain.tsx`, `roma/lib/domains.ts` | Preserve ordinary current-plan navigation. | Do not remove Billing or imply it changes plan. |
| Docs | interaction/dialog/Bob/Roma living docs | Already correct; update only if final component naming changes wording. | Do not restore toast doctrine or give 126E dialog-mechanics ownership. |

### Exact 126E product-code write set

None.

### Exact behavior deleted later by 126M because of 126E law

- Widgets `Upgrade -> /billing`.
- `confirmDiscardBuilderEdits()` inside the `bob:upsell` branch only.
- `router.push('/billing')` inside the `bob:upsell` branch only.
- The test assertion that requires those old behaviors.

### Explicit no-touch set

- Bob Save, translation, preview, Copilot, and account-command transport.
- Roma account routes, policy, entitlements, and 402 payloads.
- Asset upload behavior.
- Tokyo, Berlin, San Francisco, Supabase, R2, widget source, and public runtime.
- Public widget social-share copy status.
- Ordinary Billing navigation.

## Documentation Baseline

Current interaction, Bob, and UI-index documentation no longer defines toast
doctrine, assigns keyboard/focus to 126E, routes interaction state to 126D, or
couples Save to translation generation. Revisit these paths only if execution
changes interaction law.

## V1-V8 Pre-Execution Controls

| ID | 126E risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | UI substitutes invented success, generic unavailable copy, or fake progress for actual command result. | Feedback must come from product route/session result or real agent activity. |
| V2 Silent healing | UI rewrites failed/invalid state into a clean/default state without surfacing failure. | Durable failures and validation failures remain visible until understood or recovered. |
| V3 Silent omission | A relevant loading/error/empty/partial-success/upgrade state is dropped. | Each async surface classifies applicable states and fixes silent omissions. |
| V4 Fail-open control | UI prechecks replace route/policy enforcement or enforcement disappears when data is missing. | Enforcement stays with product policy/routes; disabled UI is not the control. |
| V5 Corruption-as-absence | Corrupt persisted state is treated as empty/new/unavailable and overwritten. | Interaction cleanup must not rewrite persisted state; corrupt state remains explicit failure. |
| V6 Partial-success masquerade | Multi-file upload, save follow-up, translation, or command result claims full success after dropped work. | Partial success is visible when remaining work, failed items, or changed state matters. |
| V7 Masquerade/redress | Existing fragmented feedback is renamed as doctrine instead of converged. | Widget 402, Bob upsell, and asset upsell must converge in product meaning, not labels. |
| V8 Runtime test dependency | Normal product interaction depends on validation scripts, probes, or test rituals. | Source/docs/runtime behavior carry the truth; checks only verify execution. |

## Step 7 Executable Gates

126E has no standalone product-code mutation. Its Step-9 gate is the
inside-out behavioral checkpoint that later consumer slices must satisfy.

### Gate E1 - Preserve current interaction truth

1. Re-read the Step-6 audit against the execution-start tree.
2. Confirm Save, translation terminal feedback, Copilot apply/undo, assets bulk
   progress, domain state classification, and copy fallback behavior have not
   regressed in earlier A-D execution.
3. Run:

```bash
pnpm --filter @clickeen/bob test:translations-panel
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
```

4. Search for a new toast/snackbar framework, global interaction store, generic
   command state machine, Save-triggered translation, or raw reason-key JSX.

Green means current correct behavior is preserved. No source edit is required
or authorized merely to make this gate produce a commit.

### Gate E2 - Carry exact outer-layer requirements forward

Before 126E closes, the integrated plan must carry these exact requirements:

- 126K owns dialog mechanics and same-layer transition behavior.
- 126M owns the one Roma scaffold and both current Upgrade transitions.
- 126M deletes the two `/billing` Upgrade paths and the Bob-branch discard
  invocation while preserving real navigation guards.
- 126M updates `run-widget-command-gates.ts` to prove both entries open one
  scaffold and that route/policy 402 enforcement remains intact.
- 126M browser evidence proves Bob unsaved edits survive opening and closing the
  scaffold.

Green means those requirements appear once in the final integrated Step-9 plan,
not copied as competing implementations across 126E, 126K, and 126M.

### Final cross-slice acceptance after 126M

```bash
pnpm --filter @clickeen/roma test:widget-command-gates
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
```

Browser evidence must prove:

1. Widgets plan-limit `Upgrade` transitions to the Roma scaffold without modal
   stacking.
2. Bob plan-limit `Upgrade` opens the same scaffold and preserves dirty Builder
   state without a discard prompt.
3. Closing the scaffold returns to the same work.
4. No purchase, plan mutation, provider request, fake success, or invented
   contact operation occurs.
5. Ordinary `Open billing` navigation still opens the current-plan surface.
6. Route/policy enforcement still returns the product's 402 response.

## Step-7 Done List

- Current Step-6 audit is bound to an exact source tree.
- Already-correct behavior is named as preserve/regression-only.
- The only proven remaining interaction gap is named.
- 126E, 126K, and 126M ownership does not overlap.
- Exact later deletions and no-touch paths are recorded.
- No product code, product data, deploy state, or managed-service state changed
  during pre-execution.
- Exact-tree Step-8 product, architecture/V1-V8, and code/blast-radius reviews
  are still required before this PRD is execution-ready.

## Source Research Bar

Current official-source input:

- Material distinguishes states, progress, snackbars, dialogs, and field
  validation.
- Apple distinguishes loading, content unavailable, alerts/action sheets, and
  field validation.
- OpenAI Apps SDK separates tool result data, model/user-visible content,
  component `_meta`, invoking/invoked status strings, destructive annotations,
  and hosted-UI constraints.

Converged implication:

- Clickeen evaluates interactions by command truth, state durability,
  recoverability, host constraints, and whether the UI reflects actual product
  outcomes.
- External systems are north stars, not copy/paste interaction doctrine.
- No first-party source defines Clickeen's agent-operated interaction model.
  Clickeen's AI edit/review/apply/undo behavior is product law owned here.

Compliance reason:

- This uses original-source research only and applies it through Clickeen
  product authority instead of importing another company's full interaction
  system.

## Out Of Scope For This PRD

- No product data repair unless a separate named product-data authority is
  opened by the execution plan.
- No generated deploy as part of the PRD text update itself.
- No new toast/snackbar/dialog framework.
- No color doctrine beyond the bridge to 126B state token mechanics.
- No keyboard/focus ownership.
- No deletion of public widget-owned social-share local copy status under the
  "no toast doctrine" rule. That status belongs to widget runtime behavior, not
  the shared Clickeen interaction system.
- No browser/runtime verification before execution changes exist to verify.

## GLM Input Integrated

GLM's independent as-built and research passes are integrated into the
converged standard above. This section preserves the high-signal findings that
shaped the final product law.

Confirmed findings:

- Codex's broad audit found the real cross-surface shape: Roma account shell,
  widgets/assets/pages local state, Bob save, Translation Agent activity,
  Copilot apply/undo, and fragmented monetization/copy behavior.
- GLM correctly sharpened the fragmentation: two upgrade modals, assets inline
  upsell, multiple reason-key copy maps, no shared toast/snackbar layer, and no
  Copilot activity feed.
- The account shell is a reusable reference grammar that other surfaces do not
  consistently reuse.
- Bob save is confirmed persistence, while Bob editing/preview is browser-memory
  optimism. This is a product decision, not a bug.
- Copilot confirmed-before-apply plus undo is a Clickeen strength.
- Translation generation has Agent Activity; Copilot currently uses
  conversational feedback plus apply/undo. The standard now preserves that for
  single-step chat/edit operations and requires Agent Activity for future longer
  or multi-phase agent operations with meaningful phases.
- Material's state model and Clickeen's 126B state tokens need an explicit
  bridge: 126E owns interaction behavior, 126B owns visual state color.

Integrated net:

- The final product law is not "add missing interaction components." The final
  product law is: define the interaction vocabulary, command truth, feedback
  durability, monetization meaning, reason-key copy posture, Agent Activity
  usage, and 126B state bridge so agents stop inventing behavior per surface.
