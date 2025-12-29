# Michael — Database (Supabase)

Michael is Clickeen’s **minimal** persistence layer. It stores exactly what we need to edit and serve widget instances, and nothing else.

## Authority

The schema is defined by:
- `supabase/migrations/20251228000000__base.sql`
- `supabase/seed.sql` (local dev only)

If this document conflicts with those files, the SQL wins.

## What Michael Stores (and only this)

### `widgets`
One row per widget type (FAQ, Countdown, …).

Core columns:
- `id` (uuid) — internal
- `type` (text) — widget type slug (e.g. `faq`, `countdown`)
- `name` (text) — human label

### `widget_instances`
One row per instance. This is the **canonical config state tree**.

Core columns:
- `id` (uuid) — internal (never exposed outside DB/services)
- `widget_id` (uuid) — FK to `widgets.id`
- `public_id` (text) — the **only** identifier that crosses system boundaries
- `status` (text) — `published` | `unpublished`
- `config` (jsonb) — required object

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

**Naming**
- `wgt_<widgetType>_main`

Examples:
- `wgt_faq_main`
- `wgt_countdown_main`

### B) Template instance (Clickeen curated “gallery”)
These are instances created by Clickeen (via Bob) that serve as starter designs.

**Naming**
- `wgt_<widgetType>_tmpl_<templateKey>`

Examples:
- `wgt_faq_tmpl_christmas`
- `wgt_faq_tmpl_halloween`

### C) User instance
Instances created by users (usually by cloning either a `main` instance or a template instance).

**Naming**
- `wgt_<widgetType>_u_<instanceKey>`

Examples:
- `wgt_faq_u_4f8k2m1x`
- `wgt_countdown_u_9a2d7c`

## “Instances ARE Templates” (how templates work)

Competitors build a separate “template system”.

Clickeen does not.

A “template” is just a `widget_instances` row whose `public_id` uses the `tmpl` form. The gallery is simply a filtered view of instances (later: in UI/service code).

## Local Dev (Docker Supabase)

Local DB is Supabase CLI + Docker:
- `supabase db reset` applies `supabase/migrations/*`
- then applies `supabase/seed.sql`

The seed creates:
- widgets: `faq`, `countdown`
- instances: `wgt_faq_main`, `wgt_countdown_main`

## What Michael Does NOT Do (by design)

- No workspaces / memberships / entitlements
- No usage analytics tables
- No embed tokens table
- No schema/template migration system

Those concerns are intentionally outside Michael’s scope right now so the editor stays strict and the platform stays simple.
