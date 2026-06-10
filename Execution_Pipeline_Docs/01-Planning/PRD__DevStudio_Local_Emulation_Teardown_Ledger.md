# PRD: DevStudio Local Emulation Teardown Ledger

Status: Planning artifact for a follow-up PRD.
Source: `PRD__DevStudio_Cloudflare_Migration.md` Step 7.
Date: 2026-06-10.

## Purpose

DevStudio is now a Berlin-authenticated Cloudflare Pages surface at
`https://devstudio.clickeen.com`. This ledger inventories the local-emulation
items that were left out of Step 6 by design and gives each one a
`delete`/`keep`/`fence` proposal plus blast radius for a separate teardown PRD.

This document does not execute teardown.

## Step 7 Boundaries

- Do not delete files, local state, logs, or secrets in this PRD.
- Do not edit `scripts/dev-up.sh`, wrangler configs, `.dev.vars`,
  `tokyo/dev-server.mjs`, `Logs/`, or `.wrangler/state` in this PRD.
- Do not make Cloudflare changes in this PRD.
- Do not use this ledger to introduce new local product behavior or replacement
  architecture.
- Treat the `tokyo/` tree as product/deploy source unless a later PRD proves a
  narrower target. The local CDN stub is the target, not the whole tree.
- Treat root `.env.local` as operator secret/config material. Do not print,
  copy, or remove values as part of this ledger.

## Ledger

| Item | Current role | Evidence | Surviving authority | Proposal | Blast radius | Follow-up requirements |
| --- | --- | --- | --- | --- | --- | --- |
| `scripts/dev-up.sh` | Canonical local support-stack launcher for Bob, Berlin, Tokyo local stub, and Tokyo-worker. It no longer launches DevStudio. | Starts local ports `3000`, `3005`, `4000`, and `8791`; creates `Logs/`; uses `.dev-up.lock`; passes `TOKYO_DEV_JWT`; starts wrangler with `--env local` and `--persist-to`. | DevStudio evidence is Cloudflare Pages. Local support authority remains Bob plus Berlin plus Tokyo stub plus Tokyo-worker until a follow-up PRD retires that workflow. | fence | Removing it now breaks documented local Bob source-profile work, Berlin auth parity, Tokyo-worker local route checks, local font/R2 sync, and Bob prewarm diagnostics. | Separate teardown PRD must decide whether local Bob/Tokyo source-profile development remains supported. If retired, remove `dev-up` with the wrangler local env forks and generated state references in one change. |
| `berlin/wrangler.toml` `[env.local]` | Local Berlin Worker fork used by `dev-up` on port `3005`, with local issuer, callback, finish redirect, queue, KV, and Durable Object wiring. | `[env.local]` has localhost Berlin vars; `scripts/dev-up.sh` starts `pnpm exec wrangler dev --local --env local --port 3005`. | Cloud Berlin top-level wrangler config and deployed environment secrets remain the real auth service authority. | fence | Removing this fork breaks local Berlin health, local Google callback simulation, Bob route capsule verification, and local token/JWKS parity. Cloud Berlin is unaffected if top-level config stays intact. | Delete only in the follow-up PRD that also removes local Berlin from `dev-up` and documents the replacement for local auth-dependent testing. |
| `tokyo-worker/wrangler.toml` `[env.local]` | Local Tokyo-worker fork used by `dev-up` on port `8791`, with local Berlin/Tokyo/public-serving URLs and local KV/R2/queue bindings. | `[env.local]` points at `http://localhost:3005`, `http://localhost:4000`, and `http://localhost:8791`; `scripts/dev-up.sh` starts wrangler with `--env local --port 8791 --persist-to`. | Cloud Tokyo-worker config and deployed bindings remain the storage/control authority. | fence | Removing this fork breaks local account asset proxying, local Tokyo-worker health checks, local public-serving simulation, local R2/font sync, and any local Worker route probes. | Delete only with the Tokyo local stub and `dev-up` teardown, or keep fenced as a named local worker test profile. |
| `sanfrancisco/wrangler.toml` `[env.local]` | Non-canonical local San Francisco Worker fork. It is not started by the current `dev-up` stack but may support isolated translation/queue experiments. | `[env.local]` exists in `sanfrancisco/wrangler.toml`; package local dev can still run wrangler separately. | Cloud San Francisco worker config remains the AI/runtime worker authority. Local SF ownership is undecided. | fence | Removing it can break isolated local San Francisco queue, D1/R2/KV, and service-binding tests. It does not affect the current canonical `dev-up` stack. | Follow-up PRD must first decide whether San Francisco local testing survives. If not, delete only the `[env.local]` fork and keep cloud config untouched. |
| `tokyo/dev-server.mjs` | Local Tokyo CDN stub on port `4000`. Serves friendly local routes for Dieter, widgets, themes, fonts, i18n, Prague assets, and proxies account assets to Tokyo-worker. | File declares local `http://localhost:4000`; defaults `TOKYO_WORKER_BASE_URL` to `http://localhost:8791`; `scripts/dev-up.sh` starts it before Tokyo-worker and Bob. | The git-authored `tokyo/` product tree plus R2/cloud serving are the deploy/source authority. The stub is local URL-shape convenience only. | fence | Removing it now breaks Bob local source-profile asset/spec fetches, Dieter CSS/icon access, Prague local asset assumptions, i18n local fetches, and account asset proxy debugging. | Delete only if local Bob/Tokyo source-profile development is retired or replaced by a named cloud-dev source path. |
| `tokyo/dev-server.mjs` local upload route | Local-only mutable `POST /widgets/upload` path that writes uploaded assets under `tokyo/product/widgets/.../assets/uploads`. | Inventory found the upload behavior inside the Tokyo stub, not in cloud authority. | Real widget persistence must remain Roma/Bob saving to Tokyo, not an ad hoc local upload authority. | fence | Deleting blindly may break any manual local widget asset debugging still relying on the route. Keeping it unfenced risks preserving a local mutable path that looks like product truth. | Follow-up PRD must audit callers and either delete the route or fence it behind explicit local-debug naming and docs. |
| `tokyo/` repo tree | Product/deploy source tree containing widget source, Dieter build output, Prague assets/content, and i18n bundles. | Build and sync scripts read/write under `tokyo/`; docs map it to R2 roots. | Git-authored product/deploy source plus Tokyo/R2 deploy sync. | keep | Deleting or treating the whole tree as local-emulation residue would break widget software, Dieter assets, Prague content, i18n bundles, validation, and R2 sync. | Follow-up teardown must target the local stub and generated local state, not the entire `tokyo/` tree. |
| `berlin/.dev.vars` and `scripts/dev/generate-berlin-keys.mjs` | Ignored local Berlin signing material and generator for first-run local Berlin auth. | `scripts/dev-up.sh` calls the generator if `.dev.vars` is missing; the generator writes RSA keypair plus refresh secret to `berlin/.dev.vars`. | Deployed Berlin secrets are environment-managed outside this file. Local `.dev.vars` is only for local Berlin. | fence | Removing this while local Berlin remains breaks local token signing, refresh behavior, local JWKS parity, and active local sessions. Cloud Berlin is unaffected. | Delete only with local Berlin teardown. If local Berlin survives, document `.dev.vars` as generated local secret material and never as cloud evidence. |
| Root `.env.local` | Ignored operator config used by local support scripts and Cloudflare helper/preflight commands. | `scripts/dev-up.sh` sources it; Cloudflare and audit scripts also rely on root-local operator config. | Cloudflare deployed env/secrets and shell/operator env are separate authorities. Root `.env.local` is not product storage truth. | fence | Deleting or rewriting it can break Cloudflare API/R2 preflights, authenticated E2E helpers, local Bob/Berlin/Tokyo startup, audits, and migrations. | Follow-up teardown may remove local-emulation consumers but must not delete unrelated operator secrets or print values. |
| `prague/.env.local` | Ignored local Prague config for local asset and app URLs. | Inventory found `PUBLIC_TOKYO_URL`, `PUBLIC_BOB_URL`, and stale Paris-era local URL shape. | Prague Cloudflare Pages env and public asset config are cloud authority. | fence | Deleting it can break local Prague dev; leaving stale values can mislead future local workflow docs. Cloud Prague is unaffected. | Follow-up PRD must decide whether local Prague dev remains supported, then either delete the file expectation or fence it to Prague-only local dev and remove stale values. |
| `Logs/` | Ignored local process logs for detached `dev-up` services. | `scripts/dev-up.sh` creates `Logs/` and writes service logs such as Tokyo, Tokyo-worker, Berlin, and Bob logs. | No product authority. Logs are disposable diagnostics. | fence | Removing contents is low product risk, but removing log support while `dev-up` remains reduces startup failure evidence and health-check diagnostics. | If `dev-up` is deleted, delete the durable `Logs/` concept. If `dev-up` remains, keep it generated and ignored. |
| `.wrangler/state` | Ignored Miniflare/Wrangler persistence for local Workers, KV/R2/D1-like state, queues, and Durable Objects. | `scripts/dev-up.sh` uses `--persist-to`; Tokyo font/R2 sync scripts accept `--persist-to`. | Cloudflare deployed resources are real service authority. `.wrangler/state` is local generated persistence only. | fence | Resetting it loses local R2/font objects, Berlin local sessions/tickets, Tokyo-worker local state, and San Francisco local state. Cloud-dev/prod are unaffected. | Add an explicit reset path in the follow-up PRD if local state cleanup is wanted. Delete recreation references only when local Workers are retired. |
| `.dev-up.lock/` | Ignored local lock directory for preventing concurrent `dev-up` stacks. | `scripts/dev-up.sh` defines `LOCK_DIR="$ROOT_DIR/.dev-up.lock"`. | No product authority. It belongs only to the `dev-up` launcher. | fence | Removing while `dev-up` remains can allow overlapping local stacks and port conflicts after interrupted runs. | Delete with `dev-up`, or keep generated/ignored while `dev-up` survives. |
| Service `.wrangler/tmp` directories | Generated Wrangler build/cache directories under service packages such as Berlin, Tokyo-worker, and San Francisco. | Created by local wrangler runs; ignored by git. | No product authority. Build cache only. | delete | Deleting while no local worker is running only slows the next local worker start. No product data impact. | Follow-up PRD can include a generated-cache cleanup step, guarded by no running local wrangler process. |
| Local support-stack wiring: ports, `TOKYO_DEV_JWT`, health checks, prewarm | Glue that makes the local Bob/Berlin/Tokyo support stack act as one workflow. | `scripts/dev-up.sh` defaults `TOKYO_DEV_JWT`, waits on `3000`, `3005`, `4000`, `8791`, syncs fonts, and prewarms Bob widget routes. | Cloud evidence uses deployed hosts. Local wiring is support workflow only. | fence | Removing pieces out of order creates partial local failures: Bob starts without assets/auth, Tokyo-worker starts without Berlin/Tokyo URLs, or diagnostics lose health evidence. | Follow-up PRD must remove this as a coupled boundary, not as isolated line edits. |
| Active local workflow docs | Documentation now states DevStudio is cloud-only while local support stack remains Bob/Berlin/Tokyo stub/Tokyo-worker. | `RuntimeProfiles.md`, `CONTEXT.md`, `documentation/README.md`, and service docs were synced in Step 6. | Documentation is truth. DevStudio authority is Cloudflare Pages; local support authority remains explicitly scoped. | keep | Removing docs before removing the underlying local stack creates operator drift. Keeping old DevStudio-local docs would recreate the migration confusion. | Future teardown PRD must update docs in the same commit as any local-stack deletion. |

## Follow-up PRD Shape

A teardown PRD should split the work into explicit lanes:

1. Generated-state cleanup: `Logs/`, service `.wrangler/tmp`, stale
   `.dev-up.lock/`, and optional `.wrangler/state` reset.
2. Local support-stack boundary: `scripts/dev-up.sh`, Tokyo local CDN stub,
   Berlin/Tokyo-worker/San Francisco `[env.local]` forks, Berlin `.dev.vars`,
   local ports, `TOKYO_DEV_JWT`, health checks, and prewarm behavior.
3. Product-source preservation: `tokyo/` stays unless a separate product/deploy
   PRD proves a narrower source migration.
4. Docs sync: local workflow docs change in the same commit as any teardown.

## Step 7 Result

Step 7 is green when this planning artifact is committed. DevStudio Cloudflare
migration closure stops here. The post-108 policy-page extension is a follow-up
DevStudio update after 108A-1 defines the new schema authority.
