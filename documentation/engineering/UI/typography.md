# Typography In Clickeen

STATUS: CURRENT SYSTEM OPERATOR SPEC

Canonical doctrine: this document.
Execution PRD: [`126D__PRD__Typography.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126D__PRD__Typography.md).
Current source authorities are Dieter typography source, account widget
defaults, and widget runtime typography.

This document defines two typography lanes:

- Operational UI typography: Dieter owns Bob, Roma, DevStudio, Admin chrome, and
  Dieter components.
- Public widget content typography: Bob authors structured widget typography;
  the shared static style renderer applies it during Bob preview and explicit
  Publish through `--typo-*` variables.

Do not merge these lanes. Operational UI must stay deterministic and Clickeen
owned. Public widget content must stay account-authored and portable.

## Operational UI Typography

Source:

```text
dieter/tokens/dieter-typography.css
```

The complete operational typography contract is the set of visual classes
revealed in DevStudio Typography:

```text
display-*
heading-*
body-*
label-*
caption*
overline*
```

Rules:

- Every operational text node selects one declared Dieter visual class.
- Each visual class is a complete typography choice. Consumers do not assemble
  typography from raw family, size, weight, line-height, or tracking values.
- Technical values, IDs, logs, token names, and source values do not receive an
  automatic monospace exception; they use the visual class selected for their
  UI context.
- Declared size and line-height values remain internal mechanics of the visual
  class definitions, not consumer composition APIs.
- Do not create local font stacks, local type scales, or component-local text
  styles.
- Do not style raw `h1` through `h6` globally in Dieter typography.
- Use `.heading-1` through `.heading-6` as visual text classes only.
- Typography utilities own text mechanics, not color semantics.
- Operational UI letter spacing defaults to `0`. Non-zero tracking belongs only
  to an explicit, human-decided Dieter visual text class, never a copied local
  component value.
- Use only utility names declared in the current Dieter typography source.

Raw semantic headings remain HTML semantics. Visual scale is explicit through
classes, for example `<h2 class="heading-3">` when the semantic level and visual
scale differ.

DevStudio reveals all 31 visual classes and exposes one page-level
**Edit typography tokens** action. The source currently contains 17 live
font-size and line-height tokens. Font-size writes accept only positive
`rem`/`em`/`px` lengths or the existing positive `clamp(...)` shape;
line-height writes accept only positive unitless numbers. DevStudio submits the
exact entered value. Invalid input is rejected visibly and is never trimmed,
normalized, or committed as a different value.

## Public Widget Typography

Public widget typography is account content typography.

Bob saves structured typography in widget state:

```text
typography.globalFamily
typography.roles.*
typography.roleScales.*
```

Every current Widget applies that state during Bob preview and Roma Publish
through the same static style renderer:

```text
renderWidgetStyles(exact state + exact account font data)
-> complete CSS variables and role styles
```

The generated CSS emits `--typo-*` variables for the Widget scope. Widget typography may
include account-authored content colors, role scales, custom sizes, weights,
styles, tracking presets, line-height presets, and locale/script-aware fallback
behavior. That is widget content authority, not Dieter chrome authority.

Saved `typography.roleScales` is the only role-scale authority. The
source/editor contract produces every common and Widget-declared role, scale,
tracking preset, and line-height preset as exact Clickeen truth. Roma consumes
that complete trusted typography during materialization; it does not reconstruct
or revalidate the contract against a second schema.

Widget content may use container-query fluid sizing because widgets run inside
variable embed containers. Operational UI chrome must not use viewport-fluid
type.

Roma and Admin consume this operational UI typography. DevStudio may reveal or
edit only typography values whose real Dieter source authority it can govern;
its preview data is not a second typography authority.

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
- Global Clickeen font records, loaded from the Tokyo `/fonts/special/**`
  product path. These records use `source: "tokyo"` and are available to every
  account.
- Account-uploaded font records, stored as account assets under
  `accounts/{accountPublicId}/assets/{filename}` and served by Clickeen account
  asset CDN URLs at runtime.

The admin account is a normal account:

```text
CLICKEEN
```

Fonts uploaded by `CLICKEEN` are still `CLICKEEN` account assets. The seven
Clickeen-owned special fonts—Frari, Giudecca, Marin, Orio, Pachuka, Pachuka
Line, and Rialto—are not uploads: their git source is
`tokyo/product/fonts/special/**`, their R2 home is `fonts/special/**`, and their
friendly Tokyo path is `/fonts/special/**`.

Those seven `source: "tokyo"` records are required product records and must
match the system definitions exactly. Account documents cannot remove them,
replace them with account assets, add arbitrary Tokyo font paths, or attach
unknown fields. Other Google and account-uploaded records remain account font
library data.

## Account Font Library Shape

The persisted account font library stores source truth, not runtime URLs:

```text
fontLibrary: {
  version: 1,
  fonts: {
    [family]: {
      label,
      source,       // google | tokyo | account-asset
      category,     // sans | serif | display | script | handwritten
      familyClass,  // sans | serif
      usage,        // body-safe | heading-only
      weights,
      styles,
      locked?,
      spec?,        // google only
      filePath?,    // tokyo only; /fonts/special/{filename}
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

- The account-independent widget compiler emits typography family controls as
  strings without a default font catalog.
- On editor open, Bob binds those family controls to the exact current-account
  font library supplied by Roma. The bound controls govern manual edits and
  Copilot context. Bob does not normalize or semantically revalidate that
  Clickeen-owned artifact.
- Family changes are one product operation: the requested family plus a
  compatible weight and style are applied together. Dieter emits the requested
  family only; it does not choose companion values.
- The user-facing account-backed controls admit only choices from the exact
  account library at the editing ingress. Once Bob emits the complete draft,
  materialization trusts it; it does not run a second family/weight/style
  validator.
- Bob preview resolves account-uploaded font `assetRef` values through the
  current account asset route and renders the exact temporary preview CSS from
  the same draft typography state.
- Bob preview passes global Tokyo font paths through its same-origin `/fonts/**`
  proxy; it does not resolve those files as account assets.
- Inter is always available when account data is valid.
- An unavailable Roma-owned `fontLibrary` fails at the owning account/open
  boundary. Bob does not reinterpret its contents.
- Bob must not show or preview font choices the runtime cannot load.

Published-package behavior:

- Publish materialization reads saved typography and account font library
  together.
- Materialization consumes every role's exact family, weight, and style before
  asset resolution. Instance typography and common defaults are required. A widget
  with no widget-core typography roles does not invent a core typography block.
- Packages include only the font records used by the saved instance plus Inter.
- Google records become exact stylesheet `<link>` elements in generated
  `index.html`; generated CSS never uses a render-blocking Google `@import`.
- Global Tokyo records materialize to an absolute URL on the configured Tokyo
  origin, such as `https://tokyo.dev.clickeen.com/fonts/special/Orio.woff`.
  Public packages never resolve them through `clk.live` or an account folder.
- Account-uploaded records emit `@font-face` from resolved account asset URLs.
- A genuinely unreadable required account font asset fails at the owning asset
  boundary. No consumer silently replaces it with Inter.

- One stored stylesheet includes locale-responsive `:lang(...)` typography
  rules and the required script font dependencies. Tokyo changes only
  `<html lang>` while applying an overlay, so Japanese, Korean, Chinese,
  Arabic, Hebrew, Thai, Devanagari, Bengali, Cyrillic, and Latin text select
  the correct authored fallback/line-height rules without locale packages.
- Bob preview uses the same rendered CSS and exact Google stylesheet links.

Big Bang, Cards, Countdown, FAQ, and Logo Showcase all use the canonical static
style path locally. Common typography labels remain owned by the Widget
foundation; Widgets declare labels and display order for Widget-specific roles
in `editor.panels[].shared.roleLabels`. Roma Publish writes complete typography
into `styles.css`, and Bob uses the same style renderer for its temporary
source-and-draft preview. Public `runtime.js` does not perform initial
typography application, and there is no `CKTypography`,
`CK_WIDGET_TYPOGRAPHY_DATA`, or `ck:state-update` compatibility path.

## Fallback Truth

Public widget CSS uses the required Inter account-font baseline directly before
structured widget typography data is applied. It does not depend on an
operational UI font-family variable. A missing programmer-authored typography
module is a source/build failure, and an unavailable required asset fails at
its owning asset boundary. The static baseline is presentation, not a runtime
validator, repair path, or substitute for either authority.

## Font Uploads

Uploaded fonts are account assets. Accepted font upload pairs are exact:

- `.woff2` with `font/woff2`.
- `.woff` with `font/woff`, `application/font-woff`, or
  `application/x-font-woff`.
- `.ttf` with `font/ttf` or `application/x-font-ttf`.
- `.otf` with `font/otf` or `application/x-font-otf`.

Do not accept broad `font/*`. SVG fonts, CSS, JavaScript, HTML, XML, WASM, and
scriptable/executable extensions are rejected.
