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
- `prague/content/allowlists/v1/**`

Do **not** repo-grep or read other folders unless explicitly instructed.

---

## 2) Allowed Outputs (files you may edit)

Default scope:
- `tokyo/widgets/{widget}/pages/{overview|templates|examples|features|pricing}.json`

Only if the PRD explicitly requires new string keys:
- `prague/content/allowlists/v1/blocks/{blockKind}.allowlist.json`

Do **not** edit:
- `tokyo/l10n/prague/**` (generated overlays)

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

### Step 2 — Update page JSON (layout + base copy)

File:
- `tokyo/widgets/{widget}/pages/{page}.json`

Rules:
- Layout + copy: `blocks[]` contains `id`, `type`, `copy`, and allowed meta fields (e.g. `visual`).
- Page JSON is the **single source of truth** for base copy; overlays overwrite `blocks[].copy` at runtime.
- `id` is unique and stable per page.
- `type` must match a registered block type.
- `visual` is only allowed for block types that support it (see registry). For embeds, use `curatedRef.publicId`.

Example shape:
```json
{
  "v": 1,
  "blocks": [
    { "id": "page-meta", "type": "page-meta", "copy": { "title": "...", "description": "..." } },
    { "id": "navmeta", "type": "navmeta", "copy": { "title": "...", "description": "..." } },
    { "id": "hero", "type": "hero", "copy": { "headline": "...", "subheadline": "..." }, "visual": true, "curatedRef": { "publicId": "wgt_curated_faq.lightblurs.v01" } },
    { "id": "minibob", "type": "minibob", "copy": { "heading": "...", "subhead": "..." } }
  ]
}
```

---

Required keys (current registry):
- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline`
- `split`: `headline`, `subheadline` (meta: `layout`, `curatedRef` allowed)
- `steps`: `title`, `items[]`
- `outcomes`: no required keys enforced yet (expects `items[]` when used)
- `cta`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

---

### Step 3 — Update allowlists only when required

If you add **new string keys** for an existing block type:
- Update `prague/content/allowlists/v1/blocks/{blockKind}.allowlist.json`

If you need a **new block type**, stop and ask (requires a PRD and registry update).

---

### Step 4 — Translation + verify (only when asked)

Do not call providers directly. Translation is system-owned:
- `pnpm prague:l10n:translate`
- `pnpm prague:l10n:verify`

These are run **only** with human approval.

---

## 5) Final Output Checklist

Before you finish:
- Every page has `page-meta` (and overview has `navmeta`).
- All block IDs are unique and stable.
- Every page JSON includes base copy for all block IDs.
- Base copy includes required keys for the block type.
- No compiled/overlay files were edited.

If any requirement is unmet, stop and ask.

---

## References (do not expand scope)

- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/capabilities/localization.md`
