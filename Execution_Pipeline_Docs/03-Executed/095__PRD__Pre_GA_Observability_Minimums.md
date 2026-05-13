# PRD 095 - Pre-GA Observability Minimums

Status: Executed
Date: 2026-05-13
Cleanup context: `Execution_Pipeline_Docs/01-Planning/096__PRD__Pre_GA_Fragmentation_Tax_And_Product_Path_Cleanup.md`
Venice runtime context: `Execution_Pipeline_Docs/01-Planning/097__PRD__Venice_World_Class_Public_Runtime.md`
Architecture source: `documentation/architecture/CONTEXT.md`

## 1. Purpose

PRD 095 defines and executes the minimum observability required before and during pre-GA product-path cleanup.

This is intentionally separate from PRD 096. PRD 096 is code-architecture cleanup. PRD 095 is operational visibility so we can answer: "Did this cleanup break the product path in production?"

Execution summary:

- Added a shared structured log event contract in `packages/ck-contracts/src/observability.ts`.
- Standardized the request ID header as `x-request-id`.
- Adapted Roma, Berlin, Tokyo-worker, Venice, and San Francisco to emit structured request logs through service-owned adapters.
- Propagated request IDs across Roma -> Berlin, Roma -> Tokyo product/asset control, Roma -> San Francisco, Venice -> Tokyo, and Tokyo-worker response boundaries.
- Preserved fail-fast behavior; no recovery paths, fallback product modes, auth tokens, capsules, cookies, secrets, widget private config, or customer PII were added to observability payloads.

## 2. Intended Scope

Draft scope:

- Sentry or equivalent error reporting for the active product-path services.
- Request ID propagation across Roma, Berlin, Tokyo-worker, Venice, and San Francisco where product-path calls cross service boundaries.
- Named boundary logs for auth/session, Roma-to-Tokyo calls, Tokyo-worker instance transitions, Venice public embed failures, and San Francisco agent calls.
- Venice-specific visibility for public runtime failures: loader mount failure, iframe boot/render failure, artifact read failure, SEO/GEO metadata failure, and cache/header regressions.
- A shared structured log event shape, preferably in `ck-contracts`, plus tiny service-owned logger adapters.
- A small verification checklist proving errors include service, route/boundary, request ID, and reason key where applicable.

## 3. Non-Goals

- No generic observability platform.
- No tracing theory.
- No dashboard buildout unless required to verify product-path failures.
- No PRD 096 cleanup work.
- No PRD 097 Venice runtime redesign work.
- No business analytics.
- No customer behavior instrumentation.
- No new observability package unless the dependency graph proves it is necessary.

## 4. Architecture Constraints

- Observability must not weaken auth boundaries or expose raw tokens, capsules, PII, or widget private config.
- Logs must describe named product boundaries, not invent new product concepts.
- Error reporting must preserve fail-fast behavior; it must not turn failures into recoveries or fallbacks.
- Request IDs are correlation metadata only, not product state.
- Shared code should define event shape, not runtime-specific logging behavior. Do not put SDK-specific dependencies, service env assumptions, or platform globals into `ck-contracts`.
- Each service owns its small adapter for its runtime and provider.
- Create `ck-observability` only if the dependency graph demands it; do not create it for theoretical cleanliness.
- Venice public-path observability must be extremely careful: never log raw customer page URLs with sensitive query strings, raw widget private config, auth material, or visitor PII.
- Host-page diagnostics must be opt-in/debug-gated; customer consoles must stay quiet by default.

## 5. Draft Acceptance Shape

Executed acceptance:

- Services covered: Roma, Berlin, Tokyo-worker, Venice, San Francisco, plus shared `ck-contracts`.
- Canonical request ID header: `x-request-id`.
- Shared event fields: service, stage, requestId, boundary, method, path, status, durationMs, visibility, cfRay, reasonKey/detail where applicable, and bounded entity IDs where already part of the product boundary.
- Service adapters remain local to each runtime. `ck-contracts` owns only shape, serialization, and request-id normalization.
- Venice records public route boundaries without host-page console output changes or PRD 097 runtime redesign.
- San Francisco records AI request boundaries and uses the server request ID as the execution request ID.
- Roma forwards request IDs through current-account product calls, Berlin proxy/product reads, Tokyo product/asset calls, locale/translation/storage paths, and copilot execution.

Verification evidence:

- `corepack pnpm --filter @clickeen/ck-contracts typecheck` - green
- `corepack pnpm --filter @clickeen/roma typecheck` - green
- `corepack pnpm --filter @clickeen/berlin typecheck` - green
- `corepack pnpm --filter @clickeen/tokyo-worker typecheck` - green
- `corepack pnpm --filter @clickeen/venice typecheck` - green
- `corepack pnpm --filter @clickeen/sanfrancisco typecheck` - green
- `corepack pnpm --filter @clickeen/roma lint` - green
- `corepack pnpm --filter @clickeen/ck-contracts lint` - green
- `corepack pnpm --filter @clickeen/ck-contracts test` - green
- `corepack pnpm build:widgets:check` - green

Workspace note:

- The earlier local Corepack issue was resolved by enabling the bare `pnpm` shim. `pnpm install` now runs the Dieter prepare lifecycle successfully.

## 6. Relationship To PRD 096

PRD 095 should land before or alongside the higher-risk PRD 096 sub-PRDs if those sub-PRDs cannot be confidently verified with local checks and product-path smoke alone.

PRD 095 should also land before or alongside PRD 097 implementation slices that change Venice SSR, loader behavior, cache policy, or SEO/GEO delivery.

PRD 096B and PRD 096F specifically wait for PRD 095 because they need Roma-to-Tokyo runtime visibility and structured boundary logging.
