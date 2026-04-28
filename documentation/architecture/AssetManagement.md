# Clickeen Asset Management Contract (Canonical)

This file is the single source of truth for account-owned assets across Bob, Roma, Tokyo-worker, and Venice.

For platform context see [Overview.md](./Overview.md), [CONTEXT.md](./CONTEXT.md), and [Tenets.md](./Tenets.md).

---

## Hard invariants

1. One asset belongs to one account. Full stop.
2. Assets are immutable. No replace-in-place behavior exists.
3. New file means new asset id/ref.
4. Asset management is intentionally small: upload, list, use, delete.
5. Runtime serves exactly what config references. No fallback/healing.
6. Uploads are single-mode only. No variant parameter exists in the contract.
7. Asset type is first-class metadata at ingest (`assetType`), not guessed later by each consumer.

---

## Canonical model

- Blob bytes: `accounts/{accountId}/assets/{assetId}/blob/{filename}` in Tokyo R2.
- Manifest metadata: `accounts/{accountId}/assets/{assetId}/manifest.json` in Tokyo R2.
- Canonical immutable read path: `/assets/account/{accountId}/{assetId}/{filename}`.
- Authoring media surfaces reference logical asset identity (`assetId`, optional `posterAssetId`).
- Logo/media authoring controls persist `asset.assetId` plus editor metadata where needed; they do not persist Tokyo storage refs.
- Runtime/materialized config packs resolve those logical ids to immutable `/assets/account/{accountId}/{assetId}/{filename}` paths.

Manifest must carry:
- `assetId` (immutable identity)
- `accountId` (single owner)
- `assetType` (`image | vector | video | audio | document | other`)
- `contentType`
- `sizeBytes` (exact bytes)
- `sha256`
- `key` (canonical immutable assetRef)
- provenance fields (`publicId`, `widgetType`, `source`)

---

## API contract

Tokyo-worker authoritative endpoints:
- `POST /__internal/assets/upload` (private Roma service-binding path)
- `GET /assets/account/:accountId/:assetId/:filename`
- `GET /__internal/assets/account/:accountId` (private Roma service-binding path)
- `GET /__internal/assets/account/:accountId/usage` (private Roma service-binding path)
- `POST /__internal/assets/account/:accountId/resolve` (private Roma service-binding path)
- `DELETE /__internal/assets/:accountId/:assetId` (private Roma service-binding path)
- `GET /assets/integrity/:accountId` (dev/internal)
- `GET /assets/integrity/:accountId/:assetId` (dev/internal)

Roma product routes proxy current-account-safe operations for product UI:
- `GET /api/account/assets`
- `POST /api/account/assets/upload`
- `POST /api/account/assets/resolve`
- `DELETE /api/account/assets/:assetId`

Rules:
- normal Roma product routes do not require browser-supplied `accountId`
- Roma resolves the current account server-side from the signed current-account authz capsule
- explicit `:accountId` route shapes, if they still exist anywhere, are not part of the normal Roma customer shell
- hosted Builder installs one explicit asset transport with three concerns only: `list`, `resolve`, and `upload`
- Bob delegates those asset concerns to Roma through one hosted asset-command seam (`list-assets`, `resolve-assets`, `upload-asset`) and Roma handles those commands directly against the current-account routes
- authoring missing/not-missing truth comes from `POST /api/account/assets/resolve` via Tokyo-worker, not from local preview probes inside Dieter/Bob
- Builder asset controls use one shared resolve helper to interpret missing-state and one shared upsell emitter for asset-denial UI events
- preview render failures in Builder are non-authoritative UI errors only
- storage-used truth for Assets, `/api/account/usage`, and storage-budget checks comes from Tokyo-worker asset manifests through the asset authority, not a mirrored KV counter

---

## Upload behavior (executed contract)

1. Auth + account membership (`editor+`) enforced.
2. Per-file upload cap and total account storage limit are enforced before write.
3. Filename rule is strict reject-only:
   - spaces are rejected
   - unsafe path/url chars are rejected
   - no rename/rewrite policy is applied server-side
4. Blob is written once; manifest is written once.
5. Upload response returns immutable asset identity (`assetId` + canonical `assetRef`), exact size (`sizeBytes`), MIME (`contentType`), and `assetType`.
6. Tokyo owns runtime asset resolution (`assetId -> assetRef -> /assets/account/...`) for materialized config packs and other runtime artifacts.

---

## Delete behavior

1. Roma Assets panel is the management surface.
2. Delete removes blob key + manifest metadata.
3. Delete does not trigger snapshot rebuild or runtime substitution.
4. Missing assets are explicit missing state at runtime.

---

## Surface ownership

| Surface | Owns |
|---|---|
| Bob | Upload trigger + editor ref assignment |
| Roma | Asset inventory UX (list/upload/bulk-upload/delete, limits visibility, storage-bytes display from `/api/account/assets`) + current-account command validation |
| Tokyo-worker | Asset storage/read/delete/integrity + storage-used truth + runtime asset ref materialization/validation |
| Venice | Static serving of referenced bytes |

---

## Acceptance checklist

- Upload writes exactly one immutable asset identity.
- List shows `assetType`, `contentType`, and exact `sizeBytes`.
- Assets surface shows current storage used against the account storage limit.
- Runtime never rewrites/falls back to other assets.
- Delete removes metadata + blobs and surfaces failures explicitly.

---

## Hard-Cut Closure Checklist (Executed Order)

1. Lock final contract in one place (this doc): `assetRef`, `assetType`, exact response shape, and operations (`upload/list/use/delete`) only.
2. Remove transitional runtime behavior that violated the hard-cut contract.
3. Use single-asset manifest semantics only (`key` as canonical `assetRef`, no runtime variants/version links).
4. Upload path is original-only, rejects `x-variant`, classifies/stores `assetType`, and stores exact `sizeBytes`.
5. Read path resolves canonical immutable `assetRef` only.
6. List path returns only:
   - `assetId`
   - `assetRef`
   - `assetType`
   - `contentType`
   - `sizeBytes`
   - `filename`
   - `createdAt`
   - `url`
7. Delete path uses `accountId + assetId` identity and hard-deletes blob + metadata.
8. Persisted authoring config rejects legacy media URL persistence and treats storage refs as runtime-only details for migrated media surfaces.
9. Migrated Bob media controls persist logical media identity (`assetId`, optional `posterAssetId`) only.
10. Roma assets domain uses strict upload/list/bulk-upload/delete contract only.
11. Migration utility is retired after hard-cut completion (no persistent migration script in the repo).
12. Delete obsolete legacy asset migration scripts and helpers.
13. Post-cutover validation confirms no legacy config rewrite path remains.
14. Keep docs aligned with this contract.
15. Run validation matrix (classification, ownership, exact size, render path, delete, oversize fail, legacy rejection).
16. Cloud-dev cutover: only new contract accepted; legacy contract rejected by design.
17. Final cleanup pass confirms legacy contract code paths are removed.
