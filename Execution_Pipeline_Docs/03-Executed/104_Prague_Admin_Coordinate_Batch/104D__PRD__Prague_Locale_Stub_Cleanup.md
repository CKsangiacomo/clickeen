# PRD 104D - Prague Locale Stub Cleanup

Status: Draft for execution planning
Owner: Product + Architecture
Parent: [PRD 104](./104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md)

## Purpose

Remove fake Prague locale discovery before Prague becomes public product proof.

The current risk is a null-returning stub:

```text
prague/src/lib/instanceL10n.ts
```

A function that validates ids and returns `null` is not a product boundary. It implies Prague can resolve widget locales while proving that it cannot.

## Product Contract

After this PRD:

```text
Prague either embeds a specific public locale artifact explicitly,
or Prague has no locale discovery behavior.
```

Prague must not pretend to know available widget locales unless it gets that data through a real public/build-time product boundary.

Prague page locale, Prague chrome locale, and account-widget public artifact locale are separate domains.

Prague may localize its own website copy through page-owned sidecars. It must not use market locales, canonical locales, page locale, chrome locale, or URL locale as evidence that an embedded account widget has a corresponding public locale artifact.

## Required Scope

Required behavior:

- `prague/src/lib/instanceL10n.ts` does not remain as a null-returning stub.
- `prague/src/lib/instanceL10n.ts` is deleted as a locale-discovery module. If `localeLabel`, sorting, or display-only helpers survive, move them to a file whose name and API do not imply Tokyo/account-widget locale discovery.
- If active code needs it, replace it with a real public-boundary implementation. That implementation must not read translation operation state, private R2 job documents, locale sync records, or San Francisco queue state.
- `accountInstanceRef.locale` remains a render selection for an already materialized public artifact, not availability truth.
- Prague may render a widget locale artifact only when the locale is explicit product data for that render path: the current Prague route locale, or an explicit page JSON ref such as `accountInstanceRef.locale`.
- Market locale lists may drive Prague route generation and UI localization, but they must not be treated as account-instance available locales.
- Delete or block synthetic widget-locale availability paths:
  - `resolveTokyoInstanceLocales`
  - `instanceLocalesRaw`
  - `fallbackInstanceLocales`
  - hardcoded fallback locale arrays for widget previews
  - market-locale-derived widget preview tiles
  - page-locale-derived `accountInstanceRef.locale` defaults that imply artifact availability
  - locale showcase dropdown behavior that mutates `?locale=`
- `locale-showcase` may remain only if each tile is backed by an explicit object-form `accountInstanceRef` with a concrete locale and the build validates that the public artifact exists. Otherwise remove `locale-showcase` from launch pages and docs.
- For launch-scope non-English Prague routes, missing `{page}.translations/{locale}.json` must either fail the build or the locale must not be advertised for that route. Silent fallback to base JSON is forbidden outside `en`.

Given the current PRD intent, the preferred execution is deletion unless the audit proves active usage.

## Blast Radius

Expected implementation areas:

```text
prague/src/lib/instanceL10n.ts
prague/src/components/WidgetBlocks.astro
prague/src/blocks/locale-showcase/locale-showcase.astro
prague/src/components/InstanceEmbed.astro
prague/src/lib/blockRegistry.ts
prague/src/lib/i18n.ts
prague/src/lib/markdown.ts
prague/src/blocks/site/nav/**
prague/content/base/v1/chrome.json
prague/src/markets/markets.json
prague/src/**
tokyo/prague/pages/**
tokyo/prague/pages/**/*.translations/*.json
documentation/services/prague/PraguePageAgentGuide.md
documentation/services/prague/**
documentation/widgets/WidgetPraguePagesBuilder.md
documentation/widgets/FAQ/FAQ_PraguePages.md
prague/README.md
documentation/capabilities/localization.md
documentation/architecture/CONTEXT.md
```

Do not edit:

```text
sanfrancisco/src/**
tokyo-worker/src/domains/translation/**
bob/**
supabase/migrations/**
```

## Drift Stop Conditions

Stop and revise if deletion or replacement requires:

- reading `localeSync`;
- reading `translatedValues`;
- reading `translation-generation-job.json`;
- calling San Francisco;
- using Tokyo private R2 paths;
- implementing dynamic public locale discovery without a named public boundary.
- keeping generated locale-showcase options based on `markets[].locales`;
- keeping inherited refs from another block as locale showcase truth;
- keeping auto-injected locale showcase behavior that implies account-instance locale availability;
- keeping docs that describe injected locale showcase, first-ref fallback, market-locale widget proof, or "instant any market" widget localization unless backed by explicit public artifacts;
- requiring Prague to know locale readiness, translated-locale completeness, generation status, or account active locale policy.

## Verification

Static checks:

```sh
rg -n "resolveTokyoInstanceLocales|instanceL10n|instanceLocalesRaw|fallbackInstanceLocales|chooseOverviewHeroLocales|resolveOverviewHeroNamedLocaleCount" prague/src -S
rg -n "localeSync|translatedValues|translation-generation-job|baseContentMarker|generationRequestMarker|queuedLocales|pendingLocales|completedLocales|currentReadyLocales|supersededLocales|sanfrancisco|San Francisco" prague/src -S
rg -n "locale-showcase|localeShowcase|accountInstanceRef\\.locale|localeOverride|\\?locale=" prague/src tokyo/prague/pages documentation/services/prague documentation/services/prague/PraguePageAgentGuide.md documentation/widgets prague/README.md -S
rg -n "marketConfig\\?\\.locales|listPragueLocales\\(|regionalFallbackLocales|tier1Locales|nativeLocale" prague/src prague/src/markets/markets.json -S
rg -n "locale \\|\\| 'en'|locale \\|\\| \"en\"|\\?\\? 'en'|\\?\\? \"en\"|searchParams\\.set\\('locale'|searchParams\\.set\\(\"locale\"" prague/src -S
rg -n "injected after minibob|first complete account instance ref|same instance.*locales|instance-available locales|intersect.*instance|query param" documentation/services/prague documentation/widgets documentation/ai prague/README.md -S
```

Expected result:

- no null-returning locale-discovery stub remains;
- Prague has no private translation dependency;
- any surviving locale behavior is explicitly public-boundary behavior;
- no market-locale or page-locale fallback is treated as account-widget artifact availability;
- locale-showcase is either deleted from launch scope or backed by explicit validated public artifact refs.

Runtime proof:

```text
Prague build succeeds.
Prague pages that specify accountInstanceRef.locale render a public locale artifact URL ending in /{locale}.html.
Prague pages without accountInstanceRef.locale render the route locale artifact by default, or the base index.html for en, without claiming availability beyond the actual public artifact.
Prague does not attempt dynamic locale availability discovery through private translation state.
Prague pages that display multiple locale artifacts do so only from explicit locale refs or current route locale. They do not compute account-instance availability from market locale lists, private Tokyo state, San Francisco state, or null-returning discovery.
Locale showcase copy and docs do not claim artifact availability from market locales alone.
```

## Documentation Updates

Update active docs so Prague locale behavior is not overstated:

```text
documentation/services/prague/prague-overview.md
documentation/services/prague/blocks.md
documentation/capabilities/localization.md
documentation/architecture/CONTEXT.md
documentation/services/prague/PraguePageAgentGuide.md
documentation/widgets/WidgetPraguePagesBuilder.md
documentation/widgets/FAQ/FAQ_PraguePages.md
prague/README.md
```

Documentation requirements:

- No active doc says Prague intersects with instance-available locales, discovers widget locales, or uses market locale config as proof that a widget locale artifact exists.
- Docs state the only Prague-side widget locale behavior: route locale or `accountInstanceRef.locale` selects an already materialized public artifact URL.
- Docs state non-English embeds use `/{locale}.html` public artifact paths, not query params and not runtime translation composition.
- Docs state Prague never reads `translation-generation-job.json`, `localeSync`, `translatedValues`, `baseContentMarker`, `generationRequestMarker`, or San Francisco queue/job state.
- If `locale-showcase` survives, docs describe it as explicit public artifact proof only. If it is removed from launch scope, docs remove injected showcase and first-ref fallback language.

## Acceptance

104D is complete when:

- `prague/src/lib/instanceL10n.ts` is deleted as a discovery module, or replaced with a real public-boundary implementation named and documented by this PRD;
- no null-returning locale-discovery stub remains;
- Prague does not claim locale availability truth from private translation state;
- Prague does not claim account-widget locale availability from market locale lists, canonical locale lists, page locale, or chrome locale;
- `locale-showcase` is either deleted from launch scope or backed by explicit validated public artifact refs per tile;
- injected locale showcase, first-ref fallback, query-param locale switching, and silent non-English page translation fallback are deleted or explicitly blocked for launch scope;
- Prague overview/block/authoring docs no longer describe fake instance-available locale discovery;
- docs describe `accountInstanceRef.locale` as a public artifact selector only;
- Prague build still passes.
