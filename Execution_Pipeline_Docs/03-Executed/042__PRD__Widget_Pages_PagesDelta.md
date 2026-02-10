# PRD 042 — Widget Pages: Deterministic Wireframes

**Status:** EXECUTED  
**PRD #:** 042  
**Date:** 2026-02-06  
**Executed:** 2026-02-10  
**Type:** Execution delta / wireframe contract

---

## Execution record (authoritative)

This file is the deterministic page-construction delta used during PRD 042 execution.
As-built runtime contracts are implemented in:
- `prague/src/lib/blockRegistry.ts`
- `prague/src/components/WidgetBlocks.astro`
- `tokyo/widgets/*/pages/*.json`

When this delta conflicts with runtime code, runtime code is the source of truth.

---

This is the **execution playbook** for AIs building widget pages in:
- `tokyo/widgets/<widget>/pages/overview.json`
- `tokyo/widgets/<widget>/pages/templates.json`
- `tokyo/widgets/<widget>/pages/examples.json`
- `tokyo/widgets/<widget>/pages/features.json`

Reference implementation: `tokyo/widgets/faq/pages/*.json`

## Global rules (reduce interpretation)

1) **Use the full PRD 042 block system (no phased variants)**:
   - Existing: `hero`, `split`, `steps`, `big-bang`, `minibob`, `cta-bottom-block`, `page-meta`, `navmeta`
   - Navigation + moats: `subpage-cards`, `locale-showcase`, `control-moat`, `global-moat`, `platform-strip`
   - Proof + interaction: `embed-carousel`, `mobile-showcase`, `feature-explorer`

2) **Meta blocks are part of the contract**
   - `page-meta` is **always block #1** (non-visual; SEO title/description).
   - `navmeta` is **required on Overview** (non-visual; used by Prague widgets mega menu).

3) **Showoffs are `split` blocks**
   - Alternate layouts: `visual-left` → `visual-right` → `stacked` (at least one `stacked` per page).
   - Use curated embeds via `curatedRef.publicId` when possible (reuse is OK, but prefer real variety when you have it).

4) **Moat blocks are explicit**
   - `control-moat` = 3 cards (design control)
   - `global-moat` = 6 cards (global-by-default)
   - `platform-strip` = 3 cards (trust signals)

5) **No “fallback wireframes”**
   - If a page calls for `embed-carousel`, `mobile-showcase`, or `feature-explorer`, we build those blocks and use them.

---

OVERVIEW — PAGE WIREFRAME (required blocks)

page-meta (block type: `page-meta`, non-visual)
SEO title + description for this widget.

hero (block type: `hero`)
PRD-driven promise + differentiator (fast value communication).

navmeta (block type: `navmeta`, non-visual, REQUIRED)
Used by Prague mega menu. Must include `copy.title` + `copy.description`.

minibob (block type: `minibob`)
Live try, above the fold.

subpage-cards (block type: `subpage-cards`)
Premium navigation tiles linking to Templates / Examples / Features.

locale-showcase (block type: `locale-showcase`)
Explicitly show “real languages” switching (this is a core platform moat).

value props (block type: `steps`)
3 item “why this widget” section (widget-specific benefits).

showoff 1: proof embed
split (block type: `split`, layout: `visual-right`)

control moat (block type: `control-moat`)
Design control + editor power (3 cards).

showoff 2: proof embed
split (block type: `split`, layout: `visual-left`)

big-bang (block type: `big-bang`)
Impact statement (why this widget matters + why now).

showoff 3: proof embed (format variation)
split (block type: `split`, layout: `stacked`)

global moat (block type: `global-moat`)
Global-by-default + localization moat (6 cards).

platform strip (block type: `platform-strip`)
Trust signals (3 cards).

cta (block type: `cta-bottom-block`)
Primary action: Start free / Get started.

---

TEMPLATES — PAGE WIREFRAME (required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
Templates promise: “pick a template OR go pixel-perfect custom”.

desktop carousel (block type: `embed-carousel`)
Auto-scrolling embeds (2 side by side on desktop; 1 on mobile).
Cycles through curated template instances.

mobile showcase (block type: `mobile-showcase`)
4 mobile embeds side by side (horizontal stack).

showoffs: named styles (embed)
Each showoff is a `split` with a clear style label:
- Classic / Professional
- Brutalism
- Liquid Glass / Glassmorphism
- Dark mode

control moat (block type: `control-moat`)
“Design freedom” (3 cards).

workflow (block type: `steps`)
3 steps: choose template → customize → publish (and localize).

cta (block type: `cta-bottom-block`)
Install template + customize in editor.

---

EXAMPLES — PAGE WIREFRAME (required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
ICP-focused promise: “works for your business type”.

desktop carousel (block type: `embed-carousel`)
Auto-scrolling embeds (2 side by side on desktop; 1 on mobile).
Cycles through ICP examples (Hotels, Restaurants, Tour operators, SaaS, E-commerce).

big-bang (block type: `big-bang`)
“International customers don’t wait” (or widget-equivalent) narrative section.

how it works (block type: `steps`)
3 steps: Ombra / setup → publish → results (tailored to widget + ICP).

platform strip (block type: `platform-strip`)
ICP trust signals (3 cards).

cta (block type: `cta-bottom-block`)
Build your own + contact (if enterprise motion applies).

---

FEATURES — PAGE WIREFRAME (required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
PRD-driven killer feature for this widget.

feature explorer (block type: `feature-explorer`)
6 categories:
Content / Layout / Appearance / Typography / Translation / Settings
Left: category pills
Right: grid of feature cards (3 per row) for selected category

main feature deep dives (embed where relevant)
2–4 splits (alternate visual-left/visual-right).

control moat (block type: `control-moat`)
Design + translate controls (3 cards).

global moat (block type: `global-moat`)
Platform excellence (6 cards).

platform strip (block type: `platform-strip`)
CDN delivery / Lightweight embed / Security & compliance (3 cards).

cta (block type: `cta-bottom-block`)
Start free.
