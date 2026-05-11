# PRD 89 - Slice 5 Derived Artifact Contract

Status: contract green; bespoke audit script removed by Slice 10
Date: 2026-05-11

## Decision

The current derived artifacts stay in the account instance subtree as explicit generated read/serving artifacts:

```text
accounts/{accountId}/widgets/index.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/published/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/l10n/base/{fingerprint}.snapshot.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/live/{locale}.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/{locale}/{metaFp}.json
```

They are not source truth. Source truth remains:

```text
accounts/{accountId}/widgets/{widgetType}/{instanceId}/instance.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/publish.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

## Changes

- Documented the source tree and derived artifact contract in `documentation/architecture/CONTEXT.md`.
- Corrected Tokyo/Tokyo-worker service docs so account inventory is `accounts/{accountId}/widgets/index.json`, not a widget-type-local index.
- Documented `seo/meta/**` as the generated per-instance SEO serving namespace.
- Slice 10 removed the bespoke `scripts/tokyo/prd89-derived-artifacts.mjs` helper because it depended on explicit inventory input and source-text self-tests. The surviving closure proof is the documented source/derived contract plus runtime behavior checks.
- Reused the existing Tokyo-worker account-index rebuild boundary: `POST /__internal/renders/widgets/index/rebuild.json`.

## Artifact Contract

| Artifact | Writer | Reader | Rebuild or repair |
| --- | --- | --- | --- |
| `widgets/index.json` | Tokyo-worker save/delete/index rebuild | Roma Widgets navigation and instance-location resolver | `POST /__internal/renders/widgets/index/rebuild.json` |
| `published/config.json` | Tokyo-worker publish/sync via `writeConfigPack` | Public `/renders/widgets/{instanceId}/config.json` after published lookup | publish/sync from `config.json` + `publish.json` |
| `l10n/base/{fingerprint}.snapshot.json` | Tokyo-worker save via `ensureSavedRenderL10nBase` | translation diff/status paths | save from `config.json` + widget localization allowlist |
| `seo/meta/live/{locale}.json` | Tokyo-worker l10n/meta generation via `writeMetaPack` | public SEO meta live pointer route | l10n/meta generation from overlay/meta pack source |
| `seo/meta/{locale}/{metaFp}.json` | Tokyo-worker l10n/meta generation via `writeMetaPack` | public SEO meta pack route | l10n/meta generation from overlay/meta pack source |

## Verification

Historical inventory result from the PRD 088 migration report:

```json
{
  "scannedKeyCount": 264,
  "classifiedKeyCount": 252,
  "generatedArtifactCount": 29,
  "sourceInstanceCount": 9,
  "issues": []
}
```

```bash
rg -n "widgets/\{widgetType\}/index\.json|index\.json.*widget type|widget type.*index\.json" documentation/architecture documentation/services -g'*.md'
```

Result: no stale widget-type-local inventory documentation.

```bash
node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit
```

Result: passed.

## Exit Criteria

1. `documentation/architecture/CONTEXT.md` explains account instance source truth and derived artifacts.
2. Tokyo-worker exposes the account-index rebuild route; kept generated artifacts are documented as derived and must be verified through behavioral checks, not source-text audit helpers.
3. Generated artifacts are documented as read/serving artifacts only; identity, ownership, saved config, and publish truth remain in source documents.
4. `seo/meta/**` is explicitly documented as the generated per-instance SEO serving namespace.
