# Dieter

Dieter is Clickeen’s shared design system: a token-first, CSS-only library that powers Bob, Venice, and any future surfaces. This document explains how Dieter is structured, how to integrate it safely, and how the Dieter Admin preview harness fits into the workflow.

- **Component contracts:** `dietercomponents.md` (live reference for each primitive).
- **This readme:** global tokens, typography, colors, icons, and the Dieter Admin harness.

## 1. Dieter Core

### 1.1 Repository Layout

| Path | Description |
| --- | --- |
| `tokens/` | Canonical design tokens (`@dieter/tokens/tokens.css`). Includes color, spacing, typography, focus, and motion tokens. |
| `components/` | CSS contracts compiled into the Dieter package (`@ck/dieter`). Each file (e.g., `button.css`) contains the complete stylesheet for one primitive. |
| `icons/` | Normalised SVG source (`fill="currentColor"`) plus the generated `icons/icons.json` registry. |
| `dietercomponents.md` | Integration playbook for every component (markup, behaviors, QA). |
| `dieteradmin/` | Preview harness for browsing components (documented in Section 2). |
| `dist/` | Generated artifacts when packaging the system (ignore during development). |

### 1.2 Using Dieter in an App

1. Install `@ck/dieter` (or link the package during mono-repo development).
2. Load tokens (and fonts if needed):
   ```html
   <link rel="stylesheet" href="/dieter/tokens/tokens.css">
   <link rel="stylesheet" href="/dieter/fonts.css"> <!-- optional; see typography -->
   ```
3. Import the component stylesheet you need:
   ```html
   <link rel="stylesheet" href="/dieter/components/button.css">
   ```
4. Copy the markup from `dietercomponents.md`, wire it with your application logic, and follow the QA checklist.

Because Dieter ships CSS-only, there is no JavaScript bundle. Host applications own interactions (e.g., toggling `data-state`).

### 1.3 Token System

All Dieter components are driven by CSS custom properties defined in `tokens/tokens.css`. Key token families:

#### Spacing & Sizing

| Token Prefix | Description | Examples |
| --- | --- | --- |
| `--space-*` | Horizontal spacing scale (padding/margin, increments ≈4px). | `--space-1`, `--space-4` |
| `--hspace-*` | Vertical spacing (smaller increments for lines). | `--hspace-2`, `--hspace-4` |
| `--control-size-*` | Control heights for components (`xs`→ `xl`). | Buttons, toggles, textfields |
| `--control-padding-inline` | Inline padding for controls (maps to `--space-*`). | Button/textfield interior padding |
| `--control-inline-gap-*` | Gaps between icon/text in controls. | Button icon gap |
| `--radius-*` / `--control-radius-*` | Border radii for surfaces and controls. | `--radius-4`, `--control-radius-md` |

#### Typography

| Token | Usage |
| --- | --- |
| `--font-ui` | Default UI font stack (Inter Tight by default). Override globally to change the interface font. |
| `--control-text-xs|sm|md|lg|xl` | Typography for controls aligned with control sizes. |
| `--body-text`, `--heading-*`, etc. | Semantic typography tokens applied via utility classes. |

See [Typography](#135-typography) for classes and examples.

#### Color & Theme

Colors are theme-aware via two mechanisms:

1. **Prefers color scheme:** tokens override within `@media (prefers-color-scheme: dark)`.
2. **Explicit theme attribute:** `:root[data-theme="dark"]` (or `light`, `hc` for high contrast) toggles theme variants.

| Token Prefix | Purpose |
| --- | --- |
| `--color-text`, `--color-bg` | Core foreground/background colors. |
| `--color-system-*` | Accent colors (blue, green, red, etc.) used in variants. |
| `--role-surface-*` | Neutral surfaces (panels, cards). |
| `--role-border` | Default border color; combined with `color-mix` for subtle borders. |
| `--focus-ring-*` | Focus ring color, width, offset. |

Components rely on these tokens rather than hardcoded values. When customizing, prefer token overrides to manual CSS edits.

#### Motion & Timing

| Token | Description |
| --- | --- |
| `--duration-base` | Default transition duration (≈160ms). |
| `--duration-slow/fast` | Slow/fast variants. |
| `--easing-standard` | Default easing curve. |

Components respect `@media (prefers-reduced-motion: reduce)` and disable transitions accordingly.

### 1.4 Typography

Dieter ships semantic typography utilities and element defaults.

#### Loading Fonts

- Default font (Inter Tight):
  ```html
  <link rel="stylesheet" href="/dieter/fonts.css">
  <link rel="stylesheet" href="/dieter/tokens/tokens.css">
  ```
- Custom font: skip `fonts.css` and override `--font-ui` after loading tokens.

#### Global Element Defaults

- `body`: 16px, weight 400.
- `h1`…`h6`: scaled from 32px to 14px, weights 700→500.
- `p`: matches body text.

#### Utility Classes

| Class | Style |
| --- | --- |
| `.heading-1`…`.heading-6` | Mirror semantic headings. |
| `.body`, `.body-small`, `.body-large` | Body text variants. |
| `.label`, `.label-small` | Label/overline styles. |
| `.caption`, `.caption-small` | Caption styles. |
| `.overline`, `.overline-small` | Uppercase overlines. |

Numeric utilities (`.text-10`…`.text-32`) remain for legacy layouts.

### 1.5 Colors

#### Light & Dark Themes

Tokens switch automatically when:

- The OS reports dark mode (`prefers-color-scheme: dark`), or
- The page sets `data-theme="dark"` on the root element.

High contrast mode uses `data-theme="hc"` or the matching media query.

#### Color Families

| Token Family | Description |
| --- | --- |
| `--color-system-blue/green/red/…` | Accent palette; used for primary buttons, success/error, etc. |
| `--color-text`, `--color-text-muted` | Base text colors with transparent mixing for muted states. |
| `--role-surface-bg`, `--role-surface-elevated` | Default surfaces. |
| `--role-border` | Neutral border color; combine with `color-mix` for subtle strokes. |

Light levels (e.g., `.1`…`.5`) represent transparency mix ratios—e.g., `color-mix(in oklab, var(--color-text), transparent 70%)` yields a lighter tint. The component CSS already encodes these mixes; override tokens instead of rewriting the mix logic.

#### Deriving States

Hover/active states typically use `color-mix` between the base color and transparent black/white. Example from Button:
```css
--btn-hover-bg: color-mix(in oklab, var(--btn-bg), var(--btn-color) 6%);
--btn-clicked-bg: color-mix(in oklab, var(--btn-bg), var(--btn-color) 14%);
```

### 1.6 Icons

- Source SVG files live in `icons/svg/` and are normalised to `fill="currentColor"`.
- The build step produces `icons/icons.json`, a dictionary consumed by apps (e.g., Bob’s icon helper).
- Components expect inline SVG: copy the icon markup into `.diet-btn__icon`, `.diet-segment__icon`, etc.
- When bundling for frameworks, reference the json registry or copy assets into the app’s static folder.

### 1.7 Component Contracts

Detailed per-component guidance lives in `dietercomponents.md`:

| Component | Notes |
| --- | --- |
| Button | Types, variants, tokens, QA. |
| Segmented | Radio-based segmented control. |
| Textfield | Core input plus composed variants. |
| Dropdown | Trigger + floating surface pattern. |
| Expander | Checkbox-driven disclosure. |
| Toggle | Checkbox-based switch. |
| Tabs | Radio-based tablist with baseline indicator. |
| Textrename | Inline rename control. |

Always consult that file for markup and behavior details.

### 1.8 Build & Distribution

- `pnpm --filter @ck/dieter build` compiles `dist/` for publishing.
- `pnpm --filter @ck/dieter lint` ensures CSS/typings are valid.
- `pnpm deploy` (if configured) pushes the package to the registry.

When editing tokens or components:

1. Update CSS in `components/` or `tokens/`.
2. Update `dietercomponents.md` with new guidance.
3. Update Dieter Admin showcase HTML.
4. Run `pnpm --filter @ck/dieteradmin dev` to visually verify.

## 2. Dieter Admin

Dieter Admin is the internal preview harness used to review and QA components. It is **not** a production surface and ships no bundle—its only role is documentation and manual testing.

### 2.1 What It Is / Is Not

| Is | Is Not |
| --- | --- |
| Static Vite app that imports Dieter source CSS directly. | A canonical data source; it mirrors components but doesn’t own contracts. |
| Documentation + QA tool for engineers and designers. | A production component library (no shipping JS). |
| A safe place to add interaction demos for review. | A replacement for application-specific behavior (Bob/Venice still own their JS). |

### 2.2 Structure

- Entry point: `dieter/dieteradmin/src/main.ts` bootstraps the shell and router.
- HTML fragments: `src/html/dieter-showcase/*.html` provide component previews.
- CSS: `src/css/*` styles the admin shell (not shipped to consumers).
- Nav configuration: `src/data/nav.config.ts` groups pages.

### 2.3 Running & Building

- `pnpm --filter @ck/dieteradmin dev` launches the preview at `http://localhost:5173`.
- `pnpm --filter @ck/dieteradmin build` produces a static site for sharing (optional).

### 2.4 Authoring Pages

1. Add an HTML fragment under `src/html/dieter-showcase/` matching the component name.
2. Reference the fragment in `src/data/routes.ts` (slug + CSS imports).
3. Update `nav.config.ts` to expose the page in the sidebar.
4. Use `data-demo="..."` attributes and inline `<script>` (if necessary) for admin-only interactions.

**Important:** Keep component wiring local to the fragment. Production apps must not rely on admin scripts.

### 2.5 Shared Renderer Guidance

`main.ts` renders every showcase page. Changes to the shared layout affect all components. Before editing:

```text
// ⚠️ Shared renderer: affects all showcase pages.
// After editing, verify at minimum:
// 1) Button grid renders correctly.
// 2) Segmented layout intact.
// 3) Textfield/Dropdown toggles.
// 4) Textrename view/edit toggle.
```

### 2.6 QA Checklist (Admin)

After changing core renderer or CSS imports, run through:

1. **Critical:** Button, Segmented, Textrename pages load without layout breaks.
2. Dropdown trigger opens/closes.
3. Toggle animates knob and color.
4. Tabs underline tracks active tab.
5. Expander disclosure works.
6. Typography and color pages render tokens.

### 2.7 Keeping Admin in Sync

- Whenever a component contract changes, update both the CSS and the showcase fragment.
- Regenerate assets if icons/tokens change (`pnpm --filter @ck/dieter build`).
- Update `dietercomponents.md` so integrators have the latest contract.

---

This README keeps Dieter’s global rules and tooling in one place. For per-component integration details, always defer to `dietercomponents.md`.

