# PRD 103J - Generic Widget Translation System

Status: Active generic-widget contract; sync behavior owned by PRD 103K
Owner: Product + Architecture
Date: 2026-05-25
Depends on: `103K__PRD__Saved_Base_Content_Translation_Sync.md`

## Purpose

Keep translation generic across all account-owned widgets.

This PRD answers:

```text
Which widget text is translatable, and how does the system extract it generically?
```

PRD 103K answers:

```text
When are translated values valid for current saved base content?
```

Both are required. 103J must not reintroduce FAQ-only behavior, and it must not define job-id/current-generation authority.

## Product Truth

Clickeen Builder is a multi-widget SaaS product. Translation cannot be coupled to FAQ.

For every widget, the widget source declares authored customer-visible text once:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

That contract includes every user-visible authored text primitive, regardless of which Bob panel owns the control:

- Content panel text;
- CTA button labels;
- header title and subtitle;
- timer labels;
- logo names, captions, alt text, and titles;
- FAQ section titles, questions, and answers;
- any other saved string or rich text that the customer authors and visitors see.

Bob may organize controls across Content, Design, CTA, Layout, or other panels. Panel ownership does not define translation ownership. `editable-fields.json` defines translation ownership.

## Required Contract

Each widget definition exposes a `WidgetEditableFieldsContract` with:

- `widgetType`;
- concrete or repeatable field paths;
- `type` of `string` or `richtext`;
- human label;
- semantic role;
- `arrayItemIdentity` declarations for repeated structures.

Repeatable paths such as `strips[].logos[].caption` must not rely on array index as product identity. The system resolves stable identity from declared ID fields such as `strips[].id` and `strips[].logos[].id`.

Tokyo extracts saved text into a widget-generic field model:

```ts
type SavedTextField = {
  identityKey: string;
  fieldPattern: string;
  path: string;
  type: 'string' | 'richtext';
  label: string;
  role: string;
  baseText: string;
};
```

`path` is where the value currently lives. `identityKey` is the durable field identity across reorder, insert, and delete.

## Translation Ownership

Base authored text is edited only on the real account Builder path:

```text
Roma opens one account-owned instance -> Bob edits -> Roma saves -> Tokyo persists.
```

Translation generation reads the saved instance after Save and writes translated locale values through Tokyo product operations.

The translated value API may continue to expose exact current path maps because Bob preview and public materialization apply values by concrete path.

Internally, Tokyo must use identity-aware merge semantics:

- current extraction produces `identityKey -> current path`;
- existing translated values are associated to identities where possible;
- moved fields carry translated values by identity to their new current path;
- deleted identities are removed;
- new identities require translation;
- the final stored/read value map for a locale contains only current concrete paths.

## Boundary With 103K

103J does not approve random `jobId` as translation validity authority.

The generic saved text field list from this PRD is an input to the PRD 103K saved-base-content marker. Translation validity is decided by whether translated values match the current saved base content marker, not by whether a completion belongs to the latest random generation id.

## Non-Negotiables

- `editable-fields.json` is the only product declaration of translatable authored widget text.
- FAQ helpers do not define the product operation.
- Tokyo owns Generate, saved-base-content marker derivation, translated-locale writes, sync state, and completion/failure transitions.
- San Francisco translates generic primitive fields only.
- Bob renders product state from Tokyo and reviews/previews translated values through the generic contract.
- Translation does not create another widget, another authoring mode, overlay inventory, selected pointer, or storage-path identity.
- Unsupported widget translation must fail or be hidden at the named boundary. It must not silently degrade into partial product behavior.
- Adding a new widget must be boring: add widget source, add `editable-fields.json`, pass contract tests, and inherit the translation pipeline.

## Acceptance

- FAQ, Countdown, Logo Showcase, and future widgets use the same `editable-fields.json` extraction path.
- Repeated text identity survives reorder, insert, and delete.
- CTA/button text and text owned by non-content panels is included when declared in `editable-fields.json`.
- No product module imports FAQ-only language value helpers.
- Generated widget source registration prevents hand-edited translation runtime catalogs.
- 103K tests prove the generic extracted fields feed the saved-base-content sync marker.
