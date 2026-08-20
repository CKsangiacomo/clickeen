# PRD 130B — Defensive Construction Remediation Execution Plan

**Status:** POST-DEPLOYMENT AUDIT CORRECTION IN EXECUTION — prior Slices 0–9
remain historical; correction Slices 11–16 govern the current pass

**Date:** 2026-08-19

**Decision authority:** Human product owner / architect

**Product specification:**
[PRD 130B — Defensive Construction Remediation](130B__PRD__Defensive_Construction_Remediation.md)

This is the complete ordered implementation plan for PRD 130B. The PRD owns
the product decisions, finding classifications, and architecture. This file
turns those decisions into a runnable sequence with exact boundaries,
verification gates, deployment work, and owner QA.

Read the PRD and this plan at the start of every execution session. Complete
the slices in order. A slice is not complete until its exit gate passes.

## 1. Outcome

The pass ships six bounded corrections:

1. five consequential Roma commands require an explicit click confirmation;
2. Save presents `Save -> spinner -> green checkmark + Saved -> disappear`;
3. Roma owns the only Builder header and lends its far-right action slot to
   Bob's Save control only while Bob says it is needed;
4. Widgets starts its two independent reads concurrently and keeps the table
   frame visible during first load;
5. Widget Defaults preserves the exact compiled label for every displayed
   panel; and
6. Product Copilot's visible message state follows the actual terminal turn
   and edit-application result.

The pass does not redesign the product. It removes current friction through
the existing authorities and command paths.

## 2. Hard scope lock

### 2.1 Executable set

Only these PRD decisions are implementation work:

| Decision | Work |
| --- | --- |
| E1 | Click confirmations for Widget Delete, Asset Delete, Unpublish, Remove team member, and Transfer ownership |
| E2 | Bob-owned Save phase and one-second positive receipt |
| E3 | Concurrent Widgets reads plus table-shaped loading |
| E4 | Exact Widget Defaults compiled panel labels |
| E5 | Truthful visible Product Copilot message status |
| E6 | One Roma Builder header with a borrowed Bob Save slot |

The 63-row finding ledger in the PRD is a decision record. Rows classified as
Keep, Already corrected, Architect-closed, Excluded, Not proven, Conflicting
evidence, Test artifact, or Unmarked are not implementation tasks.

### 2.2 Explicit exclusions

Do not inspect, change, verify, deploy, or opportunistically clean up:

- Prague code, routes, signed-in intent, public pages, or Prague Pages;
- Bob Catalog/New Builder copy or journey beyond proving that First Save still
  uses the approved Save sequence;
- invitation creation, revocation, acceptance, or login handoff;
- PRD 129 lifecycle, publication, cache-eviction, source, storage, or serving
  architecture;
- PRD 131 header grammar beyond consuming the current Roma header correctly;
- billing, purchase, upgrade fulfillment, Home, Billing/Usage/AI stubs, or the
  public Widget `Not found` face;
- preview-readiness investigation, generic loading watchdogs, session recovery,
  autosave, retries, new Copilot history/outcome services, Refresh removal,
  dialog-mount cleanup, or unrelated UI audits; and
- keyboard behavior or keyboard QA for the five new confirmations. This is a
  click-only product requirement: Cancel, Confirm, and the existing approved
  backdrop behavior are the acceptance surface.

## 3. Authority and coordinate gate

| Gate | Exact authority for this pass |
| --- | --- |
| Product surface | Roma account domains and Roma Builder header; Bob browser-memory editor and Copilot pane |
| Account/session coordinate | Existing Roma current account plus the existing Bob session/open target |
| Storage coordinate | Unchanged Tokyo instance/asset storage and Michael account/member truth |
| Route/API boundary | Existing Roma command routes and existing Bob `save-instance`/Copilot transports |
| New local protocol | Only `bob:save-control-state` and `host:save-request` inside the existing Roma/Bob iframe bridge |
| Design authority | Existing Dieter Popup, Button, Spinner, Icon, Table, tokens, and motion |
| Runtime surface | Roma and Bob Cloudflare Pages from `main`; Dieter source is compiled into those consumers |
| Verification surface | Focused local behavior suites, deployed cloud-dev Roma/Builder, and owner QA |

The division of labor is fixed:

- Roma owns the Builder header, publication controls, account commands, and
  the five confirmation decisions.
- Bob owns the draft, dirty truth, exact Save command, Save phase, Save error,
  Copilot apply/Undo, and visible Copilot message state.
- Dieter owns only reusable presentation and mechanics.
- Tokyo and Michael keep their current storage and relational authority.
- Product Copilot and San Francisco wire contracts do not change.

## 4. Change categories

Keep these work types separate during execution:

| Category | Work in this pass |
| --- | --- |
| Code | Roma, Bob, and one generic Dieter Button presentation state |
| Product data | None required to ship |
| Schema/storage | None |
| Documentation | Update current operator manuals only after behavior exists |
| Deployment | Roma and Bob Pages only after an authorized push |
| Live verification | Cloud-dev checks and owner QA after the deployed revision is known |

## 5. Execution rules

1. Work slice by slice. Do not push a half-converted Builder header or Save
   lifecycle.
2. Preserve all unrelated worktree changes. Inspect every edited file before
   commit; never reset or overwrite another collaborator's work.
3. Keep the current command routes and results. Confirmations decide whether to
   invoke a command; they do not wrap, retry, reinterpret, or own it.
4. Keep Save on its existing path:
   `bob:account-command(save-instance) -> Roma -> Tokyo ->
   host:account-command-result`.
5. Keep `bob:dirty-state-changed` independent from Save presentation; it
   remains Roma's publication gate.
6. Add no global state store, command framework, generic event bus, new Save
   route, new Save response handshake, retry layer, cache, timeout, probe,
   validator, registry, or compatibility path.
7. Reuse Dieter source and exact existing icons/tokens. Do not introduce
   consumer-local green Button styling.
8. Local tests are implementation evidence. Only the deployed cloud-dev
   surface is runtime evidence.
9. Every slice receives behavior proof at the point it is implemented. A
   source-text search may supplement that proof but may not be its only basis.
10. After implementation, run the independent V1-V8 audit required by
    `AGENTS.md` before commit/push.

## 6. Slice map

| Slice | Result | Depends on |
| --- | --- | --- |
| 0 | Baseline, exact seams, and behavior fixtures | Nothing |
| 1 | One shared Roma confirmation consumer | Slice 0 |
| 2 | Five consequential commands use confirmation | Slice 1 |
| 3 | One Roma Builder header and complete Save lifecycle | Slice 0 |
| 4 | Concurrent Widgets reads and stable loading table | Slice 0 |
| 5 | Widget Defaults panel labels | Slice 0 |
| 6 | Copilot result-aware visible messages | Slice 0 |
| 7 | Canonical documentation reconciliation | Slices 1-6 |
| 8 | Full local verification and independent V1-V8 audit | Slice 7 |
| 9 | Commit, push, and Roma/Bob Pages deployment | Slice 8 plus explicit push authority |
| 10 | Cloud-dev technical verification and owner QA | Slice 9 |

Slices 1-2 form one confirmation lane. Slice 3 is one indivisible
Bob/Roma/Dieter lane: do not ship the Save button bridge while Bob still owns a
second header, and do not delete Bob's header before the borrowed Save and
compact controls are complete.

## 7. Detailed execution

### Slice 0 — Baseline and behavior fixtures

#### Step 0.1 — Establish the exact shared-worktree baseline

- [x] Record `git status --short`, current branch, current HEAD, and recent log.
- [x] Inspect every existing changed file and identify its owner before editing.
- [x] Confirm the PRD and this execution plan contain the same E1-E6 scope and
      exclusions.
- [x] Do not stash, reset, revert, or rewrite unrelated work.

#### Step 0.2 — Record current focused test results

Run and record the current result of:

```bash
pnpm -C roma typecheck
pnpm -C roma lint
pnpm -C roma test:widget-command-gates
pnpm -C roma test:account-asset-gates
pnpm -C roma test:ui-copy
pnpm -C roma test:widget-defaults-typography
pnpm -C bob typecheck
pnpm -C bob lint
pnpm -C bob test:accessibility-copy
pnpm -C bob test:editor-contract
pnpm -C bob test:copilot-model-history
pnpm -C bob test:copilot-pane-gates
pnpm -C dieter typecheck
```

An existing failure is recorded before product edits. It is not silently
attributed to this pass and does not authorize unrelated cleanup.

#### Step 0.3 — Map the current implementation seams

Confirm the active locations before editing:

- Roma confirmations and commands:
  `roma/components/widgets-domain.tsx`,
  `roma/components/assets-domain.tsx`,
  `roma/components/widget-publication-controls.tsx`,
  `roma/components/team-member-domain.tsx`, and
  `roma/components/settings-domain.tsx`;
- Roma Builder host/header:
  `roma/components/builder-domain.tsx`,
  `roma/components/roma-shell.tsx`, and `roma/app/roma.css`;
- Widgets route/loading:
  `roma/app/api/account/widgets/route.ts` and
  `roma/components/widgets-domain.tsx`;
- Widget Defaults projection:
  `roma/components/widget-defaults-builder-controls.tsx`;
- Bob Save/header:
  `bob/lib/session/sessionTypes.ts`,
  `bob/lib/session/useSessionSaving.ts`,
  `bob/lib/session/WidgetDocumentSession.tsx`,
  `bob/components/BuilderApp.tsx`,
  `bob/components/TopDrawer.tsx`, and `bob/app/bob_app.css`;
- Copilot presentation:
  `bob/lib/copilot/types.ts` and `bob/components/CopilotPane.tsx`; and
- Dieter Button:
  `dieter/components/button/button.css`,
  `dieter/components/button/button.spec.json`, and its existing example source.

If these owners have changed, correct this plan before implementing against a
different authority.

#### Step 0.4 — Add behavior-first fixtures

- [x] Extend the existing Roma/Bob `tsx` test style instead of installing a new
      test framework.
- [x] Add executable proof for confirmation open/cancel/confirm call counts.
- [x] Add executable Save-phase transition proof, including timer and
      edit-during-save cases.
- [x] Add executable host-message admission/state-reset proof.
- [x] Add executable Widgets read-order/result-priority proof.
- [x] Add executable panel-label projection proof.
- [x] Add executable Copilot visible-message transition proof.
- [x] Retain source assertions only for structural facts such as deletion of
      `TopDrawer`; do not use them as the only interaction proof.

**Slice 0 exit gate:** the baseline is recorded, authority seams are current,
and fixtures fail only for the approved missing E1-E6 behavior.

### Slice 1 — Shared Roma click-confirmation mechanics

#### Step 1.1 — Add the consumer component

- [x] Add `roma/components/roma-command-confirmation-dialog.tsx`.
- [x] Name the export `RomaCommandConfirmationDialog`.
- [x] Give it only these product-neutral inputs: `open`, `title`, `body`,
      `confirmLabel`, `onCancel`, and `onConfirm`.
- [x] Render nothing while closed so a closed confirmation cannot intercept
      the page.
- [x] Compose the current Dieter `diet-popup` structure, Dieter Buttons, and
      current Roma dialog lifecycle/backdrop pattern.
- [x] Keep command copy, command pending state, route calls, and errors out of
      the shared component.

#### Step 1.2 — Implement the exact click behavior

- [x] Opening the dialog invokes no command.
- [x] Cancel closes and invokes no command.
- [x] The existing approved backdrop behavior closes and invokes no command.
- [x] Confirm closes the decision surface and invokes `onConfirm` exactly once.
- [x] Do not add keyboard navigation, Escape behavior, focus trapping, focus
      return, or keyboard acceptance tests in this pass.
- [x] Do not remove any mechanics already supplied invisibly by the reused
      primitive merely to manufacture a separate cleanup project.

#### Step 1.3 — Prove the component boundary

- [x] Verify that no route, account, Widget, asset, team, or publication word is
      hardcoded in the component.
- [x] Verify that open, Cancel, and backdrop produce zero command calls.
- [x] Verify that one Confirm produces one command call.
- [x] Verify repeated UI events cannot invoke the command after the dialog has
      closed.

**Slice 1 exit gate:** one Roma-owned, product-neutral confirmation consumer
exists; it asks for one click decision and owns no product command.

### Slice 2 — Wire the five Roma commands

#### Step 2.1 — Widget Delete

- [x] In `widgets-domain.tsx`, store the exact pending `WidgetInstance` chosen
      from the row menu.
- [x] Opening Delete closes the row menu and opens the confirmation; it does
      not call the existing delete handler.
- [x] Use title `Delete this widget?` and confirm label `Delete widget`.
- [x] Name the exact instance and state that deletion removes its saved source,
      removes public availability, and cannot be undone.
- [x] Confirm invokes the existing delete path once.
- [x] Preserve `activeActionKey`, list-wide busy behavior, Widgets cache
      mutation/invalidation, success removal, and visible delete error.

#### Step 2.2 — Asset Delete

- [x] In `assets-domain.tsx`, store the exact selected asset rather than
      deleting on the first click.
- [x] Use title `Delete this asset?` and confirm label `Delete asset`.
- [x] Name the exact asset, say Widgets referencing it may stop displaying it,
      and state that deletion cannot be undone.
- [x] Confirm invokes the current exact asset-delete callback once.
- [x] Preserve upload/list/refresh behavior, asset busy state, list update, and
      visible failure copy.

#### Step 2.3 — Unpublish

- [x] In `widget-publication-controls.tsx`, separate request intent from the
      existing `changeStatus` execution.
- [x] A request for `published` continues immediately and unchanged.
- [x] A request for `unpublished` opens confirmation in both current consumers:
      the Widgets row toggle and Roma Builder publication state.
- [x] Use title `Take this widget offline?` and confirm label `Unpublish`.
- [x] Name the exact Widget and say its saved source remains and it can be
      published again.
- [x] Confirm calls the existing unpublish transition once.
- [x] Preserve pending publication exclusion, exact Tokyo refresh, widgets
      cache handling, upsell behavior, dirty-state publication gate, and errors.

#### Step 2.4 — Remove team member

- [x] In `team-member-domain.tsx`, open confirmation instead of invoking
      `removeMember` on the first click.
- [x] Use title `Remove this team member?` and confirm label `Remove member`.
- [x] Name the exact person and state that account access is removed.
- [x] Confirm invokes the existing remove-member command once.
- [x] Preserve role/owner restrictions, pending state, successful navigation or
      refresh, and visible Berlin/Roma failure.

#### Step 2.5 — Transfer ownership

- [x] In `settings-domain.tsx`, open confirmation for the exact selected owner
      candidate.
- [x] Use title `Transfer account ownership?` and confirm label
      `Transfer ownership`.
- [x] Name the selected recipient and state that the current Owner becomes
      Admin.
- [x] Confirm invokes the existing owner-transfer route once.
- [x] Preserve owner-only policy, selected-candidate truth, pending state,
      bootstrap/session reconciliation, redirect behavior, and visible failure.

#### Step 2.6 — Confirmation regression matrix

For each of the five commands, prove:

- [x] the first product click opens the correct decision and makes no request;
- [x] Cancel and backdrop leave local and remote state unchanged;
- [x] Confirm invokes the exact existing handler once;
- [x] subject, title, body, and confirm label are exact;
- [x] an existing route failure remains visible in the existing owner surface;
- [x] success remains owned by the existing command result; and
- [x] no invitation command or invitation copy entered the implementation.

**Slice 2 exit gate:** all five commands require one explicit click decision,
and every post-confirm route/result behavior remains unchanged.

### Slice 3 — One Roma Builder header and Bob's borrowed Save control

This slice implements E2 and E6 together.

#### Step 3.1 — Add the generic Dieter success presentation

- [x] Extend the existing Dieter Button with optional
      `data-state="success"`.
- [x] Keep `data-state` orthogonal to required `data-type`; it expresses a
      temporary result, not a fifth hierarchy type.
- [x] Use existing system green and white tokens for rest/hover/active color.
- [x] Preserve Button geometry, sizing, loading, disabled, Icon, and label
      contracts.
- [x] Add the state to `button.spec.json` and the existing source example.
- [x] Reuse the existing `checkmark` Dieter icon; add no icon registry or new
      glyph.

#### Step 3.2 — Define Bob's one Save presentation phase

- [x] Add the local phase union `hidden | save | saving | saved` to Bob's
      session presentation state.
- [x] Keep it outside persisted Widget data and outside Roma account truth.
- [x] Derive every transition from Bob's existing draft signature,
      `isDirty`, `isSaving`, and exact Save result.
- [x] Initial clean open emits `hidden`; initial dirty state emits `save`.
- [x] Starting Save emits `saving` before the existing command is sent.
- [x] Failed Save preserves the existing visible Bob error and emits `save`
      only while the current draft remains dirty; a clean draft emits `hidden`.
- [x] Successful Save emits `saved` only when the current draft signature still
      equals the submitted/saved signature.
- [x] If the draft remains dirty when Save terminates, emit `save` directly and
      never show a false success receipt.
- [x] After exactly 1,000 milliseconds, emit `hidden` only if the draft is still
      clean.
- [x] A new accepted edit, new Save, accepted editor open, or unmount cancels
      the pending disappearance timer and resolves the phase from current truth.
- [x] First Save keeps the current in-place `instanceId` and `baseLocale`
      adoption and follows the same phase sequence without another open.

#### Step 3.3 — Add exactly two typed iframe presentation messages

Add these message shapes to the existing Bob and Roma host unions:

```ts
type BobSaveControlStateMessage = {
  type: 'bob:save-control-state';
  phase: 'hidden' | 'save' | 'saving' | 'saved';
};

type HostSaveRequestMessage = {
  type: 'host:save-request';
};
```

- [x] Do not put them in a new service/package or general event bus.
- [x] Bob emits its current phase after every accepted `ck:open-editor` and
      every phase transition.
- [x] Use the exact known Roma host origin after the existing open-boundary
      admission.
- [x] Bob accepts `host:save-request` only from its exact parent source and
      admitted host origin.
- [x] Bob rechecks `isDirty`, `isSaving`, and the current phase before invoking
      its existing `save()`; an inapplicable duplicate is ignored.
- [x] Keep `bob:account-command(save-instance)` and
      `host:account-command-result` as the only persistence request/result.

#### Step 3.4 — Add the reserved Save slot to Roma's header

- [x] In `builder-domain.tsx`, store the latest Bob Save phase, defaulting to
      `hidden`.
- [x] Accept `bob:save-control-state` only after the current exact Bob origin
      and iframe-window checks.
- [x] Reset the phase to `hidden` on iframe load, active target change,
      Bob-not-ready state, open failure, and unmount.
- [x] Render `page__actions` when either publication controls or a Bob Save
      phase is present. This must work for an unsaved New draft, where no
      publication instance exists yet.
- [x] Keep publication controls first and place the borrowed Save slot at the
      far right.
- [x] Render:
  - `save`: enabled large primary `Save`;
  - `saving`: disabled/busy large primary Button with the ordinary Dieter
    Spinner in that same Button;
  - `saved`: disabled large Button with `data-state="success"`, the Dieter
    checkmark, and `Saved`; and
  - `hidden`: no Button and no placeholder chrome.
- [x] Only the visible `save` phase sends `host:save-request` to Bob.
- [x] Send to the exact Bob origin and current iframe window.
- [x] Do not infer dirty state or Save success in Roma.

#### Step 3.5 — Preserve Roma-owned compact navigation

Current code exposes compact navigation from Bob's `TopDrawer`, while the
full-canvas Roma Builder suppresses RomaShell's ordinary header trigger. That
reachable action must move to its real owner before Bob's header is deleted.

- [x] Render the existing Roma compact navigation control in the Roma Builder
      header's leading group.
- [x] Reuse `roma-nav-trigger`, the existing Dieter quaternary Button/Icon, and
      `useRomaShellActions().openNavigation`.
- [x] Keep it hidden in Full mode through the current Roma CSS and visible in
      Compact mode.
- [x] Keep navigation state, scrim, dismissal, and focus behavior inside the
      existing RomaShell owner.
- [x] Once this is present, remove Bob's `open-navigation` host action and its
      now-dead message type/handler. Do not create a replacement Bob route or
      host command.

#### Step 3.6 — Preserve Bob's compact ToolDrawer access without a header

- [x] Move the current compact-only `Open tools` quaternary icon Button from
      `TopDrawer` into `editor-content`.
- [x] Keep the existing `toolsOpen`, `toolsButtonRef`, `aria-expanded`,
      `aria-controls`, icon, and ToolDrawer/scrim behavior.
- [x] Position it as a compact editor control over the work area using existing
      Dieter tokens; keep it hidden while the persistent ToolDrawer is present.
- [x] Do not create a new top bar, rail, or header to hold it.
- [x] Keep the existing explicit unsupported mobile-portrait boundary.

#### Step 3.7 — Delete Bob's second header

- [x] Remove `TopDrawer` from `BuilderApp`.
- [x] Delete `bob/components/TopDrawer.tsx` after both reachable compact actions
      have valid owners.
- [x] Delete `topdrawer`, `topdrawer-actions`, `topdrawer-leading`,
      `topdrawer-context-wrap`, retired compact-child selectors, and any other
      header-only/dead CSS or wrappers.
- [x] Keep `builder-app` and `editor-content` as the Bob layout root and allow
      editor content to consume the released vertical space.
- [x] Do not move publication state/actions into Bob.

#### Step 3.8 — Save/header behavior matrix

Prove all of the following through executable behavior tests:

- [x] one Roma header and no Bob header;
- [x] exact origin/source admission in both directions;
- [x] clean open -> hidden;
- [x] dirty open/edit -> Save;
- [x] Save click -> one host request -> one existing Bob Save command;
- [x] duplicate or stale host request -> no second Save;
- [x] existing Save success -> spinner -> green checkmark + Saved -> hidden;
- [x] First Save success -> ID/base-locale adoption and the same sequence with
      no second `ck:open-editor`;
- [x] Save failure -> existing error plus Save when dirty or hidden when clean;
- [x] edit during Save -> Saving until the result, then Save when still dirty,
      never a false Saved receipt;
- [x] edit during Saved -> timer cancelled and Save immediately;
- [x] timer completion hides only a still-clean result;
- [x] target change, iframe reload, open failure, and Bob-not-ready reset stale
      Roma Save chrome;
- [x] `bob:dirty-state-changed` still gates publication independently;
- [x] compact Roma navigation remains reachable;
- [x] compact Bob ToolDrawer remains reachable; and
- [x] Full mode renders no compact-only controls.

**Slice 3 exit gate:** Roma renders the only Builder header, Bob remains the
sole Save authority, the button tells the exact Save truth, and no reachable
compact operation was dropped.

### Slice 4 — Widgets cold-path correction

#### Step 4.1 — Start the independent reads together

- [x] In `roma/app/api/account/widgets/route.ts`, resolve the current-account
      context exactly as today.
- [x] Start `loadAccountWidgetInstanceFacts` and
      `listTokyoWidgetDefinitions` together in one `Promise.all`.
- [x] Await the pair once.
- [x] Preserve deterministic error priority: instance-facts error first;
      otherwise definitions error; otherwise the exact current response.
- [x] Preserve status codes, reason keys, auth cookies, catalog mapping,
      instance mapping, and response shape.
- [x] Add no cache, timeout, race, alternate read, fallback, probe, or retry.

#### Step 4.2 — Keep the loading state table-shaped

- [x] In `widgets-domain.tsx`, render the current semantic Widgets Table shell
      during first empty load.
- [x] Keep the current headers visible.
- [x] Render one status row spanning the table columns with
      `Loading widgets...`.
- [x] Preserve accessible status semantics.
- [x] Leave refresh, retry, empty, filtered-empty, sorting, publication
      controls, and shared widgets cache behavior unchanged.

#### Step 4.3 — Verify the cold path

- [x] Both reads start before either is resolved.
- [x] Success response is unchanged.
- [x] Instance error wins even if definitions also fail.
- [x] Definitions error returns when instances succeed.
- [x] First load, empty result, cached revisit, forced refresh, and Retry each
      retain their exact current meaning.
- [x] The page no longer changes from a loose paragraph into a table.

**Slice 4 exit gate:** the route has one parallel join and the loading UI
preserves the final table geometry without new infrastructure.

### Slice 5 — Widget Defaults compiled panel context

#### Step 5.1 — Preserve exact compiler output

- [x] In `widget-defaults-builder-controls.tsx`, keep
      `CompiledWidget.panels` order.
- [x] Keep `filterPanelHtml` as the existing product projection.
- [x] For every non-empty projected panel, create a wrapper containing the
      exact `panel.label` and the filtered control HTML.
- [x] Set the label with DOM `textContent`.
- [x] Reuse the existing Bob/Dieter control-group typography and spacing.
- [x] Do not infer a label from panel id, duplicate a label map, add fallback
      wording, or revalidate the compiled artifact.
- [x] Keep a panel with no selected defaults controls absent.

#### Step 5.2 — Preserve the existing host behavior

- [x] Keep control order, hydration/destruction, `showIf`, raw value admission,
      font-library behavior, account-limit decision, draft updates, and the
      existing Widget Defaults save route unchanged.
- [x] Verify repeated low-level cluster/control labels remain distinguishable
      because the surrounding panel label is visible.

#### Step 5.3 — Verify projection results

- [x] Multiple non-empty panels render in compiler order with exact labels.
- [x] Exact HTML for selected controls remains intact.
- [x] Empty panels stay absent.
- [x] Quotes/entities in a trusted label render once as text, not interpreted
      markup.
- [x] No second label authority exists.

**Slice 5 exit gate:** every visible projected group retains its exact trusted
compiled context and nothing else in Widget Defaults changes.

### Slice 6 — Product Copilot result-aware visible transcript

#### Step 6.1 — Add presentation-only message status

- [x] Extend Bob's visible `CopilotMessage` with the smallest local status
      needed for `working`, `applied`, `not-applied`, and `stopped` presentation.
- [x] Keep status out of `CopilotModelHistory`, `CopilotTurnRequest`, SSE
      events, continuations, grants, and provider/model input.
- [x] Render exact passive words: `Working`, `Applied`, `Not applied`, and
      `Stopped`.
- [x] Do not rewrite or suppress streamed assistant text.

#### Step 6.2 — Drive status from the existing result chain

- [x] Creating the active assistant message marks it Working.
- [x] `text_delta` continues to append text while the message stays Working.
- [x] A text-only successful terminal event removes unresolved Working state;
      do not invent an `Applied` edit receipt when no edit occurred.
- [x] A message containing `apply_widget_ops` stays Working through tool-call
      buffering and `model_step_finished` until Bob's existing `applyOps`
      accepts the complete batch.
- [x] Successful apply marks the exact visible message Applied and preserves
      changed paths plus Undo.
- [x] Request failure, terminal stream error, rejected tool batch, or local
      apply failure marks unresolved proposed work Not applied and preserves
      the existing visible error.
- [x] Stop marks unresolved work Stopped, sends no further continuation, and
      does not roll back edits already applied.
- [x] Late events for a stopped turn remain ignored under the existing rule.

#### Step 6.3 — Preserve the AI boundaries

- [x] Keep the one-tool contract, model-step buffering, terminal-event
      enforcement, request draft signature as capsule context, atomic apply,
      Undo guard, grant, model policy, 120-second transport timeout, and zero
      provider retries.
- [x] Add no SSE event, response handshake, outcome API, learning record,
      Worker retry, model retry, Roma status inference, or persistence.

#### Step 6.4 — Verify visible truth

- [x] Text streams while Working is visible.
- [x] Text-only terminal success does not remain Working.
- [x] Tool narration cannot show Applied before `applyOps` succeeds.
- [x] Apply rejection displays Not applied plus the existing error.
- [x] Stream failure cannot leave unresolved text looking applied.
- [x] Stop displays Stopped for unresolved work and preserves already-applied
      edits for explicit Undo.
- [x] The next model request contains the exact same structured history shape
      as before this pass.

**Slice 6 exit gate:** the visible transcript reports Bob's known result and
the wire/runtime agent contracts are untouched.

### Slice 7 — Canonical documentation reconciliation

Update documentation only after Slices 1-6 are implemented and verified
locally. Planning text must not masquerade as current runtime truth.

#### Step 7.1 — Roma and account manuals

- [x] Update `documentation/services/roma.md` for the five click
      confirmations, Widgets concurrent read/loading behavior, Widget Defaults
      panel labels, and the one Roma Builder header with borrowed Save slot.
- [x] Update `documentation/architecture/AccountManagement.md` only for the
      current Remove member and Transfer ownership confirmation behavior.
- [x] Keep invitation law unchanged and out of the implementation record.
- [x] Keep PRD 129 lifecycle/publication/cache law unchanged.

#### Step 7.2 — Bob and Builder surface manuals

- [x] Update `documentation/services/bob.md` to remove `TopDrawer` from the
      current topology, document `ToolDrawer | Workspace`, document the borrowed
      Save presentation bridge, and record the exact Save sequence.
- [x] Update `documentation/engineering/UI/surfaces.md` so it no longer claims
      TopDrawer remains above EditorContent.
- [x] Update `documentation/engineering/UI/interactions.md` from the current
      `Saving... -> hidden` description to the exact one-second green Saved
      receipt and click-only command confirmations.
- [x] Preserve Bob's browser-memory editing and Roma-owned publication law.

#### Step 7.3 — Dieter and dialog manuals

- [x] Update `documentation/services/dieter.md` and
      `documentation/engineering/UI/components.md` for Button
      `data-state="success"` as presentation orthogonal to `data-type`.
- [x] Update `documentation/engineering/UI/dialogs-and-modals.md` with the
      exact five-command confirmation class and its approved click/backdrop
      behavior, without broad keyboard work or a new dialog framework.
- [x] Keep product copy and command meaning with Roma.

#### Step 7.4 — Product Copilot manuals

- [x] Update `documentation/services/bob.md` and
      `documentation/ai/agents/product-copilot.md` for visible Working/Applied/
      Not applied/Stopped presentation.
- [x] State explicitly that this is Bob UI state and does not change Product
      Copilot/San Francisco events or model history.

#### Step 7.5 — Execution records

- [x] Update PRD 130B and this plan from `implementation not started` to the
      exact local/deployed/verified status only as each becomes true.
- [x] Keep all six audit documents historical and unchanged except a factual
      link correction if required.
- [ ] Record exact files, focused commands, commit, deploy revisions, and owner
      QA evidence.
- [x] Record any real remaining mismatch instead of declaring completion.

**Slice 7 exit gate:** canonical docs match implemented code, the PRD remains
the decision record, and this file contains the execution/evidence checklist.

### Slice 8 — Local verification and independent V1-V8 audit

#### Step 8.1 — Focused checks

Run at minimum:

```bash
pnpm -C roma typecheck
pnpm -C roma lint
pnpm -C roma test:widget-command-gates
pnpm -C roma test:account-asset-gates
pnpm -C roma test:ui-copy
pnpm -C roma test:widget-defaults-typography
pnpm -C dieter typecheck
pnpm -C bob typecheck
pnpm -C bob lint
pnpm -C bob test:accessibility-copy
pnpm -C bob test:editor-contract
pnpm -C bob test:copilot-model-history
pnpm -C bob test:copilot-pane-gates
pnpm -C roma build:cf
pnpm -C bob build:cf
git diff --check
```

- [x] Add a focused package script when a new behavior fixture needs one.
- [x] Do not broaden to Prague or unrelated Workers.
- [x] Inspect the complete diff after generated/build steps and ensure ignored
      output did not become source truth.

#### Step 8.2 — Structural drift scans

- [x] No `TopDrawer` import/render/source file or dead header CSS remains.
- [x] No Bob `open-navigation` message remains after Roma owns the compact
      trigger.
- [x] No invitation code changed.
- [x] No new Save route/result protocol exists.
- [x] No new Copilot SSE event or model-history presentation field exists.
- [x] No inferred/fallback Widget Defaults panel label exists.
- [x] No cache, retry, probe, validator, or generic command framework entered
      the diff.

#### Step 8.3 — Independent V1-V8 audit

Use an independent agent after implementation, as required by `AGENTS.md`, and
give it the complete current diff plus PRD 130B. It must inspect runtime paths,
not only test names.

| ID | Required audit result |
| --- | --- |
| V1 | No invented confirmation subject, Save receipt, panel label, or Copilot result substitutes exact truth |
| V2 | No persisted or user state is normalized/repaired on read |
| V3 | No command, failure, panel, event, compact navigation control, or ToolDrawer control is silently dropped |
| V4 | Existing authz and exact iframe origin/source admission remain fail-closed |
| V5 | No stored-state interpretation changed |
| V6 | Save and Copilot presentation claim only completed results; confirmation never claims command success |
| V7 | No failing flow continues behind a renamed wrapper/retry |
| V8 | Runtime does not depend on tests, probes, or audit helpers |

Every concrete blocker is corrected and the affected tests/docs are rerun
before proceeding.

Result on 2026-08-19: PASS. The independent complete-diff audit found two
reachable Save-phase blockers, both corrected before shipping: an edit during
Save had exposed Save before the command terminated, and a failed Save after an
edit back to clean truth had exposed a dead Save control. The corrected reducer,
behavior tests, manuals, and production builds were re-audited. V1–V8 pass with
no unresolved blocker.

**Slice 8 exit gate:** all focused checks/builds pass, the full diff is clean,
and independent V1-V8 reports no unresolved violation.

### Slice 9 — Commit, push, and Roma/Bob deployment

This slice requires explicit execution/push authority at the time it runs.

#### Step 9.1 — Reconcile the shared worktree

- [x] Re-read `git status --short`, diff stat, and every edited-file diff.
- [x] Include every intended edited file; do not leave half of an authority
      conversion uncommitted.
- [x] Preserve and correctly include concurrent authorized work rather than
      discarding it.
- [x] Stop if an edited file cannot be attributed or safely reconciled.

#### Step 9.2 — Commit and push

- [x] Create one cohesive commit for code, tests, and canonical documentation.
- [x] Record the commit SHA:
      `34444e5e646cc530514e0646d27f0795259ce96d`.
- [x] Push `main` only under the current explicit authority.
- [x] Record the remote branch/SHA after push; `github/main` matched
      `34444e5e646cc530514e0646d27f0795259ce96d`.

#### Step 9.3 — Observe only the affected deploy plane

- [x] Observe the Git-connected Roma Cloudflare Pages build from the pushed SHA.
- [x] Observe the Git-connected Bob Cloudflare Pages build from the pushed SHA.
- [x] Confirm Dieter source is consumed by those successful builds; there is no
      separate Dieter runtime deploy.
- [x] Do not invoke, debug, wait for, or report Prague deployment.
- [x] Do not deploy Berlin, Tokyo-worker, San Francisco, or Product Copilot
      Worker because this pass changes none of those runtime owners.
- [x] Record Pages deployment identifiers, status, and deployed revision:
      Roma `9270d489-3886-4c95-ab6f-527a4a6c58e5` and Bob
      `db5a4569-6836-4a96-b9b4-cea4d3857806`, both terminal
      `deploy/success` for `34444e5e646cc530514e0646d27f0795259ce96d`.

**Slice 9 exit gate:** the complete intended commit is on `main`, Roma and Bob
Pages report the pushed revision, and no unrelated deploy was performed.

### Slice 10 — Cloud-dev technical verification and owner QA

Use only safe cloud-dev account data. Product mutations used for QA must be
restored when possible and recorded exactly.

#### Step 10.1 — Five confirmations

For Widget Delete, Asset Delete, Unpublish, Remove member, and Transfer
ownership:

- [ ] the first click opens the exact dialog and makes no request;
- [ ] Cancel makes no request;
- [ ] standard backdrop dismissal makes no request;
- [ ] Confirm makes one exact request;
- [ ] pending and failure remain visible in the existing surface; and
- [ ] successful reversible state is restored after QA.

Member removal and ownership transfer require controlled disposable
cloud-dev identities and explicit owner coordination. If those safe
preconditions do not exist, mark those live command completions pending; do
not mutate a real Google identity or risk the owner account.

No keyboard acceptance checks are part of this pass.

#### Step 10.2 — One Builder header and Save lifecycle

- [ ] Builder displays one Roma header and no Bob header.
- [ ] Clean draft shows no Save control.
- [ ] Editing shows Save at the far-right Roma action slot.
- [ ] Save shows the in-button spinner.
- [ ] Successful clean Save shows green checkmark + Saved for one second, then
      disappears.
- [ ] A newer edit during Save keeps the spinner until the result, then returns
      to Save when the current draft remains dirty.
- [ ] Failure keeps the existing Bob error visible and derives Save/hidden from
      current dirty truth.
- [ ] First Save adopts the ID/base locale and does not reopen/remount Bob.
- [ ] Publication actions remain Roma-owned and continue to use Bob dirty truth.
- [ ] Iframe reload and target change do not retain stale Save chrome.

#### Step 10.3 — Compact Builder

- [ ] Roma's compact navigation trigger remains reachable in the Roma header.
- [ ] Bob's compact ToolDrawer opener remains reachable in editor content.
- [ ] ToolDrawer open/close/scrim behavior remains intact.
- [ ] Full mode keeps the persistent ToolDrawer and hides compact-only controls.
- [ ] The existing unsupported mobile-portrait boundary remains truthful.

#### Step 10.4 — Widgets and Widget Defaults

- [ ] A cold Widgets load retains the Table headers and loading row.
- [ ] Runtime request evidence is consistent with concurrent upstream reads;
      do not add a probe merely to prove this.
- [ ] Success, empty, failure, Retry, sorting, and publication behavior remain
      correct.
- [ ] Widget Defaults visibly separates multiple panels with their exact
      compiled labels and retains control behavior/save.

#### Step 10.5 — Product Copilot

- [ ] A real text-only turn shows Working while active and resolves on terminal
      success.
- [ ] A real edit turn remains Working until Bob applies it, then shows Applied
      with changed paths/Undo.
- [ ] Stop marks unresolved work Stopped and preserves already-applied edits.
- [ ] A safe controlled failure, when one can be produced through an existing
      product boundary, shows Not applied plus the existing error.
- [ ] Do not break a provider, change a secret, or invent a test runtime path to
      manufacture failure evidence; mark that one live scenario pending if it
      cannot be exercised safely.

#### Step 10.6 — Final reconciliation

The signed-in checks in Steps 10.1–10.5 remain pending because the product
browser runtime had no available in-app or external browser session. They were
not inferred from local tests or replaced by another browser mechanism. Safe
non-UI checks proved HTTP `200` from Roma's signed-out custom/deployment login
surfaces and Bob's custom/deployment `/bob` surfaces. No product data changed.

Record separately:

- [x] local test/build evidence;
- [x] pushed commit and remote revision;
- [x] Roma Pages deployment;
- [x] Bob Pages deployment;
- [x] cloud-dev technical evidence;
- [x] owner-visible QA results recorded as pending because no browser was
      available;
- [x] product-data mutations and restoration: none;
- [x] independent V1-V8 result; and
- [x] only genuinely pending live checks.

**Slice 10 exit gate:** deployed Roma/Bob behavior matches E1-E6, owner QA is
recorded honestly, and no excluded surface or unrelated product data was
touched.

## 8. Completion checklist

PRD 130B is complete only when every item below is true:

- [ ] Slices 0-10 are complete in order.
- [x] All five consequential commands require one click confirmation.
- [x] Save follows the exact four-phase presentation and never gives a false
      receipt to a newer dirty draft.
- [x] Roma renders the only Builder header.
- [x] Compact navigation and ToolDrawer access remain reachable under their
      correct owners.
- [x] Widgets reads are concurrent and first load remains table-shaped.
- [x] Widget Defaults preserves exact compiled panel labels.
- [x] Copilot visible status follows exact terminal/apply truth without a wire
      change.
- [x] Canonical documentation matches implemented and deployed behavior.
- [x] Focused behavior checks, typechecks, lints, and Roma/Bob builds pass.
- [x] Independent V1-V8 has no unresolved blocker.
- [x] The complete intended worktree is committed and pushed under explicit
      authority.
- [x] Roma and Bob deployment revisions are recorded.
- [x] Cloud-dev technical verification and owner QA are recorded separately.
- [x] No invitation, Prague, Catalog/New Builder, PRD 129, or other excluded
      work entered the pass.

Current reconciliation: Slices 0–9 are implemented, green, independently
audited, pushed, and deployed. Safe non-UI cloud verification is complete with
no product-data mutation. Slice 10's signed-in owner-visible checks remain
explicitly pending because no product browser session was available. The
honest status is: **deployed successfully; signed-in owner-visible QA pending**.

## 9. Post-deployment audit correction execution

The prior slice record above remains historical evidence for revision
`34444e5e646cc530514e0646d27f0795259ce96d`. The Claude and Cursor audits found
proof debt and one real stale-continuation defect after that deployment. The
product owner also settled the governing interaction law: Manual and Copilot
are mutually exclusive, and only one edit authority can operate on one open
instance at a time. The following slices are the complete current correction
plan.

### Slice 11 — Re-establish authority and adjudicate the audits

#### Step 11.1 — Re-read the owning law

- [x] Read the mandatory architecture and strategy documents completely.
- [x] Read the complete Bob, Roma, Product Copilot, UI interaction, testing,
      runtime-profile, Cloudflare operation, and Pages deployment manuals.
- [x] Read both post-execution audits and the complete PRD/execution record.

#### Step 11.2 — Lock the product ruling

- [x] Manual and Copilot remain mutually exclusive views over one Bob session.
- [x] One unresolved Copilot turn owns the only active edit lane.
- [x] Chat and its active Undo record remain Bob session-level browser memory;
      idle mode switching must not discard them.
- [x] Leaving or reloading Builder still discards that state; no persistence is
      added.
- [x] The request `draftSignature` remains context, not a concurrency validator.
- [x] Claude's keyboard finding stays excluded, its phase finding remains
      unproven, and its header finding remains owned by completed PRD 131.
- [x] Cursor's stale-continuation finding and both audits' behavior-proof gaps
      enter execution.

**Slice 11 exit gate:** the correction follows the actual product interaction
and does not manufacture a second concurrency protocol.

### Slice 12 — Enforce Bob's one active edit lane

#### Step 12.1 — Put ownership in existing session state

- [x] Represent unresolved Copilot ownership through the existing Bob session
      and turn lifecycle; add no global store, registry, route, or protocol.
- [x] Keep the visible thread and current Undo record with that open session so
      unmounting the idle Copilot panel does not delete either.
- [x] Keep presentation-only status out of model history and the wire.

#### Step 12.2 — Gate conflicting local actions

- [x] While a turn is unresolved, keep Copilot selected and disable Manual.
- [x] Disable Undo while a request or tool application is unresolved.
- [x] Keep Stop available and preserve the existing Send/Stop command.
- [x] Release Manual and Undo only after terminal success, visible failure, or
      Stop settles the active turn.
- [x] Preserve the existing one-tool/one-step envelope and atomic apply path.

#### Step 12.3 — Make teardown terminal

- [x] On Bob session or Copilot owner teardown, cancel the active request.
- [x] Mark unresolved visible work stopped through the existing Bob state.
- [x] Ignore every late event/completion for that stopped owner.
- [x] Prove that teardown cannot apply an edit or open a continuation.
- [x] Keep the existing cancellation envelope: Bob puts the active stream id in
      the command body, Roma aborts the controller at that target id, and the
      cancellation command's own id correlates its acknowledgement.
- [x] Enable Cloudflare `enable_request_signal` for Roma so aborting the hosted
      browser request reaches the route signal and upstream Product Copilot
      fetch in the deployed runtime.

**Slice 12 exit gate:** no current UI path can run Manual/Undo concurrently
with unresolved Copilot work, while idle panel switching preserves chat and
Undo exactly for the open session.

### Slice 13 — Build continuation from exact applied truth

#### Step 13.1 — Consume the existing apply result

- [x] Keep `session.applyOps` as Bob's sole operation authority.
- [x] On success, consume the exact post-apply `data` already returned by that
      result.
- [x] Build the continuation `currentDraftContext` directly from that data and
      the exact compiled visible-control projection.
- [x] Send the existing tool result and `priorModelStepId` unchanged.
- [x] Do not wait for a render/effect/ref refresh and do not substitute an older
      draft snapshot.

#### Step 13.2 — Preserve failure truth

- [x] A failed/rejected apply never opens a success continuation. The existing
      error tool-result continuation, when the turn can continue, carries the
      exact unchanged current draft.
- [x] Failure remains `Not applied` with the existing visible error.
- [x] No edit, history entry, tool result, or continuation is silently dropped
      or invented.

**Slice 13 exit gate:** every continuation describes the exact draft Bob just
applied, and no new validator or wire coordinate exists.

### Slice 14 — Replace duplicated and regex-only proof

#### Step 14.1 — Execute the mounted Bob lifecycle

- [x] Mount the production Bob session/ToolDrawer/Copilot consumer in a real
      browser DOM rather than reimplementing its state machine in the test.
- [x] Prove Working, text-only terminal, Applied, Not applied, and Stopped.
- [x] Prove Manual and Undo are unavailable while unresolved and return only
      after the exact terminal boundary.
- [x] Prove idle Manual/Copilot switching preserves transcript and Undo.
- [x] Prove Stop/teardown reject late apply and continuation work.
- [x] Prove the continuation body contains values/signature derived from the
      exact returned post-apply draft.

#### Step 14.2 — Execute the real Roma/Bob Save and cancellation bridge

- [x] Mount the production Builder host and Bob session boundary with their
      real cross-origin message admission.
- [x] Prove Bob phase emission reaches Roma's borrowed Save slot.
- [x] Prove a Roma Save click produces exactly one accepted Bob Save command.
- [x] Prove wrong origin, wrong source, stale iframe, and non-actionable phase
      remain inert.
- [x] Start a production Bob Copilot request through production Roma
      BuilderDomain, cancel it with Bob's exact target id, and prove Roma's
      hosted stream signal aborts before the cancellation acknowledgement.
- [x] Pin Roma's required Cloudflare request-signal compatibility flag in the
      same focused bridge gate; deployed propagation remains Slice 16 evidence.

#### Step 14.3 — Execute all five confirmation consumers

- [x] Mount Widget Delete, Asset Delete, both Unpublish consumers, Remove member,
      and Transfer ownership through their production consumer callbacks.
- [x] For each: first click opens, Cancel/backdrop makes no request, Confirm
      makes one exact request, and pending/failure stays in the owning surface.
- [x] Preserve the already-valid shared dialog and wire/protocol unit proof.

**Slice 14 exit gate:** tests execute the production callback chains the audits
identified; source-text assertions no longer masquerade as interaction proof.

### Slice 15 — Reconcile and audit locally

#### Step 15.1 — Reconcile operator and execution truth

- [x] Update Bob, Roma, Product Copilot, and UI interaction manuals to the
      one-active edit law, exact targeted cancellation, session-level transient
      state, teardown, and exact continuation.
- [x] Record audit adjudication and correction evidence in the PRD and this
      execution plan without rewriting the historical audit files.
- [x] Keep Roma, publication, header, Prague, invitations, Catalog/New, and all
      other excluded laws unchanged.

#### Step 15.2 — Run the complete bounded check matrix

- [x] Run new Bob and Roma behavior fixtures.
- [x] Run affected existing Copilot, Save, confirmation, command-gate, model
      history, UI-copy, accessibility, typecheck, lint, and build checks.
- [x] Run `git diff --check` and deterministic scope/contract scans.
- [x] Review every changed and untracked file in the shared worktree; preserve
      and include all intended collaborator work.

#### Step 15.3 — Independent V1–V8 audit

- [x] Give an independent agent the complete current diff and owning manuals.
- [x] Resolve every reachable blocker through the named authority.
- [x] Record V1–V8 explicitly with no local-test claim presented as live proof.

The independent current-tree audit passed with no reachable blocker. V1
silent substitution, V2 silent healing, V3 silent omission, V4 fail-open
control, V5 corruption-as-absence, V6 partial-success masquerade, V7
masquerade/redress, and V8 runtime test dependency all pass. This is local
implementation evidence only; it is not cloud-dev product proof.

**Slice 15 exit gate:** code, behavior proof, canonical docs, and execution
records agree, and the independent audit has no unresolved blocker.

### Slice 16 — Commit, push, deploy, and verify cloud-dev

#### Step 16.1 — Commit the complete intended worktree

- [ ] Re-read final status/diff and include every intended edited and untracked
      file; do not commit secrets or `.env.local`.
- [ ] Commit directly on `main` under the owner's explicit authority.
- [ ] Push `main` directly to `github/main`; no pull request exists in this
      deployment process.

#### Step 16.2 — Observe Git-connected Pages only

- [ ] Run the documented Cloudflare API preflight before Pages inspection.
- [ ] Observe Bob and Roma Git-connected deployments for the pushed revision.
- [ ] Do not deploy or troubleshoot Prague, Workers, or unrelated projects.
- [ ] Record exact commit and deployment IDs/states.

#### Step 16.3 — Verify the owning live surface

- [ ] Run safe signed-in Builder evidence through the documented browser/E2E
      path: active-turn mode/Undo gate, exact continuation, transcript/Undo
      retention, and Stop/terminal release.
- [ ] Re-run the Roma/Bob Save and confirmation checks that are safe with
      controlled cloud-dev data; record any identity-dependent destructive
      checks as pending rather than risking owner data.
- [ ] Record product-data mutations and restoration exactly.

**Slice 16 exit gate:** the complete correction is pushed and deployed through
the documented direct-main process, owning live evidence is recorded honestly,
and only genuinely unsafe owner-data checks remain pending.
