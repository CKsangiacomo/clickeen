# PRD 105F - Manual Translation Edit And Public Materialization Verification

Status: Active contract / verification gate
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`, `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`

## Purpose

Verify the simple manual translated-locale edit model and the publish/materialization boundary under PRD 105.

This PRD extracts the surviving doctrine from the 103F/103G green evidence docs while correcting their old "generated language files" wording to the PRD 105 instance folder taxonomy.

## Source Documents Reviewed

This PRD extracts from:

```text
103F__PRD__Translation_Override_UX.md
103F__EXEC__Translation_Override_UX.md
103G__PRD__Save_Publish_Generated_Language_Files.md
103G__EXEC__Save_Publish_Generated_Language_Files.md
```

Those documents become historical evidence after this extraction. They must not remain active execution authority.

## Product Contract

Manual translated-locale editing is intentionally simple:

```text
Bob user edits a translated value.
Bob writes the full locale value map through Roma.
Roma calls Tokyo.
Tokyo validates the full map against the saved editable-fields contract.
Tokyo writes the current durable translated locale output.
Publish/materialization consumes the current saved source plus translated locale output.
```

Manual edit does not create a second translation system.

## Manual Edit Rules

- Bob edits current translated-locale values only for a selected translated locale.
- Bob must write the full translated-locale value map, not a partial patch.
- Roma forwards one account-authorized product operation to Tokyo.
- Tokyo validates the value map against the saved instance editable-fields contract.
- Tokyo rejects partial maps.
- Manual edits overwrite current translated values for that locale.
- A later regeneration may overwrite manual edits.

Do not add:

- override status;
- provenance layer;
- review-state workflow;
- source-hash protection;
- manual-edit audit subsystem;
- second readiness/status layer;
- translation-agent changes for manual edits.

## PRD 105 Storage Target

Durable translated-locale output belongs under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Old docs may say "translated locale values" or "generated language files." Under PRD 105, the active target language is:

```text
translated locale overlay
```

The product API may still speak value maps because Bob preview and materialization apply concrete current paths. The durable product result must align with the locale overlay taxonomy.

Manual writes must produce the v1 locale overlay schema defined in `105__PRD__Instance_Folder_Tenets.md`: full concrete-path `values`, current `baseContentMarker`, current `widgetContractHash`, `status: "inSync"` when valid, and no operation-controller fields.

## Publish / Materialization Rules

Publish/materialization consumes:

```text
instance.config.json
instance.content.json
overlays/locales/{locale}.json
account assets
widget software
```

and produces generated browser artifacts:

```text
index.html
styles.css
runtime.js
```

Public serving reads generated R2/CDN artifacts only.

Publish/materialization must not:

- call Bob;
- call Roma editor state;
- call Berlin for visitor traffic;
- call San Francisco or an LLM;
- inspect translation jobs;
- inspect generation lanes;
- infer publish state from generated file presence;
- create a new readiness/status subsystem;
- use public files as authoring source.

## PRD 105 Correction To Old Language-File Wording

Old 103G wording such as:

```text
generated language files
translated locale file
{locale}.html
script.{locale}.js
```

is not the PRD 105 default architecture.

Correct PRD 105 default:

```text
one instance embed
locale overlays under overlays/locales/{locale}.json
generated browser files index.html, styles.css, runtime.js
```

Static locale-specific pages for SEO/GEO are a future specialized public-artifact shape and require a separate PRD. They must not leak into default translation/materialization authority.

## Verification Scope

This PRD is green only when active code/docs are checked for:

- Bob manual edit emits a full translated-locale value map;
- Roma forwards one Tokyo product operation by account, instance, locale;
- Tokyo rejects partial translated-locale value maps;
- manual edit does not write Bob draft/base config;
- manual edit does not create override/provenance/review-state/status truth;
- durable translated-locale output aligns with `overlays/locales/{locale}.json`; implementation migration is owned by `105M`;
- publish/materialization consumes saved source plus current translated locale overlay/value map;
- public serving is static R2/CDN only;
- public serving does not call Bob, Roma editor state, Berlin, or San Francisco;
- public artifacts do not contain private product source paths or internal Tokyo routes;
- active docs do not present default `{locale}.html`, `script.{locale}.js`, or "generated language files" as the PRD 105 default shape.

## Archive Decision For Source Batch

After this PRD is created, the 103F/103G batch must move to `03-Executed` as historical evidence.

Required archive status:

```text
Historical green evidence.
Surviving doctrine extracted to PRD 105F.
Superseded by PRD 105/105C/105D/105E/105F where conflicting.
```

## Non-Scope

This PRD does not:

- add protected human translation workflows;
- add review/provenance/audit status;
- implement SEO/GEO static locale pages;
- repair translation operation liveness;
- rename runtime files by itself; `105M` owns that implementation;
- implement automatic generate-on-save;
- implement automatic rematerialization after translation completion.

Those require later focused PRD 105 sub-PRDs if verification proves they are needed.
