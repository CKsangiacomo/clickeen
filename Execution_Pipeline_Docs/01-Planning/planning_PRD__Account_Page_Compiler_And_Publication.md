# Planning PRD — Account Page Compiler And Publication

Status: Planning — alignment input to the future PRD 127; not independently executable

Owner: Roma / Page Compiler

Date: 2026-08-03

Carries forward: unfinished Page Composer compiler and publication work from historical PRD 106B and the PRD 110 review

Unlocks: Clickeen Pages, stable public Page URLs, and a future Websites product built from Pages

Related planning:

- `planning_PRD__System_SEO_GEO_AEO_Widget_And_Page_Surfaces.md`
- `planning_PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md`

This document owns the compiler and publication design input. The System
SEO/GEO/AEO PRD owns the surface-quality contract it must implement. The Prague
PRD owns migration proof and cutover constraints. Their accepted decisions must
be consolidated into PRD 127 before execution begins.

## Product Direction

Clickeen Pages is initially a single-page publishing product.

```text
Widget = reusable software
Instance = one saved, account-owned configured widget
Page = one account-owned ordered composition of saved instance references
```

A Page is not:

- copied widget HTML, CSS, or JavaScript;
- a browser-side stack of independent `clk.live` instance URLs;
- a navigation system or website route tree;
- generated code that a customer must paste again after every edit.

Page source remains a small ordered list of instance references. On publication,
the Page Compiler resolves those references and creates one coherent, optimized,
SEO-valid web document. Clickeen stores and hosts that document behind one
stable Page identity. The proposed first public path taxonomy is:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

The URL identifies the Page, not a particular build. Customers can link to it,
map it through future authorized host integrations, or later include it in a
Clickeen Website. They never become the source authority for copied compiler
output.

## Purpose

Implement the missing deterministic compiler and publication path:

```text
Roma Page source
+ exact saved instance packages
→ Roma Page Compiler
→ one semantic HTML document
+ one deduplicated stylesheet
+ one deduplicated runtime
+ build evidence
→ Tokyo-worker stores exact bytes in R2
→ clk.live serves the active successful build
```

The Page Compiler has three primary product responsibilities:

1. Construct one valid, crawlable and SEO-valid document from the Page and
   its instance content.
2. Consolidate and deduplicate CSS without weakening instance isolation.
3. Consolidate and deduplicate JavaScript while preserving independent instance
   behavior.

SEO is not an optional post-processing feature. Once Clickeen hosts the public
Page response, the compiler must enforce and materialize the approved
whole-document SEO/GEO/AEO contract.

## Why This PRD Exists

Historical PRD 106B describes an intended Page Composer and records its steps
as green. Current runtime and canonical documentation prove that the compiler
and public Page result do not exist today:

- Roma stores Page `source.json` but keeps Page publishing unavailable.
- Roma and Tokyo-worker reject Page publication.
- Tokyo-worker recognizes the public Page route but returns `404`.
- no active compiler creates the Page document, consolidated CSS, consolidated
  runtime, or Page SEO output.

Historical documents remain historical evidence. This PRD is the current
planning authority for the missing behavior.

## Authority Gate

| Concern                             | Active authority                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Product surface                     | Roma Pages                                                                    |
| Account/session coordinate          | Berlin bootstrap → Roma current `accountPublicId`                             |
| Page source and composition order   | Roma                                                                          |
| Instance content and configuration  | the referenced account Instance, edited in Bob                                |
| Saved instance package bytes        | Tokyo-worker/R2 through Roma instance routes                                  |
| Instance materialization contract   | `@clickeen/ck-runtime-materializer` and Widget Shell markers                  |
| SEO/GEO/AEO product contract        | System SEO/GEO/AEO planning, consolidated into PRD 127                        |
| Page compilation and validation     | Roma Page Compiler                                                            |
| Page package storage and activation | Tokyo-worker/R2                                                               |
| Public Page identity                | Tokyo-worker `clk.live` Page coordinate                                       |
| Public visitor delivery             | active stored Page package through `clk.live`/CDN                             |
| Deploy surfaces                     | Roma Pages and Tokyo-worker Worker                                            |
| Verification                        | Roma routes/UI, Tokyo-worker routes, public Page URL and exact R2 coordinates |

Tokyo-worker is an opaque storage and delivery authority. It must not interpret
Page source, resolve instances, generate SEO, or compose visitor responses.

If implementation proves that an authority must move, execution stops and this
PRD returns to Planning.

## Source Contract

The authoritative Page source remains intentionally small:

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

Storage coordinate:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
```

The source contains references and approved Page truth. It never contains
copied instance config, copied instance packages, generated HTML, generated CSS,
or generated JavaScript.

The current metadata schema is not yet sufficient for the full SEO contract in
this PRD. Before execution, the schema review must define only the additional
structured fields proven necessary for the first single-Page release. At
minimum the compiler needs approved authority for:

- title;
- description;
- robots;
- canonical URL;
- language and text direction;
- social title, description and image when social previews are enabled.

The compiler may derive `lang` and `dir` deterministically from the approved
Page locale registry. It must not invent marketing copy, image descriptions,
structured-data claims, canonical URLs, or social content.

## Locked Product Decisions

1. Page source stores ordered instance references, not copied widget output.
2. A placement follows the current saved account instance identified by
   `instanceId`.
3. The compiler consumes exact saved instance package bytes. It does not
   silently rebuild an instance from different widget software.
4. Compilation happens during Page publication and after a referenced instance
   is successfully saved. It never happens on a public visitor request.
5. Public output is one complete initial HTML document, not stacked iframes and
   not a client-only loader.
6. Primary Page content must be present in the initial response.
7. Shared CSS and runtime modules are emitted once per exact contribution, not
   once per placement.
8. Instance content, identity, data and behavior remain independently scoped.
9. Page publication fails if the Page is empty or any placement is missing,
   malformed, cross-account or unmaterialized. Whether a materialized Instance
   must also be independently published is an explicit open product decision;
   it is not a technical requirement of composition.
10. Saving an included instance recomposes every affected Page in that account.
11. A successful recomposition updates the same stable Page URL.
12. A failed recomposition never replaces the last complete public build. Roma
    must show that the published Page is out of date.
13. Affected Pages are found by scanning current account Page sources. This PRD
    adds no graph service, reverse index, queue or workflow engine.
14. This first release publishes the account base/default locale only. Enabled
    advanced localization blocks publication until its own approved contract
    exists.
15. A Page has no customer navigation, shared header/footer, site route tree or
    Website model in this release.
16. A future Website may map multiple routes to stable Page identities and add
    shared navigation, chrome, domains and site-wide SEO without replacing the
    Page Compiler.

## Explicit Non-Goals

- Website authoring or arbitrary site hosting.
- Menus, navigation hierarchies, shared headers or shared footers.
- Multi-Page route management, sitemaps or site-wide `hreflang` generation.
- A free-form block, section, slot, column or layout-tree system.
- Per-Page overrides of referenced instance content.
- Editing instance content in the Pages domain.
- Copying generated Page code into customer systems as a second source.
- Platform-specific Shopify, WordPress, Wix or other publication adapters.
- Prague route cutover.
- Visitor-time Page or instance composition.
- Multi-locale output, IP localization, country routing or Page language
  switching.
- A dependency graph, Queue, Durable Object, workflow framework, retry platform
  or reverse-placement index.
- New Page tier limits.

## Compiler Input Contract

For each placement, Roma loads the exact saved package from the same account:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
accounts/{accountPublicId}/instances/{instanceId}/serve-state.json
```

The compiler accepts a placement only when:

- the instance belongs to the current account;
- the instance is materialized; its independent public serve state is enforced
  only if the open child-publication decision requires it;
- all required generated browser files exist;
- the HTML contains exactly one valid stamped widget root;
- CSS contributions use the existing exact style-module markers;
- JavaScript contains exactly one valid payload for the instance;
- runtime contributions use the existing exact runtime-module markers;
- the complete package fingerprint can be computed from exact stored bytes.

Missing or malformed input fails compilation. The compiler never drops a
placement, substitutes another instance, repairs markers, or rematerializes from
newer software.

For this release, `pageSource.localization.defaultLocale` must equal the account
base locale. IP localization must be false, country rules empty, and the Page
language switcher false. The source may retain those future settings, but an
enabled unsupported setting fails publication visibly.

## Compilation Contract

### 1. Validate Page source

- Validate the account and Page coordinates.
- Validate Page metadata and the base-locale contract.
- Preserve placement order exactly.
- Reject duplicate placement IDs.
- Reject repeated use of one `instanceId` until the source, stamped-root and
  runtime contracts explicitly support that case. Current source normalization
  does not itself prohibit repeated `instanceId` values, so execution must not
  describe this guard as established persisted-data truth.

### 2. Resolve exact instance contributions

- Load every package through the Roma → Tokyo-worker account boundary.
- Verify account and instance identity.
- Compute a deterministic fingerprint over each complete package.
- Extract the stamped root, style modules, runtime payload and runtime modules
  through shared marker-contract parsing—not UI-route string manipulation.

### 3. Construct one semantic and SEO-valid document

The compiler has the complete Page view and must validate the assembled
document as one document rather than assuming individually valid widgets form a
valid Page.

It must:

- emit one doctype, `<html>`, `<head>` and `<body>`;
- emit one approved title, description, robots policy and canonical URL;
- emit approved `lang`, `dir` and viewport values;
- emit approved social metadata when present;
- preserve semantic instance content in the initial HTML;
- preserve content source authority and placement order;
- guarantee unique compiler-generated instance coordinates and reject
  colliding contribution IDs that cannot remain exact; the compiler does not
  rewrite arbitrary instance markup to hide collisions;
- validate heading structure across the complete Page;
- validate link and image semantics available in structured instance truth;
- include only explicitly declared, compatible structured-data contributions;
- reject conflicting canonical, identity or structured-data claims;
- produce actionable Page-level SEO findings for source correction.

The deterministic compiler validates and materializes approved truth. It does
not rewrite human copy or silently invent titles, headings, alt text, schema
claims or URLs. Roma agents may propose and apply approved source edits through
the Page or Instance authority; the compiler then recompiles that truth.

The planning refinement must classify SEO findings as either publication
blocking or advisory. That policy must be explicit and tested; an executing
agent must not decide it ad hoc.

### 4. Emit optimized HTML

`index.html` contains:

- the complete SEO-valid document head;
- one ordered Page main container;
- one placement coordinate around each exact stamped instance root;
- one reference to the Page stylesheet;
- one deferred reference to the Page runtime.

The compiler removes each instance package's document shell. It does not place
nested `<html>`, `<head>` or `<body>` documents into the Page.

### 5. Emit optimized CSS

The compiler collects style modules by stable module identity and exact bytes:

```text
same module id + same exact bytes → emit once
same module id + different bytes → fail compilation
different module ids → preserve both
```

`styles.css` contains only:

1. the minimal Page stack layout;
2. each required shared Widget Shell/Dieter contribution once;
3. each required Widget Core contribution once;
4. exact instance-specific contributions where required.

The compiler preserves existing root scoping. It does not rewrite selectors,
invent Page theme tokens, flatten isolation, or include modules unused by the
Page. The emitted stylesheet is deterministic, minified and content-addressed
by the approved build process.

### 6. Emit optimized JavaScript

`runtime.js` contains:

1. every per-instance payload keyed by exact instance identity;
2. each required shared Shell runtime module once;
3. each required Widget Core runtime module once;
4. deterministic initialization compatible with placement order.

Unused behavior modules are not emitted. A module that depends on singleton
global state and cannot support multiple instances fails certification; the
Page Compiler must not patch it locally. Primary Page content and ordinary
links remain useful before JavaScript executes.

### 7. Emit build evidence

The compiler writes private evidence containing only:

- compiler contract version;
- Page source revision and fingerprint;
- placement IDs, instance IDs and exact package fingerprints;
- final Page package/build fingerprint;
- build timestamp;
- exact SEO validation result.

Evidence is not product configuration, a job record, a dependency graph or an
error-log platform.

Given identical source and instance bytes, compilation must produce
byte-identical public artifacts. Only the evidence timestamp may differ.

## Package And Activation Contract

The public Page URL must never expose a mixed HTML/CSS/runtime build. R2 writes
multiple objects independently, so execution requires one atomic selection
boundary.

Recommended contract:

```text
accounts/{accountPublicId}/pages/{pageId}/builds/{buildFingerprint}/index.html
accounts/{accountPublicId}/pages/{pageId}/builds/{buildFingerprint}/styles.css
accounts/{accountPublicId}/pages/{pageId}/builds/{buildFingerprint}/runtime.js
accounts/{accountPublicId}/pages/{pageId}/builds/{buildFingerprint}/build.json
accounts/{accountPublicId}/pages/{pageId}/active-build.json
accounts/{accountPublicId}/pages/{pageId}/serve-state.json
```

Roma creates the build fingerprint and submits the exact complete package.
Tokyo-worker writes and verifies the immutable build, then changes the single
active-build coordinate. The canonical Page URL selects only that build's
`index.html`, and that HTML references CSS and runtime at immutable,
build-fingerprinted public asset URLs. It must not reference mutable root asset
URLs that resolve a possibly newer active pointer. This prevents a pointer
change between the HTML, CSS and runtime requests from mixing builds.

This preserves last-good output without adding a Queue, job system or compiler
behavior to Tokyo.

This remains a blocking product-owner decision until explicitly approved.

## Save, Publish, Update And Failure Behavior

### Draft save

Draft source remains account-owned Page truth. Draft composition may reference
materialized unpublished instances, but no public build changes.

### Publish

1. Roma validates current Page source.
2. Roma resolves every current materialized instance package allowed by the
   approved child-publication policy.
3. Roma compiles and validates the complete Page.
4. Tokyo-worker stores and verifies the complete build under the approved
   activation contract.
5. Tokyo-worker activates that exact complete build and published serve state.
6. The exact public Page cache coordinate is purged.

No partial package is reported as published.

### Included instance update

After Bob successfully saves an instance, Roma scans current Page sources in
that account for its `instanceId` and recompiles only those Pages. The result
must distinguish:

- instance saved and all affected Pages current;
- instance saved but named affected Pages out of date;
- instance save failed before Page recomposition.

There is no background retry platform. A named direct recompile operation can
retry an out-of-date Page.

### Failed compilation or activation

- the new build does not become active;
- the last complete published build may remain live;
- Roma reports the Page as out of date with the exact failing source/build
  evidence;
- stale output is never represented as current.

### Unpublish and delete

- Unpublish changes serve state and purges the exact Page URL while preserving
  private source and build evidence.
- A published Page must be unpublished before deletion.
- Delete removes only the exact Page source/build/serve coordinates; referenced
  instances remain unchanged.

## Public Delivery And Future Websites

Tokyo-worker serves the active stored document at the stable Page URL. A public
request must never load Page source, fetch instances, concatenate packages,
compile, repair or infer missing files.

Clickeen therefore provides managed hosting for structured Clickeen Pages, not
general-purpose application hosting.

The stable Page identity also creates a future Website boundary:

```text
Website
├── /        → pageId-home
├── /about   → pageId-about
└── /contact → pageId-contact
```

That future Website layer may own domains, routes, shared navigation, headers,
footers, sitemaps and site-wide localization/SEO. It must reference Pages and
reuse the Page Compiler rather than copy Page source or create another renderer.

## Execution Checklist

### Code changes

- [ ] Approve and record the package activation contract.
- [ ] Approve the first-release SEO source fields and blocking/advisory policy.
- [ ] Expose shared exact contribution parsing beside the materializer contract
      without duplicating marker parsing.
- [ ] Implement one Roma Page Compiler with no widget-type branches.
- [ ] Implement semantic-document and SEO validation.
- [ ] Implement deterministic HTML assembly.
- [ ] Implement CSS module deduplication and conflict failure.
- [ ] Implement runtime payload consolidation, module deduplication and conflict
      failure.
- [ ] Emit exact build and SEO evidence.
- [ ] Implement the approved Roma → Tokyo-worker package write/activation
      contract.
- [ ] Enable Tokyo-worker public serving from active stored builds only.
- [ ] Recompose affected Pages after successful instance save.
- [ ] Add a direct named Page recompile operation.
- [ ] Remove Roma/Tokyo publication stubs, unavailable UI and obsolete tests.

### Product data changes

- [ ] Perform no direct account R2 mutation during code implementation.
- [ ] Create test Pages and publication state only through owning product routes.
- [ ] Preserve existing Page source unless a named migration is approved.
- [ ] Do not mark an existing Page published without a verified active build.

### Deploy/runtime verification

- [ ] Run focused materializer, Roma and Tokyo-worker checks.
- [ ] Commit and push the complete cross-system change.
- [ ] Verify Roma's exact Git-connected Pages deployment.
- [ ] Verify Tokyo-worker's exact GitHub Actions deployment.
- [ ] Publish a Page containing two instances of one widget and one instance of
      another widget.
- [ ] Verify one semantic initial document at the stable public URL.
- [ ] Verify approved metadata, heading policy, structured data and social
      metadata behavior.
- [ ] Verify shared CSS/runtime modules occur once and instance behavior remains
      isolated.
- [ ] Edit one included instance and verify the same Page URL updates.
- [ ] Force invalid SEO and module conflicts and prove visible failure with the
      last good build unchanged.
- [ ] Unpublish and prove the public URL stops serving.

### Documentation changes

- [ ] Update `documentation/architecture/CONTEXT.md` with the deployed lifecycle.
- [ ] Update `documentation/architecture/Overview.md`.
- [ ] Update `documentation/services/roma.md` with compiler/SEO ownership and
      instance-save recomposition.
- [ ] Update `documentation/services/tokyo-worker.md` with exact Page package,
      activation and public-serving coordinates.
- [ ] Update `documentation/widgets/README.md` with the contribution and Page SEO
      contracts.
- [ ] Reconcile historical PRD 106B claims without rewriting history.

## Verification Matrix

| Concern                 | Required proof                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Determinism             | Identical Page source and instance bytes produce identical public bytes                                       |
| Initial document        | One semantic document contains every placement in order                                                       |
| Metadata                | Exactly one approved title, description, robots, canonical, `lang`, `dir` and viewport                        |
| Human content authority | Compiler never invents or silently rewrites content/SEO truth                                                 |
| Heading policy          | Whole-Page heading findings follow the approved blocking/advisory policy                                      |
| Structured data         | Only declared compatible contributions appear; conflicts fail visibly                                         |
| CSS dedupe              | Same module identity/body emits once                                                                          |
| CSS conflict            | Same module identity/different body blocks compilation                                                        |
| Runtime dedupe          | Same runtime module identity/body emits once                                                                  |
| Runtime conflict        | Same runtime identity/different body blocks compilation                                                       |
| Multi-instance safety   | Multiple instances operate independently in one document                                                      |
| Account isolation       | Cross-account reference fails before package write                                                            |
| Publication             | Empty/missing/malformed/unmaterialized input blocks activation; child serve-state follows the approved policy |
| Recomposition           | Instance save updates every directly affected Page                                                            |
| Failure truth           | Failed Page remains visibly out of date; last good build remains exact                                        |
| Public serving          | Stable URL serves only one complete active build                                                              |
| Unpublish/delete        | Exact Page state changes; referenced instances remain unchanged                                               |

## Blast Radius And Prohibitions

Expected implementation areas:

- shared contribution parsing beside `@clickeen/ck-runtime-materializer`;
- one small Roma-owned Page Compiler;
- Roma Page routes and affected-Page recomposition after instance save;
- Roma Pages UI for publish/current/out-of-date truth;
- Tokyo-worker Page package storage, activation and public serving;
- focused compiler, Roma, Tokyo-worker and public-page tests;
- canonical documentation listed above.

Forbidden expansion:

- Bob UI redesign;
- widget-specific compiler branches;
- Prague route changes;
- customer navigation, site shells or a Website builder;
- a new database, Queue, Durable Object, workflow engine, graph or reverse index;
- a client-side primary Page loader, iframe stack or generated-code copy path;
- a second renderer or compatibility compiler.

## V1–V8 Design Audit

| ID                            | Required behavior                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| V1 Silent substitution        | Missing or conflicting Page/instance/SEO truth fails; nothing is invented           |
| V2 Silent healing             | Invalid source, markers, semantics or packages are not repaired by the compiler     |
| V3 Silent omission            | Every placement and required declared contribution appears exactly once             |
| V4 Fail-open control          | Publication fails when required source, package, status or SEO proof fails          |
| V5 Corruption-as-absence      | Corrupt source/package/evidence is an error, never an empty Page                    |
| V6 Partial-success masquerade | Only a complete build activates; affected-Page failures are named                   |
| V7 Masquerade/redress         | No unavailable, concatenate, iframe or copied-output path survives under a new name |
| V8 Runtime test dependency    | Public delivery depends only on active stored artifacts, never tests or probes      |

## Acceptance Criteria

- Roma publishes a non-empty Page composed of real saved account instances.
- The Page source remains ordered instance references.
- One stable `clk.live` Page URL serves one complete, crawlable initial document.
- The compiler validates and emits coherent Page-level SEO without inventing
  source truth.
- Shared CSS and runtime contributions are not repeated per placement.
- Instance roots, data and behavior remain exact and isolated.
- Conflicting contribution identities block compilation.
- Public requests perform no Page or instance composition.
- Saving an included instance updates the same Page URL after successful
  recomposition.
- Failed builds never replace the last complete active build and remain visible
  as out of date in Roma.
- Publication stubs and obsolete unavailable behavior are deleted.
- No navigation, Website, graph, queue, reverse index, iframe stack, visitor-time
  compiler or copied-code authority is introduced.
- Canonical documentation matches deployed behavior.

## Open Decisions Before Execution

Only these decisions remain open:

1. Approve or reject the immutable-build plus active-pointer activation contract.
2. Approve the minimal additional Page metadata fields required for first-release
   SEO and social previews.
3. Approve an explicit Widget structured-SEO contribution contract or state
   that the first release validates semantic HTML without Widget JSON-LD
   contributions.
4. Classify whole-Page SEO findings as publication-blocking or advisory.
5. Decide whether an included materialized Instance must also have independent
   public serve state before its Page may publish.
6. Confirm the exact stable public path taxonomy shown in this PRD.
7. Confirm direct synchronous affected-Page recomposition remains acceptable at
   current Page limits.

Until those decisions are recorded and peer review confirms that existing
instance package markers can support exact contribution extraction, this PRD
remains Planning. Its accepted contract must be consolidated into PRD 127
before any execution slice begins.
