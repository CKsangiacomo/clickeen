# Localization Capability

Last updated: 2026-08-05

## Product Contract

Clickeen localization is overlay-native:

```text
one saved base source
+ one exact overlay per translated locale
+ one published root runtime
= localized public widget
```

Translation is content work. It does not create another widget artifact,
publication state, delivery file, or cache lifecycle.

Web Code Generator uses the exact `baseLocale` and overlay coordinates when it
writes initial HTML and locale-switcher options. Tokyo-worker uses exact overlay
values for translated Instance response completion. A translation command does
not invent Clickeen language-support claims or trigger a hidden
generator/publication operation.
For ordinary Pages, the current authoring shape is equally direct:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
accounts/{accountPublicId}/pages/{pageId}/overlays/locales/{locale}.json
```

`source.json` owns the Page `baseLocale`. Account Settings—not the Page—owns the
selected exact locale list used by Generate translations. Each non-base Page
locale is one separate exact overlay object. Page templates have no
`baseLocale` and no translations. On Page Save, Web Code Generator's already
generated direct files and root `overlays.json` are stored beside authoring
truth. Root `overlays.json` is the saved exact-locale response input; it is not
another authoring authority and changes only through Page Save or Update.

## Code Authority

| Concern | Authority |
| --- | --- |
| Account locale policy | Roma account locale routes and account storage |
| Translation command | Product control -> Roma `/api/account/translations/generate` |
| Translation operation | Translation Agent -> San Francisco |
| Saved text extraction and exact overlay validation | Tokyo-worker account translation domain |
| Overlay storage | Tokyo R2 `overlays/locales/{locale}.json` |
| Bob package generation and translated preview | `@clickeen/ck-web-code-generator` over current in-memory state and exact overlays |
| Public localized serving | Tokyo-worker exact stored Instance/Page response completion |

## Authority Chain

```text
Roma current account/session
-> accountPublicId
-> target `{ kind: instance | page, id }`
-> saved target source
-> exact locale coordinate
-> Translation Agent
-> Tokyo-worker
-> exact target overlay path
```

Public serving adds the single publication coordinate:

```text
serve-state.json
-> exact root index/styles/runtime files
-> exact requested overlay
-> field-marked HTML completion
-> public placeholder completion
```

## Locale Policy

- The account base locale is source authority.
- Active non-base locales are translation targets allowed by account policy.
- Generate Translations requests every currently active non-base locale.
- Removing an active locale deletes its exact overlay from every account
  instance. Each completed and failed deletion coordinate remains visible.
- Changing locale settings never creates or rebuilds public runtime files.

## Source Text

`instance.content.json` owns the current saved translatable field set. Fields
are concrete saved paths, including concrete array indexes. Translation
responses must return one string for every current path and no other path.

Human-authored base text remains human source authority. Agents translate it;
they do not silently rewrite the base source.

## Generate Translations

1. Generate translations requires a saved ordinary Instance or Page and at
   least one active non-base locale.
2. Roma resolves current account/session and entitlement truth.
3. Roma reads the saved target and sends its translatable values to the same
   Translation Agent operation.
4. San Francisco translates the supplied saved text items.
5. Tokyo-worker writes each completed exact overlay to the target's existing
   overlay path.
6. Roma returns:

   ```text
   requestedLocales
   translatedLocales
   failedLocales
   ```

7. The calling product surface reports those outcomes.

For a Page, only `title`, `description`, `socialTitle`, and
`socialDescription` are translated. `socialImageAssetRef`, placements, robots,
and every other Page value are not translation inputs. No compilation or
publication step runs as part of translation generation.

## Overlay Contract

Storage:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Body:

```json
{
  "values": {
    "header.title": "Translated title"
  }
}
```

An editor-authorized exact-value write uses
`PUT /api/account/instances/{instanceId}/translations/{locale}`. The body must
contain the complete `values` map for current saved text fields. Base-locale
overlays, missing paths, and extra paths fail; the write has no runtime-artifact
side effect.

Validation is exact against current saved content. Missing paths, unexpected
paths, non-string values, malformed documents, and invalid locale coordinates
fail. Stored corruption is not normalized or treated as missing.

## Bob Preview

Bob reads the complete exact saved overlay map through Roma before the current
base package becomes savable. Web Code Generator uses that complete map for the
base package's locale coordinates. Translation preview selection separately
chooses one of those already-read overlays, resolves it over the current
in-memory base state, and runs Web Code Generator for that selected locale. The
translated preview is an exact in-memory generated package and never writes
storage. A failed overlay read blocks package generation and Save.

## Public Serving

Canonical URLs:

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
https://clk.live/{accountPublicId}/pages/{pageId}
https://clk.live/{accountPublicId}/pages/{pageId}/{locale}
```

For an index request, Tokyo-worker verifies the published instance and exact
root files. It validates stored overlay coordinates, reads and validates the
exact requested overlay, replaces exact field-marked text/attributes and
`<html lang>` in the stored root index, completes public account/instance
placeholders, and returns complete HTML through the exact public URL cache key.

`runtime.js` binds behavior to generated markup; it does not apply locale
overlays. A missing requested overlay returns `404 Locale not available`. A
corrupt overlay returns `500 Locale data invalid`. Incomplete public HTML
returns `500 Public HTML invalid`. Base content is never presented as a
requested non-base locale.

For a published Page, the stable URL redirects with `no-store` to one locale in
the saved public locale set. The base exact-locale response uses values already
stored in `index.html`; a non-base response applies only its exact root
`overlays.json` entry. Both complete public SEO coordinates and return HTML
before JavaScript. Root `overlays.json` is validated as one document before
route selection, so one malformed entry makes the Page unavailable for every
Page route. With a valid root, a missing locale is `404` and selected HTML
completion failure is `500`; neither falls back to the base locale. Page
`styles.css` and `runtime.js` are shared across locales.

Instance and Page HTML are CDN-cacheable only at their exact response keys.
Instance translation writes/deletes purge their exact public locale URL. Page
authoring translation writes do not change root serving overlays or purge;
Page Save while published, Publish, Unpublish, and Delete purge affected public
HTML and support-file URLs. Locale selection is never hidden in a shared cached
variant.

A successful Instance translation write also marks each same-account ordinary
Page that references that Instance as Needs update. It does not regenerate the
Page or change its live files. Page-owned translation writes do not mark the
Page. Removing an Instance overlay because Account Settings removed a locale
also does not mark it; Settings affects later Generate translations and Page
Save/Update inputs.

## Operator Recipes

### Generate one instance

Use Bob’s Generate Translations command or the authenticated Roma instance
translation route. Confirm the returned requested/translated/failed sets
reconcile exactly.

### Inspect overlay truth

1. Run `pnpm cf:preflight`.
2. Read the exact `overlays/locales/{locale}.json` object.
3. Compare its path set with `instance.content.json`.
4. Confirm no root source or artifact object changed unless a separate instance
   save occurred.

### Verify public localization

1. Confirm the instance is published.
2. Open the base URL and the same URL with `?locale={locale}`.
3. Confirm translated text and `<html lang>` on the locale response.
4. Confirm both responses reference identical root stylesheet/runtime URLs.
5. Confirm missing and corrupt overlays fail explicitly.

For a Page, verify the stable redirect and each saved exact-locale URL
separately, confirm metadata/visible placement values match that locale before
JavaScript, and confirm every locale references the same Page CSS/runtime URLs.

## Failure Semantics

- Requested locale outcomes are exhaustive.
- Partial translation success is reported as partial.
- Activity transport is never result truth.
- Missing overlay and corrupt overlay are distinct.
- No generated value substitutes for missing source truth.
- Public reads never write, heal, regenerate, or call an agent.

## Verification Matrix

| Concern | Proof |
| --- | --- |
| Account policy | Roma locale route response |
| Saved text set | Tokyo instance content |
| Overlay bytes | exact R2 read after `pnpm cf:preflight` |
| Translation outcome | Roma requested/translated/failed sets |
| Bob preview | exact generated package for current state and selected overlay |
| Root artifact | exact R2 `index.html`, `styles.css`, and `runtime.js` objects and content types |
| Localized response | root URL with `?locale=` and translated HTML output |
| Localized Page response | stable redirect plus base-index or exact non-base `overlays.json` completion |
| Negative storage invariant | no instance locale-derived HTML/CSS/JS objects |
