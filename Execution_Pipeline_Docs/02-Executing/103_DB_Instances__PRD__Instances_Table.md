# PRD 103_DB Instances - Instance Registry And Control Table

Status: Planning child of active DB pivot
Owner: Tokyo
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: PRD 103 product execution that depends on listing/opening/saving/translating/publishing instances

## Purpose

Create the `instances` table as the single deterministic registry/control row for account-owned instances.

This PRD does not move widget content, config payloads, translated values, generated files, or locale readiness payloads into Supabase. It moves only the small facts the application must query or gate:

- which durable instances exist;
- which account owns each instance;
- which widget product each instance uses;
- whether the instance is intended to be published by product state;
- whether translation generation is idle, queued, running, or failed;
- when the instance was created;
- when the user last edited the instance.

## Product Why

Roma currently needs to show "which instances belong to this account" and open a selected instance. That must be a database query through Tokyo, not a generated account index file, R2 listing, source JSON file, or public artifact check.

Tokyo currently needs to decide whether an account may open, save, translate, publish, unpublish, rename, duplicate, or delete an instance. That needs one account-scoped control row, not scattered storage-object state.

Translation generation needs coarse product state for the panel and button. The product should know whether Generate is idle, queued, running, or failed without inferring from browser spinner state, overlay inventory files, or partial object writes.

Publish needs product state. Public `index.html` existence is an artifact, not the truth that an instance is published.

## Product What

An instance is a durable account-owned Clickeen object created from a widget product.

Examples:

- an FAQ instance owned by the Clickeen admin account;
- a Countdown instance owned by a customer account;
- a Logo showcase instance owned by a customer account.

An instance is not the widget software itself. Widget software lives in Tokyo product source. The instance row points to the widget product by `widget_type` and tracks the account-owned object.

An instance is not a MiniBob/funnel mirror. Admin-owned instances can be used as templates. Creating a customer instance from a template means Tokyo duplicates an admin-owned instance into the target account.

## Product How

All instance row writes go through Tokyo product operations.

Roma and Bob never write the table directly. Roma calls Tokyo with the active account context from Berlin. Bob receives the working instance through Roma/Tokyo product operations.

San Francisco does not write instance rows directly. Translation work reports back through Tokyo, and Tokyo updates the coarse `translation_status`.

Public serving does not read this table. Public serving reads R2/CDN artifacts only.

## Table

`instances`

One row per durable account-owned instance.

| Column | Type | Writer | Reader | Use |
| --- | --- | --- | --- | --- |
| `id` | text | Tokyo | Tokyo, Roma through Tokyo | Existing Tokyo `instanceId`. Same value as current route `/builder/{instanceId}` and current instance path segment. Immutable after create. |
| `account_id` | text | Tokyo | Tokyo, Berlin-derived authorization checks through Tokyo | The same compact account id used by Tokyo folders: `accounts/{accountId}/instances/{instanceId}`. Owns containment. Used for account-scoped listing, open/save/generate/publish/delete authorization, and entitlement counts. Immutable after create. |
| `widget_type` | text | Tokyo | Tokyo, Roma/Bob through Tokyo | Product widget type such as `faq`, `countdown`, or `logoshowcase`. Used to load the correct widget definition/editor/runtime path. Immutable after create. |
| `publish_status` | `instance_publish_status` | Tokyo | Tokyo, Roma/Bob through Tokyo | Product publish state: `unpublished` or `published`. Updated only by publish/unpublish product operations. This is not current serving eligibility; billing/tier materialization may serve less than paid-tier output without rewriting publish intent. |
| `translation_status` | `instance_translation_status` | Tokyo | Tokyo, Roma/Bob through Tokyo | Coarse Generate state: `idle`, `queued`, `running`, or `failed`. Used by the translation panel/button. Not readiness, not progress, not history. |
| `created_at` | timestamptz | Tokyo | Tokyo, Roma/Bob through Tokyo | Creation timestamp. Written once. Used for sorting, audit/debug, and migration verification. |
| `edited_at` | timestamptz | Tokyo | Tokyo, Roma/Bob through Tokyo | Last user edit timestamp. Updated on rename and user save of content/config/settings. Translation workers and artifact materialization do not update it. |

Approved values:

- `instance_publish_status`: `unpublished`, `published`
- `instance_translation_status`: `idle`, `queued`, `running`, `failed`

`publish_status` and `translation_status` must not be open text. They are shared Clickeen product vocabularies and must be represented by DB enum types owned by the migration:

```sql
create type instance_publish_status as enum ('unpublished', 'published');
create type instance_translation_status as enum ('idle', 'queued', 'running', 'failed');
```

`widget_type` remains text because Tokyo widget products are the authority. Tokyo must resolve `widget_type` against its widget product definitions before creating/opening an instance. Adding a new widget product must not require a DB enum migration.

No other columns are approved in V1.

## Indexes

Required V1 indexes:

```sql
primary key (id);
create index instances_account_edited_idx on instances (account_id, edited_at desc, id);
create index instances_account_widget_type_idx on instances (account_id, widget_type);
create index instances_account_published_idx on instances (account_id, id) where publish_status = 'published';
```

Why these indexes exist:

- `(account_id, edited_at desc, id)` supports the normal Roma widget list without a global scan.
- `(account_id, widget_type)` supports account-scoped entitlement/count gates by widget product.
- `instances_account_published_idx` supports account-scoped published limit probes and free-tier serving materialization without indexing every unpublished row.

No global product path may list all instances.

## Create Flow

Tokyo creates the row.

Supported creation paths:

- Roma user clicks Create FAQ/Countdown/Logo Showcase.
- Roma user duplicates an existing account-owned instance.
- Roma/user flow creates from an admin-owned template instance by calling `duplicateInstanceFromTemplate`.
- One-shot migration creates rows for existing current instances.

Flow:

1. Berlin gives Roma the active account context.
2. Roma calls Tokyo create, duplicate, or `duplicateInstanceFromTemplate` with account context and requested widget type/template.
3. Tokyo generates or reuses the correct `instanceId`.
4. Tokyo writes the `instances` row.
5. Tokyo initializes the authored payload through its own product operation.
6. Roma opens the created instance by `id`.

## Write Ownership

| Operation | Column writes |
| --- | --- |
| Create | `id`, `account_id`, `widget_type`, `publish_status = unpublished`, `translation_status = idle`, `created_at`, `edited_at` |
| Duplicate same-account instance | new `id`, same `account_id`, same `widget_type`, `publish_status = unpublished`, `translation_status = idle`, new `created_at`, new `edited_at` |
| Duplicate admin template into account | new `id`, target `account_id`, template `widget_type`, `publish_status = unpublished`, `translation_status = idle`, new `created_at`, new `edited_at` |
| Rename/edit instance label | `edited_at`; editable label/name lives in Tokyo-owned instance payload/config, not in this table |
| User save content/config/settings | `edited_at`; authored payload is updated behind Tokyo operation, not in this table |
| Generate accepted | `translation_status = queued` after Tokyo accepts the request and records the private source fingerprint/job handoff |
| Generate worker starts | `translation_status = running` if Tokyo tracks worker-start state in V1 |
| Generate completes successfully | `translation_status = idle` |
| Generate fails | `translation_status = failed` |
| Publish | `publish_status = published` after the publish operation completes according to the publish contract |
| Apply free-tier serving | no `publish_status` change; Tokyo rematerializes public artifacts according to free-tier policy |
| Restore paid-tier serving | no `publish_status` change; Tokyo rematerializes public artifacts according to restored tier policy |
| Delete | delete the row and owned Tokyo payloads/artifacts/assets according to the delete operation contract |

## Read Ownership

Tokyo reads the row for:

- list account instances;
- open instance;
- save instance;
- rename instance;
- duplicate instance;
- delete instance;
- generate translations;
- publish/unpublish;
- entitlement gates.

Roma/Bob see this state only through Tokyo product operation responses.

Berlin owns account/user truth. Berlin does not own instance lifecycle.

San Francisco performs translation work. It reports outcomes through Tokyo. It does not read/write this table directly in V1.

## Scaling Model

The table is designed for hundreds of millions of rows by keeping rows narrow and every product query account-scoped.

This table improves operational efficiency by replacing storage-object coordination with one indexed product-control row:

- account listing becomes a Tokyo query by `account_id`, not R2 listing or generated account index JSON;
- open/save/generate/publish begin with one deterministic ownership check;
- product publish state comes from `publish_status`, not public `index.html` presence;
- coarse Generate state comes from `translation_status`, not browser-local spinner state or overlay inventory inference;
- entitlement checks count tiny rows, not storage objects or payload files.

This table stays cost-efficient only if it remains a control table. It must not become the home for widget payloads, translated values, generated artifacts, per-locale readiness, or job history.

Translation stale-work protection belongs inside the Tokyo Generate operation, not in extra DB columns:

- Generate snapshots/marks the saved authored text input that Tokyo accepted;
- workers return results through Tokyo;
- Tokyo applies results only if the current saved authored text input still matches the accepted work;
- stale results are discarded without overwriting translated values or resetting a newer Generate state.

No `translation_job_id`, `translation_error_key`, `sourceVersion`, or per-locale progress column is approved in `instances` for V1.

Hot product queries:

```sql
select id, account_id, widget_type, publish_status, translation_status, created_at, edited_at
from instances
where account_id = $1
  and (edited_at, id) < ($2, $3)
order by edited_at desc, id desc
limit $4;

select id, account_id, widget_type, publish_status, translation_status, created_at, edited_at
from instances
where id = $1 and account_id = $2;

select id
from instances
where account_id = $1 and widget_type = $2
limit $3;

select id
from instances
where account_id = $1 and publish_status = 'published'
limit $2;
```

For entitlement gates, prefer limit probes over exact counts unless the UI/product needs an exact number. Example: if policy allows five published instances, query six ids and decide whether the sixth exists. This keeps normal gates cheap at large scale.

The system must not:

- scan all instances;
- store widget payloads in this table;
- store translated values in this table;
- store generated artifact metadata in this table;
- update this table for public page traffic;
- update this table for per-locale translation progress such as "14/28 ready";
- update `edited_at` from background translation/materialization noise.

At very large scale, Postgres partitioning can be added behind the same Tokyo product operations. The product contract stays account-scoped.

## Migration

Migration creates one `instances` row for each current durable instance.

Migration source:

- current Tokyo/R2 instance identity and account path;
- current widget product type;
- current user-facing display name/label remains in Tokyo-owned payload/config and is not migrated into the DB row;
- current publish state if it exists as product truth;
- current coarse translation state only if it is reliable. Otherwise initialize `translation_status = idle`.

Migration must not create legacy compatibility branches in product code.

After migration:

- account instance listing reads the DB row through Tokyo;
- generated account index JSON is not product truth;
- source JSON files are not listing/open truth;
- widget payloads remain accessible only through Tokyo product operations.

## Deletion Targets

This PRD deletes or removes from active product paths:

- account instance index JSON as listing truth;
- R2 listing as account instance discovery;
- `instance.json`, `instance.config.json`, and `instance.content.json` as cross-service product contracts;
- any Roma/Bob code that constructs product state from storage object paths;
- any product fallback that treats legacy instance source files as co-equal truth.

Private payload storage behind Tokyo may survive in V1 only if it is not used as cross-service coordination and has an owner, update behavior, and delete/rebuild behavior documented by the executing slice.

## Non-Goals

- No `instance_locale_values` table.
- No `instance_translation_jobs` table.
- No generated artifact metadata table.
- No widget content/config columns.
- No display/name/title column.
- No translated value JSONB column.
- No `sourceVersion`.
- No `widgetCode`.
- No `widget_key`.
- No legacy `instance.json` fallback.
- No public serving DB read.

## Acceptance Criteria

- Tokyo creates `instances` rows for create, same-account duplicate, and `duplicateInstanceFromTemplate`.
- Existing current instances are migrated into rows.
- Roma lists account instances through Tokyo backed by `instances`.
- Opening an instance requires `id` and `account_id` match.
- Saving an instance updates `edited_at` and does not write content/config into `instances`.
- Generate updates only `translation_status` for coarse panel/button state.
- Publish/unpublish updates only `publish_status` for product publish state.
- `applyFreeTierServing` and `restorePaidTierServing` do not rewrite `publish_status`; they rematerialize serving output from account policy.
- Instance display/name/title remains in Tokyo-owned payload/config and is returned by Tokyo list/open operations when needed.
- Public artifact presence is not used as product state.
- No active product path reads generated account index JSON as instance listing truth.
- No active product path exposes storage paths, overlay IDs, or legacy source filenames to Roma/Bob as product identity.

## Rollback And Recovery

Pre-GA rollback is forward repair, not legacy instance-source fallback.

Before migration, export the current account/instance identity map and the Tokyo-owned payload/artifact keys needed to rebuild `instances` rows. If migration finds an instance without one account owner, unknown widget type, duplicate `id`, or unreliable publish state, abort or initialize only the safe approved default named by the execution slice. If a post-migration defect is found, repair the `instances` rows from the export and Tokyo-owned payloads. Do not restore generated account index JSON, R2 listing, or legacy `instance.json` as product truth.

## Verification

Required before this child PRD is green:

- schema migration file reviewed and applied through the approved Supabase CI/CD path;
- no local Supabase reset/push/seed workflow used;
- migration proof for current FAQ, Countdown, and Logo Showcase instances;
- Tokyo unit/integration tests for create/list/open/rename/save/generate/publish gates;
- Tokyo unit/integration tests for `duplicateInstanceFromTemplate`, `applyFreeTierServing`, `restorePaidTierServing`, and account deletion cleanup participation;
- Roma test or smoke proof that widget list/open uses Tokyo operation, not generated JSON;
- grep guard proving `widgetCode`, `widget_key`, `sourceVersion`, and legacy `instance.json` fallback are not introduced in the DB-backed instance path;
- `git diff --check`;
- relevant lint/typecheck/test commands recorded in the execution ledger.
