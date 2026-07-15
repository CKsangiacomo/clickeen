# 126E - PRD: Interactions

Status: PRE-EXECUTION DOCTRINE RECORDED - step-5 living doctrine reconciled; D3 monetization doctrine propagated; step-6/7/8 artifacts pending; no step-9 execution credit.
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

## Execution Gap Targets

126E step 6 must verify the current baseline and identify only real remaining
gaps. Living doctrine, Bob Save visibility, durable translation feedback, and
multi-item upload progress are implemented current behavior and must not be
scheduled again:

- Preserve the current living interaction doctrine and update it only if later
  execution changes interaction law.
- Make Roma account shell the documented reference grammar for account-boundary
  state.
- Audit each Roma domain and classify applicable states; fix silent omissions
  where a relevant state currently collapses into unavailable or nothing.
- Preserve Bob save as confirmed persistence and Bob edit/preview as
  browser-memory optimism.
- Preserve current Bob behavior: Save is hidden while clean, visible while
  dirty, reads `Saving...` during persistence, and hides after reconciliation.
- Preserve Copilot confirmed-before-apply and undoable edit behavior.
- Preserve immediate browser-memory edit/preview while keeping account
  persistence at explicit save.
- Preserve and regression-test current durable translation result feedback.
- Converge monetization product meaning across Roma widget upgrade modal, Bob
  upsell modal, and asset limit/upsell inline copy. Upgrade opens or transitions
  to the shared upsell scaffold; it does not route to inactive Billing.
- Preserve current per-item bulk-upload rows, aggregate progress, visible
  failures, partial-success result, and independent continuation.
- Consolidate reason-key copy posture across account shell, Builder, assets,
  ToolDrawer, Copilot, and account notice paths.
- Document Copilot's interaction law: conversational feedback for single-step
  chat/edit operations, Agent Activity for future longer or multi-phase agent
  operations with meaningful phases.
- Remove any drift that treats toast/snackbar as required product doctrine.
- Cross-reference 126B for hover/pressed/disabled/state color mechanics.
- Keep execution scoped to source/docs and existing product surfaces. Do not add
  generic framework machinery.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Paths | Execution concern | Must not change |
| --- | --- | --- | --- |
| Roma account boundary | `roma/components/roma-account-context.tsx`, `roma/components/use-roma-me.ts`, `roma/components/roma-domain-error-boundary.tsx`, `roma/app/(authed)/domain-page-shell.tsx` | Account-shell state remains the reference grammar: loading, auth redirect, recoverable error/retry, no-context/reload, render. | Do not replace account shell with a global state framework. |
| Roma domain states | `roma/components/home-domain.tsx`, `ai-domain.tsx`, `billing-domain.tsx`, `widgets-domain.tsx`, `assets-domain.tsx`, `pages-domain.tsx`, `settings-domain.tsx`, `team-domain.tsx`, `team-member-domain.tsx`, `profile-domain.tsx`, `usage-domain.tsx`, `widget-defaults-domain.tsx`, `accept-invite-domain.tsx` | Classify each domain's applicable loading/refreshing/empty/unavailable/unauthorized/error/success states; fix silent omissions where product truth is currently hidden. | Do not force every domain to render every state; state must match actual product work. |
| Roma policy and monetization routes | `roma/app/api/account/instances/route.ts`, `roma/app/api/account/instances/[instanceId]/duplicate/route.ts`, `roma/app/api/account/instances/[instanceId]/publish/route.ts`, `roma/app/api/account/assets/upload/route.ts`, `roma/app/api/account/assets/route.ts`, `roma/app/api/account/usage/route.ts`, `documentation/capabilities/multitenancy.md` | Preserve route/policy enforcement and converge user-facing upgrade meaning across widget 402, Bob upsell, and asset limit/upsell feedback. | Do not replace product-policy enforcement with UI-only disabled prechecks. |
| Upsell scaffold and hosts | `roma/components/widgets-domain.tsx`, `roma/components/builder-domain.tsx`, the one small reusable Roma upsell scaffold component, `bob/components/UpsellPopup.tsx`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/WidgetSessionChrome.tsx`, `roma/tests/run-widget-command-gates.ts` | Replace both Upgrade-to-`/billing` branches with the same Roma-owned scaffold; preserve Bob's typed intent bridge; remove `confirmDiscardBuilderEdits()` from only the `bob:upsell` branch so the in-place transition preserves working state; update the test that currently requires discard plus `router.push('/billing')`. | Do not remove legitimate Upgrade actions, weaken discard protection for real Builder navigation, duplicate the scaffold in Bob, add a global upsell store/framework, or change command-route enforcement. |
| Billing/current-plan navigation | `roma/components/settings-domain.tsx`, `roma/components/billing-domain.tsx`, `roma/lib/domains.ts` | Preserve ordinary Billing navigation and truthful current-plan copy while separating it from Upgrade. | Do not imply plan changes or remove the legitimate read-only Billing surface. |
| Bob save and session truth | `bob/components/TopDrawer.tsx`, `bob/lib/session/useSessionSaving.ts`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/WidgetDocumentSession.tsx`, `bob/lib/session/WidgetSessionChrome.tsx`, `bob/lib/session/sessionTransport.ts` | Verified current baseline; regression-check only. | Do not clear dirty state optimistically before save result and reconciliation. |
| Bob error and reason-key copy | `bob/components/ToolDrawer.tsx`, `bob/components/useTranslationPreviewState.ts`, `bob/lib/session/useSessionBoot.ts`, `bob/lib/session/sessionTransport.ts`, `roma/lib/route-helpers.ts`, `roma/lib/tokyo-client.ts`, `roma/lib/account-authz-capsule.ts` | Align reason-key copy posture and durable error display. Raw implementation keys must not leak to users. | Do not introduce one mega-map unless surfaces genuinely share implementation ownership. |
| Agent Activity and translation result truth | `bob/components/TranslationsPanel.tsx`, `bob/lib/session/sessionTransport.ts`, `roma/components/builder-domain.tsx`, `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`, `bob/tests/run-translations-panel.ts`, `documentation/ai/agents/translation-agent.md`, `documentation/capabilities/localization.md` | Verified current baseline; preserve and regression-test Agent Activity plus durable result/failure/partial feedback. | Do not use Agent Activity as generic loading, polling, spinner replacement, or success substitute. Do not route translation generation back into save. |
| Copilot interaction law | `bob/components/CopilotPane.tsx`, `bob/lib/session/useSessionCopilot.ts`, `bob/lib/session/WidgetSessionCopilot.tsx`, `roma/app/api/account/instances/[instanceId]/copilot/route.ts`, `roma/app/api/account/instances/[instanceId]/copilot/outcome/route.ts`, `documentation/ai/README.md` | Preserve conversational feedback for single-step chat/edit, confirmed apply, and undo. Add Agent Activity only for future longer/multi-phase Copilot operations with real phases. | Do not convert current Copilot into fake streamed activity. |
| Bulk asset upload progress | `roma/components/assets-domain.tsx`, `roma/app/api/account/assets/upload/route.ts`, `roma/app/api/account/assets/resolve/route.ts`, `roma/app/api/account/assets/[assetRef]/route.ts`, `documentation/architecture/AssetManagement.md` | Verified current baseline; preserve per-item status, aggregate progress, visible failures, and partial-success honesty. | Do not collapse multi-file results into one success/failure message. |
| Dialogs/notices used by interaction semantics | `roma/components/roma-account-notice-modal.tsx`, `bob/components/UpsellPopup.tsx`, `documentation/engineering/UI/dialogs-and-modals.md` | Keep blocking/entitlement/account-notice/destructive decisions on explicit dialog/notice surfaces. | 126E does not create a new dialog framework; 126K/dialog docs own overlay mechanics. |
| 126B state bridge | `documentation/engineering/UI/color.md`, `documentation/engineering/UI/interactions.md`, component files touched by interaction states | 126E says what happened; 126B says how visual state color is rendered. | Do not add color formulas to 126E. |
| Living interaction docs | `documentation/engineering/UI/README.md`, `documentation/engineering/UI/interactions.md`, `documentation/services/bob.md`, `documentation/services/roma.md`, `documentation/engineering/UI/components.md`, `documentation/engineering/UI/dialogs-and-modals.md`, `documentation/engineering/UI/motion.md` | Verified current baseline: stale toast doctrine, keyboard/focus ownership, 126D state ownership, "to-be-declared" framing, and old UI track mappings are absent. Revisit only when a real execution change alters interaction law. | Do not document removed behavior as current doctrine. |

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

## Post-Execution Regression Checks

Execution is not complete until these checks are run and reconciled:

- Search `documentation/engineering/UI/interactions.md` for stale toast,
  keyboard/focus, 126D state, and to-be-declared claims.
- Search `documentation/services/bob.md` for stale PRD 126D toast/banner
  translation language.
- Verify Bob save action visibility and `Saving...` behavior in
  `bob/components/TopDrawer.tsx` and save confirmation in
  `bob/lib/session/useSessionSaving.ts`.
- Verify Bob edit/preview remains browser-memory optimistic while persistence
  remains explicit save.
- Verify Translation Agent Activity remains a real `aria-live` activity surface.
- Verify Translation generation displays durable result/failure/partial
  feedback for command failure, `translation.accepted: false`,
  `localePackages.failed`, skipped locales, and partial package coordinates
  after activity ends.
- Verify Copilot confirmed apply plus undo remains intact.
- Verify Roma monetization still comes from route/policy enforcement and 402
  product responses where applicable.
- Verify bulk upload surfaces expose per-item and partial-success truth where
  changed.
- Verify no new toast/snackbar framework, global interaction store, or generic
  state machine was added.
- If search finds `tokyo/product/widgets/shared/socialShare.js`
  `ck-socialShare__toast` / `showToast`, record it as widget-owned local
  social-share copy status. It is not the shared Clickeen toast/snackbar system
  and is not deleted by 126E.
- Run focused lint/type checks for changed Bob/Roma/docs tooling files if code
  changes occur in execution.

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
