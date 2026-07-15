# 126B Color - Current-Source Gap Audit

Status: STEP 6 COMPLETE - current source audited; no Step-9 execution credit.
Parent PRD: `../126B__PRD__Color.md`.
Audit date: 2026-07-15.
Audited tree: `503fe5a7` (`docs(126A): record exact-tree review green`).

This audit replaces the frozen June snapshot. Every current finding below cites
the audited source location. It authorizes no product-code, generated-output,
deploy, or product-data mutation.

## Read-Only Commands

```bash
rg -n "instance-rename__error|settings-panel__error|settings-panel__warning|settings-panel__note|settings-panel__success|topdrawer-instance-title-input|topdrawer-instance-title--editable" . --glob '!**/node_modules/**' --glob '!Execution_Pipeline_Docs/**'
rg -n "theme: 'light' \| 'dark'|prefers-color-scheme|data-theme=[\"']dark" bob dieter admin roma tokyo/product/widgets documentation/engineering/UI documentation/services
rg -n -e "--color-surface\\b|--color-bg\\b|--color-system-gray-(7|10)\\b|--state-muted-opacity\\b|--state-hover-target\\b" dieter bob roma admin tokyo/product/widgets documentation/engineering/UI
rg -n "color-system-(red|orange|green|blue)(-5|-contrast)?\\b" bob --glob '*.{ts,tsx,css}'
```

These scans establish current presence/absence and consumer liveness. No test,
build, preflight, deploy, or remote mutation was part of Step 6.

## Authorities And Current Baseline

| Evidence | Current truth |
| --- | --- |
| `dieter/tokens/dieter-color-tokens.css:1-44` | Dieter owns the light-mode role layer and state mix controls. |
| `scripts/build-dieter.js:1-120` | Tokyo Dieter files are generated output, not an edit authority. |
| `documentation/engineering/UI/color.md:1-122` | Living law already records light-mode, role/state, user-color, and human-owned contrast decisions. |
| `admin/scripts/generate-foundation-pages.mjs:64-66` | DevStudio reveal decides whether a color row appears writable. |
| `admin/functions/_shared/dieter-tokens.js:5-11` | DevStudio write authority accepts only `--color-*` values with exactly three or six hex digits. |
| `scripts/tokyo-r2-deploy-sync.mjs:24` | Widget package source syncs from `tokyo/product/widgets/**` to R2 `product/widgets/**`. |
| `.github/workflows/cloud-dev-workers.yml:5-15,125-129` | Widget package changes trigger worker deploy and Tokyo product-root sync. |
| `.github/workflows/cloud-dev-roma-app.yml:5-14` | Widget package and Bob changes trigger Roma cloud-dev verification. |

Current source contains the exact semantic roles, resolved historical undefined
tokens, truthful read-only role/focus/state reveal, generated Dieter parity, and
no active Dieter dark selector/example. These are regression evidence, not new
Step-9 work.

## B1 - Bob Theme Fiction And Dead/Live Status CSS

### Dormant theme path to delete

| Evidence | Finding | Step-9 action |
| --- | --- | --- |
| `bob/lib/session/sessionTypes.ts:20-24,146-150` | `PreviewSettings.theme` advertises `light|dark` and the default manufactures `light`. | Delete the field and default. |
| `bob/components/Workspace.tsx:79,164-201,309-373,423` | Workspace reads, stores, posts, and tracks the theme property. | Delete only that plumbing. Preserve device, host, state, locale, typography, and iframe lifecycle. |
| `tokyo/product/widgets/shared/runtime.js:91-113` | Shared widget receiver ignores `theme`. | Read-only proof; no receiver change. |
| `tokyo/product/widgets/shared/branding.js:188-202` | Branding receiver ignores `theme`. | Read-only proof. |
| `tokyo/product/widgets/shared/socialShare.js:534-550` | Social receiver ignores `theme`. | Read-only proof. |
| `documentation/services/bob.md:389-404` | Documented `ck:state-update` falsely includes `[light|dark]`. | Delete the field from the documented message. |

### Dead Bob CSS to delete

Whole-repo consumer search proves the following selectors have no producer:

| Evidence | Step-9 action |
| --- | --- |
| `bob/app/bob_app.css:88-99` | Delete unused editable-title selectors. |
| `bob/app/bob_app.css:110-144` | Delete unused title-input/focus/active/disabled and rename-error selectors. Bob title is read-only at `bob/components/TopDrawer.tsx:24-31`. |
| `bob/app/bob_app.css:391-418` | Delete unused warning, note, upsell-note, and note/fullwidth selectors. |
| `bob/app/bob_app.css:434-441` | Delete unused success selector. |

Do not recolor dead paths or create browser proof for nonexistent rename/status
UX. Roma rename at `roma/components/widgets-domain.tsx:337-380` is a different
surface and is not Bob proof.

### Live Bob status paths to keep truthful

| Evidence | Finding | Step-9 action |
| --- | --- | --- |
| `bob/components/td-menu-content/useTdMenuHydration.ts:75-83` | Failed control hydration renders `.settings-panel__error`. | Keep the selector; replace only value-equivalent base red border/text references with `--role-error`. Preserve its pale `--color-system-red-5` background and geometry. |
| `bob/app/bob_app.css:382-389` | The live settings error uses base red plus a pale ramp. | Same exact change; no visual redesign. |
| `bob/components/ToolDrawer.tsx:181-183,275-310` | Session and blocked-editor errors use inline base-red border/text plus pale background. | Replace only value-equivalent base red with `--role-error`; preserve pale background and behavior. |
| `bob/components/Workspace.tsx:465-478` and `bob/app/bob_app.css:465-477` | Preview loading/error overlays are live; the error surface is a pale ramp with no value-equivalent current semantic surface role. | No change. Classify the pale ramp as a legal semantic-status modifier; do not invent a container-role family. |

The 126B law permits a palette ramp or contrast sibling only as a modifier on an
explicit semantic status where no value-equivalent role exists. The status base
meaning must still use the semantic role. This is narrower than adding eight
unused status-container tokens and preserves the current visual result.

### User-authored transparent preview classification

`stage.background` is user-authored at
`bob/lib/compiler/modules/stagePod.ts:263-280`. Workspace posts the unchanged
state at `bob/components/Workspace.tsx:349-360`, while
`bob/components/Workspace.tsx:265-290` paints the
iframe host backdrop white when that authored background is transparent. This
does not rewrite or normalize source state; it provides a neutral editor host
behind a transparent iframe. It is explicitly no-change for 126B and therefore
does not violate V1/V2.

## B2 - Logo Showcase Focus Role

| Evidence | Finding | Step-9 action |
| --- | --- | --- |
| `tokyo/product/widgets/logoshowcase/widget.css:206-213` | Logo-link focus uses base blue directly. | Change only the outline to value-equivalent `--role-focus`. |
| `tokyo/product/widgets/logoshowcase/widget.css:311-313` | Active carousel dot uses blue as a widget product default. | No change; this is not focus chrome. |
| `roma/tests/instance-package-fixtures.ts:16-25,49-75` | Roma parity packages embed each widget's source CSS. | Read-only fixture authority. |
| `roma/tests/fixtures/124c-base-package-expected.json:28` | Logo Showcase expected package embeds current CSS. | Update only the exact Logo Showcase focus-token substring. |

The cloud gate must not depend on a saved account instance. The repository's
`8FMVZFFPJV` fixture at
`e2e/widgets/prd106f-builder-certification.spec.ts:37-43` is test input, not a
cloud-liveness authority. Rematerializing product data is forbidden for this UI
token change. The owning remote truth is the synced R2 product-root object
`product/widgets/logoshowcase/widget.css`.

## B3 - DevStudio Reveal/Write Predicate Parity

| Evidence | Finding | Step-9 action |
| --- | --- | --- |
| `admin/scripts/generate-foundation-pages.mjs:64-66` | Reveal accepts any 3-8 hex digits. | Use the exact backend 3/6-digit predicate. |
| `admin/functions/_shared/dieter-tokens.js:5-11,97-119` | Write API accepts exactly 3/6 digits and applies that predicate on read and write. | Read-only authority; do not broaden or otherwise edit. |
| `admin/src/html/foundations/colors.html:1` | Generated reveal uses current six-digit token values. | Regenerate; zero output diff is expected. Never hand-edit. |
| `documentation/engineering/UI/color.md:102-111` | Living law says only "literal hex," which incorrectly includes valid CSS 4/8-digit forms. | State exact 3/6-digit write truth. |
| `documentation/services/devstudio.md:79-87` | Service doc has the same imprecision. | State exact 3/6-digit write truth. |

No shared predicate helper, validator, registry, or token platform is justified
for one source regex aligned to its existing write authority.

## Routed And No-Change Work

| Evidence/inventory | Owner | 126B boundary |
| --- | --- | --- |
| Direct primitive/state consumption under `dieter/components/**` | 126I | Apply 126B law when the named component is executed. |
| Broad DevStudio chrome under `admin/src/css/**` | 126L | B3 owns only generator predicate and exact docs. |
| Broad Roma chrome under `roma/app/roma.css` | 126M | No Roma implementation in 126B. |
| Bob controls and hosted ToolDrawer/preview chrome outside exact B1 sites (`126I__PRD__Components.md:120-133`; `126M__PRD__Roma_UI.md:77-86,172-190`) | 126I for Dieter/component patterns; 126M for the nested hosted screen | Apply 126B law only while those owners execute their exact component/screen blast radius; no Bob-wide rewrite in 126B. |
| `tokyo/prague/pages/faq/features.json:133-135` marketing copy | Prague human-content authority | No AI edit under color-system scope. |

No Dieter token value or generated Tokyo Dieter file, palette, state percentage,
user-authored color, widget appearance value, account instance, overlay,
translation, Supabase, Tokyo-worker, San Francisco, Berlin, or R2 account data is
in scope.

## Later Verification Contract

### B1

- Local: dead-selector and theme scans; Bob typecheck/lint/build and relevant
  tests; browser device switching and `ck:state-update` capture; intercepted
  failed save exercises the live ToolDrawer error without a remote write.
- Deploy: commit/push first; `pnpm cf:api:preflight`; Bob and Roma Pages latest
  deployment commit hashes equal the B1 commit; Roma cloud-dev workflow
  `head_sha` equals B1; deployed Builder message capture has no `theme`.

### B2

- Local: widget validation/build and `pnpm tokyo:r2:sync:check`; Roma instance-
  package parity; fixture diff is only the Logo Showcase focus token; keyboard
  focus proof is green.
- Deploy: commit/push first; `pnpm cf:preflight`; worker and Roma workflow
  `head_sha` values equal B2; R2 read-back of
  `product/widgets/logoshowcase/widget.css` contains `--role-focus` and not the
  old focus declaration. No account instance is read, written, or rematerialized.

### B3

- Local: source comparison proves identical 3/6-digit generator/backend value
  shapes; DevStudio build/checks are green; generated colors HTML has zero diff;
  both living docs say 3/6 digits.
- Deploy: commit/push first; `pnpm cf:api:preflight`; DevStudio Pages latest
  deployment commit hash equals B3; deployed foundation shows current source
  colors editable and role/focus/state rows read-only.

## V1-V8 Audit

| ID | Result | Evidence |
| --- | --- | --- |
| V1 | PASS | Theme fiction is deleted; authored transparent state remains unchanged and only the editor host backdrop is neutral (`Workspace.tsx:265-290`). |
| V2 | PASS | No theme alias or color normalization is introduced. |
| V3 | PASS | Live/dead consumers, fixture, generated output, docs, workflows, R2 key, and deployment SHAs are named. |
| V4 | PASS | Reveal uses the same accepted shape as write authority. |
| V5 | PASS | Invalid color forms stay visible read-only rather than becoming absent or rewritten. |
| V6 | PASS | Each slice distinguishes local, pushed deploy, and owner-surface evidence. |
| V7 | PASS | Dead CSS and dark-theme fiction are deleted, not renamed. |
| V8 | PASS | Checks prove behavior and are not product runtime dependencies. |
