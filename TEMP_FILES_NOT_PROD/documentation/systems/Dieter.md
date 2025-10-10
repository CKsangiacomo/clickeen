# Dieter PRD (v1, Frozen)

**Status:** ✅ Frozen for Phase‑1  
**Owner:** `dieter/` workspace package  
**Last updated:** 2025‑09‑24

---

## AIs Quick Scan

**Purpose:** Design system (tokens + CSS contracts) for Studio/Bob.  
**Owner:** Workspace package `@ck/dieter` + Vercel project `c-keen-app`.  
**Dependencies:** None at runtime; consumed by Studio/Bob/Venice.  
**Phase-1 Assets:** `@ck/dieter` package, `dieter/dist/**`, `/dieter/*` copied assets.  
**Key ADRs:** ADR-004, ADR-005, ADR-012.  
**Common mistakes:** Importing Dieter React components in Venice, fetching SVG icons at runtime, hand-editing `/apps/app/public/dieter/`.

---

## Purpose
- Dieter is Clickeen’s design system: design tokens, global foundations, and CSS component contracts shared across Studio and Venice.
- Ships as the workspace package **`@ck/dieter`** plus copy-on-build assets served from `/dieter/*`.
- Single visual source of truth for Studio, Bob, MiniBob, admin consoles. Venice generates widget HTML and styles it using Dieter CSS tokens/foundations (no Dieter React runtime in Venice).

## Scope (Phase‑1)
- **In:**
  - Global foundations (tokens, typography baseline, focus ring, spacing utilities) exported via `@ck/dieter/dist/tokens.css`.
  - **Button** component contract (the only production-ready component) exported via `@ck/dieter/dist/components/button.css`.
  - Inline SVG icon set under `dieter/icons/svg/` for manual embedding.
- **Out / future phases:** Additional controls (Input, Select, Segmented Control, Tabs, etc.), React component wrappers, theming APIs, and foundations beyond those listed above.

## Consumers & Split
| Surface | Usage |
| --- | --- |
| Studio shell (`apps/app`) | imports Dieter tokens + CSS bundles for UI chrome |
| Bob / MiniBob | apply Dieter classes/tokens inside Studio (HTML + CSS only in Phase‑1) |
| Internal Dieter manager | consumes the same CSS bundles for component previews |
| Venice embeds / published widgets | use Dieter CSS tokens/foundations + inline SVGs; never import Dieter React |

## Distribution & Build
- `pnpm --filter @ck/dieter build` → `dieter/dist/**`
- Copy assets manually: `scripts/copy-dieter-assets.js`
- Keep `apps/app/public/dieter/` in `.gitignore`
- Developers must not hand-edit `/apps/app/public/dieter/**`
- No automated CI enforcement in Phase-1
- Bundle responsibilities:
  - `dist/tokens.css` → tokens + foundational utilities only (no component scaffolding).
  - `dist/components/*.css` → per-component contracts (currently `button.css`).
  - `dist/icons` → optimized SVG assets for manual inlining.

**Minimal integration rules (NORMATIVE)**
- Always consume the latest published `@ck/dieter` build plus copied `/dieter` assets; never hand-edit files under `apps/app/public/dieter/`.
- Phase‑1 ships CSS only. Studio/Bob apply Dieter classes/tokens to plain HTML; React wrappers will arrive in a later phase.
- Venice consumes the generated CSS/tokens and inlines SVG icons; no runtime React or remote icon fetches.
- Do not add telemetry/logging to Dieter assets; observability stays in app/site surfaces only.
- Re-run `pnpm --filter @ck/dieter build && node scripts/copy-dieter-assets.js` whenever tokens/components change; treat drift as a build bug.

## Icon Delivery Plan (Phase‑1)
- SVG sources live in `dieter/icons/svg/`; each file is optimized for inline use.
- A manifest (`dieter/icons/manifest.ts`) tracks curated icons, but React wrappers are not released in Phase‑1.
- Venice widgets inline the normalized SVG markup at SSR time; runtime fetches are forbidden.

**Icon delivery clarifier (NORMATIVE)**
- Studio/Bob may inline SVGs or create local wrappers, but must not publish new icon bundles without updating the manifest.
- Venice renders Dieter icons as inline, normalized SVG snippets embedded in SSR HTML; no runtime fetch, no React.
- Production builds must not lazy-load or dynamically fetch SVG assets; shipping inline keeps embeds within the loader budget.

## Phase-1 Assets & Imports
- Tokens & utilities: `import '@ck/dieter/dist/tokens.css';`
- Button contract: `import '@ck/dieter/dist/components/button.css';`
- Icons: inline SVGs from `@ck/dieter/icons/svg/*.svg`

> Phase‑1 does **not** ship React components or runtime JS helpers. Apply the CSS classes/tokens to plain HTML.

## Global Foundations (Phase‑1)

**Files**
- `dieter/dist/tokens.css` → exported tokens, focus styles, spacing and typography utilities.
- `dieter/tokens/tokens.css` → source for the build; do not consume directly.

**Token families (examples)**
- Typography: `--font-ui`, `--fs-10 … --fs-32`, `--lh-tight/normal/loose`.
- Spacing: `--space-1 … --space-10` (4px grid) and control sizing tokens `--control-size-*`, `--control-font-*`.
- Colors: `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`, plus semantic role tokens `--role-primary-bg`, `--role-danger-text`, etc.
- Accessibility: `--focus-ring-width`, `--focus-ring-color`, `--focus-ring-offset`, `--min-touch-target`.

Global typography defaults to Inter (`--font-ui`) with a 16px body size (`--fs-16`). The token bundle also ships focus-ring defaults and a lightweight reset to harmonise across browsers. Utilities in `tokens.css` (e.g., `.panel-heading`) exist solely for internal previews and must not leak into shipped bundles.

**Usage rules (NORMATIVE)**
- Every component style MUST reference tokens via `var(--token-name)`. Introducing raw hex values or fixed px sizes is forbidden.
- Tokens follow the “role” palette (e.g., `--role-danger-bg`) instead of ad-hoc names like `--color-danger`. Use the role tokens to stay consistent with Button.
- Preview helper selectors (e.g., `.panel-heading`) still live in `tokens.css` for the internal harness; do not ship or depend on them in production. These will be removed in a future cleanup.
- Some legacy references (e.g., `--radius-2/3`) are being audited; treat `--radius-4` as the only published radius token until new ones are added.

## Test harness checklist (NORMATIVE)
- Build Dieter: `pnpm --filter @ck/dieter build`.
- Copy assets: `node scripts/copy-dieter-assets.js` (or the Turbo task) and confirm `apps/app/public/dieter/` matches `dieter/dist/`.
- Open `tests/dietercomponents.html` in a local server/iframe harness.
- Verify Button examples render with correct tokens, focus states, and variants. Any additional demos in the harness are experimental and must not ship.

## Governance
- Single source: `dieter/` package.
- Copy-on-build only; keep `/apps/app/public/dieter/` untracked and regenerate assets manually when drift appears.
- SVG normalization scripts enforce consistent assets.
- Versions follow SemVer; breaking changes require ADR update.
- Rendering split (React consoles vs. SSR widgets) is authoritative—changes need an ADR.
- Tokens-only rule: every CSS addition must lean on existing tokens; if a needed token is missing (e.g., additional radius values), file an issue/ADR before shipping.

## Change Process
1. Update Dieter source (tokens/components/icons).
2. Run `pnpm icons:build` (when generator lands) + `pnpm --filter @ck/dieter build`.
3. Copy assets via script; ensure docs/ADRs stay in sync.

---

_No new files were created; only this doc was rewritten._

## Component Contracts (Phase‑1)

Phase‑1 exposes a single production-ready component. Treat it as the template for future contracts.

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

### Future components
- Additional controls (Input, Select, Segmented, etc.) remain under active design. Do not ship contracts or rely on draft CSS until they are marked ✅ in both docs and code.
- Any preview remnants in the test harness (e.g., segmented drafts) are experimental and must not be consumed in production.

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

❌ **Wrong:** Editing copied assets under `apps/app/public/dieter/` manually.
✅ **Right:** Regenerate via `pnpm --filter @ck/dieter build` + `node scripts/copy-dieter-assets.js`.

❌ **Wrong:** Styling components with hard-coded hex values or px instead of tokens.
```css
.my-btn { background:#0a84ff; border-radius:8px; }
```
✅ **Right:** Reference Dieter tokens so theming stays consistent.
```css
.my-btn { background:var(--color-accent); border-radius:var(--radius-4,0.5rem); }
```

❌ **Wrong:** Assuming Phase‑1 ships Input/Select/Tabs CSS contracts.
✅ **Right:** Only Button is production-ready; wait for docs + code to mark other components ✅ before using them.
