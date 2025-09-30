# Dieter

Clickeen's design system workspace. Source tokens, component CSS contracts, and icon SVGs live here and build into `dist/` via `pnpm --filter @ck/dieter build`.

- `tokens/` → canonical design tokens
- `components/` → Phase‑1 CSS contracts (Button, Segmented preview)
- `icons/` → curated SVG set (normalized to `fill="currentColor"`)
- `dist/` → generated output; copied into `bob/public/dieter`

Run `pnpm --filter @ck/dieter build` after editing tokens/components to regenerate assets, then `pnpm verify:dieter-button` to confirm the button contract hash matches expectations.

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
