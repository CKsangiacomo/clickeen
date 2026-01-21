# System: Tokyo Worker - Asset Uploads + Instance l10n Publisher

## Identity
- Tier: Supporting
- Purpose: Serve workspace assets and materialize **instance** localization overlays into Tokyo/R2.

## Interfaces
- `POST /workspace-assets/upload` (auth required; writes to R2)
- `GET /workspace-assets/**` (public, cacheable)
- `POST /curated-assets/upload` (auth required; writes to R2)
- `GET /curated-assets/**` (public, cacheable)
- `POST /l10n/publish` (internal; publish or delete a layer overlay; body: `{ publicId, layer, layerKey, action? }`)
- `POST /l10n/instances/:publicId/:layer/:layerKey` (dev auth; direct overlay write)
- `GET /l10n/**` (public; deterministic overlay paths, immutable)

## Dependencies
- Supabase (service role) for `widget_instance_overlays` + `l10n_publish_state`
- Tokyo R2 bucket for artifacts
- Paris for queueing publish jobs

## Deployment
- Cloudflare Workers + Queues
- Queue names: `instance-l10n-publish-{env}` (`local`, `cloud-dev`, `prod`)
- Scheduled repair publishes only dirty rows (bounded; no full-table scans).

## l10n Publish Flow (executed)
- Reads `widget_instance_overlays` from Supabase (Phase 1: locale layer only).
- Merges `ops + user_ops` (user_ops applied last for layer=user).
- Writes `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json`.
- Writes `tokyo/l10n/instances/<publicId>/index.json` with layer keys (hybrid index).
- Marks publish state clean in `l10n_publish_state`.
- Records versions in `l10n_overlay_versions` and prunes older versions per tier.

## Local Dev
- If `TOKYO_L10N_HTTP_BASE` is set, publishes to the Tokyo dev server over HTTP.
- `TOKYO_DEV_JWT` is required for dev-only endpoints.

## Rules
- Overlay files are set-only ops with `baseFingerprint` (required).
- `publicId` is locale-free; locale is a runtime parameter.
- Prague website strings are not handled here; they are published by `scripts/prague-l10n/*` into `tokyo/l10n/prague/**` (repo-owned base + ops overlays).

## Links
- Tokyo: `documentation/services/tokyo.md`
- Localization contract: `documentation/capabilities/localization.md`
