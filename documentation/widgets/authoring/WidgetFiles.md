# Widget Files

STATUS: CURRENT SYSTEM OPERATOR SPEC

Every Clickeen widget source folder contains exactly six source files:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  editable-fields.json
  limits.json
  index.html
  styles.css
  runtime.js
```

No widget-local source runtime files exist outside this six-file contract.
Shared runtime utilities live in `tokyo/product/widgets/shared/`.

## File Responsibilities

| File | Responsibility |
| --- | --- |
| `spec.json` | Widget identity, defaults, presets when present, Bob editor panels, ToolDrawer controls, `itemKey`, and widget-local normalization when present. |
| `editable-fields.json` | Customer-visible text paths that Bob and Translation Agent can edit or translate. |
| `limits.json` | Mapping from widget paths/operations to account entitlement keys. |
| `index.html` | Initial document template and stable field/behavior hooks used to generate complete customer-visible markup. |
| `styles.css` | Widget-scoped visual styles, shared style module markers, and CSS variable consumption. |
| `runtime.js` | Behavior-only module that binds interaction to generated markup; it does not render primary content. |

## Consumers

| File | Consumed by |
| --- | --- |
| `spec.json` | Bob compiler, Web Code Generator, and widget default composition. |
| `editable-fields.json` | Bob copy-edit surfaces and Translation Agent field selection. |
| `limits.json` | Bob edit policy and Roma account create/save enforcement. |
| `index.html` | Web Code Generator initial document generation for Bob preview and exact save package. |
| `styles.css` | Web Code Generator composition of exact saved `styles.css`. |
| `runtime.js` | Web Code Generator composition of exact saved behavior-only `runtime.js`. |

Operators must keep the six files internally consistent. A new Core path in
`spec.json.defaults` is not enough: if it is customer-visible text it also needs
`editable-fields.json`; if it is tier-limited it needs `limits.json`; if runtime
uses it, generated markup and `runtime.js` behavior must consume it through
their exact structured contracts.

## Source Vs Compiled Package

The six-file contract is the widget source contract. It is not the compiled Bob
payload and it is not the saved public package.

Compiled/saved packages may include shared Shell CSS/JS, Dieter assets, and
generated package files. The saved account Instance folder is:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  index.html
  styles.css
  runtime.js
```

Bob generates only the exact `index.html`, `styles.css`, and `runtime.js` bytes
and submits those with the current config through Roma. Roma derives exact
`instance.config.json` and `instance.content.json` source artifacts from that
config and the Widget editable-field contract. Tokyo-worker stores Roma's
derived source artifacts plus Bob's exact three package files. Public serving
requires publish state and valid exact package files.

Current generation seals widget-local `styles.css`, `runtime.js`, and selected
shared widget modules into generated `styles.css` and `runtime.js`. Required
Dieter token/component CSS is also
sealed into `styles.css`; account assets and approved Dieter icon URLs remain
external delivery references. Changing sealed source files after an account
package is written does not rewrite that stored package.

## Runtime Path

```text
Roma loads compiled widget software
  -> Roma opens Bob with saved instance data and the saved instance package
  -> user edits one browser-memory instance
  -> Bob generates and previews exact package files for each valid working state
  -> Bob sends current config and exact generated package to Roma
  -> Roma hosts and policy-checks the save command
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
- Do not move primary content rendering into `runtime.js`.
