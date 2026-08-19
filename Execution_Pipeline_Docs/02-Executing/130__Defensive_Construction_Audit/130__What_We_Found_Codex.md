# What we found — Codex

Status: **INDEPENDENT AUDIT COMPLETE — READ-ONLY — AWAITING ARCHITECT DISPOSITION**

Owner: Clickeen product owner/architect

Date: 2026-08-19

This is Codex's independent pass over the product concern recorded in
`130__AUDIT__Defensive_Construction_Audit.md`. It is evidence, not permission
to change code, mutate account data, deploy, or operate a managed service.

The pass began from Clickeen product law in `AGENTS.md` and `documentation/`,
then walked the deployed product. Code was opened only to identify the owner of
behavior that was felt live or to prove whether a normal user action was
concretely reachable. The other reports in this folder were compared only after
this ledger was formed; their rows are not evidence for this report.

## 1. Scope and exclusions

### In scope

- Roma login ingress and authenticated shell
- Widgets inventory
- existing saved-instance Builder hosted by Roma with Bob in the iframe
- Bob manual editing feedback, Product Copilot entry state, and Translations
  entry state
- Roma Builder landing
- Assets
- Account settings, Profile, Team, Billing, Usage, AI, and Widget Defaults
- Tokyo-worker public serving for published base, published locale, missing
  locale, and unpublished coordinates
- the bounded B1-B4 trust-boundary remediation recorded by PRD 130

### Explicitly excluded

- all Prague routes, code, and handoffs
- Roma Widget Catalog at `/widgets/catalog`
- the resulting New Builder route at `/builder/new/:widgetType`

The Catalog is a Roma surface, not a Bob command surface. Bob was audited only
through an existing saved instance.

### Deliberately not executed

No Save, Publish, Republish, Unpublish, widget Delete, asset Delete, upload,
invitation, ownership transfer, settings write, translation generation, or
Copilot turn was submitted. Those commands affect shared cloud-dev account
state or usage and this audit did not have mutation authority.

One Bob text field was changed in browser memory and restored to its exact
original value. The Save command was never clicked. A Copilot prompt was typed
and cleared; Send was never clicked. Opening menus, changing editor panels, and
renaming locally before Cancel produced no product command. The repository's
authenticated Playwright state was refreshed locally with
`pnpm e2e:auth:roma-dev`.

## 2. Baseline and method

Local source baseline:

- `main@814aebf301f6eff2d9bc373c91363e05de190517`
- `github/main` resolved to the same commit at audit time
- worktree clean before this report was added

After the evidence freeze, concurrent work from another repository participant
appeared in the shared worktree. This report does not absorb or adjudicate those
uncommitted edits; its source claims are frozen to the commit above. Only this
Codex report was authored by this pass.

Live baseline:

- `https://roma.dev.clickeen.com`
- Bob hosted at `https://bob.dev.clickeen.com/bob`
- public serving at `https://dev.clk.live`
- authenticated account `CLICKEEN`

The live UI does not expose a deployment commit, so this report does not claim
that the live deployment was cryptographically identified as the local SHA. It
records live behavior and separately records the current source that owns that
behavior.

The walk used the repository's authenticated Playwright runner from the VS Code
workspace. For each route or click it recorded:

1. what appeared immediately;
2. when the requested surface became usable;
3. what signaled completion;
4. whether the intended control received the hit;
5. whether hidden UI was actually visible, focusable, or hit-testing;
6. only then, which current source path owned a felt delay or reachable action.

Finding classifications in this report are strict:

- **Observed** — happened in the live walk.
- **Reachable** — the live control exists and current owning code proves the
  ordinary next click performs the behavior, but the mutating click was not
  submitted.
- **Latent** — requires a failure or concurrency condition not observed live.
- **Theoretical** — no current user flow was proven; it is not a finding here.

## 3. Live inventory and measured journeys

Inventory at audit time:

| State | Widget | Instance | Name |
| --- | --- | --- | --- |
| Published | Big Bang | `LWZZR7JSG8` | BigBang Test |
| Published | FAQ | `VUWUJ7OQ0Y` | FAQ example |
| Unpublished | Countdown | `8LGOEM8JGC` | Untitled widget |
| Unpublished | Cards | `M4YW8OAT5O` | Untitled widget |

Measured cold-path examples from fresh browser contexts:

| Journey | Immediate state | Usable/completed state |
| --- | --- | --- |
| Widgets | Roma shell, heading, filter, `Loading widgets...` | four-row table at about 2.1 s |
| Existing Builder | Roma shell, `Loading widget...`, `Loading publication status...` | Bob controls at about 1.6 s; complete workspace at about 1.9 s |
| Widget Defaults | shell and page heading, then `Loading widget defaults...` | Discard/Save and compiled controls at about 1.7 s |
| Assets | shell, asset table state `Loading assets...`, disabled `Refreshing...` | 22 rows and 2.2 MB at about 1.2-2.1 s |
| Team | shell and two honest loading labels | owner row and empty invitations at about 2.1 s |
| Usage | shell and `Storage used Loading...` | 2.2 MB at about 2.1 s |

One traced cold Widgets load spent about 0.5 s in `/api/bootstrap`, followed by
about 1.2 s in `/api/account/widgets`; the table was ready at about 2.1 s.
One traced existing Builder load completed at about 1.7 s after the click,
including Bob boot, the saved-instance open request, editor artifact load, and
account-asset resolution.

## 4. Findings, ranked by current user cost

### C1 — Destructive actions are one ordinary click from irreversible effect

**Classification: reachable, high consequence, not executed.**

Live evidence:

- The published `BigBang Test` row exposes an enabled menu containing Rename,
  Duplicate, and Delete.
- Every one of the 22 asset rows exposes an enabled Delete button.
- The published-state switch is enabled and its visible center hit-tests to the
  intended toggle.

Current owning code proves the next click is the command, not a confirmation:

- Widget Delete calls the account instance `DELETE` directly in
  `roma/components/widgets-domain.tsx:353-369`.
- Asset Delete calls the account asset delete path directly in
  `roma/components/assets-domain.tsx:291-318` and is wired directly from each
  row at `roma/components/assets-domain.tsx:588-597`.
- Turning off the published switch calls the Unpublish `POST` directly in
  `roma/components/widget-publication-controls.tsx:60-72` and
  `roma/components/widget-publication-controls.tsx:139-146`.

The exact conditions are ordinary owner/editor use: open the existing menu or
click an enabled control. No race, corrupt state, or unusual environment is
required. Widget Delete removes the saved instance; Unpublish takes the public
package out of service; asset Delete can remove bytes referenced by saved
widgets.

The current design exists because product commands are intentionally direct and
Roma already owns authorization and command routing. That directness should
stay. The excess is only the lack of one proportional human decision before a
high-consequence command. The smallest disposition is a Roma-owned confirmation
for Widget Delete, Asset Delete, and Unpublish. It does not require a workflow,
recovery service, second authority, or new failure taxonomy.

This report does not generalize the finding to member removal, invitation
revoke, or ownership transfer: the audited account had no second member,
pending invitation, or transfer candidate, so those actions were not currently
reachable in this live walk.

### C2 — Save has excellent dirty feedback but no positive completion receipt

**Classification: reachable in current code; successful live Save deliberately
not executed.**

Live evidence before the command boundary:

- Editing `Header CTA label` made Save appear within about 266 ms.
- Restoring the exact original value made Save disappear again.
- The preview remained usable and no product command was sent.

Current owning code proves the success ending:

- `bob/lib/session/useSessionSaving.ts:109-122` records the submitted signature,
  clears `isSaving`, and clears dirty state after a successful result.
- `bob/components/TopDrawer.tsx:24-27` derives visibility solely from dirty or
  saving state.
- `bob/components/TopDrawer.tsx:71-85` therefore removes the entire Save action
  when a clean success is reached. There is no `Saved` state in that surface.

On a published widget, Roma separately updates publication facts so the slim
header can show `Published · changes not live` and Republish. That is release
truth, not an explicit receipt for Bob's primary command. On an unpublished
widget there is not even that indirect publication-state change.

The current design correctly makes Save a transient verb instead of permanent
toolbar clutter. The missing part is one short, passive completion state using
the existing successful result. No new protocol or persistence authority is
needed. The receipt must not become another gate or modal.

### C3 — The cold Widgets route serializes two independent Tokyo reads

**Classification: observed on every cold uncached Widgets visit in this pass.**

The live cold path showed only `Loading widgets...` until the four rows arrived
at about 2.1 seconds. Network tracing attributed roughly 1.2 seconds to
`/api/account/widgets` after account bootstrap.

The route composes two independent results but awaits them serially:

1. instance facts at `roma/app/api/account/widgets/route.ts:38-58`;
2. widget definitions at `roma/app/api/account/widgets/route.ts:59-79`.

Both calls use the same already-resolved account coordinate and capsule. The
second does not consume the first. This is not a validation problem and should
not be fixed with more cache state. The existing five-minute browser cache in
`roma/components/use-roma-widgets.ts:84-116` already makes repeat visits cheap.

The smallest disposition is to start the two existing owner reads together and
retain the same exact fail-visible result handling. That removes avoidable cold
latency without changing authority, payload, cache law, or UI state.

The one-line loading copy is honest. A table skeleton could improve perceived
shape, but it would not remove the measured serialization and is therefore not
the primary fix.

### C4 — Widget Defaults erases panel context and produces duplicate labels

**Classification: observed, deterministic.**

The live Widget Defaults common section displayed two adjacent groups both
named `LOCALE SWITCHER`. The deployed Big Bang compiled artifact contains three
different common concepts with that cluster label:

- appearance: background, text, border, radius, and padding;
- typography: family, size, style, weight, color, line height, and tracking;
- settings: enabled, attachment, and position.

The ambiguity is introduced by the Widget Defaults projection, not by corrupt
compiled truth:

- common controls are selected from the exact compiled artifact at
  `roma/components/widget-defaults-domain.tsx:257-263`;
- `buildPanelHtml` filters the relevant panels and concatenates their inner HTML
  at `roma/components/widget-defaults-builder-controls.tsx:130-140`;
- the owning panel labels (`Appearance`, `Typography`, `Settings`) are not
  retained around those fragments.

The visible result asks the user to guess which identical heading controls
which concern; enabling additional settings can expose a third identical
heading. The smallest disposition is to preserve the existing compiled panel
context in this projection or otherwise make those existing group labels
specific. Do not add a new Widget Defaults schema or reinterpret the compiled
artifact.

## 5. Prior claims that did not reproduce

### The Roma shell does not disappear behind `Loading page`

The navigation, page register, heading, and page-level controls stayed visible
while account and domain data loaded. Source matches the screenshot:
`RomaAccountBoundary` is mounted inside `.page__content` at
`roma/components/roma-shell.tsx:175-177`; its loading state at
`roma/components/roma-account-context.tsx:73-85` replaces only the content
child, not the shell.

There is still an account bootstrap wait. Calling it a full-shell or nav
replacement is not current reality.

### Closed Dieter dialogs did not intercept controls

On the saved Builder, four closed dialogs existed in the DOM. All had computed
`display: none`, zero width and height, and zero visible dialogs in the
accessibility query. They were not hit targets.

Direct center-point hit tests resolved correctly for:

- Widgets Edit -> the intended Edit link;
- the published switch -> its knob inside the intended label.

The closed-dialog DOM is therefore not a current click-interception finding in
this pass. Mount-on-open may still be a code-cleanliness preference, but no
current user cost was proven and no remediation is recommended from this
evidence.

### Existing Builder did not show the old “No instance selected” boot lie

The boot sequence showed `Loading widget...` and `Loading publication
status...`, then the correct instance. It never told the user to select an
instance after they had clicked Edit.

### The preview did not lag controls by several seconds

In the measured run, Bob controls appeared at about 1.6 seconds and the complete
workspace reported ready at about 1.9 seconds. The total open still has visible
loading time, but this pass did not reproduce a multi-second controls-versus-
preview mismatch.

## 6. Current mechanisms that should remain

### Publication is Roma-owned and Bob remains Save-only

The saved Builder showed instance name, Published state, the publication
switch, Open public widget, and Copy code in Roma's slim header. Bob's
TopDrawer contained editor controls and Save only. This matches the current
authority split; no Publish or Unpublish command was found in Bob.

### The inventory-wide busy state is not a blanket deletion candidate

`activeActionKey` causes every row to disable while an account instance command
is pending (`roma/components/widgets-domain.tsx:559-682`). Taken alone this
looks broad. Current system law, however, uses one per-account coordinator for
existing Save, Rename, Publish, Unpublish, and Delete. Allowing another row to
submit during that interval would knowingly surface `commandInProgress`.

Duplicate also reuses `activeActionKey` even though it creates another identity
outside the existing-instance coordinator. This pass did not execute Duplicate
or feel a prolonged frozen list, so it does not promote that bounded mismatch
into a user-cost finding. It also does not recommend the earlier blanket
per-row-only change: for coordinated commands that would make the UI promise
parallel work that Tokyo intentionally rejects. Any later refinement must
separate Duplicate from coordinated existing-instance commands instead of
loosening the whole list.

### Public serving fails without fallback

- Published Big Bang base returned 200 with semantic HTML.
- Big Bang `?locale=fr` returned 404 `Locale not available`; that instance had
  no French overlay, and no other locale was silently substituted.
- Published FAQ `?locale=fr` returned 200 with `<html lang="fr">`.
- Unpublished Countdown returned 404 `Not found`.

These are correct publication and locale boundaries.

### Honest partial products remain honest

- Billing states that the provider is not connected.
- Usage shows live storage and says broader reporting is not connected.
- AI states that execution happens inside Builder.
- Account settings explains why ownership transfer is unavailable on the
  current one-member account.
- Builder landing directs the user to select a concrete instance from Widgets.

No fake completion or silent substitute was found on those surfaces.

## 7. Independent trust-boundary check

The bounded remediation from PRD 130 was checked against current code without
using the sibling reports as proof.

| Slice | Current result | Evidence |
| --- | --- | --- |
| B1 Roma owner-result consumption | **Correct** | Bootstrap success is consumed as `RomaMeResponse` in `roma/components/use-roma-me.ts:216-237`; Widgets consumes the exact `RomaWidgetsResponse` in `roma/components/use-roma-widgets.ts:84-116`. Cache-container shape checks prove Roma's own client cache, not Berlin or Tokyo semantics. |
| B2 Widget Defaults | **Correct trust boundary; one UX projection defect is C4** | The UI consumes exact `CompiledWidget` artifacts. The server retains `validateAccountWidgetDefaultsTypography` at `PUT /api/account/widget-defaults`, which is correct because that route is browser ingress, not a downstream Clickeen consumer. |
| B3 assets | **Correct** | Roma enforces active-account upload policy at `roma/app/api/account/assets/upload/route.ts:46-62`; Tokyo retains capsule authorization plus filename, MIME, byte, SVG, and limit admission at `tokyo-worker/src/domains/assets-handlers.ts:236-285` and does not repeat Roma's account-status decision. |
| B4 Copilot internal chain | **Correct in code; live turn unmarked** | Bob consumes the typed transport at `bob/components/CopilotPane.tsx:209-212` and invokes it at `:524-535`. San Francisco verifies the grant, then consumes the request as `ModelTurnRequest` at `sanfrancisco/src/ai/model-turn.ts:500-515`. SSE JSON decoding remains transport work. |
| B5 Prague reference/probe cleanup | **Excluded** | All Prague code and routes were explicitly outside this pass. No result is claimed. |

The live Copilot entry state also behaved coherently: the prompt was enabled,
Send was disabled while empty, enabled within 9 ms of browser-memory input, and
disabled again after the text was cleared. No turn was sent, so model execution,
stream completion, narration ordering, usage charging, and tool application
remain unmarked.

## 8. Routes and surfaces cleared at the tested depth

| Surface | Result |
| --- | --- |
| `/login` | 200; one clear `Continue with Google` ingress. Fresh Google OAuth was not clicked. |
| `/widgets` | Correct four-row truth, filters/sorts, Edit hits, publication labels. C1 and C3 remain. |
| existing `/builder/:instanceId` | Correct instance, Roma publication header, Bob editor, fast dirty feedback. C2 remains. |
| `/builder` | Immediate honest instruction to open a concrete instance from Widgets. |
| `/assets` | 22 exact rows, sizes/MIME, 2.2 MB, honest loading/error pattern. C1 remains for Delete. |
| `/settings` | Current plan/role, language loading, locked base language, visible ownership reason. |
| `/profile` | Form rendered without an extra gate; Save was not executed. |
| `/team` | Owner row and empty invitations; empty-email invite remained disabled. |
| `/billing` | Honest provider-not-connected state. |
| `/usage` | Live storage value and honest broader-reporting boundary. |
| `/ai` | Honest entitlement context; points execution to Builder. |
| `/settings/widget-defaults` | Exact controls loaded; clean Discard/Save disabled. C4 remains. |
| Bob Translations | Base locale, plan count, Generate, saved-overlay load, and preview locale rendered. Generate was not executed. |
| public serving | Correct 200/404 and locale/no-fallback behavior at the tested coordinates. |

The visible `Refresh list` on Assets and `Refresh` on account languages were not
promoted to findings. Both completed normally, neither blocked the primary
journey, and this pass did not prove that the manual recovery affordance is
redundant after every external or failed update. Deleting a visible recovery
control without that proof would be the same overreach this audit is intended
to prevent.

## 9. Still unmarked

- actual Save completion and failure, including first Save
- Publish, Republish, and Unpublish execution and capacity denial
- widget Delete, asset Delete, uploads, and bulk uploads
- Profile, locale, Widget Defaults, team, invitation, membership, and ownership
  writes
- Translation Agent generation and partial failure
- Product Copilot model turn, streaming narration, tool application, Stop, undo,
  charging, and failure
- deliberate network hangs, request timeouts, service outages, and concurrent
  multi-tab commands
- DevStudio and operator-only surfaces
- all Prague behavior
- Widget Catalog and New Builder

Unmarked means not tested here. It does not mean broken, clean, inherited from
another report, or authorized for remediation.

## 10. Comparison after the independent ledger

Only after the findings above were established was this pass compared with the
other files in the folder.

- C1 corroborates the master audit and Kimi's confirmation-inversion finding,
  but this report narrows its claim to the destructive controls actually
  present on the current account plus their current owning handlers.
- C2 corroborates the master and Kimi Save-receipt finding, while explicitly
  separating live dirty-state evidence from the unexecuted successful Save.
- C3 corroborates the observed Widgets delay in the Claude/Cursor walks and
  adds the current serial owner-read cause.
- C4 independently reproduces Claude/Kimi's duplicate Locale Switcher labels
  and identifies the lost panel context that creates them.
- This pass does **not** reproduce the claimed hidden-dialog click interception,
  full-shell disappearance, or multi-second preview-after-controls gap.
- This pass does **not** adopt the recommendation to delete Refresh controls or
  make the list busy state per-row, because current evidence does not justify
  either change.
- Prague and Catalog/New findings in other reports are outside this pass by
  explicit owner instruction.

## 11. Net result

The current product is materially simpler than the historical state described
by the opening PRD 130 audit: publication is reachable on Roma surfaces, Bob is
Save-only, abandoned Create storage is outside this audit's saved-instance path,
cache eviction is not a product result, and the bounded B1-B4 trust cleanup is
present without removing real external-ingress enforcement.

Four current corrections survive this independent pass:

1. put one proportional confirmation in front of the destructive commands
   proven reachable here;
2. give Bob's primary Save command one passive success receipt;
3. run the two independent Widgets owner reads concurrently;
4. preserve panel context in Widget Defaults so distinct Locale Switcher
   concerns do not share an indistinguishable heading.

All four are small changes through existing authorities. None requires a new
service, schema, registry, fallback, repair path, validation layer, or response
protocol.

This audit authorizes none of them.
