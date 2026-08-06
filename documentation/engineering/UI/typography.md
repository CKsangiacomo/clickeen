# Typography In Clickeen

STATUS: CURRENT SYSTEM OPERATOR SPEC

Canonical doctrine: this document.
Execution PRD: [`126D__PRD__Typography.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126D__PRD__Typography.md).
Current source authorities are Dieter typography source, account Widget
defaults, and structured Widget typography consumed by Web Code Generator.

This document defines two typography lanes:

- Operational UI typography: Dieter owns Bob, Roma, DevStudio, Admin chrome, and
  Dieter components.
- Public Widget content typography: Bob authors structured Widget typography;
  Web Code Generator validates it and writes its font CSS and `--typo-*`
  variables into the exact generated package.

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

## Public Widget Typography

Public widget typography is account content typography.

Bob saves structured typography in widget state:

```text
typography.globalFamily
typography.roles.*
typography.roleScales.*
```

Web Code Generator applies that state through:

```text
packages/ck-web-code-generator/src/shell.ts
```

Generation emits `--typo-*` variables for the Widget scope. Widget typography may
include account-authored content colors, role scales, custom sizes, weights,
styles, tracking presets, line-height presets, and locale/script-aware fallback
behavior. That is widget content authority, not Dieter chrome authority.

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

Persisted uploaded font records keep `assetRef`, not public URLs. Bob resolves
that reference through the account asset authority before generation. Web Code
Generator emits the resolved public URL only into generated font CSS.

## Bob And Runtime Flow

Bob opens through Roma. Roma is the current-account authority and supplies the
account font library from account widget defaults to Bob.

Bob behavior:

- The account-independent widget compiler emits typography family controls as
  strings without a default font catalog.
- On editor open, Bob binds those family controls to the normalized current
  account font library. The bound controls govern manual edits, Copilot context,
  and normal config validation.
- Family changes are one product operation: the requested family plus a
  compatible weight and style are applied together. Dieter emits the requested
  family only; it does not choose companion values.
- The account-backed controls do not offer unavailable choices. Direct or
  malformed saved family/weight/style combinations are rejected by Web Code
  Generator; they are not trimmed, repaired, or replaced.
- Bob preview resolves account-uploaded font `assetRef` values through the
  current account asset route and regenerates the exact preview package with
  the resolved font context.
- Inter is always available when account data is valid.
- Missing or malformed `fontLibrary` fails editor open explicitly.
- Bob must not show or preview font choices generation cannot load.

Generated package behavior:

- Web Code Generator reads the current structured typography and resolved
  account font context together.
- Generation validates every role's family, weight, and style against the
  already resolved font context before CSS emission. Instance typography and
  Shell defaults are required. A widget
  with no widget-core typography roles does not invent a core typography block.
- Packages emit font CSS only for families selected by the generated Instance.
- Google records load from Google.
- Account-uploaded records emit `@font-face` from resolved account asset URLs.
- Unknown font families, missing font records, or missing account font assets
  fail resolution or generation. They are not silently replaced with Inter.

Shared Widget typography behavior:

- Shell typography labels are owned by `@clickeen/widget-shell`. Widgets declare
  labels and display order for widget-specific roles in
  `editor.panels[].shared.roleLabels`.
- Web Code Generator writes selected typography variables and required font CSS
  into the same exact package Bob previews and submits on Save.
- `runtime.js` does not receive or apply typography state.

## Fallback Truth

Public Widget CSS does not depend on an operational UI font-family variable.
Malformed structured typography, an unavailable selected font, or a missing
font asset must fail through Bob resolution or Web Code Generator rather than
becoming an apparent successful package.

## Font Uploads

Uploaded fonts are account assets. Accepted font upload pairs are exact:

- `.woff2` with `font/woff2`.
- `.woff` with `font/woff`, `application/font-woff`, or
  `application/x-font-woff`.
- `.ttf` with `font/ttf` or `application/x-font-ttf`.
- `.otf` with `font/otf` or `application/x-font-otf`.

Do not accept broad `font/*`. SVG fonts, CSS, JavaScript, HTML, XML, WASM, and
scriptable/executable extensions are rejected.
