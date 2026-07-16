# 126E Step 8 - Exact-Tree Peer Review

Status: GREEN.
Reviewed tree: `ec1ed486` (`docs(126E): limit D3 to existing upgrade commands`).
Review date: 2026-07-15.

This is pre-execution evidence only. It approves the 126E Step-7 plan for later
Step-9 execution after every 126A-126M domain completes Step 8. It grants no
product-code, deploy, managed-service, or product-data execution credit.

## Independent Lenses

| Lens | Result | What was attacked |
| --- | --- | --- |
| Product truth | GREEN | D3 scope, honest pre-GA destination, preserved unsaved Builder work, ordinary Billing navigation, Assets exclusion, and no fake commercial operation. |
| Architecture, cohesion, and V1-V8 | GREEN | 126E/126K/126M ownership, route-owned 402 enforcement, no global store/framework, no data or infrastructure mutation, and exact violation controls. |
| Code, blast radius, and tests | GREEN | Both existing Upgrade paths, exact later deletions, Assets absence of an Upgrade command, no-touch files, negative old-test evidence, and future browser assertions. |

## Finding Closed Before Green

The first review cycle found contradictory historical wording that said Assets
must converge with the two existing Upgrade commands while the executable map
correctly preserved Assets. The PRD and audit now state the accepted product
decision precisely: D3 applies only to the existing Widgets `Upgrade` command
and Bob's typed `bob:upsell` intent. Assets currently has explicit limit/error
copy but no Upgrade command; 126E does not invent one. A future Assets Upgrade
entry requires separate product law.

## Exact Approved Result

- 126E owns interaction meaning and has no product-code write set.
- 126K owns dialog lifecycle and same-layer transition mechanics.
- 126M owns one Roma scaffold plus the Widgets and Bob-host transitions.
- Widgets stops linking its Upgrade action to `/billing`.
- The `bob:upsell` branch stops invoking the discard guard and stops navigating
  to `/billing`; real navigation retains discard protection.
- Route/policy 402 enforcement and ordinary current-plan Billing navigation
  remain unchanged.
- Assets upload, limit, and failure behavior remain unchanged.

## Verification Evidence

- `pnpm --filter @clickeen/bob test:translations-panel` - passed.
- `pnpm --filter @clickeen/roma test:widget-command-gates` - passed; its old
  Bob-to-Billing assertion is recorded as negative evidence and scheduled for
  replacement by 126M.
- `pnpm --filter @clickeen/bob typecheck` - passed in independent review.
- `pnpm --filter @clickeen/roma typecheck` - passed in independent review.

## V1-V8 Result

All eight controls pass at reviewed tree `ec1ed486`. Product truth is not
invented or silently repaired; both existing Upgrade commands remain visible;
route enforcement remains authoritative; old Billing routing is deleted rather
than renamed; Assets is not masqueraded as a third upsell flow; and tests remain
verification rather than runtime dependencies.
