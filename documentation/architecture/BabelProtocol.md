# Babel Protocol

Last updated: 2026-07-30

Babel is the exact saved-text translation protocol for account instances. It
turns one current saved source field set into one exact overlay value map per
requested non-base locale.

## Source Text Contract

Tokyo-worker resolves the saved instance and returns concrete text fields from
`instance.content.json`. Each field carries its concrete path and current base
text. This saved field set is the only source scope a translation job may
translate.

## Overlay Contract

For locale `{locale}`, Babel writes only:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

```json
{
  "values": {
    "header.title": "Translated text"
  }
}
```

The submitted value map must match the current saved field set exactly.
Tokyo-worker rejects missing paths, extra paths, invalid locale coordinates,
non-string values, and stale or malformed instance source.

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

That command ends after overlay truth is reconciled. It does not build, publish,
cache, or delete runtime files.

## Resolution

Bob preview and the public base runtime both resolve:

```text
saved base state + exact requested overlay values
```

Bob uses the translated-value contract directly. Public serving is gated by the
one instance publication state; Tokyo-worker injects the validated overlay into
the one base index, and the one base runtime resolves it before widget modules
start.

## Failure Semantics

- A requested locale has exactly one outcome: translated or failed.
- Full success is impossible when any requested locale failed.
- Missing and corrupt overlay truth are distinct.
- No English/base substitution is allowed for a requested non-base locale.
- Activity events are transport-only progress, not persisted truth.

## Verification

1. Read the saved field set through Roma/Tokyo.
2. Run Generate Translations.
3. Confirm the response contains only translation outcomes.
4. Read each overlay and prove exact path equality with saved content.
5. Confirm no instance HTML, CSS, or JavaScript object was created.
6. Open `/{account}/{instance}?locale={locale}` and verify translated output
   uses the package stylesheet and runtime.
