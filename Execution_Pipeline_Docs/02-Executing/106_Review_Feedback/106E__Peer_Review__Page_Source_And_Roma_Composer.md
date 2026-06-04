# 106E Peer Review - Page Source And Roma Composer

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106E__PRD__Page_Source_And_Roma_Composer.md`

## Review Lens

106E is where Clickeen introduces the page source object.

The product model must stay simple:

```text
page = account-owned ordered list of widget instance placements
widget instance = the only source unit for placed content
Roma = authenticated UI/facade
Tokyo = page source operation authority
Page Materializer = later generated package compiler
```

No block inventory. No page-specific widget snapshots. No Roma-local source truth.

## Consolidated Verdict

106E is directionally correct but not execution-ready.

The right product shape is there:

- Pages are ordered compositions of widget instances.
- Roma gets a Pages area.
- Users can add existing widgets, create a widget and place it, reorder placements, remove placements, and open the placed instance in Bob.
- Page materialization and public serving are correctly out of scope.

The missing part is authority.

The PRD describes a UI and R2 folder shape, but it does not yet define:

- Tokyo-owned page operations;
- route/slug uniqueness authority;
- reverse placement index for recomposition;
- placement lifecycle when widget instances are deleted;
- strict V1 source validation;
- create-and-place failure behavior.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- Keeps pages as source metadata plus widget instance references.
- Does not copy widget config/content into page source.
- Keeps Bob editing one widget instance at a time.
- Keeps Page Materializer out of 106E.

Blocking gaps:

- Page source authority is unnamed.
- Current Tokyo internal routes cover instances, publish, translation, and widget definitions, but no pages.
- 106E can accidentally become Roma-local source unless it explicitly mirrors the widget route pattern.
- Source schema contains duplicate/future truth: `order`, `region`, `layout`, `canonicalPath`, locale overlays, publish folders.

### Architecture / Tenet Compliance

Compliant:

- No block object.
- No freeform canvas.
- No page-specific widget source.
- Removing a placement does not delete the widget instance.

Not compliant yet:

- Tokyo must own page operations, like it owns account instance operations.
- Invalid page state must fail at the page API boundary.
- Widget deletion cannot silently create stale page refs.

### Overarchitecture / Gold-Plating Risks

Do not build:

- page preview/materialization in 106E;
- page translation overlays;
- route files plus manifest plus source as competing truth;
- page-specific widget snapshots;
- page-mode Bob;
- graph service;
- block registry.

The V1 page source should be almost boring enough to be annoying:

```json
{
  "v": 1,
  "id": "page_home",
  "slug": "/",
  "head": {
    "title": "Home",
    "description": "",
    "robots": "index,follow"
  },
  "placements": [
    {
      "id": "plc_hero",
      "instanceId": "HERO123456",
      "overrides": {}
    }
  ]
}
```

Array order is the order.

### Simple / Boring Path

Add Roma `Pages` UI and `/api/account/pages*` routes. Those routes call Tokyo internal page operations. Tokyo stores `source.json` in the website workspace and updates page summary/slug/placement indexes.

Bob remains unchanged: open placed instance links to the existing Builder route for that instance.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- This is the first real product expression of “pages stack widgets.”
- Users can keep using the widget model they already understand.
- The first UI can be a vertical ordered list, which is enough.
- Opening a placed widget in Bob preserves the current editing workflow.

Product risks:

- Without a return path from Builder, users can be stranded after editing a placed widget.
- Create-new-and-place can fail halfway unless the failure behavior is explicit.
- Page Composer should not require standalone publishing each placed widget unless we intentionally accept that UX.
- Widget delete behavior must be obvious: users should not unknowingly break pages.

### Architecture / Tenet Compliance

Compliant:

- Page source references instance IDs.
- Removing a placement leaves the widget intact.
- Page materialization is not in scope.

Needs tightening:

- Roma must not own page storage.
- Bob must not gain page mode.
- Page source must fail invalid refs at the API boundary.
- Existing instance picker must use account widget summaries, not widget source.

### Overarchitecture / Complexity

Keep out:

- drag/drop canvas;
- page preview iframe;
- page publish;
- localized page overlays;
- page overrides;
- domains/nav/global site settings;
- A/B tests/personalization.

106E is just source + list composer.

### Simple / Boring Product Path

The user workflow should be:

1. Open `Pages`.
2. Create a page.
3. Set slug/title/description.
4. Add existing widget instances or create a new widget instance.
5. Reorder the list.
6. Open any placed widget in Bob.
7. Return to the page list/composer.

No other conceptual layer is needed.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- R2 website workspace is the right source storage neighborhood.
- Roma should reuse the current-account route pattern.
- Page source can remain static JSON.

P0 gap:

- 106F recomposition needs “find pages that place this instance.”
- If 106E stores placements only inside R2 `source.json`, 106F needs account-wide page scans.
- 106E must create a reverse placement index at the same time it saves page source.

### Systems That Talk To Each Other

Surviving systems:

- Roma `Pages`: UI and same-origin API facade.
- Tokyo page operations: list/create/read/save/delete page source.
- R2 website workspace: page `source.json`.
- Supabase/Tokyo index rows: page summaries, slug uniqueness, placement reverse lookup.
- Bob: edits one widget instance.
- 106F: reads page source and widget packages later.

No invented subsystem is required.

### SaaS-Grade Technical Bar

For scale:

- slug uniqueness cannot be an R2 scan;
- page summaries cannot require reading every page source;
- widget-save recomposition cannot scan all pages;
- deleting a placed widget must fail or invalidate through a named operation;
- page save must update source and indexes together or fail clearly.

### Recommended Sequence

106E can proceed as source/UI after its authority decisions are made.

It should not block on 106B runtime cleanup if it stays source-only. It must not attempt materialization/preview until 106B and 106F are ready.

## Consolidated Required PRD Decisions

Before executing 106E, decide:

1. **Page Source Authority**
   - Tokyo owns account page source operations.
   - Roma owns UI and same-origin route facade only.
   - Roma never writes page source directly.

2. **Exact API Contract**
   - Roma:

```text
GET    /api/account/pages
POST   /api/account/pages
GET    /api/account/pages/{pageId}
PUT    /api/account/pages/{pageId}
DELETE /api/account/pages/{pageId}
```

   - Tokyo internal routes mirror these product operations.

3. **Source Storage**
   - Source lives under:

```text
accounts/{accountPublicId}/website/pages/{pageId}/source.json
```

   - Page source is the editable source authority.
   - Manifest/index data is projection, not competing source.

4. **Index / Route / Dependency Authority**
   - Add indexed page records for listing and route uniqueness.
   - Add placement reverse index so 106F can resolve affected pages by `instanceId`.
   - No R2 scans for slug lookup, page listing, or widget-save recomposition.

5. **Route Truth**
   - Slug is mutable and never identity.
   - Tokyo validates normalized slug and unique `(account, slugKey)`.
   - Root `/` is allowed once per account.
   - Derive canonical path from slug in V1, or require equality.

6. **Source Schema Simplification**
   - Array order is placement order.
   - Remove `order`, or mark it derived-only.
   - V1 permits only `main/fullWidth`; better, omit `region/layout` until needed.
   - `overrides` must be empty in V1.
   - Do not create page locale overlays in 106E.

7. **Placement Integrity**
   - Every placement instance ID must exist in the same account.
   - Duplicate placement IDs fail.
   - Decide whether the same instance can appear twice on one page.
   - Deleting a placed widget instance must be blocked or handled by a named page-aware operation.
   - Recommended: block instance deletion while referenced.

8. **Create-New-And-Place Failure Model**
   - Either make it one Tokyo product operation, or accept explicit two-step behavior:
     - widget instance creation succeeds;
     - page placement save fails;
     - created widget remains a normal unplaced account widget.
   - Roma should not invent compensation deletion.

9. **Renderable Package Decision**
   - 106E should validate account ownership, not standalone publish availability.
   - The question of private composition packages vs published-only widgets belongs to 106B/106F, but 106E must not create a separate section publish mode.

10. **Builder Return Path**
   - Bob remains one-instance editing.
   - Add a Pages return context/route so editing a placed widget returns the user to the page composer.

## Suggested Acceptance Gates

106E should fail if:

- Roma `Pages` does not use current-account authz;
- browser code can read/replay the authz capsule;
- Roma writes page source directly instead of calling Tokyo;
- Tokyo page validator accepts invalid slug, duplicate slug, foreign instance, missing instance, duplicate placement id, non-empty overrides, invalid region/layout, or duplicate route;
- page save does not update page source and placement index coherently;
- 106F cannot resolve pages by placed `instanceId` without scanning R2;
- removing a placement deletes the widget instance;
- deleting a placed widget leaves stale page refs;
- Bob gains page mode;
- Page Composer/materialization/public serving leaks into this slice;
- any `block`, `section inventory`, or page-specific widget snapshot appears.

## Decision Status

Do not execute 106E as-is.

Keep the product direction, but define the page operation authority and indexes first. This PRD is the page source foundation. If it is loose, every later page materializer, edge route, personalization system, and A/B test inherits bad source truth.
