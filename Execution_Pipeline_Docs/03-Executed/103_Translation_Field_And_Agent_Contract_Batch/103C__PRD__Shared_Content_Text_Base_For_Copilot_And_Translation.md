# PRD 103C - Shared Widget Source Projections

Status: Historical evidence / surviving doctrine extracted to PRD 105E; superseded by PRD 105, 105D, and 105E where conflicting
Owner: Product + Architecture
Date: 2026-05-17
Current dependencies: `103J__PRD__Generic_Widget_Translation_System.md`, `103K__PRD__Saved_Base_Content_Translation_Sync.md`

Archive note: this document is no longer active execution authority. Current translation field/source projection authority is PRD 105E.

## Purpose

Define the source projections used by Builder agents without creating duplicate product truth.

Translation and Copilot both need widget source context, but they need different projections:

- Translation consumes the declared customer-visible editable text fields.
- Copilot may need broader widget package context to edit content, behavior, appearance, and valid config.

## Translation Projection

Translation source is:

```text
editable-fields.json + current saved instance content
```

Tokyo extracts identity-bearing `SavedTextField` values from that projection.

Those extracted fields feed the PRD 103K saved-base-content marker. If the saved base text changes, the marker changes and existing translations become out of sync.

Translation must not use:

- FAQ-only content fixtures as product authority;
- compiled-control label heuristics;
- overlay inventory;
- storage path identity;
- array indexes as durable identity for repeated text.

## Copilot Projection

Copilot may consume a wider widget package projection when editing a widget. That broader context does not make those fields translatable.

The rule is simple:

```text
editable-fields.json decides translation scope.
Copilot package context decides editing intelligence.
```

## Acceptance

- Translation text extraction comes from `editable-fields.json` and saved instance content.
- Extracted translation fields include identity, role, type, label, concrete path, and base text.
- The extracted field set is sufficient to derive the saved-base-content marker in PRD 103K.
- Copilot can receive broader widget context without changing translation ownership.
- No FAQ-only projection remains an active translation boundary.
