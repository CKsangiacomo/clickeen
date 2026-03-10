# PRD 063 — Pages Deploy Plane Convergence: Cloudflare Git Build As Sole Deploy Truth

Status: EXECUTING
Date: 2026-03-10
Owner: Product Dev Team
Priority: P0 (process + infrastructure convergence)

> Core mandate: Cloudflare Pages apps must have exactly one deploy plane. Today the repo carries two: Cloudflare Git-connected build and GitHub Actions + `wrangler pages deploy`. That is architecture drift. This PRD hard-cuts Pages deploy to one boring model: Git remains the trigger, Cloudflare Pages Git build performs the deploy, and GitHub Actions stops acting as a second deploy orchestrator for Pages apps.

> AI-native process rule: deployment logic must live where AI agents naturally reason about it. App-local build contracts are legible. Hidden workflow orchestration, project creation, secret sync, and path translation in GitHub Actions are not.

Pre-GA hard-cut rule:
- Clickeen is pre-GA.
- There is no need to preserve dual deploy planes.
- If a Pages app has both Git-connected deploy and `wrangler pages deploy`, one of them is wrong and must be removed.
- No `legacy`, `compat`, `temporary`, or “keep both for safety” behavior is allowed.

Environment contract:
- Integration truth: `cloud-dev`
- Local is for iteration and verification
- Canonical local startup: `bash scripts/dev-up.sh`
- No destructive Supabase resets
- No git reset/rebase/force-checkout

---

## One-line Objective

Make Pages deployment boring:
- Git push is the trigger
- Cloudflare Pages Git build is the only deploy plane for Pages apps
- Each app owns one build contract, one output directory, and one Cloudflare project configuration
- GitHub Actions stops deploying Pages artifacts

---

## Problem Statement

Today the Pages deployment model is split across two systems:

1. **Cloudflare Pages Git-connected builds**
2. **GitHub Actions workflows that run `wrangler pages deploy`**

This causes recurring drift:

- Build/output path fixes solve one plane and not the other
- Dashboard/root-directory behavior and workflow/path behavior diverge
- AI agents update app code but forget workflow orchestration logic
- GitHub Actions becomes a second hidden architecture
- Bob/Next.js monorepo quirks amplify the problem first

The recurring Bob failure is the proof:
- app build succeeded
- Cloudflare Git build then failed on output-directory validation
- because the repo was trying to satisfy two deploy planes at once

This is not a one-off CI bug. It is a process architecture problem.

---

## Why This PRD Exists

For a `1 human architect + AI coding teams` system:

- GitHub Actions is easy for AI to forget
- Cloudflare dashboard state is easy for AI to forget
- Running both at once guarantees drift

The correct process is the one with the fewest hidden layers.

Cloudflare Pages Git build is the right sole deploy plane for Pages apps because:

- Git remains the trigger
- app-local config remains the source of truth
- there is no second workflow-based deploy orchestrator
- each Pages project can be understood as:
  - repo
  - branch
  - root directory
  - build command
  - output directory
  - env vars

That is legible to both humans and AI.

---

## In Scope

Pages deploy process for:

- `bob`
- `roma`
- `venice`
- `prague`

Including:

- app-local build/output contracts
- Cloudflare Pages project settings
- repo docs describing deploy ownership
- removal of GitHub Actions Pages deploy logic

---

## Out of Scope

These are not part of this PRD:

- Worker deploy process for `paris`, `tokyo-worker`, `sanfrancisco`, `berlin`
- Changing app runtime behavior
- Re-architecting Bob/Roma/Venice/Prague app code beyond what is needed for one clean build contract
- Replacing Cloudflare Pages as hosting provider
- General GitHub Actions removal for lint/test/typecheck

GitHub Actions may continue to run:

- lint
- typecheck
- tests
- non-Pages Worker deploys if still justified

But it must stop deploying Pages apps.

---

## Non-Negotiable Rules

1. Each Pages app must have exactly one deploy plane.
2. For Pages apps, the only deploy plane after this PRD is Cloudflare Pages Git build.
3. GitHub Actions must not:
   - create Pages projects
   - sync Pages secrets
   - deploy Pages artifacts
4. Each Pages app must own one app-local build contract:
   - root directory
   - build command
   - output directory
5. Build output directories must remain app-local, not cross-app shared at repo root.
6. No app may require path translation glue between build script and deploy plane after this PRD.
7. Dashboard config must match repo-documented intent exactly.
8. Documentation must explicitly say that Cloudflare Pages projects are Git-connected deploy targets and GitHub Actions is not the Pages deploy plane.
9. The human architect owns one-time dashboard/project alignment. AI may document it, but must not simulate it with hidden workflow glue.
10. No dual deploy systems may remain after cutover.

---

## Target Model

### Pages deploy contract

For every Pages app:

- `git push` to `main` triggers deploy
- Cloudflare Pages pulls the repo
- Cloudflare Pages builds from the app root
- Cloudflare Pages reads the app-local build contract
- Cloudflare Pages deploys the artifact

No GitHub `wrangler pages deploy`.

### App-local ownership

Each app owns:

- its own root directory
- its own build script
- its own output path
- its own required env vars

### Human-owned infra setup

The human architect performs one-time Cloudflare Pages project alignment:

- root directory
- production branch
- build command
- output directory
- env vars
- Git integration enabled
- Git build is the only active deploy behavior for the project

After that, the repo should not need workflow glue to deploy Pages.

---

## Canonical App Matrix

### Bob

Project:
- `bob-dev`

Root directory:
- `bob`

Build command:
- `pnpm build:cf`

Output directory:
- `.cloudflare/output/static`

Canonical public host:
- `https://bob.dev.clickeen.com`

Host binding rule:
- authenticated Builder/runtime flows must use the custom `*.clickeen.com` host shape
- `*.pages.dev` is not an acceptable public runtime host for authenticated Bob flows
- reason: Bob participates in the shared httpOnly cookie/auth boundary with Roma

Required env vars:
- `NEXT_PUBLIC_TOKYO_URL`
- `PARIS_BASE_URL`
- `BERLIN_BASE_URL`
- `SANFRANCISCO_BASE_URL` where required by deployed environment

Hard rule:
- Bob output must remain app-local under `bob/.cloudflare/output/static`
- `bob/wrangler.toml` must point to `.cloudflare/output/static` relative to `bob/`
- Bob build-script monorepo workaround (`repo-root .vercel/project.json` + `rootDirectory: 'bob'`) must be explicitly decided in this PRD execution:
  - resolved keep decision: retain it only as an ephemeral Vercel monorepo builder prerequisite
  - it must not change the app-local output contract
  - it must not reintroduce repo-root shared output or a second deploy plane

### Roma

Project:
- `roma-dev`

Root directory:
- `roma`

Build command:
- `pnpm build:cf`

Output directory:
- `.vercel/output/static`

Canonical public host:
- `https://roma.dev.clickeen.com`

Host binding rule:
- authenticated Builder/runtime flows must use the custom `*.clickeen.com` host shape
- `*.pages.dev` is not an acceptable public runtime host for authenticated Roma Builder flows
- reason: shared httpOnly cookie/auth boundary with Bob requires the supported custom-domain host shape
- Roma build-script monorepo workaround (`repo-root .vercel/project.json` + `rootDirectory: 'roma'`) is also explicitly kept only as an ephemeral Vercel monorepo builder prerequisite; it must not change the app-local output contract or reintroduce a second deploy plane

Required env vars:
- `PARIS_BASE_URL`
- `NEXT_PUBLIC_TOKYO_URL`
- `BERLIN_BASE_URL`
- other documented auth/session vars required by Roma runtime

### Venice

Project:
- `venice-dev`

Root directory:
- `venice`

Build command:
- `pnpm build:cf`

Output directory:
- `.vercel/output/static`

Canonical public host:
- `https://venice.dev.clickeen.com`

Required env vars:
- `TOKYO_URL` or `TOKYO_BASE_URL` or `NEXT_PUBLIC_TOKYO_URL`
- `VENICE_INTERNAL_BYPASS_TOKEN` where required

### Prague

Project:
- `prague-dev`

Root directory:
- `prague`

Build command:
- `pnpm build`

Output directory:
- `dist`

Canonical public host:
- `https://prague.dev.clickeen.com`

Required env vars:
- `PUBLIC_TOKYO_URL`
- `PUBLIC_BOB_URL`
- `PUBLIC_VENICE_URL`
- `PUBLIC_PARIS_URL` / `PARIS_BASE_URL` where required
- `PUBLIC_ROMA_URL`

---

## Current Drift To Remove

### A. GitHub Actions as Pages deploy plane

These workflows currently deploy Pages artifacts and must stop doing so:

- `.github/workflows/cloud-dev-roma-app.yml`
- `.github/workflows/cloud-dev-venice-app.yml`
- `.github/workflows/cloud-dev-prague-app.yml`
- `.github/workflows/cloud-dev-prague-content.yml`

Important explicit note:
- `cloud-dev-roma-app.yml` currently deploys **both Roma and Bob**
- removing Pages deploy from that workflow removes Bob's current workflow fallback deploy as well
- therefore Bob Cloudflare Git project alignment must be complete before the workflow deploy is deleted

### B. Workflow-owned Pages project mutation

These behaviors must be removed from CI:

- `wrangler pages project create ...`
- `wrangler pages secret put ...`
- `wrangler pages deploy ...`

### C. Repo contracts shaped to satisfy two planes

This class of glue must be removed:

- repo-root/shared output path workarounds
- path translation between build script and deploy script
- deploy-only path indirection that exists only because GitHub Actions deploy is still active

---

## Execution Order

### Phase 1 — Freeze the deploy model in docs

Document the final rule before changing infra:

- Pages apps deploy via Cloudflare Git build only
- GitHub Actions is not the Pages deploy plane
- app-local build contracts are canonical

Update docs:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `documentation/services/venice.md`
- `documentation/services/prague/prague-overview.md`

Done when:
- no doc teaches `wrangler pages deploy` as the canonical Pages deploy model
- docs explicitly state Git-connected Cloudflare Pages build is the only Pages deploy plane

### Phase 2 — Normalize app-local build contracts

Ensure each app can be built locally with the exact same contract Cloudflare Git build will use.

Tasks:

- Bob:
  - keep output app-local at `bob/.cloudflare/output/static`
  - remove repo-root output special cases introduced only to satisfy workflow deploys
  - update `bob/wrangler.toml` so `pages_build_output_dir` is `.cloudflare/output/static` relative to `bob/`
- Roma:
  - verify `roma/.vercel/output/static`
- Venice:
  - verify `venice/.vercel/output/static`
- Prague:
  - verify `prague/dist`

Done when:
- each app builds from its own root
- each app writes only to its own output directory
- no app requires repo-root output paths for Pages deploy

Verification:
- `pnpm -C bob build:cf`
- `pnpm -C roma build:cf`
- `pnpm -C venice build:cf`
- `pnpm -C prague build`

### Phase 3 — Produce the human architect setup checklist

Create one explicit checklist per Pages app for Cloudflare dashboard/project alignment:

- project name
- repo
- branch
- root directory
- build command
- output directory
- canonical public host
- host binding rule / custom-domain requirement where applicable
- required env vars
- env var source-of-value table:
  - variable name
  - required vs optional
  - exact `cloud-dev` value
  - source-of-truth owner

This is a human-owned infra step and must be documented explicitly, not hidden in CI glue.

Done when:
- the repo contains one clear per-app setup checklist
- no AI needs to infer Pages project settings from workflow shell commands

### Phase 4 — Align Cloudflare Pages projects manually

Human architect action:

- hard-cut any non-canonical deploy behavior/fallback by making Pages projects Git-connected and correctly configured
- ensure Git build is enabled for:
  - `bob-dev`
  - `roma-dev`
  - `venice-dev`
  - `prague-dev`
- ensure each project uses the canonical app matrix from this PRD
- ensure Git build is the only active deploy behavior for each Pages project
- disable any remaining non-canonical deploy behavior/fallback where applicable
- ensure required custom-domain host bindings are configured for apps that depend on them
- ensure unsupported `*.pages.dev` runtime hosts are not treated as valid product hosts where this PRD forbids them

Done when:
- all 4 projects are configured to build from Git
- no Pages project depends on GitHub Actions artifact deploys
- Bob and Roma use the supported custom-domain runtime hosts for authenticated Builder flows

### Phase 5 — Remove Pages deploy logic from GitHub Actions

Delete Pages deploy responsibilities from workflows:

- remove Pages project creation
- remove Pages secret sync
- remove Pages artifact deploy

Keep only code-quality checks where still useful.

Likely outcomes:

- `cloud-dev-roma-app.yml` becomes lint/typecheck/build verification only, or is deleted if redundant
- `cloud-dev-venice-app.yml` becomes build verification only, or is deleted if redundant
- `cloud-dev-prague-app.yml` / `cloud-dev-prague-content.yml` stop deploying Pages and become smoke/build verification only, or are deleted if redundant

Done when:
- no workflow contains `wrangler pages deploy`
- no workflow contains `wrangler pages project create`
- no workflow contains Pages secret syncing

### Phase 6 — Remove dual-plane path glue

Delete path logic that only exists because GitHub Actions was also a deploy plane.

Examples:

- Bob repo-root output workaround once Pages Git build is canonical
- Bob `wrangler.toml` must stop pointing at repo-root output and point only at the app-local Pages build output
- any deploy-path translation from app-local output to workflow-specific output
- Bob build-script monorepo workaround must be resolved explicitly:
  - keep with documented justification
  - or delete
  - no ambiguous residue

Done when:
- build scripts express only the app-local build contract
- no path exists only to satisfy GitHub Actions deploy

### Phase 7 — Acceptance review and hard closure

Validate the final state:

- push to Git triggers Pages deploy
- each Pages app builds from its own root
- Cloudflare Pages succeeds without GitHub artifact deploy
- GitHub Actions does not deploy Pages

Done when:
- a fresh commit to `main` deploys the Pages apps through Cloudflare Git build only
- repo docs and runtime behavior match exactly

---

## Acceptance Gates

1. Bob, Roma, Venice, and Prague each have exactly one deploy plane.
2. That deploy plane is Cloudflare Pages Git build.
3. GitHub Actions contains zero `wrangler pages deploy` commands for Pages apps.
4. GitHub Actions contains zero Pages project creation commands.
5. GitHub Actions contains zero Pages secret sync commands.
6. Each Pages app has one app-local build contract and one app-local output directory.
7. No Pages app depends on a repo-root shared output path.
8. Docs explicitly teach:
   - Git triggers deploy
   - Cloudflare Pages Git build performs deploy
   - GitHub Actions is not the Pages deploy plane
9. The human checklist contains an explicit env var source-of-value table for each Pages app.
10. Bob build-script monorepo workaround is either removed or explicitly justified in docs/runtime comments.
11. Bob and Roma custom-domain host bindings are configured exactly as required by the app matrix.
12. A fresh push to `main` deploys Pages successfully without manual artifact deploy.

---

## Hard Failure Conditions

This PRD is not done if any of these remain true:

- a Pages app still deploys through GitHub Actions
- a Pages app still also deploys through Cloudflare Git build
- workflows still mutate Pages projects or secrets
- Bob still requires a repo-root output workaround because the old dual-plane deploy model remains active
- Bob build-script monorepo workaround remains without an explicit keep/delete decision and justification
- Bob or Roma deploy is considered complete while still relying on an unsupported `*.pages.dev` runtime host for authenticated Builder flows
- docs still describe two valid Pages deploy methods
- any app requires “special” path translation only to survive both deploy systems

---

## What This PRD Is Not

This PRD is not:

- a generic CI modernization effort
- a rewrite of Worker deploys
- a migration to a new hosting provider
- a patch-by-patch stabilization loop

It is a hard process correction:

- one Pages deploy plane
- one app-local build contract
- one boring model that AI can remember

---

## Why This Is The Correct Process Change

Because for this team shape:

- the human architect should own one-time infra configuration
- AI should work inside visible repo contracts, not hidden orchestration layers
- GitHub Actions deploy logic is too easy for AI to forget and too easy to patch badly

Cloudflare Pages Git build is the more legible model:

- Git push triggers deploy
- app root owns build
- Cloudflare owns execution
- repo docs describe the exact contract

That is simpler, more scalable, more AI-legible, and more faithful to the repo tenets than the current split system.
