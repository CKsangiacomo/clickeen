# System: Tokyo — Asset Storage & CDN

## Identity
- Tier: Supporting
- Purpose: File and asset storage with CDN delivery

## Interfaces
- Upload APIs, signed URLs
- Serves widget definitions/assets (`tokyo/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`)

## Dependencies
- Used by: Venice, Bob, Site

## Deployment
- Cloudflare R2 (zero egress)

## Rules
- Public assets cacheable; private assets signed, time-limited

## Canonical URLs (executed)

- **Local**: `http://localhost:4000` (Tokyo dev server started by `scripts/dev-up.sh`)
- **Cloud-dev**: `https://tokyo.dev.clickeen.com` (Cloudflare dev)
- **UAT / Limited GA / GA**: `https://tokyo.clickeen.com` (release stages share prod infra)

Consumers should treat Tokyo as the **software plane**:
- Widget definitions are fetched over HTTP (even locally) using `NEXT_PUBLIC_TOKYO_URL`
- Dieter build artifacts are served from Tokyo (`tokyo/dieter/**`)
- i18n bundles are served from Tokyo (`tokyo/i18n/**`)

## Dieter bundling manifest (executed)

Dieter emits a bundling manifest at:
- `tokyo/dieter/manifest.json`

This is the authoritative contract Bob uses to determine which Dieter bundles are real and which classnames are helpers.

Shape (as implemented today):
- `v`: schema version (number)
- `gitSha`: build fingerprint
- `components`: string[] (valid component bundles)
- `componentsWithJs`: string[] (bundles that ship a `.js`)
- `aliases`: Record<string,string> (optional hint mapping)
- `helpers`: string[] (classnames that must never be treated as bundles)
- `deps`: Record<string,string[]> (explicit component dependencies)

## Determinism rule (anti-drift)

- ToolDrawer `type="..."` drives required bundles.
- CSS classnames never add bundles (classnames are not a dependency graph).

## i18n bundles (executed)

Tokyo serves built localization catalogs for editor/runtime surfaces:
- Build output path: `tokyo/i18n/{locale}/{bundle}.{hash}.json`
- Manifest: `tokyo/i18n/manifest.json`

Rules:
- Catalog filenames are content-hashed (safe for `Cache-Control: immutable` at the CDN).
- `manifest.json` is the indirection layer that maps `{ locale, bundle } → filename` and is intended to be short-TTL.
- Bundles are scoped by namespace:
  - `coreui.*` (shared product/editor chrome)
  - `{widgetName}.*` (widget-specific terminology/labels)

Local dev:
- `tokyo/dev-server.mjs` serves `/i18n/*` from `tokyo/i18n/*`.
- `tokyo/dev-server.mjs` serves `/workspace-assets/*` from `tokyo/workspace-assets/*` (gitignored).
- `tokyo/dev-server.mjs` supports local upload endpoints:
  - `POST /workspace-assets/upload` (workspace-scoped assets; required header: `x-workspace-id`)
  - `POST /widgets/upload` (platform/widget-scoped assets; required header: `x-widget-type`)

## Links
- Back: ../../CONTEXT.md
