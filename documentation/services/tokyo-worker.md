# System: Tokyo Worker - Asset Uploads + Instance l10n Publisher

## Identity
- Tier: Supporting
- Purpose: Serve workspace assets and materialize **instance** localization overlays into Tokyo/R2.

## Interfaces
- `POST /workspace-assets/upload` (auth required; writes to R2)
- `GET /workspace-assets/**` (public, cacheable)
- `POST /l10n/publish` (internal; publish or delete a locale overlay)
- `POST /l10n/instances/:publicId/:locale` (dev auth; direct overlay write)
- `GET /l10n/**` (public; manifest short-TTL, hashed overlays immutable)

## Dependencies
- Supabase (service role) for `widget_instance_locales`
- Tokyo R2 bucket for artifacts
- Paris for queueing publish jobs

## Deployment
- Cloudflare Workers + Queues
- Queue names: `instance-l10n-publish-{env}` (`local`, `cloud-dev`, `prod`)

## l10n Publish Flow (executed)
- Reads `widget_instance_locales` from Supabase.
- Merges `ops + user_ops` (user_ops applied last).
- Writes `tokyo/l10n/instances/<publicId>/<locale>.<hash>.ops.json`.
- Updates `tokyo/l10n/manifest.json` atomically.

## Local Dev
- If `TOKYO_L10N_HTTP_BASE` is set, publishes to the Tokyo dev server over HTTP.
- `TOKYO_DEV_JWT` is required for dev-only endpoints.

## Rules
- Overlay files are set-only ops with `baseFingerprint` (required).
- `publicId` is locale-free; locale is a runtime parameter.
- Prague website strings are not handled here; they use the repo-local `prague-strings/**` pipeline.

## Links
- Tokyo: `documentation/services/tokyo.md`
- Localization contract: `documentation/capabilities/localization.md`
