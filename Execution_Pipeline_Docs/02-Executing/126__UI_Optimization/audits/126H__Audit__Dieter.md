# 126H - Current-Source Pre-Execution Audit: Dieter

Status: STEP 6 COMPLETE - current-source audit and Step-7 plan independently
reviewed green at exact tree `4c5458b4`; no Step-9 execution credit.
PRD: `../126H__PRD__Dieter.md`.

## Audit Question

What Dieter substrate work is still real in current source, and which findings
belong to another 126 owner instead of becoming a new token system or catch-all
refactor?

## Authority Gate

| Authority | Current owner |
| --- | --- |
| Dieter source | `dieter/tokens/**`, `dieter/components/**`, `dieter/icons/**`. |
| Generated Dieter output | `tokyo/product/dieter/**`, produced only by `scripts/build-dieter.js`. |
| Public widget package source | `tokyo/product/widgets/**`; shared shell source is git-authored product source, not generated Dieter output. |
| Package/build operations | 126G for `dieter/package.json`, complete source/package/workspace/lockfile provenance, source-derived generated-output parity, ignored generated output, scoped dirty-tree manual remote refusal, and build-before-R2-sync ordering. |
| DevStudio product surface | 126L for `admin/**` visual and interaction changes. |
| Component/layer behavior | 126I and 126K for component shadows and layering. |
| Product data | Account instance packages and `accounts/**`; not mutated by 126H. |
| Verification | Source search, Dieter typecheck, Roma byte-exact package test, normal Git deploy, and R2 product-source read-back when Step 9 changes deployed source. |

## Commands And Checks

The current-source pass inspected the package, component catalog, source and
generated token consumers, shared widget source, Admin/DevStudio consumers,
living docs, and current workflow/build ownership. It ran:

```bash
find dieter/components -mindepth 1 -maxdepth 1 -type d
node -e "const m=require('./tokyo/product/dieter/manifest.json'); console.log(m.components.length)"
rg -n -- '--hspace-|--vspace-|--radius-[234]|--focus-ring-width|--focus-ring-offset|--min-touch-target|--color-surface|--shadow-lg' \
  dieter admin roma prague bob tokyo/product/dieter tokyo/product/widgets
rg -n "@clickeen/ck-contracts|tldts|gsap" dieter bob
pnpm --filter @ck/dieter typecheck
pnpm --filter @clickeen/roma test:instance-package
```

Dieter typecheck passed. Roma's byte-exact package matrix passed for all eight
current widget packages. The pre-existing untracked `tokyo/product/fonts/` was
not touched.

## Proven Current State

### Foundation and catalog are already converged

- `dieter/components/` has 25 source directories including non-rendered
  `shared/`; the generated manifest has 24 CSS-backed runtime components.
- Current foundation source has the real `--space-*`, `--vertspace-*`, control
  size/gap/radius, icon size, three shadow, two duration, easing, `.sr-only`, and
  reduced-motion substrate described by the living docs.
- Numeric radius aliases, stale `--hspace-*`/`--vspace-*`,
  `--color-surface`, foundation focus width/offset, and touch-target tokens are
  absent from Dieter, generated Dieter, Admin/DevStudio, Roma, and Prague active
  source.
- `--shadow-elevated` has real Roma/Prague consumers and remains current law.
- Raw component shadows and raw z-index values remain real, but their behavior
  belongs to 126I/126K. 126H must not invent elevation levels or `--z-*` tokens.

No Dieter foundation-token source change remains for 126H itself. Premature
cleanup is current input, not Step-9 execution credit.

### One live stale focus-width consumer remains

`tokyo/product/widgets/shared/socialShare.css` still contains:

```css
outline: var(--focus-ring-width, 2px) solid ...;
```

The Dieter token no longer exists and is not product doctrine. The fallback
already makes effective runtime width `2px`, so Step 9 replaces only the stale
reference with literal `2px`. This is vocabulary cleanup with no visual or
interaction change. The byte-exact fixture
`roma/tests/fixtures/124c-base-package-expected.json` contains the materialized
shared CSS and must be updated mechanically, then the all-widget package test
must remain green.

This does not authorize a focus framework or removal of visible focus. The
widget keeps its existing visible `:focus-visible` outline.

### One DevStudio fallback masks an undefined shadow token

`admin/src/css/utilities.css` styles the token editor panel with
`var(--shadow-lg, <raw shadow>)`. `--shadow-lg` does not exist. The raw fallback
hides the broken substrate name.

The token editor is a 126L-owned DevStudio surface and `--shadow-elevated` is the
current shared role for an elevated panel. 126L must replace the masked name
with `var(--shadow-elevated)` and browser-verify the token editor. 126H records
and routes the defect; it does not edit the DevStudio surface twice.

### Dieter package metadata has three false surfaces, owned once by 126G

Current `dieter/package.json`:

- declares unused `gsap`;
- declares `main: index.html`, but `dieter/index.html` does not exist;
- runs `prepare: pnpm run build`, which regenerates deployed product output
  during dependency installation.

`@clickeen/ck-contracts` and `tldts` are real dependencies with current source
imports and must stay. 126G owns one package edit that removes GSAP, false
`main`, and install-time `prepare` while preserving explicit `build` and
`typecheck`. 126F owns the motion reason for GSAP deletion; 126H owns the honest
package-shape finding; neither edits the same file again.

The target package is a build/typecheck task package with no claimed
programmatic entrypoint. No replacement registry or entrypoint is needed.

### Generated/deployed boundaries remain simple

- Dieter source changes produce `tokyo/product/dieter/**` only through the root
  builder.
- 126G includes `pnpm-workspace.yaml` beside root package/lock inputs in
  provenance, workflow triggers, and dirty-tree refusal, and fails when the
  source-derived expected output set or copied bytes differ from generated
  output.
- The shared social-share CSS is git-authored widget package source under the
  existing Tokyo product root; it is not generated Dieter output.
- 126G's ignored generated-output and single build-before-sync path must be green
  before this widget source can sync to R2, because every product-root sync also
  uploads Dieter.
- Existing published account instance packages are product snapshots. The
  stale variable currently resolves to the same `2px` value, so 126H does not
  silently rematerialize account product data for a no-behavior source cleanup.

## Exact Step-7 Disposition

| Area | Integrated Step-9 disposition | Must not do |
| --- | --- | --- |
| Shared widget focus width | In `tokyo/product/widgets/shared/socialShare.css`, replace `var(--focus-ring-width, 2px)` with literal `2px`; update the byte-exact Roma fixture; run the all-widget package matrix. | Do not restore the deleted Dieter token, remove visible focus, or add focus machinery. |
| DevStudio token-editor elevation | 126L replaces undefined `--shadow-lg` plus raw fallback with current `--shadow-elevated` and browser-verifies the panel. | No new shadow token, local alias, or duplicate 126H edit. |
| Dieter package metadata and output | 126G performs the one package edit removing Dieter GSAP, false `main`, and install-time `prepare`; real dependencies and explicit scripts stay. It owns complete package/workspace/lock provenance and the one source-derived output parity assertion. | No second package edit in 126F/126H and no new entrypoint, registry, or manifest. |
| Foundation/tokens | Preserve and verify current source truth. | No new scale, alias, focus/touch doctrine, or repeated cleanup. |
| Component shadows/layering | Route exact current files to 126I/126K. | No elevation system or `--z-*` family in 126H. |
| Generated Dieter output | Changes only when an owning source slice changes and runs the builder. | No hand edit or duplicate H-only rebuild. |
| Product data | No mutation. | No direct R2 account edit or silent rematerialization of published snapshots. |

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | OPEN UNTIL STEP 9 | Delete the stale focus variable reference directly; do not invent a replacement token. |
| V2 Silent healing | PASS | Existing effective `2px` behavior is named; no persisted state is normalized. |
| V3 Silent omission | OPEN UNTIL STEP 9 | Shared widget source, byte-exact fixture, DevStudio fallback, package metadata, generated boundary, and owning handoffs are all mapped. |
| V4 Fail-open control | OPEN UNTIL STEP 9 | Remove fallback-masked `--shadow-lg`; 126L must consume the real current token. |
| V5 Corruption-as-absence | PASS | Broken token names are treated as defects, not ignored as missing. |
| V6 Partial-success masquerade | PASS | Premature token cleanup receives no execution credit; 25/24 counts and real token consumers are explicit. |
| V7 Masquerade/redress | PASS | No compatibility aliases, renamed focus token, package wrapper, or new elevation system is allowed. |
| V8 Runtime test dependency | PASS | Source carries behavior; byte-exact and browser checks only verify it. |

## Step-8 Review Questions

1. Is replacing the stale widget focus-width reference with its current `2px`
   fallback the complete behavior-preserving cleanup?
2. Does the byte-exact fixture/test blast radius cover every current widget
   package that embeds shared social-share CSS?
3. Are the `--shadow-lg` and Dieter package findings assigned once to 126L and
   126G without leaving another active legacy path?
4. Does the plan preserve real `@clickeen/ck-contracts`, `tldts`,
   `--shadow-elevated`, `.sr-only`, and published product-data authority?
