# Dieter Admin

This Vite + TypeScript workspace hosts the Dieter preview shell. It renders the foundations and components that live in `dieter/components/**` so we can verify tokens and contracts as we build them. Dieter Admin never defines component CSS; it only assembles preview markup.

## What lives here

- **Shell (`src/main.ts`, `src/router.ts`)** — builds the docs chrome, listens to hash-based routes, and injects HTML fragments into the content area.
- **Preview data (`src/data`)** — lists the available showcases and their navigation metadata.
- **Preview markup (`src/html/dieter-showcase/`)** — single source of truth for showcase HTML. Each page mirrors the Dieter contracts (Typography, Colors, Icons, Button, Segmented, Textfield). Keep these in lockstep with the Dieter PRD.
- **Preview helpers (`src/css/dieter-previews.css` + siblings)** — light layout scaffolding for Dieter Admin only. These styles must never change the appearance of real `.diet-*` classes.

## Working rules

1. **PRD is authoritative.** `documentation/systems/Dieter.md` is the normative contract. Update it when a component is kept in Dieter.
2. **Components only.** Showcases under `src/html/dieter-showcase/` mirror the Dieter contracts. There are no WIP/candidate surfaces in this workspace.
3. **No contract overrides.** Custom CSS/JS in this workspace may position demos, but must never tweak the visuals or behavior of the shipped Dieter selectors. Update `dieter/components/**` first, then refresh the preview markup to match.
4. **Icons come from Dieter.** Use `data-icon="<name>"` on preview nodes; the shell injects SVGs from `@dieter/icons/svg`. Do not paste ad-hoc SVGs.
5. **Keep previews simple.** One HTML file per page. If a contract changes, update the matching showcase file immediately.
6. **Document decisions locally.** Any Dieter Admin specifics belong here (or in scoped notes), not in the frozen PRD.
7. **No ad-lib copy.** Previews must only contain component markup + metadata derived from Dieter tokens/attributes. If additional copy is required, a human must provide it.

## Showcase page architecture

Every page under `src/html/dieter-showcase/` follows a standardized structure for displaying component variations. The pattern uses CSS Grid for responsive layout and BEM naming for dieteradmin-specific classes.

### HTML Structure

```html
<div class="dieter-preview">

  <!-- Optional section header when component has variants -->
  <h3 class="section-header">Section Name</h3>

  <!-- Row for each type (icon-only, icon-text, text-only, etc.) -->
  <div class="row" data-cols="5">

    <!-- Row header describes the type or variant -->
    <div class="row-header">Type/Variant Name</div>

    <!-- One specdpreview block per size (xs, sm, md, lg, xl) -->
    <div class="specdpreview">

      <!-- Specs column: class name and attributes -->
      <div class="preview-specs">
        <div class="preview-specs__row">
          <span class="preview-specs__detail">diet-btn</span>
        </div>
        <div class="preview-specs__row">
          <span class="preview-specs__detail">data-size="xs"</span>
        </div>
        <div class="preview-specs__row">
          <span class="preview-specs__detail">data-type="icon-only"</span>
        </div>
      </div>

      <!-- Preview column: live component -->
      <div class="componentpreview">
        <button class="diet-btn" data-size="xs" data-type="icon-only">
          <!-- component markup -->
        </button>
      </div>

    </div>
    <!-- Repeat specdpreview for each size -->

  </div>
  <!-- Repeat row for each type/variant -->

</div>
```

### Alignment Invariants (Canonical Matrix)

To keep columns and rows perfectly aligned across all preview pages, follow these invariants exactly:

- One variant per row: each row is a single `.row` with a `.row-header` and a fixed number of cells via `data-cols="N"`.
- One cell structure: every cell is a `.specdpreview` containing only:
  - `.preview-specs` — minimal spec lines (use `.preview-specs__detail` for each; no extra labels)
  - `.componentpreview` — the live component markup only
- Top-aligned rows: rows are aligned from the top so differing demo heights (label + helper vs. icon‑only) don’t shift baselines.
- Fixed spec column: specs do not wrap; a stable width prevents column jitter.
  - CSS enforces `white-space: nowrap` and a minimum width.
  - You can tune width per page with a single variable: `.dieter-preview { --spec-col-w: 150px; }`.
- Close every row: ensure each `.row` is properly closed before starting the next. Nested rows will break alignment.
- Consistent sizes per row: match the column count (e.g., Textfield uses `data-cols="3"` for `md|lg|xl`; textarea uses `data-cols="1"`).

These rules are enforced by Dieter Admin CSS:

```css
.row { align-items: start; }
.preview-specs { min-inline-size: var(--spec-col-w, clamp(120px, 16ch, 180px)); }
.preview-specs__detail { white-space: nowrap; }
```

### Troubleshooting (fast)

- Overlapping cells → a previous `.row` wasn’t closed or contained extra wrappers.
- Columns not lining up → spec text is wrapping; shorten the detail text or increase `--spec-col-w` on the page wrapper.
- Single demo row (e.g., textarea) → use `data-cols="1"` with one `.specdpreview` cell.

### CSS Grid System

The layout uses responsive CSS Grid with the following structure defined in `src/css/dieter-previews.css`:

- **`.row`**: Main grid container
  - Default: `grid-template-columns: max-content repeat(5, 1fr)` for 5-column layout (buttons)
  - Uses `data-cols` attribute to adjust column count
  - `data-cols="3"`: 3 columns (segmented control)
  - `data-cols="1"`: single column (typography)
  - Full width with responsive gap: `clamp(0.75rem, 2vw, 2rem)`

- **`.row-header`**: First column, sizes naturally to content width using `max-content`

- **`.specdpreview`**: Each size variation
  - Two-column grid: `grid-template-columns: auto 1fr`
  - Responsive gap: `clamp(1rem, 3vw, 3rem)`
  - Left column (specs) uses natural width, right column (preview) takes remaining space

- **`.preview-specs`**: Metadata column
  - Vertical stack with minimal gap: `gap: var(--hspace-1, 0rem)`
  - Left-aligned: `justify-self: start`
  - Shows only detail (class name and attributes)

- **`.componentpreview`**: Live component column
  - Left-aligned: `justify-self: start`
  - Contains actual Dieter component markup

### Section Headers

Section headers use Heading 3 style with System Gray color:

```css
.section-header {
  font: 600 var(--fs-20)/var(--lh-normal) var(--font-ui);
  color: var(--color-system-gray);
  margin: 0;
}
```

**When to use section headers:**
- **Use** when component has variants (e.g., Button has Primary, Secondary, Neutral, Line 1, Line 2)
- **Skip** when component only has types and sizes (e.g., Segmented has no variants, only Icon only / Icon + text / Text only)

### Component Matrix Patterns

**Button showcase** (75 examples):
- 3 section headers: "Icon only", "Icon + text", "Text only"
- Each section has 5 rows (one per variant)
- Each row has 5 specdpreview blocks (one per size: xs, sm, md, lg, xl)
- Uses `data-cols="5"`

**Segmented showcase** (9 examples):
- No section headers (no variants)
- 3 rows: Icon only, Icon + text, Text only
- Each row has 3 specdpreview blocks (one per size: sm, md, lg)
- Uses `data-cols="3"`

**Typography showcase** (multiple text styles):
- 4 section headers: Headings, Body, Labels & Captions, Overline
- Each text style in its own row
- Single column layout
- Uses `data-cols="1"`

### Preview Specs Format

The preview-specs block shows metadata in detail-only format:
- Class name: `<span class="preview-specs__detail">diet-btn</span>`
- Each attribute: `<span class="preview-specs__detail">data-size="xs"</span>`
- No labels, no titles, just the raw specification

### Class Naming

All layout classes use BEM and are dieteradmin-specific:
- `.dieter-preview` — outer wrapper
- `.section-header` — section heading
- `.row` — grid row container
- `.row-header` — type/variant label
- `.specdpreview` — specs + preview pair
- `.preview-specs` — metadata column
- `.preview-specs__row` — metadata line wrapper
- `.preview-specs__detail` — metadata value
- `.componentpreview` — component wrapper

**Never** pollute Dieter component classes (`.diet-*`) with dieteradmin layout styles.

### Responsive Behavior

- Row headers size naturally to longest label using `max-content`
- Preview columns use `1fr` to fill available space
- Gaps scale responsively using `clamp()` between min and max values
- Full width enforced with `width: 100%` on `.row`
- All alignment uses `justify-self` instead of static values

### Building a New Showcase Page

1. **Read the component CSS** from `dieter/components/*.css` to understand all variants, sizes, and types
2. **Determine structure**: Does the component have variants? How many types? How many sizes?
3. **Choose column count**: Set `data-cols` attribute on `.row` based on number of sizes
4. **Add section headers** only if component has variants
5. **Build rows** for each type (or variant + type combination)
6. **Fill specdpreview blocks** for each size with specs and live component
7. **Keep icons consistent** throughout the page - use same icon across all examples
8. **Test responsive behavior** by resizing viewport to ensure gutters absorb space properly

## Common tasks

```bash
pnpm install        # one-time setup
pnpm dev            # run Dieter Admin locally at http://localhost:xxxx
pnpm build          # build the static bundle
pnpm test           # run Vitest regression checks
```

When verifying changes, smoke-test both light and dark themes via the toggle in the sidebar and ensure the admin preview still mirrors the component contract exactly.
