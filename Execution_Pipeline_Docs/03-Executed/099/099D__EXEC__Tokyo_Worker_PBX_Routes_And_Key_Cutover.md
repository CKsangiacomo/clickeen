# PRD 099D - Tokyo-worker PBX Routes And Key Cutover

Status: Complete  
Parent: `Execution_Pipeline_Docs/02-Executing/099__PRD__Tokyo_R2_Product_Storage_Architecture_Refactor.md`  
Owner: DEV + TPM  
Sequence: 4 of 8

## Purpose

Refactor Tokyo-worker to serve the PRD99 storage model while staying a PBX.

Tokyo-worker routes, validates named boundaries, reads/writes Tokyo objects, and returns results. It does not become the product-policy authority.

## Scope

In scope:

- serve friendly asset routes from canonical R2 roots
- update internal render routes to use account instance storage from `099C`
- remove active reads/writes for root `widgets/`, root `published/`, root `public/`, and root `l10n/`
- expose published projection reads through `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`
- keep policy decisions at Roma/system account operations

Out of scope:

- deciding whether an account should be paid/free/published
- implementing Venice public UX
- long-lived compatibility readers for old R2 paths

## Blast Radius

Likely touched:

- `tokyo-worker/src/routes/render-routes.ts`
- `tokyo-worker/src/routes/internal-render-routes.ts`
- `tokyo-worker/src/routes/asset-routes.ts`
- `tokyo-worker/src/domains/render/account-instance-transitions.ts`
- `tokyo-worker/src/domains/render/keys.ts`
- `tokyo-worker/src/domains/render/live-surface.ts`
- `tokyo-worker/src/domains/render/r2-object.ts`
- `tokyo-worker/src/domains/widget-catalog.ts`
- `tokyo-worker/src/generated/widget-seo-geo-registry.ts`
- route/helper tests

Current hot spots:

- `tokyo-worker/src/domains/render/keys.ts` builds `accounts/${accountId}/widgets`
- `tokyo-worker/src/domains/render/keys.ts` builds `published/widgets/${instanceId}.json`
- `tokyo-worker/src/domains/render/live-surface.ts` deletes root published lookups
- `tokyo-worker/src/routes/render-routes.ts` serves public render and asset routes
- current Tokyo-worker policy leaks include publication caps, l10n versions, upload size, and storage caps

## Required Work

1. Route `/widgets/{widgetType}/...` to R2 `product/widgets/{widgetType}/...`.
2. Route `/dieter/...`, `/fonts/...`, `/themes/...`, and Prague-friendly paths to their canonical roots.
3. Route internal account instance operations to `accounts/{accountPublicId}/instances/{instanceId}/...`.
4. Replace root `published/widgets/{instanceId}.json` with account-scoped published projection reads at:

```text
/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/config.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/overlays/{overlayId}.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/live/{locale}.json
/renders/accounts/{accountPublicId}/instances/{instanceId}/meta/{locale}/{metaFp}.json
```

5. Reject requests that lack required account coordinate at the named boundary.
6. Move publication caps, l10n version caps, upload size caps, and storage caps out of Tokyo-worker product-policy ownership unless the slice explicitly reclassifies a check as a bounded technical safety limit.
7. Keep allowed PBX validations narrow: auth, account capsule/path match, method/path/ID shape, codebook, object schema, R2 existence, and technical request bounds.

## Verification

Required checks:

```bash
pnpm --filter @clickeen/tokyo-worker test
rg -n "published/widgets|accounts/.*/widgets|root `widgets`|root widgets|l10n/prague" tokyo-worker/src
rg -n "product/widgets|accounts/.*/instances|published/|renders/accounts" tokyo-worker/src
rg -n "resolvePolicyFromEntitlementsSnapshot|getEntitlementsMatrix|instances.published.max|l10n.versions.max|storage.bytes.max|uploads.size.max" tokyo-worker
```

Live route checks after deploy:

```text
/widgets/faq/spec.json
/widgets/countdown/spec.json
/widgets/logoshowcase/spec.json
```

Each must resolve to R2 `product/widgets/`.

## Stop Conditions

Stop if:

- Tokyo-worker needs a compatibility reader for an old R2 path on a product route
- Tokyo-worker starts deciding billing, tier, compliance, or publish eligibility
- friendly URL shape forces a root storage folder
- Venice cannot receive enough coordinate without reintroducing root `published/`
- Tokyo-worker remains the owner of billing, tier, publication, l10n version, upload-size, or storage-cap product policy

## Exit Criteria

- Tokyo-worker routes all canonical friendly paths through PRD99 roots.
- Old root storage paths are not active product dependencies.
- Tokyo-worker remains PBX-only.

## Execution Notes

Completed in this slice:

- Public published reads are now exposed at `/renders/accounts/{accountPublicId}/instances/{instanceId}/...`.
- Legacy public `/renders/widgets/{instanceId}/...` routes remain non-resolving 404 boundaries instead of compatibility readers.
- Friendly software/CDN routes continue to proxy canonical PRD99 R2 roots, including `/widgets/...` to `product/widgets/...`.
- Tokyo Worker no longer owns product-policy caps for publish count, l10n versions, upload size, or storage bytes.
- Overlay version allocation now uses a bounded technical maximum only; tier/version policy belongs upstream.
- Added Tokyo Worker route tests for account-scoped published projection reads and legacy route non-resolution.
- Deployed Tokyo Worker version `60ae2d37-860a-478b-9c1b-acd1fc09a34f`.

Verification evidence:

- `Execution_Pipeline_Docs/02-Executing/evidence/099D__scan_removed_legacy_roots.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099D__scan_canonical_routes_and_keys.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099D__scan_policy_ownership_removed.txt`
- `Execution_Pipeline_Docs/02-Executing/evidence/099D__live_friendly_widget_r2_compare.jsonl`

Green checks:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm lint`
- `pnpm typecheck`

Live checks:

- `/widgets/faq/spec.json` matched R2 `product/widgets/faq/spec.json`.
- `/widgets/countdown/spec.json` matched R2 `product/widgets/countdown/spec.json`.
- `/widgets/logoshowcase/spec.json` matched R2 `product/widgets/logoshowcase/spec.json`.
