# Dieter Component Candidates — V0 Build Guide

> STATUS: DRAFT — Candidate build guide. Nothing here is GA until promoted into `documentation/systems/Dieter.md` in the same PR as the code change.

## Build Philosophy (CRITICAL)

When implementing Dieter components:

1. **V0 = Elegant Minimum** — Build the simplest, most beautiful version first. Iterate complexity later.
2. **Apple Aesthetic** — Neutral, refined, spacious. Study Button/Segmented for inspiration.
3. **Tokens Only** — No `#hex` in component CSS, no raw `px` (except typography fallbacks). Use `var(--*)` for everything.
4. **Height Ladder** — Control sizes MUST use `--control-size-sm/md/lg` (20px/24px/28px). No custom heights.
5. **Color Sparingly** — Default to grays and surfaces. Accent color (`--color-accent`) for focus/active only.
6. **No Semantic Color Soup** — ❌ Avoid red/green/yellow states in V0. Keep it neutral and elegant.

---

## Component Build Checklist (V0)

Before coding, confirm:

- [ ] You've studied `button.css` and `segmented.css` for patterns
- [ ] You know which `--control-size-*` tokens to use
- [ ] You're building **one** clean variant (not five at once)
- [ ] States are minimal: default, hover, focus, disabled
- [ ] No color-coded states (error/success/warning) in V0
- [ ] Transitions use `var(--duration-base)` or `var(--duration-snap)`
- [ ] Dark theme works via token inheritance (no hardcoded overrides)

---

## Token Reference (Use These)

### Control Sizes (Heights)
```css
--control-size-sm: 1.25rem;   /* 20px */
--control-size-md: 1.5rem;    /* 24px */
--control-size-lg: 1.75rem;   /* 28px */
```

### Control Radii
```css
--control-radius-sm: 0.3125rem;
--control-radius-md: 0.375rem;
--control-radius-lg: 0.4375rem;
```

### Spacing (Padding/Gap)
```css
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
```

### Color Tokens (Neutral Palette)
Use tokens, not literal values, in component CSS.
```css
--color-bg;        /* background */
--color-surface;   /* control surface */
--color-text;      /* foreground text */
--color-border;    /* borders/separators */
--color-accent;    /* focus/active accents only */
```

### State Mixing (Hover/Active)
```css
/* Hover = 6% mix in light, 10% in dark */
background: color-mix(in oklab, var(--color-surface), var(--color-text) 6%);

/* Active = 14% mix in light, 22% in dark */
background: color-mix(in oklab, var(--color-surface), var(--color-text) 14%);
```
Always blend tokens with tokens; do not blend raw hex values.

### Motion
```css
--duration-snap: 140ms;   /* Quick transitions */
--duration-base: 160ms;   /* Default transitions */
```

### Accessibility
```css
--focus-ring-width: 2px;
--focus-ring-color: var(--color-accent);
--focus-ring-offset: 2px;
```

### Theming (Light/Dark/HC)
- Light defaults are provided by tokens; dark overrides via `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`.
- High contrast via `:root[data-theme="hc"]`.
- Components must inherit via tokens (no hardcoded dark overrides). Pin `data-theme` only in previews when needed.

---

## Candidate Build Queue (V0)

Not GA. Build candidates here, preview in Dieter Admin, and promote to the Dieter PRD only when approved.

### 1. Textfield

**Purpose:** Single-line text entry.

**V0 Scope (Candidate Minimum):**
- One variant: clean textfield with label
- Three sizes: `md`, `lg`, `xl` (tied to `--control-size-*`)
- States: default, focus, disabled
- Optional: helper text below

**V0 HTML (Target):**
```html
<div class="diet-input" data-size="md">
  <label class="diet-input__label">Label</label>
  <input type="text" class="diet-input__field" placeholder="Placeholder" />
  <span class="diet-input__helper">Optional supporting text</span>
</div>
```

**CSS Mandate:**
- Wrapper uses `display: grid; gap: var(--space-2)`
- Field height = `--control-size-md` (24px) with vertical padding `var(--space-2)`
- Border: `1px solid color-mix(in oklab, var(--color-border), transparent 40%)`
- Focus: 1px system-blue stroke (border-color `var(--color-system-blue)`), no box-shadow ring
- Placeholder: `color-mix(in oklab, var(--color-text), transparent 60%)` and disappears on input
- Below-field helper: neutral text for additional info (error/success styles are V1)
- Disabled: `background: color-mix(in oklab, var(--color-surface), transparent 55%)`

Vertical spacing (hspace)
- Prefer `--hspace-*` for vertical rhythm inside the control:
  - Default stack gap (label ↔ field ↔ optional supporting text): `gap: var(--hspace-4)` (0.3rem)
  - Optional size bumps: `lg → var(--hspace-5)`, `xl → var(--hspace-6)`
- Keep `--space-*` for outer layout gutters/padding between components.

**Out of V0 Scope (V1):**
- Prefix/suffix icons (add in V1 after core works)
- Error states with red borders (V1)
- Success states with green checks (V1)
- Character counters (V1)

---

### 2. Textarea

**Purpose:** Multi-line text entry.

**V0 Scope (Candidate Minimum):**
- One variant: clean textarea with label
- Single size (V0): padding/font-size fixed; height controlled by `rows`
- States: default, focus, disabled
- Optional: helper text below

**V0 HTML (Target):**
```html
<div class="diet-textarea">
  <label class="diet-textarea__label">Label</label>
  <textarea class="diet-textarea__field" rows="4" placeholder="Placeholder"></textarea>
  <span class="diet-textarea__helper">Optional supporting text</span>
</div>
```

**CSS Mandate:**
- Inherits Textfield's border/disabled logic
- Focus: 1px system-blue stroke (border-color `var(--color-system-blue)`), no box-shadow ring
- Height controlled by `rows` attribute (not CSS)
- Resize handle remains visible

**Out of V0 Scope:**
- Character counter (V1)
- Auto-resize JS behavior (V1)
- Inline formatting toolbar (V2)

---

### 3. Select

**Purpose:** Dropdown list for choosing one option.

**V0 Scope (GA Minimum):**
- Native `<select>` element (mobile-friendly, accessible)
- Three sizes: `sm`, `md`, `lg`
- States: default, focus, disabled
- Custom caret icon

**V0 HTML (Target):**
```html
<div class="diet-select" data-size="md">
  <label class="diet-select__label">Label</label>
  <div class="diet-select__control">
    <select class="diet-select__field">
      <option value="">Choose…</option>
      <option value="one">Option 1</option>
      <option value="two">Option 2</option>
    </select>
    <span class="diet-select__icon" aria-hidden="true">
      <svg><!-- chevron down --></svg>
    </span>
  </div>
  <span class="diet-select__helper">Optional supporting text</span>
</div>
```

**CSS Mandate:**
- Control wrapper mimics Textfield border/focus styling
- Native `<select>` with `appearance: none` to hide default arrow
- Custom icon positioned absolute on the right
- Icon uses `--control-icon-md` sizing
- Focus: 1px system-blue stroke (border-color `var(--color-system-blue)`), no box-shadow ring

**Out of V0 Scope:**
- Custom dropdown overlay (Listbox pattern) — too complex for V0
- Multi-select (V2)
- Async search/combobox (V2)

---

### 4. Checkbox

**Purpose:** Binary choice (checked/unchecked).

**V0 Scope (GA Minimum):**
- Standalone checkbox with label
- Three sizes: `sm`, `md`, `lg`
- States: unchecked, checked, disabled
- Custom checkmark icon

**V0 HTML (Target):**
```html
<label class="diet-checkbox" data-size="md">
  <input type="checkbox" class="diet-checkbox__input" />
  <span class="diet-checkbox__box">
    <svg class="diet-checkbox__icon" aria-hidden="true"><!-- checkmark --></svg>
  </span>
  <span class="diet-checkbox__label">Accept terms</span>
</label>
```

**CSS Mandate:**
- Box size = `--control-size-md` (24px)
- Border: `1px solid color-mix(in oklab, var(--color-border), transparent 25%)`
- Border-radius: `var(--control-radius-sm)` (slightly rounded, not circular)
- Checked: background = `--color-accent`, icon appears with scale animation
- Icon sized to 60% of box (scales with size)
- Transition: `transform var(--duration-snap) ease-out` (respects `prefers-reduced-motion`)

**Out of V0 Scope:**
- Indeterminate state (V1)
- Helper description text (V1)
- Error state with red outline (V1)

---

### 5. Radio Group

**Purpose:** Select exactly one option from multiple choices.

**V0 Scope (GA Minimum):**
- Vertical stack of radio options
- Three sizes: `sm`, `md`, `lg`
- States: unselected, selected, disabled

**V0 HTML (Target):**
```html
<div class="diet-radiogroup" role="radiogroup" aria-label="Plan" data-size="md">
  <label class="diet-radio">
    <input type="radio" name="plan" class="diet-radio__input" value="free" />
    <span class="diet-radio__circle">
      <span class="diet-radio__dot"></span>
    </span>
    <span class="diet-radio__label">Free</span>
  </label>
  <label class="diet-radio">
    <input type="radio" name="plan" class="diet-radio__input" value="pro" />
    <span class="diet-radio__circle">
      <span class="diet-radio__dot"></span>
    </span>
    <span class="diet-radio__label">Pro</span>
  </label>
</div>
```

**CSS Mandate:**
- Group wrapper: `display: flex; flex-direction: column; gap: var(--space-2)`
- Circle size = `--control-size-md` (24px), perfectly round
- Border: `1px solid color-mix(in oklab, var(--color-border), transparent 25%)`
- Selected: border changes to `--color-accent`, inner dot appears
- Dot size = 45% of circle, uses scale animation
- Keyboard navigation: Arrow keys move selection

**Out of V0 Scope:**
- Horizontal layout (V1)
- Description text under each option (V1)
- Card-style radios (V2)

---

### 6. Switch

**Purpose:** Binary toggle for instant on/off actions (iOS-style).

**V0 Scope (GA Minimum):**
- Switch with optional trailing label
- Three sizes: `sm`, `md`, `lg`
- States: off, on, disabled

**V0 HTML (Target):**
```html
<label class="diet-switch" data-size="md">
  <input type="checkbox" role="switch" class="diet-switch__input" />
  <span class="diet-switch__track">
    <span class="diet-switch__thumb"></span>
  </span>
  <span class="diet-switch__label">Enable notifications</span>
</label>
```

**CSS Mandate:**
- Track width = `calc(--control-size-md * 2)` (~48px for md)
- Track height = `--control-size-md` (24px)
- Thumb diameter = `calc(--control-size-md - 4px)` (20px for md, leaves 2px margin)
- Off state: track = `var(--color-system-gray-5)`, thumb on left
- On state: track = `--color-accent`, thumb slides right via `transform: translateX(...)`
- Transition: `var(--duration-base)` ease-in-out
- Thumb has subtle shadow for depth

**Out of V0 Scope:**
- Leading icon (V1)
- Description text (V1)

---

### 7. Box

**Purpose:** Layout container with padding and optional border/shadow.

**V0 Scope (GA Minimum):**
- Four padding presets: `none`, `sm`, `md`, `lg`
- Three surface treatments: `flat`, `raised`, `bordered`

**V0 HTML (Target):**
```html
<div class="diet-box" data-padding="md" data-variant="raised">
  <div class="diet-box__header">
    <h3>Title</h3>
  </div>
  <div class="diet-box__body">
    <p>Content goes here</p>
  </div>
</div>
```

**CSS Mandate:**
- Padding: `none` = 0, `sm` = `var(--space-3)`, `md` = `var(--space-4)`, `lg` = `var(--space-5)`
- Flat: `background: var(--color-surface)`, no border
- Raised: adds `box-shadow: var(--shadow-elevated)`
- Bordered: adds `border: 1px solid color-mix(in oklab, var(--color-border), transparent 10%)`
- Border-radius: `var(--control-radius-md)`
- Header/body/footer use `gap: var(--space-3)` for spacing

**Out of V0 Scope:**
- Accent border colors (V1)
- Interactive states (Box is not a button)
- Nested box variants (V2)

---

### 8. Divider

**Purpose:** Visual separator between sections.

**V0 Scope (GA Minimum):**
- Horizontal and vertical orientations
- One thickness: hairline (1px)

**V0 HTML (Target):**
```html
<!-- Horizontal -->
<hr class="diet-divider" />

<!-- Vertical -->
<div class="diet-divider" role="separator" aria-orientation="vertical"></div>
```

**CSS Mandate:**
- Horizontal: `<hr>` with `height: 1px`, `background: color-mix(in oklab, var(--color-border), transparent 10%)`
- Vertical: `width: 1px`, `align-self: stretch` to fill parent height
- No margin (consumers control spacing)
- Color adapts to theme automatically

**Out of V0 Scope:**
- Labeled divider (text in the middle) — V1
- Different thicknesses (2px, 4px) — V1
- Icon-backed dividers — V2

---

### 9. Badge

**Purpose:** Small label showing status or category.

**V0 Scope (GA Minimum):**
- Two tones: `solid` (filled), `subtle` (light bg)
- One type: `info` (blue accent)
- Three sizes: `sm`, `md`, `lg`

**V0 HTML (Target):**
```html
<span class="diet-badge" data-size="sm" data-tone="solid">
  Active
</span>
```

**CSS Mandate:**
- Height = `--control-size-sm/md/lg`
- Padding: `sm` = `var(--space-2)`, `md` = `var(--space-3)`, `lg` = `var(--space-4)`
- Border-radius: `var(--control-radius-sm)` (pill shape)
- Solid tone: `background: var(--color-accent)`, `color: white`
- Subtle tone: `background: color-mix(in oklab, var(--color-accent), transparent 85%)`, `color: var(--color-accent)`
- Font: `600 var(--fs-11)` with `letter-spacing: 0.02em`

**Out of V0 Scope:**
- Success/warning/error types (green/yellow/red) — avoid semantic colors in V0
- Icons in badges — V1
- Dismissible badges (with ×) — V1
- Numeric counter badges — V1

---

### 10. Spinner

**Purpose:** Loading indicator for async operations.

**V0 Scope (GA Minimum):**
- Spinning circle animation
- Three sizes: `sm`, `md`, `lg`

**V0 HTML (Target):**
```html
<div class="diet-spinner" data-size="md" role="status">
  <span class="diet-spinner__visual" aria-hidden="true"></span>
  <span class="sr-only">Loading...</span>
</div>
```

**CSS Mandate:**
- Diameter = `--control-size-sm/md/lg`
- Stroke width = `calc(var(--control-size-md) * 0.12)` (scales with size)
- Color: `color-mix(in oklab, var(--color-accent), transparent 35%)` for the arc
- Animation: `animation: diet-spinner-rotate var(--duration-spin) linear infinite`
- Reduced motion: fallback to pulsing opacity instead of rotation

**Out of V0 Scope:**
- Determinate progress (arc percentage) — V2
- Labeled spinner (text below) — V1
- Inverse color for dark backgrounds — V1

---

## Implementation Protocol

1. **Pick one component** from the queue above
2. **Study Button.css** — copy the token usage patterns, state handling, and dark theme approach
3. **Build V0 only** — the simplest variant, 3 sizes, 4 states (default/hover/focus/disabled)
4. **Test in DieterAdmin** — create showcase HTML, verify light/dark themes
5. **Verify tokens** — no `#hex`, no raw `px`, all transitions use `var(--duration-*)`
6. **Iterate** — after V0 works, add one more variant at a time

---

## Anti-Patterns (DO NOT DO)

❌ **Semantic Color Soup**
```css
/* BAD - turns form into a traffic light */
.diet-input[data-state="error"] {
  border-color: #ff3b30; /* red */
}
.diet-input[data-state="success"] {
  border-color: #34c759; /* green */
}
.diet-input[data-state="warning"] {
  border-color: #ff9500; /* yellow */
}
```

✅ **Neutral Elegance**
```css
/* GOOD - keeps it refined */
.diet-input:focus-within {
  border-color: var(--color-accent); /* blue accent for focus only */
}
.diet-input[disabled] {
  background: color-mix(in oklab, var(--color-surface), transparent 55%);
}
```

---

❌ **Raw Pixel Heights**
```css
/* BAD - breaks size system */
.diet-input__field {
  height: 28px; /* hardcoded */
}
```

✅ **Token-Based Heights**
```css
/* GOOD - uses size ladder */
.diet-input__control {
  min-height: var(--control-size-md); /* 24px */
}
```

---

❌ **Too Many Variants Upfront**
```css
/* BAD - building 20 variants before V0 works */
.diet-input--with-icon { ... }
.diet-input--with-clear-button { ... }
.diet-input--with-character-counter { ... }
.diet-input--with-validation-tooltip { ... }
/* ... and 16 more */
```

✅ **Incremental Complexity**
```css
/* GOOD - V0 is clean baseline */
.diet-input {
  /* Core styling only */
}

/* V1 adds prefix icon after V0 ships */
.diet-input__prefix { ... }
```

---

## Success Criteria (V0 Done)

A component graduates from candidate to GA when:

- [ ] CSS uses tokens exclusively (no hardcoded colors/spacing)
- [ ] Works in light + dark themes without explicit overrides
- [ ] Has 3 sizes tied to `--control-size-*` tokens
- [ ] Has 4 states minimum: default, hover, focus, disabled
- [ ] Focus ring uses `--focus-ring-*` tokens
- [ ] Transitions respect `prefers-reduced-motion`
- [ ] DieterAdmin showcase page exists with full size matrix
- [ ] Visually matches Button/Segmented quality bar
- [ ] No semantic colors (red/green/yellow) in default state

---

**Remember:** V0 is about elegance and refinement, not feature completeness. Build the most beautiful simple version first. Add complexity only after the foundation is solid.
