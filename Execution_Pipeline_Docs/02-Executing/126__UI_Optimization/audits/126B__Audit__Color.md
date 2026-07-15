# 126B Color - Current-Source Gap Audit

Status: STEP 6 COMPLETE - current source audited; no Step-9 execution credit.
Parent PRD: `../126B__PRD__Color.md`.
Audit date: 2026-07-15.
Audited tree: `503fe5a7` (`docs(126A): record exact-tree review green`).

This audit replaces the frozen June snapshot with current source truth. It
separates work already present from the small remaining 126B implementation
surface. It authorizes no product-code, generated-output, deploy, or product-
data mutation.

## Authorities

| Concern | Authority |
| --- | --- |
| Color values and semantic roles | `dieter/tokens/dieter-color-tokens.css` |
| Generated Dieter product output | `scripts/build-dieter.js` -> `tokyo/product/dieter/**` |
| Bob preview session/message shape | `bob/lib/session/sessionTypes.ts`, `bob/components/Workspace.tsx` |
| DevStudio color reveal | `admin/scripts/generate-foundation-pages.mjs` |
| DevStudio color write contract | `admin/functions/_shared/dieter-tokens.js` |
| Widget package source | `tokyo/product/widgets/{widgetType}/**` |
| Living color law | `documentation/engineering/UI/color.md` |

## Current Baseline Already Present

Current source already has the exact light-mode semantic role layer, state mix
controls, resolved historical undefined references, truthful read-only
DevStudio role/focus/state rows, generated Dieter parity, and no Dieter dark
selectors or dark examples. These are regression evidence, not Step-9 work.

The following stale names are absent from active source:

```text
--color-surface
--color-bg
--color-system-gray-7
--color-system-gray-10
--state-muted-opacity
--state-hover-target
```

The only current internal dark-mode fiction found by the source scan is Bob's
unused `theme: 'light' | 'dark'` preview field. Widget message receivers consume
state, locale, typography, device-independent widget behavior, and resize
messages; none reads the posted `theme` property.

## Exact Remaining 126B Work

### B1 - Delete Bob's Dormant Theme Shape And Use Status Roles

| File | Current evidence | Later Step-9 change |
| --- | --- | --- |
| `bob/lib/session/sessionTypes.ts` | `PreviewSettings.theme` advertises unsupported light/dark behavior and `DEFAULT_PREVIEW` manufactures `light`. | Delete the field and default. Do not replace it with another mode/theme field. |
| `bob/components/Workspace.tsx` | Reads, memoizes, posts, and uses the unused theme only as an effect dependency. No widget receiver consumes it. | Delete all theme plumbing while preserving device, host, preview state, locale, and typography behavior. |
| `documentation/services/bob.md` | Documents `"theme": "[light|dark]"` in `ck:state-update`. | Delete the field from the documented message. |
| `bob/app/bob_app.css` | Instance rename and settings error/warning/info/success chrome consumes direct system primitives despite exact roles existing. | Replace only those status references with `--role-error`, `--role-warning`, `--role-info`, and `--role-success`; preserve the existing mix percentages and geometry. |
| `bob/components/ToolDrawer.tsx` | Inline session-error colors repeat direct red primitives. | Use `--role-error` in the existing border/background/text formulas; do not change error content or control flow. |

This slice changes no save, translation, Copilot, preview data, iframe loading,
or account behavior. Removing a message property that no receiver reads is a
deletion, not a compatibility project.

### B2 - Use The Existing Focus Role In Logo Showcase

| File | Current evidence | Later Step-9 change |
| --- | --- | --- |
| `tokyo/product/widgets/logoshowcase/widget.css` | Link focus uses `--color-system-blue` directly. | Change only the focus outline to `--role-focus`. Keep active carousel-dot blue because it is a widget product default, not structural focus chrome. |

This is widget package source. It must flow through the existing Tokyo product-
root Git deploy/sync path. No account instance or product data is edited.

### B3 - Align DevStudio Reveal With Its Write Predicate

| File | Current evidence | Later Step-9 change |
| --- | --- | --- |
| `admin/scripts/generate-foundation-pages.mjs` | Writable color reveal accepts any 3-8 hex digits. | Use the exact write contract: 3 or 6 hex digits only. |
| `admin/functions/_shared/dieter-tokens.js` | Write authority accepts `^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$`. | Read-only evidence; do not broaden or otherwise edit the API. |
| `admin/src/html/foundations/colors.html` | Generated from current six-digit source colors. | Regenerate and prove zero output diff is expected for current source values. Do not hand-edit. |

This closes a reveal/write truth mismatch without adding a shared validator,
registry, parser, or token API.

## Routed Work

| Current inventory | Owner | 126B boundary |
| --- | --- | --- |
| Dieter component-wide role/state adoption | 126I | Apply 126B law when each component is executed; no broad recolor in 126B. |
| Broad DevStudio chrome adoption | 126L | 126B changes only the generator predicate. |
| Broad Roma chrome adoption and dead CSS cleanup | 126M | No Roma implementation in 126B. |
| Bob structural colors outside the exact status sites above | No current 126 Step-9 owner authorizes a Bob-wide visual refactor | Keep as observed inventory; do not manufacture scope. A later Bob-owned PRD must name exact changes. |
| Prague FAQ marketing copy mentioning dark mode | Prague content authority/product-owner decision | Human-authored marketing content is not changed by a color-system implementation PRD. |

Routing is not approval of legacy. It prevents a domain PRD from expanding into
an unbounded whole-product rewrite. Every later owner must consume the current
126B color law when it changes the named component or surface.

## Explicit No-Change Surface

- No Dieter token value, palette, role name, or state percentage change.
- No `tokyo/product/dieter/**` generated change is expected.
- No Roma implementation change.
- No DevStudio write API change.
- No theme provider, dark-mode toggle, dark-mode token pair, or readiness claim.
- No contrast gate or automated palette decision.
- No purge of user-authored colors, widget appearance values, gradients,
  shadows, swatches, or serialized color data.
- No Tokyo-worker, San Francisco, Berlin, Supabase, account instance, overlay,
  translation, publish, or R2 account-data change.
- No generated file is hand-edited.

## Later Verification Contract

### B1 local proof

- `rg` proves no Bob preview `theme` field or message property remains.
- Bob typecheck, lint, build, and focused relevant tests are green.
- Browser proof shows Builder desktop/mobile preview switching, iframe state
  updates, status messages, and rename/session errors remain coherent.

### B1 deploy proof

- Commit and push precede runtime proof.
- Bob and Roma Git-connected Cloudflare Pages builds are green.
- Cloud-dev Roma Builder proves the deployed Bob behavior; browser message
  capture confirms `ck:state-update` has no theme property.

### B2 local proof

- Widget validation/build and the Logo Showcase package fixture are green.
- Browser focus proof confirms a visible focus outline sourced from
  `--role-focus`, with no layout or product-color change.

### B2 deploy proof

- Commit and push precede runtime proof.
- `cloud-dev workers deploy` and its Tokyo product-root R2 sync are green.
- The owning cloud-dev Logo Showcase surface serves the changed package and a
  keyboard-focused logo link uses the role-backed focus color.

### B3 local proof

- `pnpm build:devstudio` is green.
- Regeneration leaves `admin/src/html/foundations/colors.html` unchanged for the
  current six-digit source values.
- A source-level check proves 3/6-digit hex is writable while 4/5/7/8-digit hex
  is read-only, matching the backend contract.

### B3 deploy proof

- Commit and push precede runtime proof.
- DevStudio Git-connected Cloudflare Pages build is green.
- The deployed color foundation still reveals current tokens and exposes edit
  controls only for values accepted by the existing write API.

## V1-V8 Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | No missing truth is replaced with an invented token or theme value. |
| V2 | PASS | The unused theme shape is deleted; no compatibility alias silently heals it. |
| V3 | PASS | Source, consumer, generated, docs, deploy, and runtime proof surfaces are named. |
| V4 | PASS | DevStudio cannot reveal an invalid value as writable when the write API rejects it. |
| V5 | PASS | Invalid reveal/write truth remains invalid rather than being treated as an absent capability. |
| V6 | PASS | Each slice has distinct local, deploy, and cloud proof before it can be called green. |
| V7 | PASS | Dark-mode fiction is deleted rather than renamed or preserved as readiness. |
| V8 | PASS | Tests and browser captures prove behavior; normal product work does not depend on them. |
