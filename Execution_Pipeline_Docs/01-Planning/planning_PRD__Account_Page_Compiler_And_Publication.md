# Planning PRD — Account Page Compiler And Publication

Status: Planning — requires peer review and product-owner approval before execution
Owner: Roma / Page Compiler
Date: 2026-08-02
Carries forward: unfinished Page Composer compiler and publication work from historical PRD 106B and PRD 110 peer review
Unlocks: real Clickeen Page publishing, public Page serving, and the Prague composed-page migration

## Purpose

Build the missing compiler that turns one account-owned Page source plus its
ordered saved widget instances into one optimized, browser-readable Page
package stored in R2 and served through the existing `clk.live` boundary.

The product model is already established:

```text
Widget = software
Instance = one saved, account-owned configured widget
Page = one account-owned ordered composition of saved instances
```

Roma currently manages Page source but cannot publish a Page. The missing
boundary is:

```text
Roma Page source
+ exact saved instance packages
→ Roma Page Compiler
→ one optimized Page package
→ Tokyo-worker stores and serves exact bytes
```

This PRD owns that missing compiler, the publish path it enables, and automatic
recomposition when a placed instance changes. It does not create a website
builder, block system, layout engine, graph service, queue platform, or second
widget renderer.

## Why This PRD Exists After PRD 106B

Historical PRD 106B described the intended Page Composer and recorded its
steps as green. Current runtime and canonical documentation prove that its
compiler/publication result does not survive:

- Roma saves only Page `source.json`.
- `roma/components/pages-domain.tsx` hard-codes Page publishing as unavailable.
- Roma's Page publish route always returns
  `coreui.errors.page.publishUnavailable`.
- Tokyo-worker also rejects Page publish because no real Page package is
  submitted.
- Tokyo-worker parses the public Page URL but returns `404`.
- Canonical documentation correctly states that public Page serving is
  disabled until Roma writes Page packages.

PRD 106B remains historical design and execution evidence. It is not current
runtime authority. This Planning PRD carries forward only the unfinished
compiler/publication work and refreshes it against the current codebase.

## First Planning Review

### 1. Does this use elegant engineering and scale across hundreds of widgets?

Yes, if the compiler consumes the existing generic saved-package contribution
contract:

- one stamped widget root;
- stable CSS module markers;
- one per-instance runtime payload;
- stable runtime module markers;
- exact saved-package fingerprints.

The compiler must not contain widget-type branches. A new compliant widget
requires no Page Compiler code change. Shared modules are deduplicated by their
declared module identity and exact bytes.

### 2. Is it compliant with Clickeen architecture and tenets?

Yes:

- Roma owns Page product meaning, compilation, readiness, and account policy.
- Bob continues to edit one widget instance.
- The existing runtime materializer remains the widget package authority.
- Tokyo-worker stores and serves exact submitted bytes without composing Pages.
- R2/CDN remains the public delivery path.
- Public requests never compose, fetch, or repair Page source.

### 3. Does it avoid over-architecture?

Yes, with the following explicit constraints:

- no graph service;
- no queue platform;
- no reverse-placement database or derived fast-path index in this PRD;
- no Page-specific widget registry;
- no compatibility compiler;
- no visitor-time composition;
- no parallel legacy publication path.

Affected Pages are found by scanning the current account's saved Page sources
and selecting placements that reference the saved `instanceId`. That is the
current source of truth and is sufficient for the current Page product.

### 4. Does it move Clickeen toward the intended architecture?

Yes. It completes the existing structured Page model and turns it into stored,
cacheable public output without copying widget source into Page source or
turning Tokyo into a renderer.

## Authority Gate

| Concern | Active authority |
| --- | --- |
| Product surface | Roma Pages |
| Account/session coordinate | Berlin bootstrap → Roma current `accountPublicId` |
| Page source and composition decisions | Roma |
| Individual widget instance editing | Bob |
| Saved instance package bytes | Tokyo-worker/R2, written through Roma instance routes |
| Widget package materialization contract | `@clickeen/ck-runtime-materializer` + Widget Shell markers |
| Page compiler | New Roma-owned compiler package/module |
| Page storage and public bytes | Tokyo-worker/R2 |
| Public Page route | Tokyo-worker `clk.live` Page coordinate |
| Deploy surface | Roma Pages + Tokyo-worker Worker |
| Verification surface | Roma routes/UI, Tokyo-worker internal/public routes, exact R2 coordinates |

If execution discovers that any of these authorities must move, execution
stops and this PRD must return to Planning.

## Current Source And Storage Contract

Current Page source is authoritative and remains intentionally small:

```ts
type AccountPageSource = {
  pageId: string;
  accountPublicId: string;
  displayName: string;
  metadata: {
    title: string;
    description: string;
    robots: 'index,follow' | 'noindex,nofollow';
    canonicalUrl?: string;
  };
  localization: AccountPageLocalization;
  placements: Array<{
    placementId: string;
    instanceId: string;
  }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
```

Page source must continue to contain references, not copied widget state:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
```

The intended public package remains:

```text
accounts/{accountPublicId}/pages/{pageId}/index.html
accounts/{accountPublicId}/pages/{pageId}/styles.css
accounts/{accountPublicId}/pages/{pageId}/runtime.js
accounts/{accountPublicId}/pages/{pageId}/serve-state.json
```

The compiler also needs exact build evidence. This PRD proposes one private
file beside the package:

```text
accounts/{accountPublicId}/pages/{pageId}/build.json
```

`build.json` is compiler evidence, not Page source or product configuration. It
contains only:

- compiler contract version;
- Page source revision/fingerprint;
- each placement id, instance id, and exact saved-package fingerprint;
- final Page package fingerprint;
- build timestamp.

It must not contain widget content, Page policy, retries, jobs, dependency
graphs, readiness prose, error logs, or copied source documents.

## Product Decisions Locked By This PRD

1. A Page placement references the current saved instance by `instanceId`.
2. Page source never embeds or overrides instance config/content.
3. The Page Compiler consumes exact saved instance package bytes. It does not
   silently rebuild an instance from newer widget software.
4. Compilation happens on Page save/publish and after a referenced instance is
   saved. It never happens on a public visitor request.
5. The public Page is one initial HTML document, not stacked iframes and not a
   client-only loader.
6. Shared CSS and JavaScript are emitted once per exact module contribution,
   not once per placement.
7. Per-instance content, state, identity, and runtime payload remain isolated.
8. A draft Page may contain materialized unpublished instances.
9. Page publish is blocked when the Page is empty or any placed instance is
   missing, malformed, unmaterialized, or unpublished.
10. Saving a placed instance automatically recomposes every affected Page in
    the same account.
11. A published Page keeps its public URL; the user never needs a new embed or
    URL after recomposition.
12. If a recomposition fails, the last complete public package may continue to
    serve, but Roma must show that the Page is out of date. It must not present
    stale output as current.
13. No reverse-placement index or graph service is introduced. Roma scans the
    account's current Page sources.
14. Tokyo-worker stores, selects, and serves exact bytes. It does not resolve
    instances, deduplicate modules, or decide Page readiness.
15. This compiler slice publishes only the account base/default locale. Page
    source may retain future localization settings, but publish is blocked when
    IP localization, country rules, or the Page language switcher are enabled.
    Multi-locale Page packages require a separate approved PRD.

## Explicit Non-Goals

- A visual website builder.
- Free-form blocks, columns, sections, slots, or arbitrary layout trees.
- Per-Page overrides of widget instances.
- Editing widget content inside the Pages domain.
- Customer site navigation, domains, route maps, headers, or footers.
- Prague route migration.
- Advanced structured-data merging.
- Open Graph or Twitter metadata expansion.
- Multi-locale Page packages, IP localization, country routing, and the Page
  language switcher. Existing source fields may remain editable planning data,
  but any enabled advanced localization setting blocks publication until a
  separate approved localization execution spec exists.
- Nested-instance graph machinery. Current materialized dependencies remain
  evidence, but nested Page composition requires a separately proven product
  use case.
- Page tier-policy changes; compiler execution must honor the active policy but
  must not invent new limits.

## Compiler Input Contract

For every placement, Roma loads the exact saved instance package from the same
account coordinate:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
accounts/{accountPublicId}/instances/{instanceId}/serve-state.json
```

The compiler accepts an instance only when:

- the instance belongs to the current account;
- all three generated browser files exist;
- the package contains exactly one valid stamped widget root;
- CSS chunks use the existing exact style-module markers;
- JavaScript contains exactly one valid payload for the instance;
- runtime chunks use the existing exact runtime-module markers;
- the package fingerprint can be computed from exact stored bytes;
- the instance is published when compiling for Page publication.

For this compiler slice, `pageSource.localization.defaultLocale` must equal the
account base locale at publication time. IP localization must be false, country
rules must be empty, and the language switcher must be false. Draft save may
preserve those source fields, but publication fails visibly rather than
inventing an incomplete locale delivery model.

Missing or malformed input fails compilation. The compiler never drops the
placement, substitutes another instance, repairs markers, or rematerializes
from newer widget software.

## Compilation Algorithm

### 1. Validate Page source

- Validate the current account and Page coordinate.
- Validate metadata, localization, revision, and placement shape.
- Preserve placement order exactly.
- Reject duplicate placement ids.
- Reject duplicate instance placements under the current product rule.

### 2. Resolve exact instance packages

- Load all placed packages through the Roma → Tokyo-worker account route.
- Verify each returned package belongs to the requested account and instance.
- Compute one deterministic fingerprint for each complete saved package.
- Extract contributions using shared parser functions owned beside the current
  runtime materializer contract. Do not implement ad-hoc parsing in a Page UI
  component or API route.

### 3. Build one dependency map

For each placement, collect:

- stamped root HTML;
- style chunks keyed by module id;
- the exact per-instance runtime payload;
- runtime chunks keyed by module id.

Deduplication rule:

```text
same module id + same exact bytes → emit once
same module id + different bytes → fail compilation
different module ids → preserve both
```

The compiler must not pick one conflicting module, rename it, or continue.

### 4. Emit one HTML document

The output contains:

- one doctype and `<html>` element;
- one `<head>` with approved Page metadata;
- one stylesheet reference;
- one ordered Page main container;
- one semantic placement wrapper/root per saved instance contribution;
- one deferred runtime reference.

The compiler strips the instance package document shell. It preserves each
validated stamped widget root and placement order. It does not place full
instance `<html>`, `<head>`, or `<body>` documents inside the Page.

Primary Page content must be present in initial HTML.

### 5. Emit one stylesheet

`styles.css` contains:

1. the minimal Page stack layout;
2. each exact shared Shell style module once;
3. each exact Widget Core style module once;
4. any exact instance-specific style contribution once.

The compiler does not rewrite selectors, invent Page theme tokens, or flatten
scoping. Existing widget roots remain the style-isolation coordinate.

### 6. Emit one runtime

`runtime.js` contains:

1. every per-instance payload keyed by its exact instance identity;
2. each exact shared Shell runtime module once;
3. each exact Widget Core runtime module once;
4. one deterministic initialization order compatible with placement order.

Modules must operate correctly with multiple instances in one document. A
module that assumes singleton global state fails certification and blocks Page
publication; the Page Compiler must not wrap or patch it locally.

### 7. Emit build evidence

The compiler computes the final package fingerprint and emits `build.json`.
Given identical Page source and identical instance package bytes, compilation
must produce byte-identical `index.html`, `styles.css`, and `runtime.js`.
`build.json` may differ only in `builtAt`.

## Instance Update And Recomposition

The current placement shape stores `instanceId`, not a frozen revision. The
Page therefore follows the current saved instance.

When Bob saves an instance:

```text
1. Roma validates and materializes the new instance package.
2. Roma saves the complete instance through the existing instance route.
3. Roma lists current Page sources for the account.
4. Roma selects Pages whose placements reference the instance id.
5. Roma recompiles only those Pages.
6. Successful Page builds replace their prior complete packages.
7. Published Pages keep their existing public coordinate.
8. Roma returns exact affected-Page results.
```

No account Pages means no Page compilation work.

The instance save response must not masquerade as full propagation success. It
must distinguish:

- instance saved and all affected Pages updated;
- instance saved and specific affected Pages remain out of date;
- instance save failed before any Page work began.

The last successful `build.json` provides durable comparison evidence. A Page
is out of date when its recorded Page revision or recorded instance package
fingerprints do not match current truth. This avoids inventing a separate job,
retry, or readiness-state platform.

Retry is a direct Roma Page recompile command for the named Page. It is not a
background queue or polling workflow.

## Page Save And Publish Behavior

### Draft save

- Save validates Page source and exact materialized instance packages.
- Draft composition may include unpublished instances.
- Save writes the new source and complete draft Page package together through
  the approved package operation.
- If compilation fails, source/package mutation must not be reported as a
  complete save.

### Publish

- Publish recompiles from current source and current exact saved packages.
- Publish fails for an empty Page.
- Publish fails if any placement is missing, malformed, unmaterialized, or
  unpublished.
- Publish activates only a complete verified Page package.
- Successful publish purges the exact public Page cache coordinate.

### Unpublish

- Unpublish changes serve state and purges the exact public Page cache.
- Page source and last successful package remain account-owned stored data.
- The public route stops serving the Page.

### Delete

- Published Pages must be unpublished before deletion.
- Delete removes Page source, package files, compiler evidence, and serve state
  for the exact Page coordinate.
- Delete never modifies placed widget instances.

## Public Delivery

Public Page URLs remain:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

Tokyo-worker serves only stored generated output after valid published serve
state. It must not:

- load Page source on a public request;
- fetch placed instances on a public request;
- concatenate widget packages;
- infer missing files;
- compile or repair Page output;
- serve an unpublished Page.

Cache headers follow the existing public artifact policy. Publication,
recomposition, unpublish, and delete purge the exact Page URL and support-file
coordinates only after the owning mutation succeeds.

## Blocking Planning Decision: Package Activation

R2 writes multiple objects independently. This PRD must not pretend that three
root-file writes are atomic.

Before moving to `02-Executing`, peer review and the product owner must approve
one exact activation contract:

### Option A — Current root files with verified write ordering

Write `styles.css`, then `runtime.js`, then `index.html`, verify all bytes, and
purge only after completion. This is the smallest change but cannot make the
three R2 object replacements truly atomic for uncached requests during the
write window.

### Option B — Immutable build folder plus one active-build pointer

Write all files under an immutable build fingerprint, verify them, then change
one active-build coordinate used by public serving. This provides atomic
activation and clean cache identity but adds one storage selection contract.

Recommendation: Option B, because it preserves last-good public output and
prevents mixed-version HTML/CSS/JavaScript without adding a job, graph, or
framework. It must remain an opaque storage selection in Tokyo; Roma still
owns the build fingerprint and Page readiness.

Execution is blocked until this choice is recorded in this PRD. An executing
agent must not choose between these options.

## Execution Checklist

### Code changes

- [ ] Record the approved package-activation contract.
- [ ] Extract shared, exact contribution parsers beside
  `@clickeen/ck-runtime-materializer`; do not duplicate marker parsing.
- [ ] Implement one Roma-owned Page Compiler with no widget-type branches.
- [ ] Implement deterministic HTML assembly.
- [ ] Implement exact CSS module deduplication and conflict failure.
- [ ] Implement per-instance payload consolidation and exact runtime module
  deduplication.
- [ ] Emit exact compiler/build evidence.
- [ ] Add Roma → Tokyo-worker package write/read contract.
- [ ] Enable Page publish/unpublish only after complete package verification.
- [ ] Enable Tokyo-worker public Page serving from stored generated files only.
- [ ] Recompose affected Pages after normal instance save by scanning current
  Page sources.
- [ ] Add a direct named Page recompile command for visible failures.
- [ ] Remove the unconditional Page publish stubs and
  `pagePublishingUnavailable` UI branch.
- [ ] Delete obsolete unavailable copy and tests that preserve the stub.

### Product data changes

- [ ] No direct account R2 mutation during code implementation.
- [ ] Create or update test Pages only through Roma account routes.
- [ ] Preserve existing Page sources exactly unless the product owner requests
  a named migration.
- [ ] Do not mark existing Pages published until a real package has compiled
  and been verified.

### Deploy/runtime verification

- [ ] Run focused materializer, Roma, and Tokyo-worker checks.
- [ ] Commit and push the complete cross-system change.
- [ ] Verify Roma Pages Git-connected deployment for the exact commit.
- [ ] Verify Tokyo-worker deploy through the owning GitHub Actions workflow.
- [ ] Create a Page with at least two instances of the same widget type and one
  different widget type.
- [ ] Prove shared CSS/runtime modules occur once.
- [ ] Prove all three instance roots and payloads remain isolated.
- [ ] Publish through Roma and verify exact public Page HTML/CSS/runtime.
- [ ] Edit one included instance in Bob and prove the same Page URL updates.
- [ ] Force one invalid contribution and prove compilation fails visibly while
  the last complete published package remains the only public output.
- [ ] Unpublish and prove the public Page stops serving.

### Documentation changes

- [ ] Update `documentation/architecture/CONTEXT.md` from publish-disabled to
  the exact compiler/publication lifecycle.
- [ ] Update `documentation/architecture/Overview.md`.
- [ ] Update `documentation/services/roma.md` with compiler ownership and
  instance-save recomposition.
- [ ] Update `documentation/services/tokyo-worker.md` with the approved package
  write/serve coordinates.
- [ ] Update `documentation/widgets/README.md` with the contribution contract.
- [ ] Update Cloudflare operation documentation only if the owning deployment
  or cache-purge path changes.
- [ ] Reconcile the historical PRD 106B claims without rewriting history.

## Verification Matrix

| Concern | Required proof |
| --- | --- |
| Determinism | Same source and instance bytes produce identical package bytes |
| HTML | One document, ordered stamped roots, primary content in initial HTML |
| CSS dedupe | Same module id/body emitted once |
| CSS conflict | Same module id/different body fails compilation |
| Runtime payloads | Every placement has exactly one isolated instance payload |
| Runtime dedupe | Same runtime module id/body emitted once |
| Runtime conflict | Same module id/different body fails compilation |
| Multi-instance safety | Two instances of one widget type operate independently |
| Account isolation | Cross-account instance reference fails before package write |
| Draft | Materialized unpublished instance may be placed and saved |
| Publish | Empty, missing, malformed, unmaterialized, or unpublished input blocks publish |
| Recomposition | Bob save updates every directly affected Page |
| Failure truth | Failed affected Page is reported and remains detectably out of date |
| Public serving | Same public URL serves new complete bytes after activation |
| Cache | Exact Page coordinates purge only after successful activation |
| Unpublish | Public route stops serving; private source/package remains |
| Delete | Exact Page folder data removed; instances unchanged |

## Blast Radius

Expected implementation areas:

- `packages/ck-runtime-materializer/**` for shared exact contribution parsing,
  only if the current package contract cannot expose it without duplication.
- A small Roma-owned Page Compiler module/package.
- `roma/lib/account-page-*` for compilation and package calls.
- `roma/lib/account-instance-*` or the exact instance save route for affected
  Page recomposition.
- `roma/app/api/account/pages/**` for save, publish, unpublish, and recompile.
- `roma/components/pages-domain.tsx` for removing unavailable state and showing
  direct current/out-of-date results.
- `tokyo-worker/src/domains/pages/**` for opaque package storage/activation.
- `tokyo-worker/src/routes/internal-page-routes.ts` for private package commands.
- `tokyo-worker/src/routes/clk-live-routes.ts` for stored public Page serving.
- Focused compiler, Roma Page, Tokyo Page, and public-serving tests.
- Canonical documentation named above.

Forbidden blast-radius expansion:

- Bob editor UI redesign.
- Widget Core behavior changes except fixing a proven multi-instance contract
  violation exposed by compiler certification.
- Prague route migration.
- New database, Durable Object, Queue, workflow engine, or graph service.
- New Page layout taxonomy beyond the existing ordered stack.

## V1–V8 Design Audit

| ID | Required compiler behavior |
| --- | --- |
| V1 Silent substitution | Missing/conflicting contributions fail; nothing is invented |
| V2 Silent healing | Invalid markers, roots, payloads, or source are not repaired |
| V3 Silent omission | Every placement must appear exactly once in the output |
| V4 Fail-open control | Publish fails when any required source/package/status proof fails |
| V5 Corruption-as-absence | Corrupt package/source/build evidence is an error, not an empty Page |
| V6 Partial-success masquerade | Instance save names every affected Page result; publish activates only a complete package |
| V7 Masquerade/redress | No old concatenate/stub path survives under a new compiler name |
| V8 Runtime test dependency | Public work depends on stored packages, never tests/probes/helpers |

## Acceptance Criteria

- Roma can compile and publish a non-empty Page composed of real saved account
  instances.
- The Page is one crawlable initial HTML document.
- Shared Shell and Widget Core CSS/runtime contributions are not repeated per
  placement.
- Instance-specific roots, data, locale identity, and runtime payloads remain
  exact and isolated.
- Same module identity with conflicting bytes blocks compilation.
- Tokyo-worker stores and serves only exact compiler output.
- Public serving performs no Page or instance composition.
- The same Page URL serves updated complete output after an included instance
  is saved.
- A failed recomposition is visible and the Page is detectably out of date.
- The last complete public package is never silently overwritten by an
  incomplete build.
- The unconditional Roma/Tokyo publish-unavailable stubs and UI branch are
  deleted.
- No reverse index, graph service, queue, compatibility compiler, stacked
  iframe path, or visitor-time composition is introduced.
- Canonical documentation matches the deployed behavior before execution is
  closed.

## Required Peer Review Verdict

Before this PRD can move to `02-Executing`, peer review must explicitly answer:

1. Is the saved widget package contribution contract sufficient for exact root,
   CSS-module, runtime-payload, and runtime-module extraction without a second
   widget renderer?
2. Does scanning current account Page sources remain acceptable at the active
   Page limits, with no reverse index?
3. Which package-activation option is approved?
4. Can the affected-Page result remain direct and synchronous without a queue
   at current limits?
5. Do the proposed tests prove deduplication and multi-instance behavior across
   every currently supported widget type?
6. Does the plan remain free of graph, status-machine, compatibility, and
   visitor-time composition machinery?

Until those questions are answered and the activation choice is recorded,
this document is Planning only and must not be executed.
