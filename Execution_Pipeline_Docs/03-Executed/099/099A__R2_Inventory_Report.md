# PRD 099A R2 Inventory Report

Generated: 2026-05-15T19:31:04.852Z

Bucket: `tokyo-assets-dev`  
Account: `a8528ec394ae2da9e5521d2ddd3aeb87`  
Method: Cloudflare R2 object API via the existing Wrangler OAuth browser-auth session, read-only `GET /accounts/{account_id}/r2/buckets/{bucket}/objects?per_page=1000`.

Status: **GREEN**

## Totals

- Objects listed: 1300
- Total bytes listed: 7359930
- Complete manifest: `Execution_Pipeline_Docs/02-Executing/evidence/099A__r2_inventory_manifest.json`
- R2 mutations performed: none

## Root Folders

| root | objects | bytes | rootDisposition | classifications |
| --- | --- | --- | --- | --- |
| accounts/ | 209 | 1726628 | keep root; move/recreate legacy UUID children | keep |
| dieter/ | 253 | 1231894 | keep | keep |
| fonts/ | 7 | 212416 | keep | keep |
| l10n/ | 302 | 1202650 | delete root after owned content is recreated under product/prague/account paths | move/recreate |
| prague/ | 434 | 1816169 | keep | keep |
| product/ | 67 | 1152043 | keep | keep |
| public/ | 18 | 15837 | delete root | delete |
| published/ | 8 | 1617 | delete root after account-scoped projections are recreated | move/recreate |
| widgets/ | 2 | 676 | delete root | delete |

## Object Classifications

| classification | objects |
| --- | --- |
| delete | 20 |
| keep | 970 |
| move/recreate | 310 |

## Reasons

| reason | objects |
| --- | --- |
| canonical git-authored CDN font root | 7 |
| canonical git-authored design-system root | 253 |
| canonical git-authored marketing/GTM root | 434 |
| canonical git-authored product software root | 67 |
| legacy root localization; PRD99 requires ownership under product, prague, or account paths | 302 |
| legacy root public bucket content; PRD99 has no root public namespace | 18 |
| legacy root published projection; PRD99 moves public projections under account-scoped ownership | 8 |
| legacy root widget software; PRD99 serves widget software from product/widgets | 2 |
| PRD99 account-owned runtime state path | 209 |

## Toxic / Migration Pattern Counts

| pattern | objects |
| --- | --- |
| account/root widgets path | 723 |
| l10n root path | 302 |
| legacy instance-prefixed id | 8 |
| legacy published widget registry path | 8 |
| legacy widget-prefixed id | 18 |
| public root path | 18 |

## 099A Gate Checks

- Unclassified roots: none
- Blocker-classified objects: 0
- Root `widgets/`: delete root
- Root `l10n/`: delete root after owned content is recreated under product/prague/account paths
- Root `public/`: delete root
- Root `published/`: delete root after account-scoped projections are recreated

## Classification Samples

### delete
- `public/instances/wgt_curated_faq_lightblurs_generic/l10n/live/en.json`
- `public/instances/wgt_curated_faq_lightblurs_generic/l10n/packs/en/408f3b90b5c1b9934cae93f630f45be4c4a7c109acaadc814d9108562870c416.json`
- `public/instances/wgt_curated_faq_minimal_techpalette/l10n/live/en.json`
- `public/instances/wgt_curated_faq_minimal_techpalette/l10n/packs/en/1505e0c91b9b81a7b620aad0299651c55df87aad2aadc24ff35813c629dfe19f.json`
- `public/instances/wgt_curated_faq_minimal_whitegreen_museum/l10n/live/en.json`
- `public/instances/wgt_curated_faq_minimal_whitegreen_museum/l10n/packs/en/799c5a4790798e0da396a013080bcb40f2ae24738b5d1ecb053b3e59e138d37b.json`
- `public/instances/wgt_curated_faq_photo_hospitality_westcoast/l10n/live/en.json`
- `public/instances/wgt_curated_faq_photo_hospitality_westcoast/l10n/packs/en/51ab0a924ea1d414dbddb0a647d32fde728a8b2f3d183e80b17b381e2df3b26b.json`
- `public/instances/wgt_curated_faq_photo_museum_art/l10n/live/en.json`
- `public/instances/wgt_curated_faq_photo_museum_art/l10n/packs/en/79d243e3f1fe1cebe92c01cf9c831167047ecea6d6cf553f18e772e55125e969.json`
- `public/instances/wgt_curated_faq_photo_restaurant_highend/l10n/live/en.json`
- `public/instances/wgt_curated_faq_photo_restaurant_highend/l10n/packs/en/38976ac05cf3f33b05e6fe796be628bd2f94b792dcbfb21786b97cf0102eab95.json`
- `public/instances/wgt_main_countdown/l10n/live/en.json`
- `public/instances/wgt_main_countdown/l10n/packs/en/638ef7f60b9c13087285e4c85285b9a18665be9ffa8337aa0d328e006f3d8abc.json`
- `public/instances/wgt_main_faq/l10n/live/en.json`
- `public/instances/wgt_main_faq/l10n/packs/en/38976ac05cf3f33b05e6fe796be628bd2f94b792dcbfb21786b97cf0102eab95.json`
- `public/instances/wgt_main_logoshowcase/l10n/live/en.json`
- `public/instances/wgt_main_logoshowcase/l10n/packs/en/a767620545e495126f671e1781983000810a5651c46ca8b7be12ed8abfbbf381.json`
- `widgets/faq/localization.json`
- `widgets/logoshowcase/localization.json`

### keep
- `accounts/00000001/assets/0852d3a0-03ea-4399-b0e0-533ad1d44a6e/blob/DesignWaves.jpg`
- `accounts/00000001/assets/0852d3a0-03ea-4399-b0e0-533ad1d44a6e/manifest.json`
- `accounts/00000001/assets/0c333b1f-dfde-4667-b3f9-ad955f8c9a26/blob/oregon.jpg`
- `accounts/00000001/assets/0c333b1f-dfde-4667-b3f9-ad955f8c9a26/manifest.json`
- `accounts/00000001/assets/461566e8-9167-4f68-984b-54b7edf0e29d/blob/original.jpg`
- `accounts/00000001/assets/461566e8-9167-4f68-984b-54b7edf0e29d/manifest.json`
- `accounts/00000001/assets/47614e7e-f955-4563-b282-2608f1ee7129/blob/museum-art.jpg`
- `accounts/00000001/assets/47614e7e-f955-4563-b282-2608f1ee7129/manifest.json`
- `accounts/00000001/assets/494d53a2-7d01-4d70-966f-66aa64e29752/blob/restaurant-highend.jpg`
- `accounts/00000001/assets/494d53a2-7d01-4d70-966f-66aa64e29752/manifest.json`
- `accounts/00000001/assets/5d07d73c-ba98-493c-98cb-8002221f42ef/blob/Veg.jpg`
- `accounts/00000001/assets/5d07d73c-ba98-493c-98cb-8002221f42ef/manifest.json`
- `accounts/00000001/assets/873aebf2-fd4c-4157-a3a9-fe3f50a5a1af/blob/waves.jpg`
- `accounts/00000001/assets/873aebf2-fd4c-4157-a3a9-fe3f50a5a1af/manifest.json`
- `accounts/00000001/assets/9f21817d-a7b5-48ad-981b-0bbff370c887/blob/original.jpg`
- `accounts/00000001/assets/9f21817d-a7b5-48ad-981b-0bbff370c887/manifest.json`
- `accounts/00000001/assets/ad1299cc-73c7-48ff-b3a2-14251fd2e88c/blob/original.jpg`
- `accounts/00000001/assets/ad1299cc-73c7-48ff-b3a2-14251fd2e88c/manifest.json`
- `accounts/00000001/assets/c81ccae1-9a99-448a-b6aa-cc263b31a9e0/blob/hospitality-westcoast.jpg`
- `accounts/00000001/assets/c81ccae1-9a99-448a-b6aa-cc263b31a9e0/manifest.json`

### move/recreate
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/countdown/pricing/locale/uk/5c131ea21d13058dcd5cb1924e033ff5caf0bac49aff5ec92b366fcd73e62127.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/countdown/pricing/locale/vi/5c131ea21d13058dcd5cb1924e033ff5caf0bac49aff5ec92b366fcd73e62127.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/countdown/pricing/locale/zh-hans/5c131ea21d13058dcd5cb1924e033ff5caf0bac49aff5ec92b366fcd73e62127.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/countdown/pricing/locale/zh-tw/5c131ea21d13058dcd5cb1924e033ff5caf0bac49aff5ec92b366fcd73e62127.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/bases/08da11d9a3121229c9a968a1d0b9958f6dfe5fce6d6366a1418c25945a27ffdd.snapshot.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/bases/c49782f485884bf484c869e027456254704e46338c8acfb180e9f37eb9fc9e8b.snapshot.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/bases/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.snapshot.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/index.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/ar/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/bn/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/cs/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/da/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/de/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/es/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/fi/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/fil/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/fr/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/he/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/hi/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
- `l10n/v/cc56db6bc27d06ed5ef0731499e513a4eb459b59/prague/widgets/faq/examples/locale/hu/6ee19ebd0cfbc54425d7d6ca9ae2fc04c47db84105b4ca54b907caf8c1939e97.ops.json`
