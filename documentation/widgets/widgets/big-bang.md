# Big Bang Widget

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Big Bang renders a high-impact statement with optional supporting copy inside
the shared Widget Shell.

## Architecture Status

Big Bang uses the canonical Widget contract in cloud-dev. `widget.html`
composes the shared Stage, Pod, Header, branding, locale-switcher, and
social-share services with one Big Bang Core. `core/core.html` owns the unique
semantic statement structure, `core/core.css` owns its presentation and
typography role, and mandatory `core/core.js` registers the Core. Big Bang has
no visitor interaction, so its Core initializer intentionally does no work.

Bob preview and explicit allowed Publish use the same compiled Widget
software. Publish materializes the complete saved statement and supporting
copy into semantic HTML; public JavaScript does not render or localize the
initial content. There is no flat-source compatibility path or Widget-specific
branch in Bob, Roma, the materializer, or Tokyo-worker.

## Source

```text
tokyo/product/widgets/big-bang/
```

Files:

```text
spec.json
editable-fields.json
discovery.json
limits.json
labels/
  en.json
upsell/
  en.json
widget.html
core/
  core.html
  core.css
  core.js
```

## Contract

| Concern | Current value |
| --- | --- |
| `widgetname` | `big-bang` |
| display name | Big Bang |
| Core namespace | `bigBang.*` |
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

Core defaults live under:

```text
bigBang
typography
```

Core state families:

```text
bigBang.alignment
bigBang.gap
bigBang.showSupportingCopy
bigBang.statement
bigBang.supportingCopy
bigBang.textWidth
```

Operator controls:

```text
bigBang.statement
bigBang.showSupportingCopy
bigBang.supportingCopy
bigBang.alignment
bigBang.textWidth
bigBang.gap
```

Alignment and text width apply to the complete statement/supporting-copy
column. Gap is the vertical space between the two values. Core CSS consumes
those exact saved values and owns the Big Bang typography role; shared
composition continues to own only shared/common typography roles. The Widget's
`typographyBehavior` declaration supplies the Big Bang role's exact generic
fluid-size and normal-line-height behavior; shared rendering contains no Big
Bang role branch.

## Editable Fields

```text
header.title
header.subtitleHtml
headerCta.label
bigBang.statement
bigBang.supportingCopy
```

`header.title`, `header.subtitleHtml`, `bigBang.statement`, and
`bigBang.supportingCopy` are rich-text Dropdown Edit fields. Their saved inline
HTML supports emphasis, `br`, and `http(s)` links. Statement and supporting-copy
links inherit the color of their configured typography role.

## Discovery

`discovery.json` identifies Big Bang as a `statement` Widget. Its important
customer-content parts are the statement headline and supporting copy, with a
`supports` relationship from the copy to the statement.

This is internal Widget software, not user-editable SEO copy. Free and Tier 1
use its system baseline, including Clickeen identification. When a Tier 2+
account enables SEO/GEO, Publish may optimize technical discovery output from
the exact saved customer content. Only Publish materialization writes public
HTML/CSS/JavaScript.

## Limits

```text
branding.remove -> behavior.showBacklink -> branding.remove
widget.socialShare.enabled -> behavior.socialShare.enabled -> social-share.enable
embed.seoGeo.enabled -> behavior.seoGeo.enabled -> seo-geo.enable
```

The final value on each line is the exact message identity in
`upsell/en.json`. That file owns the complete Big-Bang-specific denial context;
account policy owns the entitlement decision and current/target plans, and
Roma owns the system CTA and Popup. Core and public runtime consume none of
this product UI contract.

## Materialized Core And Visitor Behavior

Core HTML contains these stable operator hooks:

```text
[data-role="big-bang-core"]
[data-role="big-bang-statement"]
[data-role="big-bang-support"]
```

The materializer writes the exact saved statement and, when enabled and
nonempty, supporting copy into those semantic elements. It also writes stable
content/discovery coordinates for localization and SEO/GEO output. Core CSS
owns alignment, width, gap, and Core typography. Mandatory Core JavaScript
registers through `CKWidgetRuntime` but performs no work because Big Bang has
no visitor behavior.

Shared Header, Stage, Pod, branding, social share, and locale switching remain
generic shared services. Core neither invokes them nor revalidates their
trusted output.

## Verification

```bash
# Intentional derived-output write:
node scripts/widgets/generate-artifacts.mjs --widget big-bang
# Non-writing verification:
node scripts/widgets/generate-artifacts.mjs --widget big-bang --check
pnpm --filter @clickeen/widget-foundation typecheck
node --check tokyo/product/widgets/big-bang/core/core.js
```
