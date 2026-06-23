# Overlay Architecture

STATUS: CURRENT OPERATOR SPEC

## Product Rule

Clickeen translation overlays are account instance content artifacts.

The Translation Agent writes localized values for the account's active locales.
Tokyo stores the files in R2/CDN. Bob, Roma, and clk.live read the exact files
that exist for the account instance. There is no separate lifecycle layer,
fallback locale, or compatibility wrapper.

## Storage

Locale overlay files live under the owning account instance:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

The file body is only the translated value map:

```json
{
  "values": {}
}
```

The account, instance, and locale coordinates come from the storage path and the
operation being executed. They are not repeated inside the file body.

## Field Authority

Every widget declares its translatable fields in:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Agents may translate declared text fields. They must not invent paths outside
the widget declaration.

Repeatable declaration paths are extraction instructions. Runtime overlay files
use concrete paths such as:

```text
sections.0.faqs.0.question
```

## Runtime Rule

The runtime applies a locale value map to the base widget configuration:

```text
resolveTranslatedValues(baseConfig, translatedValues)
```

The resolver applies the exact translated value map to the exact base config. It
does not accept precedence stacks, status fields, freshness metadata, fallback
values, or producer-specific shapes.

## Operational Boundary

Translation is agent-operated:

- Bob exposes the user action and displays progress.
- The Translation Agent translates active locales and writes locale files.
- Tokyo stores and serves account instance files.
- Roma owns account settings, tier authority, and user/account routing.
- clk.live serves what Tokyo has for the requested widget/page locale.

If the user changes active locales, the system changes the locale files to
match the setting: remove files for removed locales and generate files for
added locales. Tokyo does not infer meaning. It stores and serves exact files.
