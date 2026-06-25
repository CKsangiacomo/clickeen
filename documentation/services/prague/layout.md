# Prague Layout System

STATUS: CURRENT SYSTEM OPERATOR SPEC

Prague uses a small CSS primitive set for marketing pages. The primitives live in Prague because Prague owns the public marketing presentation layer.

## Source Files

| Concern | File |
| --- | --- |
| Layout primitives | `prague/public/styles/layout.css` |
| UI primitives | `prague/public/styles/primitives.css` |
| Element styles | `prague/public/styles/elements.css` |
| Base app styles | `prague/public/styles/base.css` |
| Global app loader | `prague/src/layouts/Base.astro` |
| Section components | `prague/src/blocks/**` |

`Base.astro` loads `elements.css`, `layout.css`, `primitives.css`, and
`base.css` for current Prague pages.

## Layout Primitives

| Class | Purpose |
| --- | --- |
| `ck-canvas` | Full-width section surface. Owns background and vertical rhythm. |
| `ck-inline` | Width-constrained inner wrapper and gutters. |
| `ck-stack` | Vertical flex layout. |
| `ck-row` | Horizontal flex layout with wrapping. |
| `ck-split` | Two-column composition that stacks on mobile. |
| `ck-heroCanvas` | Hero canvas surface used by Prague hero composition. |

## UI Primitives

| Class | Purpose |
| --- | --- |
| `ck-btn` | Button styles with `primary`, `secondary`, `secondaryCta`, `glass`, and `ghost` variants. |
| `ck-badge` | Small badge or pill. |
| `ck-card` | Repeated item card. |
| `ck-media` | Screenshot, video, or visual frame. |

Typography uses Dieter utility classes already available to Prague, such as `heading-*`, `body-*`, `label-*`, and `overline`.

## Rules

- `ck-canvas` and `ck-inline` do not set `overflow`, `position`, or default child centering.
- Scroll behavior belongs inside the block that needs it.
- Backgrounds belong to `ck-canvas`.
- Width constraints belong to `ck-inline`.
- Blocks compose primitives; they do not invent parallel layout systems.
- Blocks do not add new breakpoints unless the runtime task explicitly changes Prague layout primitives.

## Verification

Run:

```bash
pnpm --filter @clickeen/prague typecheck
pnpm --filter @clickeen/prague build
```

Use browser evidence on:

```text
https://prague.dev.clickeen.com/us/en/
https://prague.dev.clickeen.com/us/en/widgets/countdown/
```
