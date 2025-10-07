# DieterAdmin Component Status

> **STATUS:** DRAFT — proposal in flight. When a component is kept in Dieter, reflect it in `documentation/systems/Dieter.md`. Treat this page as the working backlog, not a normative PRD.

## DIETER COMPONENTS (in `@ck/dieter`)

1. Button ✅
2. Segmented Control ✅
3. Typography Scale ✅
4. Color Tokens ✅

---

## DIETER CANDIDATES (building these is project scope of this task)

### Form Fields
5. Textfield

### Choice Controls
8. Checkbox
9. Radio Group
10. Switch

### Layout & Accents
11. Box
12. Divider
13. Badge

### Feedback
14. Spinner

---

## Global Rules (Apply to ALL Components)

**CSS Token Usage:**
- ❌ No `#` hex colors
- ❌ No raw `px` values (except font-size or inside `calc()`)
- ✅ Spacing: `var(--space-*)`
- ✅ Colors: `var(--color-*)` or `var(--color-system-*)`
- ✅ State blends: reuse Button/Segmented `color-mix` percentages for hover/active layers before inventing new ratios.
- ✅ Borders: `var(--color-border)`
- ✅ Radii: `var(--radius-*)`
- ✅ Fonts: `var(--font-ui)`
- ✅ Font sizes: `var(--fs-*)`
- ✅ Line heights: `var(--lh-tight|normal|loose)`
- ✅ Motion: `var(--duration-snap)`, `var(--duration-base)`, `var(--duration-spin)` for transitions/animations (no raw ms values).
- ✅ Copy: Preview labels/placeholders must stay generic (no scenario-specific strings such as “Search” or “Email”).

**Naming:**
- Class prefix: `.diet-[component]`
- BEM for child elements: `.diet-[component]__element`

**Theme Support:**
- Must work in light theme
- Must work in dark theme
- Use theme-aware tokens (not hardcoded colors)

**Icon Usage:**
- Use Dieter manifest glyphs (same inline SVGs shipped with Button/Segmented). No ad-hoc icons.

### Size Token Map (reference)

| Control size | Height token | Padding token | Radius token | Icon box token |
| --- | --- | --- | --- | --- |
| `xs` *(icon stub)* | `var(--control-size-xs)` | `var(--space-2)` | `var(--control-radius-xs)` | `var(--control-icon-xs)` |
| `sm` | `var(--control-size-sm)` | `var(--space-2)` / `var(--space-3)` | `var(--control-radius-sm)` | `var(--control-icon-sm)` |
| `md` | `var(--control-size-md)` | `var(--space-3)` | `var(--control-radius-md)` | `var(--control-icon-md)` |
| `lg` | `var(--control-size-lg)` | `var(--space-4)` | `var(--control-radius-lg)` | `var(--control-icon-lg)` |
| `xl` | `var(--control-size-xl)` | `var(--space-5)` | `var(--control-radius-xl)` | `var(--control-icon-xl)` |

> Use these tokens in lieu of raw pixel heights noted below. If a new token is needed, add it to `dieter/tokens/tokens.css` before shipping.

> `xs` represents the 16px “icon stub” footprint. Icon-only controls and the micro text-only button may use it; any footprint that carries both icon and label begins at `sm` (20px) and ladders up.

### Baseline Implementation Checklist

- [ ] Tokens only (no literal hex codes, no raw px other than typography fallbacks)
- [ ] Light + dark screenshots captured in Dieter harness
- [ ] Focus, hover, active, error, disabled, and read-only states verified
- [ ] `prefers-reduced-motion` honored where animation exists
- [ ] ARIA relationships validated with VoiceOver/NVDA smoke test
- [ ] Component demos added to Dieter admin harness with at least one representative variant

### Demo Layout Contract

    - **Hero matrix:** rows map to variant families (e.g., default, prefix icon, subtle tone); columns map to the size presets (`sm`, `md`, `lg`). Each cell contains the live component demo plus its core specs (class/data attributes, token highlights). States such as hover/active/focus are explored by interacting with the component inside the cell. See `dieter/dieteradmin/html/dieter-showcase/button.html` for the canonical markup (`.component-table → .component-section → .component-row → .component-cell` with `.component-copy` + `.component-visual`).
- **Supporting blocks (ordered):**
  1. Anatomy list (structural markup slots)
  2. CSS references (`@ck/dieter` bundle or lab CSS path)
  3. Token list (key variables touched by the contract)
  4. Accessibility guidance (roles/attrs/keyboard if applicable)
  5. AI contract summary (class names, markup snippets, selectors, do-nots)
  6. Snippets / usage examples (optional details accordion)
- **Optional modules:** add a “state strip” row for interactions that aren’t obvious in the matrix (e.g., validation errors, auto-resize), a motion clip if the animation is non-trivial, and a usage “Do / Don’t” pair when product has specific guardrails.
- **Mobile behavior:** hero matrix collapses to stacked cards (variant heading → size → demo). Supporting blocks stay in the same order but use accordion wrappers when the content is long.

### Wrapper Pattern Matrix

| Control type | Wrapper element | Notes |
| --- | --- | --- |
| Single input (input/select/textarea) | `<div class="diet-[component]">` | Apply `data-size` on the wrapper; label/affordances live inside. |
| Binary toggle/check control | `<label class="diet-[component]">` | Keeps native input and text clickable; no extra `for` wiring needed. |
| Control group (radio group, segmented etc.) | `<div class="diet-[component]" role="radiogroup">` | ARIA role only on the group; each child remains a `<label>`. |
| Layout surface (box, divider, badge, spinner) | `<div>`/`<span>` as shown in HTML snippet | Choose semantic tag based on context (e.g., `<span>` for inline badge). |

---

## Component Specifications

### 5. Textfield

**Purpose:** Single-line text entry field with label, helper text, and validation states.

**Sizes:** sm, md, lg (heights: 20px, 24px, 28px)
- sm: Compact forms, inline editing
- md: Default form fields
- lg: Prominent forms, mobile-first

**Variants:**
- Default: Standard text input
- With prefix icon (search, email, etc.)

**States:**
- Default: Normal unfocused state
- Focus: Blue outline ring
- Error: Red border, helper text changes color
- Disabled: Reduced opacity, no interaction (read-only follows default visuals)

**HTML Structure:**
```html
<div class="diet-input" data-size="md" data-state="default">
  <label class="diet-input__label">Email</label>
  <div class="diet-input__control">
    <input type="text" class="diet-input__field" placeholder="you@example.com" />
  </div>
  <span class="diet-input__helper">Optional supporting text</span>
</div>
```

**Accessibility:**
- Label must be associated with input
- Optional supporting text linked via `aria-describedby`
- Error messages announced to screen readers
- Disabled state communicated

**Token mapping & layout:**
- `data-size="sm|md|lg"` sets height via `--control-size-*` and horizontal padding via `--space-*`; keep vertical padding symmetrical.
- Prefix icon affordances reserve `min-inline-size: calc(var(--control-size-md) * 0.75)` and inherit the same padding token to maintain rhythm.
- Borders derive from `var(--color-border)` (default) and `var(--color-system-red)` (error) using the Button neutral/primary hover mixes for consistency.

**Variants scope:**
- **Kept:** default, prefix icon.
- **Out of scope:** All other variants deferred to Phase 2.

**State styling:**
- Focus ring leverages shared tokens (`--focus-ring-width`, `--focus-ring-color`).
- Error state promotes optional supporting text color to `var(--color-system-red)` and updates border + prefix icon tint.
- Disabled sets `background: color-mix(in oklab, var(--color-surface), transparent 55%)` while keeping text legible; read-only mirrors default visuals but blocks pointer events.

**Accessibility & semantics:**
- Wire supporting-text IDs (`id="email-supporting"`) and apply `aria-describedby` on the field; include validation ID when errors render.
- Ensure prefix/suffix buttons (e.g., visibility toggle) are separate focusable elements with `aria-label`/`aria-pressed` semantics.

**QA focus:**
- Verify placeholder contrast meets WCAG in both themes.
- Confirm VoiceOver announces supporting/error text exactly once per state change.
- Test mobile Safari autocapitalize/autofill attributes don’t break layout.

---

### 6. Textarea

**Purpose:** Multi-line text entry for longer content like comments, descriptions.

**Sizes:** sm, md, lg
- Affects padding and font-size
- Height controlled by `rows` attribute or auto-resize

**Variants:**
- Fixed height: `rows` attribute controls height
- With character counter

**States:**
- Default
- Focus: Blue outline ring
- Error: Red border
- Disabled: Reduced opacity

**HTML Structure:**
```html
<div class="diet-textarea" data-size="md">
  <label class="diet-textarea__label">Description</label>
  <textarea class="diet-textarea__field" rows="4" placeholder="Enter details..."></textarea>
  <div class="diet-textarea__footer">
    <span class="diet-textarea__helper">Optional supporting text</span>
    <span class="diet-textarea__counter">0 / 500</span>
  </div>
</div>
```

**Accessibility:**
- Label association
- Character counter as live region for screen readers
- Resize handle keyboard accessible

**Token mapping & layout:**
  - Size tokens mirror Textfield; padding scales with `--space-*` while minimum height is driven by `rows` and `line-height`.
- Footer stack spacing uses `gap: var(--space-2)` and aligns supporting text + counter baseline.

**Variants scope:**
- **Kept:** fixed-height textarea with optional supporting text; counter variant for max-length messaging.
- **Future:** auto-resize behaviours, inline formatting affordances, spell-check toggle.

**State styling:**
  - Focus ring identical to Textfield; error state reuses field border + footer text tone update.
- Disabled state sets `background: color-mix(in oklab, var(--color-surface), transparent 50%)` and `cursor: not-allowed` but keeps text legible.
- Transition effects (if used) should reference `var(--duration-snap)` and respect `prefers-reduced-motion`.

**Accessibility & semantics:**
- Counter updates a visually hidden live region every 500 ms max to avoid flooding assistive tech.
- Expose `aria-invalid="true"` and `aria-errormessage` referencing the helper when validation fails.

**QA focus:**
- Verify soft wrap vs hard return behavior in Chrome/Safari/Firefox.
- Confirm keyboard resizing works on desktop (Shift+Arrow) and that manual resize handles stay visible.
- Ensure counter contrast and error color tokens meet minimum ratios.

---

### 7. Select

**Purpose:** Dropdown list for choosing one option from multiple choices.

**Sizes:** sm, md, lg

**Variants:**
- Native select (mobile-friendly)
- Placeholder option
- Grouped options (optgroup)

**States:**
- Default
- Focus: Blue outline
- Error: Red border
- Disabled: Grayed out

**HTML Structure:**
```html
<div class="diet-select" data-size="md">
  <label class="diet-select__label">Country</label>
  <div class="diet-select__control">
    <select class="diet-select__field">
      <option value="">Choose...</option>
      <option value="us">United States</option>
      <option value="ca">Canada</option>
    </select>
    <span class="diet-select__icon">▼</span>
  </div>
  <span class="diet-select__helper">Optional supporting text</span>
</div>
```

**Accessibility:**
- Native select for keyboard/screen reader support
- Label association
- Selected value announced

**Token mapping & layout:**
  - Trigger inherits Textfield sizing tokens; caret icon slot fixed at `inline-size: var(--control-icon-md)` and aligns via flex.
- Menu surface (when a custom dropdown is required) uses `box-shadow: var(--shadow-floating)` with padding `var(--space-2)`.
- Divider between items leverages `var(--color-border)` at `1px` via `linear-gradient` for pixel-snapping.

**Variants scope:**
- **Kept:** native select with placeholder option and optgroup headings.
- **Future:** custom combobox overlay, async search, multi-select chips.

**State styling:**
- Focus ring wraps the entire control container; error state changes trigger border + caret tint.
- Disabled state sets opacity ~0.45 and ensures caret remains visible but inert.
- Transition timings reference `var(--duration-base)` and respect reduced-motion preferences.

**Accessibility & semantics:**
- Keep the native `<select>` for mobile; when layering custom UI, maintain `aria-expanded`, `aria-controls`, and focus trapping with Escape to close.
- Optgroup headings announce via `role="group"` and `aria-label` to align with SR expectations.

**QA focus:**
- Verify dropdown width matches trigger width (no clipping) and handles long labels with ellipsis.
- Test keyboard navigation (Arrow, Home/End, PageUp/PageDown) and typeahead.
- Confirm helper/error text updates live without reflowing menu height.

---

### 8. Checkbox

**Purpose:** Binary choice or multiple selections from a list.

**Sizes:** sm, md, lg
- Affects checkbox box size and label font

**Variants:**
- Standalone: Single checkbox
- With description: Additional helper text under label
- Indeterminate: Partial selection state (parent checkbox)

**States:**
- Unchecked
- Checked: Blue background, white checkmark
- Indeterminate: Blue background, white dash
- Disabled: Reduced opacity
- Error: Red border

**HTML Structure:**
```html
<label class="diet-checkbox" data-size="md">
  <input type="checkbox" class="diet-checkbox__input" />
  <span class="diet-checkbox__box">
    <span class="diet-checkbox__icon">✓</span>
  </span>
  <span class="diet-checkbox__label">Accept terms</span>
</label>
```

**Accessibility:**
- Native checkbox for keyboard/screen reader
- Space bar toggles
- Indeterminate set via JS: `element.indeterminate = true`

**Token mapping & layout:**
- Checkbox box dimension ties to `--control-size-*`; use `border-radius: var(--control-radius-sm)` for all sizes to stay aligned with buttons.
- Stroke weight is `1px` (hairline) on light theme, `1.5px` equivalent using `outline` for dark to maintain contrast.
- Icon glyphs sourced from Dieter manifest sized to 60% of box.

**Variants scope:**
- **Kept:** standalone, standalone with helper description, indeterminate.
- **Future:** checkbox list group with header, inline action link.

**State styling:**
- Check/indeterminate transitions use `transform: scale(1)` with `var(--duration-snap)` ease-out and are disabled when `prefers-reduced-motion`.
- Error state applies to wrapper with `outline: 2px solid var(--color-system-red)` while keeping box shadow minimal.

**Accessibility & semantics:**
- Helper/description text should be wrapped in `.diet-checkbox__description` and referenced via `aria-describedby`.
- Manage indeterminate via JS property only (not attribute); toggle resets to checked/unchecked states.

**QA focus:**
- Confirm focus indicator remains visible even when box is filled (use inset box-shadow fallback).
- Test touch hit area meets `--min-touch-target` by padding label inline.
- Verify indeterminate state is announced by VoiceOver/NVDA as "mixed".

---

### 9. Radio Group

**Purpose:** Select exactly one option from multiple choices.

**Sizes:** sm, md, lg

**Variants:**
- Vertical stack (default)
- Horizontal inline
- With descriptions under each option

**States:**
- Unselected
- Selected: Blue circle with inner dot
- Disabled: Reduced opacity
- Error: Red border on group

**HTML Structure:**
```html
<div class="diet-radiogroup" role="radiogroup" aria-label="Plan" data-size="md">
  <label class="diet-radio">
    <input type="radio" name="plan" class="diet-radio__input" />
    <span class="diet-radio__circle">
      <span class="diet-radio__dot"></span>
    </span>
    <span class="diet-radio__label">Free</span>
  </label>
  <label class="diet-radio">
    <input type="radio" name="plan" class="diet-radio__input" />
    <span class="diet-radio__circle">
      <span class="diet-radio__dot"></span>
    </span>
    <span class="diet-radio__label">Pro</span>
  </label>
</div>
```

**Accessibility:**
- `role="radiogroup"` on container
- `aria-label` on group
- Arrow keys navigate between options
- All radios share same `name` attribute

**Token mapping & layout:**
- Outer rail gap uses `row-gap: var(--space-2)` vertically and `column-gap: var(--space-3)` horizontally.
- Radio circle inherits `--control-size-sm|md|lg`; inner dot set to 45% of circle with `transform` scale animation.
- Label typography follows size token map (sm → `var(--control-font-sm)`, md → `var(--control-font-md)`, etc.).

**Variants scope:**
- **Kept:** vertical stack, horizontal inline, descriptive option body.
- **Future:** cards-as-radio (Box hybrid) once layout tokens land.

**State styling:**
- Focus state uses outline on `.diet-radio` with inset fallback for dark mode.
- Error state applied to `.diet-radiogroup` via `--color-system-red` border + helper text tint.

**Accessibility & semantics:**
- Provide `aria-labelledby` referencing external heading when available; fallback to inline label.
- For description blocks, wrap in `.diet-radio__description` and include ID in `aria-describedby` for the input.
- Keyboard support: Up/Left selects previous, Down/Right selects next, Home/End jump to extremes.

**QA focus:**
- Validate only one input can be checked at a time and that clicking label toggles.
- Ensure inline layout wraps gracefully on narrow widths without losing focus ring.
- Run SR smoke test to confirm "selected" announcement updates per change.

---

### 10. Switch

**Purpose:** Binary toggle for instant on/off actions (like iOS toggle).

**Sizes:** sm, md, lg

**Variants:**
- Default: Just the switch
- With label: Text next to switch

**States:**
- Off: Gray track, thumb on left
- On: Blue track, thumb on right
- Disabled: Reduced opacity

**HTML Structure:**
```html
<label class="diet-switch" data-size="md">
  <input type="checkbox" role="switch" class="diet-switch__input" />
  <span class="diet-switch__track">
    <span class="diet-switch__thumb"></span>
  </span>
  <span class="diet-switch__label">Enable notifications</span>
</label>
```

**Accessibility:**
- `role="switch"` on input
- Space bar toggles
- Screen readers announce on/off state

**Token mapping & layout:**
- Track height derives from `--control-size-*`; width is `calc(height * 2 - var(--space-1))` to maintain 2:1 ratio.
- Thumb diameter equals `height - var(--space-1)`; move via `transform: translateX(calc(track-width - height))`.
- Use `--color-system-blue` for on state background and `var(--color-system-gray-5)` for off; apply `box-shadow: var(--shadow-inset-control)` for the subtle inner edge.

**Variants scope:**
- **Kept:** switch only, switch + trailing label.
- **Future:** leading icon, nested description text.

**State styling:**
- Animations run with `var(--duration-base)` ease-in-out; disable transitions under reduced motion.
- Disabled state dims both track and label to 48% opacity and prevents pointer events.

**Accessibility & semantics:**
- Keep native checkbox input and sync `aria-checked` for compatibility; reflect external state changes programmatically.
- If label is separate element, connect via `id`/`for` or wrap input for large hit target.

**QA focus:**
- Ensure thumb final positions align pixel-perfectly in both themes (no subpixel blur).
- Verify keyboard `Space` toggles and `Tab` focus outlines remain visible on dark theme.
- Confirm SR announcement reads "On"/"Off" (or localized) when toggled.

---

### 11. Box

**Purpose:** Layout container with padding, background, and optional border/shadow.

**Sizes:** Padding variants - none, sm, md, lg

**Variants:**
- Flat: Just background color
- Raised: With subtle shadow
- Bordered: With border
- Borderless: No border

**States:**
- Default
- (No interactive states - it's a container)

**HTML Structure:**
```html
<div class="diet-box" data-padding="md" data-variant="raised">
  <div class="diet-box__header">
    <h3>Title</h3>
  </div>
  <div class="diet-box__body">
    <p>Content goes here</p>
  </div>
  <div class="diet-box__footer">
    <button>Action</button>
  </div>
</div>
```

**Accessibility:**
- Use semantic HTML inside (nav, article, section as appropriate)
- Heading hierarchy maintained

**Token mapping & layout:**
- Padding variants map to `none → 0`, `sm → var(--space-3)`, `md → var(--space-4)`, `lg → var(--space-5)`.
- `data-variant="raised"` leverages shared shadow token (`var(--shadow-elevated)`); `bordered` uses `1px solid color-mix(in oklab, var(--color-border), transparent 10%)`.
- Header/body/footer separators use `gap: var(--space-3)` ensuring consistent rhythm.

**Variants scope:**
- **Kept:** flat, raised, bordered, borderless, padding presets.
- **Future:** accent border (plan-specific), callout tone links.

**State styling:**
- Non-interactive container — no hover transitions; reserved for layout only. If clickable, product must spec additional states separately.
- In dark theme, lighten border/shadow via `color-mix` to maintain contrast against surface.

**Accessibility & semantics:**
- Encourage semantic sectioning: header uses `<header>`, body `<div>`/semantic content, footer `<footer>` when actions exist.
- Maintain heading levels relative to surrounding page structure.

**QA focus:**
- Verify nested boxes respect spacing tokens (no collapsed margins).
- Ensure raised variant shadow looks correct on both backgrounds in harness.
- Confirm responsive behavior (padding scales, content wraps cleanly at mobile widths).

---

### 12. Divider

**Purpose:** Visual separator between content sections.

**Sizes:** Thickness - hairline (1px), medium (2px), heavy (4px)

**Variants:**
- Horizontal (default)
- Vertical (for toolbars, inline)
- With label: Text in the middle of line

**States:**
- Default
- (No interactive states)

**HTML Structure:**
```html
<!-- Horizontal -->
<hr class="diet-divider" data-thickness="hairline" />

<!-- Vertical -->
<div class="diet-divider" role="separator" aria-orientation="vertical" data-thickness="medium"></div>

<!-- With label -->
<div class="diet-divider" data-variant="labeled">
  <span class="diet-divider__label">OR</span>
</div>
```

**Accessibility:**
- Use `<hr>` for horizontal separators
- `role="separator"` for vertical dividers
- `aria-orientation="vertical"` when vertical

**Token mapping & layout:**
- Hairline → `height: 1px` using `background: color-mix(in oklab, var(--color-border), transparent 10%)`.
- Medium → `height: 2px`; Heavy → `height: 4px` with `border-radius: 999px` for smooth caps.
- Labeled variant adds `padding-inline: var(--space-4)` and `gap: var(--space-2)` around the label while leveraging `text-transform: uppercase` + `var(--fs-11)`.

**Variants scope:**
- **Kept:** horizontal, vertical, labeled.
- **Future:** icon-backed dividers or badge pills (needs product brief).

**State styling:**
- Non-interactive; ensure colors meet contrast on both themes (adjust mix values accordingly).
- Vertical divider height should fill parent flex container with `align-self: stretch`.

**Accessibility & semantics:**
- Keep `<hr>` for horizontal separators to leverage built-in semantics; avoid additional wrapper roles.
- Labeled variant should include `role="text"` on the label span only if additional semantics required.

**QA focus:**
- Validate pixel snapping at various zoom levels (Chrome/Firefox) to prevent blurry lines.
- Confirm labeled divider centers text vertically and truncates gracefully.
- Test vertical divider in toolbars with buttons to ensure spacing tokens keep 44px tap targets.

---

### 13. Badge

**Purpose:** Small label showing status, count, or category.

**Sizes:** sm, md, lg

**Variants:**
- Type: info, success, warning, error, neutral
- Tone: solid (filled), subtle (light bg), outline (border only)
- With icon
- Dismissible (with × button)

**States:**
- Default
- Hover (if dismissible)
- (No focus state unless interactive)

**HTML Structure:**
```html
<span class="diet-badge" data-size="sm" data-type="success" data-tone="solid">
  Active
</span>

<span class="diet-badge" data-size="md" data-type="info">
  <span class="diet-badge__icon">ℹ</span>
  <span class="diet-badge__label">New</span>
  <button class="diet-badge__dismiss" aria-label="Dismiss">×</button>
</span>
```

**Accessibility:**
- Use semantic color names in aria-label if color conveys meaning
- Dismiss button needs aria-label
- Icons decorative unless they convey unique meaning

**Token mapping & layout:**
- Height inherits the control tokens (`--control-size-sm|md|lg`), with inline padding `var(--space-2)` (`sm`) / `var(--space-3)` (`md`) / `var(--space-4)` (`lg`).
- Icon slot fixed at `inline-size: var(--control-icon-sm)`; badge border radius defaults to `var(--control-radius-sm)`.
- Tone + type map to tokens:
  - `type="info"` → `background: color-mix(in oklab, var(--color-system-blue), transparent 85%)`, text `var(--color-system-blue)`.
  - `type="success"` → mix of `var(--role-success-bg)` etc. Document full matrix in CSS comments when implemented.

**Variants scope:**
- **Kept:** info and success badges in solid or subtle tones (text-only footprint).
- **Future:** additional types (warning/error/neutral), outline treatment, icons, dismissible behaviour, numeric counters, inline avatar badge.

**State styling:**
- Dismiss hover uses `background: color-mix(in oklab, currentColor, transparent 85%)` and inherits focus ring tokens.
- Outline variant uses `border: 1px solid currentColor` with subtle background set to transparent.

**Accessibility & semantics:**
- If color communicates status, append `aria-label="Status: Success"` or include visually hidden text.
- Dismiss button must be focusable with `aria-label` and should emit custom event for consumers.

**QA focus:**
- Ensure truncation uses `max-inline-size` but keeps icon/dismiss buttons visible.
- Verify keyboard focus on dismiss button shows proper ring without shifting layout.
- Test badges on dark surfaces and inside buttons (contrast).

---

### 14. Spinner

**Purpose:** Loading indicator for async operations.

**Sizes:** sm, md, lg

**Variants:**
- Default: Spinning circle
- With label: Text below spinner
- Inline: Next to text

**States:**
- Spinning (default)
- (No other states)

**HTML Structure:**
```html
<div class="diet-spinner" data-size="md" role="status">
  <span class="diet-spinner__visual" aria-hidden="true"></span>
  <span class="visually-hidden">Loading...</span>
</div>

<div class="diet-spinner" data-size="lg" data-variant="labeled">
  <span class="diet-spinner__visual" aria-hidden="true"></span>
  <span class="diet-spinner__label">Loading your content...</span>
</div>
```

**Accessibility:**
- `role="status"` for non-blocking loads
- `role="alert"` for critical blocking loads
- Visually hidden text describes what's loading
- Respects `prefers-reduced-motion`

**Token mapping & layout:**
- Size tokens map to diameters: `sm` → `var(--control-size-sm)`, `md` → `var(--control-size-md)`, `lg` → `var(--control-size-lg)`.
- Stroke width defaults to `calc(var(--control-size-sm) * 0.12)` and leverages `color-mix(in oklab, var(--color-accent), transparent 35%)` for trailing edge.
- Inline variant aligns spinner and label with `gap: var(--space-2)` and inherits font tokens from parent.

**Variants scope:**
- **Kept:** default spinner, labeled (stacked), inline with text.
- **Future:** determinate progress arc, inverse-on-dark background.

**State styling:**
- Animation: `animation: diet-spinner-rotate var(--duration-spin) linear infinite` by default; reduce to pulsing opacity when `prefers-reduced-motion` is on.
- Provide an inverse token set for dark surfaces (spinner stroke uses `var(--color-system-white)`).

**Accessibility & semantics:**
- Ensure visually hidden text is customizable per usage (e.g., `Loading submissions…`).
- For blocking operations, switch to `role="alert"` and consider `aria-live="assertive"` to announce immediately.

**QA focus:**
- Confirm animation remains smooth at 60fps and doesn’t alias at retina scale.
- Verify reduced-motion fallback kicks in across Safari/Firefox.
- Check labeled variant line-height and alignment across sizes.

---

**Note:** Each spec above is a proposal. Review and adjust before implementation. Some components may need additional variants, states, or accessibility considerations based on actual use cases.
