# Overlay Architecture

Last updated: 2026-08-20

## Product Rule

An account instance has one saved source, one published base runtime, and zero
derived locale runtimes.

```text
one base runtime + one exact locale overlay = localized rendering
```

Translation changes locale overlay truth only. It must never create HTML, CSS,
JavaScript, publication state, fingerprints, or another delivery lifecycle for
a locale.

## Storage

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.source.json
  serve-state.json
  overlays/
    locales/
      {locale}.json
```

The overlay body is exact:

```json
{
  "values": {
    "faq|header-title|header.title": "Translated text"
  }
}
```

There is no instance-level locale artifact subtree.

## Field Authority

The `content` member of atomic `instance.source.json` owns the current saved
text-field set. Its map keys remain concrete paths. Each field also carries its
`fieldPattern` and stable `identityKey`.

Overlay `values` use that `identityKey` as the content coordinate:

```text
scalar:
{widgetType}|{role}|{fieldPattern}

repeated:
{widgetType}|{role}|{fieldPattern}|{arrayItemIdentityPath}={stableId}...
```

Every repeated coordinate is therefore derived from the exact
`arrayItemIdentity` declarations in the Widget's `editable-fields.json`, not
from an array index. A Generate Translations operation produces one complete
map for the current saved identity set. The Translation Agent owns conformance
when it produces that map; Tokyo-worker trusts and stores the complete result.
Downstream services never filter, repair, narrow, or revalidate the accepted
overlay.

Save does not rewrite an existing overlay. Its structural behavior is exact:

- reorder keeps the same identities, so translations follow their items;
- add creates a new identity with no overlay value, so that field remains
  intentional untranslated base-source content until Generate Translations;
- delete removes the rendered identity, so any old overlay coordinate is inert
  and disappears from preview/public expression; and
- the next Generate Translations replaces the locale map with the complete
  current identity set.

## Runtime Rule

The canonical public selection is:

```text
/{accountPublicId}/{instanceId}?locale={locale}
```

Tokyo-worker:

1. resolves the public route coordinate and reads the exact publication state;
2. lists exact stored overlay coordinates and authors the base locale plus those
   coordinates as the public switcher's options;
3. for an explicit non-base locale, reads the exact requested
   Translation-Agent overlay;
4. applies each exact value whose stable coordinate is present to the matching
   semantic node body or exact authored `data-ck-content-attribute` target in
   the published serve-state's logical `indexHtml` response;
5. serves the resulting semantic HTML response through the existing public
   cache policy, with the locale query in the request coordinate.

The public locale switcher consumes only the exact options authored in step 2.
It does not invent options from a browser global or `<html lang>`; absent
options fail visibly. Bob preview remains separate and uses its exact delivered
preview locale policy.

The published serve-state's logical `indexHtml` already contains complete
semantic base-language content. A localized HTML response contains every available selected-locale
value before JavaScript. A new stable identity added since the last Generate
Translations operation remains visibly base-source content and is explicitly
untranslated; this is not substitution from another overlay or locale. The
response continues to reference the same `styles.css` and mandatory
`runtime.js`. JavaScript owns visitor behavior; it does not create initial
content, localize, host, or serve the instance.

Missing overlays return `404 Locale not available`. If the exact selected
overlay cannot be read or applied, the request fails visibly as `500 Locale
data invalid`. Neither condition falls back to another locale, and neither
authorizes a second overlay schema/equality validator in the serving path.
Those error responses are not cached. Because an overlay coordinate changes
both one localized response and the switcher options in every index response,
Publish, unpublish, Delete, and an exact overlay write/delete cause Tokyo's
default Worker entrypoint to schedule its own Workers Cache eviction after the
owning truth mutation through `waitUntil`. It uses the exact
`accountInstanceCacheTag`; every cacheable response
for the exact account/instance carries that tag, covering every package path
and locale/tracking query variant. Eviction outcome is never part of the
mutation result or product UI.

This stable-coordinate format is a pre-GA cutover for scalar and repeated
fields. Previously stored positional-key overlays are not compatibility input.
After deployment, an affected locale requires an explicit Generate
Translations operation or explicit overlay deletion. There is no positional
read fallback, migration-on-Serve, or alternate overlay schema.

CLICKEEN cloud-dev has no remaining affected positional locale: the only 28
stored overlays are on `VUWUJ7OQ0Y`, and every file's exact 12-key set equals
current saved stable-identity truth. The closure mismatch is instead in the
then-published package, where repeated `=` selectors were entity-encoded by the
materializer. The producer correction changes no overlay coordinate or data.

## Current Operations

| Operation | Authority |
| --- | --- |
| List/read/write/delete overlay values | Roma account route -> Tokyo-worker translation route |
| Generate translations | Bob command -> Roma -> Translation Agent -> exact Tokyo overlay writes |
| Remove an active language | Roma deletes that exact overlay from every account instance |
| Save instance source | Roma -> Tokyo-worker; atomically replaces `instance.source.json` only |
| Publish/unpublish | Roma owns the account command; allowed Publish materializes the base package, and Tokyo-worker atomically replaces package/publication truth in `serve-state.json` |
| Public localized read | Tokyo-worker reads the one base package and exact overlay |

## Failure Semantics

- Generation success means every requested locale has an explicit translated or
  failed outcome. It never includes artifact work.
- Partial translation failure stays partial and names the exact failed locales.
- Overlay deletion reports every completed and failed instance/locale
  coordinate.
- An overlay write/delete returns the exact storage result. After a successful
  mutation, Tokyo-worker schedules the same account-instance cache eviction as
  publication and deletion. Cache availability or outcome cannot change the
  overlay result and is never exposed to Roma or the user.
- Missing requested overlay is absence; malformed stored overlay is corruption.
  They are not interchangeable.
- A missing value for a newly added stable identity is explicit untranslated
  source content, not a missing locale overlay or corruption.
- An old value for a deleted stable identity has no rendered consumer and is
  inert until the next Generate Translations replacement.
- Public localization never calls a model, writes storage, regenerates source,
  or depends on a test/probe.

## Local Implementation State

Tokyo-worker's local public path now trusts Roma's atomic published serve-state
and the exact Translation-Agent overlay. Big Bang, Cards, Countdown, FAQ, and Logo Showcase
all materialize their authored semantic content slots through the canonical
Widget contract. Tokyo-worker uses Cloudflare `HTMLRewriter` to replace those
slots by stable `identityKey` and set
`<html lang>` before returning the selected-locale response. Missing newly
added coordinates leave the authored base-source node unchanged; deleted
coordinates have no node. A content slot may author an exact
`data-ck-content-attribute` such as `alt` or `title`; the same generic rewriter
sets that attribute instead of element content. Public package fingerprints,
browser locale context, client localization, overlay-shape validation, and
saved-field equality checks are absent from that serving path.

Authenticated translation list/read/write operations also trust exact
owner-produced overlays; they do not project or compare values against saved
content. The public route and publication gate remain real, and no requested
locale falls back to base.

The stable overlay contract, generic Tokyo path, and literal repeated-identity
producer are deployed from `72e7500072ced840648747d66d60a670538a2f52`.
Agent closure Republished only FAQ `VUWUJ7OQ0Y` through Roma. Its saved source
and all 28 exact overlays remained byte-identical; `publishedAt` advanced to
`2026-08-20T18:21:12.284Z`. Unique public base and French requests proved
literal repeated `=` coordinates, correct scalar and repeated translations,
correct base content, and no serving-time compatibility path.

The separate pre-GA atomic source/published-serve-state cutover is complete for
all four legacy saved cloud-dev instances under `CLICKEEN`; the two public
instances were Republished through Roma. No compatibility reader or
migration-on-read exists, and retained split legacy objects are unreachable.

## Verification

| Concern | Owner-of-truth verification |
| --- | --- |
| Overlay bytes | `pnpm cf:preflight`, then exact R2 object read |
| Translation command | Roma response contains requested/translated/failed locale truth only |
| Base public runtime | public instance URL loads the base index, stylesheet, and runtime |
| Localized public runtime | response HTML for `?locale=` contains translated semantic text before JavaScript and the same package support URLs |
| Missing/corrupt locale | explicit 404/500; never base-language output |
| Storage invariant | zero instance objects outside `overlays/locales/` representing a locale runtime |
