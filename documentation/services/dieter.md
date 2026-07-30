# Dieter - Design System

STATUS: CURRENT SYSTEM OPERATOR SPEC

Dieter is Clickeen's shared design-system source. It owns tokens, the
high-level application Layout/Page contract, component CSS, component specs,
component snippets, icons, and component hydrators. Account data never lives
in Dieter.

## Authority

| Concern | Current authority |
| --- | --- |
| Design-system source | `dieter/**` |
| Package | `@ck/dieter` for source ownership and typechecking |
| Bob/Roma UI | Compile Dieter source directly |
| Prague UI | Compile Dieter token source directly |
| Widget runtime | Materialize required Dieter CSS into instance `styles.css` |
| Public Dieter files | R2 `dieter/icons/svg/**` only |
| Icon authoring | Human-operated `tooling/sf-symbols/**` |

There is no Dieter build bundle, generated Tokyo mirror, browser manifest, or
`window.Dieter` runtime.

## Source Layout

| Path | Purpose |
| --- | --- |
| `dieter/tokens/` | Canonical token CSS. |
| `dieter/layouts/main-container/` | Canonical `main-container > left-nav + page` layout CSS, example HTML, and spec. |
| `dieter/components/{component}/` | Component CSS, stencil, spec, and optional hydrator. |
| `dieter/components/shared/` | Small source helpers shared by existing components, including compact property-row geometry. |
| `dieter/components/index.ts` | Explicit component-hydrator exports. |
| `dieter/icons/svg/` | Approved SVG icon bytes deployed to R2. |
| `dieter/icons/icons.json` | Source registry used by authoring and compile-time consumers. |
| `dieter/styles.css` | Bob/Roma source CSS entrypoint. |
| `tooling/sf-symbols/` | Manual SF Symbols extraction/generation tool. |

Component folders normally contain:

```text
{component}.css
{component}.html
{component}.spec.json
{component}.ts or {component}.js   # optional source hydrator
```

## Consumer Boundaries

Bob and Roma import `dieter/styles.css` in their application builds. Roma and
DevStudio directly import
`dieter/layouts/main-container/main-container.css`; that layout is deliberately
not in the broad stylesheet because Bob retains its ToolDrawer/Workspace
composition. Bob imports the source hydrators it uses and calls them
explicitly; Dieter does not install a browser global.

Prague imports the canonical token entrypoint in its application build.

Widget package generation reads canonical Dieter token and component CSS.
Instance materialization writes the required rules into that instance's
`styles.css`. Public widget HTML therefore does not fetch Dieter CSS or
JavaScript.

DevStudio reads Dieter source through its existing source generators. Its
generated reveal pages are tooling output, not a deployable Dieter runtime.
The generated Core styles page reads spacing, control geometry, radius, shadow,
and motion values from `dieter-foundation-tokens.css`. The separate Layouts
page reads the real layout HTML/CSS/spec and exposes its four source tokens.
Authenticated edits commit back to that same foundation token file through
DevStudio's validated GitHub write path.

Compact property controls share row geometry through
`dieter/components/shared/property-row.css`. Components continue to own their
specific input, switch, dropdown, popover, hover, focus, and disabled behavior.

Color source keeps one small shared role layer:
`--role-surface-bg`, `--role-surface`, `--role-surface-muted`,
`--role-border`, and `--role-error`. Text and focus retain their existing
`--color-text`, `--color-text-secondary`, and `--focus-ring-color`
authorities. Dieter does not carry unused action, feedback, selected,
disabled, or `on-*` role families.

## Icon Delivery

New or changed icons are generated manually with `tooling/sf-symbols/**`, then
committed as:

```text
dieter/icons/icons.json
dieter/icons/svg/{name}.svg
```

The Tokyo product-root sync deploys the SVG source files directly to:

```text
/dieter/icons/svg/{name}.svg
```

`icons.json` is not deployed. Product controls keep their accessible name on
the control; decorative icons are painted from the approved SVG URL and remain
semantically hidden.

Account-uploaded assets and fonts remain under
`accounts/{accountPublicId}/...`; they are not Dieter icons.

## Verification

From repo root:

```bash
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm validate:widgets
```

Run the focused Bob, Roma, Prague, DevStudio, or widget-package build when that
consumer changed. `pnpm tokyo:r2:sync:check` must list only
`dieter/icons/svg/**` under the Dieter deploy root.

## Operator Rules

- Edit Dieter source, never a generated mirror.
- Keep `tooling/sf-symbols/**` as the manual icon-authoring lane.
- Do not add a Dieter bundle, manifest, registry service, browser global, or
  compatibility copy.
- Do not add external vertical margins to reusable controls; host layout owns
  outside spacing.
- Do not use runtime CSS `@import` in generated widget packages.
- Do not inline repeated SVG bytes into compiled panels or application chrome.
- Public widgets may use approved icon URLs; they do not fetch shared Dieter
  CSS or JavaScript.
