# Shared Widget Utilities

STATUS: CURRENT SYSTEM OPERATOR SPEC

Branding, social share, locale switching, typography, presentation, and Core
geometry use shared widget implementations. Reuse does not make them Shell
children. Shell remains the composition of Header and Core only.

Every shared capability exposes one Widget-neutral contract and is applied the
same way wherever a Widget declares it. A shared capability never branches on
Widget type or absorbs Core semantics. The shared system composes common
capabilities; Core uses only the generic capabilities its purpose needs and
does not orchestrate the complete system itself.

Exact state and artifacts produced by another named Clickeen authority are
trusted. Shared capabilities apply them unchanged without validation,
filtering, normalization, repair, or fallback.

All five built Widgets implement the canonical model locally: the generic
renderer expresses shared markup and presentation for Bob preview and Publish,
and public JavaScript does not create initial content. Shared visitor modules
bind only behavior already represented in the materialized document.

## Typography Roles

The shared typography contract exposes these common authoring/editor roles:

```text
title
body
button
localeSwitcher
```

The widget foundation owns their default product labels. A widget declares labels
and visible order for its additional roles in its structured typography panel.
Bob composes those declared roles into the editor. The shared authored
composition requests only the common roles; each Core stylesheet requests its
own additional roles. The same generic style renderer expresses those exact
variables for Bob preview and Publish without a public typography engine.
Saved `typography.roleScales` is the sole size-scale authority for both common
and widget-specific roles. Required roles, scales, tracking presets, and
line-height presets are explicit state; shared runtime does not supply a second
scale table or treat a missing preset as `normal`.

## Branding

State:

```text
behavior.showBacklink
```

Entitlement:

```text
branding.remove
```

Rules:

- Canonical shared document composition applies the Clickeen badge/backlink to
  the Pod, and shared presentation owns its styling.
- Account policy decides whether the edit is allowed. A denied action uses the
  Widget's compiled `limits.json`/`upsell/{locale}.json` contract through
  Bob/Roma; branding composition and Core do not decide policy or open an
  upsell.
- Roma materialization writes the complete shared branding markup; Bob preview
  remains under Bob's existing editing authority. Public JavaScript exists only
  if backlink behavior genuinely requires it.
- Widget Core does not create badge or backlink markup.
- Removing branding is account policy, not widget choice.

## Social Share

State:

```text
behavior.socialShare.enabled
behavior.socialShare.attachTo
behavior.socialShare.position
behavior.socialShare.channels.*
```

Entitlement:

```text
widget.socialShare.enabled
```

Canonical visitor source:

```text
tokyo/product/widgets/shared/socialShare.js
tokyo/product/widgets/shared/socialShare.css
```

Canonical visitor API:

```text
CKSocialShare.bind()
```

Rules:

- Publish materialization writes the share trigger/menu markup; Bob preview
  remains under Bob's existing editing authority. Mandatory `runtime.js`
  attaches the external share interaction.
- Account policy decides whether enabling share is allowed. A denied action
  uses the Widget's compiled `limits.json`/`upsell/{locale}.json` contract
  through Bob/Roma; share runtime and Core do not decide policy, select a plan,
  or supply fallback copy.
- Share UI attaches to Stage or Pod through `behavior.socialShare.attachTo`.
- Share position comes from `behavior.socialShare.position`.
- Channel booleans under `behavior.socialShare.channels.*` decide which shared actions appear.
- Widget Core does not create share DOM.
- Builder preview renders the menu without performing external share side effects.
- Public iframe snippets need clipboard and popup permissions for share actions.
- Bob preview re-expresses share chrome from the one current draft.

## Locale Switcher

State:

```text
localeSwitcher.*
appearance.localeSwitcher*
```

Canonical visitor source:

```text
tokyo/product/widgets/shared/localeSwitcher.js
tokyo/product/widgets/shared/localeSwitcher.css
```

Canonical visitor API:

```text
CKLocaleSwitcher.bind(widgetShell)
```

Rules:

- Available locales come from the account tier.
- Active locales are the account language selection in Roma Settings.
- In Bob preview, rendered switcher options come from the exact delivered
  locale policy. In public HTML, Tokyo-worker authors options from the exact
  base locale and stored overlay coordinates.
- The selected-locale response already contains the exact Edge-applied semantic
  content before the switcher JavaScript runs.
- The public switcher reads the Edge-authored options and chooses a locale by
  changing the `locale` query coordinate; Tokyo returns that locale's semantic
  HTML.
- The switcher removes itself when disabled or when delivered languages length
  is `<= 1`.
- In editing preview, locale changes are blocked.
- In translations preview, locale changes post `ck:preview-locale-change-request`.
- In public runtime, locale changes update the `locale` query parameter.
- The switcher does not generate translations.
- The switcher does not decide active locales.
- Widget Core does not implement locale switching.

Locale operation boundary:

```text
Available locales -> account tier
Active locales -> Roma Settings
Translated values -> instance overlays under Tokyo-worker
Bob delivered locale policy -> preview switcher options
Tokyo stored overlay coordinates -> public Edge-authored switcher options
Switcher behavior -> choose among delivered values
```

The switcher is runtime UI only. Translation generation belongs to the
Translation Agent; account active-locale changes belong to Roma settings and
Tokyo-worker overlay storage.

Current local all-Widget truth: Bob preview supplies the exact delivered locale
choices through its preview document. Public index responses contain
Edge-authored `<option>` elements for the exact base locale and stored overlay
coordinates. The shared switcher reads those elements and does not require a
public locale-policy global.

## Preview Localization

Bob renders deploy-built Widget software with the exact current browser-memory
draft and requested preview locale. Core and shared visitor JavaScript receive
no state-update protocol. Public locale serving applies the trusted overlay to
authored semantic content or exact authored attribute slots before response;
visitor JavaScript is not the localization renderer.

## Shared Runtime Files

Every built Widget composes the same shared document contract from its
`widget.html`.

```text
widget.html
```

Canonical selected shared runtime and presentation files are:

```text
composition.css
header.css
header.js
localeSwitcher.css
localeSwitcher.js
runtime.js
socialShare.css
socialShare.js
stagePod.css
stagePod.js
```

The following historical pre-migration browser modules remain in the source
tree but are not referenced by any built Widget and are not selected into its
public package:

```text
appearance.js
branding.js
coreSize.js
fill.js
previewL10n.js
surface.js
typography-data.js
typography.js
```

Shared source files are broad package dependencies. When explicit allowed
Publish asks Roma to materialize an account Widget package, the shared
composition and Core become complete `index.html`, selected shared/Core CSS
becomes `styles.css`, and Widget/shared visitor behavior becomes mandatory
`runtime.js`. Initial content and presentation exist before that JavaScript
runs. Later edits to shared Widget files do not change already-stored account
package bytes without another explicit Publish.
