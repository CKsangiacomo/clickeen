# PRD 124B - Bob Editor Boundary Optimization And Deletion

Status: EXECUTED
Parent: PRD 124
Owner: Bob editor boundary
Date: 2026-06-17

## Boundary

Bob owns browser-memory editing:

- Open editor session state.
- Compiled controls and local edit operations.
- Sandboxed preview.
- Copilot and translation UI intent.
- Explicit save intent sent to Roma.

Bob does not own:

- Account identity.
- Account policy.
- Account asset storage routes.
- Publish truth.
- Public embed/package authority.
- Direct AI/storage/runtime authority.

## Findings And Required Actions

| ID | Severity | Component | Category | Evidence | Required action | Blast radius | V-risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BOB-01 | High | Account asset route | Dead/wrong-service authority | `bob/app/assets/account/[accountId]/[...assetRef]/route.ts`, `bob/lib/tokyo-static-proxy.ts`, `bob/lib/session/sessionTransport.ts` | Delete Bob account asset route and `proxyTokyoAccountAsset`. Hosted asset work stays through Roma host commands. If runtime evidence proves a caller, migrate caller to Roma `/api/account/assets/**`. | Bob asset URLs, stale external links | V4, V7, V1 |
| BOB-02 | Medium | Dieter public artifacts | Legacy/generated mirror | `bob/public/dieter/**`, `bob/lib/icons.ts`, Dieter docs | Remove tracked `bob/public/dieter/**` or make it generated/ignored. Bob consumes Tokyo/R2 `/dieter/**` and icon registry only. | Static Bob public paths | V1, V3, V7 |
| BOB-03 | Medium | Bob env/runtime docs | Legacy authority | `bob/wrangler.toml`, `bob/lib/env/berlin.ts`, AI/docs references | Remove dead Bob auth/AI env vars and unused env helpers. Docs must say Roma owns account and AI routes. Keep fail-closed stubs only when explicitly documented. | Deploy docs/env contracts | V7, V8, V4 |
| BOB-04 | High | Embed/copy-code UI | Wrong authority | `bob/components/TopDrawer.tsx`, `bob/components/EmbedModal.tsx`, `bob/lib/embed-snippets.ts`, `packages/ck-policy/src/registry.ts` | Move embed state/snippet generation to Roma or add a Roma host command returning current embed info. Bob only renders returned values. | Copy-code modal, public embed UX | V1, V6, V7 |
| BOB-05 | High | Website setting UI | Dead/legacy write path | `bob/components/SettingsPanel.tsx`, `bob/lib/edit/ops.ts`, widget docs | Remove Bob `context.websiteUrl` write path. Website context belongs to account/Roma settings and is passed read-only into editor/Copilot if needed. | Settings panel, Copilot context | V3, V6, V7 |
| BOB-06 | Medium | Compiler/control soft parsing | Silent healing | `bob/lib/compiler.server.ts`, `bob/lib/compiler/stencils.ts`, `bob/components/td-menu-content/showIf.ts`, `linkedOps.ts` | Make malformed widget software fail compile or fail closed. Do not skip malformed presets, JSON attrs, show-if, or linked ops. | Widget compile/editor controls | V2, V3, V4 |
| BOB-07 | Medium | Dirty/save signature | Silent substitution | `bob/lib/session/sessionTypes.ts`, `useSessionSaving.ts` | Replace `JSON.stringify` failure fallback `'{}'` with explicit invalid-state error that blocks save/dirty comparison. | Dirty tracking, save UX | V1, V5 |
| BOB-08 | Low | Public package/native UI exports | Dead/legacy surface | `bob/package.json`, `bob/bob_native_ui/textrename/**`, architecture docs | Remove unused package exports and `textrename` native UI files, or prove a current external consumer before keeping them. | Package import surface | V7, V8 |

## Execution Slices

1. Account authority cleanup: delete direct asset proxy and stale account/env surfaces.
2. Embed authority cleanup: Roma owns embed/publish snippet truth.
3. Workspace setting cleanup: remove Bob-owned website context writes.
4. Compiler strictness: malformed widget software fails instead of healing.
5. Artifact/package cleanup: tracked Dieter mirror and unused native/export paths.

## Execution Notes

2026-06-17 critical slice:

- BOB-01: deleted Bob `/assets/account/[accountId]/[...assetRef]` route and `proxyTokyoAccountAsset`.
- BOB-01: account asset list/upload/resolve/delete remains through Roma hosted Builder commands and Roma current-account asset routes.

2026-06-17 editor authority slice:

- BOB-02: deleted tracked `bob/public/dieter/**` icon mirror. Bob `/dieter/**` remains the same-origin Tokyo proxy route for preview/runtime media.
- BOB-03: deleted unused Bob Berlin env helper and removed stale Bob `BERLIN_BASE_URL`, `SANFRANCISCO_BASE_URL`, and `NEXT_PUBLIC_CLK_LIVE_URL` vars. Bob Copilot/API stubs still fail closed and hosted Builder calls still route through Roma.
- BOB-04: removed Bob embed modal/snippet generation. Roma Builder now owns widget public URL, iframe embed, and script embed copy actions using the current account, opened instance id, configured public-serving origin, and Builder-open publish status.
- BOB-05: removed Bob website URL modal and the `context.websiteUrl` write path from Settings. Website context remains outside widget instance config and belongs to account/Roma settings when implemented.
- BOB-08: deleted unused `bob/bob_native_ui/textrename/**` native UI copy and removed unused `@clickeen/bob` exports for `./builder` and `./bob-app.css`; kept `./compiled-widget-route` because Roma imports it.

2026-06-17 compiler/session strictness slice:

- BOB-06: removed permissive `show-if` parse/eval handling from ToolDrawer controls. Bob now uses one shared show-if parser for compile and runtime, validates expressions before writing `data-bob-showif`, and fails the controls surface instead of showing controls after malformed expressions.
- BOB-06: made malformed widget presets, JSON attrs, options, boolean/number attrs, fill modes, and missing ToolDrawer field types fail the compile/open path instead of being skipped, encoded as strings, or defaulted.
- BOB-06: made linked control operations reject the edit when required companion operations cannot be computed or preset targets are not editable; Bob no longer applies only the initiating op while dropping required linked updates.
- BOB-07: removed the dirty/save signature fallback from failed `JSON.stringify`. Bob now rejects unsupported editor data at open/edit/save signature boundaries instead of substituting `{}`.

## Completion Gates

- Bob has no direct account asset route.
- Bob no longer constructs public embed truth from iframe/client state.
- Bob no longer writes account/workspace settings into instance config.
- Malformed widget software does not partially render as success.
- Generated artifacts are not tracked as Bob source unless explicitly owned.
- V1-V8 subagent audit is clean before moving to executed.
