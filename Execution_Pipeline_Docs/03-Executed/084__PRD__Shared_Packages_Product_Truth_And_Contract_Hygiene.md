# PRD 084: Shared Packages Product Truth And Contract Hygiene

Status: 02-Executing
Date: 2026-05-05
Owner: Clickeen product architecture

## Product Decision

The `packages/` folder stays.

The package shape is the right SaaS idea: small shared product contracts used by many services. The problem is not that shared packages exist. The problem is that `@clickeen/ck-contracts` still carries old product meanings and manually duplicated type declarations.

Shared packages must be boring. They must hold durable cross-service contracts only. They must not preserve old product modes, old naming mythology, or fake routing behavior.

## Plain-English Model

- `@clickeen/ck-policy` owns account policy: tiers, roles, caps, budgets, entitlements, authz capsule, and limits.
- `@clickeen/l10n` owns locale/l10n primitives: supported locales, locale labels, locale normalization, deterministic fingerprints, and allowlisted translation path extraction.
- `@clickeen/ck-contracts` owns cross-service payload contracts: UUID validation, account asset refs, account asset records, localization op shape, account locale policy parsing, widget locale switcher settings, and media materialization helpers.

Everything else must either live in the service that owns the product behavior, or be deleted.

## Current Failure

`@clickeen/ck-contracts` still defines product behavior from public-id prefixes:

```text
wgt_main_*
wgt_system_*
wgt_*_u_*
```

That makes the string decide whether an instance is main, system, or user. This contradicts the current product truth:

- A widget type is product code.
- A widget instance is an account-owned editable object.
- Admin-owned instances are normal account-owned instances.
- System/listed starter behavior comes from Tokyo-owned instance metadata, not public-id grammar.

The current shared contract spreads old product categories into Roma, Prague, Tokyo, Dieter, and Venice. Once a bad product concept enters a shared package, every service starts treating it as architecture.

There is also implementation drift:

- `@clickeen/ck-contracts` is JavaScript plus hand-maintained `.d.ts` files.
- `@clickeen/ck-policy` and `@clickeen/l10n` export TypeScript source.
- Root `package.json#workspaces` omits the packages even though `pnpm-workspace.yaml` includes them.
- The AI registry in `@clickeen/ck-contracts/ai` still exposes old/non-live product identities such as SDR widget copilot and debug probe next to live account paths.

## Target Architecture

### Shared Package Boundaries

`@clickeen/ck-policy` remains the one policy authority.

It may contain:

- policy profiles and member roles
- entitlement matrix validation
- policy resolution
- budget/cap/flag evaluation
- authz capsule mint/verify helpers
- limit spec parsing and enforcement

It must not contain:

- AI provider/model provisioning
- widget instance inventory
- product catalog behavior
- Prague/Roma/Tokyo routing rules

`@clickeen/l10n` remains the one l10n primitive authority.

It may contain:

- supported locale registry
- locale token normalization
- locale label resolution
- stable stringify/fingerprint helpers
- l10n snapshot helpers
- allowlisted translation path extraction
- Prague page overlay layer order only while Prague actively uses that exact deterministic contract

It must not contain:

- translation fallback UX behavior
- product queue status rules
- account ownership logic
- widget instance selection logic

`@clickeen/ck-contracts` becomes a clean cross-service contract package.

It may contain:

- UUID validation
- error/status enums used by multiple services
- account asset path/key parsing
- account asset payload normalization
- account locale policy validation
- localization op normalization
- widget locale switcher payload normalization
- media asset id collection/materialization helpers used by Bob/Tokyo/Dieter
- AI registry only for live AI execution contracts, not product-mode leftovers

It must not contain:

- public-id classification by `main/system/user`
- template/curated/starter meaning
- account/admin/system ownership decisions
- Prisma/DB/Supabase/R2 service ownership decisions
- dead AI product identities
- hand-maintained type declarations that can drift from runtime code

### Public ID Rule

A public id is an identifier, not product truth.

Existing public ids remain valid opaque identifiers. This PRD does not migrate saved instance ids, rewrite URLs, or break embeds that already point to `wgt_*` ids. It only deletes the behavior that assigns product meaning from those prefixes.

Allowed:

```ts
normalizeInstancePublicId(raw)
isInstancePublicId(raw)
```

Not allowed:

```ts
classifyWidgetPublicId(raw) // main/system/user
isSystemInstancePublicId(raw)
isMainWidgetPublicId(raw)
isUserWidgetPublicId(raw)
```

If Roma or Prague needs to know what an instance is, it must load Tokyo-owned instance metadata.

The neutral validator must allow current live Clickeen ids, including existing `wgt_main_*`, `wgt_system_*`, and `wgt_*_u_*` values, as valid identifiers. It must not return `main`, `system`, or `user`, and no caller may branch on those prefixes.

### System/Admin-Owned Instance Rule

The surviving authority for instance meaning is Tokyo instance metadata.

Roma and Prague may use words like `systemInstance` only as UI/content language if the value ultimately points to a real Tokyo-owned account instance. They must not infer system/admin/starter behavior from the public id string.

### AI Registry Rule

The surviving live account Builder Copilot path is the one Roma-owned account path.

Shared AI contracts may describe the live agent IDs that San Francisco executes. They must not preserve old acquisition/minibob/product-variant identities inside shared account product code.

Debug-only execution must either be San Francisco-local ops code or deleted. It must not appear as a normal product agent in a shared product registry.

Before deleting any AI agent entry, execution must create a live/dead decision table:

| Agent | Current owner | Current caller | Decision |
|---|---|---|---|
| `cs.widget.copilot.v1` | Roma account Builder + San Francisco | live account product | keep |
| `l10n.instance.v1` | Tokyo/San Francisco l10n generation | live product pipeline | keep if active |
| `agent.personalization.onboarding.v1` | San Francisco personalization | live if still used | keep or delete based on caller scan |
| `l10n.prague.strings.v1` | Prague/San Francisco local/system strings | live if still used | keep or delete based on caller scan |
| `sdr.copilot` | San Francisco acquisition/ops | not account Builder | keep only if it is a real public acquisition path; otherwise delete |
| `sdr.widget.copilot.v1` | legacy widget copilot variant | not live account Builder | delete or move San Francisco-local only if an active non-account product path proves it |
| `debug.grantProbe` | San Francisco ops/debug | not product | delete from shared registry or move to San Francisco-local ops registry |

No AI entry may be deleted just because it looks old. It must be deleted because its surviving owner/caller is absent or because its owner is San Francisco-local rather than shared product contract.

## Non-Negotiable Tenets

1. Shared packages must be more boring than app code.
2. Product meaning must not come from public-id prefixes.
3. Tokyo metadata is the surviving authority for widget instance meaning.
4. `@clickeen/ck-policy` owns policy only.
5. `@clickeen/l10n` owns deterministic l10n primitives only.
6. `@clickeen/ck-contracts` owns durable payload contracts only.
7. Delete old public-id classifiers. Do not wrap them with new names.
8. Delete dead AI registry entries or move ops-only code behind San Francisco-only ownership.
9. Convert manual JS plus `.d.ts` contract code into one TypeScript source of truth.
10. Do not add a generic catalog/reference framework in this PRD.
11. Do not preserve old concepts because active callers still import them.
12. Every step must remove or simplify wrong shared truth before adding replacement code.

## Anti-Goals

- Do not merge all packages into one package.
- Do not create a new shared product kernel.
- Do not build a catalog system.
- Do not add a template/curated abstraction.
- Do not add a public-id migration unless required by a concrete active runtime break.
- Do not reject existing `wgt_*` ids. Delete prefix meaning, not existing identifiers.
- Do not refactor unrelated service internals.
- Do not rewrite l10n generation or policy enforcement in this PRD.
- Do not touch Supabase schema unless an active caller proves a schema-level dependency remains.

## Blast Radius

### High-Risk Callers

- Roma account instance route currently imports `classifyWidgetPublicId`.
- Prague markdown validation currently imports `isSystemInstancePublicId`.
- Tokyo asset utilities re-export `normalizePublicId = normalizeWidgetPublicId`.
- Prague widget embed code still contains `systemInstanceRef` language and public-id prefix assumptions.
- San Francisco and Roma use `@clickeen/ck-contracts/ai` for AI agent registry and policy capsule resolution.

### Medium-Risk Callers

- Bob and Tokyo use media materialization helpers from `@clickeen/ck-contracts`.
- Dieter uses account asset contract helpers.
- Berlin and Roma use user settings country/timezone helpers from `@clickeen/ck-contracts`.
- Berlin/Roma/Tokyo/San Francisco use policy and l10n packages broadly.

### Low-Risk Metadata

- Root `package.json#workspaces` drift from `pnpm-workspace.yaml`.
- Package-level missing scripts/tsconfig shape.

## Deletion Targets

Delete from `@clickeen/ck-contracts`:

- `WIDGET_PUBLIC_ID_MAIN_RE`
- `WIDGET_PUBLIC_ID_SYSTEM_RE`
- `WIDGET_PUBLIC_ID_USER_RE`
- `WIDGET_PUBLIC_ID_RE` if it only preserves those categories
- `WidgetPublicIdKind`
- `classifyWidgetPublicId`
- `isMainWidgetPublicId`
- `isSystemInstancePublicId`
- `isUserWidgetPublicId`

Replace with one neutral identifier contract:

- `INSTANCE_PUBLIC_ID_RE`
- `normalizeInstancePublicId`
- `isInstancePublicId`

The neutral identifier contract must preserve current valid id shapes as opaque ids. It may be stricter about unsafe characters, empty strings, path separators, and dangerous URL/path content. It must not require a new id format.

Delete or relocate from `@clickeen/ck-contracts/ai`:

- SDR widget copilot as a shared product path if not live
- `debug.grantProbe` from shared product registry
- resolver functions that preserve old account Copilot variants

Delete from repo metadata:

- root workspace/package drift that makes `packages/` look unofficial

Delete after TypeScript conversion:

- hand-maintained `packages/ck-contracts/src/*.d.ts`
- JS source files that are replaced by TS source

## Execution Plan

Each step must be green before moving to the next one.

### Step 1: Confirm Active Shared Package Call Graph

Inspect and record live imports for:

- `@clickeen/ck-contracts`
- `@clickeen/ck-contracts/ai`
- `@clickeen/ck-policy`
- `@clickeen/l10n`

Required output:

- one active caller list by package
- one deletion candidate list
- one surviving authority per deleted concept
- one list of existing public-id shapes in active source and current Tokyo/Roma generation code
- one AI live/dead decision table for every entry exported by `@clickeen/ck-contracts/ai`

Green gate:

- every active public-id classifier caller is named
- every active AI registry legacy caller is named
- the plan explicitly says which existing id shapes remain valid as opaque identifiers
- the plan explicitly says which AI entries are kept, moved, or deleted
- no code is changed in this step

### Step 2: Delete Public-ID Product Classification

Remove `main/system/user` public-id classification from `@clickeen/ck-contracts`.

Replace it with neutral public-id validation only. The neutral validator must accept existing live IDs as opaque identifiers. It must not break persisted instances, copied embed URLs, or Prague block references.

Update callers:

- Roma validates id shape only, then loads Tokyo instance metadata for product meaning.
- Prague validates id shape only, then verifies the referenced instance exists when validation is enabled.
- Tokyo stops exporting `normalizePublicId` as widget-public-id classifier behavior.
- Dieter and Venice retain only neutral id/asset helpers.

Green gate:

- `rg "classifyWidgetPublicId|isSystemInstancePublicId|isMainWidgetPublicId|isUserWidgetPublicId|WIDGET_PUBLIC_ID_"` returns no active source hits outside executed docs.
- Roma typecheck passes.
- Prague typecheck/build passes.
- Tokyo Worker typecheck passes.
- Product behavior remains: valid account/system/admin-owned instances can be opened and embedded by id without prefix-based branching.
- Existing `wgt_*` ids remain accepted as ids.

### Step 3: Clean Prague System Instance Naming Where It Affects Behavior

Prague may keep marketing content that says "system instance" only where it is descriptive copy. Runtime code must not enforce `wgt_system_`.

Update active Prague validation and embed code so:

- `systemInstanceRef.publicId` means "a referenced Tokyo instance id"
- existence validation checks Venice/Tokyo response, not prefix grammar
- fallback/default ids do not invent `wgt_main_${widget}` as product truth unless the block explicitly asks for that id
- Prague pages/blocks that need a widget embed must carry an explicit instance id, or fail at build time with a clear missing-instance-id error.
- `InstanceEmbed` must not derive widget type from public-id prefixes. If widget type is needed for UI/accessibility, pass it explicitly from content metadata or omit it.

Green gate:

- `rg "wgt_system_|wgt_main_|wgt_.*_u_" prague/src` shows no active runtime assumptions, only intentional content fixtures if any.
- Prague default/fallback embed behavior no longer manufactures an instance id from a widget slug.
- Prague build passes.

### Step 4: Clean AI Registry Product Modes

Audit `@clickeen/ck-contracts/ai` against live product paths.

Start this step by filling the AI live/dead decision table from Step 1 and executing only those decisions. Do not guess.

Keep:

- the live account Builder Copilot contract
- live l10n instance generation contract
- live personalization contract if still active
- live Prague l10n local/system strings contract if still active

Delete or move:

- dead SDR widget copilot product path
- debug grant probe from shared product registry
- resolver functions that always collapse old variants to CS

If an old agent is still actively executed by San Francisco only for ops or local tools, make that ownership explicit inside San Francisco instead of advertising it from shared product contracts.

Green gate:

- `@clickeen/ck-contracts/ai` describes live cross-service AI contracts only.
- Roma account Copilot still resolves to the one live Builder Copilot path.
- San Francisco typecheck passes.
- Admin typecheck passes if Admin still visualizes AI registry state.

### Step 5: Convert `@clickeen/ck-contracts` To TypeScript Source

Replace JS plus manual `.d.ts` with TypeScript source as the single truth.

Rules:

- no hand-maintained declaration files
- package export shape remains stable for consumers unless the repo's existing TS-source package pattern requires the same simple export style used by `@clickeen/ck-policy` and `@clickeen/l10n`
- runtime validation behavior remains equivalent except for deliberate deletions from Steps 2 and 4
- no broad app refactors
- do not add a new package build/declaration pipeline unless a consumer typecheck proves the repo cannot consume TS source directly

Green gate:

- `packages/ck-contracts/src/*.d.ts` removed
- package exports point to TS source or generated declarations through the repo's chosen build path
- all consumers typecheck

### Step 6: Align Workspace Metadata

Make workspace metadata tell one story.

Either:

- add `packages/ck-policy`, `packages/ck-contracts`, and `packages/l10n` to root `package.json#workspaces`

or:

- remove root `package.json#workspaces` if `pnpm-workspace.yaml` is the only intended workspace authority.

Green gate:

- root workspace metadata and `pnpm-workspace.yaml` no longer contradict each other
- `pnpm install --lockfile-only` is not required unless package metadata changes force lockfile churn

### Step 7: Verification And Regression Sweep

Run focused checks:

- `rg "classifyWidgetPublicId|isSystemInstancePublicId|isMainWidgetPublicId|isUserWidgetPublicId|WIDGET_PUBLIC_ID_" --glob '!Execution_Pipeline_Docs/**' --glob '!documentation/**'`
- `rg "sdr.widget.copilot.v1|debug.grantProbe" packages roma sanfrancisco admin --glob '!node_modules'`
- package consumer typechecks for Roma, Prague, Tokyo Worker, San Francisco, Berlin, Bob, Dieter, Venice, Admin
- product-path smoke where available

Green gate:

- no active source references deleted product classifiers
- no active shared registry references deleted AI product modes
- all affected package consumers pass typecheck/build/lint as appropriate

## Done Means

- Shared packages still exist and have clearer ownership.
- `@clickeen/ck-contracts` no longer makes product meaning from public-id prefixes.
- Roma and Prague no longer depend on `wgt_main_`, `wgt_system_`, or `wgt_*_u_*` to decide product behavior.
- AI shared contracts no longer advertise dead product paths.
- `@clickeen/ck-contracts` has one source of truth for runtime and types.
- Repo workspace metadata agrees.
- The cleanup deletes stale behavior instead of layering compatibility wrappers around it.
