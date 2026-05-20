# PRD 100A - Instance Folder And Save Shape

Status: Complete
Owner: Product + Architecture
Date: 2026-05-16
Parent: PRD 100 - Core Instance Mini-Sites And Static Embed Delivery

PRD 103_00 NOTE: this PRD is narrowed to public static-serving internals. Its `instance.json` catchall source model, overlay folder assumptions, generated browser files, and file-presence semantics must not govern authoring, translation, catalog, or publish APIs while the pre-103 source-model gate is active.

## Purpose

Make the account instance folder the single storage root for both source truth and generated public mini-site files.

PRD 100A removes the old split where saved config, publish state, published projections, Venice runtime reads, and overlay pointers live as separate JSON products. After this slice, Save persists one source package to `instance.json` and schedules asynchronous generation work. Save completion means source truth is durable. It does not mean generated browser files are ready.

Surviving authority:

```text
accounts/{accountPublicId}/instances/{instanceId}/instance.json
```

## Scope

In scope:

- Collapse account instance source truth into one top-level `instance.json`.
- Keep overlays under `accounts/{accountPublicId}/instances/{instanceId}/overlays/`.
- Reserve generated browser files in the same instance folder: `index.html`, `styles.css`, `script.js`, and any explicitly generated browser support files.
- Change the account Save path so Roma/Tokyo writes `instance.json` and then triggers translation + embed generation asynchronously.
- Record source/save version and generated-file readiness status in `instance.json` so older jobs cannot mark newer saves ready.
- Define the file allowlist contract public serving must enforce.
- Add code and test guards against reintroducing sibling top-level JSON truth.

Out of sibling scope but coordinated:

- Full `clk.live` DNS/TLS/static serving implementation belongs to the public serving slice.
- San Francisco queue reliability and agent internals belong to the agent hardening/embed agent slices.
- Account asset library cleanup belongs to the account asset slice.
- Final removal of Venice runtime composition belongs to the Venice cleanup slice.

## Current State / Drift

Current active code still reflects PRD 099's published-projection runtime model:

- `tokyo-worker/src/domains/render/keys.ts` defines top-level `config.json`, `publish.json`, and `published/config.json` keys next to `instance.json`.
- `tokyo-worker/src/domains/render/saved-config.ts` writes saved config to `config.json` and writes identity/display metadata to `instance.json`.
- `tokyo-worker/src/domains/render/live-surface.ts` writes public projection state under `published/` and `publish.json`.
- `tokyo-worker/src/routes/render-routes.ts` and `venice/app/renders/[...path]/route.ts` expose `/renders/accounts/{accountPublicId}/instances/{instanceId}/...` runtime JSON projection reads.
- `venice/app/widget/[accountPublicId]/[instanceId]/route.ts` composes public widget HTML per request by fetching live pointer JSON, config JSON, overlay JSON, and widget HTML.
- `bob/components/EmbedModal.tsx` still builds copied snippets around Venice `/widget/{accountPublicId}/{instanceId}` and the Venice loader.
- Roma Save currently calls Tokyo save and then runs Babel follow-up from `roma/app/api/account/instances/[instanceId]/route.ts`; it does not persist one complete source package nor trigger an embed build job.

That drift is implementation reality, not product truth for PRD 100.

## Target State

Every account-owned instance folder has this shape:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.json
  overlays/
  index.html
  styles.css
  script.js
```

Required invariants:

- `accountPublicId` matches `^[0-9A-Z]{8}$`.
- `instanceId` matches `^[0-9A-Z]{10}$`.
- The canonical public URL is `https://clk.live/{accountPublicId}/{instanceId}`.
- There is no `publicEmbedId`.
- There is no `embed.clickeen.com`.
- There is no shortener, redirect alias, or second public namespace.
- There is exactly one top-level source JSON file: `instance.json`.
- There is no top-level `config.json`, `publish.json`, `embed.json`, or `translations.json`.
- Translation output is overlay value maps under `overlays/`.
- Generated browser files live in the instance folder and are derived from `instance.json`, `overlays/`, account assets, and product widget software.
- Public serving may expose only browser files. It must not expose `instance.json`, `overlays/`, directory listings, or non-browser build inputs.

## Detailed Requirements

### `instance.json` Source Package

`instance.json` must include the complete source package needed by product operations and agents:

- `accountPublicId`
- `instanceId`
- `widgetType`
- display metadata
- saved base config
- `baseLocale`
- enabled target locales
- locale overlay/build policy inputs needed by agents
- product-approved `embedBuildShape`
- `sourceVersion` for the latest Save
- translation/build status tied to that source version
- last successful embed build metadata tied to the source version

Minimum `embedBuildShape`:

```json
{
  "rendering": "html",
  "seoMode": "off",
  "locales": ["en"],
  "clientSide": "minimal-js"
}
```

Allowed values:

- `rendering`: `html` or `iframe`
- `seoMode`: `off`, `lite`, or `full`
- `clientSide`: `static`, `minimal-js`, or `interactive`
- `locales`: base locale plus enabled target locales

Public requests must not choose or override `embedBuildShape`.

Required generation coordination fields:

```json
{
  "sourceVersion": 12,
  "generation": {
    "translation": {
      "status": "queued",
      "sourceVersion": 12,
      "updatedAt": "2026-05-16T00:00:00.000Z"
    },
    "embed": {
      "status": "stale",
      "sourceVersion": 12,
      "updatedAt": "2026-05-16T00:00:00.000Z",
      "lastSuccessful": {
        "sourceVersion": 11,
        "completedAt": "2026-05-16T00:00:00.000Z"
      }
    }
  }
}
```

`sourceVersion` is incremented by Tokyo on each successful source save. Agent jobs must carry the `sourceVersion` they read. A job may update generation status only when its `sourceVersion` still matches the current `instance.json`.

Allowed generation status values:

```text
not_generated
queued
building
ready
stale
failed
unavailable
```

### Save Shape

On account Save:

1. Roma validates account session and editor payload.
2. Tokyo validates the instance coordinate and widget type.
3. Tokyo writes one complete `instance.json` source package at:

```text
accounts/{accountPublicId}/instances/{instanceId}/instance.json
```

4. Tokyo marks translation/embed generation as `queued`, `stale`, or `not_generated` for the saved source version.
5. Roma/Tokyo triggers San Francisco translation and embed work asynchronously through named job boundaries.
6. The API response returns source-save success, not generated-file readiness.

Save must fail if:

- the account ID or instance ID is invalid
- the instance does not exist
- the submitted `widgetType` does not match the saved instance
- saved config is missing or not an object
- `instance.json` cannot be written
- the system cannot record that generation is required for this save

Save must not:

- write `config.json`
- write `publish.json`
- write `embed.json`
- write `translations.json`
- call Venice
- generate public files inside Bob or browser JavaScript
- block on translation or embed generation completion
- silently keep old source truth when `instance.json` write fails

### Generated Files

The embed agent writes generated browser files under the same instance folder:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/script.js
```

Generation must write support files before `index.html`. Public availability is controlled by `index.html` presence, but full publish/unpublish behavior is completed by the public serving/cutover slices.

### Public File Allowlist Contract

The static serving layer must only allow generated browser files from the instance folder:

```text
index.html
styles.css
script.js
other explicitly generated browser files required by the mini-site
```

The allowlist must deny:

- `instance.json`
- any path under `overlays/`
- old `config.json`, `publish.json`, `embed.json`, `translations.json`
- overlay pointer artifacts outside `overlays/`
- `published/` runtime projection files
- directory listings

### URL Contract

The only public URL contract this slice may write into product state or snippets is:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Direct mappings:

```text
https://clk.live/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html

https://clk.live/{accountPublicId}/{instanceId}/styles.css
  -> accounts/{accountPublicId}/instances/{instanceId}/styles.css

https://clk.live/{accountPublicId}/{instanceId}/script.js
  -> accounts/{accountPublicId}/instances/{instanceId}/script.js
```

No code in this slice may introduce `publicEmbedId`, `embed.clickeen.com`, URL aliases, short IDs, or lookup-backed public paths.

## Out Of Scope

- Building the final `clk.live` worker, DNS, TLS, cache headers, or CDN purge flow.
- Implementing the full embed agent renderer.
- Implementing all translation-agent retry, observability, and backpressure behavior.
- Redesigning account assets or uploaded asset storage.
- Creating a generic artifact framework.
- Preserving compatibility for old Venice public runtime routes.
- Changing Bob's in-memory editing model.

## Acceptance Criteria

- New saves write one complete `instance.json` under `accounts/{accountPublicId}/instances/{instanceId}/`.
- New saves do not write top-level `config.json`, `publish.json`, `embed.json`, or `translations.json`.
- The saved config is inside `instance.json`.
- `instance.json` records the source version and generation status needed to distinguish saved source state from generated file readiness.
- Translation jobs are requested after source save and target `overlays/`.
- Embed jobs are requested after source save and target generated browser files in the instance folder.
- Save responses expose source-save success without claiming generated files are ready.
- Existing public output, if present, is not deleted just because a new save queued generation.
- Public URL data uses `https://clk.live/{accountPublicId}/{instanceId}` only.
- Code guards or tests fail on reintroduced `publicEmbedId`, `embed.clickeen.com`, top-level `config.json`, top-level `publish.json`, top-level `embed.json`, or top-level `translations.json` in active account instance paths.

## Implementation Notes

Primary surfaces to change:

- `tokyo-worker/src/domains/render/keys.ts`: remove surviving active key helpers for top-level `config.json`, `publish.json`, and `published/config.json`; add explicit generated browser file key helpers if needed.
- `tokyo-worker/src/domains/render/saved-config.ts`: replace split `instance.json` + `config.json` writes with one `instance.json` write/read contract.
- `tokyo-worker/src/domains/render/account-instance-transitions.ts`: make create, duplicate, save, publish state reads, and unpublish/publish coordination use the new source package shape.
- `tokyo-worker/src/domains/render/instance-index.ts`: derive Roma Widgets index entries from `instance.json`; do not treat indexes as identity authority.
- `tokyo-worker/src/routes/internal-render-routes.ts`: keep the existing account Save route family if useful, but its implementation must write `instance.json` and request async generation.
- `roma/app/api/account/instances/[instanceId]/route.ts`: return save success plus generation request status, not embed readiness.
- `roma/lib/account-instance-direct.ts`: normalize Tokyo payloads around the new source package/readiness shape.
- `bob/components/EmbedModal.tsx`: when snippet updates land, copied URLs must use `clk.live`; old Venice `/widget` snippets must not remain as product-facing output.

Keep deletion scoped. Historical PRD text and archived evidence can mention old shapes. Active code, current architecture docs, and generated product snippets cannot keep them as live product truth.

## Risks / Guards

- Risk: older async jobs overwrite newer saves as ready. Guard with source-version matching before status updates.
- Risk: public serving accidentally exposes source JSON or overlays. Guard with an explicit browser-file allowlist and tests.
- Risk: Save reports success while generation queueing failed. Guard by requiring Save to persist generation-required status or return a clear upstream failure.
- Risk: old Venice route remains product-visible. Guard copied snippets, docs, and route tests against `/widget/{accountPublicId}/{instanceId}` as the canonical public path.
- Risk: duplicate truth survives in `config.json` or `publish.json`. Guard active key helpers and write paths with tests/CI scans.

## Validation / Tests

Minimum validation:

- Tokyo unit tests for create/save/duplicate reading and writing only `instance.json` plus `overlays/`.
- Tokyo tests proving save rejects widget-type mismatch and invalid coordinates.
- Tokyo tests proving no top-level `config.json`, `publish.json`, `embed.json`, or `translations.json` is written on create/save/publish/unpublish paths.
- Roma route test or integration test proving Save returns source-save success and generation status, not generated-file readiness.
- Static scan test for active code/current docs excluding historical PRDs/evidence:

```text
publicEmbedId
embed.clickeen.com
accounts/{accountPublicId}/instances/{instanceId}/config.json
accounts/{accountPublicId}/instances/{instanceId}/publish.json
accounts/{accountPublicId}/instances/{instanceId}/embed.json
accounts/{accountPublicId}/instances/{instanceId}/translations.json
```

- Public serving contract test, owned by the serving slice but required before merge train completion, proving `instance.json` and `overlays/` return deny/404 while `index.html`, `styles.css`, and `script.js` are allowed.

Run:

```text
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
```

## Rollout / Cutover

This is pre-GA. No public compatibility shim is required for old Venice runtime embeds.

Cutover order:

1. Add the new `instance.json` read/write contract in Tokyo.
2. Switch create/save/duplicate to write the new source package.
3. Switch Roma Save response handling to source-save plus generation-request status.
4. Add generation status/version fields and stale/queued marking.
5. Wire async job requests for translation and embed generation through the named San Francisco boundaries.
6. Update copied public URL data to `https://clk.live/{accountPublicId}/{instanceId}` when the serving slice is ready.
7. Remove or block active writes of old top-level JSON files.
8. Add CI/static scans so old public IDs, old hostnames, and old sibling JSON truths cannot re-enter active product code.

Rollback during execution may keep reading old files only behind an explicit operator-only repair boundary. Product Save must not silently write both old and new truths.
