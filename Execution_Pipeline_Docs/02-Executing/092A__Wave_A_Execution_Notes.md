# PRD 092 - Execution Notes

Status: Complete; credentialed product-path smoke pending session credentials
Started: 2026-05-12
Scope: PRD 092 Wave A and Wave B

Wave A includes:

- Slice 0 - Documentation And Evidence Baseline
- Slice 1 - Verification Coverage
- Slice 2 - Contract And Security Primitive Convergence
- Slice 7 - Venice Loader Simplification With SEO/GEO Preservation
- Slice 8 - Roma Scaffold Honesty
- Slice 9 - Prague Stub Classification And Cleanup
- Slice 12 - Shared Contract Hygiene
- Slice 13 - Final Product-Path Verification for Wave A

Wave B was originally blocked behind the Wave A review checkpoint. The user explicitly resumed execution on 2026-05-12, so this file now records both the historical Wave A checkpoint and the final Wave B closure.

## Slice 0 - Baseline

Commands:

```bash
git status -sb
rg -n "SEO/GEO|seoGeo|embed.seoGeo|views.monthly|stub|placeholder|not available|scaffold|rebuild|repair|compat|legacy|widget-config-contract|CREATE_WIDGET_OPTIONS|ACTIVE_WIDGET_TYPES|WIDGET_SPECS|generateMetaPack|widgetType ===|case 'faq'|case 'countdown'|timingSafeEqual|sha256Hex|function isRecord|function asTrimmedString|withNoStore|resolveErrorReason|resolveTokyoControlErrorDetail|\\.catch\\(" documentation roma bob prague venice tokyo-worker berlin sanfrancisco packages dieter
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm test
```

Notes:

- `pnpm` was not available on PATH. Corepack could run pnpm, but could not create `/usr/local/bin/pnpm` due permission denial.
- A temporary `/tmp/clickeen-codex-bin/pnpm` shim was used for verification only.
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- The first evidence `rg` completed but was noisy because generated/vendor output exists inside app folders. Slice execution uses narrower `rg` patterns with generated folders excluded.

## Bounded Classification Matrix

Only files losing, moving, or gaining authority in Wave A are listed.

| File/path                                   | Service owner    | Current caller(s)     | Documentation source                     | Classification                                  | Surviving authority                           | Proposed action                                                      | Blast radius               | Verification command                             |
| ------------------------------------------- | ---------------- | --------------------- | ---------------------------------------- | ----------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| `package.json`                              | Workspace        | Root scripts          | PRD 092 Target B                         | Verification gap                                | Root Turbo scripts                            | Keep root scripts; make package scripts real where missing           | All checks                 | `pnpm typecheck`, `pnpm lint`, `pnpm test`       |
| `turbo.json`                                | Workspace        | Root verification     | PRD 092 Target B                         | Current product behavior                        | Root Turbo task graph                         | Preserve unless script coverage requires task change                 | All checks                 | `pnpm typecheck`, `pnpm lint`, `pnpm test`       |
| `bob/package.json`                          | Bob              | Root Turbo            | `documentation/services/bob.md`          | Verification gap                                | Bob app-local scripts                         | Add real `typecheck` script                                          | Bob only                   | `pnpm --filter @clickeen/bob typecheck`          |
| `roma/package.json`                         | Roma             | Root Turbo            | `documentation/services/roma.md`         | Verification gap                                | Roma app-local scripts                        | Add real `typecheck` script                                          | Roma only                  | `pnpm --filter @clickeen/roma typecheck`         |
| `venice/package.json`                       | Venice           | Root Turbo            | `documentation/services/venice.md`       | Verification gap                                | Venice app-local scripts                      | Add real `typecheck` script                                          | Venice only                | `pnpm --filter @clickeen/venice typecheck`       |
| `tokyo-worker/package.json`                 | Tokyo-worker     | Root Turbo            | `documentation/services/tokyo-worker.md` | Verification gap                                | Tokyo-worker app-local scripts                | Add real `typecheck` script                                          | Tokyo-worker only          | `pnpm --filter @clickeen/tokyo-worker typecheck` |
| `sanfrancisco/package.json`                 | San Francisco    | Root Turbo            | `documentation/architecture/CONTEXT.md`  | Verification gap                                | San Francisco app-local scripts               | Add real `typecheck` script                                          | San Francisco only         | `pnpm --filter @clickeen/sanfrancisco typecheck` |
| `dieter/package.json`                       | Dieter           | Root Turbo            | `documentation/architecture/CONTEXT.md`  | Verification gap                                | Dieter app-local scripts                      | Add real `typecheck` script                                          | Dieter only                | `pnpm --filter @ck/dieter typecheck`             |
| `packages/ck-contracts/src/index.ts`        | Shared contracts | Multiple services     | PRD 092 Target I/J                       | Duplicate truth                                 | `@clickeen/ck-contracts`                      | Add explicit strict primitives if needed                             | Multi-service compile-time | Package and root typecheck                       |
| `tokyo-worker/src/auth.ts`                  | Tokyo-worker     | Internal auth checks  | PRD 092 Target J                         | Duplicate truth                                 | Shared crypto primitive                       | Replace local timing-safe string comparison                          | Auth boundary              | Tokyo-worker typecheck                           |
| `sanfrancisco/src/grants.ts`                | San Francisco    | Grant validation      | PRD 092 Target J                         | Duplicate truth                                 | Shared crypto primitive                       | Replace local byte comparison if runtime-compatible                  | AI grant auth              | San Francisco typecheck                          |
| `sanfrancisco/src/signatures.ts`            | San Francisco    | Signature validation  | PRD 092 Target J                         | Duplicate truth                                 | Shared crypto primitive                       | Replace local string comparison                                      | AI signature auth          | San Francisco typecheck                          |
| `packages/l10n/src/index.ts`                | L10n package     | L10n fingerprints     | PRD 092 Target J                         | Duplicate truth                                 | Shared crypto primitive if runtime-compatible | Replace local `sha256Hex` only if it does not add coupling/confusion | L10n fingerprints          | Root typecheck                                   |
| `bob/lib/api/compiled-widget-route.ts`      | Bob              | Compiled widget API   | PRD 092 Target J                         | Duplicate truth                                 | Shared crypto primitive if runtime-compatible | Replace local `sha256Hex` only if it keeps Bob simple                | Bob compiled route         | Bob typecheck                                    |
| `venice/app/embed/v2/loader.ts`             | Venice           | Public embed loader   | `documentation/services/venice.md`       | Current product behavior                        | Venice loader                                 | Deduplicate iframe/resize/error paths while preserving SEO/GEO       | Public embed runtime       | Venice typecheck/build plus route smoke          |
| `roma/components/usage-domain.tsx`          | Roma             | Usage domain          | `documentation/services/roma.md`         | Deliberate scaffold                             | Roma scaffold honesty                         | Make copy honest if needed; do not delete domain                     | Roma UX                    | Roma typecheck                                   |
| `prague/src/components/Carousel.astro`      | Prague           | Marketing blocks      | PRD 092 Target E                         | Accidental public residue candidate             | Prague page composition                       | Classify missing-instance copy before cleanup                        | Public marketing pages     | Prague typecheck/build                           |
| `prague/src/components/InstanceEmbed.astro` | Prague           | Marketing embeds      | `documentation/services/venice.md`       | Current product behavior plus residue candidate | Prague embed composition                      | Preserve embed; remove public config-stub wording if accidental      | Public embeds              | Prague typecheck/build                           |
| `prague/src/blocks/hero/hero.astro`         | Prague           | Marketing hero block  | PRD 092 Target E                         | Accidental public residue candidate             | Prague marketing block                        | Remove customer-visible "stub" copy if not deliberate                | Public marketing pages     | Prague typecheck/build                           |
| `prague/src/blocks/split/split.astro`       | Prague           | Marketing split block | PRD 092 Target E                         | Accidental public residue candidate             | Prague marketing block                        | Remove customer-visible missing-instance copy if not deliberate      | Public marketing pages     | Prague typecheck/build                           |

## Slice 1 - Verification Coverage Findings

Root verification currently passes, but coverage is incomplete because Turbo only runs tasks defined in package scripts.

Packages with real `typecheck` scripts before Slice 1:

- `@clickeen/berlin`
- `@clickeen/prague`

Deployable services missing a real `typecheck` script before Slice 1:

- `@clickeen/bob`
- `@clickeen/roma`
- `@clickeen/venice`
- `@clickeen/tokyo-worker`
- `@clickeen/sanfrancisco`
- `@ck/dieter`

Slice 1 action: add real package-local `typecheck` scripts for those packages, then run each directly and rerun root `pnpm typecheck`.

Slice 1 result:

- Added real `tsc -p tsconfig.json --noEmit` scripts to Bob, Roma, Venice, Tokyo-worker, San Francisco, and Dieter.
- Direct typechecks passed for all six packages.
- Root `pnpm typecheck` now runs 8 real package tasks and passed.

## Slice 2 - Contract And Security Primitive Convergence

Action:

- Added shared security primitives to `@clickeen/ck-contracts/security` for timing-safe byte/string comparison and SHA-256 hex hashing.
- Replaced duplicate timing-safe comparison implementations in Tokyo-worker and San Francisco with the shared primitive.
- Replaced duplicate SHA-256 implementations in Bob and Tokyo-worker with the shared primitive while preserving local public wrappers where callers already depended on them.
- Exported strict `isRecord` and `asTrimmedString` helpers from `@clickeen/ck-contracts`, then removed duplicated local implementations from `ck-policy`, San Francisco HTTP parsing, and Berlin primitives.
- Left `packages/l10n/src/index.ts` as-is because `ck-contracts` already depends on `l10n`; importing `ck-contracts/security` back into `l10n` would create a package cycle.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/ck-contracts test
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
```

Result: green.

## Wave B / Slice 4 - Widget Catalog Authority And Create Flow

Status: GREEN

Action:

- Added Tokyo-worker widget catalog authority in `tokyo-worker/src/domains/widget-catalog.ts`.
- Exposed Tokyo catalog metadata through `/__internal/renders/widgets/catalog.json`.
- Replaced Roma's hardcoded create options with catalog entries returned by `/api/account/widgets`.
- Added account-policy visibility for widget creation through `widgets.types.max`.
- Moved saved widget-config validation to Tokyo-worker save/write boundaries.
- Deleted Roma's `widget-config-contract.ts`; Roma no longer imports `tokyo/product/widgets/*/spec.json`.
- Removed Roma-side config validation from account-instance direct calls so Tokyo is the saved-instance validation boundary.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/tokyo-worker typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/bob typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/bob lint
rg -n "tokyo/product/widgets|widget-config-contract|CREATE_WIDGET_OPTIONS|WIDGET_SPECS|ACTIVE_WIDGET_TYPES|ACTIVE_WIDGET_DEFAULTS" roma tokyo-worker/src/domains/render tokyo-worker/src/routes -g "*.{ts,tsx}"
```

Result: green. The search returned no Roma imports of widget specs and no retained Roma widget-config validator.

## Wave B / Slice 5 - Widget-Owned SEO/GEO Dispatch

Status: GREEN

Action:

- Preserved FAQ and Countdown SEO/GEO meta-pack behavior.
- Added catalog capability lookup before Tokyo-worker generates SEO/GEO metadata.
- Replaced the central `if widgetType === ...` SEO/GEO dispatch with a capability registry.
- Deleted Venice's unused request-time schema/excerpt generator files; Venice remains DB-free and continues to inject Tokyo-published metadata through the loader.
- Did not move SEO/GEO generation into Venice.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/tokyo-worker typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/venice typecheck
rg -n "widgetType === 'faq'|widgetType === 'countdown'|if \\(widgetType ===|generateSchemaJsonLd|generateExcerptHtml" tokyo-worker/src venice -g "*.{ts,tsx}"
```

Result: green. The remaining widget-type checks are catalog validation branches, not SEO/GEO dispatch.

## Wave B / Slice 6 - Catalog Labels, UX Scale, And Agent Metadata

Status: GREEN

Action:

- Roma account widgets now use catalog labels for create buttons and grouped instance headings.
- Prague public widget title helpers no longer special-case `faq -> FAQ`; public fallback labels are boring generic title-case when catalog data is unavailable.
- San Francisco stayed generic; no widget-name regex or catalog-shaped special case was added.
- Bob remained a generic compiled-widget consumer.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/prague typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/sanfrancisco typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/bob typecheck
rg -n "toLowerCase\\(\\) === 'faq'|faq -> FAQ|if \\(s\\.toLowerCase\\(\\) === 'faq'\\)|if \\(normalized\\.toLowerCase\\(\\) === 'faq'\\)" prague roma -g "*.{ts,tsx,astro}"
```

Result: green. Prague/Astro reported existing hints only: 0 errors and 0 warnings.

## Wave B / Slice 10 - Policy Enforcement Readiness

Status: GREEN

Action:

- Updated `widgets.types.max` registry metadata from gap to enforced, matching the new Roma catalog/create enforcement.
- Kept `views.monthly.max` as policy truth but explicitly marked it as a pre-GA enforcement gap that must not be advertised as active until Venice has monthly counters and over-limit behavior.
- Updated multitenancy docs to name the shipped widget-type enforcement and the monthly-views enforcement plan.
- Preserved `embed.seoGeo.enabled` as enforced by Bob embed UI and Tokyo-worker sync.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
rg -n "views\\.monthly\\.max|Monthly views|monthly public view|widgets\\.types\\.max|Widget types" packages/ck-policy/src documentation/capabilities/multitenancy.md roma -g "*.{ts,tsx,md}"
```

Result: green. `@clickeen/ck-policy` currently has no direct `typecheck` or `test` scripts; root verification covers it through downstream workspace typecheck.

## Wave B / Slice 11 - Tokyo-worker Artifact Boundary Simplification

Status: GREEN

Action:

- Deleted the unused direct internal `config-pack` write route from Tokyo-worker.
- Kept config-pack writes only behind the existing sync/queue artifact path.
- Kept `index/rebuild.json` as an explicit operator repair route and documented that product reads/writes must not call it as fallback.
- Removed the nonexistent `PATCH saved.json` route from Tokyo-worker service docs.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/tokyo-worker typecheck
rg -n "config-pack|PATCH /__internal/renders/widgets|writeConfigPack|sha256StableJson" tokyo-worker/src/routes/internal-render-routes.ts documentation/services/tokyo-worker.md roma bob scripts -g "*.{ts,tsx,js,mjs,md}"
```

Result: green. The search returned no direct route/caller residue for the deleted artifact mutation bypass.

## Wave B / Slice 13 - Final Product-Path Verification

Status: GREEN

Action:

- Ran the required PRD 092 final gate after Wave B.
- Built touched deployable surfaces.
- Checked diff whitespace.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm build:dieter
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm test
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/bob build
NEXT_PUBLIC_TOKYO_URL=http://localhost:4000 PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/prague build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/venice build
git diff --check
```

Result: green.

Known verification context:

- Roma build requires `NEXT_PUBLIC_TOKYO_URL`; the gate used `http://localhost:4000` as the local build-time value.
- Prague/Astro reported existing hints only: 0 errors and 0 warnings.
- No credentialed end-to-end product-path smoke was run because local account/session credentials were not available in this execution context.

## Slice 13 - Wave A Gate Verification

Action:

- Ran the full workspace gate after all Wave A slices.
- Built the deployable surfaces touched by Wave A.
- Recorded the historical Wave A-only checkpoint before later Wave B completion.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm test
NEXT_PUBLIC_TOKYO_URL=http://localhost:4000 PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/prague build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/venice build
```

Result: green.

Notes:

- `pnpm` was executed through the temporary Corepack shim because the global `pnpm` binary is not currently on PATH.
- Roma build requires `NEXT_PUBLIC_TOKYO_URL`; the gate used `http://localhost:4000` as the local build-time value.
- Prague/Astro emitted informational hints only; the check completed with zero errors and zero warnings.

Historical Wave A checkpoint:

- At this checkpoint, `roma/lib/widget-config-contract.ts` cleanup remained behind the Wave A review checkpoint.
- At this checkpoint, widget catalog authority cleanup remained behind the Wave A review checkpoint.
- At this checkpoint, SEO/GEO generator authority cleanup remained behind the Wave A review checkpoint.
- At this checkpoint, policy enforcement and Tokyo artifact-boundary simplification remained behind the Wave A review checkpoint.

## Wave B / Slice 3 - Roma Route And Error Boilerplate Cleanup

Status: GREEN

Action:

- Added `roma/lib/berlin-proxy-route.ts` as the single Roma helper for thin Berlin text proxy routes.
- Replaced duplicated Berlin fetch/response/error shells in session, profile, contact-method, invitation, team, account lifecycle, and owner-transfer routes.
- Kept route ownership explicit: each route still declares its session/account role boundary and the Berlin path it proxies.
- Did not touch widget-config validation in this slice.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma lint
```

Result: green.

## Slice 8 - Roma Scaffold Honesty

Action:

- Kept Roma domain navigation intact.
- Tightened Roma domain descriptions so scaffolded or partial domains do not claim unsupported product actions:
  - Billing now says it shows current plan and that provider operations are not connected.
  - Usage now says storage usage is live and broader reporting is not connected in Roma yet.
  - AI now says it shows entitlement context and that Copilot execution happens inside Builder.
  - Settings now names account languages, ownership, and final account controls.
- Updated `documentation/services/roma.md` to match the runtime copy and ownership.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma lint
NEXT_PUBLIC_TOKYO_URL=http://localhost:4000 PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma build
```

Result: green. A first build attempt without `NEXT_PUBLIC_TOKYO_URL` failed at configuration collection, which is expected because Roma requires an explicit Tokyo base URL.

## Slice 9 - Prague Stub Classification And Cleanup

Action:

- Preserved Minibob as a public demo/embed surface and did not introduce any save-capable authoring behavior.
- Replaced public fallback copy that exposed implementation details:
  - carousel missing data fallback
  - hero/split missing visual fallback
  - Venice embed unavailable fallback
  - create bridge unavailable page
  - localized overlay failure page copy
- Kept internal `[prague]` build/runtime validation errors as operator diagnostics; they are not normal public fallback copy.

Verification:

```bash
rg -n "stub|Missing accountInstanceRef|PUBLIC_VENICE_URL|PUBLIC_ROMA_URL|No items provided|Live widget preview \\(stub\\)|Required translation overlays|cloud-dev is repaired|not configured" prague/src prague/content --glob '!**/dist/**'
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/prague typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/prague build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
```

Result: green. Astro check reported existing hints, but 0 errors and 0 warnings.

## Slice 12 - Shared Contract Hygiene

Action:

- Re-scanned Wave A duplicate/gold-plating targets after Slices 2, 7, 8, and 9.
- Kept `@clickeen/ck-contracts` narrow: security primitives, JSON record checks, and strict trimmed string parsing only.
- Replaced additional duplicate parser primitives only where the affected module was already on a shared service boundary:
  - Roma Tokyo-control account-instance helpers
  - Roma Berlin product shared helper barrel
  - Tokyo-worker account localization utility
- Preserved domain-local parser helpers where extracting them would create a generic utility platform or cross-package coupling.
- At this checkpoint, preserved Wave B targets (`roma/lib/widget-config-contract.ts`, widget catalog authority, SEO/GEO generator authority) for later explicit Wave B execution.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/roma typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/tokyo-worker typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/ck-contracts test
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
```

Result: green. Tokyo-worker first caught a lost re-export from `account-localization-utils`; restored the export and reran green before continuing.

## Slice 7 - Venice Loader Simplification With SEO/GEO Preservation

Action:

- Collapsed duplicated iframe creation, CSP error display, load timeout handling, and resize message handling in `venice/app/embed/v2/loader.ts` into one `mountFrame` primitive.
- Kept the public embed contract intact:
  - script-level `data-instance-id`
  - placeholder-level `data-clickeen-id`
  - `/embed/v2/loader.js` and `/embed/latest/loader.js`
  - trigger behavior
  - locale handling
  - iframe render path
  - `ck:resize` postMessage behavior
  - CSP/load error reporting
  - SEO/GEO pointer, meta pointer, meta pack fetch, JSON-LD injection, and excerpt injection
- Did not touch Prague's embed usage or the SEO/GEO runtime contract.

Verification:

```bash
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/venice typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --filter @clickeen/venice build
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm --dir venice exec next dev --hostname 127.0.0.1 --port 3217
curl -fsS http://127.0.0.1:3217/embed/v2/loader.js | node -e 'const fs = require("node:fs"); const script = fs.readFileSync(0, "utf8"); new Function(script); const required = ["data-clickeen-id","data-instance-id","seo-geo","/renders/widgets/","/widget/","ck:resize","securitypolicyviolation"]; const missing = required.filter((token) => !script.includes(token)); if (missing.length) process.exit(1);'
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
```

Result: green.

## PRD 092 Final Completion - Wave B Closure

Status: GREEN for code, docs, and build gates; credentialed product-path smoke still requires a Roma account session cookie.

Action:

- Replaced the Tokyo-worker hand-maintained widget catalog/spec imports with the generated `tokyo/product/widgets/manifest.json`.
- Added widget-owned `catalog.json` files for FAQ, Countdown, and Logo showcase, including widget-owned display order.
- Moved FAQ and Countdown SEO/GEO meta-pack generation into `tokyo/product/widgets/{widgetType}/seo-geo.ts`.
- Added `scripts/build-widget-catalog.mjs`, which regenerates the widget manifest and `tokyo-worker/src/generated/widget-seo-geo-registry.ts`, plus `--check` mode for typecheck-time drift detection.
- Kept San Francisco widget copilot prompt routing generic by removing FAQ-specific prompt copy and content-intent regex shortcuts.
- Updated active docs so new widgets add widget-owned catalog/SEO files and rerun the generator, not hand-edit Tokyo-worker or Venice schema source.
- Corrected this execution note from a Wave A-only record into a full PRD 092 execution record.

Verification:

```bash
node scripts/build-widget-catalog.mjs
corepack pnpm --filter @clickeen/tokyo-worker typecheck
corepack pnpm --filter @clickeen/sanfrancisco typecheck
git diff --check
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm typecheck
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm lint
PATH="/tmp/clickeen-codex-bin:$PATH" pnpm test
NEXT_PUBLIC_TOKYO_URL=http://localhost:4000 PATH="/tmp/clickeen-codex-bin:$PATH" pnpm build
```

Result: green.

Notes:

- `pnpm` is still not installed as a global binary in this shell; root Turbo gates need the temporary `/tmp/clickeen-codex-bin/pnpm` Corepack shim so Turbo can find a package-manager executable.
- `corepack pnpm typecheck` without that shim still fails before running tasks with `Unable to find package manager binary: cannot find binary path`.
- Prague/Astro typecheck continues to emit existing generated-output hints only, with 0 errors and 0 warnings.
- `pnpm typecheck` now runs `build:widgets:check` before Turbo typecheck, so stale generated widget catalog files fail the normal typecheck gate.
- `pnpm build` now runs `build:widgets` before i18n/l10n and Turbo build, so generated widget catalog drift is caught by the build path.
- `pnpm health:product-path` remains blocked for the authenticated Roma product-path branch without `--cookie`, `CK_ROMA_COOKIE`, or `ROMA_COOKIE`; unauthenticated Roma rejection and Venice loader checks were already green in the preceding verification run.
