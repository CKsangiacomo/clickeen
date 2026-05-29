# EXEC 103_DB.7 Publish Materialization Bridge

Status: Executed historical evidence / green runtime slice; surviving doctrine extracted to PRD 105C; superseded by PRD 105, 105A, 105B, and 105C where conflicting
Date Started: 2026-05-22
Date Completed: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.7 - Publish/materialization bridge`

Archive note: this document is no longer active execution authority. It is retained as evidence for publish/materialization boundary cleanup.

## Slice Intent

Publish state and public serving are two different product concerns.

The approved V1 model is:

- `instances.publish_status` is the product publish state/intent;
- public browser traffic reads materialized R2 artifacts only;
- app/product services do not infer authoring state from generated public files;
- public serving does not hit Supabase on visitor requests;
- billing/tier containment changes the materialized public output without rewriting the user's publish intent.

This keeps the database in the operational path and R2/CDN in the public serving path.

## Runtime Changes

- `clk.live` serving now reads the requested generated browser artifact directly from R2.
- `clk.live` no longer reads `instances.publish_status` on visitor traffic.
- Publish still materializes public files from Tokyo-owned instance state and then writes `instances.publish_status = published`.
- Unpublish now removes generated public files and writes `instances.publish_status = unpublished`.
- Public generated file matching is shared through Tokyo's public artifact module so the route and cleanup operation use the same allowlist.
- Materialization writes versioned support files before entry HTML and swaps `index.html` last.
- Tokyo now exposes named serving materialization operations:
  - `applyFreeTierServing(accountId)`;
  - `restorePaidTierServing(accountId)`.

## Serving Policy Operations

`applyFreeTierServing`:

- reads published instance rows for the account;
- resolves the free published-instance limit from `ck-policy`;
- rematerializes the published instances allowed by the free policy;
- removes public artifacts for published instances outside the free policy;
- does not change `instances.publish_status`.

`restorePaidTierServing`:

- reads published instance rows for the account;
- rematerializes public artifacts for every published instance;
- does not change `instances.publish_status`.

This means a suspended/downgraded account can have fewer public artifacts served while the product still remembers which instances the user had published.

## Decision

File presence is not product publish state. The product publish state is the instances table.

R2 file presence is only the materialized serving result. That is acceptable because the public route is not asking "is this published?" It is serving an already-materialized browser artifact if one exists at an allowed public key.

## Verification

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`

Current targeted proof:

- public `clk.live` route works without Supabase registry state;
- publish writes versioned support files before public entry HTML;
- unpublish deletes generated public artifacts;
- `applyFreeTierServing` disables public output beyond free policy without rewriting `instances.publish_status`;
- `restorePaidTierServing` rematerializes all published public output;
- generated public artifact allowlisting is shared between serving and cleanup.

## Green Readout

The publish/materialization bridge is now operation-shaped:

- Supabase owns product publish state.
- R2 owns served artifacts.
- Visitor traffic does not query Supabase.
- Billing/tier serving containment is a materialization operation, not a publish-state rewrite.
