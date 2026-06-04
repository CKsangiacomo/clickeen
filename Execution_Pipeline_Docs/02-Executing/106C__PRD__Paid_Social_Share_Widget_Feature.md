# PRD 106C - Paid Social Share Widget Feature

Status: Executed / verified
Owner: Product + Architecture
Date: 2026-06-03
Parent: `../01-Planning/106__PRD__Page_Composer_Widget_Instance_Materializer_Foundation.md`
Depends on: `106A__PRD__Widget_File_Structure_V2.md`, `106B__PRD__Widget_Package_Composition_Contract.md`

## Execution Progress

2026-06-03 repair pass verified:

- Roma save resolves the account policy from the authorization capsule and rejects non-entitled saves that enable `behavior.socialShare.enabled`.
- Tokyo-worker stores only submitted package bytes; it does not sanitize, render, or remove social share chrome.
- Page Composer has no social-share entitlement branch. It consumes already-validated widget packages and inherits the stored package bytes.
- Verified with `pnpm --filter @clickeen/roma test`, `pnpm --filter @clickeen/roma typecheck`, `pnpm --filter @clickeen/tokyo-worker test`, and `pnpm --filter @clickeen/tokyo-worker typecheck`.

2026-06-04 repair pass verified:

- Added a Bob package-generation fixture proving disabled social share config omits share markup/CSS/runtime and enabled social share config includes the paid overlay inside the same generated `index.html`, `styles.css`, and `runtime.js` package.
- The fixture proves the generated package keeps saved visible widget content and the keyed `CK_WIDGETS[instanceId]` payload while adding share chrome.
- Verified with `pnpm --filter @clickeen/bob test`, `pnpm --filter @clickeen/bob typecheck`, and `git diff --check`.

## Purpose

Turn Prague's current widget share overlay into a paid widget package feature.

The reference implementation is:

```text
prague/src/components/InstanceEmbed.astro
```

The current Prague share overlay is well coded and must not be lost. This PRD must preserve the behavior, visual quality, and interaction shape across HTML, CSS, and JavaScript.

The product feature must live in generated widget packages, not in Page Composer.

## Current Prague Share Overlay Audit

Before implementation, audit `InstanceEmbed.astro` and capture the current behavior that must survive.

The audit must cover:

- HTML structure:
  - hover/focus topbar;
  - `details` / `summary` share menu;
  - share button;
  - menu sections;
  - share cards;
  - toast region.
- CSS behavior:
  - hover/focus reveal;
  - mobile always-visible behavior;
  - dark glass share button;
  - anchored menu;
  - card grid;
  - z-index/positioning;
  - current Dieter/token-based proportions.
- JavaScript behavior:
  - copy link;
  - SMS;
  - email;
  - WhatsApp;
  - Telegram;
  - Signal;
  - Messenger;
  - WeChat;
  - LINE;
  - Slack;
  - Teams;
  - Discord;
  - X;
  - LinkedIn;
  - Facebook;
  - Reddit;
  - Instagram;
  - TikTok;
  - toast feedback;
  - URL/anchor behavior.
- Assets/icons:
  - current Prague/Dieter icons;
  - current inlined brand SVGs;
  - any normalization needed before moving into generated packages.

The goal is not to simplify away working product. The goal is to move the working Prague overlay behavior into the generated widget package model without dragging Prague host chrome into customer output.

## Product Contract

Widget config path:

```text
behavior.socialShare.enabled
```

Entitlement key:

```text
widget.socialShare.enabled
```

Policy truth belongs in:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
```

Widget mapping belongs in:

```text
tokyo/product/widgets/{widgetType}/limits.json
```

## Generated Package Behavior

When the account is entitled and the widget instance has social share enabled:

```text
index.html   includes share button/menu markup inside the widget root
styles.css   includes share overlay styling
runtime.js   includes share URL, copy, toast, and channel handlers
```

The generated package must carry all needed share HTML/CSS/JS. It must not rely on Prague runtime, Prague page chrome, or a parent host frame.

When the account is not entitled:

- Bob rejects or upsells the toggle through the existing policy path;
- materialization must not emit the paid share overlay;
- Page Composer must not add it later.

## Page Composer Rule

Page Composer stays dumb:

```text
if widget package contains social share, composed page contains social share
if widget package does not contain social share, composed page does not invent social share
```

## Prague Rule

Do not delete Prague `InstanceEmbed` share chrome.

It remains:

- current public showcase behavior;
- UX reference for the paid widget feature.

It is not copied blindly into customer-hosted page placements. It is audited and ported into the widget package feature so the quality survives in a root-scoped, generated-package-safe form.

## Share Target Rule

The share target is resolved by the delivery context:

```text
single widget URL -> share https://clk.live/{accountPublicId}/{instanceId}
page URL -> share https://clk.live/{accountPublicId}/pages/{pageId}
embedded page/placement -> share the host page URL when available, otherwise the Clickeen object URL
```

V1 may share the current public URL. Placement anchors can be added later if needed, but the runtime must not assume Prague-only URLs.

## Localized Share Chrome Gate

Social share UI is customer-visible widget chrome.

It must follow the same localization discipline as the rest of the widget package.

Before paid launch, 106C must decide and implement one of:

```text
share labels/toasts are declared in editable-fields/localized package copy
or share labels/toasts are generated from an approved shared localized chrome dictionary
```

Do not ship paid social share with hardcoded English labels/toasts as a hidden runtime exception.

## Audit Refresh Decisions

The audit refresh is useful for 106C because it confirms the paid social share path is not active production architecture yet.

Use:

- no active `widget.socialShare.enabled` policy/materialization path was found;
- Prague share chrome remains reference behavior, not product authority;
- the paid feature must be emitted by generated widget packages when entitled;
- Page Composer must inherit share output from widget packages and contain no share-specific logic.

Reject:

- a page-level sharing subsystem;
- Prague wrapper dependency inside generated packages;
- social-share analytics/attribution scope in 106C;
- customer-domain SEO claims for client-side embeds.

## Execution Record

### Slice 1 - Policy, Limits, Defaults, Bob Toggle

Executed and verified.

What changed:

- Added `widget.socialShare.enabled` to `packages/ck-policy/entitlements.matrix.json`.
- Added typed registry/meta support in `packages/ck-policy/src/registry.ts`.
- Added an explicit policy test proving social share is a paid flag: Free is false, Tier 1+ is true.
- Added `behavior.socialShare.enabled` mappings to every current widget `limits.json`.
- Added default-off `behavior.socialShare.enabled` config to FAQ, Countdown, and Logo Showcase.
- Added Bob editor toggle fields through the existing widget spec/editor/limits path.

Why this is correct:

- The product has one config path and one entitlement key.
- Bob uses the existing policy/limits machinery; no new paid-feature subsystem was introduced.
- Non-entitled accounts hit the same upsell/reject path used by existing paid widget behavior.

Verification:

- `pnpm --filter @clickeen/ck-policy test`
- `pnpm validate:widgets`
- `pnpm --filter @clickeen/bob test`
- `git diff --check`

### Slice 2 - Roma Save Policy Gate

Executed and verified.

What changed:

- Roma validates `behavior.socialShare.enabled` against the real account policy before saving.
- Non-entitled saves with `behavior.socialShare.enabled: true` fail at the account product boundary with `coreui.upsell.reason.flagBlocked`.
- Entitled saves are allowed to submit package bytes that include share chrome.
- Tokyo-worker no longer sanitizes or renders social share output. It applies storage-boundary checks and stores submitted package bytes.
- Tests prove non-entitled save rejection, entitled save acceptance, and disabled config acceptance.

Why this is correct:

- Roma owns account-command acceptance and has the account entitlement snapshot.
- Bob-only gating is no longer the only protection.
- Tokyo remains storage/edge/package-readiness, not a widget renderer or policy sanitizer.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `git diff --check`

### Slice 3 - Generated Package Share Chrome

Executed and verified.

What changed:

- Added package-owned shared files:
  - `tokyo/product/widgets/shared/socialShare.css`
  - `tokyo/product/widgets/shared/socialShare.js`
- Builder package generation injects share markup inside the generated widget root only when validated config is enabled.
- Builder package generation appends social-share CSS to generated `styles.css` only for enabled packages.
- Builder package generation appends social-share runtime to generated `runtime.js` only for enabled packages.
- Generated share runtime is root-scoped, idempotent, and reads `window.CK_WIDGETS[instanceId]`.
- Generated share runtime supports: copy, SMS, email, WhatsApp, Telegram, Signal, Messenger, WeChat, LINE, Slack, Teams, Discord, X, LinkedIn, Facebook, Reddit, Instagram, TikTok, toast feedback, URL/channel params, and close-on-escape/outside-click/pointer-leave behavior.
- Share labels/toasts are centralized in shared package chrome copy, not hidden inside Prague.
- Prague `InstanceEmbed.astro` was not deleted or made a dependency.

Why this is correct:

- The generated public package is still exactly three files: `index.html`, `styles.css`, `runtime.js`.
- Page Composer remains dumb: it will inherit share output from widget packages and does not need entitlement or channel logic.
- Non-entitled saves cannot submit share-enabled package bytes through Roma.

Verification:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm validate:widgets`
- `git diff --check`

## Pre-Execution Agent Review Addendum

Three-agent pre-execution review completed against `106__Umbrella__Composition_Vision.md`.

Consensus: 106C is product-correct only if social share remains a paid widget package feature. It must not become a Page Composer feature, Prague wrapper dependency, page-level sharing subsystem, or new product object.

### Staff Engineer Findings

- Primary code vectors:
  - `prague/src/components/InstanceEmbed.astro` as audit/reference only;
  - `packages/ck-policy/entitlements.matrix.json`;
  - `packages/ck-policy/src/registry.ts`;
  - target widget `limits.json` and `spec.json`;
  - `tokyo/product/widgets/shared/branding.js` or a new package-safe shared social share module only if it removes duplication;
  - target widget `widget.html`, `widget.css`, and `widget.client.js`;
  - `bob/lib/session/publicPackage.ts`;
  - `roma/lib/account-instance-save-policy.ts`;
  - `tokyo-worker/src/domains/account-instances/package-files.ts`;
  - Bob policy/limit toggle paths.
- 106C is blocked until 106A/106B package contracts are verified for target widgets.
- Roma save must enforce `widget.socialShare.enabled`; Bob-only gating is insufficient.
- Tokyo-worker must not receive or derive account policy for rendering social share bytes.

### Senior PM Findings

- The user story is: entitled user enables one paid behavior toggle on one real widget instance; Builder save emits that instance package with share chrome; pages inherit it because they compose widget packages.
- The toggle should be explicit per widget instance and default off unless product explicitly approves otherwise. Composed pages with many share-enabled placements can become visually noisy.
- Share target behavior must be unsurprising:
  - standalone widget shares the widget object URL;
  - hosted composed page shares the page URL;
  - embedded customer page shares host page URL when reliably available;
  - fallback is the Clickeen object URL.
- Share UI labels/toasts are customer-visible chrome. Localized runtime copy path must be decided before paid launch, or English-only must be treated as unacceptable pre-launch debt.

### Principal TPM Findings

- Surviving authorities:
  - `behavior.socialShare.enabled` is the only widget config field;
  - `widget.socialShare.enabled` is the entitlement key;
  - `ck-policy` owns tier/entitlement truth;
  - widget `limits.json` maps config path to entitlement;
  - Bob exposes locked/enabled UI;
  - Roma save is the final account-policy gate before package bytes reach Tokyo;
  - Page Composer has no social-share logic;
  - Prague `InstanceEmbed` remains reference/showcase chrome.
- Downgrade or stale config can leave paid output public until the next save/package update path rejects or removes it; downgrade sweeps must use the same account-policy boundary, not Tokyo rendering.
- Full Prague channel/icon payload copied per widget can bloat composed pages; normalize assets into product-owned package runtime locations.

### Required Pre-Execution Gates

106C cannot go green unless:

- 106B generated package contract is green for target widgets.
- `widget.socialShare.enabled` exists in policy matrix/registry and tests.
- Target widget `limits.json` files map `behavior.socialShare.enabled`.
- Target widgets default `behavior.socialShare.enabled` to `false`.
- Bob shows the enabled/locked/upsell state through existing policy/limits machinery.
- Roma save proves non-entitled enabled config cannot submit share markup/CSS/runtime.
- Downgrade or stale config removes paid output on the next save/package update path.
- Generated share UI lives inside the extractable widget root.
- Generated share markup contains no `<script>`, stylesheet links, Prague iframe chrome, Prague-only anchor assumptions, or page-level layout ownership.
- Share runtime uses `CK_WIDGETS[instanceId]`, not `window.CK_WIDGET`.
- Share runtime is root-scoped and idempotent: two share-enabled widgets on one page do not share toast state, details state, query selectors, timers, or event handlers incorrectly.
- CSS is scoped under the widget root/share chrome classes and safe to concatenate.
- Page Composer contains no entitlement, config, channel, or share-specific branch.
- Current Prague behavior is preserved: copy, SMS, email, WhatsApp, Telegram, Signal, Messenger, WeChat, LINE, Slack, Teams, Discord, X, LinkedIn, Facebook, Reddit, Instagram, TikTok, toast feedback, menu behavior, and mobile visibility.
- Prague `InstanceEmbed` still works as current showcase chrome.

### Scope Guard

Do not add:

- share service;
- share provider registry;
- page-level social share state;
- placement-level share overrides;
- block/section/share object;
- per-channel entitlement flags;
- analytics, attribution dashboards, UTM strategy, or viral reporting;
- share manifest or fourth generated package file;
- parent-window handshake;
- customer-domain SEO guarantees for client-side embeds;
- Prague URL assumptions inside generated packages.

The world-class SaaS version is boring: policy-gated config becomes deterministic static widget package output, and composed pages inherit it without knowing it exists.

## Non-Scope

Do not:

- implement social share as a page feature;
- inject Prague host chrome into every page placement;
- add page-level share UI;
- add analytics or attribution dashboards;
- drop current Prague share channels or interaction behavior without an explicit product decision;
- change public page composition.

## Verification

This PRD is green when:

- `widget.socialShare.enabled` exists in policy registry and matrix;
- relevant widget `limits.json` files map `behavior.socialShare.enabled` to the entitlement;
- Bob rejects or upsells non-entitled enable attempts;
- entitled widgets materialize share markup/CSS/runtime into their generated package;
- non-entitled widgets do not materialize the overlay;
- generated share behavior preserves the audited Prague HTML/CSS/JS behavior in package-safe form;
- generated share runtime is root-scoped and works with multiple share-enabled widgets on one page;
- Prague `InstanceEmbed` still works.
