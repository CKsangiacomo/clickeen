# 126K - PRD: Dialogs And Modals

Status: PRE-EXECUTION STEPS 6-7 COMPLETE - exact dialog inventory, lifecycle,
ownership, deletion map, and proof matrix are pinned; Step-8 review pending; no
Step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit: `audits/126K__Audit__Dialogs_and_Modals.md`.
Living doctrine: `documentation/engineering/UI/dialogs-and-modals.md`.

## Purpose

Give every current blocking dialog one truthful lifecycle and connect every
legitimate pre-GA Upgrade action to one honest upsell scaffold. Use the browser's
native `<dialog>` top layer plus one small Dieter DOM helper. Keep product state,
copy, validation, persistence, and dismissal decisions with each workflow.

This PRD does not create a modal framework, React dialog library, registry,
global store, compatibility wrapper, or z-index system.

## Authority Map

| Concern | Authority |
| --- | --- |
| Blocking-dialog mechanics | Native `<dialog>` plus `dieter/components/shared/dialog-lifecycle.ts` |
| Dirty/running state and permitted dismissal | Owning workflow |
| D1 dismissal policy | Product-owner decision register and living dialog doctrine |
| D3 upsell product meaning | Roma-owned upsell scaffold |
| Bob plan-limit intent | Typed `bob:upsell` message, unchanged |
| Plan-limit enforcement and policy | Existing Roma APIs/policy, unchanged |
| Browser/tab abandonment | Native `beforeunload`, unchanged |
| Non-modal popover semantics | Owning Dieter component |

## Native Dialog Contract

Every blocking dialog is a native `<dialog>` opened with `showModal()`. The
small Dieter helper owns only:

- `showModal()`/`close()` mechanics;
- capture of the opener and return focus;
- initial focus;
- focus containment while modal;
- Escape routing to the workflow's dismissal callback;
- optional backdrop request reporting;
- body scroll lock and restoration;
- cleanup of listeners and prior state.

The helper receives callbacks such as `requestDismiss(reason)` and never decides
whether dirty work, running work, or a required notice may close. It renders no
copy, actions, confirmation UI, or product state.

Delivery stays inside the existing monorepo source boundary:

- Dieter component entries import the helper relatively and bundle it into
  their generated component JavaScript;
- Bob and Roma import the same source module directly at build time using the
  existing internal-source pattern;
- DevStudio imports it through its existing `@dieter/*` source alias;
- no `@ck/dieter` package entrypoint, package-manifest change, lockfile change,
  runtime CDN helper script, or second package is introduced.

Native `<dialog>` supplies the top layer and parent inertness. Existing fixed
backdrop wrappers and dialog z-index literals are deleted as each blocking
dialog migrates. Existing Dieter shadows/radii remain; no new elevation or
stacking system is added.

Dirty confirmation replaces the active dialog body/state temporarily. It does
not stack a second modal. `Keep editing` restores the work body and focus;
`Discard` closes and drops only the workflow's temporary edits.

## Exact Product Matrix

| Owner/workflow | Escape | Backdrop | Explicit behavior |
| --- | --- | --- | --- |
| Dieter Bulk Edit | Clean closes; dirty shows discard state | Never | Cancel follows dirty rule; Save applies to Bob working state |
| Dieter Object Manager | Clean closes; dirty shows discard state | Never | Cancel follows dirty rule; Save applies reorder/delete |
| Roma Add Instances | Closes and discards selection | Never | Cancel discards; Add selected persists |
| Roma Bulk Upload | Disabled while any upload is active | Never | Close exists after terminal state |
| Roma tier-drop notice | Never | Never | Open settings or persisted Dismiss only |
| Roma plan-limit prompt | Closes | Closes | Upgrade replaces prompt with upsell scaffold |
| Bob plan-limit prompt | Closes | Closes | Upgrade emits typed `bob:upsell`; Roma opens scaffold |
| Roma upsell scaffold | Closes | Closes | Close only; no commercial operation |
| DevStudio token editor | Clean closes; dirty shows discard state | Never | Cancel follows dirty rule; Confirm Commit persists |
| Roma unsaved Builder/defaults | Means Keep editing | Never | Explicit Discard continues requested navigation |

Native `beforeunload` remains for browser/tab exit and is not replaced.

## D3 Upsell Scaffold

Roma owns one `RomaUpsellDialog` used by Roma-native Upgrade actions and Bob's
typed intent. The scaffold contains:

- truthful title and close action;
- the originating reason when available;
- one stable empty content region reserved for later plan comparison, benefits,
  pricing, and checkout work.

It does not mutate a plan, call a billing provider, navigate to `/billing`,
claim purchase success, or invent a contact destination. A plan-limit prompt
transitions to this state in the same dialog layer. Opening it preserves
unsaved Builder work and never invokes the discard-work prompt. Ordinary Billing
navigation for current-plan inspection remains unchanged.

## Non-Modal Popover Contract

- `dropdown-actions` remains a listbox/choice popover.
- `dropdown-edit`, `dropdown-upload`, `dropdown-fill`, `dropdown-border`,
  `dropdown-shadow`, and `textedit` are non-modal dialog popovers.
- Fill, border, and shadow change from false `listbox` roles to `dialog` roles.
- `dropdownToggle` provides open/close, outside-click, Escape, and return-focus
  mechanics for non-modal popovers only.
- `textedit` adopts that same engine for its host popover; nested `popaddlink`
  remains nested form content.
- Non-modal popovers never call `showModal()`, inert the page, or use the
  blocking-dialog helper.

## Execution Slices

### K1 - Shared Native Lifecycle

1. Add `dieter/components/shared/dialog-lifecycle.ts` with the bounded mechanics
   above.
2. Import it directly from each owning component/app build as defined by the
   delivery boundary above.
3. Keep the API DOM-only and framework-independent.

Green gate: focused browser tests prove focus, Escape routing, backdrop
reporting, return focus, scroll restoration, repeated open/close cleanup, and
nested focus containment. No new unit-test framework is added.

### K2 - Dieter Blocking Dialogs And Popover Semantics

1. Convert Bulk Edit markup to native `<dialog>` and add its clean/dirty/discard
   states without changing applied `bob-ops` behavior.
2. Replace `object-manager.js` with `object-manager.ts` because this behavior
   change must import the shared helper. Preserve its data contract and child
   hydration while deleting the accumulating backdrop listener.
3. Add Object Manager icon tooltips and its `tooltip` manifest dependency as
   handed off by 126I.
4. Convert fill/border/shadow to truthful non-modal dialog roles.
5. Make `dropdownToggle` return focus consistently and move `textedit` host
   lifecycle onto it without changing nested link editing.
6. Rebuild Dieter and generated DevStudio component pages; never hand-edit
   generated output.

Green gate: both blocking editors preserve working values until Save, dirty
dismissal never silently drops work, and all six editing popovers retain their
current editing behavior with truthful semantics.

### K3 - App Dialog Consumers And D3

1. Convert Bob UpsellPopup, Roma's four current modal families, and DevStudio's
   token editor to native `<dialog>` plus the helper.
2. Add the Roma upsell scaffold and connect Roma plan-limit Upgrade and Bob's
   `bob:upsell` intent to it.
3. Remove only the upsell branch's `confirmDiscardBuilderEdits()` and
   `/billing` navigation. Preserve actual Builder navigation guards.
4. Replace the two in-app `window.confirm` calls with one narrow Roma
   unsaved-changes dialog component. Preserve native `beforeunload`.
5. Implement every D1 row exactly; do not infer one default dismissal policy.
6. Delete migrated backdrop wrappers, raw modal z-index declarations, and dead
   Bob publish/website modal CSS.

Green gate: every matrix row has direct browser proof; no prompt stacks with the
upsell scaffold; no product route or persistence behavior changes.

### K4 - Deploy And Browser Proof

1. Run all local gates and focused dialog suites.
2. Deploy through Git-connected Bob, Roma, and DevStudio Pages plus the normal
   Worker/R2 Dieter sync at one source SHA.
3. Read back the Dieter manifest at that SHA.
4. Run authenticated Roma and DevStudio browser tests. Missing DevStudio auth
   remains RED; Roma auth must not substitute.
5. Reconcile living dialog, interaction, component, and service docs.

## Exact Blast Radius

### Add

- `dieter/components/shared/dialog-lifecycle.ts`
- `dieter/components/object-manager/object-manager.ts`
- `roma/components/roma-upsell-dialog.tsx`
- `roma/components/roma-unsaved-changes-dialog.tsx`
- `e2e/widgets/dialog-contracts.spec.ts`
- `e2e/devstudio/dialog-contracts.spec.ts`

### Edit

| Area | Files |
| --- | --- |
| Dieter build contract | `scripts/build-dieter.js` only for Object Manager tooltip dependency |
| Bulk Edit | `dieter/components/bulk-edit/bulk-edit.{html,css,ts}` |
| Object Manager | `dieter/components/object-manager/object-manager.{html,css,spec.json}` plus new `.ts` |
| Popovers | `dieter/components/shared/dropdownToggle.ts`; `dieter/components/textedit/textedit.ts`; `dieter/components/dropdown-{fill,border,shadow}/*.html` |
| Bob | `bob/components/UpsellPopup.tsx`; `bob/app/bob_app.css` |
| Roma | `roma/components/pages-domain.tsx`; `assets-domain.tsx`; `roma-account-notice-modal.tsx`; `widgets-domain.tsx`; `builder-domain.tsx`; `widget-defaults-domain.tsx`; `roma/app/roma.css` |
| DevStudio | `admin/src/main.ts`; `admin/src/css/utilities.css`; generated registries/pages produced by the Dieter build |
| Tests | `roma/tests/run-widget-command-gates.ts` plus the new focused suites |
| Docs | `documentation/engineering/UI/{dialogs-and-modals,interactions,components}.md`; `documentation/services/{bob,roma,devstudio}.md` |

Execution-start grep must confirm every generated filename and current consumer.
If a named generated file has moved, update this PRD before editing.

### Delete

- `dieter/components/object-manager/object-manager.js` after the TypeScript
  replacement builds the same public `object-manager.js` artifact;
- both in-app `window.confirm` calls;
- migrated `.roma-modal-backdrop` wrappers and CSS;
- dead `.ck-upsellModal__detail`, `.ck-publish*`, and `.ck-website*` CSS;
- old blocking-dialog backdrop/z-index/listener branches replaced by native
  `<dialog>`.

### Do Not Touch

- plan-limit APIs, entitlements, policy, billing routes/providers;
- account/session, save, translation, Tokyo, San Francisco, Berlin, Supabase,
  R2 account data, or public-widget overlays;
- status/alert overlays that are not dialogs;
- native `beforeunload`;
- 126J/L/M shell composition except where dialog viewport fit needs CSS within
  the exact dialog selectors.

## Verification

```bash
pnpm build:dieter
pnpm --filter @ck/dieter typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob build
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio check:functions
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/roma test:widget-command-gates
E2E_BASE_URL=https://roma.dev.clickeen.com pnpm exec playwright test e2e/widgets/dialog-contracts.spec.ts
E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test e2e/devstudio/dialog-contracts.spec.ts
```

The exact Roma package test script must be confirmed at execution start. If the
named script does not exist, use its current owning command and amend this PRD;
do not silently skip the gate.

Deploy proof requires `bob-dev`, Roma, and DevStudio Pages at one source SHA,
the normal Dieter R2 sync run at that SHA, and a manifest readback. No product
data mutation belongs to 126K.

## Dependencies And Handoffs

- 126I must be green before K2 because both touch Object Manager and popovers.
- 126J's compact ToolDrawer must defer to any open blocking dialog.
- 126L consumes K1 for the token editor and must not invent another lifecycle.
- 126M consumes the completed Roma/Bob D1/D3 behavior and must preserve it while
  changing shell and visual classes.

## V1-V8 Pre-Execution Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | Dismissal is explicit per workflow; no default is invented. |
| V2 | PASS | No persisted state is normalized or repaired. |
| V3 | OPEN UNTIL STEP 9 | Every D1 row, D3 transition, two confirms, dead CSS, generated output, deploy, and docs require proof. |
| V4 | OPEN UNTIL STEP 9 | Running/required dialogs must remain fail-closed to forbidden dismissal. |
| V5 | PASS | Corrupt product data is outside this UI change. |
| V6 | OPEN UNTIL STEP 9 | Local lifecycle success cannot stand in for all app consumers and deployed evidence. |
| V7 | OPEN UNTIL STEP 9 | Old wrappers, confirms, listeners, and CSS must be deleted rather than hidden. |
| V8 | PASS | Native dialog/runtime code owns mechanics; tests only verify. |
