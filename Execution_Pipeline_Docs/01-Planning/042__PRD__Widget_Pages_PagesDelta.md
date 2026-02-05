# PRD 042 — Widget Pages: Deterministic Wireframes (v0.1)

This is the **execution playbook** for AIs building widget pages in:
- `tokyo/widgets/<widget>/pages/overview.json`
- `tokyo/widgets/<widget>/pages/templates.json`
- `tokyo/widgets/<widget>/pages/examples.json`
- `tokyo/widgets/<widget>/pages/features.json`

Reference implementation (v0.1): `tokyo/widgets/faq/pages/*.json`

## Global rules (reduce interpretation)

1) **v0.1 uses existing blocks + the 5 GTM blocks**:
   - Existing: `hero`, `split`, `steps`, `big-bang`, `minibob`, `cta-bottom-block`, `page-meta`, `navmeta`
   - GTM blocks: `subpage-cards`, `locale-showcase`, `control-moat`, `global-moat`, `platform-strip`

2) **Meta blocks are part of the contract**
   - `page-meta` is **always block #1** (non-visual; SEO title/description).
   - `navmeta` is **required on Overview** (non-visual; used by Prague widgets mega menu).

3) **Showoffs are `split` blocks**
   - Alternate layouts: `visual-left` → `visual-right` → `stacked` (at least one `stacked` per page).
   - Use curated embeds via `curatedRef.publicId` when possible (it’s OK to reuse one curated instance across multiple splits in v0.1).

4) **Moat blocks are explicit**
   - `control-moat` = 3 cards (design control)
   - `global-moat` = 6 cards (global-by-default)
   - `platform-strip` = 3 cards (trust signals)

5) **v0.2 blocks are optional** (only if/when we implement them in Prague)
   - `embed-carousel`, `mobile-showcase`, `feature-explorer`
   - Must have a v0.1 fallback using `split`/`steps` so pages still ship premium without new primitives.

---

OVERVIEW — PAGE WIREFRAME (v0.1 required blocks)

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

showoff 1: proof embed
split (block type: `split`, layout: `visual-right`)

showoff 2: proof embed
split (block type: `split`, layout: `visual-left`)

big-bang (block type: `big-bang`)
Impact statement (why this widget matters + why now).

showoff 3: proof embed (format variation)
split (block type: `split`, layout: `stacked`)

value props (block type: `steps`)
3 item “why this widget” section (widget-specific benefits).

control moat (block type: `control-moat`)
Design control + editor power (3 cards).

global moat (block type: `global-moat`)
Global-by-default + localization moat (6 cards).

platform strip (block type: `platform-strip`)
Trust signals (3 cards).

cta (block type: `cta-bottom-block`)
Primary action: Start free / Get started.

---

TEMPLATES — PAGE WIREFRAME (v0.1 required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
Templates promise: “pick a template OR go pixel-perfect custom”.

template gallery (v0.1)
2–4 splits that showcase distinct template aesthetics.
split (layout: `visual-left` / `visual-right`)

template gallery (v0.2 upgrade, optional)
embed-carousel (auto-scrolling curated embeds, 2 visible on desktop).

mobile proof (v0.1)
1 split showing the template in a mobile-friendly layout.
split (layout: `stacked`)

mobile proof (v0.2 upgrade, optional)
mobile-showcase (4 mobile embeds in a horizontal stack).

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

EXAMPLES — PAGE WIREFRAME (v0.1 required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
ICP-focused promise: “works for your business type”.

examples gallery (v0.1)
3–6 ICP showoffs as splits (alternate left/right; include one stacked).
split (layout: `visual-left` / `visual-right` / `stacked`)

examples gallery (v0.2 upgrade, optional)
embed-carousel (cycles through ICP examples).

big-bang (block type: `big-bang`)
“International customers don’t wait” (or widget-equivalent) narrative section.

how it works (block type: `steps`)
3 steps: Ombra / setup → publish → results (tailored to widget + ICP).

platform strip (block type: `platform-strip`)
ICP trust signals (3 cards).

cta (block type: `cta-bottom-block`)
Build your own + contact (if enterprise motion applies).

---

FEATURES — PAGE WIREFRAME (v0.1 required blocks)

page-meta (block type: `page-meta`, non-visual)

hero (block type: `hero`)
PRD-driven killer feature for this widget.

feature map (v0.1)
Use `steps` (or a small set of `split`s) to list 6 categories:
Content / Layout / Appearance / Typography / Translation / Settings

feature map (v0.2 upgrade, optional)
feature-explorer (category pills + grid of feature cards).

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
