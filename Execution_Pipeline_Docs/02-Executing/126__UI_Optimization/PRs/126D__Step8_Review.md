# 126D Step 8 - Exact-Tree Peer Review

Status: GREEN.
Reviewed tree: `31b81152` (`docs(126D): close exact execution proof gaps`).
Review date: 2026-07-15.

This is pre-execution evidence only. It approves the 126D Step-7 plan for later
Step-9 execution after every 126A-126M domain completes Step 8. It grants no
product-code, deploy, managed-service, or product-data execution credit.

## Independent Lenses

| Lens | Result | What was attacked |
| --- | --- | --- |
| Product truth | GREEN | Bob manual/Copilot and Roma Widget Defaults transitions, exact rejection copy, unchanged state/dirty/Undo/outcome on failure, role-aware controls, and Save/reload proof. |
| Architecture and V1-V8 | GREEN | One widget-shell resolver/validator, Dieter intent-only presentation, account-independent compilation, account-bound Bob/Roma validation, owning instance-package boundary, and no duplicate font policy. |
| Code and deploy | GREEN | Exact file/call ordering, ToolDrawer/Copilot mapping, server-side pre-materialization validation, eight-client AST parity, focused tests, canonical R2 keys, both Cloudflare preflights, Pages SHAs, and selected-instance rematerialization. |

## Findings Closed Before Green

- Replaced Bob-only font handling with one account-font transition and
  relational-validation authority consumed by Bob, Roma Widget Defaults, and
  Roma instance package materialization.
- Removed Dieter's duplicate companion-selection policy from the execution
  design; Dieter emits only the user's requested family value.
- Made family changes explicit family/weight/style operations and required
  deterministic rejection without hidden persisted-state repair.
- Added Roma shell/core defaults edit, GET/PUT, test, deploy, and authenticated
  product verification to the blast radius.
- Carried typography role labels into compiled control metadata so Copilot sees
  the product role instead of an ambiguous generic field label.
- Required identical product rejection copy in manual Bob, Copilot, and Roma,
  with unchanged document/dirty state, no Undo, and no success telemetry.
- Added server-side instance-package validation before asset resolution,
  materialization, or Tokyo save, with exact 422 paths and no package update.
- Kept shared/widget runtime JavaScript unchanged; build validation reads each
  actual widget client's role map and compares it with composed spec roles.
- Corrected deploy proof to use the canonical `dieter/**` R2 coordinate, both
  Cloudflare preflights, exact R2 read-back, and exact-SHA `bob-dev`/`roma-dev`
  Pages evidence.
- Reconciled normal Bob Save truth: the selected smoke instance is
  rematerialized; no bulk or unsolicited package regeneration is authorized.

## V1-V8 Result

All eight controls pass at reviewed tree `31b81152`. Missing or invalid font
truth fails explicitly; no value is invented or silently repaired; both editor
hosts and the owning save boundary use one authority; rejection cannot
masquerade as an applied edit; and tests remain verification rather than runtime
dependencies.
