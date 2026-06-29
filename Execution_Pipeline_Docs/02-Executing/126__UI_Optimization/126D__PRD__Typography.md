# 126D - PRD: Typography

Status: PRE-EXECUTION READY - three-lane review green.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126D of 126A-126M.
KB doc: `documentation/engineering/UI/typography.md`.

This PRD is the execution authority for 126D typography. It is filled from
Codex and GLM Step 1 as-built evidence, Step 3 official-source research, and
human product direction. It decides the typography standard, names the current
gaps, and defines the blast radius for execution.

126D execution must make the codebase and docs match this PRD. It must not
create a new typography framework, compatibility lane, generic text engine,
font governance subsystem, or validation ritual.

## Step Inputs

- Step 1 Codex as-built: `audits/126D__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126D__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126D_Research_Codex.md`.
- Step 3 GLM research: `research/126D_Research_GLM.md`.
- Step 6 Codex pre-execution audit: `audits/126D__Audit__Typography.md`.
- Current living doc: `documentation/engineering/UI/typography.md`.
- Account asset authority: `documentation/architecture/AssetManagement.md`.
- Dieter typography source: `dieter/tokens/dieter-typography.css`.
- Public widget runtime: `tokyo/product/widgets/shared/typography.js`.

## Role

126D owns typography mechanics for Clickeen UI: font families, account font
libraries, static and fluid size scales, line heights, tracking/letter-spacing
surfaces, utility classes, runtime widget typography roles, script/font fallback
behavior, generated typography visibility, and consumer usage across Bob, Roma,
DevStudio, Admin, and public widgets.

126D does not own color semantics. If a typography class carries color, that is
a gap to route to 126B/component context/widget content authority.

126D does not own document hierarchy. Raw `h1` through `h6` elements are
semantic HTML. Dieter may provide visual text classes, but Dieter does not own a
content-heading taxonomy.

## Pre-GA Cleanup Tenet

Clickeen is pre-GA. Once the 126D typography standard is decided, execution
cleans source and docs to that standard.

- Fix source and docs to this PRD.
- Remove stale paths and stale names from active code/docs.
- Do not support old and new typography names in parallel.
- Do not add guards/checks/deny lists to preserve paths that should no longer
  exist.
- Do not document removed behavior as a living option.

Compliance reason: this protects agent-operability. Agents need one current
truth, not a catalog of old drift to reinterpret.

## Current Reality Summary

Clickeen already has useful typography infrastructure, but it is split across
Dieter operational UI typography and public-widget runtime typography without a
single execution-grade product law.

Strong current substrate:

- `dieter/tokens/dieter-typography.css` defines `--font-ui`, `--font-mono`,
  base size tokens, `--fs-10` through `--fs-32`, display size tokens, line-height
  tokens, and utility classes.
- `tokyo/product/widgets/shared/typography.js` validates and applies
  public-widget typography through `CKTypography.applyTypography`.
- `bob/lib/compiler/modules/typography.ts` exposes Bob's widget typography
  editor contract.
- `packages/widget-shell/src/defaults.ts`, `contract.ts`, and `controls.ts`
  define default widget-shell typography payload shape.
- DevStudio generates typography preview data from Dieter CSS and can currently
  edit only a subset of typography tokens.

Current gaps:

- Dieter operational UI and widget runtime typography are both real, but their
  ownership boundaries are underdocumented.
- Dieter has no tracking token layer; tracking appears as utility-local values.
- Dieter utility classes currently carry some color behavior that belongs to
  126B/component context/widget content authority.
- Public widgets have richer typography mechanics than the public Dieter doc
  explains: tracking presets, line-height presets, container-query fluid sizing,
  script fallback, and locale/script-aware line-height behavior.
- `--font-display` is referenced by widget CSS but has no source definition in
  the inspected state.
- Bob font data and widget runtime font data still expose fixed
  `source: 'tokyo'` / `/fonts/special/*` records. The decided product law is
  account font libraries, not a global custom-font bucket.
- The account font library is not yet represented as a concrete account data
  contract. Bob currently builds options from static source metadata, and the
  runtime currently accepts only static `CK_WIDGET_TYPOGRAPHY_DATA.curatedFonts`.
- Account assets do not yet accept/list fonts as `assetType: "font"`.
- Root `/fonts/**` routing still exists in Tokyo-worker/Cloudflare/Bob proxy
  paths and must be removed only after account-font migration and package
  inventory prove the root font path is no longer live product data.
- Bob editor fields, widget-shell defaults, and runtime-applied fields do not
  fully line up.
- Existing docs understate Bob, widget runtime, account fonts, and generated
  class-count reality.

## Human-Decided Product Standard

The 126D problem is not "invent prettier fonts." The problem is that agents
have been given several typography contracts without one deterministic rule for
which surface owns which decision.

126D defines two typography lanes:

- Operational UI typography: Dieter owns Bob/Roma/DevStudio/Admin chrome and
  Dieter components.
- Public widget content typography: Bob authors structured widget typography
  config; widget runtime applies it through `CKTypography.applyTypography` and
  `--typo-*` variables.

These lanes stay separate. Merging them would make operational UI too
brand-flexible or make public widgets too rigid.

## Operational UI Typography

Operational UI means Clickeen chrome and controls: Bob, Roma, DevStudio, Admin,
and Dieter components.

Target law:

- Use `--font-ui` for normal UI text.
- Use `--font-mono` for code, IDs, logs, structured technical values, and
  monospace text.
- Use Dieter-declared size and line-height tokens/classes.
- Do not create local font stacks, local type scales, or per-component type
  systems.
- Do not use viewport-fluid typography in operational UI chrome.
- Operational UI tracking defaults to `0`.
- Any non-zero operational UI tracking belongs to an explicit Dieter visual text
  class decided by the human, not a copied local component value.
- Do not style raw `h1` through `h6` globally in Dieter typography source.
- Visual classes such as `.heading-1` through `.heading-6` are visual text
  styles only. They are not semantic hierarchy, not content structure, and not a
  separate heading system.
- A surface may combine semantic HTML and explicit visual class, for example
  `<h2 class="heading-3">`, when document hierarchy and visual scale differ.

Compliance reason: agents must choose explicit visual roles. Raw heading
selectors create invisible styling and let agents get design behavior without
declaring intent.

## Utility Class Contract

Target law:

- Dieter typography utilities cover text mechanics only: family, size, weight,
  line-height, text transform, and declared role-level tracking.
- Dieter typography utilities do not own color semantics.
- Display classes may remain as explicit Dieter visual text classes for
  product surfaces that actually need display-sized type. They are not a license
  to create marketing-hero typography in operational UI.
- Body, heading, label, caption, and overline classes are visual text styles.
- Old utility names and old consumers are removed from active source/docs once
  execution updates the standard names.

Compliance reason: this respects 126B and keeps typography from becoming a
hidden color system or a content hierarchy engine.

## Public Widget Runtime Typography

Public-widget typography is content typography, not operational chrome
typography.

Target law:

- Bob authors widget typography through structured role config.
- Widget runtime validates typography config and emits `--typo-*` variables.
- Runtime-applied roles and Bob editor roles must be the same product contract
  where they overlap.
- Stored custom values are product truth only when runtime applies them.
- Widget content roles may use container-query fluid sizing because widgets run
  inside variable embed containers.
- Widget content may use role scales, custom sizes, style, weight,
  user-authored colors, tracking presets, line-height presets, script
  fallbacks, and locale/script-specific line-height behavior.
- Widget typography may carry user-authored content color because widget content
  is account/user-authored; Clickeen chrome color remains 126B/component-owned.

Compliance reason: Clickeen serves account-owned public content. Widget
typography must preserve brand/content freedom while staying structured and
runtime-compatible.

## Account Font Library Law

The system uses Google Fonts and account-uploaded custom fonts.

Target law:

- Inter is always present in every account font library.
- Accounts cannot remove Inter.
- Account font library Inter is the required widget/content baseline. It is not
  the same authority as operational UI `--font-ui`, which may use the Dieter
  `Inter Tight, Inter, system-ui, sans-serif` stack for dense Clickeen chrome.
- Every account has one widget typography font library:
  Inter baseline + account-selected Google Fonts + account-uploaded custom
  fonts.
- Google Fonts are loaded from Google's font delivery path.
- Account-uploaded custom fonts are account assets under
  `accounts/{accountPublicId}/assets/{filename}`.
- Uploaded custom fonts are served by Clickeen through the account asset CDN
  path. Customers do not need to host custom font files on their own websites.
- The admin account is an account like all others. Custom fonts uploaded by the
  admin account are admin-account assets under `accounts/CLICKEEN/assets/...`;
  they are not global product fonts by being owned by the admin account.
- Bob presents one account font library in the widget typography panel. The UX
  is one smooth picker, not confusing product categories.
- Runtime loading preserves source authority underneath: Google Fonts from
  Google, uploaded fonts from Clickeen account asset URLs.
- The fixed `source: 'tokyo'` / `/fonts/special/*` custom-font path is not the
  target product model. Current Frari, Giudecca, Marin, Orio, Pachuka,
  Pachuka Line, and Rialto availability is treated as intended admin-account
  custom font availability in the target model. Execution migrates those font
  bytes to the normal `CLICKEEN` account asset authority before removing the
  fixed product-font path from active source.
- `--font-display` must not remain referenced. Execution target is no active
  `--font-display` references unless the human explicitly creates that token as
  product law in a later PRD.

Compliance reason: this is the actual Clickeen moat for typography. Customers
get Google Fonts and uploaded custom fonts in one portable widget font library,
while Clickeen owns CDN serving for uploaded font files and preserves account
asset source truth.

## Account Font Library Data Contract

126D does not create a font service or global font registry. Account font
library metadata extends the existing account widget defaults document:

```text
accounts/{accountPublicId}/widget-defaults.json
```

Target document addition:

```text
fontLibrary: {
  version: 1,
  fonts: {
    [family]: {
      label,
      source,
      category,
      familyClass,
      usage,
      weights,
      styles,
      locked?,
      spec?,
      assetRef?,
      contentType?
    }
  }
}
```

Field law:

- The `family` object key is the CSS family value saved in
  `typography.globalFamily` and `typography.roles.*.family`.
- `label` is the user-facing picker label.
- `source` is exactly `google` or `account-asset`.
- `category` is exactly `sans`, `serif`, `display`, `script`, or
  `handwritten`. It is picker grouping, not runtime fallback behavior.
- `familyClass` is exactly `sans` or `serif`. It is the runtime fallback
  class used by widget typography.
- `usage` is exactly `body-safe` or `heading-only`.
- `weights` contains only string weights `100`, `200`, `300`, `400`, `500`,
  `600`, `700`, `800`, or `900`.
- `styles` contains only `normal` or `italic`.
- Google font records carry `spec`; they do not carry a Clickeen asset
  reference.
- Uploaded font records carry `assetRef` and `contentType`; they do not persist
  a public CDN URL or root `/fonts/**` URL.
- Inter is present as a locked `google` record in every account font library.
- Current system Google font choices become account-selected Google font
  records in this same `fontLibrary.fonts` map. Future account customization
  adds/removes Google records here, except Inter.
- Current Frari, Giudecca, Marin, Orio, Pachuka, Pachuka Line, and Rialto
  records become `account-asset` records only for the `CLICKEEN` account unless
  product-data inventory proves another account currently owns a saved use that
  must be explicitly migrated.

This metadata is account product data. It is not a shell control, not a
per-widget visual field, and not a new subsystem.

Malformed enum values fail account widget-defaults validation. They are not
normalized, guessed, or mapped to "close enough" values.

Compliance reason: Bob, runtime materialization, and docs get one existing
account authority for font choices, while uploaded font bytes stay under the
account asset authority.

## Font Upload Allowlist

Execution must add exact font upload acceptance to the existing account asset
route. Do not accept a broad `font/*` prefix.

Allowed font pairs:

- `.woff2` with `font/woff2`.
- `.woff` with `font/woff`, `application/font-woff`, or
  `application/x-font-woff`.
- `.ttf` with `font/ttf` or `application/x-font-ttf`.
- `.otf` with `font/otf` or `application/x-font-otf`.

SVG fonts, CSS files, JavaScript, HTML, XML, WASM, and executable/scriptable
extensions remain rejected. Missing MIME remains rejected.

Compliance reason: uploaded fonts become account assets without turning upload
validation into a fail-open file bucket.

## Bob Authoring And Runtime Delivery

Bob opens through Roma, and Roma is the current-account authority. Execution
must make Roma include the account font library in the `ck:open-editor` payload
from the existing account widget defaults authority, or make Bob fetch it
through an existing Roma-hosted account command. Pick the narrowest code path
that preserves this authority chain:

```text
Roma current account -> account widget defaults -> Bob session -> typography panel
```

Bob target behavior:

- The Typography panel font picker uses the account font library, not
  `CK_TYPOGRAPHY_FONT_META` as final source truth.
- Inter is always available; the picker is never empty when account data is
  valid.
- If the account font library is missing, malformed, or unavailable, Bob open
  fails explicitly. It does not show an empty picker or silently rebuild a
  static library.
- `typography.globalFamily` remains session state synchronized with visible
  role families. It is not a separate user-facing category.
- Role labels shown in Bob must match the widget role semantics supplied by the
  widget/compiler. Generic labels such as "Subtitle" or "Eyebrow" must not be
  shown when the active widget role means something else.

Runtime/materialization target behavior:

- Save/package materialization reads the account font library and the saved
  widget typography state together.
- The package/runtime data includes only the font records needed by the saved
  instance plus Inter. Bob preview may use the full account library for editing.
- Google font records load from Google using the stored Google spec.
- Account-asset font records are resolved through account asset authority and
  materialized for runtime with a public account asset URL. The persisted
  account font record still stores `assetRef`, not a CDN URL.
- Uploaded font runtime emits `@font-face` from the resolved account asset URL
  and the record's declared family, weights, styles, and content type.
- Unknown saved font family, missing account font record, or missing account
  font asset is a save/materialization failure. It is not silently replaced by
  Inter.
- Already published packages may continue to render browser fallback if an
  account later deletes a font asset, but Clickeen runtime must not rewrite the
  saved typography state as if it were valid.

Compliance reason: authoring and runtime share the same account font authority,
which prevents Bob from offering fonts that public widgets cannot load.

## Font Migration And Deploy Sequence

Font migration is cross-system product-data work. Execution order is binding:

1. Add source support for `assetType: "font"`, exact font MIME/extension
   acceptance, account font library metadata, Bob account-font consumption, and
   runtime account-font materialization.
2. Deploy the font-capable account asset/runtime path through the normal
   Cloudflare/Git path before moving existing font bytes. This is migration
   sequencing, not a compatibility lane.
3. Inventory source, account widget defaults, saved account instances, generated
   public packages, and R2 package bytes for the seven current special font
   families and for `/fonts/special/*` or root `/fonts/**` references.
4. Migrate current `CLICKEEN` special font bytes through Roma/Tokyo-worker
   account asset authority into `accounts/CLICKEEN/assets/...`.
5. If inventory finds non-`CLICKEEN` accounts or published packages using the
   special families, do not silently drop them. Execution must either migrate
   those account uses by explicit product-data authority or stop before route
   removal with the exact account/package evidence.
6. Rematerialize any affected public packages so runtime font data points to
   account asset URLs.
7. Remove `source: 'tokyo'`, `/fonts/special/*`, root `/fonts/**`
   Tokyo-worker route/proxy/config/docs, and special font files from active
   source after migration and package evidence are green.

Final green state has no active `/fonts/special/*` source, no root font route
kept as a guard, and no docs describing root product fonts as current.

Compliance reason: the sequence avoids V3/V6/V7 without preserving the old font
path as a permanent concept.

## Widget Fallback Baseline

Replacing undefined `--font-display` references with `var(--font-ui)` is a
static CSS fallback only. It means "no widget typography variable has been
applied yet, so render with the system UI baseline."

It must not be used to hide runtime failure. If `CKTypography.applyTypography`
or required account font data is missing, runtime/editor behavior must fail
through the owning path instead of pretending the fallback is valid saved
typography.

Compliance reason: undefined CSS token cleanup does not become silent healing
of invalid product state.

## Bob Typography Editor

Target law:

- Bob shell chrome uses Dieter operational UI typography.
- Bob widget editor controls author widget content typography.
- Bob's typography panel presents the account font library.
- Bob must not show font, role, or field choices that runtime ignores.
- Bob saved widget typography must match `CKTypography.applyTypography`
  behavior.
- Bob's current 14 role candidates and controls are execution evidence, not a
  separate typography authority.

Compliance reason: Bob is an agent-operable schema surface. Its fields must
line up with runtime truth or agents and users operate false state.

## Roma, Admin, And DevStudio

Target law:

- Roma consumes Dieter operational UI typography.
- Admin consumes Dieter operational UI typography.
- DevStudio reveals Dieter typography preview/editor state only to the extent
  it can actually govern it.
- DevStudio preview data is visibility evidence, not typography behavior
  authority.
- DevStudio must not present partial token editing as if it were the full
  typography system.

Compliance reason: this keeps operational surfaces tied to owner files and
avoids a fake design-token console.

## Detailed Execution Blast Radius

Execution must use `audits/126D__Audit__Typography.md` as the binding
file-level audit. The table below is the allowed 126D blast radius. It is not a
permission to redesign typography; it is the exact scope needed to make the
current codebase match this PRD.

| Area | Paths | Execution concern |
| --- | --- | --- |
| Dieter source typography | `dieter/tokens/dieter-typography.css` | Remove raw `h1`-`h6` selectors; keep `.heading-1`-`.heading-6`; remove `.body-small` and `.body-large`; remove typography-owned `color:` from `.label-*`, `.caption*`, `.overline*`. |
| Generated Dieter typography output | `tokyo/product/dieter/tokens/dieter-typography.css`, `tokyo/product/dieter/tokens/dieter-typography.shadow.css` | Regenerate only from Dieter source. No hand edits. |
| Generated count governance | `scripts/dieter/governance-guards.mjs` | Reconcile the locked generated typography count after source class cleanup; the count must reflect current source truth. |
| DevStudio typography generation | `admin/scripts/generate-typography-json.cjs`, `admin/src/data/typography.generated.json`, `admin/src/data/typography.ts`, `admin/src/main.ts`, `admin/functions/_shared/dieter-tokens.js`, `admin/src/css/dieter-previews.css` | Reveal/write must remain honest; generated preview rows come from current visual classes only; remove undefined `--font-body-xsmall`; partial token editing must not masquerade as full typography authority. |
| Admin component example generation | `admin/src/data/componentRenderer.ts`, `admin/src/html/components/**` | Replace generated `body-xsmall` spec-line class with current `body-xs`; regenerate component HTML. |
| Dieter component stale class cleanup | `dieter/components/textedit/textedit.html`, `dieter/components/textedit/textedit-dom.ts`, `dieter/components/dropdown-edit/dropdown-edit.html`, `dieter/components/textrename/textrename.css` | Replace `body-xsmall` with `body-xs`, `label-small` with `label-s`, and remove comments that preserve removed class names. |
| Dieter component tracking cleanup | `dieter/components/button/button.css`, `dieter/components/textfield/textfield.css`, `dieter/components/valuefield/valuefield.css`, `dieter/components/textrename/textrename.css` | Local non-zero tracking must either move to explicit Dieter visual text classes or be removed. No component-local copied tracking values. |
| Generated Dieter component output | `tokyo/product/dieter/components/**` | Regenerate from Dieter component source after source fixes. |
| Bob shell typography | `bob/app/bob_app.css` | Replace `.settings-panel__code code` hardcoded mono stack with `var(--font-mono)`. |
| Account font library document | `roma/lib/account-widget-defaults-direct.ts`, `roma/lib/account-widget-defaults-contract.ts`, `roma/lib/account-widget-defaults-materialization.ts`, `roma/components/widget-defaults-domain.tsx`, `roma/app/api/account/widget-defaults/route.ts`, `tokyo-worker/src/domains/account-widget-defaults.ts`, `tokyo-worker/src/routes/internal-widget-default-routes.ts` | Extend the existing account widget defaults authority with top-level `fontLibrary` metadata through both Roma and Tokyo-worker storage ownership. Do not put font library under shell controls or create a new font service. |
| Bob open/session font payload | `roma/components/builder-domain.tsx`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/useSessionBoot.ts`, `bob/lib/session/WidgetDocumentSession.tsx` | Carry the account font library from Roma/current account into Bob session or through an existing Roma account command. Missing/malformed font library fails open-editor explicitly. |
| Bob widget typography authoring | `bob/lib/edit/typography-fonts.ts`, `bob/lib/compiler/modules/typography.ts`, `bob/components/td-menu-content/linkedOps.ts`, `bob/components/td-menu-content/useTdMenuBindings.ts` | Remove `source: 'tokyo'` / `/fonts/special/*`; font options come from account font library; controls remain aligned with runtime-applied fields; role labels must match widget semantics. |
| Widget shell contract | `packages/widget-shell/src/defaults.ts`, `packages/widget-shell/src/contract.ts`, `packages/widget-shell/src/controls.ts` | Defaults/controls/schema must not imply custom values are active unless their preset is `custom`; shell paths must map to runtime apply behavior. |
| Runtime package materialization | `roma/lib/account-instance-public-package.ts`, `roma/lib/account-instance-locale-package.ts`, `packages/ck-runtime-materializer/src/**` | Materialized packages must include account font runtime data for saved typography families and fail when referenced account font data/assets are missing. |
| Widget runtime typography | `tokyo/product/widgets/shared/typography.js`, `tokyo/product/widgets/shared/typography-data.js`, `packages/widget-shell/src/modules.ts` | Remove Tokyo special-font source logic; preserve Google Fonts loading and script fallback; uploaded fonts resolve through account asset URLs; package data replaces static special-font data. |
| Widget CSS consumers | `tokyo/product/widgets/cards/widget.css`, `tokyo/product/widgets/big-bang/widget.css` | Replace undefined `--font-display` fallback with defined `var(--font-ui)` fallback. |
| Widget specs/runtime invalid class cleanup | `tokyo/product/widgets/faq/spec.json` | Replace `body-xsmall` with current `body-xs` where widget editor specs embed Dieter component classes. |
| Special font product files | `tokyo/product/fonts/special/Frari.woff2`, `tokyo/product/fonts/special/Giudecca.woff`, `tokyo/product/fonts/special/Marin.woff`, `tokyo/product/fonts/special/Orio.woff`, `tokyo/product/fonts/special/Pachuka.woff2`, `tokyo/product/fonts/special/Pachuka_line.woff2`, `tokyo/product/fonts/special/Rialto.woff2` | Migrate bytes to `accounts/CLICKEEN/assets/...` through account asset authority, then remove these stale product-font files from active source. |
| Account asset font support | `tokyo-worker/src/domains/assets-handlers.ts`, `tokyo-worker/src/asset-utils.ts`, `tokyo-worker/src/domains/assets.ts`, `roma/app/api/account/assets/upload/route.ts`, `roma/components/assets-domain.tsx`, `dieter/components/shared/account-assets.ts`, `roma/lib/account-asset-record.ts` | Account assets must accept/list/resolve uploaded fonts as normal account assets with truthful `assetType: "font"` metadata and the exact MIME/extension allowlist in this PRD; no separate font asset subsystem. |
| Root font route/proxy cleanup | `tokyo-worker/src/routes/asset-routes.ts`, `tokyo-worker/src/asset-utils.ts`, `tokyo-worker/wrangler.toml`, `bob/app/fonts/[...path]/route.ts`, `bob/lib/tokyo-static-proxy.ts` | Remove `/fonts/special/*` and broader root `/fonts/**` route/proxy/config/docs after source + R2/package/account-instance inventory and migration are green; do not keep a guard for the deleted special-font concept. |
| Roma typography consumers | `roma/components/team-domain.tsx`, `roma/components/team-member-domain.tsx`, `roma/components/accept-invite-domain.tsx` | Replace `heading-h3` / `heading-h4` with current `heading-3` / `heading-4`. |
| Prague typography consumers | `prague/src/pages/[market]/[locale]/create/index.astro`, `prague/src/pages/[market]/[locale]/index.astro`, `prague/src/pages/[market]/[locale]/privacy/index.astro` | Replace local page font stack/inline sizes with Dieter classes/tokens in create page; remove duplicate inline heading tracking from index/privacy pages. |
| Prague tracking inventory | `prague/src/blocks/site/nav/Nav.astro`, `prague/src/blocks/split/split.astro`, `prague/src/blocks/split-carousel/SplitCarousel.astro`, `prague/public/styles/primitives.css` | Named for blast-radius awareness only; leave to Prague/surface execution unless 126D creates a direct Dieter tracking token replacement. |
| Documentation | `documentation/engineering/UI/typography.md`, `documentation/engineering/UI/dieter.md`, `documentation/architecture/AssetManagement.md`, `documentation/services/bob.md`, `documentation/services/tokyo-worker.md`, `documentation/engineering/CloudflareOperations.md`, `documentation/widgets/shared/ShellCore.md`, `documentation/widgets/shared/ShellUtilities.md`, `documentation/widgets/authoring/ToolDrawerControls.md`, `documentation/widgets/widgets/*.md` | Living docs must state the two lanes, account font library, account asset/CDN font serving, exact author/runtime ownership, and must not describe removed patterns as current. |

Known documentation repairs:

- `documentation/engineering/UI/typography.md` must cover both typography lanes:
  Dieter operational UI typography and public-widget runtime content
  typography.
- `documentation/engineering/UI/typography.md` must document the account font
  library: Inter baseline, account-selected Google Fonts, and account-uploaded
  custom fonts served through Clickeen account asset CDN URLs.
- `documentation/engineering/UI/typography.md` must document the
  `fontLibrary` record shape in account widget defaults and state that public
  URLs are materialized runtime data, not persisted account font source truth.
- `documentation/engineering/UI/typography.md` must state the Inter/Inter Tight
  distinction: widget/content baseline Inter is required in every account font
  library; operational UI `--font-ui` is the Dieter chrome stack.
- `documentation/engineering/UI/typography.md` must cover current
  `CKTypography` behavior, `--font-display` cleanup, and the viewport-fluid
  versus container-query-fluid split.
- `documentation/architecture/AssetManagement.md` must state that uploaded
  fonts are account assets, including accepted font MIME/extensions,
  `assetType: "font"`, admin account `CLICKEEN`, and account asset CDN
  delivery.
- `documentation/services/bob.md` must state that Roma supplies account font
  library data to Bob and Bob must fail open-editor if account font data is
  missing or malformed.
- `documentation/services/tokyo-worker.md` and
  `documentation/engineering/CloudflareOperations.md` must document final root
  font route removal if `/fonts/**` is deleted from Worker routing/config.
- `documentation/widgets/shared/ShellCore.md` and
  `documentation/widgets/shared/ShellUtilities.md` must document widget runtime
  typography as `CKTypography` behavior, not Dieter chrome typography.
- Removed paths and class names must not remain documented as current behavior.

## Execution Gap Targets

126D execution must complete these source/doc changes:

- Remove raw `h1` through `h6` visual styling from Dieter typography source.
- Keep visual heading classes only as explicit visual text classes.
- Replace current consumers of stale visual heading names with current visual
  class names.
- Remove typography-owned color from Dieter label/caption/overline utility
  classes or route the color to the consuming component/context/widget content
  authority.
- Remove active `--font-display` references.
- Replace Bob local monospace/font-stack bypasses with `--font-mono` /
  `--font-ui`.
- Remove current fixed `source: 'tokyo'` custom font records from Bob and
  widget runtime font data.
- Add account font library metadata to the existing account widget defaults
  document as top-level account metadata.
- Migrate intended admin-account font availability to `accounts/CLICKEEN/assets`
  through the account asset authority.
- Add account asset support for uploaded font files and truthful
  `assetType: "font"` metadata using the exact font MIME/extension allowlist in
  this PRD.
- Align Bob font selection, saved widget typography, widget-shell defaults, and
  widget runtime loading.
- Ensure account-uploaded fonts resolve through Clickeen account asset CDN
  serving in public widgets.
- Inventory saved account instances, account widget defaults, public packages,
  and R2 package bytes before deleting root font routes.
- Update living docs listed in the blast-radius table.

## Product Data Authority For Font Migration

Current special font files are intended admin-account custom font availability
in the target model. Migrating them is product data work as well as code/doc
work.

Authority chain:

```text
Roma current account -> accountPublicId CLICKEEN -> Roma account asset route -> Tokyo-worker -> accounts/CLICKEEN/assets/{filename}
```

Verification:

- Account asset font upload support is deployed before migration starts.
- Roma account asset route or Assets UI shows the font assets for `CLICKEEN`.
- R2 evidence confirms bytes/metadata under `accounts/CLICKEEN/assets/...`
  after `pnpm cf:preflight`.
- Cloudflare API/route verification passes after `pnpm cf:api:preflight` when
  the root `/fonts/**` route/config is removed.
- GitHub Actions/Cloudflare evidence confirms the Worker deploy that contains
  the final font route state.
- Account widget defaults, saved account instances, generated public packages,
  and R2 package bytes are inventoried for the seven special font families and
  for `/fonts/special/*` or root `/fonts/**` references before route removal.
- Public widget runtime uses account asset URLs, not root product-font URLs.

Compliance reason: the admin account is not a special global asset class.

## Source Research Bar

Current official-source input:

- Material 3 treats typography as semantic roles and publishes type-scale token
  pairings.
- Apple treats typography as platform text styles with legibility, leading,
  system fonts, and locale-aware behavior.
- OpenAI Apps SDK guidance expects hosted UI to inherit system-compatible text
  behavior, remain resize-safe, and fit host surface constraints.

Converged implication:

- Clickeen evaluates typography as explicit roles with readable,
  resize-safe, locale-aware behavior.
- The official sources are north stars, not copy/paste token tables.
- Clickeen does not import M3/Apple/OpenAI typography scales wholesale.
- OpenAI-hosted constraints matter only for surfaces actually hosted inside
  OpenAI surfaces.

Compliance reason: this uses original-source research through Clickeen product
authority instead of replacing Clickeen with another company's type system.

## V1-V8 Pre-Execution Controls

| ID | 126D risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Undefined `--font-display` or fake font fallback substitutes an invented font truth. | Remove active `--font-display` references; account font records are explicit product data, not inferred from static maps. |
| V2 Silent healing | Runtime coerces invalid font config into a different persisted font without surfacing failure. | Preserve runtime validation semantics; do not normalize stored user typography into false success. |
| V3 Silent omission | Removing fixed font paths drops intended admin-account font availability or published package references. | Deploy font asset support, inventory source/product data/R2 packages, migrate intended fonts, rematerialize affected packages, then remove old source path. |
| V4 Fail-open control | Missing font/source data falls back to unowned typography behavior. | Missing account font library/record/asset fails Bob open or save/materialization explicitly; upload acceptance uses exact MIME/extension pairs. |
| V5 Corruption-as-absence | Bad stored typography becomes treated as empty/default and overwritten. | Do not rewrite persisted typography state as part of code cleanup. |
| V6 Partial-success masquerade | Bob shows fields/fonts/runtime roles that public widgets ignore. | Bob font picker, saved typography, account font library, package data, and runtime apply path must agree. |
| V7 Masquerade/redress | `/fonts/special/*` remains while being renamed "account fonts." | Migrate to account assets, then remove the old source path; do not keep it under a new label. |
| V8 Runtime test dependency | Normal font behavior depends on validation scripts/check rituals. | Fix source/docs/runtime authority; checks only verify execution. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- `pnpm build:dieter`
- Regenerate/verify DevStudio typography data if affected.
- Search Dieter typography source for raw global `h1` through `h6` visual
  styling.
- Search repo for stale visual heading class consumers targeted by the PRD.
- Search repo for removed typography utility names: `body-xsmall`,
  `label-small`, `body-small`, and `body-large`.
- Search repo for active `--font-display` references.
- Search repo for active `source: 'tokyo'` and `/fonts/special/*` references.
- Search Bob/Admin/Roma operational UI for local mono/font-stack bypasses
  touched by the blast radius.
- Search Dieter components for local non-zero `letter-spacing` values targeted
  by this PRD.
- Verify Bob font options are sourced from the account font library model.
- Verify widget runtime font loading uses Google Fonts or account asset URLs as
  appropriate.
- Verify migrated font assets through Roma/Tokyo-worker/R2 account asset
  authority.
- Run `pnpm cf:preflight` before R2 font migration/verification.
- Run `pnpm cf:api:preflight` before Cloudflare route/config verification.
- Verify Worker deploy evidence when Tokyo-worker route/config changes.
- Inventory account widget defaults, saved account instances, public packages,
  and R2 package bytes for special font family/root path references before
  root font route removal.
- Update docs listed in the blast-radius table.

## Out Of Scope

- No universal typography engine.
- No generic text component framework.
- No dark-mode typography work.
- No color doctrine beyond the 126B boundary.
- No compatibility shim for old font paths.
- No compatibility aliases for old typography utility names.
- No root font route guard for `/fonts/special/*` after that path is removed.
- No broad redesign of Bob/Roma/DevStudio typography UI.

## GLM Input Integrated

GLM's independent as-built and research passes are integrated into the
standard above. The high-signal findings are:

- Dieter has no tracking token layer and currently inlines letter-spacing in
  utility classes.
- Dieter fluid display is viewport-clamp; widget runtime fluid type is
  container-query clamp.
- Typography utilities currently carry some color behavior.
- Widget typography runtime is richer than the Dieter typography doc currently
  explains.
- `--font-display` is referenced but not defined.
- Dieter source and generated Tokyo Dieter output duplicate because generated
  output mirrors source.
- Bob editor role coverage, widget-shell defaults, and runtime-applied custom
  fields are not fully aligned.

Final product law: Dieter operational UI typography and widget runtime content
typography are separate authorities, and each must be deterministic inside its
own lane.
