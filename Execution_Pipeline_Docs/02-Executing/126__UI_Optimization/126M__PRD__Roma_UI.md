# 126M - PRD: Roma UI

Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).

Status: PRE-EXECUTION DOCTRINE RECORDED - step-5 living doctrine reconciled; shared-control, translation, D1 dismissal, D2 workspace, and D3 upsell boundaries propagated; steps 6-8 remain pending.

The Phase-1 baseline/addendum sections below are frozen evidence. Mandatory Roma
shared-control, translation-boundary, and product-state law is now settled in
this PRD and the product-owner decision register, including D1/D2/D3. No
execution is authorized yet. The old executable draft was seed material and is
not preserved as current doctrine.

Primary Step 1 evidence:

- `audits/126M__AsBuilt_Codex.md`
- `audits/126M__AsBuilt_GLM.md`

Primary Step 3 evidence:

- `research/126M_Research_Codex.md`
- `research/126M_Research_GLM.md`

## Frozen Phase 1 Step 2 Boundary

This point-in-time baseline described:

- current Roma UI reality;
- current route/product authority boundaries;
- known gaps;
- stale prior-draft/count warnings;
- the decisions that were still open before Step 4 human convergence.

It did not:

- implement shared primitives;
- delete `.roma-*`, `.rd-*`, or `widget-defaults*` CSS;
- split domain components;
- change copy;
- change save/translation behavior;
- implement the stale-translation banner;
- update living service docs;
- edit GLM artifacts;
- start Step 4+ convergence.

## Product Role

Roma is the authenticated current-account product app and Builder host.

## Current Mandatory Law

Roma consumes the accepted Dieter native field, table visual, tooltip, and
dialog mechanics while retaining account/domain state, labels, validation,
layout, behavior, and specialized tables. Dead Widget Defaults control CSS is
deleted without replacing active Bob/Dieter control behavior. Translation sync
attention stays in Bob beside Tokyo's authoritative summary; Roma must not infer
a second translation state. Accepted D1 law governs Roma dismissal behavior:
Add Instances discards temporary selection on Escape/Cancel and never closes by
backdrop; Bulk Upload cannot dismiss while active; the tier-drop notice requires
Open settings or persisted Dismiss; plan-limit prompts may close because no work
is lost; unsaved Builder/defaults prompts treat Escape as Keep editing and
require explicit Discard.

Accepted D3 law keeps legitimate Upgrade entry points. They open or transition
to the shared pre-GA upsell dialog scaffold instead of navigating to `/billing`.
The scaffold is a real, dismissible UI destination for developing plan
comparison, benefits, pricing, and future checkout, but it performs no purchase,
plan mutation, provider call, fake success, or invented contact operation. A
plan-limit prompt is replaced by the scaffold rather than stacked beneath it.
Roma owns one small reusable scaffold component: Roma-native Upgrade actions
open it directly, while Bob keeps the typed `bob:upsell` intent and Roma opens
the same component. Ordinary Billing navigation remains valid for current-plan
inspection. No global upsell store, billing adapter, or dialog framework is
authorized. Opening the scaffold preserves unsaved Builder work; the current
`confirmDiscardBuilderEdits()` call is removed from only the `bob:upsell`
branch, not from real navigation guards.

D2 is decided global law. Roma preserves its desktop dashboard workspace on
tablets in both orientations, including touch operation. Mobile landscape uses
compact drawer navigation; mobile portrait presents the explicit unsupported
orientation/size boundary. The current generic `980px` collapse and inline
`details` navigation are current-source gaps, not product doctrine.

Roma's one shell remains narrow persistent left navigation plus flexible work
area in full mode, and the same navigation as an overlay drawer plus full-width
work area in compact mode. Roma domains are not rebuilt as separate mobile
screens. Bob uses the same nested rule for ToolDrawer plus preview/workspace.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in this PRD.

Once the 126M Roma UI standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

Current reality:

- Roma bootstraps current-account context from Berlin through `/api/bootstrap`.
- Roma browser code calls same-origin Roma APIs.
- Roma routes account widget, page, asset, team, usage, locale, Builder, Copilot,
  and translation operations through named server routes.
- Bob is the editor. Tokyo-worker is the account storage boundary. Berlin owns
  auth/account identity. San Francisco owns governed AI execution.
- Roma Builder hosts Bob and maps Bob account commands to same-origin Roma
  routes.

Known gaps:

- UI convergence must preserve current-account authority and must not turn Roma
  into a generic admin app.
- Product mutations must remain route-owned and must not become direct UI
  storage writes.

## App Shell And Navigation

Current reality:

- Roma loads `roma/app/roma.css` plus Dieter token/component CSS from Tokyo.
- Dieter CSS available in Roma includes tokens, segmented, button, textfield,
  toggle, and popover.
- Authed domain pages are thin wrappers over `DomainPageShell`.
- `DomainPageShell` renders `RomaShell`, the account notice modal, Suspense
  fallback, and the domain error boundary.
- `RomaShell` renders the local `.roma-layout`, `.rd-domain`, `.rd-header`, and
  `.rd-canvas` shell.
- `RomaNav` renders 12 domain keys, active `aria-current`, and nested Settings
  domains.
- Main domain keys are Home, Widgets, Pages, Builder, Assets, and Settings.
- Settings domains include Account, User Settings, Team, Billing, Usage, AI, and
  Widget Defaults.

Known gaps:

- The shell is structured and shared, but it is local `.roma-*` / `.rd-*` UI,
  not a Dieter primitive shell.
- Current mobile nav/table behavior is local CSS and must be audited before any
  later implementation step changes it.

## Dieter Consumption

Current reality:

- Roma is token-aware and loads Dieter CSS.
- Dieter usage in inspected Roma UI is concentrated in `diet-btn-txt` and
  `diet-btn-txt__label`.
- Current scan found no `diet-textfield`, `diet-toggle`, `diet-segmented`,
  `diet-popover`, or `diet-button` class hits in `roma/app` or
  `roma/components`.
- Current Dieter adoption in Roma is CSS/class-based. The inspected shell and
  domain files do not import Dieter React components.

Known gaps:

- Roma's repeated inputs, tables, and modal behavior remain outside a
  Dieter-backed shared contract. App shell, domain layout, grids, locale
  composition, toolbars, and Builder hosting are legitimate Roma composition
  unless a current gap proves otherwise.
- Later convergence must be class/markup-aware instead of assuming custom Dieter
  elements exist.

## Local UI Layer

Current reality:

- `roma/app/roma.css` is 762 lines.
- It defines layout, nav, headers, canvas modules, module surfaces, cards,
  code blocks, toolbar, account locale settings, inputs, form grids, fields,
  tables, cell actions, modals, Builder iframe, and mobile behavior.
- The `widget-defaults` CSS still contains an old local toggle/input/textarea
  control system, but current Widget Defaults runtime renders compiled
  Bob/Dieter controls through `@clickeen/bob/control-host`. The old control CSS
  is dead; active `widget-defaults-builder-fields` rules are host composition.
- CSS-side raw pixel values still exist in Roma CSS.

Known gaps:

- `.roma-*`, `.rd-*`, and `widget-defaults*` mix legitimate app composition,
  repeated component styling, and dead CSS. They must be classified, not
  deleted or renamed as one namespace.
- The dead Widget Defaults toggle/input/textarea rules are deletion targets;
  current compiled control behavior remains Bob/Dieter-owned.

## Shared Primitive Layer

Current reality:

- No `roma/components/ui` shared primitive folder exists in the current working
  tree.
- No current `DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, or
  `Toast` primitive implementation was found.
- Domains consume local classes and local markup directly.

Known gaps:

- The shared primitive layer described in old seed text is not current runtime.
- Renewed human convergence rejects that old generic primitive list. Current
  mandatory law adds only the proven shared operational field and table visual
  contracts; Roma keeps domain state, labels, validation, layout, behavior, and
  specialized composition.

## Domain Size And Shape

Current line counts:

- `pages-domain.tsx`: 1111 lines.
- `builder-domain.tsx`: 987 lines.
- `widget-defaults-domain.tsx`: 730 lines.
- `widgets-domain.tsx`: 624 lines.
- `assets-domain.tsx`: 524 lines.
- `account-locale-settings-card.tsx`: 334 lines.
- `team-domain.tsx`: 311 lines.
- `team-member-domain.tsx`: 303 lines.
- `profile-domain.tsx`: 289 lines.
- `settings-domain.tsx`: 190 lines.
- Smaller domains include accept invite, account notice modal, usage, nav,
  shell, home, AI, and billing.

Known gaps:

- Old 126M seed counts are stale and must not be reused as current truth.
- Pages, Builder, Widget Defaults, Widgets, and Assets remain large/high-risk
  domains for later UI work.

## Domain Patterns

Current reality:

- Widgets uses local table, inline rename, row actions, loading/error/empty
  branches, and an upgrade modal.
- Pages uses local page list/source forms/localization tables/placement tables,
  add-instance modal, publish/copy controls, and unavailable package copy.
- Assets uses local table, storage labels, upload/delete state, and bulk upload
  modal.
- Builder hosts Bob in an iframe, sends `ck:open-editor`, maps Bob commands to
  same-origin Roma routes, and renders local copy/open/error status.
- Settings renders account language settings and owner-transfer controls.
- Account language settings save active locales and report overlay-update
  follow-up through success copy.
- Profile, Team, and Team Member use local forms and tables.
- Home, Billing, and AI are mostly static card surfaces.
- Usage has live storage usage state and broader-reporting unavailable copy.
- Upgrade actions currently route to `/billing`, while Billing says its provider
  is not connected. This is an execution gap: accepted D3 law keeps the actions
  but changes their destination to the shared upsell scaffold without claiming
  commercial success.

Known gaps:

- Tables, forms, modals, empty states, errors, and status messages are repeated
  by domain rather than expressed through one current primitive system.
- State handling is uneven by domain.
- Billing, usage, team, and pages expose implementation/environment copy that
  must be classified before later copy work.

## Save And Localization Boundary

Current reality:

- `PUT /api/account/instances/:instanceId` saves widget source/content and the
  base public package through Tokyo.
- Explicit translation generation is routed through
  `/api/account/instances/:instanceId/translations/generate`.
- The translation route calls Translation Agent and materializes locale packages
  after accepted translation generation.
- Bob's Translations panel has an explicit "Generate translations" action.
- Bob disables translation generation while the widget is dirty/saving or has no
  translation fields.
- Current audit found no top-of-builder stale-translation attention banner in
  Roma Builder UI.

Settled boundary:

- Translation attention already exists in Bob's Translations panel beside the
  authoritative summary and Generate action. Roma has no independent stale
  signal and must not invent one. The single owner is settled product law, not
  an open 126 decision.
- Save/translation product law must remain separated in later work.

## State And Feedback

Current reality:

- Account boundary has loading/auth/unavailable/reload states.
- Domain error boundary has a rendering error surface.
- Widgets, pages, assets, team, team member, profile, settings, and usage have
  some loading/error/empty/success handling.
- Home, billing, and AI are static card domains without domain-level
  loading/error/empty branches.
- Local modal/status patterns exist in widgets, assets, pages, Builder,
  profile, and account notices.
- Builder and Widget Defaults use browser `window.confirm` for in-app unsaved
  navigation. Browser/tab `beforeunload` is a separate browser-owned boundary.

Known gaps:

- Feedback surfaces are not centralized.
- Modal, toast/banner, inline error, loading, success, destructive confirmation,
  and attention-state semantics need later classification.

## Comparative Baseline

| Area | Current Strength | Current Gap |
| --- | --- | --- |
| Account authority | Same-origin Roma routes and current-account shell | UI work must not bypass product routes |
| Shell | Shared `RomaShell`/`RomaNav` structure | Preserve legitimate app composition; remove only dead or accepted Dieter-duplicate controls |
| Dieter | Tokens and button CSS loaded/used | Forms/toggles/popovers/tables/modals not broadly Dieter-class-based |
| Domains | Clear account product surfaces | Large domain files and repeated local markup |
| Widget Defaults | Compiled Bob/Dieter controls in the account-default host | Dead old local control CSS remains beside legitimate host layout |
| Builder | Explicit Bob host and command bridge | Translation attention remains Bob-owned; no Roma-owned signal is permitted |
| Save/localization | Separate save and translation routes; attention lives in Bob panel | Remove the invented Roma-banner gap from final doctrine |
| State | Many domains have some state handling | Uneven loading/empty/error/success model |
| Copy | Some product-law copy is explicit | Some implementation/environment copy remains visible |

## Known Stale Prior-Draft Content

- Prior references to `audits/126D__Audit__Roma_UI.md` are stale for this 126M
  Phase 1 audit. Codex Step 1 output is `audits/126M__AsBuilt_Codex.md`.
- Prior executable steps for shared primitives, domain porting, CSS deletion,
  monolith splitting, copy/state pass, docs sync, and acceptance criteria are
  not Step 2 doctrine.
- Prior save/localization addendum language describes product behavior and later
  UI obligations, but Step 2 does not execute route changes or the banner.
- Prior quantity claims must be replaced by current audit counts before any
  later executable PRD.

## Compliance To Architecture, Product, And Product Law

Architecture:

- Keeps Roma in the current-account app lane.
- Keeps Bob as editor and Tokyo/Berlin/San Francisco as named authorities.
- Records Dieter consumption without inventing a new component/runtime model.

Product:

- Describes current user-facing domains and current gaps.
- Does not change product behavior.
- Does not decide copy, component, or layout changes before convergence.

Product law:

- Keeps source/base save separate from explicit translation generation.
- Does not turn missing banner evidence into an invented state.
- Does not treat old seed material as executable truth.

## Original Step-2 Non-Decisions And Current Resolution

- No code changes.
- No Roma redesign.
- The old generic shared primitive list is rejected; only the two proven Dieter
  contracts in the decision register survive.
- Dieter adoption is bounded to accepted reusable controls/visual contracts;
  Roma shell and domain composition remain Roma-owned.
- CSS deletion is limited to proven dead or accepted duplicated contract CSS.
- No domain splitting.
- No save/translation route change.
- No stale-translation banner implementation.
- D1/D2/D3 doctrine is propagated. Exact gap, execution, and peer-review scope
  remain steps 6-8.

---

## Frozen GLM Addendum - Point-In-Time Phase 1 Step 2 Feedback

Status: FROZEN HISTORICAL INPUT - not current source truth and not executable
guidance. The renewed current baseline above overrides every conflicting claim.
In particular, the old Widget Defaults control block described below is dead
CSS around a current compiled Bob/Dieter runtime; execution deletes the dead
rules and preserves only legitimate host layout. This addendum remains solely
as provenance for what the earlier reviewer observed.

Adversarial critique of the two Codex Baseline sections from the earlier seed
against the GLM independent as-built pass (`audits/126M__AsBuilt_GLM.md`). Not
converged. GLM's pass was Bash-blocked this session, so GLM-verified evidence
covers `roma/app/layout.tsx` and `roma/app/roma.css` in full; the per-domain
TSX counts and `diet-*` usage counts remain PRD-claimed and are tagged as such
in the as-built. That limitation is stated up front so Codex's claims and GLM's
critique are read at the right confidence.

### What Codex gets right

- **"Roma loads Dieter tokens/component CSS and uses Dieter text buttons
  heavily, but still owns a parallel `.roma-*` / `.rd-*` screen/component
  layer."** GLM-verified. `layout.tsx:13-18` loads tokens + 5 component
  stylesheets, and `roma.css` is a 762-line parallel system
  (`roma.css:1-762`, GLM full read). Codex's framing is accurate.
- **"Inline/ad-hoc TSX styles ... are still present."** Plausible and
  consistent with the CSS-side inline-px escapes GLM did verify
  (`roma.css:190,194,202,675,684,711`). The TSX-side count from the old seed is
  PRD-claimed, not GLM-verified, but the phenomenon is real.
- **"Compliance reason: this frames Roma as the convergence target without
  changing account/product routes ... or save/translation behavior."** As a
  *framing* this is fine - and it is correctly labeled "not final doctrine."
  GLM agrees convergence is the right direction.

### What Codex misses or under-specifies

1. **Dieter is CSS-only here, not web components.** Codex's baseline reads as
   if `diet-textfield` / `diet-toggle` / `diet-segmented` / `diet-popover` are
   components to "adopt." In this codebase they are **class-name patterns**
   backed by globally-loaded CSS (`layout.tsx:14-18`); there are no custom
   elements imported. "Adopt Dieter components" therefore means "use Dieter
   class names + the loaded CSS," which materially changes what Step 2/3 port
   work looks like (markup + class swap, not `<diet-textfield>` element
   adoption). The baseline should state this so the steps don't over-promise an
   element migration that the codebase doesn't support.

2. **The `widget-defaults` subsystem is a *second* parallel form system inside
   the first, and Codex doesn't call it out separately.** GLM verified a 240+-
   line dedicated block (`roma.css:257-499`) with its own hand-rolled switch
   (`.widget-defaults-field--toggle input[type=checkbox]` styled as a toggle,
   `roma.css:419-461`), its own input (`roma.css:463`), its own textarea
   (`roma.css:475`), error styles, and a collapsible-cluster system that already
   references Dieter classes (`.tdmenucontent__cluster*`, `roma.css:350-403`;
   `.diet-btn-ic__icon`, `roma.css:377`). This is the densest hand-rolled
   control styling in the file and the strongest single site for `diet-toggle` /
   `diet-textfield` adoption. Codex's "parallel `.roma-*` / `.rd-*` layer"
   lumps it in; the convergence plan should enumerate it explicitly because it
   is where the most real toggle/textfield replacement work is.

3. **Inline-px escapes exist *inside `roma.css` itself***, not only in TSX. GLM
   verified six CSS-side hardcoded-px sites
   (`roma.css:190,194,202,675,684,711`). Codex's baseline and the prior draft
   both locate inline-px only in TSX. The tokenization guard's scope must
   include the CSS file, or these sites survive the TSX-only pass. This is a
   concrete gap.

4. **Historical responsive recommendation, superseded by D2.** GLM verified
   (`roma.css:724-760`) that the inspected implementation combined navigation
   collapse and table overflow at one `980px` breakpoint. Current law preserves
   truthful table overflow where the workspace needs it but explicitly rejects
   that breakpoint as device/product classification. Tablet keeps the desktop
   workspace; mobile landscape receives compact composition.

5. **The header inconsistency on `builder-domain.tsx` (869 vs 976 lines).** The
   prior PRD body said 869; the prior header note said it grew to 976. GLM could
   not reconcile. Step 0 recount must resolve this, and the baseline should say
   so rather than inherit the ambiguity.

### Where Codex over-claims or evidence is thin

- **"broad Dieter button usage" and "existing state branches in
  widgets/assets/pages" (old Codex Second Pass bullet 1).** "Broad" is a
  quantity claim that GLM did not re-verify and Codex's old baseline stated
  without its own count. "Existing state branches" was asserted without naming
  which states in which file. Both are directionally believable but
  under-evidenced in the baseline text itself.
- **"uneven states, local modals, and implementation-facing copy" as
  weakest-evidence (old Second Pass bullet 2).** Agree on direction; the
  as-built shows the *copy* and *modal* sites are concrete. "Uneven states" was
  the least grounded and needed a per-domain state matrix.

### Net

Codex's earlier baseline was a correct *directional* frame (parallel system
exists, Dieter is under-adopted, convergence not redesign). It was
**under-specified on three things that change execution**: (a) Dieter here is
class-name CSS, not custom elements; (b) the `widget-defaults` second form
system is the single biggest adoption site and should be named; (c) inline-px
escapes live in `roma.css` too, so the tokenization guard must cover the CSS
file. It also **inherited an unflagged number inconsistency** and made
**quantity claims** it did not independently back. None of this is a wrong
direction; it is thin where the as-built can now be specific. A later recount
must close the verified-counts gap before any baseline hardens into doctrine.
