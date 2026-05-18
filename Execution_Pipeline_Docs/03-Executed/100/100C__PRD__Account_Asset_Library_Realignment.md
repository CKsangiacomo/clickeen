# PRD 100C - Account Asset Library Realignment

Status: Complete
Owner: Product + Architecture
Date: 2026-05-16
Parent: PRD 100 - Core Instance Mini-Sites And Static Embed Delivery

## Purpose

PRD 100 moves public widget delivery to generated static mini-sites. Account assets must support that model without becoming instance-owned files, public ID registries, generated hash storage, or embed-agent-managed storage.

This sub-PRD realigns account-owned uploads to the simple product contract:

```text
accounts/{accountPublicId}/assets/
```

Instances reference account assets. Instances do not own, copy, hash, version, or duplicate account assets.

In-place replacement of account asset bytes preserves the same account asset reference and must not require rebuilding instances that reference the asset.

## Scope

In scope:

- One account asset library truth shared by Bob and Roma.
- Tokyo-worker storage and serving for accepted account assets under `accounts/{accountPublicId}/assets/`.
- Upload, list, resolve, replace bytes in place, delete, and reuse from Bob controls.
- Upload validation before acceptance.
- Pre-GA cleanup or containment of current generated-ID/generated-storage/manifest/content-hash drift.
- Static embed generation consuming saved account asset references without managing assets.

Out of scope:

- Clickeen-owned product media. Product-owned files are `media`, not account `assets`.
- generated public asset identifiers, separate asset domains, hash folders, byte registries, immutable histories, or asset version timelines.
- Folder organization, bulk library operations, advanced DAM features, CDN cache-busting product models, or long-lived asset migrations.
- Rebuilding instances solely because account asset bytes were replaced in place.

## Current State/Drift

Current implementation drift exists and must be removed or explicitly contained before GA:

- Uploaded assets are identified by generated IDs instead of account asset refs.
- Bytes are hidden behind generated storage indirection.
- Metadata is stored in per-asset `manifest.json`.
- `sha256` is recorded as product-facing asset metadata.
- Resolved URLs are built from multiple generated identity pieces plus filename.

That shape is implementation reality, not product truth. New PRD 100 embed architecture must not depend on it.

## Target Contract

Account assets are account-owned library files:

```text
accounts/{accountPublicId}/assets/{assetRef}
```

`assetRef` is the stable account-library reference saved by instances and returned by Roma/Tokyo APIs. It must be:

- account-scoped
- path-safe
- human-comprehensible enough for account library state
- independent of blob hashes, UUID public identities, immutable versions, or per-instance folders

The stable reference is what Bob saves into instance config/source and what the embed agent consumes during generation.

Bob is an upload/use entry point. Roma is the account asset library surface. Tokyo-worker stores and serves accepted account assets. All three surfaces use the same account asset truth.

## Required API/Storage Changes

Tokyo-worker must expose account-scoped operations through Roma's current-account boundary:

- `upload`: validate input, accept only a product-safe account asset reference, write accepted bytes under `accounts/{accountPublicId}/assets/`, and return the stable reference plus display metadata needed by Bob/Roma.
- `list`: return accepted account assets for Roma library and Bob picker reuse from the same source.
- `resolve`: convert a saved account asset reference into the authoring/build/serving URL or storage pointer needed by Bob preview and embed generation.
- `replace`: overwrite bytes at the same account asset reference after validation.
- `delete`: remove the account asset or mark it unavailable according to the chosen pre-GA storage contract, and fail clearly when deletion is blocked by active references.

Storage must not introduce:

- public asset IDs
- asset hostnames separate from `clk.live`/Tokyo serving decisions
- hash-derived account asset folders
- per-instance asset copies
- blob registry manifests as product model

If implementation needs private operational metadata, it must be contained behind Tokyo-worker and must not become product identity or generated embed contract.

## Replace Behavior

Replacing an account asset changes bytes in place and preserves the same account asset reference.

Required behavior:

- Existing instance configs keep the same saved reference.
- Generated HTML/CSS/JS that refers to the account asset reference remains valid.
- Replacement does not enqueue or require instance rebuilds.
- Bob preview and Roma library resolve the updated bytes through the shared account asset contract.
- If caches exist, invalidation/revalidation belongs to the account asset serving layer, not the instance build pipeline.

Replacement must run the same acceptance validation as upload before the old accepted bytes are superseded. Failed validation keeps the previous accepted asset intact.

## Validation

Validation happens before a file becomes or replaces an accepted account asset.

Minimum validation:

- Accept safe names/references and reject unsafe names before storage.
- Reject path traversal, `..`, absolute paths, empty names, and separator abuse.
- Reject control characters and invalid folder/file names.
- Enforce allowed extensions and MIME/type checks.
- Enforce per-file size limits and account policy limits where available.
- Reject executable or scriptable uploads, including script-capable SVG/HTML/JS payloads.
- Scan or quarantine before acceptance when scanner infrastructure is available.

Only accepted bytes are written to the account `assets/` library. Quarantined bytes must not be resolvable by Bob, Roma, the embed agent, or public serving.

## Acceptance Criteria

- Account assets are stored and served as account-owned library files under `accounts/{accountPublicId}/assets/`.
- Bob upload, Bob picker reuse, Roma library upload/list/replace/delete, and embed generation use one shared account asset truth.
- Instances save references to account assets; they do not own or duplicate asset bytes.
- Generated instance output references account assets from the account library and does not copy them into `accounts/{accountPublicId}/instances/{instanceId}/`.
- In-place asset replacement preserves the same reference and does not require instance rebuilds.
- Unsafe uploads are rejected before acceptance.
- Current generated-ID/generated-storage/manifest/content-hash drift is removed or explicitly contained as pre-GA cleanup that cannot leak into product APIs or generated embeds.
- No generated public asset identifier, separate asset domain, hash folder, byte registry, or immutable asset history appears in the product contract.

## Implementation Notes

- Treat `accounts/{accountPublicId}/assets/` as the surviving authority before changing callers.
- Keep Roma as the current-account API boundary; Bob should not write directly to Tokyo-worker.
- Keep asset references in instance source/config narrow and account-scoped. Do not add per-instance asset ownership fields.
- Resolve account asset references at authoring/build time through Roma/Tokyo-worker. The embed agent consumes accepted references; it does not validate uploads, mint IDs, or choose storage layout.
- If existing code still needs UUID/blob compatibility during pre-GA cutover, isolate it behind Tokyo-worker adapters and remove the adapter before GA.
- Deletion must be explicit about referenced assets. Prefer fail-fast blocked deletion while references exist unless product explicitly chooses dangling-reference behavior.

## Risks/Guards

- Risk: Old generated-ID/generated-storage drift becomes the implicit new product model. Guard: block new public API fields and generated embeds from using generated upload IDs, storage indirection, manifests, or content hashes as product identity.
- Risk: Replacing bytes silently changes public visuals. Guard: validation must succeed before replacement; failed replacement preserves prior bytes.
- Risk: Deleting referenced assets breaks live embeds. Guard: reference checks or explicit blocked deletion errors are required before deletion ships.
- Risk: Bob and Roma diverge into separate libraries. Guard: both must call the same Roma/Tokyo account asset operations and list from the same account source.
- Risk: Static embed generation copies assets into instance folders. Guard: generated output may reference account assets but must not write account asset bytes under the instance folder.

## Validation/Tests

Required coverage:

- Upload accepts safe image/media files and writes only under `accounts/{accountPublicId}/assets/`.
- Upload rejects traversal names, absolute paths, control characters, executable/scriptable extensions, MIME mismatches, and oversize files.
- Bob-uploaded assets appear in Roma library list.
- Roma-uploaded or replaced assets appear in Bob picker/preview through the same reference.
- Replace keeps the same saved reference and updates resolved bytes without touching instance source or triggering rebuild.
- Generated embed output references account asset paths/references and does not contain copied account asset bytes under the instance folder.
- Delete blocks or clearly fails when an accepted asset is still referenced by an instance.
- No new tests or snapshots assert generated public asset identifiers, separate asset domains, hash folders, storage indirection, generated upload identity, manifest product identity, or content-hash product metadata.

## Rollout/Cutover

1. Inventory current account asset callers in Bob, Roma, Tokyo-worker, and embed-generation code.
2. Name `accounts/{accountPublicId}/assets/{assetRef}` as the only surviving product storage contract.
3. Add or realign Roma/Tokyo operations for upload, list, resolve, replace, and delete.
4. Move Bob upload and picker flows onto the shared Roma/Tokyo account asset operations.
5. Update embed generation to consume saved account asset references only and to reject attempts to copy account assets into instance folders.
6. Remove or contain generated-ID/generated-storage/manifest/content-hash drift behind Tokyo-worker until any pre-GA test assets are cleaned.
7. Run validation tests and a manual Bob-to-Roma-to-embed smoke path:

```text
Bob upload -> asset appears in Roma -> widget saves reference -> embed references asset -> Roma replace bytes -> same embed reference resolves new bytes without rebuild
```

8. Remove pre-GA compatibility adapters before GA unless a later PRD explicitly keeps them.
