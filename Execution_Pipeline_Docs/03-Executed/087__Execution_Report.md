# PRD 087 Execution Report

Status: GREEN  
Started: 2026-05-08  
PRD: `087__PRD__Authoring_Contract_Compiler_And_Runtime_Hygiene.md`

## Slice 0 - Evidence Refresh And Scope Lock

Status: GREEN

### Current Widget Set

| Widget | Runtime files | Contract files | Current editor source | Shared runtime imports |
|---|---|---|---|---|
| `countdown` | `widget.html`, `widget.css`, `widget.client.js` | `spec.json`, `agent.md`, `limits.json`, `localization.json`, `layers/user.allowlist.json` | `spec.json.html`, 108 lines, 5 slot markers | `fill`, `header`, `localeSwitcher`, `surface`, `typography`, `stagePod`, `branding`, `previewL10n` |
| `faq` | `widget.html`, `widget.css`, `widget.client.js` | `spec.json`, `agent.md`, `limits.json`, `localization.json`, `layers/user.allowlist.json` | `spec.json.html`, 97 lines, one 12,282-character escaped template line | `fill`, `header`, `localeSwitcher`, `surface`, `typography`, `stagePod`, `branding`, `previewL10n` |
| `logoshowcase` | `widget.html`, `widget.css`, `widget.client.js`, `base-assets/*` | `spec.json`, `agent.md`, `limits.json`, `localization.json`, `layers/user.allowlist.json` | `spec.json.html`, 88 lines, two large escaped template lines, 5 slot markers | `fill`, `header`, `localeSwitcher`, `surface`, `typography`, `stagePod`, `branding`, `previewL10n` |

### Current Compiler Truth Sources

| Compiler stage | Current truth source | Finding | Surviving authority |
|---|---|---|---|
| Defaults | `spec.json.defaults` | Correct product truth | Keep |
| Normalization | `spec.json.normalization` | Correct data-driven pattern | Keep |
| Editor panels | `spec.json.html` strings parsed through `<bob-panel>` | Toxic editor DSL | Replace with `spec.json.editor.panels` |
| Editor clusters | `<tooldrawer-cluster>` tags plus path-prefix inference | Compiler guesses labels and groups | Explicit cluster objects |
| Editor fields | `<tooldrawer-field*>` tags and escaped attributes | Hostile to AI widget creation | Explicit field objects |
| Shared header controls | Compiler slot injection based on defaults | Compiler hides product controls | Explicit field objects in widget contract |
| Shared stage/pod controls | Compiler slot injection based on defaults | Compiler hides product controls | Explicit field objects in widget contract |
| Typography controls | Compiler strips author panel and injects generated one | Compiler discards author truth | Explicit field objects in widget contract |
| Theme registry | Remote `${tokyoBase}/themes/themes.json` fetch with silent `null` fallback | Non-deterministic product compile | Local repo theme JSON |
| Dieter stencils | Tokyo Dieter component stencils | Valid UI rendering dependency | Keep |

### Copilot Contract

Bob sends San Francisco a compact `controls` list derived from `compiled.controls`.

Current path:

```text
spec.json.html -> parse panels -> collect controls from generated markup -> Bob sends controls to Copilot
```

Surviving path:

```text
spec.json.editor -> compile controls directly -> Bob sends same controls shape to Copilot
```

The `CompiledControl` shape remains the safety contract for manual ops, linked ops, and Copilot ops.

### Decisions

| Decision | Choice | Why |
|---|---|---|
| Structured editor schema | `spec.json.editor.panels[].clusters[].fields[]` | One obvious product truth for Builder controls |
| Field shape | JSON objects with `groupId`, `type`, `path`, `label`, `attrs`, optional structured `template` | Keeps Dieter rendering while removing HTML-like authoring strings |
| Template shape | Structured nodes: `field`, `element`, `text` | Nested/repeater UI stays data, not escaped HTML |
| `showIf` | Structured predicates; simple comparisons plus `all` for current real conjunctions | Preserves product behavior without string eval |
| `compiled.controls` | Preserve current shape and generate directly from `spec.json.editor` | Avoids Roma/Bob/San Francisco contract churn |
| Migration | Hard cut all current widgets in one slice | Pre-GA; no long-lived dual contract |
| Theme registry | Read `tokyo/product/themes/themes.json` locally at compile time | Deterministic Builder compile |
| Policy gate | Delete `packages/ck-policy/src/gate.ts`; inline explicit Berlin role guard | Removes fake generic policy concept |
| Shared runtime | Defer Slice 5 unless a concrete blocking issue appears | Size alone is not product evidence |
| Dieter | Investigation only | No approved Dieter implementation in PRD 087 |
| Roma direct instance | Defer unless a concrete product-boundary violation appears | Size alone is not product evidence |

### Slice 0 Verification

- Widget inventory checked with `find tokyo/product/widgets -maxdepth 3 -type f`.
- Current `spec.json` structure checked with Node JSON inspection.
- Compiler inputs checked across `bob/lib/compiler.server.ts`, `bob/lib/compiler.shared.ts`, and `bob/lib/compiler/controls.ts`.
- Copilot usage of `compiled.controls` checked across Bob, Roma, and San Francisco.
- Policy gate callers checked with `rg "can\\(|gate|ActionKey" berlin packages`.

Green result: Slice 1 blockers are resolved. Proceeding to pre-slice deletion and Slice 4 before the hard-cut widget migration.

## Pre-Slice Cleanup - `_fragments`

Status: GREEN

Deleted:

- `tokyo/product/widgets/_fragments/README.md`

Why:

- The folder documented an old plain-fragment direction that is not the product architecture.
- The surviving widget truth is one widget folder with `spec.json.editor`, `widget.html`, runtime JS/CSS, `agent.md`, limits, localization, and layer allowlists.

Verification:

- `_fragments` has no remaining product-code references.

## Slice 4 - Policy Gate Naming And Boundary Cleanup

Status: GREEN

Deleted:

- `packages/ck-policy/src/gate.ts`
- `ActionKey` / `ACTION_KEYS` from `packages/ck-policy/src/registry.ts`
- `gate` export from `packages/ck-policy/src/index.ts`

Changed:

- `berlin/src/projection/routes.ts` now performs the narrow viewer-role denial directly at the projection mutation boundary.

Why:

- The old `gate.ts` name implied a broad policy engine, but the only real behavior was "viewer cannot mutate instance projection."
- Entitlement and limit enforcement stay owned by explicit product boundaries, not a fake generic gate.

Verification:

- `./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit`
- `rg "gate|GateDecision|ActionKey|ACTION_KEYS|can\\(" packages/ck-policy berlin/src/projection -S`
  - Remaining hits are natural-language notes only; no gate code path remains.

## Slice 1 - Authoring Contract Boundary

Status: GREEN

Changed:

- `tokyo/product/widgets/faq/spec.json`
- `tokyo/product/widgets/countdown/spec.json`
- `tokyo/product/widgets/logoshowcase/spec.json`
- `bob/lib/compiler/editor-contract.ts`
- `bob/lib/compiler.shared.ts`
- `bob/lib/compiler.server.ts`

Deleted from current widget specs:

- Top-level `html` editor DSL.
- Widget-authored `<bob-panel>`, `<tooldrawer-cluster>`, `<tooldrawer-field>`, and `@slot:` strings.
- Escaped nested ToolDrawer templates.

Surviving authority:

- `spec.json.defaults` owns saved default state.
- `spec.json.editor` owns Builder panels, clusters, fields, shared controls, templates, and `showIf`.
- `widget.html` remains the runtime template.
- `compiled.controls` remains the edit allowlist for manual edits and Copilot.

Verification:

- Node spec inspection confirms all three widgets have `editor`, no `html`, and no legacy DSL strings.
- Local compiler smoke against local Tokyo/Dieter stencils:
  - `countdown`: 5 panels, 134 controls.
  - `faq`: 5 panels, 139 controls.
  - `logoshowcase`: 5 panels, 107 controls.
- `./node_modules/.bin/tsc -p bob/tsconfig.json --noEmit`
- `corepack pnpm --filter @clickeen/bob lint`
- `corepack pnpm --filter @clickeen/bob build`

## Slice 2 - Bob Compiler Strictness

Status: GREEN

Deleted from the compiler product path:

- `@slot:` marker injection.
- Path-prefix cluster label inference (`stage.*`, `pod.*`, `layout.item*`, etc.).
- Appearance cluster splitting based on path inspection.
- Typography panel strip-and-reinject behavior.
- Product-path dependency on `widgetJson.html`.

Added:

- Structured editor contract validation in `bob/lib/compiler/editor-contract.ts`.
- Explicit compiler failure when a widget spec is missing `editor`.

Verification:

- Negative compiler smoke: removing `editor` from FAQ fails with `[BobCompiler] faq spec.json missing editor object`.
- Deletion scan:
  - `rg "@slot:|PANEL_SLOT|buildHtmlWithGeneratedPanels|rewriteAppearanceCluster|classifyLayoutClusterLabel|stripUnusedSlotMarkers|injectAtSlot|widgetJson\\.html|spec\\.json\\.html" bob tokyo/product/widgets/countdown tokyo/product/widgets/faq tokyo/product/widgets/logoshowcase -S`
  - No matches.

## Slice 3 - Theme Truth And Compiler Remote Dependency

Status: GREEN

Changed:

- Bob compiler now imports local `tokyo/product/themes/themes.json`.
- Missing or malformed local theme truth throws `[BobCompiler] Local theme registry is missing or malformed`.

Deleted:

- Remote `${tokyoBase}/themes/themes.json` fetch from the Builder compile path.
- Silent `themeRegistry = null` fallback.

Verification:

- Deletion scan confirms the only theme registry source in Bob compiler is the local JSON import.
- Bob build and local compiler smoke both passed with local theme truth.

## Slices 5, 6, And 7

Status: DEFERRED BY EVIDENCE

Decision:

- Slice 5 shared runtime contract is not executed in this pass. Slice 0 found shared runtime size, but no concrete product-boundary bug blocking the authoring contract hard cut.
- Slice 6 Dieter remains investigation-only. No Dieter implementation is authorized by PRD 087.
- Slice 7 Roma direct-instance audit is not executed in this pass. Slice 0 did not find a concrete mixed-responsibility bug in the Roma open/save path.

Why:

- PRD 087 explicitly says file size alone is not a product-boundary violation.
- The product-critical path was the widget editor contract and compiler behavior; that path is now hard-cut and verified.

## Final Verification

Status: GREEN

Commands:

- `git diff --check`
- `PATH=/tmp/clickeen-bin:$PATH corepack pnpm typecheck`
- `PATH=/tmp/clickeen-bin:$PATH corepack pnpm lint`
- `./node_modules/.bin/tsc -p bob/tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p berlin/tsconfig.json --noEmit`
- `corepack pnpm --filter @clickeen/bob lint`
- `corepack pnpm --filter @clickeen/bob build`

Targeted product-path checks:

- All current widget specs (`faq`, `countdown`, `logoshowcase`) have `editor`, no `html`, and no legacy editor DSL strings.
- Bob compiler smoke compiled all three widgets against local Tokyo/Dieter stencils.
- Local Bob compiled-widget API route returned 200 for all three widgets:
  - `countdown`: 5 panels, 134 controls.
  - `faq`: 5 panels, 139 controls.
  - `logoshowcase`: 5 panels, 107 controls.
- Negative compiler smoke confirmed missing `editor` fails visibly.
- Product-code drift scan found no surviving `@slot:`, legacy `spec.json.html`, slot injection, path-prefix inference helpers, remote theme fallback, or fake `gate.ts` code path.
- Canonical docs were updated so `spec.json` is documented as defaults + structured Builder editor contract, not ToolDrawer markup.

Notes:

- Root `pnpm typecheck` and `pnpm lint` require a plain `pnpm` binary on PATH because Turbo spawns it internally. This machine only had `corepack pnpm`, so verification used a temporary `/tmp/clickeen-bin/pnpm` shim that delegates to `corepack pnpm`.
