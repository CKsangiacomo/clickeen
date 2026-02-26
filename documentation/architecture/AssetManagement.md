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
| Roma Assets panel | List, inspect usage, delete, entitlement visibility | Runtime fallback behavior |
| Paris | Authz + surface gate + proxy orchestration | Silent rewrite/heal of asset refs |
| Tokyo-worker | Upload, immutable read, delete, integrity checks | Replace-in-place semantics |
| Venice | Serve canonical asset path proxy and render output | Fallback image/video substitution |

---

## Canonical data contract

- Persisted config stores logical immutable refs: `asset.versionId`.
- Runtime materializes canonical read path: `/assets/v/{encodeURIComponent(versionId)}`.
- Legacy persisted URL fields (`fill.image.src`, `fill.video.src`, `fill.video.posterSrc`, string `fill.video.poster`, `/assets/v/*`-backed `logoFill`) are outside contract.

Ownership and usage tables:
- `account_assets` (asset identity + ownership metadata)
- `account_asset_variants` (immutable blob variants with R2 keys)
- `account_asset_usage` (deterministic where-used mapping from config writes/publish paths)

---

## API contract

Authoritative runtime endpoints:
- `POST /assets/upload` (Tokyo-worker): upload asset blob + metadata
- `GET /assets/v/:versionId` (Tokyo-worker/Tokyo proxy): immutable asset read
- `GET /assets/integrity/:accountId` (Tokyo-worker): account mirror integrity snapshot
- `GET /assets/integrity/:accountId/:assetId` (Tokyo-worker): per-asset identity integrity snapshot

Managed (Roma) control-plane endpoint:
- `DELETE /api/accounts/:accountId/assets/:assetId` (Paris): Roma-surface-gated delete, delegated to Tokyo-worker hard delete
  - Requires `x-clickeen-surface: roma-assets`
  - Non-Roma surfaces receive `403`

---

## Canonical flows

### Upload flow (Bob -> Tokyo-worker -> instance config)

1. User uploads file in Bob.
2. Bob posts to Tokyo-worker upload path with account/workspace trace headers.
3. Tokyo-worker writes R2 blob(s) and ownership metadata (`account_assets`, `account_asset_variants`).
4. Response returns immutable asset identity/version reference.
5. Bob writes `asset.versionId` into instance config immediately.
6. Paris write paths sync deterministic usage rows into `account_asset_usage`.

Operational note:
- Upload/attach success is independent from render snapshot convergence. Asset persistence must not be reported as failed only because publish snapshot processing is still in-flight.

### Delete flow (Roma Assets only)

1. User deletes from Roma Assets panel.
2. Roma/Paris enforce Roma-surface gate.
3. Tokyo-worker validates integrity for that asset identity.
4. Tokyo-worker deletes variant blob keys and corresponding metadata rows (`account_asset_usage`, `account_asset_variants`, `account_assets`) in request path.
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

Integrity endpoints are required for operational visibility in Roma Assets. Mismatch is explicit and actionable, never silently hidden.

---

## Environment parity

Local and cloud-dev must follow the same asset contract and endpoint semantics. Environment changes can alter hostnames, never asset behavior.

---

## Acceptance checklist

- Upload in Bob links asset into instance config and stores blob/metadata once.
- Deleting in Roma never triggers automatic snapshot rebuild or fallback behavior.
- Non-Roma delete attempts are blocked (`403`).
- Embed/runtime serves exact ref or missing state; no healing.
- Roma integrity UI can expose DB<->R2 mismatch state using integrity endpoints.
