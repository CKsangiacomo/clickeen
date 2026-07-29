# Planning PRD - Account Asset Folders

Status: PLANNED - NOT BUILT (product decisions captured 2026-07-14)
Owner: Product + Architecture
Priority: P2 — 126M foundation satisfied; awaiting promotion
Date: 2026-07-14
Type: Planning PRD / feature design with product decisions captured

Origin: product request to let users organize account assets by folder, similar
to Google Drive, in the Roma Assets domain.

Related:
- `documentation/architecture/AssetManagement.md` — current asset authority chain
- `documentation/services/tokyo-worker.md` — asset handlers and R2 boundary
- `packages/ck-contracts/src/index.ts` — `isExactAccountAssetRef`, `encodeAssetRefPath`
- `tokyo-worker/src/domains/assets.ts` — `directAccountAssetRefFromKey` (the folder guard)
- `tokyo-worker/src/asset-utils.ts` — `validateUploadFilename` (rejects path separators)
- `roma/components/assets-domain.tsx` — current flat-list UI
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126M__PRD__Roma_UI.md` — sequenced predecessor
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126_DevQA.md` — foundation state

---

## 1. Purpose

Let users organize account assets into folders in the Roma Assets domain, so an
account with many assets can be browsed hierarchically instead of as one flat
list. The target experience is the Google Drive model: folder tree, breadcrumb
navigation, create/move/delete folders, upload into a folder, drag-to-move.

This PRD defines the asset-folder feature. It is **not** current runtime
authority and creates no implementation work until promoted into `02-Executing/`.

## 2. Why execution follows 126M

PRD 126M is executed and verified. That sequencing matters because it removed
the old Roma UI foundation this feature must not restore:

- **126M deleted the `.roma-input` and `.roma-table` visual bases** that would
  have forced the folder UI onto a parallel component family.
- **126M adopted the shared operational-field/operational-table contracts** that
  the folder UI should use from day one (folder rename input, folder-aware table
  rows, move dialog form controls).
- **The 126 foundation is green** (`126_DevQA.md`). Asset folders can now be
  designed against the converged Roma shell instead of carrying pre-126 drift.

The 126M dependency is satisfied. Promotion to `02-Executing/` now depends only
on the remaining decisions and pre-execution proof in §12.

## 3. Product law (what cannot change)

These are fixed by existing authority and the no-legacy-compatibility tenet:

- **One asset authority chain.** Roma → account asset route → Tokyo-worker →
  `accounts/{accountPublicId}/assets/{assetRef}`. Folders do not add a second
  storage authority, a parallel asset library, or a separate database. They are a
  path convention inside the existing assetRef contract.
- **No Supabase asset storage.** `SupabaseOperations.md` and `michael.md` forbid
  account runtime files in Supabase. Folders are not rows in an `asset_folders`
  table; they are R2 key prefixes (or marker objects — see §7).
- **No compatibility wrappers.** The pre-GA tenet forbids aliases, redirects, or
  parallel old/new paths. Once folders ship, the flat-list UX is replaced, not
  preserved beside the folder UX.
- **Source-truth fidelity.** Folder organization is account-owned product data.
  It is not integration-sourced; agents may reorganize it only through the
  explicit account asset routes.
- **Public serving is unchanged.** `clk.live` and asset CDN reads resolve the
  final assetRef the same way. Folder structure is an authoring/management
  concern; the public serving path is unaffected.

## 4. What the code already supports (the cheap part)

Verified against current source on 2026-07-14:

| Concern | Current state | Evidence |
| --- | --- | --- |
| Multi-segment assetRef in the contract | **Already accepted** | `isExactAccountAssetRef` at `packages/ck-contracts/src/index.ts:136-142` splits on `/`, validates each segment, rejects `.`/`..`/empty/control chars. `brand/logos/main.png` passes today. |
| URL encoding of folder paths | **Already folder-aware** | `encodeAssetRefPath` at `index.ts:144-146` encodes each segment and rejoins with `/`. |
| R2 key shape | **Already folder-shaped** | `accounts/{accountPublicId}/assets/{assetRef}` — a multi-segment assetRef produces a normal nested R2 key. |
| Folder-scoped listing | **Already available** | R2 `list({ prefix: 'accounts/CLICKEEN/assets/brand/' })` returns everything under that prefix. Used already by `listAccountAssetFilesByAccount` at `tokyo-worker/src/domains/assets.ts:167-197`. |
| Public asset URL resolution | **Folder-agnostic** | `parseAccountAssetRef` and `parseAccountAssetKey` at `index.ts:167-203` handle any valid segment count. |

**Implication:** the contract layer needs no breaking change to support folders.
The assetRef format is folder-ready by design; the system simply does not expose
or use multi-segment refs yet.

## 5. What actively blocks folders (the gates to remove)

Three current guards forbid folders by deliberate product decision, not accident:

1. **The storage-layer folder guard** — `directAccountAssetRefFromKey` at
   `tokyo-worker/src/domains/assets.ts:87-102`:
   ```js
   // Current PRD 100 product surface writes accepted account assets as direct
   // account-owned files. Folder UX can evolve later as an explicit contract.
   if (segments.length !== 1) return null;
   ```
   This rejects any assetRef with more than one segment. The comment itself names
   folders as a future explicit contract. **This PRD is that contract.** Removing
   this guard is the storage unlock, but it is a deliberate gate — do not remove
   it without resolving §7 (empty folders) and §8 (move semantics).

2. **Upload filename validation** — `validateUploadFilename` at
   `tokyo-worker/src/asset-utils.ts`:
   ```js
   if (filename.includes('/') || filename.includes('\\')) return { ok: false, detail: 'path separators are not allowed' };
   ```
   Upload currently takes a single flat `x-filename` header
   (`roma/app/api/account/assets/upload/route.ts:54`). To support folders, upload
   must accept either a target folder path (`x-folder-path`) or a fully-qualified
   `x-asset-ref` (`brand/logos/main.png`).

3. **The flat-list UI assumption** — `assets-domain.tsx` renders one flat list
   with search, single upload, bulk upload, delete, and storage usage. There is
   no breadcrumb, tree, create-folder affordance, folder navigation, or move
   action. This is the bulk of the visible work but it is pure frontend.

## 6. Move/rename and widget-instance references — DECIDED: Option A

**The constraint.** Widget instances store assetRefs as saved data. At
materialization time, `materializeImageFill` / `materializeVideoFill`
(`packages/ck-contracts/src/index.ts:380-399`) resolve `assetRef` → URL through
`readResolvedAssetByRef`. `AssetManagement.md:194-198` is explicit: "Replacing an
account asset can change delivered media without rewriting the widget package
that references it." A **move** that changes an asset's assetRef (e.g.
`logo.png` → `brand/logo.png`) breaks every widget instance that references the
old assetRef, because the old assetRef no longer resolves.

R2 has no native rename. Moving `a.png` → `folder/a.png` is `put` to the new key
+ `delete` the old key. There is no server-side redirect.

**Decision (product owner, 2026-07-14): Option A — rewrite referencing instance
configs on move.** Any asset moves freely; the system rewrites all widget
instance references transparently. This is the Google Drive model: files move
freely, references follow invisibly.

**Move operation contract:**

1. Roma move command receives `{ assetRef, targetFolderPath }`.
2. Tokyo-worker performs the R2 `put` (new key) + `delete` (old key).
3. Roma scans the account's widget instances for configs referencing the old
   assetRef (`collectConfigMediaAssetRefs` at `packages/ck-contracts/src/index.ts:360-378`).
4. For each referencing instance, Roma rewrites the assetRef to the new value
   through the normal account instance save path (Roma compiles, materializes,
   submits to Tokyo-worker).
5. The move succeeds only when the R2 put+delete **and** every instance rewrite
   succeed.

**All-or-nothing integrity rule.** If R2 put+delete succeeds but an instance
rewrite fails, the whole move is failed-visible: Roma reports the exact failed
instance coordinates, and the move is rolled back (re-put the old key, re-delete
the new key, leave instance configs untouched). Partial-success masquerade (V6)
is forbidden. The user never sees "moved successfully" with broken previews.

**Folder rename** is a bulk application of the same move contract: renaming
`brand/` → `branding/` rewrites every assetRef under that prefix and every
widget instance referencing any of them.

**Why the alternatives were rejected:**
- *Option B (forbid moving referenced assets)* — hostile to the organizing
  workflow. The assets users most want to organize are the ones they're using.
- *Option C (alias/redirect)* — violates the no-legacy-compatibility tenet
  (MAMA §1) and V1 (silent substitution). Out.

## 7. Empty folders — DECIDED: supported (marker objects)

**Decision (product owner, 2026-07-14): empty folders are supported.** This
matches the Google Drive organizing model: users scaffold structure first
("Brand", "Logos", "Hero Images"), then populate it.

R2 has no empty-folder concept — a folder only "exists" as long as a file is
under its prefix. To support empty folders, the system uses **marker objects**:

- Creating an empty folder writes a small marker object at
  `accounts/{accountPublicId}/assets/{folder-path}/.folder` (exact marker name
  finalized in execution PRD; must not collide with a valid asset filename — the
  leading `.` keeps it outside the assetRef segment regex
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$`).
- The list handler filters markers out of the asset list and uses them only to
  materialize folder rows.
- The assetRef validator continues to reject `.folder` as a segment, so markers
  are never user-addressable as assets.
- Move/delete/rename keep markers and content consistent: deleting the last asset
  under a folder leaves the marker (folder remains, now empty); deleting the
  folder deletes the marker too.

**Consistency rule.** A populated folder must never "disappear" because its
marker went missing (V5 corruption-as-absence). If a marker is absent but content
exists under the prefix, the folder is still shown — derived from content. If a
marker exists with no content, the folder is shown as empty. Markers are an
augmentation, not the sole source of folder truth.

**Why F1 (no empty folders) was rejected:** it breaks the most common organizing
workflow. Users would immediately ask why they can't create an empty folder, and
"R2 doesn't support it" isn't an answer they should ever encounter.

## 8. Folder contract — DECIDED

**Folder naming rules** (unchanged from existing validator): reuse the existing
segment regex `^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$` from `isExactAccountAssetRef`.
No new character set.

**Nesting depth limit — DECIDED: maximum 3 levels.** Example:
`brand/logos/main.png` is depth 3 (valid); `brand/logos/2026/main.png` is depth 4
(rejected). The assetRef 240-char limit (`isExactAccountAssetRef`) still applies
as the natural hard cap. The list/upload/move handlers reject any assetRef whose
segment count exceeds 3. The UX (breadcrumb, tree indentation, mobile rendering)
is designed for this depth.

**Folder rename** follows §6 Option A applied to every asset under the folder
prefix: renaming `brand/` → `branding/` rewrites every assetRef under that prefix
and every widget instance referencing any of them, all-or-nothing.

**Folder delete — DECIDED: cascade-delete with explicit confirmation.** Deleting
a folder prompts a confirmation that names what will be destroyed (the folder,
all assets inside it, all nested folders). On confirm, everything under the
prefix is deleted — assets, nested folder markers, and the folder marker itself.
On cancel, the action is aborted and nothing changes.

Cascade-delete must also handle widget-instance references for every asset under
the folder (same integrity concern as §6, but in bulk):
- **On confirm**, the delete operation cascades through (1) every referencing
  widget instance — the assetRef is removed from each config through the normal
  Roma save path — then (2) R2 deletes every object under the prefix.
- **All-or-nothing.** If any instance rewrite fails, the whole folder delete is
  failed-visible; no R2 objects are removed. The user sees the exact failed
  instance coordinates. Partial-success masquerade (V6) is forbidden.
- **There is no trash and no undo.** The confirmation dialog must make the
  irreversibility explicit. A misclick destroys assets widgets depend on;
  requiring the explicit "delete everything" confirmation makes that
  destruction intentional.

**Migration of existing flat assets — DECIDED: no forced migration.** All
existing assets sit at the root (single-segment assetRef). They remain at root;
the root is rendered as the default folder. Users can move them into folders
after the fact using the normal move operation.

**Search scope — DECIDED: global.** Search queries the whole account, not the
current folder. Results show each asset's full folder path
(e.g. `Brand / Logos / main.png`) as essential context. This matches the Google
Drive default and avoids regressing the current flat-search behavior (which is
already global). A "current folder only" filter is a secondary affordance, not
the default.

## 9. Scope

**In:**
- Folder-aware assetRef usage across contract, storage, upload, list, and UI.
- Folder navigation UI in the Roma Assets domain (breadcrumb, tree or list,
  create-folder, upload-into-folder, move, delete).
- Move/rename operation with the §6 chosen semantics.
- Roma UI built on the post-126M `.diet-operational-*` contracts.

**Out:**
- Shared/collaborative folders (no per-user folders; one folder structure per
  account, per the one-account product law).
- Folder-level permissions (the account role already gates asset operations).
- Folder as a public-serving concept (`clk.live` URLs stay asset-ref-based).
- Tags, labels, or other metadata beyond folder path.
- A Supabase `asset_folders` table.
- Connectors / integration-sourced assets (those are a separate, later track and
  blocked on broader foundation work).

## 10. Authority map

| Concern | Authority |
| --- | --- |
| Folder path contract | `packages/ck-contracts/src/index.ts` (existing assetRef format) |
| Folder storage | Tokyo-worker over `accounts/{accountPublicId}/assets/{folder}/...` |
| Folder operations (create/list/move/delete) | Roma account asset routes → Tokyo-worker |
| Folder UX | Roma Assets domain (`assets-domain.tsx`) |
| Widget-instance assetRef integrity on move | Roma save path + `materializeConfigMedia` resolution |
| Public serving | Unchanged — Tokyo-worker asset read |

## 11. Estimated effort on the post-126M foundation

| Layer | Effort | Notes |
| --- | --- | --- |
| Contract layer | Trivial | Mostly already supports folders; add `parseAssetRefFolder()` helper. |
| Storage layer (remove folder guard, add marker handling) | Low | One guard line in `directAccountAssetRefFromKey`; marker filter in list handler. |
| Upload handler (accept folder) | Low–Med | New `x-folder-path` or `x-asset-ref` header; existing validation extends. |
| List handler (folder-scoped + grouping) | Low | Add `folder` query param; return folder grouping from R2 prefix listing + markers. |
| **Move/rename handler (Option A)** | **Hard** | Per §6: R2 put+delete + scan referencing instances + rewrite all refs all-or-nothing, with rollback. This is the most complex single piece. |
| **Folder cascade-delete (Option A)** | **Med–Hard** | Per §8: bulk integrity check + rewrite + R2 prefix delete, all-or-nothing. Shares machinery with move. |
| Empty-folder create/delete (markers) | Low–Med | Marker object write/delete; consistency rules from §7. |
| Roma folder UI (Drive-style) | Med | Bulk of visible work; ~400-600 lines: breadcrumb, tree, create-folder, move modal, drag-drop, folder-scoped list. Must use `.diet-operational-*`. |
| E2E tests | Med | Folder CRUD, move with instance-ref integrity, nested navigation, search scope, empty folders, cascade-delete confirmation. |

**Rough total: 2-3 weeks for one engineer.** Option A's reference-rewriting
integrity machinery is the dominant cost; once that's built, folder rename and
cascade-delete reuse it.

## 12. Remaining preconditions before promotion to `02-Executing/`

Satisfied foundation: **126M is executed and verified.** The folder UI will be
built on `.diet-operational-*`, not the deleted `.roma-input`/`.roma-table`
families.

This PRD cannot move to execution until:

1. **The exact marker object name is finalized** in the execution PRD (`.folder`
   is the working name; it must be confirmed outside the assetRef segment regex).
2. **The integrity-check scope is finalized** for the cascade operations in §6
   and §8: which instance-scan helper is reused, how referencing instances are
   enumerated, and how the all-or-nothing rollback is implemented.
3. **A V1-V8 pre-execution audit** is written for the chosen design, especially
   covering move-integrity and cascade-delete failure modes (V1 silent
   substitution, V6 partial-success masquerade).

The §6/§7/§8 product decisions are captured (2026-07-14) and no longer block
promotion.

## 13. V1-V8 planning audit

| ID | Risk for this feature | Mitigation |
| --- | --- | --- |
| V1 Silent substitution | A move that fails to rewrite instance refs leaves broken previews that silently render nothing or a stale URL. | Move is all-or-nothing; any failed instance rewrite rolls the asset move back and fails visibly. |
| V2 Silent healing | Marker objects or implicit folder creation must not "heal" invalid paths. | Folder creation writes an explicit marker only after the complete path passes the existing segment and depth rules. |
| V3 Silent omission | Folder delete must not drop assets without rewriting their refs in instances. | Cascade delete rewrites every referencing instance first; any failed rewrite prevents all R2 deletion. |
| V4 Fail-open control | Folder path validation must not relax existing SVG / MIME / size checks. | Reuse existing validators unchanged; only the path shape changes. |
| V5 Corruption-as-absence | A missing marker must not make a populated folder disappear. | Folder rows derive from content prefixes as well as explicit empty-folder markers. |
| V6 Partial-success masquerade | Move, rename, or cascade delete must not report success after only part of the requested work completed. | The operation is all-or-nothing with rollback and exact failed instance coordinates. |
| V7 Masquerade/redress | Must not ship a flat-list "compatibility" view beside the folder view. | The folder UX replaces the flat UX (no-legacy-compatibility tenet). |
| V8 Runtime test dependency | Folder behavior must not depend on test fixtures or probes. | Standard requirement; no special risk. |

## 14. Product decisions captured (2026-07-14)

All six design questions are resolved. Rationale preserved for execution context:

1. **Move semantics (§6) — Option A: rewrite instance refs.** Any asset moves
   freely; the system rewrites all widget-instance references transparently and
   all-or-nothing. Matches Google Drive. Alternatives rejected: forbidding moves
   on referenced assets is hostile to the organizing workflow; aliases/redirects
   violate the no-legacy-compatibility tenet.
2. **Empty folders (§7) — supported via marker objects.** Users can create
   empty folders and populate them later. Matches the Google Drive organizing
   model. The alternative (no empty folders) breaks the scaffold-first workflow.
3. **Nesting depth (§8) — maximum 3 levels.** Keeps breadcrumbs, tree
   indentation, and mobile rendering usable. The assetRef 240-char limit remains
   the natural hard cap.
4. **Folder delete (§8) — cascade-delete with explicit confirmation.** Prompt
   names what will be destroyed; on confirm everything under the prefix is
   deleted (assets + nested markers + folder marker) with all-or-nothing
   reference integrity; on cancel nothing changes. No trash, no undo — the
   confirmation makes irreversibility explicit.
5. **Search scope (§8) — global.** Search queries the whole account; results
   show each asset's folder path. Matches Google Drive default and preserves the
   current flat-search behavior.
6. **Timing (§2/§12) — 126M foundation satisfied.** This remains planning only.
   When promoted, the folder UI will build on the converged Roma shell.
