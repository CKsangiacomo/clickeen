# Clickeen Babel Protocol

Status: PRD 103_00 product-operation model, superseded for generic translation execution by `Execution_Pipeline_Docs/01-Planning/103J__PRD__Generic_Widget_Translation_System.md`. Final PRD 103 resume still requires the manual smoke and Product + Architecture signoff recorded in `Execution_Pipeline_Docs/02-Executing/103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md`.

Babel is Clickeen's translated-locale value protocol for account widgets. It is not a separate translation schema, a runtime fallback system, a selected-pointer system, or a storage locator layer.

## Product Boundary

Builder edits one account-owned widget instance in the account base locale.

After save, translation generation is explicit work from the Translations panel. Roma calls Tokyo once. Tokyo resolves the current instance content, widget editable-field contract, target locales, existing translated values, stable field identities, and delta. San Francisco receives widget-generic saved text fields and returns translated text primitive values. Tokyo stores translated locale values and materializes public visitor artifacts when publish runs.

## Source Of Text Truth

Each widget declares its editable/translatable field graph once in:

```txt
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Repeatable declaration paths are extraction instructions inside the product boundary. Producer payloads always contain concrete paths:

```json
{
  "sections.0.faqs.0.question": "What rooms do you offer?"
}
```

No producer receives wildcard, glob, template, or sidecar paths.

## Exact Producer Contract

For a given saved `instance.content.json` and widget editable-field contract:

1. Tokyo extracts required concrete text primitive paths.
2. Tokyo decides the delta: missing locale values plus fields marked `changed`.
3. San Francisco receives exactly those paths and their current base values.
4. San Francisco returns exactly those paths and translated values.
5. Tokyo rejects the response if any required path is missing.
6. Tokyo rejects the response if any undeclared path is present.
7. The rejection names the concrete offending path.

The system does not normalize, drop, repair, coerce, or infer producer output.

## Translated Locale Values

The product identity is:

```txt
instanceId + locale
```

The translated value body is an exact value map:

```json
{
  "values": {
    "header.title": "Domande frequenti",
    "sections.0.faqs.0.question": "Che stanze offrite?"
  }
}
```

The body does not carry product identity, readiness, job state, source version, hash identity, or storage path. Product operations carry identity and state.

Tokyo may store the value map in any approved private storage shape. Bob, Roma, San Francisco, and product docs must not use private storage object IDs as locale identity.

## Runtime Resolution

Babel v1 uses one translated locale value map at a time:

```txt
resolvedState = resolveTranslatedValues(baseState, translatedValues)
```

No multi-layer precedence resolver is part of this protocol. A/B, geo, personalization, or stacked transformations require a later PRD.

Manual translation edits are temporary overrides of the current translated value map. The system does not store manual status, review status, provenance, or a protected override layer. If a field is regenerated, the regenerated translated value replaces the manual value.

## Tokyo PBX Rule

Tokyo-worker validates, stores, reads, generates, and completes translated locale values through named product operations.

Tokyo-worker must not:

- Expose private storage object IDs as locale identity.
- Orchestrate San Francisco work from Roma-side storage walks.
- Repair values it produced or accepted.
- Preserve old l10n route or path shapes.
- Preserve old account/widget storage grouping shapes.

## Deleted Pre-GA Model

The following are not active product truth:

- Widget `localization.json`.
- `spec.json.overlays.text`.
- `textPack`.
- `L10nOp`.
- Base snapshot/fingerprint identity for account-widget translations.
- Readiness/status fields inside translated value bodies.
- Selected translation pointers.
- Compatibility readers for old translation paths.
