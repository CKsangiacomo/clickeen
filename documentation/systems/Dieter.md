# Dieter System Overview

This document is the canonical reference for Clickeen’s design system and its preview harness. It consolidates all guidance previously found in `dieter/README.md` and replaces outdated versions of this doc.

**Last updated:** 2025-10-12 — Always verify against `dieter/components/*.css`, `dieter/tokens/tokens.css`, and the Dieter Admin showcases when making changes.

- [1. Dieter Core](#1-dieter-core)
- [2. Dieter Admin](#2-dieter-admin)

---

## 1. Dieter Core

Dieter is Clickeen's shared design system: a token-first, CSS-only library consumed by Bob, Venice, marketing surfaces, and internal tools. It ships under the package name `@ck/dieter` with accompanying static assets copied into each app under `/dieter/**`.

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
   - `button.css`, `toggle.css`, `textfield.css`, `expander.css`, `dropdown.css`, etc.
   - Universal tokens (`tokens.css`)
   - Typography, colors, spacing, motion

2. **Widget-Specific Compositions** - Components built FROM primitives for specific widgets
   - `expander-faq.css` - FAQ-specific expander with delete button, Q&A structure
   - `card-testimonials.css` - Testimonial card layout
   - Each widget can create its own compositions as needed

3. **Bob-Specific Components** - Components for Bob's UI
   - `bob-basetooldrawer.css` - Tool drawer base styles
   - Other Bob-specific UI patterns

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
  // Primitives (universal)
  button.css
  toggle.css
  textfield.css
  expander.css

  // Widget-specific compositions
  expander-faq.css
  card-testimonials.css

  // Bob-specific
  bob-basetooldrawer.css
```

**For widget definitions:**
Widget definitions (via `spec.json` and compiled ToolDrawer panels) contain HTML using Dieter components. They only load the specific Dieter assets they need. This keeps each widget's footprint tiny while allowing Dieter to grow infinitely.

See [Widget Architecture](../widgets/WidgetArchitecture.md) for complete details on how widgets use Dieter components.

### 1.1 Workspace Layout

| Path | Description |
| --- | --- |
| `tokens/` | Canonical design tokens (`@dieter/tokens/tokens.css`). Includes spacing, typography, color, focus, and motion tokens. |
| `components/` | CSS contracts for each primitive (e.g., `button.css`, `segmented.css`). Compiled into `dist/components/*.css`. |
| `icons/` | Source SVGs normalized to `fill="currentColor"` plus the generated registry (`icons/icons.json`). |
| `dietercomponents.md` | Live integration guide: markup, behavior expectations, QA per component. |
| `dieteradmin/` | Preview harness (documented in [Section 2](#2-dieter-admin)). |
| `dist/` | Generated artifacts produced by `pnpm --filter @ck/dieter build` (ignored during development). |

### 1.2 Using Dieter in an Application

1. **Install / link the package:** `pnpm install @ck/dieter` (or link the workspace package).
2. **Load tokens** (and fonts if using the packaged font):
   ```html
   <link rel="stylesheet" href="/dieter/tokens/tokens.css">
   <link rel="stylesheet" href="/dieter/fonts.css"> <!-- optional: loads Inter Tight -->
   ```
3. **Import the component stylesheet(s) you need:**
   ```html
   <link rel="stylesheet" href="/dieter/components/button.css">
   ```
4. **Copy markup + behaviors** from `dietercomponents.md`, wire with your application logic, and run the QA checklist.

Dieter ships **CSS only**. Host applications manage all interactivity (e.g., toggling `data-state` attributes, focus management, persistence).

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
- Build output: `dieter/dist/icons/svg/*`, plus registry files (`icons.json`, `icons.js`, typings).
- Copy process: `pnpm --filter @ck/dieter build` followed by `node scripts/copy-dieter-assets.js` (or Turbo task) to sync `/dieter/icons/**` in consuming apps.
- Consumption rules:
  - Inline SVG markup from the registry (`dieter/dist/icons.js` or JSON).
  - Bob housed icons can use local helpers (e.g., a React wrapper) but must source markup from the registry.
  - Venice embeds MUST inline SVG during SSR; client-side fetches are forbidden to protect loader budgets.
  - No ad-hoc icon bundles: update source SVGs, rebuild, copy assets.

### 1.7 Component Contracts

The full integration guide (markup, behaviors, QA) lives in [dieter/dietercomponents.md](../../dieter/dietercomponents.md). Always consult it before wiring a component. Current components include:

| Component | Purpose |
| --- | --- |
| Button | Primary/secondary calls to action (icon-only/text-only/icon-text). |
| Segmented | Radio-based segmented control. |
| Textfield | Core input field + composed variants. |
| Dropdown | Trigger + floating surface pattern. |
| Expander | Checkbox-driven disclosure section. |
| Toggle | Checkbox-based switch. |
| Tabs | Radio-based tablist with baseline indicator. |
| Textrename | Inline editable text field with view/edit state toggle. |

### 1.8 Build & Distribution Workflow

Whenever tokens or component CSS changes:

1. Update source files in `tokens/` or `components/`.
2. Update `dietercomponents.md` with the new contract.
3. Update Dieter Admin fragments for previews.
4. Run `pnpm --filter @ck/dieteradmin dev` to verify visually.
5. Build and copy assets:
   ```bash
   pnpm --filter @ck/dieter build
   node scripts/copy-dieter-assets.js
   ```
6. Commit changes; the consuming apps should re-run their asset copy or build step.

Never hand-edit `/bob/public/dieter/**`; treat it as a generated artifact.

---

## 2. Dieter Admin

Dieter Admin is the internal preview harness used for documentation and manual QA. It imports Dieter source CSS directly; it is not a production surface.

### 2.1 Role & Scope

| Dieter Admin **is** | Dieter Admin **is not** |
| --- | --- |
| Static Vite app for previews & documentation. | A runtime bundle or component library. |
| A safe playground for interaction demos. | A source of truth for component contracts (the CSS is). |
| A QA checklist driver before shipping CSS. | Replacement for app-specific logic (Bob/Venice still own JS). |

### 2.2 Project Structure

| Path | Description |
| --- | --- |
| `src/main.ts` | Bootstraps the shell, router, and shared renderer. |
| `src/html/dieter-showcase/*.html` | HTML fragments for each component preview. |
| `src/css/*` | Styles for the admin shell (never shipped). |
| `src/data/routes.ts` | Maps slugs to showcase fragments and CSS imports. |
| `src/data/nav.config.ts` | Sidebar grouping and ordering. |

### 2.3 Running & Building

- Development: `pnpm --filter @ck/dieteradmin dev` → `http://localhost:5173`
- Production build (optional): `pnpm --filter @ck/dieteradmin build`

### 2.4 Authoring / Updating Pages

1. Create or edit the HTML fragment under `src/html/dieter-showcase/`.
2. Ensure the fragment’s CSS imports are listed in `routes.ts`.
3. Register the page in `nav.config.ts` to expose it in the sidebar.
4. If the demo needs interaction, add local inline scripts guarded by `data-demo` hooks (admin-only; do not ship to production).

### 2.5 Shared Renderer Warnings

`main.ts` renders all component pages. Changes to its layout or DOM helpers affect every showcase. Always leave a warning block near the renderer:

```text
// ⚠️ Shared renderer: affects all showcase pages.
// After editing, verify at minimum:
// 1) Button grid renders correctly.
// 2) Segmented layout intact.
// 3) Textfield/Dropdown toggles.
// 4) Textrename view/edit toggle.
```

### 2.6 QA Checklist (Admin)

After modifying shared code or CSS imports, manually confirm:

1. **Button** page: icon-only/icon-text/text-only grids render and respond on hover/focus.
2. **Segmented** page: all sizes show correct rail, icons, and active states.
3. **Textfield** page: basic and composed variants display correctly.
4. **Dropdown** page: trigger toggles surface open/closed; icon rotates.
5. **Expander** page: disclosure opens/closes, chevron rotates.
6. **Toggle** page: knob animates, track color updates.
7. **Tabs** page: underline tracks active radio.
8. **Textrename** page: view/edit toggle works and focus is managed.
9. **Typography/Colors** pages: tokens render without layout issues.

### 2.7 Best Practices for Contributors (Human or AI)

- Keep component wiring local to the fragment—do **not** add admin-specific logic to shared CSS or app code.
- When adding new demos, follow the button page pattern: spec/preview area + component preview + optional CSS/UX blocks.
- Use inline scripts guarded by `data-demo` attributes for interaction (e.g., dropdown click handler). These scripts must not ship externally.
- Always verify markup against `dietercomponents.md`; the admin harness does not supersede the component contract.

### 2.8 Keeping Admin in Sync

Whenever components change:

1. Update the canonical CSS in `dieter/components/`.
2. Update the integration guide (`dietercomponents.md`).
3. Update the admin fragment and run `pnpm --filter @ck/dieteradmin dev`.
4. Confirm the QA checklist before committing.

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

This document now supersedes older Dieter write-ups. `dietercomponents.md` remains the detailed per-component contract file; refer to both together when integrating or modifying Dieter components.
