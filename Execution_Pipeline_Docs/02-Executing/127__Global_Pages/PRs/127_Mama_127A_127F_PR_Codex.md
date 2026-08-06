# 127 Mama + 127A–127F Peer Review — CODEX

Date: 2026-08-04

Status: **REVIEW COMPLETE — PROGRAM DIRECTION ACCEPTED; SLICE CONTRACTS NEED CORRECTION BEFORE BLIND EXECUTION**

## What this review did

Three reviewers examined the current Mama PRD and 127A–127F:

- Staff Engineer — architecture, code ownership, blast radius, unnecessary
  machinery, vague execution language, documentation, and V1–V8;
- Senior PM — product behavior, UX, product laws, tiers, Pages versus Widgets,
  localization, templates, and customer wording;
- Principal TPM — sequence, system boundaries, Cloudflare/Tokyo delivery,
  deployment, verification, and V1–V8.

The reviews were checked against the current repository rather than accepted
at face value. Findings below are included only when current code,
documentation, or an already-settled Product Owner decision proves them.

Reviewed execution documents:

- `127__PRD__Global_Pages_Program.md`
- `127A__PRD__Page_Source_And_Policy.md`
- `127B__PRD__Web_Code_Generator.md`
- `127C__PRD__Page_Publication_And_Public_Serving.md`
- `127D__PRD__Page_Currency_And_Explicit_Update.md`
- `127E__PRD__Roma_Pages_And_Page_Builder.md`
- `127F__PRD__Template_Snapshots_And_Catalogs.md`

Primary current-system evidence:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/widgets/authoring/WidgetFiles.md`
- current Roma, Bob, Tokyo-worker, Widget, policy, and runtime-materializer code

## Verdict in plain words

The product model is now correct:

- a Page is an ordered collection of saved Widget Instances;
- the Page stores Instance references, not copied Widget source or public
  Widget URLs;
- one Web Code Generator writes complete HTML, CSS, and JavaScript for saved
  Instances and Pages;
- the generator is repository code used in the browser, not a Worker, API,
  Queue, or separate deployed service;
- Save and Update are explicit customer actions;
- Publish only exposes already-saved files;
- Tokyo stores and serves; Roma owns account and policy; Bob edits Instances;
  Page Builder edits Pages;
- `baseLocale` and exact overlays remain the localization model;
- Pages have only Current and Needs update;
- there are no package histories, dependency graphs, background rebuilds, or
  country copies.

That direction should be protected.

The execution set is not yet safe to hand to an agent and say “execute A–F
without invention.” The remaining gaps are concrete. Most are missing details
at the exact point where 127 replaces current behavior. Closing them requires
small contracts in existing systems, not new systems.

## Proven corrections required before the affected slice executes

### 1. 127B must define how translated Widget text reaches complete HTML

#### What the PRD currently says

127B removes visitor-side primary-content construction and requires complete
Widget HTML. It also says existing overlay markers will be reused.

#### What the code proves

The required HTML field markers do not currently exist:

- `@clickeen/ck-runtime-materializer` injects `CK_LOCALE_CONTEXT`;
- current overlay paths are applied to JavaScript state;
- current Widget client code then constructs or changes the DOM;
- 127C specifies Page HTML completion, not standalone Widget HTML completion.

For example, current Cards HTML does not contain the complete saved card
content. Current `widget.client.js` creates it.

#### Required correction

127B must define one exact generated-HTML field-path contract using the
existing editable-field paths. It must also assign standalone Widget locale
completion to Tokyo in the same cutover:

```text
saved Widget index.html with exact field markers
+ exact Instance overlay
→ Tokyo replaces those exact marked values
→ complete localized HTML response
→ runtime.js adds behavior only
```

The contract must name the actual attributes/markers and failure behavior.
Missing or extra paths fail. Base content is never returned as a requested
non-base locale.

This is not another renderer. It replaces the current JavaScript state-to-DOM
translation with deterministic overlay-to-HTML replacement.

### 2. 127B must define the Web Code Generator input and Roma validation

#### What the PRD currently says

Bob generates files in the browser, previews them, and submits those exact
files. Roma “validates the source and file contract” without defining that
contract.

#### What the code proves

Current Roma performs important trusted work before it generates files:

- resolves account asset references;
- resolves account typography data;
- applies current account/Instance/base-locale coordinates;
- resolves policy booleans;
- generates the accepted bytes server-side.

After 127B, browser-submitted HTML/CSS/JavaScript is untrusted input. Roma must
validate it without generating a second result.

#### Required correction

127B must define exact exported contracts for at least:

```text
generateInstance(input) -> structured source + index.html + styles.css + runtime.js
generatePage(input)     -> Page files + overlays.json + generatedFrom
```

`generateInstance` input must name:

- compiled Widget spec/default files;
- structured Instance source;
- account, Instance, and base-locale coordinates;
- resolved asset map;
- account typography data;
- resolved policy booleans.

Roma's submitted-file validator must name what it checks, including:

- expected Widget/Instance/Page root coordinates;
- required HTML markers and source-to-HTML field agreement;
- allowed runtime modules and asset references;
- file/media/size limits already owned by product contracts;
- malformed or source-mismatched payload failures.

Roma validates submitted bytes. It does not create different bytes.

### 3. 127B must settle Widget Create and Duplicate

#### What the PRD currently says

127B replaces the server materializer and specifies Bob Open, Edit, and Save.
It does not specify Widget Create or Duplicate.

#### What the code proves

Create, Save, and Duplicate all use the current server materializer. Removing
that path makes Create and Duplicate undefined.

#### Product Owner decision required

Choose the customer behavior explicitly:

- Create can open an unsaved Bob draft and create the Instance only on Save;
  or Roma's Widgets browser can invoke the shared Web Code Generator before
  submitting Create.
- Duplicate can open an unsaved Bob draft or generate the new identity/files
  in the Roma browser before submitting Duplicate.

The selected path must replace the old Instance ID in HTML/runtime coordinates
and must also be the rule later used by **Use template**. No server-side second
generator should be retained merely to keep these commands working.

### 4. 127B must specify Page CSS and runtime assembly

#### What the PRD currently says

It says to preserve Instance isolation and deduplicate only proven identical
code.

#### What the code proves

Runtime order matters today:

- each Instance payload is registered before Widget behavior initializes;
- shared modules and Widget modules may initialize all matching roots;
- repeated Instances of the same Widget type must not share Instance state;
- Widget CSS commonly uses Widget-type selectors rather than Instance-ID
  selectors.

“Preserve isolation” is not enough for an executor to implement this safely.

#### Required correction

127B must state the generated runtime order:

1. every placement's data/config payload;
2. each byte-identical shared runtime module once;
3. each required Widget behavior module once;
4. Page-only behavior last.

It must also state:

- which current file boundaries identify deduplicable modules;
- that Instance-specific values stay in the placement/root payload or CSS
  variables;
- that selectors are not heuristically rewritten;
- that repeated, differently configured Instances of the same Widget are a
  required contract test.

No module loader or chunk registry is needed.

### 5. Page translation must be specified as an extension of the existing Translation Agent

#### What the PRDs currently say

127A and 127E call Page translation an existing Translation Agent operation.

#### What the code proves

The existing operation is Instance-specific:

- the grant names an Instance and `agent:widget.instance.translator`;
- Roma calls the Instance translation operation;
- Tokyo exposes Instance translation routes;
- Instance overlays are separate locale objects, while 127A places Page
  metadata overlays in Page source.

#### Required correction

Keep the existing Translation Agent, but specify its Page command:

```text
Page Builder Generate translations
→ authenticated Roma Page translation route
→ existing Translation Agent with Page coordinate/grant
→ Tokyo Page-overlay write route
→ accepted Page metadata overlays written to Page source
→ Page revision advances under one explicitly defined rule
→ Page derives Needs update
```

The PRDs must name:

- allowed Page metadata fields from 127A;
- Page grant capability and coordinate;
- Roma and Tokyo route boundaries;
- expected Page revision/concurrency behavior;
- whether revision advances once for the accepted multi-locale command or once
  per accepted locale write, with exhaustive translated/failed locale results.

This is an additional operation of the current Translation Agent, not a new
Page translator or translation service.

### 6. 127D must stop treating the Instance revision as an open investigation

#### What the PRD currently says

127D says to reuse an effective Instance revision if one exists, otherwise add
one. It also refers to an existing batch revision read.

#### What the code proves

Neither exists:

- Instance source has `updatedAt` and a public-package fingerprint;
- no single value advances for both accepted Instance Save and accepted
  overlay writes;
- current Roma Instance inventory performs separate fact reads, not one
  account-scoped batch revision read.

#### Required correction

127D must name one field now:

```text
savedRevision: positive integer
```

It is stored in the existing Instance source/config authority and advances
after:

- successful Instance Save;
- successful approved Instance-overlay write.

Tokyo needs one account-scoped read accepting the required Instance IDs and
returning only their `instanceId + savedRevision`. Roma uses that one existing-
authority route for Page list/open freshness.

This is one field and one batch read. It is not a dependency index, graph,
registry, cache, or evidence product.

### 7. Removing an account locale must define Page behavior

#### What the PRD currently says

A Page's selected locales must remain a subset of account active locales. The
program does not say what happens to Pages when an active account locale is
removed.

#### What the current product does

Account locale removal immediately deletes the corresponding exact Instance
overlay through the existing locale cleanup operation.

#### Required correction

Extend that same account-locale removal operation to Pages:

- remove the locale from Page source and its Page metadata overlay;
- remove the locale from the generated serving `overlays.json` without running
  Web Code Generator or Translation Agent;
- advance the Page source revision so the Page becomes Needs update;
- purge that exact Page-locale cache/URL;
- make that removed exact-locale URL stop serving immediately;
- reconcile every affected Page and every failed cleanup coordinate explicitly.

This is locale cleanup in the existing authority, not automatic Page
generation.

### 8. SEO/GEO/AEO toggle output contradicts itself

#### What the PRDs currently say

127A, 127B, and the Mama PRD say enhanced search/sharing output is emitted only
when `embed.seoGeo.enabled` is authorized and the customer enables it. 127C
then requires canonical, `hreflang`, social metadata, and structured data on
every exact-locale Page response.

#### Required correction

Use the already documented product law:

- every output receives complete semantic HTML, correct visible content,
  correct language, title, and honest robots behavior;
- when SEO/GEO/AEO is enabled, add supplied description/social metadata,
  canonical/alternate-locale relationships, discovery, and supported
  source-backed structured data;
- Roma authorizes and passes the boolean;
- Web Code Generator writes the eligible output/markers;
- Tokyo applies stored exact values and never makes a tier decision.

Trying to enable an unavailable toggle changes nothing and opens the existing
Upgrade dialog.

### 9. The stable Page URL has one missing authority, not two

#### What the PRD currently says

Locale selection starts with a remembered visitor choice under an “existing
global privacy/choice authority,” then browser language, account country map,
and base locale.

#### What the code proves

- The account country-to-locale map **does exist** in Roma account locale
  policy and account settings. The review claim that it is invented is wrong.
- A shared `clk.live` remembered-choice/privacy authority does **not** exist in
  the inspected current code or documentation.

#### Product Owner decision required

Choose one:

1. remove remembered choice from PRD 127 and use browser language → existing
   account country map → base locale; or
2. keep remembered choice and specify the privacy-compliant owner, cookie or
   storage scope, consent behavior, lifetime, reset behavior, and cache
   isolation in 127C.

Do not remove the existing account country mapping and do not create Page-
specific country mappings.

### 10. 127C must choose the actual Cloudflare cache contract

127C says completed HTML is cached by Page revision and locale, but the public
URL has no revision and the current Tokyo Page path does not use a revision-
bearing Cache API key.

The simplest accepted contract is:

- cache completed HTML at the exact-locale URL;
- use Page revision as response integrity/ETag evidence, not another public
  identity;
- purge the affected stable/exact-locale URLs after accepted Save/Update,
  Publish, Unpublish, Delete, or locale removal.

If a revision-bearing internal Cache API key is desired instead, 127C must name
and justify it. The executor must not choose silently.

### 11. 127E must name the blank Page factory and Bob reuse boundary

#### Blank Page

`/pages/new` refers to an “accepted blank Page/template authority,” but 127F's
Catalog work happens later and cannot be 127E's dependency.

127E needs one browser-local blank Page factory with exact defaults:

- no Page ID before Save;
- current account `baseLocale`;
- ordinary non-template state;
- empty placements;
- explicit initial display name and title;
- explicit robots value;
- base locale only;
- no overlays.

Saving a blank draft is allowed; publishing it is not.

#### Bob/Dieter reuse

Bob's TopDrawer, ToolDrawer, and Workspace are currently private Bob
components. 127E must name which product-neutral components become shared and
which Page Builder parts reuse only Bob's taxonomy and Dieter contracts.

Do not authorize an abstract editor framework. Extract only components that
both concrete editors actually use.

### 12. 127F must match the accepted DevStudio Catalog-management direction

127F currently says CLICKEEN operators edit Catalog templates through Roma
**My templates**. The accepted Product Owner direction was to keep Catalog
management out of customer Roma and manage CLICKEEN Catalog truth through
DevStudio.

Required correction:

- regular accounts manage their own **My templates** through Roma/Bob/Page
  Builder;
- every customer's Roma Catalog remains read-only;
- DevStudio operates the underlying CLICKEEN-owned Widget/Page templates
  through the normal CLICKEEN account and Roma/Tokyo authorities;
- every CLICKEEN template remains an ordinary `isTemplate: true` object;
- no Catalog registry, copied Catalog record, or separate storage system is
  added.

### 13. Catalog base-locale behavior needs one presentation decision

The current matching-base-locale rule prevents silently relabeling English
template content as Italian, which is correct. Roma must not show a template as
usable and then fail only after the customer clicks it.

Recommended first-release behavior:

- DevStudio maintains Catalog templates for explicitly supported base locales;
- Roma Catalog lists only templates matching the current account base locale;
- Roma displays the template language;
- a direct/stale request with a mismatched locale fails and creates nothing;
- no template translation or rebase machinery is introduced.

The Product Owner must accept or replace this presentation rule before 127F.

### 14. 127B needs an explicit cloud-dev product-data cutover

Changing Widget definitions and generator code does not rewrite saved R2
Instances. Existing retained Instances may still contain empty HTML and
visitor-side primary-content construction.

127B must separate code and product-data work:

1. deploy the code through the documented Pages/Worker paths;
2. resolve every retained cloud-dev Instance through Roma/Tokyo reads;
3. re-save it through the approved product route, or delete/recreate disposable
   pre-GA Instances after exact read-only inventory;
4. never rewrite account R2 objects directly;
5. verify source, HTML/CSS/JS, overlays, publication, base response, translated
   response, and cache state;
6. reconcile every retained/deleted coordinate.

This is a finite pre-GA data cutover, not migration machinery or backward
compatibility.

### 15. Widget attribution stays in 127, but its product truth needs approval

One reviewer recommended moving Free Widget attribution and JSON-LD out of
127B. That recommendation is rejected. The Product Owner explicitly made this
a Web Code Generator responsibility.

What remains open is product data, not architecture:

- approve the public name, factual description, attribution wording, stable
  Schema.org identity, and Prague product URL for all eight Widgets;
- ensure every required Prague route exists before generated attribution points
  to it;
- keep the implementation as one small reviewed product-data module;
- do not create a registry service, crawler, SEO agent, or learning system.

The current PRD table is labeled draft and therefore cannot become production
truth without Product Owner approval.

## Smaller corrections that should be made with the blockers

- In 127B, replace the exclusion “Page completion on public requests” with
  “Web Code Generator execution on public requests.” Tokyo's deterministic
  stored-overlay HTML completion remains required.
- State that 127B proves Page generation through contracts/fixtures and 127E
  performs the Page Builder import later.
- Replace “A widget or translated Page information has changed” with: “A widget
  or page translation has changed. Update the page to continue.”
- State that trying to publish a Needs update Page opens the existing Update
  gate and changes nothing.
- Keep SEO fields visible while the toggle is off and explain that enabling the
  feature publishes those search/sharing enhancements.
- Replace 127A's “a blank Page may be saved if product behavior permits it”
  with the accepted decision: a blank Page may be saved but not published.
- Remove “other domain actions, if any” from 127E. Name the first-release
  actions or state there are no others.
- Replace “reuse a revision if one exists, otherwise add one” with the exact
  `savedRevision` decision above.
- Require CLICKEEN Catalog templates to be proven usable from another account,
  including referenced assets, without inventing asset-copy orchestration.

## Product Owner decisions before PRD correction closes

| Decision                                                                | Why it cannot be delegated to execution                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Widget Create and Duplicate behavior after server generation is removed | This changes when an Instance comes into existence and what the customer sees.         |
| Remembered visitor locale choice in 127                                 | This decides whether 127 adds a new privacy/cookie authority or deliberately does not. |
| Catalog base-locale presentation                                        | This decides which templates customers see and avoids a click-then-fail Catalog.       |
| Eight Widget attribution/product identity values                        | These are public Clickeen product claims and links, not engineering defaults.          |

All other corrections above are implementation contracts required to preserve
already-settled product behavior.

## Feedback explicitly rejected

The following reviewer ideas or claims are not accepted:

- **“The account country-to-locale map does not exist.”** Incorrect. Roma
  already reads and edits `localePolicy.ip.countryToLocale`.
- **“Move Free Widget attribution/JSON-LD out of 127 because it is not part of
  Pages.”** Rejected. The Product Owner explicitly included it in the shared
  Web Code Generator cutover.
- another Widget HTML writer or second renderer;
- a Web Code Generator Worker/API/service;
- a new Translation Agent or Page translation service;
- a dependency graph, Queue, poller, autonomous rebuild, or evidence product;
- package versions, candidate/selected packages, or retained package history;
- locale-specific CSS or JavaScript packages;
- a chunk registry, module-loader framework, or selector-rewriting system;
- new Page placement limits beyond existing Instance and Page entitlements;
- cross-account asset-copy orchestration;
- a template database, marketplace, or Catalog storage system;
- a generic Bob/Page Builder editor framework;
- Tier99-specific authorization machinery.

## Documentation that must change after the owning behavior deploys

Do not write future behavior into current-system documents before deployment.

### After 127A / policy and source deploy

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- Tier99 readers: Berlin, Michael/Supabase, San Francisco/policy profile docs

### After 127B / Web Code Generator deploy

- `documentation/widgets/authoring/WidgetFiles.md`
- all eight Widget operator docs and affected shared Widget docs
- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/architecture/RuntimeProfiles.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- Web Code Generator package README/operator contract
- actual affected GitHub build/architecture workflows

### After 127C–127F deploy

- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/devstudio.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/engineering/CloudflareOperations.md` only if the real
  cache/purge operation changes
- add one concise `documentation/capabilities/pages.md` owning the complete
  deployed Pages customer/runtime contract

`CONTEXT.md` remains short and receives only current high-level truth.

## V1–V8 review

| Gate                            | Current result      | Reason                                                                                                                                  |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| V1 — Silent substitution        | GREEN in direction  | Missing source/locale values are required to fail rather than fall back.                                                                |
| V2 — Silent healing             | GREEN               | Corrupt source/files are rejected rather than repaired.                                                                                 |
| V3 — Silent omission            | RED until corrected | Standalone Widget localized HTML, Create/Duplicate, locale removal, and retained R2 Instances are missing from the execution contracts. |
| V4 — Fail-open control          | RED until corrected | Roma's validation of untrusted browser-generated files is not defined.                                                                  |
| V5 — Corruption-as-absence      | GREEN               | Page and Instance corruption is not treated as blank/missing.                                                                           |
| V6 — Partial-success masquerade | YELLOW              | Page translation and locale cleanup need exhaustive success/failure contracts before they can claim completion.                         |
| V7 — Masquerade/redress         | YELLOW              | The old materializer can survive under Create/Duplicate or generated workflows unless the blast-radius deletion list is explicit.       |
| V8 — Runtime test dependency    | GREEN               | Tests remain verification and are not required for normal product work.                                                                 |

## Readiness by slice

| Slice | Readiness    | What must close first                                                                                                                        |
| ----- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 127A  | Almost ready | Make blank-save behavior exact and allocate the Page translation write/revision contract.                                                    |
| 127B  | Not ready    | Close Widget localized HTML, WCG input/validation, Create/Duplicate, CSS/runtime assembly, attribution approval, and cloud-dev data cutover. |
| 127C  | Not ready    | Align SEO toggle output, stable-locale choice, exact cache/purge behavior, and standalone Widget locale serving ownership.                   |
| 127D  | Not ready    | Specify `savedRevision`, its writes, and the account-scoped batch read.                                                                      |
| 127E  | Not ready    | Specify Page Translation Agent routes/grants, blank factory, and concrete Bob component reuse.                                               |
| 127F  | Not ready    | Restore DevStudio Catalog management and decide matching-base-locale presentation.                                                           |

## Final recommendation

Do not redesign the program and do not add machinery.

Correct the execution PRDs in place around the fifteen concrete items above.
Then run one final short consistency review focused only on:

1. every command has one named authority and route;
2. every generated file has one writer and one validator;
3. Widget and Page exact-locale HTML are complete before JavaScript;
4. no old server materializer or visitor-side content constructor remains;
5. code, remote product data, deploy proof, and documentation are all named in
   the owning slice.

After those corrections, the accepted A → B → C → D → E → F sequence remains
the right sequence.
