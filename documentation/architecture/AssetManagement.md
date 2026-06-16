# Clickeen Account Asset Library Contract

This file is the architecture contract for account-owned assets across Bob, Roma, and Tokyo-worker.

For platform context see [CONTEXT.md](./CONTEXT.md), [Overview.md](./Overview.md), and [Tenets.md](./Tenets.md).

## Product Model

Account assets are account-owned library files.

Instances reference account assets.

Instances do not own account assets.

Generated instance embed output references account assets from the account library. It must not duplicate account asset files into an instance `embed/` folder or turn account assets into instance-owned files.

In-place replacement of an account asset keeps the same account asset reference and must not require rebuilding instances that reference it.

The account asset library is not a generated-ID registry, not a hash-derived storage model, and not a second public identity system.

Do not introduce a second public asset namespace, account asset hash folders, account asset byte-versioning, or immutable asset histories as product behavior.

## Naming Boundary

Use `assets` only for account-owned uploads in Tokyo:

```text
accounts/{accountPublicId}/assets/
```

Use `media` for Clickeen-owned product files used by Prague, Roma, Bob, Dieter, widget software, marketing surfaces, app UI, product-owned demo files, screenshots, icons, fonts, or similar internal/product-owned files.

## Authority

Builder is the account asset management surface.

Bob is an upload/use entry point while a user edits a widget.

Tokyo-worker stores and serves accepted account assets.

There must be one account asset truth shared by Bob and Roma.

If a user uploads an asset in Bob, Tokyo-worker stores the accepted account asset and Roma/Bob read that same account asset truth. There is no standalone Roma asset-library mutation workflow.

## Minimum Operations

PRD 100 requires these account asset library operations:

- upload
- list
- resolve for authoring/build consumption
- delete by exact account asset reference through the route/API boundary
- reuse from Bob controls

Folder organization, bulk library management, replace-in-place, and richer file-management UX can evolve later only as explicit product contracts.

The active PRD 100 implementation stores accepted uploads as direct files under the account asset folder:

```text
accounts/{accountPublicId}/assets/{filename}
```

The account asset list path is a prepared metadata list. It must not read per-asset manifests, hash folders, blob folders, or run one object-integrity `HEAD` check per listed file.

## Upload Boundary

Validation happens before a file becomes an account asset.

Minimum validation:

- reject unsafe names
- reject path traversal and absolute paths
- reject control characters and invalid folder/file names
- enforce allowed file extensions and MIME/type checks
- enforce size limits
- reject executable or scriptable uploads
- scan or quarantine files before acceptance when scanner infrastructure is available

SVG is valid account media. It is accepted as `image/svg+xml` and classified as
a vector asset; it must not be rejected as an executable file. Scriptable SVG
content is still rejected before the file becomes an account asset.

Only accepted files are written into the account `assets/` folder.

## Embed Boundary

The embed agent is not an asset manager.

The embed agent must not mint asset identities, invent public asset URLs, hash files, create generated storage indirection, version assets, or decide account asset serving.

If generated HTML/CSS/JS needs an account asset, it consumes the account asset reference saved in the instance source and resolves it through the one Roma/Tokyo account asset library contract.

Asset byte replacement is handled by the account asset serving layer, not by rebuilding every referencing instance.

## Removed Implementation Drift

PRD 100 removes this old account asset shape from active product contracts:

- generated UUID identity for account uploads
- internal byte indirection under each uploaded file
- metadata is stored in per-asset `manifest.json`
- content hashes recorded as product-facing asset metadata
- resolved URLs built from multiple generated identity pieces plus filename

Old implementation shape must not leak into generated embed architecture, Bob controls, Roma library APIs, or Tokyo-worker account asset serving.

## Surface Ownership

| Surface | Owns |
| --- | --- |
| Bob | Upload trigger, picker/use action, and editor reference assignment |
| Roma | Account asset library UX, current-account command validation, account policy checks, and storage visibility |
| Tokyo-worker | Accepted account asset storage, serving, replacement, deletion, and storage-used truth |
| Embed agent | Consuming account asset references while generating instance HTML/CSS/JS |

## Acceptance Checklist

- Account assets live under the account asset library boundary.
- Bob and Roma use one shared account asset truth.
- Instance embed output references account assets; it does not own or duplicate them.
- In-place account asset byte replacement does not require instance rebuilds.
- Unsafe uploads are rejected before becoming account assets.
- Clickeen-owned product files are called `media`, not assets.
- Old generated-ID/manifest implementation shape is removed from active product APIs and generated embeds.
