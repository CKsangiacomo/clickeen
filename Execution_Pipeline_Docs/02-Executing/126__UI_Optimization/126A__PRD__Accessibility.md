# 126A - PRD: Accessibility

Status: DIRECTIONAL - Phase 1 Step 2 Codex baseline.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126A of 126A-126M.
KB doc: `documentation/engineering/UI/accessibility.md`.

This PRD is a baseline/directional artifact only. It is filled from Codex Step 1
as-built evidence and Step 3 official-source research. It does not converge
Codex/GLM, does not select fixes, does not write doctrine, and does not
authorize runtime implementation.

## Step Inputs

- Step 1 Codex as-built: `audits/126A__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126A__AsBuilt_GLM.md` when human compares.
- Step 3 Codex research: `research/126A_Research_Codex.md`.
- Step 3 GLM research: external GLM artifact when available.
- Current living doc: `documentation/engineering/UI/accessibility.md`.
- Related living doc: `documentation/engineering/UI/dialogs-and-modals.md`.

## Role

126A owns the cross-cutting accessibility baseline for the UI system: focus,
keyboard operability, touch targets, ARIA/semantics, contrast, text resizing,
status/error announcement, reduced motion, and dialog accessibility.

Accessibility is not a visual polish layer. In Clickeen it is part of the
agent-operable substrate. If controls, dialogs, generated content, and status
surfaces are not structured and perceivable, agents and humans both lose the
same product truth. The baseline therefore has to be concrete and file-grounded,
not a claim that "accessibility exists."

## Current Reality Summary

Clickeen has real accessibility foundations but not a complete accessibility
contract.

The strongest substrate is in Dieter:

- Focus and touch target tokens exist in
  `dieter/tokens/dieter-foundation-tokens.css:74-77`.
- `.sr-only` exists in `dieter/tokens/dieter-foundation-tokens.css:91-96`.
- A global reduced-motion guard exists in
  `dieter/tokens/dieter-foundation-tokens.css:98-105`.
- Focus color is tokenized in `dieter/tokens/dieter-color-tokens.css:18`.
- Semantic color and contrast-variant tokens exist in
  `dieter/tokens/dieter-color-tokens.css`.

The strongest component evidence:

- Tabs expose `role="tablist"` in `dieter/components/tabs/tabs.html:1`.
- Tabs hydrate tab roles, `aria-selected`, and roving `tabindex` in
  `dieter/components/tabs/tabs.ts:1-14`.
- Tabs handle arrow navigation in `dieter/components/tabs/tabs.ts:29-54`.
- Choice tiles expose radiogroup/radio semantics and sync `aria-checked` in
  `dieter/components/choice-tiles/choice-tiles.html:10-18` and
  `dieter/components/choice-tiles/choice-tiles.ts:85-91`.
- Bulk edit has `role="dialog"` and `aria-modal="true"` in
  `dieter/components/bulk-edit/bulk-edit.html:17-18`, focuses the first input
  on open in `dieter/components/bulk-edit/bulk-edit.ts:329-335`, and closes on
  Escape in `dieter/components/bulk-edit/bulk-edit.ts:342-346`.
- Bob Workspace uses live/status/error semantics in
  `bob/components/Workspace.tsx:396-407`.
- Bob TranslationsPanel uses agent activity status/live semantics in
  `bob/components/TranslationsPanel.tsx:94-105`.
- Roma uses active nav/current page semantics in
  `roma/components/roma-nav.tsx:20-23` and nav labeling in
  `roma/components/roma-nav.tsx:45`.
- DevStudio token editor diff uses `aria-live` in `admin/src/main.ts:340-365`.

The weakest evidence:

- Focus visibility is inconsistent. Tabs, buttons, segmented controls,
  dropdown headers, and DevStudio nav include focus-visual removal or
  unreachable focus states.
- Touch target compliance is not proven. The 44px token exists, but the control
  ladder is 16-32px in `dieter/tokens/dieter-foundation-tokens.css:27-32`.
- Dropdown triggers are often `div role="button"` without `tabindex`, such as
  `dieter/components/dropdown-actions/dropdown-actions.html:11-17`.
- Shared dropdown behavior toggles on click and closes on Escape, but does not
  prove Enter/Space open, arrow navigation, focus trap, or return focus in
  `dieter/components/shared/dropdownToggle.ts:59-95`.
- `object-manager` modal markup lacks `role="dialog"` and `aria-modal` in
  `dieter/components/object-manager/object-manager.html:38-40`.
- Modal behavior is not shared. Bulk edit and Bob upsell each do part of the
  job, but focus trap, return focus, scroll lock, and inert outside content are
  not a system primitive.
- Contrast is tokenized but not formally audited across actual
  foreground/background pairings.
- Reduced-motion foundation exists, but component-by-component coverage is not
  proven.

## Directional Product Reading

The baseline product problem is not that Clickeen lacks accessibility work. The
problem is that accessibility is currently a set of partial local wins rather
than a single UI-system contract.

That matters for Clickeen specifically because Clickeen is agent-operated:

- Agents need structured controls and states to inspect and operate surfaces.
- Humans need the same structure to work through keyboard, screen readers,
  resizing, reduced motion, and low-vision settings.
- Generated and translated content can expand, change language, and alter
  layout pressure, so accessibility cannot be validated only against the English
  happy path.
- Builder/Roma/DevStudio screens are operational tools, not marketing pages;
  dense UI is acceptable only if the interaction targets and semantics remain
  usable.

## Scope For Later Human Convergence

This PRD scopes the accessibility decision surface. It does not decide final
law.

### Focus

Current baseline:

- Tokens exist.
- Some components have visible focus.
- Several components remove focus visuals or use non-focusable pseudo-buttons.

Later convergence must decide:

- Whether visible focus is mandatory for every keyboard-reachable control.
- Whether `div role="button"` is allowed at all.
- Whether any component may remove focus visuals without replacing them with a
  visible equivalent.

### Keyboard

Current baseline:

- Tabs are strong.
- Choice tiles move focus by arrow keys.
- Shared dropdowns handle click and Escape, not full keyboard operation.
- Dialog/modal keyboard behavior is inconsistent.

Later convergence must decide:

- Required keyboard matrix for tabs, segmented controls, dropdowns, listboxes,
  dialogs, swatches, sliders, carousel controls, and destructive actions.
- Whether keyboard behavior belongs in shared Dieter primitives rather than
  one-off component code.

### Touch Targets

Current baseline:

- `--min-touch-target` is 44px.
- `--control-size-xs` through `--control-size-xl` are 16-32px.
- Several public widget controls are below 44px.

Later convergence must decide:

- Clickeen's target-size law: 44px, 48px, or surface-specific.
- Whether dense visual controls need larger invisible hit areas.
- How to validate touch targets in Builder, Roma, DevStudio, and public widgets.

### ARIA And Semantics

Current baseline:

- Tabs, choice tiles, some dropdowns, Bob status, and some dialogs have useful
  semantics.
- Some components mix semantics, such as segmented radio plus nested button
  plus `aria-pressed`.
- Some modal-like surfaces lack dialog semantics.

Later convergence must decide:

- Acceptable semantic patterns by component.
- Whether native controls are required where practical.
- Naming requirements for icon-only buttons, swatches, media previews, and
  agent-operation controls.

### Dialogs And Modality

Current baseline:

- Bulk edit and Bob upsell have dialog ARIA and initial focus behavior.
- Object manager does not.
- Textedit/dropdown edit use dialog popovers.
- Focus trap, return focus, scroll lock, and inert outside content are not
  proven shared behavior.

Later convergence must decide:

- Shared dialog contract.
- Distinction between modal dialogs, popovers, sheets, banners, and status
  messages.
- Where accessibility ownership splits between 126A and 126K.

### Contrast

Current baseline:

- Dieter color tokens include semantic and contrast variants.
- No formal WCAG audit exists.
- Token names are not proof that every actual color pairing passes.

Later convergence must decide:

- Contrast measurement method.
- Required states: default, hover, active, selected, focus, disabled, error,
  warning, success, muted, placeholder, overlays, charts/previews.
- Whether contrast validation becomes a docs/build gate or remains a manual
  audit artifact.

### Text Resizing

Current baseline:

- Dense controls and translated strings create known pressure.
- The existing audit did not prove text resizing behavior.

Later convergence must decide:

- Required text growth testing for Builder panels, Roma screens, DevStudio
  editors, generated widgets, translation UI, and agent dialogs.
- Whether truncation is allowed for labels/actions and under what constraints.

### Reduced Motion

Current baseline:

- Global reduced-motion guard exists.
- Some components add local reduced-motion rules.
- Coverage is not proven across every transition and animated state.

Later convergence must decide:

- Whether the global duration clamp is enough.
- Which animations are nonessential.
- Whether carousels, loaders, shimmers, popovers, and layout transitions need
  explicit reduced-motion behavior.

### Status And Error Feedback

Current baseline:

- Bob Workspace and TranslationsPanel have live/status evidence.
- Some upload and Roma error paths are not proven announced.

Later convergence must decide:

- Which operations use status, alert, banner, toast, modal, or inline error.
- Announcement expectations for save, publish, upload, translation generation,
  account operations, and agent activity.

## Official Source Baseline

Step 3 Codex research identifies these non-binding external bars:

- Material 3 treats focus, keyboard navigation, dialogs, target sizing, color
  contrast, text resizing, motion, and component semantics as system concerns.
- Apple HIG treats keyboard-only operation, VoiceOver labeling, target sizing,
  Dynamic Type/text sizing, Reduce Motion, modality, and sheet behavior as
  product-quality requirements.
- OpenAI Apps SDK UI guidance requires accessible hosted UI, WCAG AA
  text/background contrast, alt text for images, and resizing support.

Research does not become Clickeen doctrine until Step 4 human convergence.

## Known Gaps Only

These are baseline gaps, not selected fixes:

1. Focus visibility is not system-wide.
2. Keyboard operation is not system-wide.
3. Touch target adoption is not proven.
4. Dialog/modal accessibility is inconsistent.
5. Dropdown trigger semantics are incomplete where triggers are non-focusable
   pseudo-buttons.
6. Contrast has not been measured across actual UI pairings.
7. Text resizing behavior is not proven.
8. Reduced-motion behavior is foundational but not fully audited.
9. Error/status announcements are uneven.
10. Current docs can overstate isolated working examples as a complete pattern.

## Out Of Scope For This Baseline

- Runtime code changes.
- Product data changes.
- Visual redesign.
- New UI framework.
- Step 4 convergence.
- Step 5 doctrine updates.
- Step 6 gap audit against final doctrine.
- Step 7 executable implementation PRD.
- Step 9 execution.

## Compliance With Clickeen Architecture And Product Law

- Lean and agent-operable: this baseline favors structured UI truth agents can
  inspect instead of adding hidden behavior or invented machinery.
- Source authority separation: code owns current reality, official Google/Apple
  /OpenAI sources own external reference, human owns convergence.
- No reinterpretation: this PRD does not turn accessibility into a redesign or
  implementation pass.
- No masquerade: it distinguishes existing substrate from unproven system
  compliance.
- No silent success: partial component wins are called partial.

## Done For Phase 1 Step 2

126A Step 2 is done when this PRD:

- Points to Step 1 Codex audit in `audits/126A__AsBuilt_Codex.md`.
- Points to Step 3 Codex research in `research/126A_Research_Codex.md`.
- States current reality and known gaps only.
- Avoids Step 4+ convergence or fixes.
- Keeps accessibility scoped to Clickeen's UI-system substrate.

## GLM Addendum — Phase 1 Step 2 (feedback on Codex baseline)

GLM reviewed Codex's baseline against the GLM step-1 as-built (`audits/126A__AsBuilt_GLM.md`) and step-3 research (`research/126A_Research_GLM.md`). Critique only — no merge, no convergence, no fix selection (human, step 4).

### Codex gets right
- The framing — "partial local wins, not a system contract" — is correct and the right product read.
- Token foundations, tabs/choice-tiles strength, bulk-edit as the one correct modal, object-manager inconsistency — all confirmed by GLM as-built.
- The scope-for-convergence structure (focus/keyboard/touch/ARIA/dialog/contrast/resize/motion/status) is the right decision surface.

### Where Codex under-claimed — GLM as-built now VERIFIES these (upgrade "unverified" → "verified failure")
1. **Touch target — Codex: "not proven." GLM: PROVEN DEAD.** `--min-touch-target` (44px) is consumed by ZERO dieter components; the control ladder caps at `--control-size-xl` 32px. Every `diet-*` interactive control (16–32px) fails 44px. Only prague honors it. (as-built Facet 3 §B)
2. **Contrast — Codex: "not formally audited." GLM: MEASURED (WCAG 2.1 luminance).** ≥9 pairs FAIL AA body: text-secondary 4.04:1, caption 2.84:1, overline 4.39:1 (10px), textfield placeholder 2.84:1 / disabled 2.50:1, dropdown-fill/border invalid-orange 1.95:1, prague ck-badge 1.92:1, prague primary-on-pink 3.45:1, admin error-red 3.15:1 / success-green 1.87:1. (as-built Facet 3 §A)
3. **Modal focus-trap/return/scroll-lock — Codex: "not proven shared." GLM: VERIFIED ABSENT.** All 4 roma modals (assets/pages/widgets/account-notice) + admin token-editor overlay: NO Escape, NO trap, NO outside-click, NO focus restoration. Bob UpsellPopup autofocuses but doesn't restore focus. (as-built Facet 1, gaps #2, #5)

### Findings Codex missed entirely
4. **The `-contrast` WCAG ramp is dead.** Defined for every hue, consumed ONLY for gray. The failing pairs (#2) use the base hue the `-contrast` sibling was designed to fix. Root cause of most contrast failures: the accessible variant exists and is ignored — not "unmeasured." (as-built Facet 3 §A.2, defect #4)
5. **Two undefined-token defects (live bugs):** `--color-surface` (`button.css:8,190,321`) and `--hspace-2/3` (tabs, textfield, dropdown-fill/border/shadow) referenced but never defined. (as-built Facet 3 §E)
6. **Roma has ZERO live regions** — no `aria-live`/`role=status`/`role=alert`; loading/error states are static `<section>` text. (Bob has 5; dieter has 1.) (as-built Facet 2)
7. **Icon-only buttons unlabeled:** object-manager (`:61,64,67` up/down/delete), menuactions (no ARIA at all), `button.html:1` conditional `aria-label` (icon-only renders unnamed if unset). (as-built Facet 2)
8. **`bob/TdMenu.tsx:53` — full `role=tablist`/`tab`/`aria-selected` markup but NO arrow-key handler** — a direct regression vs dieter's own `tabs.ts` which implements arrows. (as-built Facet 1, gap #3)
9. **Three parallel "visually-hidden" implementations:** `.sr-only` (dieter), `.visually-hidden` (admin `utilities.css` — admin does NOT consume `.sr-only`), inline `diet-segment__sr` + dropdown-fill alpha-label. (as-built Facet 3 §D)
10. **Focus suppressed with no replacement — exact files:** dropdown-{actions,border,edit,fill,shadow,upload} headers, admin nav (`layout.css:127-128`), bob instance-title (`bob_app.css:121,125-129`), textfield/textrename/textedit/valuefield bare `outline:none`. dropdown-actions & dropdown-edit have NO replacement ring anywhere. (as-built Facet 1, gap #1)

### Where Codex could be sharper
11. **Trigger inconsistency:** not just "`div role=button` without tabindex" — it's inconsistent component-to-component: textedit uses native `<button>`, all other dropdowns + textrename use `<div role=button">`; textrename sets `role=button` with NO `aria-haspopup`/`aria-expanded`. (as-built Facet 2)
12. **Touch-target bar sourced:** GLM research flags the real disagreement — M3 = **48dp**, HIG = **44pt** (default). clickeen's 44 matches HIG, undershoots M3. A step-4 decision; Codex's "44/48/surface-specific" frames it but doesn't source the split. (research §M3, §HIG)

### GLM flag for human
- Codex lists "Text Resizing" as unproven. GLM did NOT measure text-resize behavior this pass (out of as-built scope this round) — neither pass has verified it. Genuine open gap.

— end GLM addendum. Not converged; human reconciles 126A at step 4.
