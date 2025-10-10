# Dieter PRD (v1, Frozen)

**Status:** ✅ Frozen (current release)  
**Owner:** `dieter/` workspace package  
**Last updated:** 2025‑09‑24

---

## AIs Quick Scan

**Purpose:** Design system (tokens + CSS contracts) shared across all Clickeen surfaces.  
**Owner:** Workspace package `@ck/dieter` + Vercel project `c-keen-app`.  
**Dependencies:** None at runtime; consumed by every surface that renders Clickeen UI (builder, embeds, admin tools, marketing, etc.).  
**Published assets:** `@ck/dieter` package, `dieter/dist/**`, `/dieter/*` copied assets.  
**Common mistakes:** Importing Dieter React components in Venice, fetching SVG icons at runtime, hand-editing `/bob/public/dieter/`.

---

## Purpose
- Dieter is Clickeen’s design system: design tokens, global foundations, and CSS component contracts shared across every surface that renders our UI.
- Ships as the workspace package **`@ck/dieter`** plus copy-on-build assets served from `/dieter/*`.
- Single visual source of truth for builder flows, embeds, admin tooling, and any future surfaces. Consumers (Bob, Venice, marketing, internal tools) all style via these tokens; no React runtime ships with the package.

## Scope
- Global foundations (tokens, typography baseline, focus ring, spacing utilities) exported via `@ck/dieter/dist/tokens.css`.
- Component contracts live in `dieter/components/**` and build to `dieter/dist/components/**` (e.g., `button.css`, `segmented.css`).
- Inline SVG icon set under `dieter/icons/svg/` for manual embedding.
- Additional components may be added or removed at the design owner’s discretion. This document does not track statuses; components either live in `dieter/` (kept) or are deleted.

## Consumers & Split
| Surface | Usage |
| --- | --- |
| Bob shell (`bob/`) | imports Dieter tokens + CSS bundles for UI chrome |
| Bob editor / MiniBob | apply Dieter classes/tokens inside the builder (HTML + CSS) |
| Internal Dieter manager / other tools | consume the same CSS bundles for component previews |
| Venice embeds / published widgets | use Dieter CSS tokens/foundations + inline SVGs; never import Dieter React |

## Distribution & Build
- `pnpm --filter @ck/dieter build` → builds `dieter/dist/**` and copies assets into `bob/public/dieter/` automatically
- Manual copy helper (when needed): `scripts/copy-dieter-assets.js`
- Keep `bob/public/dieter/` in `.gitignore`
- Developers must not hand-edit `/bob/public/dieter/**`
- No automated CI enforcement (manual verification required)
- Bundle responsibilities:
  - `dist/tokens.css` → tokens + foundational utilities only (no component scaffolding).
  - `dist/components/*.css` → per-component contracts (currently `button.css`, `segmented.css`).
  - `dist/icons` → optimized SVG assets for manual inlining.

- Always consume the latest published `@ck/dieter` build plus copied `/dieter` assets; never hand-edit files under `bob/public/dieter/`.
- The package ships CSS only. Bob applies Dieter classes/tokens to plain HTML; React wrappers are not available.
- Venice consumes the generated CSS/tokens and inlines SVG icons; no runtime React or remote icon fetches.
- Do not add telemetry/logging to Dieter assets; observability stays in app/site surfaces only.
- Re-run `pnpm --filter @ck/dieter build && node scripts/copy-dieter-assets.js` whenever tokens/components change; treat drift as a build bug.

## Icon Delivery Plan
- SVG sources live in `dieter/icons/svg/`; each SVG is normalized to `fill="currentColor"` and optimized.
- The curated icon list is `dieter/icons/icons.json`; the build emits `dieter/dist/icons/svg/*` plus a lightweight registry (`dieter/dist/icons.js`, `dieter/dist/icons.d.ts`) for app surfaces.
- Venice widgets inline the normalized SVG markup at SSR time; runtime fetches are forbidden.

**Icon delivery clarifier (NORMATIVE)**
- Bob may inline SVGs or create local wrappers, but must not publish new icon bundles without updating the manifest.
- Venice renders Dieter icons as inline, normalized SVG snippets embedded in SSR HTML; no runtime fetch, no React.
- Production builds must not lazy-load or dynamically fetch SVG assets; shipping inline keeps embeds within the loader budget.

## Assets & Imports
- Tokens & utilities: `import '@ck/dieter/dist/tokens.css';`
- Button contract: `import '@ck/dieter/dist/components/button.css';`
- Segmented Control contract: `import '@ck/dieter/dist/components/segmented.css';`
- Textfield contract: `import '@ck/dieter/dist/components/textfield.css';`
- Icons: inline SVGs from the built paths (e.g., `dieter/dist/icons/svg/*.svg`, copied to `/dieter/icons/svg/*.svg`)

> Dieter does **not** ship React components or runtime JS helpers. Apply the CSS classes/tokens to plain HTML using attributes only.

## Global Spacing & Icons (NORMATIVE)

This section specifies the global spacing and icon rules every component must follow. The goal is one mental model and zero per‑component guesswork.

### Spacing Token Families (NORMATIVE)

- `--space-*` — horizontal padding/margins on the global 4 px grid. Every control’s left/right padding MUST come from this ladder (`--space-1`, `--space-2`, etc.). No other token family may be used for inline padding.
- `--hspace-*` — vertical rhythm tokens (0 → 0.8 rem in 0.1 rem steps). Use only for vertical spacing inside a control (label ↔ input, helper text, stacked content). Never repurpose them for horizontal padding.
- `--control-inline-gap-*` — icon ↔ text gap tokens. Apply them via `gap:` in icon-bearing layouts. Do not use them for padding.

- Icon box sizes (global, per size)
  - `--control-icon-xs|sm|md|lg|xl` size the icon container; defined in tokens.

- Icon–label spacing (global rule)
  - The space between an icon and label is derived the SAME way everywhere.
  - Use the global inline gap tokens by size and apply as the component’s CSS `gap:`:
    - `--control-inline-gap-xs: 0.125rem`
    - `--control-inline-gap-sm: 0.15rem`
    - `--control-inline-gap-md: 0.165rem`
    - `--control-inline-gap-lg: 0.18rem`
    - `--control-inline-gap-xl: 0.20rem`
  - Text‑only sets `gap: 0`; icon‑only ignores `gap` (no label).

- Icon glyph sizing (SVG inside the icon box)
  - Default ratio token: `--control-icon-glyph-ratio: 0.90` (unitless).
  - Per‑size ratio tokens (when visual tuning is required):
    - `--control-icon-glyph-ratio-xs: 0.97`, `--control-icon-glyph-ratio-sm: 0.95`, `--control-icon-glyph-ratio-md: 0.95`, `--control-icon-glyph-ratio-lg: 0.90`, `--control-icon-glyph-ratio-xl: 0.87`.
  - Compute glyph size in components as: `glyph = calc(iconBox × glyphRatio)`.
  - Icon‑only XS special case: compute against the square height when needed: `glyph = calc(btnHeight × --control-icon-glyph-ratio-xs)`.

## Global Control Specification (NORMATIVE)

All Dieter controls (buttons, segmented, textfield, future peers) must draw from the same size ladder. The table below is authoritative; any change to a token mapping requires updating this table and every control contract.

| Control size | Rail height (`--control-size-*`) | Radius (`--control-radius-*`) | Side padding (text-bearing) | Icon box (`--control-icon-*`) | Icon↔text gap (`--control-inline-gap-*`) | Typography (`--control-text-*`) |
| --- | --- | --- | --- | --- | --- | --- |
| xs | `--control-size-xs` | `--control-radius-xs` | `--space-1` | `--control-icon-xs` | `--control-inline-gap-xs` | `--control-text-xs` |
| sm | `--control-size-sm` | `--control-radius-sm` | `--space-1` | `--control-icon-xs` | `--control-inline-gap-sm` | `--control-text-sm` |
| md | `--control-size-md` | `--control-radius-md` | `--space-2` | `--control-icon-sm` | `--control-inline-gap-md` | `--control-text-md` |
| lg | `--control-size-lg` | `--control-radius-lg` | `--space-2` | `--control-icon-sm` | `--control-inline-gap-lg` | `--control-text-lg` |
| xl | `--control-size-xl` | `--control-radius-xl` | `--space-2` | `--control-icon-sm` | `--control-inline-gap-xl` | `--control-text-xl` |

Additional rules:
- Icon-only variants use a square footprint (`inline-size = block-size = rail height`) with zero inline padding.
- Vertical spacing inside a control (label ↔ helper, stacked content) uses the `--hspace-*` ladder; do not repurpose the horizontal `--space-*` tokens for vertical rhythm.
- Glyph size is derived via the global ratio tokens (`--control-icon-glyph-ratio{-[size]}`) and must be computed (`calc(icon × ratio)`), never hard-coded.
- If a control needs a new size, radius, or spacing value, add the token first, update this table, then touch component CSS.

### System Colors (Tokens Only)
- Dieter exposes a theme‑aware system palette purely as tokens. No helpers/selectors are added; components keep deriving states via `color-mix` on these tokens.
- Hue tokens (light defaults under `:root`; dark values under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`):
  - `--color-system-red|orange|yellow|green|mint|teal|cyan|blue|indigo|purple|pink|brown`
  - Contrast companions: `--color-system-<hue>-contrast`
- Usage (unchanged): override `--color-accent` globally or component custom properties (e.g., `--btn-bg`) in your selectors. Components will continue to compute hover/active via `color-mix`.

### Theme Support (Light / Dark)
- **Source of truth:** `dieter/tokens/tokens.css` defines both light defaults and a `@media (prefers-color-scheme: dark)` override block. Every Dieter utility and component must consume colors via existing custom properties (`--color-bg`, `--color-text`, `--color-border`, `--color-system-*`, etc.). Shading, hover, and pressed states must derive from `color-mix` + those tokens—never hard-coded hex values. Motion and elevation now ship via shared tokens: `--duration-snap`, `--duration-base`, `--duration-spin`, `--shadow-elevated`, `--shadow-floating`, `--shadow-inset-control`.
- **Runtime behaviour:**
  - Browsers auto-switch via `prefers-color-scheme`. The token bundle responds automatically; no extra code is required when the user’s OS changes modes.
  - To force a theme (e.g., Bob preview toggle), set `data-theme="dark"` or `data-theme="light"` on the root element. The token bundle ships attribute-scoped overrides (`:root[data-theme="dark"]`) that mirror the media queries, so Venice/Bob can deterministically pin the palette during previews or SSR.
  - Never duplicate tokens. If a surface needs a manual override (for example, Venice SSR fallback while the parent site is light-only), scope it by applying the attribute on the widget root: `<div data-theme="dark">…`. Do **not** copy the dark tokens or generate bespoke palettes.
- **Implementation rules for AIs:**
  1. **Always** reference the color tokens—`var(--color-bg)`, `var(--color-surface)`, `var(--color-text)`, `var(--color-system-blue)`—when styling new utilities or examples.
  2. When creating helper utilities (container, panel, etc.) ensure every background, border, shadow, or text color pulls from tokens so the theme swap is automatic.
  3. Embeds (Venice) must not inject their own `prefers-color-scheme` overrides; they inherit the token output and optionally pin `data-theme` if the instance configuration or preview experience demands it.
  4. Bob’s preview harness should toggle theme by flipping the attribute on the iframe root and never by importing a second stylesheet.
  5. AIs must not introduce additional theme flags or cascading classes. If a new palette is required, escalate for token additions.

## Global Foundations

**Files**
- `dieter/dist/tokens.css` → exported tokens, focus styles, spacing and typography utilities.
- `dieter/tokens/tokens.css` → source for the build; do not consume directly.

**Token families (examples)**
- Typography: `--font-ui`, `--fs-10 … --fs-32`, `--lh-tight/normal/loose`.
- Spacing: `--space-1 … --space-10` (4px grid) and control sizing tokens `--control-size-*`, `--control-font-*`.
- Vertical rhythm (hspace): `--hspace-1 … --hspace-9` (0.0rem → 0.8rem in 0.1rem steps) — for tight vertical spacing inside components (e.g., label ↔ field ↔ supporting text stacks). Prefer `--hspace-*` for intra‑component vertical gaps; keep `--space-*` for layout gutters/padding.
- Motion: `--duration-snap` (140 ms), `--duration-base` (160 ms), `--duration-spin` (600 ms).
- Elevation: `--shadow-elevated`, `--shadow-floating`, and `--shadow-inset-control` are the only sanctioned shadow tokens; reuse them across components instead of defining ad-hoc box-shadows.
- Admin shell layout tokens: `--sidebar-width` (expanded) and `--sidebar-width-collapsed` (icon rail).
- Colors: `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, plus semantic role tokens `--role-primary-bg`, `--role-danger-text`, etc.
- **Derived color tints & shades (NORMATIVE)**
  - We do not mint separate tokens for the lighter/darker chips shown in `admin/dietercomponents.html`. Instead, derive them from the base token with `color-mix` so a change to the source cascades everywhere.
  - Naming convention (used in docs + code samples): `token.1 … token.5` are light blends, `token.1D … token.5D` are dark blends.
  - Recipes (initial calibration — adjust the percentages here if design shifts):
    - `token.1` → `color-mix(in oklab, var(--token), white 20%)`
    - `token.2` → `color-mix(in oklab, var(--token), white 40%)`
    - `token.3` → `color-mix(in oklab, var(--token), white 60%)`
    - `token.4` → `color-mix(in oklab, var(--token), white 80%)`
    - `token.5` → `color-mix(in oklab, var(--token), white 90%)`
    - `token.1D` → `color-mix(in oklab, var(--token), black 20%)`
    - `token.2D` → `color-mix(in oklab, var(--token), black 40%)`
    - `token.3D` → `color-mix(in oklab, var(--token), black 60%)`
    - `token.4D` → `color-mix(in oklab, var(--token), black 80%)`
    - `token.5D` → `color-mix(in oklab, var(--token), black 90%)`
  - Never hard-code the resulting RGB/hex values. Always reference the base token plus `color-mix` so tweaks to `--color-system-*` or role tokens flow through.
- Accessibility: `--focus-ring-width`, `--focus-ring-color`, `--focus-ring-offset`, `--min-touch-target`.

Global typography defaults to Inter (`--font-ui`) with a 16px body size (`--fs-16`). The token bundle also ships focus-ring defaults and a lightweight reset to harmonise across browsers. Utilities in `tokens.css` (e.g., `.panel-heading`) exist solely for internal previews and must not leak into shipped bundles.

**Usage rules (NORMATIVE)**
- Every component style MUST reference tokens via `var(--token-name)`. Introducing raw hex values or fixed px sizes is forbidden.
- Tokens follow the “role” palette (e.g., `--role-danger-bg`) instead of ad-hoc names like `--color-danger`. Use the role tokens to stay consistent with Button.
- Preview helper selectors (e.g., `.panel-heading`) still live in `tokens.css` for the internal harness; do not ship or depend on them in production. These will be removed in a future cleanup.
- Use `--radius-4` for border radii. Additional radius tokens will be added as needed.
- Vertical rhythm is locked to the 4px scale. Stacks, margins, paddings, and gaps MUST use the published spacing tokens (`--space-1 = 4px`, `--space-2 = 8px`, `--space-3 = 12px`, `--space-4 = 16px`, `--space-6 = 24px`, `--space-8 = 32px`, `--space-10 = 40px`). Arbitrary values (10px, 18px, 26px…) are prohibited.
- Control heights come from the control token family: `--control-size-xs|sm|md|lg|xl` define 16px / 20px / 24px / 28px / 32px rails, and the matching font + radii tokens (`--control-font-*`, `--control-radius-*`, `--control-icon-*`) must be used together to keep visuals aligned. `xs` (16px) is the smallest size, used for icon-only buttons and minimal text-only buttons; any button with both icon and label starts at `sm` (20px) and ladders up. Never invent intermediate heights—escalate if a design needs a new token.
- Control icon ladder (normalized `fill="currentColor"` glyphs) has an explicit mapping: `--control-icon-xxs` (12px), `--control-icon-xs` (16px), `--control-icon-sm` (20px), `--control-icon-md` (24px), `--control-icon-lg` (28px), `--control-icon-xl` (32px). Components reference these tokens directly; do not hard-code icon dimensions.
- Control text ladder mirrors control rails: use `--control-text-xs|sm|md|lg|xl` for 16 / 20 / 24 / 28 / 32px controls respectively. These tokens bundle weight, size, line-height, and font family so buttons, segmented, textfields, dropdowns, etc. stay in sync.
- Honour `--min-touch-target` (44px). When a visual control is shorter (e.g., 24px rail) add transparent padding or outer spacing so the hit area meets the token rather than shrinking the target.

## Test harness checklist (NORMATIVE)
- Build Dieter: `pnpm --filter @ck/dieter build`.
- Copy assets: `node scripts/copy-dieter-assets.js` (or the Turbo task) and confirm `bob/public/dieter/` matches `dieter/dist/`.
- Open `tests/dietercomponents.html` in a local server/iframe harness.
- Verify Button examples render with correct tokens, focus states, and variants. The harness may include work‑in‑progress demos for evaluation; only rely on CSS that ships from the `@ck/dieter` package (do not import Admin‑lab‑only CSS in apps).

## Governance
- Single source: `dieter/` package.
- Copy-on-build only; keep `/bob/public/dieter/` untracked and regenerate assets manually when drift appears.
- SVG normalization scripts enforce consistent assets.
- Versions follow SemVer; breaking changes require explicit CEO approval before shipping.
- Rendering split (React consoles vs. SSR widgets) is authoritative—changes need explicit CEO approval.
- Tokens-only rule: every CSS addition must lean on existing tokens; if a needed token is missing (e.g., additional radius values), raise an issue and obtain approval before shipping.

## Change Process
1. Update Dieter source (tokens/components/icons).
2. Run `pnpm icons:build` (when generator lands) + `pnpm --filter @ck/dieter build`.
3. Copy assets via script; ensure docs and the decision log stay in sync.

---

_No new files were created; only this doc was rewritten._

## Component Reference

Per-component contracts live alongside the CSS source in `dieter/components/*.css`. Each file documents supported attributes, element hooks, and state handling in comments at the top of the file. When a component is promoted to production, make sure the file header and Dieter Admin showcase reflect the current contract. This PRD stays component agnostic—update those source files and the decision log whenever the contract changes.

### Button (`dieter/dist/components/button.css`)

**Selectors & attributes**
- Root: `.diet-btn`
- Element hooks: `.diet-btn__icon`, `.diet-btn__label`
- `data-size="xs|sm|md|lg|xl"`
- `data-type="icon-only|icon-text|text-only"`
- `data-variant="primary|secondary|neutral|line1|line2"`
- States: `:hover`, `:active`, `:focus-visible`, `:disabled`, `[aria-disabled="true"]`, `[aria-pressed="true"]`, `[data-state="loading"]`

**Token mapping (per size)**
- `xs` → rail `--control-size-xs`, side padding `--space-1`, icon box `--control-icon-xs`, gap `--control-inline-gap-xs`, typography `--control-text-xs`
- `sm` → `--control-size-sm`, `--space-1`, `--control-icon-xs`, `--control-inline-gap-xs`, `--control-text-sm`
- `md` → `--control-size-md`, `--space-2`, `--control-icon-sm`, `--control-inline-gap-sm`, `--control-text-md`
- `lg` → `--control-size-lg`, `--space-2`, `--control-icon-sm`, `--control-inline-gap-sm`, `--control-text-lg`
- `xl` → `--control-size-xl`, `--space-2`, `--control-icon-sm`, `--control-inline-gap-md`, `--control-text-xl`
- Icon-only → square rail (`inline/block size = rail height`), padding `0`, icon fills the square. Text-only sets `gap: 0`.
- Glyph size uses `calc(--btn-icon-box × --control-icon-glyph-ratio{-[size]})` with the global ratio tokens.

**Behaviour & accessibility**
- Loading state (`[data-state="loading"]`) dims the label and shows a spinner pseudo-element.
- Focus-visible uses the shared two-layer ring (`--focus-ring-*`).
- Disabled and `aria-disabled` remove pointer affordances but preserve focus handling.
- Icons must come from the Dieter registry (inline SVG or hydrated via `data-icon`).

### Segmented Control (`dieter/dist/components/segmented.css`)

**Selectors & attributes**
- Root radiogroup: `.diet-segmented`
- Segment label: `.diet-segment`
- Hooks: `.diet-segment__input` (radio), `.diet-segment__surface`, `.diet-segment__icon`, `.diet-segment__label`, `.diet-segment__sr`
- `data-size="sm|md|lg"`
- `data-type="icon-only|text-only"` (omit for icon+text)
- Consumers must apply `role="radiogroup"` and native radio semantics.

**Token mapping**
- `sm` → rail `--control-size-sm`, surface padding `--space-1`, icon box `--control-icon-xxs`, icon/text gap `--control-inline-gap-xs`, typography `--control-text-sm`
- `md` → `--control-size-md`, `--space-2`, `--control-icon-xxs`, `--control-inline-gap-sm`, typography `--control-text-md`
- `lg` → `--control-size-lg`, `--space-2`, `--control-icon-xs`, `--control-inline-gap-sm`, typography `--control-text-lg`
- Icon-only segments drop `padding-inline` to `0` and rely on the square rail; `.diet-segment__sr` supplies screen-reader text when no label is present.
- The rail padding (`--seg-rail-padding`) insets the surface so the focus ring and hover states render correctly.

**Behaviour & accessibility**
- Checked state follows native radio (`.diet-segment__input:checked`).
- Focus-visible reuses the global focus ring, and `prefers-reduced-motion` removes transitions.
- Disabled segments reduce opacity and cursor affordance.
- Icons must be the curated Dieter SVGs; do not fetch at runtime.

### Textfield (`dieter/dist/components/textfield.css`)

**Selectors & attributes**
- Root: `.diet-input`
- Hooks: `.diet-input__label`, `.diet-input__field`, optional `.diet-input__helper`, optional wrappers `.diet-input__inner` / `.diet-input__control`, optional `.diet-input__icon`
- `data-size="md|lg|xl"`
- States: `:focus-visible`, `:disabled`, `[aria-disabled="true"]`

**Token mapping**
- Side padding (all sizes, field + wrapper) → `--space-2`
- Vertical stack gap → root uses `--hspace-2`; helper margin uses `--hspace-4`
- Icon/text gap inside composed wrapper → `--control-inline-gap-md`
- Icon boxes: `md` → `--control-icon-xxs`, `lg` → `--control-icon-xs`, `xl` → `--control-icon-xs`
- Rail heights/typography follow the global ladder (`--control-size-*`, `--control-text-*`)
- Composed wrapper preserves border radius/border tokens and keeps the input flexible (`flex: 1 1 0`).

**Behaviour & accessibility**
- Labels and fields must be linked via `for`/`id`; helpers can be referenced with `aria-describedby`.
- Focus-visible uses the shared ring; disabled state applies opacity/tint via tokens.
- Icons are inline Dieter SVGs (via `data-icon` hydration or copied markup). Trailing action buttons share the same icon hook.

## Common AI mistakes (NORMATIVE)

❌ **Wrong:** Importing Dieter React components in Venice renderers.
```ts
import { Button } from '@ck/dieter/components'; // WRONG — React never ships to embeds
```
✅ **Right:** Render SSR HTML with Dieter classes/tokens only.
```ts
const html = `<button class="diet-btn" data-variant="primary">${label}</button>`;
```

❌ **Wrong:** Fetching SVG icons at runtime in embeds.
```ts
await fetch('/dieter/icons/checkmark.svg');
```
✅ **Right:** Inline the normalized SVG string emitted at build time.
```ts
const icon = icons.checkmark; // string literal of <svg>
```

❌ **Wrong:** Editing copied assets under `bob/public/dieter/` manually.
✅ **Right:** Regenerate via `pnpm --filter @ck/dieter build` + `node scripts/copy-dieter-assets.js`.

❌ **Wrong:** Styling components with hard-coded hex values or px instead of tokens.
```css
.my-btn { background:#0a84ff; border-radius:8px; }
```
✅ **Right:** Reference Dieter tokens so theming stays consistent.
```css
.my-btn { background:var(--color-accent); border-radius:var(--radius-4,0.5rem); }
```

❌ **Wrong:** Assuming additional component CSS contracts exist when they are not listed here.
✅ **Right:** Use only the components explicitly documented above; treat this doc as the sole source for what is production-ready.
