STATUS: NORMATIVE — SINGLE SOURCE OF TRUTH (SCOPED)
This document is authoritative for its scope. It must not conflict with:
1) documentation/dbschemacontext.md (DB Truth) and
2) documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Global Contracts).
If any conflict is found, STOP and escalate to CEO. Do not guess.


## DB SCHEMA POLICY
- This file is the canonical Supabase dump maintained by CEO.
- Engineers MUST code to this file exactly. Schema-in-code drift is forbidden.
- Changes require a DB CHANGE REQUEST (motivation + exact DDL) and an updated dump.


SERVICE-ROLE BOUNDARIES (REMINDER)
- plan_features and any billing/entitlement writes: service-role ONLY.
- events writes happen via server/API; clients DO NOT write directly to tables.
- embed_tokens reveal only non-sensitive fields to anon; validation happens server-side.

db-schema-context.md — Complete DB snapshot

1. File purpose

Purpose: Provide a single-file, comprehensive structural snapshot of your Supabase Postgres project (schemas, extensions, tables, columns, relationships, sizes, and RLS policies).
Security note: This file may contain sensitive object definitions (policies, function names, etc.). Treat it as protected.
2. Project summary

Project: ebmqwqdexmemhrdhkmwn
Schemas inspected and included: auth, public, extensions, plus system schemas present in DB (listed elsewhere).
3. Installed extensions (summary)

Detected extensions (names and noted schema when available):
earthdistance
pgsodium
rum
address_standardizer_data_us
pg_hashids
pg_prewarm
plpgsql_check
file_fdw
http
postgis
pg_tle
citext
tcn
intagg
pgrouting
refint
moddatetime
amcheck
pg_net
postgis_sfcgal
btree_gin
bloom
seg
pgjwt
uuid-ossp (installed in schema: extensions)
pg_walinspect
tsm_system_time
hstore
postgis_topology
postgres_fdw
pg_surgery
pg_buffercache
postgis_tiger_geocoder
pg_trgm
insert_username
address_standardizer
pgroonga_database
xml2
autoinc
dict_int
tsm_system_rows
pg_stat_statements (installed in schema: extensions)
postgis_raster
index_advisor
pgroonga
supabase_vault (installed in schema: vault)
sslinfo
fuzzystrmatch
vector
pgmq
unaccent
btree_gist
pgaudit
wrappers
pgtap
lo
dict_xsyn
pg_repack
isn
pgrowlocks
plpgsql (pg_catalog)
pageinspect
pg_cron (pg_catalog)
tablefunc
pg_visibility
pg_stat_monitor
pg_jsonschema
pgstattuple
ltree
intarray
cube
hypopg
(and others listed in internal metadata)
Recommendation: Install extensions into a dedicated schema (e.g., extensions) when re-creating the DB; avoid placing extension objects directly in public.
4. Schema: public — tables, columns, PKs, FKs, sizes, RLS state (summary)

Notes: This section summarizes the table-level metadata retrieved. Sizes are estimates from metadata output.
profiles

RLS: disabled
Size: 16 kB (estimate)
Primary key: user_id
Columns:
user_id uuid NOT NULL
name text
company text
subscription_status text DEFAULT 'trial'
created_at timestamp with time zone DEFAULT now()
created_by uuid
created_source user_created_source DEFAULT 'signup_form' (enum)
created_ip inet
created_user_agent text
widgets

RLS: enabled
Size: 112 kB (~35 live rows)
Primary key: id (uuid DEFAULT gen_random_uuid())
Columns:
id uuid NOT NULL DEFAULT gen_random_uuid()
user_id uuid NOT NULL
name text NOT NULL
type text NOT NULL
public_key text UNIQUE NOT NULL
status text DEFAULT 'active'
config jsonb DEFAULT '{}' NOT NULL
created_at timestamptz DEFAULT now()
workspace_id uuid NOT NULL
Foreign keys:
workspace_id -> public.workspaces(id)
Relationships (incoming foreign keys):
widget_submissions.widget_id -> widgets.id
widget_instances.widget_id -> widgets.id
plugin_artifacts.widget_id -> widgets.id
widget_events.widget_id -> widgets.id
widget_events

RLS: disabled
Size: 48 kB (~10 rows)
Primary key: id (uuid DEFAULT gen_random_uuid())
Columns: id, widget_id uuid, type text, meta jsonb DEFAULT '{}', ts timestamptz DEFAULT now()
FK: widget_id -> public.widgets(id)
widget_submissions

RLS: enabled
Size: 96 kB (~13 rows)
Primary key: id uuid DEFAULT gen_random_uuid()
Columns:
id uuid DEFAULT gen_random_uuid()
widget_id uuid NOT NULL
payload jsonb NOT NULL CHECK (pg_column_size(payload) <= 32768)
ts timestamptz DEFAULT now()
ip text
ua text
widget_instance_id text
payload_hash text
ts_second timestamptz
FK: widget_id -> widgets.id
widget_instances

RLS: enabled
Size: 160 kB (~22 rows)
Primary key: id uuid DEFAULT gen_random_uuid()
Columns:
id uuid
widget_id uuid NOT NULL
public_id text UNIQUE NOT NULL
status text DEFAULT 'draft' CHECK status IN ('draft','published','inactive')
config jsonb DEFAULT '{}'
created_at timestamptz DEFAULT now()
draft_token uuid
claimed_at timestamptz
expires_at timestamptz
updated_at timestamptz DEFAULT now()
FK: widget_id -> widgets.id
usage_events

RLS: disabled
Primary key: id
Columns include workspace_id uuid, event_type text DEFAULT 'feature_usage', quantity integer DEFAULT 1, metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now(), etc.
plan_limits

RLS: disabled
Primary key: composite (plan_id, limit_type)
Columns: plan_id text, limit_type text, limit_value integer, enforcement text DEFAULT 'soft', grace_amount integer DEFAULT 0
workspaces

RLS: enabled
Primary key: id uuid
Columns:
id uuid
name text
plan text DEFAULT 'free'
created_at timestamptz DEFAULT now()
kind text DEFAULT 'business' CHECK kind IN ('agency','business')
parent_workspace_id uuid
Relationships: many incoming FKs (widgets.workspace_id, workspace_allocations.workspace_id, agency_packages.agency_workspace_id, workspace_members.workspace_id, billing_account_workspaces.workspace_id, etc.)
workspace_members

RLS: enabled
Primary key: id uuid
Columns:
id uuid
workspace_id uuid NOT NULL
user_id uuid NOT NULL
role text DEFAULT 'owner' CHECK role IN ('owner','admin','super_editor','editor','collaborator','viewer')
status text DEFAULT 'active'
created_at timestamptz DEFAULT now()
invited_by uuid
invited_at timestamptz DEFAULT now()
accepted_at timestamptz
FKs:
user_id -> auth.users(id)
invited_by -> auth.users(id)
workspace_id -> public.workspaces(id)
plan_features

RLS: enabled
Primary key: composite (plan_id, feature_key)
Columns: plan_id text, feature_key text, limit_value int, enabled boolean, metadata jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now()
events

RLS: enabled
Primary key: id uuid
Columns: id, workspace_id uuid NOT NULL, entity_type text, entity_id uuid, event_type text NOT NULL, actor_id uuid, payload jsonb DEFAULT '{}', metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
embed_tokens

RLS: enabled
Primary key: id uuid
Columns:
id uuid DEFAULT gen_random_uuid()
widget_instance_id uuid NOT NULL
token text UNIQUE NOT NULL
expires_at timestamptz NOT NULL
created_at timestamptz DEFAULT now()
created_by uuid
rotated_at timestamptz
FK: widget_instance_id -> widget_instances.id
plugin_artifacts

RLS: disabled
Primary key: id uuid
Columns:
id uuid DEFAULT gen_random_uuid()
widget_id uuid NOT NULL
version text NOT NULL
content bytea NOT NULL CHECK (octet_length(content) <= 28672)
bytes integer GENERATED AS (octet_length(content))
created_at timestamptz DEFAULT now()
FK: widget_id -> widgets.id
billing_accounts

RLS: enabled
Primary key: id uuid
Columns:
id uuid DEFAULT gen_random_uuid()
owner_user_id uuid NOT NULL
created_at timestamptz DEFAULT now()
FK: owner_user_id -> auth.users(id)
billing_account_workspaces

RLS: enabled
Primary key: composite (billing_account_id, workspace_id)
Columns:
billing_account_id uuid
workspace_id uuid
FKs: billing_account_id -> billing_accounts.id, workspace_id -> workspaces.id
Other smaller or support tables (summaries): test_migration, user_creation_audit, agency_packages, workspace_allocations, widget_claim_audit, widget_fetch_errors, materialized_view_refresh_log, performance_baseline_audit, submission_rate_window, feature_flags — extract full definitions with the SQL in section 7.
5. Schema: auth — core tables (summary)

auth.users

RLS: enabled (typical Supabase)
Primary key: id uuid
Notable columns:
id uuid NOT NULL
email text
encrypted_password text
role text
raw_app_meta_data jsonb
raw_user_meta_data jsonb
is_super_admin boolean
created_at timestamptz
updated_at timestamptz
phone text UNIQUE
phone_confirmed_at timestamptz
confirmed_at timestamptz
banned_until timestamptz
deleted_at timestamptz
is_anonymous boolean DEFAULT false
Important: Do not create a separate public.users table — use auth.users and create a public.profiles table if you need public profile data.
auth.refresh_tokens

RLS: enabled
Primary key: id (bigint)
Columns generally include token text UNIQUE, user_id uuid (FK to auth.users.id), revoked boolean, created_at, updated_at, parent, session_id
Other auth tables present: instances, audit_log_entries, identities, sessions, mfa_factors, mfa_challenges, sso_providers, sso_domains, saml_providers, etc. Extract full DDL if required.
6. Row Level Security (RLS) — policies (selected highlights)

Notes: Policies below are taken verbatim from the retrieved metadata. They are important and may contain helper function references (e.g., is_workspace_owner(workspace_id)).
public.widgets

"Owner can select own widgets" — FOR SELECT TO authenticated USING (user_id = auth.uid());
"Owner can insert own widgets" — FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
"Owner can update own widgets" — FOR UPDATE TO authenticated USING (user_id = auth.uid());
"Owner can delete own widgets" — FOR DELETE TO authenticated USING (user_id = auth.uid());
public.widget_instances

"widget_instances_select_own_auth" — FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM widgets w WHERE (w.id = widget_instances.widget_id AND w.user_id = auth.uid())));
"widget_instances_insert_own_auth" — FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM widgets w WHERE (w.id = widget_instances.widget_id AND w.user_id = auth.uid())));
"widget_instances_update_own_auth" — FOR UPDATE TO authenticated USING (EXISTS (...));
"widget_instances_delete_own_auth" — FOR DELETE TO authenticated USING (EXISTS (...));
public.workspace_members

Policies around owners/admins:
"owners_can_insert_members" — FOR INSERT TO authenticated WITH CHECK is_workspace_owner(workspace_id);
"owners_can_update_members" — FOR UPDATE TO authenticated USING is_workspace_owner(workspace_id) WITH CHECK is_workspace_owner(workspace_id);
"owners_can_delete_members" — FOR DELETE TO authenticated USING is_workspace_owner(workspace_id);
"members_read_own" — FOR SELECT TO public USING (user_id = auth.uid());
"members can select workspace memberships" — FOR SELECT TO authenticated USING (workspace_id IN (SELECT m.workspace_id FROM workspace_members m WHERE m.user_id = auth.uid()));
public.workspaces

"members_select_own_workspace" — FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members m WHERE (m.workspace_id = workspaces.id AND m.user_id = auth.uid() AND m.status = 'active')));
"owners_admins_update_workspace" — FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members m WHERE (m.workspace_id = workspaces.id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role = ANY (ARRAY['owner','admin'])))) WITH CHECK (same);
"owners_admins_delete_workspace" — FOR DELETE TO authenticated USING (EXISTS (...role check...));
public.plan_features

"plan_features_read_all" — FOR SELECT TO anon, authenticated USING (true)
public.events

"events_read_members" — FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members m WHERE (m.workspace_id = events.workspace_id AND m.user_id = auth.uid())))
public.billing_accounts

"billing_accounts_owner_rw" — FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid())
public.billing_account_workspaces

"baw_owner_or_member_read" — FOR SELECT TO authenticated USING (((EXISTS (SELECT 1 FROM billing_accounts ba WHERE (ba.id = billing_account_workspaces.billing_account_id AND ba.owner_user_id = auth.uid()))) OR (EXISTS (SELECT 1 FROM workspace_members m WHERE (m.workspace_id = billing_account_workspaces.workspace_id AND m.user_id = auth.uid())))))
"baw_owner_write" — FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM billing_accounts ba WHERE (ba.id = billing_account_workspaces.billing_account_id AND ba.owner_user_id = auth.uid()))) WITH CHECK (same)
public.embed_tokens

"embed_tokens_deny_all" — FOR ALL TO public USING (false) WITH CHECK (false)
"embed_tokens_member_read" — FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM ((widget_instances wi JOIN widgets w ON (w.id = wi.widget_id)) JOIN workspace_members m ON (m.workspace_id = w.workspace_id)) WHERE (wi.id = embed_tokens.widget_instance_id AND m.user_id = auth.uid())))
Important policy notes

Policies often use auth.uid() and helper functions (e.g., is_workspace_owner). This follows Supabase RLS best practices.
Many tables have per-operation policies (SELECT, INSERT, UPDATE, DELETE) scoped to authenticated or anon roles.
7. SQL snippets: extract full DDL for functions, views, types, triggers, indexes, policies

Run these read-only queries in Supabase SQL editor or psql to collect full DDL and paste results into the FUNCTIONS & VIEWS section (section 8).
Export all functions:
SQL Query



SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, p.proname;

Export all views (include WITH (security_invoker=on)):
SQL Query



SELECT table_schema,
       table_name,
       'CREATE VIEW ' || table_schema || '.' || table_name || ' WITH (security_invoker=on) AS ' || pg_get_viewdef(table_schema || '.' || table_name, true) AS view_ddl
FROM information_schema.views
WHERE table_schema NOT IN ('pg_catalog','information_schema');

Export materialized views:
SQL Query



SELECT schemaname, matviewname,
       'CREATE MATERIALIZED VIEW ' || schemaname || '.' || matviewname || ' AS ' || pg_get_viewdef(schemaname || '.' || matviewname, true) AS ddl
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog','information_schema');

Export enumerated types:
SQL Query



SELECT n.nspname AS schema, t.typname AS enum_name,
       array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
GROUP BY n.nspname, t.typname
ORDER BY n.nspname, t.typname;

Export domains:
SQL Query



SELECT n.nspname AS schema, t.typname AS domain_name, pg_get_domaindef(t.oid) AS domain_def
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typtype = 'd' AND n.nspname NOT IN ('pg_catalog','information_schema');

Export RLS policies (as CREATE POLICY statements):
SQL Query



SELECT
  'CREATE POLICY ' || quote_ident(pol.polname) || ' ON ' || quote_ident(n.nspname) || '.' || quote_ident(rel.relname) ||
  ' FOR ' || pol.polcmd || ' TO ' || (CASE WHEN pol.polroles IS NULL THEN 'public' ELSE array_to_string(ARRAY(SELECT rolname FROM unnest(pol.polroles) r join pg_roles on r = pg_roles.oid), ',') END) ||
  CASE WHEN pol.polqual IS NOT NULL THEN ' USING (' || pol.polqual || ')' ELSE '' END ||
  CASE WHEN pol.polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pol.polwithcheck || ')' ELSE '' END
AS policy_ddl
FROM pg_policy pol
JOIN pg_class rel ON pol.polrelid = rel.oid
JOIN pg_namespace n ON rel.relnamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema');

Export indexes:
SQL Query



SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog','information_schema');

Export triggers:
SQL Query



SELECT event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog','information_schema');

To produce a schema-only dump locally (pg_dump):
Example:
pg_dump --schema-only --no-owner --schema=public --schema=auth -h <host> -U <user> -d <db> -f schema-only.sql
8. FUNCTIONS & VIEWS — paste-ready template

Instructions: Run the queries in section 7. Copy the pg_get_functiondef / view DDL / matview DDL outputs and paste them below. For views, ensure WITH (security_invoker=on). For materialized views and foreign tables, consider moving to private schema to avoid RLS bypass.
---- FUNCTIONS & VIEWS (BEGIN) ----

-- Paste function/view/materialized view DDL here (example placeholders):

-- Example function (paste pg_get_functiondef output): -- CREATE OR REPLACE FUNCTION auth.get_user_tenant() RETURNS uuid -- LANGUAGE sql STABLE -- AS $$ -- SELECT tenant_id FROM public.user_profiles WHERE auth_user_id = auth.uid(); -- $$;

-- Example view: -- CREATE VIEW public.my_view WITH (security_invoker=on) AS -- SELECT ...;

-- Note: Materialized views may bypass RLS — prefer schema private for them.

---- FUNCTIONS & VIEWS (END) ----

9. Reproduction ordering & best-practice checklist

Create schemas first (extensions, vault, private).
Install extensions into the dedicated schema (CREATE EXTENSION ... SCHEMA extensions).
Create custom types (enums, domains).
Create tables with primary keys and inline foreign key constraints (use id bigint primary key generated always as identity only when appropriate; existing tables use gen_random_uuid()).
Create explicit CREATE INDEX statements for foreign key columns (improves join performance).
Create sequences and set owners/defaults.
Create functions (use CREATE OR REPLACE FUNCTION; set search_path = '' inside bodies; use SECURITY DEFINER only for trigger helpers).
Create views WITH (security_invoker=on).
Enable RLS on app tables and create explicit policies (one per operation; use auth.uid()).
Create triggers and trigger functions.
Apply GRANTS and role privileges last.
10. Security guidance & best-practice reminders

Auth: Use auth.users and link public.profiles to auth.users.id.
RLS: Enable RLS on all user-facing tables; create explicit policies for SELECT/INSERT/UPDATE/DELETE and specify TO roles (authenticated, anon).
Foreign tables and materialized views: Place them in schema private and document the security risk — they can bypass RLS.
Extensions: Install into extensions schema, not public.
Functions:
For trigger helper functions: consider SECURITY DEFINER and then REVOKE EXECUTE from anon/authenticated if sensitive.
Set search_path inside functions: set search_path = ''.
Indexes: Add indexes on columns used by policies (e.g., user_id, workspace_id) and foreign keys to improve performance.
Secrets: Function bodies or policies may reference keys or sensitive logic—treat the file accordingly.
