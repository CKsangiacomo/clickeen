# 127B Former Page Compiler — CODEX Peer Review

Status: **SUPERSEDED BY THE 2026-08-04 REWRITE OF 127B — HISTORICAL INPUT ONLY**

The current 127B now uses the product-owner three-file law: every Widget has
HTML/CSS/JS, every Instance saves customized copies, and every Page combines
those saved files. This review predates that correction. Run a new peer review
against the rewritten PRD before execution; do not use this verdict as current
readiness evidence.

The current slice is `127B__PRD__Web_Code_Generator.md`. Every Page Compiler
reference below uses the superseded name and does not define the accepted Web
Code Generator.

Date: 2026-08-04

Reviewed against:

- `127__PRD__Global_Pages_Program.md`
- `127A__PRD__Page_Source_And_Policy.md`
- `127B__PRD__Page_Compiler.md`
- the boundaries assigned to 127C, 127D, and 127E
- current Roma, Tokyo, Widget, shared-runtime, and
  `@clickeen/ck-runtime-materializer` code
- current architecture, localization, Widget-authoring, Roma, Bob, and Tokyo
  documentation

Review seats:

- Staff Engineer
- Senior Product Manager
- Principal Technical Program Manager

This file consolidates the three independent reviews after checking their claims
against the repository. It does not rewrite 127B and does not authorize execution.

## Verdict

**RED — 127B is not execution-ready.**

The Page Compiler direction is correct and should not be redesigned:

- one saved Page and its referenced saved Widget Instances go in;
- one real Page package comes out;
- the package contains exactly `index.html`, `styles.css`, `runtime.js`, and
  `overlays.json`;
- compilation is pure and deterministic;
- the customer eventually invokes it only through explicit **Save** or
  **Update page**;
- templates do not compile and have no locales or translations;
- no public Widget URLs, iframes, agents, queues, background rebuilds, Build
  history, new service, or per-locale file packages are introduced;
- missing or corrupt truth blocks the whole compile instead of being omitted,
  repaired, or replaced.

The problem is not the product direction. The problem is that 127B describes the
finished result while leaving the hardest implementation contracts undefined.
An executing AI would have to invent those contracts. The largest gap is decisive:
**the current Widget materializer does not produce populated semantic HTML, but
127B assumes that it does.**

## What 127B is supposed to do, in plain words

127B should add one shared, in-memory compiler function. Given a validated saved
Page, the exact saved Instances placed on it, their locale overlays, resolved
assets, Widget software, and evidence, that function returns the four complete
Page files or one exact failure.

127B should prove that function with real Widget fixtures. It should not yet save
a Page package, install anything in Tokyo, serve a public Page, calculate Page
currency, or build Page Builder UI. Those integrations belong to later slices.

## Decisions that are already right and must remain

### Customer-controlled compilation

The compiler must not run autonomously. The final product commands remain:

- **Save**: save Page-authored changes and request a new compiled package;
- **Update page**: deliberately incorporate newer referenced Instance truth;
- **Publish**: expose an already-current package; publishing does not compile.

Opening a Page, editing an unsaved field, saving a Widget Instance, writing a
translation, or receiving a public request must not invoke the compiler.

### One real Page

A Page is not a stack of Widget embeds. It becomes one HTML document with one
stylesheet, one runtime, and one compiled overlay file. Shared support code is
included once where reuse is safe.

### Existing authorities remain in place

- Roma owns authenticated Page and Instance reads and later command
  orchestration.
- The existing shared materializer package is the natural owner of pure artifact
  compilation.
- Tokyo owns package storage and public serving only when 127C adds them.
- Widget source remains the authority for Widget structure and behavior.
- Overlays remain the locale-specific value model. No renamed "projection"
  system is needed.

### Failure stays visible

The compiler is all-or-nothing. It must not drop a placement, use a nearby locale,
guess metadata, ignore a missing module, or return two good files and call the
Page compiled.

### The technical bar is world-class without competitor-shaped machinery

The competitive result is straightforward: complete semantic HTML, immutable
support bytes, CDN-friendly URLs, deterministic compilation, last-good serving,
and no browser waterfall through child Widget packages. That is the right bar for
a hosted Page product.

Clickeen does not need to copy a legacy CMS build queue, plugin graph, deployment
dashboard, or per-locale site-copy model to reach that bar. Its advantage remains
the simpler one: saved structured truth is compiled once on an explicit customer
command and Tokyo later serves the resulting files. The blockers below matter
because 127B does not yet prove that its proposed code can actually produce that
result.

## Blocking findings

### 1. The current materializer cannot produce the semantic HTML 127B promises

This is the primary blocker.

127B says the compiler will retain each Widget's semantic HTML and that every
locale can produce complete initial HTML for crawlers. Current code does not have
that capability.

The materializer currently:

1. reads `widget.html`;
2. extracts its `<body>`;
3. stamps the Widget root with an Instance ID;
4. removes stylesheet and script tags;
5. puts saved state into `runtime.js`;
6. relies on `widget.client.js` to populate the visible DOM in the browser.

Concrete examples:

- `tokyo/product/widgets/faq/widget.html` contains an empty title and empty FAQ
  list. The FAQ client creates the questions and answers later.
- `tokyo/product/widgets/big-bang/widget.html` contains empty content elements.
  Its client inserts the real statement and supporting copy later.
- `packages/ck-runtime-materializer/src/materialize.ts` packages the extracted
  HTML shell. It does not render saved Widget state into that shell.

Therefore:

```text
current materializer HTML = Widget shell
current materializer HTML != complete crawler-readable Widget content
```

The proposed `PageInstanceContribution.html` cannot become populated merely by
adding `baseValues`. A field path such as an FAQ answer does not tell the Page
Compiler which repeated HTML node to create, which element is semantic, or which
existing sanitizer applies.

Before execution, 127B must define one exact Widget-owned semantic-render
contract that produces complete HTML from validated saved state. That contract
must be used by standalone Widget materialization and Page compilation so Page
compilation does not become a second Widget renderer.

127B must also name the impact on all eight shipped Widget types:

- Big Bang
- Call to Action
- Cards
- Countdown
- FAQ
- Logo Showcase
- Split Carousel Media
- Split Media

If this changes the current six-file Widget authoring contract, that is a real
architecture decision and must be stated before execution. The executor must not
be left to choose a headless browser, DOM emulator, generic template engine,
field-to-DOM guessing, or eight duplicated Page-only renderers.

### 2. `PageInstanceContribution` cannot safely compose the existing runtime

The proposed contract uses anonymous arrays:

```ts
css: string[];
javascript: string[];
```

Those strings do not identify:

- a shared module that should appear once;
- a Widget-type client initializer that should appear once per Widget type;
- a per-placement payload that must appear once per placed Instance;
- module dependencies and execution order;
- typography and resolved media input;
- the source module whose bytes are being deduplicated.

This can break two Instances of the same Widget type. The current shared runtime
registers a Widget initializer and immediately initializes every matching root.
If an initializer runs before every placement payload exists, a later root can
be marked initialized without its state. Deduplicating the second initializer
then prevents recovery.

127B must replace anonymous support-code strings with a typed contribution that
at minimum separates:

- the stamped placement root;
- the per-Instance state payload;
- shared runtime modules;
- Widget-type initializer modules;
- CSS modules;
- stable module IDs;
- deterministic dependency/order information.

Required execution law:

- emit all per-placement payloads before any Widget initializer;
- deduplicate a module only when its canonical module ID and bytes both match;
- fail when the same module ID has different bytes;
- preserve deterministic first-use order for distinct modules;
- initialize each placement exactly once.

This is the minimum information the existing runtime needs. It is not a new
framework or registry.

### 3. The Page and placement markup is not pinned to the existing runtime

The existing Widget runtime already recognizes:

```html
data-ck-composed-page="true"
```

It uses that marker to distinguish a composed Page from a standalone Widget.
Shared behavior such as the Widget locale switcher relies on it.

127B's example only shows:

```html
<main data-ck-page="...">
```

If implemented literally, placed Widgets can behave as standalone Widgets inside
the Page.

127B must specify the exact markup contract rather than saying only "stack in
order":

- the composed-Page marker;
- the Page ID attribute;
- the placement ID attribute;
- the Instance ID attribute;
- the exact wrapper nesting used for runtime scoping;
- the first-release spacing rule between placements, including whether the Page
  adds no spacing of its own.

The current runtime already supports multiple roots and `data-ck-instance-id`.
The Page Compiler should use those seams, not invent replacements.

### 4. Locale completion is named but not defined

127B says Tokyo and Page preview will share a locale-completion function. The
current Tokyo helper only replaces the `CK_LOCALE_CONTEXT` script marker and the
`<html lang>` value. It does not populate visible semantic HTML.

To return complete localized HTML, the contract must define:

- the exact typed `overlays.json` shape;
- the exact markers connecting Page/Instance fields to HTML text, rich text,
  attributes, metadata, and structured data;
- escaping rules for HTML text, attributes, URLs, JSON, and JSON-LD;
- the existing rich-text sanitizer that remains authoritative;
- the locale-completion function's exact input, success result, and failure
  result;
- how `lang`, `dir`, title, description, canonical, alternates, social metadata,
  and visible content change together;
- a guarantee that failure produces no partly localized HTML.

Locale resolution must happen independently for the Page and each placed
Instance because each object has its own core `baseLocale`.

For requested locale `L`:

```text
Page:
  L == Page.baseLocale      -> use Page base source
  otherwise                 -> require Page overlay L

Each placed Instance:
  L == Instance.baseLocale  -> use Instance base source
  otherwise                 -> require Instance overlay L
```

This matters when the Page and an Instance have different base locales. The Page
base locale is not a shortcut that allows the compiler to use every Instance's
base source. There is no language-only fallback, locale alias, or substitute.

The overlay path format also needs one exact typed schema and one real example.
It must use concrete field paths accepted by the current overlay system; array
patterns such as `items[]` are authoring declarations, not stored overlay keys.

### 5. The compiler's code owner is left to the executor

The current wording allows "Roma or an existing shared package" and tells the
executor to inspect the code before choosing the final module path. That directly
authorizes different implementations.

The least additive owner is the existing
`@clickeen/ck-runtime-materializer` package because it already owns:

- Widget package parsing;
- deterministic runtime-package assembly;
- CSS and JavaScript source loading;
- root stamping;
- package fingerprints;
- the contract tests Roma already depends on.

127B should pin the Page compiler, Instance contribution, canonical
serialization, and pure locale-completion exports to that package. Roma remains
the caller and data-loading authority. Do not create a Page Compiler service,
Worker, Queue, separate package, general renderer registry, or temporary route.

### 6. 127B currently takes work owned by 127C, 127D, and 127E

127B says:

- Save and Update invoke the compiler;
- Page Builder previews the selected package;
- old Page preview code is deleted;
- product preview reads the last complete package.

But 127B also says it performs no storage, adds no Tokyo writes, adds no public
routes, and receives no Page Builder credit. Without package installation there
is no selected package for a later request to preview.

The clean boundary is:

```text
127B
  pure compiler + pure locale completion + real fixtures and tests
  no production caller and no customer-visible behavior

127C
  Save orchestration + atomic Tokyo installation + public serving

127D
  dependency currency + explicit Update page invocation

127E
  Page Builder + installed-package preview + customer messages
```

127B must remove production Save/Update wiring, selected-package preview, old-UI
deletion, and runtime preview proof from its scope and Definition of Done.

The accepted product rule still belongs in 127B as an invocation constraint:
later product callers may call the compiler only from explicit Save or Update.
It is not behavior that 127B itself can integrate or prove in the product.

If a standalone compiler slice is considered too inert, merge B and C. Do not
create a disposable API or test-only production endpoint merely to make B look
deployed.

### 7. The support-file URLs and fingerprint order conflict with 127C

127B shows:

```html
<script src="./runtime.js" defer></script>
```

The public Page URL is slashless:

```text
/{accountPublicId}/pages/{pageId}
```

From that URL, `./runtime.js` resolves under `.../pages/runtime.js`, not under the
Page. The compiler must emit exact root-relative Page URLs:

```text
/{accountPublicId}/pages/{pageId}/styles.css
/{accountPublicId}/pages/{pageId}/runtime.js
```

There is also a circular fingerprint problem across 127B and 127C. 127C proposes
using `packageFingerprint` in the support-file URLs, while 127B calculates that
fingerprint from all final files, including the HTML containing those URLs.

The PRDs need one non-circular byte order. A simple rule is:

1. finish `styles.css`, `runtime.js`, and `overlays.json`;
2. fingerprint those files;
3. place the relevant individual support-file fingerprints in the root-relative
   HTML URLs;
4. finish and fingerprint `index.html`;
5. calculate the package fingerprint from the four completed files.

127B and 127C must state the same rule.

### 8. The source authority for Widget software is unresolved

127B says the compiler receives the current saved Instance and the compiled
Widget package. It does not say which Widget software revision the Page should
use.

That creates a real customer-visible ambiguity:

- use the already saved standalone Instance package, so the Widget looks exactly
  as it currently does; or
- rematerialize saved Instance source through the latest deployed Widget
  software, which may change its appearance or behavior without the customer
  resaving that Instance.

127B must choose one rule and align 127D's currency evidence with it. If current
Widget software is an input, its artifact/schema/materializer fingerprints must
be recorded so a software change cannot leave a Page incorrectly marked
**Current**. If the saved Instance package is authoritative, the contribution
contract must say how it is read without fetching a public URL.

The executor must not decide this product behavior while coding.

### 9. Inputs, failures, and evidence remain too loose

#### Assets

The compiler is pure but the input currently supplies account asset coordinates.
A pure function cannot resolve those coordinates. Roma must resolve assets and
typography through existing authorities before the compiler call and provide
validated runtime-ready values plus their evidence. The compiler must not guess
asset URLs or call Tokyo.

#### Failures

`reason: string` invites raw technical messages and inconsistent handling. Use a
finite `reasonKey` union with required coordinates for each reason. Technical
detail may accompany the key, but customer copy belongs to 127E.

#### Evidence

The compiler must compute or verify fingerprints against the exact validated
inputs it compiles. It must not merely repeat caller-supplied fingerprints.

Evidence must record every input that 127D will use to decide whether the Page
is current. At minimum that decision needs alignment on:

- Page revision;
- each placed Instance source and required overlay evidence;
- the Widget software/materializer contract if latest software participates;
- resolved assets when their bytes can change without their coordinate changing;
- the final four file fingerprints and package fingerprint.

Remove evidence that no current-state comparison consumes. For example, Page
overlay fingerprints may be redundant if Page overlays are inside `source.json`
and covered by the Page revision.

### 10. SEO and structured-data output still permits invention

127B must enumerate the first-release head output and its exact source fields:

- `<title>`;
- meta description;
- robots;
- self-canonical;
- reciprocal exact-locale `hreflang` links;
- `x-default` to the stable Page URL;
- exact social tags derived from the declared Page social fields.

The current Widget contract does not expose a typed structured-data contribution.
The phrase "supported Widget-specific structured data" therefore gives an
executor permission to invent FAQ, Product, Offer, Organization, or other schema.

The first execution should emit no Widget JSON-LD unless a Widget already owns an
explicit typed contribution. If 127B emits Page-level `WebPage` JSON-LD, it must
list the exact properties and Page fields that populate them. It must never infer
claims, keywords, prices, offers, image descriptions, or schema types from prose.

### 11. Determinism and verification are under-specified

"The same canonical input" is not enough to guarantee byte-identical output.
127B must specify:

- UTF-8 and line-ending rules;
- placement order;
- locale order;
- module and stylesheet order;
- object-key order in `overlays.json`;
- serialization and escaping rules;
- behavior when a module ID collides with different bytes;
- the exact bytes included in every fingerprint.

Verification must cover the supported product, not merely "more than one Widget
type":

- all eight current Widget types;
- mixed types in one Page;
- two Instances of the same type;
- interactive behavior after initial semantic HTML;
- arrays, rich text, links, alt text, media, and account typography;
- exact base and non-base locale resolution;
- different Page and Instance base locales;
- accessible IDs and relationships across duplicate Widget types;
- no standalone locale controls in composed Page mode;
- malformed and missing input failures;
- byte-identical standalone Widget output for unchanged fixtures;
- no network, storage, mutation, or runtime probe dependency.

Use the existing product envelope for performance evidence: up to the current
`widgets.instances.max` of 250 distinct placements and the current locale limit.
This is engineering proof, not a new Page entitlement. Measure compiler time and
package sizes against the actual Roma/Cloudflare request boundary. If it does not
fit, stop for a product decision. Do not silently add a customer cap, Queue,
background compiler, or partial result.

## Exact 127B boundary after correction

127B should own:

- one shared pure Page compiler in the existing materializer package;
- one Widget-owned semantic-render contract shared with standalone
  materialization;
- typed Instance contributions and deterministic CSS/runtime consolidation;
- canonical four-file serialization and fingerprints;
- pure exact-locale HTML completion;
- complete compiler, regression, security, and resource-envelope tests;
- documentation for the compiler and any changed Widget source contract.

127B should not own:

- Roma Save or Update route orchestration;
- R2 or Tokyo package installation;
- active-package selection;
- Page publication or public routes;
- CDN cache behavior;
- Page currency;
- Page Builder or compiled preview UI;
- compatibility paths for the current pre-GA Page UI.

## Verified blast radius

The final file list depends on the semantic-render decision, which is why that
decision must precede execution. The execution doc must nevertheless name and
audit these current owners:

- `packages/ck-runtime-materializer/src/**`
- `packages/ck-runtime-materializer/tests/**`
- `packages/ck-runtime-materializer/README.md`
- `packages/widget-shell/src/modules.ts`
- `scripts/widgets/generate-artifacts.ts`
- `roma/generated/widget-materializer-artifacts.ts`
- affected generated `roma/generated/widgets/*.json`
- `roma/lib/account-instance-public-package.ts`
- `roma/lib/account-instance-source-artifacts.ts`
- the shared 127A Page contract export
- all eight `tokyo/product/widgets/{widgetType}/widget.html` files
- all eight `tokyo/product/widgets/{widgetType}/widget.client.js` files
- required modules under `tokyo/product/widgets/shared/**`
- focused materializer, real-Widget, generator-freshness, and Roma regression
  tests

Generated Widget artifacts must be regenerated through the existing generator,
never edited by hand. Existing standalone Widget packages must remain
byte-identical for unchanged inputs unless the product owner explicitly approves
a shared semantic-output contract change.

## Documentation work required by the corrected slice

Documentation must describe only truth actually delivered by 127B.

Required when its underlying contract changes:

- `packages/ck-runtime-materializer/README.md` — exact Page compiler,
  contribution, locale-completion, ordering, purity, and failure contracts.
- `documentation/widgets/authoring/WidgetFiles.md` — the exact semantic-render
  source contract every Page-capable Widget must provide.
- `documentation/widgets/authoring/WidgetAuthoringChecklist.md` — Page
  contribution and duplicate-instance/locale verification.
- `documentation/widgets/shared/ShellCore.md` and the relevant shared-runtime
  documentation — composed-Page marker, module identity, and initialization
  order.
- each affected `documentation/widgets/widgets/*.md` — Widget-specific
  compile-time semantic and interactive behavior.
- `documentation/architecture/RuntimeProfiles.md` — the pure four-file compiler
  result, clearly separated from installation and serving.
- `documentation/architecture/OverlayArchitecture.md` and
  `documentation/capabilities/localization.md` — exact compiled Page overlay
  shape and per-object `baseLocale` resolution.

Update `documentation/services/roma.md` only for a compiler dependency or caller
that actually exists after the corrected 127B. Update `documentation/services/bob.md`
only if the shared Widget rendering contract changes Bob or standalone
materialization behavior.

Do not make `documentation/architecture/CONTEXT.md` claim that customers can
save, preview, publish, or serve compiled Pages after a pure-library 127B. Do not
update `documentation/services/tokyo-worker.md` for Page storage or serving until
127C implements it. Final high-level documentation reconciliation belongs at the
first slice where those behaviors become current truth and again at 127 closure.

## Reviewer proposals rejected as unnecessary or contrary to settled product law

The review does **not** recommend:

- autonomous compilation;
- compilation on every draft edit;
- a separate live Page renderer;
- an agent-driven compiler;
- a Queue or background job system;
- a Page Compiler service or Worker;
- a Build entity or build-history UI;
- one HTML/CSS/JS package per locale;
- a new Page-placement entitlement;
- a compatibility layer for the pre-GA Page UI;
- inferred Widget JSON-LD;
- a temporary production route used only to prove the library exists.

Those ideas either contradict explicit decisions, add machinery without solving
the actual blocker, or move later-slice work into 127B.

## V1–V8 assessment

| Rule | Result | Reason |
| --- | --- | --- |
| V1 — Silent substitution | At risk | Undefined structured-data and locale-completion rules permit invented output. |
| V2 — Silent healing | At risk | "Canonical input" is not defined tightly enough to prevent an executor from normalizing invalid source. |
| V3 — Silent omission | Blocked | Current Widget shells omit much visible content from initial HTML. |
| V4 — Fail-open control | Good intent; contract incomplete | Required source and locales are meant to fail closed, but exact validators and reason keys are not pinned. |
| V5 — Corruption-as-absence | Pass in intent | 127B explicitly rejects corrupt Page, Instance, overlay, and asset truth. |
| V6 — Partial-success masquerade | Pass in intent | Success requires all four files, but the optional failure coordinates should become mandatory per reason. |
| V7 — Masquerade/redress | High risk | The missing semantic-render contract invites a second renderer under another name. |
| V8 — Runtime test dependency | Pass | Tests remain verification; no runtime test dependency is needed. |

## Conditions for a GREEN execution review

127B becomes ready only after it is rewritten to answer these points directly:

1. What exact Widget-owned code turns validated saved state into populated
   semantic HTML, and how do standalone Widgets and Pages share it?
2. What is the exact typed Instance contribution, including module identity,
   phases, order, payloads, roots, typography, and assets?
3. What exact Page/placement markup uses the existing composed-Page runtime seam?
4. What is the exact `overlays.json` schema, marker contract, per-object
   `baseLocale` rule, and safe locale-completion function?
5. Which named files in the existing materializer package own the compiler?
6. Which Widget software revision is authoritative for a saved Instance inside a
   Page, and how does 127D detect a change?
7. What are the non-circular support-file URL and fingerprint rules shared with
   127C?
8. What are the finite failure reasons and required coordinates?
9. What exact SEO/social/schema output is allowed, with no inference?
10. Which tests prove all eight Widget types, duplicate types, all current locales,
    the current product envelope, standalone parity, and zero network/storage
    access?
11. Which documentation files change now, and which must wait for C, D, or E?

The core design can be elegant and scalable. It does not need more machinery.
It needs the current rendering reality and exact ownership boundaries written
into the execution document so the executor has nothing important left to invent.
