# Michael — Database (Supabase)

Michael is Clickeen’s **minimal** persistence layer. It stores exactly what we need to edit and serve widget instances, and nothing else.

## Authority

The schema is defined by:
- `supabase/migrations/20251228000000__base.sql`
- `supabase/migrations/20260105000000__workspaces.sql`

If this document conflicts with those files, the SQL wins.

## What Michael Stores (and only this)

### `widgets`
One row per widget type (e.g. FAQ).

Core columns:
- `id` (uuid) — internal
- `type` (text) — widget type slug (e.g. `faq`)
- `name` (text) — human label

### `widget_instances`
One row per instance. This is the **canonical config state tree**.

Core columns:
- `id` (uuid) — internal (never exposed outside DB/services)
- `widget_id` (uuid) — FK to `widgets.id`
- `workspace_id` (uuid) — FK to `workspaces.id` (instances are workspace-owned)
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `kind` (text) — `curated` | `user` (curated powers Prague + templates; user is workspace-owned)
- `status` (text) — `published` | `unpublished`
- `config` (jsonb) — required object

### `workspaces`
One row per workspace/team (Figma model). Workspaces own instances.

Core columns:
- `id` (uuid) — internal
- `tier` (text) — `free` | `tier1` | `tier2` | `tier3`
- `name` (text)
- `slug` (text) — URL-safe workspace slug
- `website_url` (text, nullable) — workspace setting used by Copilot; gated by `context.websiteUrl.enabled` where it is surfaced/consumed
- `l10n_locales` (jsonb, nullable) — workspace-selected locales for auto-translate

### `workspace_members`
One row per user membership (roles).

Core columns:
- `workspace_id` (uuid) — FK to `workspaces.id`
- `user_id` (uuid) — FK to `auth.users.id`
- `role` (text) — `viewer` | `editor` | `admin` | `owner`

### `comments` (provisioned)
A workspace moat: viewers can comment without editing (Figma model).

This table exists even if the full UI/UX ships later.

## Hard Invariants (strict editor philosophy)

- **No partial configs**: `config` is required and must be a JSON object (not `null`, not an array).
- **No legacy states**: only `published` / `unpublished` exist (no `draft`, no `inactive`).
- **No extra “template system”**: Michael does not have a templates table. “Templates” are instances.

## Instance Taxonomy (3 kinds of instances)

Clickeen uses one system (“instances”) but we still need a consistent taxonomy so tooling can filter and present them.

This taxonomy is encoded in `widget_instances.public_id` and enforced by a DB check constraint.

### A) Main instance (system baseline)
One per widget type. Used for:
- dev sandbox editing in DevStudio/Bob
- canonical “baseline” config to copy/clone from
- local dev convenience mirror of `tokyo/widgets/<widgetType>/spec.json` defaults (Bob compilation + fallbacks use Tokyo specs)

**Naming**
- `wgt_main_{widgetType}`

Examples:
- `wgt_main_faq`

### B) Curated instance (Clickeen-owned)
These are instances created by Clickeen (via Bob) that serve as starter designs **and** Prague embeds.

**Naming**
- `wgt_curated_{curatedKey}`

Where:
- `curatedKey` is stable and dot-separated; it starts with the widget type (allowed chars: `a-z 0-9 . - _`)
- locale is a runtime parameter; it must not be encoded into `public_id`

Examples:
- `wgt_curated_faq.overview.hero`
- `wgt_curated_faq.templates.card.1`

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

A “template” is just a curated `widget_instances` row whose `public_id` uses the `wgt_curated_` form. The gallery is simply a filtered view of instances (later: in UI/service code).

## Local Dev (Docker Supabase)

Local DB is Supabase CLI + Docker:
- `supabase db reset` applies `supabase/migrations/*` **and wipes local data** (destructive)
- instances are created explicitly from DevStudio Local (superadmin), not by scripts

**Data contract (don’t fight UUID churn):**
- After a reset, internal UUIDs (`widgets.id`, `widget_instances.id`, `widget_instances.widget_id`) will change. That’s normal.
- The durable contract for a widget instance is:
  - `widget_instances.public_id` (stable string ID)
  - `widget_instances.workspace_id` (required)
  - `widget_instances.config` (the JSON blob you care about)

## What Michael Does NOT Do (by design)

- No billing tables (Stripe, invoices, etc.)
- No embed tokens table (yet)
- No schema/template migration system (templates are instances)

Those concerns are intentionally outside Michael’s scope right now so the editor stays strict and the platform stays simple.

## Deterministic dev workspaces

Migration `supabase/migrations/20260105000000__workspaces.sql` inserts two deterministic workspaces for dev:
- `ck-dev` (`00000000-0000-0000-0000-000000000001`) — internal dev workspace (tier3)
- `ck-demo` (`00000000-0000-0000-0000-000000000002`) — MiniBob demo workspace (free)
