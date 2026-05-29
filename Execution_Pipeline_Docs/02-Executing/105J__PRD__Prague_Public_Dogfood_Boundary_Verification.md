# PRD 105J - Prague Public Dogfood Boundary Verification

Status: Active execution sub-PRD
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105H__PRD__Execution_Verification_Protocol.md`, `105I__PRD__Admin_Account_Coordinate_And_Context_Verification.md`

## Purpose

Verify that Prague dogfoods Clickeen through the real public widget boundary, without depending on translation internals or fake locale discovery.

This PRD extracts the surviving doctrine from PRD 104C and 104D under the PRD 105 reset.

The core rule:

```text
Prague is a customer of the published widget product.
Prague must not consume Bob, Tokyo, San Francisco, R2 source, or translation operation internals.
```

## Source Documents Reviewed

This PRD extracts from:

```text
104__PRD__Prague_Dogfood_Boundary_And_Admin_Account_Coordinate.md
104C__PRD__Prague_Dogfood_Boundary_Cleanup.md
104D__PRD__Prague_Locale_Stub_Cleanup.md
```

Those documents become historical planning evidence after this extraction. They must not remain active execution authority.

## Product Contract

Prague may embed a published account-owned widget by public coordinate:

```ts
accountInstanceRef: {
  accountPublicId: "CLICKEEN";
  instanceId: string;
  locale?: string;
}
```

Prague may know:

- compact account coordinate;
- instance id;
- optional explicit locale selection if the public runtime supports it.

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

## PRD 105 Locale Correction

Older 104 docs mention locale-specific public artifacts such as:

```text
/{locale}.html
```

That is not active PRD 105 authority.

The default public widget shape is one embed entry:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json
```

`accountInstanceRef.locale` is not proof that a `{locale}.html` file exists. It is only an optional public embed selection input if supported by the current published widget runtime.

Prague must not:

- infer widget locale availability from Prague route locale;
- infer widget locale availability from market locale lists;
- infer widget locale availability from page chrome locale;
- mutate widget locale through query-param behavior that implies readiness;
- read private translation state to discover locales;
- claim per-locale HTML artifacts unless a separate SEO/GEO/public-artifact PRD creates that product shape.

## Locale Stub Cleanup

The null-returning locale discovery stub is not a product boundary:

```text
prague/src/lib/instanceL10n.ts
```

It must be deleted as a discovery module or replaced by a real public-boundary implementation whose inputs and outputs are documented here.

Preferred active model:

```text
Prague either embeds the base public widget,
or Prague passes an explicit locale selection to the public widget boundary if the published runtime supports it.
Prague does not discover available account-widget locales.
```

If display-only locale labels/sorting survive, they must move to a file whose name and API do not imply account-widget locale discovery.

## Prague Launch Boundary

Active launch page data must use object-form refs:

```ts
accountInstanceRef: {
  accountPublicId: "CLICKEEN";
  instanceId: string;
  locale?: string;
}
```

String-form refs are not launch authority.

When `accountInstanceRef` exists:

- `accountPublicId` is required;
- `instanceId` is required;
- partial refs are invalid;
- unresolved refs fail launch validation;
- refs must not be inherited from unrelated blocks;
- refs must not silently render local placeholder widgets;
- refs must not include `embedMode`, `indexable`, widget code, Tokyo paths, overlay ids, or translation state as identity.

## Prague Launch Proof Set

The current Clickeen-owned launch proof set is expected to include:

```text
tokyo/prague/pages/faq/overview.json
tokyo/prague/pages/faq/examples.json
tokyo/prague/pages/faq/features.json
tokyo/prague/pages/faq/pricing.json
tokyo/prague/pages/countdown/overview.json
tokyo/prague/pages/logoshowcase/overview.json
```

Each launch-scope page that embeds a widget must reference a real public widget coordinate and must validate that the public coordinate resolves.

## Blast Radius

Expected implementation areas:

```text
tokyo/prague/pages/**
prague/src/**
prague/README.md
documentation/ai/BUILD_PraguePage.md
documentation/services/prague/**
documentation/widgets/**
documentation/architecture/CONTEXT.md
documentation/capabilities/localization.md
documentation/capabilities/multitenancy.md
```

Do not edit for this PRD:

```text
berlin/**
roma/**
supabase/migrations/**
tokyo-worker/src/routes/**
bob/**
sanfrancisco/src/**
dieter/**
translation workflow runtime
```

## Drift Stop Conditions

Stop and revise if execution requires:

- reading `localeSync`;
- reading `translatedValues`;
- reading `translation-generation-job.json`;
- reading `baseContentMarker` or `generationRequestMarker`;
- calling San Francisco;
- using Tokyo private R2 paths;
- inventing Prague-specific widget identity;
- adding account slug/alias routing;
- creating default `{locale}.html`, `script.{locale}.js`, or `styles.{locale}.css` public artifacts;
- preserving null-returning locale discovery as launch behavior;
- claiming market locales prove account-widget locale availability.

## Verification Scope

This PRD is green only when active code/docs are checked for:

- Prague launch refs use object-form `accountInstanceRef`;
- launch refs use `CLICKEEN` for Clickeen-owned widgets;
- unresolved launch refs fail validation;
- Prague has no private translation operation dependencies;
- `prague/src/lib/instanceL10n.ts` is deleted as a null-returning discovery module or replaced by a real public-boundary implementation;
- no launch behavior infers widget locale availability from market/page/chrome locale;
- no active Prague docs claim `{locale}.html` as the default public widget locale model;
- no active Prague docs claim Prague reads or intersects instance-available locales;
- Prague build passes with strict account-instance validation;
- at least one FAQ page and one non-FAQ page embed real public Clickeen-owned widgets if those pages are in launch scope.

## Required Static Tripwires

Execution must include scans equivalent to:

```sh
rg -n "translation-generation-job|localeSync|translatedValues|localeStatus|baseContentMarker|generationRequestMarker|queuedLocales|pendingLocales|completedLocales|currentReadyLocales|supersededLocales" prague/src tokyo/prague/pages -S
rg -n "instanceL10n|resolveTokyoInstanceLocales|instanceLocalesRaw|fallbackInstanceLocales" prague/src -S
rg -n "\\{locale\\}\\.html|script\\.\\{locale\\}\\.js|styles\\.\\{locale\\}\\.css|/{locale}\\.html" prague documentation tokyo/prague/pages -S
rg -n "accountInstanceRef" prague/src tokyo/prague/pages -S
```

Expected result:

- private translation terms absent from Prague launch code/data;
- no null locale-discovery stub remains;
- default per-locale public artifact language is absent from active Prague docs/code;
- object-form `accountInstanceRef` is the surviving launch shape.

## Runtime Proof

Required runtime proof:

```text
PUBLIC_CLK_LIVE_URL=https://dev.clk.live PRAGUE_VALIDATE_ACCOUNT_INSTANCE=1 PRAGUE_VALIDATE_ACCOUNT_INSTANCE_STRICT=1 pnpm --filter @clickeen/prague build
```

The proof must show:

- Prague build succeeds;
- launch-scope account refs resolve publicly;
- broken/partial refs fail validation;
- Prague embeds public widget URLs only;
- Prague does not fetch private Tokyo, San Francisco, Bob, or R2 source paths.

## Archive Decision For Source Batch

After this PRD is created, the 104 Prague boundary and locale-stub docs must move to `03-Executed` as historical planning evidence with the rest of the 104 batch.

Required archive status:

```text
Historical planning evidence.
Surviving Prague public dogfood boundary doctrine extracted to PRD 105J.
Superseded by PRD 105/105C/105H/105I/105J where conflicting.
```

## Non-Scope

This PRD does not:

- migrate the admin account coordinate by itself;
- implement translation workflow repair;
- implement zero-touch translation;
- implement automatic rematerialization;
- implement SEO/GEO static locale pages;
- redesign Prague visual content;
- change public widget materialization architecture.
