# Typography In Clickeen

STATUS: CURRENT SYSTEM OPERATOR SPEC

Authority: 126D, Dieter typography source, account widget defaults, and widget
runtime typography.

126D defines two typography lanes:

- Operational UI typography: Dieter owns Bob, Roma, DevStudio, Admin chrome, and
  Dieter components.
- Public widget content typography: Bob authors structured widget typography;
  widget runtime applies it through `CKTypography.applyTypography` and
  `--typo-*` variables.

Do not merge these lanes. Operational UI must stay deterministic and Clickeen
owned. Public widget content must stay account-authored and portable.

## Operational UI Typography

Source:

```text
dieter/tokens/dieter-typography.css
```

Operational UI uses:

```text
--font-ui: Inter Tight, Inter, system-ui, sans-serif
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace
```

Rules:

- Use `--font-ui` for normal Clickeen UI text.
- Use `--font-mono` for code, IDs, logs, and structured technical values.
- Use Dieter visual text classes and declared size/line-height tokens.
- Do not create local font stacks or local type scales in components.
- Do not style raw `h1` through `h6` globally in Dieter typography.
- Use `.heading-1` through `.heading-6` as visual text classes only.
- Typography utilities own text mechanics, not color semantics.
- Use only utility names declared in the current Dieter typography source.

Raw semantic headings remain HTML semantics. Visual scale is explicit through
classes, for example `<h2 class="heading-3">` when the semantic level and visual
scale differ.

## Public Widget Typography

Public widget typography is account content typography.

Bob saves structured typography in widget state:

```text
typography.globalFamily
typography.roles.*
typography.roleScales.*
```

Runtime applies that state through:

```text
tokyo/product/widgets/shared/typography.js
CKTypography.applyTypography(...)
```

Runtime emits `--typo-*` variables for the widget scope. Widget typography may
include account-authored content colors, role scales, custom sizes, weights,
styles, tracking presets, line-height presets, and locale/script-aware fallback
behavior. That is widget content authority, not Dieter chrome authority.

Widget content may use container-query fluid sizing because widgets run inside
variable embed containers. Operational UI chrome must not use viewport-fluid
type.

## Account Font Library

Every account has one widget typography font library in the existing account
widget defaults document:

```text
accounts/{accountPublicId}/widget-defaults.json
fontLibrary
```

Inter is always present and locked. Accounts cannot remove Inter.

Account font records are either:

- Google font records, loaded from Google font delivery with the stored `spec`.
- Account-uploaded font records, stored as account assets under
  `accounts/{accountPublicId}/assets/{filename}` and served by Clickeen account
  asset CDN URLs at runtime.

The admin account is a normal account:

```text
CLICKEEN
```

Custom fonts uploaded by `CLICKEEN` are `CLICKEEN` account assets. They are not
global product fonts.

## Account Font Library Shape

The persisted account font library stores source truth, not runtime URLs:

```text
fontLibrary: {
  version: 1,
  fonts: {
    [family]: {
      label,
      source,       // google | account-asset
      category,     // sans | serif | display | script | handwritten
      familyClass,  // sans | serif
      usage,        // body-safe | heading-only
      weights,
      styles,
      locked?,
      spec?,        // google only
      assetRef?,    // account-asset only
      contentType?  // account-asset only
    }
  }
}
```

Persisted uploaded font records keep `assetRef`, not public URLs. Runtime
package materialization resolves `assetRef` through the account asset authority
and emits the public account asset URL only into materialized runtime data.

## Bob And Runtime Flow

Bob opens through Roma. Roma is the current-account authority and supplies the
account font library from account widget defaults to Bob.

Bob behavior:

- The typography panel font picker uses the account font library.
- Bob preview resolves account-uploaded font `assetRef` values through the
  current account asset route and posts runtime typography data into the widget
  iframe with preview state.
- Inter is always available when account data is valid.
- Missing or malformed `fontLibrary` fails editor open explicitly.
- Bob must not show or preview font choices the runtime cannot load.

Runtime package behavior:

- Save/package materialization reads saved typography and account font library
  together.
- Packages include only the font records used by the saved instance plus Inter.
- Google records load from Google.
- Account-uploaded records emit `@font-face` from resolved account asset URLs.
- Unknown font families, missing font records, or missing account font assets
  fail materialization. They are not silently replaced with Inter.

Shared widget runtime behavior:

- `CKTypography` reads `CK_WIDGET_TYPOGRAPHY_DATA`.
- Public runtime packages inline that data during package materialization.
- Bob preview supplies the same shape through `ck:state-update.typographyData`
  before widget clients apply preview state.

## Font Uploads

Uploaded fonts are account assets. Accepted font upload pairs are exact:

- `.woff2` with `font/woff2`.
- `.woff` with `font/woff`, `application/font-woff`, or
  `application/x-font-woff`.
- `.ttf` with `font/ttf` or `application/x-font-ttf`.
- `.otf` with `font/otf` or `application/x-font-otf`.

Do not accept broad `font/*`. SVG fonts, CSS, JavaScript, HTML, XML, WASM, and
scriptable/executable extensions are rejected.
