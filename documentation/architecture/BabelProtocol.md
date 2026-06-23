# Clickeen Babel Protocol

Status: Active protocol. Generic widget text extraction is owned by `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103J__PRD__Generic_Widget_Translation_System.md`; saved-base-content translation sync is owned by `Execution_Pipeline_Docs/03-Executed/103_Translation_Workflow_And_Sync_Batch/103K__PRD__Saved_Base_Content_Translation_Sync.md`.

Babel is Clickeen's translated-locale value protocol for account widgets. It is not a separate translation schema, a runtime fallback system, a selected-pointer system, or a storage locator layer.

## Product Boundary

Builder edits one account-owned widget instance in the account base locale.

After save, translated locale values are explicit account work from the
Translations panel. Tokyo-worker currently stores, reads, and lists exact
translated-locale overlay files only. Roma calls the Translation Agent Worker
for generation. Roma mints the agent grant, the Translation Agent Worker calls
San Francisco `/model/chat` for model execution, and the Translation Agent
writes overlays through Tokyo-worker. San Francisco owns model execution only.
Public widget package bytes are public artifacts, not source truth, and are not
rebuilt from overlays during visitor serving or publish.

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
3. Roma calls the Translation Agent Worker for generation.
4. Translation Agent writes exact overlay value maps through Tokyo-worker.
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

The API body does not carry product identity, lifecycle state, backend task state, source
revision, hash identity, or storage path. Product operations carry identity and
state.

Tokyo stores the durable translated-locale product result as
`overlays/locales/{locale}.json`. That overlay is the exact value-map artifact
for one locale. It carries no lifecycle metadata, backend task state, or storage
identity exposed to Bob/Roma/San Francisco/public widget consumers.

## Runtime Resolution

Babel current uses one translated locale value map at a time:

```txt
resolvedState = resolveTranslatedValues(baseState, translatedValues)
```

No multi-layer precedence resolver is part of this protocol. A/B, geo,
personalization, manual translation editing, or stacked transformations require a
later PRD.

## Tokyo PBX Rule

Tokyo-worker stores and reads translated locale value artifacts through named
storage operations. Translation Agent has its own Worker home. Roma calls that
Worker for generation, and San Francisco stays the model execution boundary the
Translation Agent calls.

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
