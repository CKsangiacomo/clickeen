# 126D - PRD: Typography

Status: PRE-EXECUTION STEP 7 COMPLETE - current-source audit and final executable plan recorded; Step 8 exact-tree review pending; no Step-9 execution credit.
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

Current remaining typography gaps:

- Dieter operational UI and widget runtime typography are both real, but their
  ownership boundaries are underdocumented.
- Dieter has no tracking token layer; tracking appears as utility-local values.
- Dieter utility classes currently carry some color behavior that belongs to
  126B/component context/widget content authority.
- Public widgets have richer typography mechanics than the public Dieter doc
  explains: tracking presets, line-height presets, container-query fluid sizing,
  script fallback, and locale/script-aware line-height behavior.
- Bob editor fields, widget-shell defaults, and runtime-applied fields do not
  fully line up.

The account-font architecture is current and closed: `fontLibrary` and normal
account assets represent fonts; Bob and materialization consume that authority;
the former Tokyo special-font records, active `--font-display` references, and
root `/fonts/**` route are absent. Authenticated Roma evidence confirms all
seven custom fonts as `CLICKEEN` account assets, and public runtime evidence
confirms Orio and Pachuka Line load through account-asset URLs. Living docs
describe this current architecture.

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
- Frari, Giudecca, Marin, Orio, Pachuka, Pachuka Line, and Rialto are normal
  `CLICKEEN` account assets. The former fixed product-font path is absent.
- `--font-display` has no active reference and must not be restored unless the
  human explicitly creates that token as product law in a later PRD.

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

Current document contract:

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
- Current Google and `CLICKEEN` account-asset records coexist in this
  `fontLibrary.fonts` map. Future account customization adds/removes Google
  records here, except Inter. Authenticated product evidence confirms the seven
  custom fonts belong to `CLICKEEN`.

This metadata is account product data. It is not a shell control, not a
per-widget visual field, and not a new subsystem.

Malformed enum values fail account widget-defaults validation. They are not
normalized, guessed, or mapped to "close enough" values.

Compliance reason: Bob, runtime materialization, and docs get one existing
account authority for font choices, while uploaded font bytes stay under the
account asset authority.

## Font Upload Allowlist

Existing account-asset upload validation accepts only the exact font pairs
below. It does not accept a broad `font/*` prefix.

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

Bob opens through Roma, and Roma is the current-account authority. Current
source carries the account font library into the Bob session through this
authority chain:

```text
Roma current account -> account widget defaults -> Bob session -> typography panel
```

Current Bob behavior:

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

Current runtime/materialization behavior:

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

## Font Migration Closure

Font support, account-library wiring, asset migration, package materialization,
old-route removal, and public runtime delivery are complete. Authenticated Roma
and public-runtime evidence is recorded in `126_DevQA.md`. No remote font
migration remains. The seven untracked local copies under
`tokyo/product/fonts/special/` are non-deployed residue for step-9 deletion only.

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

The table below reconciles the historical 126D blast radius with current
source. Closed rows remain regression evidence. Step 9 is limited to the
current-source compiler/session font-authority defect and widget-role label
ownership proven by Step 6. It must not reopen completed typography or font
migration work.

| Area | Paths | Execution concern |
| --- | --- | --- |
| Dieter source typography | `dieter/tokens/dieter-typography.css` | Verified current: raw heading selectors, removed body aliases, and typography-owned label/caption/overline colors are absent; current visual classes remain. |
| Generated Dieter typography output | `tokyo/product/dieter/tokens/dieter-typography.css`, `tokyo/product/dieter/tokens/dieter-typography.shadow.css` | Verified current: generated only from Dieter source; no hand-edit lane. |
| Generated count governance | `scripts/dieter/governance-guards.mjs` | Verified current: locked generated count reflects current source truth. |
| DevStudio typography generation | `admin/scripts/generate-typography-json.cjs`, `admin/src/data/typography.generated.json`, `admin/src/data/typography.ts`, `admin/src/main.ts`, `admin/functions/_shared/dieter-tokens.js`, `admin/src/css/dieter-previews.css` | Verified current: reveal/write is bounded to real authority, preview rows use current classes, and `--font-body-xsmall` is absent. |
| Admin component example generation | `admin/src/data/componentRenderer.ts`, `admin/src/html/components/**` | Verified current: generated examples use `body-xs`. |
| Dieter component stale class cleanup | `dieter/components/textedit/textedit.html`, `dieter/components/textedit/textedit-dom.ts`, `dieter/components/dropdown-edit/dropdown-edit.html`, `dieter/components/textrename/textrename.css` | Verified current: removed `body-xsmall`/`label-small` names and preserving comments are absent. |
| Dieter component tracking cleanup | `dieter/components/button/button.css`, `dieter/components/textfield/textfield.css`, `dieter/components/valuefield/valuefield.css`, `dieter/components/textrename/textrename.css` | Verified current: component-local copied tracking values are absent. |
| Generated Dieter component output | `tokyo/product/dieter/components/**` | Verified current: output reflects Dieter component source. |
| Bob shell typography | `bob/app/bob_app.css` | Verified current: the code block uses `var(--font-mono)`. |
| Account font library document | `roma/lib/account-widget-defaults-direct.ts`, `roma/lib/account-widget-defaults-contract.ts`, `roma/lib/account-widget-defaults-materialization.ts`, `roma/components/widget-defaults-domain.tsx`, `roma/app/api/account/widget-defaults/route.ts`, `tokyo-worker/src/domains/account-widget-defaults.ts`, `tokyo-worker/src/routes/internal-widget-default-routes.ts` | Verified current: top-level `fontLibrary` flows through the existing account widget-defaults authority. |
| Bob open/session font payload | `roma/components/builder-domain.tsx`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/useSessionBoot.ts`, `bob/lib/session/WidgetDocumentSession.tsx` | Verified current: Bob receives the account font library and rejects missing/malformed data. |
| Bob widget typography authoring | `bob/lib/edit/typography-fonts.ts`, `bob/lib/compiler/{controls,editor-contract}.ts`, `bob/lib/compiler/modules/typography.ts`, `bob/lib/session/{sessionConfig,sessionTypes,useSessionBoot,useSessionEditing,useSessionSaving,WidgetDocumentSession}.ts*`, `bob/components/{CopilotPane,TdMenuContent,ToolDrawer}.tsx`, `bob/components/td-menu-content/{accountFonts,linkedOps,useTdMenuBindings}.ts`, `bob/lib/control-host.ts` | Step-6 defect: visible account fonts and fixed compiler/session validation disagree; family transitions, Copilot labels, and mapped rejection copy are incomplete. Bind one account contract and one explicit transition operation to all Bob edit paths. |
| Roma Widget Defaults typography | `roma/components/widget-defaults-{builder-controls,domain}.tsx`, `roma/lib/account-widget-defaults-contract.ts`, `roma/app/api/account/widget-defaults/route.ts` | Step-8 defect: Roma is a second account-bound editor host and currently lacks relational account-font validation. Use the same resolver/validator for shell and widget core on edit, GET, and PUT. |
| Dieter family intent | `dieter/components/dropdown-actions/dropdown-actions.ts`, `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.js` | Step-8 defect: Dieter currently owns companion selection and emits three ops. Reduce it to raw family intent; host/product contract owns transition semantics. |
| Widget shell contract | `packages/widget-shell/src/defaults.ts`, `packages/widget-shell/src/contract.ts`, `packages/widget-shell/src/{controls,font-library}.ts` | Defaults/controls/schema must not imply custom values are active unless their preset is `custom`; shell role labels and account-font relation law have one shared owner. |
| Runtime package materialization | `roma/lib/account-instance-public-package.ts`, `roma/lib/account-instance-locale-package.ts`, `packages/ck-runtime-materializer/src/**` | Step-8 defect: package creation checks family/asset presence but not each role's allowed weight/style. Run the shared relational validator before asset resolution/materialization so direct/replayed saves fail before Tokyo write. |
| Widget runtime typography | `tokyo/product/widgets/shared/typography.js`, `tokyo/product/widgets/shared/typography-data.js`, `packages/widget-shell/src/modules.ts`, `scripts/widgets/compile-all.ts`, `tokyo/product/widgets/*/widget.client.js` | Google and account-asset font authorities and current runtime behavior stay unchanged. Step 9 makes widget validation compare each actual client role map with its composed spec roles. |
| Widget CSS consumers | `tokyo/product/widgets/cards/widget.css`, `tokyo/product/widgets/big-bang/widget.css` | Verified current: no active `--font-display` fallback remains. |
| Widget specs/runtime invalid class cleanup | `tokyo/product/widgets/faq/spec.json` | Verified current: embedded editor classes use `body-xs`. |
| Local special-font residue | untracked `tokyo/product/fonts/special/*` files | The seven account assets are proven current. These files are non-deployed workspace residue, not a Git execution slice or product-data task. Leave them outside Step-9 credit. |
| Account asset font support | `tokyo-worker/src/domains/assets-handlers.ts`, `tokyo-worker/src/asset-utils.ts`, `tokyo-worker/src/domains/assets.ts`, `roma/app/api/account/assets/upload/route.ts`, `roma/components/assets-domain.tsx`, `dieter/components/shared/account-assets.ts`, `roma/lib/account-asset-record.ts` | Verified current: normal account assets accept/list/resolve fonts with truthful metadata and the exact allowlist. |
| Root font route/proxy cleanup | `tokyo-worker/src/routes/asset-routes.ts`, `tokyo-worker/src/asset-utils.ts`, `tokyo-worker/wrangler.toml`, `bob/lib/tokyo-static-proxy.ts` | Verified current: no root product-font route/proxy/config remains. |
| Roma typography consumers | `roma/components/team-domain.tsx`, `roma/components/team-member-domain.tsx`, `roma/components/accept-invite-domain.tsx` | Verified current: consumers use `heading-3` / `heading-4`. |
| Prague typography consumers | `prague/src/pages/[market]/[locale]/create/index.astro`, `prague/src/pages/[market]/[locale]/index.astro`, `prague/src/pages/[market]/[locale]/privacy/index.astro` | Verified current: pages use Dieter classes/tokens and duplicate inline heading tracking is absent. |
| Prague tracking inventory | `prague/src/blocks/site/nav/Nav.astro`, `prague/src/blocks/split/split.astro`, `prague/src/blocks/split-carousel/SplitCarousel.astro`, `prague/public/styles/primitives.css` | Named for blast-radius awareness only; leave to Prague/surface execution unless 126D creates a direct Dieter tracking token replacement. |
| Documentation | `documentation/engineering/UI/{typography,dieter}.md`, `documentation/architecture/AssetManagement.md`, `documentation/services/{bob,roma,tokyo-worker}.md`, `documentation/engineering/CloudflareOperations.md`, `documentation/widgets/shared/{ShellCore,ShellUtilities}.md`, `documentation/widgets/authoring/ToolDrawerControls.md`, `documentation/widgets/widgets/*.md` | Living docs must state the two lanes, account font library, account asset/CDN font serving, intent/operation ownership, both editor hosts, and exact author/runtime ownership. |

Current documentation reconciliation:

- `documentation/engineering/UI/typography.md` now covers both typography lanes:
  Dieter operational UI typography and public-widget runtime content
  typography.
- It documents the account font
  library: Inter baseline, account-selected Google Fonts, and account-uploaded
  custom fonts served through Clickeen account asset CDN URLs.
- It documents the
  `fontLibrary` record shape in account widget defaults and state that public
  URLs are materialized runtime data, not persisted account font source truth.
- It states the Inter/Inter Tight
  distinction: widget/content baseline Inter is required in every account font
  library; operational UI `--font-ui` is the Dieter chrome stack.
- It covers current
  `CKTypography` behavior, `--font-display` cleanup, and the viewport-fluid
  versus container-query-fluid split.
- `documentation/architecture/AssetManagement.md` states that uploaded
  fonts are account assets, including accepted font MIME/extensions,
  `assetType: "font"`, admin account `CLICKEEN`, and account asset CDN
  delivery.
- `documentation/services/bob.md` states that Roma supplies account font
  library data to Bob and Bob must fail open-editor if account font data is
  missing or malformed.
- `documentation/services/tokyo-worker.md` and
  `documentation/engineering/CloudflareOperations.md` record current route
  authority without a root product-font path.
- `documentation/widgets/shared/ShellCore.md` and
  `documentation/widgets/shared/ShellUtilities.md` document widget runtime
  typography as `CKTypography` behavior, not Dieter chrome typography.
- Removed paths and class names must not remain documented as current behavior.

## Execution Gap Targets

Step 6 is complete in `audits/126D__Audit__Typography.md`. It proved two
remaining mismatches:

1. Bob replaces the visible family menu with the current account library but
   still validates edits, Copilot controls, config, and save against the
   account-independent compiler's fixed default-Google-family enum. A visible
   account font such as Orio is rejected. Its visible menu also filters
   weights/styles by family while session/Copilot validation accepts generic
   combinations that public runtime can reject later.
2. Bob's compiler silently filters composed typography roles through a fixed
   14-role list. Current role keys happen to align across all eight widgets,
   but a future widget role can disappear from Bob without compile failure.
   Some current generic labels also understate widget semantics.

All font migration, Dieter class cleanup, account-asset delivery, root-route
deletion, public package materialization, and remote product-data work are
closed regression evidence, not Step-9 scope.

## Step 7 Final Executable Plan

This plan is the complete 126D execution authority. Step 9 must implement this
one atomic authority move after Step 8 is green for the exact committed plan
tree. It must not deploy a midpoint where account family controls accept any
string without account binding.

### Product Result

- A user can select any font in the current account font library, including an
  uploaded font such as Orio, and Bob accepts, previews, saves, and exposes the
  same choice to Copilot.
- A family absent from the current account library is rejected.
- A weight or style absent from the selected family record is rejected during
  open, editing, and save instead of failing later in public runtime.
- Roma Widget Defaults applies and validates the same family transitions for
  shell and widget-core typography; it is not a weaker second editor.
- A rejected family transition leaves visible controls and document truth
  unchanged, creates no dirty state or Undo action, and reports no applied edit.
- Bob shows every composed typography role for every widget.
- Shared shell roles retain shared default labels. Widgets declare labels for
  their own roles and may override a shared label when that role has broader
  widget meaning.
- Adding a widget role without a product-readable label fails widget
  compilation; it is never silently omitted.
- Widget validation fails when an actual widget client's runtime role map and
  its composed spec roles differ; source drift cannot ship silently.

### Authority Design

The account-independent compiler emits a family control as a string control
with no font options or enum values. `packages/widget-shell`, beside the
existing `AccountFontLibrary` contract, owns the pure resolver for a requested
family transition and the pure validator for persisted typography selections.
The resolver returns an explicit family/weight/style triple or a structured
rejection. It preserves an explicitly requested allowed companion and rejects
an explicitly requested disallowed value. For an omitted companion it preserves
the current value if allowed, otherwise prefers `400`/`normal`, otherwise the
target record's first allowed value. Nothing is silently written or repaired.

Dieter owns presentation only and emits the requested family as one raw intent.
Bob and Roma adapt that intent to their document paths through the same narrow
control-host operation, call the widget-shell resolver, and apply the returned
triple atomically. A rejected operation restores the visible three controls
from unchanged document truth and displays: `That font choice is not available.
Choose another font, weight, or style.` The stable internal reason key is
`coreui.errors.typography.selection.invalid`; raw helper text is never user
copy.

The current account's normalized `fontLibrary` is bound to Bob controls once,
during session open. Those bound controls drive config validation, direct
edits, Copilot, and save validation. The widget-shell validator checks Bob after
open/edits/before save and checks Roma shell plus every widget-core defaults
document on GET and PUT. The visible grouped menus in both hosts come from the
same `fontLibrary`.

This is one account authority used in two presentations, not two font models:

```text
Roma current account fontLibrary
  -> widget-shell transition + validation law
     -> Bob session binding/edit/Copilot/save
     -> Roma Widget Defaults shell/core edit/save
     -> visible grouped family menus in both hosts
```

Widget role labels use the existing structured typography panel declaration:

```json
{
  "id": "typography",
  "shared": {
    "id": "typography",
    "roleLabels": {
      "widgetRole": "Product-readable label"
    }
  }
}
```

`packages/widget-shell` owns and exports the four shell defaults: `Title`,
`Subtitle`, `Button text`, and `Locale switcher`. Widget declarations own their
additional labels and any needed shared-role override. Bob consumes those
authorities; it does not duplicate them. No global role registry is added.
Every generated typography field carries that role label as its explicit
compiled `groupLabel`, so both the visible panel and Copilot speak in product
roles rather than generic `Font family` controls.

The existing widget compiler validation reads each real `widget.client.js`
with the TypeScript AST, finds the role map passed to
`CKTypography.applyTypography`, and compares that exact key set with the
composed spec roles. It supports the current inline object and local object
with static property assignments. Unsupported or dynamic construction fails
validation rather than being inferred. Runtime source and materialized package
bytes do not change for this proof.

### Atomic Source Slice 126D.1

| File | Exact change | Preserve |
| --- | --- | --- |
| `packages/widget-shell/src/controls.ts` | Export the existing four shell typography role keys with their product labels. | Existing control definitions, paths, and account-default metadata. |
| `packages/widget-shell/src/font-library.ts` | Add `resolveAccountTypographyFamilySelection` and `validateAccountTypographyFontSelections`. The resolver returns a compatible triple or structured reason; the validator returns exact invalid paths. | Existing library normalization, options, Google specs, upload types, and account-asset records. |
| `bob/lib/compiler/modules/typography.ts` | Delete default-account family options and the hardcoded 14-role candidate table. Render empty family options so compiled family controls infer `string`. Own generic 100-900 weight labels locally. Enumerate every composed role. Resolve labels from widget-shell plus widget declaration; reject missing/unknown/unused entries. Emit that role label as `group-label` on every role control. | Current control paths, conditional custom fields, and visible control order. |
| `bob/lib/compiler/editor-contract.ts` | Parse `shared.roleLabels` as a non-empty string map and pass it to `buildTypographyPanel`. Reject malformed metadata. | Existing shared panel shape and all non-typography editor rendering. |
| `bob/lib/compiler/controls.ts` | Prefer a non-empty explicit `group-label` attribute over the technical field group label. Typography fields receive their role label, which survives in compiled controls and Copilot context. | Existing group fallback and control inference for every other field. |
| `bob/lib/edit/typography-fonts.ts` | Delete the file. Every export is either dead, default-account authority, or a wrapper around `@clickeen/widget-shell`; no compatibility re-export remains. | Account font types/helpers stay in `@clickeen/widget-shell`. |
| `bob/lib/session/sessionConfig.ts` | Add the pure binder that copies compiled family controls with exact current-account options/enums. Call the widget-shell typography validator and map its exact paths into the existing invalid-config contract. | Existing generic compiled-control and config-shape validation. |
| `bob/lib/session/useSessionBoot.ts` | Normalize `fontLibrary` before config validation; bind typography family controls to it; validate config and account typography selections against the bound compiled widget; store the bound compiled widget in session state. | Existing explicit missing/malformed library failure, unsaved-open protection, policy, Copilot, translations, and session coordinates. |
| `bob/lib/session/useSessionEditing.ts`, `bob/lib/session/sessionTypes.ts`, `bob/lib/session/WidgetDocumentSession.tsx` | After generic validation, run account-font validation before accepting state. Expose `reportEditRejection(reasonKey)` through the existing session so a control-host rejection sets `source: 'ops'` error only; data, dirty state, last update, and save signature remain unchanged. Pass the existing normalized font library into editing. | Existing operation errors, session composition, dirty calculation, and metadata. |
| `bob/lib/session/useSessionSaving.ts` | Run the same account-aware assertion before issuing save. | Existing save command, error mapping, and dirty-state behavior. |
| `bob/lib/edit/typography-family-ops.ts`, `bob/components/td-menu-content/linkedOps.ts`, `bob/lib/control-host.ts` | Add one narrow path adapter around the widget-shell resolver and export it for Roma. It consumes current document, font library, and raw set ops, then returns explicit ops or structured rejection. Bob's full linked-op expansion delegates all family changes to it. | Existing preset, radius, shadow, padding, and all non-typography linked operations; no session/persistence code enters `control-host`. |
| `bob/components/TdMenuContent.tsx`, `bob/components/td-menu-content/useTdMenuBindings.ts` | Catch structured family rejection, resync family/weight/style fields from unchanged session data, and call `reportEditRejection`. Successful operations clear the existing ops error. | Existing field event wiring, hydration, show-if, and upsell behavior. |
| `bob/components/ToolDrawer.tsx` | Map `coreui.errors.typography.selection.invalid` to the exact shared product copy for manual edit rejection. | Existing load/save/translation/other operation mappings. |
| `bob/components/CopilotPane.tsx` | Pass draft ops through the shared expansion before inverse/apply/metadata and use expanded ops everywhere. Role-aware `groupLabel` stays in the AI capsule. On structured typography rejection show the same exact typography product copy; reserve `COPILOT_INVALID_EDIT_MESSAGE` for unrelated invalid edits. Create no Undo token and emit no `edit_applied` outcome. | Existing request envelope, concurrency signature, conversation UX, successful outcome reporting, and undo semantics. |
| `dieter/components/dropdown-actions/dropdown-actions.ts` | Delete the typography family branch that chooses companions, mutates three inputs, and emits three ops. A family choice follows normal dropdown behavior and emits only family intent. Keep weight/style option filtering as presentation. | Normal dropdown lifecycle, pending/apply behavior, focus, external sync, and non-typography actions. |
| `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.js` | Regenerate from Dieter source; prove generated behavior emits raw family intent. | Generated-only authority. |
| `roma/components/widget-defaults-builder-controls.tsx`, `roma/components/widget-defaults-domain.tsx` | Expand raw family intent through the shared adapter and apply the returned triple to shell/core draft state in one functional update. On rejection restore fields, show the stable product error, and leave draft/dirty state unchanged. | Existing compiled-control reuse, readiness/contract errors, discard, and save UX. |
| `roma/lib/account-widget-defaults-contract.ts` | After library/path validation, run the widget-shell validator against shell typography and every widget-core typography document on GET and PUT; return all exact invalid paths. | Existing account coordinate, compiled control coverage, and software metadata allowances. |
| `roma/tests/run-widget-defaults-typography.ts`, `roma/package.json` | Add focused shell/core transition and route-contract proof, including uploaded family, both transition directions, explicit invalid companion, unchanged rejection state, and exact invalid paths. | Existing test commands. |
| `roma/lib/account-instance-public-package.ts` | Immediately after loading the normalized account `fontLibrary`, validate the instance/locale materialized state with the same widget-shell typography validator before font asset resolution or runtime materialization. Return `422`, `coreui.errors.typography.selection.invalid`, and exact paths. | Existing account-font asset resolution, runtime typography data, package bytes, and materializer mapping. |
| `roma/tests/run-instance-package-reroute.ts`, `roma/tests/run-instance-save-boundary.ts` | Prove disallowed weight/style fails before package construction and that an invalid direct/replayed save reaches neither `saveAccountInstanceInTokyo` nor package update. | Existing package and source-save boundaries. |
| `tokyo/product/widgets/big-bang/spec.json` | Declare `bigBang: "Big Bang statement"` and override `body` as `Subtitle and supporting copy`. | Widget defaults, runtime, content, layout, and all non-label editor metadata. |
| `tokyo/product/widgets/calltoaction/spec.json` | Declare `eyebrow: "Eyebrow"`; override `title` as `Title and action headline` and `body` as `Subtitle and supporting text`. | Widget behavior and all non-label editor metadata. |
| `tokyo/product/widgets/cards/spec.json` | Declare `cardTitle: "Card title"` and `cardCopy: "Card copy"`. | Widget behavior and shared role labels. |
| `tokyo/product/widgets/countdown/spec.json` | Declare `timer: "Timer"` and `label: "Labels"`. | Widget behavior and shared role labels. |
| `tokyo/product/widgets/faq/spec.json` | Declare `section: "Section title"`, `question: "Question"`, and `answer: "Answer"`. | Widget behavior and shared role labels. |
| `scripts/widgets/compile-all.ts` | Parse every actual widget client's `CKTypography.applyTypography` third-argument role map with the TypeScript AST. Collect inline object keys or local-object keys plus static property assignments; reject unsupported/dynamic forms. Compare the exact key set with `compiled.defaults.typography.roles`. | Existing widget discovery and product-readable control validation; no role registry. |
| `bob/tests/run-typography-contract.ts` | Compile all eight specs; prove exact roles/labels, account-independent family controls, account-bound Orio acceptance, transition rules in both directions, exact shared rejection copy in ToolDrawer/Copilot, unchanged manual/Copilot rejection state, no false Undo/outcome, malformed/missing/unused label failure, and role-aware Copilot metadata. | Test-only proof; no runtime dependency. |
| `bob/package.json` | Add `test:typography-contract`. | Existing scripts. |
| `documentation/engineering/UI/typography.md` | Document compiler/session font authority and role-label ownership. | Two-lane typography doctrine and closed migration truth. |
| `documentation/engineering/UI/dieter.md` | Document that Dieter emits control intent and does not own account-font transition policy. | Existing Dieter source/generated authority. |
| `documentation/services/bob.md` | Document account-bound family controls and absence of a compiler default font catalog. | Existing Builder/session/product boundary. |
| `documentation/services/roma.md` | Document Widget Defaults as the second account-bound host using the same account font operation/validator. | Existing Roma route/surface authority. |
| `documentation/widgets/authoring/ToolDrawerControls.md` | Document widget-specific `shared.roleLabels` and compile failure on omissions. | Existing authoring contract. |
| `documentation/widgets/shared/ShellUtilities.md` | Document shell-owned typography role labels and build-time parity between composed roles and each actual widget client role map. | Existing runtime typography utility behavior. |

### Explicit Deletions

- Static compiler family options from the default account library.
- `bob/lib/edit/typography-fonts.ts` in full; its dead wrappers and default
  catalog authority are not preserved under a new name.
- The fixed 14-role candidate list, including dead `heading` candidature.
- Bob's duplicate ownership of the four shell role labels.
- Dieter's family-specific weight/style selection and three-op emission branch.
- Any Roma Widget Defaults path that accepts typography without the shared
  account-font validator.
- Any stale living-doc statement that says the compiler supplies final account
  font options or silently discovers widget role labels.

Do not delete account font records, account assets, public packages, widget
runtime role maps, or the untracked local font copies as part of this Git slice.
Do not edit shared/widget runtime JavaScript or bulk-rematerialize instance
packages; the runtime role-map proof is build-time source validation. The one
real Bob smoke save normally rematerializes only that selected instance.

### Verification Gate

Local source gate:

```bash
pnpm build:dieter
pnpm --filter @ck/dieter typecheck
pnpm --filter @clickeen/bob test:typography-contract
pnpm --filter @clickeen/roma test:widget-defaults-typography
pnpm validate:widgets
pnpm --filter @clickeen/widget-shell typecheck
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma test:instance-package
pnpm --filter @clickeen/roma test:instance-save-boundary
rg -n "DEFAULT_ACCOUNT_FONT_LIBRARY|CK_TYPOGRAPHY_FONTS|CK_GOOGLE_FONT_SPECS|buildCkTypographyFamilyOptions" bob
rg -n "dataset\.weights|dataset\.styles" dieter/components/dropdown-actions/dropdown-actions.ts
git diff --check
```

The Bob negative search must return no active default-family authority. The
Dieter search may find only the two option-filtering readers; no family-click
companion selection or multi-op emission may remain. Generated Dieter output
must match source after `pnpm build:dieter`.

Deploy/runtime gate:

1. Commit and push the exact green source tree through normal Git deployment.
2. Verify the Tokyo product-root Worker/R2 sync GitHub Action is green for that
   exact commit SHA.
3. Run `pnpm cf:preflight`, then read back and byte/hash-compare these exact R2
   keys with the committed source. Missing credentials or any mismatch keeps
   the gate red:
   `product/widgets/{big-bang,calltoaction,cards,countdown,faq}/spec.json` and
   `dieter/components/dropdown-actions/dropdown-actions.js` (compared with
   committed `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.js`).
4. Run `pnpm cf:api:preflight`; stop on failure. Then verify both `bob-dev` and
   `roma-dev` Cloudflare Pages deployments are green
   for the exact commit SHA; workflow success without Pages SHA evidence is not
   sufficient. Verify both canonical runtime hosts respond through the current
   deployment.
5. Through authenticated Roma Widget Defaults, switch one shell role and one
   widget-core role into and out of the uploaded account font. Verify each
   transition changes family/weight/style together, Save succeeds, and reload
   returns the same values.
6. In Roma Widget Defaults, attempt an unavailable family and an explicitly
   disallowed companion. Verify stable product error copy, unchanged controls
   and draft, no dirty state, and no PUT.
7. Open an existing `CLICKEEN` widget in Bob through Roma and verify the
   account-bound compiled payload exposes the current account families and
   product role labels.
8. Select an uploaded account font, observe the preview, save, reopen, and
   verify the selected family persists.
9. Verify that normal Save rematerialized only this selected instance's base
   package and that its public embed still renders; no bulk regeneration runs.
10. Ask Bob Copilot to switch into and out of that uploaded font. Verify each
   applied edit contains a compatible family/weight/style set and Undo restores
   all three values.
11. Verify Bob Copilot identifies the intended typography role, and its family
    choices equal the current account library rather than the default Google
    catalog.
12. In manual Bob, Copilot, and Roma, verify an unknown family and an explicitly
    disallowed companion show exactly `That font choice is not available.
    Choose another font, weight, or style.`, leave controls/config/dirty state
    unchanged, create no Undo token, and emit no `edit_applied` outcome.
13. Submit an invalid direct/replayed instance save and prove the 422 reason/path
    response occurs before any Tokyo instance write or public-package update.

No direct R2/Supabase mutation or font-data migration is permitted.

### Step-9 Green Bar

126D is green only when the source, focused tests, eight-widget validation,
docs, exact-SHA deploys, and real account-font edit/save/reopen proof all agree.
Deleting untracked workspace residue, passing typecheck alone, or showing the
font in the menu is not 126D execution proof.

## Closed Product Data Authority Evidence

The seven fonts are verified `CLICKEEN` account assets. This section records the
authority used for that completed migration; it does not authorize new product
data work.

Authority chain:

```text
Roma current account -> accountPublicId CLICKEEN -> Roma account asset route -> Tokyo-worker -> accounts/CLICKEEN/assets/{filename}
```

Closed evidence:

- Authenticated Roma account routes show all seven fonts as `CLICKEEN` account
  assets and expose the current `fontLibrary`.
- Current source contains no root product-font route or fixed Tokyo font record.
- Public widget runtime uses account-asset URLs, not root product-font URLs.
- Direct R2/API preflight is unavailable on this machine because
  `CLOUDFLARE_ACCOUNT_ID` is absent; this register makes no direct-storage
  claim.

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
| V1 Silent substitution | A future change restores undefined `--font-display` or invents font truth. | Verified: no active `--font-display` reference; account font records are explicit product data. |
| V2 Silent healing | Runtime coerces invalid font config into a different persisted font without surfacing failure. | Preserve runtime validation semantics; do not normalize stored user typography into false success. |
| V3 Silent omission | A future cleanup drops account font availability or package references. | Verified: fonts are migrated, packages use account assets, and the old route is removed. |
| V4 Fail-open control | Missing font/source data falls back to unowned typography behavior. | Missing account font library/record/asset fails Bob open, Roma defaults GET/PUT, or save/materialization explicitly; upload acceptance uses exact MIME/extension pairs. |
| V5 Corruption-as-absence | Bad stored typography becomes treated as empty/default and overwritten. | Do not rewrite persisted typography state as part of code cleanup. |
| V6 Partial-success masquerade | Either editor shows or claims a font edit that its contract/runtime rejects. | Dieter emits intent only; Bob and Roma use one resolver/validator; rejection changes no data/dirty/Undo/outcome; saved typography, package data, and runtime agree. |
| V7 Masquerade/redress | A deleted special-font concept is restored under a new label. | Verified: `/fonts/special/*` and the root font route are absent. |
| V8 Runtime test dependency | Normal font behavior depends on validation scripts/check rituals. | Fix source/docs/runtime authority; checks only verify execution. |

## Verification Checklist

These are regression checks for any later typography change. They do not reopen
font migration or authorize remote product-data work:

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
- Verify account-font state through Roma/Tokyo product routes and public
  runtime if later typography execution touches that path. Direct Cloudflare
  checks require the documented preflight and credentials; no migration is
  reopened here.
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

GLM's independent input is frozen historical provenance. Current source
overrides stale present-tense claims below:

- Dieter has no tracking token layer and currently inlines letter-spacing in
  utility classes.
- Dieter fluid display is viewport-clamp; widget runtime fluid type is
  container-query clamp.
- Typography utilities currently carry some color behavior.
- Living typography documentation now explains the richer widget runtime.
- `--font-display` is absent from active source.
- Dieter source and generated Tokyo Dieter output duplicate because generated
  output mirrors source.
- Bob editor role coverage, widget-shell defaults, and runtime-applied custom
  fields are not fully aligned.

Final product law: Dieter operational UI typography and widget runtime content
typography are separate authorities, and each must be deterministic inside its
own lane.
