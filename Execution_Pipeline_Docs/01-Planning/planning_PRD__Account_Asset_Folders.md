# Planning PRD - Account Asset Folders

Status: PLANNED - NOT BUILT (asset identity and batch-authority owner gate open)
Owner: Product + Architecture
Priority: P2 — Dieter operational foundation ready; awaiting owner authority choices
Date: 2026-07-14; architecture re-audited 2026-08-15
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

The original PRD 126M scope executed and remains historical evidence. The
reopened 126 convergence correction must close before this planning PRD is
promoted. That sequencing matters because it removes the old Roma UI foundation
this feature must not restore:

- **126M deleted the `.roma-input` and `.roma-table` visual bases** that would
  have forced the folder UI onto a parallel component family.
- **126M adopted Dieter's existing input and Table contracts** and PRD 127 now
  provides the controlled Data Table composition that the folder UI should use
  from day one: Textfield for folder naming, Dropdown Actions for choices,
  Data Table for selection/batch work, and Table for ordinary tabular structure.
- **The reopened 126 convergence gate is still authoritative**
  (`126_DevQA.md`). Asset folders must be designed against the converged Roma
  shell rather than carrying pre-126 drift.

The original 126M dependency is satisfied. Promotion to `02-Executing/` also
depends on closing the reopened 126 convergence gate and the remaining
decisions and pre-execution proof in §12.

## 3. Product law (what cannot change)

These are fixed by existing authority and the no-legacy-compatibility tenet:

- **One asset authority chain.** Roma → account asset route → Tokyo-worker →
  `accounts/{accountPublicId}/assets/{assetRef}` remains the only asset command
  and byte-storage path. Folders do not add a separate database or bypass that
  chain. Before execution, the owner must decide whether folder placement
  remains part of mutable `assetRef` or becomes metadata over an immutable
  `assetRef`; §6 records why current authorities make that distinction material.
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

**Implication:** the contract can technically address nested keys, but that does
not decide the product identity model. Multi-segment `assetRef` is one candidate;
immutable `assetRef` plus folder-placement metadata is the other. Neither is
current runtime truth until the owner closes §6.

## 5. Current constraints that the selected contract must address

Three current guards forbid folders by deliberate product decision, not accident:

1. **The storage-layer folder guard** — `directAccountAssetRefFromKey` at
   `tokyo-worker/src/domains/assets.ts:87-102`:
   ```js
   // Current PRD 100 product surface writes accepted account assets as direct
   // account-owned files. Folder UX can evolve later as an explicit contract.
   if (segments.length !== 1) return null;
   ```
   This rejects any assetRef with more than one segment. The comment itself names
   folders as a future explicit contract. Removing this guard is required only
   if §6 selects path-based placement. Immutable identity with placement
   metadata keeps asset keys flat. Do not alter the guard before that decision.

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
   action. This is the bulk of the visible work, but it must consume the exact
   backend authority selected in §6 rather than inventing client-side folder
   truth.

## 6. Move/rename and widget-instance references — OWNER GATE REOPENED

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

The 2026-07-14 product intent was that files move freely and existing Widget
references keep working. The 2026-08-15 authority audit proves the previously
written all-or-nothing implementation cannot be executed through current
authorities: R2 asset writes and each Roma/Tokyo instance save commit
independently, there is no transaction or compare-and-swap spanning them, and a
compensating save can itself fail. Calling sequential writes plus rollback
"atomic" would be V6 partial-success masquerade.

The owner must choose one honest contract before implementation:

1. **Mutable path identity with explicit partial results.** Folder placement
   remains part of `assetRef`. A move copies to the destination, retains the
   source while referencing instances are rewritten one at a time, returns
   exact per-asset and per-instance outcomes, and deletes the source only after
   full completion. Partial state and retry become visible product behavior.
2. **Immutable asset identity with mutable folder placement (recommended).**
   Widgets keep the existing stable `assetRef` and public URL. `folderPath` is
   account-owned placement metadata, so moving or renaming never rewrites a
   Widget instance. Current R2 object metadata can hold placement, but a
   multi-item move still returns exact partial results because separate object
   rewrites are not transactional.
3. **Immutable identity plus one CAS-managed account asset-library artifact.**
   One typed Tokyo/R2 account artifact owns folders and the complete
   `assetRef → folderPath` map. An ETag compare-and-swap makes one logical batch
   placement update atomic. This is new persisted machinery and requires
   explicit owner authorization, recovery law, and rollout proof.

Aliases and redirects remain excluded. The UX still targets Google Drive-style
free organization; the unresolved question is the truthful command/storage
contract underneath it.

## 7. Empty folders — UX DECIDED; STORAGE FOLLOWS §6

**Decision (product owner, 2026-07-14): empty folders are supported.** This
matches the Google Drive organizing model: users scaffold structure first
("Brand", "Logos", "Hero Images"), then populate it.

R2 has no empty-folder concept — a folder only "exists" as long as a file is
under its prefix. Marker objects remain the working candidate when folders are
path/prefix truth. If the owner selects the CAS asset-library artifact in §6,
that one artifact owns empty-folder truth instead; do not write both. Under the
marker candidate:

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

## 8. Folder and batch UX contract — PARTLY DECIDED

**Folder naming rules** (unchanged from existing validator): reuse the existing
segment regex `^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$` from `isExactAccountAssetRef`.
No new character set.

**Nesting depth limit — DECIDED: maximum 3 levels.** Example:
`brand/logos/main.png` is depth 3 (valid); `brand/logos/2026/main.png` is depth 4
(rejected). The assetRef 240-char limit (`isExactAccountAssetRef`) still applies
as the natural hard cap. The list/upload/move handlers reject any assetRef whose
segment count exceeds 3. The UX (breadcrumb, tree indentation, mobile rendering)
is designed for this depth.

**Folder rename** changes placement through the exact authority selected in §6.
It must not claim atomic completion when that authority returns partial results.

**Folder delete — DECIDED: cascade-delete with explicit confirmation.** Deleting
a folder prompts a confirmation that names what will be destroyed (the folder,
all assets inside it, all nested folders). On confirm, everything under the
prefix is deleted — assets, nested folder markers, and the folder marker itself.
On cancel, the action is aborted and nothing changes.

Deletion of a referenced asset is a separate open owner decision. Current
Widget contracts do not define one generic valid value after an image/video/font
reference is removed. The implementation must either block referenced deletion,
preserve an explicitly broken reference, or execute Widget-owned replacement
operations. It must not invent a generic fallback fill/font or silently remove
the value. There is no trash and no undo after an accepted deletion.

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

**Selection and batch work — DECIDED: required.** Assets is an operational
workspace, not a decorated flat list. Users can select one, many, or all
presented assets/folders; the selected count and exact allowed batch commands
remain visible; and each command returns truthful per-item or atomic results as
defined by §6. Roma will compose the consumer-agnostic Dieter Data Table rather
than adding an Assets-only selection/table system.

## 9. Scope

**In:**
- Folder-aware asset organization across contract, storage, upload, list, and UI.
- Folder navigation UI in the Roma Assets domain (breadcrumb, tree or list,
  create-folder, upload-into-folder, move, delete).
- Multi-select, select-all, selected-count, and exact batch move/delete actions.
- Move/rename operation with the owner-approved §6 semantics.
- Roma UI composed from Dieter Data Table, Badge, Banner, Spinner, Tooltip,
  Textfield, Dropdown Actions, Table, and Popup as each job requires.

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
| Asset identity and folder placement contract | Owner gate in §6; then `packages/ck-contracts` |
| Folder storage | Tokyo-worker in the existing account asset authority selected in §6 |
| Folder operations (create/list/move/delete) | Roma account asset routes → Tokyo-worker |
| Folder UX | Roma Assets domain (`assets-domain.tsx`) |
| Widget-reference integrity | Stable identity or explicit partial rewrite contract selected in §6 |
| Public serving | Unchanged — Tokyo-worker asset read |

## 11. Estimated effort on the post-126M foundation

| Layer | Effort | Notes |
| --- | --- | --- |
| Contract layer | Owner-gated | Exact shape follows the identity/placement decision; do not infer the model from a helper. |
| Storage layer | Owner-gated | Existing R2 authority remains; marker/metadata/CAS-artifact work depends on §6. |
| Upload handler (accept folder) | Low–Med | New `x-folder-path` or `x-asset-ref` header; existing validation extends. |
| List handler (folder-scoped + grouping) | Low | Add `folder` query param; return folder grouping from R2 prefix listing + markers. |
| **Move/rename handler** | **Owner-gated** | Metadata placement is small; visible partial path rewrites are hard; a CAS artifact is new persisted machinery. |
| **Folder cascade-delete** | **Owner-gated** | Requires the explicit referenced-asset deletion law in §8. |
| Empty-folder create/delete (markers) | Low–Med | Marker object write/delete; consistency rules from §7. |
| Roma folder UI (Drive-style) | Med | Breadcrumb, folders, search, controlled multi-select, batch toolbar, upload, and commands composed from Dieter Data Table and existing primitives. |
| E2E tests | Med | Folder CRUD, move with instance-ref integrity, nested navigation, search scope, empty folders, cascade-delete confirmation. |

No honest estimate is locked until the owner closes §6 and referenced deletion.

## 12. Remaining preconditions before promotion to `02-Executing/`

Historical foundation: **the original 126M scope executed and remains
evidence.** The folder UI will use Dieter Data Table and the existing Dieter
primitives where applicable, not the deleted `.roma-input`/`.roma-table`
families.

This PRD cannot move to execution until:

1. **The owner selects the §6 identity/placement and batch-result contract.**
2. **The owner selects referenced-asset deletion behavior** from the explicit
   choices in §8; no component or host may invent a generic replacement.
3. **The empty-folder authority is finalized** for the selected model (marker,
   metadata, or an explicitly approved CAS artifact).
4. **A V1-V8 pre-execution audit** covers move, batch, concurrent writes,
   referenced deletion, and partial-result presentation.

The visual/product intent from 2026-07-14 remains captured. The 2026-08-15
authority audit reopens only the identity, atomicity, and referenced-deletion
contracts that current Roma/Tokyo/R2 cannot truthfully implement as written.

## 13. V1-V8 planning audit

| ID | Risk for this feature | Mitigation |
| --- | --- | --- |
| V1 Silent substitution | A mutable-path move can leave broken previews; referenced deletion can tempt a generic replacement. | Select the identity law before coding and never invent a replacement fill/font/value. |
| V2 Silent healing | Folder creation must not normalize paths or invent missing parents. | The chosen folder authority writes only the one exact validated folder requested by the command. |
| V3 Silent omission | Batch commands can drop items or referenced-asset consequences. | Results enumerate every requested item and the chosen deletion law handles every reference explicitly. |
| V4 Fail-open control | Folder path validation must not relax existing SVG / MIME / size checks. | Reuse existing validators unchanged; only the path shape changes. |
| V5 Corruption-as-absence | Malformed folder truth must not become an empty or root folder. | The selected marker/metadata/artifact contract rejects malformed persisted truth visibly. |
| V6 Partial-success masquerade | Current R2 and instance writes cannot make a cross-object command atomic. | Either authorize one CAS batch authority or return exact partial outcomes; never label compensating writes atomic. |
| V7 Masquerade/redress | Must not ship a flat-list "compatibility" view beside the folder view. | The folder UX replaces the flat UX (no-legacy-compatibility tenet). |
| V8 Runtime test dependency | Folder behavior must not depend on test fixtures or probes. | Standard requirement; no special risk. |

## 14. Product decisions captured (2026-07-14) and authority correction (2026-08-15)

The 2026-07-14 decisions preserve product intent. Items 1 and 4 are no longer
implementation-ready after the 2026-08-15 authority audit:

1. **Move product intent (§6) — files organize freely.** The earlier
   path-rewrite/all-or-nothing mechanism is superseded by the open §6 authority
   gate; free movement remains the target.
2. **Empty folders (§7) — supported.** Users can create empty folders and
   populate them later. The storage representation follows the §6 authority;
   the alternative (no empty folders) breaks the scaffold-first workflow.
3. **Nesting depth (§8) — maximum 3 levels.** Keeps breadcrumbs, tree
   indentation, and mobile rendering usable. The assetRef 240-char limit remains
   the natural hard cap.
4. **Folder delete (§8) — explicit confirmation remains required.** The outcome
   for referenced assets is now an owner gate because current Widget contracts
   define no generic valid state after removing an asset reference.
5. **Search scope (§8) — global.** Search queries the whole account; results
   show each asset's folder path. Matches Google Drive default and preserves the
   current flat-search behavior.
6. **Timing (§2/§12) — 126M foundation satisfied.** This remains planning only.
   When promoted, the folder UI will build on the converged Roma shell.
7. **Selection/batch workspace (§8) — required.** Roma will use Dieter Data
   Table's controlled operational composition rather than an Assets-only table
   or selection system.
