# 106B Peer Review - Widget Package Composition Contract

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106B__PRD__Widget_Package_Composition_Contract.md`

## Review Lens

Page Composer only works if widget packages are boring.

For Clickeen Pages, a widget package must be a stable generated product artifact:

```text
index.html
styles.css
runtime.js
```

Page Composer should read those files, extract one widget fragment, concatenate or dedupe safe CSS/runtime contributions, and write one page package. It must not inspect widget source, Bob contracts, overlays, config internals, or invent a second renderer.

## Consolidated Verdict

106B is architecturally correct but not execution-ready.

The right direction is clear:

- one generated widget package shape;
- no iframe stacking;
- no block renderer;
- no page-specific widget source snapshots;
- no `window.CK_WIDGET` duplicate truth;
- Page Composer consumes generated widget output only.

The missing pieces are contract details that determine whether this can scale:

- first-paint HTML is required; final execution moved widget package emission to Builder/Roma save and Tokyo package storage/readiness;
- runtime initialization is still descriptive, not a callable interface;
- fragment extraction lacks exact success/failure rules;
- current widget CSS is not composition-safe;
- page placement of unpublished widgets is unresolved;
- package consistency during concurrent recomposition is not defined.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- Keeps the generated widget package as the only Page Composer input.
- Avoids a new block/section product substrate.
- Treats the single-widget public page and composed page as the same artifact shape with a different instance count.
- Correctly pushes toward `CK_WIDGETS[instanceId]` as the only payload authority.

Blocking gaps:

- Current generated `index.html` is mostly a source shell. Saved content is serialized into `runtime.js`, which means the page fragment is not real first-paint content.
- Current widget clients still auto-boot around `document.currentScript`. That breaks once runtimes are concatenated into one page runtime.
- Current runtime still emits and reads `window.CK_WIDGET`.
- Current CSS owns document-level selectors such as `:root`, `html`, `body`, `.stage`, and `.pod`.

### Architecture / Tenet Compliance

Compliant:

- Page Composer does not read private widget files.
- Widget instance remains the product unit.
- Page output is generated, edge-servable static artifact work.

Not compliant yet:

- The package contract still allows runtime self-discovery instead of an explicit root-scoped initializer.
- The fragment boundary is not strict enough for a materializer to fail fast.
- The PRD does not state whether iframe-shaped widgets are page-compatible. For this direction, page composition should reject iframe-shaped widgets instead of preserving that mode.

### Overarchitecture / Gold-Plating Risks

Do not turn 106B into:

- a JavaScript bundler;
- a dependency graph;
- a fourth generated package file;
- a generic rendering framework;
- a parser that understands widget semantics.

The simple V1 is ordered source absorption:

```text
extract html fragment
dedupe exact shared CSS/runtime chunks
append scoped widget CSS
append root-scoped widget initializers
boot each placed root from CK_WIDGETS[instanceId]
```

### Simple / Boring Path

Make this a hard interface gate:

- DOM parse generated `index.html`;
- require exactly one extractable root;
- reject fragments with `script` or document `link` tags;
- require `init(root, payload, context) -> cleanup?`;
- reject `CK_WIDGET`;
- prove two instances of the same widget type can initialize independently in one document.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- Preserves the user-facing model: users create widgets, then stack those widget instances into pages.
- Keeps Page Composer invisible to users. It just compiles a clean page.
- Protects SEO/GEO by requiring visible first-paint HTML.
- Avoids the bad UX of many iframe boxes stacked on one page.

User-facing risks:

- If page sections must be individually published standalone widgets, users may accidentally expose section URLs or hit publish/cap confusion.
- If first-paint HTML is not real saved content, pages can show placeholders to crawlers and users before JavaScript.
- If each placed widget keeps its own locale switcher, a page with many widgets can show many competing locale controls.
- If runtime cleanup is weak, repeated timers/carousels/countdowns can create visible page instability.

### Architecture / Tenet Compliance

Compliant:

- Builder remains the authoring surface for widgets.
- Page Composer composes existing product units instead of creating a fake block mode.
- Entitlement and policy decisions stay outside the generated package contract.

Needs tightening:

- Decide whether placed widgets must be standalone-published, or whether Tokyo creates private renderable packages for composition.
- Define one page-level locale behavior before localized pages ship.
- Add acceptance tests that assert saved content appears in generated HTML before JavaScript runs.

### Overarchitecture / Complexity

Keep out of 106B:

- social share behavior;
- personalization;
- A/B tests;
- page override authoring;
- runtime feature flags;
- generic package registry theory.

106B should only make the generated widget package absorbable.

### Simple / Boring Product Path

The PM-safe sequence is:

```text
make one widget package reliable
prove one package can be absorbed
prove many packages can sit together
then let Roma build pages from those packages
```

That keeps the user story simple: a page is a stack of existing widgets.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- Static widget packages composed into static page packages are cheap to serve.
- Edge serving stays simple: public pages serve generated files, not request-time assembly.
- Clickeen avoids a second renderer and avoids iframe performance debt.

Blocking operational gaps:

- Package coherence is undefined. Page Materializer can read mixed old/new `index.html`, `styles.css`, and `runtime.js` while a widget is being rewritten.
- Cache invalidation is named for widget publish today, not page recomposition after widget save.
- Current Tokyo public serving behavior uses artifact existence as the serving gate, so composition-only packages can accidentally become standalone public widgets.

### Systems That Talk To Each Other

The system boundaries should be:

- Builder/Roma save writes widget packages; Tokyo stores and verifies them.
- Roma Composer lets users choose and order widget instances on a page.
- Tokyo Page Materializer reads generated widget packages and writes page packages.
- Edge serves generated page packages.

No subsystem should invent a new page/widget truth.

### SaaS-Grade Technical Bar

For millions of users, 106B needs:

- package revision or atomic staging/promotion;
- exact fragment extraction failures;
- CSS leakage gates;
- runtime multi-instance smoke tests;
- no request-time composition;
- no account-wide scan to discover page dependencies.

### Recommended Sequence

Recommended dependency order:

```text
106A cleanup
106B package contract gates
106E Roma/page source can proceed in parallel but cannot publish pages yet
106F materializer/recomposition
106G edge serve/cache/SEO
```

106B must be green before 106F treats generated widget packages as stable inputs.

## Consolidated Required PRD Decisions

Before executing 106B, decide:

1. **Renderable Package Boundary**
   - Are page placements allowed only from published widget instances?
   - Or does Tokyo create private composition packages that are not standalone-served by `clk.live`?

2. **First-Paint Rendering Authority**
   - Builder/Roma package output must carry saved instance state into `index.html`.
   - The generated HTML cannot be only a placeholder shell plus runtime payload.

3. **Fragment Extraction Contract**
   - Define the exact selector.
   - Require exactly one root.
   - Require widget type and instance id attributes.
   - Strip or reject `script` and document `link` tags inside the fragment.
   - Fail on zero or multiple roots.

4. **Runtime Entrypoint Contract**
   - Use one callable root-scoped initializer:

```text
init(rootEl, generatedPayload, context) -> cleanup?
```

   - `CK_WIDGETS[instanceId]` is the only payload authority.
   - `window.CK_WIDGET` must not be emitted or read.

5. **CSS Composition Contract**
   - No page-level `body/html/:root` ownership in composed CSS.
   - Shared Stage/Pod CSS emitted once or deduped.
   - Widget CSS scoped by widget root/class.
   - Fixed/floating shell behavior must be rejected or normalized before page composition.

6. **Page Locale Behavior**
   - Decide whether composed pages suppress per-widget locale switchers in V1.
   - If pages support localization, page-level locale must be the authority.

7. **Package Coherence**
   - Add package revision/hash across all three files, or use atomic staging then promotion before Page Materializer reads.

8. **Verification Fixture**
   - Add a composed test fixture with repeated and mixed widget types.
   - Include two instances of the same widget type to catch global runtime collisions.

## Suggested Acceptance Gates

106B should fail if:

- generated `index.html` does not contain saved visible content before JavaScript;
- generated runtime emits or reads `window.CK_WIDGET`;
- fragment extraction finds zero or multiple roots;
- extracted fragment contains `script` or document `link` tags;
- composed CSS includes leaking `body`, `html`, or `:root` rules outside approved shared shell output;
- runtime depends on `document.currentScript` for composed initialization;
- two instances of the same widget type cannot initialize independently in one document;
- widget package reads are not coherent across `index.html`, `styles.css`, and `runtime.js`.

## Decision Status

Do not execute 106B as-is.

Keep the direction, but amend the PRD into a strict package contract before 106F depends on it. This is the interface that decides whether Clickeen Pages stay simple at scale or collapse into page-specific renderer work.
