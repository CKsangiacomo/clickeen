# System: Michael - Supabase Data Plane

STATUS: REFERENCE - ACCOUNT DATA ONLY

Michael is Supabase/Postgres. It owns relational account data such as accounts, users, billing/support records, usage events, and other queryable product records.

Michael does not own widget instance storage.

## Widget Instance Boundary

Active widget instance truth lives in Tokyo:

- inventory
- instance IDs
- display names
- saved config
- publish state
- l10n overlays
- runtime published bytes

The PRD 89 schema hard cut drops the historical `widget_instances` residue. Product code must not recreate a Michael widget-instance table for Builder, Widgets, Venice serving, or Prague embeds.

## Account Truth

Michael remains appropriate for:

- account/user identity rows
- membership and governance records
- usage/billing records
- audit/support/reporting queries
- migrations and RLS-owned relational data

Tokyo remains appropriate for:

- account assets
- account widget instance documents
- published widget lookup/bytes
- account-instance l10n overlays

## Pre-GA Rule

Do not add new widget-instance product behavior to Michael. The surviving product path is Roma -> Bob -> Tokyo.
