# PRD 89 - Slice 6 Supabase Legacy Widget Schema Hard Cut

Status: Executed - green
Date: 2026-05-11

## Scope

Slice 6 removes Michael's final legacy account-widget instance schema. Tokyo is the surviving authority for account widget instance identity, ownership, saved config, overlays, generated runtime artifacts, and publish state.

## Migration

Added:

```text
supabase/migrations/20260511113000__prd89_drop_legacy_widget_instance_schema.sql
```

The migration drops:

```text
public.comments
public.curated_widget_instances
public.widget_instance_locales
public.widget_instance_overlays
public.l10n_generate_state
public.l10n_publish_state
public.l10n_overlay_versions
public.l10n_base_snapshots
public.instance_enforcement_state
public.instance_render_health
public.widget_instances
```

`public.comments` is included because it was an inactive workspace/widget-instance dependent table with `widget_instance_id`; leaving it after dropping `widget_instances` would preserve a dangling legacy product shape.

The migration includes a PostgreSQL `DO` verification block that raises if any dropped table, any `widget_instance_id` column, or any old `wgt_main_*` / `wgt_system_*` / `wgt_curated_*` account-widget constraint survives.

## Documentation

Updated:

- `documentation/architecture/CONTEXT.md`
- `documentation/services/michael.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`

Docs now state that Michael does not keep account widget instance source/projection tables and that account widget identity is `instanceId`, not `public_id`/`publicId`.

## Verification

Active runtime scan:

```bash
rg -n "widget_instances|curated_widget_instances|widget_instance_overlays|widget_instance_locales|l10n_publish_state|l10n_overlay_versions|l10n_base_snapshots|instance_enforcement_state|instance_render_health|public_id|publicId" bob roma venice prague tokyo-worker tokyo/product/widgets packages scripts --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

Result: no matches.

Migration static assertion:

```bash
node -e "const fs=require('fs'); const p='supabase/migrations/20260511113000__prd89_drop_legacy_widget_instance_schema.sql'; const s=fs.readFileSync(p,'utf8'); const required=['comments','curated_widget_instances','widget_instance_locales','widget_instance_overlays','l10n_generate_state','l10n_publish_state','l10n_overlay_versions','l10n_base_snapshots','instance_enforcement_state','instance_render_health','widget_instances']; for (const t of required) { if (!s.includes('DROP TABLE IF EXISTS public.'+t+' CASCADE')) throw new Error('missing drop '+t); } if (!s.includes(\"column_name = 'widget_instance_id'\")) throw new Error('missing widget_instance_id assertion'); if (!/wgt_\\(curated\\|system\\|main\\)_/.test(s)) throw new Error('missing legacy constraint assertion'); console.log('migration static assertions passed');"
```

Result: passed.

Fresh schema application substitute:

The machine has no local `docker`, `podman`, `colima`, `psql`, `postgres`, or `initdb`, so `supabase db reset --local` cannot run here. To avoid leaving this as grep-only, the full migration set was applied to an in-process PostgreSQL engine with Supabase auth-role stubs:

```text
PGlite + auth/users/auth/roles stubs + all 69 supabase/migrations/*.sql
```

Result:

```json
{"migrationsApplied":69,"legacyTables":0,"legacyColumns":0}
```

Canonical schema-dump verification command for a normal Supabase local environment:

```bash
supabase db reset --local --no-seed
supabase db dump --schema-only --local | rg -n "widget_instances|curated_widget_instances|widget_instance_overlays|widget_instance_locales|l10n_publish_state|l10n_overlay_versions|l10n_base_snapshots|instance_enforcement_state|instance_render_health|public_id|wgt_curated|wgt_system|widget_instance_id"
```

Expected result: no matches.

## Exit Criteria

1. The final migration drops the legacy account-widget instance tables and dependent inactive comments table.
2. The migration self-fails if legacy account-widget schema residue survives.
3. Active app code has zero reads/writes to the dropped tables.
4. The execution record names the final migration and the schema-dump verification command.
