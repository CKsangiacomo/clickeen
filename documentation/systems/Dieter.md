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
- **In:**
  - Global foundations (tokens, typography baseline, focus ring, spacing utilities) exported via `@ck/dieter/dist/tokens.css`.
  - **Button** component contract exported via `@ck/dieter/dist/components/button.css`.
  - **Segmented Control** component contract exported via `@ck/dieter/dist/components/segmented.css`.
  - Inline SVG icon set under `dieter/icons/svg/` for manual embedding.
- **Not shipped yet:** Additional controls (Input, Select, Tabs, etc.), React component wrappers, theming APIs, and foundations beyond those listed above. Do not build or assume them until this doc lists them.

## Consumers & Split
| Surface | Usage |
| --- | --- |
| Bob shell (`bob/`) | imports Dieter tokens + CSS bundles for UI chrome |
| Bob editor / MiniBob | apply Dieter classes/tokens inside the builder (HTML + CSS) |
| Internal Dieter manager / other tools | consume the same CSS bundles for component previews |
| Venice embeds / published widgets | use Dieter CSS tokens/foundations + inline SVGs; never import Dieter React |

## Distribution & Build
- `pnpm --filter @ck/dieter build` → `dieter/dist/**`
- Copy assets manually: `scripts/copy-dieter-assets.js`
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
- SVG sources live in `dieter/icons/svg/`; each file is optimized for inline use.
- A manifest (`dieter/icons/manifest.ts`) tracks curated icons, but React wrappers are not released.
- Venice widgets inline the normalized SVG markup at SSR time; runtime fetches are forbidden.

**Icon delivery clarifier (NORMATIVE)**
- Bob may inline SVGs or create local wrappers, but must not publish new icon bundles without updating the manifest.
- Venice renders Dieter icons as inline, normalized SVG snippets embedded in SSR HTML; no runtime fetch, no React.
- Production builds must not lazy-load or dynamically fetch SVG assets; shipping inline keeps embeds within the loader budget.

## Assets & Imports
- Tokens & utilities: `import '@ck/dieter/dist/tokens.css';`
- Button contract: `import '@ck/dieter/dist/components/button.css';`
- Segmented Control contract: `import '@ck/dieter/dist/components/segmented.css';`
- Icons: inline SVGs from `@ck/dieter/icons/svg/*.svg`

> Dieter does **not** ship React components or runtime JS helpers. Apply the CSS classes/tokens to plain HTML.

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
- Some legacy references (e.g., `--radius-2/3`) are being audited; treat `--radius-4` as the only published radius token until new ones are added.
- Vertical rhythm is locked to the 4px scale. Stacks, margins, paddings, and gaps MUST use the published spacing tokens (`--space-1 = 4px`, `--space-2 = 8px`, `--space-3 = 12px`, `--space-4 = 16px`, `--space-6 = 24px`, `--space-8 = 32px`, `--space-10 = 40px`). Arbitrary values (10px, 18px, 26px…) are prohibited.
- Control heights come from the control token family: `--control-size-xs|sm|md|lg|xl` define 16px / 20px / 24px / 28px / 32px rails, and the matching font + radii tokens (`--control-font-*`, `--control-radius-*`, `--control-icon-*`) must be used together to keep visuals aligned. `xs` is the 16px "icon stub" footprint (also used by the micro text-only button); any footprint that carries both icon and label starts at `sm` (20px) and ladders up. Never invent intermediate heights—escalate if a design needs a new token.
- Honour `--min-touch-target` (44px). When a visual control is shorter (e.g., 24px rail) add transparent padding or outer spacing so the hit area meets the token rather than shrinking the target.

## Test harness checklist (NORMATIVE)
- Build Dieter: `pnpm --filter @ck/dieter build`.
- Copy assets: `node scripts/copy-dieter-assets.js` (or the Turbo task) and confirm `bob/public/dieter/` matches `dieter/dist/`.
- Open `tests/dietercomponents.html` in a local server/iframe harness.
- Verify Button examples render with correct tokens, focus states, and variants. Any additional demos in the harness are experimental and must not ship.

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

## Component Contracts

The components listed here are the only production-ready Dieter contracts. Treat them as canonical until this section is updated.

### Button (`dieter/dist/components/button.css`)

**Class & attribute model**
- Root: `.diet-btn` (inline-flex control)
- Element hooks: `.diet-btn__icon`, `.diet-btn__label`
- Size modifiers: data attribute or class (`data-size="xs|sm|md|lg"`, `.diet-btn--xs`, etc.)
- Footprint modifiers: `data-footprint="icon-only|text-only"`, `.diet-btn--icon-only`
- Variants: `data-variant="primary|secondary|neutral|ghost|danger"`, matching classes `.diet-btn--primary` etc.
- State attributes: `:hover`, `:active`, `:focus-visible`, `:disabled`, `[aria-disabled="true"]`, `[aria-pressed="true"]`, `[data-state="loading"|"active"|"selected"]`

**Token usage**
- Relies exclusively on tokens (e.g., `--color-accent`, control sizing tokens) and derives all colors via `color-mix` + tokens. Introducing raw color values is prohibited.
- Exposes CSS custom properties (`--btn-*`) that cascade from tokens; consumers may override them cautiously to theme variants.

**Accessibility**
- Focus-visible outline uses `--focus-ring-*` tokens with a two-layer box-shadow.
- `--min-touch-target` guides control height; default min height ≥ 44px.
- Loading state (`data-state="loading"`) dims label and can display a spinner overlay (spinner markup not shipped yet; implementers add `<span class="diet-btn__spinner">` if needed).
- Disabled + aria-disabled lower opacity and remove pointer events; maintain keyboard focus handling.

**Testing**
- `tests/dietercomponents.html` renders button examples for regression checks; run locally after rebuilding `@ck/dieter`.

### Segmented Control (`dieter/dist/components/segmented.css`)

**Class & attribute model**
- Root radiogroup container: `.diet-segmented`
- Segment wrapper (label): `.diet-segment`
- Element hooks: `.diet-segment__input` (native radio), `.diet-segment__surface`, `.diet-segment__icon`, `.diet-segment__label`, `.diet-segment__sr`
- Size modifiers: `data-size="sm|md|lg"`
- Footprint modifiers: `data-footprint="icon-only|text-only"`
- State selectors: `.diet-segment__input:checked`, `.diet-segment__input:focus-visible`, `.diet-segment__input:disabled`, `:hover` on `.diet-segment`, plus radiogroup ARIA (`role="radiogroup"`) applied by consumers

**Token usage**
- Component variables (`--seg-*`) derive from shared tokens (`--color-system-blue`, `--color-bg`, `--focus-ring-*`, sizing tokens) and may be overridden downstream when theming is approved.
- No raw hex values outside the token palette; `color-mix` combines token colors to express hover/active states consistent with Button.

**Accessibility**
- Uses native radio inputs for semantics; `.diet-segment__sr` provides screen-reader labels when icons are used without text.
- Focus-visible outline reuses the shared two-layer focus ring (`--focus-ring-*`).
- `prefers-reduced-motion: reduce` turns off transitions, and disabled segments drop their pointer cursor to avoid false affordances.

**Testing**
- `admin/dietercomponents.html` renders segmented examples in multiple sizes/footprints; verify after rebuilding `@ck/dieter`.

### Future components
- Additional controls (Input, Select, Tabs, etc.) remain under active design. Do not ship contracts or rely on draft CSS until they are marked ✅ in both docs and code.
- Any preview remnants in the test harness (e.g., input/select prototypes) are experimental and must not be consumed in production.

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
