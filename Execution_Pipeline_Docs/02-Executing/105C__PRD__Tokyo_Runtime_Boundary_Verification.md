# PRD 105C - Tokyo Runtime Boundary Verification

Status: Active contract / verification gate
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`, `105B__PRD__Core_DB_Model_Verification.md`

## Purpose

Verify the Tokyo runtime boundaries that were cleaned during the 103_DB execution series, and extract only the surviving product rules.

The old execution docs are useful evidence, but they also contain stale physical-storage assumptions. This PRD keeps the good runtime boundaries and names the remaining PRD 105 gaps that must be fixed or verified later.

## Source Documents Reviewed

This PRD extracts from:

```text
103_DB_Instance_Registry_Control_Row__EXEC__Tokyo_Runtime_Wiring.md
103_DB_Translated_Locale_Operation_Cleanup__EXEC__Tokyo_Runtime_Wiring.md
103_DB_Widget_Definition_Operation_Cleanup__EXEC__Tokyo_Runtime_Wiring.md
103_DB_Publish_Materialization_Bridge__EXEC__Tokyo_Runtime_Wiring.md
103_DB_Migration_And_Toxic_Path_Deletion__EXEC__Tokyo_Runtime_Wiring.md
```

Those documents become historical evidence after this extraction. They must not remain active execution authority.

## Surviving Runtime Boundaries

### Instance Registry

- Tokyo requires the `instances` row for lifecycle operations.
- Instance list/open/save/rename/delete/publish/unpublish must start from Tokyo product operations.
- R2 account index JSON is not instance listing truth.
- R2 listing is not instance discovery truth.
- `instance.json` is not active product truth and must not be read or written.
- `instance.config.json` and `instance.content.json` are source files behind Tokyo operations, not cross-service APIs.

### Translated Locale Operations

- Bob and Roma ask Tokyo for translated locale product state.
- The product identity is `{ accountId, instanceId, locale }`.
- Bob and Roma must not receive overlay IDs, selected overlay pointers, overlay inventory, R2 keys, or storage paths.
- Manual translated-locale reads/writes must go through Tokyo operations.
- San Francisco reports translation outcomes through Tokyo.

### Widget Definitions

- Widget source lives in repo/static Tokyo product source under `tokyo/product/widgets/{widgetType}/`.
- Tokyo exposes widget definitions through a product operation route.
- Roma consumes widget definitions through Tokyo.
- Supabase `widgets` is not product truth.
- Generated widget catalog/manifest files are not product authority.
- Build-time generated source indexes may exist only as import/build plumbing, not product state.

### Publish And Public Serving

- `instances.publish_status` is product publish intent.
- Public browser files in R2 are materialized output.
- Public visitor traffic must not query Supabase.
- Public serving reads only allowed generated R2 artifacts and public-safe assets.
- Publish/unpublish/materialization are Tokyo operations.
- `applyFreeTierServing` and `restorePaidTierServing` materialize public output without rewriting publish intent.

## PRD 105 Gaps Exposed By This Batch

This batch also proves what still needs cleanup under PRD 105.

### Locale Overlay Physical Shape

Old executed slice allowed translated values to remain inside `instance.content.json` as a private Tokyo implementation detail.

PRD 105 target shape is:

```text
overlays/locales/{locale}.json
```

Current verification has shown active runtime does not fully store durable locale values under the PRD 105 shape. `105M` is the focused implementation PRD that moves Tokyo-worker toward `overlays/locales/{locale}.json`.

### Generated Runtime File Name

Old executed slice kept:

```text
script.js
script.{locale}.js
```

PRD 105 target shape is:

```text
runtime.js
```

Current verification has shown active runtime still emits old script names. `105M` is the focused implementation PRD that renames the generated browser runtime to `runtime.js` and removes the old default artifact model.

### Default Locale Artifact Shape

Old docs described generated locale public files such as:

```text
{locale}.html
script.{locale}.js
```

PRD 105 target shape does not use default per-locale HTML/JS explosion. Locale is a value overlay under:

```text
overlays/locales/{locale}.json
```

SEO/GEO static locale pages require a separate future PRD. They are not the default embed architecture.

## Verification Scope

This PRD is green only when active code/docs are checked for the extracted boundaries.

Required checks:

- no active code uses `accounts/{accountId}/instances/index.json` as listing truth;
- no active code uses R2 listing as account instance discovery;
- no active code reads or writes `instance.json` as source truth or fallback;
- no active code exposes overlay IDs, selected overlay pointers, overlay inventories, or R2 paths to Bob/Roma as translated-locale product state;
- Bob/Roma translated-locale flows use Tokyo product operations by `{ accountId, instanceId, locale }`;
- no active code uses Supabase `widgets` as widget-definition truth;
- Roma consumes widget definitions through Tokyo;
- generated widget catalog/manifest files are not product authority;
- public visitor traffic does not query Supabase;
- publish/unpublish use `instances.publish_status` as product intent and R2 files as materialized output;
- active docs identify `script.js`, `script.{locale}.js`, and `{locale}.html` as historical or future-specialized shapes, not PRD 105 default shape;
- active docs identify `overlays/locales/{locale}.json` as the target durable translated locale output.

## Archive Decision For Source Batch

After this PRD is created, the Tokyo runtime boundary batch must move to `03-Executed` as historical evidence.

Required archive status:

```text
Executed historical evidence.
Surviving doctrine extracted to PRD 105C.
Superseded by PRD 105/105A/105B/105C where conflicting.
```

## Non-Scope

This PRD does not:

- implement the locale overlay physical migration;
- rename generated browser files in runtime code;
- implement SEO/GEO static locale pages;
- repair translation generation liveness;
- change the account coordinate migration;
- change Prague dogfood content;
- redesign widget catalog registration.

Those require later focused PRD 105 sub-PRDs if verification proves work remains.
