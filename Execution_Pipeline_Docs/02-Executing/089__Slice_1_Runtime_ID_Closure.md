# PRD 089 Slice 1 - Widget Runtime ID Contract Closure

Status: GREEN
Date: 2026-05-11

## Changes

Renamed the active widget runtime contract from `publicId` to `instanceId` in:

- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/localeSwitcher.js`
- `tokyo/product/widgets/shared/branding.js`
- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/faq/widget.client.js`
- `tokyo/product/widgets/countdown/widget.client.js`
- `tokyo/product/widgets/logoshowcase/widget.client.js`

`data-ck-public-id` was replaced with `data-ck-instance-id`.

Runtime message payloads now use `instanceId`.

## Verification

```bash
rg -n "publicId|public_id|data-ck-public-id|CK_WIDGET\\.publicId" tokyo/product/widgets bob roma venice prague packages --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Result: no active product-code matches.

```bash
for f in tokyo/product/widgets/shared/stagePod.js tokyo/product/widgets/shared/localeSwitcher.js tokyo/product/widgets/shared/branding.js tokyo/product/widgets/shared/previewL10n.js tokyo/product/widgets/shared/typography.js tokyo/product/widgets/faq/widget.client.js tokyo/product/widgets/countdown/widget.client.js tokyo/product/widgets/logoshowcase/widget.client.js; do node --check "$f" || exit 1; done
```

Result: all edited widget runtime files parse.

## Gate

Slice 1 is complete. Remaining `/l10n/instances` route strings in `previewL10n.js` belong to Slice 2.
