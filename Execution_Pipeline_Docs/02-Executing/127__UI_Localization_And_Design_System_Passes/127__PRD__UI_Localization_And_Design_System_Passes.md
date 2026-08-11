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

| Concern | Authority |
| --- | --- |
| User primary language and UI-language preference persistence | Michael/Supabase person truth |
| Profile normalization and bootstrap identity | Berlin |
| User-facing preference command and Bob-open coordination | Roma |
| Bob Chrome source | `bob/l10n/` when installed in Stage 3 |
| Roma Chrome source | `roma/l10n/` when installed in Stage 4 |
| ToolDrawer structure | Widget `spec.json` |
| ToolDrawer copy | Adjacent Widget `{widgetType}_tooldrawer_l10n_labels/` |
| Component structure, appearance, and behavior | Dieter |
| Widget editor compilation | Bob compiler and existing artifact generation |
| Open-editor draft state | Bob browser memory |
| Current documentation | `documentation/` |
| Execution memory and evidence | This PRD 127 folder |

No stage may move one of these concerns into another authority merely because
the code is convenient there.

## 5. Stage Status

| Stage | Status | Release state |
| --- | --- | --- |
| Stage 1 — Scaffold only | Complete | Committed, pushed, and deployed; no non-English experience is exposed |
| Stage 2 — Dieter UI pass | In progress: Foundations, Agent Activity, Bulk Edit, Button, Choice Tiles, Dropdown Actions, Popover, and Dropdown Border complete | Dropdown Actions, Popover, Dropdown Border, and the shared property-menu rails are ready for exact-SHA cloud-dev QA |
| Stage 3 — Bob UI pass | Not started | No authority to begin until explicitly directed |
| Stage 4 — Roma UI pass | Not started | No authority to begin until explicitly directed |
| Stage 5 — Translation pass | Not started | No translations may be generated yet |

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
5. Dropdown Actions
6. Dropdown Border
7. Dropdown Edit
8. Dropdown Fill
9. Dropdown Shadow
10. Dropdown Upload
11. Menuactions
12. Object Manager
13. Popaddlink
14. Popover
15. Popup
16. Repeater
17. Segmented
18. Slider
19. Table
20. Tabs
21. Textedit
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
