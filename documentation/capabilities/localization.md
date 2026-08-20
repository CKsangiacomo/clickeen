# Localization Capability

STATUS: STABLE OVERLAY CONTRACT AND LITERAL REPEATED-IDENTITY PACKAGE DEPLOYED AND LIVE-VERIFIED

Last updated: 2026-08-20

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

The `content` member of atomic `instance.source.json` owns the current saved
translatable field set. Its keys are concrete paths. Each field also carries
its field pattern and stable `identityKey`. The overlay uses `identityKey`, not
the physical map key:

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

An authenticated explicit cutover/deletion uses
`DELETE /api/account/instances/{instanceId}/translations/{locale}` for that one
account, instance, and locale. Roma resolves the current account and delegates
the exact delete to Tokyo-worker. It is not a broad R2-prefix deletion or a
visitor-time migration.

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
read or rewrite the instance's stored logical `indexHtml`, `stylesCss`, or
`runtimeJs` package members, and it writes no storage.

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
2. reads logical `publicPackage.indexHtml` from the atomic published
   `serve-state.json`;
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
exact overlay write/delete reaches Tokyo's default Worker entrypoint after the
mutation and schedules the exact account-instance tag eviction through
`waitUntil`. Every cacheable response for the exact account/instance carries
that tag, covering every package path. Eviction availability and outcome are
never part of the overlay result.

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

The CLICKEEN cloud-dev cutover is complete: `VUWUJ7OQ0Y` is the only instance
with overlays; its 28 locale files exactly cover the 28 active non-base
locales, and every file's 12 keys exactly match the 12 stable identity keys in
current saved source. No Generate/delete product-data operation is pending.

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
- An overlay PUT/DELETE returns its exact storage result. After success,
  Tokyo-worker schedules account-instance tag eviction through `waitUntil`.
  Cache context and purge outcome are invisible to the operation, Roma, and the
  user; bounded freshness with `must-revalidate` remains the delivery backstop.

## Current Repository And Deploy State

- Big Bang, Cards, Countdown, FAQ, and Logo Showcase use the canonical Widget
  source contract and authored stable localization slots. The then-published
  FAQ package's repeated-selector serialization mismatch is named below.
- Overlay generation, Bob preview, materialized slots, and Edge expression use
  stable `identityKey` coordinates in the deployed implementation.
- Tokyo-worker's deployed public path uses `HTMLRewriter` and contains no
  browser locale context.
- Translation list/read/write paths trust exact overlay truth.
- Product commit `e2ac3589` was pushed and deployed through cloud-dev Worker/R2
  run `32087699030` plus the Git-connected Bob/Roma Pages deploys. The later
  shared-composition correction `03132e5f` and verification `2b13e7c1` are also
  present on cloud-dev.
- Remote account overlay truth is already fully on the stable-identity
  contract; no positional key remains and no compatibility read exists.
- The newer pre-GA atomic source/published-serve-state cutover is complete for
  all four legacy saved cloud-dev instances under `CLICKEEN`; the two public
  instances were Republished through Roma. There is no compatibility reader or
  migration-on-read, and retained split legacy objects are unreachable.
- Both prior zone-API invalidation attempts were proved silent no-ops for
  Workers Caching. The original zone `tags` request left warm base and French
  responses at cache `HIT` after Republish returned `200`; the later accepted
  zone `prefixes: [host/account/instance]` request cannot invalidate cache owned
  by the Worker entrypoint. The deployed source schedules Tokyo's owning
  default-entrypoint tag eviction through `waitUntil` and makes its outcome
  product-inert. Cache HIT/MISS or purge success is intentionally not an
  acceptance gate. Agent-executed public-serving proof passes independently of
  cache outcome.
- Agent closure verification on 2026-08-20 proved and corrected a separate
  package-producer mismatch: repeated FAQ content paths contained Mustache
  entity text for `=` and therefore missed the exact stored overlay keys. The
  shared producer retains unsafe-character escaping while emitting the
  canonical literal coordinate. Commit `72e75000` is deployed; Roma
  Republished only `VUWUJ7OQ0Y`; exact source and overlay hashes remained
  unchanged; and unique French public HTML contains translated scalar and
  repeated FAQ content before JavaScript.

## Verification

| Concern | Owner-of-truth proof |
| --- | --- |
| Account locale policy | Roma locale route response |
| Saved text | exact Tokyo instance content |
| Overlay bytes | exact R2 object after `pnpm cf:preflight` |
| Translation result | Roma requested/translated/failed sets |
| Bob preview | exact overlay values over the one current draft |
| Base package | exact logical `indexHtml`, `stylesCss`, and `runtimeJs` inside the atomic published `serve-state.json` |
| Static base meaning | response HTML contains saved content before JavaScript |
| Localized meaning | `?locale=` response HTML contains translated content and exact `<html lang>` before JavaScript |
| Storage invariant | no locale-derived HTML/CSS/JavaScript objects |

Cloud-dev public proof requires an authorized deploy. Local code and generated
artifacts are not deployed-product evidence.
