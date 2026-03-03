# 053 Execution Report - Stop Runtime Healing: One Truth for Assets and Locales

Date: 2026-02-28
Owner: Product Dev Team
Status: EXECUTED IN CODE (local contract/runtime checks green; existing l10n terminal failures still present on sample curated instance)

## Scope

This report captures implementation and verification for PRD 53:
- Snapshot contract hardening
- Runtime asset strictness
- Snapshot locale entitlement determinism
- Curated/user snapshot orchestration parity

## Code changes (executed)

### Slice A - Tokyo snapshot guardrails

File:
- `tokyo-worker/src/domains/render.ts`

Changes:
- Added generated-artifact validation for forbidden legacy paths (`/arsenale/`) on `r.json` and `meta.json` before publish pointer move.
- Added carry-forward revalidation for existing revision entries:
  - If carried `r.json`/`meta.json` artifact is missing or contains forbidden legacy path, locale is dropped from next revision `current`.
- Kept failure model strict: any generated artifact validation failure throws and prevents pointer advancement.

### Slice B - Shared fill strictness

File:
- `tokyo/widgets/shared/fill.js`

Result:
- Already compliant at execution time (no raw `src/url/poster/posterSrc` fallback resolution present; canonical `asset.versionId` only path materialization).
- No code change required.

### Slice C - Locale cap after final merge

File:
- `paris/src/domains/workspaces/service.ts`

Changes:
- Added shared entitlement max resolver for locales.
- Applied `l10n.locales.max` cap to final merged locale set (`workspace locales + persisted overlay locales`) in `resolveRenderSnapshotLocales`.
- `hasOverlayLocaleFallback` now reflects whether overlay-derived locales survive into final capped set.

### Slice D - Curated/user parity in snapshot orchestration

File:
- `paris/src/domains/workspaces/read-handlers.ts`

Changes:
- Removed curated-only gating from `handleWorkspaceInstanceRenderSnapshot`.
- Endpoint now enforces workspace authz + valid `publicId` + instance existence only (same contract for curated and user instances).

### Slice E - Fail-visible asset availability signal on `/r`

File:
- `venice/app/r/[publicId]/route.ts`

Changes:
- Added asset availability analysis from render state:
  - `assetAvailability.status`: `ok|missing|unknown`
  - `assetAvailability.missingCanonicalRefs`
  - `assetAvailability.missingPaths` (bounded list)
- Added response headers:
  - `X-Ck-Asset-Availability`
  - `X-Ck-Asset-Missing-Count`
- Dynamic `/r` now includes `assetAvailability` payload field.
- Snapshot `/r` remains byte-faithful; headers are derived from payload/state without mutating snapshot bytes.

## Verification

Commands run:

1. `pnpm test:contracts`
   - Result: PASS (`[contracts] OK`)
2. `pnpm test:paris-boundary`
   - Result: PASS (`[paris-boundary] OK`)
3. `pnpm test:runtime-parity:public`
   - Result: PASS
4. `pnpm test:runtime-parity:auth`
   - Result: PASS
5. `pnpm lint`
   - Result: PASS for executed packages; Bob has existing react-hooks warnings (non-blocking, pre-existing).
6. `pnpm typecheck`
   - Result: runs turbo typecheck graph; no execution-slice regressions surfaced.
7. `pnpm --filter @clickeen/{tokyo-worker,paris,venice} exec tsc --noEmit`
   - Result: NOT RELIABLE in this workspace due cross-tree/backup/external tsconfig pollution and unrelated missing modules/types.

Runtime probes (local):

1. Snapshot `/r` headers expose asset signal:
   - `x-ck-asset-availability: ok`
   - `x-ck-asset-missing-count: 0`
   - `x-venice-render-mode: snapshot`
2. Dynamic bypass `/r` exposes payload + headers:
   - payload `assetAvailability: { status: "ok", missingCanonicalRefs: 0, missingPaths: [] }`
   - headers include `x-ck-asset-availability` and `x-ck-asset-missing-count`
3. Snapshot payload includes asset signal after EN-only manual regeneration:
   - `POST /renders/instances/wgt_curated_faq_pixelart_gaming/snapshot` with `{"action":"upsert","locales":["en"]}` returned `200`.
   - Published pointer advanced to new revision (`mm6mav5y-c22f10af4847`).
   - Published `r.json` for `en` contains `assetAvailability: { status: "ok", missingCanonicalRefs: 0, missingPaths: [] }`.
4. Snapshot orchestration parity check:
   - Non-curated-format `publicId` now returns `NOT_FOUND` (instance missing) instead of curated-only validation denial.
5. Published artifact legacy-path scan:
   - Pointer read: `GET http://localhost:8791/renders/instances/wgt_curated_faq_pixelart_gaming/published.json`
   - Revision index read: `GET http://localhost:8791/renders/instances/wgt_curated_faq_pixelart_gaming/revisions/mm6mav5y-c22f10af4847/index.json`
   - Artifact scan across all locale `r.json`/`meta.json` in revision:
     - Result: `legacy_path_found=0` for `/arsenale/`.

Observed operational note (existing data/pipeline state, not introduced by PRD 53 code):
- Workspace orchestration endpoint with `waitForEn=1` on `wgt_curated_faq_pixelart_gaming` timed out.
- Publish status reports `overall: l10n_failed` with many terminal locale failures (`retry_exhausted:Overlay write failed (500)`).
- This affects full locale-set orchestration readiness, not EN-only manual snapshot generation.

## Decision

PRD 53 execution slices are implemented in code with local contract/runtime gates green.

Follow-up required outside this PRD slice:
- Repair existing terminal l10n failures on affected curated instance(s) before expecting EN wait gates to pass consistently for manual `waitForEn=1` orchestration.
