# PRD 130B — Defensive Construction Remediation

**Status:** EXECUTION READY — evidence reconciled; implementation not started

**Date:** 2026-08-19

**Owner:** Human product owner / architect

**Execution owners:** Roma, Bob, and their existing tests and deployment surfaces

## 1. Outcome

This pass removes the small set of current product costs proven by the PRD 130
audit without reopening settled architecture or converting every defensive
mechanism into work.

When this PRD is complete:

1. six current Roma commands that can remove access, content, or public state
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
   terminal result; and
6. canonical documentation, local verification, deployment evidence, and
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

The plan deliberately does not turn theoretical risk into machinery.

## 4. Explicit scope

### 4.1 In scope

| ID | Surface | Current cost | Classification |
| --- | --- | --- | --- |
| E1 | Roma destructive commands | Six consequential actions execute on the first ordinary click | Current and reachable |
| E2 | Bob Save | Successful Save removes its action but leaves no positive completion receipt | Current and observed |
| E3 | Roma Widgets initial load | Two independent Tokyo reads run serially; the wait is rendered as a loose text module | Current and observed |
| E4 | Roma Widget Defaults | Projection keeps control HTML but drops each trusted compiled panel label | Current and observed |
| E5 | Bob Product Copilot transcript | Streamed narration can visually assert completion before a requested edit is applied; a later error can leave contradictory text | Latent but concretely reachable |

### 4.2 Explicit exclusions

The following remain outside this pass even when an audit mentions them:

- all Prague code, routes, Pages deployment, signed-in intent, and public-page
  behavior;
- the Bob Catalog/New Builder surface, its copy, and its creation journey;
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
| Product surface | Roma account domains and Bob browser-memory editor | Correct the consumer that owns the visible decision or receipt |
| Account/session | Existing Roma current-account context; existing Bob session | No new identity, permission, or session coordinate |
| Storage | Existing Tokyo instance/asset storage and Michael account/member truth | No storage shape or data migration |
| Route/API | Existing Roma command routes and Bob's existing `save-instance` / Copilot transport | Do not add a route or wire event |
| Design system | Dieter popup mechanics, buttons, icons, table, tokens, and motion | Reuse mechanics; Roma and Bob retain product meaning and copy |
| Runtime/deploy | Roma and Bob Cloudflare Pages deployments from `main` | No Prague deployment and no unrelated Worker deployment |
| Verification | Focused local suites, cloud-dev Roma/Builder surfaces, owner QA | Local checks are not deployed-product proof |

### 5.1 Settled division of labor

- Bob owns exactly one account-bound editor command: Save.
- Roma owns Publish, Republish, Unpublish, Delete, assets, team, invites, and
  account settings commands.
- Dieter owns popup, table, icon, button, and motion mechanics; it does
  not own the meaning of a destructive command.
- Tokyo and Michael continue to own their stored facts. No downstream validator
  or secondary policy check is added.
- Product Copilot proposes edits; Bob remains the authority that applies them to
  the browser-memory draft.

## 6. Executable product decisions

### E1 — One decision before six consequential Roma commands

The six commands are:

| Command | Existing owner | Confirmation meaning |
| --- | --- | --- |
| Delete saved Widget | `WidgetsDomain` | Deletes saved source and makes any published version unavailable; cannot be undone |
| Delete asset | `AssetsDomain` | Removes the asset; Widgets using it may stop displaying it; cannot be undone |
| Unpublish Widget | `WidgetPublicationControls` | Takes the public Widget offline while preserving saved source for later Publish |
| Remove team member | `TeamMemberDomain` | Removes the member's account access; they may be invited again later |
| Revoke pending invite | `TeamDomain` | Makes the pending invite unusable; a new invite may be created later |
| Transfer ownership | `SettingsDomain` | Makes the selected member Owner and the current Owner Admin |

Implementation law:

1. Add one Roma consumer component, `RomaCommandConfirmationDialog`, because the
   same decision mechanics are required by six current Roma-owned commands.
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
| Revoke invite | `Revoke this invitation?` | `Revoke invite` | Name the invite recipient and that the link stops working |
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
2. Dirty and idle renders the ordinary `Save` button.
3. Clicking Save renders the spinner inside that same button while the existing
   account command is in flight.
4. A successful Save renders the same button green with the Dieter checkmark and
   the word `Saved` only when the current draft signature still equals the
   submitted/saved signature.
5. After 1,000 milliseconds, that green result button disappears if the draft is
   still clean.
6. If the user makes a newer edit while Save is in flight, the returned result
   saved only the submitted snapshot. The current draft remains dirty and the
   control returns directly to `Save`; it must not claim the newer draft is saved.
7. A failed Save returns to `Save` and retains the existing visible error. It
   never enters the green `Saved` state.
8. A new accepted edit, a new Save, or a new `ck:open-editor` cancels any pending
   disappearance timer and derives the next button state from current draft truth.
9. First Save adoption of `instanceId` and `baseLocale` remains in place and uses
   this same button sequence without a second Bob open.
10. Add no Roma message, Bob protocol event, publication action, or persistence
    outside the existing Save command.

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

## 7. Complete disposition of audit claims

### 7.1 Execute in this PRD

| Audit claim | Disposition |
| --- | --- |
| Confirmation budget is inversely related to harm | E1: confirm the six proven consequential Roma commands |
| Save success is silent | E2: add deterministic passive Save receipt |
| Widgets cold load serializes independent reads | E3: concurrent route reads |
| Widgets loading is loose text and feels stalled | E3: stable table-shaped loading state |
| Widget Defaults duplicates low-level labels without panel context | E4: preserve exact compiled panel labels |
| Copilot narration can visually precede actual apply truth | E5: pending/applied/failed/stopped presentation state in Bob |

### 7.2 Already corrected; do not rebuild

| Audit claim | Current disposition |
| --- | --- |
| Publish/Republish/Unpublish were mixed into Bob | Corrected by PRD 129; publication is Roma-owned and Bob is Save-only |
| Publication button visibility carried completion/retry meaning | Corrected by the Roma publication surfaces and exact publication facts |
| Cache purge failure changed product command results | Corrected: eviction is best-effort background work outside product truth |
| Catalog Create persisted an abandoned instance | Corrected by New-in-memory and first-Save creation; Catalog remains excluded here |
| First Save reopened Bob or lost adopted identity | Corrected by in-place ID/base-locale adoption |
| Builder header violated Roma/Dieter grammar | Corrected by PRD 131 |
| Bob Copilot Send did not invoke the session transport | Corrected and locally/live verified in the earlier remediation |
| Builder showed `No instance selected` during ordinary boot | Not present on the current baseline |
| Roma account shell disappears behind full-page loading | False on current code; only the owned page content is gated |
| Closed dialogs intercept navigation or controls | Not present in current live computed state; closed dialogs are hidden and non-hit-testable |
| Preview trails controls by several seconds | Did not reproduce on the current baseline; preview already starts with the open flow |
| Copilot stream can end without terminal truth | Corrected by the current terminal-event enforcement |
| Asset account-status policy is repeated in Tokyo | Corrected: Roma owns active-account upload policy; Tokyo keeps external file and authorization admission |
| Internal trusted results are broadly reparsed/revalidated | The bounded B1–B4 corrections are already implemented; B5 Prague is excluded |

### 7.3 Keep as intentional current behavior

| Mechanism or claim | Why it remains |
| --- | --- |
| Roma Widgets list-wide existing-instance busy state | Existing Save/Rename/Publish/Unpublish/Delete share the account coordinator; the UI conservatively prevents conflicting list commands |
| Bob `showIf` hides inapplicable controls | It is Widget-authored product presentation, not defensive omission |
| Failed Bob control operations retain exact draft truth | Current errors are visible; tier denial uses the upsell surface; no silent healing occurs |
| Widgets `Retry`, Assets `Refresh list`, and language `Refresh` | These are explicit recovery/read commands with current documented meaning; redundancy was not proven |
| Existing route and transport timeouts | Same-origin account routes and Bob Save/Copilot already have bounded transports; no current generic spinner hang was proven |
| Copilot `maxRetries: 0` | Avoids duplicate/ambiguous model execution and usage; no proven zero-byte retry requirement |
| Copilot Undo remains Bob-owned | The next turn receives the exact current draft; no new outcome protocol is justified |
| Copilot disabled reason placement | The current reason is the composer input placeholder beside the disabled Send control; the older “scrolled elsewhere” claim is stale |
| Signed-in invite acceptance is login-time/transactional | Canonical Berlin law does not expose two competing current acceptance commands |
| Public serving fails without a fallback | This is required visible truth, not a degraded user path to heal |
| Honest Billing, Usage, and AI account stubs | They accurately state current capability without fake operations |
| Unpublished Copy-code feedback | It appears only when that unavailable action is requested; hidden dialog DOM produced no current hit-testing cost |

### 7.4 Architect-closed

| Claim | Decision |
| --- | --- |
| Home needs a fabricated first-run action | Keep Home intentionally blank |
| Upgrade CTA must perform billing | Keep the current scaffold until billing exists |
| Public embed `Not found` needs a new failure experience | Keep the current explicit failure face |

### 7.5 Excluded or unproven

| Claim | Decision |
| --- | --- |
| Prague signed-in intent, routes, or Pages deployment | Explicitly excluded |
| Catalog/New Builder wording or behavior | Explicitly excluded |
| Session loss mid-edit needs autosave/recovery machinery | No current failure was observed; Bob already warns through `beforeunload` |
| Every spinner needs another timeout and retry | No concrete unbounded current user flow was proved |
| Every manual refresh control is defensive clutter | No product evidence supports deletion |
| Provider retry would improve Copilot | No current failure or safe exactly-once retry law was proved |

## 8. Execution slices

Each slice must finish its focused checks before the next slice starts. No
half-converted UI state is pushed to `main`.

### Slice 0 — Baseline and behavior fixtures

1. Confirm the branch/worktree and preserve unrelated edits.
2. Record current focused test results for Roma and Bob.
3. Add or extend behavior-level fixtures for dialog decision semantics, Save
   receipt transitions, Widget route concurrency/result priority, panel-label
   projection, and Copilot visible-message lifecycle.
4. Do not make source-text grep the only proof for interactive behavior.

**Exit gate:** the fixtures represent the existing authority boundaries and fail
only for the intended missing behavior.

### Slice 1 — Shared Roma confirmation mechanics

1. Add `RomaCommandConfirmationDialog` under Roma components.
2. Reuse Dieter's dialog lifecycle and existing Roma popup presentation.
3. Implement conditional mounting, Cancel-first focus, Escape/backdrop cancel,
   focus trap, and focus return.
4. Prove that open/cancel never invokes the supplied command and explicit Confirm
   invokes it once.
5. Add accessibility assertions for role, title/body association, focus order,
   and keyboard cancellation.

**Exit gate:** the shared consumer has no product-command knowledge and no command
can run before confirmation.

### Slice 2 — Wire the six Roma commands

1. Widgets: route Delete through the confirmation, preserving row/list busy and
   existing cache updates.
2. Assets: route Delete through the confirmation, preserving upload/list/delete
   policy and result handling.
3. Publication: confirm only Unpublish, leaving Publish/Republish untouched.
4. Team member: confirm Remove.
5. Team invite: confirm Revoke.
6. Settings: confirm ownership transfer and preserve the existing successful
   redirect/session behavior.
7. Test each command's exact subject, body, and confirm label.
8. Test that Cancel leaves remote and local state unchanged.
9. Test that post-confirm failures remain visible in the existing owner surface.

**Exit gate:** all six commands require one decision, execute exactly once after
Confirm, and otherwise retain their old route/result semantics.

### Slice 3 — Bob Save receipt

1. Add the in-memory receipt fact to the existing session state.
2. Set it on successful existing Save and successful first Save.
3. Clear it on the next accepted edit and on editor open.
4. Render the passive `Saved` state through the existing Top Drawer grammar.
5. Cover save success, save failure, edit-after-save, first Save, and subsequent
   editor open.

**Exit gate:** the clean draft has a truthful receipt, not a second action or
protocol.

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

1. Update the owning Roma, Bob, Dieter, account, UI-interaction, accessibility,
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

1. each of the six dialogs opens from its real control, cancels by button, Escape,
   and backdrop, returns focus, and invokes no command before Confirm;
2. each Confirm invokes the exact command and preserves visible failure behavior;
3. Bob Save shows `Saved`, clears it after an edit, and works after first Save
   without reopening Bob;
4. cold Widgets retains the table frame and the route latency reflects concurrent
   upstream reads;
5. Widget Defaults visibly distinguishes multiple compiled panels;
6. a real Product Copilot text-only turn, editing turn, Stop, and controlled
   failure show truthful message status; and
7. keyboard and narrow-viewport behavior remain usable.

Use only safe cloud-dev account data. Restore any team, invitation, publication,
asset, or Widget state intentionally changed for QA. Never automate or mutate a
real Google identity.

**Exit gate:** owner-visible cloud-dev evidence is recorded separately from local
test evidence. Any unperformed destructive scenario is named as pending rather
than inferred.

## 9. Test matrix

| Surface | Required positive proof | Required negative/failure proof |
| --- | --- | --- |
| Shared confirmation | Confirm calls once; focus lifecycle is correct | Open, Cancel, Escape, and backdrop call zero times |
| Six Roma commands | Exact command runs after Confirm | Existing route error remains visible and does not report success |
| Bob Save | Successful Save shows receipt; first Save adopts and shows it | Failed Save shows no receipt; accepted edit clears it |
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
| V3 Silent omission | No command, control, panel, event, or failure result is silently dropped |
| V4 Fail-open control | Missing authorization or command dependencies still fail through their existing owners |
| V5 Corruption-as-absence | No stored-state interpretation changes in this pass |
| V6 Partial-success masquerade | Save and Copilot receipts describe only known completed results; confirmations do not claim command success |
| V7 Masquerade/redress | A failing command is not rerouted through a renamed retry or wrapper |
| V8 Runtime test dependency | Product work does not depend on tests, probes, or verification rituals |

## 12. Completion criteria

This PRD is complete only when all of the following are true:

- E1–E5 are implemented within their named authorities;
- focused and behavior-level tests pass;
- canonical documentation matches the implementation;
- the intended complete worktree is committed and pushed under explicit
  execution authority;
- Roma and Bob deployed revisions are recorded;
- cloud-dev owner QA is completed or each unperformed check is explicitly pending;
- product-data state is reported accurately; and
- the independent V1–V8 audit passes with no unresolved blocker.

Until then the honest state is: **execution planned, not complete**.
