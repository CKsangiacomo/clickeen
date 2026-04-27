# 079 PRD - Tokyo Account-First Storage And Surface Taxonomy

Status: EXECUTED
Owner: Tokyo, Tokyo-worker, Roma, Bob, Prague, Venice
Priority: P0
Date: 2026-04-27

## 1. Problem

Tokyo currently mixes four different things in one flat folder model:

1. Product/platform source files.
2. Roma/Bob product UI resources.
3. Prague marketing/showcase resources.
4. Account-owned runtime data and generated public artifacts.

That mix created poisonous product concepts:

- `admin-owned`
- `template` as an architecture/storage class
- repo-authored instance overlays
- public `l10n/instances` as if it were product truth
- owner type as a translation path selector

This is why translation and Builder behavior keep getting stuck. The filesystem teaches the code that admin/system instances are special and that instance overlays can live in Git. Both are false.

Clickeen is account software. The runtime storage model must be account-first.

## 2. Product Truth

### Core nouns

**Widget**

The software/type. Example: FAQ, Countdown, Logo Showcase.

Widget source defines:

- defaults
- controls
- runtime HTML/CSS/JS
- limits
- editable paths
- localization/overlay allowlists

**Instance**

One saved configured widget owned by one account.

An instance owns:

- saved config
- display metadata
- asset references
- base locale
- l10n base fingerprint
- translation status
- overlay ops
- generated packs
- publish/live state

**Account**

The ownership boundary for instances, assets, usage, export, deletion, permissions, and billing.

Admin is just an account with broader permissions. Admin-owned starter content lives under the admin account exactly like every other account's content.

### Killed concepts

These must not survive as architecture/storage concepts:

- `admin-owned`
- `template`
- `curated template`
- `Prague template`
- `repo-owned instance l10n`
- `owner-specific translation flow`

The UI should also move away from "template" unless product explicitly re-approves that word after the architecture is clean. The architecture must model the thing as:

**a listed/duplicable instance.**

## 3. Final Tokyo Repo Shape

The Git repo `tokyo/` should contain product source and authored static resources only.

It should be organized by product surface, not by artifact mechanics and not by owner type.

```txt
tokyo/
  product/
    widgets/
      faq/
        spec.json
        widget.html
        widget.css
        widget.client.js
        agent.md
        limits.json
        localization.json
        layers/
          locale.allowlist.json
          geo.allowlist.json
          industry.allowlist.json
          experiment.allowlist.json
          behavior.allowlist.json
      countdown/
      logoshowcase/
      shared/

    dieter/
      manifest.json
      tokens.css
      components/
      icons/
      tokens/

    fonts/

    themes/
      themes.json

  roma/
    i18n/
      en/
        coreui.json
        account.json
        builder.json
        settings.json
        widgets.json

  prague/
    pages/
      faq/
        overview.json
        examples.json
        features.json
      countdown/
      logoshowcase/

    i18n/
      en/
        chrome.json
        marketing.json

    l10n/
      source/
        ...

    assets/

  accounts/
    README.md
```

### Notes

- Widgets are not under `roma/`. Widgets are product/platform primitives used by Bob, Roma, Venice, Prague, and Tokyo-worker.
- Roma i18n is for account-product chrome and Builder/account UI copy.
- Prague has its own folder for marketing/showcase website source.
- `accounts/` in the repo is documentation/fixture-only unless a specific local seed fixture is intentionally committed. Real account data lives in Tokyo-worker storage, not Git.
- Do not use `dist/` as a core source concept in this PRD. Build outputs are implementation details. Source folders should be named by product ownership.

## 4. Final Tokyo-Worker Storage Shape

Runtime/account data must be account-first.

Conceptual storage:

```txt
accounts/
  <accountId>/
    assets/
      meta/
        <assetId>.json
      versions/
        <assetId>/
          <versionOrFingerprint>/
            <filename>

    instances/
      <publicId>/
        saved/
          pointer.json
          config/
            <configFp>.json

        l10n/
          bases/
            <baseFingerprint>.snapshot.json

          overlays/
            locale/
              <locale>/
                <baseFingerprint>.ops.json
            geo/
              <country>/
                <baseFingerprint>.ops.json
            industry/
              <industry>/
                <baseFingerprint>.ops.json
            experiment/
              <experiment>/
                <baseFingerprint>.ops.json
            behavior/
              <behavior>/
                <baseFingerprint>.ops.json

          packs/
            <locale>/
              <textFp>.json

          live/
            <locale>.json

        render/
          config/
            <configFp>.json
          live/
            pointer.json
          meta/
            <locale>/
              <metaFp>.json

    indexes/
      instances.json
      assets.json
      usage.json
      listed-instances.json
```

### Rules

- Account root is the ownership authority.
- `publicId` alone is not the storage ownership boundary.
- All instance overlays belong under the owning account's instance.
- Translation status belongs to the saved instance revision, not a separate state file and not a repo path.
- Admin/system starter instances live under `accounts/<adminAccountId>/instances/...`.
- Copying a starter creates a new instance under the destination account.

## 5. Public Serving Projection

Public embeds and public asset reads need fast, cacheable paths. Those paths are projections from account truth, not source of truth.

Conceptual public projection:

```txt
public/
  assets/
    v/
      <opaqueAssetRef>

  instances/
    <publicId>/
      live.json
      config/
        <configFp>.json
      l10n/
        live/
          <locale>.json
        packs/
          <locale>/
            <textFp>.json
      meta/
        <locale>/
          <metaFp>.json
```

Public projection rules:

- Venice/public embed reads only published projections.
- Public paths do not own account state.
- Deleting/unpublishing an instance removes or invalidates public projections.
- Runtime generation writes account-first data first, then public projection.
- Public projection may use `publicId` because it is serving published content, not proving ownership.

## 6. Listed/Duplicable Instances Instead Of Templates

There is no `templates` storage class, route authority, API authority, or type authority.

A starter/example/listed item is an instance with metadata:

```json
{
  "listed": true,
  "duplicable": true,
  "listedSurfaces": ["prague", "roma"],
  "category": "hospitality",
  "tags": ["faq", "restaurant"],
  "title": "Restaurant FAQ",
  "description": "A ready-to-edit FAQ instance for restaurants."
}
```

Exact field names can change during implementation, but the rule cannot:

**Listed/duplicable status is metadata on an instance, not a separate model/folder/table/path.**

Prague can display listed admin-account instances. Roma can offer listed instances as starters. Duplication copies an instance into the destination account.

## 7. Current Deletion Candidates

These current paths encode the wrong architecture and must be deleted or moved:

- `tokyo/admin-owned/**`
- `tokyo/l10n/instances/**` in Git
- `tokyo/Assets/**`
- `tokyo/arsenale/**`
- docs that describe `admin-owned` as canonical
- scripts that build account instance overlays from repo-local `admin-owned`
- code/docs that treat `template` as a storage/product model

These current paths need relocation/retargeting:

- `tokyo/widgets/**` -> `tokyo/product/widgets/**`
- `tokyo/dieter/**` -> `tokyo/product/dieter/**`
- `tokyo/fonts/**` -> `tokyo/product/fonts/**`
- `tokyo/themes/**` -> `tokyo/product/themes/**`
- `tokyo/i18n/**` product-account UI catalogs -> `tokyo/roma/i18n/**`
- `tokyo/widgets/*/pages/**` Prague page content -> `tokyo/prague/pages/<widgetType>/**`

## 8. Blast Radius

### Tokyo repo/dev server

- static route roots
- `/widgets/**`
- `/dieter/**`
- `/fonts/**`
- `/themes/**`
- `/i18n/**`
- `/l10n/**`
- local proxy behavior for account-backed instance reads

### Tokyo-worker

- asset storage keys
- saved instance config keys
- l10n base/overlay/pack/live keys
- render live/config/meta keys
- public projection write/delete
- internal route handlers
- queue jobs
- integrity checks

### Roma

- Builder open/save routes
- asset upload/list/resolve/delete routes
- account usage
- widgets/listed starter discovery
- publish/unpublish
- account locale fanout

### Bob

- compiler asset URLs
- widget package fetch URLs
- Dieter manifest URL
- i18n catalog URL
- account command routes for assets/translations

### Venice

- widget package proxy
- Dieter proxy
- public render projection reads
- public l10n projection reads
- public asset reads

### Prague

- page source discovery
- starter/listed instance discovery
- localized page overlays
- static asset references
- removal of template-specific assumptions

### Scripts/docs

- `scripts/i18n/*`
- `scripts/l10n/*`
- `scripts/dev-up.sh`
- seed scripts
- Prague l10n scripts
- architecture docs
- service docs
- widget docs that mention old Tokyo paths

## 9. Concrete Deletion Ledger

This PRD is not green if the implementation only adds new paths while leaving old concepts alive.

The tables below are based on the repo snapshot on 2026-04-27. Counts are targets, not ceilings: if execution discovers more legacy files, delete them too.

### 9.1 Repo path deletions and moves

| Current path | Current size | Problem | Target action | Phase |
| --- | ---: | --- | --- | --- |
| `tokyo/admin-owned/**` | 122 files, about 6,868 JSON/MD LOC | Encodes owner type as a source/storage lane. Makes admin content special. | Delete. Move valid Roma i18n source to `tokyo/roma/i18n/**`. Convert valid starter instances into normal account-owned admin instances. | 1, 3, 4 |
| `tokyo/l10n/instances/**` in Git | 287 files, about 19,307 JSON LOC | Repo contains instance localization artifacts. This cannot scale and makes public/build output look like instance truth. | Delete from Git after account-first storage and public projection exist. Prague-specific l10n stays only under `tokyo/prague/l10n/**` or public projection, not `instances`. | 2, 4 |
| `tokyo/Assets/**` | 25 files, about 203 SVG/MD LOC | Global bucket with unclear consumer ownership. | Move by consumer: Prague-only assets to `tokyo/prague/assets/**`; shared product brand/runtime assets to `tokyo/product/assets/**` only if truly shared. Delete old path. | 1 |
| `tokyo/arsenale/**` | 2 files, 0 useful LOC | Legacy asset namespace residue. | Delete. No compatibility path. | 1 |
| `tokyo/widgets/*/pages/**` | 27 files, about 3,062 JSON LOC | Prague page source is inside widget software. | Move to `tokyo/prague/pages/<widgetType>/**`. Widget source remains only widget software/contracts. Delete old `pages` subfolders. | 1 |
| `tokyo/widgets/**` | existing widget source | Correct concept, wrong top-level location. | Move to `tokyo/product/widgets/**`. Delete old path after all references are updated. Public HTTP `/widgets/**` may remain as a serving route, but repo source must not. | 1 |
| `tokyo/dieter/**` | existing Dieter build output | Product platform resource, currently flat. | Move to `tokyo/product/dieter/**`; update manifest consumers. Delete old path after references move. Public HTTP `/dieter/**` may remain. | 1 |
| `tokyo/fonts/**` | existing font resources | Product platform resource, currently flat. | Move to `tokyo/product/fonts/**`; update consumers. Delete old path. | 1 |
| `tokyo/themes/**` | existing theme resources | Product platform resource, currently flat. | Move to `tokyo/product/themes/**`; update consumers. Delete old path. | 1 |
| `tokyo/i18n/**` | built account-product UI catalogs | Mixed output/source naming and no Roma ownership in path. | Move account-product i18n to `tokyo/roma/i18n/**`. Build scripts may still emit hashed public files, but source/ownership must be Roma-scoped. Delete old path once public serving retargets. | 1 |

### 9.2 Script deletion/rewrite targets

These scripts must not continue reading or writing the forbidden paths.

| File | Current LOC | Required result |
| --- | ---: | --- |
| `scripts/i18n/build.mjs` | 190 | Retarget from `tokyo/admin-owned/i18n` and `tokyo/i18n` to `tokyo/roma/i18n` ownership. No `admin-owned` string. |
| `scripts/i18n/validate.mjs` | 107 | Same retarget. Validation must not mention `admin-owned`. |
| `scripts/l10n/build.mjs` | 505 | Delete or rewrite so it does not build account instance overlays from Git. Prague-only l10n may get a Prague-specific script. Account instance l10n belongs to Tokyo-worker storage. |
| `scripts/l10n/validate.mjs` | 244 | Delete or rewrite to validate Prague l10n only. It must not validate `tokyo/l10n/instances/**` as repo truth. |
| `scripts/prague-l10n/*` | inspect during Phase 1 | Retarget Prague source/output to `tokyo/prague/**`. Must not use `templates` as an architecture path. |
| `scripts/dev-up.sh` | inspect during Phase 1 | Retarget prewarm/seed paths to `tokyo/product/**`, `tokyo/roma/**`, `tokyo/prague/**`, and account-first storage. |
| `scripts/dev/seed-local-platform-state.mjs` | inspect during Phase 2 | Must seed account-first storage, not root `l10n/instances` or root `renders/instances` as account truth. |

### 9.3 Tokyo dev-server deletion/rewrite targets

| File | Current LOC | Required result |
| --- | ---: | --- |
| `tokyo/dev-server.mjs` | 906 | Rewrite static roots to new repo taxonomy. Remove direct repo serving of `tokyo/l10n/instances/**`. Instance-backed l10n/render reads proxy to Tokyo-worker/account-first storage. |

Hard checks:

- No route may serve `tokyo/admin-owned/**`.
- No route may serve repo `tokyo/l10n/instances/**`.
- `/widgets/**`, `/dieter/**`, `/fonts/**`, `/themes/**`, and `/i18n/**` may remain public HTTP routes only as projections/serving URLs. They must not imply old repo source paths.

### 9.4 Tokyo-worker account-first rewrite targets

These files contain the current runtime storage and routing spine. Execution must rewrite keys here instead of layering new helpers beside old keys.

| File | Current LOC | Required result |
| --- | ---: | --- |
| `tokyo-worker/src/domains/render.ts` | 1,310 | Replace root `renders/instances/<publicId>` truth with `accounts/<accountId>/instances/<publicId>/render|saved`. Keep public projection helpers explicitly named as projection writes. |
| `tokyo-worker/src/domains/account-instance-sync.ts` | 612 | Read/write l10n bases/overlays/packs/live under account instance root; publish writes public projection only. |
| `tokyo-worker/src/domains/account-localization-state.ts` | 290 | Translations panel reads account instance saved/l10n truth only. No public projection or repo l10n fallback. |
| `tokyo-worker/src/domains/assets.ts` | 369 | Move asset bytes/manifests under `accounts/<accountId>/assets/**`; public `/assets/v/**` stays projection/read surface. |
| `tokyo-worker/src/routes/asset-routes.ts` | 91 | Account routes remain account-scoped; update storage root and integrity checks. |
| `tokyo-worker/src/routes/l10n-routes.ts` | 172 | Account l10n control routes use account-first keys. Public l10n reads use projection keys only. |
| `tokyo-worker/src/routes/internal-render-routes.ts` | 567 | Saved/open/sync/delete routes use account-first instance root. No old-key fallback after the phase gate. |
| `tokyo-worker/src/queue-handler.ts` | 127 | Queue jobs update account-first instance state, then projection if needed. |

Phase 2 is not green if any new write goes to old root-level account truth keys:

- `renders/instances/<publicId>/saved/**`
- `renders/instances/<publicId>/live/**` as source truth
- `l10n/instances/<publicId>/bases/**` as source truth
- `l10n/instances/<publicId>/locale/**` as source truth
- `l10n/instances/<publicId>/packs/**` as source truth
- `l10n/instances/<publicId>/live/**` as source truth

Those strings may exist only in clearly named public projection helpers during the temporary transition, and must be gone from source-truth helpers.

### 9.5 Roma/Builder deletion targets for `template`

Default target: remove the Roma `templates` domain entirely and replace it with listed/duplicable instance discovery only if the product still needs a starter gallery.

| File | Current LOC | Required result |
| --- | ---: | --- |
| `roma/app/(authed)/templates/page.tsx` | 9 | Delete, or replace with a new non-template route backed by listed instances. |
| `roma/app/api/account/templates/route.ts` | 46 | Delete. Replacement route must be named for listed/duplicable instances, not templates. |
| `roma/components/templates-domain.tsx` | 179 | Delete. Do not rename the component while preserving template concepts internally. |
| `roma/components/use-roma-templates.ts` | 67 | Delete. Replacement type must not be `TemplateInstance`. |
| `roma/lib/domains.ts` | 35 | Remove `templates` domain entry. |
| `roma/middleware.ts` | 60 | Remove `/templates`. |
| `roma/lib/michael-catalog.ts` | 202 | Remove call to `/v1/templates/registry`; replace with listed instance discovery if needed. |
| `roma/components/builder-domain.tsx` | 550 | Remove links/copy pointing to `/templates`; replace only after new listed-instance route exists. |
| `roma/components/widgets-domain.tsx` | 537 | Same. |
| `berlin/src/route-dispatch.ts` | 274 | Delete `/v1/templates/registry` route or replace with listed-instance registry. |

Rules:

- `template` may not remain in type names, route names, storage names, API names, or domain keys.
- If UI copy keeps the word "template", that must be consciously approved after the architecture is clean. The default target is no template copy.
- Existing Michael/Berlin template registry behavior is not a compatibility surface. Delete it or rename/rebuild it around listed instances.

### 9.6 Prague deletion/move targets

Prague must not use `templates` as an architecture path. If the public website later needs a page label that says "templates", that is a separate product-copy decision after this refactor. Prague must not own instances and must not store instance overlays.

| File/path | Current size | Required result |
| --- | ---: | --- |
| `tokyo/widgets/*/pages/**` | 27 files, about 3,062 LOC | Move to `tokyo/prague/pages/**`. |
| `tokyo/l10n/prague/**/templates/**` | inspect during Phase 1 | Rename path if it means starter/listed-instance architecture. If it is public URL copy only, isolate under Prague page l10n and document it as page copy. |
| `prague/src/lib/markdown.ts` | 279 LOC | Read from `tokyo/prague/pages/**`. |
| `prague/src/pages/api/local/curated-blocks.js` | 232 LOC | Stop reading repo `tokyo/l10n/instances/**`; listed instances come from account/system instance data. |
| `prague/src/blocks/site/nav/WidgetSubnav.astro` | 90 LOC | Remove template architecture wording or keep only public page label after approval. |
| `prague/src/components/WidgetBlocks.astro` | 472 LOC | Move page-source assumptions to `tokyo/prague/pages/**`. |
| `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro` | 178 LOC | Validate pages from Prague source, not widget source. |

### 9.7 Bob/Venice consumer retargets

| File | Current LOC | Required result |
| --- | ---: | --- |
| `bob/lib/compiler.server.ts` | 772 | Fetch widget source from the new product path while preserving public `/widgets/**` URL if needed. |
| `bob/lib/compiler/assets.ts` | 137 | Retarget widget asset path assumptions. |
| `venice/lib/tokyo.ts` | 123 | Treat public routes as projections. No account truth reads from public paths. |
| `venice/app/widgets/[...path]/route.ts` | 31 | Proxy public widget package serving from new product source/projection. |
| `venice/app/dieter/[...path]/route.ts` | 31 | Retarget Dieter product source/projection. |

## 10. No-Legacy-Preservation Rules

Execution must reduce concepts, not add compatibility layers.

Forbidden patterns:

- new `legacy*` helpers that keep old paths alive
- `try old key, then new key` product reads after a phase has migrated
- scripts that copy new account data back into old repo paths
- docs that say old paths are deprecated but still canonical enough to use
- route aliases that preserve `/api/account/templates` after the replacement route exists
- data models with both `template*` and `listed*` names for the same concept
- public projection helpers with names that omit `public` or `projection`

Allowed temporary behavior:

- A single explicit migration script may read old keys and write new keys.
- The migration script must be removed or moved to executed migration notes after use.
- During a phase, a read fallback may exist only inside a named migration command, never in product request paths.

## 11. Execution Phases

### Phase 0 - Lock Product Language

Goal: make the model explicit before moving code.

Required changes:

- Update architecture docs to define Widget, Instance, Account, Listed/Duplicable Instance.
- Mark `admin-owned` and `template` as forbidden architecture/storage concepts.
- Add an audit doc listing all current references to forbidden concepts.

Green gate:

- Docs contain the final model.
- Audit list exists.
- No code changed yet except optional checks.
- Deletion ledger is updated with actual counts before implementation begins.
- Every legacy concept has one of three labels: delete, move, or replace. No "keep for now" label.

### Phase 1 - Repo Surface Taxonomy

Goal: move Git source folders into product-surface folders without changing account runtime storage keys yet.

Required changes:

- Move widget source to `tokyo/product/widgets`.
- Move Dieter build output to `tokyo/product/dieter`.
- Move fonts/themes to `tokyo/product`.
- Move Roma/account product i18n to `tokyo/roma/i18n`.
- Move Prague page source to `tokyo/prague/pages`.
- Move Prague-specific i18n/l10n source to `tokyo/prague`.
- Update Bob/Roma/Venice/Prague/dev-server/scripts/docs references.

Green gate:

- No `tokyo/admin-owned` writes.
- `tokyo/admin-owned/**` is deleted.
- `tokyo/Assets/**` is deleted after assets are moved by consumer.
- `tokyo/arsenale/**` is deleted.
- No widget source references the old `tokyo/widgets` path.
- `tokyo/widgets/*/pages/**` is deleted after moving Prague pages.
- Bob can compile widgets.
- Roma can open Builder.
- Prague can build pages.
- Venice can serve an embed.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and build are green.

### Phase 2 - Account-First Runtime Storage

Goal: change Tokyo-worker runtime storage to account-first.

Required changes:

- Write saved configs to `accounts/<accountId>/instances/<publicId>/saved/...`.
- Write assets to `accounts/<accountId>/assets/...`.
- Write l10n bases/overlays/packs/live under the owning account instance.
- Write render config/live/meta under the owning account instance.
- Maintain public projections separately under public serving keys.
- Update internal routes and queues to pass/use account identity as the storage root.

Green gate:

- No new writes to old root-level `renders/instances/**` or `l10n/instances/**` account truth.
- Public projection writes are clearly named as public serving projection.
- Product read paths do not fallback to old root-level keys.
- `tokyo-worker` storage helper names include either `account`/`accountInstance` or `publicProjection`; ambiguous helpers are deleted or renamed.
- Account usage/list/delete/export can be answered from `accounts/<accountId>`.
- Roma Builder open/save/publish/unpublish works.
- Assets upload/list/resolve/delete works.
- Translation panel reads account instance truth.
- Venice serves only public projections.

### Phase 3 - Listed Instances Replace Templates

Goal: remove template as a product/storage model.

Required changes:

- Rename internal template discovery to listed/duplicable instance discovery.
- Admin starter content lives under the admin account.
- Prague references listed instances, not template folders.
- Roma "new widget from template" becomes "duplicate listed instance".
- Delete template-specific data paths and docs.

Green gate:

- Searches for storage/model uses of `template` are gone or explicitly UI-copy-only.
- `/api/account/templates` is deleted.
- `/templates` Roma domain is deleted or replaced by a new non-template route.
- `TemplateInstance`, `TemplatesDomain`, and `useRomaTemplates` are deleted.
- Berlin/Michael `/v1/templates/registry` is deleted or replaced by listed-instance discovery.
- Duplicating a listed admin instance creates a normal destination account instance.
- Translations/assets/overlays copy through the same instance duplication path.

### Phase 4 - Delete Old Paths

Goal: remove the toxic paths and compatibility residue.

Required deletions:

- `tokyo/admin-owned/**`
- repo `tokyo/l10n/instances/**`
- `tokyo/Assets/**`
- `tokyo/arsenale/**`
- old scripts that build account instance overlays from Git
- old docs that call admin-owned canonical
- old route aliases after current data is migrated or reseeded
- old template routes/types/domains if not already deleted in Phase 3

Green gate:

- `rg "admin-owned|tokyo/l10n/instances|tokyo/Assets|tokyo/arsenale"` has no active code/docs hits except this PRD and executed migration notes.
- `rg "TemplateInstance|TemplatesDomain|useRomaTemplates|/api/account/templates|/v1/templates/registry"` has no hits.
- No runtime code writes old account truth keys.
- No product route reads old keys as fallback.
- Full verification passes.

## 12. Verification Commands

Minimum local verification:

```sh
git diff --check
pnpm lint
pnpm typecheck
pnpm test
NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm build
```

Required negative searches:

```sh
rg -n "admin-owned|adminOwned|admin owned|admin_owned" .
rg -n "tokyo/l10n/instances|l10n/instances/.+\\.ops\\.json" .
rg -n "tokyo/Assets|tokyo/arsenale|/arsenale" .
rg -n "TemplateInstance|TemplatesDomain|useRomaTemplates|/api/account/templates|/v1/templates/registry" .
rg -n "\\btemplate\\b|\\btemplates\\b" roma bob tokyo-worker prague venice documentation scripts
```

`template` may remain only as consciously approved user-facing public copy after Phase 3, never as a storage/model/path/route/type authority.

## 13. Non-Goals

This PRD does not:

- redesign widget specs or controls
- change the visual Builder experience
- make translation synchronous
- create multi-version compatibility support
- preserve legacy local/demo paths as product behavior
- create a new "system account" storage class outside normal accounts

## 14. Tenets For Execution

- Do not patch around `admin-owned`; delete the concept.
- Do not move widgets under Roma.
- Do not create a `templates` model while claiming templates are gone.
- Do not keep old keys as silent fallbacks after the phase that replaces them.
- Do not let public projection become source of truth.
- Do not let Prague own instances.
- Do not let owner type decide translation behavior.
- Do not move to the next phase until the current phase is green.
- Each phase must end with fewer concepts than it started with.

## 15. Expected End State

After this PRD:

- Tokyo repo clearly separates product resources, Roma resources, Prague resources, and account storage documentation.
- All real instances live under account ownership.
- Admin starter instances are normal account instances.
- Templates are gone as an architecture concept.
- Public runtime files are projections.
- Instance translations and overlays are account-instance data, not repo files.
- Roma, Bob, Venice, Prague, and Tokyo-worker all speak the same product language.

## 16. Execution Result

Executed on 2026-04-27.

Deletion gates completed:

- Deleted repo `tokyo/admin-owned/**`.
- Deleted repo `tokyo/l10n/instances/**`.
- Deleted repo `tokyo/Assets/**`.
- Deleted repo `tokyo/arsenale/**`.
- Deleted Roma template routes, domain page, hooks, Michael catalog types, and Berlin template registry route.
- Removed Prague template page/l10n artifacts and replaced the public subpage model with examples/features/pricing.

Verification completed:

- `git diff --check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build:i18n`
- `pnpm build:l10n`
- `pnpm build:dieter`
- `pnpm prague:l10n:verify`
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm build`
- Required negative searches for killed storage/model/path concepts.
