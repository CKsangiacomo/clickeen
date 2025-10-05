# Dieter Admin Lab

This Vite + TypeScript workspace hosts the Dieter preview shell. It renders the frozen Dieter components that ship in `@ck/dieter` and the in-progress "Dieter candidates" we prototype before they are promoted to the PRD.

## What lives here

- **Shell (`src/main.ts`, `src/router.ts`)** — builds the docs chrome, listens to hash-based routes, and injects HTML fragments into the content area.
- **Preview data (`src/data`)** — lists published Dieter components (`dieterPreviews`) and the candidate routes/specs the lab should display.
- **HTML snippets (`src/html/**`)** — component demo markup loaded via `import.meta.glob`.
  - `src/html/dieter-showcase/` mirrors the frozen Dieter package (button, segmented, colors, typography). Treat these as read-only references.
  - `src/html/candidates/` holds lab previews for in-progress components. Each candidate should use a single consolidated document with sections/anchors for variants and states so the file list stays manageable.
- **Preview helpers (`src/css/dieter-previews.css` + siblings)** — light layout scaffolding for the lab only. These styles must never change the appearance of real `.diet-*` classes.

## Working rules

1. **PRD stays frozen.** `documentation/systems/Dieter.md` is the normative contract. Update it only when a candidate is ready to graduate.
2. **Published vs. candidate.** "Dieter components" are the GA assets already exported from `@ck/dieter`; treat them as read-only here. "Dieter candidates" (Input, Textarea, Select, etc.) are the experiments we iterate on inside this lab.
3. **No contract overrides.** Custom CSS/JS in this workspace may position demos, but must never tweak the visuals or behavior of the shipped Dieter selectors. If a demo needs a different state, change the actual component CSS in `dieter/components/**` instead.
4. **Keep previews modular.** Use per-component folders or anchors in a single HTML file rather than scattering many `*-variant*.html` fragments. This keeps the harness maintainable as we add components.
5. **Document decisions locally.** Any lab-specific conventions or open questions belong here (or in a scoped notes file), not in the frozen PRD.
6. **No ad-lib copy.** Previews must only contain component markup + metadata derived from Dieter tokens/attributes. Do not invent descriptive text, examples, or labels beyond the standard scaffold; if additional copy is required, a human must provide it.

## Component preview blueprint

Every page under `src/html/dieter-showcase/` (GA references) and `src/html/candidates/` (lab work) follows the same scaffold so AIs can compose them consistently:

1. **Wrapper:** Wrap the entire page in `<div class="dieter-preview">`. This gives the card frame, padding, and background.
2. **Caption:** Add a `<p class="dieter-preview__caption">` describing the contract at the top.
3. **Hero matrix:** Use one of the shared grid helpers to present variants vs. sizes:
   - `.dieter-preview__table → __row → __cells → __cell` (buttons, segmented control, etc.).
   - `.dieter-preview__swatches` (color palette) or `.dieter-preview__columns` (typography) if the component needs another layout. Inside each cell place the metadata block (`.dieter-preview__meta`) plus a single live component instance.
4. **Supporting sections:** Optional blocks (e.g., CSS contract snippet, state grid, font-weight explorer) follow the hero matrix as additional `<div>`s inside the wrapper. Only add them when the PRD explicitly calls for extra context; the default should look exactly like the Segmented Control reference (hero matrix only).
5. **Real markup only:** Inside each demo tile, render the true Dieter contract markup (`.diet-btn`, `.diet-segmented`, typography classes, etc.). The preview styles only handle layout—never override the component CSS or add bespoke wrappers.

Following this blueprint keeps the showcase consistent and prevents drift between GA references and candidate experiments.

### Hero matrix semantics (rows vs. columns)

- **Rows = footprint families.** Each `<div class="dieter-preview__row">` groups one footprint of the component (icon-only, icon+text, text-only, etc.). Use an `<h4>` at the start of the row to label the footprint.
- **Columns = size ladder.** `.dieter-preview__cells` is a responsive grid (`repeat(auto-fit, minmax(180px, 1fr))`). Provide one `.dieter-preview__cell` per size preset (XS → XL, or the published rail). The grid handles wrapping—no custom flexbox needed.
- **Cell anatomy.** Inside each cell:
  - Add `<div class="dieter-preview__meta">` entries for the selectors applied (`class:diet-btn`, `data-size="sm"`, `data-footprint="icon-only"`, etc.). Keep the metadata short—mirror the Segmented Control showcase.
  - Follow with a **single** live control wrapped in `<div class="dieter-preview__demo">`. Do not stack permutations inside the hero cell; additional variants belong in a supporting section below the table. If no supporting section is needed, stop after the hero matrix.
  - If a note is required inside the tile (e.g., “Primary”), reuse `.dieter-preview__caption` for the label.

### Layout helpers (no hand-rolling)

- `dieter-preview__table`, `__row`, `__cells`, `__cell`, `__meta`, and `__demo` handle the layout. Do **not** replace them with ad-hoc flexbox; the helpers include the spacing, wrapping, and neutral background tokens shared across Segmented, Button, etc.
- Use the stack helpers (`stack-sm`, `stack`, `stack-lg`) **outside** the hero matrix—e.g., for state samplers or code snippets. Hero cells stay limited to one component instance so they resemble the Segmented reference.
- For code examples, wrap the snippet in `<pre><code>…</code></pre>` inside the `.dieter-preview` wrapper. The base styles in `utilities.css` format the block to match the existing “CSS contract” sections.
- When you need a full-width supporting section (font weight explorer, CSS contract, variant sampler), append another `<div>` after the hero table and use the helpers there. The outer `.dieter-preview` grid provides the vertical spacing.

### Checklist before shipping a page

1. Files live in the correct folder: GA references → `src/html/dieter-showcase/`, candidates → `src/html/candidates/`.
2. Page markup follows the wrapper → caption → hero table → supporting sections flow.
3. Each hero row corresponds to a footprint, each column to a size, and every cell shows exactly one live component sample plus metadata.
4. All cells use the helper classes (`dieter-preview__*`); optional stacks (`stack-sm`, etc.) only appear in supporting sections after the table.
5. Optional extras (state samplers, code snippets, explorers) sit after the hero table and use existing utility classes. If the spec doesn’t call for them, don’t add them.
6. The component’s Dieter CSS is already imported via `dieterPreviews` (for GA pages) or the candidate spec (for lab pages); never add local overrides.

If the above holds, the page will render identically to the existing Button/Segmented/Color/Typo demos and future AIs can focus on component logic instead of layout guesswork.

## Common tasks

```bash
pnpm install        # one-time setup
pnpm dev            # run the lab locally at http://localhost:xxxx
pnpm build          # build the static bundle
pnpm test           # run Vitest regression checks
```

When verifying changes, smoke-test both light and dark themes via the toggle in the sidebar and ensure the admin preview still mirrors the component contract exactly.
