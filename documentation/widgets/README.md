# Widgets Operator Manual

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents current Clickeen widget operation. Use it when changing
widget source, Bob editor controls, Translation Agent editable paths, the
presentation frame, Shell composition, or shared widget utilities.

Clickeen widget law:

- Widgets are software.
- Widget instances are saved account-owned widgets.

Widget software lives in git:

```text
tokyo/product/widgets/{widgetType}/
```

Saved account instances live in Tokyo/R2 through Tokyo-worker:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Bob edits one instance in browser memory. Roma owns account routing, policy,
and save operations. Tokyo-worker stores exact submitted files. Shared widget
utilities live under `tokyo/product/widgets/shared/`.

## Operator Authority

| Concern | Authority |
| --- | --- |
| Widget software source | `tokyo/product/widgets/{widgetType}/` |
| Common defaults and shared control contracts | `packages/widget-foundation/src/` |
| Shared widget utilities | `tokyo/product/widgets/shared/` |
| Bob editor panels and controls | `spec.json.editor.panels[]`, `bob/lib/compiler*` |
| Dieter controls | `dieter/components/**` source |
| Customer-visible text paths | `editable-fields.json` |
| Account entitlement limits | `limits.json` |
| Saved package materialization | Roma account instance package builder/save policy |
| Saved widget instances | Tokyo-worker under `accounts/{accountPublicId}/instances/{instanceId}/` |

## Generated Package Dependency Rule

Saved account widget packages are stored product bytes. Widget-local
`widget.html`, `widget.css`, `widget.client.js`, selected shared widget
CSS/JS, widget identity markers, source state, and overlay state are resolved when
Roma materializes `index.html`, `styles.css`, and `runtime.js`.

Later widget software or shared runtime changes do not mutate already-stored
account package files. They require a named account command or a future broad
re-resolution command with exact coordinates. Public serving must not compare
stored account package bytes to current widget source on visitor requests.

Dieter icon URLs and account asset references remain external delivery
references owned by their own roots. Dieter CSS and JavaScript do not.

Truth order follows `documentation/architecture/CONTEXT.md`: runtime code and
migrations, deployed Cloudflare configuration/bindings, service and widget docs,
then architecture docs. If runtime and docs disagree, fix the doc or the
runtime in the same change that exposes the mismatch.

## Current Widgets

| Widget | Operator Spec | Source |
| --- | --- | --- |
| Big Bang | `widgets/big-bang.md` | `tokyo/product/widgets/big-bang/` |
| Call to Action | `widgets/calltoaction.md` | `tokyo/product/widgets/calltoaction/` |
| Cards | `widgets/cards.md` | `tokyo/product/widgets/cards/` |
| Countdown | `widgets/countdown.md` | `tokyo/product/widgets/countdown/` |
| FAQ | `widgets/faq.md` | `tokyo/product/widgets/faq/` |
| Logo Showcase | `widgets/logoshowcase.md` | `tokyo/product/widgets/logoshowcase/` |
| Split Carousel Media | `widgets/split-carousel-media.md` | `tokyo/product/widgets/split-carousel-media/` |
| Split Media | `widgets/split-media.md` | `tokyo/product/widgets/split-media/` |

## Folder Map

| Folder | Purpose |
| --- | --- |
| `authoring/` | Source-file contract, Bob/ToolDrawer controls, and widget execution checklist. |
| `shared/` | Presentation frame, Shell/Core contract, and shared runtime utility behavior. |
| `widgets/` | Per-widget operator specs for built widgets. |

## Shared Manuals

| Manual | Purpose |
| --- | --- |
| `authoring/WidgetFiles.md` | Exact six-file widget source contract. |
| `authoring/ToolDrawerControls.md` | Bob panels, ToolDrawer fields, and Dieter controls. |
| `authoring/WidgetAuthoringChecklist.md` | Current execution checklist for widget edits. |
| `shared/ShellCore.md` | Presentation frame and Shell/Header/Core ownership, state paths, and DOM shape. |
| `shared/ShellUtilities.md` | Branding, social share, and locale switcher. |

## Folder Rules

This folder contains current operator truth only.

Do not put PRDs, planning docs, competitor research, screenshots, copied apps,
scraped pages, other-surface planning material, or unbuilt widgets in this
folder.

Research and planning material belongs under `Execution_Pipeline_Docs/`.

## Baseline Verification

Run after widget source or widget documentation changes:

```bash
pnpm validate:widgets
git diff --check -- tokyo/product/widgets documentation/widgets
```

For product behavior, verify through Roma/Bob/Tokyo-worker and the relevant
`clk.live` or `dev.clk.live` serving surface. Do not use local-only behavior as
proof of deployed product truth.
