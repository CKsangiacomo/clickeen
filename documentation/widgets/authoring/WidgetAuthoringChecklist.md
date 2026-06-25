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

1. Confirm the widget source folder contains exactly six files.
2. Confirm every Core control path exists in `spec.json.defaults`.
3. Confirm Shell paths remain Shell-owned.
4. Confirm Shell/shared paths resolve through composed Shell defaults.
5. Confirm every customer-visible text path, including Shell Header text paths,
   is listed in `editable-fields.json`.
6. Confirm plan limits map through `limits.json`.
7. Confirm `widget.html` uses the Shell/Core DOM shape.
8. Confirm `widget.client.js` uses shared Shell utilities for runtime,
   appearance/fill/surface, branding, share, preview localization, locale
   switcher, Header, Stage/Pod, Core size, and typography as relevant.
9. Confirm no widget-local fallbacks were added for required shared helpers.
10. Confirm Clickeen Pages references use saved account widget instances.

## Edit Boundaries

| Change | Required files |
| --- | --- |
| New Core state path | `spec.json`, `widget.client.js`, and docs for that widget. |
| New customer-visible text | `spec.json`, `editable-fields.json`, `widget.client.js`, and docs for that widget. |
| New repeatable item text | Same as customer-visible text, plus stable `arrayItemIdentity`. |
| New entitlement-limited behavior | `limits.json`, Roma policy path if needed, and docs for that widget. |
| New Core DOM hook | `widget.html`, `widget.client.js`, and docs for that widget. |
| Shared Shell behavior | Shared file under `tokyo/product/widgets/shared/`, not a widget-local helper. |

Do not move a change across these boundaries by hiding it in a generated package
or a local fallback. The source contract is what agents operate.

## Verification

```bash
pnpm validate:widgets
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
