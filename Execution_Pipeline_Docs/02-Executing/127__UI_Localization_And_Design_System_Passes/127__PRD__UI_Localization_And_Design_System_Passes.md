# PRD 127 — UI Localization And Design-System Passes

Status: **EXECUTING — STAGE 1 COMPLETE; STAGE 2 IN PROGRESS**

Owner: Clickeen product owner/architect

Date: 2026-08-09

## 1. Purpose Of This Memo

This PRD is the execution memory for Clickeen's UI-language foundation and the
three planned UI improvement passes.

It exists so every AI agent returns to the same product decisions, folder
ownership, stage boundary, and explicit exclusions before changing UI copy,
Dieter components, Bob, Roma, generated Widget editor artifacts, or user UI
language preferences.

This is not authorization to execute every stage at once. The human product
owner/architect authorizes one stage and one UI pass at a time. A later stage
must not begin because an earlier stage made it technically possible.

## 2. Product Outcome

Clickeen will support a dependable product UI language without building a
second design system, spreading Widget labels into Bob, or making an open Bob
session recompile itself.

English remains the direct default. The majority English experience must not
wait for locale selection, fetch a translation file, or take a fallback path.
Non-English UI is selected only when the user explicitly enables the existing
primary-language preference for product UI.

The work is deliberately combined with the planned Dieter, Bob, and Roma UI
passes so the product finalizes English source, component contracts, and UI
behavior before translations are generated.

## 3. Product Laws

### 3.1 Two Categories Of Product UI Copy

All product UI copy belongs to one of two categories:

1. **Chrome copy** — copy outside Widget ToolDrawer panels. The surface that
   renders it owns it. Bob Chrome lives with Bob. Roma Chrome lives with Roma.
2. **Widget ToolDrawer labels** — every visible word rendered inside a
   ToolDrawer panel. The Widget owns those labels in its own adjacent label
   folder.

There is no third shared-copy category and no all-Widget label catalog.

### 3.2 Widget ToolDrawer Ownership

Each Widget declares the ToolDrawer structure it needs in `spec.json` using
label tokens. Its adjacent label folder owns the resolved copy:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  {widgetType}_tooldrawer_l10n_labels/
    en.json
```

The Bob compiler joins:

```text
Widget structure
+ exact Widget ToolDrawer labels
+ Dieter stencils
→ generated Widget editor artifact
```

The Widget does not implement Widget-specific UI. It declares panels,
sections, controls, options, placeholders, and actions using the supported Bob
compiler and Dieter component vocabulary.

### 3.3 Dieter Ownership

Dieter owns:

- tokens;
- component structure;
- component styling;
- component behavior;
- stencil inputs;
- supported states, sizes, and variants.

Dieter does not own caller copy. It has no translation catalog and no locale
folder. A Dieter component receives its visible wording from the surface or
Widget instance using it.

### 3.4 English Direct Default

English is the direct source and direct artifact path:

- English Widget ToolDrawer labels compile to the existing
  `/widget-editors/{widgetType}.json` path.
- English Roma and Bob Chrome do not require a locale lookup or translation
  fetch.
- Missing or invalid non-English truth must not silently fall back while
  claiming the selected language is active.
- No non-English experience is exposed until the final translation stage is
  structurally complete and verified.

### 3.5 User Preference

The existing person profile authority carries:

```text
primary_language
use_primary_language_for_ui
```

`use_primary_language_for_ui` defaults to `false`.

When it is false, product UI uses English directly. When it is true, Roma may
resolve the product UI language from the user's primary language after Stage 4
installs the complete product flow. The preference does not change Widget
content locale, account base locale, public Widget locale, or translation
overlays.

### 3.6 One UI Language Per Bob Session

Bob receives one resolved UI language when a Widget is opened. That language
is immutable for the lifetime of that open Bob session.

If the user changes UI language while Bob is open, Bob does not hot-swap,
recompile, or replace ToolDrawer state. The user sees this notice:

> Reopen this widget to use the UI language you selected.

The next open resolves the new language. This protects browser-memory edits,
dirty state, undo, preview, panel state, dialogs, and Product Copilot from an
unnecessary live editor rebuild.

## 4. Authority Map

| Concern                                                      | Authority                                              |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| User primary language and UI-language preference persistence | Michael/Supabase person truth                          |
| Profile normalization and bootstrap identity                 | Berlin                                                 |
| User-facing preference command and Bob-open coordination     | Roma                                                   |
| Bob Chrome source                                            | `bob/l10n/` when installed in Stage 3                  |
| Roma Chrome source                                           | `roma/l10n/` when installed in Stage 4                 |
| ToolDrawer structure                                         | Widget `spec.json`                                     |
| ToolDrawer copy                                              | Adjacent Widget `{widgetType}_tooldrawer_l10n_labels/` |
| Component structure, appearance, and behavior                | Dieter                                                 |
| Widget editor compilation                                    | Bob compiler and existing artifact generation          |
| Open-editor draft state                                      | Bob browser memory                                     |
| Current documentation                                        | `documentation/`                                       |
| Execution memory and evidence                                | This PRD 127 folder                                    |

No stage may move one of these concerns into another authority merely because
the code is convenient there.

## 5. Stage Status

| Stage                      | Status                                                                                                                                                                                                                                               | Release state                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Stage 1 — Scaffold only    | Complete                                                                                                                                                                                                                                             | Committed, pushed, and deployed; no non-English experience is exposed |
| Stage 2 — Dieter UI pass   | In progress: Foundations, the current component inventory through Textfield and Valuefield, and the new Datefield/Date Range Picker contracts are complete and re-audited as consumer-agnostic primitives; standalone Popaddlink and Textedit are deleted because their jobs were duplicate or unused | The Widget catalog is the next Stage 2 DevStudio tab                  |
| Stage 3 — Bob UI pass      | Not started                                                                                                                                                                                                                                          | No authority to begin until explicitly directed                       |
| Stage 4 — Roma UI pass     | Not started                                                                                                                                                                                                                                          | No authority to begin until explicitly directed                       |
| Stage 5 — Translation pass | Not started                                                                                                                                                                                                                                          | No translations may be generated yet                                  |

Update this table when a stage actually changes state. Do not infer completion
from the presence of scaffolding.

## 6. Stage 1 — Scaffold Only

### Objective

Build the English foundation without generating or exposing non-English UI.

### Required Work

- Define the two-category copy rule.
- Define the future Roma Chrome schema boundary.
- Define the future Bob Chrome schema boundary.
- Define the per-Widget ToolDrawer-label schema.
- Create English label files for the eight current Widgets.
- Move English ToolDrawer literals from `spec.json` into those Widget-owned
  files.
- Update the compiler to join Widget structure, English labels, and Dieter
  stencils.
- Preserve the existing English artifact path.
- Prove generated English ToolDrawer output and behavior remain unchanged.
- Define `use_primary_language_for_ui`, defaulting to `false`.
- Document the immutable-language-per-Bob-session rule.
- Keep every non-English UI path dormant.

### Current Implementation Shape

The eight current Widget folders contain one adjacent English label file. Raw
specs carry `$label:{key}` tokens. The compiler rejects missing, malformed, or
unused label entries and emits resolved English artifacts through the existing
artifact path. Resolved defaults and browser artifacts do not persist label
tokens.

The person preference is present as dormant profile data. Roma does not expose
the toggle, choose a UI locale, or pass a UI locale into Bob. Bob does not load
UI-language files or change an open session's UI language.

### Stage 1 Hard Stops

- No non-English translation generation.
- No non-English artifact path.
- No unfinished UI-language control.
- No remote product-data mutation.
- No Cloudflare change.
- No deployment unless separately authorized.
- No assumption that Stages 2–5 are already authorized.

## 7. Stage 2 — Dieter And DevStudio UI Pass

### Objective

Review the design system through DevStudio one tab at a time while making the
planned Dieter UI improvements. For each tab, prove both that the owning source
is coded properly and that the real product consumes it properly.

DevStudio is the human cockpit and visual execution agenda. It reveals source
truth; it is not a second design-system, Widget, catalog, entitlement, or model
authority.

### Per-Tab Execution Loop

For each DevStudio tab:

1. State what the tab is intended to own and which source is authoritative.
2. Inspect the complete canonical source contract.
3. Review every supported state, size, variant, interaction, and planned UI
   improvement represented by that tab.
4. Confirm DevStudio demonstrates the real source rather than a local imitation.
5. Inventory every real consumer in Bob, Roma, DevStudio, Widgets, Prague, or
   another current surface.
6. Confirm consumers use the canonical contract without unnecessary local
   reimplementation or override.
7. Identify only concrete current or reachable problems.
8. Make the smallest fix through the owning authority.
9. Verify the DevStudio reveal and every affected real consumer.
10. Record the result before advancing to the next tab.

A tab may pass unchanged. Listing a tab does not authorize redesigning it.

### Foundations Pass

Review in this order:

1. Core styles
2. Colors
3. Icons
4. Typography
5. Layouts

For Foundations, verify that DevStudio renders real Dieter source and that
product surfaces use the canonical tokens, icon contract, typography classes,
and layouts without parallel local systems.

### Dieter Components Pass

Review in this order:

1. Agent Activity
2. Bulk Edit
3. Button
4. Choice Tiles
5. Date Range Picker
6. Datefield
7. Dropdown Actions
8. Dropdown Border
9. Dropdown Edit
10. Dropdown Fill
11. Dropdown Shadow
12. Dropdown Upload
13. Menuactions
14. Object Manager
15. Popover
16. Popup
17. Repeater
18. Segmented
19. Slider
20. Table
21. Tabs
22. Textfield
23. Toggle
24. Valuefield

For every component used inside ToolDrawer panels:

- inventory every visible word it can render;
- remove wording internally hardcoded by Dieter;
- expose that wording through the component's existing stencil inputs;
- make the applicable Widget ToolDrawer label file provide the value;
- keep component structure, styling, behavior, and states in Dieter;
- keep all ToolDrawer copy ownership outside Dieter;
- regenerate the existing English Widget editor artifacts;
- verify the component in DevStudio and in real Bob/ToolDrawer use.

The same Dieter component may receive Bob Chrome, Roma Chrome, DevStudio, or
Widget-owned copy depending on where that component instance is rendered. The
component itself does not decide the language or source of that text.

### Catalog And Policy Pass

The DevStudio navigation also includes:

- Widget catalog;
- Entitlements;
- LLM Management.

These are reviewed in the same one-tab-at-a-time pass, but they are not Dieter
component authorities.

Widget catalog must reflect the real Widget authority and generation flow; it
must not become another Widget registry. Entitlements must reflect the existing
policy authority. LLM Management must reflect the existing managed-model
authority. Any correction remains with the named owner rather than being moved
into Dieter or DevStudio.

### Stage 2 Completion Gate

Stage 2 is complete only when:

- every listed DevStudio tab has an explicit pass result;
- every approved UI improvement is implemented through the correct owner;
- DevStudio truthfully demonstrates the real source;
- every affected product consumer uses the canonical Dieter contract;
- Dieter owns no caller-specific ToolDrawer wording;
- every visible ToolDrawer-panel string is supplied by its Widget label file;
- the generated English artifacts and real English behavior remain dependable;
- affected current documentation matches the implementation.

### Stage 2 Hard Stops

- No Dieter translation catalog.
- No Dieter locale folder.
- No bulk redesign merely because a component has a tab.
- No global Widget-label catalog.
- No locale selection or non-English generation.
- No unrelated Roma Home or navigation change. Roma Home is intentionally
  empty.
- No keyboard-navigation program or focus-system work unless the human product
  owner explicitly requests it.

## 8. Stage 3 — Bob UI Pass

### Objective

Complete Bob's planned UI improvements and install Bob UI-language ownership
without changing Bob's browser-memory editing model.

### Required Work

- Move all Bob Chrome strings into `bob/l10n`.
- Complete compilation of locale-specific Widget editor artifacts.
- Ensure every ToolDrawer string is supplied by its Widget label file.
- Open Bob with one resolved UI language.
- Keep that language immutable for the session.
- Implement the reopen-this-widget notice when the selected language changes
  during an open Bob session.
- Verify save, dirty state, undo, preview, panels, dialogs, and Product Copilot
  remain unchanged.

### Stage 3 Hard Stops

- No live Bob language swapping.
- No editor remount or draft replacement when preference changes.
- No Bob-owned all-Widget translation catalog.
- No persistence from Bob outside the existing Roma save command.
- No translation generation yet.

## 9. Stage 4 — Roma UI Pass

### Objective

Complete Roma's planned UI improvements and install the user-facing product UI
language choice through the existing user profile authority.

### Required Work

- Move Roma Chrome strings into `roma/l10n`.
- Use the existing `use_primary_language_for_ui` user-profile field.
- Expose the toggle in Settings and the appropriate main-navigation language
  control.
- Use `primary_language` for UI only when the toggle is on.
- Retain English as the direct default.
- Select the correct Bob artifact when opening a Widget.
- Show the reopen notice when preference changes during an open Bob session.
- Keep product UI language separate from account, Widget-content, and public
  locale authorities.

### Stage 4 Hard Stops

- No new profile or locale authority.
- No change to account base locale or saved content overlays.
- No English performance penalty through an unnecessary locale-resolution
  path.
- No translation generation yet.

## 10. Stage 5 — Translation Pass

### Objective

Generate non-English product UI only after English copy, component contracts,
and the Dieter, Bob, and Roma UI passes are stable.

### Required Work

- Translate Roma Chrome files.
- Translate Bob Chrome files.
- Translate each Widget's ToolDrawer-label file in that Widget's own folder.
- Verify every locale has exact structural coverage.
- Generate non-English Widget editor artifacts.
- Run the complete UI, compiler, artifact, build, and product-flow checks.
- Deploy through the existing authorities.
- Verify language selection through Roma and a newly opened Bob session.
- Verify an already-open Bob session retains its original language and shows
  the reopen notice after a preference change.

No translation is generated before the English folder structure and source
copy are final.

## 11. Explicitly Outside This Program

PRD 127 does not change or create:

- Prague localization;
- account Widget-content overlays;
- Translation Agent behavior;
- public Widget translation;
- Dieter locale catalogs;
- live Bob language swapping;
- a global Widget-label catalog;
- a new service or package;
- a locale registry;
- a compatibility layer;
- a new R2 root;
- Cloudflare topology or deployment machinery;
- Account Pages or Page Builder;
- a general accessibility or keyboard-navigation program;
- Roma Home content or landing-route behavior.

## 12. Verification Law

Every stage must prove its result through each owner it changes:

- source/schema verification;
- compiler and generated-artifact verification;
- Dieter and DevStudio verification when affected;
- Bob and Roma focused tests when affected;
- build verification for the changed surfaces;
- cloud-dev verification only after deployment is separately authorized and
  performed;
- documentation reconciliation;
- independent V1–V8 review for cross-system, shared-contract, deployment, or
  product-data work.

Local tests do not prove a live deployment. Source changes do not prove remote
product-data changes. Each stage closeout must say explicitly what changed,
what was verified, and what was not committed, pushed, deployed, or mutated.

## 13. Stage Transition Rule

At the end of a stage:

1. Update the stage status table.
2. Record exact files and authorities changed.
3. Record checks and runtime evidence.
4. Reconcile current documentation.
5. Complete V1–V8 when required.
6. Stop.

Do not start the next stage until the human product owner/architect explicitly
authorizes it.

## 14. Execution Record

### Stage 2 — Dieter And DevStudio UI Pass

- **Core styles — passed, 2026-08-09.** The 53 non-layout source tokens are
  generated from the canonical Dieter foundation file, use the same validation
  contract as the write route, and all have active consumers.
- **Colors — passed after correction, 2026-08-09.** The reveal now includes all
  138 color, role, focus, and state declarations. The four existing state-mix
  percentages are visible as read-only rows with representative color samples;
  color edit authority remains limited to literal `--color-*` hex values.
- **Icons — passed after systemic correction, 2026-08-09.** The human-selected
  source contains 165 icons. One SF exporter now generates every SVG with
  `currentColor` and a shared optical-canvas formula, so component slots no
  longer magnify tightly cropped glyphs differently. DevStudio reveals the SVG
  directory directly. Dieter, DevStudio, Bob, Roma, Prague, and Widgets do not
  maintain a second global approval list, compare the icon library against
  itself, or ask whether a declared Dieter icon is allowed. Product fields may
  still declare the exact choices that field offers.
- **Typography — passed after correction, 2026-08-09.** DevStudio reveals the
  31 real Dieter visual classes and uses one page-level editor for their 17
  shared live source tokens. Four unused tokens and one invalid DevStudio class
  were removed. The existing write boundary now preserves exact typed input and
  visibly rejects invalid sizes or line heights instead of trimming or
  committing a changed value. Public Widget runtime now uses saved
  `typography.roleScales` as its sole scale authority; Roma rejects missing
  declared roles, scales, tracking presets, or line-height presets before save,
  and Countdown's formerly implicit values are explicit. Prague font delivery
  remains deferred to the Prague pass by owner direction.
- **Layouts — passed after correction, 2026-08-09.** The artificial three-frame
  placeholder showcase was removed completely. DevStudio now serves the actual
  purpose of this tab: an AI-operable architecture map of the shared
  Roma/DevStudio application shell, Bob's separate editor composition, and the
  public Widget Stage/Pod/Shell/Header/Core composition. Each map names exact
  classes, owner, consumers, and source path. The four real application-layout
  tokens retain their existing validated edit path; no product layout behavior
  changed.
- **Agent Activity — passed after correction, 2026-08-09.** Dieter now
  exposes the real required title plus multi-row narration contract used by
  Bob, with `sm`/`md` sizes, `--color-system-purple-5` active surface, and one
  thin animated system-color gradient stroke. The component owns no visible
  words. Every current Widget declares the static title token and resolves it
  from its adjacent English ToolDrawer label file into the existing editor
  artifact; Bob consumes that exact value while Translation Agent events remain
  the dynamic row authority. DevStudio renders the source contract directly.
  No translation, locale, Translation Agent, product-data, Cloudflare, or
  deployment work is included in this component slice.
- **Button — unified after the Bulk Edit audit, 2026-08-10.** The three old
  text, icon, and icon-text Button classes were deleted. One `.diet-button`
  now composes optional direct Icon and label children, requires
  `data-size="small|medium|large"`, and uses visual-hierarchy
  `data-type="primary|secondary|tertiary|quaternary"`. Primary is filled blue,
  secondary is quiet gray, tertiary inherits the former outlined line
  treatment, and quaternary has no resting background or border; action wording
  does not create another Button type. Button composition explicitly supports
  no Icon, an Icon at the start or end of its label, or an accessible icon-only
  control without creating another Button class. Direct child order owns Icon
  placement; there is no position attribute or CSS reordering. The corrected
  small/medium/large geometry is `1.5rem/1.75rem/2.5rem` high with
  `.75rem/.875rem/1rem` text, `.25rem/.375rem/.5rem` child gaps, and
  `.5rem/.5rem/1rem` inline padding. Their radii scale at
  `.1875rem/.25rem/.375rem`. An unsized direct Icon scales with Button size at
  `.75rem/1rem/1.25rem`; an explicit numeric Icon size remains available and
  authoritative. Hidden label padding, repeated Icon dimension rules,
  redundant composite Button resets, and duplicate Button selectors were
  removed. Dieter composites, DevStudio, Bob, Roma, and current Widget source
  use the same contract. DevStudio loads the Icon primitive once at its
  application boundary so every component reveal honors the source contract.
  Menu Actions remains its separate menu-row component.
- **Choice Tiles — passed after correction, 2026-08-10.** The previous
  `sm|md|lg` API changed only Button text and an explicitly injected
  `12/16/20` Icon while every tile retained one fixed height, padding, gap, and
  radius. Choice Tiles now owns one proportional size authority:
  `4rem/4.5rem/5rem` minimum heights, `.5rem/.5rem/.75rem` block padding,
  `.25rem/.5rem/.5rem` internal gaps, `.25rem/.375rem/.5rem` radii, and
  `1rem/1.25rem/1.25rem` unsized Icons. Large uses `0.9375rem` text with a
  `1.25rem` line height; small and medium retain their corresponding Button
  typography. Inline padding remains `.5rem`; the row
  gap is `.25rem` at small and `.5rem` at medium/large so ordinary labels retain
  useful width in the ToolDrawer. The separate rendered Icon-size input is
  removed. Exact caller labels wrap rather than truncate. DevStudio
  reveals three distinct real Icons across all sizes plus the current
  two-option text-only composition. All six current Widget controls across Big
  Bang, Call to Action, Cards, Countdown, and FAQ already supply the group and
  option copy through their adjacent English ToolDrawer label files; no Dieter
  copy, catalog, locale folder, non-English artifact, or runtime locale path was
  added. Selection and string binding remain unchanged.

- **Dropdown Actions and Popover — passed after correction, 2026-08-10.** This
  was a component-only slice; it did not migrate Widget, Bob, or Roma
  consumers. Dropdown Actions retains the intended closed-state UX: the row
  shows its caller-supplied label and current value, hover discloses the
  interaction, and no resting chevron was added. Opening replaces the row with
  its attached Popover; selecting a Menu Action updates the bound value and
  closes immediately without an Apply footer. The root `sm|md|lg` value is now
  the sole component geometry and typography authority, using
  `1.25rem/1.5rem/1.75rem` trigger heights and
  `.6875rem/.8125rem/.875rem` text. Current ToolDrawer instances remain `md`.
  The standard Popover header now contains only its caller-supplied label; the
  useless decorative Icon was removed. Popover structure owns no example or
  fallback words, and Dropdown Actions continues to receive its label,
  placeholder, group labels, option labels, and badges through its existing
  inputs. DevStudio reveals closed `sm|md|lg`, open `md`, and generic Popover
  source states. The eight existing English Widget artifact pairs were
  regenerated from that canonical component source; no Widget, Bob, or Roma
  consumer source was rewritten. No validator, compilation guard, locale file,
  translation generation, runtime locale path, or adjacent component cleanup
  was added.
  A visual-QA follow-up removed the selected checkmark's fixed `12px` size so
  it now follows Menu Actions at `12/16/20px` for `sm/md/lg`, and removed the
  Popover header's second inline inset so header and body share one left edge.
  The attached Popover now inherits the Dropdown Actions `sm|md|lg` radius,
  and opening the control no longer adds a separate blue border or tint to the
  covered trigger.
  Dieter applies that size to both the canonical direct Icon and the nested
  Icon shape still authored by Bob account-font menus and Roma Dropdown
  Actions. Their redundant `data-size="12"` attributes remain explicitly
  deferred to the Bob and Roma consumer passes rather than expanding this
  component-source correction.

- **Dropdown Border — passed after correction, 2026-08-11.** The former
  component mixed fixed medium typography, mismatched trigger/Popover radii,
  an open-state blue treatment, internally owned words, a decorative header
  Icon, and permissive value repair. It is now one global Dieter component with
  no Widget-specific modes or compiler branches. Its exact value is
  `{enabled:boolean,width:number,color:string}`. Root `sm|md|lg` coherently owns
  `1.25rem/1.5rem/1.75rem` trigger heights, `.25rem/.375rem/.5rem` trigger and
  Popover radii, `.6875rem/.8125rem/.875rem` text, and
  `.75rem/1rem/1.25rem` Icons. The closed trigger shows width followed by the
  color chip for an active border and the existing `square.slash` Icon for no
  border. The Popover header contains only the caller field label; Enabled
  sits directly below it, and its false state hides the dependent color and
  width controls without replacing their exact stored values. Color, width,
  and enabled operations change only their own property.
  All visible words now come from each Widget's adjacent English ToolDrawer
  label file. Widget specs declare the component labels and exact generated
  field-path labels; directly authored Dropdown Border fields retain their
  ordinary label tokens. Bob generically joins those inputs with the Dieter
  stencil. All eight current Widgets regenerate against that same contract,
  and all 31 current ToolDrawer uses remain `md`. No global label catalog,
  Dieter locale folder, Widget exception, compatibility path, translation,
  product-data mutation, Cloudflare change, or deployment machinery was added.

- **Shared property-menu row rails — passed after correction, 2026-08-11.**
  This component slice reused `components/shared/property-row.css`; it did not
  add a row component, wrapper, schema, hydrator, compatibility path, or
  validation layer. Dropdown Actions and Dropdown Border now keep the complete
  caller field label on the leading rail and a right-aligned trailing rail.
  Dynamic value text yields first and receives the end ellipsis; a fixed chip
  or Icon remains visible. Compound values author text before the visual.
  Rest and hover preserve identical geometry and hover applies to the complete
  clickable row. Dropdown Actions is the simple label/value reference.
  Dropdown Border is the compound reference: `1px` followed by the color chip,
  or only `square.slash` for no border.
  The Border hydrator now consumes its exact three-property Widget value
  directly. Its former fallback value, malformed-source mode, invalid-Hex UI,
  diagnostic label, compiler attribute, Widget label tokens, and matching CSS
  were removed. The existing picker conversions and native interaction math
  remain component behavior; runtime product work does not depend on a new
  validator or test path. All eight English Widget artifact pairs and the two
  DevStudio component reveals were regenerated from the existing authorities.
  Dropdown Upload remains the separate single-file workflow and other
  property-menu components remain unchanged for their own passes.

- **Builder hydration correction — passed, 2026-08-11.** The deployed
  component pass exposed an existing host-order fact: compiled ToolDrawer JSON
  inputs begin empty because their current values belong to the opened Widget
  instance, while Dieter hydration previously ran before Bob supplied those
  values. Dropdown Border now consumes exact state directly, so parsing the
  empty compiled placeholder correctly failed the Appearance panel instead of
  inventing a border. Bob now writes its already-loaded instance JSON values
  into the existing `data-bob-path` fields before activating Dieter controls.
  Roma Widget Defaults performs the same existing value sync before its shared
  control-host hydration. No default, fallback, repaired state, Widget special
  case, compatibility path, or new lifecycle system was added. The existing
  authenticated Builder smoke now opens Appearance and requires a rendered
  Dropdown Border with no controls-load error.

- **Shared remaining-dropdown presentation — passed, 2026-08-11.** This
  bounded slice extended the existing property-row authority from Dropdown
  Actions and Dropdown Border to Dropdown Edit, Fill, Shadow, and Upload. The
  complete caller label now stays on the leading rail; the right-aligned
  trailing rail owns the dynamic value; only that value receives an end
  ellipsis; and Fill and Shadow author value text before their fixed visual.
  Rest and hover preserve the same rail positions. Root `sm|md|lg` now gives
  all four triggers `1.25rem/1.5rem/1.75rem` heights and matching
  `.25rem/.375rem/.5rem` attached-Popover radii. Opening Fill, Shadow, or
  Upload no longer adds a separate blue trigger treatment. Their standard
  Popover headers contain only the caller label; the dead decorative
  `headerIcon` compiler/spec input and Upload's decorative rest Icon were
  removed. Bulk Edit's existing copied single-file Upload composition was
  brought to the same source structure. No selection, rich-text editing,
  fill, shadow, upload, binding, persistence, copy, validation, translation,
  Widget-specific behavior, or new shared component was added or changed.
  Those four components still receive their own behavior and copy review in
  the listed Stage 2 order. DevStudio source generation, all eight Widget
  artifact pairs, Dieter governance/typecheck, Bob and Roma typechecks and
  focused contracts, DevStudio typecheck/build, browser-computed rail/open/
  radius proof, and diff checks passed.

- **Completed-component primitive and localization audit — passed after
  correction, 2026-08-11.** Agent Activity, Bulk Edit, Button, Choice Tiles,
  Dropdown Actions, and Dropdown Border were re-audited together against one
  rule: Dieter owns reusable structure, presentation, and interaction; it does
  not own consumer meaning or visible ToolDrawer words. Dropdown Actions no
  longer inspects `typography.roles.*` or carries font weight/style metadata;
  Bob's existing account-font binding owns that filtering. Bulk Edit no longer
  contains unused Logo Showcase upload, account-asset, account-policy, or
  auto-name branches. Its current generic text/checkbox table receives all
  trigger, dialog, action, column, placeholder, and empty-state copy through
  the consuming Widget's adjacent label file. Agent Activity's static title
  now uses the same component-label shape as other global ToolDrawer component
  inputs: `editor.labels.components["agent-activity"].title` in Widget source
  and `compiled.toolDrawerLabels.components["agent-activity"].title` in the
  English artifact. Button and Choice Tiles retain caller-supplied labels;
  Dropdown Actions retains caller-supplied label/options; Dropdown Border
  retains caller-supplied field/component labels. No Dieter copy catalog,
  consumer branch, locale folder, compatibility path, service, runtime locale
  path, product-data change, or Cloudflare change was introduced. All eight
  English Widget artifact pairs, DevStudio source generation/build, Dieter
  typecheck/governance, Bob typecheck and full focused suite, Roma typecheck
  and Widget command gates, repository typecheck/lint, exact label-shape scans,
  and diff checks passed.

- **Dropdown Edit — passed, 2026-08-11.** The global Dieter primitive now uses
  pinned, locally bundled Lexical for its inline rich-text editing behavior;
  no browser runtime request or new Clickeen package/service was introduced.
  The Popover provides Bold, Italic, Underline, Strikethrough, Link, Remove
  link, and selected-only Clear formatting, with no automatic text selection.
  Every Dropdown Edit field supports links. The persisted value remains the
  existing compact inline HTML string using `strong`, `em`, `u`, `s`, `a`,
  and `br`; pasted block boundaries become `br`, and empty remains exactly
  `""`. The closed-row summary presents those line breaks as spaces without
  changing the bound HTML. Bob continues to own browser-memory draft, undo,
  preview, and Save. All visible component and field words resolve
  from each Widget's adjacent ToolDrawer English file through the existing
  compiler and English artifact path. The duplicated FAQ editor markup was
  replaced by shared structured Dropdown Edit declarations. FAQ questions and
  Cards titles are now correctly declared as rich text, and saved Widget
  renderers preserve links for every Dropdown Edit-backed field. FAQ accordion
  markup keeps the rich-text question and its actual expand control as
  siblings, so following a question link does not toggle the accordion. No
  per-Widget editor mode, per-field link flag, global label catalog, locale
  folder, compatibility path, storage migration, Translation Agent change,
  Cloudflare change, or non-English generation was added.
- **Dropdown Edit link-action and Icon correction — passed, 2026-08-11.** The
  toolbar and link-sheet close controls now use the existing medium Button
  geometry. At this point both used its 1rem Icon size; the later toolbar-sizing
  follow-up below moves only the six editor commands to 1.25rem. The link sheet
  now has one contextual action
  in one position: selected unlinked text shows an editable URL with **Add
  link**; an existing link shows its URL read-only and changes the same action
  to **Remove link**. Changing a URL is remove then add. The former Apply and
  second Remove-link buttons are deleted. All eight Widget-adjacent English
  contracts replaced the old Apply key with the exact Add-link key; Bob's
  existing compiler still joins those labels into the one Dieter stencil. No
  new link workflow, catalog, compatibility alias, validation layer, storage,
  route, product-data, or deployment machinery was added.

- **Shared Popover work-area widths — passed, 2026-08-11.** Popover now owns
  one independent `row|wide|extra-wide` width contract for the four work-area
  dropdowns: Border, Edit, Fill, and Shadow. Row matches the closed row; wide
  and extra-wide preserve its left edge and add exactly 40px or 80px to the open
  surface's right edge over the workspace. The existing shared dropdown
  hydrator positions expanded Popovers above ToolDrawer clipping and keeps
  them aligned while the row scrolls or resizes. Widget field attrs pass the
  width through Bob's existing stencil context; the choice does not change
  `sm|md|lg` control geometry, copy, value binding, editor behavior, the
  ToolDrawer width, or the workspace layout. Dropdown Actions and Upload stay
  at row width. DevStudio generates the generic Popover widths and open
  Border/Edit/Fill/Shadow examples from the real Dieter specs. No portal,
  Widget branch, new component, locale path, validation layer, service,
  storage, product-data, Cloudflare, or deployment change was added.

- **Popover width defaults and work-area optimization — passed,
  2026-08-11.** The width vocabulary is now the final hard-cut
  `row|wide|extra-wide` contract; the former names do not remain as aliases or
  compatibility selectors. Dropdown Border, Fill, and Shadow own `wide`
  (+40px) as their global component default. Dropdown Edit owns `extra-wide`
  (+80px). Current Widgets therefore receive the intended work area from the
  Dieter component specs without repeating attrs or adding Bob/Widget-specific
  branches. Border, Fill, and Shadow removed their three six-column swatch-row
  wrappers and now render one direct nine-column palette grid, producing two
  rows at the default wide width. Edit gives its extra width directly to the
  writing surface and toolbar. Actions and Upload remain row-width. DevStudio
  and all eight English Widget artifact pairs were regenerated from the same
  source contract. No component behavior, value binding, Widget meaning,
  locale contract, validation layer, service, storage, product data, or
  Cloudflare authority changed.

- **Dropdown Border rhythm and Dropdown Edit toolbar sizing — passed,
  2026-08-11.** The shared Slider primitive now lets its range input consume
  the complete remaining inline space instead of retaining the browser's
  intrinsic range width. Dropdown Border applies that existing primitive with
  one `2.5rem` Hue/Width label rail, so both tracks start and end together,
  and its medium dependent controls use one `.5rem` vertical rhythm. Dieter's
  stylesheet order now loads the Slider primitive before its dropdown
  compositions, while DevStudio explicitly loads that shared primitive for
  isolated component reveals. The
  Dropdown Edit rich-text toolbar keeps its existing medium Button geometry
  while its six command Icons explicitly use Dieter's existing 1.25rem Icon
  size. The separate link-sheet close control remains unchanged at the medium
  Button's default 1rem Icon. No Widget branch, new size, component variant,
  validator, fallback, repair path, persistence behavior, locale contract,
  product data, or Cloudflare authority was added or changed.

- **Dropdown work-area proportion correction — passed, 2026-08-11.** The
  wider Dropdown Border work area no longer retains its former narrow-surface
  spectrum height: the saturation/value canvas is now `8rem/9rem/10rem` for
  `sm|md|lg`, making the current medium canvas 9rem. Its 18 color swatches no
  longer carry gray boxes; only white retains one gray resting edge, while
  every selected color keeps the existing blue outline. Dropdown Edit now
  applies the same `.5rem` spacing between its Popover header, editor, and
  toolbar that it already used inside the editor composition. No Widget,
  consumer, value, picker, rich-text, locale, persistence, or deployment
  contract changed.

- **Dropdown Border swatch proportion follow-up — passed, 2026-08-11.** Each
  swatch is centered in its existing nine-column grid cell with `0.125rem`
  removed from both dimensions and from the component corner radius. Colored
  swatches remain borderless, white retains its one-pixel gray resting edge,
  and selection now uses a one-pixel blue outline instead of the former
  two-pixel ring. No picker, color, value, Widget, locale, or consumer behavior
  changed.

- **Completed-component contract cleanup — passed, 2026-08-12.** Product
  compilation no longer borrows labels, placeholders, options, Bulk Edit
  columns, or action words from Dieter DevStudio example contexts;
  `headerLabel` now follows the same existing ToolDrawer label-token contract.
  Bulk Edit parses the browser-decoded column JSON exactly once. The shared
  JSON marker is now consumer-neutral `data-dieter-json`, and Bulk Edit's
  existing multi-path event is `dieter-ops`; Bob and Roma consume the same
  exact payload with no compatibility alias. Bob, Roma Widget Defaults, and
  DevStudio now destroy hydrated Dropdown Actions, Border, and Edit roots
  before replacing them, and Dropdown Edit detaches its local Lexical root.
  No new registry, validator, fallback, repair path, service, storage,
  translation, product-data, or Cloudflare machinery was added.

- **Dropdown Fill — passed, 2026-08-12.** Dropdown Fill is now one
  consumer-agnostic exact-JSON Dieter primitive. Every field declares its
  supported `color|gradient|image|video` modes through `fill-modes`; the former
  path/label-based image inference and `allow-image` compatibility input are
  deleted. All visible and accessible component words are exact caller inputs.
  The eight Widget specs declare one identical 24-key component-label shape,
  shared generated Fill paths declare their field-label coordinates, and each
  adjacent English ToolDrawer label file owns the corresponding words. Bob's
  existing compiler joins that copy into the single Dieter stencil; it does
  not read DevStudio example copy or add Widget-specific branches.

  The closed row follows the existing shared leading-label/trailing-value
  geometry. The component-owned `wide` Popover exposes solid, gradient, image,
  and video panels with one coherent rhythm. Solid and gradient color editors
  use the shared Slider/Textfield geometry, compact `8rem/9rem/10rem` canvases,
  one direct nine-column palette, two-pixel-smaller swatches, a gray resting
  edge only on white, and a one-pixel selected outline. Gradient edits retain
  the declared `linear|radial|conic` kind instead of converting saved truth to
  linear; the retired CSS-only gradient compatibility shape is removed. Image
  and video reuse the existing account-assets client and existing product
  command path. Their actions use Dieter Button/Icon contracts and their
  dynamic statuses/errors come from caller copy. The shared asset denial event
  is consumer-neutral `dieter-upsell` with the same payload and host behavior.

  Dropdown Fill now exports `destroyDropdownFill`; Bob, Roma Widget Defaults,
  and DevStudio call it before replacing hydrated roots, canceling pending
  media resolution and releasing retained component state. DevStudio reveals
  the real closed size ladder plus one open editor whose own controls exercise
  all four modes without overlapping permanent Popovers. Generated English
  editor artifacts remain at the existing path. No non-English
  generation, new catalog, registry, component variant, route, storage,
  product-data mutation, Cloudflare topology, fallback, repair path, or
  compatibility layer was added.

- **Dropdown Fill systemic UI correction — passed locally, 2026-08-12.** The
  first Fill pass established the exact value, l10n, account-assets, and host
  lifecycle contract, but its open UI retained four unrelated mode Buttons,
  a second remove-fill action, a duplicate native-color strip, and two-column
  Hex/opacity fields. This correction keeps that behavior authority and
  replaces only the wrong composition.

  The Popover now follows one order: caller label, Enabled, the existing
  icon-only Segmented primitive when multiple modes were declared, then
  the active editor. Enabled off writes exact `none`, hides dependent controls,
  and keeps the exact prior fill only in the open component session for an
  explicit re-enable. The separate Remove fill action and label key are gone;
  the exact shared 24-key shape now supplies Enabled instead. The closed none
  state uses `square.slash`. The seven remaining obsolete `allow-color`
  authoring attrs were removed; `fill-modes` is now the sole declared mode
  contract in every current Widget.

  Nested Toggle, Segmented, Slider, Textfield, and Button primitives use the
  root component's `sm|md|lg` size; the current product use remains `md`.
  Solid and gradient modes use a compact `6rem/7rem/8rem` canvas ladder,
  full-width Slider tracks, trailing opacity values, one Hex row, and the
  existing two-row palette. Image and video retain their exact fill values,
  account-assets client, upload/choose/remove flows, and dynamic caller copy;
  only their surface height follows the same compact ladder. Opening an empty
  media mode does not rewrite or misreport the stored fill, while an explicit
  Remove asset action remains final and is not resurrected by the session-only
  Enabled memory. DevStudio uses
  the actual Segmented dependency and reveals the real open medium component.
  All eight generated English editor artifact pairs were regenerated. No new
  picker primitive, shared color abstraction, Widget branch, validator,
  fallback, compatibility path, route, storage, product-data operation, or
  Cloudflare machinery was added.

  Local verification passed: all 8 Widget artifact pairs and generated Widget
  definition sources are exact; Dieter governance and typecheck, DevStudio
  typecheck/build, Bob compiler contract/typecheck/build, Roma Widget Defaults
  and command gates/typecheck/build, root typecheck/lint, and diff checks are
  green. Chromium exercised all four modes at the real medium `wide` geometry:
  288px Popover, 272px editor, four equal mode segments, 112px color/media
  surfaces, exact `none` on disable, hidden dependent controls, and exact prior
  color restoration on re-enable.

- **Dropdown Fill Icon correction — passed locally, 2026-08-12.** The Fill
  mode selector remains the existing icon-only Segmented primitive, but its
  glyphs now use the established 1.25rem rich-editor toolbar Icon size at every
  Fill root size. The current medium ToolDrawer selector therefore matches the
  established Dropdown Edit toolbar scale instead of the ordinary medium
  Button's smaller default Icon. The gradient-stop action
  remains one contextual Button, but its add and remove glyphs are now two
  ordinary pre-rendered Dieter Icons whose visibility changes with the action;
  the inactive Icon is explicitly removed from layout by one component-scoped
  hidden rule.
  The former post-hydration `data-icon` rewrite is deleted; it could expose an
  unmasked color square in DevStudio after its inline-SVG hydration. No new
  icon loader, component, fill behavior, Widget branch, locale key, value
  contract, compatibility path, service, storage, product data, or Cloudflare
  machinery was added.

- **Dropdown Fill empty-media summary correction — passed locally,
  2026-08-12.** Selecting image or video without choosing an asset now writes
  the exact `none` fill and keeps that media editor open for the current
  interaction. The closed property row therefore shows the existing
  `square.slash` no-fill Icon instead of retaining the prior color chip. The
  obsolete CSS rule that forced the hidden chip back into the trailing rail is
  removed, so the no-fill Icon occupies the exact centered trailing position
  by itself. Roma Widget Defaults' existing control synchronization now emits
  `external-sync` only when the projected value actually changed; an unchanged
  exact `none` therefore does not close the media editor that initiated it.
  No new state shape, fallback, validator, repair path, Widget
  branch, locale key, asset behavior, route, storage, or Cloudflare machinery
  was added.

- **Dropdown Shadow — passed locally, 2026-08-12.** Dropdown Shadow now edits
  the existing exact `{enabled,inset,x,y,blur,spread,color,alpha}` object
  directly through the established property-row and attached `wide` Popover.
  The closed row shows exact opacity before its base-color chip whenever the
  shadow is enabled, including `0%`, and only `square.slash` when disabled.
  The Popover repeats the caller label, places Enabled first, then reveals a
  live non-clickable shadow preview, axis-appropriate Horizontal/Vertical
  controls, Blur, Spread, Opacity, and the compact Hue/Hex/two-row color editor.
  Every numeric row has one complete leading label, one flexible Slider track,
  and one fixed trailing `px`/`%` value.

  The fake default shadow, missing-`inset` substitution, incoming clamps,
  component-local invalid mode, native color-picker shortcut, and unrelated
  color rewrite are deleted. Each interaction mutates only its exact property;
  disabling and axis presentation preserve all other values. All eight Widget
  specs now declare the same exact eleven-key Shadow component-label contract
  plus exact generated Stage/Pod/card field labels, with English copy owned by
  each adjacent ToolDrawer label file. Bob's hardcoded `Shadow` fallback and
  generated Stage/Pod copy are gone. Shadow now exports the established destroy
  function and joins Bob/Roma/DevStudio host teardown without a new lifecycle
  system. DevStudio reveals real enabled, disabled, inset, x-only, and y-only
  values. No Widget behavior, defaults, save route, storage, API, translation
  generation, validator, compatibility path, product data, or Cloudflare
  machinery changed.

  Focused verification passed: Dieter typecheck/governance, DevStudio
  typecheck/build and browser hydration/lifecycle, Bob typecheck and full
  compiler suite, Roma typecheck/defaults/command/package/save checks, Widget
  source generation, and all eight English editor artifact pairs. The
  independent post-implementation audit found no remaining defect and passed
  V1–V8.

- **Dropdown Shadow runtime completion — passed locally, 2026-08-13.** The
  editor pass exposed two real runtime defects: internal Stage/Pod shadows were
  being converted into directional gradient strips, and Stage outside shadow
  was drawn on the iframe boundary where it could not be seen. FAQ also
  declared Q&A-card inside-shadow state without applying it to the cards.

  The existing shared appearance runtime now consumes the exact
  `{enabled,inset,x,y,blur,spread,color,alpha}` object. Outside contexts require
  `inset:false`; inside contexts require `inset:true`; a mismatch fails instead
  of being silently rewritten. Linked internal rendering uses the exact `all`
  object. Unlinked rendering preserves the exact signed X/Y, blur, negative or
  positive spread, color, and opacity of top/right/bottom/left and emits one
  ordered comma-separated inset `box-shadow` list. The existing above/below
  content layer remains the composition authority. Gradient approximations,
  clamping, default-color substitution, and inset forcing are removed from the
  shared shadow path.

  Stage outside shadow remains a real Stage `box-shadow`. The widget document
  now creates deterministic top/right/bottom/left gutters from that exact
  shadow geometry, keeps viewport sizing inside those gutters, and includes
  their width and height in the existing iframe resize message. Bob consumes
  that existing resize event and removes only the temporary loading background
  after Widget ready. Disabled or zero-opacity Stage shadow adds no gutter.

  Bob no longer copies linked internal-shadow edits into hidden values. The
  link toggle and active `all`/side object each write only their own path, so
  switching between linked and unlinked preserves every previously edited
  object. FAQ's existing Q&A-card `insideShadow` now renders on every generated
  card through `CKSurface` variables and FAQ presentation CSS; no shadow math
  or Widget-specific editor branch was added to FAQ.

  The same Widget-owned Shadow label schema now includes the link labels and
  the shared layer/below-content/above-content copy. All eight adjacent English
  files and specs carry the same shaped contract, and the compiler no longer
  writes those phrases. This current fourteen-key component/composition shape
  supersedes the earlier editor-only eleven-key record above. All eight editor
  artifact pairs were regenerated.

  Focused verification passed: exact shared-shadow runtime tests; browser
  computed proof for Stage outside gutters, Stage/Pod true inset shadows, FAQ
  per-card inset shadows, and above/below layering; Bob linked-value
  preservation and editor-contract tests; all eight artifact-pair checks; Bob
  and Roma typechecks; and scoped diff checks. No new component, service,
  registry, storage authority, route, product-data mutation, Cloudflare change,
  deployment, or compatibility path was added.

- **Dropdown Upload — passed locally, 2026-08-13.** Dropdown Upload is now one
  consumer-agnostic single-file editor with one exact JSON value:
  `null | {assetRef:string,name:string}`. The retired primary-string plus
  `meta-path` split, `source:"user"` value field, component-local file limits,
  arbitrary nested preview template, hardcoded UI copy, and duplicate local
  asset validation are deleted. Empty is exact `null`; a selected file retains
  the account asset reference and exact filename together.

  The component now follows the completed dropdown system: the shared
  property row keeps the caller label on the leading rail and the placeholder
  or filename on the right-aligned trailing rail; only the filename truncates.
  Its row-width Popover repeats the caller label, contains one preview surface
  and one native file input, and exposes Upload when empty or Replace and
  Remove when selected. Root `sm|md|lg` owns the row, Popover, typography,
  preview geometry, Icon, and nested Button size. The caller-supplied
  account-assets client remains the only upload/resolve seam; Roma and Tokyo
  retain policy and storage authority. DevStudio supplies a local in-memory
  showcase client so the generated page can demonstrate selected, upload,
  replace, preview, and remove behavior without remote data.

  All visible and accessible wording is caller input. Bob joins the exact
  five-key `dropdown-upload` component-copy shape only when a Widget declares
  the field, using the same adjacent ToolDrawer label contract as the completed
  components. None of the eight current Widget specs declares Dropdown Upload,
  so this pass added no fake Widget field or unused Widget labels. Bob compiles
  one JSON control, accepts only exact `null` or `{assetRef,name}` session
  values, and its existing account-assets command path remains unchanged.
  Dropdown Upload now exports `destroyDropdownUpload`; Bob and DevStudio release
  its state and pending asset resolution through the existing Dieter host
  teardown seam.

  Focused verification passed: Dieter typecheck and governance, DevStudio
  generation/build/typecheck, Bob editor-contract tests and typecheck, Widget
  definition-source generation, all eight current Widget artifact pairs, and
  diff checks. Local Chromium hydrated all four DevStudio examples without page
  errors, resolved the selected SVG, wrote exact `null` on Remove, uploaded and
  previewed a new SVG through the local showcase client, and wrote one exact
  `{assetRef,name}` value. No account data, route, storage, product data,
  Cloudflare configuration, deployment, translation generation, compatibility
  path, service, registry, or PRD 128 behavior changed.

- **Menuactions — passed locally, 2026-08-13.** Menuactions is now one native,
  unbound action row for menus and Popovers. Its required `sm|md|lg` size is
  the sole authority for compact row height, typography, radius, spacing, and
  the default size of one optional trailing Dieter Icon. The complete
  caller-supplied label remains left aligned; the optional Icon/check remains a
  fixed right-side element. Hover, active, and disabled states retain the same
  geometry.

  The fake `primary` option, consumer-specific `aimenuactions` option and purple
  Icon rule, false instance-data string binding, unused path input, parallel
  label typography inputs, old nested Icon layer/glyph-ratio sizing, and
  redundant type-setting hydrator are deleted rather than wrapped or aliased.
  Every live caller already emits an exact native `type="button"`, so no
  replacement runtime machinery was required.

  Dropdown Actions still owns its exact selected value, Popover lifecycle, and
  immediate close. Bob's Copy code action, Roma's Rename/Duplicate/Delete
  actions, Bob's account-font options, Popaddlink's current close composition,
  and DevStudio's token chooser retain their existing caller-owned behavior.
  Their redundant Menuactions variant, typography, nested Icon wrapper, and
  fixed checkmark-size overrides are removed. DevStudio now reveals label-only,
  trailing-Icon, and disabled rows at every size. All visible words remain
  exact caller input: Widget option labels continue through adjacent Widget
  ToolDrawer label files, while Bob and Roma Chrome stays with those
  applications for their later passes. No Dieter locale, copy catalog, Widget
  branch, persistence change, compatibility path, service, registry, route,
  product-data mutation, Cloudflare change, or translation generation was
  added.

  Focused verification passed: Dieter typecheck/governance, DevStudio
  generation/build/typecheck, Bob and Roma typechecks plus their focused
  editor/command contract suites, Widget source generation, all eight editor
  artifact pairs, and diff checks. Local Chromium computed the exact
  `16/20/24px` row, `11/13/14px` text, `12/16/20px` trailing Icon, and
  `3/4/6px` radius ladders; it also selected a real Dropdown Actions option,
  observed the exact new value, and proved the Popover closed. The local
  V1–V8 audit passed. This work is not committed, pushed, deployed, or live.

- **Object Manager and Repeater — passed locally, 2026-08-13.** The two
  collection components now follow one exact mental model without collapsing
  their different jobs. Object Manager renders top-level caller-declared object
  editors. `allow-structure="true"` exposes immediate Add plus one Popup draft
  for reorder/delete and saves that draft as one exact array; false renders
  only the object editors. Repeater owns nested inline add/remove/reorder using
  one exact caller template and `default-item`. Both accept arrays of objects
  with stable ids, assign ids only to declared empty id coordinates on new
  items, preserve all other caller state, and reject rather than derive missing
  item structure.

  The old Repeater JavaScript is replaced by the typed source because it
  concretely inferred new-item shapes and silently substituted values. The new
  component retains the existing inline drag UX but moves its visual states to
  Dieter CSS, uses the established Button/Icon/Textfield/Toggle contracts, and
  makes the root `sm|md|lg` size the sole geometry and typography authority.
  Object Manager now actually honors the existing structural-permission flag;
  its dialog uses the existing Popup/dialog lifecycle and caller-owned dirty
  discard copy. Neither component contains a Widget, account, Bob, Roma, route,
  storage, or product-policy branch.

  Widget copy follows the Stage 1 contract. Cards, FAQ, and Logo Showcase own
  the exact Object Manager dialog/action shape and each Object Manager item
  label in their adjacent English file. Repeater label/action inputs remain
  adjacent Widget copy, and obsolete Repeater-only `reorder-title` entries were
  removed. Bob only joins those existing structured inputs to the two global
  stencils. No Dieter locale or global collection-copy catalog was added.

  Object Manager and Repeater now export destroy functions and join the one
  Bob/Roma/DevStudio control-host lifecycle, including nested child hydrators.
  DevStudio hydrates and reveals the real three-size components plus Object
  Manager's caller-owned-fields-only composition. Local
  Chromium proved Object Manager add, structural draft, reorder, save, close,
  and stable generated ids; Repeater add and reorder-mode transitions; and
  clean hash-route replacement with no page error. The component pages also
  exposed and closed malformed demonstration JSON attributes and a wrong modal
  template lookup before completion.

  Focused verification passed: full repository typecheck and lint; Dieter
  governance; Bob's full focused suite and exact collection/l10n/editor
  contract; Roma Widget Defaults, command-gate, and instance-package suites;
  DevStudio generation/build and browser behavior; Widget source generation;
  and all eight editor artifact pairs. The local V1-V8 audit passed.
  No translation generation, product-data mutation, route, storage,
  Cloudflare, compatibility path, service, registry, or PRD 128 change is part
  of this pass. The source pass is committed and pushed through the normal
  cloud-dev rollout; no direct deployment or remote-data operation is used.

- **Popover, retired Popaddlink, Slider, Tabs, and Toggle — passed locally,
  2026-08-13.** Popover remains the one shared floating-surface primitive: it
  owns surface geometry, header/body alignment, radius, shadow, and the existing
  `row|wide|extra-wide` width contract while callers retain trigger, body,
  workflow, action, and copy ownership. No second Popover API or consumer
  behavior was added.

  Popaddlink is deleted rather than restyled. It had no Widget field contract
  or independent product job; its only real use was a duplicate nested surface
  inside Dropdown Edit. Dropdown Edit now owns one internal link sheet with the
  existing URL field, one contextual Add/Remove action, and one caller-labelled
  close action. The URL input is private component UI rather than a Bob-bound
  field. It applies the entered href exactly and no longer trims, prefixes,
  reserializes, validates, or silently repairs it; established public Widget
  rendering remains the URL-safety authority. All eight Widget specs and
  adjacent English files carry the same exact ten-key Dropdown Edit component
  label shape, including `Close link editor`. The separate Popaddlink source,
  hydrator, generated DevStudio route, Bob/DevStudio calls, and nested fake
  Popover overrides are gone.

  Slider now owns its progress presentation once. Its native range stencil no
  longer carries inline JavaScript, and Dropdown Shadow no longer repeats that
  inline behavior. One small idempotent Dieter hydrator synchronizes only the
  range's existing visual CSS variables on initial render, native input, and
  the existing `external-sync` signal after exact value projection;
  Bob, Roma Widget Defaults through the shared host, and DevStudio use that
  same path and release its listener through `destroySlider`. Numeric value,
  units, trailing readouts, and product meaning remain caller/compound-editor
  concerns. Bob and Roma reject missing/non-numeric Slider truth instead of
  replacing it with the field minimum.

  Tabs is reduced to a native radio group. Checked and disabled state remain
  native input truth; Dieter CSS owns only size and presentation. The custom
  tab roles, roving tabindex, arrow-key focus/selection program, hydrator, and
  host calls are deleted. Choice Tiles' separate custom left/right navigation
  residue is also removed, retaining its existing native/click selection and
  exact value behavior. Tabs has no current Widget ToolDrawer consumer;
  DevStudio reveals real two/three-option checked and disabled states.

  Toggle remains a native checkbox-label primitive. Its root `sm|md|lg` size
  now owns label typography as well as the switch, and the complete row owns
  checked, hover, and disabled presentation. Redundant nested consumer
  typography inputs are removed from the completed Dropdown Border, Fill,
  Shadow, and Repeater compositions. DevStudio reveals checked, unchecked, and
  disabled states. Slider and Toggle labels and every Tabs group/option label
  remain caller inputs; no Dieter catalog, locale folder, fallback, validator,
  compatibility path, service, registry, route, storage, product-data,
  Cloudflare, translation, or PRD 128 work was added.

  Focused verification passed: Dieter typecheck/governance, DevStudio
  generation/typecheck/build and browser behavior, Bob editor-contract and
  typecheck, Roma Widget Defaults/command-gate checks, Widget definition-source
  generation, all eight editor artifact pairs, root typecheck/lint, and diff
  checks. The independent V1–V8 result is recorded with the final verification
  of this pass. The source is committed and pushed on `main`; no direct deploy
  or remote-data operation was used.

- **Object Manager, Repeater, Popup, and Segmented correction pass — passed
  locally, 2026-08-14.** Object Manager and Repeater now expose one exact
  collection boundary to their host. The outer collection field alone carries
  `data-bob-path`; all rendered child fields retain consumer-neutral
  `data-path`. A nested Repeater writes its exact child array to the enclosing
  Object Manager, and only the final outer array reaches Bob or Roma Widget
  Defaults. FAQ's section-title `labelPath` remains owned by the enclosing
  Object Manager and retains its adjacent Widget label in compiled metadata.
  The unused, incomplete Repeater toggle branch and the global nested-path
  rewrite are deleted rather than preserved behind aliases.

  Repeater's root size now determines the existing Button and Icon ladder for
  reorder and remove actions, with equal leading and trailing rails around the
  flexible item body. Object Manager's Popup row actions follow the same root
  size. Logo Showcase's add-and-open behavior uses one exact caller-declared
  selector for its sibling Bulk Edit; Repeater contains no Widget, Bob, Roma,
  ToolDrawer, or document-layout branch. Existing array values, stable ids,
  per-component jobs, external synchronization, and destroy lifecycles remain
  intact.

  Popup remains the native-dialog structural primitive. It owns the shared
  frame, backdrop, viewport containment, three widths, scrolling body, and
  header/body/footer geometry, while callers continue to own workflow,
  dismissal policy, actions, persistence, and copy. The canonical title and
  every real Popup consumer now use the existing `heading-4` treatment. Bulk
  Edit's accessible dialog name follows its visible editor or discard title,
  and Bob Upsell uses a semantic visible heading referenced by
  `aria-labelledby`. DevStudio now reveals only the real small, medium, and
  large structural sizes; the large example proves body scrolling inside the
  fixed frame instead of inventing fake workflow categories.

  Segmented is reduced to one native-radio authority. The nested Button,
  mirrored `aria-pressed` state, JavaScript hydrator, compiler Button options,
  and legacy style/icon-size examples are deleted. One presentational segment
  surface composes caller-supplied text or a direct Dieter Icon, and the native
  radio alone owns checked, disabled, focus, and submitted value. The same
  structure is used by Logo Showcase's three Widget fields, Dropdown Fill's
  mode selector, Bob's Manual/Copilot switch, and Bob's Desktop/Mobile switch.
  Dropdown Fill retains its already-approved explicit 20px mode Icons; generic
  Segmented Icons follow the small/medium/large `12/16/20px` ladder.

  ToolDrawer words remain in each Widget's adjacent English label file. Popup
  owns no words. Segmented group names, visible labels, and icon-only names are
  exact caller inputs; Bob Chrome remains in Bob until Stage 3. No Dieter
  locale, global copy catalog, compatibility path, fallback, validator,
  framework, registry, route, storage, product-data, Cloudflare, translation,
  or PRD 128 work was added.

  Focused verification passed: Dieter typecheck/governance; DevStudio
  generation/build/typecheck; Bob editor-contract and typecheck; Roma Widget
  Defaults, command-gate, and typecheck checks; Widget definition-source
  generation; and all eight editor artifact pairs. Local Chromium proved
  Repeater's proportional `24/28/40px` action rails with `12/16/20px` Icons,
  exact single-event FAQ nested aggregation, exact Logo Showcase add then
  sibling Bulk Edit open, Split Carousel add and reorder with one event per
  operation, native Segmented selected/disabled behavior, Object Manager's
  root-sized modal actions, and Popup's three structural sizes with contained
  large-body scrolling. The final independent V1–V8 audit found no violation.
  The correction source is committed and pushed on `main`; no direct deploy or
  remote-data operation was used.

- **Table — passed locally, 2026-08-14.** Dieter Table remains one
  consumer-agnostic semantic table surface. It now uses the existing `lg`
  radius with no elevation, the shared white surface for both header and body,
  `--space-3` block and `--space-4` inline cell padding, a
  `--color-system-gray-step3` column-header underline, and
  `--color-system-gray-step5` body-row dividers. It retains horizontal
  overflow, semantic table markup, action/preview composition classes, and no
  vertical rules or zebra stripes.

  Sorting remains application behavior. Roma's existing Widgets and Assets
  tables still own the selected column, direction, and row order. Their
  existing `small` quaternary sort Buttons now use the exact Dieter icon
  treatment: inactive columns show `chevron.down.dotted.2` with
  `--color-system-gray-3`; an active ascending column shows `chevron.up.2` and
  an active descending column shows `chevron.down.2`, both with
  `--color-system-gray-2`. No Table sorting controller, hydrator, React table
  layer, compatibility path, or second state authority was added.

  DevStudio now reveals ordinary, active-ascending, active-descending,
  horizontal-overflow, row-action, and editable-cell compositions generated
  directly from the Table spec. Table owns no words: Roma and DevStudio retain
  their Chrome/example copy, and Logo Showcase Bulk Edit retains its exact
  Widget-adjacent ToolDrawer copy. No Dieter catalog, locale file, Widget label
  migration, storage, route, account-data, translation, Cloudflare topology,
  or PRD 128 work is part of this pass.

  Focused verification passed: Dieter typecheck/governance; exact DevStudio
  generation/typecheck/build and focused Table route contract; Roma
  Table/command gates and typecheck; Bob
  editor-contract and typecheck; and generated Widget artifact reconciliation.
  Local Chromium proved the exact 8px radius, no shadow, 12px/16px cell
  padding, shared header surface, requested header/body divider tokens, 12px
  inactive/ascending/descending Icons and colors, real horizontal overflow,
  and unchanged row-action/editable-cell composition. The final independent
  V1-V8 audit is recorded with the final verification of this pass. No direct
  deployment or remote product-data mutation is part of the Table pass.

- **Duplicate rich-text prototype hard deletion — passed locally,
  2026-08-14.** The unused experimental rich-text component is deleted from
  Dieter, Bob and Roma host support, DevStudio generation and navigation,
  active tests, package dependencies, and current documentation. It had zero
  current Widget declarations and zero generated editor controls, so no stored
  value, Widget contract, product-data migration, compatibility path, or
  translation work exists. Dropdown Edit remains the single current ToolDrawer
  rich-text authority, with 24 exact generated controls across the eight
  current Widgets and the existing ten-label caller contract unchanged.

  DevStudio now generates 22 component pages. Focused Dieter governance and
  typecheck, DevStudio generation/build/typecheck, Bob editor-contract and
  typecheck, Roma Widget Defaults/command-gate checks, all eight Widget
  artifact pairs, root lint/typecheck, zero-residue scans, and diff checks pass.
  A future long-form writing surface must begin from a real Widget product
  contract rather than preserving this obsolete prototype. No deployment or
  remote-state mutation is part of this deletion pass.

- **Textfield and Valuefield — passed locally, 2026-08-14.** Textfield is one
  native, caller-labelled one-line string primitive with no hydrator. Its
  `sm|md|lg` root owns the complete row height, radius, typography, spacing,
  hover, editing, and disabled presentation. The complete leading label remains
  visible at rest, only the trailing current value may ellipsize, and editing
  turns the row into the writing surface. Exact optional placeholders come
  from the caller; Dieter demonstration copy no longer enters compiled product
  controls.

  Valuefield is one native finite-number primitive with no hydrator. The same
  root size owns its row and content-sized trailing number editor. Rest keeps
  the exact value on the shared right rail; hover belongs to the complete row,
  and editing uses one neutral white trailing surface that grows with the
  numeric content while remaining bounded by the available row. Exact inclusive
  `min`, `max`, and native `step` attributes come only from the declaring
  field; the compiler no longer substitutes DevStudio's example `0..100`
  range. Bob and Roma Widget Defaults accept finite values inside the declared
  bounds, preserve zero and signed caller ranges, and reject non-finite or
  out-of-bounds edits without coercion, clamping, replacement, or draft
  mutation. `step` remains browser input metadata rather than a second value
  validator.

  Existing caller bounds were made explicit only where the current field truth
  is inclusive. Countdown's positive-only time amount/count duration and Logo
  Showcase's positive-only continuous speed remain unbounded at the primitive
  boundary because their current Widget runtime law is exclusive `>0`; the
  next Widget-catalog pass must choose the product input resolution before an
  inclusive minimum can be authored. The existing shared Core Size runtime's
  cross-field clamp/default behavior likewise remains with the owning Widget
  catalog/runtime pass rather than being hidden inside Valuefield.

  The same audit removed a stale Logo Showcase metadata workaround. Bulk Edit
  now derives all seven string/boolean item controls from its existing generic
  `path`, `row-path`, and `columns` declaration, so one complete Logo-details
  Save batch passes the ordinary compiled-control boundary. The two fake
  Textfields and four adjacent label keys hidden under Dropdown Fill are gone;
  Dropdown Fill continues to own only `logoFill`, and the visible Bulk Edit UX
  and Widget-owned copy are unchanged.

  DevStudio generates 22 component pages and reveals exact native Textfield
  and Valuefield geometry, caller placeholders, zero bounds, signed ranges,
  and disabled states. All eight Widget editor artifact pairs are exact and
  every rendered Valuefield's bound attributes match its compiled metadata.
  Focused verification passed: Dieter typecheck/governance; DevStudio
  generation/build/typecheck and Chromium geometry; Bob editor-contract,
  complete Bulk Edit batch, and typecheck; Roma Widget Defaults numeric
  acceptance, command gates, and typecheck; Widget source generation; all
  eight artifact pairs; root typecheck/lint; and diff checks. The independent
  final V1-V8 audit is recorded with the final verification of this pass. No
  commit, push, deployment, route, storage, product-data, translation,
  Cloudflare, or PRD 128 operation is part of this local pass.

- **Systemic focus-state and Valuefield geometry correction — passed locally,
  2026-08-14.** Dieter no longer adds blue focus-only decoration to Buttons,
  compact property rows, Dropdown triggers, Bulk Edit fields, Segmented,
  Slider, Textfield, Toggle, Valuefield, or Dropdown Fill's gradient-stop
  action. Native input, selection, editing, dialog containment, and dismissal
  behavior remain intact. Blue presentation remains only where it communicates
  a real selected, active, drag, or product-action state; ordinary hover and
  editing use neutral component surfaces.

  Valuefield keeps the complete caller label on the leading rail and the exact
  number on the shared trailing rail. The row owns hover; editing keeps a
  neutral row with one white trailing surface. The native number input uses
  CSS intrinsic content sizing, a one-character minimum, the existing 8px
  control padding, and the available row as its maximum. The editor therefore
  grows with the value while preserving the same right alignment as Toggle and
  Dropdown trailing elements. No JavaScript sizing, hydrator, new variant,
  validation rule, fallback, coercion, or compatibility path was added.

  DevStudio's existing policy-specific full-width numeric compositions retain
  their explicit local full-width geometry; the canonical intrinsic rule is
  scoped to the complete Valuefield structure. Caller copy, Widget-adjacent
  labels, compiled paths, inclusive bounds, Bob/Roma numeric acceptance,
  Widget artifacts, stored values, routes, product data, and public Widget
  behavior are unchanged.

  Focused verification passed: Dieter typecheck/governance; exact DevStudio
  generation/build/typecheck; Bob editor contract and typecheck; Roma Widget
  Defaults, command-gate, and typecheck checks; all eight Widget artifact
  pairs; root typecheck/lint; Tokyo product-root dry run; and diff checks. Local
  Chromium loaded all 22 generated component routes and proved the exact
  `20/24/28px` Valuefield size ladder, content-sized live editor growth, 8px
  slot padding, 9px effective right inset, complete-row hover, neutral edit
  surface, absence of blue focus decoration, and the preserved full-width
  DevStudio Entitlements composition. The independent final audit passed
  V1–V8 with no remaining defect.

- **Popup seamless-surface and optional-title correction — passed locally,
  2026-08-14.** Popup remains the single Dieter blocking-dialog presentation
  authority. Its small/medium/large frame now uses one continuous borderless
  elevated surface, `--space-6` outer padding, and `--space-5` separation
  between header, scrolling body, and footer without internal horizontal
  dividers. Existing viewport containment, radius, backdrop, elevation, body
  scrolling, action alignment, and shared native-dialog lifecycle remain
  unchanged.

  A visible title is now optional. When present it retains `heading-4` and
  names the dialog; when absent the caller must provide the exact accessible
  name. An optional medium quaternary Dieter Button with the `multiply` Icon
  provides dismiss presentation. Its accessible label and action binding are
  caller-owned, so Dieter adds no copy, automatic close behavior, validator,
  fallback, controller, registry, or alternate modal system.

  Existing approved dismissal policy is preserved. Bulk Edit, Object Manager,
  Bob upsell, Roma upsell/widget-upgrade/copy-code, Roma Bulk Upload, and the
  DevStudio token editor bind the Icon to their existing close/cancel path;
  dirty Bulk Edit/Object Manager/DevStudio views still require their explicit
  discard decision, and Roma Bulk Upload keeps dismissal disabled while busy.
  Roma's account tier-drop notice and unsaved-changes confirmation do not gain
  the optional action. All footer workflow actions remain.

  DevStudio now reveals title-plus-dismiss, titleless-with-accessible-name, and
  title-without-dismiss structures from the real Popup stencil. Bulk Edit and
  Object Manager retain their exact Widget-adjacent caller labels, while Bob
  and Roma Chrome strings remain with their current owning surfaces for the
  later localization passes.

  Focused verification passed: Dieter typecheck/governance; exact DevStudio
  generation/build/typecheck; Bob editor-contract, accessibility-copy, and
  typecheck; Roma command-gate and typecheck checks; Widget source validation;
  all eight editor/materializer artifact pairs; root typecheck/lint; Tokyo
  product-root dry run; and diff checks. Local Chromium proved all three Popup
  structures and exact computed geometry, including the borderless frame,
  24px outer padding, 20px section rhythm, 28px dismiss Button, 16px Icon, and
  contained large-body scrolling. It also proved clean Bulk Edit/Object Manager
  dismissal and the existing dirty Object Manager discard decision. Commit,
  push, Git-connected exact-SHA rollout, and live owning-surface reconciliation
  follow this local execution record.

- **Datefield and Date Range Picker — passed locally, 2026-08-14.** Dieter now
  owns two consumer-agnostic date fields over one private shared civil-date
  calendar. Datefield binds only exact `"" | "YYYY-MM-DD"`; Date Range Picker
  binds only exact `null | {start:"YYYY-MM-DD",end:"YYYY-MM-DD"}` with no
  additional keys and `start <= end`. Both validate real Gregorian dates and
  exact optional bounds without timezone conversion, coercion, clamping,
  fallback, or silent repair. Empty controls open on today's month only as a
  presentation coordinate; they do not write today as product truth.

  The UI follows the accepted Stripe mental model through Clickeen's existing
  Dieter system: one compact `sm|md|lg` property row, the calendar Icon, an
  existing `extra-wide` Popover, 24px month controls, one 7-column month, and
  proportional 28/32/36px day cells. Datefield commits one day immediately.
  Date Range Picker keeps the first click provisional, previews a continuous
  interval, commits one complete object on the second day, supports same-day
  and cross-month ranges, and restarts from an earlier second click. Clear
  writes the field's exact empty value; Escape/outside dismissal preserves the
  prior committed range. The shared wide/extra-wide Popover authority now also
  clamps vertically to an 8px viewport inset so the complete work area remains
  reachable without a date-specific positioning system.

  All human-language inputs remain caller-owned: label, placeholder, Previous
  month, Next month, and Clear. The exact caller locale drives `Intl` month,
  weekday, date-name, and closed-summary presentation. Dieter owns no locale
  catalog, native browser date-picker skin, timezone, preset, Apply action,
  Widget branch, or public Calendar component. Bob compiles and validates the
  two generic field shapes, projects exact browser-memory truth before
  hydration, and destroys the calendar roots with the existing control host.
  Roma Widget Defaults reuses that same host and exact external-sync path. No
  current Widget declares either field, so all eight Widget source contracts,
  English label files, generated editor/materializer artifacts, account data,
  public Widget packages, and storage coordinates remain unchanged.

  DevStudio now generates 24 component pages and reveals both controls from
  their real stencils/specs/source. Local Chromium proved the 20/24/28px closed
  row ladder, 28/32/36px day ladder, exact leap-day and bound handling,
  locale-derived summaries, one-write Datefield selection, no write after the
  first range click, hover preview, earlier-date restart, same-day and
  cross-month commits, exact Clear, external sync, Escape cancellation, route
  teardown, continuous range geometry, and complete viewport containment.
  Focused verification covers Dieter typecheck/governance; exact DevStudio
  generation/typecheck/build and route contract; Bob editor-contract and
  typecheck; Roma Widget Defaults/typecheck; all eight Widget artifact pairs;
  and diff checks. The independent V1–V8 audit and Git-connected exact-SHA
  rollout follow this local execution record.
