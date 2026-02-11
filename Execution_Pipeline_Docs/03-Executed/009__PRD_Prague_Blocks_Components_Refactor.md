# PRD — Prague Blocks + Components Refactor (Lego System)

Status: Executed / superseded. Structural refactor landed; this doc references the retired prague-strings pipeline.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Status: Draft
Owner: Product Dev Team (Prague)
Surface: Prague (marketing/SEO)
Environment: Local-first (source of truth), then cloud-dev

## Summary

Refactor Prague’s UI structure into a clean, scalable "lego system":
- `blocks/` is a true library of reusable page sections (Hero, Minibob, Split Creative, etc).
- `components/` is the library of smaller UI primitives used by blocks.
- Page composition is data-driven (JSON manifests per widget page).
- Localization expands from local base strings into compiled per-locale pages.
- SEO-ready: page metadata and on-page copy are localized through the same pipeline (no SEO agent required).

This aligns the filesystem, authoring workflow, and localization pipeline with the long-term “100x pages” goal.

## Problem

Today, Prague’s block taxonomy is organized by **page family** (`widget-landing/`, `widget-templates/`, etc), not by reusable block types. That creates:
- duplicated block implementations across page families,
- drift in layout and typography,
- unclear ownership of block types,
- friction when reusing blocks across pages,
- brittle localization mapping (allowlists should be per block type, not per page folder).

We need a single block library that scales to hundreds of pages and widgets without manual file sprawl.

## Goals

1) **Make blocks reusable** across any page or widget without copy/paste.
2) **Make composition data-driven** (page JSON lists blocks; code does not hardcode page layout).
3) **Tie blocks cleanly to localization** (allowlist per block type; base strings per page block).
4) **Keep global UI coherent** (nav/footer/cta live in one shared library).
5) **Preserve Prague’s layout rules** (ck-canvas/ck-inline, one breakpoint, Dieter tokens).
6) **Enable locale-native SEO** without changing the pipeline (manual base now, SEO agent later).

## Non-Goals

- Redesigning visual UI or changing Prague layout primitives.
- Introducing new runtime behavior or network fetches.
- Changing widget instance/curated pipelines.
- Creating a new CMS. This remains a repo-driven system.
- Building the SEO agent itself (this PRD only makes the system ready for it).

## Proposed Architecture

### 1) Block Library (Prague)

Blocks are first-class, reusable components by type:

```
prague/src/blocks/
  hero/
    hero.astro
  minibob/
    minibob.astro
  split-creative-left/
    split-creative-left.astro
  split-creative-right/
    split-creative-right.astro
  split-creative-stacked/
    split-creative-stacked.astro
  big-bang/
    big-bang.astro
  steps/
    steps.astro
  outcomes/
    outcomes.astro
  cta/
    cta.astro
  site/
    nav/
      Nav.astro
    footer.astro
```

Rules:
- Blocks do not read filesystem or fetch.
- Blocks receive props only.
- Blocks use `ck-*` layout primitives + Dieter tokens.
- `blocks/site/*` are global chrome (nav/footer). They are not composed via page manifests.

### 1.1) Block Registry (Validation + Mapping)

Introduce a block registry to validate manifests and map block `type` to implementation:

- Registry maps `type` -> component + props contract.
- Build-time validation fails fast on:
  - unknown `type`,
  - missing compiled strings for a required block,
  - invalid metadata fields.

This keeps page JSON typo-safe and deterministic.

### 2) UI Components Library (Prague)

Small, reusable UI pieces live in `components/`:

```
prague/src/components/
  Button.astro
  Badge.astro
  Card.astro
  SectionHeader.astro
  Icon.astro
```

Rules:
- Components are leaf-level building blocks used by blocks.
- No page awareness.

### 3) Page Composition (Data-Driven)

Each widget defines blocks for each page in its own folder:

```
tokyo/widgets/<widget>/pages/overview.json
tokyo/widgets/<widget>/pages/templates.json
tokyo/widgets/<widget>/pages/examples.json
tokyo/widgets/<widget>/pages/features.json
tokyo/widgets/<widget>/pages/pricing.json
```

Example (layout only; no text):
```json
{
  "v": 1,
  "blocks": [
    { "id": "hero", "type": "hero", "visual": true },
    { "id": "minibob", "type": "minibob" },
    { "id": "split-1", "type": "split-creative-left", "curatedRef": { "publicId": "wgt_curated_faq.templates.hero" } }
  ]
}
```

Notes:
- The **page list** is used for nav/URL structure.
- The **block list** defines actual layout per widget page.
- No TS/JS hardcoding of layouts.

#### 3.1) Block Metadata Fields (Manifest)

Each block entry is layout + metadata only (no text).

- `id` (string, required): stable ID within the page.
- `type` (string, required): block type name (must exist in registry).
- `visual` (boolean, optional): legacy metadata for blocks that can show a curated visual (no embed by itself).
- `curatedRef` (object, optional): explicit curated instance reference for blocks that embed a visual.
  - Example: `{ "publicId": "wgt_curated_faq.templates.hero" }`

#### 3.2) Block Props Contract (Strings -> Props)

Strings are stored per page block in `prague-strings/base/` and expanded into compiled files.
At runtime, Prague merges the layout manifest with compiled strings by `blockId`.

Example compiled strings shape:
```json
{
  "v": 1,
  "blocks": {
    "hero": { "strings": { "headline": "...", "subheadline": "..." } },
    "minibob": { "strings": { "heading": "...", "subhead": "..." } }
  }
}
```

Block registry defines required string keys per block type:
- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `split-creative-left|right|stacked`: `headline`, `subheadline`
- `steps`: `title`, `items[]`
- `cta`: `headline`, `subheadline`
- `navmeta` (non-visual): `title`, `description`
- `page-meta` (non-visual): `title`, `description` (SEO metadata)

Prague passes `{ copy, meta }` into each block:
- `copy` comes from compiled strings.
- `meta` comes from manifest fields (`curatedRef`, `visual`, `primaryCta`).

### 4) Runtime Loading Flow (Layout + Strings Merge)

1) Load page layout from `tokyo/widgets/<widget>/pages/<page>.json`.
2) Load compiled strings from `prague-strings/compiled/v1/<locale>/widgets/<widget>/<page>.json`.
3) Validate every block entry:
   - `type` exists in registry.
   - compiled strings exist for `id`.
   - required string keys are present.
4) Merge into render model `{ id, type, copy, meta }`.
5) Render blocks in order using registry mapping.
6) If a `page-meta` block exists, use it to set `<title>` and meta description (not rendered).

Missing or stale data fails fast (build-time or server render error).

### 4) Localization & Expansion

Base strings live locally per page block:
```
prague-strings/base/v1/widgets/<widget>/<page>/blocks/<blockId>.json
```

Allowlists live per block type:
```
prague-strings/allowlists/v1/blocks/<blockType>.allowlist.json
```

Pipeline:
1) San Francisco generates overlays per locale (ops patches).
2) Compile step produces per-locale compiled pages:
```
prague-strings/compiled/v1/<locale>/widgets/<widget>/<page>.json
```
3) Prague loads the page manifest + compiled strings and renders blocks in order.

This preserves the “start local → expand everywhere” model.

### 4.1) Shared Strings

Some strings are truly global (nav/footer/shared CTAs). These live under:
```
prague-strings/base/v1/shared/*.json
```

If a block declares `sharedKey`, compile merges shared strings into that block first.
Any key collision is a hard error (fail fast).

### 4.2) SEO Localization Readiness (No Agent Required)

The system must work today without an SEO agent, and be ready for one later:

- Page-level SEO strings live in a non-visual `page-meta` block per page.
- Base SEO strings are authored locally (English).
- The standard localization pipeline generates overlays and compiled outputs for SEO strings.
- A future SEO agent can generate overlays for the same allowlisted SEO fields using locale intent profiles.

No pipeline changes are required when the SEO agent is introduced; it just becomes another overlay producer.

## Implementation Plan

### Phase 1 — Refactor folder structure
- Create `prague/src/blocks/` by block type.
- Create `prague/src/components/` for shared UI primitives.
- Move existing block files into new paths (no visual changes).
- Audit current Prague code to extract component candidates into `components/`.

### Phase 2 — Update imports & runtime composition
- Update all Prague pages to import blocks from the new library paths.
- Keep `tokyo/widgets/*/pages/*.json` as the page manifest source.
- Add block registry validation to fail fast on unknown block types or missing strings.
- Implement runtime merge of layout + compiled strings (per block ID).

### Phase 3 — Localization alignment
- Ensure allowlists are keyed by block type (Hero, Minibob, split-creative-left/right/stacked).
- Ensure base strings are stored per widget/page/block.
- Keep compile outputs identical to current runtime expectations.
- Add `page-meta` as a non-visual block type for SEO metadata (title/description).

### Phase 4 — Documentation + policy
- Update Prague docs to reflect new block/component taxonomy.
- Record conventions for new block types, naming, and props.
- Document runtime loading flow and shared strings merge policy.

## Execution Steps (Detailed)

### 0) Preconditions

- Confirm localization pipeline is green locally (translate + compile + Prague renders).
- Ensure every block has a matching base strings file; any `copy` in page JSON is ignored by runtime.

### 1) Block library + components (mechanical move)

1.1 Create target folders:
- `prague/src/blocks/<block-type>/`
- `prague/src/components/`

1.2 Move blocks into type-based folders:
- Migrate `widget-landing/*` blocks into `blocks/<type>/`.
- Migrate any duplicated block types into a single canonical component.
- Keep `split-creative-left/right/stacked` as distinct block types (layouts diverge).

1.3 Component audit:
- Identify shared UI parts currently duplicated across blocks.
- Extract into `prague/src/components/*` (buttons, badges, headings, cards).

### 2) Block registry + validation

2.1 Create a registry module (new):
- Map `type` -> component import + required string keys + allowed metadata.
- Example entry: `{ type: 'hero', required: ['headline', 'subheadline'], meta: ['visual'] }`

2.2 Validation rules (build-time):
- Unknown block type -> fail fast.
- Missing compiled strings for a block id -> fail fast.
- Missing required string keys -> fail fast.
- Unsupported metadata fields -> fail fast.

### 3) Runtime merge (layout + strings)

3.1 Page load flow:
- Load layout manifest from `tokyo/widgets/<widget>/pages/<page>.json`.
- Load compiled strings from `prague-strings/compiled/v1/<locale>/widgets/<widget>/<page>.json`.

3.2 Merge into render model:
- `{ id, type, copy, meta }` per block in manifest order.
- Pass `copy` + `meta` into the block component.

3.3 SEO block:
- If `page-meta` exists, apply `<title>` and meta description.

### 4) Localization alignment

4.1 Add allowlists:
- One allowlist per block type (`big-bang`, `hero`, `split-creative-left`, `split-creative-right`, `split-creative-stacked`, `steps`, `cta`, `minibob`, `outcomes`, `page-meta`, `navmeta`).

4.2 Base strings:
- Add `prague-strings/base/v1/widgets/<widget>/<page>/blocks/<blockId>.json`.
- Ensure base files include `blockId`, `blockKind` (block type), `strings`, and optional `sharedKey`.

4.3 Overlay + compile:
- Run `pnpm prague:strings:translate` and `pnpm prague:strings:compile`.
- Verify compiled output exists for all widget pages and locales.

### 5) Integration updates

5.1 Update imports:
- Replace old block import paths in pages/layouts to new `blocks/*` paths.

5.2 Remove page-family folders:
- Remove now-empty `prague/src/blocks/widget-*` folders after migration.

### 6) Verification

6.1 Smoke checks:
- Open at least 2 widgets and 2 locales for overview + templates.
- Confirm hero, split-creative, steps, outcomes, cta, minibob render with localized copy.

6.2 SEO checks:
- Confirm `<title>` and meta description change per locale.
- Confirm no runtime fetches added.

### 7) Rollback

- If regressions appear, rollback via git revert of this refactor PR.

## Acceptance Criteria

- Prague builds with no runtime behavior change.
- All widget pages render using new block paths.
- Block files live under `prague/src/blocks/<block-type>/`.
- Global components live under `prague/src/blocks/site/` or `prague/src/layouts/`.
- Smaller UI primitives live under `prague/src/components/`.
- Localization pipeline still compiles per-locale pages with strict validation.
- Block registry validation rejects unknown types or missing required strings.
- Manual visual parity check for core pages (overview + templates for at least 2 widgets).
- SEO metadata renders from compiled strings (no SEO agent required).

## Risks & Mitigations

- **Import breakage during moves** → do a clean, mechanical move and update all imports.
- **Hidden drift** → keep visual output identical; no design changes in this PRD.
- **Schema mismatch** → validate block `type` values match block filenames.
- **Rollback** → structural refactor only; rollback via git revert.

## Decisions (Locked)

- `split-creative-left/right/stacked` are distinct block types with fixed layouts.
- Keep separate page JSON files per widget (`overview.json`, `templates.json`, etc).
- `blocks/site/*` are global chrome, not part of page manifests.

## Notes

- This is a structural refactor to enable the lego system and localization pipeline.
- No new product surface is introduced; only organization and contracts are clarified.
