# Dieter

Clickeen's design system workspace. Source tokens, component CSS contracts, and icon SVGs live here and build into `dist/` via `pnpm --filter @ck/dieter build`.

- `tokens/` → canonical design tokens
- `components/` → Phase‑1 CSS contracts (Button, Segmented)
- `icons/` → curated SVG set (normalized to `fill="currentColor"`)
- `dist/` → generated output; copied into `bob/public/dieter` automatically by the build script

Run `pnpm --filter @ck/dieter build` after editing tokens/components to regenerate assets. The build also copies `dist/` into `bob/public/dieter/`. Then run `pnpm verify:dieter-button` to confirm the button contract hash matches expectations.

> Do not hand-edit files under `bob/public/dieter/`. Treat drift as a build bug; rebuild/copy instead.

## GA Components (Phase‑1)

Only the following CSS contracts are GA in Phase‑1. Other CSS present in `dist/components/` may be experimental and must not be consumed in production until promoted in the PRD.

- Button (`dist/components/button.css`)
  - Sizes: `xs | sm | md | lg | xl` via `data-size` or class (`.diet-btn--xs` … `--xl`)
  - Types: icon-only (attribute `data-type="icon-only"` or class `.diet-btn--icon-only`), icon + text (`.diet-btn--icon-text`), text-only (`.diet-btn--text-only`)
  - Variants: `primary | secondary | neutral | line1 | line2` (`data-variant` or `.diet-btn--*`)
  - Aliases: `data-tone="ghost"` (neutral), `data-tone="control"` (lined style)
  - Hooks: `.diet-btn__icon`, `.diet-btn__label`
  - A11y: focus ring via tokens; compose to meet `--min-touch-target` (44px) on touch surfaces; `data-state="loading"` shows spinner

- Segmented Control (`dist/components/segmented.css`)
  - Sizes: `sm | md | lg` (`data-size`)
  - Types: `icon-only | text-only` (`data-type`)
  - Hooks: `.diet-segmented` root; `.diet-segment` item; `.diet-segment__input` (native radio), `.diet-segment__icon`, `.diet-segment__label`, `.diet-segment__surface`
  - A11y: native radio semantics, focus ring via tokens, reduced‑motion aware

Note: `dist/components/input.css` exists but is not GA. Do not consume it in production until the PRD marks it ✅.

## Theming & Tokens

- Light/Dark: tokens include light defaults and dark overrides via `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`. High‑contrast via `:root[data-theme="hc"]`.
- Always style components via tokens: colors (`--color-bg/surface/text/system-*`), spacing (`--space-*`), sizes/radii (`--control-*`). Derive hovers/actives via `color-mix`.

## Icons

- Sources: `icons/svg/` normalized to `fill="currentColor"`. Curated list in `icons/icons.json`.
- Build emits `dist/icons/svg/*` plus a tiny registry (`dist/icons.js`, `icons.d.ts`).
- Embeds (Venice) must inline SVG strings; app surfaces may reference copied assets under `/dieter/icons/svg/*.svg`.

## Preview & Testing (Dieter Admin)

- Dev server: `pnpm --filter @ck/dieteradmin dev` (Vite). It imports `@dieter/dist/tokens.css`, `@dieter/dist/components/*.css` and renders showcase HTML.
- Use it to visually verify Button/Segmented matrices, colors, and typography after rebuilding Dieter.

## Verification

- Check contract drift: `pnpm verify:dieter-button` (compares `dist/components/button.css` hash with `dieter/.button-css.sha256`).

## Typography

Dieter provides global semantic text styles automatically applied to HTML elements and utility classes:

### Global Elements
- `body` → 400 weight, 16px, normal line-height
- `h1-h6` → Scaled from 32px (h1) to 14px (h6), weighted 700-500
- `p` → 400 weight, 16px, normal line-height

### Semantic Utility Classes
- **Headings**: `.heading-1` through `.heading-6` (mirror `h1-h6`)
- **Body**: `.body`, `.body-small` (14px), `.body-large` (18px)
- **Labels**: `.label` (12px, 600 weight), `.label-small` (10px, uppercase)
- **Captions**: `.caption` (11px, muted), `.caption-small` (10px, muted)
- **Overlines**: `.overline` (12px, uppercase, tracked), `.overline-small` (10px)

### Numeric Utilities
Legacy size-based classes remain available: `.text-10` through `.text-32`, `.text-title-fluid`

All styles use `--font-ui` stack and Dieter tokens (`--fs-*`, `--lh-*`, `--color-text`).

## Fonts

Dieter provides **Inter Tight** as the default font, but fonts are fully customizable:

### Using the Default Font (Inter Tight)

Import `fonts.css` to load Inter Tight from Google Fonts:

```html
<link rel="stylesheet" href="dieter/fonts.css">
<link rel="stylesheet" href="dieter/tokens/tokens.css">
```

### Using a Custom Font

**Skip `fonts.css`** and override the `--font-ui` variable:

```html
<!-- Load your brand font -->
<link href="https://fonts.google.com/css?family=Roboto" rel="stylesheet">

<!-- Load Dieter tokens only -->
<link rel="stylesheet" href="dieter/tokens/tokens.css">

<style>
  :root {
    --font-ui: "Roboto", sans-serif;
  }
</style>
```

All Dieter components will automatically use your custom font. No component modifications needed.
