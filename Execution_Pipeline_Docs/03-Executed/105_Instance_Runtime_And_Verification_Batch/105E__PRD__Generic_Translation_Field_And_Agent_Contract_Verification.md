# PRD 105E - Generic Translation Field And Agent Contract Verification

Status: Green / contract verified
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`

## Purpose

Verify the generic widget translation field contract and the San Francisco translation agent boundary.

This PRD extracts the surviving doctrine from the 103 translation foundation PRDs. The goal is to preserve the good product model while removing stale authority and ambiguity.

The core rule:

```text
Every widget declares translatable authored text in editable-fields.json.
Tokyo extracts saved text fields from saved instance source.
San Francisco translates exactly those fields.
Tokyo owns sync, durable translated output, readiness, and completion application.
```

## Source Documents Reviewed

This PRD extracts from:

```text
103B__PRD__Instance_Translation_Agent_Contract.md
103C__PRD__Shared_Content_Text_Base_For_Copilot_And_Translation.md
103H__PRD__Shared_Agent_Model_Profiles.md
103I__PRD__San_Francisco_Agent_Runtime_Cleanup.md
103J__PRD__Generic_Widget_Translation_System.md
```

Those documents become historical evidence after this extraction. They must not remain active execution authority.

## Product Contract

Translation is a generic account-widget capability, not an FAQ feature.

For every widget:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

declares all customer-visible authored text that can appear to visitors.

This includes text regardless of Bob panel location:

- Content panel text;
- CTA labels;
- header titles/subtitles;
- captions;
- alt/title text;
- timer labels;
- FAQ questions and answers;
- any other saved authored string or rich text a visitor sees.

Panel ownership does not define translation ownership. `editable-fields.json` does.

## Saved Text Field Contract

Tokyo extracts saved text fields from:

```text
editable-fields.json + instance.content.json accessed through Tokyo product operations
```

San Francisco must not read R2 instance source files directly.

Each extracted field must include:

- stable identity key;
- concrete current path;
- field pattern;
- type: `string` or `richtext`;
- role;
- label;
- base text;
- widget contract identity/hash.

Repeated fields should use stable item identity where the widget model already provides it. For PRD 105 execution, concrete current paths remain the persisted locale overlay key format. If a widget does not yet have stable item identity, do not invent a broad identity framework inside translation execution; use concrete paths plus the saved base marker and let reorder mark affected paths out of sync.

The current concrete path is where the value is applied today. The stable identity key is how the product survives reorder, insert, and delete.

## San Francisco Agent Contract

Canonical agent id:

```text
widget.instance.translator
```

San Francisco owns only AI text production for Tokyo-created locale work.

It must receive:

- compact account coordinate;
- user/audit context when required by policy;
- instance id;
- widget type;
- base locale;
- target locale;
- saved base content marker;
- widget editable-fields contract identity/hash;
- concrete fields to translate;
- current base text for those fields;
- current translated values only when needed as merge/context;
- signed agent runtime policy and budget.

It must return:

- translated values for exactly the requested paths/identities;
- the same saved base content marker;
- terminal completion or failure outcome;
- telemetry: agent id, provider, model, policy profile/version, token usage, and result status.

San Francisco must not:

- decide locale sync/readiness;
- write public artifacts;
- write durable locale overlays directly unless a future PRD explicitly gives it a narrow operation boundary;
- choose provider/model outside `ck-policy` and the shared model router;
- accept FAQ-only payloads as product contract;
- retry stale marker rejections forever;
- return undeclared extra paths silently;
- omit requested paths silently.

## Policy Contract

Provider/model/budget selection comes from existing policy authority:

- `packages/ck-policy/entitlements.matrix.json`;
- `packages/ck-policy/ai-runtime.matrix.json`;
- `packages/ck-contracts/src/ai.ts`;
- DevStudio-managed policy matrices.

No widget, Bob route, Roma route, Tokyo route, San Francisco agent, or provider adapter may hardcode translation provider/model choice outside this policy path.

## PRD 105 Storage Contract

Durable translated locale output target:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Tokyo owns writing that durable product result.

San Francisco returns translated values to Tokyo. It does not own the instance folder shape.

## Verification Scope

This PRD is green only when active code/docs are checked for:

- every active widget has an `editable-fields.json` contract for customer-visible authored text;
- FAQ, Countdown, Logo Showcase, and at least one future/new widget path use the same extraction pipeline;
- CTA/button text and non-content-panel text are included when visitor-visible;
- repeated fields use stable identity, not array index identity;
- Tokyo extracts `SavedTextField`-equivalent data from saved instance source through Tokyo operations;
- San Francisco job payloads include marker, widget contract identity, concrete paths, field identity, base text, and policy;
- San Francisco validates missing/extra/empty provider output as terminal failure;
- San Francisco reports terminal complete/fail to Tokyo per locale;
- Tokyo alone applies/rejects completion based on saved base content authority;
- no FAQ-only language helper defines product translation behavior;
- no provider/model bypass exists outside the shared policy/router path;
- docs point to PRD 105/105D/105E for translation field and agent authority.

## Archive Decision For Source Batch

After this PRD is created, the translation field/agent contract batch must move to `03-Executed` as historical evidence.

Required archive status:

```text
Historical evidence.
Surviving doctrine extracted to PRD 105E.
Superseded by PRD 105/105D/105E where conflicting.
```

## Non-Scope

This PRD does not:

- implement translation operation state;
- implement Tokyo's operation ledger/store;
- implement durable overlay migration;
- implement automatic generate-on-save;
- implement automatic rematerialization after translation completion;
- implement Prague dogfood pages;
- implement SEO/GEO locale pages;
- redesign policy matrices.

Those require later focused PRD 105 sub-PRDs if verification proves work remains.

## Final Verification - 2026-06-02

Status: Green. Generic translation field and agent contracts are verified locally for the current widget set.

Evidence:

- `pnpm --filter @clickeen/ck-contracts test` passes generic saved-text extraction and translated-value validation across FAQ, Countdown, and Logo Showcase.
- `pnpm validate:widgets` passes for all current widget sources.
- `node scripts/verify/prd103j-generic-translation-guard.mjs` passes.
- `pnpm --filter @clickeen/sanfrancisco test` passes queue payload, marker, provider failure, and translation validation tests.
- `pnpm verify:prd105-runtime-boundary` passes.
