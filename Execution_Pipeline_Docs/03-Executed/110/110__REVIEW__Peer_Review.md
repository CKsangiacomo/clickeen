# Peer Review - PRD 110 (Toxic Flow Deletion)

Review date: 2026-06-18
Basis: `110__PRD__Toxic_Flow_Deletion.md`, peer reviews A and B,
`documentation/architecture/CONTEXT.md`, `AGENTS.md`, executed PRD status
headers, and direct reads of the current Roma/Bob/Tokyo/Prague tree.

## Verdict

Retire PRD 110. Do not execute it.

PRD 110's deletion scope is already superseded by executed work in the
112/112A-E + 113 batch, with supporting cleanup from 106/107. Its ledger is
empty because the toxic paths it was meant to delete are already gone.

Retiring 110 does not mean Page Composer is complete. Page Composer has live
Roma work still open: publish, publish gating, stale/failed recompose state,
page tier caps, and page tests. That work must be carried forward under the
Roma/Page Composer authority, not hidden inside a retired deletion PRD.

Prague block removal is not 110 work. PRD 121 owns the Prague migration and any
route-by-route block deletion or fence lift.

## Product-Law Read

The system truth remains:

- Widgets are software in the system.
- Users create widget instances in Roma/Bob and save them in their account in
  Tokyo.
- Pages are stacks of saved account instances that live in Tokyo.
- Bob edits one widget instance in browser memory. User save is the persistence
  boundary.
- Roma routes the user to the account, enforces tier, and saves account work.
- Tokyo-worker stores and serves account runtime bytes in R2.
- Admin is a normal `CLICKEEN` account using the same product paths.

Against that truth, PRD 110 is no longer an executable PRD. It is a historical
cleanup plan whose deletion targets have been removed or moved to the correct
surviving authority.

## What Is Done

| 110 Target | Current Evidence | Result |
| --- | --- | --- |
| `accounts/{account}/website/pages` | `rg` over Roma/Tokyo/Bob | Gone |
| `accounts/{account}/website/publishes` | `rg` over Roma/Tokyo/Bob | Gone |
| `accounts/{account}/website/indexes` | `rg` over Roma/Tokyo/Bob | Gone |
| Route-generated page `embed.js` | `rg` over Roma/Tokyo/Bob | Gone |
| Bob `publicPackage` save authority | `rg 'publicPackage' bob` | Gone |
| Roma materialization parity | `roma/lib/account-instance-public-package.ts` exists | Present |
| Tokyo page summary/product derivation | direct Tokyo page-domain read | Removed from Tokyo authority |
| Tokyo pages as storage boundary | direct Tokyo page-domain read | Storage-only shape |
| 112/112A-E status | executed PRD headers | Executed |
| 113 status | executed PRD header | Executed |

This is the deletion half of 110. It is complete.

## What Is Not Done

These items are not reasons to keep 110 open. They are surviving Page Composer
product work and must stay visible under Roma/Page Composer ownership.

| Open Product Work | Current Evidence | Correct Owner |
| --- | --- | --- |
| Page publish | `roma/app/api/account/pages/[pageId]/publish/route.ts` returns an unconditional 422 stub | Roma/Page Composer |
| Publish gating on unpublished instances | Unreachable while publish is stubbed | Roma/Page Composer |
| Stale/failed recompose state after instance changes | Serve-state vocabulary is still only `published` / `unpublished` | Roma/Page Composer |
| Page tier caps | Account policy exists, but page-count caps are not wired | Roma/Page Composer |
| Page-source and page-policy tests | No focused Roma page tests found | Roma/Page Composer |

This is the addition half that Review A correctly caught. Review B is right
that 110 must retire, but Review A is more correct about the product risk: the
team must not read "110 is retired" as "Page Composer is done."

## Prague Scope

Prague block work belongs to PRD 121.

Current Prague block files can remain while PRD 121 is still draft and routes
have not migrated. Deleting them through 110 would create duplicate authority
and risk route breakage. PRD 121 must own each route cutover, each block
deletion, and each fence lift.

## Review Findings

| ID | Severity | Finding | Action |
| --- | --- | --- | --- |
| R110-1 | Blocker | PRD 110 deletion targets are already gone or superseded by executed PRDs | Move 110 out of active planning. Do not execute |
| R110-2 | Major | Retiring 110 can hide unfinished Page Composer work if the closeout says "target reached" without qualification | Carry the open Roma/Page Composer items forward before archive |
| R110-3 | Major | Prague block deletion is duplicated authority between 110 and 121 | Remove Prague from 110 closure; 121 owns it |
| R110-4 | Minor | 110 uses a custom toxic taxonomy beside the canonical V1-V8 product-law violations | Do not preserve the forked taxonomy as current guidance |
| R110-5 | Minor | 110 contains process-heavy ledger and fence templates for work already done | Do not fill the ledger retroactively |
| R110-6 | Minor | 110 identity drifts into older PRD106E wording | Treat as historical drift, not a live execution document |

## Correct Closure

1. Move PRD 110 to `03-Executed/` as historically superseded.
2. Add a short closeout header saying deletion scope was executed by
   112/112A-E + 113, with supporting 106/107 cleanup.
3. State explicitly that PRD 110 is not the owner of remaining Page Composer
   product work.
4. Carry these open Roma/Page Composer items forward:
   - page publish;
   - publish gating for unpublished instances;
   - stale/failed recompose state;
   - page tier caps;
   - focused page tests.
5. State explicitly that Prague migration and block deletion remain PRD 121.
6. Do not fill 110's deletion ledger, add 110-specific CI guards, or execute
   no-op deletion work.

## Final Judgment

Advisor A gives the better product review because it separates deletion
completion from surviving Page Composer completion. Advisor B gives the cleaner
process review because it correctly rejects executing a dead PRD and calls out
the meta-work. The canonical decision is:

```text
Retire 110.
Do not execute 110.
Carry unfinished Page Composer work under Roma/Page Composer.
Keep Prague block migration under 121.
Do not preserve 110's duplicate taxonomy, ledger, or search-guard machinery.
```
