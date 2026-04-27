# 079A Audit - Tokyo Account-First Taxonomy Deletion Map

Status: PHASE 0 GATE ARTIFACT
Date: 2026-04-27
Owner: Tokyo, Tokyo-worker, Roma, Bob, Prague, Venice

## Purpose

This audit turns PRD 79 into an execution deletion map.

Every legacy concept below has exactly one label:

- **Delete**: remove the concept/path/API/type. Do not preserve it through aliases.
- **Move**: keep the real source data but move it under the surviving owner.
- **Replace**: remove the old product model and rebuild the needed behavior using the surviving model.

There is no "keep for now" bucket.

## Product Truth Locked By This Gate

- Widget = product software/type.
- Instance = one saved configured widget owned by one account.
- Account = the ownership boundary for instances, assets, usage, billing, export, deletion, and permissions.
- Admin = a normal account with broader permissions.
- Starter/example/gallery content = listed/duplicable account-owned instances.
- Public paths = serving projections only, never account truth.

Forbidden architecture/storage concepts:

- `admin-owned`
- `template`
- repo-owned instance l10n
- owner-specific translation flows

## Repo Path Deletion And Move Map

| Current path | Measured size | Label | Required result |
| --- | ---: | --- | --- |
| `tokyo/admin-owned/**` | 122 files, 6868 LOC | Move + Delete | Move valid Roma UI catalogs to `tokyo/roma/i18n/**`. Convert any valid starter instance data into normal admin-account instance seed/storage. Delete the path. |
| `tokyo/l10n/instances/**` in Git | 287 files, 19307 LOC | Delete | Instance l10n leaves Git. Account instance l10n goes under account-first Tokyo-worker storage. Public l10n is projection only. |
| `tokyo/Assets/**` | 25 files, 203 LOC | Move + Delete | Move Prague-only assets to `tokyo/prague/assets/**`; move genuinely shared product assets to `tokyo/product/assets/**`; delete the global bucket. |
| `tokyo/arsenale/**` | 2 files, 0 LOC | Delete | Remove the dead namespace. No compatibility route. |
| `tokyo/widgets/*/pages/**` | 27 files, 3062 LOC | Move + Delete | Move Prague page source to `tokyo/prague/pages/<widgetType>/**`; delete page folders from widget source. |
| `tokyo/widgets/**` | existing widget source | Move | Move widget software/contracts to `tokyo/product/widgets/**`; public `/widgets/**` may remain only as serving URL. |
| `tokyo/dieter/**` | existing Dieter output | Move | Move product Dieter resources to `tokyo/product/dieter/**`; public `/dieter/**` may remain only as serving URL. |
| `tokyo/fonts/**` | existing font resources | Move | Move to `tokyo/product/fonts/**`; delete old root path. |
| `tokyo/themes/**` | existing theme resources | Move | Move to `tokyo/product/themes/**`; delete old root path. |
| `tokyo/i18n/**` | built/current UI catalogs | Move + Delete | Roma-owned UI catalog source goes under `tokyo/roma/i18n/**`; public serving output must not preserve root ownership confusion. |

## Script Map

| Current file | Label | Required result |
| --- | --- | --- |
| `scripts/i18n/build.mjs` | Replace | Build from Roma-owned i18n source. No admin-owned source path. |
| `scripts/i18n/validate.mjs` | Replace | Validate Roma-owned i18n source. No admin-owned source path. |
| `scripts/l10n/build.mjs` | Delete or Replace | Must not build account instance overlays from Git. If Prague needs a script, make it Prague-specific. |
| `scripts/l10n/validate.mjs` | Delete or Replace | Must not validate repo `l10n/instances` as account truth. |
| `scripts/prague-l10n/*` | Replace | Read/write `tokyo/prague/**`, not widget software folders. |
| `scripts/dev-up.sh` | Replace | Retarget local build/prewarm paths to `tokyo/product/**`, `tokyo/roma/**`, and `tokyo/prague/**`. |
| `scripts/dev/seed-local-platform-state.mjs` | Replace | Seed account-first storage, not root instance l10n/render truth. |

## Tokyo And Tokyo-Worker Map

| Current file | Label | Required result |
| --- | --- | --- |
| `tokyo/dev-server.mjs` | Replace | Serve new repo taxonomy; proxy account-backed instance l10n/render reads to Tokyo-worker; never serve forbidden paths. |
| `tokyo-worker/src/domains/render.ts` | Replace | Source truth under `accounts/<accountId>/instances/<publicId>/saved|render`; public writes clearly named projections. |
| `tokyo-worker/src/domains/account-instance-sync.ts` | Replace | L10n bases/overlays/packs/live under account instance root. |
| `tokyo-worker/src/domains/account-localization-state.ts` | Replace | Translation panel reads account instance truth only. |
| `tokyo-worker/src/domains/assets.ts` | Replace | Asset bytes/manifests under `accounts/<accountId>/assets/**`; public assets remain projection/read surface. |
| `tokyo-worker/src/routes/asset-routes.ts` | Replace | Account-scoped routes use account-first asset storage. |
| `tokyo-worker/src/routes/l10n-routes.ts` | Replace | Private l10n control uses account-first keys; public reads use projections only. |
| `tokyo-worker/src/routes/internal-render-routes.ts` | Replace | Open/save/sync/delete use account-first instance root. No product fallback to old keys. |
| `tokyo-worker/src/queue-handler.ts` | Replace | Queue jobs update account-first state, then projection when needed. |

## Template Deletion Map

Architecture rule: `template` must not survive as a route, API, storage model, type model, or domain key.

| Current reference | Label | Required result |
| --- | --- | --- |
| `roma/app/(authed)/templates/page.tsx` | Delete | Remove route or replace with a non-template listed-instance surface. |
| `roma/app/api/account/templates/route.ts` | Delete | Remove API. Replacement must be listed/duplicable instance discovery. |
| `roma/components/templates-domain.tsx` | Delete | Remove component. Do not rename while keeping template semantics inside. |
| `roma/components/use-roma-templates.ts` | Delete | Remove `TemplateInstance` model. |
| `roma/lib/domains.ts` | Replace | Remove `templates` domain entry. |
| `roma/middleware.ts` | Replace | Remove `/templates`. |
| `roma/lib/michael-catalog.ts` | Replace | Remove `/v1/templates/registry`; use listed instance discovery if needed. |
| `berlin/src/route-dispatch.ts` | Delete or Replace | Remove `/v1/templates/registry`; replacement must be listed-instance registry if the product still needs it. |
| `documentation/services/roma.md` | Replace | Remove template as a normal Roma product domain once code is changed. |
| `documentation/services/berlin.md` | Replace | Remove template registry as a current route once code is changed. |

## Prague Map

| Current reference | Label | Required result |
| --- | --- | --- |
| `prague/src/lib/markdown.ts` | Replace | Read page source from `tokyo/prague/pages/**`. |
| `prague/src/pages/api/local/curated-blocks.js` | Replace | Stop reading repo instance l10n; listed instances come from account/system instance data. |
| `prague/src/components/CuratedInstanceEmbed.astro` | Replace | Asset refs move from global bucket to Prague/product-owned assets. |
| `prague/src/components/InstanceEmbed.astro` | Replace | Asset refs move from global bucket to Prague/product-owned assets. |
| `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro` | Replace | Validate from Prague page source. |
| `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro` | Replace | Validate from Prague page source. |
| `prague/src/blocks/site/nav/widgetsMegaMenu.ts` | Replace | Read Prague page source. |
| `documentation/services/prague/*` | Replace | Remove old widget-page source paths after the move. |

## Bob And Venice Map

| Current reference | Label | Required result |
| --- | --- | --- |
| `bob/lib/compiler.server.ts` | Replace | Fetch widget source from product widget source or stable public projection. |
| `bob/lib/compiler/assets.ts` | Replace | Retarget widget asset assumptions. |
| `venice/lib/tokyo.ts` | Replace | Treat public routes as projections, not account truth. |
| `venice/app/widgets/[...path]/route.ts` | Replace | Proxy public widget package serving from product source/projection. |
| `venice/app/dieter/[...path]/route.ts` | Replace | Proxy Dieter product source/projection. |

## Phase Gates

Phase 0 is green only when:

- This audit exists.
- Architecture docs state widget/instance/account/listed-instance truth.
- The measured deletion ledger is present.
- No source code behavior has been changed in Phase 0.

Later phases are not green if they only add new paths while preserving old product models.
