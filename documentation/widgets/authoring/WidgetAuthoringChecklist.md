# Widget Authoring Checklist

STATUS: CURRENT SYSTEM OPERATOR SPEC

Use this checklist for widget source or widget documentation changes.

## Before Editing

1. Read `documentation/architecture/CONTEXT.md`.
2. Read `documentation/strategy/WhyClickeen.md`.
3. Read `documentation/services/bob.md`.
4. Read `documentation/services/roma.md`.
5. Read `documentation/services/tokyo-worker.md`.
6. Read `documentation/widgets/authoring/` and `documentation/widgets/shared/`.
7. Read the exact widget operator spec under `documentation/widgets/widgets/`.
8. Read the exact widget source under `tokyo/product/widgets/{widgetType}/`.

## Authority Gate

Before product-path changes, name:

```text
Product surface
Account/session coordinate
Storage coordinate
Route/API boundary
Runtime/deploy surface
Verification surface
```

## Execution

1. Confirm the widget source folder contains the six canonical files and exact
   `{widgetType}_tooldrawer_l10n_labels/en.json` folder/file.
2. Confirm every Core control path exists in `spec.json.defaults`.
3. Confirm Shell contains exactly Header and Core; Stage and Pod remain the
   presentation frame outside it.
4. Confirm cross-widget defaults resolve through the common-default contract,
   independently of DOM ownership.
5. Confirm every customer-visible text path, including Header text paths,
   is listed in `editable-fields.json`.
6. Confirm plan limits map through `limits.json`.
7. Confirm `widget.html` uses the Stage/Pod/Shell/Header/Core DOM shape.
8. Confirm `widget.client.js` uses shared widget utilities for runtime,
   appearance/fill/surface, branding, share, preview localization, locale
   switcher, Header, Stage/Pod, Core size, and typography as relevant.
9. Confirm no widget-local fallbacks were added for required shared helpers.
10. Confirm every widget-authored ToolDrawer copy value is a `$label:{key}`
    token and every token resolves from the adjacent English label file, with
    no missing or unused entries.
11. Confirm every resolved editor cluster has one plain-text section label,
    with no pre-encoded HTML entities or duplicate section/group heading.
12. Confirm only shared Header and the widget's primary Content section declare
    `initiallyOpen: true`; every other section relies on the collapsed default.

## Edit Boundaries

| Change | Required files |
| --- | --- |
| New Core state path | `spec.json`, `widget.client.js`, and docs for that widget. |
| New or changed widget-authored ToolDrawer copy | `spec.json` label token plus `{widgetType}_tooldrawer_l10n_labels/en.json`. |
| New customer-visible text | `spec.json`, `editable-fields.json`, `widget.client.js`, and docs for that widget. |
| New repeatable item text | Same as customer-visible text, plus stable `arrayItemIdentity`. |
| New entitlement-limited behavior | `limits.json`, Roma policy path if needed, and docs for that widget. |
| New Core DOM hook | `widget.html`, `widget.client.js`, and docs for that widget. |
| Shared widget behavior | Shared file under `tokyo/product/widgets/shared/`, not a widget-local helper. |

Do not move a change across these boundaries by hiding it in a generated package
or a local fallback. The source contract is what agents operate.

## Verification

```bash
pnpm validate:widgets
pnpm --filter @clickeen/bob test:editor-contract
git diff --check -- tokyo/product/widgets documentation/widgets
```

For public/runtime behavior, verify through Roma, Tokyo-worker, and the
published `clk.live` or `dev.clk.live` surface that owns the truth.

For Translation Agent behavior, verify that `editable-fields.json` names only
customer-visible text paths and that array-backed text includes the exact
identity path needed to address the right item.

For product behavior, product data, deploy state, managed-service state, or
shared architecture documentation changes, run the V1-V8 audit from `AGENTS.md`
and reconcile documentation with runtime before final response.
