# PRD 062 — Repo Taxonomy Convergence: Shared Runtime Packages and Tokyo Content Plane

Status: EXECUTED
Date: 2026-03-09
Owner: Product Dev Team
Priority: P0 (repo architecture cleanup)

> Core mandate: remove folder taxonomy drift created by incremental AI-built changes. Runtime code must not live under `tooling/`. Tokyo-owned content must not have special root-level exceptions. Prague-only abstractions must not sit in fake-generic shared buckets. The repo must teach one boring model to humans and AI.

> Ownership rule: every file gets one real owner. Generic root buckets such as `tooling/`, `config/`, and `artifacts/` must not survive as mixed architectural namespaces.

Pre-GA hard-cut rule:
- Clickeen is pre-GA.
- There is no backcompat requirement for repo structure.
- If a folder/category is wrong, move or delete it. Do not preserve old paths under `legacy`, `compat`, duplicate workspace entries, or transitional aliases.
- Folder names are architecture. Misclassification is a real bug.

Environment contract:
- Integration truth: cloud-dev
- Local is for iteration and verification
- Canonical local startup: `bash scripts/dev-up.sh`
- No destructive Supabase resets
- No git reset/rebase/force-checkout

---

## One-line Objective

Make the repo shape match the actual architecture:
- apps/services at the root
- shared runtime libraries in one explicit workspace root
- Tokyo-owned content source inside Tokyo
- actual tools in `scripts/` or true tooling-only folders
- no fake-generic buckets

---

## Problem Statement

The current repo taxonomy teaches the wrong model:

1. Runtime libraries live under `tooling/`, even though they are imported on live request paths.
2. Localization source has a special root-level exception (`l10n/`) even though Tokyo is the canonical content/runtime plane.
3. System-string source (`i18n/`) and overlay source (`l10n/`) are structurally separated from Tokyo, while widget source already lives inside `tokyo/widgets/**`.
4. Prague-only composition code lives in a fake shared workspace package (`tooling/composition`) even though it is not broad platform runtime.
5. A single protocol artifact lives in a second contracts bucket (`tooling/contracts`) next to `ck-contracts`, which creates naming confusion.
6. Root `config/` acts as a junk drawer for multiple runtime domains and abstraction levels: entitlements, locale registry, Prague market routing, l10n protocol schemas, and sample fixtures.
7. Root `artifacts/` is generated QA residue, not source, runtime, or build output, but it pollutes repo taxonomy by existing at the root.

This is not elegant engineering. It is folder drift.

---

## Current Drift to Remove

### A. Misclassified runtime packages

These are runtime/shared libraries, not tooling:
- `tooling/ck-contracts`
- `tooling/ck-policy`
- `tooling/l10n`

### B. Prague-only code in a fake shared bucket

This is Prague-owned composition/rendering code, not generic shared runtime:
- `tooling/composition`

### C. Duplicate/misleading contract naming

This is a protocol artifact, but it lives in a second contracts namespace:
- `tooling/contracts/open-editor-lifecycle.v1.json`

### D. Tokyo content source split across the repo

These roots are outside Tokyo even though Tokyo owns the domain:
- `i18n/`
- `l10n/`

### E. Root config junk drawer

These files do not belong in one generic root bucket:
- `config/entitlements.matrix.json`
- `config/locales.json`
- `config/markets.json`
- `config/layers.json`
- `config/index.schema.json`
- `config/overlay.schema.json`
- `config/fixtures/index.sample.json`
- `config/fixtures/overlay.sample.json`

### F. Root generated residue

This does not belong at repo root:
- `artifacts/**`

---

## Non-Negotiable Rules

1. Runtime code must not live under `tooling/`.
2. Shared runtime workspace libraries must live under one explicit root: `packages/`.
3. Domain-owned source must live under the owning domain root.
4. Tokyo-owned content source must live under `tokyo/**`, not in special root-level exceptions.
5. Prague-only abstractions must live under `prague/**`, not under generic shared buckets.
6. Protocol artifacts must live with contracts, not in a second ambiguous namespace next to another contracts package.
7. `tooling/` may contain only real tooling that is not part of runtime behavior.
8. No new parallel roots may be introduced during cleanup.
9. Documentation must describe the final folder taxonomy exactly; no “old path/new path” dual explanations.
10. Root `config/` must not survive as a mixed cross-domain bucket.
11. Generated local QA evidence must live under hidden local-only paths such as `.artifacts/**`, never at repo root.

---

## Target Repo Taxonomy

### 1. Root apps/services remain at the root

Examples:
- `bob/`
- `roma/`
- `paris/`
- `prague/`
- `venice/`
- `tokyo-worker/`
- `sanfrancisco/`

These are deployable runtimes or product surfaces.

### 2. Shared runtime libraries move to `packages/`

Canonical target:
- `packages/ck-contracts`
- `packages/ck-policy`
- `packages/l10n`

Why:
- these are cross-runtime libraries
- they are imported by active app/service code
- they are not dev tools

### 3. Tokyo-owned admin-authored localization content moves under Tokyo

Canonical target:
- `tokyo/admin-owned/i18n/**`
- `tokyo/admin-owned/l10n/**`

Runtime/published outputs remain:
- `tokyo/i18n/**`
- `tokyo/l10n/**`

Why:
- Tokyo already owns widget source under `tokyo/widgets/**`
- Tokyo already owns runtime/published localization bytes
- root-level `i18n/` and `l10n/` are architectural exceptions and must be removed
- `admin-owned` is the required classifier: this content is repo-authored/admin-owned input, not user/account-owned state and not a generic Tokyo source bucket

### 4. Prague-only composition moves under Prague

Canonical target:
- `prague/src/composition/**`

Why:
- current usage is Prague-owned
- it is not a broad platform runtime package
- it should stop pretending to be generic shared infrastructure

### 5. Protocol artifact joins contracts, not tooling

Canonical target:
- `packages/ck-contracts/editor/open-editor-lifecycle.v1.json`

Why:
- this is a contract artifact
- it belongs with contract ownership
- it must not live in a separate `tooling/contracts` bucket
- `packages/ck-contracts/editor/` is not a generic contracts bucket; it is only the builder/editor host lifecycle contract namespace

### 6. Actual tooling stays tooling-only or moves to scripts

Allowed examples after cleanup:
- `scripts/**`
- `tooling/whisper/**` if it remains truly non-runtime
- `tooling/sf-symbols/**` only if it remains tool/vendor-only and has zero runtime ownership confusion

Hard rule:
- `tooling/` must contain zero active runtime libraries after this PRD

### 7. Root config is eliminated

Canonical target ownership:
- `packages/ck-policy/entitlements.matrix.json`
- `packages/l10n/locales.json`
- `prague/src/markets/markets.json`

Delete only after explicit repo-proof shows there is no active runtime, build, or script consumer:
- `config/layers.json`
- `config/index.schema.json`
- `config/overlay.schema.json`
- `config/fixtures/index.sample.json`
- `config/fixtures/overlay.sample.json`

Why:
- `entitlements.matrix.json` is policy-owned runtime truth
- `locales.json` is l10n-owned runtime truth
- `markets.json` is Prague-owned runtime truth
- layers/schemas/fixtures are not justified as a root architectural namespace and currently read as protocol residue

### 8. Generated residue becomes hidden local output only

Canonical target:
- `.artifacts/runtime-parity/**`

Hard rule:
- root `artifacts/` must not exist
- generated QA evidence is not part of repo taxonomy

---

## Explicit Moves

### Workspace/runtime moves

- `tooling/ck-contracts` -> `packages/ck-contracts`
- `tooling/ck-policy` -> `packages/ck-policy`
- `tooling/l10n` -> `packages/l10n`

### Prague ownership move

- `tooling/composition` -> `prague/src/composition`

### Contract artifact move

- `tooling/contracts/open-editor-lifecycle.v1.json` -> `packages/ck-contracts/editor/open-editor-lifecycle.v1.json`

### Tokyo content-source moves

- `i18n` -> `tokyo/admin-owned/i18n`
- `l10n` -> `tokyo/admin-owned/l10n`

### Root config breakup

- `config/entitlements.matrix.json` -> `packages/ck-policy/entitlements.matrix.json`
- `config/locales.json` -> `packages/l10n/locales.json`
- `config/markets.json` -> `prague/src/markets/markets.json`

### Root config deletions

Delete only after explicit repo-proof shows there is no active runtime, build, or script consumer:
- `config/layers.json`
- `config/index.schema.json`
- `config/overlay.schema.json`
- `config/fixtures/index.sample.json`
- `config/fixtures/overlay.sample.json`

### Generated residue cleanup

- delete root `artifacts/`
- if parity reports still need to exist later, write them only to `.artifacts/runtime-parity/`

---

## What This PRD Is Not

This PRD is not:
- a runtime behavior redesign
- a localization protocol redesign
- a widget schema redesign
- an excuse to introduce another generic “shared” bucket
- a chance to refactor unrelated product code

This PRD is structural cleanup only.

---

## Execution Guardrails

1. Keep workspace package names stable during moves.
Do:
- keep `@clickeen/ck-contracts`
- keep `@clickeen/ck-policy`
- keep `@clickeen/l10n`
- keep `@clickeen/composition` only until Prague ownership cutover is complete

Do not:
- rename package names while moving folders
- introduce temporary alias packages
- add re-export shims just to preserve old paths

2. Execute one ownership boundary at a time.
- move folder
- update direct dependents
- delete old folder in the same slice
- run the phase verification gates before continuing

3. Prefer import-specifier stability over broad churn.
- workspace directory paths may change
- package import names should stay the same where possible
- relative file-path consumers are the only places that should need direct path edits

4. No “move now, docs later” drift.
- path-owning docs for the current phase update in the same slice
- historical executed PRDs may be left as historical records, but active architecture/service docs must teach only the new path

5. Delete only with proof where uncertainty exists.
- for `config/layers.json`, `config/index.schema.json`, `config/overlay.schema.json`, and `config/fixtures/*`, grep all runtime code, scripts, build config, and active docs before deletion
- if a real runtime/build/script consumer exists, relocate to the owning domain instead of deleting blindly

---

## Dependency Map

This is the concrete dependency map execution must respect.

### A. Workspace package path moves

Moving these folders changes workspace/package location, not package identity:
- `tooling/ck-contracts` (`@clickeen/ck-contracts`)
- `tooling/ck-policy` (`@clickeen/ck-policy`)
- `tooling/l10n` (`@clickeen/l10n`)

Primary dependency edges:
- `bob`, `roma`, `paris`, `venice`, `tokyo-worker`, `sanfrancisco`, `dieter`, `admin`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Execution rule:
- keep package names unchanged
- update workspace paths first
- then refresh lockfile/import resolution

### B. Editor lifecycle contract move

Current known dependents:
- `roma/components/builder-domain.tsx`
- `admin/vite.config.ts`
- DevStudio host runtime/docs/tests

Execution rule:
- move artifact and update both Roma and DevStudio in the same slice
- delete `tooling/contracts` immediately after cutover

### C. Prague composition move

Current known dependents:
- `prague/src/lib/blockRegistry.ts`
- Prague docs
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Execution rule:
- this is Prague-owned; do not search for a generic shared abstraction
- if any non-Prague runtime still depends on `@clickeen/composition`, stop and re-evaluate before moving

### D. Entitlements matrix move

Current known dependents:
- `packages/ck-policy` internals after move (`matrix.ts`, `registry.ts`)
- `admin/vite.config.ts`
- active docs that still teach `config/entitlements.matrix.json`

Execution rule:
- move only after `ck-policy` already lives under `packages/`
- keep matrix ownership inside policy

### E. Locales registry move

Current known dependents:
- `bob/components/LocalizationControls.tsx`
- `roma/components/account-locale-settings-card.tsx`
- `paris/src/shared/l10n.ts`
- `prague/src/lib/locales.ts`
- `prague/src/lib/pragueL10n.ts`
- `prague/src/lib/instanceL10n.ts`
- `scripts/i18n/build.mjs`
- `scripts/i18n/validate.mjs`
- `scripts/prague-l10n/translate.mjs`
- `scripts/prague-l10n/verify.mjs`
- active docs that teach `config/locales.json`

Execution rule:
- move only after `packages/l10n` already lives under `packages/`
- keep `locales.json` owned by `packages/l10n`

### F. Markets registry move

Current known dependents:
- `prague/src/lib/markets.ts`
- `prague/src/pages/index.astro`
- Prague docs

Execution rule:
- move into Prague in the same slice as all Prague import updates

### G. Root `i18n/` and `l10n/` moves

Primary known dependents:
- `scripts/i18n/*`
- `scripts/l10n/*`
- active localization docs

Execution rule:
- move only after `packages/l10n` and the root `config/` breakup are complete
- `tokyo/admin-owned/**` is input only; do not mix runtime outputs into it

### H. Root `artifacts/` cleanup

Execution rule:
- this is last-mile cleanup
- if any active script still writes there, move that writer to `.artifacts/runtime-parity/**` in the same slice

---

## Execution Order

### Phase 1 — Freeze taxonomy and ownership

Lock these ownership rules in docs:
- shared runtime packages live in `packages/`
- Tokyo-owned admin-authored localization content lives in `tokyo/admin-owned/**`
- Prague-only composition lives in `prague/**`
- `tooling/` is not a runtime namespace
- `config/` is not a valid mixed root bucket
- root `artifacts/` is not a valid repo root

Done when active docs teach all of the following correctly and nowhere still teach the old shape as valid:
- shared runtime packages live in `packages/`
- Tokyo-owned admin-authored localization content lives in `tokyo/admin-owned/**`
- Prague-only composition lives in `prague/**`
- root `config/` is not a valid mixed bucket
- root `artifacts/` is not a valid repo root
- `tooling/*` is not the home for runtime code

### Phase 2 — Move runtime workspace packages

Move:
- `tooling/ck-contracts` -> `packages/ck-contracts`
- `tooling/ck-policy` -> `packages/ck-policy`
- `tooling/l10n` -> `packages/l10n`

Update:
- `pnpm-workspace.yaml`
- root-level package graph assumptions
- all workspace imports/references
- package paths used by builds and docs
- lockfile/workspace resolution

Done when no runtime package path under `tooling/` remains in workspace config or runtime imports.

Verification:
- `pnpm install`
- targeted resolution/type checks for moved packages and direct dependents:
  - moved workspace packages
  - `bob`
  - `roma`
  - `paris`
  - `prague`
  - `venice`
  - `tokyo-worker`
  - `sanfrancisco`

### Phase 3 — Move the protocol artifact into contracts ownership

Move:
- `tooling/contracts/open-editor-lifecycle.v1.json` -> `packages/ck-contracts/editor/open-editor-lifecycle.v1.json`

Update:
- Roma builder host imports
- DevStudio host serving path
- docs and tests

Done when `tooling/contracts` is deleted and the editor lifecycle artifact is owned by contracts.

Verification:
- `pnpm --filter @clickeen/roma lint`
- `pnpm --filter @clickeen/devstudio test -- dev-widget-workspace`

### Phase 4 — Move Prague-only composition into Prague

Move:
- `tooling/composition` -> `prague/src/composition`

Update:
- Prague imports
- Prague package config
- any build config referencing `@clickeen/composition`
- docs that currently teach it as generic shared runtime

Done when no non-Prague runtime depends on composition and `tooling/composition` is deleted.

Verification:
- `pnpm --filter @clickeen/prague build`

### Phase 5 — Break up root config by real ownership

Move:
- `config/entitlements.matrix.json` -> `packages/ck-policy/entitlements.matrix.json`
- `config/locales.json` -> `packages/l10n/locales.json`
- `config/markets.json` -> `prague/src/markets/markets.json`

Delete:
- `config/layers.json`
- `config/index.schema.json`
- `config/overlay.schema.json`
- `config/fixtures/index.sample.json`
- `config/fixtures/overlay.sample.json`

Update:
- all runtime imports
- scripts that currently read `config/locales.json`
- docs that currently teach `config/*` as architectural truth

Hard rule:
- do not preserve root `config/` as a reduced bucket
- delete only after explicit repo-proof (`rg` across runtime code, scripts, build config, and docs) shows no active runtime, build, or script consumer

Done when no root-level `config/` remains.

Verification:
- `pnpm --filter @clickeen/bob lint`
- `pnpm --filter @clickeen/roma lint`
- `pnpm --filter @clickeen/prague build`
- targeted parse/check of `scripts/i18n/*` and `scripts/prague-l10n/*`

### Phase 6 — Move Tokyo-owned localization sources under Tokyo

Move:
- `i18n` -> `tokyo/admin-owned/i18n`
- `l10n` -> `tokyo/admin-owned/l10n`

Update:
- `scripts/l10n/build.mjs`
- `scripts/l10n/validate.mjs`
- i18n build scripts
- docs and references

Hard rule:
- this is a path move only, not a behavior redesign
- `tokyo/admin-owned/**` is a narrow admin-owned authored-input plane only; it must not become a new generic bucket

Done when no root-level `i18n/` or `l10n/` remains.

Verification:
- `node --check scripts/i18n/build.mjs`
- `node --check scripts/l10n/build.mjs`
- `node --check scripts/l10n/validate.mjs`
- run the relevant localization builds/validators

### Phase 7 — Delete residue and shrink `tooling/`

Delete:
- empty moved folders
- stale docs
- stale generated references
- path aliases that only exist because the old location existed

Reclassify remaining `tooling/*` entries:
- keep only if clearly tooling-only
- otherwise move or delete

Done when `tooling/` contains zero runtime libraries and no ambiguous namespace remains.

### Phase 8 — Remove generated root residue

Delete:
- root `artifacts/`

Update:
- any scripts/docs that still point to `artifacts/**`
- local QA writers to `.artifacts/runtime-parity/**` if still needed

Done when root `artifacts/` does not exist.

Verification:
- dead-reference grep for `artifacts/`
- dead-reference grep for old moved paths

---

## Acceptance Gates

1. No runtime workspace package lives under `tooling/`.
2. `pnpm-workspace.yaml` points shared runtime packages to `packages/*`.
3. No root-level `i18n/` exists.
4. No root-level `l10n/` exists.
5. No root-level `config/` exists.
6. No root-level `artifacts/` exists.
7. `tooling/composition` does not exist.
8. `tooling/contracts` does not exist.
9. The open-editor lifecycle contract is owned by contracts, not tooling.
10. Prague builds with composition owned by Prague.
11. Bob/Roma/Paris/Tokyo-worker/San Francisco build against packages in `packages/*`.
12. `entitlements.matrix.json` is policy-owned, `locales.json` is l10n-owned, and `markets.json` is Prague-owned.
13. `tokyo/admin-owned/**` exists only for admin-owned authored localization inputs and is not used as a generic catch-all.
14. Docs teach one repo taxonomy only.

---

## Hard Failure Conditions

This PRD fails if any of these remain true:

- runtime code still lives under `tooling/`
- root `config/` still exists as a mixed bucket
- root `artifacts/` still exists
- localization source still lives outside Tokyo
- `tokyo/admin-owned/**` starts accumulating unrelated files beyond admin-owned localization inputs
- Prague-only code still pretends to be generic shared runtime
- both `contracts` and `ck-contracts` remain as separate architectural meanings
- docs still describe the old paths as valid
- cleanup creates alias paths, fallback imports, or temporary compatibility directories

---

## Why This Is The Correct Cleanup

This PRD does not add a new system. It removes repo ambiguity.

The boring target is:
- runtimes at root
- shared runtime libraries in `packages/`
- no generic root `config/`
- Tokyo-owned content in Tokyo
- Prague-owned code in Prague
- generated QA residue hidden under `.artifacts/` if it exists at all
- real tools in `scripts/` or true tooling-only folders

That is simpler for:
- humans
- AI coding agents
- docs
- build config
- future cleanup work

It also directly supports Clickeen’s AI-native thesis:
- architecture must be legible
- names must teach the truth
- folder taxonomy is part of the interface

---

## Out of Scope

- splitting `ck-policy` into smaller packages
- deleting `tooling/whisper` or `tooling/sf-symbols` unless they are proven misclassified
- changing localization runtime semantics
- changing Tokyo publish/runtime path contracts
- changing widget source contract
- inventing a new generic replacement for `config/`

Those may become follow-up cleanup PRDs if still needed after this convergence.
