# PRD 104C - Prague Dogfood Boundary Cleanup

Status: Draft for execution planning
Owner: Product + Architecture
Parent: [PRD 104](./104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md)
Depends on:
- `104A__PRD__Admin_Account_Coordinate_Migration.md`
- `104D__PRD__Prague_Locale_Stub_Cleanup.md`

## Purpose

Make Prague dogfood the real public widget product path using stable public embed coordinates, with no dependency on translation internals or private Tokyo storage.

## Product Contract

Prague may know:

```ts
accountInstanceRef: {
  accountPublicId: "CLICKEEN";
  instanceId: string;
  locale?: string; // optional explicit public artifact selector; omitted means base artifact
}
```

Prague must not know:

```text
translation-generation-job.json
localeSync
translatedValues
localeStatus
baseContentMarker
generationRequestMarker
queuedLocales
pendingLocales
completedLocales
currentReadyLocales
supersededLocales
San Francisco job ids
Tokyo private R2 paths
overlay IDs as product identity
```

`accountInstanceRef.locale` selects a public pre-materialized locale artifact such as `/{locale}.html`. It must never cause Prague to read translation summaries, translated values, locale sync, or San Francisco state.

Prague must not synthesize widget artifact locale from the Prague route locale. A localized Prague page may localize Prague page copy while embedding the base widget artifact unless the authored `accountInstanceRef` explicitly names a locale that exists on `clk.live`.

`accountInstanceRef` may contain only `accountPublicId`, `instanceId`, and optional `locale`. `embedMode`, `indexable`, `title`, `widgetCode`, overlay id, San Francisco id, Tokyo path, or translation state must not be part of identity.

## Required Scope

Required behavior:

- Prague launch pages use object-form `accountInstanceRef`.
- Prague launch pages reference `accountPublicId: "CLICKEEN"` after 104A.
- String-form `accountInstanceRef` is forbidden in active Prague source, page data, composition primitives, and renderers. Any primitive or block path that can render a widget must accept only object-form refs or be deleted from launch scope.
- Unresolved `accountInstanceRef` values fail validation for launch pages.
- Prague has no forbidden translation internal dependencies.
- Validation recursively inspects every `accountInstanceRef` under active Prague launch surfaces: top-level blocks, nested `items[]`, carousel/showcase items, primitive media widgets, locale showcase inputs, minibob inputs, and generated block props.
- When `accountInstanceRef` exists, both `accountPublicId` and `instanceId` are required. Partial refs are invalid.
- Launch-intended widget refs may not be inherited from another block, synthesized from fallback locale data, silently dropped, or rendered as local placeholder UI. Each widget-rendering block or item declares its own complete object-form ref unless this PRD names a single explicit page-level ref owner.

The surviving Prague launch contract is:

```ts
accountInstanceRef: {
  accountPublicId: string;
  instanceId: string;
  locale?: string;
}
```

## Prague Launch Proof Set

The concrete active launch proof set is:

```text
tokyo/prague/pages/faq/overview.json        instance UZ3JEJSHII
tokyo/prague/pages/faq/examples.json        instance UZ3JEJSHII
tokyo/prague/pages/faq/features.json        instance UZ3JEJSHII
tokyo/prague/pages/faq/pricing.json         instance UZ3JEJSHII
tokyo/prague/pages/countdown/overview.json  instance H7IF9M2K9B
tokyo/prague/pages/logoshowcase/overview.json instance 8FMVZFFPJV
```

Any countdown, logoshowcase, or FAQ subpage without `accountInstanceRef` is outside widget-embed proof scope unless it receives an explicit complete ref.

Prague launch validation must fail on unresolved `accountInstanceRef` values for launch pages. A page may not silently drop or local-mock a broken embedded widget.

Stop conditions:

- Stop if 104A has not proven `dev.clk.live/CLICKEEN/{instanceId}` serves and `dev.clk.live/00000001/{instanceId}` returns 404.
- Stop if 104D has not removed or explicitly accepted Prague locale stub behavior.

## Blast Radius

Expected implementation areas:

```text
tokyo/prague/pages/**
prague/README.md
prague/src/**
prague/src/composition/**
prague/src/components/Carousel.astro
prague/src/components/InstanceEmbed.astro
prague/src/components/WidgetBlocks.astro
prague/src/blocks/hero/**
prague/src/blocks/split/**
prague/src/blocks/split-carousel/**
prague/src/blocks/embed-carousel/**
prague/src/blocks/mobile-showcase/**
prague/src/lib/blockRegistry.ts
prague/src/lib/markdown.ts
documentation/ai/BUILD_PraguePage.md
documentation/services/prague/**
documentation/widgets/**
documentation/architecture/CONTEXT.md
documentation/capabilities/multitenancy.md
documentation/capabilities/localization.md
```

Do not edit:

```text
berlin/**
roma/**
supabase/migrations/**
tokyo-worker/src/routes/**
bob/**
sanfrancisco/src/**
dieter/**
```

## Verification

Static checks:

```sh
rg -n "00000001" prague/src prague/README.md tokyo/prague/pages documentation/ai documentation/services/prague documentation/widgets documentation/architecture/CONTEXT.md documentation/capabilities -S --glob '!**/CompetitorAnalysis/**'
rg -n "translation-generation-job|localeSync|translatedValues|localeStatus|baseContentMarker|generationRequestMarker|queuedLocales|pendingLocales|completedLocales|currentReadyLocales|supersededLocales" prague/src tokyo/prague/pages -S
rg -n "accountInstanceRef" prague/src tokyo/prague/pages -S
rg -n "accountInstanceRef\\??: string|accountInstanceRef: string|primitive\\.accountInstanceRef|renderWidget|accountInstanceRef.*string" prague/src/composition prague/src -S
rg -n "Widget preview unavailable|Widget preview is unavailable|fallbackInstanceLocales|catch\\(\\(\\) => null\\)|embedMode|indexable" prague/src tokyo/prague/pages -S
```

Expected result:

- launch page refs use `CLICKEEN`;
- Prague has no private translation internal dependencies;
- object-form `accountInstanceRef` is the surviving launch page shape;
- string-form refs are deleted from active widget-rendering paths or migrated to object form;
- placeholder/fallback widget rendering is not reachable for launch-scope refs;
- `embedMode` / `indexable` is either deleted from launch-scope identity or explicitly proven non-behavioral and outside the public coordinate.

Runtime proof:

```text
PUBLIC_CLK_LIVE_URL=https://dev.clk.live PRAGUE_VALIDATE_ACCOUNT_INSTANCE=1 PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT=1 pnpm --filter @clickeen/prague build
Prague launch validation fails on unresolved accountInstanceRef values.
Every launch-scope accountInstanceRef resolves to a public dev.clk.live artifact for accountPublicId/instanceId.
Refs without `locale` resolve to the base public artifact.
Refs with explicit `locale` resolve to the corresponding public locale artifact.
At least one FAQ launch page embeds a real published Clickeen-owned widget.
At least one countdown or logoshowcase launch page embeds a real published Clickeen-owned widget if included in launch scope.
Missing, unreachable, partial, or private refs fail the build for launch scope.
```

## Documentation Updates

Update active docs so documentation and code speak the same Prague boundary:

```text
documentation/architecture/CONTEXT.md
documentation/capabilities/localization.md
documentation/capabilities/multitenancy.md
documentation/ai/BUILD_PraguePage.md
documentation/services/prague/prague-overview.md
documentation/services/prague/blocks.md
documentation/widgets/WidgetPraguePagesBuilder.md
documentation/widgets/WidgetComplianceSteps.md
documentation/widgets/FAQ/FAQ_PraguePages.md
prague/README.md
```

Documentation requirements:

- No active doc describes `00000001` as the current admin/example coordinate.
- Prague docs describe the public widget coordinate as `accountPublicId + instanceId`, with optional locale as a public artifact selector.
- Prague docs state that page JSON refs may omit `locale`; Prague uses the base public artifact unless the ref explicitly supplies a locale.
- Historical docs may retain `00000001` only if explicitly marked historical/pre-104A.
- Docs do not describe Prague as reading translation operation state, overlay storage, locale sync, or private Tokyo paths.

## 103L / Prague Launch Precondition

Before Prague dogfood launch is accepted, record the 103L proof:

```text
FAQ translation job input contains concrete FAQ question/answer paths.
FAQ translation job input does not contain wildcard producer paths.
Translated FAQ question/answer text appears in Bob preview after generation.
```

This is a launch precondition, not PRD 104C implementation scope.

## Acceptance

104C is complete when:

- Prague launch pages consume public widget coordinates only;
- Prague launch refs use `CLICKEEN`;
- unresolved embedded widget refs fail validation;
- Prague has no private translation internal dependencies;
- string-form `accountInstanceRef` is deleted from active widget-rendering paths or migrated to object form;
- recursive launch validation covers top-level and nested widget refs;
- launch-scope embeds do not inherit refs, synthesize refs, or fall back to placeholder widget UI;
- active Prague docs and widget docs no longer teach `00000001` as active product truth;
- 103L launch precondition evidence is recorded as pass/block without expanding this PRD into translation refactor work.
