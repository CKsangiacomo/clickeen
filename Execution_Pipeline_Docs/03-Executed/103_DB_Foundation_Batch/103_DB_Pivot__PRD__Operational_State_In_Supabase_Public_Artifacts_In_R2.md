# PRD 103_DB_Pivot - Operational State In Supabase Postgres, Public Artifacts In R2

Status: Executed historical evidence / doctrine extracted to PRD 105A; superseded by PRD 105 and 105A where conflicting
Owner: Product + Architecture
Date: 2026-05-21
Blocks: PRD 103 product execution until DB pivot and PRD 103K translation sync are green

Archive note: this document is no longer active execution authority. It is retained as DB Pivot evidence. Current instance-folder and DB/R2 operation authority lives in `../02-Executing/105__PRD__Instance_Folder_Tenets.md` and `../02-Executing/105A__PRD__DB_R2_Operation_Authority.md`.

## Purpose

Stop treating Cloudflare storage objects as the product application's database.

PRD 103 cannot continue while Roma, Tokyo, Bob, and San Francisco coordinate account authoring, translation, workflow, publish, and readiness state by writing JSON objects that another service later lists, reads, validates, or repairs.

The corrected architecture is:

```text
Supabase Postgres owns the minimum queryable control state.
Tokyo owns product operations and may keep large whole-document payloads behind those operations.
Cloudflare R2/CDN serves public artifacts.
```

This is not a return to "everything in the database." Public embeds, static runtime files, generated HTML/CSS/JS, images, fonts, cacheable assets, and large whole-document payloads stay out of Supabase unless a slice proves the product is simpler and cheaper with them in Postgres. The database owns only the product facts that must be listed, filtered, joined, transactionally gated, or used for deterministic coordination.

## Parent/Child PRD Model

This is the parent PRD for the DB pivot.

The parent PRD owns the doctrine:

- why Clickeen is moving away from storage-object coordination;
- what belongs in Supabase, what belongs behind Tokyo product operations, and what belongs in R2/CDN;
- why Supabase Postgres is the operational database and D1 is not the canonical product-state store for this pivot;
- how database work is executed safely through migrations/CI instead of local Docker resets or dashboard-driven schema edits;
- which product ownership boundaries survive: Berlin owns Accounts/Users, Tokyo owns Instances, R2 serves public artifacts.

The parent PRD does **not** own every table column. Detailed table design lives in child PRDs so each domain can be reviewed and executed without blurring ownership.

Required child PRDs:

| Child PRD | Product domain | Owner | Purpose |
| --- | --- | --- | --- |
| `103_DB_Current_Supabase_Inventory__PRD__Remote_DB_Audit_Gate.md` | Current remote DB inventory | Product + Architecture + Berlin/Tokyo | Inventory every current remote Supabase object and code caller before any DB Pivot migration. This is the audit gate that prevents partial-schema execution. |
| `103_DB_Accounts__PRD__Accounts_Table.md` | Accounts | Berlin | Define the one-id account table model, status/tier policy input, invitation boundary, agency roll-up extension point, and cleanup of account-shaped stale tables. |
| `103_DB_Billing_Status__PRD__Billing_Status_Stub.md` | Billing Status | Berlin + Billing | Define the temporary PLG/billing status contract used by `accounts.status` until real billing is activated, including operation gates and public artifact suspension behavior. |
| `103_DB_Users__PRD__Users_Table.md` | Users | Berlin | Define the one-user-one-account model, user role/profile fields, hard rejection for already-associated emails, and auth/connector audit boundary. |
| `103_DB_Instances__PRD__Instances_Table.md` | Instance State | Tokyo | Define the account-owned instance registry/control row, writers/readers, indexes, migration, and deletion of R2 listing/open truth. |

Child PRDs are TPM/Dev Manager level artifacts. Each child must answer:

- product what/why/how in plain language;
- exact table columns and indexes;
- writer and reader ownership for every column;
- migration source and rollback/recovery plan;
- affected services and routes;
- data-volume/scaling behavior;
- verification steps and green conditions;
- explicit deletion targets for stale tables, JSON files, generated indexes, compatibility paths, or local scripts.

No child PRD may add a table, column, payload move, or compatibility path just because code currently has a caller. It must name the product operation that needs the state.

No implementation child PRD may execute until `103_DB_Current_Supabase_Inventory__PRD__Remote_DB_Audit_Gate.md` is green. The team must know the full current remote Supabase object map before changing any slice of it.

## Product Truth

Clickeen has two consumers with different needs.

The application consumes product operations that need cheap, deterministic answers:

- which account-owned instances exist;
- who owns each instance;
- which widget product each instance uses;
- whether the instance is intended to be published by product state;
- when the current account lifecycle status began, so billing grace and deletion operations do not read history artifacts;
- whether translation generation is idle, queued, running, or failed at the product level;
- account/user ownership, authorization joins, policy joins, usage, and audit trails.

Tokyo-owned product operations may still read and write larger authored payloads or translated value maps as whole documents, provided Roma, Bob, and San Francisco never coordinate by listing storage objects or treating storage paths as product identity. Payload location is an execution decision, not the reason to create the database model.

The world consumes public artifacts:

- published `index.html`;
- published support CSS/JS;
- published locale pages/scripts if the public model needs them;
- image/font/runtime assets;
- cacheable static widget software assets.

The application must not reconstruct product state from public artifacts. Public artifact presence must not define authoring state, translation state, or publish state.

## Doctrine

If the application must list, filter, join, count for entitlement gates, or coordinate a product operation across requests, the minimum facts needed for that answer belong in Supabase Postgres.

If a browser fetches it as a public/embed asset, it belongs in Cloudflare R2/CDN.

If data is both operational and public, the operational control state is Supabase and the public copy is a materialized artifact written by a named publisher.

R2 must not hold product pointers, inventories, workflow status, account listing truth, publish truth, or selected/current relationships. Large payloads may remain in Tokyo-owned storage only when they are accessed through Tokyo product operations, not as cross-service IPC.

## Operational And Cost-Efficiency North Star

This pivot is not about making the database bigger. It is about making product operations cheaper, clearer, and deterministic.

The current bad shape is operationally expensive:

- Roma wants account instances, but the answer is hidden in generated JSON, R2 listings, source files, or compatibility objects.
- Translation and publish state are inferred from files, overlay inventories, pointer objects, or browser-local spinner state.
- One service writes storage objects so another service can discover work by reading them back.
- Every cross-service storage read creates another validation boundary where two parts of the same product can reject each other's data.

The target shape is operationally simple:

- Roma asks Tokyo for account instances.
- Tokyo answers from an indexed Supabase control row.
- Tokyo owns open, save, rename, duplicate, translate, publish, unpublish, and delete operations for instances.
- San Francisco performs translation work and reports through Tokyo.
- R2/CDN serves only public artifacts and cacheable assets.

The efficiency gain is not just lower latency. The real gain is deleting entire classes of failure: stale indexes, missing inventories, selected-pointer drift, public-file status inference, storage path identity, and service-to-service JSON shape rejection.

Cost efficiency comes from keeping Supabase narrow:

- no widget content payloads in DB by default;
- no translated value payloads in DB by default;
- no generated HTML/CSS/JS in DB;
- no public embed reads from DB;
- no per-locale rows or job-history tables unless a child PRD proves the product reader, writer, lifecycle, query need, and cost reason;
- no progress-counter writes such as "14/28 ready" on every translated locale completion.

Supabase is used for bounded authoring/control operations:

- list account instances;
- open one instance with ownership check;
- save/rename one instance;
- gate entitlement counts;
- represent current publish state;
- represent coarse translation Generate state;
- coordinate product work across requests without storage-object IPC.

At scale, every hot query must be account-scoped or direct by instance id plus account id. The product must never require a global instance scan for normal operation.

The north-star rule:

```text
Use Supabase for tiny queryable control facts.
Use Tokyo product operations for authored/translated payload ownership.
Use R2/CDN for public artifacts.
```

## Canonical Product Operations

These operation names are the approved vocabulary for the DB pivot. They describe Clickeen product behavior, not storage mechanics.

| Operation | Owner | Meaning |
| --- | --- | --- |
| `duplicateInstanceFromTemplate` | Tokyo | Creates a new account-owned instance by duplicating an admin-owned template instance into the target account. Admin instances are templates; this is account-to-account instance duplication, not a separate product mode. |
| `duplicateInstance` | Tokyo | Creates a new instance in the same account by duplicating an existing account-owned instance. |
| `applyFreeTierServing` | Tokyo | Materializes public serving for an account according to free-tier policy. Used when a free account is created and when a suspended account passes the public-serving grace window. |
| `restorePaidTierServing` | Tokyo | Rematerializes public serving for an account after billing recovery or tier restoration. |
| `deleteAccount` | Berlin orchestration, Tokyo cleanup | Comprehensive account cleanup: removes the account row and owned operational rows, Tokyo payloads, generated public artifacts, assets, invitations, users, and cold account-owned history unless a legal/billing retention policy explicitly extracts records elsewhere. |

Do not reintroduce `createInstanceFromDemo`, `claim demo`, `funnel claim`, or similar operation names in the DB pivot. Prague/MiniBob acquisition surfaces may collect or preview, but the product operation that creates a durable account instance is either direct create, same-account duplicate, or template duplication from an admin-owned instance.

## Store Decision

The canonical operational database for this pivot is **Supabase Postgres**.

This PRD deliberately does **not** choose Cloudflare D1 as canonical product state.

Why:

- Clickeen already has Supabase and a `supabase/` migration surface. Use the database we have instead of creating a second canonical store.
- The workload is SaaS control state: accounts, users, instance registry rows, live-state gates, coarse translation state, policy joins, usage, audit, and future billing/reporting. That is a relational OLTP/Postgres shape.
- Postgres gives mature transactions, row concurrency, JSONB, indexes, joins, schema migrations, inspection tooling, and optional RLS.
- D1 is valid infrastructure, but as SQLite it is a poor canonical center for this multi-tenant product state at this stage. Choosing D1 now would likely create another parallel state model instead of deleting the current one.
- Public serving does not hit Supabase. The cost/latency problem that justified moving public HTML/CSS/JS out of the database remains solved by R2/CDN.

Cloudflare remains the compute, queue, cache, and public artifact platform:

- Tokyo-worker and San Francisco run on Cloudflare Workers.
- Translation and materialization async work uses Cloudflare Queues unless a later PRD names a better workflow primitive.
- Published visitor artifacts and cacheable assets stay in R2/CDN.
- Workers connect to Supabase Postgres through **Cloudflare Hyperdrive** unless 103_DB.1B proves Hyperdrive is unsuitable for this repo/runtime. Hyperdrive is the preferred production path because it gives Workers pooled Postgres access without turning D1 into the product database.

Implementation rules:

- Do not invent a generic "database adapter" abstraction for this pivot.
- Product operations should speak Tokyo/Roma/San Francisco verbs, while Tokyo's implementation uses Supabase Postgres tables/transactions.
- If a Worker connects through Hyperdrive, use a Postgres driver supported by the Worker runtime. Do not use the Supabase JavaScript client through Hyperdrive.
- D1 may appear only as a future edge projection/cache with a named rebuild source and a separate PRD. It must not own accounts, users, instance registry state, translation state, or publish state in this pivot.

## Supabase Environment Management Doctrine

Clickeen must stop treating bootstrap-era local scripts as product database workflow.

Supabase local development through the official CLI is legitimate for schema/dev validation. It answers "does this migration/schema/app path work against a local stack?" It does not answer "what does cloud-dev/production currently contain?" and it is not the release path.

The previous `scripts/dev-up.sh` / `DEV_UP_USE_REMOTE_SUPABASE` era is over. Those scripts were created when Clickeen was primarily bootstrapped on a local machine. They now create confusion because they mix local runtime boot, local Supabase lifecycle, remote-target escape hatches, migrations, and useful build chores in one command.

The target operating model follows Supabase's environment-management pattern:

```text
feature branch -> migration files and CI validation
develop/cloud-dev branch -> cloud-dev/staging Supabase project through CI/CD
main branch -> production Supabase project through CI/CD
```

`supabase/migrations` is the committed schema source. Remote Supabase projects receive schema changes through reviewed migrations applied by CI/CD to named project IDs. A local terminal must not be the authority for staging or production database changes.

### Allowed Supabase Validation Uses

- Read repo migrations and generated schema/types.
- Inspect the linked remote Supabase project read-only through the VS Code Supabase extension or Supabase Dashboard SQL Editor when the active slice requires current remote evidence.
- Run `npx supabase@2.62.5 migration list --linked` or equivalent pinned CLI migration-history checks when the current machine cannot run the latest CLI.
- Run static migration checks that do not connect to a database.
- Run local Supabase CLI for disposable schema/dev validation.
- Run CI-owned migration validation against a fresh, isolated database created inside the CI job from synthetic fixtures only.
- Generate or verify checked-in DB types only through the approved CI/local-read protocol named by the active slice.

Local Supabase is allowed only as local validation. It must never be used as evidence of cloud-dev/production data shape, migration safety over existing data, or product-state correctness.

### Forbidden Local/Remote Supabase Uses

- No `supabase db reset` in agent-run product execution, local or remote.
- No `db reset` against any remote Supabase project.
- No `db push` from a developer or agent terminal to cloud-dev/staging/production.
- No Clickeen script may wrap or hide a reset/push command behind a friendly product-development command.
- No local script may silently switch from local Supabase to a remote project.
- No `DEV_UP_USE_REMOTE_SUPABASE=1` style runtime escape hatch in active product workflows.
- No dashboard schema edits as the normal path. If an emergency dashboard change occurs, it must be pulled into a migration and reconciled before product work continues.
- No agent may use local Docker Supabase data as evidence that remote product state is correct.
- No `supabase db pull` as a casual inspection command. It writes migration files and may convert unknown dashboard drift into source history before the team understands it.

### Required Remote Discipline

- Cloud-dev/staging and production must be separate Supabase projects.
- CI/CD must name the target project explicitly through secrets/variables.
- Migration application must be observable in CI logs and linked from the execution slice.
- Remote inspection, when needed, must be read-only unless the active PRD slice explicitly authorizes a migration deployment.
- Production migration must have an explicit promotion step from the already-green staging/cloud-dev migration.
- Supabase migration deployment is manual-dispatch CI only for this pivot. The active workflow is `.github/workflows/supabase-migrations.yml`.
- The workflow requires an explicit `cloud-dev` target and `APPLY_MIGRATIONS` confirmation. It uses the existing cloud-dev runtime naming boundary: GitHub's `SUPABASE_URL_CLOUD_DEV` repo variable becomes workflow `SUPABASE_URL`, matching the app/runtime env name. The project ref is derived from that URL.
- The only additional CI credentials are the Supabase CLI deployment credentials required to apply migrations: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. These are not product/runtime secrets and must not be read by Roma, Bob, Tokyo, San Francisco, or Berlin runtime code.
- Production migration dispatch is intentionally not exposed until cloud-dev schema proof is green and the production target is explicitly configured.
- The workflow runs the PRD 103 DB pivot guard before linking or applying migrations.
- No push-triggered workflow may apply Supabase migrations during this pivot.

This is a hard correction to the old Clickeen bootstrapping pattern. `scripts/dev-up.sh` and similar local scripts may remain only after they are audited and stripped of database lifecycle authority. They must not start, reset, migrate, switch, seed, or manage Supabase as part of product execution.

Current audit result:

- `scripts/dev-up.sh` no longer starts local Supabase, runs `supabase migration up`, loads env from `supabase status`, seeds Supabase, or switches targets. It reads explicit Supabase env and refuses to manage database lifecycle.
- `scripts/dev/local-supabase.mjs` was deleted because it existed only to read local Supabase status and support `DEV_UP_USE_REMOTE_SUPABASE` target switching.
- `scripts/dev-up.sh` still builds Dieter and i18n artifacts as explicit non-DB chores. Do not preserve or re-add DB lifecycle control just to keep Dieter generation convenient.
- DevStudio is a standalone local Vite toolbench (`pnpm dev:admin` / `pnpm --filter @clickeen/devstudio dev`). It should not require `dev-up`, Supabase lifecycle, or a fake product account stack just to run Dieter previews, component docs, ck-policy matrix tools, or local utility pages.
- `.github/workflows/supabase-migrations.yml` is the only approved deploy lane for reviewed Supabase migrations in this pivot. It is manual, target-scoped, environment-scoped, and guard-gated.
- `pnpm lint` runs `scripts/verify/prd103-db-pivot-guard.mjs`, and the PR architecture gate now runs when `supabase/**` changes.

### Allowed Cloudflare Storage Uses

- Public generated artifacts under the public serving path.
- Widget runtime/source assets that are release-owned, static, and cacheable.
- Customer uploaded binary assets and derived asset renditions.
- Private whole-document payloads only when Tokyo owns them behind product operations and the active slice names ownership, transaction/update behavior, and rebuild/delete behavior.

### Forbidden Cloudflare Storage Uses

- `instance.json`, `instance.config.json`, or `instance.content.json` as product API contracts, cross-service discovery targets, or account listing truth.
- `accounts/{accountId}/instances/index.json` as account listing truth.
- overlay inventory JSON.
- selected/current overlay pointer JSON.
- workflow/status truth stored as a field inside a blob nobody indexes.
- `index.html` presence as publish state.
- generated catalog/manifest JSON as product authority.
- service A writing a file so service B can discover product work by listing/reading that file.
- D1 as an undeclared second canonical store for account/instance/translation/publish state.

## Simple Database Product Model

A database is tables and columns. This pivot must not replace storage-object confusion with SQL-shaped confusion.

The Supabase product model has only three domains:

1. **Accounts** - tenants, status/tier policy input, invitations, and later account roll-ups.
2. **Users** - humans, account association, role, and person preferences. One user belongs to one account.
3. **Instance State** - durable account-owned instances and the minimum control state needed to list, open, gate, publish, and coordinate translation generation.

Every table must belong to one of those domains. If a table cannot be explained as Accounts, Users, or Instance State, it is a delete candidate. If a table belongs to one of those domains but only exists because of old scaffolding, dashboard repair work, local bootstrap, or speculative future features, it must be merged, deleted, or explicitly deferred outside active product state.

### Column Value Discipline

The DB pivot must not replace JSON vocabulary drift with free-text SQL vocabulary drift.

Rules:

- closed Clickeen vocabularies use database enum types;
- global standards use normalized values and shared validators before write;
- human names stay plain text;
- open product catalog references stay text only when another Clickeen authority owns the catalog.

Approved closed vocabularies:

- `account_status`: `active`, `suspended`;
- `account_tier`: `free`, `tier1`, `tier2`, `tier3`;
- `user_role`: `owner`, `admin`, `editor`, `viewer`;
- `invitation_status`: `pending`, `accepted`, `revoked`;
- `instance_publish_status`: `unpublished`, `published`;
- `instance_translation_status`: `idle`, `queued`, `running`, `failed`.

Approved normalized standards:

- `primary_email`: `citext`, globally unique;
- `primary_language`: BCP 47 language tag such as `en`, `en-US`, `it`;
- `country`: ISO 3166-1 alpha-2 uppercase code such as `US`, `IT`, `GB`;
- `timezone`: IANA timezone such as `America/New_York` or `Europe/Rome`;
- `phone` and `whatsapp`: E.164 numbers such as `+14155552671`.

`widget_type` remains text because Tokyo widget products are the authority. Adding a new widget product must not require a database enum migration. Tokyo must resolve `widget_type` against its widget product definitions before creating or opening an instance.

### Target V1 Tables

The target v1 schema should be this small unless 103_DB.1 proves a specific product invariant requires one more table.

#### Accounts

`accounts`

- one row per Clickeen account/tenant;
- owns one account identity, status, current status lifecycle clock, tier policy input, selected target locales, locale policy, and creation timestamp;
- does not own profile/display fields, publish booleans, or internal/platform flags in v1;
- written by Berlin for account lifecycle/settings;
- read by Berlin for auth/bootstrap/account settings and by Tokyo through product operations when instance work needs account policy/locale context.

Account deletion is an operation, not a retained `closed` status. Closed/deleted free accounts must not accumulate as operational rows plus owned storage. Deletion must clean the account row and owned product data/artifacts according to the deletion policy.

`ck-policy` remains the entitlement engine. `accounts.tier` is only its input. Limits, model profile, locale allowance, feature gates, and branding entitlements must not be duplicated into account columns.

Locale split: available locale count/allowance comes from `ck-policy`; selected target locales and base/source locale behavior are account settings on `accounts`. They are not entitlement columns.

Account tier/status history is not a DB table in V1. Berlin writes cold account-owned history to `accounts/{accountId}/account-history.jsonl`. Current truth remains `accounts.status` and `accounts.tier`; history is not used to gate product behavior and is deleted with the account unless a separate legal/billing retention policy extracts a record.

`account_invitations`

- one row per pending or historical invitation;
- owns invited email, target role, status, expiry, accepted/revoked timestamps;
- written/read by Berlin team invitation operations;
- approved in V1 because Invite Members is an active product feature.
- must reject an invite/add request when the invited email already exists in `users.primary_email`.

#### Users

`users`

- one row per human Clickeen user;
- owns the user's account association, role, accepted/current profile fields, and creation timestamp;
- enforces the product invariant that one user belongs to one account;
- written by Berlin during login/reconcile and invitation acceptance;
- read by Berlin for login, bootstrap, invitation matching, user/team UI, and account authz context;
- does not own provider profile snapshots, connector payloads, raw OAuth payloads, or active-account preference.

V1 `users` columns:

| Column | Meaning |
| --- | --- |
| `user_id` | Internal human id. |
| `account_id` | The one account this user belongs to. Required. |
| `role` | User role in that account: `owner`, `admin`, `editor`, or `viewer`. |
| `primary_email` | Accepted/current primary email. Globally unique. |
| `first_name` | Optional person profile/display field. |
| `middle_name` | Optional person profile/display field. |
| `last_name` | Optional person profile/display field. |
| `primary_language` | BCP 47 person preference for product/user communication. |
| `country` | ISO 3166-1 alpha-2 person country preference/profile field. |
| `timezone` | IANA person timezone preference/profile field. |
| `phone` | Accepted/current E.164 phone number. No `_verified` duplicate. |
| `whatsapp` | Accepted/current E.164 WhatsApp number. No `_verified` duplicate. |
| `created_at` | User creation time. |

The parent PRD does not approve any extra login/auth/connector table. Berlin auth/profile/contact/provider scaffolding must be audited before implementation. `login_identities`, contact-method tables, verification tables, provider profile snapshots, active-account preference fields, and connector/account-connection persistence are delete/defer candidates unless a separate Berlin auth/connector PRD proves they are required.

Provider vocabulary is locked:

- `Login Method` proves the human can sign in.
- `Account Connection` grants the Clickeen account access to an external provider/source.
- `Connection Resource` is a selectable external source under an account connection.
- `Widget Source` is a widget instance's reference to a connection resource.

Login can suggest; connector must authorize. A Google login can create the first user/account and later suggest "use this Google account" during Google Business Profile connection, but it must not silently become a Google Reviews/GBP connector. Connector scopes require explicit authorization and produce account-owned connection/resource state outside `users`.

`account_members` does not survive as core truth. Role lives on `users` because a user belongs to exactly one account. Agency is account-to-account roll-up, not user-to-many-accounts membership.

#### Instance State

`instances`

- one row per durable account-owned instance;
- owns only the instance registry/control columns listed below;
- written by Tokyo on create, rename, publish/unpublish, delete, and coarse translation-status transitions;
- read by Tokyo for list/open/save/generate/publish gates;
- read indirectly by Roma/Bob only through Tokyo product operations;
- does not store authored widget payloads, translated values, locale readiness counts, job history, generated file metadata, or storage object paths in v1.

Why this table exists:

- Roma needs to answer "which instances belong to this account?" without listing Cloudflare objects or reading generated index files.
- Tokyo needs one cheap ownership/control row before opening, saving, translating, publishing, or deleting an instance.
- The product needs a deterministic place for publish state and coarse Generate state that is not inferred from public files, overlay inventories, or spinner-local state.
- Entitlement gates need account-level counts and ownership joins without walking storage.
- The row is intentionally small so the database does not become the home for every widget string, translated value, or public artifact.

V1 `instances` columns:

| Column | Meaning |
| --- | --- |
| `id` | Existing Tokyo `instanceId`. Same value as the current folder segment under `accounts/{accountId}/instances/{instanceId}` and Roma route `/builder/{instanceId}`. No new UUID or surrogate id in v1. |
| `account_id` | Account that owns the instance. Needed for account listing, opening, authorization containment, and entitlement gates. |
| `widget_type` | Product widget type such as `faq`, `countdown`, or `logoshowcase`. `widgetCode` and `widget_key` do not survive in the DB model. |
| `publish_status` | Product publish state: `unpublished` or `published`. This is the user's/product's publish intent/state, not entitlement, not current serving eligibility, and not artifact readiness. Billing and tier policy may materialize fewer public artifacts without rewriting user publish intent. |
| `translation_status` | Coarse Generate state for Roma/Bob: `idle`, `queued`, `running`, or `failed`. It is not locale readiness, not a progress counter, and not translation history. |
| `created_at` | Creation time. |
| `edited_at` | Last user edit to instance name/content/config/settings. Queue, translation, and publish worker noise must not update this column. |

No other `instances` columns are approved by this PRD. Additions require a concrete product reader, product writer, lifecycle, and cost reason.

Conditional/non-v1 instance tables:

- No `instance_locale_values` table in v1 unless 103_DB.1 proves Tokyo cannot provide deterministic translated-locale preview/readiness without it at lower cost than Tokyo-owned payload storage.
- No `instance_translation_jobs` table in v1 unless 103_DB.1 proves a separate job-history or per-locale query product need. The first fix is the coarse `instances.translation_status` control state plus Tokyo-owned Generate operation semantics.
- No materialization table in v1 unless 103_DB.1 proves publish needs historical attempts, multiple concurrent builds, or independently queryable artifact-build records.

### Tables That Do Not Survive By Default

- `widgets`: deleted. Widget definitions live in Tokyo/repo/static widget source and are exposed through Tokyo widget-definition operations.
- `account_commercial_overrides`: delete/defer unless an active product operation proves it is needed. Do not merge limit overrides into core `accounts`; `ck-policy` remains the entitlement resolver.
- `internal_control_events`: delete or defer unless an active audit/admin product reads/writes it.
- `account_publish_containment`: delete/defer unless a named billing/status operation proves it is needed. Publish/serving containment should be expressed through account status/tier plus Tokyo materialization operations, not a vague second account flag.
- `account_members`: deleted as core truth. User account association and role live on `users`.
- `user_contact_methods` and `user_contact_verifications`: delete unless non-provider contact verification is active product.

## Target Model

### Supabase Product Tables

The exact migration may adjust column names to the current schema, but it must preserve the simple Accounts / Users / Instance State model above:

| Concern | Supabase authority | Notes |
| --- | --- | --- |
| Account locale settings | `accounts.selected_target_locales`, `accounts.locale_policy` | Roma settings writes them through Berlin. `ck-policy` still controls allowance/caps; these columns hold user selection and base/source locale behavior only. |
| Account instance registry | `instances` | One row per real account-owned instance. Owns only `id`, `account_id`, `widget_type`, `publish_status`, `translation_status`, `created_at`, and `edited_at` in v1. Instance display/name/title remains in Tokyo-owned payload/config. |
| Instance authored payload | Tokyo product operation | Payload may remain whole-document storage behind Tokyo in v1. Roma/Bob/San Francisco must not read storage files directly or use storage paths as product identity. |
| Translated locale values | Tokyo product operation | Payload may remain Tokyo-owned whole-value storage in v1. No overlay ID, selected pointer, or inventory product concept. DB rows are not approved unless 103_DB.1 proves a product/cost need. |
| Translation generation state | `instances.translation_status` plus Tokyo Generate operation | V1 stores only coarse panel/button liveness state. Sync truth is Tokyo-owned saved-base-content marker comparison per PRD 103K. No progress counters, locale rows, job history, or model audit fields unless a later slice proves the product needs them. |
| Publish state | `instances.publish_status` | Product publish intent/state. Public file existence is not status. Billing/tier serving suppression is materialized by Tokyo without changing publish intent. Artifact build details stay private to the materialization operation unless a later slice proves a separate state primitive is needed. |
| Widget definitions | product operation owned by Tokyo | Backing may be repo/static source or DB. Roma calls Tokyo for widget definitions; it does not fetch generated R2 catalog JSON. |

This PRD intentionally does not move config, content, translated values, or per-locale readiness payloads into Supabase by default. That was the old "everything in DB" mistake in a new form. Payload movement is allowed only when a slice proves it removes product complexity without creating a DB cost trap at scale.

Generate sync/stale-work guard:

- Tokyo accepts Generate against the current saved base content marker.
- Tokyo records the private marker for that accepted work in the queue/private payload, derived from the saved authored text input it is about to translate.
- Repeated Generate for the same active marker returns the active generation and does not replace it.
- Generate while another generation is active for the same instance is rejected or returns active state; it does not create competing generations.
- San Francisco results are applied only through Tokyo.
- Tokyo applies results only if they still match the current saved base content marker.
- Marker mismatch is reported as base content changed / translations out of sync and must not overwrite newer saved text, reset `translation_status`, or recreate old translated values.

This guard is not an approved DB column in V1. It is the minimum private Tokyo operation check needed so async translation work cannot corrupt newer user edits and cannot discard valid same-marker translations.

### Worker-To-Database Access

Tokyo-worker is the primary service boundary for account instance product state.

The preferred production access path is:

```text
Tokyo-worker -> Hyperdrive binding -> Supabase Postgres
```

Roma and Bob should not bypass Tokyo to read/write instance state. San Francisco should complete translation work through Tokyo product operations, not by writing Supabase rows directly, unless a later execution slice explicitly assigns a narrow worker-owned transaction boundary.

If 103_DB.1 discovers existing Supabase access in Roma, Berlin, or another service, that access must be classified as one of:

- real ownership that survives outside the account-instance path;
- temporary migration/read path to delete;
- auth/account path already owned by that service;
- violation to move behind Tokyo or Berlin.

The target is not "all services can query Supabase." The target is one operational source of truth with named product owners.

Worker DB calls must have boring production guardrails:

- statement timeout and transaction timeout configured for Tokyo/Berlin Worker DB access;
- retry only idempotent reads and known safe serialization/connection failures;
- no retry for non-idempotent mutations unless the operation is explicitly idempotent by key;
- p95 and p99 latency targets recorded for list/open/save/generate/publish control-state queries;
- mutation gates fail closed if account/user/instance ownership cannot be proven from DB state.

### R2 Public Artifact Model

R2/CDN stores public artifacts that can be deleted and rebuilt from Tokyo-owned product state plus release-owned widget/runtime source.

Examples:

```text
clk.live/{accountId}/{instanceId}/index.html
clk.live/{accountId}/{instanceId}/styles.css
clk.live/{accountId}/{instanceId}/script.js
clk.live/{accountId}/{instanceId}/{locale}.html
```

Those files are not authoring source. They are not readiness state. They are not the account listing. They are not the translated locale inventory.

### Publish Boundary

Publish/materialization is the bridge:

1. Tokyo reads account instance registry/control state from Supabase and authored/translated payloads from the Tokyo-owned payload source approved by the active slice.
2. The materializer builds static visitor artifacts.
3. The materializer writes artifacts to R2/CDN keys.
4. Publish/unpublish updates `instances.publish_status` only through the approved publish/unpublish product operation.
5. Public serving reads R2/CDN only.

Materialization must be idempotent and failure-safe:

- write new artifacts to inactive/versioned keys first;
- verify the required artifact set before swapping the public entrypoint;
- leave the previous public artifacts serving if the new materialization fails;
- retry only idempotent materialization work;
- reconcile any partial R2 writes from Tokyo-owned state;
- never set `instances.publish_status = published` as proof that all R2 writes succeeded unless the publish operation has completed its materialization contract.

`applyFreeTierServing` and `restorePaidTierServing` use the same materialization discipline. They change which published artifacts are publicly served according to account policy; they do not rewrite the user's instance publish intent.

The user-facing product may choose queued materialization only after a later slice names the state primitive. Until then, this PRD does not approve new materialization status columns or tables.

## Scope

In scope:

- design and migrate account instance registry/control state from storage-object discovery into Supabase-owned product rows;
- choose and wire the concrete Worker-to-Supabase access path, with Hyperdrive as the default production decision;
- move only coarse translation state needed by Roma/Bob into `instances.translation_status`;
- delete overlay inventory, selected pointer, account instance index, and instance source JSON as product contracts;
- replace app-to-storage coordination with product operations backed by minimal DB control state;
- define the materialization worker boundary from DB state to R2 public artifacts;
- update Roma/Bob/Tokyo/San Francisco docs and tests so no product path speaks storage-object vocabulary;
- migrate current dev/admin instances and widget data needed for the live product path;
- add guards that prevent R2 operational-state regressions.

Out of scope:

- rewriting public serving away from R2/CDN;
- moving images, fonts, binary assets, or public generated HTML/CSS/JS into Supabase;
- introducing D1 as canonical account/instance/translation/publish state;
- adding marketplace/starter-instance product features beyond the migration needed to keep current widgets usable;
- preserving legacy R2 account source files as a supported product mode;
- preserving local Supabase/Docker scripts as database lifecycle or remote database management paths;
- new translation UX beyond the PRD 103K saved-base-content sync banner/button model and deterministic Tokyo-backed Generate/readiness model with DB-backed coarse state.

## Non-Negotiables

- No compatibility mode where Roma/Bob/San Francisco can choose between DB registry state and R2 listing/file state as co-equal product truth.
- No "legacy instance.json" product fallback.
- No service may list/read R2 objects to answer an application query that should be a SQL query.
- No workflow state in unindexed blobs.
- No public artifact file presence as product status.
- No raw storage object IDs in Roma/Bob/San Francisco product payloads.
- No widget payload, translated value, locale readiness, or job-history table unless a slice proves the product reader, writer, lifecycle, and cost reason.
- No D1-backed shadow product state.
- No local Docker Supabase workflow as an operational product workflow.
- No `supabase db reset` in agent-run product execution, even against a local database.
- No script-controlled local/remote Supabase switching in active product execution.
- No remote Supabase schema/data mutation from an agent terminal outside the migration/CI path.
- No direct service-to-Supabase free-for-all. Product ownership still belongs to named service operations.
- Invalid state fails at the named product boundary. It is not silently healed into a new normal.

## Acceptance Criteria

- Roma lists, opens, saves, renames, duplicates, deletes, publishes, and unpublishes account instances through product operations backed by the `instances` registry/control row where applicable.
- Bob receives one instance working copy from Roma and never sees R2 source filenames or overlay IDs.
- Tokyo owns DB transactions for instance registry/control state. Tokyo owns authored payloads, translated locale values, translation generation semantics, and materialization behind product operations.
- Tokyo-worker connects to Supabase Postgres through the approved access path, preferably Hyperdrive, with config documented.
- San Francisco translation workers receive jobs from the named queue/job source and report outcomes through Tokyo product operations. San Francisco does not write instance DB state directly in v1.
- Generate is deterministic: repeated Generate for the same active saved base content marker returns active state instead of replacing work; Generate is disabled while active in Bob; `instances.translation_status` gives Roma/Bob coarse button/liveness state.
- Changed/missing translation work is resolved by Tokyo from the approved authored payload source. Roma/Bob must not derive it from storage siblings or overlay inventories.
- Translation readiness is returned by Tokyo product operations, not overlay inventory JSON. DB locale rows are not required unless 103_DB.1 proves they are needed.
- Publish writes public artifacts to R2 from Tokyo-owned state and updates `instances.publish_status` through the publish/unpublish product operation.
- Public serving reads only public artifacts from R2/CDN.
- `instance.json`, `instance.config.json`, `instance.content.json`, overlay inventory, selected pointer, and account index JSON are gone from active product contracts, even if private payload storage remains behind Tokyo during v1.
- D1 is not used as canonical product state.
- Local Supabase/Docker flow is removed from agent-run product execution; remote schema changes run through migrations and CI/CD.
- Docs and guards encode the doctrine: minimum queryable control state in Supabase, Tokyo-owned payloads behind product operations, public artifacts in R2.

## Verification

Each execution slice must include:

- schema/migration proof or explicit no-schema-needed proof;
- concrete Supabase access proof, including Hyperdrive binding/config proof when the slice touches Worker DB access;
- environment-management proof: named cloud-dev/staging/prod target, CI migration path, and no local reset/push/remote-mutation command;
- targeted Tokyo/Roma/Bob/San Francisco tests for the product operation changed;
- migration proof for current admin/dev instances;
- negative tests proving deleted R2 product contracts are not called;
- negative tests or grep guards proving no D1-backed account/instance/translation/publish state was introduced;
- negative tests or grep guards proving local scripts cannot reset, push, migrate, seed, or silently target any Supabase project;
- doc updates before slice closure;
- `git diff --check`;
- relevant lint/typecheck/test commands named in the execution ledger.

PRD 103 runtime work may resume only after this DB pivot is green and the architecture docs no longer teach Cloudflare storage objects as application coordination state.
