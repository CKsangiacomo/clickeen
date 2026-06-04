# PRD 105D - Translation Operation State And Smoke Verification

Status: Green / contract verified
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`, `105B__PRD__Core_DB_Model_Verification.md`, `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`

## Purpose

Extract the surviving translation-operation repair from the red 103_DB generation slice and the blocked end-to-end smoke gate.

This PRD exists because the old translation generation path mixed the wrong authorities:

```text
coarse DB liveness
random job lineage
R2 operation-controller JSON
Bob polling/copy
San Francisco completion callbacks
translated value payload storage
```

The corrected model must be simple:

```text
DB = coarse operation liveness plus the minimal durable translation operation ledger/outbox.
Tokyo = translation product operation and durable operation state.
San Francisco = translates and reports terminal locale outcomes to Tokyo.
R2 instance folder = source, overlays, assets, generated artifacts only.
Bob = reflects Tokyo product state.
```

## Source Documents Reviewed

This PRD extracts from:

```text
103_DB_Translation_Generation_Control_State__EXEC__Tokyo_Runtime_Wiring.md
103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md
```

Those documents become historical evidence after this extraction. They must not remain active execution authority.

## Product Contract

The product workflow is:

```text
User saves base content.
User opens Translations panel.
Bob asks Roma/Tokyo for translation product state.
Generate is enabled only when saved base content needs translation work and no generation is active.
Tokyo accepts or returns the active operation.
San Francisco translates locale work.
San Francisco reports terminal outcome to Tokyo.
Tokyo writes durable translated locale overlays and sync metadata.
Bob shows translated locale preview only when Tokyo says the locale is reviewable.
Publish/materialization writes public embed artifacts.
```

Save does not create public translation truth by itself. Generate does not create competing work. Public serving does not infer state from operation files.

## Surviving Rules To Keep

- `instances.translation_status` survives only as coarse liveness: `idle`, `queued`, `running`, `failed`.
- `translation_status` is not sync truth, readiness truth, progress, history, or job identity.
- detailed active operation identity, per-locale terminal facts, enqueue state, timeout basis, and callback idempotency live in the minimal Supabase operation ledger/outbox defined below.
- Tokyo owns Generate, complete, fail, timeout, and stale-completion decisions.
- San Francisco reports outcomes through Tokyo.
- Bob/Roma read translation state through Tokyo product operations.
- Bob must not infer translation state from local spinners, queue messages, storage inventory, overlay files, or public artifacts.
- Generate while any generation is active must not create competing work.
- Completion applies only when the worker result still matches the saved base content authority.
- Stale completion is terminal for San Francisco and must not create retry churn.
- No broad job-history system, progress dashboard, or analytics table is approved by default.
- No operation-controller JSON belongs in the instance folder.

## PRD 105 Translation Storage Contract

Durable translated locale output belongs under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Operation liveness and backend coordination do not belong there.

Forbidden instance-folder operation files:

```text
translation-generation-job.json
generation.json
queue.json
status.json
worker-state.json
retry-state.json
```

Detailed operation state beyond `instances.translation_status` must use the Supabase-backed operation ledger/outbox below. `105M` owns implementation, not the decision of whether this exists.

Required minimal implementation direction:

- one operation row per accepted generation request;
- one per-locale row per target locale in that operation;
- per-locale enqueue state lives on the per-locale row unless execution proves a separate outbox table is simpler;
- `instances.translation_status` mirrors coarse liveness only.

R2 instance JSON cannot be that store.

## Coarse Status Mapping Invariant

Tokyo must keep the operation ledger and the instance registry aligned through this small mapping:

| Operation ledger state | `instances.translation_status` | Meaning |
| --- | --- | --- |
| no active operation | `idle` | Generate is available unless content/account policy blocks it |
| `queued` | `queued` | Tokyo accepted generation and is enqueueing or waiting for first locale result |
| `running` | `running` | At least one locale has reported while at least one locale is still pending |
| `completed` | `idle` | All requested locales reached terminal success/stale handling; Generate can run again |
| `failed` | `failed` | The current operation reached terminal failure |
| `timed_out` | `failed` | Tokyo timed out the operation; no polling loop may keep it active |

This column is not readiness, progress, sync truth, locale inventory, or history. Bob/Roma may use it only as coarse button liveness and must read the Tokyo product summary for reviewable locale state.

The first implementation must be the smallest store that replaces `translation-generation-job.json`. It must not become a broad workflow platform, analytics history table, or queue dashboard.

## Required Operation Ledger / Outbox Contract

`105M` must implement or explicitly map to this minimum Supabase-backed shape before deleting `translation-generation-job.json`.

### `translation_generation_operations`

One row represents one Tokyo-accepted generation operation for one account instance.

Required fields:

```text
id                         uuid primary key
account_public_id          text not null
instance_id                text not null
base_locale                text not null
target_locales             jsonb not null
base_content_marker        text not null
generation_request_marker  text not null
status                     text not null
requested_at               timestamptz not null
updated_at                 timestamptz not null
expires_at                 timestamptz not null
reason_key                 text null
detail                     text null
```

Required constraints:

- exactly one active operation per `{account_public_id, instance_id}` where `status in ('queued', 'running')`;
- repeated Generate with the same active `generation_request_marker` returns the active operation;
- Generate while any different operation is active does not create competing work;
- `status` is limited to `queued`, `running`, `completed`, `failed`, `timed_out`;
- `base_content_marker` and `generation_request_marker` are versioned SHA-256 markers.

### `translation_generation_operation_locales`

One row represents one target locale inside one operation and doubles as the minimal outbox/enqueue ledger unless execution proves a separate outbox table is simpler.

Required fields:

```text
operation_id               uuid not null references translation_generation_operations(id)
locale                     text not null
status                     text not null
enqueue_status             text not null
job_id                     text null
base_content_marker        text not null
requested_at               timestamptz not null
updated_at                 timestamptz not null
completed_at               timestamptz null
reason_key                 text null
detail                     text null
```

Required constraints:

- unique `{operation_id, locale}`;
- `status` is limited to `queued`, `running`, `completed`, `failed`, `stale`;
- `enqueue_status` is limited to `pending`, `sent`, `failed`;
- San Francisco callbacks are idempotent by `{operation_id, locale, base_content_marker}`;
- stale marker callbacks become terminal `stale`/non-applied outcomes and must not retry forever.

This is not a job-history product. Completed rows exist only as long as needed for product state, debugging, timeout semantics, and safe pre-GA operation visibility.

## Required Correct Model

Translation sync is based on saved base content, not job lineage.

Required concepts:

- saved base content marker;
- widget editable-fields contract identity;
- base locale;
- concrete editable field identities/paths;
- target locale set for generation request idempotency;
- per-locale translated value sync metadata.

Markers must be versioned SHA-256 digests over canonical JSON. A short non-cryptographic hash is not acceptable for apply/reject boundaries.

Required behavior:

- Generate for the same active request returns the active operation.
- Generate while any generation is active keeps Generate disabled and does not create competing work.
- San Francisco job payloads carry the marker needed for Tokyo to apply/reject deterministically.
- Tokyo applies completion when the marker matches current saved base content.
- Tokyo rejects stale completion as terminal when it no longer matches.
- Missing/out-of-sync locales remain visible as product state, not queue math.
- Existing in-sync locale overlays are not invalidated by adding another target locale.

## Bob Product State

`105G` is the primary authority for Bob/Roma translation panel state, resolver precedence, and user-visible copy. This section repeats only the backend-driven product requirements that `105D` needs for smoke verification.

Bob must show one primary state at a time.

Required user-visible rules:

- no `0 of N translations ready`;
- no `Preparing translations.`;
- no queue/progress copy based on storage inventory;
- Generate disabled while loading/unsaved/active;
- out-of-sync banner when saved base content changed:

```text
The base content has changed. Regenerate translations.
```

- active generation copy:

```text
Generating translations.
```

Base preview may always exist. Translated locale preview appears only for locales Tokyo marks reviewable for the current saved base content.

## End-To-End Smoke Gate

This PRD cannot be green from unit tests alone.

Required cloud-dev smoke:

- authenticated Roma opens account widget list;
- Bob opens FAQ instance;
- Bob opens at least one non-FAQ widget;
- save persists authored content;
- Generate accepts work without creating competing generation;
- San Francisco translates concrete editable fields;
- Tokyo writes durable translated locale output under the PRD 105 target shape or a clearly named temporary storage shape that is scheduled for removal;
- Bob translated preview renders translated text;
- publish/materialization writes public artifacts;
- public visitor reads generated R2/CDN artifacts only;
- private source files and operation files do not resolve publicly;
- old numeric admin account coordinates do not resolve as active product truth.

FAQ-only proof is not enough. Translation must be generic across widgets.

## Verification Scope

This PRD is green only when active code/docs are checked for:

- no active code creates competing generations for the same instance;
- no active code uses random `jobId` lineage as translation sync truth;
- no active code writes or reads `translation-generation-job.json` as operation truth;
- no active code stores operation-controller JSON in the instance folder;
- no active code treats `instances.translation_status` as readiness/progress/sync truth;
- no active Bob UI copy says `Preparing translations.` or `N of M translations ready`;
- San Francisco completion treats Tokyo stale/non-applied outcome as terminal;
- active tests cover marker-based apply/reject;
- active tests cover disabled Generate while active;
- active tests cover base-changed/out-of-sync copy;
- active smoke covers FAQ plus one non-FAQ widget;
- active docs point to PRD 105/105D for translation operation boundaries.

## Archive Decision For Source Batch

After this PRD is created, the red translation generation slice and blocked end-to-end smoke gate must move to `03-Executed` as historical evidence.

Required archive status:

```text
Historical evidence.
Surviving repair doctrine extracted to PRD 105D.
Superseded by PRD 105/105A/105B/105C/105D where conflicting.
```

## Non-Scope

This PRD does not:

- implement the final Tokyo operation store by itself;
- implement zero-touch generate-on-save;
- implement automatic rematerialization after translation completion;
- implement SEO/GEO static locale pages;
- change account coordinate migration;
- change Prague page content;
- redesign the widget catalog;
- move account/user/core DB schema.

Those require later focused PRD 105 sub-PRDs if verification proves they are needed.

## Final Verification - 2026-06-02

Status: Green. Translation operation state is verified locally as Supabase-ledger-backed operation state, not R2 job-document state.

Evidence:

- `supabase/migrations/20260528120000__prd105_translation_generation_operations.sql` defines `translation_generation_operations` and `translation_generation_operation_locales`.
- `tokyo-worker/src/domains/render/translation-operation-ledger.ts` reads and writes operation state through Supabase REST endpoints for those tables.
- `translation-generation-job.json` is absent from active production source and appears only in cleanup/verification context.
- `pnpm --filter @clickeen/tokyo-worker test` passes operation liveness, timeout, completion, stale marker, and failure tests.
- `pnpm --filter @clickeen/sanfrancisco test` passes completion/failure queue boundary tests.
- `pnpm verify:prd105-runtime-boundary` passes.
