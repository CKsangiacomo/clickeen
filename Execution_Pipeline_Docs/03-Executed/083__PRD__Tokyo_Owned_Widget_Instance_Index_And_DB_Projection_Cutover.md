# PRD 083: Tokyo-Owned Widget Instance Index And DB Projection Cutover

Status: 03-Executed
Date: 2026-05-05
Owner: Clickeen product architecture

PRD 103 NOTE: the product-boundary language in this historical PRD around `instances/index.json`, listed indexes, saved/live pointers, projections, and scripts writing indexes is not current authority. Current authority is `Execution_Pipeline_Docs/01-Planning/103__PRD__Saved_Instance_Localization_Runtime.md` plus the DB Pivot PRD. Any surviving index/pointer mechanism must be private implementation behind product operations or deleted.

## Product Decision

Tokyo owns editable widget instances.

Roma must list, open, rename, duplicate, publish, unpublish, and delete widget instances from Tokyo-owned instance state. Supabase/Michael may keep a relational projection for support, billing joins, audits, and repair, but it must not be the product source of truth for the Widgets page or Builder open path.

This PRD closes the current split-brain problem where Roma starts from DB rows and then tries to load Tokyo saved documents. That made DB-only ghosts appear as real product instances, and it made real account/admin/system behavior depend on whether two stores happened to agree.

## Plain-English Model

- A widget type is product code.
- A widget instance is an account-owned editable object.
- Admin-owned instances are normal account-owned instances.
- System instances are admin-owned instances that the product chooses to show as starters or embed in Prague.
- There is no separate template truth.
- There is no separate curated truth.
- There is no runtime fallback to DB config.

The boring SaaS rule is: the service that owns the object serves the object list.

For widget instances, that service is Tokyo.

## Current Failure

Roma Widgets currently starts with Berlin/Supabase registry data, then asks Tokyo for saved documents.

The dangerous shape is:

1. Berlin/Supabase returns public IDs from `widget_instances`.
2. Roma asks Tokyo for each saved document.
3. If Tokyo returns 404, Roma drops the instance from the UI.

That is why some admin-owned/system instances disappear from Roma Widgets. They exist as DB rows, but they do not have Tokyo saved documents. Roma hides them instead of treating the mismatch as a product integrity error.

Assets do not have the same bug because Assets already read from the Tokyo-owned asset plane. Widgets must work the same way.

## Target Architecture

### Tokyo

Tokyo owns the editable instance document and the account instance index.

Canonical keys:

```text
accounts/{accountId}/instances/index.json
accounts/{adminAccountId}/instances/listed-index.json
accounts/{accountId}/instances/{publicId}/saved/pointer.json
accounts/{accountId}/instances/{publicId}/saved/config/{configFingerprint}.json
accounts/{accountId}/instances/{publicId}/live/pointer.json
accounts/{accountId}/instances/{publicId}/live/config/{configFingerprint}.json
```

The index is not a second product truth. It is the Tokyo-owned list of Tokyo-owned saved instance documents.

`accounts/{accountId}/instances/index.json` lists the saved instances owned by that account.

`accounts/{adminAccountId}/instances/listed-index.json` is a derived discovery projection for admin-owned instances marked `listed: true`. It exists so regular accounts can see starter instances without asking DB for starter truth. It is not a template store, not a curated store, and not an admin storage lane. The source instances still live under the admin account like every other account-owned instance.

Each index entry must contain only product identity and routing fields:

```ts
type TokyoAccountInstanceIndexEntry = {
  // The owning account for the saved document. For listed starters this is the admin account.
  accountId: string;
  publicId: string;
  widgetType: string;
  displayName: string;
  kind: "user" | "system";
  listed: boolean;
  duplicable: boolean;
  listedSurfaces: string[];
  publishStatus: "published" | "unpublished";
  updatedAt: string;
};
```

Rules:

- The saved pointer is the record-level truth for editable document identity.
- The index is the Tokyo-owned materialized inventory built from saved pointers and live serve-state.
- The index entry must point to an existing saved pointer.
- The saved pointer must point to an existing saved config.
- Missing saved state is an integrity error, not an empty UI row and not a silent drop.
- Publish state comes from Tokyo live/serve state, not DB status.
- Listed starter discovery comes from the admin account's Tokyo listed index, not Berlin/Supabase.
- Duplicate source ownership comes from the Tokyo index entry `accountId`, not DB registry lookup.

Index writes must go through one Tokyo index writer. Do not let each route hand-edit index JSON differently. The writer must:

- load the current account index,
- validate every retained entry points to saved state,
- apply the one mutation,
- write the next index,
- and recover from write races by retrying from current R2 state or rebuilding the affected account index from saved pointers before returning success.

At Clickeen's expected shape of a few instances per account, a single account index is cheap to read and rewrite. The important rule is not clever storage. The important rule is one writer, one format, no stale DB fallback.

### Roma

Roma Widgets reads from Tokyo.

Roma does not ask Berlin/Supabase for the Widgets list. Roma may call Berlin for account/session/policy truth, but not for editable instance inventory.

Roma Builder opens a single Tokyo-owned instance document.

Roma Widgets receives two Tokyo-owned sets:

- `accountInstances`: saved instances owned by the current account.
- `listedInstances`: listed admin-owned starter instances that the current account may duplicate.

Roma duplicate uses the selected Tokyo index entry to know the source `accountId` and `publicId`. It must not call Berlin/Supabase to discover who owns the source.

### Berlin And Supabase/Michael

Berlin/Supabase keeps a projection only.

The projection can support:

- account joins
- audit/debugging
- quota/account reporting
- repair checks
- future search/reporting views

The projection cannot own:

- Widgets page inventory
- display name
- editable config
- publish status
- starter/system instance availability

Projection drift must be visible in health checks and repair logs. It must not change what the user sees in Widgets.

## Non-Negotiable Tenets

1. Tokyo is the surviving authority for widget instance documents and instance inventory.
2. DB rows are not product truth for widget instances.
3. No runtime fallback from Tokyo to `widget_instances.config`.
4. No silent 404 drops in Roma Widgets.
5. No separate curated/template/admin widget flow.
6. Admin-owned/system instances use the same account path as every other account instance.
7. Product write success means Tokyo document plus Tokyo index success.
8. DB projection failure is an operational repair problem, not a second product truth.
9. If an instance is missing Tokyo saved state, the product reports the mismatch clearly.
10. Delete old active paths after cutover. Do not leave old registry code as a shadow product path.
11. Publish cap counting uses Tokyo index plus Tokyo serve-state, not DB public-id lists.
12. Listed starter discovery uses Tokyo's admin-owned listed index, not a new template/curated service.

## Anti-Goals

- Do not build a new template service.
- Do not reintroduce curated assets or curated instances.
- Do not make Supabase config the backup source for Builder.
- Do not keep both DB-first and Tokyo-first listing paths.
- Do not add abstract catalog layers before the product needs them.
- Do not add a generic event system for this cutover.
- Do not create a global starter database table.
- Do not make the Tokyo listed index independently editable.

## Execution Plan

Each step must be green before moving to the next one.

### Step 1: Confirm Active Call Graph

Inspect and document the current active paths:

- Roma Widgets list
- Roma duplicate
- Roma rename
- Roma delete
- Roma publish/unpublish
- Roma Builder open
- Berlin registry routes
- Tokyo saved config routes
- Tokyo live/serve-state routes

Required output:

- One short execution note listing every active product path and its current owner.
- A deletion candidate list for old DB-first paths.

Green gate:

- We can name every place where Roma currently depends on Berlin/Supabase for widget instance inventory.

### Step 2: Add Tokyo Account Instance Index

Add Tokyo Worker support for:

- reading `accounts/{accountId}/instances/index.json`
- reading `accounts/{adminAccountId}/instances/listed-index.json` for listed admin-owned starters
- writing the index when saved instance state changes
- removing index entries when saved instance state is deleted
- updating publish status when live/serve state changes
- deriving listed starter entries from admin-owned saved pointers whose metadata says `listed: true`

The write boundary must update saved document state and index state together from the product point of view. A saved document without an index entry is invalid. An index entry without a saved document is invalid.

Implement one small Tokyo module for index mutation and validation. Do not spread read/modify/write logic across routes.

The listed index must be derived from the admin account's saved pointers and normal account index. It must not introduce a new starter object model.

Green gate:

- Tokyo typecheck passes.
- Unit or route-level tests prove:
  - saved write creates/updates index entry
  - delete removes index entry
  - publish/unpublish updates index publish status
  - admin-owned `listed: true` saved entries appear in the listed index
  - duplicate source entries include the source owning `accountId`
  - concurrent or repeated index writes cannot drop unrelated entries
  - index read fails loudly on broken saved pointers

### Step 3: Build One-Time Index Backfill

Create a one-time backfill/repair script that builds Tokyo indexes from existing Tokyo saved documents.

The script must:

- scan account instance saved pointers
- validate each pointer/config pair
- write account `index.json`
- write the admin account `listed-index.json` from listed admin-owned saved pointers
- report DB rows with no Tokyo saved document as ghosts
- report Tokyo saved documents with no DB projection as projection gaps

Important: this script may read old DB `widget_instances.config` only as an explicit historical import source for named broken rows. That is not a runtime fallback. After this migration, runtime code must never recover product config from DB.

Green gate:

- Script can run in dry-run mode.
- Dry-run reports counts before writing.
- Admin account shows all valid Tokyo saved instances in the generated account index.
- Admin account listed starters appear in the generated listed index.
- Ghost DB rows are reported, not hidden.

### Step 4: Cut Roma Widgets List To Tokyo

Change Roma `/api/account/widgets` so it reads the Tokyo account instance index.

Remove the active dependency on Berlin/Supabase registry data for the Widgets list.

Roma should group instances by `widgetType` using Tokyo index entries.

Roma Widgets should include:

- current-account instances from `accounts/{accountId}/instances/index.json`
- listed starter instances from the admin account listed index

Roma may still call Berlin for account auth, role, entitlement snapshot, and publish-containment state. It must not call Berlin/Supabase for instance inventory or starter discovery.

Green gate:

- Roma typecheck passes.
- Widgets page lists all Tokyo-indexed account instances.
- Widgets page lists listed admin-owned starters as duplicable entries for non-admin accounts.
- Missing Tokyo saved state produces a clear integrity error.
- There is no code path where a Tokyo 404 becomes a hidden row.

### Step 5: Cut Product Mutations To Tokyo Index

Update product mutations so Tokyo remains the write owner:

- create instance
- duplicate instance
- rename instance
- delete instance
- publish instance
- unpublish instance

Required behavior:

- Mutations write Tokyo saved/live/index state first.
- DB projection is updated after Tokyo success through projection-only code.
- DB projection errors are captured in a projection-gap report/repair path. A console log alone is not sufficient.
- DB projection errors do not become product truth.
- If Tokyo write/index update fails, the product mutation fails.
- Duplicate source lookup uses Tokyo index/source `accountId`, never Berlin/Supabase registry.
- Publish cap counting uses Tokyo account index plus Tokyo serve-state, never Berlin/Supabase public-id lists.

Green gate:

- Creating a new instance makes it appear in Widgets without requiring a DB registry read.
- Duplicating a system/admin instance creates a normal account instance.
- Duplicating a listed starter works because Roma knows the source owner from Tokyo.
- Rename changes the Widgets display name from Tokyo index.
- Publish/unpublish changes Widgets status from Tokyo state.
- Publish cap enforcement counts published current-account instances from Tokyo state.
- Delete removes the instance from Widgets by removing it from Tokyo index.

### Step 6: Demote Or Delete DB Registry Product Paths

Remove active product use of Berlin/Supabase widget registry routes.

Deletion candidates:

- `roma/lib/michael-catalog.ts` as active Widgets source
- Roma `/api/account/widgets` dependency on `loadAccountWidgetCatalog`
- Berlin `/v1/accounts/:accountId/widget-registry` as product inventory source
- Berlin account public-id registry helpers as product inventory source
- runtime reads of `widget_instances.config` for Builder product state
- runtime reads of `widget_instances.display_name` for Widgets display identity
- runtime reads of `widget_instances.status` for publish status
- Roma duplicate dependency on `getAccountInstanceCoreRow` for source ownership
- Roma publish dependency on `listAccountInstancePublicIds` for cap counting
- Roma delete dependency on `getAccountInstanceCoreRow` before deleting Tokyo state

Projection helpers may survive only if renamed/contained as projection maintenance. They must not be callable from product UI list/open truth.

Green gate:

- `rg "loadAccountWidgetCatalog|widget-registry|instances/public-ids"` shows no active Roma Widgets/open dependency.
- `rg "widget_instances.*config|config.*widget_instances"` shows no active runtime Builder recovery path.
- `rg "getAccountInstanceCoreRow|listAccountInstancePublicIds" roma/app roma/lib` shows no active product-path dependency for duplicate, delete, publish-cap, Widgets, or Builder open.
- Existing DB projection helpers are either deleted or clearly named as projection-only.

### Step 7: Product Smoke And Health Verification

Run product checks against dev:

- admin account login
- Roma Widgets list
- regular account Roma Widgets list with admin-owned starters visible as duplicable
- Roma Builder open for `wgt_main_*`
- Roma Builder open for `wgt_system_*`
- duplicate system/admin instance into account-owned instance
- rename duplicated instance
- publish/unpublish
- publish cap reached path
- delete duplicated instance
- Assets page remains unchanged
- Prague embeds that use admin/system instances still resolve through Tokyo live output

Green gate:

- Admin account Widgets shows every valid Tokyo-owned instance.
- Regular account Widgets shows current-account instances plus listed admin-owned starters.
- No valid instance is hidden because a DB/Tokyo mismatch exists.
- Broken instances are visible as health/integrity problems.
- Assets remains Tokyo-owned and unaffected.

## Code Blast Radius

### Tokyo Worker

Likely touched:

- `tokyo-worker/src/domains/render/keys.ts`
- `tokyo-worker/src/domains/render/saved-config.ts`
- `tokyo-worker/src/domains/render/storage.ts`
- new `tokyo-worker/src/domains/render/instance-index.ts` or equivalent small module
- `tokyo-worker/src/routes/internal-render-routes.ts`
- publish/unpublish serve-state owner in `tokyo-worker/src/domains/render/live-surface.ts`

Expected direction:

- Add Tokyo index read/write.
- Add listed starter index derivation for admin-owned listed entries.
- Route all index changes through one writer.
- Keep logic local to render/account-instance ownership.
- Do not add a generic catalog abstraction.

### Roma

Likely touched:

- `roma/app/api/account/widgets/route.ts`
- `roma/app/api/account/widgets/duplicate/route.ts`
- `roma/app/api/builder/[publicId]/open/route.ts`
- `roma/app/api/account/instance/[publicId]/route.ts`
- `roma/app/api/account/instances/[publicId]/publish/route.ts`
- `roma/app/api/account/instances/[publicId]/unpublish/route.ts`
- `roma/app/api/account/instances/[publicId]/rename/route.ts`
- `roma/lib/account-instance-direct.ts`
- `roma/lib/michael-instance-rows.ts`
- `roma/lib/michael-catalog.ts`

Expected direction:

- Widgets list reads Tokyo index.
- Builder open still reads one Tokyo saved document.
- Duplicate uses Tokyo source owner/publicId from index, then writes a Tokyo-owned target document.
- Publish cap checks count Tokyo-owned published instances.
- Delete removes Tokyo state/index before projection cleanup.
- Old DB-first catalog path is deleted or demoted after callers are gone.

### Berlin

Likely touched:

- `berlin/src/routes-account.ts`
- `berlin/src/registry/account-instance-registry.ts`
- registry-related route dispatch

Expected direction:

- Registry routes stop being product inventory.
- Projection support can remain only behind explicit projection naming.
- No product path should call Berlin for widget instance inventory.
- `publish-containment` can remain Berlin-owned account policy because it is account governance, not instance inventory.

### Supabase/Michael

Likely touched:

- projection maintenance only
- no destructive schema change required in the first cutover

Expected direction:

- `widget_instances` can remain as projection/audit data.
- `config`, `display_name`, and `status` must not be runtime product truth.
- Later cleanup can remove or narrow zombie columns after production confidence.

### Prague And Venice

Expected impact:

- No direct authoring change.
- Prague embeds must keep resolving admin/system instances through Tokyo live output.
- Venice read plane must continue serving live published output.

## Verification Commands

Run the relevant subset after each step, and the full set before closure:

```bash
./node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
./node_modules/.bin/tsc -p roma/tsconfig.json --noEmit
./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit
pnpm lint
pnpm typecheck
```

Codebase checks:

```bash
rg "loadAccountWidgetCatalog|widget-registry|instances/public-ids" roma berlin
rg "saved.status === 404|status === 404" roma
rg "widget_instances.*config|config.*widget_instances" roma berlin
rg "getAccountInstanceCoreRow|listAccountInstancePublicIds" roma/app roma/lib
rg "listed-index|instances/index" tokyo-worker roma
rg "curated|template" roma berlin tokyo-worker prague
```

The `curated|template` check is not expected to be zero everywhere because docs and UI copy may mention starter behavior. It is expected to show no active alternate product truth.

## Acceptance Criteria

This PRD is done only when:

1. Roma Widgets reads Tokyo account instance index, not Berlin/Supabase registry.
2. Admin account sees all valid admin-owned/system instances in Widgets.
3. Regular accounts see current-account instances plus listed admin-owned starters from Tokyo.
4. Duplicate source ownership comes from Tokyo index entry `accountId`, not Berlin/Supabase.
5. Publish caps count Tokyo-owned published instances, not DB public-id rows.
6. DB-only rows no longer appear as product instances.
7. Tokyo-only saved instances appear in Widgets even if DB projection lags.
8. Missing Tokyo saved state is reported as an integrity problem.
9. Duplicate, rename, publish, unpublish, and delete all update Tokyo state and index.
10. DB projection code is either deleted from the active product path or clearly contained as projection-only.
11. No runtime code recovers editable config from `widget_instances.config`.
12. No separate curated/template/admin flow remains for widget instances.
13. Verification commands pass.

## Why This Is The Right SaaS Shape

This is simple because every product question has one owner:

- "What instances does this account have?" Tokyo.
- "What is this instance called?" Tokyo.
- "What does this instance edit?" Tokyo.
- "Is this instance published?" Tokyo.
- "What account is allowed to do?" Berlin/account policy.
- "What relational projection helps reporting and repair?" Supabase/Michael.

That is the scalable shape for millions of accounts because the editor does not need to join across services to know what to show. The write owner can make one local object/index update, the UI can read one product-owned list, and repair jobs can fix projections without changing product truth.

The result is less code, fewer invisible failure modes, and a product path that matches the way users think: open account, see widgets, edit one widget, save to Tokyo.
