# PRD 099G Admin Account Recreation Report

Generated: 2026-05-15T15:56:40.372Z
Bucket: tokyo-assets-dev
Admin account public ID: 00000001

## Selected Admin Instances

| Widget | Old Source | New Instance | Overlays | SEO/GEO Meta Objects |
| --- | --- | --- | ---: | ---: |
| faq | ins_01KR8R6ZYZBDXE0DT2FB8PB0NN | UZ3JEJSHII | 28 | 58 |
| countdown | ins_01KR8R6ZYTPM6B3CHS8KZ0CEC9 | H7IF9M2K9B | 28 | 0 |
| logoshowcase | ins_01KR8R6ZZ07S5PMJVSRKM4M7K8 | 8FMVZFFPJV | 0 | 0 |

## Why Only These Three

PRD99 keeps widget software in `product/widgets/` and keeps account runtime state under `accounts/{accountPublicId}/instances/{instanceId}/`. The recreation therefore creates one normal admin account instance per real product widget and does not preserve the old duplicate account-owned widget lane.

## Remote Verification

Index entries verified: 3

## Public Tokyo Smoke

- faq UZ3JEJSHII: live 200, config 200
- countdown H7IF9M2K9B: live 200, config 200
- logoshowcase 8FMVZFFPJV: live 200, config 200

## Venice Deployment And Smoke

Venice dev was rebuilt from the PRD99 route contract and deployed to Cloudflare Pages project `venice-dev`.

Deployment URL: `https://746ee7c9.venice-dev.pages.dev`

Canonical Venice host smoke:

- faq UZ3JEJSHII: `https://venice.dev.clickeen.com/widget/00000001/UZ3JEJSHII` and render proxy passed.
- countdown H7IF9M2K9B: `https://venice.dev.clickeen.com/widget/00000001/H7IF9M2K9B` and render proxy passed.
- logoshowcase 8FMVZFFPJV: `https://venice.dev.clickeen.com/widget/00000001/8FMVZFFPJV` and render proxy passed.
