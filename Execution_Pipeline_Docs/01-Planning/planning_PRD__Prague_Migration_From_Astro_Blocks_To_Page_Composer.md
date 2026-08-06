# Planning PRD — Prague Migration From Astro Blocks To Clickeen Pages

Status: Planning — future migration after PRD 127; outside PRD 127 execution

Owner: Prague migration + Roma Pages

Date: 2026-08-03

Depends on:

- `Execution_Pipeline_Docs/02-Executing/127__Global_Pages/Source PRDs/planning_PRD__Account_Page_Compiler_And_Publication.md`
- `Execution_Pipeline_Docs/02-Executing/127__Global_Pages/Source PRDs/planning_PRD__System_SEO_GEO_AEO_Widget_And_Page_Surfaces.md`
- composition-ready Widget packages and exact projection overlays

Unlocks: replacement of Prague's legacy Astro block composition with normal
Clickeen Instances, global Pages and market projections

This document owns Prague migration input, proof and cutover constraints. It
does not own the Page product, projection model or SEO contract and contributes
no execution scope to PRD 127. A future Prague program consumes the completed
PRD 127 Page product.

## Direction

Prague is an existing global Clickeen website. Its Astro blocks, block JSON,
registries, translation sidecars and `WidgetBlocks` assembly are legacy
implementation and migration input, not architecture to preserve.

The migration must preserve Prague's approved visible product experience:

- content meaning and visual intent;
- menus, navigation, routes and redirects;
- branding and site chrome;
- exact market-and-language behavior;
- crawlability, metadata and structured SEO truth.

It does not preserve Prague's current implementation shape.

The target model is:

```text
Prague legacy route content and market truth
→ normal account-owned global Instances with exact projections
→ one global Roma Page with ordered Instance references
→ standard Page Compiler
→ one current four-file Page package
→ neutral global route + exact projection URLs
```

Prague is the first substantial first-party migration proof for the same Page
product customers receive. It must not create a Prague-specific compiler,
regional Page copies, copied packages, visitor-time Instance composition or
compatibility adapter.

## Shared Global Product Contract

Prague adopts the same terminology and invariants as the other two planning
PRDs:

- one Page is one global identity with no default language;
- origin locale records provenance only;
- `en-US`, `es-US`, `it-IT` and other approved coordinates are first-class
  projections, not secondary translations of a US Page;
- a projection may vary copy, assets, offers, currency, metadata, structured
  data and other approved market truth;
- every published projection is complete; no projection silently falls back to
  origin or another market;
- one current Page package contains `index.html`, `styles.css`, `runtime.js` and
  `overlays.json` regardless of projection count;
- Page source and runtime packages are never duplicated per locale/country;
- every projection-sensitive HTML, attribute, behavior, style, metadata and
  schema value uses the shared projectable-field contract; shared CSS/runtime
  contains no hidden origin- or market-specific value;
- Cloudflare uses explicit choice, browser language and IP market evidence to
  select among approved projections at the neutral root;
- exact projection URLs always win and return independently cacheable complete
  HTML.
- Pages is a Tier 2+ product governed by total account Page inventory:
  `pages.max=0/0/3/10/unlimited/unlimited` from free through Tier99;
- a Page may compose an exact saved complete same-account Instance without
  independently publishing that Instance;
- `instances.published.max` remains the standalone Widget-publication meter and
  Prague creates no exception to either policy.

## Relationship To The First Pages Release

The first Clickeen Pages product is hosted single-page publishing. Proposed
identity:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://clk.live/{accountPublicId}/pages/{pageId}/{projectionKey}
```

A standalone Page does not yet own:

- menus or navigation;
- shared Website header/footer;
- a multi-Page route tree or customer domain;
- arbitrary Prague site chrome.

Those remain Website-level concerns. A future Website may collect global Page
IDs under routes and add shared navigation, chrome, domains and site-wide
policy. It must reuse Page identities, projections and the Page Compiler.

Prague already owns those Website-level concerns, so this migration separates:

1. **Page content/projection migration** — replace Prague block composition and
   translation sidecars with normal Instances, one global Page and exact
   projections.
2. **Prague route cutover** — make Prague routes and retained site chrome
   deliver those Page projections through one general Website/host contract.

The first can be proven at stable `clk.live` Page projection URLs. Production
Prague route cutover remains blocked until a general Website/host contract
preserves Prague chrome and complete initial-response SEO. This PRD must not
invent a Prague-only redirect, reverse proxy, fragment injector or shell adapter
to bridge that gap.

## Shared Roma Authoring Workflow

Prague uses the same Roma Pages product that customers use:

```text
Pages
├── Your pages
└── Page catalogue
        ↓
    Page Builder
        ↓
    selected Instance → Bob → return to Page Builder
```

The Page Builder previews and edits Page-owned source, projections, metadata,
layout and ordered placements. Selecting a placement opens its normal account
Instance in Bob. Dirty Page work must save successfully first or remain in Page
Builder. Bob saves only that Instance through Roma, affected Pages
rematerialize, and save/cancel returns through a current-account-validated
Page + placement + Instance coordinate. Roma restores the selection only when
the Page and placement still exist and the placement still references that
Instance. Deleted/stale targets are reported visibly without a substitute
selection or arbitrary redirect. The refreshed preview and exact public-currency
state remain separate truths.

Prague receives no migration-only Page editor, block editor, preview renderer or
Instance override layer. A migrated section is corrected in Bob. Page order,
Page metadata and Page projections are corrected in Page Builder. Preview uses
the same Page Compiler/projection contract as publication and is not proof that
the public package or Prague route is current. Prague inherits PRD 127's shared
choice between a clean reusable editor composition and a smaller Roma Page
Builder; it creates neither choice locally.

## Reserved Tier99 Admin Conformance

Prague follows the same PRD 127 tier contract as Roma Pages: `free` and Tier
1–4 are customer profiles; Tier99 is the permanently non-sellable account tier
used only by exact account `CLICKEEN` for Clickeen Admin/Ops work. Tier99 uses
the existing Berlin tier → shared entitlements → Roma enforcement path and
creates no Prague-specific bypass or internal policy system.

Tier99 distinguishes the highest sellable customer from Clickeen operating its
own product; it is not extra Prague capacity. Account `CLICKEEN` remains a
normal Clickeen account using the normal policy and product-route machinery,
with one explicit internal profile that customers can never buy or receive.
Its locked Page value is `pages.max=unlimited`.

If the named Prague migration account is `CLICKEEN`, it must be migrated to
Tier99 only after the shared schema, entitlement,
AI-policy/grant, Berlin bootstrap, Roma lifecycle and retained Admin surfaces
are deployed and independently proven with Tier99. The stored account row and
its current tier must then be read from the owning account authority before the
reviewed migration; its pre-change tier must not be guessed or hardcoded.
Prague does not infer Admin authority from `accountPublicId`, an account user
role or Tier 4. A Tier 4 customer remains a normal customer using the same
Pages product.

## Why Previous Delivery Branches Stay Removed

Historical planning considered:

- link or redirect;
- reverse-proxy full document;
- Prague shell with injected composed content.

Those branches treated Prague's legacy shell as the Page product boundary. They
remain rejected. The Page boundary is one stable global Page identity with exact
projection URLs and one current hosted package.

A future host/Website integration references that Page identity. It is designed
once for Prague and future consumers, not improvised route-by-route.

## Current Truth And Dependency Gate

Today:

- Roma stores Page source but cannot publish it;
- Roma already has a combined `/pages` inventory/source editor and partial Bob
  return route, but not the route-owned catalogue/inventory split,
  compiler-backed complete preview, validated same-placement restoration or
  explicit public-currency UX required here;
- no deployed Page Compiler emits the four-file current package or Page-level
  projection/SEO truth;
- Tokyo-worker does not serve public Pages;
- current Widget localization uses exact locale overlays with `?locale=` and
  `no-store`, not the target projection route/cache contract;
- Prague still renders repository/Astro block data through legacy assembly.
- the shared policy registry has no `pages.max`; current Roma routes do not
  implement the target Tier 2+ Page inventory policy.
- the shared policy/profile contracts currently stop at Tier 4. Product-owner
  direction identifies account `CLICKEEN` as using Tier 4, but execution must
  verify that exact stored row through Berlin/account DB truth; Tier99 is not
  deployed truth.

This migration remains Planning and outside PRD 127 until:

- PRD 127 implements and proves the shared global Page, projection, compiler and
  SEO contracts;
- Roma publishes a real Page through the approved current-package path;
- Tokyo serves the neutral resolver and exact projection URLs;
- the compiler proves semantic HTML, `overlays.json`, CSS/runtime deduplication,
  projection completeness and affected-Page rematerialization;
- the reserved Tier99 schema/profile is deployed and the named Admin migration
  is verified before Prague relies on Admin policy;
- every selected Prague section has a composition-ready Widget/Instance;
- at least two projections for the representative route are complete;
- the general Website/host delivery contract is approved before production
  Prague route cutover.

If Page capability is missing, fix the shared Page product. If a Widget or
projection is missing, fix that owning Widget/Instance. Prague must not fill the
gap locally.

## Authority Gate

| Concern                                       | Active authority                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Prague route content before migration         | current Prague source, as read-only migration input                                               |
| Migrated content/configuration                | normal account-owned Instances                                                                    |
| Migrated Instance projections                 | normal Instance overlay authority                                                                 |
| Global Page source and order                  | Roma Page source                                                                                  |
| Page-owned projection/SEO truth               | Roma Page source                                                                                  |
| SEO/GEO/AEO contract                          | System SEO/GEO/AEO planning, consolidated into PRD 127                                            |
| Page materialization                          | Roma Page Compiler                                                                                |
| Current Page package and serve state          | Tokyo-worker/R2                                                                                   |
| Global selection/projection application/cache | Tokyo-worker edge serving                                                                         |
| Prague menus/routes/chrome                    | Prague until a general Website authority replaces it                                              |
| Account/session coordinate                    | Berlin bootstrap → Roma current `accountPublicId`                                                 |
| Stored account tier                           | Berlin/account database truth                                                                     |
| Tier entitlements/AI profile                  | shared policy matrices/contracts                                                                  |
| Page product availability/inventory           | shared `pages.max` policy enforced by Roma                                                        |
| Reserved Tier99 assignment                    | trusted internal migration/provisioning only                                                      |
| Runtime/deploy                                | Roma Pages, Tokyo-worker Worker, and Prague Pages only for approved cutover                       |
| Verification                                  | Roma Page routes, exact Page projection URLs, Prague route after cutover, and deployment evidence |

Named migration account, Page ID and projection coordinates must be recorded
before product data is created. No source may be written directly to R2.

## Product Rules

1. Each migrated Prague content section becomes a normal Clickeen Instance.
2. Target Page source stores ordered `instanceId` references and Page-owned
   projection truth, not copied Widget output.
3. One global Page replaces regional content copies for the same semantic Page.
4. Prague legacy locale/market data maps into explicit Instance/Page
   projections; it does not become a Page tree by country.
5. Prague stores no private Page source, Instance source or copied compiler
   output.
6. Prague does not parse, modify, concatenate or repair Page packages.
7. Page materialization happens before delivery. On a public CDN miss Tokyo may
   only apply the exact compiled projection from the current Page package.
8. Exact Page projection URLs remain stable after Instance or projection edits.
9. Prague blocks, registries, Astro rendering and translation sidecars are
   deleted route-by-route after replacement proof.
10. Existing Prague menus/navigation remain outside Page source in the first
    Pages release.
11. No Website feature is added to Pages solely to unblock Prague.
12. Production cutover cannot remove Prague chrome or weaken initial-response
    SEO.
13. No route claims global parity while required projections are incomplete.
14. One representative route with at least two projections proves the complete
    path before broader migration.
15. Tier99 is never assigned by Prague or used as a Prague-specific capability
    bypass.
16. Prague Page placements may use exact saved complete `CLICKEEN` Instances
    without independently publishing them; Prague gains no direct Instance
    package or publication authority.
17. A standalone proof is private/dev where possible and otherwise
    `noindex,nofollow`. The existing Prague route remains the indexed authority
    until one accepted cutover changes authority and deletes replaced assembly.
18. A/B compatibility means selecting two normal Pages or Instances. Prague
    creates no experiment-specific source, package, entitlement or routing
    machinery in PRD 127.

## Migration Source And Target

Current Prague data under `tokyo/prague/pages/**`, repository JSON, translation
sidecars, `blocks[]`, `blockRegistry` and `WidgetBlocks` is read-only migration
source.

Legacy truth separates by authority:

- Page-specific semantic and `page-meta` truth maps into projection-aware Roma
  Page source after explicit validation;
- block content and exact translation values map into normal Instance source and
  projections;
- a Prague language value may be reused across market projections only through
  the shared explicit locale-to-projection mapping; market-specific offers,
  assets, currency, links and claims require exact owning projection truth;
- market-specific assets, offers and metadata map only when their source
  authority is proven;
- Prague `navmeta`, menu relationships and route chrome remain Prague-owned
  Website truth until a general Website product replaces that authority.

For each selected route:

1. Inventory visible content, behavior and market differences in route order.
2. Identify one global semantic Page identity and its approved projections.
3. Map each section to an existing composition-ready Widget or name the missing
   Widget work.
4. Create and edit normal account-owned Instances through Roma/Bob authorities.
5. Populate exact Instance projections through their overlay authorities.
6. Create one Roma Page, open it in Page Builder, and define the ordered
   Instance references plus Page-owned projection/SEO truth.
7. Publish through the normal four-file Page Compiler path.
8. Verify neutral resolver and exact projection URLs at `clk.live`.
9. After the general Website contract exists, map the Prague route to the Page
   identity while retaining approved Prague site behavior.
10. Delete replaced legacy assembly after the route delete gate is green.

Nested Prague `accountInstanceRef` behavior does not automatically become a
dependency graph. Each case becomes either a direct Page placement, a
self-contained Widget capability or an explicit blocker.

## Projection And SEO Mapping

Prague must map each approved projection as a complete market representation,
not translate only navigation or boilerplate.

Prague's translation sidecars are migration evidence, not automatic market
projections. Translation Agent may carry approved language-owned fields into
the normal Instance overlay authority, but neither it nor Prague may infer
market offers, assets, prices, currencies, links or structured claims. Missing
exact projection truth blocks the route record rather than falling back to a
generic locale.

For every migrated projection, the standard compiler contract must prove:

- complete visible content in the initial response;
- one projection-specific title and description;
- one robots policy and self-canonical exact projection URL;
- correct language/region and text direction;
- coherent heading behavior under the approved severity policy;
- unique generated coordinates;
- valid links and image semantics;
- compatible source-grounded structured data when approved;
- approved social metadata when present;
- shared deduplicated CSS/runtime;
- reciprocal projection relationships and sitemap membership;
- matching per-document `rel="alternate" hreflang` relationships;
- no client-side primary content or overlay fetch.

Prague must not regenerate or override that truth at standalone Page URLs.

Future Prague route integration separately owns:

- final Prague route canonicals;
- mapping of Prague routes to Page projection identities;
- site sitemap membership and shared navigation/chrome;
- Prague-wide social/structured identity where applicable.

That Website contract must prevent duplicate titles, canonicals, schema or
conflicting projection truth. It is not invented here.

## Global Resolver And Cache

For standalone Page proof:

```text
global Page URL
→ explicit/remembered choice, browser language, Cloudflare market evidence
→ temporary redirect to an exact projection URL when resolved
→ neutral chooser when no confident projection is resolved
```

Root redirects/chooser responses are not shared-cacheable. An exact projection
URL bypasses selection and always serves that projection regardless of visitor
IP.

The resolver works without a cookie. Any remembered choice uses Clickeen's
global privacy/consent/retention authority and cannot be a Prague-specific or
unguarded `clk.live`-wide preference.

On a CDN miss Tokyo reads only current Page `index.html` and `overlays.json`,
applies the selected compiled projection and caches complete HTML. Prague never
participates in this path.

When Page projection data changes:

- purge only the affected exact projection URL;
- preserve unrelated projection caches and shared CSS/runtime;
- purge the neutral resolver when available projection coordinates change.

When shared Page structure changes, purge every projection URL. CSS/runtime is
purged only when its bytes change.

## Update And Failure Truth

When a migrated Instance or one of its projections changes:

1. Roma saves/materializes the Instance or writes/deletes its projection
   through the normal authority.
2. Roma finds directly affected Page sources.
3. Roma rematerializes the one current Page package.
4. Tokyo installs only a complete successful replacement.
5. Targeted cache invalidation updates the same exact projection identities.

Prague never stores a package snapshot as a second source.

If Page replacement fails:

- no partial or mixed package may serve;
- the last complete package may remain public only through the atomic selection
  boundary approved in PRD 127;
- Roma shows the Page as out of date;
- no projection falls back to origin or another market;
- Prague cannot represent the Page as current;
- no legacy renderer substitutes after its delete gate has passed.

If a migrated Instance change reaches the direct rematerialization budget,
Roma's one terminal result must distinguish current Pages from named out-of-date
Pages. Remaining Pages preserve their last complete packages and may be retried
through the named direct rematerialize operation; Prague cannot report route
currency from Instance-save success alone.

## Route Migration Record

Before creating migration data, record one row per selected semantic route:

| Prague route | Legacy source        | Target account      | Global Page ID | Required Instances | Approved projections | Page proof        | Site-contract blocker | Delete gate |
| ------------ | -------------------- | ------------------- | -------------- | ------------------ | -------------------- | ----------------- | --------------------- | ----------- |
| `<route>`    | `<files/components>` | `<accountPublicId>` | `<pageId>`     | `<instanceIds>`    | `<projectionKeys>`   | `<URLs/evidence>` | `<named blocker>`     | `<proof>`   |

The record also captures current redirect, trailing-slash, 404, canonical,
market and language behavior that later Website cutover must preserve.

## Execution Slices

### Slice 1 — One global Page content proof

- prove the migration account's explicit tier profile; if it is the Clickeen
  Admin account `CLICKEEN`, verify deployed Tier99 truth rather than Tier 4
  inference;
- select one representative Prague route;
- inventory its legacy content and market differences;
- prove every required Widget is composition-ready;
- create normal Instances and exact projections;
- create one global Roma Page;
- publish and verify at least two exact projection URLs on a private/dev
  coordinate where possible or with `noindex,nofollow` throughout proof;
- prove neutral routing, complete initial SEO, CSS/runtime deduplication, cache
  behavior and included-Instance rematerialization.

This proves Page content/projection migration only. It does not authorize
production Prague route replacement.

### Slice 2 — General Website/host delivery decision

- approve the general contract mapping site routes to global Page projections;
- prove retained menu/chrome and complete semantic HTML;
- prove canonical, market selection, cache and update authority;
- update shared Page/Website planning instead of hiding behavior in Prague.

### Slice 3 — One Prague production route

- map the selected route to the approved Page identity/projections;
- verify desktop/mobile, Prague chrome, routing and SEO;
- switch canonical/indexing authority once; never leave both the proof Page and
  replaced Prague route independently indexable;
- verify an Instance/projection edit reaches the same Prague route;
- delete replaced legacy block/translation assembly;
- prove search gates for removed imports and paths.

### Slice 4 — Route-by-route expansion

Repeat the accepted route record and delete gate. Do not bulk-convert routes
whose Widgets, projections or site behavior are unsupported.

## Delete Gate

For a migrated production route, deletion is complete only when:

- the route no longer imports or executes `WidgetBlocks`, `blockRegistry` or
  legacy `blocks[]` composition;
- migrated content no longer reads Prague block JSON or translation sidecars;
- Prague stores no copied Page/Instance source or package;
- the public route uses the approved global Page/projection contract;
- required Prague chrome, route, market and SEO behavior is proven;
- Instance/projection update propagation is proven;
- the old path is removed rather than renamed, wrapped or retained as fallback.

Legacy source for unmigrated routes may remain only with exact route scope. It
is not a compatibility product mode.

## Verification

### Page content/projection proof

- Page source contains one global identity and ordered normal Instance
  references.
- Page root contains one current four-file generated package and no build or
  locale package tree.
- Neutral resolver selects only available projections.
- At least two exact projection URLs return complete semantic HTML.
- Standalone proof URLs are private/dev or `noindex,nofollow`; the existing
  Prague route remains indexed until accepted cutover.
- Each projection has exact title, description, canonical, robots, language,
  direction, structured-data and social behavior under the shared contract.
- Shared CSS/runtime contributions occur once.
- Editing an Instance or projection updates the same public identity with
  targeted cache invalidation.
- Failed replacement serves no mixed package; last-good behavior follows the
  atomic selection boundary approved in PRD 127 and Roma remains visibly out of
  date.

### Future Prague route cutover proof

- Existing navigation, branding and required chrome remain visible.
- Route, redirect, trailing-slash and 404 behavior match the migration record.
- Primary content and SEO are present in the initial Prague response.
- Canonical and projection authority are singular and correct.
- The accepted cutover removes proof `noindex` only under the final authority
  contract and leaves no competing indexable legacy document.
- Prague references Page identity without copied package state.
- Search gates prove the selected route no longer uses legacy assembly.
- Prague build/typecheck and Cloudflare deployment evidence are green.

## V1–V8 Design Audit

| ID                            | Required behavior                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| V1 Silent substitution        | missing Widget/projection/Website/tier truth blocks migration; Tier 4 never substitutes Tier99 |
| V2 Silent healing             | legacy content/projection data is mapped explicitly, never normalized into invented truth      |
| V3 Silent omission            | required content/SEO and dirty Page draft work are preserved and verified                      |
| V4 Fail-open control          | Page/tier/route/return checks fail closed; Prague cannot assign or bypass reserved Tier99      |
| V5 Corruption-as-absence      | invalid legacy/Page/overlay data or stale return target remains explicit                       |
| V6 Partial-success masquerade | Page/Instance save, rematerialization, Page preview and Prague cutover remain distinct         |
| V7 Masquerade/redress         | legacy renderers and parallel Admin/tier bypasses are removed, not wrapped                     |
| V8 Runtime test dependency    | public delivery depends on current stored Page/projection truth, not tests or probes           |

## Acceptance Criteria

- Prague legacy composition and translation sidecars are migration input, not
  future architecture.
- One representative route becomes normal global Instances and one global Page.
- The proof includes at least two complete first-class projections with no
  default-language fallback.
- The Page publishes one current four-file package through the standard
  compiler.
- Exact projection URLs return SEO-valid initial HTML with shared CSS/runtime
  and proven CDN caching.
- Standalone proof URLs remain non-indexed until one accepted cutover switches
  indexing/canonical authority and deletes the replaced legacy implementation.
- Updating an included Instance or projection updates the same Page identity.
- Included saved complete Instances do not require independent publication and
  Prague creates no standalone Widget as a side effect of Page publication.
- Prague content is maintained through the same Page Builder → Bob → Page
  Builder workflow as customer Pages, with no Prague-specific editor.
- Dirty Page work, save/cancel return and stale placement handling follow the
  same fail-closed Roma contract as customer Pages.
- Page Builder preview and public/Prague route currency remain separate truths.
- Prague uses the shared explicit Tier99 Admin profile when applicable, never a
  Tier 4/Admin ambiguity or Prague-owned bypass.
- Account `CLICKEEN` receives Pages through normal `pages.max=unlimited` policy,
  not through a Prague exception.
- Prague does not copy, parse, mutate or independently compose the Page package.
- Pages gains no Website/navigation machinery solely for Prague.
- Production cutover remains blocked until one general Website/host contract
  preserves Prague chrome, routes and initial-response SEO.
- Each migrated production route deletes its replaced Astro block and
  translation assembly through a proven route-specific gate.

## Open Questions Before Production Route Cutover

These are future Prague-program decisions, not PRD 127 decisions. They must be
named before Prague product-data changes:

1. Which representative Prague route and at least two projections provide the
   first standalone Page proof?
2. Which required sections still lack composition-ready Widgets or complete
   projection truth?
3. Is Prague the first Clickeen Website or another first-party consumer of the
   same general Website/host contract?

The Pages-to-Websites architecture must not be answered with Prague-only
machinery, and selecting a proof route does not add Prague migration or
production cutover to PRD 127.
