# Dieter Single‑Contract Simplification — Execution Playbook

This playbook defines a precise, repeatable procedure to converge every Dieter component to a single, unambiguous contract. It is engineered for hands‑off execution by AIs and humans.

No runtime is introduced. No new packages. Only CSS contract tightening, canonical HTML co‑located with CSS, Admin showcase alignment, and lightweight guardrails.

## 0) Scope, Constraints, Outcomes

- Components in scope: Button, Segmented, Textfield
- Surfaces touched: `dieter/components/**` and `dieter/dieteradmin/src/html/dieter-showcase/**`
- Constraints
  - No behavioral changes; visual contract only
  - Do not rename or remove tokens
  - Preserve ARIA/semantics (e.g., Segmented = radiogroup + radios; Textfield = label + input)
  - No local backups or legacy placeholders will be kept; push current main to remote before starting and rely on git revert if needed
  - Preserve existing design scales and global typography exactly as they are (no new styles):
    - Control/icon size ladders remain (16/20/24/28/32 and icon previews 16–40)
    - `--hspace-*` used only for vertical intra‑component spacing; `--space-*` for horizontal/outer paddings/margins
    - Global text styles remain unchanged: `.heading-1…6`, `.body`, `.body-small`, `.body-large`, `.label`, `.label-small`, `.caption`, `.caption-small`, `.overline`, `.overline-small`
- Do‑Not‑Touch (explicit)
  - Dieter Admin scaffolding/layout/router/navigation (no edits to shell or nav wiring)
  - Typography, colors, icons tokens and their Dieter Admin showcase pages (no edits)
  - Icons build/processing scripts and `dieter/icons/icons.json` manifest (no edits)
  - Admin navigation structure/data (e.g., `dieter/dieteradmin/src/data/routes.ts`) (no edits)
- Outcomes
  - Attributes‑only usage for modifiers (data‑size, data‑type, data‑variant)
  - Canonical HTML snippets live next to CSS with the same name
  - Admin showcases mirror the same attributes and curated icons
  - Guardrails prevent re‑introduction of aliases and non‑curated SVGs

## 1) Canonical Contract (Global)

- Modifiers (the only allowed)
  - `data-size`: `xs|sm|md|lg|xl` (per component subset)
  - `data-type`: `icon-only|icon-text|text-only` (if applicable)
  - `data-variant`: per component (see below)
- Semantic state
  - Pressed/toggle: `[aria-pressed="true"]`
  - Loading: `[data-state="loading"]`
  - Disabled: `:disabled` or `[aria-disabled="true"]`
  - Focus: `:focus-visible`
  - Transient press: `:active`
- Icons: Inline curated SVG only, normalized to `fill="currentColor"`. HTML provides `viewBox`; CSS sizes icon box + glyph via tokens.
- Forbidden (to be purged)
  - Class modifiers: `.diet-.*--` (sizes/types/variants)
  - Tone aliases: `data-tone="ghost|control"`
  - Extras: `data-footprint`
  - State aliases: `data-state="active|selected"`, `data-pressed`

## 1.1) Token Invariants (MUST Remain Unchanged)

- Control size ladder (rails)
  - `--control-size-xs = 16px`, `--control-size-sm = 20px`, `--control-size-md = 24px`, `--control-size-lg = 28px`, `--control-size-xl = 32px`
  - Components may not introduce new control sizes in Phase‑1.
- Icon preview/box scale
  - Icon size demonstrations use `16, 20, 24, 28, 32, 36, 40px` boxes; glyphs scale via `--control-icon-*` and `--control-icon-glyph-ratio-*`.
  - Do not hardcode icon glyph sizes; compute from tokens.
- Spacing semantics
  - Horizontal/outer padding/margins/gutters use `--space-*` (4px grid).
  - Vertical intra‑component stack spacing uses `--hspace-*` tokens only.
  - Do not repurpose `--hspace-*` for horizontal paddings.
- Global text styles (no additions)
  - Keep existing styles exactly as‑is: `.heading-1…6`, `.body`, `.body-small`, `.body-large`, `.label`, `.label-small`, `.caption`, `.caption-small`, `.overline`, `.overline-small`.
  - Components must not add or modify global typography utility classes.

## 2) Component Size & Variant Matrix (Authoritative)

- Button
  - sizes: `xs | sm | md | lg | xl` (default: `md`)
  - types: `icon-only | icon-text | text-only`
  - variants: `primary | secondary | neutral | line1 | line2`
- Segmented
  - sizes: `sm | md | lg` (default: `md`)
  - types: `icon-only | text-only` (omit `data-type` for icon+text)
  - variants: none
- Textfield
  - sizes: `md | lg | xl` (default: `lg`)
  - types: n/a (optional composed wrapper: `.diet-input__control`)

## 3) File Co‑Location (Canonical Artifacts)

For each component, there MUST be exactly two canonical artifacts, side by side:

- CSS: `dieter/components/<name>.css`
- HTML: `dieter/components/<name>.html` (3–5 canonical, copy‑pasteable snippets only)

The Admin showcases MUST reflect the same HTML (components only):
- `dieter/dieteradmin/src/html/dieter-showcase/button.html`
- `dieter/dieteradmin/src/html/dieter-showcase/segmented.html`
- `dieter/dieteradmin/src/html/dieter-showcase/textfield.html`

Do not modify Dieter Admin navigation, scaffolding, or the typography/colors/icons showcase pages.

## 4) Pre‑Migration Audit (Mandatory)

Run a repository‑wide audit BEFORE deleting aliases. Produce an inventory.

```bash
# Class modifiers
rg -n "\.diet-.*--" bob/ venice/ dieter/dieteradmin/

# Tone & extras
rg -n "data-tone=" bob/ venice/ dieter/dieteradmin/
rg -n "data-footprint=" bob/ venice/ dieter/dieteradmin/

# State aliases
rg -n "data-(state|pressed)=\"(active|selected|true)\"" bob/ venice/ dieter/dieteradmin/
```

Decision:
- If zero usage outside Admin → Option A (Hard Cut) is safe.
- If usage exists in app/runtime → Option B (Soft Landing) for one sprint.

## 5) CSS Simplification (Per Component)

Edit `dieter/components/<name>.css` as follows:

- Keep a single root class: `.diet-btn`, `.diet-segmented`, `.diet-input`
- Use combined attribute selectors for clarity/specificity:
  - `.diet-btn[data-size="md"]`, `.diet-segmented[data-size="sm"]`, `.diet-input[data-size="lg"]`
- Map attributes to tokens (no raw px):
  - rail height: `--control-size-*`
  - radii: `--control-radius-*`
  - paddings/gaps: `--space-*`, `--control-inline-gap-*`
  - variants: role/system tokens + `color-mix`
- States (visuals only):
  - `:active`, `:focus-visible`, `[aria-pressed="true"]`, `[data-state="loading"]::after`, `:disabled`/`[aria-disabled]`
- Icon sizing:
  - box: `--control-icon-*`
  - glyph: `calc(var(--control-icon-*) * var(--control-icon-glyph-ratio-*))`
- Purge forbidden selectors (hard cut, no quarantines):
  - class modifiers, tone aliases, extras, state aliases — delete completely

Acceptance (per component):
- Zero alias selectors active; only canonical selectors remain
- Visual parity confirmed in Admin (light/dark) at all supported sizes

## 6) Canonical HTML Snippets (Per Component)

Create `dieter/components/<name>.html` with 3–5 minimal examples. Use attributes‑only + curated icons. Examples should include a representative size/type/variant matrix.

- Button — examples to include:
  - text‑only `md` `primary`
  - icon+text `lg` `secondary` (icon slot uses curated sun SVG)
  - icon‑only `xs` `neutral` (with `aria-label`)
- Segmented — examples to include:
  - icon‑only `sm` (two items)
  - icon+text `md` (sun/moon curated icons)
  - text‑only `lg`
- Textfield — examples to include:
  - `md` plain
  - `lg` with helper
  - `xl` with composed `.diet-input__control`

Acceptance:
- Snippets are attributes‑only; no class modifiers/aliases
- Inline curated SVGs use `fill="currentColor"` and a `viewBox`
- A11y basics: Segmented role + radios; Textfield label + input association; icon‑only buttons include `aria-label`

## 7) Admin Showcase Alignment (Components Only)

Update only the component showcase pages listed above to match the canonical snippets:
- Attributes‑only for size/type/variant
- Curated icons only; no stroke‑only or hardcoded color SVGs

Acceptance:
- Visual parity preserved across light/dark and supported sizes
- Grep checks (below) pass with zero violations

Safety boundaries:
- Do not modify Dieter Admin scaffolding, layout, router, or navigation.
- Do not modify typography/colors/icons showcase pages.

## 8) Guardrails (Lightweight Checks)

Add a simple script (CI or pre‑merge) that fails on forbidden patterns and invalid SVGs.

Forbidden patterns:
```bash
# Class modifiers
rg -n "\.diet-.*--" dieter/components/ dieter/dieteradmin/src/html/dieter-showcase/

# Tone & extras
rg -n "data-tone=" dieter/components/ dieter/dieteradmin/src/html/dieter-showcase/
rg -n "data-footprint=" dieter/components/ dieter/dieteradmin/src/html/dieter-showcase/

# State aliases
rg -n "data-(state|pressed)=\"(active|selected|true)\"" dieter/components/ dieter/dieteradmin/src/html/dieter-showcase/
```

Icon normalization:
```bash
# Fail if an SVG lacks fill="currentColor" in canonical/component HTML or showcases
rg -n "<svg[^\n]*>" dieter/components/*.html dieter/dieteradmin/src/html/dieter-showcase/*.html | \
  rg -v "fill=\"currentColor\"" && exit 1 || true
```

A11y invariants (pseudo‑checks; implement small Node/DOM parser if needed):
- Segmented: file must contain `role="radiogroup"` and `type="radio"` descendants
- Textfield: file must contain a `.diet-input__label` and `.diet-input__field`

Typography protection (no new global text utilities):
```bash
# Fail if components or showcases add new global text utility classes
rg -n "\.(heading-[1-6]|body(-small|-large)?|label(-small)?|caption(-small)?|overline(-small)?)\s*\{" dieter/components/ dieter/dieteradmin/src/html/dieter-showcase/ && exit 1 || true
```

## 9) Execution Mode — Hard Cut Only

- Preconditions: Ensure latest changes are pushed to remote (git push). Run the pre‑migration audit.
- Action: Remove all aliases now; update Admin component showcases in the same PR; enable guardrails.
- Rollback strategy relies solely on git revert (no deprecated code blocks retained).

## 10) Acceptance Checklist (All Must Pass)

- [ ] Only attributes‑based selectors in component CSS (no active alias selectors)
- [ ] Only attributes (data‑size, data‑type, data‑variant) used in canonical HTML + showcases
- [ ] Only curated SVGs (fill="currentColor"); no stroke‑only or hardcoded color SVGs
- [ ] A11y basics present (radiogroup+radios; label+input)
- [ ] Visual parity verified in Admin across themes/sizes
- [ ] Guardrail grep checks return zero forbidden hits
- [ ] Exactly one HTML file exists next to each CSS file (same name)

## 11) Rollback Plan

If regressions are observed after merge:
- Use git revert to restore the prior remote state (a full push occurred before execution).
- Revert the CSS and component showcase HTML in one scoped commit if needed.
- Open a migration issue with audit file list and schedule remediation.

## 12) FAQ (Operational)

- Q: Why combined selectors like `.diet-btn[data-size="md"]`?
  - A: Clearer specificity and grouping; keeps attribute logic scoped to the component root.
- Q: Do we ever use class modifiers again?
  - A: No. They are deleted and guarded against re‑introduction.
- Q: Where do developers find canonical examples?
  - A: Next to the CSS. `dieter/components/<name>.html` is the only source of snippets; Admin showcases mirror those.
- Q: What about performance of attribute selectors?
  - A: Scale is small; combined selectors keep specificity clear. Monitor with DevTools if concerns arise at larger scale.

---

This playbook is the authoritative execution guide for Dieter’s single‑contract simplification. Follow steps 4→10 in order; use Option A unless the audit shows runtime alias usage.
