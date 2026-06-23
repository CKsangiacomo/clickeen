# AI Execution Guide — Build a Prague Page (Widget Marketing)

STATUS: EXECUTION GUIDE (AI ONLY)

This is a strict, step-by-step guide for AI agents. It is an execution guide for
one bounded Prague marketing-page edit.

This guide is only for Prague widget marketing JSON. Account pages are stacks of
saved widget instances and are governed by Roma/Tokyo account page contracts.

If anything is unclear or missing, stop and ask the human.

---

## 0) Stop Conditions (ask before changing anything)

Stop and ask if:

- The widget type or target page is not explicitly provided.
- You need a new Prague marketing section type or layout (requires PRD + registry update).
- The request requires runtime changes in Prague, Bob, Roma, Tokyo-worker, Venice, or Dieter.
- You need to modify compiled outputs or generated translation sidecars directly.

---

## 1) Allowed Inputs (read-only)

Only read these:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/capabilities/localization.md`
- `prague/src/lib/blockRegistry.ts` (Prague marketing-section required keys + meta fields)
- `tokyo/prague/pages/{widget}/{overview|templates|examples|features|pricing}.json` (repo-authored source; deployed R2 home is `prague/pages/**`)
- `prague/content/allowlists/current/**`

Read only this scope for a Prague marketing-page edit.

---

## 2) Edit Scope

Default scope:

- `tokyo/prague/pages/{widget}/{overview|templates|examples|features|pricing}.json`

Only if the PRD explicitly requires new string keys:

- `prague/content/allowlists/current/blocks/{blockKind}.allowlist.json`

Generated translation sidecars are outside this default edit scope:

- Prague generated page translation sidecars unless the task is explicitly localization work (`tokyo/prague/pages/{widget}/{page}.translations/{locale}.json`)

---

## 3) Scope Boundaries

- New Prague marketing section types require a PRD and registry update.
- Runtime logic changes belong to a runtime task, not a marketing-page JSON edit.
- IDs and file paths are base-language page identities.
- Account-widget locale availability comes from account widget runtime truth.
- Page copy comes from the PRD or explicit user instruction.
- Compiled files and generated translation sidecars are generated artifacts.

---

## 4) Execution Steps (do in order)

### Step 1 — Choose marketing section stack (existing section types only)

Use only Prague section types in `prague/src/lib/blockRegistry.ts`.

Required non-visual sections:

- `navmeta` (overview only; required for mega menu)
- `page-meta` (all widget pages; required for SEO `<head>`)

If a required section is missing or the section type does not exist, stop and ask.

---

### Step 2 — Update page JSON (layout + base copy)

File:

- `tokyo/prague/pages/{widget}/{page}.json`

Rules:

- Layout + copy: Prague page JSON contains `blocks[]` section entries with `id`, `type`, `copy`, and allowed meta fields (e.g. `visual`).
- Page JSON is the **single source of truth** for base copy; page-owned translation sidecars apply localized Prague copy at runtime.
- `id` is unique and stable per page.
- `type` must match a registered Prague section type.
- `visual` is only allowed for section types that support it (see registry). For embeds, use `accountInstanceRef.accountPublicId` + `accountInstanceRef.instanceId` only when the page intentionally points at a real account widget instance.
- Admin examples are normal account-owned instances under account `CLICKEEN`.
- `accountInstanceRef.locale` is allowed only as an explicit public artifact selector for authored carousel items. It is not translation state, locale availability, or an instruction to discover widget locales.
- Account instance references use `accountPublicId + instanceId`.

Example shape:

```json
{
  "blocks": [
    { "id": "page-meta", "type": "page-meta", "copy": { "title": "...", "description": "..." } },
    { "id": "navmeta", "type": "navmeta", "copy": { "title": "...", "description": "..." } },
    {
      "id": "hero",
      "type": "hero",
      "copy": { "headline": "...", "subheadline": "..." },
      "visual": true,
      "accountInstanceRef": { "accountPublicId": "CLICKEEN", "instanceId": "UZ3JEJSHII" }
    },
    { "id": "minibob", "type": "minibob", "copy": { "heading": "...", "subhead": "..." } }
  ]
}
```

---

Required keys (current Prague section registry):

- `big-bang`: `headline`, `body`
- `hero`: `headline`, `subheadline`
- `split`: `headline`, `subheadline` (meta: `layout`, `accountInstanceRef` allowed)
- `steps`: `title`, `items[]`
- `outcomes`: no required keys enforced yet (expects `items[]` when used)
- `cta`: `headline`, `subheadline`
- `minibob`: `heading`, `subhead`
- `navmeta`: `title`, `description`
- `page-meta`: `title`, `description`

---

### Step 3 — Update allowlists only when required

If you add **new string keys** for an existing section type:

- Update `prague/content/allowlists/current/blocks/{blockKind}.allowlist.json`

If you need a **new Prague section type**, stop and ask; that change requires a
PRD and registry update.

---

### Step 4 — Translation + verify (only when asked)

Translation runs through system-owned commands:

- `pnpm prague:l10n:translate`
- `pnpm prague:l10n:verify`

These are run **only** with human approval.

---

## 5) Final Output Checklist

Before you finish:

- Every page has `page-meta` (and overview has `navmeta`).
- All block IDs are unique and stable.
- Every page JSON includes base copy for all block IDs.
- Base copy includes required keys for the Prague section type.
- No compiled files or generated translation sidecars were edited.

If any requirement is unmet, stop and ask.

---

## References

- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/capabilities/localization.md`
