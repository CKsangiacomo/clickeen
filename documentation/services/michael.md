# Michael — Database (Supabase)

Michael is Clickeen’s **minimal** persistence layer. It stores exactly what we need to edit and serve widget instances, and nothing else.

## Authority

The schema is defined by:
- `supabase/migrations/20251228000000__base.sql`
- `supabase/migrations/20260117090000__curated_widget_instances.sql`
- `supabase/migrations/20260118090000__widget_instances_user_only.sql`
- `supabase/migrations/20260216120000__widget_instances_display_name.sql`
- `supabase/migrations/20260213160000__accounts_asset_domain_phase0.sql`
- `supabase/migrations/20260304090000__account_only_tenancy.sql`

If this document conflicts with those files, the SQL wins.

## What Michael Stores (and only this)

### `widgets`
One row per widget type (e.g. FAQ).

Core columns:
- `id` (uuid) — internal
- `type` (text) — widget type slug (e.g. `faq`)
- `name` (text) — human label

### `widget_instances`
One row per **user instance**. This is the canonical config state tree for account-owned data.

Core columns:
- `id` (uuid) — internal (never exposed outside DB/services)
- `widget_id` (uuid) — FK to `widgets.id`
- `account_id` (uuid) — FK to `accounts.id` (instances are account-owned)
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `display_name` (text, nullable) — account-facing instance label (defaults to `public_id` when missing)
- `kind` (text) — `user` (curated/baseline live in `curated_widget_instances`)
- `status` (text) — `published` | `unpublished`
- `config` (jsonb) — required object

Guardrails:
- `widget_instances_user_public_id_only` constraint (NOT VALID) blocks new `wgt_main_*` / `wgt_curated_*` writes.

### `curated_widget_instances`
One row per **Clickeen-authored** instance (baseline + curated).

Core columns:
- `id` (uuid) — internal (never exposed outside DB/services)
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `widget_type` (text) — denormalized widget type (validated against Tokyo registry at write time)
- `kind` (text) — `baseline` | `curated`
- `status` (text) — `published` | `unpublished`
- `owner_account_id` (uuid) — FK to `accounts.id` (curated rows are owned by the single admin account, `ADMIN_ACCOUNT_ID`)
- `config` (jsonb) — required object

### `accounts`
Canonical account identity table used for ownership and upload metering.

Core columns:
- `id` (uuid) — canonical account identity (opaque ID)
- `status` (text) — `active` | `disabled`
- `is_platform` (boolean) — platform-owned account marker
- `tier` (text) — `free` | `tier1` | `tier2` | `tier3`
- `name` (text)
- `slug` (text, unique)
- `website_url` (text, nullable) — account setting used by Copilot/personalization context
- `l10n_locales` (jsonb, nullable) — account **active locales** (non‑EN; EN is implied)
- `l10n_policy` (jsonb, nullable) — account locale policy (baseLocale + ip/switcher)
- `created_at`, `updated_at` (timestamptz)

Seeded platform account:
- `ADMIN_ACCOUNT_ID = 00000000-0000-0000-0000-000000000100` (`is_platform=true`)

### `account_members`
One row per user membership (roles).

Core columns:
- `account_id` (uuid) — FK to `accounts.id`
- `user_id` (uuid) — FK to `auth.users.id`
- `role` (text) — `viewer` | `editor` | `admin` | `owner`

### `account_assets`
Logical metadata for uploaded account-owned assets.

Core columns:
- `asset_id` (uuid) — logical asset identity
- `account_id` (uuid) — FK to `accounts.id` (ownership key)
- `source` (text) — `bob.publish|bob.export|devstudio|promotion|api`
- `original_filename`, `normalized_filename`, `content_type` (text)
- `size_bytes` (bigint)
- `sha256` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

Notes:
- `public_id/widget_type` are nullable provenance columns (upload/source context), not ownership/read gates.
- New usage truth lives in `account_asset_usage` (below).

### `account_asset_variants`
Physical storage mapping for account asset variants (for example `original`, and future optimized variants).

Core columns:
- `asset_id` (uuid) + `account_id` (uuid) — FK pair to `account_assets`
- `variant` (text)
- `r2_key` (text, unique)
- `filename`, `content_type` (text)
- `size_bytes` (bigint)
- `created_at` (timestamptz)

### `account_asset_usage`
Canonical "where used" mapping between account-owned assets and instance config paths.

Core columns:
- `account_id` (uuid)
- `asset_id` (uuid)
- `public_id` (text) — instance identity (`wgt_*`)
- `config_path` (text) — deterministic config path (for example `config.sections[0].image.fill`)
- `created_at`, `updated_at` (timestamptz)

Rules:
- Uniqueness key: `(account_id, asset_id, public_id, config_path)`.
- FK to `(asset_id, account_id)` in `account_assets` with cascade on delete.
- Paris automatically rewrites usage rows on instance config create/update (no manual reconciliation step).

### `widget_instance_overlays` (current)
Canonical layered overlays for instances (curated + user).

Core columns:
- `public_id` (text) — locale-free instance id
- `layer` (text) — `locale|geo|industry|experiment|account|behavior|user`
- `layer_key` (text) — canonicalized key per layer (locale BCP47, geo ISO, etc.)
- `ops` (jsonb) — set-only ops generated by agents/manual base overlays
- `user_ops` (jsonb) — per-field manual overrides for layer=user (set-only ops)
- `base_fingerprint` (text) — required staleness guard (sha256)
- `base_updated_at` (timestamptz, nullable) — metadata only
- `source` (text) — `agent` | `manual` | `import`
- `geo_targets` (text[], nullable) — locale selection only (fr vs fr-CA)
- `account_id` (uuid, nullable) — user instances are account-scoped; curated overlays may be global (`null`)
- `updated_at`, `created_at` (timestamptz)

Notes:
- Overlay files served by Tokyo are materialized from `ops + user_ops` (user_ops applied last for layer=user).
- `base_fingerprint` is used by Venice to classify overlays as fresh vs stale; stale locale overlays may be applied selectively when safe (best-available overlays; see `documentation/capabilities/localization.md`).
- Instance identity remains locale-free; overlays are keyed by `(public_id, layer, layer_key)`.
- Uniqueness is enforced per `(public_id, layer, layer_key)`; history lives in R2 + version ledger.

### `comments` (provisioned)
An account moat: viewers can comment without editing (Figma model).

This table exists even if the full UI/UX ships later.

## Hard Invariants (strict editor philosophy)

- **No partial configs**: `config` is required and must be a JSON object (not `null`, not an array).
- **No legacy states**: only `published` / `unpublished` exist (no `draft`, no `inactive`).
- **No extra “template system”**: Michael does not have a templates table. “Templates” are instances.
- **Account-owned uploads**: every uploaded asset row must have non-null `account_id`; ownership is never inferred from scope names.

## Instance Taxonomy (3 kinds of instances)

Clickeen uses one system (“instances”) but we still need a consistent taxonomy so tooling can filter and present them.

This taxonomy is encoded in `public_id` across two tables:
- `curated_widget_instances` → `wgt_main_*` and `wgt_curated_*`
- `widget_instances` → `wgt_*_u_*`

### A) Main instance (baseline)
One per widget type. Used for:
- dev sandbox editing in DevStudio/Bob
- canonical “baseline” config to copy/clone from
- local dev convenience baseline; DevStudio’s **Update default config** keeps `wgt_main_*` and `spec.json` defaults in sync when you choose to do so (no automatic mirroring)

**Naming**
- `wgt_main_{widgetType}`

Examples:
- `wgt_main_faq`

### B) Curated instance (Clickeen-authored)
These are instances created by Clickeen (via Bob) that serve as starter designs **and** Prague embeds.

**Naming**
- `wgt_curated_{widgetType}_{styleSlug}`

Where:
- `styleSlug` is a stable, human-chosen style key (allowed chars: `a-z 0-9 _`)
- locale is a runtime parameter; it must not be encoded into `public_id`

Examples:
- `wgt_curated_faq_lightblurs_generic`
- `wgt_curated_countdown_starter`
- `wgt_curated_logoshowcase_brutalist`

**Metadata**
Curated instances also store metadata in `curated_widget_instances.meta`:
```
{
  "styleName": "lightblurs.generic",
  "styleSlug": "lightblurs_generic"
}
```
Metadata is used for DevStudio display + filtering; the `public_id` is still the canonical identifier.

### C) User instance
Instances created by users (usually by cloning either a `main` instance or a curated instance).

**Naming**
- `wgt_<widgetType>_u_<instanceKey>`

Examples:
- `wgt_faq_u_4f8k2m1x`

### Migration note (no legacy)

Legacy `wgt_curated_{curatedKey}.{locale}` rows must not exist.

The canonical migration is:
- `supabase/migrations/20260116090000__public_id_prefixes.sql`

It:
- renames the known curated/main instances to the new prefixes, and
- re-adds the `widget_instances_public_id_format` constraint to forbid locale suffixes going forward.

## “Instances ARE Templates” (how templates work)

Competitors build a separate “template system”.

Clickeen does not.

A “template” is just a curated `curated_widget_instances` row whose `public_id` uses the `wgt_curated_` form. The gallery is simply a filtered view of instances (later: in UI/service code).

## Local Dev (Docker Supabase)

Local DB is Supabase CLI + Docker:
- `supabase db reset` applies `supabase/migrations/*` **and wipes local data** (destructive)
- instances are created explicitly from DevStudio Local (superadmin), not by scripts

**Data contract (don’t fight UUID churn):**
- After a reset, internal UUIDs (`widgets.id`, `widget_instances.id`, `widget_instances.widget_id`) will change. That’s normal.
- The durable contract for a widget instance is:
  - `widget_instances.public_id` (stable string ID)
  - `widget_instances.account_id` (required)
  - `widget_instances.config` (the JSON blob you care about)
- The durable contract for uploaded assets is:
  - `account_assets.asset_id`
  - `account_assets.account_id`
  - `account_asset_variants.r2_key`
  - `account_asset_usage.{public_id,config_path}` for deterministic usage mapping

## What Michael Does NOT Do (by design)

- No billing tables (Stripe, invoices, etc.)
- No embed tokens table (yet)
- No schema/template migration system (templates are instances)

Those concerns are intentionally outside Michael’s scope right now so the editor stays strict and the platform stays simple.

## Deterministic admin account

Michael seeds one deterministic platform/admin account:
- `ADMIN_ACCOUNT_ID = 00000000-0000-0000-0000-000000000100`

This account owns:
- `curated_widget_instances` (baseline + curated starter designs)
- internal/admin tooling surfaces (DevStudio/Roma admin)
