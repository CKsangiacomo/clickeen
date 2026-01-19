# AI Execution Guide — Build a Prague Page (Widget Marketing)

STATUS: EXECUTION GUIDE (AI ONLY)

This is a strict, step-by-step guide for AI agents. It is **not** a design doc. Do not improvise, search widely, or invent beyond the explicit inputs below.

If anything is unclear or missing, stop and ask the human.

---

## 0) Stop Conditions (ask before changing anything)

Stop and ask if:
- The widget type or target page is not explicitly provided.
- You need a new block type or a new block layout (requires PRD + block registry update).
- The request requires runtime changes in Prague, Bob, Paris, Venice, or Dieter.
- You need to modify compiled outputs or overlays directly.

---

## 1) Allowed Inputs (read-only)

Only read these:
- `documentation/architecture/CONTEXT.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/capabilities/localization.md`
- `prague/src/lib/blockRegistry.ts` (required keys + meta fields)
- `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`
- `prague-strings/base/v1/**`
- `prague-strings/allowlists/v1/**`

Do **not** repo-grep or read other folders unless explicitly instructed.

---

## 2) Allowed Outputs (files you may edit)

Default scope:
- `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`
- `prague-strings/base/v1/widgets/{widget}/blocks/{blockId}.json` (overview)
- `prague-strings/base/v1/widgets/{widget}/{page}/blocks/{blockId}.json` (subpages)

Only if the PRD explicitly requires new string keys:
- `prague-strings/allowlists/v1/blocks/{blockKind}.allowlist.json`

Do **not** edit:
- `prague-strings/compiled/**` (generated)
- `prague-strings/overlays/**` (generated)
- `scripts/prague-localize.mjs` (deprecated)

---

## 3) Forbidden Actions (non-negotiable)

- Do not add new block types or change the block registry.
- Do not add new runtime logic in Prague.
- Do not create locale-specific IDs or file paths.
- Do not write copy that is not in the PRD.
- Do not manually edit compiled or overlay files.

---

## 4) Execution Steps (do in order)

### Step 1 — Choose block stack (existing block types only)

Use only block types in `prague/src/lib/blockRegistry.ts`.

Required non-visual blocks:
- `navmeta` (overview only; required for mega menu)
- `page-meta` (all widget pages; required for SEO `<head>`)

If a required block is missing or the block type does not exist, stop and ask.

---

### Step 2 — Update page JSON (layout only)

File:
- `tokyo/widgets/{widget}/pages/{page}.json`

Rules:
- Layout only: `blocks[]` contains `id`, `type`, and allowed meta fields (e.g. `visual`).
- **No copy** in page JSON. Copy always lives in `prague-strings/base` and compiled strings **overwrite** any inline `copy`.
- `id` is unique and stable per page.
- `type` must match a registered block type.
- `visual` is only allowed for block types that support it (see registry). For embeds, use `curatedRef.publicId`.

Example shape:
```json
{
  "v": 1,
  "blocks": [
    { "id": "page-meta", "type": "page-meta" },
    { "id": "navmeta", "type": "navmeta" },
    { "id": "hero", "type": "hero", "visual": true, "curatedRef": { "publicId": "wgt_curated_faq.liquid_glass.v01" } },
    { "id": "minibob", "type": "minibob" }
  ]
}
```

---

### Step 3 — Add base strings (one file per block instance)

Overview page strings:
- `prague-strings/base/v1/widgets/{widget}/blocks/{blockId}.json`

Subpage strings:
- `prague-strings/base/v1/widgets/{widget}/{page}/blocks/{blockId}.json`

File shape (required):
```json
{
  "v": 1,
  "blockId": "hero",
  "blockKind": "hero",
  "strings": {
    "headline": "...",
    "subheadline": "..."
  }
}
```

Rules:
- `blockId` must equal the `id` in page JSON.
- `blockKind` must equal the `type` in page JSON.
- `strings` must contain all required keys for the block type (see `blockRegistry`).
- Use only ASCII unless the PRD provides non-ASCII.

Required keys (current registry):
- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline`
- `split-creative-left|right|stacked`: `headline`, `subheadline`
- `steps`: `title`, `items[]`
- `cta`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

---

### Step 4 — Update allowlists only when required

If you add **new string keys** for an existing block type:
- Update `prague-strings/allowlists/v1/blocks/{blockKind}.allowlist.json`

If you need a **new block type**, stop and ask (requires a PRD and registry update).

---

### Step 5 — Translation + compile (only when asked)

Do not call providers directly. Translation is system-owned:
- `pnpm prague:strings:translate`
- `pnpm prague:strings:compile`

These are run **only** with human approval.

---

## 5) Final Output Checklist

Before you finish:
- Every page has `page-meta` (and overview has `navmeta`).
- All block IDs are unique and stable.
- Every block has a matching base strings file.
- Base strings include required keys for the block type.
- No compiled/overlay files were edited.

If any requirement is unmet, stop and ask.

---

## References (do not expand scope)

- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/capabilities/localization.md`
