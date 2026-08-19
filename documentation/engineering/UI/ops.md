# UI Ops - How Dieter Is Consumed And Delivered

**Living, canonical reference.**

This doc owns how Dieter moves through the system.
[`dieter.md`](dieter.md) owns what the design system is.

- Canonical source: `dieter/**`.
- Execution PRD:
  [`126G__PRD__Ops.md`](../../../Execution_Pipeline_Docs/03-Executed/126__UI_Optimization/126G__PRD__Ops.md).
- Manual icon authoring: `tooling/sf-symbols/**`.

## Source And Consumers

There is one Dieter source tree and no generated Dieter runtime tree.

- Bob and Roma compile `dieter/styles.css` and source hydrators.
- Prague compiles canonical token CSS.
- DevStudio generates its reveal pages from source.
- Widget package generation reads canonical token/component CSS.
- Instance materialization writes required Dieter CSS into instance
  `styles.css`.

The applications and widget packages do not fetch shared Dieter CSS or
JavaScript at runtime.

## Icon Delivery

Icons are the only Dieter files delivered as shared CDN objects:

```text
dieter/icons/svg/** -> R2 dieter/icons/svg/**
```

The Tokyo product-root sync deploys the committed SVG files directly.
`dieter/icons/icons.json` is used only by the human-operated SF extraction
tool. There is no deployed manifest, runtime approval registry, editor bundle,
component tree, or token tree.

The `cloud-dev workers deploy` workflow watches Dieter source because the root
checks regenerate widget product packages before the product-root sync. Tokyo
Worker deployment itself remains selected by the workflow's changed-surface
logic.

## Product/Data Boundary

Dieter source and deployment never mutate account product data.

- Design-system source lives in git.
- Public icon bytes live under the root R2 `dieter/icons/svg/**` path.
- Account/runtime data lives under
  `accounts/{accountPublicId}/...` and moves through its product routes.
- Account SVGs are account assets, not Dieter icons.

## Verification

```bash
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm validate:widgets
pnpm tokyo:r2:sync:check
```

The Dieter governance command checks the remaining token/component source
contracts. It does not count, approve, or compare icons against `icons.json`.

The sync dry run must contain only SVG files under its Dieter root. Consumer
changes also require the focused Bob, Roma, Prague, DevStudio, or widget
package build.

## Operator Rules

- Do not recreate `scripts/build-dieter.js`, `scripts/verify-svgs.js`, or
  `tokyo/product/dieter/**`.
- Do not add browser globals, manifests, registries, compatibility bundles, or
  a second Dieter edit path.
- Keep icon origination human-owned through `tooling/sf-symbols/**`.
- Agents consume the human-selected icon source; they do not originate or
  silently substitute icons.
