# PRD 100F - Remove Venice Runtime And CI Guards

Status: Executing  
Owner: Product + Engineering  
Date: 2026-05-16  
Parent: `100__PRD__Static_Public_Embed_Delivery.md`

## Purpose

Remove old Venice runtime behavior from the public widget path and add CI guards so the PRD 100 static delivery contract cannot drift back into runtime assembly.

PRD 100 canonical public serving is:

```text
https://clk.live/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html
```

Public delivery is a direct static path-template rewrite. It is not a Venice render path, not a lookup-backed public namespace, and not a runtime composition service.

Surviving authority:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
```

Generated public files live directly in the instance folder. Public serving is controlled by `index.html` file presence. If `index.html` is missing, the instance is not publicly available.

## Scope

In scope:

- Remove Venice as a visitor-view render, resolve, route-map, overlay, and config-fetch hot path.
- Remove Venice URLs from copied embed code and product-facing public URL generation.
- Remove or quarantine tests, mocks, and health checks that treat Venice `/widget` or `/renders` routes as public product truth.
- Add CI guards for banned runtime namespaces, IDs, domains, redirects, and generated-output fetch behavior.
- Add public serving allowlist guards proving raw `instance.json` and `overlays/` are not publicly exposed.
- Keep the PRD 100 static delivery contract readable to future agents.

Out of scope for this slice:

- Building the final `clk.live` worker, DNS, TLS, or cache policy.
- Implementing the embed agent renderer or file writer.
- Changing `instance.json` source package schema beyond what is required to block public runtime drift.
- Translating content or generating overlays.
- Account asset library redesign.
- Preserving compatibility for old Venice runtime routes.

## Current Drift To Remove

The following surfaces were present at PRD drafting time and are deletion or containment candidates. They are implementation drift, not PRD 100 product truth:

- `venice/app/widget/[accountPublicId]/[instanceId]/route.ts` composes public widget HTML by fetching runtime projection JSON and widget HTML per request.
- `venice/app/renders/[...path]/route.ts` proxies published render JSON such as config and overlays.
- `venice/app/embed/v2/loader.ts` builds iframe/widget URLs and fetches render projection paths.
- `venice/app/embed/v2/loader.js/route.ts`, `venice/app/embed/v2.0.0/loader.js/route.ts`, and `venice/app/embed/latest/loader.js/route.ts` expose old loader entrypoints.
- `venice/tests/runtime/embed-runtime.spec.ts` asserts `/widget/{accountPublicId}/{instanceId}` and legacy `/renders/widgets/...` behavior.
- `venice/tests/runtime/mock-tokyo.mjs` mocks `/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json`, `/config.json`, and `/overlays/{locale}.json`.
- `venice/README.md` documents `GET /widget/:accountPublicId/:instanceId` and render proxy routes.
- `bob/components/EmbedModal.tsx` copies iframe snippets using Venice `/widget/{accountPublicId}/{instanceId}`.
- `scripts/health/product-path-smoke.mjs` treats Venice `/widget` and Tokyo `/renders/accounts/.../live/r.json` as public smoke truth.
- `tokyo-worker/src/routes/render-routes.ts` and `tokyo-worker/src/routes/render-routes.test.ts` expose and test public runtime JSON projection reads.
- `tokyo-worker/src/domains/render/keys.ts`, `saved-config.ts`, and `live-surface.ts` still name or write PRD 099-era `config.json`, `publish.json`, `published/config.json`, and `live/r.json` artifacts.

Executors must verify each candidate against the current branch before deleting. If a file has already been removed by an earlier slice, do not recreate it for compatibility.

## Target Behavior

The only public product URL contract for an account-owned instance is:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Required mapping:

```text
/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html

/{accountPublicId}/{instanceId}/styles.css
  -> accounts/{accountPublicId}/instances/{instanceId}/styles.css

/{accountPublicId}/{instanceId}/script.js
  -> accounts/{accountPublicId}/instances/{instanceId}/script.js
```

Rules:

- `accountPublicId` must match `^[0-9A-Z]{8}$`.
- `instanceId` must match `^[0-9A-Z]{10}$`.
- Omitted file means `index.html`.
- `index.html` presence is the public availability switch.
- Public serving may expose only generated browser files.
- Public serving must deny raw source, overlay, projection, and directory requests.
- Generated visitor-facing files must be self-contained browser output except for allowed browser support files and approved account asset URLs.

Venice must not:

- render public widget HTML
- resolve public instance identity
- route-map public embed IDs
- apply overlays
- fetch instance config, overlay JSON, or widget HTML per visitor view
- call product services on visitor view
- appear in copied embed code
- provide a compatibility route for old public runtime embeds

There is no:

- `publicEmbedId`
- `embed.clickeen.com`
- URL shortener service
- redirect alias
- second public namespace
- public copy/projection folder

## Deletion/Containment Requirements

### Venice Runtime

Remove active public visitor routes that assemble or proxy widget runtime data. The final codebase must not contain an active product path where a public visitor request flows through:

```text
Venice -> live pointer/config/overlay/widget source -> computed HTML
```

Allowed Venice residue, if any, must be explicit non-product archival code or deleted. It must not be built, deployed, linked, tested as product behavior, documented as product behavior, or reachable from copied snippets.

### Copied Embed Code

Bob/Roma copied embed snippets must use only `clk.live`.

Allowed iframe form:

```html
<iframe src="https://clk.live/{accountPublicId}/{instanceId}"></iframe>
```

Allowed script form, if script embed is supported:

```html
<script src="https://clk.live/{accountPublicId}/{instanceId}/script.js"></script>
```

The HTML entry URL must not be used as a JavaScript `src`.

Copied embed code must not include:

- `venice`
- `/widget/`
- `/renders/`
- `embed.clickeen.com`
- `publicEmbedId`
- redirect or shortener URLs

### Tokyo Runtime JSON Routes

Public Tokyo routes that exist only to feed Venice runtime composition must be deleted or made private to a non-public build/control boundary.

Forbidden as public visitor dependencies:

- `/renders/accounts/{accountPublicId}/instances/{instanceId}/live/r.json`
- `/renders/accounts/{accountPublicId}/instances/{instanceId}/config.json`
- `/renders/accounts/{accountPublicId}/instances/{instanceId}/overlays/{locale}.json`
- `/renders/widgets/{instanceId}/...`
- `published/config.json`
- `published/live/r.json`
- `published/overlays/{locale}.json`

If a private route remains for Builder, repair, migration, or agent work, it must be named as private/internal and must not be callable from generated public output or copied embed code.

### Generated Output

Generated `index.html`, `styles.css`, `script.js`, and support browser files must not call internal product services on visitor view.

Forbidden generated-output references:

- Venice routes, domains, or loader scripts
- Roma account APIs
- Bob APIs
- Tokyo internal/config/render endpoints
- San Francisco job or agent endpoints
- `instance.json`
- any `overlays/` path
- `config.json`, `publish.json`, `embed.json`, `translations.json`
- `published/` projection paths

Generated output may reference allowed static sibling files and approved account asset serving URLs only.

### Public Serving Allowlist

The `clk.live` serving layer must deny:

- `/{accountPublicId}/{instanceId}/instance.json`
- `/{accountPublicId}/{instanceId}/overlays/...`
- `/{accountPublicId}/{instanceId}/config.json`
- `/{accountPublicId}/{instanceId}/publish.json`
- `/{accountPublicId}/{instanceId}/embed.json`
- `/{accountPublicId}/{instanceId}/translations.json`
- `/{accountPublicId}/{instanceId}/published/...`
- account or instance directory listings
- path traversal or encoded traversal attempts

Allowed public files are only generated browser files such as:

- `index.html`
- `styles.css`
- `script.js`
- explicitly generated browser support files required by the mini-site

## CI Guard Requirements

Add a repo-level architecture guard script and wire it into PR CI. The guard must fail on banned active product references, not merely warn.

Recommended script name:

```text
scripts/verify/prd100-static-public-guard.mjs
```

Recommended package script:

```text
pnpm verify:prd100-static-public
```

The guard must scan active source, tests, mocks, docs, generated fixture templates, and health scripts. It may allow this PRD file and other explicit historical PRD/archive paths through an allowlist, but product code and product docs must fail.

Required banned patterns:

```text
embed.clickeen.com
publicEmbedId
/widget/
/renders/widgets/
/renders/accounts/
published/config.json
published/live/r.json
published/overlays/
live/r.json
config.json as public runtime ingredient
shortener
redirect alias
```

Required generated-output guard patterns:

```text
fetch(".../instance.json")
fetch(".../overlays/")
fetch(".../config.json")
fetch(".../published/")
fetch(".../renders/")
fetch(".../widget/")
fetch("...roma...")
fetch("...bob...")
fetch("...venice...")
fetch("...san-francisco...")
```

The guard should use structured allowlists by path and reason, not broad text exclusions. For example, historical executed PRDs may mention old routes, but `bob/components/EmbedModal.tsx`, `venice/app/**`, `roma/**`, `tokyo-worker/src/routes/**`, `scripts/health/**`, and active docs must not preserve them as behavior.

CI must also include behavioral tests:

- copied embed snippet uses `https://clk.live/{accountPublicId}/{instanceId}`
- copied iframe snippets do not contain Venice, `/widget/`, or `/renders/`
- `clk.live` route rewrite serves `index.html` when present
- missing `index.html` returns a public miss
- public requests for `instance.json`, `overlays/`, `published/`, and runtime JSON sidecars return deny/404
- generated public files do not call internal config/render endpoints

## Acceptance Criteria

- No product-facing copied embed code contains Venice, `/widget/`, `/renders/`, `embed.clickeen.com`, `publicEmbedId`, shortener, or redirect alias references.
- Public visitor rendering does not execute Venice code.
- Venice does not fetch instance config, overlay JSON, widget source HTML, live pointers, or product services on public visitor requests.
- Old Venice runtime routes are deleted, undeployed, or explicitly unreachable as product behavior.
- Tokyo public render projection routes are not required for visitor serving.
- Generated public files live directly under `accounts/{accountPublicId}/instances/{instanceId}/`.
- Public availability is controlled by `index.html` file presence.
- Public serving exposes generated browser files only.
- Public serving does not expose `instance.json`, `overlays/`, `published/`, or runtime sidecar JSON.
- Generated public output does not call internal config endpoints, Venice, Roma, Bob, Tokyo render routes, or San Francisco.
- CI fails on reintroduction of banned domains, IDs, route namespaces, runtime JSON fetches, and old copied snippet forms.
- Active docs describe `clk.live` static serving only; old Venice runtime docs are removed or marked historical outside active guidance.

## Validation/Tests

Required validation before this slice is complete:

```bash
pnpm verify:prd100-static-public
pnpm lint
pnpm typecheck
pnpm test
```

Required targeted tests:

- Bob/Roma embed snippet unit or integration test proving copied snippets use `clk.live`.
- Static serving route tests proving direct path-template rewrite to `accounts/{accountPublicId}/instances/{instanceId}/index.html`.
- Static serving deny tests for `instance.json`, `overlays/`, `published/`, directory listings, and traversal attempts.
- Generated output contract test proving `index.html`, `styles.css`, and `script.js` contain no internal runtime fetches.
- Architecture guard fixture tests proving banned patterns fail when placed in active source and pass only in explicitly allowlisted historical docs.
- Smoke test update replacing Venice `/widget` and `/renders` checks with `clk.live` static availability checks.

Manual review checklist:

- Search active product surfaces for `publicEmbedId`, `embed.clickeen.com`, `/widget/`, `/renders/`, `published/live/r.json`, and `published/config.json`.
- Confirm copied embed UI shows the canonical public URL.
- Confirm no deploy workflow still deploys Venice as the public widget runtime.
- Confirm active documentation points agents to PRD 100 static serving rather than PRD 099 Venice PBX behavior.

## Out of Scope

- Customer migration for old Venice embed URLs.
- Redirecting old Venice routes to `clk.live`.
- Maintaining old loader versions as product-compatible entrypoints.
- Creating a public short ID, alias, or second namespace.
- Adding view metering or entitlement checks to the visitor hot path.
- Moving account assets into instance folders.
- Exposing source JSON as a public API.

## Rollout/Cutover

This is pre-GA. No customer compatibility requirement exists for old Venice runtime routes.

Recommended sequence:

1. Land the `clk.live` static serving slice or a testable local equivalent.
2. Update Bob/Roma copied embed code to emit only `clk.live` URLs.
3. Remove or disable Venice public runtime routes and loader entrypoints.
4. Remove Tokyo public render projection routes that only feed Venice visitor rendering, or move any still-needed behavior behind explicit private/internal boundaries.
5. Replace product smoke tests with static `clk.live` availability and deny checks.
6. Add and enable `prd100-static-public` CI guard.
7. Update active docs and README files so PRD 100 is the only public serving guidance.
8. Confirm no active deployed workflow treats Venice as the public widget runtime.

Rollback must not reintroduce Venice runtime composition. If static serving fails during cutover, rollback to a previous deploy only as a short operational recovery action and keep the PRD 100 guard failure visible until static serving is restored.
