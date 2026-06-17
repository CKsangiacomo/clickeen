# PRD 124 - Service Boundary Optimization And Deletion Audit

Status: EXECUTING
Owner: Product architecture
Date: 2026-06-17
Stage: 02-Executing
Type: Audit-to-deletion batch

## Purpose

Convert the service-boundary audit into executable deletion and optimization
work, without preserving wrong behavior under new names.

This batch covers:

- Berlin
- Bob
- Roma
- Tokyo product roots
- Tokyo-worker

The goal is not to "clean around" drift. The goal is to identify redundant
workflow, dead paths, unnecessary code, legacy files, and wrong-service
authority, then delete or move them to the owning boundary.

## Product Truth

```text
Widgets are software and live in the system.
Users create widget instances in Roma/Bob and save them in their account in Tokyo.
Pages are stacks of instances that live in Tokyo.
Bob is an editor. Opens and edits are browser-memory work. User save is persistence.
Tokyo is responsible for R2/storage.
Roma is the app. Roma routes the user to their account, enforces tier/account policy, and saves what the user does.
Clickeen uses Clickeen. Admin is a normal account using Clickeen widgets, assets, pages, and product routes.
Berlin owns authentication and account session/bootstrap.
```

## Core Violations

Every finding and execution step must be checked against:

| ID | Violation |
| --- | --- |
| V1 | Silent substitution |
| V2 | Silent healing |
| V3 | Silent omission |
| V4 | Fail-open control |
| V5 | Corruption-as-absence |
| V6 | Partial-success masquerade |
| V7 | Masquerade/redress |
| V8 | Runtime test dependency |

## Execution Law

- If a path is wrong-service authority, remove it or move it to the owner.
- If a path is dead, delete it.
- If a path is legacy but still active, either execute the replacement or stop
  at an explicit blocker. Do not leave an active legacy path renamed as
  "compatibility".
- If external consumers are unproven, execution must prove them through the
  owning runtime/deploy surface before deleting. A lack of repo callers is
  evidence, not final proof.
- No warning-only gates.
- No hidden fallbacks.
- No runtime dependency on tests, probes, or validation rituals.
- Docs update with the execution that changes behavior.

## SubPRDs

| PRD | Service | Purpose |
| --- | --- | --- |
| 124A | Berlin | Keep Berlin to auth/session/bootstrap and delete/extract account-management residue. |
| 124B | Bob | Keep Bob to browser-memory editing and delete/move account/product authority. |
| 124C | Roma | Keep Roma to current-account app orchestration and remove fallbacks/duplicate product logic. |
| 124D | Tokyo product roots | Keep Tokyo roots to git-authored deploy artifacts and delete stale roots/assets/scripts. |
| 124E | Tokyo-worker | Keep Tokyo-worker to storage/serving and delete/move product-policy/composition authority. |

## Service Boundary Matrix

| Service | Owns | Must Not Own |
| --- | --- | --- |
| Berlin | Auth, provider identity mapping, sessions, bootstrap, signed account authz capsule | Product settings workflows, R2 cleanup, publish/materialization state, editor persistence, connector authorization |
| Bob | One in-browser editor session, controls, preview, edit ops, save intent | Account identity, account policy, account asset routes, publish truth, public package authority |
| Roma | Current-account app, tier/account policy, same-origin product APIs, Builder host, save/upload/page commands | Berlin auth truth, Tokyo storage semantics, Bob editor semantics, widget-specific Core schemas, invented fallbacks |
| Tokyo roots | Git-authored static artifacts deployed to R2 | Runtime account data, admin bypass lanes, fixture accounts, direct R2 repair paths |
| Tokyo-worker | R2 account storage, byte safety, static artifact serving | Account policy, tier policy, composition semantics, translation orchestration policy, fallback/healing |

## Execution Order

1. Fix critical fail-open or partial-success paths:
   - Tokyo-worker internal write auth.
   - Berlin invitation/account binding.
   - Berlin account deletion route.
   - Roma asset delete success validation.
   - Roma Builder Bob-origin fallback.
   - Bob direct account asset proxy.
2. Delete/move wrong-service product authority:
   - Berlin account-management residue.
   - Bob embed/account/workspace authority.
   - Roma widget-specific Core schema logic.
   - Tokyo-worker page/instance composition logic.
3. Delete dead and legacy surfaces:
   - Berlin dead bindings/link flow/docs.
   - Bob tracked generated Dieter artifacts and unused native UI/export surface.
   - Tokyo stale roots and legacy PRD repair scripts.
   - Tokyo-worker dead duplicate route, unused binding, unused helpers.
4. Optimize expensive or broad product operations only after ownership is clean:
   - Roma/Tokyo page placement checks.
   - Roma account facts/count checks.
   - Tokyo page package file existence checks.
5. Update active docs and run V1-V8 verification with subagents before moving
   any subPRD to `03-Executed`.

## Closure Criteria

PRD 124 closes only when each subPRD is either:

- executed and moved to `03-Executed`; or
- split into a newer numbered PRD with explicit owner, blocker, and no active
  claim of completion.

The parent cannot close while an active finding is merely renamed, hidden,
warning-only, or left as "legacy continuity" in a product path.

