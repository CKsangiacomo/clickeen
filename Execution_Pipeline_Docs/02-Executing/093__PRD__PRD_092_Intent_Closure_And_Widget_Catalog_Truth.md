# PRD 093 - PRD 092 Execution Audit Closure And Widget Catalog Truth

Status: Executed - code/docs verified; credentialed product smoke blocked on Roma cookie
Owner: Codex
Date: 2026-05-12
Architecture source: `documentation/architecture/CONTEXT.md`
Strategy source: `documentation/strategy/WhyClickeen.md`
Parent PRD: `Execution_Pipeline_Docs/02-Executing/092__PRD__Pre_GA_Product_Architecture_Simplification_Pass.md`
Execution source: `Execution_Pipeline_Docs/02-Executing/092A__Wave_A_Execution_Notes.md`
Review source: post-execution PRD 092 audit on commit `229e5e85`
Additional audit source: `/Users/pietro_macpro_home/Downloads/PRD_092_execution_audit.md`, reviewed 2026-05-12
Inline audit source: user-provided "PRD 92 Execution Audit", reviewed 2026-05-12
Execution notes: `Execution_Pipeline_Docs/02-Executing/093A__Execution_Notes.md`

## 0. Execution Result

PRD 093 was executed on 2026-05-12.

Green:

- Builder open contract repaired: Tokyo saved-instance envelope includes Tokyo-owned `publishStatus`, and Roma Builder open consumes one saved envelope instead of making a second serve-state request.
- Prague widget labels now resolve through generated catalog metadata and fail on unknown widget metadata.
- Prague footer no longer routes generic widget chrome to FAQ.
- San Francisco PRD 092 edit-policy scope creep was removed rather than parked.
- Roma local `asTrimmedString` drift was removed in the touched product path.
- Tokyo-worker no longer exports a competing `isRecord`; the canonical exported helper remains `@clickeen/ck-contracts`.
- Missing local verification scripts were added for Bob, Dieter, ck-contracts, and l10n.

Blocked:

- Credentialed Roma product-path smoke could not be completed from this shell because no Roma browser cookie was available. Public smoke checks for Roma unauth rejection and Venice loader passed. See PRD 093A Slice 9 for the exact command and blocker.

## 1. Purpose

PRD 093 closes the remaining PRD 092 execution and intent gaps.

PRD 092 correctly moved the active widget catalog authority to widget-owned source under `tokyo/product/widgets/*` and generated artifacts:

- `tokyo/product/widgets/{widgetType}/catalog.json`
- `tokyo/product/widgets/{widgetType}/spec.json`
- `tokyo/product/widgets/manifest.json`
- `tokyo-worker/src/generated/widget-seo-geo-registry.ts`

The architecture is mostly where it should be. The remaining gaps are:

- Bob/Roma Builder cannot open existing widgets in cloud-dev; `/api/builder/{instanceId}/open` returns `502 Bad Gateway`.
- Prague still derives some public widget display labels from URL slugs.
- One Prague chrome link still hardcodes `faq` as the generic widgets destination.
- PRD 092 introduced an AI-made San Francisco copilot edit-policy concept outside the authorized scope.
- Roma still has same-name local `asTrimmedString` helpers with a contract that differs from the canonical helper.
- `isRecord`/`isPlainRecord`/`isPlainObject` drift remains, including an exported Tokyo-worker helper competing with `ck-contracts`.
- Some package/service verification surfaces are still missing local commands.
- PRD 092 has not been administratively closed and has not had credentialed product-path smoke recorded.

This matters because widget catalog truth is a product UX authority, not only a Tokyo-worker implementation detail. If Prague public pages, share copy, and chrome keep deriving widget names locally, then adding or renaming widgets still leaks engineering slug truth into user-facing product copy.

PRD 093 must finish that closure without building a marketplace, search platform, generic dispatch framework, new widget abstraction layer, or broad utility platform.

## 2. Product Spine

The governing product path remains unchanged:

```text
Roma account shell
  -> Bob Builder editor kernel
  -> Roma account save/orchestration boundary
  -> Tokyo-worker saved instance and published artifact authority
  -> Venice public iframe/embed runtime
```

Supporting surfaces remain unchanged:

- Prague owns marketing, SEO pages, demos, public widget pages, and funnel surfaces.
- Tokyo product widget folders own widget source truth.
- Tokyo-worker consumes generated catalog artifacts for account instance creation, validation, and SEO/GEO dispatch.
- Roma consumes Tokyo-worker catalog/account APIs for account create UX.
- Bob remains the generic one-widget editor kernel.
- San Francisco remains generic unless explicit widget metadata later supplies agent guidance.

## 3. Current Findings To Close

### Finding A - Bob/Roma Builder Open Is Failing In Cloud-Dev

Current evidence from user report:

- Roma Builder page displays: "Builder could not open this widget. Please try again."
- Browser console shows repeated `GET https://roma.dev.clickeen.com/api/builder/{instanceId}/open 502 (Bad Gateway)`.
- The visible failing route is the active account Builder open path, not a demo/minibob path.

Likely code path:

- `roma/components/builder-domain.tsx` calls `/api/builder/{instanceId}/open`.
- `roma/app/api/builder/[instanceId]/open/route.ts` calls `loadBuilderOpenEnvelope`.
- `roma/lib/builder-open.ts` loads saved instance config and serve state through `roma/lib/account-instance-direct.ts`.
- Tokyo-worker saved instance and serve-state routes are the upstream product authority.

Why this blocks PRD 092 closure:

- The real authoring product is account opens widget in Roma, Bob edits, Roma saves to Tokyo.
- If Builder cannot open an existing saved widget, the catalog/validator cleanup is not behaviorally closed.
- PRD 092 removed Roma's local widget-config validator; the Builder open path must now correctly trust Tokyo-worker as the saved-instance boundary and surface named errors, not collapse into generic 502.

Required correction:

- Diagnose the exact upstream failure behind `/api/builder/{instanceId}/open`.
- Fix the active Builder open path so existing account widgets open in Bob again.
- Preserve the one-widget, one-active-locale authoring model.
- Preserve Tokyo-worker as the saved-instance/config authority; do not restore Roma widget spec imports or local validators.
- Ensure 404/422/auth/upstream failures return named error envelopes that Roma maps to specific copy.
- Add targeted verification around `loadBuilderOpenEnvelope` or the route/data helper that failed.

Acceptance:

- Opening an existing widget from Roma Widgets or direct Builder route loads Bob with the saved config.
- `/api/builder/{instanceId}/open` no longer returns 502 for valid account instances.
- Invalid/missing instance still returns a named 404/422/auth error, not silent fallback data.
- No Roma import of `tokyo/product/widgets/*/spec.json` is reintroduced.

### Finding B - Prague Public Labels Still Come From Slugs

Current evidence:

- `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro` defines `titleCaseWidget(widgetKey)` and uses it for create CTA copy.
- `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro` repeats the same slug-derived label logic.
- `prague/src/components/InstanceEmbed.astro` derives share copy from `data-ck-widget-type` with `titleCaseWidgetType`.
- `tokyo/product/widgets/logoshowcase/catalog.json` says `label: "Logo showcase"`, while slug titlecase produces `Logoshowcase`.

Why this violates PRD 092:

- PRD 092 Target Q required Prague labels to come from catalog display metadata when available.
- PRD 092 Target S required Prague public widget display names to prefer catalog metadata over widget-name string exceptions.
- Removing `faq -> FAQ` special casing was necessary but not sufficient; replacing a special case with generic slug formatting still leaves Prague as a local display-label authority.

Required correction:

- Add a small Prague-side catalog reader that imports or reads the generated widget manifest in a boring, local way.
- Public widget pages must resolve `widgetKey -> catalog.label` before falling back to slug titlecase.
- Public widget pages must use the resolved label for create CTA copy and any other page-local widget display copy.
- `InstanceEmbed.astro` must receive or resolve catalog label metadata for share copy when available.
- Unknown/catalog-unavailable widget pages must fail at the named content/page boundary. Do not invent fallback widget labels.

Non-goals:

- Do not add a live Tokyo fetch for Prague page render just to read labels.
- Do not build widget search, marketplace navigation, or category browsing.
- Do not create a generalized widget registry framework outside the existing manifest.

### Finding C - Prague Chrome Still Hardcodes FAQ As The Widgets Destination

Current evidence:

- `prague/src/blocks/site/footer.astro` links "Widgets" to `/${market}/${locale}/widgets/faq/`.

Why this violates PRD 092:

- PRD 092 accepted remaining widget-name literals only when classified as fixture, documentation, migration history, or blocked finding.
- The footer link is product chrome, not fixture or documentation.

Required correction:

- Remove the hardcoded footer widget link for Pre-GA.
- Replace it with honest non-linked placeholder text, for example `Widgets: Pre-GA catalog in progress`.
- Do not route generic footer chrome to a specific widget page.

Non-goals:

- Do not create a public widget marketplace page.
- Do not add routing for widgets that do not have Prague page content.

### Finding D - PRD 092 Is Not Administratively Closed

Current evidence:

- `Execution_Pipeline_Docs/02-Executing/092__PRD__Pre_GA_Product_Architecture_Simplification_Pass.md` remains in `02-Executing`.
- `Execution_Pipeline_Docs/02-Executing/092A__Wave_A_Execution_Notes.md` remains in `02-Executing`.
- There is no PRD 092 final executed report in `Execution_Pipeline_Docs/03-Executed`.

Required correction:

- After Findings A and B are fixed and verified, create a PRD 092 closure report in `Execution_Pipeline_Docs/03-Executed`.
- The closure report must name:
  - commit(s) that executed PRD 092 and PRD 093 closure;
  - the surviving widget catalog authority;
  - verification commands run;
  - any residual risks intentionally deferred.
- Move or copy PRD 092 artifacts according to the repo's existing executed-PRD convention.

Non-goals:

- Do not rewrite PRD 092 history.
- Do not bury known gaps; if any remain, record them explicitly.

### Finding E - AI-Made San Francisco Copilot Policy Must Be Reverted

Current evidence from the external audit:

- `sanfrancisco/src/agents/widgetCopilotCore.ts` grew by roughly 318 net LOC in PRD 092.
- The added behavior includes a made-up edit-policy flow with scope/group classification, sensitive-path detection, `pendingPolicy` state, and confirmation copy.
- PRD 092 only authorized San Francisco cleanup around removing FAQ-specific prompt copy and avoiding widget-name regex behavior.

Why this violates PRD 092:

- PRD 092 was a simplification and architecture cleanup PRD.
- Adding an unreviewed copilot policy subsystem is a product behavior change, not a simplification.
- The execution notes described what was removed but did not clearly describe what was added.

Required correction:

- Revert the AI-made copilot edit-policy subsystem.
- Preserve only the PRD 092-authorized result: San Francisco remains generic and loses FAQ-specific prompt/regex shortcuts.
- Do not keep, park, flag, document, or expand the made-up policy as product behavior in PRD 093.
- If a real copilot edit-safety policy is ever wanted, it must start from a separate product PRD.

Acceptance:

- PRD 093 leaves no PRD 092 scope creep in San Francisco.
- San Francisco still has no FAQ/countdown/logoshowcase prompt regex or widget-name product shortcut.
- The AI-made edit-policy concept is removed rather than normalized as architecture.

### Finding F - Roma asTrimmedString Contract Drift Remains

Current evidence from the external audit:

- `packages/ck-contracts/src/index.ts` exports canonical `asTrimmedString` returning `string | null`.
- Several Roma-local helpers named `asTrimmedString` return `string`.
- The prior audit's concern was same-name contract drift, not a request to create a cross-repo utility platform.

Why this violates PRD 092 intent:

- PRD 092 Target I existed to remove silent contract drift.
- Package-cycle concerns justify not forcing every service through `ck-contracts`.
- They do not justify multiple same-name helpers inside Roma with a different return contract.

Required correction:

- Add one small Roma-local guard module, preferably `roma/lib/guards.ts`, with explicit helper names and contracts.
- Prefer canonical semantics for `asTrimmedString`: `string | null`.
- Update Roma call sites that currently define same-name local helpers.
- If a caller truly needs "trimmed string or empty string", name that behavior explicitly, for example `asTrimmedStringOrEmpty`.

Non-goals:

- Do not create a repo-wide parser/guard utility package.
- Do not churn semantically identical `isRecord` helpers outside touched Roma files unless they are in the same small local guard module and reduce drift.
- Do not change Dieter or Tokyo-worker helper contracts in this slice unless a failing verification shows they are coupled to the Roma change.

Acceptance:

- Roma no longer has multiple local definitions of `asTrimmedString`.
- Any remaining `asTrimmedString` outside `ck-contracts` is classified as service-local, same-contract, or deferred.
- Call sites retain existing behavior intentionally; empty-string behavior is named honestly if preserved.

### Finding G - Credentialed Product-Path Smoke Was Not Run

Current evidence:

- PRD 092 execution notes disclosed that no credentialed end-to-end product-path smoke was run because local account/session credentials were unavailable.

Required correction:

- Run credentialed smoke if credentials/session are available.
- If unavailable, record the exact blocker in the PRD 092 closure report and leave a named follow-up item.

Required smoke list:

1. Authenticated Roma session: open an existing widget in Builder and verify Bob receives/applies the saved config.
2. Create a widget of each catalog type and verify catalog labels render from generated catalog metadata.
3. Save an invalid FAQ config and verify Tokyo-worker returns structured validation without Roma-owned widget validation.
4. Publish an FAQ instance and verify SEO/GEO meta pack generation still works through generated registry.
5. Hit a Berlin-proxied Roma route such as `/api/me` with valid, invalid, and missing session states.
6. Embed a published widget through Venice loader and verify iframe render plus SEO/GEO JSON-LD injection.

Acceptance:

- The smoke list is either run and recorded or blocked with concrete credential/session requirements.
- PRD 092 is not called behaviorally proven unless the credentialed smoke list passes.

### Finding H - Shared Primitive Drift Still Includes isRecord And Hash Boundaries

Current evidence from the inline audit and local scan:

- `packages/ck-contracts/src/index.ts` exports canonical `isRecord`.
- `tokyo-worker/src/route-helpers.ts` exports its own `isRecord` returning `Record<string, unknown>`.
- Bob, Prague, Berlin, Dieter, Tokyo-worker, and Roma still have private `isPlainRecord` / `isPlainObject` / `isRecord` helpers.
- `packages/l10n/src/index.ts` still has a private `sha256Hex` implementation while `@clickeen/ck-contracts/security` exports `sha256Hex`.

Why this matters:

- The exported Tokyo-worker `isRecord` is a real competing primitive authority.
- Same-name exported primitives are more dangerous than private local guards because future agents can import the wrong one.
- The `packages/l10n` hash copy cannot be naively fixed by importing from `ck-contracts/security` while `ck-contracts` depends on `l10n`; that would create a package cycle.

Required correction:

- Remove or privatize the exported `tokyo-worker/src/route-helpers.ts` `isRecord` helper and import the canonical helper where dependency direction allows.
- Decide and document the canonical object-record contract: `JsonRecord` from `ck-contracts` or `Record<string, unknown>`. Do not leave competing exported names.
- Classify remaining private `isPlainRecord` / `isPlainObject` copies as:
  - same-contract local parser helpers that may stay;
  - same-service drift to converge;
  - blocked by dependency direction;
  - accidental duplication to remove.
- For `packages/l10n` `sha256Hex`, do not introduce a `ck-contracts` <-> `l10n` cycle. Either leave it explicitly documented as cycle-blocked or split the crypto primitive into a cycle-free package in a separate PRD.

Non-goals:

- Do not centralize every private object guard across the repo.
- Do not create a new utility platform during PRD 093.
- Do not introduce package cycles to make a grep result look clean.

Acceptance:

- No exported non-canonical `isRecord` helper remains in Tokyo-worker.
- Remaining private object guards are classified in the closure report.
- `packages/l10n` hash duplication is either fixed without a cycle or explicitly documented as blocked by current package ownership.

### Finding I - Local Verification Surface Is Incomplete

Current evidence from the inline audit and package manifests:

- `bob/package.json` has `typecheck` and `lint`, but no `test`.
- `dieter/package.json` has `typecheck`, but no `lint` or `test`.
- `packages/ck-contracts/package.json` has `test`, but no `typecheck` or `lint`.
- `packages/l10n/package.json` has no local scripts despite being a shared package consumed by other services.

Why this matters:

- PRD 092 Target 1 asked for every deployable service to have a named local verification command.
- Root/Turbo success can hide missing local command surfaces.
- Future agents need obvious per-package commands, especially for shared contracts.

Required correction:

- Add meaningful local scripts where the package has code to verify.
- If a package truly cannot support a lint/test command yet, document that explicitly in the PRD 092 closure report and leave a named follow-up.
- Prefer real commands over no-op placeholders.

Minimum command surface target:

| Package | Required local scripts |
|---|---|
| `bob` | `typecheck`, `lint`, `test` |
| `dieter` | `typecheck`, `lint`, `test` or documented no-test rationale |
| `packages/ck-contracts` | `typecheck`, `lint`, `test` |
| `packages/l10n` | `typecheck` and test/fixture verification if practical |

Acceptance:

- Missing local verification scripts are added or explicitly documented as not applicable with rationale.
- Root `pnpm typecheck`, `pnpm lint`, and `pnpm test` include the new/updated local surfaces where appropriate.
- The closure report names any packages still lacking a local command and why.

## 4. Target Architecture

### 4.1 Builder Open Boundary

The active Builder open path is part of the core product spine:

```text
Roma Builder route
  -> /api/builder/{instanceId}/open
  -> Tokyo-worker saved instance + serve-state authority
  -> Bob receives one ck:open-editor payload
```

Correct shape:

- Roma resolves account/session/authz.
- Tokyo-worker owns saved config, widget type, and serve-state truth.
- Roma returns one open envelope to Bob.
- Bob applies the open envelope and edits the one active widget document.

Incorrect shape:

- Roma imports widget specs to recover from open failures.
- Roma invents placeholder config when Tokyo returns invalid or missing data.
- Builder open failures collapse into unexplained `502 Bad Gateway` for valid account instances.
- Minibob/demo behavior is treated as evidence for account Builder behavior.

### 4.2 Widget Catalog Authority

The surviving authority for widget catalog metadata is:

```text
tokyo/product/widgets/{widgetType}/catalog.json
  + tokyo/product/widgets/{widgetType}/spec.json
  -> scripts/build-widget-catalog.mjs
  -> tokyo/product/widgets/manifest.json
```

Allowed consumers:

- Tokyo-worker may import the generated manifest and generated SEO/GEO registry.
- Roma may consume catalog data only through Tokyo-worker account/control APIs.
- Prague may import/read the generated manifest for public marketing display metadata.
- Bob may continue compiling one widget at a time from widget spec source through existing compiler paths.

Disallowed consumers:

- Roma must not import `tokyo/product/widgets/*/spec.json`.
- Prague must not maintain per-widget display-name exceptions.
- San Francisco must not grow widget-name regexes for prompt behavior.
- Venice must not grow per-widget SEO/GEO imports.

### 4.3 Prague Public Widget Labels

Prague should have one boring local helper for public display labels:

```text
widgetType -> generated manifest entry -> catalog label
```

Expected behavior:

- Known widget with catalog label: use the catalog label exactly.
- Unknown widget or missing manifest entry: fail at the named page/content boundary. Do not render a fallback widget label.
- Missing page content: preserve current required-page failure behavior.
- Overlay/localization failures: preserve current unavailable behavior.

This helper is label metadata only. It must not become:

- a widget marketplace model;
- a content routing authority;
- a Tokyo-worker account catalog replacement;
- a public entitlement system.

### 4.4 Prague Footer

Footer chrome must stop naming FAQ as "the widgets page" by accident.

Required outcome for PRD 093:

- Remove the generic footer "Widgets" link to FAQ.
- Replace it with honest Pre-GA placeholder text and no link.
- Do not create a catalog-derived footer route.
- Do not create a public widgets index.

### 4.5 San Francisco Copilot Policy Boundary

San Francisco may own bounded AI transformations. It must not accumulate AI-made product policy concepts during cleanup PRDs.

PRD 093 must remove the PRD 092 copilot edit-policy addition.

Required outcome:

- Revert `pendingPolicy`, `evaluateLightEditsPolicy`, and related sensitive-edit confirmation machinery unless execution proves those identifiers predate PRD 092.
- Preserve generic copilot behavior.
- Preserve removal of FAQ-specific prompt copy.

Disallowed outcomes:

- keeping the policy as a parked scaffold;
- adding a flag around it;
- writing service docs that normalize it;
- using PRD 093 to design copilot governance.

### 4.6 Roma Local Guards

Roma may have a local guard module when it reduces same-service semantic drift.

Correct shape:

```text
roma/lib/guards.ts
  -> explicit helper names
  -> one return contract per name
  -> imported by Roma files only
```

Incorrect shape:

- a new cross-service utility platform;
- helpers whose names hide empty-string-vs-null semantics;
- unrelated parser cleanup across the repo.

### 4.7 Shared Primitive Boundaries

Primitive ownership should be narrow and dependency-safe.

Correct shape:

```text
packages/ck-contracts
  -> shared contracts and dependency-safe primitives already allowed by package graph

service-local private guard
  -> allowed when it is only local parser glue and cannot be imported as authority
```

Incorrect shape:

- exported service helpers that compete with `ck-contracts`;
- importing `ck-contracts` from `l10n` while `ck-contracts` depends on `l10n`;
- renaming every local guard just to satisfy grep.

### 4.8 Verification Ownership

Each deployable service or shared package touched by PRD 092/093 must expose local verification commands that future agents can discover from its `package.json`.

Correct shape:

- `typecheck` for TypeScript packages.
- `lint` for packages with an applicable lint setup.
- `test` for packages with executable tests or realistic smoke/unit coverage.
- documented "not applicable yet" only where a real command would be dishonest.

Incorrect shape:

- no-op test scripts that always pass;
- relying only on root Turbo commands;
- undocumented missing local scripts.

## 5. Execution Slices

Each slice must be green before the next starts.

### Slice 0 - Evidence Refresh

Read before changing code:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- PRD 092
- PRD 092 execution notes
- PRD 092 execution audit from `/Users/pietro_macpro_home/Downloads/PRD_092_execution_audit.md`
- Prague widget page files
- Prague footer
- generated widget manifest
- Roma Builder open route and helpers
- Tokyo-worker saved instance and serve-state routes
- San Francisco `widgetCopilotCore.ts` PRD 092 diff
- Roma local `asTrimmedString` helper sites
- exported/private object guard helper sites
- package verification scripts for Bob, Dieter, ck-contracts, l10n

Run and record:

```bash
rg -n "\\b(faq|countdown|logoshowcase)\\b|FAQ|Countdown|Logo" prague/src --glob '*.{astro,ts,tsx}'
rg -n "catalog.json|manifest.json|tokyo/product/widgets|titleCaseWidget|titleCaseWidgetType" prague/src tokyo/product/widgets --glob '*.{astro,ts,json}'
rg -n "/api/builder|loadBuilderOpenEnvelope|loadTokyoAccountInstanceDocument|loadTokyoAccountInstanceServeStates|open-editor" roma bob tokyo-worker/src --glob '*.{ts,tsx}'
rg -n "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'
rg -n "function isRecord|const isRecord|isPlainRecord|isPlainObject" packages tokyo-worker bob roma prague berlin dieter sanfrancisco --glob '*.{ts,tsx}'
rg -n "sha256Hex" packages tokyo-worker bob roma prague berlin dieter sanfrancisco --glob '*.{ts,tsx}'
rg -n "pendingPolicy|evaluateLightEditsPolicy|validateOpsAgainstControls|sensitive" sanfrancisco/src/agents/widgetCopilotCore.ts
node scripts/build-widget-catalog.mjs --check
```

Acceptance:

- Current widget-name literals are classified before edits.
- Builder open failure path is classified before edits.
- The surviving label authority is named in the execution notes.
- Roma helper drift sites are identified before edits.
- exported/shared primitive drift is classified before edits.
- missing package verification scripts are identified before edits.
- San Francisco edit-policy addition is identified before revert.

### Slice 1 - Builder Open Product Path Regression

Fix the cloud-dev Builder open regression before cleanup-only work.

Primary files:

- `roma/app/api/builder/[instanceId]/open/route.ts`
- `roma/lib/builder-open.ts`
- `roma/lib/account-instance-direct.ts`
- Tokyo-worker saved instance / serve-state route files if the upstream contract is the failure
- Bob session open handling only if the response envelope is valid and Bob rejects it

Requirements:

- Reproduce or identify the `/api/builder/{instanceId}/open` 502 cause from logs, route response, or local equivalent.
- Preserve Tokyo-worker as the saved config and serve-state authority.
- Preserve Bob's `ck:open-editor` envelope contract.
- Return named error envelopes for invalid/missing/auth/upstream failures.
- Add a targeted test or smoke for the failing helper/route where practical.

Acceptance:

- Valid saved account widget opens in Builder and Bob applies the saved config.
- `/api/builder/{instanceId}/open` returns 200 for valid account instances.
- Invalid/missing instances return named non-200 errors.
- No Roma widget spec import or local widget validator is restored.

### Slice 2 - Prague Catalog Label Helper

Implement a small helper under Prague source that reads generated catalog metadata.

Requirements:

- Source is `tokyo/product/widgets/manifest.json`.
- Returned public data is limited to display metadata needed by Prague.
- Unknown widgets return `null` from the helper; page/content code must fail at its named boundary rather than silently inventing labels.
- Helper has no network dependency.
- Helper has no account policy dependency.

Acceptance:

- `logoshowcase` resolves to `Logo showcase`.
- `faq` resolves to `FAQ`.
- Unknown widget slugs do not receive invented display labels.

### Slice 3 - Replace Prague Slug-Derived Labels Where Catalog Is Available

Update:

- `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro`
- `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro`
- `prague/src/components/InstanceEmbed.astro`

Requirements:

- Page CTAs prefer catalog labels.
- Share copy prefers catalog labels.
- Existing routing, overlay failure handling, and page-content requirements stay unchanged.
- No widget-specific `if faq`, `if countdown`, or `if logoshowcase` logic is introduced.

Acceptance:

- Public widget pages for current widgets display catalog labels where page code constructs labels.
- `logoshowcase` no longer appears as `Logoshowcase` in generated local display copy.
- `faq -> FAQ` is achieved through catalog metadata, not a string exception.

### Slice 4 - Remove Prague Footer FAQ Link

Update:

- `prague/src/blocks/site/footer.astro`

Requirements:

- The "Widgets" footer link must not hardcode FAQ as a generic widgets destination.
- Remove the link for Pre-GA.
- Replace it with honest placeholder text and no affordance.

Acceptance:

- Residue scan no longer reports a hardcoded FAQ footer link.
- Footer remains valid for supported markets/locales.
- No public routes are added.

### Slice 5 - Revert AI-Made San Francisco Copilot Policy

Update only if the evidence classification says a code change is required.

Primary file:

- `sanfrancisco/src/agents/widgetCopilotCore.ts`

Requirements:

- Revert the made-up edit-policy subsystem added during PRD 092.
- Preserve PRD 092's intended San Francisco result: no widget-name regex, no FAQ-biased prompt copy, generic widget-aware behavior only when explicit metadata exists.
- Do not add new policy features.
- Do not reformat unrelated San Francisco files.

Acceptance:

- `widgetCopilotCore.ts` no longer contains the made-up edit-policy subsystem added during PRD 092.
- No new San Francisco widget-specific prompt shortcut appears.
- Any future copilot edit-safety policy is deferred to a separate product PRD.

### Slice 6 - Roma asTrimmedString Guard Convergence

Update:

- Roma files defining local `asTrimmedString`.
- Add `roma/lib/guards.ts` if it is the smallest local convergence point.

Requirements:

- One Roma-local definition for `asTrimmedString`.
- The name must return `string | null`, matching canonical semantics.
- Any empty-string-preserving behavior must use a distinct helper name.
- Keep diffs to Roma helper sites and necessary imports.

Acceptance:

- `rg -n "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'` reports only the intended Roma guard definition, or every remaining site is explicitly classified.
- Roma behavior remains equivalent where callers previously expected empty string.
- No cross-service utility platform is introduced.

### Slice 7 - Shared Primitive Drift Closure

Update only the smallest necessary files.

Primary targets:

- `tokyo-worker/src/route-helpers.ts`
- direct callers of the exported Tokyo-worker `isRecord`
- `packages/l10n/src/index.ts` only if the hash duplication can be fixed without a package cycle
- closure notes for private local guards that are intentionally left alone

Requirements:

- Remove competing exported object-record authority from Tokyo-worker.
- Preserve dependency direction; do not import `ck-contracts` into `l10n` unless the package graph is first made acyclic in an approved way.
- Do not centralize Bob/Prague/Berlin/Dieter private parser guards unless the local change is clearly same-service convergence.

Acceptance:

- `rg -n "export function isRecord|export const isRecord" tokyo-worker/src packages --glob '*.{ts,tsx}'` shows only the intended canonical export(s).
- `packages/l10n` hash duplication is fixed cycle-safely or documented as cycle-blocked.
- Remaining private `isPlainRecord` / `isPlainObject` helpers are classified in the closure report.

### Slice 8 - Verification Command Surface

Update package manifests and minimal verification files only.

Targets:

- `bob/package.json`
- `dieter/package.json`
- `packages/ck-contracts/package.json`
- `packages/l10n/package.json` if practical
- root Turbo/pnpm configuration if it excludes new local commands

Requirements:

- Add real local scripts, not no-op placeholders.
- If a service cannot honestly have a local lint/test yet, document the reason and add follow-up rather than faking coverage.
- Keep tests small and relevant to package boundaries.

Acceptance:

- `pnpm --filter @clickeen/bob test` exists and runs meaningful coverage or documented smoke.
- `pnpm --filter @ck/dieter lint` and `pnpm --filter @ck/dieter test` exist, or the missing command is documented as not applicable with rationale.
- `pnpm --filter @clickeen/ck-contracts typecheck`, `lint`, and `test` exist.
- `packages/l10n` has a local verification command or a documented blocker.
- Root verification commands include the new local surfaces where appropriate.

### Slice 9 - Credentialed Smoke And Behavioral Closure

Run the required product-path smoke list if credentials are available.

Requirements:

- Use a real authenticated Roma session or documented local equivalent.
- Exercise Builder open, create, invalid save, publish/SEO-GEO, Berlin proxy, and Venice embed paths.
- Record exact commands, URLs, account/session assumptions, and outcomes.

Acceptance:

- Smoke passes, or closure report records concrete credential/session blocker.
- If any smoke fails, PRD 093 does not proceed to closure until the failure is fixed or explicitly split into a higher-priority follow-up.

### Slice 10 - Documentation And Closure

Update documentation after code is green.

Required docs:

- `documentation/architecture/CONTEXT.md` if Prague's catalog metadata consumption is not already documented clearly.
- `documentation/services/prague.md` if service-level Prague behavior needs the new helper recorded.
- `documentation/services/tokyo-worker.md` or package docs if primitive ownership changes.
- `Execution_Pipeline_Docs/03-Executed/092__Execution_Report.md` or the repo's equivalent PRD 092 closure artifact.

Acceptance:

- PRD 092 closure artifact exists in `03-Executed`.
- The closure artifact lists PRD 092 and PRD 093 commits.
- Any remaining widget-name literals outside widget-owned source are classified.
- PRD 092 status is updated or its executed report clearly supersedes the stale draft header.
- The closure artifact says whether credentialed smoke was run or blocked.
- The closure artifact classifies remaining private object guards and missing verification commands, if any.

## 6. Verification

Required commands:

```bash
node scripts/build-widget-catalog.mjs --check
rg -n "CREATE_WIDGET_OPTIONS|ACTIVE_WIDGET_TYPES|ACTIVE_WIDGET_DEFAULTS|widget-config-contract|WIDGET_SPECS|case 'faq'|case 'countdown'|widgetType === 'faq'|widgetType === 'countdown'" roma bob prague venice tokyo-worker/src sanfrancisco packages --glob '*.{ts,tsx,js,mjs,astro}'
rg -n "\\b(faq|countdown|logoshowcase)\\b|FAQ|Countdown|Logo" prague/src --glob '*.{astro,ts,tsx}'
rg -n "/api/builder|loadBuilderOpenEnvelope|Builder could not open|open-editor" roma bob --glob '*.{ts,tsx}'
rg -n "function asTrimmedString|const asTrimmedString|asTrimmedString =" roma --glob '*.{ts,tsx}'
rg -n "export function isRecord|export const isRecord" tokyo-worker/src packages --glob '*.{ts,tsx}'
rg -n "FAQ-specific|faq-specific|widget-name regex|widgetType === 'faq'|case 'faq'" sanfrancisco/src/agents --glob '*.{ts,tsx}'
pnpm --filter @clickeen/bob test
pnpm --filter @ck/dieter typecheck
pnpm --filter @ck/dieter lint
pnpm --filter @ck/dieter test
pnpm --filter @clickeen/ck-contracts typecheck
pnpm --filter @clickeen/ck-contracts lint
pnpm --filter @clickeen/ck-contracts test
pnpm --filter @clickeen/prague check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If global `pnpm` is unavailable, use Corepack or the local execution shim and record that fact.

Additional manual verification:

- Open an existing account widget in Roma Builder and confirm Bob loads it.
- Call `/api/builder/{instanceId}/open` for a valid account instance and confirm `200` plus saved config envelope.
- Call `/api/builder/{instanceId}/open` for a missing/invalid instance and confirm a named error envelope.
- Inspect `/us/en/widgets/faq/`.
- Inspect `/us/en/widgets/countdown/`.
- Inspect `/us/en/widgets/logoshowcase/`.
- Confirm generated CTA/share labels use catalog labels.
- Confirm footer has no generic widget link pointing to a specific widget.
- Run or explicitly block the credentialed smoke list from Finding G.

## 7. Done Criteria

PRD 093 is done when:

- Prague public widget labels prefer `tokyo/product/widgets/manifest.json` metadata.
- Roma Builder can open valid saved account widgets in Bob.
- `/api/builder/{instanceId}/open` no longer returns 502 for valid account instances.
- Prague footer no longer routes generic widget chrome to FAQ or any other specific widget.
- Roma remains catalog/API-driven and does not regain local widget catalog truth.
- Tokyo-worker remains generated-catalog-driven and does not regain a hand-authored widget map.
- Venice remains DB-free and request-time-generation-free for SEO/GEO injection.
- San Francisco remains generic and does not gain widget-name prompt regexes.
- San Francisco PRD 092 copilot edit-policy additions are reverted.
- Roma no longer has silent same-name `asTrimmedString` contract drift.
- No exported service-local `isRecord` competes with `ck-contracts`.
- `packages/l10n` hash duplication is fixed without a package cycle or documented as cycle-blocked.
- Bob, Dieter, ck-contracts, and l10n verification surfaces are complete or explicitly blocked with rationale.
- Credentialed product-path smoke is run or concretely blocked in closure notes.
- PRD 092 is administratively closed in `03-Executed`.
- Verification is green or any blocked command is named with a concrete reason.

## 8. Explicit Deferrals

Do not use PRD 093 to implement:

- a public widget marketplace;
- widget search/filtering;
- a catalog API for Prague;
- San Francisco widget capability prompts;
- San Francisco copilot edit-safety policy design;
- Dieter dropdown lifecycle work;
- Overlay primitive renaming;
- broad `.catch` rewrites outside touched Prague paths;
- broad San Francisco copilot redesign;
- broad helper convergence outside Roma;
- broad private `isRecord`/`isPlainObject` churn outside classified risk sites;
- package graph rewrites only to remove one hash helper;
- any new account authoring mode.

These may become future PRDs only if product requirements demand them.
