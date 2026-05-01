# PRD 073 — Audit-Driven Architecture Upleveling and Simplification

Status: EXECUTED
Date: 2026-03-18
Closure reviewed: 2026-04-30
Owner: Product Dev Team
Priority: P0 (operational readiness + simplification)
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`
- `072__PRD__Roma_Boring_SaaS_Shell__Current_Account_Truth_And_Direct_Product_Flows.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`

Audit inputs:
- 4-tenet audit findings, folded into this executed PRD (2026-03-17)
- Staff-engineer-level repo traversal audit provided inline by the human (2026-03-17)
- Executive-view / blast-radius / scale-risk audit provided inline by the human (2026-03-17)

---

## Executed Intent

PRD 073 normalized architecture-audit findings after the large product-boundary cleanup.

The job was not to invent a new architecture. The job was to make the current one more boring:
- Berlin remains auth/session truth.
- Roma remains account product shell and product backend.
- Tokyo/Tokyo-worker own saved config, assets, localization artifacts, render snapshots, and public payload assembly.
- Venice remains a thin public runtime/proxy consumer.
- Paris does not re-enter the active account authoring path.

Audit findings were sorted into four buckets:
1. valid and executed
2. valid but deferred to later PRDs/backlog
3. stale because the architecture had already moved
4. rejected because they would reopen closed owner boundaries or add sludge

---

## What Changed

The accepted PRD 073 scope landed as reduction and hardening work:

- DevStudio's local widget-authoring workspace path was removed.
- Berlin and Roma account/auth mutation paths gained a more explicit operational floor.
- Listing paths moved away from hidden hard-cap assumptions where this PRD touched them.
- Wildcard CORS drift was constrained away from account-scoped authenticated routes.
- Roma gained explicit client-side error boundaries around product/domain surfaces.
- `roma/lib/michael.ts` was reduced to a thin barrel, with domain work moved into smaller modules.
- `tokyo-worker/src/index.ts` was reduced to a small request shell plus queue handoff.
- Tokyo-worker route families moved into route/domain modules.
- Tokyo account localization was split out of the old single mixed implementation.
- Roma's Cloudflare ambient request context was narrowed and documented as an edge binding/stage escape hatch, not normal product truth.
- Root debug leftovers named by the PRD were removed from versioned repo state.
- Architecture docs were corrected where they still implied stale Paris/top-level product ownership.

Current checked state:
- `tokyo-worker/src/index.ts` is `42 LOC`.
- `roma/lib/michael.ts` is `9 LOC`.
- `roma/lib/cloudflare-request-context.ts` is `42 LOC` and documents its narrow retained purpose.
- `.tmp` exists only as untracked local residue, not versioned repo state.

---

## Honest Verification State

This closure record intentionally removes PRD 073's earlier overclaim that a broad cross-service contract-test floor is fully wired into root `pnpm test`.

Current repo truth:
- Root `pnpm test` is `turbo test`.
- Several key product services are present in the Turbo test graph, but do not define a real package-level `test` command.
- Therefore PRD 073 must not claim full Berlin/Roma/Tokyo-worker/Venice contract coverage as executed proof.

What is true:
- The structural simplification goals were executed.
- The owner-boundary cleanup goals were preserved.
- The PRD's stale audit findings were normalized instead of executed literally.
- Runtime verification for later work must use the actual targeted checks owned by each follow-on PRD.

Future contract-test expansion should be opened as a focused PRD or attached to the specific product-path PRD that changes behavior. It should not be hidden inside this already-executed audit-normalization closure.

---

## Closed Backlog Item

`EB-009` from `Execution_Pipeline_Docs/01-Planning/EVERGREEN_BACKLOG.md` was promoted into PRD 073 and is now closed by the Tokyo-worker localization split/reduction already present in the codebase.

No open PRD 073 item remains in the active backlog.

---

## Remaining Non-Goals

PRD 073 did not and should not:
- reopen the Roma/Berlin/Tokyo ownership model
- recreate Roma save aftermath orchestration
- make Tokyo-worker a second entitlement engine
- rename city-named services
- create a broad testing initiative disconnected from the current product path
- grow Paris into a product-path service again
- preserve old and new flows side by side

---

## Closure Decision

PRD 073 is executed.

The correct action is documentation hygiene, not runtime code work:
- keep this PRD in `03-Executed`
- keep follow-on product-path simplification in later PRDs
- do not use stale PRD 073 test-language to claim coverage that the repo does not prove
