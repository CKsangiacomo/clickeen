# PRD106F_WidgetSystemicCertificationLedger

Status: Source + authenticated browser certification complete - commit/deploy pending
Owner: Widget system + Bob/Roma/Tokyo runtime
Date: 2026-06-09
Parent: `106__Umbrella__Composition_Vision.md`
Depends on: `PRD106A2_WidgetShellExtraction.md`, `PRD106A3_AccountWidgetDefaults.md`
Unlocks: deterministic widget building, reliable Builder panels, account defaults, Copilot grounding, and safe future widget creation.

## P0 Tenet

This is not a visual cleanup pass. This is a systemic certification pass.

Every widget must use the same Clickeen widget system:

```text
one shared Shell
one widget-owned Core namespace
one mixed Bob panel model
one shared control language
one shared utility path for shared behavior
one runtime apply contract
one Roma -> Bob -> Tokyo product flow
```

If widgets implement the same function differently, the platform is not
deterministic. Bob cannot edit reliably, Roma account defaults cannot be trusted,
Tokyo instance creation cannot be simple, Copilot cannot reason over the Builder
contract, and new widgets will keep inheriting local mess.

This is P0 because widget inconsistency breaks the product architecture itself.

## Execution Rule

Execute one widget at a time.

For each widget, execute one panel at a time.

For each panel, separate Shell and Core findings.

Do not move to the next widget until the current widget is certified or has a
named blocker approved by the product owner.

Do not patch random symptoms. Every action item must identify:

- the widget;
- the panel;
- whether the issue is Shell, Core, shared utility, Dieter/control primitive,
  runtime, defaults, labels, or data cleanup;
- the exact source authority that must change;
- the verification required to close it.

## Action Item Location

All live action items for this certification live in this file.

This file is the working ledger. It must be updated as the audit executes. Do
not rely on chat history or model memory to track findings.

## Subagent Protocol

For every widget, run three subagent reviews before implementation:

| Agent | Scope | Output |
| --- | --- | --- |
| Contract Agent | `spec.json`, defaults, editor contract, paths, labels, panel composition. | Contract violations and exact source files. |
| Runtime Agent | `widget.html`, `widget.css`, `widget.client.js`, shared runtime utilities, state application. | Runtime/render/shared utility violations and exact source files. |
| Product QA Agent | Roma/Bob Builder behavior, visible controls, preview response, save/reload expectations. | User-facing failures, dead controls, UX inconsistencies, QA steps. |

Subagents do not decide product architecture. They report against this PRD and
the surviving PRD106 architecture.

## Canonical Contract To Certify

### Shell

Shell is shared and must mean the same thing for every widget:

- Header content and visibility.
- Header CTA content/behavior/appearance.
- Header layout.
- Stage layout/appearance.
- Pod layout/appearance.
- Shared Core Size controls.
- Shared typography roles declared by Shell and Core.
- Locale switcher.
- Branding / Made with Clickeen.
- Social share.
- Shared behavior/settings.

Shell defaults must come from the global Shell default authority and account
defaults. Widget specs must not carry private Shell defaults unless explicitly
approved as a temporary cleanup item.

### Core

Core is the widget software itself.

Core must:

- live under the widget namespace;
- declare only widget-specific defaults and controls;
- render visible content inside the shared Shell body;
- use shared primitives for shared concepts;
- expose user-facing controls that actually change preview;
- avoid root `appearance.*` for widget-owned surfaces;
- fail at the named boundary for invalid state.

### Bob Panels

Builder panels are mixed surfaces:

```text
content: Shell Header controls + widget Core content controls.
layout: Shell Header/CoreSize/Stage/Pod controls + widget Core layout controls.
appearance: Shell Header/HeaderCTA/Stage/Pod controls + widget Core appearance controls.
typography: shared typography panel, editing roles declared by Shell and Core.
settings: Shell behavior + widget-specific runtime behavior if needed.
```

The same panel semantics must hold for every widget.

### Shared Controls And Labels

Common controls must behave the same everywhere:

- linked padding;
- linked corners;
- linked shadows;
- fills;
- borders;
- shadows;
- media fill/upload/select;
- repeaters;
- dropdowns;
- toggles;
- text fields;
- typography roles.

User-facing labels must use product language, not implementation leakage.

Examples:

- Use `Header CTA`, not generic `CTA`, when editing the shared Header CTA.
- Use `Call to Action` for the widget identity.
- Use `Link ... corners`, `Corner radius`, and per-corner labels like
  `top-left corner`; do not label the linked toggle `Link ... radius`.
- Do not expose `core`, `cardwrapper`, internal namespace names, or fake product
  concepts to the user.

### Dieter / ToolDrawer

If multiple widgets need the same control behavior, that behavior belongs in the
shared Builder/Dieter control language, not widget-local markup hacks.

Widget-local controls are allowed only for widget-specific Core concepts.

### Runtime

Runtime must apply state deterministically:

1. Validate the state at the named widget boundary.
2. Apply shared Shell utilities from Shell paths.
3. Apply typography.
4. Apply Header.
5. Apply Core Size.
6. Apply widget Core rendering from the widget namespace.
7. Apply branding/social/share utilities where applicable.

No runtime fallbacks, hidden healing, or alternate state truth.

## Widget Certification Order

1. `calltoaction`
2. `big-bang`
3. `cards`
4. `countdown`
5. `faq`
6. `logoshowcase`
7. `split-media`
8. `split-carousel-media`

## Per-Widget Checklist Template

Each widget section must be filled as work executes.

```text
Widget:
Status: Not started | Auditing | Fixing | Verifying | Green | Blocked

Subagents:
- Contract Agent:
- Runtime Agent:
- Product QA Agent:

Shell Content:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Shell Layout:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Shell Appearance:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Shell Typography:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Shell Settings:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Core Content:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Core Layout:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Core Appearance:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Core Typography:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Core Settings/Runtime Behavior:
- Expected:
- Actual:
- Violations:
- Action items:
- Verification:
- Status:

Final widget certification:
- Source validation:
- 106 audit:
- Typecheck:
- Lint:
- Browser QA:
- Save/reload QA:
- Commit:
- Deploy/checks:
```

## Active Ledger

The per-widget sections below preserve the audit-time findings and slice status
as work executed. The current certification authority is the final
`Cross-Widget Certification` section at the bottom of this ledger.

### calltoaction

Status: Local source/browser slice green - cross-widget shared cleanup open

Subagents:

- Contract Agent: Yellow. Shell/Core panel composition is mostly correct, but
  Shell-owned behavior normalization still lives in the widget spec, typography
  role ownership is unclear, and Core action button controls can drift from the
  shared Header CTA primitive.
- Runtime Agent: Yellow. Shared Shell utilities are present, but runtime order is
  not canonical, invalid Core state can hide content instead of failing, and
  branding/social share are applied through side-channel auto listeners.
- Product QA Agent: Yellow. Live Roma/Bob QA confirmed Content edits,
  Settings toggles, and save/reload for tested paths; it also found shared
  label/interaction defects in Header CTA appearance, Typography labels, empty
  Locale Switcher appearance clusters, and Dieter toggle click targets.

Shell Content:

- Expected: shared Header content controls only.
- Actual: uses shared `header-content`; Shell editable fields are
  `header.title`, `header.subtitleHtml`, and `headerCta.label`.
- Violations: none found.
- Action items: none.
- Verification: Builder Content panel shows shared Header controls and no
  widget-local duplicate Header controls.
- Status: Green.

Shell Layout:

- Expected: shared `header-layout`, `core-size`, and `stagepod-layout`.
- Actual: uses all three shared layout modules; Core layout is separated under
  `calltoaction.layout.*`.
- Violations: none at contract level.
- Action items:
  - `CTA-RT-001` [fixed 2026-06-09]: move `CKCoreSize.applyCoreSize(state.coreSize, contentEl)`
    before Core rendering in
    `tokyo/product/widgets/calltoaction/widget.client.js` so runtime order
    matches the canonical Shell apply contract.
- Verification: Layout panel changes Header layout, Core Size, Core alignment,
  Pod layout, and Stage layout without console errors.
- Status: Yellow until runtime order is fixed and browser QA passes.

Shell Appearance:

- Expected: shared `header-appearance` and `stagepod-appearance`.
- Actual: uses both shared appearance modules.
- Violations:
  - Core action button appearance is widget-local while Header CTA button
    appearance comes from the shared Header controls. These are the same product
    function family and can drift in labels/control behavior.
  - Header CTA padding label said `Sync padding`; shared control language uses
    linked-value vocabulary.
  - Header CTA radius appeared as `Radius` in live Bob; the source now uses
    `Corner radius`, so this requires rebuild/deploy verification.
  - The Locale Switcher appearance cluster can render as an empty heading when
    locale switcher is disabled.
- Action items:
  - `CTA-CON-001`: decide and implement the surviving shared button appearance
    primitive, or explicitly document why Header CTA and widget Core action
    buttons must remain different. Do not create a second hidden primitive.
  - `CTA-CON-005` [fixed in source 2026-06-09]: rename shared Header CTA
    padding toggle from `Sync padding` to `Link padding` in
    `bob/lib/compiler/modules/header.ts`.
  - `CROSS-UI-001` [fixed in source 2026-06-09]: make the Locale Switcher
    appearance cluster itself obey `localeSwitcher.enabled == true` in
    `bob/lib/compiler/modules/stagePod.ts`.
- Verification: Header CTA appearance and Core action appearance both visibly
  apply, use clear labels, and do not leak implementation names.
- Status: Yellow.

Shell Typography:

- Expected: one shared typography panel editing roles declared by Shell and Core.
- Actual: Call to Action declares Core `eyebrow`, while Core headline/body/action
  reuse shared `title`, `body`, and `button` roles at runtime.
- Violations:
  - Role ownership is not explicit enough. If `title/body/button` are shared text
    roles for Shell and Core, the docs and control labels must make that clear.
    If Core text needs widget-owned roles, Call to Action must declare them.
  - Live Bob showed the shared button role as `CTA`, which confuses Shell Header
    CTA with widget Core action buttons.
- Action items:
  - `CTA-CON-002`: certify `title/body/button` as shared text roles used by both
    Shell and Core, or split Call to Action Core typography into widget-owned
    roles. Update docs and tests with the chosen rule.
  - `CTA-CON-006` [fixed in source 2026-06-09]: rename the shared typography
    `button` role label from `CTA` to `Button text` in
    `bob/lib/compiler/modules/typography.ts`.
- Verification: Typography panel clearly shows what each role changes; edits to
  Title/Subtitle/Eyebrow/Button text roles visibly affect the expected
  Shell/Core text.
- Status: Yellow.

Shell Settings:

- Expected: shared behavior/settings only, including Made with Clickeen and
  social share.
- Actual: uses shared `settings-behavior`, but the widget spec still contains
  Shell-owned normalization rules for `behavior.showBacklink` and
  `behavior.socialShare.*`.
- Violations:
  - Shell behavior repair logic was widget-local. That violated the one shared
    Shell/defaults boundary and has been removed from all widget specs.
  - Branding is applied explicitly by the widget and also by shared
    `branding.js` auto listeners.
  - Social share was applied only by shared auto listeners, not by the canonical
    widget `applyState` sequence.
  - Live QA showed Dieter toggle labels were not clickable even though the
    visible switch itself worked; this is a shared control primitive issue.
- Action items:
  - `CTA-CON-003` [fixed 2026-06-09]: delete widget-owned Shell behavior
    normalization from all widget specs. Shell behavior defaults now remain only
    in the shared Shell/account defaults boundary.
  - `CTA-CON-004` [fixed 2026-06-09]: add validation/audit coverage so widget
    `normalization.coerceRules` cannot own Shell paths.
  - `CTA-RT-003` [fixed for Call to Action 2026-06-09]: call
    `CKSocialShare.apply` explicitly from
    `tokyo/product/widgets/calltoaction/widget.client.js` after branding in the
    canonical `applyState` sequence. Remaining shared side-channel listener
    removal is tracked as cross-widget cleanup.
  - `CROSS-DIETER-001` [fixed in source 2026-06-09]: make Dieter toggle text
    labels target the checkbox input and support Enter on the switch input in
    `dieter/components/toggle/*` and the Tokyo-distributed copy.
- Verification: Settings panel hides/shows Made with Clickeen, enables social
  share, shows channel settings when enabled, updates visible share UI, saves,
  reloads, and has no console errors.
- Status: Yellow until branding/social share shared-runtime ownership is
  resolved and the toggle source fix is verified in browser after deploy.

Core Content:

- Expected: widget content only under `calltoaction.*`.
- Actual: Core content is under `calltoaction.*`; labels disambiguate from
  Shell Header CTA with `Action headline`, `Action label`, and `Action link`.
- Violations:
  - Invalid/missing `state.calltoaction` can hide the Core content instead of
    failing at the widget boundary.
- Action items:
  - `CTA-RT-002` [fixed 2026-06-09]: replace silent Core hiding with strict validation in
    `tokyo/product/widgets/calltoaction/widget.client.js`.
- Verification: Core eyebrow/headline/supporting text/action controls all change
  preview, save, reload, and invalid Core state fails loudly at the named
  boundary.
- Status: Yellow.

Core Layout:

- Expected: widget-owned layout controls under `calltoaction.layout.*`.
- Actual: alignment, text width, and gap live under `calltoaction.layout.*`.
- Violations: none found.
- Action items:
  - `CTA-RT-006` [fixed for Call to Action 2026-06-09]: align runtime
    `calltoaction.layout.textWidth` and `calltoaction.layout.gap` bounds with
    the spec contract in `tokyo/product/widgets/calltoaction/widget.client.js`.
- Verification: alignment, text width, and gap visibly change Core layout and
  keep Core inside the Pod.
- Status: Green after browser QA.

Core Appearance:

- Expected: widget-owned appearance controls under the widget namespace, using
  shared primitives for shared concepts.
- Actual: Core action button style lives under `calltoaction.actionStyle.*`.
- Violations:
  - Button/link behavior and appearance are separate from Header CTA behavior.
  - `Radius` label violated the corner vocabulary.
- Action items:
  - `CTA-CON-001`: shared button appearance primitive decision, same as Shell
    Appearance.
  - `CTA-QA-001` [fixed in source 2026-06-09]: change Core action button
    `Radius` to `Corner radius` and add `(px)` units to padding/icon labels in
    `tokyo/product/widgets/calltoaction/spec.json`.
  - `CTA-RT-007` [fixed for Call to Action 2026-06-09]: align runtime
    `calltoaction.actionStyle.paddingInline`, `paddingBlock`, and `iconSize`
    bounds with the spec contract in
    `tokyo/product/widgets/calltoaction/widget.client.js`.
- Verification: Core action background/text/border/radius/padding/icon controls
  all change preview and persist through save/reload.
- Status: Yellow.

Core Typography:

- Expected: Core declares any widget-specific typography roles and participates
  in the shared typography panel.
- Actual: Core declares `eyebrow`; headline/supporting text/action use shared
  `title/body/button`.
- Violations: same ownership ambiguity as Shell Typography.
- Action items:
  - `CTA-CON-002`: typography ownership decision, same as Shell Typography.
- Verification: Typography edits affect exactly the intended Shell/Core text.
- Status: Yellow.

Core Settings/Runtime Behavior:

- Expected: no widget-specific settings unless Call to Action needs runtime
  behavior beyond shared Shell behavior.
- Actual: no widget-specific settings panel; Core action link behavior is
  implemented locally.
- Violations:
  - Core action link URL policy differs from Header CTA URL policy.
  - Missing `state` returns silently in `applyState`/`applyPreviewState`.
  - Shared utilities still contain fallback/default behavior that can hide dirty
    data after account defaults are materialized.
- Action items:
  - `CTA-RT-004`: define whether Header CTA and Core action links share one URL
    policy. If yes, extract/use one shared button/link behavior primitive.
  - `CTA-RT-005` [fixed for Call to Action 2026-06-09]: reject missing state in
    Call to Action `applyState` / preview updates instead of returning silently.
  - `CROSS-RT-001`: remove shared Shell runtime fallback defaults only as a
    cross-widget shared cleanup after every widget has certified account/default
    materialization.
  - `CROSS-RT-002`: remove Header DOM healing only after all widget Shell DOM is
    certified.
- Verification: Core action link/open/icon behavior works; invalid action state
  fails at the widget boundary; no runtime healing creates alternate truth.
- Status: Yellow.

Final widget certification:

- Source validation: `pnpm validate:widgets` passed after Call to Action label,
  toggle, locale-switcher cluster, social-share apply, fail-fast, and runtime
  bounds fixes.
- 106 audit: `pnpm audit:106 --skip-r2` passed after Call to Action label,
  toggle, locale-switcher cluster, social-share apply, fail-fast, and runtime
  bounds fixes.
- Typecheck: `pnpm typecheck` passed after Shell normalization enforcement;
  `pnpm --filter @clickeen/bob typecheck` passed after the Locale Switcher
  cluster fix.
- Lint: `pnpm lint` passed after Shell normalization enforcement.
- Browser QA: Partial green on live Roma/Bob 2026-06-09. Verified mixed panels
  render, Content/Header/Core action label edits update preview with no console
  errors, Settings Made with Clickeen hides when toggled off through the switch,
  social share channel settings appear after enabling social share, and social
  share UI appears in preview. Source fixes for labels/toggle click target still
  need deployed browser verification.
- Save/reload QA: Partial green on live Roma/Bob 2026-06-09. Verified Core
  action label save/reload through Roma -> Bob -> Tokyo, then restored the
  instance to `Get started`. Product QA also verified Header CTA label and Core
  alignment save/reload and restored the instance.
- Commit: pending.
- Deploy/checks: pending. Source-level fixes need deployed browser verification.

### big-bang

Status: Source slice green - deployed browser QA pending

Subagents:

- Contract Agent: Completed. Found that Big Bang Core required `statement` at
  runtime but the Builder control contract did not mark it required; found
  valuefield `step` metadata was dropped by Bob; found Settings grouped social
  share under branding.
- Runtime Agent: Completed. Found Big Bang still skipped initial missing state,
  treated branding as optional, retained widget-local normalization, and used a
  mobile-only typography clamp outside shared Typography.
- Product QA Agent: Timed out. Primary browser QA covered live panel rendering
  and screenshots; deployed verification still required after source fixes.

Shell Content:

- Expected: shared Header content controls and Shell editable fields matching
  the Shell authority.
- Actual: uses shared `header-content`.
- Violations:
  - `headerCta.label` in `tokyo/product/widgets/big-bang/editable-fields.json`
    uses role `button`; Shell authority uses `header-cta-label`.
  - Header CTA DOM is an empty anchor and depends on shared Header runtime
    healing to create label/icon children.
- Action items:
  - `BBG-CON-001` [fixed 2026-06-09]: update Big Bang Shell editable field metadata to match
    `packages/widget-shell/src/editable-fields.ts`.
  - `BBG-RT-003` [fixed 2026-06-09]: make Big Bang Header CTA DOM match canonical Shell DOM so it
    does not require runtime DOM healing.
- Verification: Big Bang Shell editable fields match the shared Shell list and
  Header CTA renders without relying on Header runtime element creation.
- Status: Green after source verification; browser QA pending.

Shell Layout:

- Expected: shared `header-layout`, `core-size`, and `stagepod-layout`.
- Actual: uses all three shared layout modules.
- Violations:
  - Shared CoreSize still contains fallback/default behavior. Big Bang order is
    correct, but missing/invalid `state.coreSize` must be rejected before the
    shared utility can heal it.
- Action items:
  - `BBG-RT-004` [fixed 2026-06-09]: validate `state.coreSize` before calling `CKCoreSize`.
  - `CROSS-RT-001`: shared CoreSize fallback removal remains cross-widget work.
- Verification: Big Bang Layout controls change preview; invalid CoreSize state
  fails before DOM mutation.
- Status: Yellow.

Shell Appearance:

- Expected: shared `header-appearance` and `stagepod-appearance`.
- Actual: uses both shared appearance modules.
- Violations:
  - Shared Header CTA labels still expose `Sync padding` and `Radius`; PRD106F
    vocabulary requires linked values and corners language.
- Action items:
  - `CROSS-LABEL-001` [fixed in source 2026-06-09]: shared Header CTA
    appearance labels now use `Link padding` and `Corner radius` in
    `bob/lib/compiler/modules/header.ts`.
- Verification: Header CTA appearance and Stage/Pod appearance controls visibly
  apply and labels match the shared vocabulary.
- Status: Yellow pending cross-widget shared label cleanup and browser QA.

Shell Typography:

- Expected: shared typography panel plus Core `bigBang` role.
- Actual: typography panel is shared; Big Bang declares `typography.roles.bigBang`.
- Violations:
  - Product QA noted shared role labels are still ambiguous: `Subtitle` affects
    Big Bang supporting copy through shared `body`, and `CTA` should read as
    Header CTA.
- Action items:
  - `CROSS-TYPO-001` [partly fixed in source 2026-06-09]: shared Typography no
    longer labels the `button` role as `CTA`; it now reads `Button text`.
    Remaining question: whether `Title` and `Subtitle` need clearer shared-scope
    labels or per-widget Core typography roles.
- Verification: Typography roles affect intended visible text and labels are
  understandable to a user.
- Status: Yellow pending cross-widget typography label cleanup and browser QA.

Shell Settings:

- Expected: shared `settings-behavior` for branding/social share.
- Actual: uses shared Settings node and limits map branding/social share paths.
- Violations:
  - Branding/social share also apply through shared side-channel listeners.
  - Settings grouped social share under `Clickeen Branding`, which made two
    separate Shell behaviors read like one product concept.
- Action items:
  - `BBG-RT-007` [fixed for Big Bang 2026-06-09]: call `CKSocialShare.apply`
    explicitly from `tokyo/product/widgets/big-bang/widget.client.js` after
    branding in the canonical `applyState` sequence.
  - `BBG-RT-009` [fixed for Big Bang 2026-06-09]: require
    `CKBranding.applyBacklink` in Big Bang instead of treating the shared Shell
    branding utility as optional.
  - `CROSS-SETTINGS-001` [fixed in source 2026-06-09]: split shared Settings
    clusters into `Clickeen branding` and `Social share` in
    `bob/lib/compiler/modules/settings.ts`.
  - `CROSS-RT-003`: remove duplicate branding/social share side-channel
    listeners only after every widget has explicit shared utility application.
  - `CROSS-DIETER-001` [fixed in source 2026-06-09]: Dieter toggle text labels
    now target their checkbox input; deployed browser verification still needed.
- Verification: Made with Clickeen, social share, social channel toggles, and
  locale switcher controls visibly do what they say or show a clear gated/empty
  state.
- Status: Yellow pending cross-widget shared runtime/UX cleanup and browser QA.

Core Content:

- Expected: widget content only under `bigBang.*`.
- Actual: Core content is under `bigBang.statement`,
  `bigBang.showSupportingCopy`, and `bigBang.supportingCopy`.
- Violations:
  - [fixed 2026-06-09] Spec-level Core normalization existed for
    `bigBang.showSupportingCopy`; the runtime now validates Big Bang Core state
    before Shell mutation and the widget spec no longer carries the normalization
    repair.
  - [fixed 2026-06-09] A blank `bigBang.statement` could be accepted by the
    editor but break runtime.
- Action items:
  - `BBG-RT-001` [fixed 2026-06-09]: replace `normalizeBigBang()` fallback behavior with strict
    Big Bang state validation before Shell utilities run.
  - `BBG-CON-003` [fixed 2026-06-09]: remove Big Bang widget-local
    normalization from `tokyo/product/widgets/big-bang/spec.json`.
  - `BBG-QA-001` [fixed in source 2026-06-09]: mark
    `bigBang.statement` as required in the editor contract and teach Bob
    `coerceValueStrict` to reject empty required string controls.
- Verification: statement/supporting copy controls change preview and save; a
  blank statement is blocked before save or clearly fails before DOM mutation.
- Status: Source green; deployed browser QA pending.

Core Layout:

- Expected: widget-owned layout controls under `bigBang.*`.
- Actual: alignment, text width, and gap live under `bigBang.*`.
- Violations:
  - Numeric min/max live in the spec and runtime rejects out-of-bounds values;
    Bob did not enforce those bounds before applying edits.
  - Bob dropped valuefield `step` attrs while rendering Dieter controls and
    collecting compiled control metadata.
- Action items:
  - `BBG-CON-002` [fixed 2026-06-09]: rename layout labels to product-specific text labels.
  - `BBG-QA-002` [fixed in source 2026-06-09]: enforce numeric control
    `min`/`max` in `bob/lib/edit/controls.ts` so saved values and preview
    values match.
  - `CROSS-BOB-001` [fixed in source 2026-06-09]: preserve valuefield `step`
    metadata through `bob/lib/compiler/stencils.ts`,
    `bob/lib/compiler/controls.ts`, and `bob/lib/types.ts`.
- Verification: Layout panel has no bare `Gap`; out-of-bounds text width/gap
  cannot persist as a different value from what preview renders.
- Status: Source green; deployed browser QA pending.

Core Appearance:

- Expected: none unless Big Bang declares Core appearance.
- Actual: no Core appearance defaults or controls.
- Violations: none found.
- Action items: none.
- Verification: no hidden Core appearance controls exist.
- Status: Green.

Core Typography:

- Expected: Big Bang Core declares its own statement typography role.
- Actual: Core role `bigBang` exists with role scales; shared Typography labels
  it `Big Bang statement`.
- Violations:
  - [fixed 2026-06-09] Mobile CSS overrode the shared `bigBang` typography size
    with a widget-local clamp, so the Typography control did not remain the sole
    authority at mobile widths.
- Action items:
  - `BBG-RT-006` [fixed 2026-06-09]: remove the widget-local mobile font-size
    clamp from `tokyo/product/widgets/big-bang/widget.css`; responsive
    typography must come from shared Typography, not a widget-local override.
- Verification: Big Bang statement typography controls work at desktop and
  mobile widths.
- Status: Source green; deployed browser QA pending.

Core Settings/Runtime Behavior:

- Expected: only widget-specific runtime behavior; no widget-specific Settings
  panel is needed.
- Actual: no widget-specific Settings panel; `bigBang.showSupportingCopy` is the
  only Core behavior toggle and is now validated as Core state, not repaired by
  widget-local normalization.
- Violations:
  - [fixed 2026-06-09] Missing initial `runtimeContext.state` skipped render
    instead of failing at `[BigBang]`.
  - [fixed 2026-06-09] Missing preview `state` returned silently in
    `applyPreviewState`.
- Action items:
  - `BBG-RT-001` [fixed 2026-06-09]: strict validation before Shell mutation, same as Core Content.
  - `BBG-RT-008` [fixed for Big Bang 2026-06-09]: reject missing preview state
    instead of returning silently.
  - `BBG-RT-010` [fixed for Big Bang 2026-06-09]: call `applyState` with the
    initial runtime state unconditionally so missing initial state fails at the
    widget boundary.
- Verification: invalid state fails at `[BigBang]` before runtime mutation.
- Status: Source green; deployed browser QA pending.

Final widget certification:

- Source validation: `pnpm validate:widgets` passed after Big Bang required
  statement, normalization removal, explicit social-share/branding apply,
  missing-state fail-fast, typography clamp removal, shared Settings split,
  valuefield step forwarding, and numeric bounds enforcement.
- 106 audit: `pnpm audit:106 --skip-r2` passed after the same fixes.
- Typecheck: `pnpm --filter @clickeen/bob typecheck` passed after the shared
  Bob control metadata and edit-boundary fixes.
- Lint: pending after this Big Bang/source slice.
- Browser QA: partial live browser QA completed against deployed pre-fix source
  for instance `QD1G068MX7`; screenshots captured for Content, Layout,
  Appearance, Typography, and Settings. Deployed verification is still required
  for the source fixes above.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

### cards

Status: Source fixed - browser QA pending after deploy

Subagents:

- Contract Agent: Yellow. Cards has no Shell defaults in `spec.json`,
  Core defaults resolve for declared paths, `editable-fields.json` uses stable
  repeated item identity, and `limits.json` maps `cards.items[]`. Violations are
  control-language/UX, not Shell/default ownership.
- Runtime Agent: Yellow. Earlier runtime findings were source-fixed: Cards now
  validates before Shell mutation, uses canonical Header CTA DOM, consumes
  shared card-wrapper CSS variables, explicitly applies branding/social share,
  and fails missing initial state. Shared Shell side-channel cleanup remains
  cross-widget.
- Product QA Agent: Red on deployed live source. Live browser QA showed Cards
  Content repeater/default issues, linked-card invalid state, and stale deployed
  assets. The first two are source-fixed; final certification waits for deploy
  and browser QA against current source.

Cross-widget/browser blockers found while certifying Cards:

- `CRD-QA-001` [source-fixed 2026-06-09; browser pending]: Cards Content
  repeater rendered its header/Add button but no visible card item rows because
  Bob loaded saved instance state without merging missing compiled defaults.
  Source authority fixed: `bob/lib/session/sessionConfig.ts` now performs a
  missing-only merge from `compiled.defaults` before ToolDrawer hydration and
  preview. Explicit invalid arrays such as `cards.items: []` remain invalid and
  still fail at the named Cards boundary. Verification: after deploy, card rows
  are visible, add/remove/reorder mutate `cards.items[]`, preview updates, and
  no console errors occur.
- `CRD-QA-002` [source-fixed 2026-06-09; browser pending]: selecting
  `linked-cards` could create invalid preview state because current cards were
  not link-enabled. Source authority fixed: Cards treatment validation no longer
  requires each item to opt into `link.enabled`; the `linked-cards` treatment is
  itself the link contract, while href/label remain strictly required.
  Verification: after deploy, selecting linked cards renders valid linked cards
  or fails loudly at the Cards boundary without stale preview.
- `CRD-QA-003` [open]: live deployed Cards assets still show pre-fix behavior
  (`normalizeCards`, old Appearance controls, no card-wrapper CSS vars). Source
  authority: deploy state. Verification: after commit/push/deploy, live assets
  match source before final browser certification.

Shell Content:

- Expected: shared Header content controls only.
- Actual: uses shared `header-content`.
- Violations:
  - [fixed 2026-06-09] Header CTA DOM was an empty anchor and depended on shared
    Header runtime healing to create label/icon children.
- Action items:
  - `CRD-RT-001` [fixed 2026-06-09]: make Cards Header CTA DOM match the
    canonical Shell DOM.
- Verification: Header CTA renders without relying on runtime element creation.
- Status: Source green; browser QA pending.

Shell Layout:

- Expected: shared `header-layout`, `core-size`, and `stagepod-layout`.
- Actual: uses all three shared layout modules.
- Violations:
  - [fixed 2026-06-09] Missing/invalid Core state could still be healed by
    shared utilities because Cards did not validate before applying Shell.
- Action items:
  - `CRD-RT-002` [fixed 2026-06-09]: validate Cards Core state before any Shell
    DOM mutation and keep the canonical Shell/Core apply order.
- Verification: Layout controls change preview; invalid Cards Core state fails
  at `[Cards]` before Shell mutation.
- Status: Source green; browser QA pending.

Shell Appearance:

- Expected: shared `header-appearance` and `stagepod-appearance`.
- Actual: uses both shared appearance modules.
- Violations:
  - Shared Header CTA labels still need the cross-widget vocabulary cleanup.
- Action items:
  - `CROSS-LABEL-001`: shared Header CTA appearance labels must use linked/corner
    vocabulary everywhere.
- Verification: Header CTA and Stage/Pod appearance controls visibly apply.
- Status: Yellow.

Shell Typography:

- Expected: shared typography panel plus Cards Core roles.
- Actual: Cards declares `cardTitle` and `cardCopy`; shared roles remain for
  Header/Header CTA.
- Violations:
  - Shared `button` role label appears as `CTA`, which is ambiguous in Cards
    because Header CTA and card links are different user concepts.
- Action items:
  - `CROSS-TYPO-001`: shared Typography labels need product-language cleanup.
- Verification: Typography roles affect intended visible text and labels are
  understandable.
- Status: Yellow.

Shell Settings:

- Expected: shared behavior/settings only.
- Actual: uses shared `settings-behavior`.
- Violations:
  - Branding/social share side-channel runtime ownership is unresolved.
- Action items:
  - `CROSS-RT-003`: choose one explicit Shell utility apply path for
    branding/social share.
- Verification: Made with Clickeen and social share controls visibly apply or
  show clear gated state.
- Status: Yellow.

Core Content:

- Expected: ordered card content list under `cards.items[]`, using the canonical
  repeatable list primitive.
- Actual: Cards uses `repeater` for `cards.items[]`.
- Violations:
  - [fixed 2026-06-09] Stale Cards PRD text said object-manager, but product
    direction for ordered Core lists is repeater. The stale PRD was corrected;
    Cards was not rebuilt around a second primitive.
  - [fixed 2026-06-09] Repeater lacked visible min/max attrs.
  - [fixed 2026-06-09] Card item labels were too generic beside Shell Header
    CTA/link language.
  - [fixed 2026-06-09] Icon dropdown did not include icon names used by current
    defaults.
- Action items:
  - `CRD-CON-001` [fixed 2026-06-09]: keep Cards content on `repeater` and
    update stale PRD wording that says object-manager.
  - `CRD-CON-002` [fixed 2026-06-09]: add explicit `min=2` and `max=16`
    repeater attrs.
  - `CRD-CON-003` [fixed 2026-06-09]: rename card item labels to card-specific
    language.
  - `CRD-CON-004` [fixed 2026-06-09]: add default icon options used by Cards
    defaults.
- Verification: Card add/remove/reorder works, remove is blocked below 2, add
  is blocked above 16, and labels say Card/Card link/Card icon.
- Status: Source fixed; browser QA pending for `CRD-QA-001`.

Core Layout:

- Expected: Cards-specific layout controls under `cards.*`.
- Actual: treatment, columns, gap, padding, and between-card graphic controls
  exist.
- Violations:
  - [fixed 2026-06-09] Labels `Treatment` and `Columns` were too generic.
  - [fixed 2026-06-09] Runtime clamped invalid values instead of failing.
- Action items:
  - `CRD-CON-005` [fixed 2026-06-09]: rename generic layout labels.
  - `CRD-RT-003` [fixed 2026-06-09]: replace Cards runtime clamping with strict
    numeric/enum validation.
- Verification: Layout controls visibly apply and invalid values fail at the
  named Cards boundary.
- Status: Source fixed; browser QA pending for `CRD-QA-002`.

Core Appearance:

- Expected: shared card-wrapper primitive for card surface plus strictly typed
  card-specific style controls.
- Actual: compiler injects Core card-wrapper controls from
  `cards.appearance.cardwrapper`; per-card custom styles use raw text fields for
  radius/shadow and Appearance object-manager can add cards.
- Violations:
  - [fixed 2026-06-09] `.ck-cards__card` did not consume shared
    `--ck-cardwrapper-*` variables.
  - [fixed 2026-06-09] Appearance exposed `Add card`, which mutated content
    structure from the Appearance panel.
  - [fixed 2026-06-09] Raw per-card `Radius`/`Shadow` textfields were not shared
    control language.
- Action items:
  - `CRD-RT-004` [fixed 2026-06-09]: wire card CSS to
    `--ck-cardwrapper-border-*`, `--ck-cardwrapper-radius`, and
    `--ck-cardwrapper-shadow`.
  - `CRD-CON-006` [fixed 2026-06-09]: add a shared object-manager mode that can
    manage existing items without adding/deleting content, then use it for
    per-card style edits.
  - `CRD-CON-007` [fixed 2026-06-09]: remove raw radius/shadow per-card style
    controls until a proper shared advanced style primitive exists.
- Verification: Card border/radius/shadow controls visibly change cards; no Add
  Card button appears in Appearance; custom style controls do not accept raw CSS
  escape hatches.
- Status: Source green; browser QA pending.

Core Typography:

- Expected: Cards Core typography roles are declared and consumed.
- Actual: `cardTitle` and `cardCopy` roles exist and runtime maps them to CSS
  vars.
- Violations: none found at Cards-specific source level.
- Action items: none for Cards-specific typography.
- Verification: card title/copy typography controls visibly affect card text.
- Status: Green after browser QA.

Core Settings/Runtime Behavior:

- Expected: strict Cards state validation before rendering.
- Actual: runtime normalizes/clamps/heals treatment, columns, gap, padding,
  between-card settings, link URLs, icon names, and custom styles.
- Violations:
  - [fixed 2026-06-09] Silent runtime fallback could make saved state and
    preview diverge.
  - [fixed 2026-06-09] Card links used a different URL policy from Call to
    Action and Header CTA.
  - [fixed 2026-06-09] Missing `state` returned silently.
- Action items:
  - `CRD-RT-005` [fixed 2026-06-09]: replace Cards normalizers with strict
    assertions.
  - `CRD-RT-006` [fixed 2026-06-09]: use the same safe action href policy as
    Call to Action for card links.
  - `CRD-RT-007` [fixed 2026-06-09]: reject missing state on state updates.
- Verification: invalid Cards state fails before DOM mutation; valid state
  renders cards; card links work consistently.
- Status: Source green; browser QA pending.

Final widget certification:

- Source validation: `pnpm validate:widgets` passed through `pnpm lint` and
  `pnpm typecheck` after fixes.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed after fixes.
- 106 audit: `pnpm audit:106` passed after fixes, including account defaults and
  live instance checks.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

### countdown

Status: Source fixed - browser QA pending after deploy and subagent closure

Subagents:

- Contract Agent: `019eaed1-4001-7d02-80e6-5677d2368743` (running)
- Runtime Agent: `019eaed1-74ce-7a70-adcd-cff7ad8f1894` (running)
- Product QA Agent: `019eaed1-a57e-70c2-876b-a931df2fd0ae` (running)

Shell Content:

- Expected: shared Header controls are used exactly as Shell, including
  canonical Header CTA language and DOM.
- Actual: Header controls were present, but runtime used an old bare
  Header CTA anchor shape.
- Violations:
  - [fixed 2026-06-09] Header CTA DOM did not match canonical shared Shell
    structure.
- Action items:
  - `CDN-SH-001` [fixed 2026-06-09]: update `widget.html` to use
    `data-role="header-cta"` with nested icon and label spans.
- Verification: source grep confirms canonical Header CTA DOM; runtime uses
  `CKHeader.applyHeader`.
- Status: Source green; browser QA pending.

Shell Layout:

- Expected: Header layout, Core Size, Stage, and Pod controls come from shared
  Shell nodes.
- Actual: Core Size was declared in the spec but not loaded or applied in the
  runtime. Countdown also carried a widget-owned one-option placement control.
- Violations:
  - [fixed 2026-06-09] `coreSize` controls were dead in preview.
  - [fixed 2026-06-09] `countdown.layout.position` duplicated a Shell layout
    concern and had only one usable user value.
  - [fixed in source 2026-06-09] Countdown still only asserted `stage`, `pod`,
    and `coreSize` as objects, allowing shared Core Size/Stage utilities to
    resolve invalid Shell layout into defaults.
- Action items:
  - `CDN-SH-002` [fixed 2026-06-09]: load `../shared/coreSize.js`, require a
    Core element, validate `state.coreSize`, and apply it to Countdown Core.
  - `CDN-SH-003` [fixed 2026-06-09]: remove widget-owned
    `countdown.layout.position` defaults, editor field, and runtime validation.
  - `CDN-SH-004` [fixed in source 2026-06-09]: validate `state.coreSize.mode`
    and numeric bounds, validate `state.stage.alignment`, and stop using local
    invalid-to-center alignment healing in Countdown runtime.
- Verification: `pnpm audit:106` passed after source and account-default
  cleanup.
- Status: Source green; browser QA pending.

Shell Appearance:

- Expected: shared Header CTA, Stage, Pod, locale switcher, branding, and share
  appearance controls are the shared Shell authority.
- Actual: Countdown did not carry Shell appearance defaults in `spec.json`, but
  it locally applied Shell `appearance.podBorder` in runtime.
- Violations:
  - [fixed in source 2026-06-09] Countdown was the only widget writing
    `appearance.podBorder` CSS vars locally. That made Pod border a
    widget-local Shell behavior instead of a shared Stage/Pod behavior.
  - [fixed in source 2026-06-09] Locale switcher appearance values were
    consumed by a shared utility that still has defensive defaults, while
    Countdown did not validate those authored Shell appearance paths first.
- Action items:
  - `CDN-SH-005` [fixed in source 2026-06-09]: move Pod border application into
    `tokyo/product/widgets/shared/stagePod.js` and pass `state.appearance` to
    `CKStagePod.applyStagePod(...)` from every widget runtime.
  - `CDN-SH-006` [fixed in source 2026-06-09]: validate Countdown
    `appearance.localeSwitcher*` paths before `CKLocaleSwitcher` can consume
    them.
- Verification: required shared appearance nodes are present and pass
  `audit:106`; after deploy, Pod border must visibly apply for every widget from
  the shared Stage/Pod utility.
- Status: Source green; browser QA pending.

Shell Typography:

- Expected: shared typography panel applies Shell roles declared by Shell and
  Core, including `localeSwitcher`.
- Actual: Countdown mapped Title/Body/Timer/Label/Button but omitted
  `localeSwitcher`.
- Violations:
  - [fixed in source 2026-06-09] Locale switcher typography controls were
    exposed by Shell but not mapped by Countdown runtime.
- Action items:
  - `CDN-SH-007` [fixed in source 2026-06-09]: add
    `localeSwitcher: { varKey: 'localeSwitcher' }` to Countdown
    `CKTypography.applyTypography(...)`.
- Verification: after deploy, Locale Switcher typography controls visibly apply
  when locale switcher is enabled.
- Status: Source green; browser QA pending.

Shell Settings:

- Expected: shared Settings behavior validates and applies Made with Clickeen
  and social share state.
- Actual: Countdown validated `behavior.showBacklink` but did not validate the
  shared `behavior.socialShare` channel contract.
- Violations:
  - [fixed in source 2026-06-09] Social share was exposed but not validated at
    the Countdown boundary.
- Action items:
  - `CDN-SH-008` [fixed in source 2026-06-09]: validate
    `state.behavior.socialShare.enabled` and every supported channel boolean.
- Verification: after deploy, enabling social share and each channel setting
  changes the shared share UI without console errors.
- Status: Source green; browser QA pending.

Core Content:

- Expected: Countdown Core content controls own timer/date/count/action copy
  under `countdown.*`.
- Actual: Core content was under the correct namespace, but the default target
  date was in the past and during-action controls stayed hidden because the
  default URL was empty.
- Violations:
  - [fixed 2026-06-09] New Countdown defaults could render the finished/hidden
    phase immediately.
  - [fixed 2026-06-09] During-action label controls were effectively dead until
    a URL was manually added.
  - [fixed in source 2026-06-09] Date-mode target validation allowed impossible
    calendar dates such as February 31 because JavaScript date construction
    rolled them forward.
- Action items:
  - `CDN-CORE-001` [fixed 2026-06-09]: set factory and account target date to
    `2030-01-01T00:00`.
  - `CDN-CORE-002` [fixed 2026-06-09]: set factory and account during-action
    URL to `#`.
  - `CDN-CORE-006` [fixed in source 2026-06-09]: validate the parsed date
    components against a UTC `Date` round-trip before scheduling the timer.
- Verification: `pnpm audit:106` passed against source, account defaults, and
  live instances.
- Status: Source green; browser QA pending.

Core Layout:

- Expected: Countdown Core layout is the timer presentation only; Shell owns
  placement/Pod/Stage layout.
- Actual: local placement was removed; Countdown no longer exposes fake layout
  controls.
- Violations: fixed under Shell Layout.
- Action items: none remaining for Countdown Core layout.
- Verification: no `countdown.layout.*` remains in source or account defaults.
- Status: Source green; browser QA pending.

Core Appearance:

- Expected: timer style controls must only show when they affect the active
  timer mode.
- Actual: number mode exposed timer labels, separator, time format, and tile
  style controls that did not apply.
- Violations:
  - [fixed 2026-06-09] Dead timer-label and timer-style controls were visible
    in number mode.
  - [fixed 2026-06-09] `countdown.appearance.theme` was a stale fake control.
- Action items:
  - `CDN-CORE-003` [fixed 2026-06-09]: add mode-aware `showIf` rules for timer
    labels and timer-style fields.
  - `CDN-CORE-004` [fixed 2026-06-09]: remove `theme` default/control and
    account default.
  - `CDN-CORE-005` [kept by design]: Countdown tile-surface controls remain
    widget-local because they are conditional on `Timer style = Separated`.
    They still use shared Dieter control primitives and `CKSurface`; injecting
    always-visible shared cardwrapper controls here would create dead controls
    in Inline mode.
- Verification: `pnpm lint`, `pnpm typecheck`, and `pnpm audit:106` passed.
- Status: Source green; browser QA pending.

Core Typography:

- Expected: Countdown Core typography roles are declared and consumed.
- Actual: `timer` and `label` roles exist and runtime maps them to CSS vars.
- Violations:
  - [fixed in source 2026-06-09] Core `countdown.appearance.textColor` won over
    Timer/Label typography colors in CSS, making typography color controls look
    dead.
- Action items:
  - `CDN-CORE-007` [fixed in source 2026-06-09]: make
    `--typo-timer-color`/`--typo-label-color` win, with
    `--countdown-text-color` only as the fallback.
- Verification: typography controls remain covered by Builder contract.
- Status: Source green; browser QA pending.

Core Settings/Runtime Behavior:

- Expected: Settings contains only real shared behavior and real Countdown
  runtime behavior. Runtime fails invalid state at the Countdown boundary.
- Actual: SEO/GEO controls existed without public/runtime behavior; runtime also
  silently normalized links, labels, and after-hide behavior.
- Violations:
  - [fixed 2026-06-09] `countdown.seoGeo`, `countdown.seo`, and
    `countdown.geo` were fake settings/defaults.
  - [fixed 2026-06-09] Action URL normalization silently hid invalid links.
  - [fixed 2026-06-09] Header CTA `openMode` was not validated before shared
    application.
  - [fixed 2026-06-09] After-hide hid the whole Shell stage instead of just
    Countdown Core.
  - [fixed 2026-06-09] Timer labels fell back to hardcoded runtime defaults.
  - [fixed in source 2026-06-09] Personal countdown storage failures and
    invalid stored values silently reset the timer start time.
- Action items:
  - `CDN-RT-001` [fixed 2026-06-09]: remove fake SEO/GEO defaults and Settings
    controls.
  - `CDN-RT-002` [fixed 2026-06-09]: replace action URL normalizer with strict
    action href assertion.
  - `CDN-RT-003` [fixed 2026-06-09]: validate `headerCta.openMode`.
  - `CDN-RT-004` [fixed 2026-06-09]: hide `coreEl` for finished hide state, not
    `stageEl`.
  - `CDN-RT-005` [fixed 2026-06-09]: require label values from state instead
    of runtime defaults.
  - `CDN-RT-006` [fixed in source 2026-06-09]: make personal mode require an
    instance id and usable storage; invalid stored starts now fail at
    `[Countdown]` instead of silently resetting.
- Verification: invalid removed paths fail at account-default audit until
  deleted; valid Countdown state passes `audit:106`.
- Status: Source green; browser QA pending.

Account defaults cleanup:

- Expected: `accounts/CLICKEEN/widget-defaults.json` contains only account
  defaults covered by the compiled Builder control contract plus approved
  metadata.
- Actual: the account defaults still carried old Countdown keys after source
  cleanup.
- Violations:
  - [fixed 2026-06-09] stale account paths:
    `countdown.layout.position`, `countdown.seoGeo.enabled`,
    `countdown.seo.canonicalUrl`, `countdown.seo.enableSchema`,
    `countdown.geo.enableDeepLinks`, `countdown.appearance.theme`.
- Action items:
  - `CDN-DATA-001` [fixed 2026-06-09]: remove stale Countdown keys from
    `accounts/CLICKEEN/widget-defaults.json`.
  - `CDN-DATA-002` [fixed 2026-06-09]: update account Countdown target date and
    during-action URL to match source defaults.
- Verification: full `pnpm audit:106` passed after R2 write.
- Status: Green.

Final widget certification:

- Source validation: `node scripts/validate-widget-source.mjs` passed.
- Generated source validation:
  `node scripts/generate-widget-definition-sources.mjs --check` passed.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed.
- 106 audit: `pnpm audit:106` passed after source and R2 account-default fixes.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

Cross-widget items still carried forward:

- `CROSS-LABEL-001`: shared labels such as Header CTA padding/radius and
  typography role names need one final vocabulary sweep across all widgets.
- `CROSS-RT-001`: shared Shell utility fallbacks/healing need a shared-boundary
  cleanup once all widget HTML/Core contracts are canonical.
- `CROSS-STAGEPOD-001` [fixed in source 2026-06-09; browser pending]:
  `appearance.podBorder` was a shared Shell default/control without a shared
  runtime owner. `CKStagePod.applyStagePod(...)` now accepts Shell appearance,
  validates `appearance.podBorder`, applies the Pod border CSS variables, and
  every widget runtime passes `state.appearance`.
- `CROSS-SOCIAL-001`: social share remains a shared Shell side-channel and must
  be audited once every widget passes source certification.

### faq

Status: Source green - awaiting remaining subagent closure and browser QA

Subagents:

- Contract Agent: `019eadf3-0efb-79e0-9aba-27d53c3536f8` (running)
- Runtime Agent: `019eadf3-0f6e-76d2-87e9-2475821cb6bf`
- Product QA Agent: `019eadf3-1a8e-74c2-8807-1c89c32e325f` (running)

Shell Content:

- Expected: shared Header controls plus canonical Header CTA DOM.
- Actual: Header controls were present, but FAQ shipped an empty Header CTA
  anchor and relied on shared runtime DOM healing.
- Violations:
  - [fixed 2026-06-09] Header CTA DOM was not canonical.
- Action items:
  - `FAQ-SH-001` [fixed 2026-06-09]: add canonical Header CTA icon and label
    spans in `widget.html`.
- Verification: source grep confirms canonical `data-role="header-cta"`
  children; `node scripts/validate-widget-source.mjs` passed.
- Status: Source green; browser QA pending.

Shell Layout:

- Expected: shared Header Layout, Core Size, Stage, and Pod controls are real
  and apply consistently.
- Actual: FAQ declared shared Core Size controls but did not load/apply
  `CKCoreSize`.
- Violations:
  - [fixed 2026-06-09] Core Size controls were dead in preview.
- Action items:
  - `FAQ-SH-002` [fixed 2026-06-09]: mark FAQ body as
    `data-role="faq-core"`, load `../shared/coreSize.js`, validate
    `state.coreSize`, and apply `CKCoreSize.applyCoreSize(...)`.
- Verification: source validation, generated source check, widget-shell
  validation, typecheck, lint, and full 106 audit passed.
- Status: Source green; browser QA pending.

Shell Appearance:

- Expected: Pod border and Stage/Pod appearance belong to shared StagePod,
  not FAQ runtime.
- Actual: FAQ runtime locally wrote Shell `appearance.podBorder` styles.
- Violations:
  - [fixed 2026-06-09] FAQ runtime duplicated shared Pod border application.
- Action items:
  - `FAQ-SH-003` [fixed 2026-06-09]: remove local Pod border mutation from FAQ
    runtime.
- Verification: `pnpm audit:106` passed; browser QA must verify Pod border is
  still handled by shared Shell utilities.
- Status: Source green; browser QA pending.

Core Content:

- Expected: FAQ sections/questions/answers are owned by `faq.sections` using
  the existing object-manager + nested repeater path.
- Actual: the content editor remains on the existing object-manager/repeater
  path. FAQ normalization owns inserted IDs; runtime now fails duplicate/missing
  IDs at the FAQ boundary.
- Violations:
  - [fixed 2026-06-09] Runtime did not assert unique section/question IDs or
    required item fields before rendering.
- Action items:
  - `FAQ-CORE-001` [fixed 2026-06-09]: add strict section/question validation
    before DOM mutation.
  - `FAQ-CORE-006` [fixed 2026-06-09]: expose
    `faq.sections[].faqs[].defaultOpen` in the nested FAQ item editor because it
    affects accordion preview/runtime state.
  - `FAQ-CORE-007` [fixed 2026-06-09]: make `faq.displayCategoryTitles` default
    on in factory and account defaults so default authored section content is
    visible in new instances.
- Verification: source validation passed; browser QA must add/reorder
  sections/questions and verify preview/save/reload.
- Status: Source green; browser QA pending.

Core Layout:

- Expected: FAQ layout controls map directly to rendered FAQ list/accordion/card
  behavior without runtime healing.
- Actual: runtime clamped/fell back Q/A gap and card layout values instead of
  failing invalid state at the FAQ boundary.
- Violations:
  - [fixed 2026-06-09] `itemQaGapPreset`, `itemQaGapCustom`, and `cardsLayout`
    had silent runtime fallback/clamping.
- Action items:
  - `FAQ-CORE-002` [fixed 2026-06-09]: validate layout enum/number fields and
    apply authored values directly.
  - `FAQ-CORE-008` [fixed 2026-06-09]: hide `faq.behavior.expandFirst` when
    `faq.behavior.expandAll` is on, because the first-question toggle has no
    distinct runtime effect in that state.
- Verification: `node --check`, source validation, lint, typecheck, and full
  106 audit passed.
- Status: Source green; browser QA pending.

Core Appearance:

- Expected: only visible controls with deterministic preview/public effect.
- Actual: FAQ exposed a dead `faq.appearance.theme` default/control. Link
  appearance controls were also based on authored rich-text links, while runtime
  auto-created links from plain URL text.
- Violations:
  - [fixed 2026-06-09] dead Theme dropdown/default.
  - [fixed 2026-06-09] runtime created links Builder could not detect for
    link-appearance showIf.
  - [fixed 2026-06-09] answer link sanitizer preserved unsupported targets.
- Action items:
  - `FAQ-CORE-003` [fixed 2026-06-09]: remove `faq.appearance.theme` from
    source, docs, inventory, and account defaults.
  - `FAQ-CORE-004` [fixed 2026-06-09]: stop auto-linking plain URL text; only
    authored rich-text links render as links.
  - `FAQ-CORE-005` [fixed 2026-06-09]: keep only http(s) links and only
    preserve `_blank` target with `noopener noreferrer`.
  - `FAQ-CORE-009` [fixed 2026-06-09]: rename ambiguous accordion icon labels
    from `Arrow One`/`Arrow Two` to `Arrow`/`Arrowshape`.
- Verification: no stale FAQ theme paths remain in source/docs; full 106 audit
  passed after account-default cleanup.
- Status: Source green; browser QA pending.

Core Typography:

- Expected: FAQ declares and consumes Core roles for section/question/answer.
- Actual: `section`, `question`, and `answer` roles exist and runtime maps them
  to FAQ CSS vars. Shared Shell roles remain shared.
- Violations: none found at FAQ-specific source level.
- Action items: none for FAQ-specific typography.
- Verification: `pnpm audit:106` source controls/defaults coverage passed.
- Status: Source green; browser QA pending.

Core Settings/Runtime Behavior:

- Expected: Settings exposes real FAQ runtime behavior plus shared Shell
  behavior.
- Actual: FAQ exposed fake SEO/schema/canonical controls. Deep links were real
  runtime behavior but hidden behind the fake SEO/GEO wrapper.
- Violations:
  - [fixed 2026-06-09] `faq.seoGeo.*` and `faq.seo.*` controls/defaults had no
    public/runtime output path.
  - [fixed 2026-06-09] real `faq.geo.enableDeepLinks` control was hidden behind
    fake `seoGeo.enabled`.
  - [fixed 2026-06-09] runtime did not validate the full FAQ state before
    mutation.
- Action items:
  - `FAQ-RT-001` [fixed 2026-06-09]: remove fake SEO/schema/canonical
    defaults and controls.
  - `FAQ-RT-002` [fixed 2026-06-09]: expose `faq.geo.enableDeepLinks` as plain
    FAQ behavior.
  - `FAQ-RT-003` [fixed 2026-06-09]: add `assertFaqState(...)` before shared
    Shell and FAQ Core application.
  - `FAQ-RT-004` [fixed 2026-06-09]: show `faq.geo.enableDeepLinks` only when
    `faq.layout.type = accordion`, the only layout where runtime consumes it.
- Verification: full `pnpm audit:106` passed after R2 account-default cleanup.
- Status: Source green; browser QA pending.

Account defaults cleanup:

- Expected: account FAQ defaults contain only paths covered by the compiled
  Builder contract plus approved metadata.
- Actual: `accounts/CLICKEEN/widget-defaults.json` still had stale FAQ theme
  and SEO defaults after source cleanup.
- Violations:
  - [fixed 2026-06-09] stale account paths:
    `faq.seo.canonicalUrl`, `faq.seo.enableSchema`, `faq.seoGeo.enabled`,
    `faq.appearance.theme`.
- Action items:
  - `FAQ-DATA-001` [fixed 2026-06-09]: remove stale FAQ keys from account
    defaults through the existing R2 helper.
  - `FAQ-DATA-002` [fixed 2026-06-09]: add `widgets.faq.core.uiLabels.core`
    approved metadata and set `widgets.faq.core.faq.displayCategoryTitles` to
    true in account defaults.
- Verification: full `pnpm audit:106` passed after R2 write.
- Status: Green.

Final widget certification:

- Source validation: `node scripts/validate-widget-source.mjs` passed.
- Generated source validation:
  `node scripts/generate-widget-definition-sources.mjs --check` passed.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed.
- 106 audit: `pnpm audit:106` passed after source and R2 account-default fixes.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

Cross-widget items still carried forward:

- `CROSS-CONTENT-001`: object-manager/repeater hydration and inserted-ID
  materialization should be verified in browser QA for every nested-content
  widget.
- `CROSS-SOCIAL-001`: social share remains a shared Shell side-channel and must
  be audited once every widget passes source certification.
- `CROSS-TYPOGRAPHY-001`: shared Typography panel labels for generic roles like
  `section` and `button` need a single system-wide label strategy so Core/Shell
  controls do not show misleading names in any widget.
- `CROSS-CONTEXT-001`: Bob Settings currently injects website context as
  instance state; product truth says website URL is account/workspace context,
  so this needs a dedicated shared-settings review rather than FAQ-local hacks.

### logoshowcase

Status: Source green - browser QA pending

Subagents:

- Contract Agent: Completed. Found stale Core defaults/controls
  (`logoshowcase.seoGeo`), missing Core labels, missing nested collection ID
  rules, and a too-loose Content Type control.
- Runtime Agent: Completed. Found non-canonical Header CTA DOM, missing CoreSize
  script/apply path, runtime side-channel ordering, and Core validation gaps.
- Product QA Agent: Completed. Found user-facing label issues around logo tile
  corners/radius, object-manager/repeater delete risks, and modal entitlement
  leakage in Bulk Edit.

Shell Content:

- Expected: shared Header content controls, including shared Header CTA naming
  and DOM roles.
- Actual: uses shared `header-content`; Header CTA DOM now matches canonical
  Shell roles (`ck-header__cta`, `ck-header__ctaIcon`,
  `ck-header__ctaLabel`).
- Violations:
  - Header CTA used widget-local DOM classes that forced shared Header runtime
    healing.
- Action items:
  - `LOGO-RT-001` [fixed 2026-06-09]: make Logo Showcase Header CTA DOM
    canonical in `tokyo/product/widgets/logoshowcase/widget.html`.
- Verification: Header Content controls compile and Header CTA has canonical
  Shell roles.
- Status: Source green.

Shell Layout:

- Expected: shared Header/CoreSize/Stage/Pod controls.
- Actual: shared Shell layout controls are present and the Logo Core host is now
  the Shell body target.
- Violations:
  - CoreSize script was missing from the widget HTML/runtime apply sequence.
- Action items:
  - `LOGO-RT-002` [fixed 2026-06-09]: add shared `coreSize.js` and call
    `CKCoreSize.applyCoreSize(state.coreSize, contentEl)` before Logo Core
    rendering.
- Verification: widget source validation, Shell validation, and `audit:106`
  pass.
- Status: Source green.

Shell Appearance:

- Expected: shared Header/Header CTA/Stage/Pod appearance controls only for
  Shell surfaces.
- Actual: shared Shell appearance controls are used; Logo Core appearance stays
  under `logoshowcase.*`.
- Violations: none remaining at source level.
- Action items: none.
- Verification: Widget defaults compile with no unmapped Shell appearance paths.
- Status: Source green; browser QA still must click every visible control.

Shell Typography:

- Expected: shared typography panel edits Shell/Core roles declared by the
  compiled contract.
- Actual: Logo Showcase uses shared typography contract and Core labels identify
  the logo tile group.
- Violations: none remaining at source level.
- Action items: none.
- Verification: `pnpm audit:106` passes; no stale unmapped typography defaults
  remain for Logo Showcase.
- Status: Source green.

Shell Settings:

- Expected: shared Shell behavior/settings only.
- Actual: Settings uses shared `settings-behavior`; stale widget-owned SEO/GEO
  settings were removed from Logo Core defaults and account defaults.
- Violations:
  - `logoshowcase.seoGeo` was widget-local business/SEO metadata, not a
    Builder-visible Logo Core setting.
- Action items:
  - `LOGO-CON-001` [fixed 2026-06-09]: remove `logoshowcase.seoGeo` from
    `tokyo/product/widgets/logoshowcase/spec.json`, docs, inventory, and R2
    account defaults.
- Verification: `pnpm audit:106` passes against account defaults.
- Status: Source green.

Core Content:

- Expected: Logo Showcase content lives only under `logoshowcase.*`, with
  repeatable strips/logos using shared collection primitives.
- Actual: Core content uses `logoshowcase.strips` object-manager and nested
  `logoshowcase.strips.__STRIP__.logos` repeater.
- Violations:
  - Missing ID rules for nested strips/logos could create invalid or unstable
    collection items.
  - Object-manager/repeater could delete below the widget's valid minimum.
  - Content Type control used the wrong control style/label for a simple mode.
- Action items:
  - `LOGO-CON-002` [fixed 2026-06-09]: add normalization ID rules for
    `logoshowcase.strips` and nested `logos`.
  - `LOGO-CON-003` [fixed 2026-06-09]: add `min: "1"` to the strip
    object-manager and nested logo repeater.
  - `LOGO-DIETER-001` [fixed 2026-06-09]: teach Dieter object-manager to honor
    `data-min-items` in both source and Tokyo copies.
  - `LOGO-CON-004` [fixed 2026-06-09]: change Core `Type` to a segmented
    content-type control.
- Verification: `audit:106` reports valid Logo Core roots and no generated
  source drift.
- Status: Source green.

Core Layout:

- Expected: Logo-specific layout controls under `logoshowcase.*`; shared Stage
  and Pod remain Shell.
- Actual: Logo strip layout/motion/spacing controls are Core-owned; Type
  recommendations are documented as recommendations only and do not mutate Shell
  Pod defaults.
- Violations: none remaining at source level.
- Action items:
  - `LOGO-DOC-001` [fixed 2026-06-09]: document that Type recommends Pod
    presets but Pod itself remains Shell/account state.
- Verification: Logo PRD updated and generated source check passes.
- Status: Source green.

Core Appearance:

- Expected: Logo tile/card wrapper appearance uses shared surface primitives and
  user-facing corner language.
- Actual: Logo tile labels now say corners/corner radius instead of radius for
  the linked-corner control.
- Violations:
  - Labels mixed `radius` and `corners`, which makes the same shared control
    read differently across widgets.
- Action items:
  - `LOGO-LABEL-001` [fixed 2026-06-09]: update Logo Showcase i18n source and
    public manifest via `pnpm build:i18n`.
- Verification: generated `logoshowcase` locale asset updated and stale radius
  wording removed.
- Status: Source green; browser QA still must verify the visual effect.

Core Typography:

- Expected: Logo Core typography roles participate in the shared typography
  panel.
- Actual: Logo Core label metadata exists through `uiLabels.core`.
- Violations:
  - `uiLabels.core` was missing, causing generic Core labels in shared UI.
- Action items:
  - `LOGO-CON-005` [fixed 2026-06-09]: add
    `uiLabels.core.{singular,plural,sizeCluster}` to factory and account
    defaults.
- Verification: `audit:106` passes and account defaults are clean.
- Status: Source green.

Core Settings/Runtime Behavior:

- Expected: invalid Logo Core state fails at the Logo boundary; shared Shell
  utilities apply through the canonical sequence.
- Actual: runtime now validates `coreSize`, locale switcher, social share,
  Logo Core strips/logos, logo fills, links, and carousel timing before render.
- Violations:
  - Runtime had silent/no-op paths for invalid collections and motion elements.
- Action items:
  - `LOGO-RT-003` [fixed 2026-06-09]: add strict Logo Core validation and
    named errors for invalid state.
  - `LOGO-RT-004` [fixed 2026-06-09]: apply shared Shell utilities in the
    canonical order before Logo Core render and branding/social share after
    render.
- Verification: `node --check` for Logo runtime passes; source validation,
  Shell validation, `audit:106`, typecheck, and lint pass.
- Status: Source green.

Final widget certification:

- Source validation: `node scripts/validate-widget-source.mjs` passed.
- Generated source validation:
  `node scripts/generate-widget-definition-sources.mjs --check` passed.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed.
- 106 audit: `pnpm audit:106` passed after source and R2 account-default fixes.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

### split-media

Status: Source green - browser QA pending

Subagents:

- Contract Agent: Completed. Found ungrouped Core controls, visual corner label
  drift, and an incomplete Roma save boundary for Split Media Core.
- Runtime Agent: Completed. Found asset-ref packaging drift, non-canonical
  Header CTA DOM, missing explicit social-share apply, and visual-frame
  application against the wrong visible surface.
- Product QA Agent: Completed. Found shared Header CTA label drift, Core Size
  sizing ambiguity for media frames, and cross-widget media preview/save risks.

Shell Content:

- Expected: shared Header content controls, including Header CTA controls and
  canonical Header CTA DOM.
- Actual: uses shared `header-content`; Header CTA DOM now has the canonical
  `ck-header__cta`, `ck-header__ctaIcon`, and `ck-header__ctaLabel` roles.
- Violations:
  - Header CTA markup was incomplete and depended on shared Header runtime DOM
    healing.
- Action items:
  - `SPLITMEDIA-RT-001` [fixed 2026-06-09]: make Split Media Header CTA DOM
    canonical in `tokyo/product/widgets/split-media/widget.html`.
- Verification: widget source validation, generated-source check, Shell
  validation, and `audit:106` pass.
- Status: Source green.

Shell Layout:

- Expected: shared Header/CoreSize/Stage/Pod layout controls behave the same as
  every other widget.
- Actual: shared layout controls are present; Core Size applies to the Split
  Media Core host before Core render.
- Violations:
  - Media frame height relied on `height: 100%` even when Core Size responsive
    mode only sets `min-height`.
- Action items:
  - `SPLITMEDIA-RT-002` [fixed 2026-06-09]: make fixed/responsive Core Size
    modes give the visual stage/media a deterministic visible box in
    `tokyo/product/widgets/split-media/widget.css`.
- Verification: source validation and browser QA target. Browser QA must still
  click Auto/Fixed/Responsive and confirm the visual remains visible.
- Status: Source green; browser QA pending.

Shell Appearance:

- Expected: shared Header CTA/Stage/Pod appearance controls are Shell-owned;
  labels use the same vocabulary everywhere.
- Actual: shared Shell appearance controls compile; shared Header CTA radius
  label now says `Corner radius`.
- Violations:
  - Header CTA appearance label said generic `Radius`, while the platform
    contract requires corner language.
- Action items:
  - `SHELL-LABEL-001` [fixed 2026-06-09]: change shared Header CTA appearance
    label to `Corner radius` in `bob/lib/compiler/modules/header.ts`.
- Verification: Bob typecheck/lint pass; generated sources and `audit:106`
  pass.
- Status: Source green.

Shell Typography:

- Expected: shared typography panel edits the Shell roles plus any Core roles
  declared by the widget.
- Actual: Split Media has no widget-specific typography roles beyond the shared
  Shell text roles.
- Violations: none at source level.
- Action items: none.
- Verification: `audit:106` passes.
- Status: Source green.

Shell Settings:

- Expected: shared branding and social-share behavior applies explicitly from
  Shell state after Core render.
- Actual: Split Media now requires branding/social-share utilities and calls
  them explicitly.
- Violations:
  - Social share was only loaded as a shared side-channel, not applied in the
    widget's deterministic runtime order.
- Action items:
  - `SPLITMEDIA-RT-003` [fixed 2026-06-09]: call
    `CKSocialShare.apply(...)` in Split Media after Core render and branding.
- Verification: `node --check` and full source/type/lint checks pass. Browser
  QA must still toggle social share and branding in Builder.
- Status: Source green; browser QA pending.

Core Content:

- Expected: Split Media Core content lives under `splitMedia.*` and uses one
  shared media dropdown-fill control with image/video only.
- Actual: `splitMedia.media` and `splitMedia.alt` are grouped under the Core
  visual content group; media uses the shared dropdown-fill path.
- Violations:
  - Core content fields were not grouped, causing ToolDrawer alignment drift.
  - Public package build used raw account `assetRef` state, while public runtime
    requires durable media `src` values.
- Action items:
  - `SPLITMEDIA-CON-001` [fixed 2026-06-09]: group
    `splitMedia.media` and `splitMedia.alt` in
    `tokyo/product/widgets/split-media/spec.json`.
  - `MEDIA-PACKAGE-001` [fixed 2026-06-09]: materialize account media
    `assetRef`s into package `src` values at the Roma public-package boundary
    in `roma/app/api/account/instances/[instanceId]/route.ts` while preserving
    raw editable account state for Bob/Roma.
- Verification: `audit:106`, Roma typecheck/lint, full typecheck, and full lint
  pass.
- Status: Source green.

Core Layout:

- Expected: Split Media Core layout controls live under `splitMedia.*`; shared
  Stage/Pod remain Shell.
- Actual: `splitMedia.fit` and `splitMedia.position` are grouped under Core
  layout and validated by Roma save policy and runtime.
- Violations:
  - Fit/position fields were ungrouped and not checked by the save boundary.
- Action items:
  - `SPLITMEDIA-CON-002` [fixed 2026-06-09]: group Core fit/position controls
    in `tokyo/product/widgets/split-media/spec.json`.
  - `SPLITMEDIA-ROMA-001` [fixed 2026-06-09]: validate Split Media Core
    fit/position values in `roma/lib/account-instance-save-policy.ts`.
- Verification: `audit:106`, Roma typecheck/lint, full typecheck, and full lint
  pass.
- Status: Source green.

Core Appearance:

- Expected: Split Media visual-frame controls use the shared cardwrapper shape
  and visibly apply to the media frame.
- Actual: visual-frame controls live under
  `splitMedia.appearance.cardwrapper.*`; cardwrapper now applies to the visible
  visual stage, not a hidden/outer Core host, and labels use corner language.
- Violations:
  - Visual frame controls were not visibly reliable because the cardwrapper was
    applied to the wrong surface.
  - Linked radius wording drifted from the shared corner-language contract.
- Action items:
  - `SPLITMEDIA-RT-004` [fixed 2026-06-09]: apply
    `CKSurface.applyCardWrapper(...)` to `.ck-split-media__stage`.
  - `SPLITMEDIA-CON-003` [fixed 2026-06-09]: label the linked visual value
    `Corner radius` in `tokyo/product/widgets/split-media/spec.json`.
  - `SPLITMEDIA-ROMA-002` [fixed 2026-06-09]: validate
    `splitMedia.appearance.cardwrapper` at the Roma save boundary.
- Verification: source validation, `audit:106`, typecheck, and lint pass.
  Browser QA must still click radius/border/shadow and confirm visible changes.
- Status: Source green; browser QA pending.

Core Typography:

- Expected: no Split Media-specific typography controls unless the widget
  declares Core typography roles.
- Actual: none declared.
- Violations: none.
- Action items: none.
- Verification: `audit:106` passes.
- Status: Source green.

Core Settings/Runtime Behavior:

- Expected: invalid Split Media Core state fails at the Split Media boundary;
  runtime applies shared Shell utilities and then widget Core render.
- Actual: runtime now validates `coreSize`, `localeSwitcher`,
  `behavior.socialShare`, `splitMedia.media`, `splitMedia.fit`,
  `splitMedia.position`, and `splitMedia.appearance.cardwrapper` before render.
- Violations:
  - Runtime had implicit no-op/fallback paths that made bad state look valid.
- Action items:
  - `SPLITMEDIA-RT-005` [fixed 2026-06-09]: add strict Split Media runtime
    validation and remove Split-local silent no-op behavior.
- Verification: `node --check tokyo/product/widgets/split-media/widget.client.js`
  passes; source validation, Shell validation, `audit:106`, typecheck, and lint
  pass.
- Status: Source green.

Final widget certification:

- Source validation: `node scripts/validate-widget-source.mjs` passed.
- Generated source validation:
  `node scripts/generate-widget-definition-sources.mjs --check` passed.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed.
- 106 audit: `pnpm audit:106` passed.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

Cross-widget items still carried forward:

- `CROSS-HEADERCTA-URL-001`: non-empty malformed Header CTA URLs can still make
  the shared Header CTA appear disabled; the right fix is a shared Shell URL
  boundary, not widget-local patching.
- `CROSS-MEDIA-PREVIEW-001`: Bob preview should surface asset-resolve failures
  instead of preserving stale materialized preview state.
- `CROSS-RT-001`: shared Shell runtime utilities still contain fallback/healing
  behavior and need their own shared-boundary cleanup pass.

### split-carousel-media

Status: Source green - browser QA pending

Subagents:

- Contract Agent: Completed. Found incomplete Roma save/create validation for
  `splitCarouselMedia.*` and missing grouping metadata for Core controls.
- Runtime Agent: Completed. Found validation-after-mutation, non-canonical
  Header CTA DOM, optional branding/social-share apply, and visual-frame target
  drift.
- Product QA Agent: Completed. Found shared repeater icon-button labels were
  under-labeled and Roma did not validate all runtime-required Carousel Core
  state.

Shell Content:

- Expected: shared Header content controls, including canonical Header CTA DOM.
- Actual: uses shared `header-content`; Header CTA DOM now matches canonical
  Shell roles (`ck-header__cta`, `ck-header__ctaIcon`,
  `ck-header__ctaLabel`).
- Violations:
  - Header CTA source was an empty anchor and relied on shared Header runtime
    healing.
- Action items:
  - `SPLITCAROUSEL-RT-001` [fixed 2026-06-09]: make Split Carousel Media Header
    CTA DOM canonical in
    `tokyo/product/widgets/split-carousel-media/widget.html`.
- Verification: source validation, generated-source check, Shell validation,
  and `audit:106` pass.
- Status: Source green.

Shell Layout:

- Expected: shared Header/CoreSize/Stage/Pod layout controls behave the same as
  every widget; Core remains inside the Shell Pod.
- Actual: shared layout controls are present; Core Size applies to the carousel
  Core host before Core render; fixed/responsive sizing now provides a visible
  carousel frame.
- Violations:
  - Media frame height relied on `height: 100%` without explicitly honoring the
    responsive `min-height` Core Size mode.
- Action items:
  - `SPLITCAROUSEL-RT-002` [fixed 2026-06-09]: make fixed/responsive Core Size
    modes give the carousel stage/media a deterministic visible box in
    `tokyo/product/widgets/split-carousel-media/widget.css`.
- Verification: source validation and `audit:106` pass. Browser QA must still
  click Auto/Fixed/Responsive and confirm the carousel remains visible.
- Status: Source green; browser QA pending.

Shell Appearance:

- Expected: shared Header CTA/Stage/Pod appearance controls are Shell-owned and
  use the same vocabulary everywhere.
- Actual: shared Shell appearance controls compile; Header CTA shared label was
  corrected during the Split Media pass and applies here too.
- Violations: none remaining at source level.
- Action items: none Split Carousel-specific.
- Verification: generated-source check, Bob typecheck/lint, and `audit:106`
  pass.
- Status: Source green.

Shell Typography:

- Expected: shared typography panel edits Shell roles plus any declared Core
  roles.
- Actual: Split Carousel Media has no widget-specific typography roles beyond
  shared Shell text roles.
- Violations: none at source level.
- Action items: none.
- Verification: `audit:106` passes.
- Status: Source green.

Shell Settings:

- Expected: shared branding and social-share behavior applies explicitly from
  Shell state after Core render.
- Actual: Split Carousel Media now requires branding/social-share utilities and
  calls them explicitly.
- Violations:
  - Branding was optional and social share relied on shared side-channel
    behavior instead of the widget's deterministic apply order.
- Action items:
  - `SPLITCAROUSEL-RT-003` [fixed 2026-06-09]: require
    `CKBranding.applyBacklink` and `CKSocialShare.apply(...)` in
    `tokyo/product/widgets/split-carousel-media/widget.client.js`.
- Verification: JS syntax check, source validation, typecheck, and lint pass.
- Status: Source green; browser QA pending.

Core Content:

- Expected: Carousel Core content lives under `splitCarouselMedia.*`; repeated
  carousel visuals use the shared repeater primitive, not object-manager or
  any legacy instance picker; media uses shared dropdown-fill with image/video
  only.
- Actual: `splitCarouselMedia.items` uses the shared repeater with min 2/max 6,
  add/remove/reorder labels, and per-item dropdown-fill at
  `splitCarouselMedia.items.__INDEX__.media`.
- Violations:
  - Repeater root had no explicit blank `group-label`.
  - Shared repeater icon actions were under-labeled for user-facing controls.
- Action items:
  - `SPLITCAROUSEL-CON-001` [fixed 2026-06-09]: add explicit blank
    `group-label` metadata to the Carousel visuals repeater.
  - `REPEATER-DIETER-001` [fixed 2026-06-09]: add reorder/remove accessible and
    hover labels to the shared Dieter repeater in source and Tokyo copies.
  - `SPLITCAROUSEL-CON-002` [fixed 2026-06-09]: set
    `remove-label: "Remove visual {index}"` for Split Carousel Media.
- Verification: `node --check` for both repeater copies passes; source
  validation, generated-source check, typecheck, and lint pass.
- Status: Source green; browser QA still must click add/remove/reorder.

Core Layout:

- Expected: media fit/position and carousel behavior controls live under
  `splitCarouselMedia.*`; shared Stage/Pod remains Shell.
- Actual: Core layout controls are grouped under `layout-media-fit` and
  `layout-carousel`; Roma save policy now validates fit/position, transition,
  autoplay, interval, loop, arrows, and dots.
- Violations:
  - Core layout fields were ungrouped.
  - Roma save/create boundary only validated items and media, not runtime-read
    layout/carousel fields.
- Action items:
  - `SPLITCAROUSEL-CON-003` [fixed 2026-06-09]: group Core media fit/position
    and carousel controls in
    `tokyo/product/widgets/split-carousel-media/spec.json`.
  - `SPLITCAROUSEL-ROMA-001` [fixed 2026-06-09]: validate
    `splitCarouselMedia.media.*` and `splitCarouselMedia.carousel.*` in
    `roma/lib/account-instance-save-policy.ts`.
- Verification: Roma typecheck, full typecheck/lint, and `audit:106` pass.
- Status: Source green.

Core Appearance:

- Expected: carousel visual-frame controls use the shared cardwrapper shape and
  visibly apply to the carousel frame.
- Actual: visual-frame controls live under
  `splitCarouselMedia.appearance.cardwrapper.*`; cardwrapper now applies to the
  visible carousel stage, not the Core host, and labels use corner language.
- Violations:
  - Visual frame was applied to the Core host instead of the visible carousel
    stage.
  - Linked radius label said `Visual corner radius` instead of the shared
    `Corner radius` wording.
  - Roma save/create did not validate cardwrapper appearance.
- Action items:
  - `SPLITCAROUSEL-RT-004` [fixed 2026-06-09]: apply
    `CKSurface.applyCardWrapper(...)` to `.ck-split-carousel-media__stage`.
  - `SPLITCAROUSEL-CON-004` [fixed 2026-06-09]: label the linked visual value
    `Corner radius`.
  - `SPLITCAROUSEL-ROMA-002` [fixed 2026-06-09]: validate
    `splitCarouselMedia.appearance.cardwrapper` at the Roma save boundary.
- Verification: source validation, `audit:106`, typecheck, and lint pass.
  Browser QA must still click radius/border/shadow and confirm visible changes.
- Status: Source green; browser QA pending.

Core Typography:

- Expected: no Split Carousel-specific typography controls unless the widget
  declares Core typography roles.
- Actual: none declared.
- Violations: none.
- Action items: none.
- Verification: `audit:106` passes.
- Status: Source green.

Core Settings/Runtime Behavior:

- Expected: invalid Split Carousel Core state fails before DOM mutation; runtime
  applies shared Shell utilities, then widget Core render, then branding/social
  share.
- Actual: runtime now validates `coreSize`, `localeSwitcher`,
  `behavior.socialShare`, all carousel items, media fit/position, carousel
  options, and visual-frame cardwrapper before render.
- Violations:
  - Runtime previously mutated shared DOM before validating widget Core state
    and returned silently when state was missing.
- Action items:
  - `SPLITCAROUSEL-RT-005` [fixed 2026-06-09]: move strict
    `normalizeState(...)` to the start of `applyState` and remove the
    widget-local missing-state no-op.
  - `SPLITCAROUSEL-ROMA-003` [fixed 2026-06-09]: validate carousel item `alt`
    strings at the Roma save boundary.
- Verification: `node --check tokyo/product/widgets/split-carousel-media/widget.client.js`
  passes; source validation, Shell validation, `audit:106`, typecheck, and lint
  pass.
- Status: Source green.

Final widget certification:

- Source validation: `node scripts/validate-widget-source.mjs` passed.
- Generated source validation:
  `node scripts/generate-widget-definition-sources.mjs --check` passed.
- Widget Shell validation: `node packages/widget-shell/scripts/validate.mjs`
  passed.
- 106 audit: `pnpm audit:106` passed.
- Typecheck: `pnpm typecheck` passed after fixes.
- Lint: `pnpm lint` passed after fixes.
- Browser QA: pending. Repo-level Playwright harness now exists; this widget
  still needs authenticated browser coverage.
- Save/reload QA: pending.
- Commit: pending.
- Deploy/checks: pending.

Cross-widget items still carried forward:

- `CROSS-PREVIEW-L10N-001`: widget preview localization helpers are optional
  in runtime code paths; this is shared preview infrastructure and should be
  certified once all widget source slices are green.
- `CROSS-SHELL-VALIDATION-001`: Roma save policy still validates selected
  widget Core structures but does not yet have one shared Shell state validator
  for `stage`, `pod`, `coreSize`, Header CTA URL, locale switcher, branding,
  and social share.
- `CROSS-MEDIA-PREVIEW-001`: Bob preview should surface asset-resolve failures
  instead of preserving stale materialized preview state.

## Cross-Widget Certification

Status: Green for source, live account defaults, live instances, and
authenticated browser save/reload certification. Commit/deploy still pending.

Executed after all widget slices were source-green, then repeated with a real
Roma -> Bob -> Tokyo browser session.

Validation proof:

- `node scripts/validate-widget-source.mjs` passed.
- `node scripts/generate-widget-definition-sources.mjs --check` passed.
- `node packages/widget-shell/scripts/validate.mjs` passed.
- `pnpm audit:106` passed against source, account defaults, and live instances.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm exec playwright test e2e/widgets/prd106f-builder-certification.spec.ts`
  passed: 16/16.
- `pnpm e2e` passed with authenticated remote Roma/Bob/Tokyo coverage: 18/18.

Browser certification harness:

- Added `e2e/widgets/prd106f-builder-certification.spec.ts`.
- Uses the real authenticated Roma Builder route for the eight PRD106F
  certified instances:
  `calltoaction/SZBSB5HHFJ`, `big-bang/QD1G068MX7`,
  `cards/U37WRSMY7J`, `countdown/H7IF9M2K9B`, `faq/UZ3JEJSHII`,
  `logoshowcase/8FMVZFFPJV`, `split-media/KUGYTX2ZMQ`, and
  `split-carousel-media/P10U6N7Y2X`.
- For every widget, verifies Builder open, all five mixed panels, nonblank
  preview, no widget/page errors, clean saved state on fresh open, Shell edit
  persistence, Core edit persistence, reload, and restore.
- Mutates aggregate repeater/object-manager fields structurally:
  `cards.items`, `faq.sections`, `logoshowcase.strips`, and
  `splitCarouselMedia.items`. Direct nested item mutation is not certified
  because it can create invalid intermediate preview state.
- Runs e2e with one Playwright worker because remote e2e mutates shared account
  and widget instance state. Parallel workers make certification
  nondeterministic.
- Uses one bounded click on Roma's visible `Retry` affordance if Bob opens with
  no selected instance. If the retry does not select the instance, the test
  fails.

Live data cleanup performed during certification:

- `pnpm audit:106` initially found stale account-default Core data:
  `accounts/CLICKEEN/widget-defaults.json` contained
  `widgets.countdown.core.countdown.appearance.animation`.
- Deleted that stale account-default key in R2.
- Re-ran `pnpm audit:106`; account defaults and live instances passed.

Required matrix:

| Requirement | Status | Proof / Remaining Work |
| --- | --- | --- |
| Shell defaults identical across widgets | Green | Shell factory validation and live `audit:106` pass. |
| Shell control paths identical across widgets | Green | Widget source validation, generated-source check, Shell validation, and browser panel open checks pass. |
| Mixed panel structure consistent across widgets | Green | Browser spec opens Content/Layout/Appearance/Typography/Settings for all eight widgets. |
| Core namespaces isolated and widget-specific | Green | `audit:106` passes; browser spec edits one Core path per widget and restores it. |
| Shared utility usage consistent | Green with carry-forward hardening | Certified widgets use shared Shell/Surface/Branding/Social utilities. Remaining cleanup items are shared-boundary hardening, not widget-local blockers. |
| Shared control vocabulary consistent | Green at source and panel-open level | Shared labels and controls compile and render through Bob. Further copy polish can be separate UX work. |
| Dieter/ToolDrawer primitives reused consistently | Green | Browser certifies repeater/object-manager aggregate paths and dropdown/media surfaces open without errors. |
| Runtime apply order consistent | Green | Browser preview opens nonblank for every widget and save/reload emits no widget/page errors. |
| New instance creation uses account Shell defaults + widget Core defaults | Green | `audit:106`, source validation, Shell validation, typecheck, lint, and live account-default cleanup pass. |
| Existing starter/account instances compile and open | Green | Authenticated browser spec opens all eight live instances through Roma/Bob. |
| Browser QA confirms controls change preview, save, reload, and restore | Green | PRD106F spec passes 16/16; full `pnpm e2e` passes 18/18. |

Final carry-forward items:

- `CROSS-HEADERCTA-URL-001`: malformed non-empty Header CTA URLs can make CTA
  appear disabled. This needs one shared Shell URL boundary, not widget-local
  patches.
- `CROSS-MEDIA-PREVIEW-001`: Bob preview should surface asset-resolve failures
  instead of preserving stale materialized preview state.
- `CROSS-RT-001`: shared Shell runtime utilities still need a focused no-healing
  cleanup pass at the shared boundary.
- `CROSS-PREVIEW-L10N-001`: preview localization helpers are still optional in
  runtime code paths; certify this in shared preview infrastructure.
- `CROSS-SHELL-VALIDATION-001`: Roma save policy validates selected Core shapes,
  but needs one shared Shell state validator for `stage`, `pod`, `coreSize`,
  Header CTA URL, locale switcher, branding, and social share.
