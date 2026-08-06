# Shell Utilities

STATUS: CURRENT SYSTEM OPERATOR SPEC

Branding, social share, locale switching, typography, and Shell presentation are
shared generation/runtime concerns. Widget Core does not reimplement them.

## Generation Boundary

Web Code Generator consumes structured Shell state together with exact Widget
source and shared modules. It writes complete Shell markup into generated
`index.html`, presentation into `styles.css`, and behavior into `runtime.js`.
Generated initial HTML owns primary customer content, branding attribution,
social-share controls, and locale-switcher controls.

The shared runtime binds interactions to that generated markup. It does not
accept generic state updates, apply overlays, inject styles, or construct the
primary Shell/Core content DOM.

## Typography Roles

Widget Shell owns the shared typography roles:

```text
title
body
button
localeSwitcher
```

The Shell package owns their defaults. A Widget declares labels and visible
order for additional roles in its structured typography panel. Bob composes
those declarations into the editor. Web Code Generator validates the selected
font family, weight, and style, emits typography variables and required font
CSS, and applies them to generated markup.

## Branding

State and entitlement:

```text
behavior.showBacklink
branding.remove
```

Web Code Generator writes the final branding/attribution markup and styles. A
Free Widget receives one visible contextual link to the global Clickeen product
with `rel="nofollow noreferrer"` and matching truthful Clickeen application
identity. `runtime.js` does not create attribution DOM.

`branding.remove` controls visible attribution independently of
`embed.seoGeo.enabled`. Bob preview uses the same generated markup that Bob
submits for save.

## Social Share

State and entitlement:

```text
behavior.socialShare.enabled
behavior.socialShare.attachTo
behavior.socialShare.position
behavior.socialShare.channels.*
widget.socialShare.enabled
```

Web Code Generator validates the structured social-share state and writes the
enabled controls into generated `index.html`, attached to Stage or Pod at the
selected position. Shared `socialShare.css` supplies their presentation. The
shared `runtime.js` binds share, copy, and preview-only behavior to those
generated controls. It does not create or remove their DOM in response to
state updates.

Public installation uses the shared `clickeen.js` installer rather than a
permission-bearing iframe snippet or a direct `runtime.js` installer. The
installer loads saved runtime behavior when the mounted public product requires
it.
Builder preview does not perform external share side effects.

## Locale Switcher

State:

```text
localeSwitcher.*
appearance.localeSwitcher*
```

Available locales come from account tier policy, and active locales come from
Roma Settings. Web Code Generator uses the exact base locale and supplied
overlay coordinates to write switcher options when the control is enabled and
more than one locale exists. Shared `localeSwitcher.css` supplies presentation.

The shared runtime behavior is limited to selection:

- editing preview blocks locale changes;
- translations preview posts `ck:preview-locale-change-request`;
- public runtime changes the `locale` query parameter.

Tokyo-worker, not `runtime.js`, applies a requested overlay to exact
field-marked HTML and sets `<html lang>` before serving the response. The
switcher does not generate translations, select active account locales, fetch
overlays, or apply translated values.

Locale operation boundary:

```text
Available locales -> account tier
Active locales -> Roma Settings
Translated values -> exact instance overlays under Tokyo-worker
Generated switcher options -> Web Code Generator
Localized HTML completion -> Tokyo-worker
Switcher behavior -> shared runtime.js
```

## Shared Widget Files

Current shared source files are:

```text
header.css
localeSwitcher.css
runtime.js
socialShare.css
stagePod.css
```

Web Code Generator composes the declared shared style/runtime modules into the
exact generated `styles.css` and `runtime.js`. Later source edits do not change
already-stored account package bytes without another explicit account save.

## Runtime API

Shared `runtime.js` exposes `window.CKWidgetRuntime` for behavior-only Widget
initializers:

```text
assertWidgetRoot
contextFor
isComposedPage
register
resolveInstanceId
roots
```

It also binds shared header CTA, social-share, locale-switcher, preview-ready,
and iframe-resize behavior. Widget-local `runtime.js` may register interaction
against generated DOM through this API. It must not become a renderer for
structured content.
