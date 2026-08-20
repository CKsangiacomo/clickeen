# PRD 129C — Publish And Generate Serving Package

Status: **CLOSURE VERIFICATION IN EXECUTION — REPEATED-IDENTITY MATERIALIZATION CORRECTION REQUIRED 2026-08-20**

Parent: `129__PRD__Clickeen_Widget_Software_And_Instance_Lifecycle_Architecture.md`

Depends on: approved 129A Widget software/Create contract and approved 129B
Edit/Save contract

Owner: Clickeen product owner/architect

Date: 2026-08-17

## 1. Outcome

129C defines one explicit product action:

```text
user clicks Publish or Republish on a Roma surface
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

Publish never reads an unsaved Bob draft. Roma disables Publish/Republish with
**Save first** while Bob is dirty. Bob emits no publication command.

## 4. Starting Implementation Mismatches

Before this local PRD 129 pass, the system generated public files during New,
Duplicate, and Save, while Publish mainly changed publication state after the
package already existed.

The account suspension lifecycle and its public-truth transition are owned by
the account system, not by an ordinary Widget Publish. Its scheduled runner and
complete account-root deletion operation remain documented implementation
gaps outside PRD 129.

That is the wrong ownership:

- first Save should create editable source;
- Save should update editable source;
- Publish should generate and release public files; and
- Serve should return those stored files.

129C keeps materialization at Publish and out of New, first/later Save, and
Duplicate.

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
deterministically from `accountPublicId`. Despite its retained deployed class
name, it is the account's existing-instance command coordinator: Save, Rename,
Publish, Republish, Unpublish, and Delete all use its one exclusive `active`
gate. The first Save of a New draft creates a newly minted identity and is not
an existing-instance command.

The coordinator sets `active` synchronously before its first await. It then
reads a reserved Durable Object lifecycle-fence key before request parsing or
R2 work, but writes no coordinator record. Under Cloudflare's shutdown
contract, that storage access stops an old in-flight execution rather than
allowing it to continue beside a replacement object after a deploy or runtime
restart. Durable Object storage owns no tier, count, publication set, queue,
registry, or command result.

If any existing-instance command arrives while the gate is active, it receives
`409 coreui.errors.instance.commandInProgress`. That result is generic across
Save/Rename/Publish/Unpublish/Delete: the contender performs no mutation and
the system does not queue, poll, or automatically retry it.

After entering the gate, Publish reads the exact current source and
publication pointers for the account. Roma sent the exact `sourceUpdatedAt`
from the saved source it materialized. Tokyo-worker compares that coordinate
with the current instance `updatedAt`; if an earlier Save or Rename changed it,
Publish receives `409 coreui.errors.instance.sourceChanged` and commits
nothing. Only then does Tokyo-worker compare the published count with the
Roma-supplied limit.

An allowed Publish makes one R2 write: it replaces the instance's
`serve-state.json` with the published `status`, a new `publishedAt`, and the
exact logical `publicPackage`:

```text
publicPackage:
  indexHtml
  stylesCss
  runtimeJs
```

That one object is the complete publication commit. There are no separate
`index.html`, `styles.css`, or `runtime.js` package objects and therefore no
partial three-object package state. Public URLs retain those filenames; Serve
selects the matching string from this exact logical package.

Tokyo-worker is the single writer of revision coordinates. Save and Rename
make `updatedAt` strictly later than their prior `updatedAt` and any current
`publishedAt`; Publish/Republish makes `publishedAt` strictly later than both
the exact `sourceUpdatedAt` it commits and the prior `publishedAt`. The
`updatedAt > publishedAt` divergence fact and every refreshed publication
receipt are therefore deterministic even for commands that begin in the same
millisecond. No UI validator or timestamp repair path is authorized.

### 5.2 Republish

Publishing an already-published instance replaces that instance's public
package by atomically replacing the same `serve-state.json`. Under the same
coordinator and exact-source comparison it is recognized as Republish and does
not consume another publication slot.

### 5.3 Denied Publish

A Publish denied by Roma's local capacity precheck does not invoke the
materializer. A request that reaches Tokyo while any existing-instance command
is active receives `409 coreui.errors.instance.commandInProgress` with the
system copy `Another widget update is finishing. Please try again in a
moment.` A Publish whose materialized `sourceUpdatedAt` no longer equals the
current source receives `409 coreui.errors.instance.sourceChanged` with the
instruction to Publish again. Either request may already have completed
transient in-memory Roma materialization, but neither writes publication truth.
After the active command commits, a later first-Publish request enters the
coordinator, sees any newly consumed slot, and receives the existing
`402 UPGRADE_REQUIRED` capacity result when appropriate.

Every denied Publish:

- persists no `serve-state.json` publication replacement;
- does not change saved source;
- does not change publication truth;
- does not replace the currently served package; and
- returns one exact capacity, command-contention, or source-contention result.

The `402 UPGRADE_REQUIRED` result opens the shared Roma-hosted upgrade Popup
using system-owned plan/CTA truth. `commandInProgress` and `sourceChanged` are
ordinary visible command results, not upsells; the system does not poll, queue,
or retry automatically.

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

- writes the exact generated package and resulting publication truth as one
  `serve-state.json` artifact; and
- later serves that stored truth under 129D.

Tokyo-worker does not compile Widget source, rerun the materializer, interpret
Discovery, filter Roma's output, or regenerate missing logical package
members.

The existing account-instance root remains:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.source.json
  serve-state.json
  overlays/
    locales/
      {locale}.json
```

For a published instance, `serve-state.json` contains `status`, `publishedAt`,
and the exact `{ indexHtml, stylesCss, runtimeJs }` logical `publicPackage`.
Tokyo-worker does not write separate package objects. Republish replaces that
same one artifact, so the prior complete publication remains unchanged if the
single R2 write fails.

The coordinator returns the owning mutation result to Tokyo's default Worker
entrypoint. Only after a successful Publish, Unpublish, or Delete commit, the
entrypoint may schedule
`cache.purge({ tags: [accountInstanceCacheTag] })` through `waitUntil`. Exact
overlay writes/deletes use the same post-commit scheduler. Every cacheable
response for the exact account/instance carries that deterministic tag. Save
and Rename do not schedule public eviction because neither changes public
truth.

Delete's logical commit is specifically the coordinated deletion of the exact
`instance.source.json` visibility anchor. After that commit, the default
entrypoint also schedules residual instance-prefix deletion through
`waitUntil`, removing unreachable `serve-state.json` and overlay objects. The
Delete response does not await either residual cleanup or cache eviction, and
no cleanup outcome can reclassify successful source-anchor deletion.

The scheduler never awaits or inspects purge outcome for the product path.
Missing cache context, synchronous throw, rejection, `success:false`, or an
indefinitely pending purge cannot change, delay, or reclassify the owning
mutation's result. No service and no user has a cache failure state, retry,
banner, rollback, reconciliation, or polling workflow.

For every existing-instance command, Tokyo-worker holds the coordinator's
transient `active` gate only across that command and clears it after the command
returns. A request arriving during the command receives generic
`commandInProgress`; a later request reads the newly committed source or
publication truth. No TTL, lease, reclaim, stale-holder, cache-result, or
release-failure path exists.

Publish success means Tokyo-worker committed the complete generated package
and intended publication truth in the one artifact. Cache eviction remains an
invisible delivery optimization outside that definition.

## 13. First Publish, Republish, And Unpublish

### 13.1 First Publish

An allowed first Publish generates and stores the package and changes the
instance from unpublished to published.

### 13.2 Republish

An allowed republish generates a new package from the latest saved source and
replaces the currently public package for that same instance with one atomic
`serve-state.json` write.

### 13.3 Unpublish

Unpublish changes publication truth so the package is no longer served. It
does not delete editable source and does not materialize another package. Its
one `serve-state.json` replacement records unpublished truth and contains no
logical `publicPackage`.

Publication UI lives in Roma only. One shared Roma implementation renders on
the Widgets inventory row and in the slim Roma bar above Bob. The toggle owns
Publish/Unpublish. A published instance whose exact saved `updatedAt` is later
than `publishedAt` shows **Republish**. Published receipt and public actions are
Roma facts. Bob contains no status chip or public action and is never reopened
after publication.

That comparison is exact system truth, not a time heuristic: Tokyo makes every
Save/Rename `updatedAt` strictly later than the prior source and publication
coordinates, and makes successful Publish/Republish `publishedAt` strictly
later than both the committed `sourceUpdatedAt` and the prior `publishedAt`.

Dirty Bob state disables Publish/Republish with **Save first**, but Unpublish
remains enabled. On product success, the shared controller force-reads exact
Widgets facts so `publishedAt` comes from Tokyo package commit truth rather than
an invented client time. There is no cache banner, retry, reconciliation,
rollback, queue, or polling state anywhere in Roma or Bob.

## 14. Save Remains Unchanged By Publish

Publish reads the exact saved `instance.source.json`. It does not rewrite that
artifact.

Package generation, package storage, and publication state are Publish work.
Editable source remains the user's saved instance and may be edited again after
Publish.

## 15. Serve Handoff

129C hands 129D:

```text
published instance identity
+
stored serve-state.json containing published status, publishedAt, and exact
logical publicPackage { indexHtml, stylesCss, runtimeJs }
+
zero or more exact locale overlays
```

129D reads and serves this stored truth. It does not call the materializer.

## 16. Authority Boundaries

| Authority | 129C responsibility |
| --- | --- |
| Widget software | Core source, declarations, Discovery, and exact saved-state meaning |
| Bob | Browser-memory editing, dirty signal, and Save only; no publication intent or facts |
| Roma | Current-account Publish/Republish/Unpublish controls, capacity decision, materializer invocation, publication receipt/public actions, and shared denial Popup |
| Roma materializer | Sole generation of complete `index.html`, `styles.css`, and `runtime.js` |
| Tokyo-worker | Existing-instance command serialization, exact source revision/capacity decision, and one atomic package/publication artifact |
| Dieter | Shared Popup mechanics |

No shared authority acquires Widget-specific meaning.

## 17. Approved Changes In 129C

- make explicit Publish the sole materialization action;
- enforce public capacity at Publish;
- generate mandatory complete HTML/CSS/JavaScript from exact saved source;
- generate technical Discovery output during Publish;
- store one base package and publication result as one Tokyo-worker
  `serve-state.json` commit;
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
output, stable content-slot identity, Tokyo's per-account serialization of
existing-instance Save/Rename/Publish/Unpublish/Delete, exact
`sourceUpdatedAt` comparison, strict revision coordinates, final capacity
decision, one-artifact package/publication replacement, and exact
Publish/Republish/Unpublish results.

Stable identity gives repeated translated content exact Save behavior:
reorder follows identity, a newly added identity remains intentional
untranslated base content until Generate Translations, and a deleted identity
has no current materialized slot. Publish contains no positional compatibility
or validator path.

The account-suspension lifecycle runner and complete deletion operation remain
separate documented account-system work. Publish and Serve do not pretend
those operations exist.

## 20. Local Verification Contract

- New and Save never invoke the materializer;
- only explicit allowed Publish invokes the materializer;
- Free can retain multiple editable instances and one sequential first Publish
  is denied after one instance is already published;
- a Roma-local capacity denial performs no materialization, while any final
  Tokyo denial persists no package or publication change;
- existing-instance Save/Rename/Publish/Unpublish/Delete serialize at Tokyo;
  any live contender receives exact
  `409 coreui.errors.instance.commandInProgress` and performs no mutation;
- Publish compares its exact materialized `sourceUpdatedAt` with current source
  before commit; a mismatch receives exact
  `409 coreui.errors.instance.sourceChanged`, while a later first Publish
  receives exact `402 UPGRADE_REQUIRED` when the last slot was consumed;
- Save/Rename and Publish/Republish write strictly ordered
  `updatedAt`/`publishedAt` coordinates, so divergence and refreshed
  publication receipts have no same-millisecond ambiguity;
- first Publish produces all three mandatory logical public files from exact
  saved source and commits them with publication truth in one
  `serve-state.json`;
- republish uses the latest saved source and does not consume another slot;
- raw `index.html` contains each Widget's complete meaningful content before
  JavaScript, including complete FAQ questions and answers;
- `styles.css` contains complete shared and Widget presentation;
- `runtime.js` contains visitor functionality without Bob or initial rendering;
- every tier's Discovery output uses the exact Clickeen baseline title and
  description;
- Tier 2+ enabled content-derived output uses only exact declared saved
  content and does not replace the baseline;
- Tokyo-worker stores Roma's generated strings as the exact logical
  `publicPackage` without generating Widget code or writing separate package
  objects;
- Publish/Republish, Unpublish, Delete, and exact overlay mutation schedule the
  same Worker-owned account-instance Cache-Tag eviction after their owning
  mutation, and every missing/false/throw/reject/pending eviction outcome is
  product-inert;
- generated public package responses use bounded revalidation rather than a
  24-hour stale-while-revalidate dependency;
- Roma inventory and Builder use one publication control/result path, and Bob
  contains no publication facts or commands;
- Save source remains unchanged by Publish;
- repeated localized content follows stable identity across reorder/add/delete,
  and editable attributes use their exact authored target;
- no Widget-specific shared-service branch or alternate release workflow exists;
  and
- focused implementation checks, exact-SHA Worker deployment, Roma/Bob
  reachability, atomic storage cutover, two Roma Republish commands, and all
  six public package-file responses pass in cloud-dev; owner QA remains
  pending.

## 21. Required Final V1-V8 Audit

| ID | Required result | Reason |
| --- | --- | --- |
| V1 | Pass | Missing package, policy, Discovery, storage, or stable-coordinate truth has no fallback; intentional untranslated source content is exact saved truth. |
| V2 | Pass | Publish does not repair saved source or generated output. |
| V3 | Pass | Policy decision, materialization, source revision, single-artifact storage/publication, and Serve handoff remain explicit; account suspension lifecycle remains with its named owner. |
| V4 | Pass | Roma's fast precheck and Tokyo's lifecycle-fenced per-account coordinator serialize existing-instance mutations; `sourceUpdatedAt` and final capacity checks prevent stale or over-capacity Publish across ordinary interleaving and Durable Object restart. |
| V5 | Pass | Missing or corrupt source/package truth is not treated as an unpublished empty instance; after Delete, a residual serve-state/overlay prefix without its source anchor is unreachable cleanup residue, not an instance. |
| V6 | Pass | Publish succeeds exactly as one complete package/publication commit; Delete succeeds exactly as source-anchor deletion; contention and stale source fail explicitly without a write, and residual cleanup/cache eviction are structurally unable to masquerade as product success or failure. |
| V7 | Pass | No Save-time materializer, alternate release workflow, or client initial renderer is authorized. |
| V8 | Pass | Verification remains offline/operator evidence, not part of Publish or Serve. |

This table states the required result. The independent post-implementation
audit is the implementation evidence.

## 22. Reconciliation State

```text
shared Roma-only Publish/Republish/Unpublish UI: deployed; owner interaction QA pending
publication-capacity decision before materialization: present in cloud-dev
Roma-only complete HTML/CSS/JavaScript generation: present in cloud-dev
all-Widget baseline Discovery and authored enabled output: present in cloud-dev
Tokyo exact package/publication write: deployed as one atomic serve-state.json containing status, publishedAt, and exact logical publicPackage
separate index.html/styles.css/runtime.js storage objects: removed from runtime; public filename URLs read logical package members
Unpublish without source deletion: deployed; owner interaction QA pending
account coordinator: deployed as one lifecycle-fenced Tokyo Durable Object per account serializing existing-instance Save/Rename/Publish/Unpublish/Delete; no durable policy/count/publication truth
live command overlap result: 409 coreui.errors.instance.commandInProgress; no mutation or automatic retry
stale materialized source result: 409 coreui.errors.instance.sourceChanged from exact sourceUpdatedAt comparison; no publication write
revision coordinates: deployed; both live Republish commands produced publishedAt strictly later than sourceUpdatedAt and prior publishedAt
later over-capacity result: 402 UPGRADE_REQUIRED
stable scalar/repeated overlay identity: present in cloud-dev
authored exact attribute localization target: present in cloud-dev
pre-GA positional-overlay compatibility path: absent; explicit Generate/delete cutover required for previously stored positional overlays
account suspension lifecycle runner/full deletion: documented follow-on account work, not a PRD 129 blocker
account product data: all four saved CLICKEEN instances cut over; two public instances Republished through Roma
atomic editable source: deployed as one instance.source.json containing metadata/config/content; Save/Rename each replace it in one PUT
first-Save source visibility: initial unpublished serve-state writes first and instance.source.json commits last; only exact source keys enumerate
instance Delete commit: deployed; owner Delete interaction QA pending
legacy cloud-dev source topology: cutover complete for all four saved instances; no compatibility reader
stored positional-overlay Generate/delete cutover: pending
pre-GA atomic-publication cutover: complete; no prior-object compatibility fallback exists
republish of currently published cloud-dev instances: complete for LWZZR7JSG8 and VUWUJ7OQ0Y through Roma
cache eviction non-interference: deployed and deterministically tested for missing, false, synchronous throw, rejection, and pending outcomes
generated package cache policy: `public, max-age=60, s-maxage=300, must-revalidate`
product commit and main push: a6678966
deploy: Worker deployment, Roma/Bob runtime reachability, and Tokyo R2 product-root sync passed
live product: corrected publication/storage/cache runtime is active; technical verification passed; owner QA pending
```

## 23. Closure Materialization Correction

Agent-executed closure verification found that deployed Publish materialized
repeated stable identity coordinates with Mustache's `&#x3D;` entity text while
stored overlay keys use the canonical literal `=`. The correction belongs to
the one generic render producer in `@clickeen/widget-foundation`: preserve
literal `=` inside the already-quoted content-path attribute while retaining
normal HTML escaping for unsafe characters. Publish, Roma policy, Tokyo
storage, the stable identity contract, and every Widget's Core remain
unchanged.

After the corrected Roma build is deployed, the affected published FAQ
instance `VUWUJ7OQ0Y` must be explicitly Republished through the existing Roma
command. That one authorized release replaces its atomic public package; it
does not change editable source or overlays. Local materializer proof,
independent V1-V8 audit, exact deploy evidence, and selected-locale live FAQ
proof are required before this SubPRD closes. Owner acceptance is not a gate.
