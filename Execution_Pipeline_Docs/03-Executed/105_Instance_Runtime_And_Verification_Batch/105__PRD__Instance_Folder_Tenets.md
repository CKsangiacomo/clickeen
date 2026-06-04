# PRD 105 - Instance Folder Tenets

Status: Green / architecture authority verified
Owner: Product + Architecture
Date: 2026-05-27

## Purpose

Define, in plain product language, what belongs in an account-owned instance folder and why.

This PRD exists to stop Clickeen from drifting into invented storage shapes. The instance folder is not a random artifact bucket, not a job ledger, and not a translation controller. It is the account-owned home for one widget instance's source, overlays, and generated browser files.

The goal is a boring, durable taxonomy that works for Bob, Tokyo, `clk.live` public serving, San Francisco, and Prague without each system inventing a different mental model.

## Why This Reset Exists

The planning surface has become part of the failure mode.

Too many documents currently sit beside each other as if they are equal authorities:

- parent PRDs;
- sub-PRDs;
- audit notes;
- execution notes;
- complete/green records;
- stale runtime plans;
- active repair ledgers;
- future stubs.

That makes agents reason from document topology instead of product truth. It also lets old storage shapes survive by citation: one document says `script.js`, another mentions locale HTML files, another preserves translation job JSON, and an implementation can accidentally pick the wrong ancestor.

PRD 105 is the reset for instance folder architecture. For instance folder taxonomy, it supersedes any older planning, execution, audit, or context document that conflicts with it.

Conflicting docs must be amended, archived, or explicitly labeled historical before implementation proceeds.

## Product Truth

Clickeen has one real authoring path:

```text
Account owns widget instance.
User edits the instance in Bob through Roma.
Roma saves to Tokyo.
Tokyo writes approved instance source.
Publish/materialization produces browser files for the public embed.
The active `clk.live` public-serving owner serves those browser files.
San Francisco may generate translated values, but it does not own the instance folder shape.
```

Bob and the public embed are not two unrelated products. They are two views of the same account-owned instance:

- Bob edits the saved source.
- The embed serves generated files derived from that saved source.
- There must be no hidden second truth where Bob edits one thing and the embed shows another by design.

If Bob and the embed diverge, that is a materialization/sync problem, not a product model.

## 105 Series Authority Map

PRD 105 is the taxonomy authority. The sub-PRDs are not equal alternate architectures.

Use this map when deciding which document owns a question:

| Area | Authority |
| --- | --- |
| Instance folder taxonomy | `105__PRD__Instance_Folder_Tenets.md` |
| DB/R2 authority split | `105A__PRD__DB_R2_Operation_Authority.md` |
| Core DB model verification | `105B__PRD__Core_DB_Model_Verification.md` |
| Tokyo runtime boundary verification | `105C__PRD__Tokyo_Runtime_Boundary_Verification.md` |
| Backend translation operation contract | `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md` |
| Generic editable-field and San Francisco contract | `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md` |
| Manual translated-locale edit contract | `105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md` |
| Bob/Roma translation panel state contract | `105G__PRD__Translation_Workflow_State_And_Sync_Verification.md` |
| Execution gate discipline | `105H__PRD__Execution_Verification_Protocol.md` |
| Admin account coordinate/context | `105I__PRD__Admin_Account_Coordinate_And_Context_Verification.md` |
| Prague public dogfood boundary | `105J__PRD__Prague_Public_Dogfood_Boundary_Verification.md` |
| Broad pre-GA cleanup audit | `105K__PRD__Pre_GA_Codebase_And_Documentation_Cleanup_Verification.md` |
| R2 bucket and widget package cleanup | `105L__PRD__R2_Bucket_And_Widget_Package_Source_Cleanup.md` |
| Tokyo-worker implementation refactor | `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md` |
| Future SEO/GEO strategy for widgets and block-built pages | `../01-Planning/107__PRD__SEO_GEO_Static_Build_And_Page_Block_Strategy.md` |

If two sub-PRDs appear to conflict, the more specific implementation PRD wins only inside its declared scope and only if it still obeys this master PRD. For example, `105M` owns Tokyo-worker artifact/runtime implementation; it does not get to change the instance folder taxonomy.

## Execution Spine

The 105 series executes in this order:

```text
0. Authority lock: 105 + 105H
1. Foundation verification: 105A -> 105B -> 105C
2. Translation contracts: 105D -> 105E -> 105F -> 105G
3. Admin/Prague boundary: 105I -> 105J
4. Cleanup audit: 105K as audit/backlog reconciliation, not a broad implementation pass
5. R2/package cleanup Phase A: 105L taxonomy + manifests + widget package cleanup
6. Tokyo-worker refactor: 105M slices
7. R2 cleanup Phase B: delete stale account/runtime objects only after 105M is green
8. Future SEO/GEO: PRD 107 only after 105M + public serving + PRD 106 Prague foundation are green
```

Do not treat every active 105 document as an implementation ticket. Several are contracts or verification gates. The main implementation work is `105L` and `105M`, with `105I`/`105J` requiring migration or cleanup only if verification shows drift.

The real executable work in this series is intentionally small:

```text
105L Phase A  ->  non-destructive product deploy and widget package cleanup
105M          ->  Tokyo-worker runtime/materialization/operation-state refactor
105L Phase B  ->  destructive stale R2 cleanup after 105M proves old files are not recreated
```

`105A` through `105H` are contract and verification documents. `105I` and `105J` are migration/boundary checkpoints. `105K` is audit/backlog reconciliation only. SEO/GEO planning has moved to PRD 107 and must not be executed as part of the active 105 runtime cleanup.

## Canonical Instance Folder

The surviving account instance folder shape is:

```text
accounts/{accountPublicId}/
  assets/
    {assetRef}

  instances/
    {instanceId}/
      instance.config.json
      instance.content.json

      overlays/
        locales/
          {locale}.json

      index.html
      styles.css
      runtime.js
```

This is the product taxonomy. It is intentionally small.

## File Taxonomy

### `instance.config.json`

`instance.config.json` is the non-text product source for the instance.

It exists because widget structure, behavior, style choices, asset references, identity/display metadata, widget type, base locale, target locales, and timestamps are not the same product concern as customer-visible text.

It may contain:

- widget type/code;
- instance identity and display metadata;
- base locale and target locale policy for the instance;
- section/card structure when structure is not itself customer-visible prose;
- visual settings;
- behavior settings;
- references to account-level assets;
- timestamps and version metadata.

It must not contain:

- translation operation state;
- queue state;
- San Francisco job ids;
- public serving liveness state;
- generated HTML/CSS/JS content;
- duplicated account assets.

### `instance.content.json`

`instance.content.json` is the base customer-visible text source.

It exists because translations, Copilot writing, content diffing, and Bob's editable fields all need one clean source of authored text. For every widget, customer-visible text must be represented as concrete editable paths, not as a widget-specific special case.

It may contain:

- base-locale customer-visible text;
- concrete editable field paths and stable identities;
- text values Bob exposes in the Content panel;
- translation pickup metadata tied to saved base content, when that metadata is source-adjacent and not an operation controller.

It must not contain:

- active generation controller state;
- queue progress;
- polling state;
- worker retry state;
- generated browser files;
- copied translated locale files that should live under `overlays/locales/`.

### `overlays/`

`overlays/` is the instance-owned family of value overlays.

It exists because an instance can have durable value maps that modify or specialize the base source without rewriting the base source. Locale overlays are the first required overlay family, but the folder name intentionally leaves room for future product overlays such as experiments, segments, or industry variants.

`overlays/` is product data, not public browser output and not operation state.

### `overlays/locales/{locale}.json`

`overlays/locales/{locale}.json` is the durable translated value map for one locale.

It exists because a translation result is product data: it is the translated customer-visible text for the current or prior base content. It should be inspectable, replaceable, and reasoned about as a locale overlay, not buried inside a job document.

Each locale overlay must be keyed by concrete editable paths for v1. It must not use wildcard paths as stored product truth.

It may contain:

- translated values for one locale;
- the base content marker the values were generated from;
- locale-level sync metadata needed to decide whether the overlay matches current saved base content;
- failure metadata only if it describes the durable locale product state, not worker liveness.

The v1 locale overlay schema is:

```json
{
  "v": 1,
  "locale": "it",
  "baseContentMarker": "sha256:v1:...",
  "widgetContractHash": "sha256:v1:...",
  "status": "inSync",
  "values": {
    "sections.0.faqs.0.question": "..."
  },
  "updatedAt": "2026-05-28T00:00:00.000Z",
  "reasonKey": "optional.failure.reason",
  "detail": "optional human-readable failure detail"
}
```

Required schema rules:

- `v` is always `1` for this PRD series.
- `locale` is the normalized locale represented by the file name.
- `baseContentMarker` is a versioned SHA-256 digest of the canonical saved base text payload.
- `widgetContractHash` is a versioned SHA-256 digest of the editable-fields contract used for extraction.
- `status` is one of `inSync`, `outOfSync`, or `failed`.
- `values` is a full translated value map keyed by concrete current editable paths.
- v1 may use stable field identities internally to compute markers and survive extraction, but the persisted locale overlay map is concrete-path keyed until a focused future PRD changes the overlay schema.
- `reasonKey` and `detail` are present only for failed durable locale product state.
- No queue, retry, active operation, worker lease, or job ownership fields may appear in this document.

It must not contain:

- queue messages;
- active operation progress;
- worker lease state;
- retry counters;
- "current job" ownership;
- any state whose only purpose is to decide what the backend should do next.

### `index.html`

`index.html` is the generated public entry file for the instance embed.

It exists because `clk.live` public serving needs a browser-loadable document for the instance. It is derived output, not source truth.

It is generated from:

- `instance.config.json`;
- `instance.content.json`;
- `overlays/locales/` when a locale is selected by the public runtime;
- account assets;
- widget software.

It must not become an authoring source. Bob does not edit `index.html`.

### `styles.css`

`styles.css` is the generated browser stylesheet for the instance embed.

It exists because the public embed needs stable CSS output next to the generated entry file. It is derived output, not source truth.

It must be regenerated by materialization. It must not be edited as the product source.

### `runtime.js`

`runtime.js` is the generated browser runtime for the instance embed.

This name is intentional. `runtime.js` describes what the file is: the browser runtime needed to make this instance work when served publicly. It is better than a vague name such as `script.js`, because the file is not just "some script"; it is the generated runtime for the instance.

It may handle:

- widget client behavior;
- public locale selection and application using public-safe materialized data;
- asset references;
- embed bootstrapping.

It must not:

- fetch private source JSON directly;
- fetch private `overlays/` JSON unless a PRD explicitly defines a sanitized public locale artifact or public-safe overlay route;
- expose operation state;
- act as a translation controller;
- implement Bob authoring behavior.

## Account Assets

Assets belong at the account level:

```text
accounts/{accountPublicId}/assets/{assetRef}
```

They do not belong inside each instance folder by default.

Bob and the embed reference the same account asset library. This matters because an image, file, or brand asset is account-owned, not a copy owned by every instance that happens to use it.

The instance source should store asset references. Generated browser files should reference public-safe asset URLs produced from those references.

## What Must Not Exist In The Instance Folder

The instance folder must not contain JSON files that act as operation controllers.

Forbidden examples:

```text
translation-generation-job.json
generation.json
publish.json
status.json
queue.json
queued-locales.json
completed-locales.json
worker-state.json
retry-state.json
```

`translation-generation-job.json` is specifically forbidden as a surviving architecture.

Why:

- translation generation is an operation, not instance source;
- R2 object files are not a database or job ledger;
- operation state must be owned by Tokyo in a proper durable operation model;
- San Francisco should translate and report outcomes, not coordinate by mutating instance-folder controller files;
- Bob should read product state from Tokyo/Roma, not infer state from storage inventory;
- the durable product result of translation is `overlays/locales/{locale}.json`, not a job document.

## Locale Shape

The default product shape is not one HTML file per locale.

Do not make this the default:

```text
fr.html
script.fr.js
styles.fr.css
```

The default shape is:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json
```

Reason:

- one instance has one public embed entry;
- locale is a value overlay on that instance;
- publishing should not explode the instance folder into per-locale duplicate page trees unless a separate SEO/GEO PRD explicitly requires it;
- translated values are product data and belong in locale overlays;
- the runtime can choose/apply the relevant locale overlay without redefining the instance as many separate mini-sites.

If future SEO/GEO work needs static locale-specific documents, that must be a separate named public-artifact PRD. It must not silently replace this default instance folder taxonomy.

## Operation State Belongs Elsewhere

Tokyo owns product operations.

Operation state includes:

- translation generation liveness;
- active operation identity;
- queue production/outbox state;
- worker leases;
- timeout/watchdog state;
- publish/rematerialization liveness;
- retry attempts;
- failure recovery.

For the active 105 execution, translation operation state belongs in the smallest Supabase-backed operation ledger/outbox required by `105D` and `105M`.

Future operation mechanisms may use another Tokyo-owned durable store only through a focused PRD. The default for PRD 105 execution is not open-ended.

It does not belong in:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The instance folder should remain readable as product source and derived public output. It should not become a backend control plane.

## System Responsibilities

| System | Responsibility |
| --- | --- |
| Bob | Edits one instance's config/content in memory and previews the same instance. |
| Roma | Hosts authenticated Builder, saves through Tokyo, and passes product state back to Bob. |
| Tokyo | Owns account instance source, overlays, publish/materialization, and product operations. |
| San Francisco | Produces translated value maps from concrete editable fields and reports outcomes to Tokyo. |
| `clk.live` public serving | Serves generated browser files and public-safe assets. Current owner must be verified in `105M` Slice 0 before runtime changes. |
| Prague | Embeds published widgets by public coordinates only. It must not know instance folder internals. |

## Required Invariants

- One instance folder represents one account-owned widget instance.
- Bob source and public embed output are connected by materialization, not by separate product truths.
- `instance.config.json` and `instance.content.json` are the source documents.
- `overlays/locales/{locale}.json` is the durable translated locale product result.
- locale overlays use the v1 schema defined in this PRD until explicitly superseded by a focused PRD.
- `index.html`, `styles.css`, and `runtime.js` are generated browser files.
- Account assets live at account scope and are referenced by instances.
- No operation-controller JSON belongs in the instance folder.
- No default per-locale HTML/JS explosion belongs in the instance folder.
- Storage paths are implementation details behind product operations, not UI state contracts.

## Acceptance Criteria

PRD 105 is accepted as a tenet when:

- all future PRDs touching instance storage reference this taxonomy;
- current active documentation clearly marks PRD 105 as the authority for instance folder taxonomy;
- older PRDs/docs that describe conflicting instance folder shapes are amended, archived, or labeled historical;
- documentation stops presenting `translation-generation-job.json` as an acceptable instance-folder object;
- documentation stops presenting default `{locale}.html` or `script.{locale}.js` output as the normal Clickeen embed model;
- the surviving target generated runtime name is `runtime.js`;
- `instance.config.json`, `instance.content.json`, `overlays/locales/{locale}.json`, `index.html`, `styles.css`, and `runtime.js` are the named canonical instance folder files;
- locale overlay documents conform to the v1 schema in this PRD;
- any implementation PRD that needs operation state names the real operation store and explicitly keeps it out of the instance folder.

## Required Documentation Cleanup

Before any implementation PRD claims PRD 105 compliance, the documentation set must be cleaned so there is one obvious current authority.

Required cleanup:

- add an active-authority index for PRDs touching instance storage;
- move complete execution notes out of `01-Planning` or mark them complete/historical where they live;
- mark older PRDs that mention `instance.json`, default `{locale}.html`, `script.{locale}.js`, `translated-locale-values/`, or `translation-generation-job.json` as superseded for instance folder taxonomy;
- amend architecture docs that present generated locale files as the default embed model;
- amend service docs that present operation-controller JSON inside the instance folder as acceptable architecture;
- keep historical evidence, but prevent historical evidence from reading like current product truth.

The cleanup must not delete useful historical evidence blindly. It must remove authority confusion.

## Static Tripwires For Future Execution

Future implementation PRDs should add checks that fail if active runtime/documentation treats these as surviving product truth:

```text
translation-generation-job.json
generation.json
queued-locales.json
completed-locales.json
fr.html
script.fr.js
script.{locale}.js
styles.{locale}.css
```

Legacy references may exist only in migration notes or historical PRDs that clearly label them as non-surviving.

## Non-Scope

This PRD does not implement the migration.

It does not:

- move existing operation state into a new database;
- rewrite Tokyo materialization;
- rename generated files in runtime code;
- migrate existing R2 objects;
- redesign translation generation;
- implement SEO/GEO locale pages;
- change Prague embed content;
- change Bob UI.

Those changes require focused execution PRDs that comply with this taxonomy.
