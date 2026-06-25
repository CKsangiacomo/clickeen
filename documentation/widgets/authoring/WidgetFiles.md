# Widget Files

STATUS: CURRENT SYSTEM OPERATOR SPEC

Every Clickeen widget source folder contains exactly six source files:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  editable-fields.json
  limits.json
  widget.html
  widget.css
  widget.client.js
```

No widget-local source runtime files exist outside this six-file contract.
Shared runtime utilities live in `tokyo/product/widgets/shared/`.

## File Responsibilities

| File | Responsibility |
| --- | --- |
| `spec.json` | Widget identity, defaults, presets when present, Bob editor panels, ToolDrawer controls, `itemKey`, and widget-local normalization when present. |
| `editable-fields.json` | Customer-visible text paths that Bob and Translation Agent can edit or translate. |
| `limits.json` | Mapping from widget paths/operations to account entitlement keys. |
| `widget.html` | Static Shell/Core DOM skeleton, shared CSS/script includes, stable `data-role` hooks. |
| `widget.css` | Widget-scoped visual styles and CSS variable consumption. |
| `widget.client.js` | Deterministic browser runtime that validates state, applies Shell utilities, and updates Core DOM. |

## Consumers

| File | Consumed by |
| --- | --- |
| `spec.json` | Bob compiler, Roma package materialization, widget default composition. |
| `editable-fields.json` | Bob copy-edit surfaces and Translation Agent field selection. |
| `limits.json` | Roma account policy and publish/save enforcement. |
| `widget.html` | Bob preview, Roma package materialization, public `clk.live` package. |
| `widget.css` | Bob preview and public package. |
| `widget.client.js` | Bob preview and public package runtime. |

Operators must keep the six files internally consistent. A new Core path in
`spec.json.defaults` is not enough: if it is customer-visible text it also needs
`editable-fields.json`; if it is tier-limited it needs `limits.json`; if runtime
uses it, `widget.client.js` must validate and render it.

## Source Vs Compiled Package

The six-file contract is the widget source contract. It is not the compiled Bob
payload and it is not the saved public package.

Compiled/saved packages may include shared Shell CSS/JS, Dieter assets, and
generated package files. Roma materializes saved account instance packages as:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  index.html
  styles.css
  runtime.js
```

Tokyo-worker stores the exact source/package files submitted by Roma. Public
serving requires publish state and package/source agreement.

Current package materialization seals widget-local `widget.css`,
`widget.client.js`, and selected shared widget modules into generated
`styles.css` and `runtime.js`. `/dieter/**` stylesheet links are kept as
external `@import` references; account assets and fonts also remain external
delivery references. Changing sealed source files after an account package is
written does not rewrite that stored package.

## Runtime Path

```text
Roma loads compiled widget software
  -> Roma opens Bob with saved instance data
  -> user edits one browser-memory instance
  -> Bob sends save intent to Roma
  -> Roma materializes package files
  -> Tokyo-worker stores exact account files
  -> clk.live serves stored package files when published
```

## Required Checks

Run after widget source changes:

```bash
pnpm validate:widgets
git diff --check -- tokyo/product/widgets documentation/widgets
```

Widget docs must not describe files that are not present in the widget source
folder.

## Hard Stops

- Do not add widget-local helper files.
- Do not move shared Shell behavior into a widget folder.
- Do not add fallback package files that mask a bad save.
- Do not document generated account package files as widget source files.
- Do not make `editable-fields.json` broader than actual customer-visible text.
