# Planning PRD — Prague Migration From Astro Blocks To Clickeen Pages

Status: Planning — not executable until the Account Page Compiler PRD is approved and deployed

Owner: Prague migration + Roma Pages

Date: 2026-08-03

Depends on: `planning_PRD__Account_Page_Compiler_And_Publication.md` and composition-ready widget packages

Unlocks: replacement of Prague's legacy Astro block composition with normal Clickeen Instances and Pages

## Direction

Prague is an existing Clickeen website whose current Astro blocks, block JSON,
registries, translation sidecars and `WidgetBlocks` assembly are legacy
implementation. They are migration input, not architecture to preserve.

The migration must preserve Prague's visible product experience:

- menus and navigation;
- public routes and redirects;
- market and locale behavior;
- branding and site chrome;
- content meaning and visual intent;
- crawlability and required SEO truth.

It does not need to preserve how Prague currently implements those things.

The target content model is:

```text
Prague legacy route content
→ normal account-owned Clickeen Instances
→ one Roma Page containing ordered Instance references
→ Page Compiler
→ one optimized Page at a stable clk.live Page URL
```

Prague is the first substantial first-party consumer and migration proof for
Clickeen Pages. It must consume the same Page product customers receive; it
must not create a Prague-specific Page compiler, copied package, block adapter
or visitor-time composition path.

## Relationship To The First Pages Release

The first Clickeen Pages release is a standalone single-page publishing
product. One Page has one stable public identity:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
```

A Page does not yet own:

- menus or navigation;
- a shared website header or footer;
- a site route tree;
- multi-Page domains;
- sitemaps or site-wide locale alternates.

Those are Website-level concerns. A future Clickeen Website may collect Page
IDs under routes and add shared navigation, chrome, domains and site-wide SEO.
That future product must reuse Page identities and the Page Compiler.

Prague already has those Website-level concerns. Therefore this PRD separates:

1. **Page content migration** — replace Prague block composition with normal
   Instances and published Clickeen Pages.
2. **Prague route cutover** — make Prague's existing routes and retained site
   chrome deliver those Pages.

Page content migration can be specified and proven through the stable
`clk.live` Page URL. Production Prague route cutover is blocked until Clickeen
approves one general Website/host-route contract that preserves site chrome and
serves the Page's initial semantic HTML. This PRD must not invent a Prague-only
redirect, reverse proxy, fragment injector or shell adapter to bridge that gap.

## Why The Previous Delivery Modes Are Removed

The previous PRD listed:

- link or redirect;
- reverse-proxy full document;
- Prague shell with injected composed content.

Those were unresolved architecture branches caused by treating Prague's legacy
shell as the Page product boundary. They are removed.

The agreed Page boundary is one stable Page identity backed by one compiled,
hosted artifact. Any later host or Website integration must reference that Page
identity and be designed once for Prague and external platforms—not improvised
per Prague route.

Until that general contract exists, Prague may link to a standalone Page for
testing, but a link is not accepted as production route parity when the required
Prague menu/chrome would disappear.

## Current Truth And Dependency Gate

The historical PRD106 series is not current runtime authority. Today:

- Roma stores Page source but cannot publish it.
- no deployed Page Compiler emits coherent Page HTML/CSS/runtime or Page SEO;
- Tokyo-worker does not serve public Pages;
- Prague still renders repository/Astro block data through its legacy assembly.

This migration remains Planning until all of the following are true:

- the Account Page Compiler PRD is approved and executed;
- Roma can publish a real Page at the approved stable `clk.live` coordinate;
- the compiler proves initial semantic HTML, Page-level SEO, CSS deduplication,
  runtime deduplication and affected-Page recomposition;
- every block needed by the selected Prague route has a real
  composition-ready Widget/Instance representation;
- base-locale limitations are accepted for the selected route;
- the general Prague Website/host-route delivery contract is approved before
  production route cutover.

If Page capability is missing, fix the Page Compiler PRD. If a widget is
missing, fix that Widget. Prague must not fill either gap locally.

## Authority Gate

| Concern                                  | Active authority                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Prague route content before migration    | current Prague source, as migration input only                                                      |
| Migrated content/configuration           | normal account-owned Instances                                                                      |
| Migrated composition order               | Roma Page source                                                                                    |
| Page compilation and Page-level SEO      | Roma Page Compiler                                                                                  |
| Page package and stable public Page URL  | Tokyo-worker/R2 and `clk.live`                                                                      |
| Prague menus, route tree and site chrome | Prague until a general Website authority replaces it                                                |
| Prague market/locale routing             | Prague until a general Website authority replaces it                                                |
| Account/session coordinate               | Berlin bootstrap → Roma current `accountPublicId`                                                   |
| Runtime/deploy                           | Roma Pages, Tokyo-worker Worker, and Prague Pages only for an approved route cutover                |
| Verification                             | Roma Page routes, public Page URL, Prague public route after cutover, and exact deployment evidence |

Named migration account and Page IDs must be recorded before product data is
created. No Page or Instance source may be written directly to R2.

## Product Rules

1. Each migrated Prague content section becomes a normal Clickeen Instance.
2. The target Page stores only ordered `instanceId` references.
3. Prague does not store private Page source, Instance source or copied compiler
   output.
4. Prague does not parse, modify, concatenate or repair Page packages.
5. Page compilation happens before public delivery, never on a visitor request.
6. The stable Page URL represents the Page and continues serving successful
   recompositions after an included Instance changes.
7. Prague's current blocks, block IDs, registries, Astro rendering and
   translation sidecars are deleted route-by-route after their replacement is
   proven.
8. Existing Prague menus/navigation remain outside Page source in the first
   Pages release.
9. No menu, navigation, shared-shell or Website feature is added to Pages solely
   to unblock Prague.
10. Production route cutover cannot remove required Prague chrome or weaken
    initial-response SEO.
11. No migration claims parity while required locale behavior is unsupported.
12. One representative route proves the complete path before broader migration.

## Migration Source And Target

Current Prague data under `tokyo/prague/pages/**`, repository JSON, translation
sidecars, `blocks[]`, `blockRegistry` and `WidgetBlocks` is read-only migration
source.

Legacy metadata separates by authority:

- Page-specific `page-meta` truth maps into the Roma Page SEO source after
  explicit validation.
- Prague `navmeta`, directory labels and menu relationships remain Prague-owned
  Website metadata until a general Website product replaces that authority.
- Neither shape survives as block-shaped Page product architecture.

For each selected route:

1. Inventory visible content and behavior in route order.
2. Map each content section to an existing composition-ready Widget or identify
   the missing Widget work explicitly.
3. Create normal account-owned Instances through Roma/Bob authorities.
4. Create one Roma Page containing those Instance references in the same content
   order.
5. Publish through the normal Page Compiler path.
6. Verify the standalone Page at its stable `clk.live` URL.
7. Only after the general Website/host-route contract exists, map the Prague
   route to the Page identity while retaining approved Prague site behavior.
8. Delete the replaced legacy content assembly after the route delete gate is
   green.

Nested Prague `accountInstanceRef` behavior is not automatically a Page
dependency graph. Each case must become either:

- a normal direct Page placement;
- a self-contained Widget capability owned by that Widget; or
- an explicit blocker that keeps the route out of migration.

The migration must not add a graph or recursive Prague composer.

## Page-Level SEO Contract

The Account Page Compiler PRD owns the SEO integrity of the standalone Page
artifact. For every migrated Page it must produce and verify:

- primary content in the initial HTML;
- exactly one approved title and description;
- exactly one robots and canonical policy;
- correct `lang` and `dir` for the supported locale;
- coherent whole-Page heading behavior under the approved compiler policy;
- unique generated IDs;
- valid declared links and image semantics;
- compatible, non-duplicated structured-data contributions;
- approved social metadata when present;
- deduplicated CSS/runtime and no client-only primary content.

Prague must not regenerate or override that SEO at the standalone Page URL.

Future Prague route integration must separately define Website-level authority
for:

- the final Prague canonical URL;
- market/locale route alternates and `hreflang`;
- sitemap membership;
- shared navigation and site chrome;
- Prague-wide social and structured identity when applicable.

That contract must prevent duplicate titles, canonicals, schema or conflicting
language truth. It is deliberately not invented in this Page-content migration
PRD.

## Locale Boundary

The first Page Compiler release publishes only the account base/default locale.
Therefore:

- select a base-locale Prague route for the first proof;
- do not migrate non-base Prague routes to production Page delivery;
- Prague block translation sidecars remain only for unmigrated routes;
- Prague must not apply its block translation operations to Page packages;
- multi-locale Page publication and Website-level `hreflang` require separately
  approved contracts.

This is a real scope boundary, not permission to present untranslated content as
localized output.

## Update, Cache And Failure Truth

When a migrated Instance changes:

1. Roma saves and materializes the Instance through its normal authority.
2. Roma finds directly affected Page sources.
3. Roma recompiles the affected Page.
4. Tokyo-worker activates only the complete successful Page build.
5. The same stable Page URL serves the new build after exact cache purge.

Prague must never take a copied snapshot of that package as a second source.
The future route integration must reference the Page identity and preserve this
update behavior.

If Page recomposition fails:

- the last complete Page build may remain public;
- Roma shows the Page as out of date;
- Prague route cutover cannot represent that Page as current;
- no legacy block renderer silently substitutes for the failed Page after its
  delete gate has passed.

## Route Migration Record

Before any migration data is created, record one row per selected route:

| Prague route | Legacy source        | Target account      | Target Page ID | Required Instances | Supported locale | Page proof       | Site-contract blocker | Delete gate |
| ------------ | -------------------- | ------------------- | -------------- | ------------------ | ---------------- | ---------------- | --------------------- | ----------- |
| `<route>`    | `<files/components>` | `<accountPublicId>` | `<pageId>`     | `<instanceIds>`    | `<locale>`       | `<URL/evidence>` | `<named blocker>`     | `<proof>`   |

The record must also capture current redirect, trailing-slash, 404, canonical
and locale behavior that a later Website route cutover must preserve.

## Execution Slices

This document does not authorize execution while its dependency gates are red.
After they are green, migration proceeds one slice at a time.

### Slice 1 — One Page content proof

- select one base-locale representative Prague route;
- inventory its legacy content stack;
- prove every required Widget is composition-ready;
- create normal Instances and one Roma Page;
- publish and verify its stable `clk.live` Page URL;
- prove initial SEO, CSS/runtime dedupe and included-Instance recomposition.

Completion of Slice 1 proves Page content migration only. It does not authorize
production Prague route replacement.

### Slice 2 — General site delivery decision

- approve the general Website/host-route contract;
- prove how the stable Page identity is delivered under a site route;
- prove retained menu/chrome and initial semantic HTML;
- prove canonical, locale and cache/update authority;
- update the Page/Website planning docs rather than hiding behavior in Prague.

### Slice 3 — One Prague production route

- map the selected route to the approved Page identity;
- verify desktop/mobile behavior, Prague chrome, routing and SEO;
- verify an Instance edit reaches the same Prague route;
- delete the route's replaced legacy block assembly and data;
- prove search gates for the removed imports and paths.

### Slice 4 — Route-by-route expansion

Repeat the accepted route record and delete gate. Do not bulk-convert routes
whose widgets, locales or site behavior are not supported.

## Delete Gate

For a migrated production route, deletion is complete only when:

- the route no longer imports or executes `WidgetBlocks`, `blockRegistry` or
  legacy `blocks[]` composition;
- migrated content no longer reads Prague block JSON or translation sidecars;
- Prague stores no copied Page or Instance source/package;
- the public route uses the approved Page identity contract;
- required Prague menu, route, locale and SEO behavior is proven;
- included-Instance update propagation is proven;
- the old path is removed rather than renamed, wrapped or left as fallback.

Legacy source for unmigrated routes may remain only with exact route scope. It
is not a compatibility product mode.

## Verification

### Page content proof

- Page source contains only ordered normal Instance references.
- Stable Page URL serves one initial semantic document.
- Every migrated content section appears exactly once and in order.
- Page title, description, canonical, robots, `lang`, `dir`, heading policy,
  structured data and social metadata follow the compiler contract.
- Shared CSS/runtime contributions occur once.
- Multiple Instances remain behaviorally isolated.
- Editing an included Instance updates the same Page URL.
- Failed recomposition leaves the last good build exact and the Page visibly out
  of date.

### Future Prague route cutover proof

- Existing menu, navigation, branding and required chrome remain visible.
- Route, redirect, trailing-slash and 404 behavior match the approved record.
- Primary content and SEO are present in the initial Prague response.
- Canonical and locale authority are singular and correct.
- The Prague route follows the active Page build without copied package state.
- Search gates prove the selected route no longer uses legacy block composition.
- Prague build/typecheck and Cloudflare deployment evidence are green.

## V1–V8 Design Audit

| ID                            | Required behavior                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| V1 Silent substitution        | Missing Widgets, locale output, Page builds or site contracts block migration         |
| V2 Silent healing             | Legacy block data is migrated explicitly, never normalized into new truth silently    |
| V3 Silent omission            | Every required visible section, route behavior and SEO field is recorded and verified |
| V4 Fail-open control          | A route cannot cut over with missing Page, locale, chrome or SEO proof                |
| V5 Corruption-as-absence      | Invalid legacy/Page data is a blocker, not an empty section or Page                   |
| V6 Partial-success masquerade | Standalone Page proof is not represented as completed Prague route migration          |
| V7 Masquerade/redress         | Legacy block composition is deleted, not hidden behind an adapter or fallback         |
| V8 Runtime test dependency    | Public delivery depends on active stored Page truth, not tests or probes              |

## Acceptance Criteria

- Prague legacy composition is treated as migration input, not future Page
  architecture.
- One representative route's content is faithfully represented by normal
  Instances and one Roma Page.
- The Page publishes through the standard compiler at one stable `clk.live`
  Page URL.
- The Page is SEO-complete initial HTML with consolidated CSS/runtime.
- Updating an included Instance recompiles the Page behind the same URL.
- Prague does not copy, parse, mutate or independently compose the Page package.
- Pages V1 gains no menu, navigation or Website machinery to accommodate
  Prague.
- Production Prague route cutover remains blocked until one general site
  delivery contract preserves existing chrome and initial-response SEO.
- After that contract is approved, each migrated route deletes its replaced
  Astro block composition through a proven route-specific delete gate.

## Open Questions Before Production Route Cutover

Only these Prague-specific product questions remain open:

1. What general Website/host-route contract maps a stable Page identity into a
   site while retaining site-owned navigation/chrome and initial-response SEO?
2. When that contract exists, does Prague become its first Website collection
   or another first-party host consumer of the same contract?
3. Which base-locale Prague route is the first representative Page proof?
4. Which current Prague sections still lack composition-ready Widgets?

The first question belongs to the future general Pages-to-Websites/hosts
architecture. It must not be answered with one-off Prague machinery.
