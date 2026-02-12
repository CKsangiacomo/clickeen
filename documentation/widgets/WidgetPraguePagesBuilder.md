# Widget Prague Pages Builder

STATUS: CANONICAL (AI-executable)
OWNER: GTM Dev Team + Product Dev Team
RELATED:
- `documentation/widgets/WidgetGTMStrategy.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/widgets/WidgetBuildContract.md`

---

## 0) Purpose

This is the execution playbook for building the 4 Prague widget pages:
- overview
- templates
- examples
- features

Goal: turn proven widget/platform truths into valid page JSON.

This doc is intentionally operational. It is not a creative brainstorm doc.

---

## 1) Input contract (required)

Before writing any page JSON, collect:

1. `widgetType`
2. Curated instance public IDs available for the widget (`wgt_main_*`, `wgt_curated_*`)
3. Widget-specific claim bank (from `WidgetGTMStrategy.md` section 5)
4. Platform claims selected for this widget
5. Source PRD for the widget
6. Selected style names from `WidgetGTMStrategy.md` (`1.STYLE`) for this widget's Templates page
7. Selected ICP names from `WidgetGTMStrategy.md` (`ICP.CATALOG`) for this widget's Examples page, with one-line rationale per ICP

Do not start page writing until all inputs exist.

---

## 2) Hard rules

1. Every strong claim must map to a known system fact.
2. No invented metrics.
3. Do not copy/paste the same sentence across all 4 pages.
4. Keep body copy localization-friendly (simple syntax, low idiom density).
5. Follow Prague block contracts exactly.
6. Express platform value as positive capability + mechanism.

---

## 3) Prague block contract quick reference

Supported block types for widget pages include:
- `page-meta`
- `navmeta`
- `hero`
- `minibob`
- `subpage-cards`
- `locale-showcase`
- `split`
- `split-carousel`
- `steps`
- `control-moat`
- `global-moat`
- `platform-strip`
- `big-bang`
- `cta-bottom-block`

Key required fields by block type:
- `hero.copy`: `headline`, `subheadline`
- `minibob.copy`: `heading`, `subhead`
- `split.copy`: `headline`, `subheadline`
- `split-carousel.copy`: `headline`
- `steps.copy`: `title`, `items[]`
- `subpage-cards.copy`: `title`, `items[]`
- `control-moat/global-moat/platform-strip.copy`: `title`, `items[]`
- `big-bang.copy`: `headline`, `body`
- `cta-bottom-block.copy`: `headline`, `subheadline`
- `locale-showcase.copy`: `title`, `subtitle`
- `page-meta.copy`: `title`, `description`
- `navmeta.copy`: `title`, `description`

`subpage-cards.links[].page` must be one of:
- `templates`
- `examples`
- `features`

---

## 4) Build flow

### Step 1 - Build a message bank first

Create a compact internal object before page writing:

```json
{
  "widgetType": "faq",
  "widgetClaims": [
    {
      "id": "faq.answer_on_page",
      "claim": "Answer questions on-page",
      "proof": "PRD section X + widget behavior"
    }
  ],
  "platformClaims": [
    "design.start_fast_edit_deep",
    "infra.edge_delivery_default",
    "l10n.runtime_locale_selection"
  ],
  "selectedIcps": [
    {
      "name": "Hotels & Resorts",
      "rationale": "High multilingual guest volume and repetitive pre-arrival questions."
    },
    {
      "name": "Restaurants, Cafes & Bars",
      "rationale": "Mobile-first questions on menu, allergens, and opening hours."
    }
  ],
  "curatedRefs": ["wgt_curated_faq_lightblurs_generic"]
}
```

This avoids narrative drift while drafting multiple pages.

### Step 2 - Build each page from its job

Do not start from copy. Start from page job:
- Overview = definition + first proof
- Templates = style range + control depth
- Examples = context-specific outcomes
- Features = engineering proof

### Step 3 - Validate claims

For each page, run a quick claim audit:
- Which claim IDs are used?
- Do they have proof anchors?
- Are any numeric claims unsupported?

If unsupported, rewrite before finalizing JSON.

---

## 5) Canonical page blueprints

Use these block sequences as default.

### 5.1 Overview page (`/widgets/{widget}`)

Recommended order:
1. `page-meta`
2. `hero`
3. `navmeta`
4. `minibob`
5. `subpage-cards`
6. `locale-showcase`
7. `steps`
8. `split` (design/control angle)
9. `big-bang`
10. `global-moat`
11. `platform-strip`
12. `cta-bottom-block`

What this page must prove:
- What widget is
- Why it is useful now
- Why Clickeen platform improves delivery and localization

### 5.2 Templates page (`/widgets/{widget}/templates`)

Recommended order:
1. `page-meta`
2. `hero`
3. `split-carousel` (modern styles)
4. `split` (classic styles)
5. `big-bang`
6. `control-moat`
7. `split` (layouts)
8. `split` (appearance)
9. `split` (typography)
10. `split` (dark/light or responsive)
11. `steps`
12. `cta-bottom-block`

What this page must prove:
- Style range is broad
- Editing controls are deep and practical
- User can start from presets and still fully customize
- The selected styles are explicit and named using the canonical catalog in `WidgetGTMStrategy.md` (`1.STYLE`)

### 5.3 Examples page (`/widgets/{widget}/examples`)

Recommended order:
1. `page-meta`
2. `hero`
3. `split` (scenario 1)
4. `split` (scenario 2)
5. `split` (scenario 3)
6. `big-bang`
7. `split` (scenario 4, optional)
8. `steps`
9. `platform-strip`
10. `cta-bottom-block`

What this page must prove:
- Widget works in real contexts
- Scenarios are concrete and observable
- Copy maps context -> widget action -> visible result
- Scenarios are anchored to selected ICPs from `WidgetGTMStrategy.md` (`ICP.CATALOG`) with explicit rationale

### 5.4 Features page (`/widgets/{widget}/features`)

Recommended order:
1. `page-meta`
2. `hero`
3. `split` (authoring/AI editing)
4. `split` (localization/runtime locale)
5. `split` (infra/performance)
6. `steps` (technical proof highlights)
7. `control-moat`
8. `global-moat`
9. `platform-strip`
10. `cta-bottom-block`

What this page must prove:
- Why engineering is stronger than alternatives
- Which mechanisms create reliability
- Why localization is safe and finite

---

## 6) Copy rules by block role

### Hero
- Headline: short, concrete, category-defining
- Subheadline: one mechanism + one user outcome

### Minibob
- Must describe the immediate action clearly
- No abstract copy

### Split / Split-carousel
- Treat each split as one proof point
- Avoid repeating the same benefit in 5 different splits
- Prefer capability language over defensive language

### Steps
- Steps should describe a real flow, not generic slogans
- Keep each step title action-oriented

### Moat/Strip blocks
- Use as concise proof summaries
- Keep item bodies short and specific

### CTA
- CTA copy should follow page intent
- No fake urgency

---

## 7) Localization-friendly writing standard

Because Prague copy is localized across many locales:

1. Prefer literal, clear source English.
2. Use idioms sparingly and mostly in headlines.
3. Keep subtitles and bodies straightforward.
4. Avoid stacked clauses and long punctuation chains.
5. Keep terminology consistent across pages.

---

## 8) Validation checklist (before commit)

1. JSON validity for all 4 page files.
2. Block contract validity (required fields present).
3. Claim audit complete (no unsupported strong claims).
4. Localization-safe style pass done.
5. Curated refs resolve to real instances.

Recommended local checks:
- `node scripts/prague-l10n/verify.mjs`
- `pnpm -C prague build`

---

## 9) Definition of done

A widget page set is done when:

1. All 4 pages are generated and valid.
2. Each page has a distinct role and narrative.
3. Claims are direct, proof-backed, and non-generic.
4. Copy is clean enough for reliable localization.
5. Another AI can reproduce consistent quality using this playbook.
