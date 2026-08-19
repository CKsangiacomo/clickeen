# PRD 130B — Defensive Construction Remediation

**Status:** LOCAL IMPLEMENTATION AND INDEPENDENT AUDIT COMPLETE — commit/push,
Roma/Bob deployment, and cloud-dev owner QA pending

**Date:** 2026-08-19

**Owner:** Human product owner / architect

**Execution owners:** Roma, Bob, and their existing tests and deployment surfaces

## 1. Outcome

This pass removes the small set of current product costs proven by the PRD 130
audit without reopening settled architecture or converting every defensive
mechanism into work.

When this PRD is complete:

1. five current Roma commands that can remove access, content, or public state
   require one explicit click confirmation before the existing command is
   invoked;
2. Bob's one Save button carries the whole result sequence: `Save`, in-button
   spinner, green checkmark plus `Saved`, then disappearance when the draft is
   clean;
3. the Widgets domain starts its two independent Tokyo reads concurrently and
   presents a stable, table-shaped first-load state;
4. Widget Defaults preserves the exact compiled panel label around each projected
   group of controls;
5. Product Copilot's visible assistant message cannot look complete or applied
   before the current turn and any requested Bob edit actually reach their
   terminal result;
6. the Builder has one Roma-owned page header; Bob's internal header is removed
   and Bob borrows a small right-side Roma header slot only while its Save control
   must be shown; and
7. canonical documentation, local verification, deployment evidence, and
   cloud-dev owner QA agree with the shipped behavior.

This is a product-friction correction. It does not add a new service, protocol,
storage coordinate, schema, registry, migration, runtime probe, retry system, or
validation layer.

## 2. Evidence bundle

The source audits are retained as evidence under [`audits/`](audits/):

- [PRD 130 master audit](audits/130__AUDIT__Defensive_Construction_Audit.md)
- [Claude product walk](audits/130__What_We_Found_Claude.md)
- [Codex independent audit](audits/130__What_We_Found_Codex.md)
- [Cursor service and route walk](audits/130__What_We_Found_cursor.md)
- [Kimi remediation re-audit](audits/130__What_We_Found_Kimi.md)
- [Copilot appendix](audits/130A__APPENDIX__Copilot.md)

Those documents are evidence and history. This PRD is the sole execution source
for the remaining work. A claim in an audit does not become implementation scope
unless it appears in the executable set in section 6.

## 3. Reconciliation method

Every reported issue was rechecked against current documentation and current
code after PRD 129 and PRD 131. Each claim is classified as one of:

- **Execute:** current or concretely reachable, evidence-backed, and inside this
  pass.
- **Already corrected:** the audit describes an earlier baseline; current code
  and product law already contain the correction.
- **Keep:** the named mechanism is intentional and currently serves a product or
  authority requirement.
- **Architect-closed:** the human architect explicitly accepted the current
  product state.
- **Excluded:** the surface is outside this pass by explicit instruction.
- **Not proven:** no current or reachable user flow supports implementation.
- **Conflicting evidence:** one walk reported the behavior and a later current
  walk did not reproduce it; no code change is authorized without a stable flow.
- **Test artifact:** the reported behavior came from the audit method rather than
  the product journey.
- **Unmarked:** the audits did not execute the flow; this is an evidence gap, not
  a defect classification.

The plan deliberately does not turn theoretical risk into machinery.

## 4. Explicit scope

### 4.1 In scope

| ID | Surface | Current cost | Classification |
| --- | --- | --- | --- |
| E1 | Roma destructive commands | Five consequential actions execute on the first ordinary click | Current and reachable |
| E2 | Bob Save | Successful Save removes its action but leaves no positive completion receipt | Current and observed |
| E3 | Roma Widgets initial load | Two independent Tokyo reads run serially; the wait is rendered as a loose text module | Current and observed |
| E4 | Roma Widget Defaults | Projection keeps control HTML but drops each trusted compiled panel label | Current and observed |
| E5 | Bob Product Copilot transcript | Streamed narration can visually assert completion before a requested edit is applied; a later error can leave contradictory text | Latent but concretely reachable |
| E6 | Roma/Bob Builder header | Bob still renders a second bar whose ordinary desktop purpose is now only Save | Current and observed in code/product structure |

### 4.2 Explicit exclusions

The following remain outside this pass even when an audit mentions them:

- all Prague code, routes, Pages deployment, signed-in intent, and public-page
  behavior;
- the Bob Catalog/New Builder surface, its copy, and its creation journey;
- all invitation creation, revocation, acceptance, and login-handoff behavior;
- changes to the PRD 129 instance lifecycle, publication, cache-eviction, source,
  or serving architecture;
- changes to the PRD 131 Builder header grammar;
- billing implementation, plan purchasing, and upgrade fulfillment;
- product implementation for intentionally blank Home or the honest Billing,
  Usage, and AI account stubs; and
- changes to the public Widget `Not found` failure face.

These exclusions are boundaries, not deferred findings in this PRD.

## 5. Authority gate

| Concern | Existing authority and coordinate | Rule for this pass |
| --- | --- | --- |
| Product surface | Roma account domains and Bob browser-memory editor | Roma owns the one page header; Bob owns Save truth and temporarily occupies Roma's Save slot |
| Account/session | Existing Roma current-account context; existing Bob session | No new identity, permission, or session coordinate |
| Storage | Existing Tokyo instance/asset storage and Michael account/member truth | No storage shape or data migration |
| Route/API | Existing Roma command routes and Bob's existing `save-instance` / Copilot transport | Add only the typed Save-control state/click iframe bridge; do not add a route or Save result protocol |
| Design system | Dieter popup mechanics, buttons, icons, table, tokens, and motion | Reuse mechanics; Roma and Bob retain product meaning and copy |
| Runtime/deploy | Roma and Bob Cloudflare Pages deployments from `main` | No Prague deployment and no unrelated Worker deployment |
| Verification | Focused local suites, cloud-dev Roma/Builder surfaces, owner QA | Local checks are not deployed-product proof |

### 5.1 Settled division of labor

- Bob owns exactly one account-bound editor command: Save.
- Roma owns Publish, Republish, Unpublish, Delete, assets, team, and
  account settings commands.
- Roma owns the Builder page header and its geometry. Bob may supply Save state
  to one reserved Roma action slot but does not render another header.
- Dieter owns popup, table, icon, button, and motion mechanics; it does
  not own the meaning of a destructive command.
- Tokyo and Michael continue to own their stored facts. No downstream validator
  or secondary policy check is added.
- Product Copilot proposes edits; Bob remains the authority that applies them to
  the browser-memory draft.

## 6. Executable product decisions

### E1 — One decision before five consequential Roma commands

The five commands are:

| Command | Existing owner | Confirmation meaning |
| --- | --- | --- |
| Delete saved Widget | `WidgetsDomain` | Deletes saved source and makes any published version unavailable; cannot be undone |
| Delete asset | `AssetsDomain` | Removes the asset; Widgets using it may stop displaying it; cannot be undone |
| Unpublish Widget | `WidgetPublicationControls` | Takes the public Widget offline while preserving saved source for later Publish |
| Remove team member | `TeamMemberDomain` | Removes the member's account access |
| Transfer ownership | `SettingsDomain` | Makes the selected member Owner and the current Owner Admin |

Implementation law:

1. Add one Roma consumer component, `RomaCommandConfirmationDialog`, because the
   same decision mechanics are required by five current Roma-owned commands.
2. Build it from the existing Roma/Dieter popup and button pattern; do not create
   another dialog framework or put product copy in Dieter.
3. Its exact inputs are open state, title, explanatory body, confirm label,
   cancel handler, and confirm handler. It renders nothing while closed.
4. This is a click product. The required interactions are Cancel, Confirm, and
   the standard popup backdrop behavior already provided by the current pattern.
   Do not add keyboard navigation, Escape, focus-trap, or focus-return work or
   acceptance gates in this pass.
5. No command begins while the dialog merely opens. The existing command handler
   runs exactly once only after explicit Confirm.
6. Confirmation closes into the existing owning surface's pending and error
   behavior. The dialog does not acquire command, cache, retry, or error authority.
7. Existing authorization, list-wide account command exclusion, result handling,
   and disabled states remain unchanged.
8. Publish and Republish remain immediate explicit commands. Only the transition
   from published to unpublished asks for confirmation.

Required command copy:

| Command | Title | Confirm label | Body requirement |
| --- | --- | --- | --- |
| Delete Widget | `Delete this widget?` | `Delete widget` | Name the Widget, public removal, and irreversibility |
| Delete asset | `Delete this asset?` | `Delete asset` | Name the asset, reference impact, and irreversibility |
| Unpublish | `Take this widget offline?` | `Unpublish` | Say saved changes remain and it can be published again |
| Remove member | `Remove this team member?` | `Remove member` | Name the person and loss of access |
| Transfer owner | `Transfer account ownership?` | `Transfer ownership` | Name the recipient and state that the current owner becomes Admin |

The final sentence may be adjusted for grammar around the exact subject name,
but the command meaning may not be weakened or generalized.

### E2 — The Save button carries its own result

Save remains Bob's only account-bound editing verb. There is one control and one
simple visible sequence:

```text
dirty              saving             saved              clean
[ Save ]    ->    [ spinner ]    ->   [ ✓ Saved ]   ->   no button
```

The `Saved` button is green, uses the existing Dieter checkmark icon, remains
visible for 1,000 milliseconds, and then disappears if the draft is still clean.
There is no separate badge, chip, message, or permanent clean-state Save button.

Implementation law:

1. Express the control with one local presentation phase:
   `save | saving | saved | hidden`.
2. Add one generic Dieter Button presentation state, `data-state="success"`,
   because Button currently has hierarchy types and loading but no green result
   state. It uses existing green/white tokens, remains orthogonal to
   `data-type`, and is recorded in the Button spec. Do not add Bob-local button
   colors or a new button component.
3. Dirty and idle renders the ordinary `Save` button.
4. Clicking Save renders the spinner inside that same button while the existing
   account command is in flight.
5. A successful Save renders the same button green with the Dieter checkmark and
   the word `Saved` only when the current draft signature still equals the
   submitted/saved signature.
6. After 1,000 milliseconds, that green result button disappears if the draft is
   still clean.
7. If the user makes a newer edit while Save is in flight, the returned result
   saved only the submitted snapshot. After the result, the control returns to
   `Save` when the current draft remains dirty; it must not claim that draft is
   saved.
8. A failed Save retains the existing visible error and resolves the control
   from current draft truth: `Save` when dirty, `hidden` when the current draft
   still matches saved truth. It never enters the green `Saved` state.
9. A new accepted edit, a new Save, or a new `ck:open-editor` cancels any pending
   disappearance timer and derives the next button state from current draft truth.
10. First Save adoption of `instanceId` and `baseLocale` remains in place and uses
    this same button sequence without a second Bob open.
11. Outside E6's two presentation messages, add no Roma message, Save result
    protocol, publication action, or persistence outside the existing Save
    command.

### E6 — One Roma header with a borrowed Bob Save slot

E6 is specified beside E2 because it is the rendering boundary for E2's button
and both execute as one cohesive slice.

Roma owns the Builder page and therefore owns its one header. Bob owns the
browser-memory draft and Save. The control is rendered in Roma's header, but its
visibility and state come only from Bob.

The resulting page is:

```text
┌──────────────────────────────────────────────────────────────┐
│ Widget name · publication state   publication actions   Save │  Roma
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                         Bob editor                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

When Bob is clean, the reserved slot renders nothing. When Bob is dirty, saving,
or showing the one-second result, that slot renders `Save`, the spinner, or green
`✓ Saved` respectively.

#### Ownership

- Roma owns the header DOM, layout, Widget identity, publication state,
  publication actions, and the empty/right-side Save slot.
- Bob owns the draft, dirty truth, submitted/current signatures, Save command,
  Save phase, and Save error.
- Dieter owns the Button, spinner, checkmark, green success state, and tokens.
- Tokyo remains the saved-source authority behind the existing Roma command.

Roma does not receive the draft through the header bridge and cannot construct a
Save. Bob does not acquire publication or page-header authority.

#### Minimal iframe bridge

Because Bob is an iframe, Roma cannot invoke Bob's in-memory `save()` directly.
Add exactly two typed presentation messages to the existing Roma/Bob message
unions:

```ts
type BobSaveControlStateMessage = {
  type: 'bob:save-control-state';
  phase: 'hidden' | 'save' | 'saving' | 'saved';
};

type HostSaveRequestMessage = {
  type: 'host:save-request';
};
```

The messages are local to the existing Roma/Bob host protocol; do not introduce
a new shared service, route, package, or generic event bus.

The flow is:

```text
Bob phase changes
    → bob:save-control-state
    → Roma renders the matching header control

User clicks Roma's Save button
    → host:save-request
    → Bob invokes its existing save()
    → existing bob:account-command(save-instance)
    → existing Roma route/result
    → Bob resolves exact draft truth and emits the next phase
```

Implementation law:

1. Bob is the sole producer of `hidden | save | saving | saved`.
2. Bob emits the current phase after every accepted editor open and every phase
   transition.
3. Roma resets the borrowed slot to `hidden` when the iframe reloads, the active
   target changes, or Bob is not ready; stale Save chrome may not cross sessions.
4. Roma renders the borrowed control after its existing publication actions at
   the far right of `page__actions`.
5. Roma sends `host:save-request` only from the visible `save` phase. Bob checks
   current dirty/saving truth again and ignores an inapplicable duplicate request.
6. Bob immediately emits `saving`, runs the existing Save command, and then emits
   `saved`, `save`, or `hidden` according to E2. Save failures continue to use
   Bob's existing visible error surface.
7. The existing `bob:dirty-state-changed` message remains separate and continues
   to gate Roma publication. Save presentation is not used as publication truth.
8. Both directions retain the current exact iframe source/origin checks. No
   wildcard host command is accepted after the host origin is known.
9. The existing `bob:account-command` and `host:account-command-result` remain the
   only Save request/result path. Do not add another Save response handshake.
10. Remove `TopDrawer` from `BuilderApp` and delete its header-only CSS and dead
    context/action wrappers. Bob's editor content expands into the released
    vertical space.
11. Current source still exposes `open-navigation` and `open-tools` inside
    `TopDrawer` on compact landscape, even though desktop shows only Save. Do not
    silently delete those reachable actions:
    - Roma continues to own host navigation; remove Bob's host-navigation action
      only when the existing Roma shell control covers that compact surface.
    - move Bob's compact-only ToolDrawer opener into `editor-content` as the same
      Dieter quaternary icon control; keep it hidden where ToolDrawer is already
      persistent.
    - do not recreate a Bob header to hold either control.

This is one visual header with a narrowly hosted Bob action, not a transfer of
Save authority to Roma.

### E3 — Widgets starts independent reads together and holds its table shape

`GET /api/account/widgets` currently waits for instance facts before starting the
independent Widget-definition read, even though both use the same already-resolved
account coordinate and capsule.

Implementation law:

1. Start `loadAccountWidgetInstanceFacts` and `listTokyoWidgetDefinitions`
   together with `Promise.all` after the current-account context succeeds.
2. Preserve the current deterministic result priority: if the instance-facts
   result is an error, return it first; otherwise return the definitions error;
   otherwise compose the exact current response.
3. Preserve all route status, reason-key, cookie, catalog, and instance mapping
   behavior.
4. Add no cache, timeout, probe, fallback, or alternate read path.
5. On the first empty load, render the existing Widgets table headers and one
   accessible status row saying `Loading widgets...`, rather than a separate
   canvas paragraph that changes the page's shape when data arrives.
6. Retry, empty state, filters, publication controls, and shared widgets cache
   behavior remain unchanged.

### E4 — Widget Defaults preserves compiled panel context

`buildPanelHtml` correctly filters each compiled panel down to the selected
controls, but then joins only the filtered inner HTML. That discards
`CompiledPanel.label`, causing unrelated groups such as Appearance, Typography,
and Settings to lose their context.

Implementation law:

1. Keep the exact `CompiledWidget.panels` order.
2. Keep `filterPanelHtml` as the product projection that removes controls not in
   the current defaults scope.
3. For every non-empty projected panel, compose a wrapper containing the exact
   trusted `panel.label` and its filtered HTML.
4. Set the label through DOM `textContent` and reuse existing Bob/Dieter group
   typography and spacing. Do not interpolate an alternate label, infer one from
   the panel ID, or add another labels map.
5. Keep existing control hydration, `showIf`, raw user-event admission, font
   library behavior, save route, and compiled-artifact trust unchanged.
6. A panel with no selected controls remains absent; a present panel can no longer
   lose its own label.

### E5 — Copilot visible narration follows the actual result

The current internal protocol is sound: a tool batch is buffered until its model
step completes, Bob applies the batch atomically, terminal SSE behavior is
enforced, and failures are visible. The residual product defect is local to the
visible transcript: model text streams before a proposed edit has been applied,
so wording such as “Done” can appear complete before the tool result and can
remain contradictory if the turn later fails.

Implementation law:

1. Keep streaming assistant text. Do not hold the entire response until EOF.
2. Extend Bob's visible `CopilotMessage` presentation state so the active
   assistant message is explicitly pending while the turn is unresolved.
3. A text-only turn becomes complete only on the existing successful terminal
   event.
4. A turn containing a Widget edit remains pending until Bob's existing
   `applyOps` accepts the complete tool batch.
5. After a successful apply, mark the visible message as applied and retain the
   existing changed-path/Undo affordance.
6. On request error, terminal stream error, rejected tool batch, or local apply
   failure, mark that same assistant message as failed/not applied and present the
   existing visible error. Earlier model wording must not retain an unqualified
   completed/applied presentation.
7. Stop preserves edits already applied before cancellation and marks any still
   unresolved assistant message as stopped/not applied. It does not roll back.
8. Structured model history remains unchanged. Presentation state does not enter
   the next model request.
9. Keep the one-tool contract, step buffering, terminal-event guarantee, grant,
   governed model execution, undo race guard, and 120-second transport timeout.
10. Add no SSE event, response handshake, Worker retry, model retry, or Roma
    orchestration.

The exact passive status words are `Working`, `Applied`, `Not applied`, and
`Stopped`. They describe Bob's known result; they do not reinterpret model text.

## 7. Complete finding ledger

This ledger is the crosswalk from all six audit documents and the current product
owner ruling to execution. It is intentionally wider than the six code changes.
Every reported finding is
retained even when the correct decision is to keep, close, exclude, or reject it.

Source codes:

- **M** — PRD 130 master audit
- **A** — Copilot appendix
- **CL** — Claude product walk
- **CX** — Codex independent audit
- **CU** — Cursor service and route walk
- **K** — Kimi remediation re-audit
- **PO** — current human product-owner ruling

### 7.1 Consequential-command findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| D1 | Widget Delete executes on the first click | M, CX, K | Current and reachable in `WidgetsDomain`; removes the saved source anchor and public reachability | **Execute E1** |
| D2 | Asset Delete executes on the first click | M, CX, K | Current and reachable in `AssetsDomain`; removes an account asset that Widgets may reference | **Execute E1** |
| D3 | Unpublish executes on the first click | M, CX, K | Current and reachable in `WidgetPublicationControls`; takes the public Widget offline while preserving source | **Execute E1** |
| D4 | Team-member removal executes on the first click | M, CX, K | Current and reachable in `TeamMemberDomain`; removes account access | **Execute E1** |
| D5 | Ownership transfer executes on the first click | M, CX, K | Current and reachable in `SettingsDomain`; target becomes Owner and current Owner becomes Admin | **Execute E1** |
| D6 | Unsaved-navigation confirmation receives more protection than persisted destructive work | M, K | Current product inconsistency, proven by D1–D5 and the existing unsaved-changes popup | **Resolved by E1**, without changing the unsaved guard |

### 7.2 Save and editor-state findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| S1 | Successful Save has no positive completion state | M, CX, K | Current: successful Save clears dirty state and the button disappears | **Execute E2** with `Save → spinner → green ✓ Saved → disappear` |
| S2 | First Save is also creation but has no distinct completion receipt | CX, K | Current and reachable; the same command adopts the new ID/base locale | **Execute E2** through the same button state; no second protocol |
| S3 | A rejected control edit silently reverts the field | M, K | Current code keeps the exact draft and publishes a visible Bob session error; tier denial opens the upsell surface | **Keep current behavior**; no silent current failure was proved and no inline system is added |
| S4 | `showIf` makes controls appear or disappear based on hidden state | M, K | Current and intentional Widget-authored presentation from the structured contract | **Keep**; removing it would break Widget meaning |
| S5 | Save has an infinite spinner | M, A, K | Stale as a general claim: Bob Save uses the existing 120-second account-command transport boundary | **No new timeout** |
| S6 | `Loading preview...` can spin forever | M, K | No current broken Widget or reachable hang was observed; existing Widgets reached preview | **Not proven**; do not add a generic watchdog |
| S7 | Session loss mid-edit needs recovery machinery | M | Latent/theoretical in this audit; Bob already owns browser-memory draft and `beforeunload` warning | **Not proven**; no autosave or recovery service |
| S8 | Builder briefly says `No instance selected` during normal open | CL, CX | Earlier-baseline claim; absent on the current implementation and did not reproduce live | **Already corrected** |
| S9 | Existing Builder controls become usable seconds before preview | CL, K | Observed once by Claude; not reproduced by the later independent current-baseline walk, where control and preview readiness were close | **Conflicting evidence; no execution** until a current reproducible trace exists |
| S10 | Bob renders a second Builder header whose ordinary desktop purpose is now only Save | PO | Current: Roma already owns identity/publication header while Bob `TopDrawer` consumes a second vertical bar | **Execute E6:** delete Bob's header and host Save in Roma's reserved action slot |
| S11 | Removing `TopDrawer` could silently remove compact navigation/tools controls | PO, current source | Current but compact-only: CSS hides them on desktop and reveals them below the compact breakpoint | **Execute E6 boundary:** Roma retains navigation ownership; rehome only Bob's compact ToolDrawer opener without recreating a header |

### 7.3 Roma shell, Widgets, and dialog findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| R1 | Roma replaces the entire shell/navigation with `Loading page` | CU, K | Incorrect current description: the shell/nav remain; only the requested domain content is gated by account bootstrap | **No action** |
| R2 | Widgets serializes two independent Tokyo reads | CX | Current code starts definitions only after instance facts resolve | **Execute E3** with one `Promise.all` and unchanged result priority |
| R3 | Widgets shows only loose `Loading widgets...` text before the table | CL, CX, CU | Current and observed; page shape changes when data arrives | **Execute E3** with the existing table shell and loading row |
| R4 | One Widget mutation disables actions across all inventory rows | M, CX, K | Current; existing Save/Rename/Publish/Unpublish/Delete are serialized by the per-account coordinator | **Keep** the conservative account-wide busy state |
| R5 | Closed Roma/Dieter dialogs intercept nav, Edit, or publication controls | CU, K | Did not reproduce in independent hit testing; current closed dialogs compute hidden, zero-size, and non-hit-testable | **Not a current finding** |
| R6 | Dialogs and unavailable Copy-code feedback are pre-mounted before request | CU | Markup exists, but no visible or hit-testing product cost was reproduced; unavailable feedback appears when the user asks | **Keep unless a current cost is proved** |
| R7 | Published toggle graphic intercepts the real switch | CU, CL | Cursor reported intermittent behavior; Claude's DOM inspection and live clicks did not reproduce it | **Conflicting/unproven; no change** |
| R8 | Assets `Refresh list` is redundant | CL, CU, K | The audits did not execute upload and prove automatic post-write freshness | **Not proven; keep** |
| R9 | Account-language `Refresh` is redundant | CU, K | The audits did not prove that Save and external changes make the explicit reread useless | **Not proven; keep** |
| R10 | A `beforeunload` warning proves navigation trouble | CL | Appeared only under raw `page.goto`; did not recur through the real click journey | **Test artifact; no product action** |

### 7.4 Publication, lifecycle, cache, and serving findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| P1 | Publish/Republish/Unpublish are mixed into Bob | M, K | Corrected by PRD 129; Bob is Save-only and Roma owns publication | **Already corrected** |
| P2 | The editor has no Roma-owned publication action/status at the point of editing | M, CL, K | Corrected; current Builder header carries the Roma publication state and actions | **Already corrected; keep** |
| P3 | Hiding Republish removes retry and makes visibility a completion protocol | M | Corrected by the settled Roma control/state design; button and publication fact have separate meanings | **Already corrected** |
| P4 | Purge failure changes Publish/Unpublish/Delete product responses | M, K | Corrected: cache eviction is scheduled after commit and is product-inert | **Already corrected** |
| P5 | Failed eviction permits a long stale public package | M, K | Corrected by best-effort tag eviction plus `must-revalidate`; cache is not product truth | **Already corrected** |
| P6 | Catalog Create persists an instance even if Bob is exited without Save | M, K | Corrected by New-in-memory and first-Save creation | **Already corrected; Catalog remains excluded** |
| P7 | First Save reopens Bob or loses new identity/base locale | M | Corrected by in-place adoption of the command result | **Already corrected** |
| P8 | Builder publication header violates the Roma/Dieter page-header grammar | PRD 131 follow-up | Corrected by PRD 131 and the current header implementation | **Already corrected** |
| P9 | Unpublished public Widget returns 404 and locale overlay can be partial in place | CL, CU | Current intentional serving truth; no identity or locale fallback occurred | **Keep** |
| P10 | Copy-code is unavailable for unpublished Widgets | CU, CX | Correct current publication policy; visible only when requested | **Keep** |

### 7.5 Widget Defaults and trusted-boundary findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| W1 | Widget Defaults shows duplicate low-level labels without panel context | CL, CX, K | Current and visually observed; `buildPanelHtml` discards exact `CompiledPanel.label` | **Execute E4** |
| T1 | Roma reparses Berlin/Tokyo owner results | M, CX | Bounded B1 cleanup already implemented; Roma consumes exact internal result types | **Already corrected** |
| T2 | Widget Defaults revalidates or repairs compiled/persisted internal artifacts | M, CX | B2 cleanup implemented; browser PUT admission remains correctly at external ingress | **Already corrected; keep ingress admission** |
| T3 | Tokyo repeats Roma's active-account asset policy | M, CX | B3 corrected: Roma owns account-status policy; Tokyo keeps capsule/file/byte admission | **Already corrected** |
| T4 | Product Copilot, San Francisco, Roma, and Bob re-prove trusted internal semantics | M, CX | B4 corrected while external request, grant, transport, and tool boundaries remain | **Already corrected** |
| T5 | Prague performs downstream availability/reference probes | M, CX | B5 audit finding belongs to Prague | **Explicitly excluded from this pass** |

### 7.6 Product Copilot findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| C1 | Model narration streams before Bob applies a requested edit | M, A, K | Current and concretely reachable when narration asserts completion before `applyOps` result | **Execute E5** |
| C2 | A stream can end without terminal truth and silently drop the buffered edit | A, K | Corrected by the current terminal-event enforcement and visible request-failure path | **Already corrected** |
| C3 | Copilot Send did not invoke the Bob session transport | CX | Corrected and independently live-verified with a real streamed turn | **Already corrected** |
| C4 | Undo rejection is not added to model conversation history | A | The user sees the rejection; the next request carries the exact current draft capsule, so the model does not operate on stale Widget state | **Keep Bob-owned Undo; no continuation protocol** |
| C5 | Copilot Send has no timeout | M, A, K | Stale: the Bob transport has a 120-second boundary and San Francisco has its governed execution budget | **No new timeout** |
| C6 | `maxRetries: 0` should become a zero-byte provider retry | A | No observed need; retry can duplicate governed model work or usage without an exactly-once result | **Keep zero retries** |
| C7 | Disabled Send reason can scroll away from the control | A | Stale in the current pane: the reason is the composer input placeholder beside disabled Send | **No action** |
| C8 | Exact model-step/tool matching is defensive weight | A | Required for the one-tool atomic-apply contract; malformed/mismatched work fails visibly | **Keep** |
| C9 | Stop should roll back already-applied edits | A | Current product law says Stop ends future work; already-applied edits remain and may be undone explicitly | **Keep** |
| C10 | Grant expiry and provider failures are normalized into visible errors | A | Current off-path visible failure, not a silent substitution or partial success | **Keep current error boundary** |

### 7.7 Account, first-run, and incomplete-product findings

| ID | Finding | Source | Current evidence and classification | Decision |
| --- | --- | --- | --- | --- |
| A1 | Home is empty and has no next action | M, CL, K | Current and visually observed | **Architect-closed:** Home remains intentionally blank |
| A2 | Billing, broader Usage, and AI are stub destinations | M, CL, K | Current but honest: each surface states what is and is not connected | **Architect-closed/keep** |
| A3 | Upgrade CTA does not perform billing | M, K | Current intentional scaffold until billing exists | **Architect-closed/keep** |
| A4 | Public embed renders literal `Not found` | M, K | Current visible failure with no fallback | **Architect-closed/keep** |
| A5 | Public embed can remain stale for 24 hours after failed purge | M, K | Earlier baseline; corrected by PRD 129 cache law and current cache headers | **Already corrected** |
| A6 | Partial translated overlay should fall back to another locale | CL, CU | Current serving preserves exact selected-locale/base composition and does not substitute identity | **Keep; no fallback** |

### 7.8 Explicitly excluded findings

| ID | Finding | Source | Decision |
| --- | --- | --- | --- |
| X1 | Prague signed-in Create intent lands on Home | CU, K | **Excluded:** no Prague work in this pass |
| X2 | Prague directory cards or embedded previews swallow clicks | CU, K | **Excluded:** no Prague work in this pass |
| X3 | Catalog/New Builder button wording or journey needs revision | K | **Excluded:** Catalog/New Builder is not worked in this pass |
| X4 | Any Prague Pages deployment or verification | CX | **Excluded:** this pass deploys only changed Roma/Bob surfaces |

### 7.9 Audit items that remain unmarked, not findings

The source walks deliberately did not mutate or fully exercise every product
command. The following are coverage gaps, not evidence of defects and not
automatic execution scope:

- real destructive command completion and failure in shared cloud-dev data;
- uploads and bulk uploads;
- Profile, locale, Widget Defaults, team-member, and ownership writes;
- Translation Agent generation and partial failure;
- deliberate service hangs, outages, and multi-tab concurrency;
- DevStudio and operator-only surfaces; and
- Product Copilot charging/provider failure beyond the tested successful turn.

Slices 8–10 verify only the behavior actually changed by E1–E6. They do not turn
these unmarked areas into a second audit program.

## 8. Execution slices

Each slice must finish its focused checks before the next slice starts. No
half-converted UI state is pushed to `main`.

### Slice 0 — Baseline and behavior fixtures

1. Confirm the branch/worktree and preserve unrelated edits.
2. Record current focused test results for Roma and Bob.
3. Add or extend behavior-level fixtures for click-confirmation semantics, Save
   control bridge/button transitions, single-header geometry, Widget route
   concurrency/result priority, panel-label projection, and Copilot
   visible-message lifecycle.
4. Do not make source-text grep the only proof for interactive behavior.

**Exit gate:** the fixtures represent the existing authority boundaries and fail
only for the intended missing behavior.

### Slice 1 — Shared Roma confirmation mechanics

1. Add `RomaCommandConfirmationDialog` under Roma components.
2. Reuse the existing Roma/Dieter popup and button presentation.
3. Implement conditional mounting, visible title/body, Cancel, Confirm, and the
   current standard backdrop close behavior.
4. Add no keyboard, Escape, focus-trap, or focus-return behavior or test scope.
5. Prove that open/cancel never invokes the supplied command and explicit Confirm
   invokes it once.

**Exit gate:** the shared consumer has no product-command knowledge and no command
can run before confirmation.

### Slice 2 — Wire the five Roma commands

1. Widgets: route Delete through the confirmation, preserving row/list busy and
   existing cache updates.
2. Assets: route Delete through the confirmation, preserving upload/list/delete
   policy and result handling.
3. Publication: confirm only Unpublish, leaving Publish/Republish untouched.
4. Team member: confirm Remove.
5. Settings: confirm ownership transfer and preserve the existing successful
   redirect/session behavior.
6. Test each command's exact subject, body, and confirm label.
7. Test that Cancel leaves remote and local state unchanged.
8. Test that post-confirm failures remain visible in the existing owner surface.

**Exit gate:** all five commands require one decision, execute exactly once after
Confirm, and otherwise retain their old route/result semantics.

### Slice 3 — One Roma header and Bob's borrowed Save control

1. Add the generic `data-state="success"` presentation to Dieter Button using
   existing green/white tokens, document it in `button.spec.json`, and keep it
   orthogonal to the existing hierarchy `data-type`.
2. Add the typed `bob:save-control-state` and `host:save-request` messages to the
   existing Bob/Roma host-message unions. Preserve current iframe source/origin
   checks in both directions.
3. Express Bob's one Save control as `hidden | save | saving | saved`, derived
   from existing draft/signature/command truth, and emit it after editor open and
   each transition.
4. Add the reserved Save slot at the far right of Roma Builder
   `page__actions`, after publication actions. Reset it to hidden on iframe load,
   target change, or Bob-not-ready state.
5. Render `Save` for dirty idle state. Its click sends `host:save-request`; Bob
   rechecks current truth and invokes its existing `save()`.
6. Render the spinner inside the same Roma button when Bob emits `saving`.
7. On a successful clean result, render the same button green with the Dieter
   checkmark plus `Saved` for 1,000 milliseconds, then have Bob emit `hidden`.
8. If newer edits exist when the Save result arrives, have Bob emit `save`
   directly; never show green success for the current dirty draft.
9. On failure, preserve the existing visible Bob error and emit `save` only
   when the current draft is dirty; emit `hidden` when it matches saved truth.
10. Cancel the result timer on a new edit, a new Save, editor open, and unmount.
11. Keep `bob:dirty-state-changed` separate as Roma's publication gate. Do not
    derive publication truth from Save presentation.
12. Keep the existing `bob:account-command(save-instance)` and
    `host:account-command-result` as the only persistence request/result path.
13. Remove `TopDrawer` from `BuilderApp`, delete its header-only markup/CSS, and
    let `editor-content` occupy the released vertical space.
14. Remove Bob's compact host-navigation action only after confirming Roma's own
    shell/navigation control covers that surface. Move the compact-only
    ToolDrawer opener into `editor-content` with the same existing Dieter control;
    keep it hidden where ToolDrawer is persistent.
15. Cover the Dieter state, message origin/source admission, initial clean/dirty
    open, duplicate click, existing Save, first Save, failure, edit-during-save,
    edit-during-saved, timer completion, target change, iframe reload, compact
    ToolDrawer access, and absence of a second header.

**Exit gate:** Roma renders the only Builder header; Bob still exclusively owns
Save truth and execution; the one borrowed button communicates the exact command
lifecycle; and removing `TopDrawer` drops no reachable editor action.

### Slice 4 — Widgets cold-path correction

1. Start the two Tokyo reads concurrently in the Widgets route.
2. Preserve current result priority and exact response shapes.
3. Replace the loose initial loading paragraph with the existing table shell and
   one accessible loading row.
4. Verify empty, success, first-error, second-error, cached revisit, and explicit
   Retry behavior.

**Exit gate:** the route has one parallel join, no new cache/probe, and the page
does not change from a text module into a table after the wait.

### Slice 5 — Widget Defaults panel context

1. Compose each non-empty projected panel with its exact trusted label.
2. Reuse existing group typography and spacing.
3. Retain control order, filtering, hydration, value handling, `showIf`, and save
   behavior.
4. Verify multiple panels with repeated cluster labels remain distinguishable.
5. Verify a panel without applicable controls remains absent.

**Exit gate:** exact compiled context is visible without a duplicate label map or
semantic revalidation.

### Slice 6 — Copilot result-aware visible transcript

1. Add the minimal presentation status to visible assistant messages.
2. Move that status through pending, complete/applied, failed, and stopped using
   existing turn and apply results.
3. Keep structured model history free of presentation metadata.
4. Preserve streaming text, Stop, atomic tool apply, changed-path display, and
   Undo.
5. Add behavior tests that drive the transport and prove:
   - text streams while the message remains pending;
   - text-only terminal success completes it;
   - tool narration remains pending until `applyOps` succeeds;
   - apply rejection becomes `Not applied` with visible error;
   - stream error cannot leave an unqualified completed message; and
   - Stop marks unresolved work stopped without rolling back already-applied edits.

**Exit gate:** visible narration cannot masquerade as an applied result, and the
wire contract is unchanged.

### Slice 7 — Documentation reconciliation

1. Update the owning Roma, Bob, account, Dieter component, UI-interaction,
   and Product Copilot manuals only where behavior changed.
2. Preserve PRD 129 and PRD 131 law.
3. Update this PRD's status from local implementation through deployed/verified
   states only when each is true.
4. Keep the evidence bundle unchanged except for factual link corrections caused
   by its move.
5. Record any remaining known mismatch explicitly; do not present planned behavior
   as current product truth.

**Exit gate:** canonical docs describe shipped code; this PRD describes execution
and historical evidence remains historical.

### Slice 8 — Local verification and independent V1–V8 audit

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
git diff --check
```

Add focused behavior commands to the appropriate package scripts when the
existing suites cannot exercise the new behavior. Broaden checks only if the
actual diff crosses another package authority.

An independent agent performs the post-implementation V1–V8 audit when
available, as required by `AGENTS.md`.

**Exit gate:** all focused checks pass, no stale source-only assertion masquerades
as the sole behavioral test, and V1–V8 has no unresolved violation.

### Slice 9 — Commit, push, and deployment

1. Recheck the complete worktree and include every intended edited file without
   overwriting unrelated concurrent work.
2. Commit the cohesive implementation and documentation result.
3. Push `main` only when authorized for the execution turn.
4. Observe the Roma and Bob Cloudflare Pages deployments caused by that push.
5. Do not invoke or troubleshoot Prague deployment; this pass contains no Prague
   change.
6. Do not perform remote product-data mutation; none is required.

**Exit gate:** pushed commit, deployment identifiers, and deployed source revision
are recorded. A green local build is not reported as deployment proof.

### Slice 10 — Cloud-dev and owner QA

Verify through the owning surfaces:

1. each of the five dialogs opens from its real control, cancels by button and the
   standard backdrop behavior, and invokes no command before Confirm;
2. each Confirm invokes the exact command and preserves visible failure behavior;
3. the Builder renders one Roma header and no Bob header; the borrowed Save
   control occupies the far-right Roma action slot only when Bob requests it;
4. Bob Save runs `Save → spinner → green ✓ Saved → disappear`, returns directly
   to `Save` when newer edits exist, resets across iframe/target changes, and
   works after first Save without reopening Bob;
5. compact landscape retains Bob ToolDrawer access without recreating a header,
   and Roma still owns host navigation;
6. cold Widgets retains the table frame and the route latency reflects concurrent
   upstream reads;
7. Widget Defaults visibly distinguishes multiple compiled panels;
8. a real Product Copilot text-only turn, editing turn, Stop, and controlled
   failure show truthful message status; and
9. narrow-viewport behavior remains usable.

Use only safe cloud-dev account data. Restore any team-member, publication,
asset, or Widget state intentionally changed for QA. Never automate or mutate a
real Google identity.

**Exit gate:** owner-visible cloud-dev evidence is recorded separately from local
test evidence. Any unperformed destructive scenario is named as pending rather
than inferred.

## 9. Test matrix

| Surface | Required positive proof | Required negative/failure proof |
| --- | --- | --- |
| Shared confirmation | Confirm calls once after the visible click decision | Open, Cancel, and backdrop call zero times |
| Five Roma commands | Exact command runs after Confirm | Existing route error remains visible and does not report success |
| Roma/Bob header bridge | One Roma header; Bob phase renders the far-right borrowed slot; click invokes Bob's existing Save | Wrong origin/source is ignored; reload/target change hides stale state; no second Save/result route |
| Bob Save | `Save → spinner → green ✓ Saved → disappear`; first Save adopts and follows the same sequence | Failure preserves the error and derives Save/hidden from current dirty truth; newer edits never receive a false Saved state; timer is cancelled on edit/open/unmount |
| Bob header removal | Editor content gains the released space; compact ToolDrawer opener remains reachable | No Bob header, dead header CSS, silent loss of tools, or Bob-owned host navigation remains |
| Widgets route | Both reads start before either completes; exact success response | Instance error wins deterministically; definitions error follows when instances succeed |
| Widgets loading | Stable table with accessible status | Error and empty states do not masquerade as loading |
| Widget Defaults | Exact panel labels and control order appear | Empty panels remain absent; no inferred/fallback labels |
| Copilot transcript | Text-only completion and applied edit reach exact visible status | Apply error, stream error, and Stop cannot leave unresolved work looking applied |

## 10. Product-data and compatibility statement

- No database schema changes.
- No Tokyo storage changes.
- No account data migration.
- No compatibility reader or fallback.
- No remote data mutation is required to ship.
- QA mutations are ordinary reversible product commands and must be restored.

## 11. V1–V8 completion gate

| ID | Required result |
| --- | --- |
| V1 Silent substitution | No invented confirmation subject, panel label, Save result, or Copilot result replaces exact truth |
| V2 Silent healing | No persisted/user state is normalized or repaired while being read |
| V3 Silent omission | No command, control, panel, event, failure result, or reachable compact ToolDrawer action is silently dropped |
| V4 Fail-open control | Missing authorization or command dependencies still fail through their existing owners; host Save messages retain exact iframe source/origin admission |
| V5 Corruption-as-absence | No stored-state interpretation changes in this pass |
| V6 Partial-success masquerade | Save button and Copilot statuses describe only known completed results; confirmations do not claim command success |
| V7 Masquerade/redress | A failing command is not rerouted through a renamed retry or wrapper |
| V8 Runtime test dependency | Product work does not depend on tests, probes, or verification rituals |

## 12. Completion criteria

This PRD is complete only when all of the following are true:

- E1–E6 are implemented within their named authorities;
- focused and behavior-level tests pass;
- canonical documentation matches the implementation;
- the intended complete worktree is committed and pushed under explicit
  execution authority;
- Roma and Bob deployed revisions are recorded;
- cloud-dev owner QA is completed or each unperformed check is explicitly pending;
- product-data state is reported accurately; and
- the independent V1–V8 audit passes with no unresolved blocker.

## 13. Local execution reconciliation

As of 2026-08-19, Slices 0–8 are complete locally:

- Roma composes one shared product-neutral confirmation and uses it for Widget
  Delete, Asset Delete, Unpublish in both Roma consumers, Remove member, and
  Transfer ownership. Publish/Republish remain immediate and invitation code or
  copy did not enter the pass.
- Roma renders the one Builder header. Bob's former `TopDrawer` and host
  navigation message are removed; compact Roma navigation stays in Roma and
  compact ToolDrawer access stays over Bob's editor work area.
- Bob owns `hidden | save | saving | saved`, exact host admission, the existing
  Save command, the one-second clean receipt, first-Save in-place adoption, and
  edit/failure transitions. Dieter supplies the generic success presentation.
- the Widgets route starts its two independent owner reads together while
  preserving instance-first error priority; Your widgets retains its semantic
  Table and five headers with one accessible first-load row.
- Widget Defaults renders each non-empty projection under the exact trusted
  compiled panel label assigned as DOM text.
- Bob's visible Copilot messages show only `Working`, `Applied`, `Not applied`,
  or `Stopped` from exact request/apply truth; model history and wire contracts
  are unchanged.
- the owning canonical manuals are reconciled to that local implementation.

Focused Roma/Bob/Dieter typechecks, Roma/Bob lints, all new behavior fixtures,
the existing focused regression suites listed in Slice 8, Roma `build:cf`, Bob
`build:cf`, and `git diff --check` pass. Bob lint still reports the same three
pre-existing `CopilotPane` exhaustive-dependency warnings and exits `0`.

No commit, push, Pages deployment, remote product-data mutation, or cloud-dev
owner QA is claimed yet. Those remain Slices 9–10.

The independent complete-diff audit found and closed two reachable Save-phase
defects: edits during an active Save now keep the `saving` phase until the
request terminates, and a failed request now exposes `Save` only when the current
draft remains dirty. The corrected code, behavior tests, canonical docs, and
production builds were re-audited. V1–V8 pass with no unresolved blocker.

Until Slices 9–10 finish, the honest state is: **implemented, green, and
independently audited locally; not yet shipped or owner-verified**.
