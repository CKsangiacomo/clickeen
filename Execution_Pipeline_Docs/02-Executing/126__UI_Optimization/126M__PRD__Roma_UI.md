# 126M - PRD: Roma UI

Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).

Status: CODEX BASELINE ONLY - Phase 1 Step 2.

This is current reality plus known gaps only. It is not final doctrine, does not
converge with GLM, does not select fixes, and does not authorize Step 4+
execution. The old executable draft was seed material and is not preserved as
Codex doctrine in this baseline.

Primary Step 1 evidence:

- `audits/126M__AsBuilt_Codex.md`
- `audits/126M__AsBuilt_GLM.md`

Primary Step 3 evidence:

- `research/126M_Research_Codex.md`
- `research/126M_Research_GLM.md`

## Phase 1 Step 2 Boundary

This baseline may describe:

- current Roma UI reality;
- current route/product authority boundaries;
- known gaps;
- stale prior-draft/count warnings;
- non-decisions before Step 4 human convergence.

This baseline must not:

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

- Roma's forms, tables, cards, modals, grids, locale controls, and most domain
  states remain outside a Dieter-backed shared primitive layer.
- Later convergence must be class/markup-aware instead of assuming custom Dieter
  elements exist.

## Local UI Layer

Current reality:

- `roma/app/roma.css` is 762 lines.
- It defines layout, nav, headers, canvas modules, module surfaces, cards,
  code blocks, toolbar, account locale settings, inputs, form grids, fields,
  tables, cell actions, modals, Builder iframe, and mobile behavior.
- The `widget-defaults` block is a dense second local form/control system inside
  the Roma local layer.
- CSS-side raw pixel values still exist in Roma CSS.

Known gaps:

- `.roma-*`, `.rd-*`, and `widget-defaults*` are current local UI truth, not a
  converged system.
- The `widget-defaults` subsystem must be tracked separately from the general
  shell/table/form layer because it owns local toggle/input/textarea behavior.

## Shared Primitive Layer

Current reality:

- No `roma/components/ui` shared primitive folder exists in the current working
  tree.
- No current `DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, or
  `Toast` primitive implementation was found.
- Domains consume local classes and local markup directly.

Known gaps:

- The shared primitive layer described in old seed text is not current runtime.
- Step 2 does not choose whether that old primitive list is correct.

## Domain Size And Shape

Current line counts:

- `pages-domain.tsx`: 1106 lines.
- `builder-domain.tsx`: 973 lines.
- `widget-defaults-domain.tsx`: 718 lines.
- `widgets-domain.tsx`: 624 lines.
- `assets-domain.tsx`: 488 lines.
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

Known gaps:

- Backend route separation is not the same as complete UI fulfillment.
- A missing stale-translation banner is a current UI gap only; Step 2 does not
  choose stale evidence, copy, persistence, or implementation mechanics.
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
- Builder uses browser `window.confirm` for unsaved navigation.

Known gaps:

- Feedback surfaces are not centralized.
- Modal, toast/banner, inline error, loading, success, destructive confirmation,
  and attention-state semantics need later classification.

## Comparative Baseline

| Area | Current Strength | Current Gap |
| --- | --- | --- |
| Account authority | Same-origin Roma routes and current-account shell | UI work must not bypass product routes |
| Shell | Shared `RomaShell`/`RomaNav` structure | Local `.roma-*`/`.rd-*` shell primitives |
| Dieter | Tokens and button CSS loaded/used | Forms/toggles/popovers/tables/modals not broadly Dieter-class-based |
| Domains | Clear account product surfaces | Large domain files and repeated local markup |
| Widget Defaults | Rich account default editing surface | Dense second local form/control system |
| Builder | Explicit Bob host and command bridge | No found stale-translation attention banner |
| Save/localization | Separate save and translation routes | UI attention state for stale translations not present |
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

## Explicit Non-Decisions

- No code changes.
- No Roma redesign.
- No shared primitive list decision.
- No Dieter migration decision.
- No CSS deletion.
- No domain splitting.
- No save/translation route change.
- No stale-translation banner implementation.
- No final doctrine.
- No Step 4+ convergence.

---

## GLM Addendum - Phase 1 Step 2 (feedback, preserved)

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

4. **The single 980px breakpoint and its table-reflow behavior must be
   preserved by any `DataTable` primitive.** GLM verified (`roma.css:724-760`):
   below 980px the layout collapses, nav hides behind a drawer, and `.roma-table`
   becomes `display:block; overflow-x:auto; white-space:nowrap`. Codex's
   baseline doesn't mention responsive behavior; a naive `DataTable` primitive
   that doesn't replicate the horizontal-scroll reflow would regress mobile.
   Worth naming as a later acceptance detail.

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
