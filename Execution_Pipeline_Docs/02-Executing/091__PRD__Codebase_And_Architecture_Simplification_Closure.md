# PRD 091 - Codebase And Architecture Simplification Closure

Status: Executed - complete and green
Owner: Codex
Date: 2026-05-11
Architecture source: `documentation/architecture/CONTEXT.md`
Strategy source: `documentation/strategy/WhyClickeen.md`
Audit source: 2026-05-11 codebase simplification audit
Additional audit source: `/Users/pietro_macpro_home/Downloads/Clickeen_codebase_deep_analysis.docx`, reviewed 2026-05-11 against `b0ef2d0`
Primary code surfaces: `bob`, `roma`, `tokyo-worker`, `tokyo/product/widgets`, `venice`, `prague`, `sanfrancisco`, `berlin`, `dieter`

Execution status:

- Slice 0: complete and green.
- Slice 1: complete and green (`pnpm typecheck` green).
- Slice 2: complete and green (`pnpm build:dieter`, Prague build, direct Venice/Tokyo-worker tsc, direct Roma/Bob tsc, root `pnpm typecheck`, and required grep gate green).
- Slice 3: complete and green (required grep gate clean, direct Tokyo-worker/San Francisco tsc, and Berlin typecheck green).
- Slice 4: complete and green (Bob/Venice proxy duplicates collapsed locally, San Francisco translation safety collapsed, rate-limit parsing/HTML-error detection/UUID checks moved to contracts where appropriate, root `pnpm typecheck` and `pnpm lint` green).
- Slice 5: complete and green (`widgetCopilotCore.ts` 875 LOC, `typography.js` 818 LOC, `countdown/widget.client.js` 854 LOC, widget JS syntax checks green, direct San Francisco tsc green).
- Slice 6: complete and green (`pnpm build:dieter`, root `pnpm typecheck`, root `pnpm lint`, direct Bob/Roma/San Francisco/Venice/Tokyo-worker tsc, and root `pnpm test` green).

Slice 4 residual duplicate notes:

- `roma/lib/auth/session.ts` is the only surviving browser-session refresh implementation after Bob session files were deleted.
- `faqExcerptHtml` remains in Tokyo-worker and Venice because Tokyo writes generated localization/meta packs while Venice renders the public serving schema; those are separate authorities.
- Tiny `isRecord` / `asTrimmedString` ingress guards remain local at HTTP/storage boundaries where importing a shared helper would not remove meaningful product behavior or would cross runtime ownership for negligible LOC reduction.
- Bob and Venice each retain one local proxy helper because Bob resolves Tokyo through app env while Venice proxies through its service-aware `tokyoFetch` boundary.

## 1. Purpose

PRD 091 turns the simplification audit into an execution contract.

The goal is not prettier folders, generic utility platforms, or a new cleanup framework. The goal is to make the codebase smaller, easier to reason about, and more faithful to the pre-GA product:

```text
Roma account opens one Tokyo-owned widget instance
Bob edits that one active instance
Roma saves the same instance to Tokyo
Tokyo owns instance config, l10n, publish/live state, and generated read models
Venice serves only published Tokyo truth
Berlin owns auth/session/account bootstrap
Prague is marketing/demo surface, not product account truth
San Francisco performs bounded AI transformations, not speculative crawl/research systems
Dieter owns UI primitives and tokens
```

PRD 091 closes five simplification areas:

1. Source files over 900 LOC.
2. Orphan functions and orphan files.
3. Legacy/pre-GA support code that preserves removed behavior.
4. Gold-plating and self-checking flows.
5. Duplicate implementations of the same behavior under different names.

The additional DOCX review materially narrows the product concern: the remaining work is now mostly mechanical. PRD 090/PRD 089B product-path cleanup already landed a real first-widget create path, plural account instance routes, Tokyo-owned identity minting, lower-hop CRUD verbs, and incremental index patching on several hot paths. PRD 091 must not reopen those product decisions. It must finish the remaining simplification debt.

## 2. Non-Negotiable Execution Rules

1. Delete before extracting.
2. Remove behavior before moving files.
3. Do not create a generic platform to clean up five local helpers.
4. Every surviving concern must have one named authority.
5. A file being imported is not proof that the product concept belongs.
6. A false-positive orphan from runtime asset loading must be proved before deletion.
7. No pre-GA compatibility shim survives without a named current product contract.
8. No live product path may silently heal broken truth into a new normal.
9. Explicit repair endpoints may exist only as named operator boundaries.
10. Each slice must be fully green before the next slice starts.

## 3. Surviving Authorities

| Concern | Surviving authority |
|---|---|
| Account auth, sessions, bootstrap, authz capsule | Berlin |
| Account product shell and current account orchestration | Roma |
| Builder/editor surface | Bob |
| Account widget instance identity and saved config | Tokyo-worker |
| L10n overlays, publish/live state, generated instance indexes | Tokyo-worker |
| Public embed serving | Venice |
| Marketing/demo content | Prague |
| UI primitives and tokens | Dieter |
| AI edit/translation transforms | San Francisco |
| Cross-service policy/authz contracts | Existing workspace packages only when they already fit the concern |

No slice may move authority away from these boundaries unless the PRD is revised.

## 4. Audit Findings To Close

### 4.1 Files Over 900 LOC

Confirmed source findings, excluding generated/build output:

| File | LOC | Finding |
|---|---:|---|
| `sanfrancisco/src/agents/widgetCopilotCore.ts` | 1085 | Largest active source logic file. It mixes prompt construction, language detection, session state, operation validation, policy gates, model parsing, metadata, and response shaping. |
| `tokyo/product/widgets/shared/typography.js` | 954 | Widget runtime source. Presets/config and hydration behavior should be separated without changing widget behavior. |
| `tokyo/product/widgets/countdown/widget.client.js` | 916 | Widget runtime source. Pattern repeats near-threshold in FAQ and Logo Showcase. Extract common widget runtime scaffolding only if it deletes duplicate behavior. |
| `dieter/icons/icons.json` | 2518 | Data/catalog artifact, not source logic. Not a PRD 091 target. |

Near-threshold source files must not be split just to satisfy a number:

- `tokyo-worker/src/domains/assets-handlers.ts` - 880 LOC
- `tokyo/product/widgets/faq/widget.client.js` - 853 LOC
- `tokyo/product/widgets/logoshowcase/widget.client.js` - 849 LOC
- `tokyo-worker/src/routes/internal-render-routes.ts` - 848 LOC
- `tokyo-worker/src/domains/account-instance-sync.ts` - 790 LOC
- `roma/lib/account-instance-direct.ts` - 758 LOC
- `prague/src/lib/pragueL10n.ts` - 743 LOC
- `venice/app/embed/v2/loader.ts` - 698 LOC
- `bob/components/CopilotPane.tsx` - 657 LOC

Required correction:

- Bring `widgetCopilotCore.ts` under 900 LOC by deleting dead behavior and extracting only real boundaries.
- Bring the two `tokyo/product/widgets` source files over 900 LOC under the threshold through boring vertical splits or shared runtime extraction.
- Do not split near-threshold files unless another slice removes behavior or duplicate authority first.

### 4.2 Proven Orphan And Dead-Code Candidates

Strong deletion candidates:

| Target | Finding |
|---|---|
| `sanfrancisco/src/utils/webFetch.ts` | No code imports found. Unused external page fetch/scrape utility. |
| `bob/lib/account-authz-capsule.ts` | No active Bob imports found. Duplicate of Roma/Berlin authz capsule concept. |
| `bob/lib/auth/session-cors.ts` | No active imports found. |
| `bob/lib/auth/session.ts` | No active Bob imports found outside `session-cors.ts`; delete if still orphan after `session-cors` removal. |
| `roma/lib/seo-geo.ts` | No code imports found. Duplicates Tokyo/Venice SEO/GEO logic. |
| `roma/lib/text-packs.ts` | No code imports found. Duplicates Tokyo text-pack application. |
| `bob/bob_native_ui/instance_rename/InstanceRename.tsx` | No active imports found. |
| `berlin/src/identity/user-profiles.ts:userProfileExists` | Exported but unused. |
| `tokyo-worker/src/domains/render/normalize.ts:normalizeAccountWidgetDocument` | Exported but unused. |
| `tokyo-worker/src/domains/render/normalize.ts:normalizeLiveRenderPointer` | Exported but unused. |
| `tokyo-worker/src/domains/render/normalize.ts:normalizeMetaPointer` | Exported but unused. |
| `tokyo-worker/src/domains/assets.ts:loadAccountAssetUsageCountByIdentity` | Exported but unused and returns fake `0`. |
| `admin/scripts/generate-typography-json.ts` | Superseded by `generate-typography-json.cjs`, which is what `admin/package.json` invokes. Delete after confirming no external script invokes the TS variant. |
| `admin/src/router.ts` | Exports hash-router helpers with no active imports found. |
| `prague/src/composition/renderers/html/renderPrimitives.ts` | No active imports found. |
| `prague/src/lib/pagesJson.ts` | No active imports found in the additional review; re-prove before deletion. |
| `venice/lib/internal-bypass.ts` | No active imports found; delete if no current internal operator path uses it. |

Known false-positive class:

- Dieter runtime component files such as `dieter/components/repeater/repeater.js` and `dieter/components/object-manager/object-manager.js` may not appear in TypeScript import graphs because they are runtime/catalog assets. They are not deletion targets unless Dieter registry/build/runtime verification proves they are dead.
- The additional DOCX review listed several Prague files/exports as unused, but current import checks show active callers for `prague/src/lib/i18n.ts`, `prague/src/lib/instanceL10n.ts`, `prague/src/lib/markets.ts`, `prague/src/lib/markdown.ts`, `prague/src/lib/pragueOverlayHeaders.ts`, and `prague/src/blocks/site/nav/widgetsMegaMenu.ts`. These must not be deleted unless a fresh baseline proves those imports are gone.

### 4.3 Legacy / Pre-GA Toxicity

Confirmed pre-GA cleanup targets:

| Target | Toxic behavior |
|---|---|
| `prague/src/lib/blockRegistry.ts` | Accepts dual schemas: `iconName` and legacy `icon`, `backgroundPath` and legacy `background`, `imagePath` and legacy `image`. |
| `prague/src/components/StepsPrimitive.astro` | Supports "new + legacy" fields for icon/background/image. |
| `prague/src/blocks/global-moat/global-moat.astro` | Supports legacy `icon` fallback. |
| `prague/src/blocks/platform-strip/platform-strip.astro` | Still types/accepts old icon/background/image field shape. |
| `prague/src/blocks/control-moat/control-moat.astro` | Still types/accepts old icon/background/image field shape. |
| `scripts/build-dieter.js` | Preserves legacy `/dieter/tokens.css` shim. |
| `venice/lib/internal-bypass.ts` | Public-request snapshot bypass surface must be proved as an internal operator contract or deleted. |
| `tokyo-worker/src/domains/assets.ts` usage helpers | Fake usage functions return `0` / `[]`. |
| `tokyo-worker/src/domains/assets-handlers.ts` delete flow | Uses fake usage result to pretend it can protect assets in use. |
| `bob/lib/compiler/assets.ts` | Back-compat branch for historical usage tokens. |
| `bob/lib/compiler/stencils.ts` | Back-compat branch for stencils without binding attributes. |

Required correction:

- Current local data must be migrated to current field names before deleting Prague legacy readers.
- `/embed/latest/loader.js` is currently an active product contract used by Bob, Prague, and health smoke. PRD 091 must not delete it unless all callers are migrated in the same slice and docs are revised.
- If asset usage cannot be computed from a real Tokyo authority, remove the in-use confirmation gate rather than preserving fake protection.
- If snapshot bypass remains, it must be documented as an internal-only operator boundary and verified unreachable without the internal token in production.
- Bob compiler back-compat branches must either be removed by forcing manifest-format inputs or marked blocked by a named current widget manifest that still needs them.

### 4.4 Gold-Plating And Self-Checking Flows

Confirmed simplification targets:

| Target | Issue |
|---|---|
| `tokyo-worker/src/domains/render/instance-index.ts` | `readAccountInstanceIndex` can rebuild when missing. |
| `tokyo-worker/src/domains/render/instance-index.ts` | `resolveAccountInstanceLocation` defaults `rebuildIfMissing` to `true`. |
| `tokyo-worker/src/domains/render/account-instance-transitions.ts` | Publish-limit enforcement calls `readAccountInstanceIndex` with `rebuildIfMissing: true`. |
| `tokyo-worker/src/routes/internal-render-routes.ts` | Explicit index rebuild route is valid only as a repair boundary, not as proof that live paths can self-heal. |
| `berlin/src/account-management/members.ts` | Member role update patches, then reloads the same member before returning. |
| `sanfrancisco/src/agents/l10nPragueStrings.ts` | Prompt tells the model to "Silently self-check fluency"; this is prompt meta-work, not product behavior. |
| Base locale ownership | Berlin account locale policy and Tokyo instance/l10n documents both carry base-locale truth. One must be canonical; the other must be explicitly derived. |
| Validator volume | The repo carries a large number of `normalize*`, `isRecord`, `asTrimmedString`, and boundary guard copies. Keep unknown-to-typed validation at HTTP/storage ingress; trust typed internal calls. |
| `buildAccountInstanceIndexDryRun` | Dry-run repair support is gold-plating unless wired to a real operator/CI guard. |

Required correction:

- Keep explicit repair endpoints where architecture allows generated read models to be rebuilt.
- Remove automatic rebuild from live product paths.
- Use write-returned rows when available instead of write-then-read proof.
- Remove prompt meta-instructions that tell the model to check itself rather than returning bounded output.
- Decide base-locale ownership before editing the l10n save/publish flow. Do not preserve reconciliation as a permanent product shape.
- Delete or justify dry-run index rebuild behavior.

### 4.5 Duplicate Implementations

Confirmed duplicate authorities:

| Duplicate | Locations |
|---|---|
| Session token decode/expiry/refresh flow | `bob/lib/auth/session.ts`, `roma/lib/auth/session.ts` |
| Tokyo static proxy helper | `bob/app/dieter/[...path]/route.ts`, `bob/app/widgets/[...path]/route.ts`, `bob/app/fonts/[...path]/route.ts`, `bob/app/l10n/[...path]/route.ts` |
| SEO/GEO excerpt/meta generation | `roma/lib/seo-geo.ts`, `tokyo-worker/src/domains/account-localization-mirror.ts`, `venice/lib/schema/faq.ts` |
| Text-pack path mutation | `roma/lib/text-packs.ts`, `tokyo-worker/src/domains/account-localization-mirror.ts` |
| Translation safety checks | `sanfrancisco/src/agents/l10nPragueStrings.ts`, `sanfrancisco/src/agents/l10nTranslationCore.ts` |
| Rate-limit record parsing | `berlin/src/http/request-ops.ts`, `roma/lib/request-ops.ts` |
| HTML-error detection | `bob/components/CopilotPane.tsx`, `roma/lib/ai/account-copilot.ts` |
| Dieter color utilities | `dieter/components/dropdown-border/dropdown-border.ts`, `dieter/components/dropdown-shadow/dropdown-shadow.ts`, `dieter/components/dropdown-fill/*` |
| Dieter rich-text helpers | `dieter/components/dropdown-edit/dropdown-edit.ts`, `dieter/components/textedit/*` |
| Tiny boundary primitives | `asTrimmedString`, `isRecord`, and `isUuid` are repeated across apps even though `@clickeen/ck-contracts` already exports some of this class of helper. |
| Venice catch-all proxy helpers | `venice/app/dieter/[...path]/route.ts`, `venice/app/widgets/[...path]/route.ts`, `venice/app/l10n/[...path]/route.ts`, `venice/app/renders/[...path]/route.ts` |
| Route response helpers | `withNoStore`, `copyUpstreamHeaders`, `buildConditionalHeaders`, bearer parsing, and JSON error envelopes are repeated in small route modules. |

Required correction:

- Delete stale duplicate files before extracting shared helpers.
- Extract only small, boring, proven primitives.
- Do not create a broad "utils" dumping ground.
- If a duplicate is intentionally duplicated because of runtime boundaries, document the reason and keep the code visibly tiny.
- Prefer existing workspace packages for dependency-free primitives only when importing them deletes more local code than it adds.

## 5. Execution Slices

Each slice must be executed and verified before moving to the next slice.

### Slice 0 - Evidence Baseline

Purpose:

- Reconfirm the audit against current `HEAD`.
- Prevent execution from fixing stale ghosts.

Required commands:

```bash
git status --short
find admin berlin bob dieter prague roma sanfrancisco scripts tokyo-worker venice tokyo/product/widgets -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.astro' \) \
  ! -path '*/node_modules/*' \
  ! -path '*/.next/*' \
  ! -path '*/.next-dev/*' \
  ! -path '*/.vercel/*' \
  ! -path '*/.cloudflare/*' \
  ! -path '*/.wrangler/*' \
  ! -path '*/.turbo/*' \
  ! -path '*/dist/*' \
  ! -path '*/build/*' \
  ! -path '*/coverage/*' \
  -print0 | xargs -0 wc -l | sort -nr | awk '$1 > 900 && $2 != "total" {print}'
rg -n "webFetch|account-authz-capsule|session-cors|seo-geo|text-packs|InstanceRename|userProfileExists|loadAccountAssetUsageCountByIdentity|normalizeAccountWidgetDocument|normalizeLiveRenderPointer|normalizeMetaPointer|generate-typography-json.ts|startRouter|renderPrimitivesToHtml|buildAccountInstanceIndexDryRun|legacyIcon|Back-compat" . \
  --glob '!**/node_modules/**' \
  --glob '!**/.next*/**' \
  --glob '!**/dist/**' \
  --glob '!**/.wrangler/**' \
  --glob '!**/.vercel/**' \
  --glob '!**/.cloudflare/**'
```

Acceptance:

- Baseline confirms the same target set or this PRD is amended before execution.
- No code is changed in this slice.

### Slice 1 - Delete Proven Orphans

Scope:

- Only targets with no active product caller.

Required changes:

1. Delete `sanfrancisco/src/utils/webFetch.ts`.
2. Delete `bob/lib/account-authz-capsule.ts`.
3. Delete `bob/lib/auth/session-cors.ts`.
4. Delete `bob/lib/auth/session.ts` if it remains unreferenced after step 3.
5. Delete `roma/lib/seo-geo.ts`.
6. Delete `roma/lib/text-packs.ts`.
7. Delete `bob/bob_native_ui/instance_rename/InstanceRename.tsx` and any now-orphaned CSS only if no catalog/runtime reference exists.
8. Delete `userProfileExists` from `berlin/src/identity/user-profiles.ts`.
9. Delete unused normalizers from `tokyo-worker/src/domains/render/normalize.ts`.
10. Delete `loadAccountAssetUsageCountByIdentity` from `tokyo-worker/src/domains/assets.ts`.
11. Delete `admin/scripts/generate-typography-json.ts` if no external invocation exists.
12. Delete `admin/src/router.ts` if no UI entry imports it.
13. Delete `prague/src/composition/renderers/html/renderPrimitives.ts` if no renderer imports it.
14. Delete `prague/src/lib/pagesJson.ts` if no caller exists.
15. Delete `venice/lib/internal-bypass.ts` if no current internal operator path imports it.

Required verification:

```bash
rg -n "webFetch|fetchSinglePageText|fetchHeadMeta|fetchHtmlSnippet|authorizeRequestAccountRoleFromCapsule|withSessionAndCors|applyTextPackToConfig|generateMetaPack|InstanceRename|userProfileExists|loadAccountAssetUsageCountByIdentity|normalizeAccountWidgetDocument|normalizeLiveRenderPointer|normalizeMetaPointer|startRouter|renderPrimitivesToHtml|isSnapshotBypassRequested|isSnapshotBypassAuthorized" . \
  --glob '!**/node_modules/**' \
  --glob '!**/.next*/**' \
  --glob '!**/dist/**' \
  --glob '!**/.wrangler/**'
pnpm typecheck
```

Acceptance:

- Proven orphans are gone.
- Dieter runtime assets are untouched unless separately proved dead.
- Typecheck is green.

### Slice 2 - Remove Fake Legacy And Pre-GA Compatibility

Scope:

- Legacy readers and fake compatibility behavior that are toxic before GA.

Required changes:

1. Prague current-field migration:
   - Search Prague content/config for legacy `icon`, `background`, and `image` fields consumed by block registry, `StepsPrimitive.astro`, `global-moat.astro`, `platform-strip.astro`, and `control-moat.astro`.
   - Convert living data to `iconName`, `backgroundPath`, and `imagePath`.
   - Remove legacy validators from `prague/src/lib/blockRegistry.ts`.
   - Remove legacy fallback branches from Prague components.
2. Dieter token path:
   - Search for `/dieter/tokens.css` and `tokens.css` imports.
   - Update current callers to `/dieter/tokens/tokens.css`.
   - Remove the legacy output shim in `scripts/build-dieter.js`.
3. Bob compiler back-compat:
   - Remove the historical usage-token branch from `bob/lib/compiler/assets.ts` after proving current manifests declare explicit aliases.
   - Remove the first-input binding-attribute fallback from `bob/lib/compiler/stencils.ts` after proving current stencils declare binding attributes.
4. Venice snapshot bypass:
   - Prove `venice/lib/internal-bypass.ts` is required by a current internal operator path, or delete it.
   - If retained, document the exact header/token contract and verify production cannot enable bypass without `VENICE_INTERNAL_BYPASS_TOKEN`.
5. Tokyo fake asset usage:
   - Remove fake `loadAccountAssetUsageInstanceIdsByIdentity` behavior.
   - Remove the `confirmInUse` delete gate if no real Tokyo-owned usage authority exists.
   - If a real usage authority already exists, wire to that authority only; do not add a speculative usage-index subsystem.

6. Venice path allowlists:
   - Keep the current l10n/renders allowlists.
   - Add equivalent shape allowlists for Venice `dieter` and `widgets` catch-all proxies, or document why those two are intentionally pass-through current contracts.

Required verification:

```bash
rg -n "new \\+ legacy|legacyIcon|legacyBackground|legacyImage|Back-compat|/dieter/tokens.css|x-ck-snapshot-bypass|confirmInUse|loadAccountAssetUsageInstanceIdsByIdentity" prague bob scripts venice tokyo-worker documentation \
  --glob '!**/node_modules/**' \
  --glob '!**/.next*/**' \
  --glob '!**/dist/**'
pnpm build:dieter
pnpm --filter @clickeen/prague build
pnpm --filter @clickeen/venice typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
```

Acceptance:

- No Prague component preserves old and new schema branches.
- Dieter no longer publishes a legacy token shim.
- Bob compiler no longer accepts historical manifest/stencil shapes silently.
- Venice has no unnamed pre-GA bypass and catch-all routes are either allowlisted or explicitly current pass-through contracts.
- Tokyo asset delete flow no longer pretends fake usage protection exists.
- Targeted builds/typechecks are green.

### Slice 3 - Remove Self-Healing From Live Product Paths

Scope:

- Keep explicit repair boundaries.
- Remove automatic repair from live product behavior.

Required changes:

1. Tokyo instance index:
   - `readAccountInstanceIndex` must not rebuild unless called from the explicit repair endpoint.
   - `resolveAccountInstanceLocation` must not default `rebuildIfMissing` to `true`.
   - Publish-limit checks must fail fast when the index is missing/invalid.
2. Tokyo repair endpoint:
   - Keep `/__internal/renders/widgets/index/rebuild.json` only as a named repair boundary.
   - Documentation must state generated indexes are read models and repair is explicit.
3. Berlin member update:
   - Use the write-returned row from Supabase where possible.
   - Remove write-then-reload proof from member role update.
4. San Francisco prompt meta-work:
   - Remove "Silently self-check" prompt instruction.
   - Keep deterministic output validation in code where needed.
5. Base-locale ownership:
   - Decide whether Berlin account locale policy or Tokyo instance l10n summary is canonical for base locale.
   - Convert the non-canonical value into an explicitly derived projection.
   - Remove any permanent reconciliation path that treats both as equal product truth.
6. Index rebuild dry run:
   - Delete `buildAccountInstanceIndexDryRun` unless it is wired to a named current operator/CI guard.

Required verification:

```bash
rg -n "rebuildIfMissing: true|rebuildIfMissing \\?\\? true|Silently self-check|const refreshed = await loadAccountMember|buildAccountInstanceIndexDryRun" tokyo-worker berlin sanfrancisco roma
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/berlin typecheck
pnpm --filter @clickeen/sanfrancisco typecheck
```

Acceptance:

- Live Tokyo product paths fail at the boundary instead of rebuilding themselves.
- The explicit Tokyo repair route remains available and documented.
- Berlin no longer re-reads the same member as proof of its own write.
- San Francisco no longer asks the model to perform hidden self-check meta-work.
- Base-locale ownership is documented and one side is derived.
- Dry-run index rebuild is deleted or has a named current guard.

### Slice 4 - Collapse Duplicate Authorities

Scope:

- Remove duplicate implementations where one surviving authority is obvious.

Required changes:

1. Bob/Roma session logic:
   - If Bob session code was deleted in Slice 1, no action.
   - If Bob has a real active caller, extract only pure token helpers into an existing workspace package if they are dependency-free.
   - Keep Next.js cookie response shaping app-local.
2. Bob Tokyo proxy routes:
   - Extract one local Bob Tokyo static proxy helper.
   - Route files should only declare prefix and HTTP handlers.
3. Venice proxy routes:
   - Extract one local Venice proxy helper while preserving route-specific allowlists.
   - Route files should only declare prefix, allowlist, and HTTP handlers.
4. SEO/GEO:
   - Roma must not contain a stale meta-pack generator.
   - Tokyo remains the save/localization meta-pack writer.
   - Venice remains the public schema/excerpt renderer.
5. Text-pack path mutation:
   - Tokyo remains the only active text-pack application authority.
6. San Francisco translation safety:
   - Move duplicated placeholder/tag/anchor parity checks into one San Francisco-local helper.
   - Both translation flows must call the same helper.
7. Rate-limit parsing:
   - Extract a tiny shared parser only if it deletes both Berlin and Roma duplicates without introducing a generic request-ops platform.
8. HTML-error detection:
   - Use one tiny shared function or keep one copy if the other path is deleted.
9. Tiny primitives:
   - Consolidate repeated `asTrimmedString`, `isRecord`, and `isUuid` only where the import is dependency-safe and removes local duplication.
   - Prefer `@clickeen/ck-contracts` for contract-level primitives; do not import UI/runtime-only helpers across product boundaries.
10. Dieter helper duplication:
   - Extract small component-local shared helpers only where exact duplicate color/richtext functions are removed.
   - Do not create a broad Dieter utility framework.

Required verification:

```bash
rg -n "function refreshSession|function decodeJwtPayload|function tokenIsExpired|function parseRateLimitRecord|function looksLikeHtml|function assertPlaceholderParity|function assertRichtextAnchorParity|function faqExcerptHtml|function setExistingStringAtPath|function asTrimmedString|function isRecord|function isUuid|function copyUpstreamHeaders|function buildConditionalHeaders" bob roma berlin sanfrancisco tokyo-worker venice dieter packages \
  --glob '!**/node_modules/**' \
  --glob '!**/.next*/**' \
  --glob '!**/dist/**'
pnpm typecheck
pnpm lint
```

Acceptance:

- Duplicate functions either have one surviving implementation or a documented reason for two tiny boundary-local copies.
- No new generic utility dumping ground exists.
- Root typecheck and lint are green.

### Slice 5 - Reduce Monster Files Without Inventing New Architecture

Scope:

- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/countdown/widget.client.js`

Required changes:

1. Delete behavior made unreachable by previous slices.
2. Extract only real pure boundaries:
   - operation/control validation;
   - language/session helpers;
   - response metadata shaping.
3. Keep the main core file as orchestration, not as a pile of policies.
4. Split Tokyo widget runtime files only by existing responsibilities:
   - typography presets/config separated from hydration behavior;
   - countdown widget-specific behavior separated from common runtime scaffolding when the same scaffolding is shared with FAQ/Logo Showcase.
5. Do not introduce a plugin framework, policy registry, or new agent runtime.

Required verification:

```bash
wc -l sanfrancisco/src/agents/widgetCopilotCore.ts
wc -l tokyo/product/widgets/shared/typography.js tokyo/product/widgets/countdown/widget.client.js
pnpm --filter @clickeen/sanfrancisco typecheck
```

Acceptance:

- `widgetCopilotCore.ts` is under 900 LOC.
- `tokyo/product/widgets/shared/typography.js` and `tokyo/product/widgets/countdown/widget.client.js` are under 900 LOC.
- Extracted files are boring and product-named.
- No new behavior is introduced.
- San Francisco typecheck is green.

### Slice 6 - Final Architecture And Documentation Closure

Scope:

- Make docs match the simplified product and service boundaries.

Required changes:

1. Update architecture/service docs when behavior changed:
   - `documentation/architecture/CONTEXT.md`
   - `documentation/services/tokyo-worker.md`
   - `documentation/services/venice.md`
   - `documentation/services/bob.md`
   - `documentation/services/berlin.md`
   - `documentation/services/prague/*` where applicable
2. Remove docs that teach removed pre-GA compatibility behavior.
3. Add a short closure note to PRD 091 with final deletion/consolidation counts.

Required verification:

```bash
pnpm build:dieter
pnpm typecheck
pnpm lint
pnpm test
git status --short
```

Acceptance:

- Docs no longer teach removed compatibility paths.
- All checks are green or a blocker is explicitly documented in PRD 091.
- Final diff deletes more legacy/orphan behavior than it adds.
- No slice leaves "cleanup later" code to justify preserving toxic flow.

## 6. Explicit Non-Goals

- Do not redesign Berlin account management.
- Do not redesign Tokyo storage keys.
- Do not rebuild Venice loader architecture.
- Do not create a shared mega-utils package.
- Do not move Dieter runtime assets merely because TypeScript cannot see them.
- Do not delete Prague modules that current Astro pages/components import just because an export-level scan is noisy.
- Do not delete `/embed/latest/loader.js` unless all active Bob/Prague/health callers are migrated in the same slice.
- Do not change public product behavior except where this PRD explicitly removes fake, legacy, or self-healing behavior.
- Do not use source-code grep checks as product proof; grep is only a regression guard for deleted code.

## 7. Stop Conditions

Stop execution and revise this PRD if:

1. A target marked orphan has a real active product caller.
2. Removing a compatibility path breaks a current deployed contract.
3. A proposed extraction adds more LOC than it removes without deleting behavior.
4. A slice requires a new subsystem to pass.
5. Root or targeted checks fail and the failure is not understood.

## 8. Definition Of Done

PRD 091 is complete when:

1. No source logic file is over 900 LOC except generated/catalog data.
2. Proven orphan files/functions listed in this PRD are deleted.
3. Pre-GA legacy compatibility branches listed in this PRD are gone or documented as current contracts.
4. Live product paths no longer self-heal generated Tokyo indexes.
5. Fake asset usage protection is gone or wired to real Tokyo-owned truth.
6. Duplicate implementations are collapsed to one surviving authority where appropriate.
7. Documentation matches the simplified architecture.
8. `pnpm build:dieter`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` are green or a true external blocker is recorded.

## 9. Closure Notes

Final execution removes the toxic PRD 88/89 carryover mechanisms rather than preserving them behind new names:

- Deleted or removed tracked code/docs from orphan sessions, fake asset usage, Prague legacy field readers, Venice bypass/legacy Tokyo path handling, Tokyo self-healing index reads, and duplicate proxy/translation/rate-limit helpers.
- Reduced the named monster files below threshold: `widgetCopilotCore.ts` 875 LOC, `shared/typography.js` 818 LOC, and `countdown/widget.client.js` 854 LOC.
- Current diff is deletion-dominant: tracked diff reports 261 insertions and 3426 deletions; new code helper files add 684 LOC, for about 945 code LOC added versus 3426 code LOC deleted before counting this PRD document.
- Final verification passed: `pnpm build:dieter`, root `pnpm typecheck`, root `pnpm lint`, direct Bob/Roma/San Francisco/Venice/Tokyo-worker tsc, and root `pnpm test`.
- Final source LOC gate passed with no non-generated source logic file over 900 LOC; generated/catalog output was excluded from the threshold.
- Remaining tiny boundary-local guards are intentionally local at ingress/storage boundaries; they do not define competing product truth.
