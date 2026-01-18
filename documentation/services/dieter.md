# Dieter System Overview

This document is the canonical reference for Clickeen’s design system and its preview harness. It replaces older scattered notes and should be kept aligned with the Dieter source tree.

**Last updated:** 2025-10-12 — Always verify against `dieter/components/*/*.css`, `dieter/components/*/*.spec.json`, `dieter/tokens/tokens.css`, and the DevStudio Dieter showcases when making changes.

- [1. Dieter Core](#1-dieter-core)
- [2. Dieter Admin](#2-dieter-admin)

---

## 1. Dieter Core

Dieter is Clickeen's shared design system: a token-first library consumed by Bob, Venice, marketing surfaces, and internal tools. It ships CSS plus optional JS hydrators for interactive components (see `componentsWithJs` in the manifest) under the package name `@ck/dieter` with accompanying static assets copied into each app under `/dieter/**`.

### Bundling manifest (executed)

Dieter’s build produces an explicit bundling contract at:
- `tokyo/dieter/manifest.json`

This exists to keep compilation deterministic (no heuristics based on incidental CSS classnames).

**Manifest fields (as implemented today):**
- `v`: schema version
- `gitSha`: build fingerprint
- `components[]`: valid component bundles
- `componentsWithJs[]`: bundles that ship JS (others are CSS-only)
- `aliases{}`: optional hint mapping (temporary bridge)
- `helpers[]`: classnames that must never be treated as bundles
- `deps{}`: explicit component dependencies (transitive closure allowed)

**Non‑negotiable rules:**
- ToolDrawer `type="..."` drives required bundles.
- CSS classnames never add bundles.
- Helpers are never treated as bundles.

If you add a new component or a new dependency, you must update the manifest emitter in `scripts/build-dieter.js` accordingly.

### 🔑 CRITICAL: Dieter is the Mama Library (NEW ARCHITECTURE)

**Dieter is the mama of all HTML/CSS** — it contains both primitives AND widget-specific composed components.

**What Dieter Contains:**

1. **Primitives** - Core design system components
   - `dieter/components/button/button.css`, `dieter/components/toggle/toggle.css`, `dieter/components/textfield/textfield.css`, etc.
   - Universal tokens (`dieter/tokens/tokens.css`)
   - Typography, colors, spacing, motion

2. **Widget-Specific Compositions** - Components built FROM primitives for specific widgets
   - Implemented as new component folders under `dieter/components/<component>/`
   - Each widget can create its own compositions as needed

3. **Bob-Specific Components** - Components for Bob's UI
   - Implemented as component folders under `dieter/components/<component>/`
   - Other Bob-specific UI patterns live alongside the primitives

**Why This Matters:**

**Performance:** We never load all of Dieter. Each widget only loads the CSS for components it actually uses:
- FAQ widget loads: `expander-faq.css`, `button.css`, `textfield.css`
- Newsletter widget loads: whatever IT needs

**Scalability:** Dieter can grow to 1,000+ components without performance penalty:
- Each widget stays lean (only loads what it uses)
- No bloat, no unnecessary CSS
- Infinite scalability

**Developer Experience:**
- One place for ALL UI components (primitives + compositions)
- Engineers go to Dieter to find components
- "Need an FAQ expander? Go to Dieter, grab `expander-faq`"
- "Building a new widget? Copy similar component, rename it, customize it"

**Component Organization:**
```
dieter/components/
  button/
    button.css
    button.html
    button.spec.json
    button.ts
  dropdown-edit/
    dropdown-edit.css
    dropdown-edit.html
    dropdown-edit.spec.json
  ...
```

**For widget definitions:**
Widget definitions (via `spec.json` and compiled ToolDrawer panels) contain HTML using Dieter components. They only load the specific Dieter assets they need. This keeps each widget's footprint tiny while allowing Dieter to grow infinitely.

See [Widget Architecture](../widgets/WidgetArchitecture.md) for complete details on how widgets use Dieter components.

### 1.1 Workspace Layout

| Path | Description |
| --- | --- |
| `tokens/` | Canonical design tokens (source). Built output lands in `tokyo/dieter/tokens/`. |
| `components/` | Per-component folders with `*.css`, `*.html`, `*.spec.json`, and optional `*.ts`. |
| `icons/` | Source SVGs normalized to `fill="currentColor"` plus the generated registry (`icons/icons.json`). |
| `dieteradmin/` | Static HTML fragments for icon showcase (generated; not a standalone app). |
| `tokyo/dieter/` | Build output (manifest, tokens, components, icons). |

### 1.2 Using Dieter in an Application

1. **Install / link the package:** `pnpm install @ck/dieter` (or link the workspace package).
2. **Load tokens** (and fonts if using the packaged font):
   ```html
   <link rel="stylesheet" href="/dieter/tokens/tokens.css">
   <link rel="stylesheet" href="/dieter/fonts.css"> <!-- optional: loads Inter Tight -->
   ```
3. **Import the component stylesheet(s) you need:**
   ```html
   <link rel="stylesheet" href="/dieter/components/button/button.css">
   ```
4. **Copy markup + behaviors** from `dieter/components/<component>/<component>.html` and `dieter/components/<component>/<component>.spec.json`, wire with your application logic, and run the QA checklist.

Dieter ships CSS plus optional JS hydrators (for components listed in `componentsWithJs`). Host applications load the required scripts and manage component state (e.g., `data-state` attributes, focus management, persistence).

### 1.3 Token System

All Dieter primitives use the custom properties defined in `tokens/tokens.css`. Prefer overriding tokens to hand-editing component CSS.

#### 1.3.1 Spacing & Sizing Tokens

| Token Family | Purpose | Notes |
| --- | --- | --- |
| `--space-*` | Horizontal spacing scale (≈4px increments). | Used for padding/margins outside controls. |
| `--hspace-*` | Vertical spacing scale (smaller increments). | Use for vertical rhythm (labels ↔ inputs, stacked content). |
| `--control-size-*` | Control heights for buttons, toggles, etc. | `xs` → `xl` ladder shared by all controls. |
| `--control-padding-inline` | Side padding inside controls. | Do **not** override; maps to the `--space-*` scale per size. |
| `--control-inline-gap-*` | Icon ↔ text gaps (per size). | Maps to `--space-*`; applied via `gap:`. |
| `--control-radius-*` / `--radius-*` | Border radii. | Control vs. surface radii. |

Text labels sometimes apply `padding-inline: var(--space-0)` for optical balance; keep root padding set via the control tokens.

#### 1.3.2 Icon Tokens

| Token | Description |
| --- | --- |
| `--control-icon-xs|sm|md|lg|xl` | Icon container sizes aligned with control ladder. |
| `--control-icon-glyph-ratio` (+ per-size variants) | Ratio for scaling the SVG glyph inside the icon box (`glyph = calc(iconBox × ratio)`). |

Icon-only controls use the square control height for both dimensions and zero inline padding.

#### 1.3.3 Typography Tokens

| Token | Usage |
| --- | --- |
| `--font-ui` | Global UI font stack (Inter Tight by default). Override globally to customize fonts. |
| `--control-text-xs|sm|md|lg|xl` | Control typography (weight/size) matching the control ladder. |
| Semantic tokens (`--heading-*`, `--body-*`, etc.) | Applied via utility classes or element defaults. |

See [Typography](#14-typography) for utility classes and font loading guidance.

#### 1.3.4 Color Tokens & Theme Model

- Core tokens (`--color-text`, `--color-bg`) define baseline foreground/background colors.
- Accent tokens (`--color-system-blue`, `--color-system-green`, etc.) represent branded color roles.
- Surface/border tokens (`--role-surface-*`, `--role-border`) style panels and subtle dividers via `color-mix` operations.
- Focus tokens (`--focus-ring-*`) control ring color, width, and offset.

Theme switching occurs automatically via:

1. `@media (prefers-color-scheme: dark)` for OS-level dark mode.
2. `:root[data-theme="dark"|"light"|"hc"]` for explicit overrides (e.g., manual theme toggle).

Many component states use transparency blends (e.g., `.12`, `.2`) via `color-mix(in oklab, baseColor, transparent X%)`. These mix ratios are already encoded in the CSS; override the base tokens rather than reapplying mixes.

#### 1.3.5 Motion Tokens

| Token | Description |
| --- | --- |
| `--duration-snap` | Fast transitions (≈140ms). |
| `--duration-base` | Standard transitions (≈160ms). |
| `--duration-spin` | Loading/animation duration (≈600ms). |
| `--easing-standard` | Primary easing curve. |

All components respect `@media (prefers-reduced-motion: reduce)` and disable transitions accordingly.

#### 1.3.6 Global Control Ladder

Every control must consume the shared size ladder. Adjusting token mappings here requires updating all controls.

| Control size | Height | Radius | Side padding | Icon box | Icon gap | Typography |
| --- | --- | --- | --- | --- | --- | --- |
| xs | `--control-size-xs` | `--control-radius-xs` | `--control-padding-inline` | `--control-icon-xs` | `--control-inline-gap-xs` | `--control-text-xs` |
| sm | `--control-size-sm` | `--control-radius-sm` | `--control-padding-inline` | `--control-icon-xs` | `--control-inline-gap-sm` | `--control-text-sm` |
| md | `--control-size-md` | `--control-radius-md` | `--control-padding-inline` | `--control-icon-sm` | `--control-inline-gap-md` | `--control-text-md` |
| lg | `--control-size-lg` | `--control-radius-lg` | `--control-padding-inline` | `--control-icon-sm` | `--control-inline-gap-lg` | `--control-text-lg` |
| xl | `--control-size-xl` | `--control-radius-xl` | `--control-padding-inline` | `--control-icon-sm` | `--control-inline-gap-xl` | `--control-text-xl` |

### 1.4 Typography

#### 1.4.1 Font Loading Policy (Per Surface)

**Different surfaces have different font loading requirements:**

**Bob & Dieter Admin (Apps):**
- Use Google Fonts via `<link>` tag in app layout
- Allowed domains: `fonts.googleapis.com` and `fonts.gstatic.com`
- Example:
  ```html
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600&display=swap">
  <link rel="stylesheet" href="/dieter/tokens/tokens.css">
  ```
- Tokens assume font is already loaded globally

**Venice (Embeds):**
- **User-selected fonts:** Load via Google Fonts `<link>` tag in SSR (from widget instanceData)
- **CSP must allow:** `fonts.googleapis.com` and `fonts.gstatic.com` for widgets with Typography menu
- **Default fallback:** If no font selected or CSP blocks, use system fonts
- **NO @import in CSS:** Conflicts with strict embed CSP
- Example SSR pattern:
  ```typescript
  // Venice renderer
  const fontUrl = instanceData.typography?.customFontUrl ||
                  widgetJson.typography?.availableFonts.find(f => f.name === instanceData.typography?.selectedFont)?.googleFontsUrl;

  if (fontUrl) {
    html = `<link rel="stylesheet" href="${fontUrl}">` + html;
  }
  ```

**Prague (Marketing):**
- Same as Bob/Admin (Google Fonts via `<link>` tag)

**Key Rules:**
1. **Never use @import for fonts** - Use `<link>` tags only
2. **SSR font loading** - Venice injects font `<link>` server-side, never client-side
3. **CSP compliance** - All font URLs must be allowed in CSP for that surface
4. **Fallback fonts** - Always provide system font fallback in `--font-ui`

#### 1.4.2 Element Defaults & Utilities

- `body`: 16px, 400 weight.
- `h1`…`h6`: scaled 32px → 14px, weights 700 → 500.
- `.heading-*`, `.body*`, `.label*`, `.caption*`, `.overline*` utilities provide semantic typography in class form.
- Numeric utilities (`.text-10`…`.text-32`) remain for legacy usage.

### 1.5 Colors in Practice

- `--color-system-*` tokens provide accent colors; components reference them via variants (e.g., `data-variant="primary"`).
- `color-mix` is used for hover/active states (e.g., mixing the base color with `--color-text` or transparent white).
- Light/dark switching uses the aforementioned theme hooks; tokens degrade gracefully when custom themes are applied (override the base token values).

### 1.6 Icons

- Source SVGs: `icons/svg/*.svg` (normalized to `fill="currentColor"`).
- Build output: `tokyo/dieter/icons/svg/*` plus the registry (`tokyo/dieter/icons/icons.json`).
- Build process: `pnpm --filter @ck/dieter build` (writes into `tokyo/dieter`).
- Consumption rules:
  - Inline SVG markup from the registry (`tokyo/dieter/icons/icons.json`).
  - Bob housed icons can use local helpers (e.g., a React wrapper) but must source markup from the registry.
  - Venice embeds MUST inline SVG during SSR; client-side fetches are forbidden to protect loader budgets.
  - No ad-hoc icon bundles: update source SVGs, rebuild, copy assets.

### 1.7 Component Contracts

Component contracts live alongside source:
- `dieter/components/<component>/<component>.spec.json` (behavior + props contract)
- `dieter/components/<component>/<component>.html` (canonical markup)
- `dieter/components/<component>/<component>.css` (styling contract)

Use the DevStudio Dieter showcase to review the current component set and rendered markup.

### 1.8 Build & Distribution Workflow

Whenever tokens or component CSS changes:

1. Update source files in `tokens/` or `components/` (including `*.spec.json` / `*.html` contracts).
2. Build Dieter assets into Tokyo:
   ```bash
   pnpm --filter @ck/dieter build
   ```
3. Verify visually in DevStudio:
   ```bash
   pnpm --filter @clickeen/devstudio dev
   ```
   - Visit `http://localhost:5173/#/dieter/` or `http://localhost:5173/#/dieter-components-new/`
4. Commit changes; consuming apps should use the rebuilt `tokyo/dieter` assets.

Never hand-edit `/bob/public/dieter/**`; treat it as a generated artifact.

---

## 2. DevStudio Dieter Preview (current)

DevStudio (`admin/`) is the preview harness for Dieter. It loads component specs/templates directly from `dieter/components/*` and renders per-component pages generated by `admin/scripts/generate-component-pages.ts`.

### 2.1 Running & Viewing

- Development: `pnpm --filter @clickeen/devstudio dev` → `http://localhost:5173`
- Dieter showcase routes:
  - `/#/dieter/` (curated showcases)
  - `/#/dieter-components-new/` (generated per-component pages)

### 2.2 Source of Truth

- Component contracts live in `dieter/components/<component>/<component>.spec.json` + `.html` + `.css`.
- DevStudio is a viewer; it does not define component behavior.

---

## 3. Accessibility & Privacy Baseline

All Dieter components and widgets using Dieter MUST meet these minimum standards:

### 3.1 Accessibility (WCAG AA)

**Color Contrast:**
- WCAG AA minimum contrast ratios enforced
- Visible focus states on all interactive elements
- Focus indicators use `--focus-ring` token

**Form Controls:**
- All inputs have associated `<label>` elements (using `for` attribute)
- Error messages use `aria-describedby` to link to input
- Dynamic feedback uses `aria-live` regions for screen readers
- Required fields indicated both visually and via `aria-required`

**Keyboard Navigation:**
- All interactive elements keyboard operable (Tab, Enter, Space, Arrow keys)
- Focus trap in overlays/modals (Tab cycles within, Escape closes)
- Return focus to opener when overlay closes
- No keyboard traps (users can always Tab out)

**Screen Reader Support:**
- Semantic HTML (buttons, links, headings, landmarks)
- ARIA labels where visual context isn't sufficient
- State changes announced (loading, success, error via aria-live)

### 3.2 Privacy (Embed Requirements)

**No Tracking in Embeds:**
- No cookies or localStorage used in Venice-rendered widgets
- No third-party scripts injected
- Respect Do Not Track (DNT) browser setting
- Analytics pixel is fire-and-forget, no PII

**Data Minimization:**
- Only collect data user explicitly provides in forms
- No fingerprinting or session tracking
- Submission data retention: 30 days for anonymous submissions

**GDPR Compliance:**
- Form submissions include data processing notice
- Users can opt out of analytics via `data-ckeen-analytics="false"`
- IP addresses hashed before storage (SHA-256 with salt)

### 3.3 Testing Checklist

Before shipping any Dieter component or widget:
- [ ] Manual keyboard test (Tab, Shift+Tab, Enter, Space, Escape)
- [ ] Screen reader test (VoiceOver/NVDA) for announcements
- [ ] Color contrast check (use browser DevTools accessibility panel)
- [ ] Focus visible on all interactive elements
- [ ] No console errors for missing aria-labels
- [ ] Form validation errors announced via aria-live
- [ ] Overlay focus trap works and returns focus on close

---

This document now supersedes older Dieter write-ups. Per-component contracts live in `dieter/components/<component>/<component>.spec.json` and `.html`; refer to both together when integrating or modifying Dieter components.
