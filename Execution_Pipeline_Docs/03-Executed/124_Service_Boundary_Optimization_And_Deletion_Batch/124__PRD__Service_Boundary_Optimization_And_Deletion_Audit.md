# PRD 124 - Service Boundary Optimization And Deletion Audit

Status: EXECUTED
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

## Execution Ledger

This ledger is the current execution truth for PRD 124. A subPRD stays in
`02-Executing` until every completion gate in that subPRD is satisfied.

| PRD | Status | Done | Open |
| --- | --- | --- | --- |
| 124A Berlin | Executed | BER-01 through BER-12 are complete and independently verified. Berlin invitation acceptance is login-time RPC flow, account deletion is explicit conflict/no mutation, locale mutation moved to Roma, publish containment and runtime E2E session minting were deleted, profile/bootstrap legacy fields were removed, dead render/link/doc residue was deleted, Supabase row/list payloads fail closed, and corrupt ticket state no longer masquerades as missing. | None. 124A moved to `03-Executed`. |
| 124B Bob | Executed | BOB-01 through BOB-08 are complete. BOB-06 closure made malformed widget software fail in existing Bob compiler/control paths for presets, JSON attrs/options, show-if, and linked ops. | Final V1-V8 closure audit passed. |
| 124C Roma | Executed | RMA-001 through RMA-013 are complete and independently verified. Roma no longer invents page locale/country defaults, renders generic Widget Defaults fallback editors, owns widget-specific Core schemas, reports malformed asset/delete upstream success, silently falls back to Bob origin, exposes runtime E2E session minting, traverses pages/instances for storage relationship checks, owns duplicate widget metadata maps, carries a duplicate Tokyo client wrapper, performs broad locale-lock inventory reads, or reports visible delete success on absence/corruption. | None. 124C moved to `03-Executed`. |
| 124D Tokyo product roots | Executed | TOKYO-R2-001 aligned non-Prague R2 sync triggers for `tokyo/roma/**`; TOKYO-R2-002 deleted dead `tokyo/_redirects`; TOKYO-R2-003 deleted dead `tokyo/accounts` fixture root and added the existing PR architecture gate check against reintroduction; TOKYO-R2-004, TOKYO-R2-005, and TOKYO-R2-006 are recorded as completed historical Prague cleanup before the scope correction; TOKYO-R2-007 deleted dormant `tokyo/product/media/brand/**` and removed the `product/media` sync root; TOKYO-R2-008 deleted legacy PRD 106/107 direct account R2 repair/audit scripts and removed the exposed `audit:106` closure ritual. | Final V1-V8 closure audits passed. TOKYO-R2-009 and remaining Prague/page work are deferred to the planned Prague/page-composer sequence. |
| 124E Tokyo-worker | Executed | TW-01 public internal-route exposure is closed and verified. TW-03/TW-08 corrupt registry, persisted JSON, overlay, serve-state, translation ledger, and translated-locale reads now fail closed. TW-09 asset upload has explicit Roma policy headers and Tokyo byte/storage preconditions. TW-11 stale `website/serving-policy.json` documentation was deleted. TW-12/TW-13/TW-14/TW-15 deleted dead duplicate route/reason key, unused KV binding/type, unused helpers, and full-byte page readiness reads. | TW-02, TW-04, TW-05, TW-06, TW-07, and TW-10 were split to PRD 125 because they require product authority decisions before code execution. |

Recent execution commits:

| Commit | Scope |
| --- | --- |
| `758bc5db` | PRD 124 critical boundary cleanup across Berlin/Roma/Tokyo-worker. |
| `b2d399a5` | PRD 124B Bob authority cleanup. |
| `1092a023` | Over-scoped Bob strictness pass; superseded by correction. |
| `4d9c52d0` | Corrected PRD 124B strictness drift, moved 124B back to executing, and left BOB-06 open. |
| `0d4fcf79` | Executed PRD 124B BOB-06 compiler/control strictness and moved 124B to executed. |

Execution tenet:

It is prohibited to reinterpret a PRD finding into an ideal system and then add
machinery to enforce that interpretation. PRD 124 execution is deletion first:
remove dead paths, wrong-service authority, duplicate truth, and silent fallback
behavior at the named product boundary.

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

## Closure

2026-06-17: PRD 124 is executed. SubPRDs 124A, 124B, 124C, 124D, and 124E
are in `03-Executed`. Remaining Tokyo-worker authority migrations were split to
PRD 125 with explicit owner, scope, and no active claim of completion inside
PRD 124.
