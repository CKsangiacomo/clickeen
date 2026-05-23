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

The PRD 89 schema hard cut drops the historical `widget_instances` residue. Product code must not recreate a Michael widget-instance table for Builder, Widgets, public serving, or Prague embeds.

## Account Truth

Michael remains appropriate for:

- account/user identity rows
- compact account product IDs (`accounts.public_id`)
- membership and governance records
- usage/billing records
- audit/support/reporting queries
- migrations and RLS-owned relational data

Tokyo remains appropriate for:

- account assets under `accounts/{accountPublicId}/assets/`
- account instance documents under `accounts/{accountPublicId}/instances/`
- account-scoped published projection bytes under `accounts/{accountPublicId}/instances/{instanceId}/published/`
- account-instance l10n overlays

## Pre-GA Rule

Do not add new widget-instance product behavior to Michael. The surviving product path is Roma -> Bob -> Tokyo.

## PRD 098 Account Identity

`accounts.id` remains the private relational UUID. `accounts.public_id` is the first-class account product/storage identity:

- format: exactly 8 uppercase base36 characters (`^[0-9A-Z]{8}$`)
- unique and not nullable
- minted with secure random bytes by Berlin on new account creation
- backfilled once for existing pre-GA accounts
- never derived from `accounts.id`

Overlay IDs use `accountPublicId`, not the relational UUID.

PRD 099 extends that same boundary to account runtime storage: Tokyo/R2 account folders, account asset manifests, account asset URLs, account instance paths, and published projection paths must use `accountPublicId`, never `accounts.id`. Michael may keep private UUIDs for relational joins, RLS, billing/support records, audit, and account governance, but it must not become a second account-asset or widget-instance storage authority.

Migration and cleanup reports may mention historical UUID R2 keys only as stale source material. Deleting those keys requires a dry-run report, an object-level restore manifest, and a rollback rehearsal on local/dev R2 before remote deletion.
