# PRD 129C — Publish And Generate Serving Package

Status: **CLOUD-DEV DEPLOYED — OWNER QA PENDING**

Parent: `129__PRD__Clickeen_Widget_Software_And_Instance_Lifecycle_Architecture.md`

Depends on: approved 129A Widget software/Create contract and approved 129B
Edit/Save contract

Owner: Clickeen product owner/architect

Date: 2026-08-17

## 1. Outcome

129C defines one explicit product action:

```text
user clicks Publish
-> system decides whether this account may publish the instance
-> Roma materializes the exact saved instance once
-> Tokyo-worker stores the generated package and publication truth
-> the stored package becomes public
```

Publish is the only action that generates the serving files:

```text
index.html
styles.css
runtime.js
```

129C does not create an instance, edit it, Save it, or serve visitor requests.

## 2. Why Publish Is Separate

Users may create, edit, preview, and Save many instances without making them
public.

Publish is the moment the user chooses to release one exact saved instance and
consume public capacity. It therefore owns both:

- the account publication decision; and
- generation of the browser files that will be served.

Generating those files during Create or Save would incorrectly turn ordinary
editing into a public release operation and would break the Free model.

## 3. Input From 129B

Publish receives:

- the exact account and instance identity;
- explicit Publish intent;
- the exact current saved instance source;
- the Widget software and compiled materializer contract from 129A;
- exact account policy;
- exact account-owned fonts and referenced assets needed by the saved state;
- the Widget's internal `discovery.json`; and
- the exact saved **Enable SEO/GEO** value.

Publish never reads an unsaved Bob draft. If Bob is dirty, the user Saves first
and then Publishes.

## 4. Starting Implementation Mismatches

Before this local PRD 129 pass, the system generated public files during New,
Duplicate, and Save, while Publish mainly changed publication state after the
package already existed.

The account suspension lifecycle and its public-truth transition are owned by
the account system, not by an ordinary Widget Publish. Its scheduled runner and
complete account-root deletion operation remain documented implementation
gaps outside PRD 129.

That is the wrong ownership:

- Create should create editable source;
- Save should update editable source;
- Publish should generate and release public files; and
- Serve should return those stored files.

129C moves materialization to Publish and removes it from Create and Save.

## 5. Publication Capacity

Roma owns the current-account Publish command and uses the system capability:

```text
instances.published.max
```

The system policy matrix owns every tier value. Free is `1`.

This means a Free user may retain many editable instances but may have only one
published and publicly served instance at a time.

The matrix deliberately keeps Tier 1 at that same one-instance capacity because
Tier 1 expands product features. Tier 2, at five published instances, is the
first multi-publish tier.

### 5.1 First Publish

Publishing an unpublished instance consumes one publication slot. Roma uses
the exact current account policy and published-instance facts as a fast local
precheck before materialization. It then passes the exact
`instances.published.max` value with the generated package to Tokyo-worker,
which owns the final account-atomic transition.

Tokyo-worker routes the final command to one
`AccountPublicationCoordinator` Cloudflare Durable Object selected
deterministically from `accountPublicId`. The coordinator sets a transient
`active` gate synchronously before its first await. It then reads a reserved
Durable Object lifecycle-fence key before request parsing or R2 work, but writes
no coordinator record. Under Cloudflare's shutdown contract, that storage
access stops an old in-flight execution rather than allowing it to continue
beside a replacement object after a deploy or runtime restart.

While the gate is active, the coordinator reads the exact current
`serve-state.json` truth, compares the published count to the Roma-supplied
limit, and only an allowed winner writes package bytes and published state.
Each instance's `serve-state.json` remains the sole publication truth; Durable
Object storage owns no tier, count, publication set, queue, or registry.

### 5.2 Republish

Publishing an already-published instance replaces that instance's public
package. Under the same final transition it is recognized as Republish and
does not consume another publication slot.

### 5.3 Denied Publish

A Publish denied by Roma's local capacity precheck does not invoke the
materializer. A request that reaches Tokyo but overlaps another live Publish
receives `409 PUBLISH_IN_PROGRESS` with the system message `Another Publish is
finishing. Please try again in a moment.` It may already have completed
transient in-memory Roma materialization, but it persists no package or
publication state. After the winning Publish commits, a later or retried
request enters the coordinator, sees the consumed slot, and receives the existing
`402 UPGRADE_REQUIRED` capacity result.

Every denied Publish:

- persists no package files;
- does not change saved source;
- does not change publication truth;
- does not replace the currently served package; and
- returns one exact capacity or in-progress result.

The `402 UPGRADE_REQUIRED` result opens the shared Roma-hosted upgrade Popup
using system-owned plan/CTA truth. The `409 PUBLISH_IN_PROGRESS` result asks the
user to try again after the other Publish finishes; it is not an upsell and the
system does not poll, queue, or retry automatically.

Pure publication-capacity copy is system-owned. It does not require a
Widget-specific upsell message because the denied action is an account Publish
command, not unique Widget editing meaning.
If no higher configured tier permits the required publication count, Roma does
not invent a target plan: the Popup uses maximum-capacity copy, presents Close
only, and omits Upgrade.

### 5.4 Account Lifecycle And Existing Public Truth

An account tier/status transition is not an ordinary Widget Publish command.
Editable source remains exact account truth and is not deleted, clamped,
rewritten, or locked merely because current policy is lower.

The settled suspended-account lifecycle provides day 0-30 public-serving
grace, automatic free-tier serving materialization at day 30 when recovery has
not occurred, and automatic account-root deletion at day 90 if the account is
still unrecovered. The account lifecycle operation owns the exact allowed
published set and any tier-dependent package result. Publish and Serve do not
silently choose what remains live, rewrite packages on visitor requests, or
claim that lifecycle work completed.

The scheduled lifecycle runner and complete account-root deletion operation
remain documented implementation gaps in Account Management. They are outside
PRD 129 and do not block this explicit Publish architecture.

## 6. Roma Materializer

Roma's materializer is the sole generator of the code served for an instance.

For one allowed Publish it receives:

```text
Widget software
+
shared Clickeen source used by that Widget
+
exact saved instance source
+
exact account-owned referenced resources
+
exact system policy needed for generated output
```

It emits exactly:

```text
index.html
styles.css
runtime.js
```

Bob does not generate these files. Tokyo-worker does not generate these files.
The public request does not generate these files.

The materializer is Widget-neutral: it consumes every Widget through the same
source and structured contracts. It must not contain a Widget-type branch,
Widget path list, or Widget-specific markup.

## 7. `index.html`

The generated HTML contains the complete exact saved instance:

- Stage;
- Pod;
- Shell;
- Header and CTA when configured;
- complete Widget Core content;
- exact base-locale customer content;
- meaningful headings, text, links, controls, and relationships; and
- the technical Discovery output approved for the account and saved state.

For FAQ, a browser, crawler, search engine, or answer engine receives the
questions and answers in the HTML response without running `runtime.js` to
create them.

JavaScript supplies the Widget and shared visitor functionality. It does not
create the first meaningful page.

## 8. `styles.css`

The generated CSS contains the complete presentation for the exact saved
instance:

- shared Dieter tokens and required primitives;
- shared Stage, Pod, Header, typography, and applicable capability styles; and
- the Widget's unique Core CSS.

The browser does not need Widget authoring source or Bob to display the saved
presentation.

## 9. `runtime.js`

Every published Widget package contains `runtime.js`.

It contains the JavaScript required for that exact Widget's visitor-facing
functionality and the shared visitor capabilities it uses.

For FAQ this includes genuine visitor interaction such as accordion behavior
and deep links.

It does not:

- construct the initial FAQ from empty hooks;
- contain Bob editing or preview logic;
- hold the complete editable instance as an alternate source;
- apply Stage, Pod, Header, and every shared feature through a renamed flat
  client workflow;
- perform package materialization;
- fetch Widget source; or
- perform public localization that belongs to the Edge response.

`runtime.js` is mandatory because browser functionality requires JavaScript.
It is one part of the generated HTML/CSS/JavaScript package, not the Widget or
the materializer by itself.

## 10. Discovery Output

`discovery.json` is internal Widget input to Publish. It tells the materializer
what the Widget is, which exact content parts matter, and how those parts
relate.

The system supplies the tier rule:

- every tier receives the Clickeen baseline title and description for that
  Widget;
- Tier 2 and above may additionally use exact saved content when **Enable
  SEO/GEO** is on.

Only the materializer writes the resulting technical output into
`index.html`. Bob does not write it, `discovery.json` does not contain output
templates, and Tokyo-worker does not infer it while serving.

For FAQ, the output must let search and answer systems recognize the page as
questions and answers and understand each exact question-to-answer
relationship. It must use only exact saved content declared by the Widget.

The implemented FAQ output is exact and deliberately small:

- every Publish writes `discovery.json.baseline.title` to `<title>`;
- every Publish writes `discovery.json.baseline.description` to the meta
  description;
- FAQ Core authors conditional schema.org `FAQPage`, `Question`, and `Answer`
  microdata around the exact visible question/answer content slots; and
- that content-derived markup is emitted only when the saved
  `behavior.seoGeo.enabled` value and the system
  `embed.seoGeo.enabled` flag are both true.

The materializer does not derive customer metadata, emit JSON-LD, expose a Bob
Discovery editor, or branch on Widget type. FAQ meaning remains authored in
FAQ Core and `discovery.json`.

The architecture can make content accessible to search, generative, and answer
engines. It does not promise ranking or citation outcomes.

## 11. Localization Handoff

The stored package is one complete base-locale package. Locale overlays remain
separate exact files under the existing instance locale coordinate.

The package must contain enough stable, authored content identity for 129D to
express an exact selected-locale overlay in returned HTML before JavaScript.

Materialized customer-content elements carry the exact generic
`data-ck-content-path` and `data-ck-content-mode` coordinates selected from the
Widget's editable-fields contract. The path is the saved stable `identityKey`,
not a positional array path. Scalar keys combine Widget type, role, and field
pattern; repeated keys additionally include every declared
`arrayItemIdentity` path and stable ID. Editable attribute slots also author
the exact `data-ck-content-attribute` target. 129D consumes those authored
coordinates without inferring Widget paths. No second locale package or client
localization is used.

This is a pre-GA coordinate cutover for scalar and repeated fields. Previously
stored positional overlays require an explicit Generate Translations operation
or explicit deletion after deployment. Publish and Serve do not read them
through a compatibility key, migrate them on demand, or add a downstream
validator.

## 12. Tokyo-worker Storage

Roma sends Tokyo-worker the exact generated HTML, CSS, and JavaScript together
with the Publish command.

Tokyo-worker:

- writes the exact generated package for the instance;
- writes the resulting publication truth; and
- later serves that stored truth under 129D.

Tokyo-worker does not compile Widget source, rerun the materializer, interpret
Discovery, filter Roma's output, or regenerate missing package files.

The existing account-instance root remains:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  serve-state.json
  index.html
  styles.css
  runtime.js
  overlays/
    locales/
      {locale}.json
```

Tokyo-worker stores the three exact generated strings and writes published
serve state. The account publication Durable Object then returns the committed
transition to Tokyo's default Worker entrypoint. That owning entrypoint calls
`ctx.cache.purge({ tags: [accountInstanceCacheTag] })` after a successful
Publish. Every cacheable response for the exact account/instance carries that
same deterministic tag, so one Worker-owned purge covers base HTML,
support-file paths, locale queries, and tracking-query variants without
enumerating URLs. A republish replaces the same three package objects for the
same instance. No second storage or release workflow exists.

For a first Publish, Tokyo-worker holds the coordinator's transient `active`
gate only across the exact count/package/serve-state transition and clears it
after published state commits, before cache purge. A request arriving during
that transition receives `409`; a request arriving after commit reads the new
serve state even while purge is finishing. No TTL, lease, reclaim, stale-holder,
or release-failure path exists.

Publish success means Tokyo-worker has stored the complete generated package,
committed the intended publication truth, and completed its cache purge. If
package and publication truth commit but the following purge fails, Tokyo
returns an explicit HTTP `502` purge failure, or HTTP `503` missing-purge-
configuration failure, together with the exact
`committed: { instanceId, status, changed }` transition. It does not claim full
success, hide the committed publication as a failed Publish, or roll the
publication back.

## 13. First Publish, Republish, And Unpublish

### 13.1 First Publish

An allowed first Publish generates and stores the package and changes the
instance from unpublished to published.

### 13.2 Republish

An allowed republish generates a new package from the latest saved source and
replaces the currently public package for that same instance.

### 13.3 Unpublish

Unpublish changes publication truth so the package is no longer served. It
does not delete editable source and does not materialize another package.

For either publication direction, Roma consumes a post-commit purge failure as
two exact facts: the requested publication state committed, and public delivery
refresh failed. Builder reopens the exact instance and Widgets updates its row
and cache from `committed`; Roma then shows a status-specific durable account-
shell banner. A committed Publish is retried through Republish. A committed
Unpublish is retried through the Widgets banner's **Retry public delivery**
action, which invokes the same idempotent Unpublish command with the committed
status. Bob's ToolDrawer and the upsell
Popup do not own this result, and no queue, polling loop, rollback, or alternate
retry route is added.

Publication UI lives only on the widgets inventory page. The row's toggle
remains the Publish/Unpublish control. Next to it, a published row whose
saved source is newer than its published package shows one action —
"Update live widget" — which invokes the same Publish command and route.
The editor Saves; it hosts no publication controls or notices. Bob's status
chip displays publication facts ("Published · time · changes not live") and
demands nothing. After Publish succeeds, Roma reopens the same instance so
Bob receives the new publication status and public actions.

## 14. Save Remains Unchanged By Publish

Publish reads saved source. It does not rewrite
`instance.config.json` or `instance.content.json`.

Package generation, package storage, and publication state are Publish work.
Editable source remains the user's saved instance and may be edited again after
Publish.

## 15. Serve Handoff

129C hands 129D:

```text
published instance identity
+
stored publication truth
+
stored index.html
+
stored styles.css
+
stored runtime.js
+
zero or more exact locale overlays
```

129D reads and serves this stored truth. It does not call the materializer.

## 16. Authority Boundaries

| Authority | 129C responsibility |
| --- | --- |
| Widget software | Core source, declarations, Discovery, and exact saved-state meaning |
| Bob | Explicit Publish intent only when the draft is saved |
| Roma | Current-account Publish command, capacity decision, materializer invocation, and shared denial Popup |
| Roma materializer | Sole generation of complete `index.html`, `styles.css`, and `runtime.js` |
| Tokyo-worker | Exact package and publication storage |
| Dieter | Shared Popup mechanics |

No shared authority acquires Widget-specific meaning.

## 17. Approved Changes In 129C

- make explicit Publish the sole materialization action;
- enforce public capacity at Publish;
- generate mandatory complete HTML/CSS/JavaScript from exact saved source;
- generate technical Discovery output during Publish;
- store one base package through Tokyo-worker;
- preserve overlays as separate exact locale truth;
- leave saved source unchanged; and
- hand only stored published truth to Serve.

## 18. Not In 129C

- Widget source-folder implementation details owned by 129A;
- Bob editing and preview;
- Save;
- Template creation;
- translation generation;
- visitor-request handling;
- client-side localization;
- new storage roots, release registries, or compatibility paths;
- deployment.

## 19. Local Implementation Boundary

The local implementation includes the current Roma Publish route/UI, fast
capacity precheck, generic materializer inputs, baseline and enabled Discovery
output, stable content-slot identity, Tokyo's account-atomic final capacity/
publication transition, exact package replacement, and Publish/republish/
unpublish results.

Stable identity gives repeated translated content exact Save behavior:
reorder follows identity, a newly added identity remains intentional
untranslated base content until Generate Translations, and a deleted identity
has no current materialized slot. Publish contains no positional compatibility
or validator path.

The account-suspension lifecycle runner and complete deletion operation remain
separate documented account-system work. Publish and Serve do not pretend
those operations exist.

## 20. Local Verification Contract

- Create and Save never invoke the materializer;
- only explicit allowed Publish invokes the materializer;
- Free can retain multiple editable instances and one sequential first Publish
  is denied after one instance is already published;
- a Roma-local capacity denial performs no materialization, while any final
  Tokyo denial persists no package or publication change;
- overlapping first Publishes serialize at Tokyo: a live contender receives
  exact `409 PUBLISH_IN_PROGRESS`, and a later request receives exact
  `402 UPGRADE_REQUIRED` after the winner consumes the last slot;
- first Publish produces all three mandatory files from exact saved source;
- republish uses the latest saved source and does not consume another slot;
- raw `index.html` contains each Widget's complete meaningful content before
  JavaScript, including complete FAQ questions and answers;
- `styles.css` contains complete shared and Widget presentation;
- `runtime.js` contains visitor functionality without Bob or initial rendering;
- every tier's Discovery output uses the exact Clickeen baseline title and
  description;
- Tier 2+ enabled content-derived output uses only exact declared saved
  content and does not replace the baseline;
- Tokyo-worker stores Roma's generated files without generating Widget code;
- a post-commit cache-purge failure returns explicit failure plus exact
  committed publication truth, Roma reconciles its visible state to that truth,
  and the ordinary status command remains retryable;
- Publish/Republish, Unpublish, Delete, and exact overlay mutation use the same
  Worker-owned default-entrypoint
  `ctx.cache.purge({ tags: [accountInstanceCacheTag] })`, covering package paths
  and locale/tracking query variants;
- Save source remains unchanged by Publish;
- repeated localized content follows stable identity across reorder/add/delete,
  and editable attributes use their exact authored target;
- no Widget-specific shared-service branch or alternate release workflow exists;
  and
- focused implementation checks and cloud-dev Worker/R2/Pages/reachability
  deployment proof pass, while owner QA remains pending.

## 21. Required Final V1-V8 Audit

| ID | Required result | Reason |
| --- | --- | --- |
| V1 | Pass | Missing package, policy, Discovery, storage, or stable-coordinate truth has no fallback; intentional untranslated source content is exact saved truth. |
| V2 | Pass | Publish does not repair saved source or generated output. |
| V3 | Pass | Policy decision, materialization, account-atomic storage/publication, and Serve handoff remain explicit; account suspension lifecycle remains with its named owner. |
| V4 | Pass | Roma's fast precheck and Tokyo's lifecycle-fenced per-account coordinator prevent over-capacity first-Publish success across ordinary interleaving and Durable Object restart; a contender fails explicitly and persists nothing. |
| V5 | Pass | Missing or corrupt source/package truth is not treated as an unpublished empty instance. |
| V6 | Pass | Publish succeeds only as complete package storage, publication truth, and cache purge; a post-commit purge failure exposes both the committed transition and failed delivery refresh instead of masquerading as full success or total Publish failure. |
| V7 | Pass | No Save-time materializer, alternate release workflow, or client initial renderer is authorized. |
| V8 | Pass | Verification remains offline/operator evidence, not part of Publish or Serve. |

This table states the required result. The independent post-implementation
audit is the implementation evidence.

## 22. Reconciliation State

```text
all-Widget explicit Publish/Republish UI: present in cloud-dev
publication-capacity decision before materialization: present in cloud-dev
Roma-only complete HTML/CSS/JavaScript generation: present in cloud-dev
all-Widget baseline Discovery and authored enabled output: present in cloud-dev
Tokyo exact package/publication write: present in cloud-dev
Unpublish without source deletion: present in cloud-dev
atomic account publication-capacity transition: present in cloud-dev
account coordinator: one lifecycle-fenced Tokyo Durable Object per account; no durable policy/count/publication truth
live overlap result: 409 PUBLISH_IN_PROGRESS; no package/publication persistence
later over-capacity result: 402 UPGRADE_REQUIRED
stable scalar/repeated overlay identity: present in cloud-dev
authored exact attribute localization target: present in cloud-dev
pre-GA positional-overlay compatibility path: absent; explicit Generate/delete cutover required for previously stored positional overlays
account suspension lifecycle runner/full deletion: documented follow-on account work, not a PRD 129 blocker
account product data: CLICKEEN Widget Defaults explicitly updated through Roma's authenticated defaults route to include the canonical shared `behavior.seoGeo.enabled:false`; QA VUWUJ7OQ0Y source/package restored after the live Save/Republish proof
stored positional-overlay Generate/delete cutover: pending
republish of affected pre-stable-slot public packages: pending
Worker-owned account-instance Cache-Tag invalidation proof for base and locale variants: passed live on `dev.clk.live/CLICKEEN/VUWUJ7OQ0Y` (first post-Republish reads were MISS for base, `?locale=fr`, tracking-query, CSS, and runtime)
prior zone-API tag purge runtime result: proved silent no-op after warm base/locale HIT responses and successful Republish
prior zone-API prefix purge runtime result: proved silent no-op because zone-level purge cannot invalidate Workers Caching
current invalidation: default-entrypoint `ctx.cache.purge({ tags: [accountInstanceCacheTag] })` implemented and live-proven on cloud-dev
post-commit publication/purge result correction: deployed in `36e65d8a`; cloud-dev deploy and reachability proofs passed
product commit: 36e65d8a
main push: performed
deploy: cloud-dev Worker deploy run `32177053173`, Roma verification run `32177053128`, and reachability run `32177415308` passed for commit `36e65d8a`
live product: cloud-dev active; owner QA pending
```
