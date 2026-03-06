# Clickeen Asset Management Contract (Canonical)

This document is the single source of truth for asset behavior across Bob, Roma, Paris, Tokyo-worker, and Venice.

For platform context see [Overview.md](./Overview.md), [CONTEXT.md](./CONTEXT.md), and [Tenets.md](./Tenets.md).

---

## Why this exists

Asset behavior was previously spread across service docs and PRDs. This file centralizes the contract so AI/dev teams implement one model and avoid drift.

---

## Hard tenets (cross-surface)

1. Asset flow is straightforward. Uploading in Bob immediately stores in Tokyo-worker and links into instance config via immutable `asset.versionId`.
2. Embed/runtime does not manage assets. It serves exactly what config references. No fallback, no healing, no silent intervention.
3. Asset management UI is Roma Assets panel only. Bob/DevStudio can trigger upload from editor controls but do not own inventory management policy.
4. Entitlement management is user-facing in Roma Assets. If upload is denied by policy, UX sends user to Roma Assets to manage limits.
5. R2 is a strict mirror of Roma-visible asset namespace for each account under `assets/versions/{accountId}/...`. No hidden artifacts or ghost files.
6. There is no replace-asset mutation contract. New file means new immutable asset version reference.

---

## Surface responsibilities

| Surface | Allowed | Not allowed |
|---|---|---|
| Bob (editor) | Upload file, set `asset.versionId` in config | Asset inventory ownership, hidden repair logic |
| DevStudio | Internal host/orchestration for Bob workflows | Separate asset policy from Roma |
| Roma Assets panel | List, inspect metadata/integrity, delete, entitlement visibility | Runtime fallback behavior |
| Paris | Asset-ref validation during instance writes | Asset inventory CRUD, silent rewrite/heal of asset refs |
| Tokyo-worker | Upload, immutable read, delete, integrity checks | Replace-in-place semantics |
| Venice | Serve canonical asset path proxy and render output | Fallback image/video substitution |

---

## Canonical data contract

- Persisted config stores logical immutable refs: `asset.versionId`.
- Runtime materializes canonical read path: `/assets/v/{encodeURIComponent(versionId)}`.
- Legacy persisted URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`, `/assets/v/*`-backed `logoFill`) are outside contract.
- Asset bytes live in Tokyo R2 under `assets/versions/{accountId}/...`.
- Asset metadata lives as manifest JSON in Tokyo R2 under `assets/meta/accounts/{accountId}/assets/{assetId}.json`.
- Variant metadata is embedded in that manifest.
- There is no canonical persisted "where used" table in Michael/Supabase in this repo snapshot. Paris validates asset refs during instance writes, but usage rows are not stored as DB truth.

---

## API contract

Authoritative runtime endpoints:
- `POST /assets/upload` (Tokyo-worker): upload asset blob + metadata
- `GET /assets/v/:versionId` (Tokyo-worker/Tokyo proxy): immutable asset read
- `GET /assets/integrity/:accountId` (Tokyo-worker): account mirror integrity snapshot
- `GET /assets/integrity/:accountId/:assetId` (Tokyo-worker): per-asset identity integrity snapshot

Managed (Roma) control-plane endpoints:
- `GET /api/assets/:accountId` (Roma route): account asset manifest list, delegated to Tokyo-worker
- `DELETE /api/assets/:accountId/:assetId` (Roma route): hard delete delegated to Tokyo-worker
- `DELETE /api/assets/:accountId?confirm=1` (Roma route): account purge delegated to Tokyo-worker

---

## Canonical flows

### Upload flow (Bob -> Tokyo-worker -> instance config)

1. User uploads file in Bob.
2. Bob posts to Tokyo-worker upload path with account/public/widget trace headers.
3. Tokyo-worker writes R2 blob(s) and a per-asset manifest JSON record.
4. Response returns immutable asset identity/version reference.
5. Bob writes `asset.versionId` into instance config immediately.
6. Paris validates referenced assets during instance writes; there is no separate usage-row sync step.

Operational note:
- Upload/attach success is independent from render snapshot convergence. Asset persistence must not be reported as failed only because publish snapshot processing is still in-flight.

### Delete flow (Roma Assets only)

1. User deletes from Roma Assets panel.
2. Roma route forwards the request to Tokyo-worker using Berlin session auth.
3. Tokyo-worker enforces account membership role (`editor+`) and validates integrity for that asset identity.
4. Tokyo-worker deletes variant blob keys and the corresponding manifest JSON in the request path.
5. Response is success only when delete path completes; no snapshot rebuild or runtime healing side effects.

### Render flow (Venice/Bob preview)

1. Runtime resolves config asset refs to canonical `/assets/v/...` path.
2. Venice/Tokyo proxy serves exact referenced bytes.
3. If asset is missing/unavailable, render shows missing/unavailable state. No fallback substitution.

---

## Integrity and mirror invariants

For each account namespace:
- `missingInR2Count == 0`
- `orphanInR2Count == 0`

Integrity endpoints compare manifest-declared variant keys to actual R2 objects. Mismatch is explicit and actionable, never silently hidden.

---

## Environment parity

Local and cloud-dev must follow the same asset contract and endpoint semantics. Environment changes can alter hostnames, never asset behavior.

---

## Acceptance checklist

- Upload in Bob links asset into instance config and stores blob/metadata once.
- Deleting in Roma never triggers automatic snapshot rebuild or fallback behavior.
- Non-Roma delete attempts are blocked (`403`).
- Embed/runtime serves exact ref or missing state; no healing.
- Roma integrity UI can expose manifest<->R2 mismatch state using integrity endpoints.
