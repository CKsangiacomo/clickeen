# Michael — Database (Supabase)

Michael is Clickeen’s **minimal** persistence layer. It stores account/registry data around widget instances. Public serving truth is not owned here.

## Authority

The schema is defined by:

- `supabase/migrations/20251228000000__base.sql`
- `supabase/migrations/20260117090000__curated_widget_instances.sql`
- `supabase/migrations/20260118090000__widget_instances_user_only.sql`
- `supabase/migrations/20260216120000__widget_instances_display_name.sql`
- `supabase/migrations/20260213160000__accounts_asset_domain_phase0.sql`
- `supabase/migrations/20260304090000__account_only_tenancy.sql`
- `supabase/migrations/20260304120000__prd55_storage_eviction_cutover.sql`

If this document conflicts with those files, the SQL wins.

## What Michael Stores (and only this)

### `widgets`

One row per widget type (e.g. FAQ).

Core columns:

- `id` (uuid) — internal
- `type` (text) — widget type slug (e.g. `faq`)
- `name` (text) — human label

### `widget_instances`

One row per **user instance**. During PRD 61 cutover, this is the registry/metadata row for account-owned instances; active product config truth lives in Tokyo.

Core columns:

- `id` (uuid) — internal (never exposed outside DB/services)
- `widget_id` (uuid) — FK to `widgets.id`
- `account_id` (uuid) — FK to `accounts.id` (instances are account-owned)
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `display_name` (text, nullable) — account-facing instance label (defaults to `public_id` when missing)
- `kind` (text) — `user` (listed starter/baseline cutover rows still live in `curated_widget_instances`)
- `status` (text) — `published` | `unpublished` (schema residue during cutover; not canonical serve-state authority)
- `config` (jsonb) — required object, no longer used as active product config truth

Current cutover note:

- Active product open/save no longer reads or writes `widget_instances.config`.
- Bob/Roma use Tokyo for normal authoring open/save and Michael for registry/shell metadata only.
- `widget_instances.config` still exists because of current schema shape and historical rows, but it is not the active product-path source of truth.
- Public runtime never reads this row directly.
- Tokyo owns the per-instance `published` / `unpublished` serve flag. Michael status columns must not be treated as the canonical answer to whether Venice may serve an instance.
- Roma's core Michael row helpers no longer surface instance `status` as product truth. Widgets status comes from Tokyo serve-state reads.

Guardrails:

- `widget_instances_user_public_id_only` constraint (NOT VALID) blocks new `wgt_main_*` / `wgt_curated_*` writes.

### `curated_widget_instances` (starter registry residue)

One row per **Clickeen-authored** starter/baseline instance during the current cutover.

Core columns:

- `id` (uuid) — internal (never exposed outside DB/services)
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `widget_type` (text) — denormalized widget type (validated against Tokyo registry at write time)
- `kind` (text) — `baseline` | `curated` (legacy enum names; product language is listed starter/baseline)
- `status` (text) — `published` | `unpublished` (schema residue during cutover; not canonical serve-state authority)
- `owner_account_id` (uuid) — FK to `accounts.id` (starter rows are owned by a platform account; runtime policy keys off `accounts.is_platform` plus row ownership, not a hardcoded seed id)
- `config` (jsonb) — required object, no longer used as active product config truth

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

Current deterministic platform seed:

- `ADMIN_ACCOUNT_ID = 00000000-0000-0000-0000-000000000100` (`is_platform=true`)
- This id is an operational seed, not a normative product authorization rule.

### `account_members`

One row per user membership (roles).

Core columns:

- `account_id` (uuid) — FK to `accounts.id`
- `user_id` (uuid) — FK to `auth.users.id`
- `role` (text) — `viewer` | `editor` | `admin` | `owner`

### Asset and l10n write-plane state (current)

Michael no longer stores active asset metadata, asset-usage indexes, or instance overlay authoring rows.

Removed from the active schema by PRD 55 cutover:

- `account_assets`
- `account_asset_variants`
- `account_asset_usage`
- `widget_instance_overlays`
- `l10n_generate_state`
- `l10n_base_snapshots`
- `l10n_overlay_versions`
- `l10n_publish_state`

Current ownership boundaries:

- Account-owned asset bytes + manifest metadata live in Tokyo R2 and are managed by Tokyo-worker.
- Instance overlay authoring state lives in Tokyo/Tokyo-worker-managed storage.
- Michael remains the source of truth for accounts, memberships, and widget instance rows.

### `comments` (provisioned)

An account moat: viewers can comment without editing (Figma model).

This table exists even if the full UI/UX ships later.

## Hard Invariants (strict editor philosophy)

- **No partial configs**: `config` is required and must be a JSON object (not `null`, not an array).
- **No legacy states**: if a Michael status column still exists during cutover, only `published` / `unpublished` are allowed values (no `draft`, no `inactive`). That column is not the canonical serve-state owner.
- **No separate starter content model**: starter designs are instances. The remaining `curated_widget_instances` table is cutover residue, not a surviving product noun.
- **Account-owned uploads**: every uploaded asset manifest is account-scoped; ownership is never inferred from scope names.

## Instance Taxonomy (3 kinds of instances)

Clickeen uses one system (“instances”) but we still need a consistent taxonomy so tooling can filter and present them.

This taxonomy is encoded in `public_id` across two tables:

- `curated_widget_instances` → `wgt_main_*` and `wgt_curated_*`
- `widget_instances` → `wgt_*_u_*`

### A) Main instance (baseline)

One per widget type. Used for:

- local platform baseline verification
- canonical “baseline” config to copy/clone from
- local dev convenience baseline; internal tooling may keep `wgt_main_*` and `spec.json` defaults in sync when you choose to do so (no automatic mirroring)

**Naming**

- `wgt_main_{widgetType}`

Examples:

- `wgt_main_faq`

### B) Listed starter instance (Clickeen-authored)

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
Starter instances also store metadata in `curated_widget_instances.meta` during the cutover:

```
{
  "styleName": "lightblurs.generic",
  "styleSlug": "lightblurs_generic"
}
```

Metadata is used for DevStudio display + filtering; the `public_id` is still the canonical identifier.

### C) User instance

Instances created by users (usually by duplicating either a `main` instance or a listed starter instance).

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

## Listed Starter Instances

Clickeen does not.

What the product surfaces as starter designs are account-owned instances from the admin/platform account. During the current Michael cutover, the DB registry residue for those rows is `curated_widget_instances`, but the product model is still listed/duplicable instances. The gallery is simply a filtered view of those listed starter instances. It is not keyed off the Tokyo `published` / `unpublished` serve flag, because starter discovery is not public-serving authority.

## Local Dev (Docker Supabase)

Local DB is Supabase CLI + Docker:

- `supabase db reset` applies `supabase/migrations/*` **and wipes local data** (destructive)
- instances are created explicitly from DevStudio Local (internal toolbench), not by scripts

**Data contract (don’t fight UUID churn):**

- After a reset, internal UUIDs (`widgets.id`, `widget_instances.id`, `widget_instances.widget_id`) will change. That’s normal.
- The durable contract for a widget instance is:
  - `widget_instances.public_id` (stable string ID)
  - `widget_instances.account_id` (required)
  - `widget_instances.config` (legacy schema column, not active product config truth)
- The durable contract for uploaded assets is:
  - logical `assetId` references for migrated media surfaces in instance config
  - blob bytes under `accounts/{accountId}/assets/versions/{assetId}/{sha256}/{filename}` in Tokyo R2
  - per-asset manifest metadata under `accounts/{accountId}/assets/meta/{assetId}.json`

## What Michael Does NOT Do (by design)

- No billing tables (Stripe, invoices, etc.)
- No embed tokens table (yet)
- No separate starter-content migration system (starter designs are instances)

Those concerns are intentionally outside Michael’s scope right now so the editor stays strict and the platform stays simple.

## Deterministic platform account

Michael seeds one deterministic platform account:

- `ADMIN_ACCOUNT_ID = 00000000-0000-0000-0000-000000000100`

Today this seeded platform account owns:

- `curated_widget_instances` cutover residue (baseline + listed starter designs)
- local platform verification/state used by internal tooling
- the current cloud-dev product/runtime account context after PRD 60
