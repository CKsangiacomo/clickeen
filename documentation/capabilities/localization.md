# Localization Capability

STATUS: ALL CURRENT WIDGETS DEPLOYED TO CLOUD-DEV — OWNER QA PENDING

Last updated: 2026-08-17

## Product Contract

Clickeen localization is overlay-native:

```text
one saved base source
+ one exact overlay per translated locale
+ one complete published base package
+ exact Edge locale expression
= localized semantic HTML before JavaScript
```

Translation changes content truth only. It does not create another Widget
package, another publication state, stored locale-derived HTML/CSS/JavaScript,
or a second lifecycle.

A Widget uses this shared capability by declaring exact editable customer
content. Translation Agent produces exact overlay values. Roma materializes one
base package only on explicit allowed Publish. Tokyo-worker stores and serves
the exact source, package, and overlay artifacts without learning Widget
meaning.

## Authorities

| Concern | Authority |
| --- | --- |
| Account locale policy | Roma account locale routes/settings |
| Editable/translatable identities | Widget `editable-fields.json` |
| Translation command | Bob Translations panel -> Roma |
| Translation operation | Translation Agent -> San Francisco |
| Exact overlay | Translation Agent; Tokyo-worker exact storage |
| Bob translated preview | Bob over saved source plus exact overlay |
| Base package generation | Roma materializer during explicit allowed Publish |
| Public localized HTML | Tokyo-worker Edge expression over exact materialized content slots |
| Product UI copy | Widget `labels/en.json`, Widget `upsell/en.json`, and system Chrome owners |

Clickeen authorities trust one another. Once an owning ingress or agent has
produced exact Clickeen truth, downstream services do not filter, normalize,
repair, compare, project, or revalidate it against another schema. Missing
owner truth fails at its exact coordinate and never becomes base copy, another
locale, or an invented value.

## Product UI Language Is Separate

The current product UI is English. Widget-authored product copy has two
different adjacent contracts:

```text
tokyo/product/widgets/{widgetType}/
  labels/en.json       ToolDrawer control copy
  upsell/en.json       complete Widget-context denial messages
```

Neither is customer Widget content. Neither enters `editable-fields.json`, an
instance overlay, or the public Widget package.

Every current Widget has both contracts locally, and each compiler artifact
contains its exact limit/message associations. There is no runtime English
fallback, generic Widget message, or substitution from ToolDrawer copy.

Michael's dormant `use_primary_language_for_ui` value does not currently choose
Roma/Bob UI language, account base locale, public locale, or an open Builder
session.

## Locale Policy

- The account base locale is source authority.
- Active non-base locales are translation targets allowed by account policy.
- Generate Translations requests every active non-base locale.
- Removing an active locale deletes its exact overlay from every account
  instance and reports exact completed/failed coordinates.
- Changing locale settings never creates or rebuilds public package files.
- Public locale selection uses the explicit `?locale={locale}` coordinate.

## Saved Source And Overlay

`instance.content.json` owns the current saved translatable field set. Its keys
are physical concrete paths. Each field also carries its field pattern and
stable `identityKey`. The overlay uses `identityKey`, not the physical map key:

```text
scalar:
{widgetType}|{role}|{fieldPattern}

repeated:
{widgetType}|{role}|{fieldPattern}|{arrayItemIdentityPath}={stableId}...
```

Repeated identity components come from the Widget's exact
`arrayItemIdentity` declarations. Array indexes are never overlay identity.

Overlay storage is exact:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

```json
{
  "values": {
    "faq|header-title|header.title": "Translated title"
  }
}
```

The Translation Agent owns a complete exact value map for the current saved
identity set at Generate time.
Tokyo-worker trusts, stores, reads, lists, and deletes that artifact without
projecting it through saved content or applying a second saved-field equality
check.

An external editor-authorized write through
`PUT /api/account/instances/{instanceId}/translations/{locale}` accepts the
complete value map at the owning browser ingress. After acceptance,
Tokyo-worker stores the resulting Clickeen overlay exactly. No overlay operation
materializes package files.

Human-authored base text remains human source authority. Translation does not
silently rewrite it.

## Generate Translations

1. Bob requires the open instance to be saved and clean and sends its exact
   `instanceId`.
2. Roma resolves account, active locales, tier, saved source, and the
   Translation Agent authority.
3. Translation Agent asks San Francisco for the exact translations.
4. Translation Agent writes one exact overlay for each successful locale
   through Tokyo-worker.
5. Roma returns exhaustive result truth:

   ```text
   requestedLocales
   translatedLocales
   failedLocales
   ```

6. Bob reports that result and refreshes translated preview only when at least
   one locale succeeded.

Translation generation never publishes, stores a locale package, or changes
public files.

## Bob Preview

Bob preview is editing output, not public artifact truth. It combines
deploy-built Widget software, the one current browser-memory draft, and the
exact selected saved overlay. Bob maps each stable overlay coordinate to that
identity's current draft path, so reordering follows the item rather than the
array position. A newly added identity with no value stays explicit
untranslated source content until Generate Translations; a deleted identity is
absent from the current draft and therefore absent from preview. Bob does not
read or rewrite the instance's stored `index.html`, `styles.css`, or
`runtime.js`, and it writes no storage.

## Public Serving

Canonical URLs:

```text
https://clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}?locale={locale}
```

Explicit allowed Publish generates one complete base `index.html`, complete
`styles.css`, and mandatory visitor-behavior `runtime.js`. Materialized
customer-content nodes carry exact `data-ck-content-path` and
`data-ck-content-mode` coordinates. A Widget whose editable content belongs in
an HTML attribute also authors the exact `data-ck-content-attribute` target.

For a selected non-base locale, Tokyo-worker:

1. resolves the public route and exact published state;
2. reads the stored base `index.html`;
3. lists the exact stored overlay coordinates and authors the base locale plus
   those coordinates as the public switcher's options;
4. reads the exact requested overlay;
5. uses Cloudflare `HTMLRewriter` to apply every present stable-coordinate
   value to its authored semantic content body or exact authored attribute;
6. sets `<html lang>` to the selected locale; and
7. returns complete localized HTML before JavaScript.

The response references the same stored CSS and JavaScript. No locale-derived
package is stored. Successful base/locale responses use the existing public
cache policy and the locale query is part of the request cache coordinate. An
exact overlay write/delete purges the instance's one Cloudflare cache tag after
the mutation; that tag covers every package file and locale/query variant.

Public serving does not inject `CK_LOCALE_CONTEXT`, run a client localizer,
compare package fingerprints, compare overlay values with saved content, call a
model/agent, or rebuild Widget software.

Save preserves overlay files. Stable identity gives that preservation exact
structural behavior: reorder follows identity; a new identity remains
intentional untranslated base-source content until Generate Translations; and
a deleted identity's older value is inert because no authored node consumes
it. The next Generate Translations operation replaces the overlay with the
complete current identity set.

This is a pre-GA coordinate cutover for scalar and repeated fields. Previously
stored positional overlays are not compatibility input. After deployment,
they require explicit Generate Translations or explicit deletion. Bob and
Serve contain no old-key fallback, migration-on-read, or second overlay
schema.

Bob preview supplies the exact locale policy to the shared switcher. Public
index responses instead author `<option>` elements from the exact base locale
and stored overlay coordinates at the Edge. The shared runtime reads those
options; no public locale-policy global, `<html lang>` substitution, or client
localization pass is used. Missing public options fail visibly. Preview option
text uses the exact delivered locale coordinate because no separate preview
locale-label authority exists.

FAQ Discovery microdata wraps the same visible question/answer content slots.
Edge replacement therefore localizes the visible content inside the authored
relationship without a second SEO/Discovery renderer.

## Failure Semantics

- Requested locale outcomes are exhaustive.
- Partial translation success stays partial and names exact failed locales.
- Activity transport is not result truth.
- Missing requested overlay returns `404 Locale not available`.
- An unreadable overlay returns `500 Locale data invalid`.
- Neither case serves base or another locale.
- A missing coordinate for content added after the last Generate operation is
  intentional untranslated source content, not a missing-overlay fallback.
- A coordinate for deleted content is inert because no current semantic node
  has that identity.
- Public reads never write, heal, regenerate, or call an agent.
- Cache-purge failure remains an explicit failure of the overlay mutation; it
  is not reported as completed stale delivery.

## Current Repository And Deploy State

- Big Bang, Cards, Countdown, FAQ, and Logo Showcase use the canonical Widget
  source contract and materialize exact localization slots locally.
- Overlay generation, Bob preview, materialized slots, and Edge expression use
  stable `identityKey` coordinates locally.
- Tokyo-worker's local public path uses `HTMLRewriter` and contains no browser
  locale context.
- Translation list/read/write paths locally trust exact overlay truth.
- No commit, push, deploy, remote product-data change, or cloud-dev/live proof
  has been performed for this all-Widget pass.

## Verification

| Concern | Owner-of-truth proof |
| --- | --- |
| Account locale policy | Roma locale route response |
| Saved text | exact Tokyo instance content |
| Overlay bytes | exact R2 object after `pnpm cf:preflight` |
| Translation result | Roma requested/translated/failed sets |
| Bob preview | exact overlay values over the one current draft |
| Base package | exact stored `index.html`, `styles.css`, and `runtime.js` |
| Static base meaning | response HTML contains saved content before JavaScript |
| Localized meaning | `?locale=` response HTML contains translated content and exact `<html lang>` before JavaScript |
| Storage invariant | no locale-derived HTML/CSS/JavaScript objects |

Cloud-dev public proof requires an authorized deploy. Local code and generated
artifacts are not deployed-product evidence.
