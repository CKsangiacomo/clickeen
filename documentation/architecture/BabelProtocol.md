# Clickeen Babel Protocol

Status: Active protocol. Generic widget text extraction is owned by `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103J__PRD__Generic_Widget_Translation_System.md`; saved-base-content translation sync is owned by `Execution_Pipeline_Docs/03-Executed/103_Translation_Workflow_And_Sync_Batch/103K__PRD__Saved_Base_Content_Translation_Sync.md`.

Babel is Clickeen's translated-locale value protocol for account widgets. It is not a separate translation schema, a runtime fallback system, a selected-pointer system, or a storage locator layer.

## Product Boundary

Builder edits one account-owned widget instance in the account base locale.

After save, translated locale values are explicit account work from the
Translations panel. Tokyo-worker currently stores, reads, and lists exact
translated-locale overlay files only. Roma returns translation generation
unavailable until Roma is wired to the Translation Agent Worker. In 121D, Roma
mints a grant, the Translation Agent Worker calls San Francisco
`/v1/model/chat`, and writes overlays via Tokyo-worker. San Francisco owns model
execution only. Public widget package bytes are public artifacts, not source
truth, and are not rebuilt from overlays during visitor serving or publish.

## Source Of Text Truth

Each widget declares its editable/translatable field graph once in:

```txt
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Repeatable declaration paths are extraction instructions inside the product boundary. Producer payloads always contain exact paths:

```json
{
  "sections.0.faqs.0.question": "What rooms do you offer?"
}
```

No producer receives wildcard, glob, template, or sidecar paths.

## Exact Producer Contract

For a given saved `instance.content.json` and widget editable-field contract:

1. The saved instance content and widget editable-field contract provide the required exact text primitive paths.
2. Roma owns the user-facing generation command and account active-locale lookup.
3. Until Roma is wired to the Translation Agent Worker, Roma returns `coreui.errors.translation.generationUnavailable`.
4. Tokyo-worker stores exact overlay value maps that Roma submits through the storage route.
5. Tokyo-worker rejects malformed overlay value maps before writing them.

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

The API body does not carry product identity, readiness, job state, source version, hash identity, or storage path. Product operations carry identity and state.

Under PRD 105, Tokyo stores the durable translated-locale product result as `overlays/locales/{locale}.json`. That private overlay document wraps the API value map with marker/status metadata used by Tokyo. Bob, Roma, San Francisco, and public widget consumers still speak the API value-map contract, not private storage object identity.

## Runtime Resolution

Babel v1 uses one translated locale value map at a time:

```txt
resolvedState = resolveTranslatedValues(baseState, translatedValues)
```

No multi-layer precedence resolver is part of this protocol. A/B, geo, personalization, or stacked transformations require a later PRD.

Manual translation edits are temporary overrides of the current translated value map. The system does not store manual status, review status, provenance, or a protected override layer. If a field is regenerated, the regenerated translated value replaces the manual value.

## Tokyo PBX Rule

Tokyo-worker stores and reads translated locale value artifacts through named
storage operations. Translation Agent has its own Worker home; generation is
enabled only after Roma is wired to that Worker. San Francisco stays the model
execution boundary the Translation Agent calls.

Tokyo-worker must not:

- Expose private storage object IDs as locale identity.
- Start San Francisco work from Roma-side storage walks.
- Repair values it accepted.
- Maintain generation ledgers, operation snapshots, or completion state.
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
