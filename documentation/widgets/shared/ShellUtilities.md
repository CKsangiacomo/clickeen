# Shell Utilities

STATUS: CURRENT SYSTEM OPERATOR SPEC

Branding, social share, and locale switching are shared Shell utilities.
Widget Core consumes them; Widget Core does not reimplement them.

## Branding

State:

```text
behavior.showBacklink
```

Entitlement:

```text
branding.remove
```

Runtime:

```text
tokyo/product/widgets/shared/branding.js
```

Runtime API:

```text
CKBranding.applyBacklink(widgetRoot, state)
```

Rules:

- Shared Shell applies the Clickeen badge/backlink.
- Bob preview and public runtime use the same shared behavior.
- Widgets do not hand-code badge or backlink markup.
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

Runtime:

```text
tokyo/product/widgets/shared/socialShare.js
tokyo/product/widgets/shared/socialShare.css
```

Runtime API:

```text
CKSocialShare.apply(widgetRoot, state, options)
```

Rules:

- Shared Shell creates and removes the share trigger/menu.
- Share UI attaches to Stage or Pod through `behavior.socialShare.attachTo`.
- Share position comes from `behavior.socialShare.position`.
- Channel booleans under `behavior.socialShare.channels.*` decide which shared actions appear.
- Widget Core does not create share DOM.
- Builder preview renders the menu without performing external share side effects.
- Public iframe snippets need clipboard and popup permissions for share actions.
- State updates re-apply the shared share root for the current widget instance.

## Locale Switcher

State:

```text
localeSwitcher.*
appearance.localeSwitcher*
```

Runtime:

```text
tokyo/product/widgets/shared/localeSwitcher.js
tokyo/product/widgets/shared/localeSwitcher.css
```

Runtime API:

```text
CKLocaleSwitcher.applyLocaleSwitcher(state, widgetRoot, runtimeContext)
```

Rules:

- Available locales come from the account tier.
- Active locales are the account language selection in Roma Settings.
- Rendered switcher options come from delivered `window.CK_LOCALE_POLICY.languages`.
- The current public package builder delivers base locale only unless package
  generation adds more locale values.
- The switcher switches delivered locale values.
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
Delivered locale policy -> rendered switcher options
Switcher behavior -> choose among delivered values
```

The switcher is runtime UI only. Translation generation belongs to the
Translation Agent; account active-locale changes belong to Roma settings and
Tokyo-worker overlay storage.

## Preview Localization

Runtime:

```text
tokyo/product/widgets/shared/previewL10n.js
```

`previewL10n.js` applies host-supplied translated value maps to preview/runtime
state when those values are delivered inline. It applies exact value-map paths
onto a cloned state object. It does not fetch overlays, generate translations,
or invent missing values.

## Shared Runtime Files

Current shared widget files:

```text
appearance.js
branding.js
coreSize.js
fill.js
header.css
header.js
localeSwitcher.css
localeSwitcher.js
previewL10n.js
runtime.js
socialShare.css
socialShare.js
stagePod.css
stagePod.js
surface.js
typography-data.js
typography.js
```

Shared runtime files are broad package dependencies. When Roma materializes a
saved account widget package, selected shared CSS/JS modules are copied into
the generated `styles.css` or `runtime.js` bytes. Later edits to shared widget
files do not change already-stored account package bytes without a named
regeneration command.
