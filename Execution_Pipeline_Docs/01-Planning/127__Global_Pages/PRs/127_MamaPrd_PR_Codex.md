# Peer Review — PRD 127 Mama: Clickeen Pages (CODEX)

> **Historical review — not execution authority.** This review predates the
> product-owner corrections now incorporated into the Mama and 127A–127F.
> Where it proposes migration machinery, locale lifecycle machinery, or a
> special Tier99 system, the accepted PRDs supersede it.
> It also predates the direct three-file Widget/Instance/Page law now owned by
> the Mama and rewritten 127B.
> It predates the accepted Web Code Generator name and authority; any Page
> Compiler recommendation below is historical.

Date: 2026-08-03

Reviewed document: `127__PRD__Global_Pages_Program.md`

Review method: three independent reviews were run from Staff Engineer, Senior
Product Manager, and Principal TPM perspectives. Their findings were then
checked against the current Clickeen documentation and runtime code.

Product-owner clarification after this review: the Page Compiler is never an
autonomous reaction to dependency changes. **Save** explicitly persists and
compiles Page-authored changes. Included Instance/overlay changes only mark a
Page **Needs update**. **Update page** is the explicit compiler command, and
**Publish** only exposes an already-current package. This clarification
supersedes every recommendation below that previously implied automatic
recompilation.

Product-owner clarification after this review: 127F adds My templates and
Catalogs for Widgets and Pages. Customer templates remain account-local;
`CLICKEEN` templates form the global Catalog; Save as template saves then
creates a new named snapshot; and Use template creates independent ordinary
objects. Statements below that templates are outside PRD 127 are superseded by
127F.

## Verdict

**RED — the product direction is sound, but the Mama PRD is not ready for
acceptance or execution.**

This does not need another conceptual rewrite. The core program is simple and
correct:

1. A customer orders saved Widget Instances into a Page.
2. The Page stores references to those Instances.
3. One compiler turns the Page and those Instances into one optimized hosted
   Page.
4. The existing `baseLocale` and exact overlay model supplies locale-specific
   values.
5. Tokyo/R2 stores the selected complete package and Cloudflare serves it at a
   stable `clk.live` Page URL.
6. Roma provides **Your pages**, **Page catalog**, and **Page Builder**; Bob
   remains the Instance editor.

That model complies with the tenets and with Clickeen's lean, agent-operable
architecture. The problem is that several sentences still leave executors to
invent important product and source-authority decisions. Those gaps must be
closed in the Mama before 127A–E can be trusted.

## What is strong and must be protected

### The Page model is clear

The first tenets correctly distinguish Widget, Instance, and Page. A Page is
not a copied tree of Widgets and is not a list of public Widget embeds. It is an
ordered list of same-account Instance references compiled into one result.

### The authority chain is lean

The intended chain is coherent:

```text
Roma Page operation
  -> deterministic Page Compiler
  -> Tokyo-worker account storage
  -> Tokyo public serving
  -> Cloudflare cache
```

No agent, public-source traversal, remote Widget fetch, Queue, graph, poller,
or background-job framework is needed in the normal path.

### Preview and public output use one compiler result

This prevents Roma preview and the public Page from becoming two different
rendering systems. Save and Update page may invoke the compiler; Publish does
not. The compiler remains a pure transformation and does not own R2,
publication, cache purging, or product mutations.

### The package model is justified

The four derived files and fingerprinted package directory are not a customer
Build/version feature. They are the smallest credible way to install several
R2 objects without serving HTML from one compile with CSS or JavaScript from
another. Keeping the current and immediately previous working package supports
atomic replacement and last-good serving without inventing package history.

### Locale serving is structurally correct

Exact locale URLs, complete server-delivered HTML, one shared Page stylesheet
and runtime, and a derived `overlays.json` are compatible with CDN caching and
crawler access. Browsers and crawlers do not assemble primary content from the
overlay file.

### Product scope is disciplined

The PRD correctly excludes Websites, menus, templates, A/B testing, Prague
migration, a generic editor, SEO scoring, and new orchestration machinery. It
also correctly makes Pages a Tier 2+ product governed by `pages.max`, rather
than inventing a second limit on how many already-entitled Instances may appear
in a Page.

## Mama-level corrections required before acceptance

### 1. Define the editable Page overlay authority

The current Mama and 127A resolve the earlier ambiguity by making Page-owned
overlays part of Page-authored `source.json`. Instance overlays keep their
existing exact files. The storage layout is therefore:

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  packages/{packageFingerprint}/
    index.html
    styles.css
    runtime.js
    overlays.json
```

- `source.json` owns Page identity, `baseLocale`, selected locales, base Page
  values, Page-owned overlay values, placements, and revision.
- existing Instance `overlays/locales/{locale}.json` files remain the exact
  translation truth for referenced Instance fields.
- Package `overlays.json` is derived compiler output only. It is never edited
  and never becomes translation truth.
- Page Builder must let the customer edit the declared Page-owned fields for
  each selected locale. Selecting a locale must not copy or invent base values.

127E edits Page-owned overlay values through the same Page draft and explicit
Save operation as every other Page-authored field. It adds no independent Page
overlay write path.

### 2. Overlay changes must make affected Pages derive Needs update

Existing Instance translation operations write and delete overlay files
independently. Because the proposed Page package snapshots locale values into
compiled output, a translation correction or deletion must make every affected
saved Page visibly stale. It must not silently change or compile the Page.

The Mama must state:

- a successful write or deletion of a referenced Instance overlay ends with
  that overlay mutation and performs no Page write or compiler call;
- Roma later compares a Page's selected-package evidence with current exact
  dependency fingerprints and derives `out_of_date`;
- Page-owned overlays are Page-authored source and therefore use the Page
  Builder draft → **Save** path rather than an independent mutation route;
- the last working package remains unchanged;
- **Update page** is the only operation that later compiles current overlay
  truth into the Page;
- currency-derivation failure is explicit and never treated as current.

This belongs to the parent contract because it is required for tenets 5 and 9,
not an optional 127D refinement.

### 3. Name one Widget-owned semantic contribution contract

The compiler promises complete semantic Page HTML, but current Widget packages
often contain an empty HTML shell that browser runtime fills. The Mama also
says 127 does not redesign Widgets. Both can be true only if it explicitly
authorizes one shared internal rendering contract.

The Mama must require:

- every Widget owns a deterministic semantic contribution from validated
  Instance values;
- standalone Widget materialization and Page compilation reuse that same
  Widget-owned contribution;
- standalone Widget product behavior, public URLs, localization, and storage
  remain unchanged;
- 127B may change shared Widget rendering implementation and authoring
  contracts only as needed to remove the current browser-only rendering gap;
- no second per-Widget Page renderer, DOM scraper, headless-browser compiler,
  or copied Widget implementation is allowed.

This is the critical engineering contract behind “consolidates HTML, CSS, and
JavaScript.” Without it, 127B has no implementable source of semantic HTML.

### 4. Make the Page-source migration lossless and deployable

The current Page source already contains `defaultLocale`, metadata, placements,
country rules, language-switcher state, and an optional canonical URL. The Mama
authorizes a migration but does not say what happens to those values.

It also requires 127A to deploy first while the current Roma Pages UI still
reads the old shape, and does not replace that UI until 127E. A destructive
127A migration could therefore break the live Pages surface.

The Mama must require both:

1. A field-by-field migration table. At minimum, placement IDs/order and
   metadata are preserved; `defaultLocale` is validated and mapped explicitly
   to `baseLocale`. Country rules, language-switcher state, and custom canonical
   values must each receive a named preserve/map/remove decision. Any row that
   cannot be mapped losslessly stops for review rather than being silently
   changed or dropped.
2. 127A updates every deployed reader and writer of Page source before the data
   migration runs. The existing Roma presentation may remain until 127E, but it
   must read and write the new source contract. Do not introduce a long-lived
   compatibility wrapper, and do not migrate data while a deployed consumer
   still requires the old shape.

### 5. Close the locale rules instead of promising unsupported codes

The Mama uses `en-us` and `en-gb` as customer-selectable examples, while the
current shared locale catalog does not contain them. It also does not state
that selected locales must include the Page `baseLocale`.

The Mama must decide one of these two honest scopes:

- use only locale codes already accepted by the existing shared catalog; or
- make expansion of that same catalog an explicit 127A deliverable, including
  all existing policy, Roma, Translation Agent, contract, and serving
  consumers.

It must not create a Page-only registry. In either case:

- selected locales are non-empty, unique, exact supported codes;
- `baseLocale` is always one of the selected locales;
- a blank Page starts with `selectedLocales: [baseLocale]`;
- an exact locale URL accepts only a selected locale.

### 6. Remove the nonexistent remembered-choice authority

The neutral URL currently gives first priority to a remembered visitor choice
“when the global privacy policy permits.” There is no current global visitor
consent or locale-preference authority in the repo. That sentence invites 127C
to invent a cookie and privacy subsystem.

For PRD 127, the rule should be:

- choosing a locale navigates to the exact locale URL;
- the neutral URL may use browser language, an account-approved country hint,
  and then `baseLocale`;
- it does not persist or read a remembered locale until a separately accepted
  global privacy authority exists.

This is the fail-closed, no-bloat result.

### 7. Separate publication state from package currency and Save failure

`published | unpublished` and `current | out_of_date | save_failed` describe different
things. Publication controls public availability. Package currency says
whether the selected private/public package still matches saved inputs. A
saved unpublished Page can therefore need updating too.

The Mama must define:

- all saved Pages show publication and package currency separately;
- `out_of_date` never causes autonomous compilation;
- after unpublish, a retained package may remain current as a private compiled
  Page but is not public;
- contract keys may use `out_of_date`, but customer UI uses human copy such as
  **Needs update**;
- `save_failed` uses **Needs fixing**, stays editable, and offers Save rather
  than the dependency-update modal;
- Page source save, explicit compile, package install, currency derivation,
  Update page, publish, and cache/discovery update remain separate
  outcomes.

### 8. Define the Page save boundary and safe Bob round trip

Page Builder promises that a customer can edit Page data, open an included
Instance in Bob, save it, and return to the same Page. It does not say whether
Page edits are already persisted when the customer leaves.

The product-owner decision is:

- choosing Blank page opens only a local `/pages/new` draft; no ID, Tokyo write,
  or compiler call exists before Save;
- Page edits have an explicit Save boundary, and Save persists then invokes the
  compiler once;
- opening Bob with unsaved Page edits requires Save or an existing
  unsaved-navigation confirmation;
- returning restores the same Page, selected locale, selected Instance, and
  relevant position;
- if Bob saved an included Instance, return shows the Needs update gate and
  blocks Page editing until explicit Update succeeds.

127E owns the UI, but the Mama owns whether browser-memory state or saved Page
source is authoritative.

### 9. Define Tier99 values, not just Tier99 plumbing

The Mama correctly says Tier99 is internal and not sellable, but it delegates
all non-Page entitlement and AI-policy values to 127A. Those are product
decisions; 127A must not invent them.

The parent rule should be explicit:

- Tier99 equals Tier 4 for every existing entitlement, limit, authorization
  cap, AI model profile, and agent route unless this Mama lists an exception;
- the only initial differences are the internal identity, non-sale rule, and
  `pages.max: null` (which Tier 4 also has);
- Tier99 adds no models, limits, routes, roles, cross-account authority, or
  alternate product behavior;
- all closed consumers must accept Tier99 before the exact `CLICKEEN` account
  row changes;
- the migration verifies that exact account is Tier 4 and changes only it.

The deployment proof must cover policy/contracts, Supabase/Michael, Berlin,
Roma, DevStudio policy management, Product Copilot, Translation Agent, San
Francisco, Tokyo/Tokyo-worker, and any other closed profile switch found by
127A.

### 10. Make the SEO promises executable

The SEO/GEO/AEO direction is good: complete locale HTML, exact URLs,
canonicals, reciprocal `hreflang`, and visible content matching metadata. Two
phrases remain too open-ended:

- “supported Page structured data” does not name which schema types or which
  Page fields produce them;
- “Tokyo also serves the required robots and sitemap discovery” does not name
  the public route or how published Pages enter and leave discovery. There is
  no current Page sitemap system to inherit.

Before acceptance, the Mama must either name the exact first-release fields,
schema types, robots behavior, sitemap URL topology, and owning Tokyo operation,
or remove those promises from 127. 127C may provide implementation detail, but
it must not invent a discovery registry or new service. Discovery should be
derived from authoritative published Page state through existing Tokyo-owned
storage and serving.

## What belongs in 127A–E, not in the Mama

The following are required execution proofs, but adding their implementation
details to the parent would be overarchitecture:

- the exact TypeScript shapes and validators;
- the exact compiler package/file topology;
- how CSS rules and JavaScript modules are deduplicated;
- package-fingerprint construction and R2 installation steps;
- cache headers, purge keys, and no-mixed-package tests;
- batched Page-currency derivation measurements;
- table, picker, reorder, focus, loading, and failure UI details;
- exact test commands and deployment evidence.

Your pages may derive currency across many Pages for Tier 4 and Tier99 accounts.
127D must measure batched derivation separately from one customer-requested
Update. Do not prebuild a mutation fan-out, Queue, graph, page cap, job
framework, autonomous compiler, or retry service in anticipation.

127B must prove consolidated output preserves unique IDs, ARIA relationships,
landmarks, focus order, responsive Widget behavior, CSS isolation, and
per-Instance runtime state. Those are compiler acceptance criteria, not new
Mama concepts.

## Product and UX review

The product structure is strong:

- **Your pages** is the customer's inventory.
- **Page catalog** opens an unsaved blank draft; only Save creates the Page.
- **Page Builder** owns Page data and Page composition.
- Bob continues to own Instance editing.
- The public Page is hosted by Clickeen and is not embed code pasted into a
  third-party site.

The Page Builder must stay a focused composition tool. It should not absorb
Bob controls, become a generic visual editor, or expose package versions,
compiler internals, cache state, or infrastructure terminology.

Free and Tier 1 may see Pages and the product explanation, but creation must use
the existing actionable entitlement/upgrade pattern. Downgrade behavior in the
Mama is correct: customer Pages are preserved and remain operable; only new
identity creation is blocked while over the current finite limit.

“Page catalog” versus “Page catalogue” is a copy-consistency decision, not an
architecture issue. Roma currently uses **Widget catalog**. 127E should choose
one product vocabulary and apply it consistently; it should not create both
labels.

## System and blast-radius review

| Slice | Existing authorities it changes | Required proof |
| --- | --- | --- |
| 127A | Page contracts/routes, Roma source readers and writers, Tokyo Page source storage, `@clickeen/ck-policy`, shared AI/tier contracts, Berlin, Michael/Supabase, DevStudio policy UI | Lossless Page migration; all Tier99 consumers closed before the account-row change; unknown tiers fail closed |
| 127B | Widget authoring contract, runtime materializer, Widget packages, new Page compiler | One Widget-owned semantic contribution; deterministic four-file output; no second renderer; standalone Widget behavior unchanged |
| 127C | Roma publish routes, Tokyo-worker R2 operations, Tokyo public Page route, Cloudflare cache, robots/sitemap serving | Complete package selection; no mixed files; exact-locale cache identity; unpublish/delete semantics; public discovery correctness |
| 127D | Page package evidence, current dependency fingerprints, Roma list/open/publish, explicit Update route | Currency is derived without mutation fan-out; Update is customer-triggered; last-good remains selected |
| 127E | Roma navigation and Pages UI, Dieter, Bob return contract | No creation before Save; stale edit gate; compiled-package preview; entitlement UX; no duplicated Instance editor |

## Overarchitecture audit

### Keep

- one Page source and exact overlay files;
- one deterministic compiler;
- four derived package files;
- fingerprinted current/previous package installation;
- exact locale URLs and complete cached HTML;
- evidence-derived Page currency plus one explicit Update command;
- last-good serving and visible **Update page** recovery.

### Reject

- copied Instance source inside Pages;
- stacked public Widget URLs;
- per-locale Page packages or copied Page trees;
- browser-side primary-content assembly;
- a second Widget renderer or DOM-scraping compiler;
- a Page-only locale registry;
- a new cookie/consent authority hidden inside 127;
- autonomous compilation, Queues, graphs, pollers, job frameworks, hidden
  retries, or discovery services;
- Page composition caps beyond `pages.max` and existing Instance entitlements;
- public Build/version UI, Website machinery, or a generic Page framework;
- SEO scoring, learning, recommendation, or agent machinery.

## Required documentation updates by owning slice

Documentation must change only after the matching runtime behavior is deployed
and proven.

### 127A

- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/RuntimeProfiles.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/architecture/BabelProtocol.md` for the exact Page overlay
  storage law, without changing the Instance Translation Agent protocol
- `documentation/capabilities/localization.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/services/berlin.md`
- `documentation/services/michael.md`
- `documentation/services/devstudio.md`
- affected policy, AI-profile, and agent documents
- `documentation/engineering/SupabaseOperations.md`

### 127B

- `documentation/widgets/authoring/WidgetFiles.md`
- every affected `documentation/widgets/widgets/*.md` operator specification
- affected `documentation/widgets/shared/*.md` contracts
- `packages/ck-runtime-materializer/README.md`
- the Page compiler package README/contract document

### 127C

- `documentation/services/tokyo-worker.md`
- `documentation/services/tokyo.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/engineering/CloudflareOperations.md`

### 127D

- `documentation/services/roma.md`
- localization/translation operation documentation for evidence-derived Page currency
- failure and explicit Update semantics in the relevant service contract

### 127E

- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/engineering/UI/interactions.md`
- the current Roma surface/layout documentation

### Program close

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/Tenets.md`
- `documentation/strategy/Clickeen-Babel.md` if Page overlays are now a
  deployed Babel surface

`WhyClickeen.md` and `GlobalReach.md` already express the one-source, global
edge-serving thesis. They should not be rewritten unless the product thesis
actually changes.

## V1–V8 planning audit

This is a PRD audit, so these results identify implementation risks still
present in the instructions rather than deployed violations.

| ID | Result | Reason |
| --- | --- | --- |
| V1 — Silent substitution | **AMBER** | Unsupported regional locale examples and an unnamed remembered-choice authority could cause executors to invent locale behavior. |
| V2 — Silent healing | **GREEN** | The Mama consistently requires invalid source and overlays to fail rather than be repaired. |
| V3 — Silent omission | **RED** | Existing Page migration fields still need an explicit disposition; currency evidence must include every exact required Instance overlay. |
| V4 — Fail-open control | **AMBER** | Tier99's full policy row and remembered-locale privacy authority are not closed. |
| V5 — Corruption as absence | **GREEN** | Missing or corrupt Instances, overlays, and packages remain explicit errors. |
| V6 — Partial-success masquerade | **AMBER** | Save versus compile/install, currency derivation, Update, and Publish versus cache/discovery require separate outcomes. |
| V7 — Masquerade/redress | **GREEN** | The program rejects replacement wrappers, hidden retries, and renamed orchestration machinery. |
| V8 — Runtime test dependency | **GREEN** | Tests and deployment proofs remain gates; normal product work does not depend on them. |

## Required disposition

Do not begin 127 execution yet. Correct the ten Mama-level items above, then
realign 127A–E to the corrected parent without expanding scope.

The expected result is not a larger program. It is a more exact version of the
same simple program: Page references in, one compiler, one current package,
complete locale HTML out, and Roma as the customer operation surface.
