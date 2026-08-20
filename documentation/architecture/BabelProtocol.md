# Babel Protocol

Last updated: 2026-08-20

Babel is the exact saved-text translation protocol for account instances. It
turns one current saved source field set into one exact overlay value map per
requested non-base locale.

## Source Text Contract

Tokyo-worker resolves the saved instance and returns concrete text fields from
the `content` member of atomic `instance.source.json`. Each field carries its
concrete path, `fieldPattern`, stable `identityKey`, and current base text. Roma sends the
stable `identityKey` in the existing Babel item `path` field; that transport
name carries an opaque content coordinate, not a positional array path. This
saved field set is the only source scope a translation job may translate.

## Overlay Contract

For locale `{locale}`, Babel writes only:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

```json
{
  "values": {
    "faq|header-title|header.title": "Translated text"
  }
}
```

The Translation Agent owns an exact value map matching the current saved
identity set. Scalar coordinates contain Widget type, role, and field pattern.
Repeated coordinates additionally contain every declared
`arrayItemIdentity` path and stable ID. Tokyo-worker trusts that
Clickeen-produced map and stores it completely; it does not recheck
coordinates, value types, locale meaning, or source freshness. A Translation
Agent result that violates its contract is fixed at the producing authority,
not guarded, filtered, or repaired downstream.

## Current Account Instance Path

```text
Bob Generate Translations
-> Roma current account/session gate
-> Translation Agent request for exact requested locales
-> San Francisco translation operation
-> Tokyo-worker exact overlay writes
-> Roma returns requested/translated/failed locale outcomes
-> Bob refreshes overlay-backed translation previews
```

That command ends after the exact overlay writes complete and their outcomes
return. It does not build, publish, cache, or delete runtime files.

## Resolution

Bob translated preview and the public selected-locale response both express:

```text
saved base state + exact requested overlay values
```

Bob uses the translated-value contract directly. Public serving is gated by the
one instance publication state; Tokyo-worker applies the trusted exact overlay
to the semantic nodes in the one base index response. The returned HTML already
contains the selected-locale content before Widget JavaScript starts.

Save leaves overlays unchanged. Reorder follows stable item identity. A newly
added identity has no value and remains explicit untranslated base-source
content until Generate Translations. A deleted identity has no preview or
public content node, so an older coordinate is inert. Generate Translations
replaces the locale overlay with the complete current saved identity set.

## Failure Semantics

- A requested locale has exactly one outcome: translated or failed.
- Full success is impossible when any requested locale failed.
- Missing and corrupt overlay truth are distinct.
- A missing requested locale never substitutes another locale.
- Missing value for a newly added identity is explicit untranslated source
  content, not locale fallback.
- Activity events are transport-only progress, not persisted truth.

## Current Implementation And Pre-GA Cutover

Roma now sends saved `identityKey` coordinates, Translation Agent preserves
them through model output and overlay writes, Bob resolves them against the
current draft, Roma materializes them into the generic content-slot attributes,
and Tokyo-worker applies present values at the Edge without a downstream
overlay validator.

This changes both scalar and repeated coordinates from the old positional
format. Previously stored positional overlays are not read through a
compatibility path. After deployment, they require explicit Generate
Translations or explicit deletion. Serve never migrates or falls back to the
old format.

The CLICKEEN pre-GA overlay cutover is complete. `VUWUJ7OQ0Y` owns the only
stored overlays: 28 locale files matching the 28 active non-base locales, each
with the exact 12 stable keys from current saved source. No positional overlay
or pending Generate/delete cutover remains. Closure verification separately
found an encoded repeated-key mismatch in the published HTML producer; that is
a materializer/package correction, not a Babel or overlay-data correction.

The separate pre-GA atomic `instance.source.json` cutover is complete for all
four legacy saved cloud-dev instances under `CLICKEEN`; the two public
instances were Republished through Roma. There is no legacy source reader or
migration-on-read, and retained split legacy objects are unreachable.

## Verification

1. Read the saved field set through Roma/Tokyo.
2. Run Generate Translations.
3. Confirm the response contains only translation outcomes.
4. Read each newly generated overlay and prove its coordinate set equals the
   saved `identityKey` set used for that generation.
5. Confirm no instance HTML, CSS, or JavaScript object was created.
6. Open `/{account}/{instance}?locale={locale}` and verify translated output
   is present in response HTML before JavaScript and uses the package stylesheet
   and runtime.

These are operator/release checks of the producing authorities. Normal product
runtime must not depend on them or reproduce them as downstream validation.
