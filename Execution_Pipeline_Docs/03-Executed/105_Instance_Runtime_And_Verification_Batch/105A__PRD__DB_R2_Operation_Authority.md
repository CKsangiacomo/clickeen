# PRD 105A - DB/R2 Operation Authority

Status: Green / contract verified
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`

## Purpose

Extract the surviving DB Pivot doctrine into a small PRD 105 execution slice.

This PRD keeps the good correction from the 103_DB foundation batch and discards the authority confusion around old files. It exists so future implementation follows one clean rule:

```text
Supabase owns tiny queryable operational/control facts.
Tokyo owns product operations.
R2 owns instance source, overlays, assets, and generated public artifacts.
No R2 JSON object acts as an application database, job ledger, pointer, inventory, or workflow controller.
```

## Source Documents Reviewed

This PRD extracts from the first 103_DB foundation batch:

```text
103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md
103_DB_Pivot__EXEC__Operational_State_In_Supabase_Public_Artifacts_In_R2.md
103_DB_Current_Supabase_Inventory__PRD__Remote_DB_Audit_Gate.md
103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md
103_DB_Berlin_Auth_Connector__AUDIT__Users_Login_Connector_Map.md
103_DB_Product_Model_Evidence_Lock__AUDIT__Table_R2_Operation_Map.md
```

Those documents are historical evidence after this extraction. They must not remain active execution authority.

## Surviving Authority

### Supabase

Supabase Postgres owns only the minimum queryable facts needed for product operations:

- account existence and current status/tier;
- user existence, one-account association, role, and login mapping;
- invitation lifecycle;
- instance existence, account owner, widget type, publish state, coarse translation liveness, and timestamps;
- any future operational fact that must be listed, joined, transactionally gated, or coordinated across requests.

Supabase must not own by default:

- widget source payloads;
- instance text/config payloads;
- translated value maps;
- generated HTML/CSS/JS;
- account assets;
- public embed files;
- per-locale progress rows;
- job-history tables;
- storage object pointers.

### Tokyo

Tokyo owns product operations over account instances:

- list/open/create/duplicate/rename/save/delete instance;
- read/write instance source;
- read/write locale overlays;
- generate translations;
- receive San Francisco completion/failure reports;
- publish/unpublish/materialize public artifacts.

Roma, Bob, San Francisco, Prague, and Venice must not bypass Tokyo to coordinate instance product state.

### R2

R2 owns product source and generated/static artifacts named by PRD 105:

```text
accounts/{accountPublicId}/assets/{assetRef}

accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/locales/{locale}.json
  index.html
  styles.css
  runtime.js
```

R2 may hold large product payloads when accessed through Tokyo operations. R2 must not become cross-service IPC or operation truth.

## Extracted Rules To Keep

- Supabase is the canonical operational database for this pivot.
- D1 must not be introduced as canonical account, user, instance, translation, or publish state.
- Public serving must not hit Supabase.
- Public artifact presence must not define authoring state, translation state, or publish state.
- `instances.publish_status` is product publish state; public files are materialized output.
- Instance listing must come from Tokyo/DB-backed product operations, not R2 account indexes.
- Widget definitions belong to repo/static Tokyo widget source exposed through Tokyo operations, not a Supabase `widgets` table.
- Local Supabase may be used only for disposable validation, not as remote product-state evidence.
- Agents must not run `supabase db reset`, `db push`, `db pull`, seed, or hidden local/remote target switching as product execution.
- Remote schema changes must go through reviewed migrations and the approved CI/deploy path.
- Login Method is not Account Connection.
- One user belongs to one account in V1.
- `account_members` is not V1 product truth.
- `is_platform` is not an account/core-auth truth and must not survive as a magic-id behavior flag.

## PRD 105 Corrections To Old 103_DB Language

The old 103_DB wording is amended by this PRD wherever it conflicts with PRD 105.

### Instance Source Files

Old confusing wording:

```text
instance.config.json / instance.content.json are gone from active product contracts.
```

Correct wording:

```text
instance.config.json and instance.content.json are canonical instance source files in R2.
They are not cross-service APIs, listing truth, or storage identities.
Services access them through Tokyo product operations.
```

### Locale/Public Artifact Shape

Old conflicting default:

```text
{locale}.html
script.{locale}.js
script.fr.js
fr.html
```

Correct default:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json
```

Static locale pages for SEO/GEO require a separate PRD. They are not the default Clickeen embed shape.

### Translation Operation State

Old tolerated shape:

```text
translation-generation-job.json as a detailed operation payload
```

Correct shape:

```text
No operation-controller JSON belongs inside the instance folder.
Translation liveness, queue production, retries, leases, and watchdogs belong in a real Tokyo-owned operation model outside the instance folder.
The durable translation result is overlays/locales/{locale}.json.
```

## Verification Scope

This sub-PRD is green only when code/docs are checked for the extracted rules.

Required checks:

- no active code treats R2 account index JSON as account instance listing truth;
- no active code reads/writes `instance.json` as a product fallback;
- no active code treats `translation-generation-job.json` as surviving operation truth;
- no active code exposes overlay ids, selected pointers, or storage paths as locale product identity;
- no active code treats public artifact presence as publish state;
- no active code uses Supabase `widgets` as widget-definition authority;
- no active code introduces D1 as canonical product state;
- no active script can reset, push, seed, or silently retarget Supabase during product execution;
- active docs name PRD 105 as instance folder authority;
- active docs do not present default `{locale}.html`, `script.{locale}.js`, or `translation-generation-job.json` as current architecture.

## Archive Decision For Source Batch

After this PRD is created, the first 103_DB foundation batch must move to `03-Executed` as historical evidence.

Required archive status:

```text
Executed historical evidence.
Surviving doctrine extracted to PRD 105A.
Superseded by PRD 105/105A where conflicting.
```

## Non-Scope

This PRD does not:

- implement translation runtime repair;
- move operation state into a new ledger/table/Durable Object;
- rename generated `script.js` runtime files in code;
- migrate R2 object keys;
- implement Prague launch work;
- change account coordinate migration;
- rewrite Bob UI.

## Execution Verification - 2026-05-28

Status: Superseded by final verification below.

Green evidence:

- Active docs now name PRD 105 as the instance-folder authority and no longer present default `{locale}.html`, `script.{locale}.js`, versioned script/style artifacts, translated-locale inventory folders, or `translation-generation-job.json` as current architecture.
- Active instance listing uses Supabase-backed registry operations, not R2 account indexes.
- Active widget-definition authority is repo/Tokyo widget source, not a Supabase `widgets` table.
- D1 appears only in San Francisco learning/telemetry surfaces, not as canonical account, instance, translation, or publish state.
- Publish status is owned by `instances.publish_status`; public visitor serving reads generated artifacts and does not query Supabase.
- Berlin no longer calls `account_members` from active member or invitation paths. Member role/delete operations now use `users`, and invitation acceptance attaches the accepting user to the invited account through `users.account_id`/`users.role`.

Verification commands run:

```bash
rg -n "account_members|/rest/v1/account_members" berlin/src roma/app roma/components scripts documentation/architecture documentation/services -S --glob '!**/node_modules/**'
pnpm --filter @clickeen/berlin typecheck
rg -n "translation-generation-job\\.json|accountInstanceTranslationGenerationJobKey|translatedValues|localeStatus" tokyo-worker/src/domains/render -S --glob '!**/node_modules/**'
```

Resolved blockers:

- RESOLVED BY `105M` Slice 2: Tokyo-worker translated-locale value truth and readiness now use `overlays/locales/{locale}.json`; `instance.content.json` no longer stores new field-level `localeStatus` or `translatedValues` maps.
- RESOLVED BY `105M` Slice 4: Tokyo-worker no longer has active R2 operation-controller JSON through `accountInstanceTranslationGenerationJobKey(...)`, `readCurrentTranslationGenerationJob(...)`, or `writeCurrentTranslationGenerationJob(...)`. Translation generation operation state now lives in Supabase `translation_generation_operations` and `translation_generation_operation_locales`.

Decision:

This PRD's authority split is now satisfied by the 105M execution spine. Keep this file as the DB/R2 operation-authority contract; do not use it as evidence that `translation-generation-job.json` still exists.

## Final Verification - 2026-05-30

Status: Green. `105A` is closed as the DB/R2 operation-authority contract.

The earlier red blockers are resolved by executed code, cloud cleanup, and tests:

- `105M` Slice 2 moved durable translated locale values and sync metadata to `overlays/locales/{locale}.json`.
- `105M` Slice 4 moved translation generation operation state to Supabase `translation_generation_operations` and `translation_generation_operation_locales`.
- `105L` Phase B deleted stale remote `translation-generation-job.json` objects from active CLICKEEN instance folders and deleted the old `accounts/00000001/**` prefix.
- The active public instance shape is `index.html`, `styles.css`, `runtime.js`, `instance.config.json`, `instance.content.json`, and optional `overlays/locales/{locale}.json`.

Important compatibility note:

`tokyo-worker/src/domains/render/saved-config.ts` still contains a legacy embedded-translation migration reader for old `field.translatedValues`, `field.localeStatus`, and `localeSync` payloads. That reader is not product truth. It exists only to migrate old embedded values into locale overlays and then clean the source document. The test `legacy embedded translated values migrate to locale overlays and clean content source` proves that behavior.

Verification commands:

```sh
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm verify:prd103-db-pivot
pnpm validate:widgets
rg -n "accountInstanceTranslationGenerationJobKey|readCurrentTranslationGenerationJob|writeCurrentTranslationGenerationJob|updateCurrentTranslationGenerationJob|TranslationGenerationJobDocument|TranslationGenerationJobBasis" tokyo-worker/src scripts packages bob roma sanfrancisco venice prague admin -S --glob '!**/node_modules/**'
```

Results:

```text
Tokyo-worker typecheck: passed
Tokyo-worker tests: passed, 59/59
PRD 103 DB pivot guard: passed
Widget validation: passed, 3 widget sources valid
R2 operation-controller symbol scan: no matches
```

Remote R2 evidence from `105L` Phase B:

```text
product stale keys: 0
account stale keys: 0
total delete candidates: 0
canonical active instance keys preserved: 15
```

Public smoke:

```text
UZ3JEJSHII root=200 runtime=200 styles=200 script=404 job=404 old=404
8FMVZFFPJV root=200 runtime=200 styles=200 script=404 job=404 old=404
H7IF9M2K9B root=200 runtime=200 styles=200 script=404 job=404 old=404
```

Archive status:

The 103_DB foundation batch named in this PRD is archived under:

```text
Execution_Pipeline_Docs/03-Executed/103_DB_Foundation_Batch/
```

Final decision:

`105A` is green. Supabase owns operational/control facts, Tokyo owns product operations, and R2 owns source/overlay/generated artifacts. No R2 JSON object is accepted as application database, job ledger, pointer, inventory, or workflow controller.
