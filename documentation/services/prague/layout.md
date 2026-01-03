# Prague Layout System (Core)

Prague is the marketing + SEO surface. Its layout system must be **stable**, **simple**, and **reusable** across the 100⁵ page surface.

## Decisions (non-negotiable)

- **Flex-first**: use flexbox primitives for layout and composition; avoid “grid systems”.
- **One breakpoint**: only `desktop` vs `mobile` (single media query).
- **Wide container**: modern screens justify a larger max width.
  - Current container max: `1560px`

## Primitives

Prague uses a tiny set of CSS utilities (no framework):
- `ck-canvas` — full-bleed block surface (the “stage” analogue)
- `ck-inline` — optional inline wrapper (max width + gutters; the “pod” analogue)
- `ck-stack` — vertical layout (`flex-direction: column`)
- `ck-row` — horizontal layout (`flex-wrap: wrap`)
- `ck-split` — two-column hero split (stacks on mobile)

Source: `prague/public/styles/layout.css`

## The “don’t die” contract (wrapper jail prevention)

`ck-canvas` / `ck-inline` MUST NOT:
- set `overflow` (no accidental clipping)
- set `position` (no stacking context surprises)
- center children by default (`justify-content/align-items`)

Blocks own behavior:
- Scroll containers live inside the block (e.g. carousels use `overflow-x: auto` on the carousel element).
- Backgrounds belong to `ck-canvas`; width constraints belong to `ck-inline`.

## Rule for blocks

Blocks may add local styling, but **must not invent breakpoints** or ad-hoc page spacing.
They compose the primitives above and rely on Dieter foundation tokens for spacing/typography/colors.
