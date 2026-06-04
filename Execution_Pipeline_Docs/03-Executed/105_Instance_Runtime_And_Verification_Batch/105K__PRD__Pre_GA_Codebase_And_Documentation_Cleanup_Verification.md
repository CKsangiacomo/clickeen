# PRD 105K - Pre-GA Codebase And Documentation Cleanup Verification

Status: Green / local cleanup verification executed
Owner: Product + Architecture
Date: 2026-05-28
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105H__PRD__Execution_Verification_Protocol.md`

## Purpose

Extract the still-valid pre-GA cleanup work from the remaining audits and reset it under the PRD 105 architecture.

The goal is not a broad rewrite. The goal is to make the codebase more boring before the next execution pass:

```text
fewer duplicate primitives
fewer stale docs
fewer fake product concepts
fewer customer-facing runtime risks
clearer active authority
```

## Source Documents Reviewed

This PRD extracts from:

```text
082__System_Health_Taxonomy_And_Stress_Audit.md
Clickeen_codebase_review.md
Clickeen_pre_GA_holistic_audit.md
EVERGREEN_BACKLOG.md
```

The audit documents become historical evidence after this extraction. `EVERGREEN_BACKLOG.md` remains active and is reconciled with the PRD 105 series.

## Product Contract

Clickeen's real product path remains:

```text
Roma opens one account widget.
Bob edits one active locale.
Roma saves to Tokyo.
Tokyo owns saved source, overlays, materialization, and product operations.
San Francisco performs AI work only through named Tokyo-created jobs.
`clk.live` public serving serves generated public browser artifacts. The current deployed owner must be verified before runtime-serving changes.
Prague consumes published widgets through the public boundary.
```

Cleanup work must reduce confusion around this path. It must not preserve fake product modes, stale route names, duplicate helpers, or docs that contradict PRD 105.

## Workstream 1 - Active Documentation Cleanup

Required verification:

- active docs do not present `translation-generation-job.json` as acceptable instance-folder state;
- active docs do not present default `{locale}.html`, `script.{locale}.js`, or `styles.{locale}.css` as the normal embed model;
- active docs do not teach `00000001` as current account coordinate;
- active docs do not describe Prague as reading translation internals;
- active docs point to PRD 105 and 105A-105J for current instance-folder, translation, account-coordinate, and Prague boundary authority;
- old audits and stale PRDs are archived or clearly marked historical.

Documentation cleanup must preserve useful historical evidence without letting it read like current architecture.

## Workstream 2 - Repo Hygiene And Research Prune

Verify or complete the still-valid hygiene work from PRD 082:

- no tracked ignored files;
- no repo-local virtualenvs, inbox dumps, `.DS_Store`, or ignored temp folders that pollute agent context;
- copied competitor source trees, raw HTML dumps, screenshots, and lockfiles under documentation are either deleted or replaced with concise summaries;
- deleted research artifacts have no stale active references.

No Supabase migration history may be deleted. No R2 object deletion may occur without an explicit inventory diff and execution PRD.

## Workstream 3 - Default / Curated Convergence Audit

The old `curated_widget_instances` model is a product-boundary risk if active code still treats starter/demo content as a separate class from account-owned instances.

Required verification:

- active code paths using `curated_widget_instances`, `source: 'curated'`, `source === 'curated'`, or `wgt_curated` are inventoried;
- the surviving product model is named before edits:

```text
starter/example widgets are normal account-owned instances with listing/duplicability metadata
```

- no new wrapper is added around the curated model;
- any migration away from curated rows is scoped in a focused follow-up PRD if active code still depends on it.

This PRD may perform the audit and create the follow-up plan. It must not silently rewrite the starter model without a focused execution slice.

## Workstream 4 - Shared Primitive Consolidation

Verify and plan consolidation for duplicated low-level helpers:

- `isRecord`;
- `asTrimmedString`;
- `asTrimmedStringOrNull`;
- `isStringArray`;
- `isNonEmptyString`;
- `sha256Hex` where not cycle-blocked;
- JWT decode/expiry/leeway helpers;
- cookie-domain helpers if multiple services need the same rule.

The preferred authority is `packages/ck-contracts` unless a dependency cycle requires a smaller no-deps package.

Execution must not create speculative packages. A new package is allowed only if a real dependency cycle blocks the simpler import path.

## Workstream 5 - Error And Reason-Key Discipline

Verify whether `reasonKey` strings remain ad hoc across services.

If drift remains, create or extend a typed reason-key authority, preferably:

```text
packages/ck-contracts/src/reason-keys.ts
```

The goal is not a giant abstract error framework. The goal is one typed vocabulary so emitters and UI consumers do not drift.

## Workstream 6 - Roma And Berlin Boilerplate Cleanup

Verify and plan only mechanical consolidation:

- remove dead Berlin proxy shims in Roma;
- consolidate Berlin client/proxy helpers if multiple files do one job;
- consolidate Roma account locale helper files if they still represent one concept split across many files;
- review `roma/lib/account-instance-direct.ts` for repeated Tokyo CRUD wrapper boilerplate;
- consider a typed Tokyo client helper only if it deletes repeated wrappers without hiding product behavior;
- consider account-route boilerplate helpers only if they preserve route clarity and reduce duplicated validation/error envelopes.

Do not turn Roma into a business-logic owner. Roma remains the authenticated account shell and orchestration boundary.

## Workstream 7 - `clk.live` Public Embed Hardening

The public embed is customer-facing. It must be boring and quiet.

Required verification:

- no production `console.log` in public embed hot paths;
- no silent `.catch(() => null)` in public embed paths unless explicitly proven as harmless optional behavior;
- loader/runtime code is maintainable enough to smoke and debug;
- generated public files remain aligned with PRD 105:

```text
index.html
styles.css
runtime.js
```

If the embed loader is still a large template string, a focused follow-up may convert it into real TypeScript bundled into a public IIFE. That follow-up must preserve public behavior and have `clk.live` smoke coverage.

## Workstream 8 - Dieter / Shared Runtime Risk Register

Verify the large shared-runtime and Dieter-component risks before changing them:

- `tokyo/product/widgets/shared/typography.js`;
- large Dieter components such as `dropdown-fill`, `dropdown-upload`, and `textedit`;
- any empty or placeholder widget-runtime folders.

This PRD should not split them speculatively. It should either:

- record that no active risk exists; or
- create focused follow-up PRDs with visual/runtime regression coverage.

## Blast Radius

Possible audit and cleanup surfaces:

```text
documentation/**
Execution_Pipeline_Docs/**
packages/ck-contracts/**
packages/ck-policy/**
roma/**
berlin/**
tokyo-worker/**
tokyo/product/widgets/**
tokyo/product/dieter/**
venice/**
admin/**
scripts/**
```

Do not edit without a focused follow-up:

```text
supabase/migrations/**
R2 objects
translation operation runtime
Prague launch content
San Francisco provider prompts
```

## Drift Stop Conditions

Stop and split into a focused PRD if cleanup requires:

- changing customer-visible product behavior;
- changing instance-folder taxonomy;
- changing translation workflow;
- changing account identity semantics;
- deleting Supabase migration history;
- deleting R2 objects;
- adding a new abstraction that does not remove real duplication;
- preserving a fake product mode because active callers still exist.

## Verification Scope

This PRD is green only when:

- active docs are consistent with PRD 105 and 105A-105J;
- remaining audit findings are either closed, promoted to focused PRDs, or explicitly dropped;
- `EVERGREEN_BACKLOG.md` is reconciled with the 105 series;
- static scans prove no obvious stale authority remains in active docs for instance-folder shape, admin coordinate, Prague boundary, or translation operation JSON;
- repo hygiene scans are clean or every remaining hit is intentional;
- no runtime behavior was changed without focused tests or smoke.

## Archive Decision For Source Batch

After this PRD is created, the remaining audit docs must move to `03-Executed` as historical evidence:

```text
082__System_Health_Taxonomy_And_Stress_Audit.md
Clickeen_codebase_review.md
Clickeen_pre_GA_holistic_audit.md
```

Required archive status:

```text
Historical audit evidence.
Surviving cleanup doctrine extracted to PRD 105K.
Superseded by PRD 105/105A-105K where conflicting.
```

`EVERGREEN_BACKLOG.md` remains active.

## Non-Scope

This PRD does not:

- implement SEO/GEO;
- execute starter/curated migration;
- refactor Bob compiler;
- split Dieter components;
- rewrite the public embed loader;
- implement reason-key migration;
- implement zero-touch translation.

Those require focused follow-up PRDs if this cleanup verification proves they are needed.

## Final Verification - 2026-06-02

Status: Green for deterministic local cleanup verification.

Evidence:

- Active `documentation/` drift found during the June 2 audit was corrected to name PRD 105 as the current instance-folder/runtime authority.
- Active docs no longer present PRD 103 resume gates, `script.js`, `published/`, or locale identity as current PRD 105 runtime truth.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- `pnpm verify:prd105-runtime-boundary` passes and guards against reintroducing `queuedLocales`, legacy embedded translation migration helpers, and active `translation-generation-job.json` use in production source.
- Remaining legacy references are either clearly marked historical evidence, tests, cleanup scripts, or generic translated-value primitive names.

SEO/GEO planning has moved to PRD 107 and is not part of this local cleanup closure.
