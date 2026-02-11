# PRD — Prague CMS: Widget Pages (Tokyo JSON) + Curated Instances (Single System)

Status: Superseded. This doc references the retired prague-strings pipeline and is kept for history only.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

**Status:** Draft (execution-focused)  
**Owner:** Lane A (Bob/Paris/Michael/Supabase) + Lane B (Prague)  
**Scope:** Widget marketing pages (Overview / Templates / Examples / Features / Pricing).

---

## 0) Summary (1 paragraph)

We will use `tokyo/widgets/{widgetType}/pages/*.json` as the **platform-owned CMS source of truth** for Prague widget marketing pages. Each widget has **five pages** (`overview`, `templates`, `examples`, `features`, `pricing`), each page is a list of structured blocks. Page JSON is **layout + meta only**; all copy lives in `prague-strings` and is merged at runtime. Blocks may embed a **real curated instance** by including `curatedRef.publicId` (locale-free). There is no separate “website creative” concept or flow: curated instances are the single primitive for visuals and defaults.

---

## 1) Goals / Non-goals

### Goals
- Make Prague page content **file-driven** using Tokyo widget page JSON (platform-owned).
- Five widget-specific pages: Overview / Templates / Examples / Features / Pricing.
- Each page is built from **blocks** with:
  - **Text model** (structured fields in `prague-strings`, no raw HTML blobs in v1)
  - Optional **visuals** that are real curated widget instances
- Keep identity **deterministic and locale-free** (no locale in `publicId`).
- Keep Prague read-only: Prague never writes to Paris or Supabase.

### Non-goals (v1)
- A full authoring UI for page text (start with file edits / minimal admin tooling).
- A/B testing, personalization, or per-user widget recommendations.
- Runtime fetching of Tokyo content; Prague reads repo files in this snapshot.
- “Website creative” or “template instance” flows (deprecated by curated-only model).

---

## 2) Canonical concepts (do not mix)

### 2.1 Platform catalog vs user-owned data
- `tokyo/widgets/{widgetType}/pages/*.json` is **platform-owned** GTM/catalog content (file-based layout).
- `prague-strings/**` is **platform-owned** copy + localization data (file-based overlays).
- `curated_widget_instances` are Clickeen-authored instances (baseline + curated visuals).
- `widget_instances` are user instances (workspace-owned).

### 2.2 Curated instances (single primitive)
A curated instance is:
- A **real widget instance** used by Prague and by the platform as the canonical “main” baseline.
- Stored in `curated_widget_instances`.
- Global (no workspace ownership; `workspace_id = NULL`).
- Identified by a locale-free `publicId`.

There is no separate “website creative” entity. If a page block embeds a visual, it references a curated instance directly.

### 2.3 Ownership split (hard boundary)

**Lane B (Prague) owns:**
- Prague page rendering + block system.
- Read-only consumption of `tokyo/widgets/{widgetType}/pages/*`.
- Reading compiled strings from `prague-strings/compiled/**`.
- Embedding visuals via Venice (Prague never calls Paris directly).

**Lane A (Bob + Paris + Michael/Supabase) owns:**
- DB schema + migrations.
- `publicId` grammar + validators (`assertPublicId`) + any downstream assumptions.
- Instance write APIs (create/update/publish) and superadmin write flows used by DevStudio.
- Ensuring curated instances can be created/loaded/published normally (global, service-role writes).

**Hard boundary rules:**
- Prague must **not** write to Supabase/Paris.
- Page manifests must **not** store locale-specific IDs.
- Prague embeds visuals via **Venice only**.

---

## 3) CMS data model (Tokyo pages JSON)

### 3.1 Top-level shape
Each page is a versioned JSON file at:
- `tokyo/widgets/{widgetType}/pages/{overview|templates|examples|features|pricing}.json`

Shape:
- `v: 1`
- `blocks: CatalogBlock[]`

### 3.2 Block model (strict)
Every block:
- `id: string` (stable within that widget + page; used for debug/analytics)
- `type: string` (renderer key; must exist in `blockRegistry.ts`)
- Optional meta fields (must be allowed by the registry):
  - `curatedRef: { publicId: string }` for embeds
  - `visual: true` (legacy metadata; does not embed by itself)

**Hard rule:** page JSON is **layout + meta only**. Copy lives in `prague-strings` and compiled outputs overwrite any inline `copy` in JSON.

### 3.3 Required non-visual blocks
- `navmeta` (overview only) for mega menu title/description
- `page-meta` (all pages) for SEO title/description

---

## 4) Curated embed identity

### 4.1 Explicit `curatedRef`
Blocks that embed visuals must include the curated instance identity directly:
```json
{
  "id": "hero",
  "type": "hero",
  "curatedRef": { "publicId": "wgt_curated_faq.overview.hero" }
}
```

### 4.2 Deterministic naming (recommended)
Use a stable, locale-free naming scheme:
```
wgt_curated_{widget}.{page}.{slot}
```

Examples:
- `wgt_curated_faq.overview.hero`
- `wgt_curated_countdown.templates.hero`

Prague does **not** derive these IDs; they are explicit in the manifest.

---

## 5) Prague runtime behavior (page assembly)

For `/{locale}/widgets/{widgetType}/{page?}`:
1. Prague loads `tokyo/widgets/{widgetType}/pages/{page}.json`.
2. Prague loads compiled strings from `prague-strings/compiled/v1/{locale}/widgets/{widgetType}/{page?}.json`.
3. Prague validates each block (type exists, strings present, meta allowed).
4. Prague merges compiled strings into `blocks[].copy` and renders blocks in order.
5. Visuals embed via Venice using `curatedRef.publicId` with `?locale=`.

Missing or invalid data fails fast (build-time or server render error).

---

## 6) DevStudio (curated-only flow)

DevStudio Local supports curated instances as the single primitive:
- **Update default config**: pushes editor state into `tokyo/widgets/{widget}/spec.json` and upserts `wgt_main_{widget}`.
- **Reset instance from JSON**: pulls from `spec.json` and overwrites `wgt_main_{widget}`.

Curated embed instances (e.g., `wgt_curated_faq.overview.hero`) are created/edited as normal curated instances in DevStudio; there is no separate “website creative” endpoint or button.

---

## 7) Why this is scalable / elegant

- **No new entity types**: curated instances are the only visual primitive.
- **Deterministic wiring**: manifests carry explicit curated IDs.
- **Separation of concerns**:
  - `tokyo/widgets/*/pages/*.json`: layout + embed wiring
  - `prague-strings/**`: copy + localization
  - `curated_widget_instances`: visual configs
  - Prague: renderer (blocks + embeds)
  - Venice: embed assembly and caching surface
- **Localization leverage**: locale is a runtime parameter; overlays apply without changing IDs.

---

## 8) Acceptance criteria (v1)

1. Page JSON exists for at least one widget under `tokyo/widgets/{widget}/pages/` (overview + 4 subpages).
2. Prague renders blocks from Tokyo JSON for all five pages.
3. Blocks with `curatedRef.publicId` embed via Venice using that ID.
4. `navmeta` + `page-meta` are enforced by the registry.
5. No Paris endpoint or DevStudio flow relies on “website creative” or “template instance” concepts.

---

## 9) Open decisions (need a yes/no)

1) **Prague data fetch mode**
- A) Build-time read (SSG pulls JSON during build)
- B) Runtime fetch (SSR/edge reads JSON per request with caching)

2) **Missing curatedRef behavior in prod**
- A) Placeholder visual with explicit error label (recommended)
- B) Hide the visual entirely
