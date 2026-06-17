# PRD 124D - Tokyo Product Roots Optimization And Deletion

Status: EXECUTING
Parent: PRD 124
Owner: Tokyo git-authored product roots
Date: 2026-06-17

## Boundary

Tokyo product roots own git-authored static R2 artifacts:

- `tokyo/product/widgets/**`
- `tokyo/product/dieter/**`
- `tokyo/product/fonts/**`
- `tokyo/product/themes/**`
- approved product media
- `tokyo/roma/**`
- `tokyo/prague/**`

Tokyo product roots do not own:

- Runtime account data.
- Admin bypass lanes.
- Fixture account roots.
- Direct R2 repair paths.
- Alternate widget/page storage models.

## Findings And Required Actions

| ID | Severity | Component | Category | Evidence | Required action | Blast radius | V-risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TOKYO-R2-001 | High | R2 sync triggers | Deploy omission | `scripts/tokyo-r2-deploy-sync.mjs`, `.github/workflows/cloud-dev-workers.yml` | Align workflow triggers with every sync root or split R2 sync per root with dry-run summary gates. `media`, `roma`, and `prague` changes must not pass CI without deploy/sync path. | Cloud-dev R2 product roots | V3, V6, V7 |
| TOKYO-R2-002 | Medium | `_redirects` | Dead legacy file | `tokyo/_redirects` | Delete or move historical redirect notes to docs. Remove workflow path triggers for a file sync ignores. | Source/workflow cleanup | V1, V3, V7 |
| TOKYO-R2-003 | Medium | `tokyo/accounts` fixture root | Dead/legacy root | `tokyo/accounts/README.md`, Tokyo forbidden root docs | Delete or move to service docs. Add guard against tracked `tokyo/accounts/**`. | Source cleanup | V1, V5, V7 |
| TOKYO-R2-004 | Medium | Prague `.locales` metadata | Legacy runtime residue | `tokyo/prague/pages/*/.locales/**`, l10n verify/runtime loaders | Delete from deploy root or move to non-runtime evidence. Add sync guard for `.locales`. | Prague R2 content | V1, V3, V7 |
| TOKYO-R2-005 | Medium | Prague share icons | Duplicate assets | `tokyo/prague/assets/share-icons/**`, Prague Astro components | Delete/move as design evidence, or make these icons the actual imported runtime source. No duplicate production artifact set. | Prague assets/direct URLs | V1, V3, V7 |
| TOKYO-R2-006 | Low | FAQ page assets | Orphan assets | `tokyo/prague/pages/faq/assets/**` | Remove or wire explicit page JSON references. Add orphan asset check for Prague page assets. | Prague FAQ assets | V3, V7 |
| TOKYO-R2-007 | Medium | Product media root | Dormant deploy root | `tokyo/product/media/brand/**`, sync map | Decide owner. Remove root/assets or wire consumers plus deploy trigger. Dormant roots cannot drift. | Product media direct URLs | V3, V6 |
| TOKYO-R2-008 | Medium | Legacy widget repair/audit scripts | Direct account repair path | `scripts/widgets/migrate-106.ts`, `repair-107-fill-contract.ts`, `audit-106.mjs` | Archive write scripts as historical PRD evidence or delete them. Future repairs use Roma/Tokyo-worker product routes. Diagnostics must be explicitly non-runtime. | Admin account artifacts, account defaults/instances | V2, V6, V7, V8 |
| TOKYO-R2-009 | Planning | Prague block pages | Legacy marketing content model | `tokyo/prague/pages/**/*.json`, Prague overview docs | Keep recorded as active future migration, not green. Execute in the planned Prague/page-composer sequence after prerequisites. Do not mix into this cleanup unless product order changes. | Prague content, SEO, page model | V1, V3, V6 |

## Execution Slices

1. R2 deploy-root trigger alignment.
2. Tokyo source root cleanup: `_redirects`, `tokyo/accounts`, `.locales`, unused Prague assets, product media.
3. Legacy widget repair authority cleanup.
4. Prague block-page migration remains a separate later PRD, not an implicit completion here.

## Execution Notes

2026-06-17 redirects cleanup slice:

- TOKYO-R2-002: deleted dead `tokyo/_redirects`; Tokyo R2 deploy sync does not publish this file.
- TOKYO-R2-002: removed stale `tokyo/_redirects` workflow path triggers from Roma app verify and PR architecture gates.

2026-06-17 account fixture root cleanup slice:

- TOKYO-R2-003: deleted dead `tokyo/accounts/README.md` fixture root. Account runtime data remains Tokyo-worker/R2-owned under `accounts/{accountPublicId}/`.
- TOKYO-R2-003: added a PR architecture gate check against reintroducing tracked `tokyo/accounts/**` source roots.

2026-06-17 Prague locales deploy-root cleanup slice:

- TOKYO-R2-004: deleted stale Prague `.locales` metadata files from the Tokyo deploy root. Prague translation source remains the existing page translation JSON, not `.locales` runtime metadata.
- TOKYO-R2-004: added the required refusal in the existing Tokyo R2 deploy sync path so `.locales` metadata cannot be synced back into the Prague R2 product root.
- TOKYO-R2-004: after `pnpm cf:preflight`, deleted the five matching stale R2 keys under `prague/pages/*/.locales/**` through `scripts/cloudflare/r2.mjs delete` and verified both exact prefixes list empty.

2026-06-17 Prague duplicate share-icons cleanup slice:

- TOKYO-R2-005: deleted duplicate deployable `tokyo/prague/assets/share-icons/**` design-iteration assets. Prague share UI runtime icon truth remains `prague/src/components/Icon.astro` and the inlined brand SVGs in `prague/src/components/InstanceEmbed.astro`.
- TOKYO-R2-005: removed the stale `InstanceEmbed.astro` comment that named `tokyo/prague/assets/share-icons/*.svg` as the source.
- TOKYO-R2-005: after `pnpm cf:preflight`, deleted the 21 matching stale R2 keys under `prague/assets/share-icons/` through `scripts/cloudflare/r2.mjs delete` and verified the prefix lists empty.

## Completion Gates

- Every synced Tokyo root has a matching deploy trigger or explicit workflow.
- No tracked `tokyo/accounts/**` exists as source.
- No stale `.locales` runtime metadata deploys under `prague/**`.
- No direct account R2 write repair scripts remain executable as product paths.
- Prague block pages are either migrated by their own PRD or explicitly listed as open, not fixed.
- V1-V8 subagent audit is clean before moving to executed.
