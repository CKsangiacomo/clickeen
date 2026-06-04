# PRD 089 Slice 8 - Default Surface And Data Vocabulary Decision

Status: Executed

Date: 2026-05-11

## Scope

Closed the remaining starter/catalog and `curated` vocabulary gap without inventing a fake starter mode.

## Changes

1. Removed `source` from baked LogoShowcase logo asset entries in `tokyo/product/widgets/logoshowcase/spec.json`.
2. Updated `tokyo/product/widgets/logoshowcase/agent.md` so logo asset metadata is `{ name, assetId }`.
3. Removed Roma's hidden auto-create shortcut from `/widgets?intent=create`.
4. Removed the Widgets-domain group-level "create from widget type" action. Widget duplication now requires an explicit account-owned source instance row.
5. Changed visible Roma copy away from starter/create expectations:
   - header action routes to `/widgets` as `Widgets`
   - Home quick action routes to `/widgets`
   - empty Widgets state no longer promises creation from available widget types
   - table header uses `Instance ID`, not `Public ID`
6. Corrected Roma service docs so locale fanout is described as account-owned saved instances only.

## Product Decision

Roma starter browsing is out of scope for PRD 089.

PRD 089 does not add `product/catalog/roma-duplicable-instances.json`, a Roma starter endpoint, or a starter gallery. If the product later needs starter examples, that must be a separate product decision backed by real admin-owned `ins_*` account instances, not `starter`, `template`, `curated`, `system`, or `public` product identities.

## Verification

```bash
node -e "JSON.parse(require('fs').readFileSync('tokyo/product/widgets/logoshowcase/spec.json','utf8')); console.log('logoshowcase spec json ok')"
node --check tokyo/product/widgets/logoshowcase/widget.client.js
rg -n '"source"\s*:\s*"curated"' tokyo/product/widgets --glob '!**/node_modules/**'
rg -n "normalizeWidgetType|intent=create|Create widget|New widget|available widget types|Public ID|Create .*widget instance|starter|curated|systemInstanceRef|curatedRef|wgt_curated|wgt_system" roma/app roma/components roma/lib documentation/services/roma.md tokyo/product/widgets/logoshowcase --glob '!**/node_modules/**'
corepack pnpm --filter @clickeen/roma lint
NEXT_PUBLIC_TOKYO_URL=http://127.0.0.1:4001 corepack pnpm --filter @clickeen/roma build
```

Results:

- LogoShowcase spec JSON parse passed.
- LogoShowcase runtime syntax check passed.
- `source: curated` active widget scan returned no matches.
- Roma active surface scan returned no starter/gallery/public-ID UX residue except the live `normalizeWidgetType` helper in `use-roma-widgets.ts`, which is normal widget-type normalization and not starter/product identity.
- Roma lint passed with no warnings or errors.
- Roma production build passed.
