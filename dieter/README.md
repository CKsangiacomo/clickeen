# Dieter

Design tokens, component CSS contracts, and icon SVGs live here. Edit only the source directories:

- `tokens/` → canonical token definitions (import `@dieter/tokens/tokens.css`)
- `components/` → CSS contracts with matching HTML snippets (Button, Segmented, Textfield)
- `icons/` → normalized SVG set (`fill="currentColor"`)
- Control typography: use `--control-text-xs|sm|md|lg|xl` for text inside any control-sized component (buttons, segmented, textfields, dropdowns). Tokens map to the Dieter UI font with the correct size/weight per rail.

`dist/` is generated when we package the system; ignore it while iterating.

## Components

Current CSS contracts exported from `@ck/dieter`:

- Button (`components/button.css`)
  - Sizes: `xs | sm | md | lg | xl` (`data-size`)
  - Types: `icon-only | icon-text | text-only` (`data-type`)
  - Variants: `primary | secondary | neutral | line1 | line2` (`data-variant`)
  - Hooks: `.diet-btn__icon`, `.diet-btn__label`
  - A11y: tokenized focus ring; `data-state="loading"` spinner

- Segmented Control (`components/segmented.css`)
  - Sizes: `sm | md | lg` (`data-size`)
  - Types: `icon-only | text-only` (`data-type`)
  - Hooks: `.diet-segmented`, `.diet-segment`, `.diet-segment__input`, `.diet-segment__icon`, `.diet-segment__label`, `.diet-segment__surface`
  - A11y: native radio semantics; reduced‑motion aware

- Textfield (`components/textfield.css`)
  - Sizes: `md | lg | xl` (`data-size`)
  - Structure: `.diet-input` with `.diet-input__label`, `.diet-input__field`, optional `.diet-input__helper`; composed variant uses `.diet-input__control`



## Theming & Tokens

- Light/Dark: tokens include light defaults and dark overrides via `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`. High‑contrast via `:root[data-theme="hc"]`.
- Always style components via tokens: colors (`--color-bg/surface/text/system-*`), spacing (`--space-*`), sizes/radii (`--control-*`). Derive hovers/actives via `color-mix`.

## Icons

- Sources: `icons/svg/` normalized to `fill="currentColor"`. Curated list in `icons/icons.json`.
- Embeds (Venice) should inline SVG strings; app surfaces may reference copied assets under `/dieter/icons/svg/*.svg` when the package is built.

## Preview

- `pnpm --filter @ck/dieteradmin dev` launches the Dieter Admin preview shell. It consumes the source tokens/components directly from this package.

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
