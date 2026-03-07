# Clickeen Asset Management Contract (Canonical)

This file is the single source of truth for account-owned assets across Bob, Roma, Paris, Tokyo-worker, and Venice.

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

- Blob bytes: `assets/versions/{accountId}/{assetId}/{filename}` in Tokyo R2.
- Manifest metadata: `assets/meta/accounts/{accountId}/assets/{assetId}.json` in Tokyo R2.
- Canonical immutable read path: `/assets/v/:assetRef` (derived from stored key).
- Config references immutable asset refs only (no persisted runtime URLs).

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
- `POST /assets/upload`
- `GET /assets/v/:assetRef`
- `GET /assets/account/:accountId`
- `DELETE /assets/:accountId/:assetId`
- `DELETE /assets/purge/:accountId?confirm=1`
- `GET /assets/integrity/:accountId` (dev/internal)
- `GET /assets/integrity/:accountId/:assetId` (dev/internal)

Roma control-plane routes proxy account-safe operations for product UI:
- `GET /api/assets/:accountId`
- `DELETE /api/assets/:accountId/:assetId`
- `DELETE /api/assets/:accountId?confirm=1`

---

## Upload behavior (executed contract)

1. Auth + account membership (`editor+`) enforced.
2. Tier caps and budgets enforced before write.
3. Filename sanitization is minimal and predictable:
   - whitespace -> `-`
   - unsafe chars removed
4. Blob is written once; manifest is written once.
5. Upload response returns immutable asset identity (`assetRef`), exact size (`sizeBytes`), MIME (`contentType`), and `assetType`.

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
| Roma | Asset inventory UX (list/delete/purge, limits visibility) |
| Paris | Ref validation in instance writes |
| Tokyo-worker | Asset storage/read/delete/integrity |
| Venice | Static serving of referenced bytes |

---

## Acceptance checklist

- Upload writes exactly one immutable asset identity.
- List shows `assetType`, `contentType`, and exact `sizeBytes`.
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
   - `assetRef`
   - `assetType`
   - `contentType`
   - `sizeBytes`
   - `filename`
   - `createdAt`
   - `url`
7. Delete path uses `accountId + assetId` identity and hard-deletes blob + metadata.
8. Paris config validation rejects legacy media URL persistence and enforces `asset.ref`.
9. Bob write path persists immutable refs (`asset.ref` / `poster.ref`) only.
10. Roma assets domain uses the strict list/delete contract only.
11. Keep one migration utility:
   - `scripts/migrate-asset-ref-hard-cut.mjs` (widget config normalization only; runtime manifest migration stage is retired after hard-cut)
12. Migration run policy:
   - dry-run first
   - apply second
   - post-apply dry-run must report no further config rewrites
13. Delete obsolete legacy asset migration scripts and helpers outside the dedicated migration utility.
14. Keep docs aligned with this contract.
15. Run validation matrix (classification, ownership, exact size, render path, delete, oversize fail, legacy rejection).
16. Cloud-dev cutover: only new contract accepted; legacy contract rejected by design.
17. Final cleanup pass confirms legacy contract code paths are removed.
