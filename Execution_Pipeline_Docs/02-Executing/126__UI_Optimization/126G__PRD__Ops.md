# 126G - PRD: UI Source And Delivery Cleanup

Status: STEP 9 COMPLETE - G1 through G4 GREEN.
Parent: `126__PRD__UI_Optimization_Program.md`.
Execution dependency: 126A through 126E are GREEN. Complete 126G before 126F.
Living docs: `documentation/engineering/UI/ops.md` and
`documentation/services/dieter.md`.

## Product Decision

`scripts/build-dieter.js` and `tokyo/product/dieter/**` are legacy from the
local-build era. They are not an architecture to improve or move into CI.
They must be deleted.

The only surviving manual generation tool is:

```text
tooling/sf-symbols/**
```

The human product owner uses that tool to create the approved Dieter SVG icon
source. It is not CI, runtime code, or deployment machinery.

## Final Architecture

```text
Dieter app UI
  dieter/tokens/** + dieter/components/**
    -> compiled directly by Bob, Roma, Prague, and DevStudio

Public widget instance
  widget source + required Dieter source CSS
    -> accounts/{accountPublicId}/instances/{instanceId}/styles.css
    -> accounts/{accountPublicId}/instances/{instanceId}/runtime.js

Dieter icons
  tooling/sf-symbols (human-operated)
    -> dieter/icons/svg/**
    -> GitHub Actions
    -> R2 dieter/icons/svg/**
    -> /dieter/icons/svg/{name}.svg
```

There is no generated Dieter deployment tree, editor bundle, runtime manifest,
component registry, compatibility route, or second build system.

## Current Legacy To Remove

- `scripts/build-dieter.js` copies and recompiles Dieter source into 258 files
  under `tokyo/product/dieter/**`.
- Bob and Roma download generated `editor.css` and `editor.js`.
- Bob discovers hydrators through a generated `window.Dieter` global.
- Widget HTML links remote Dieter token and button CSS.
- The runtime materializer preserves those links as external CSS imports.
- Prague downloads remote token CSS.
- Tokyo deploys and publicly serves the entire generated Dieter tree.
- Package scripts, workflows, tests, and living docs preserve that model.

## Authority Map

| Concern | Authority | Required result |
| --- | --- | --- |
| Dieter tokens and components | `dieter/**` source | Applications compile source directly. |
| Bob/Roma control hydration | Bob consuming Dieter source exports | Explicit hydrator calls; no `window.Dieter` discovery. |
| Widget instance CSS/JS | Existing runtime materializer | Required CSS is written into `styles.css`; runtime stays in `runtime.js`. |
| Prague UI | Prague build consuming Dieter source | No remote token stylesheet. |
| Icon authoring | `tooling/sf-symbols` operated by the human | Writes approved SVG source. |
| Icon deployment | GitHub Actions and Tokyo R2 sync | Only `dieter/icons/svg/**` is deployed. |
| Public Dieter route | Tokyo-worker | Only `/dieter/icons/svg/*.svg` is public. |
| Account runtime | Existing Tokyo/Roma product operations | Unchanged. |

## Execution Slices

### Slice G1 - Bob And Roma Consume Source

1. Remove generated editor CSS/JS tags from Bob and Roma layouts.
2. Compile Dieter token and component CSS directly into both applications.
3. Replace `window.Dieter` discovery with explicit Dieter source imports.
4. Export and call every current hydrator, including toggle, object manager,
   and repeater.
5. Make nested object-manager/repeater hydration call the same explicit
   hydrator function. Do not add a registry or compatibility global.
6. Narrow Bob/Roma `/dieter/**` proxying to icon SVGs only.

Green gate:

- Bob and Roma build/typecheck.
- FAQ, Cards, Logo Showcase, and Split Carousel editors retain repeated-item,
  toggle, dropdown, text, upload, and asset controls.
- No Bob/Roma source references `editor/editor.css`, `editor/editor.js`, or
  `window.Dieter`.

### Slice G2 - Widgets And Prague Own Their CSS

1. Keep widget-source stylesheet declarations as explicit materialization
   inputs. Remove the unused button declaration from the six widgets that do
   not use Dieter button classes; FAQ and Logo Showcase keep it.
2. Supply the declared Dieter source CSS to the existing widget package input.
3. Make the existing materializer write those bytes into instance
   `styles.css`.
4. Delete the materializer branch that emits external `/dieter/**` CSS imports.
5. Compile Dieter tokens directly into Prague and remove its remote token link.
6. Keep icon URLs as `/dieter/icons/svg/{name}.svg`.

Green gate:

- Materialized instance `index.html` references its own `styles.css` and
  `runtime.js`.
- `styles.css` contains required Dieter tokens/component styles.
- No materialized instance CSS imports `/dieter/tokens/**` or
  `/dieter/components/**`.
- Prague builds with local Dieter token source and CDN SVG icons.
- Existing materializer and instance-package tests pass after fixture updates.

### Slice G3 - Icon-Only Tokyo Delivery

1. Change Tokyo R2 sync from `tokyo/product/dieter/** -> dieter/**` to
   `dieter/icons/svg/** -> dieter/icons/svg/**`.
2. Remove Dieter build invocation and generated-tree workflow triggers.
3. Trigger icon deployment from authoritative icon source changes.
4. Narrow Tokyo public serving from `/dieter/**` to
   `/dieter/icons/svg/*.svg`.
5. Preserve the existing Git/GitHub Actions deployment path.
6. Do not add a manifest, copied tree, parity system, or local deployment lane.

Green gate:

- GitHub Actions deploys current source SVGs.
- Representative SVGs read successfully through the public route.
- `/dieter/editor/**`, `/dieter/components/**`, `/dieter/tokens/**`,
  `/dieter/manifest.json`, and `/dieter/icons/icons.json` are not public.

### Slice G4 - Delete Legacy Completely

Delete:

- `scripts/build-dieter.js`
- `scripts/verify-svgs.js`
- entire `tokyo/product/dieter/**` tree
- root `build:dieter` package command
- Dieter package `build`, false `main`, install-time `prepare`, and unused GSAP
- Bob's unused GSAP
- obsolete lockfile entries
- broad Dieter proxies and route descriptions
- generated-manifest dependencies in active 126 PRDs
- living documentation for the generated deployment model

Keep:

- `tooling/sf-symbols/**`
- `dieter/icons/svg/**`
- Dieter source tokens/components
- Dieter package typechecking and real dependencies
- existing application, widget, instance-materialization, GitHub, and
  Cloudflare authorities

Remote cleanup after all consumers and deployment are green:

```text
delete R2 dieter/components/**
delete R2 dieter/editor/**
delete R2 dieter/tokens/**
delete R2 dieter/manifest.json
delete R2 dieter/icons/icons.json
keep   R2 dieter/icons/svg/**
```

Use the existing approved Cloudflare operation commands. Do not create a
cleanup script or controller.

## Exact Blast Radius

Bob/Roma:

- `bob/app/layout.tsx`
- `roma/app/layout.tsx`
- `bob/components/td-menu-content/dom.ts`
- `bob/app/dieter/[...path]/route.ts`
- `roma/next.config.mjs`
- Dieter component source needed to export object-manager/repeater/toggle
- Bob/Roma app CSS source entrypoints

Widgets/materializer/Prague:

- eight `tokyo/product/widgets/*/widget.html` files
- existing widget artifact input/build files
- `packages/ck-runtime-materializer/src/runtime.ts`
- existing runtime-materializer and Roma package fixtures/tests
- `prague/src/layouts/Base.astro`

Tokyo/deploy:

- `scripts/tokyo-r2-deploy-sync.mjs`
- `.github/workflows/cloud-dev-workers.yml`
- `.github/workflows/cloud-dev-roma-app.yml`
- `tokyo-worker/src/asset-utils.ts`
- Tokyo asset/public-route tests
- `tokyo-worker/wrangler.toml` only if route configuration requires narrowing

Packages/deletions/docs:

- `package.json`
- `dieter/package.json`
- `bob/package.json`
- `pnpm-lock.yaml`
- `.gitignore`
- root `AGENTS.md` and `README.md`
- current architecture, Cloudflare, Dieter, Tokyo, widget, and iconography docs
- active downstream 126 PRDs that still mention generated manifests,
  generated Dieter output, or remote Dieter CSS/JS

## Explicit No-Touch

- Account assets and fonts
- Account instance source and overlays
- Translation behavior
- Supabase
- Berlin and San Francisco
- Widget product behavior beyond CSS delivery
- Prague icon URLs and compile-time icon-name validation
- Untracked `tokyo/product/fonts/**`

## Forbidden Drift

- No replacement Dieter build script.
- No generated `tokyo/product/dieter/**` directory.
- No editor CSS/JS bundle.
- No `window.Dieter` compatibility global.
- No runtime component discovery or registry.
- No Dieter runtime manifest.
- No path/byte parity or provenance system.
- No compatibility aliases for removed Dieter routes.
- No new R2 cleanup, reconciliation, rollback, ledger, or controller.
- No CI execution of the human SF Symbols authoring tool.

## Step-9 Execution Record

Status on 2026-07-27: **G1 through G4 GREEN; 126G complete.**

- Source cleanup landed in `971b4b16`. It deleted the legacy Dieter builder,
  SVG verifier, generated `tokyo/product/dieter/**` tree, editor bundle,
  `window.Dieter` discovery, broad proxies, obsolete package hooks, and unused
  dependencies. Bob, Roma, Prague, DevStudio, widgets, and the existing
  materializer now consume Dieter source directly.
- Public-host icon routing was corrected in `295e2232`. Tokyo serves only
  `/dieter/icons/svg/*.svg` on the public host.
- Root lint and typecheck, Dieter governance, runtime-materializer tests,
  all-widget Roma instance-package tests, Tokyo public-serving tests, and
  Bob/Roma/Prague production builds completed successfully.
- Exact-SHA GitHub Actions completed successfully for `971b4b16`: workers/R2
  run `30251895264`, Prague run `30251895299`, Roma run `30251896133`, and
  reachability runs `30252088472` and `30252506146`. Exact-SHA worker and
  reachability runs `30253524082` and `30253634499` completed successfully for
  `295e2232`.
- Approved Cloudflare preflight completed successfully. R2 `dieter/` contains
  exactly the 157 authoritative `dieter/icons/svg/**` objects and no editor,
  component, token, manifest, or icon-registry objects.
- Live public evidence: `globe.svg` returns `200`; removed editor, token,
  manifest, and icon-registry paths return `404`. Authenticated read-only
  Builder smoke passed, and the three current published pre-GA base packages
  return `200` for `index.html`, `styles.css`, and `runtime.js`.
- Existing pre-GA instances do not require compatibility repair or migration
  for 126G. They may be deleted/recreated or have translations regenerated
  through the product when useful. No translation, Supabase, or instance
  repair is a 126G completion dependency.
- Independent review passed V1-V8: the legacy delivery system was deleted
  rather than wrapped or renamed, required hydrators and widget behavior remain,
  missing package inputs still fail visibly, and runtime behavior does not
  depend on verification machinery.

## Final Verification

- Full lint and typecheck.
- Focused Bob, Roma, Prague, Dieter, materializer, instance-package, and
  Tokyo-worker tests/builds for changed surfaces.
- Static search proves all deleted concepts are absent.
- Git diff proves generated Dieter output is deleted, not relocated.
- Exact GitHub Actions SHA is green.
- Public application/editor/widget smoke verifies the owning product paths.
- R2 and public-route evidence proves icon-only Dieter delivery.
- Independent V1-V8 audit is green.

126G is complete only when consumers no longer depend on the legacy generated
tree and that tree is absent from Git, R2, routes, workflows, packages, tests,
active PRDs, and living documentation.
