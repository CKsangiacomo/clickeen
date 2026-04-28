# 081A PRD - Tokyo R2 Account Asset Storage Hard Cut

Status: READY FOR EXECUTION
Owner: Tokyo-worker, Roma, Bob, Venice, docs
Priority: P0
Date: 2026-04-28

## 1. Product Truth

Clickeen assets are simple.

- One account owns an asset.
- One upload creates one new asset id.
- A new file means a new asset id.
- An asset is never replaced in place.
- Builder config stores logical asset identity, not storage paths.
- Runtime materialization turns that asset id into a public URL.
- Admin assets are normal assets owned by the admin account.

There is no surviving product concept called asset versioning.

The account is the owner. The asset id is the identity. That is enough.

## 2. Problem

Tokyo R2 and Tokyo-worker still preserve old asset storage ideas.

The current R2 bucket shows these top-level roots:

```txt
accounts/
assets/
curated-assets/
l10n/
public/
renders/
tmp/
widgets/
workspace-assets/
```

Some of those are expected projections or product static roots. Others are toxic legacy roots.

The worse problem is active code: Tokyo-worker still writes account asset blobs under a versioned path:

```txt
accounts/<accountId>/assets/versions/<assetId>/<sha256>/<filename>
```

That shape is wrong because:

- it teaches the system that one asset can have multiple versions
- it makes R2 hard to understand by account
- it keeps hash/fingerprint identity in the asset path
- it conflicts with the product truth that one upload creates one asset id
- it keeps old vocabulary alive in code, docs, scripts, and public URLs

PRD 79 correctly killed owner-type storage concepts, but it incorrectly preserved `accounts/<accountId>/assets/versions/...`. This PRD supersedes the asset-storage subsection of PRD 79.

## 3. Final R2 Storage Shape

Runtime R2 storage must be account-first.

### 3.1 Account asset source truth

Final asset source truth:

```txt
accounts/
  <accountId>/
    assets/
      <assetId>/
        manifest.json
        blob/
          <filename>
```

Rules:

- `accountId` is the owner boundary.
- `assetId` is the asset identity.
- `filename` is validated at upload and then stored as-is.
- `sha256` may remain metadata in `manifest.json` for integrity only.
- `sha256` must not be part of the storage path.
- No `versions/` segment may exist in new writes.
- No `assetRef` or storage key may be stored in Bob authoring config.

Manifest shape:

```ts
type AccountAssetManifest = {
  assetId: string;
  accountId: string;
  assetType: "image" | "vector" | "video" | "audio" | "document" | "other";
  contentType: string;
  sizeBytes: number;
  sha256: string;
  filename: string;
  blobKey: string;
  createdAt: string;
  source?: {
    publicId?: string;
    widgetType?: string;
  };
};
```

The manifest may carry a private `blobKey`, but product APIs and authoring config must not require callers to understand it.

### 3.2 Public asset read path

Final public read path:

```txt
/assets/account/<accountId>/<assetId>/<filename>
```

It maps to:

```txt
accounts/<accountId>/assets/<assetId>/blob/<filename>
```

Rules:

- No `/assets/v/...` path for new materialized config.
- No encoded full R2 key in public URLs.
- Tokyo-worker validates the path against the manifest before serving the blob.
- Cache headers can remain long-lived because asset ids are immutable.
- Delete removes the blob and manifest; future reads return 404.

### 3.3 Public instance projections

Public embed projections remain separate from account truth:

```txt
public/
  instances/
    <publicId>/
      ...
```

Public projections are allowed. They are not account source truth.

### 3.4 Product static roots

These roots are allowed only when they are product static assets or public projections:

```txt
widgets/
fonts/
public/
accounts/
```

If Roma or Prague static resources are backed by R2 in a given environment, their roots must be named by the product surface:

```txt
roma/
prague/
```

They must not be mixed with account asset storage.

## 4. Forbidden R2 Roots And Paths

These must not survive as live write/read paths:

```txt
workspace-assets/
curated-assets/
admin-owned/
assets/
l10n/
renders/
tmp/
accounts/<accountId>/assets/versions/
```

Details:

- `workspace-assets/` is workspace-era legacy. Delete after inventory confirms no current code reads it.
- `curated-assets/` is owner-type legacy. Admin assets live under the admin account.
- `admin-owned/` must not exist in R2 or Git as runtime truth.
- Root `assets/` is forbidden as source truth. Public HTTP may be `/assets/...`, but R2 source truth is under `accounts/...`.
- Root `l10n/` and root `renders/` are forbidden as source truth. Current public route URLs may exist, but their R2 backing must be `public/instances/...`.
- `tmp/` must not be durable product storage. If upload scratch exists, it must be short-lived and explicitly TTL-owned. Otherwise delete it.
- `accounts/<accountId>/assets/versions/` is forbidden because asset versioning is dead.

## 5. Current Active Toxic Paths

The execution must remove or replace these active versioning paths.

### Tokyo-worker

- `tokyo-worker/src/asset-utils.ts`
  - remove `buildAccountAssetVersionPath`
  - replace `buildAccountAssetKey(accountId, assetId, versionFingerprint, filename)`
  - replace `normalizeCanonicalAccountAssetSuffix`
  - replace version-path parsing with account asset path parsing

- `tokyo-worker/src/domains/assets-handlers.ts`
  - stop writing `accounts/<accountId>/assets/versions/...`
  - stop listing `accounts/<accountId>/assets/versions/`
  - list account asset manifests from `accounts/<accountId>/assets/*/manifest.json`
  - delete by `accounts/<accountId>/assets/<assetId>/...`
  - return public URLs from `/assets/account/<accountId>/<assetId>/<filename>`

- `tokyo-worker/src/domains/account-instance-sync.ts`
  - materialize runtime config from `assetId` to the new public URL
  - do not call `buildAccountAssetVersionPath`

- `tokyo-worker/src/routes/render-routes.ts`
  - replace `/assets/v/*` parsing with `/assets/account/*`
  - remove the variable name `accountAssetVersion`

- `tokyo-worker/wrangler.toml`
  - replace route pattern `tokyo.dev.clickeen.com/assets/v/*`

### Shared contracts

- `packages/ck-contracts/src/index.js`
  - remove version names and version regexes
  - replace `parseCanonicalAssetRef` with account asset URL parsing
  - remove `isCanonicalAssetVersionRef`
  - remove `toCanonicalAssetVersionPath`

- `packages/ck-contracts/src/index.d.ts`
  - remove matching version types
  - expose only account asset URL helpers needed by active callers

### Bob / Roma / Venice

- `bob/app/assets/v/[...path]/route.ts`
  - replace with the new asset proxy path or delete if no longer needed

- `venice/app/assets/v/[...path]/route.ts`
  - replace with the new asset proxy path or delete if no longer needed

- `venice/lib/tokyo.ts`
  - stop treating `/assets/v/` as the account asset path

- `roma/components/assets-domain.tsx`
  - stop showing or keying user-facing rows by `assetRef` if `assetId` is sufficient
  - keep storage internals out of the product surface

### Scripts and docs

- `scripts/dev/seed-local-platform-assets.mjs`
  - remove version-token parsing
  - seed assets into the final account asset shape
  - stop creating `/assets/v/...` refs

- `documentation/architecture/AssetManagement.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/michael.md`
- `documentation/services/bob.md`

All docs must stop saying `assets/versions` and `/assets/v`.

### Supabase migrations

These migrations encode the old version-ref model:

- `supabase/migrations/20260224103000__hard_cut_legacy_asset_paths_to_version_refs.sql`
- `supabase/migrations/20260225103000__promote_logofill_asset_urls_to_version_refs.sql`
- `supabase/migrations/20260224113000__strip_legacy_fill_media_src_fields.sql`

Execution rule:

- Do not let local reset or seed paths create version refs.
- If these migrations still affect current reset data, replace them with the new asset-id model or retire the reset dependency.
- If they are purely historical applied migrations with no current runtime effect, they may remain only as inert history. They must not be cited by current docs as the active contract.

## 6. R2 Cleanup Plan

Do not manually delete bucket roots before code stops writing them.

The cleanup has to happen in this order:

1. Inventory R2 by prefix.
2. Classify each prefix as current, projection, or legacy.
3. Build an idempotent migration script in dry-run mode.
4. Copy existing account asset manifests and blobs to the new shape while the old deployed code still reads the old shape.
5. Verify copied manifests/blobs and confirm the live product still works before deploying no-fallback runtime code.
6. Change active code to write and read only the new asset shape.
7. Deploy the no-fallback runtime code.
8. Re-sync public projections for affected instances.
9. Verify Roma Assets and Builder can list, apply, save, publish, and render assets.
10. Verify old version URLs are no longer emitted by active responses.
11. Delete legacy R2 roots after explicit approval of the deletion list.

Required inventory output:

```txt
prefix
objectCount
sampleKeys
classification
action
```

Required classifications:

```txt
keep-current
keep-public-projection
migrate-then-delete
delete-now-if-empty
blocked-needs-owner-check
```

The intended final R2 top level for Tokyo assets dev is:

```txt
accounts/
public/
widgets/
fonts/
```

Optional only if actually used by deployed static products:

```txt
roma/
prague/
```

No other durable roots should remain.

## 7. Migration Rules

This is pre-GA, but assets already affect visible Builder behavior. The migration must be direct, not compatibility-heavy.

### 7.1 Existing asset migration

For every manifest currently at:

```txt
accounts/<accountId>/assets/meta/<assetId>.json
```

and every blob currently at:

```txt
accounts/<accountId>/assets/versions/<assetId>/<sha256>/<filename>
```

write:

```txt
accounts/<accountId>/assets/<assetId>/manifest.json
accounts/<accountId>/assets/<assetId>/blob/<filename>
```

Then update the manifest:

- keep `assetId`
- keep `accountId`
- keep `assetType`
- keep `contentType`
- keep `sizeBytes`
- keep `sha256`
- set `filename`
- set `blobKey`
- remove public-facing `assetRef` from the product API response

### 7.2 Saved instance configs

Saved authoring config must already store logical `assetId` for migrated media surfaces.

Execution must verify:

- no saved account config depends on `/assets/v/...`
- no saved account config depends on `asset.versionId`
- no saved account config depends on a raw R2 key

If any such config exists, migrate it to `assetId` or fail the execution. Do not add a fallback.

### 7.3 Public projections

After migration, re-sync live/public projections for affected instances so materialized config packs emit:

```txt
/assets/account/<accountId>/<assetId>/<filename>
```

not:

```txt
/assets/v/<encodedVersionKey>
```

## 8. Execution Gates

Do not move to the next step unless the current gate is green.

### Gate 1 - Inventory

Green means:

- R2 prefix inventory exists.
- Every current top-level root is classified.
- Current write paths are listed.
- Migration and deletion candidates are named.

### Gate 2 - Migration tool and dry run

Green means:

- an idempotent migration script exists
- dry-run output lists source manifest/blob keys and destination manifest/blob keys
- dry-run output reports conflicts, missing blobs, malformed manifests, and skipped objects
- no write/delete is performed in dry-run mode
- migration output is reviewable before any R2 write

### Gate 3 - R2 data copy before no-fallback deploy

Green means:

- existing account asset blobs are copied to the final shape
- existing manifests are rewritten/copied to the final shape
- copied manifests point to `accounts/<accountId>/assets/<assetId>/blob/<filename>`
- old `accounts/<accountId>/assets/versions/` objects still exist during this gate
- old deployed code can still serve the product during this gate
- migration is idempotent for retry

### Gate 4 - Contract replacement

Green means:

- `packages/ck-contracts` has no `AssetVersion` naming.
- `tokyo-worker/src/asset-utils.ts` has no `versions` storage path.
- Public asset parse/build helpers use `/assets/account/...`.

Search must return no active hits for:

```txt
assets/versions
toCanonicalAssetVersionPath
isCanonicalAssetVersionRef
AssetVersion
/assets/v
```

Historical migrations may appear only if explicitly marked inert in the PRD execution notes.

### Gate 5 - Tokyo-worker asset path

Green means:

- Upload writes one blob to `accounts/<accountId>/assets/<assetId>/blob/<filename>`.
- Upload writes one manifest to `accounts/<accountId>/assets/<assetId>/manifest.json`.
- List reads manifests from the final shape.
- Resolve returns final public URLs.
- Delete removes manifest and blob.
- Integrity checks compare final manifest/blob paths.

### Gate 6 - Builder and public render path

Green means:

- Roma Assets page lists existing account assets.
- Builder asset picker lists account assets.
- Applying an asset updates Bob preview.
- Saving persists only logical asset ids.
- Publishing/materializing emits final public asset URLs.
- Venice can serve a published widget with asset URLs.

### Gate 7 - Legacy root deletion

Green means:

- old `accounts/<accountId>/assets/versions/` objects are no longer referenced by active manifests or materialized public config
- old `accounts/<accountId>/assets/meta/` manifests are no longer referenced
- a deletion candidate list has been explicitly approved
- `workspace-assets/` deleted.
- `curated-assets/` deleted.
- root `assets/` deleted unless proven to contain current product static data, in which case move it to the correct product root first.
- root `l10n/` deleted unless proven to be a deployed projection, in which case move it under `public/instances/...`.
- root `renders/` deleted unless proven to be a deployed projection, in which case move it under `public/instances/...`.
- `tmp/` deleted or converted to a TTL-owned scratch path with no durable product meaning.
- `accounts/*/assets/versions/` deleted after migration verification.

## 9. Blast Radius

This is wide and must be treated as a storage hard cut.

### Runtime services

- Tokyo-worker asset upload/list/resolve/delete/read
- Tokyo-worker instance sync/materialization
- Roma Assets page
- Roma Builder host asset commands
- Bob asset controls and preview materialization
- Venice asset proxy and public embed render
- Local seed scripts for admin account starter assets

### Data

- R2 account asset blobs
- R2 account asset manifests
- Public instance config packs that include asset URLs
- Any saved config residue that still stores version refs

### Docs

- Asset management contract
- Tokyo-worker service docs
- Clickeen technical context
- Overview docs
- Michael docs that still describe asset storage
- Bob docs that describe `/assets/v`

### Approximate touched file set

The main blast-radius files are about 5,400 LOC combined today:

```txt
tokyo-worker/src/asset-utils.ts
tokyo-worker/src/domains/assets-handlers.ts
tokyo-worker/src/domains/account-instance-sync.ts
tokyo-worker/src/routes/render-routes.ts
packages/ck-contracts/src/index.js
packages/ck-contracts/src/index.d.ts
bob/app/assets/v/[...path]/route.ts
venice/app/assets/v/[...path]/route.ts
scripts/dev/seed-local-platform-assets.mjs
documentation/architecture/AssetManagement.md
documentation/services/tokyo-worker.md
documentation/services/michael.md
documentation/architecture/CONTEXT.md
documentation/architecture/Overview.md
```

Expected net LOC should be negative after execution because version parsing, version naming, encoded-key routing, and legacy docs are deleted.

## 10. Non-Negotiable Execution Tenets

1. **No asset versioning**
   - No `versions` path.
   - No public `/assets/v` route.
   - No `versionId`.
   - No `AssetVersion` helper names.

2. **No compatibility layer**
   - Do not keep old `/assets/v` as a fallback after migration.
   - During deploy verification, old paths may return 404 or 410.

3. **No fake owner roots**
   - No `curated-assets`.
   - No `admin-owned`.
   - Admin assets live under admin account.

4. **No workspace roots**
   - No `workspace-assets`.
   - Workspace is not a product owner.

5. **No storage refs in authoring config**
   - Bob/Roma config stores `assetId`.
   - Runtime materialization owns URL generation.

6. **No silent healing**
   - Missing manifest means explicit missing asset.
   - Missing blob means explicit missing asset.
   - Do not substitute another asset.

7. **Delete after verification**
   - Legacy R2 roots are not allowed to remain because "maybe something uses them".
   - If something uses them, that caller is part of the fix.

8. **Migrate before no-fallback deploy**
   - The runtime must not keep `/assets/v` compatibility.
   - Existing dev assets must still be copied to the new shape before deploying the no-fallback runtime reader.
   - One-time migration scripts may read old paths; product runtime may not preserve old paths as fallback behavior.

## 11. Pipeline Placement And Guardrails

This PRD must run before general Berlin/Tokyo file hygiene.

Reason:

- Tokyo asset truth is an active product/storage defect.
- PRD 81B is source-file hygiene and must not run first if it distracts from storage truth.
- Splitting or moving files before fixing the storage contract risks preserving the same bad asset model in nicer-looking modules.

Execution order:

```txt
1. PRD 81A - Tokyo R2 account asset storage hard cut
2. PRD 81B - Berlin/Tokyo-worker file boundary hygiene and render split
3. PRD 81C - San Francisco telemetry and D1 hygiene
```

### 11.1 Feedback corrections captured as execution rules

The April 28 cleanup feedback contained useful sequencing guidance, but some recommendations are stale for this repo. Execution must follow these corrections:

- Do not diff `tokyo-assets-dev` against `account_assets.asset_r2_key`. `account_assets` was dropped by PRD 55. Current asset truth is Tokyo R2 manifests and blobs.
- Do not treat Supabase asset tables as the current asset authority.
- Do not delete or squash historical Supabase migrations as part of this PRD.
- Do not fold Berlin `account-state.types.ts` into `account-state.ts`; it is a valid type boundary.
- Do not fold Berlin `profile-normalization.ts` into `user-profiles.ts`; it is used by multiple Berlin modules.
- Do not dump Berlin `auth-request.ts` into generic `helpers.ts`; request auth parsing is a separate concern.
- Do not fold Tokyo-worker `l10n-read.ts` into `l10n-authoring.ts`; public read and authoring write boundaries are different.
- Do not empty `sanfrancisco-logs-dev` as part of Tokyo cleanup; it is actively bound in San Francisco.

### 11.2 R2 deletion authority

AI may implement and run read-only inventory and migration scripts.

AI may not perform destructive R2 deletion until:

- the deletion candidate list is generated from inventory
- every candidate prefix/object set has a classification
- active code no longer reads or writes the legacy path
- migrated account assets pass verification
- the user explicitly approves the deletion list

The final execution report must include:

```txt
legacyPrefix
objectCount
actionTaken
verificationEvidence
```

### 11.3 Follow-up cleanup boundaries

After PRD 81A is green:

- Execute PRD 81B as written, not the stale feedback sequence.
- Keep `account-state.types.ts`, `profile-normalization.ts`, `auth-request.ts`, `account-localization-utils.ts`, and `l10n-read.ts` unless a later PRD names a better surviving boundary.
- Handle San Francisco `workspaceIdHash` and D1 boot-schema cleanup in PRD 81C; do not mix it into Tokyo asset storage.

## 12. Verification Commands

Required local checks:

```bash
pnpm typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma lint
NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm --filter @clickeen/bob build
NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm --filter @clickeen/roma build
pnpm --filter @clickeen/venice build
pnpm --filter @clickeen/tokyo-worker deploy --dry-run
git diff --check
```

Required search checks:

```bash
rg -n "assets/versions|toCanonicalAssetVersionPath|isCanonicalAssetVersionRef|AssetVersion|/assets/v|versionId" tokyo-worker packages bob roma venice scripts documentation --glob '!**/.next/**' --glob '!**/node_modules/**'
rg -n "workspace-assets|curated-assets|admin-owned" tokyo-worker bob roma venice scripts documentation --glob '!**/.next/**' --glob '!**/node_modules/**'
```

Allowed remaining hits:

- execution notes in this PRD
- historical migration files explicitly marked inert

Required cloud-dev checks after deploy:

```txt
1. Upload an image from Roma Assets.
2. Confirm R2 object is under accounts/<accountId>/assets/<assetId>/blob/<filename>.
3. Confirm manifest is accounts/<accountId>/assets/<assetId>/manifest.json.
4. Confirm Roma Assets lists the uploaded asset.
5. Open Builder for an account instance.
6. Apply the asset to a widget fill.
7. Confirm Bob preview displays it.
8. Save.
9. Publish/sync.
10. Confirm materialized config uses /assets/account/<accountId>/<assetId>/<filename>.
11. Confirm Venice public render displays the asset.
12. Confirm /assets/v/... is not emitted by any active response.
13. Confirm legacy R2 roots are deleted after migration verification.
```

## 13. Definition Of Done

This PRD is done only when:

- new uploads never write `assets/versions`
- existing account assets are migrated to the final account asset shape
- Roma Assets can list/delete current assets
- Builder can apply/save assets
- Venice can serve published widgets with assets
- docs no longer describe versioned account assets
- legacy R2 roots from the screenshot are deleted or proven to be allowed product static/projection roots
- search checks prove the versioning vocabulary is gone from active code
- no compatibility fallback preserves `/assets/v` or `accounts/*/assets/versions`
