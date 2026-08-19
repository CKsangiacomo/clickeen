# PRD 129B — Edit And Save Editable Instance

Status: **FIRST-SAVE CORRECTION DEPLOYED WITH TECHNICAL CLOUD-DEV VERIFICATION 2026-08-19 — FIRST-SAVE OWNER QA PENDING**

Parent: `129__PRD__Clickeen_Widget_Software_And_Instance_Lifecycle_Architecture.md`

Depends on: approved 129A Widget software and Create contract

Owner: Clickeen product owner/architect

Date: 2026-08-17

## 1. Outcome

129B defines one product action:

```text
open an unsaved New draft or saved editable instance in Bob
-> edit one browser-memory draft
-> preview that draft
-> Save the editable source through Roma
-> keep editing
```

Save is persistence inside Edit. It is not Publish.

129B ends with exact saved source. It does not generate, replace, publish, or
serve `index.html`, `styles.css`, or `runtime.js`.

## 2. Input From 129A

Bob opens with:

- `instanceId: null` and an exact account/Widget-default draft for New, or the
  exact saved instance identity and source for an existing instance;
- the compiled Widget editor contract;
- the Widget software needed to preview the draft;
- exact account policy and account fonts; and
- the existing Product Copilot, translation, and account-command setup.

New and saved instances use the same Bob editing session. Product Copilot and
Translations require saved instance identity and therefore show **Save first**
for New; account Assets remain available because they are account-scoped.

Bob open does not require a published package. A never-published instance is a
normal editable instance.

## 3. Starting Implementation Mismatches

Before this local PRD 129 pass, the product mixed Edit/Save with public package
work:

- Bob preview loads the stored public package;
- the flat `widget.client.js` receives Bob state updates and recreates initial
  Widget content;
- Save runs Widget policy again in Roma;
- Save invokes Roma's materializer;
- Save rewrites public package files; and
- Save may purge public cache for an already-published instance.

Those behaviors belong to other actions or to the retired flat client
architecture. They are not preserved by 129B.

## 4. One Draft

Bob owns one complete instance draft in browser memory.

The draft contains:

- every exact shared Stage, Pod, Header, typography, appearance, and shared
  feature value;
- every exact Widget Core value; and
- every exact base-locale customer-content value.

The instance identity remains optional Bob session context. New has no identity
until first Save; identity is never inserted into editable state.

Manual editing, undo, redo, Product Copilot changes, preview, and Save all act
on this same draft. There is no second Widget draft, second source shape, or public
package used as editable truth.

## 5. Editing

### 5.1 Manual editing

Bob and Dieter accept the user's input through the existing compiled Widget
controls and apply it to the browser-memory draft.

### 5.2 Product Copilot

Product Copilot transports the governed model's one `apply_widget_ops` tool
call through its existing agent boundary. Bob owns acceptance and execution of
that external edit request against the exact compiled controls and current
draft, then applies the accepted batch through the same atomic draft mutation
and policy path used by manual editing.

### 5.3 Undo and redo

Undo and redo remain draft operations. They do not write source, generate a
package, or change publication state.

## 6. Preview

Preview expresses the current browser-memory draft using the Widget software
defined by 129A.

Preview must show:

- the complete shared composition;
- the Widget's exact Core structure, presentation, and behavior;
- unsaved draft changes; and
- the selected preview locale and device state.

Preview is not a persisted public package and is not loaded from
`index.html`, `styles.css`, or `runtime.js` stored by Tokyo-worker.

### 6.1 Target preview path

```text
deploy-built Widget software
+ exact Bob browser-memory draft
+ exact preview context
-> Bob Workspace iframe
-> current temporary preview
```

The preview context contains only editing facts needed to express the draft,
such as instance identity, device, selected preview locale, resolved account
assets, and account fonts. It is not saved Widget state and is not a published
package.

The Widget build carries that software in the existing generated Bob editor
artifact. 129B adds no second Widget registry, source fetch, package endpoint,
preview service, or account storage object.

### 6.2 Workspace lifecycle

The existing Bob session and iframe remain. Workspace:

1. opens the deploy-built Widget software;
2. supplies the exact current draft and preview context;
3. keeps that iframe alive while ordinary draft edits occur;
4. updates the preview from the same draft used by manual controls, undo/redo,
   Product Copilot, and Save; and
5. reports preview readiness or a real preview dependency error.

An ordinary field edit must not reload Widget software, read Tokyo-worker's
instance package, or rebuild an iframe from public files. Switching Widget or
instance may reset the temporary preview as required, but the new preview still
starts from deploy-built Widget software plus the new exact draft and never
from that instance's serving package.

### 6.3 Public-package separation

The following current dependencies are removed:

- Roma Builder open does not read an instance public package or compare a
  package fingerprint before opening Bob;
- `ck:open-editor` does not contain `publicPackage`;
- Bob session state does not require `indexHtml`, `stylesCss`, or `runtimeJs`;
- Workspace does not parse stored `index.html`, inject stored `styles.css`, or
  create a Blob from stored public `runtime.js`;
- Widget readiness does not depend on a stored package; and
- the public Widget runtime does not receive Bob draft messages or acknowledge
  Bob editor state.

A published instance and a never-published instance therefore use the same Bob
preview path. The published instance's currently live package is irrelevant to
preview and remains unchanged while Bob edits or Saves newer source.

### 6.4 One authored meaning, not two renderers

Bob preview and Publish use the same Widget HTML/CSS/Core source contract
approved in 129A. Bob may have preview-only transport and lifecycle code, but
it does not contain a second Widget renderer or Widget path knowledge. Roma's
materializer may generate persistent browser files, but it does not define a
different Widget meaning.

The 129A rule for placing exact instance values in Widget HTML supplies
complete preview structure and content. Each `core.js` then owns genuine
Widget behavior in that preview. It does not become a renamed
`widget.client.js`, construct the first Widget from an empty
shell, apply all shared services, or contain Bob message handling.

For every locally migrated Widget, the former
`ck:state-update`/`ck:ready` protocol is absent from the public shared runtime
and public Core JavaScript. If Bob's
iframe continues to use
browser messaging internally, that transport belongs only to Bob's generic
preview boundary and carries no Widget-specific meaning.

### 6.5 Preview resources and locales

Account fonts, selected asset references, device state, and translation
preview remain Bob editing inputs. Bob resolves the exact account resources
through the existing Roma commands and applies the selected saved overlay by
stable `identityKey` to the current draft path for that identity. Reorder
therefore follows the same item. A newly added identity remains intentional
untranslated source content until Generate Translations; a deleted identity is
absent from preview. None of this reads, rewrites, or localizes a public
package.

### 6.6 Implemented boundary

The generated editor artifact carries the Widget's compiled HTML, CSS, and
JavaScript software. Roma supplies that artifact and one saved source document
in the existing Builder-open envelope. Workspace renders the same software with
the one current Bob draft. It does not read an account serving package, add a
Widget registry, add a source fetch, or branch on Widget type. All five current
Widgets use this path locally.

## 7. Shared Edit Limits

Account tiers and entitlement values are system policy. They are not Widget
policy.

When the user attempts a governed Widget edit:

1. Bob applies the shared system decision before changing the draft;
2. an allowed edit updates the draft normally;
3. a denied edit leaves the draft unchanged; and
4. Bob sends Roma one exact denial containing
   `capability`, `messageId`, and the attempted Boolean/numeric `required`
   demand; and
5. Roma opens the one shared upgrade Popup using:
   - system-owned current plan;
   - system-owned qualifying target plan;
   - the exact Widget message selected by `limits.json`; and
   - the system-owned CTA scaffold.

The Widget supplies context such as “add more questions.” It does not supply
tier values, pricing, target-plan selection, or CTA behavior.

The same shared edit gate applies to manual and Product Copilot changes. Bob
does not contain Widget-specific limit logic.

Save does not repeat this decision. Roma trusts the Bob draft it receives.

Roma uses `required` to choose the first higher system tier that actually
permits the attempted edit. The Widget does not choose that plan.
If no higher configured tier permits the exact demand, Roma does not invent
one: the Popup uses system-owned maximum-capacity copy, exposes Close only,
and omits Upgrade.

### 7.1 Editing After A Downgrade

A lower tier may make an existing saved instance larger than a current item
limit or remove access to a capability already present in that instance.

The exact existing draft and saved source remain intact. Bob does not delete,
clamp, disable, or rewrite that truth on open, preview, or Save. An unrelated
edit or an edit that reduces governed usage remains available. A new edit that
requests an unavailable capability or increases governed usage beyond the
current limit is denied before draft mutation through the same shared edit
gate described above.

Save persists the accepted complete draft even when preserved existing truth
is above the new tier. Save does not become a downgrade-cleanup or second
entitlement boundary.

Published-instance overage is not Bob editing work. The owning account
capacity/lifecycle operation produces the exact publication result consumed by
129C/129D; it is not a Save gate.

## 8. Enable SEO/GEO

**Enable SEO/GEO** is a shared system control shown in the ToolDrawer for every
applicable Widget.

- Every tier retains the Widget's Clickeen baseline title and description.
- Tier 2 and above may additionally enable optimization from exact saved
  content.
- the shared system owns the state coordinate, tier rule, and control;
- `discovery.json` remains internal and is never shown as an editor; and
- the user's exact toggle value is ordinary editable instance state.

The toggle follows the same shared edit-limit and upsell behavior as every
other governed edit.

Save persists the exact value. It does not generate SEO/GEO output. 129C uses
the value during Publish.

The implemented common coordinate is `behavior.seoGeo.enabled`, bound to
`embed.seoGeo.enabled`. No Widget-local SEO toggle path exists.

## 9. Save

The user may Save repeatedly while editing.

Save sends Roma:

- the exact complete browser-memory `config` draft;
- `widgetType` only for first Save, when no stored instance fact exists; and
- the existing instance identity as route/session context when one exists,
  with no `widgetType` in that Save body.

At the existing-instance route boundary, Roma externally admits a record body
with record `config`. It loads the exact account-scoped saved-instance list fact
from Tokyo and consumes that stored fact's `widgetType` to select the existing
compiled artifact before preparing the source operation. The caller supplies no
second Widget-type assertion, so no caller `widgetType` comparison or
revalidation occurs. Tokyo's stored ownership fact is the direct
artifact-selection input.

Roma prepares one exact editable-source record:

```text
instance.source.json
```

That one record contains the instance metadata, config, and base-locale content.
There is no physical config/content split.

Without an ID, Roma mints one and Tokyo-worker creates the complete source
operation using the exact current account `baseLocale` Roma read for that Save.
Roma's existing `201` Save result returns both the new ID and that exact
persisted `baseLocale`. Roma adopts the ID, updates its exact inventory fact,
and replaces `/builder/new/{widgetType}` with `/builder/{instanceId}` in place.
Bob consumes the same existing account-command result and adopts the new ID and
`baseLocale` into its session metadata, including
`translationSetup.baseLocale`. Bob is not reopened and no new message is
introduced. Tokyo-worker writes the initial unpublished `serve-state.json`
first and commits `instance.source.json` last. Only that exact source-record
key makes an instance visible, so a failed first Save cannot expose a
half-created inventory row. With an ID, Tokyo-worker replaces the existing
`instance.source.json` in one PUT.

This closes the ordinary response/session coherence gap only. It does not
serialize first Save with an account-locale `PATCH` that begins concurrently.
The simultaneous first-Save/base-locale-PATCH race remains separate work and
is not claimed solved by returning and adopting the persisted locale.

The first Save is the create operation for a newly minted identity. Every later
Save is an existing-instance command and runs through the same per-account
`AccountPublicationCoordinator` as Rename, Publish, Unpublish, and Delete. That
coordinator serializes the mutations rather than asking the commands to infer
one another's state. If another existing-instance command is active, Save
receives `409 coreui.errors.instance.commandInProgress`; it performs no write
and is not queued or retried automatically.

The same exact source key is the later Delete anchor, although Delete remains a
Roma command rather than a Bob action. Inside the coordinator, removing
`instance.source.json` is the logical Delete commit. The default Tokyo
entrypoint schedules residual `serve-state.json`/overlay-prefix cleanup and
cache eviction afterward through `waitUntil`; neither cleanup outcome can
change or delay the command result.

Tokyo-worker is the single writer of instance revision coordinates. A
successful existing-instance Save makes `updatedAt` strictly later than both
the prior `updatedAt` and any current `publishedAt`. Rename follows the same
rule. This makes the Roma publication comparison exact even when commands
begin in the same millisecond; no browser-side validator or timestamp repair
is required.

Save success means the submitted logical editable instance is the saved
source. Bob marks that exact submitted draft as saved. If the user made newer
changes while Save was running, those newer changes remain unsaved.

Save does not:

- invoke the materializer;
- generate or write `index.html`, `styles.css`, or `runtime.js`;
- change `serve-state.json` after the first Save has created its initial
  unpublished truth;
- apply publication capacity;
- publish or unpublish;
- change the current public package;
- generate Discovery output;
- generate or delete locale overlays;
- package or resolve assets and fonts; or
- purge public cache.

Assets and translations remain explicit account operations. Save stores only
the exact selected references and content values already present in the draft.

### 9.1 Stable locale-overlay identity

The implemented overlay coordinate is the saved field's stable `identityKey`,
not its concrete positional path. Scalar keys combine Widget type, role, and
field pattern. Repeated keys additionally contain every declared
`arrayItemIdentity` path and stable ID.

Save deliberately leaves overlays unchanged:

- reorder keeps the same identity, so the translation follows its item;
- add creates a new identity with no stored value, so its base text is explicit
  untranslated source content until Generate Translations;
- delete removes the current identity from preview/materialized HTML, so any
  old stored coordinate is inert; and
- Generate Translations replaces the overlay with the complete current saved
  identity set.

This changes scalar and repeated coordinates from the pre-GA positional
format. Previously stored positional overlays are not compatibility input and
require explicit Generate Translations or explicit deletion after deployment.
Bob, Publish, and Serve contain no old-key fallback, migration-on-read, or
downstream overlay validator.

## 10. Saved And Published Truth Are Independent

An instance may have:

```text
newer saved editable source
+
an older currently published package
```

This is normal after the user edits and Saves a published instance.

Visitors continue receiving the last published package. Nothing public changes
until the user explicitly publishes again under 129C.

Roma's durable divergence fact is the direct comparison
`updatedAt > publishedAt`. Save and Rename always move `updatedAt` strictly
past the prior publication coordinate, and a successful Publish/Republish moves
`publishedAt` strictly past both the exact saved `sourceUpdatedAt` it committed
and the prior `publishedAt`. The Republish state and refreshed publication
receipt therefore come from Tokyo's two single-writer facts, not from client
timing or a second validation pass.

## 11. Publish Handoff

Publish is a separate Roma-owned user command. Bob sends no Publish intent and
receives no publication state.

129B hands 129C:

```text
exact instance identity
+
exact current saved source
+
explicit Publish intent
```

Publish does not silently Save the draft. Roma already mirrors Bob's dirty
boolean for navigation protection and uses it to disable Publish/Republish with
**Save first**; Unpublish remains available.

129B does not decide publication capacity, invoke the materializer, store the
package, or change public truth.

## 12. Authority Boundaries

| Authority | 129B responsibility |
| --- | --- |
| Widget software | Editing declarations, Core preview meaning, limit bindings, Discovery declaration, and Widget upsell copy |
| Bob | One browser-memory draft, editing, undo/redo, preview, edit-limit decision use, and Save only |
| Product Copilot | Governed model turn and one `apply_widget_ops` tool-call transport |
| Roma | New-draft composition; first-Save `widgetType` plus config admission; existing-Save config admission and Tokyo-owned stored-`widgetType` artifact selection; result/ID adoption routing; and one composed upgrade Popup |
| Tokyo-worker | Physical storage of the saved source operation, strict instance revision coordinates, and serialization of later Save with every other existing-instance mutation |
| Dieter | Shared controls and Popup mechanics |

No shared authority gains Widget-specific meaning.

## 13. Approved Changes In 129B

- open and preview a source-only unpublished instance;
- remove public-package dependence from Bob editing;
- make the existing generated Bob editor artifact carry the deploy-built
  Widget software Bob needs for preview;
- make Workspace preview the one current draft without parsing or executing
  stored serving files;
- remove Bob-preview messaging and rendering responsibility from public Widget
  runtime code;
- keep one complete draft for manual and Product Copilot changes;
- apply shared Widget edit limits before a denied draft mutation;
- compose one Roma-hosted upgrade Popup;
- add the shared **Enable SEO/GEO** edit behavior;
- make first Save create exact editable source and adopt its returned ID plus
  persisted `baseLocale` into Bob session metadata and `translationSetup`
  without reopening Bob or adding a message, and make later Save update source
  only;
- send `widgetType` only on first Save; make an existing Save config-only and
  select its compiled artifact from Tokyo's exact account-scoped stored
  `widgetType` without a caller comparison;
- use stable saved content identity for overlay-backed preview; and
- keep the current published package unchanged after Save.

## 14. Not In 129B

- Create starting-state rules;
- public package materialization;
- publication-capacity enforcement;
- package storage or replacement;
- unpublish/republish behavior;
- technical SEO/GEO output;
- public locale response generation;
- public serving;
- migrations, deployment, or remote product-data operations.

## 15. Local Implementation Boundary

The all-Widget local implementation includes:

- compiled Widget-software preview fields in the existing editor artifact;
- one source/draft Workspace preview path;
- `behavior.seoGeo.enabled` and its system entitlement binding;
- one Bob denial `{ capability, messageId, required }`;
- system current-plan and first-qualifying-target-plan selection, or the exact
  maximum-capacity state when no higher tier permits the demand;
- one Roma-hosted Popup with a scaffold Upgrade action; and
- source-only Save through the existing Roma/Tokyo-worker instance operation.

No suspended-account lifecycle runner, free-tier serving transition, or
account-root deletion operation was implemented. The settled 30-day serving
grace and day-90 deletion lifecycle remain an account-lifecycle implementation
handoff outside 129B, not an Edit/Save blocker.

## 16. Local Verification Contract

- New drafts, Duplicate, and existing source-only instances open in Bob without a
  published package; any future Template-created instance must use this same
  open path;
- Builder open makes no instance-package read and sends no `publicPackage` to
  Bob;
- all shared and Widget Core edits use one draft;
- manual, undo/redo, and Product Copilot changes preview correctly;
- initial source-only preview, repeated collection edits, device changes,
  saved translation preview, account assets, and account fonts work through the
  one Workspace preview path;
- ordinary draft edits do not recreate the iframe or read public files;
- a published instance previews newer saved and unsaved draft truth while its
  live package remains byte-unchanged;
- generated public `runtime.js` contains no Bob preview message protocol and no
  initial Widget renderer;
- denied governed edits do not alter the draft and open one exact shared Popup;
- allowed edits alter the draft normally;
- **Enable SEO/GEO** follows the exact system tier rule;
- first Save writes unpublished `serve-state.json` first and commits one exact
  `instance.source.json` last; only the source key makes the instance visible;
- later Save replaces that one source artifact and serializes with
  existing-instance Rename/Publish/Unpublish/Delete;
- exiting New before Save creates no instance and changes no inventory count;
- first Save adopts the returned ID and exact persisted `baseLocale` into Bob
  session metadata and `translationSetup` through the existing command result,
  without a second `ck:open-editor` or a new message;
- that adoption does not serialize or solve the simultaneous race between
  first Save and an account-locale `PATCH`;
- first Save alone sends `widgetType`; existing Save sends only record `config`,
  and Roma selects its compiled artifact from the Tokyo-owned saved-instance
  list fact without caller `widgetType` comparison/revalidation;
- Bob contains no publication state, status receipt, public action, or
  Publish/Republish/Unpublish command;
- Save never invokes package generation or publication work;
- saving a published instance leaves the public package unchanged;
- opening or saving after downgrade preserves exact existing content, while a
  newly disallowed governed edit is denied before mutation;
- newer edits made during Save remain dirty;
- repeated localized content follows stable identity; added identities remain
  untranslated until Generate and deleted identities disappear;
- no Widget-specific shared-service branch or renamed client workflow exists;
  and
- focused and all-Widget implementation checks pass locally.

## 17. Required Final V1-V8 Audit

| ID | Required result | Reason |
| --- | --- | --- |
| V1 | Pass | Bob consumes exact compiled software, source, policy, denial, and stable identity-keyed overlay truth without positional fallback; existing Save consumes Tokyo's stored `widgetType` without a caller value or substitute. |
| V2 | Pass | Denied edits remain unapplied; existing downgrade overage is preserved; and Save stores the exact draft without repair. |
| V3 | Pass | Widget software, one draft, preview context, edit policy, first-Save `widgetType` plus config, existing-Save config plus account-scoped stored instance fact, source Save, and Publish handoff remain explicit. |
| V4 | Pass | Edit limits remain at the governed edit action after downgrade; Save does not become a second gate. |
| V5 | Pass | Exact `instance.source.json` is the visibility/creation/deletion-anchor fact; a source-only unpublished instance is valid, while a failed pre-source creation or unreachable post-Delete residual prefix cannot masquerade as an instance or depend on package recovery. |
| V6 | Pass | New writes nothing; first Save reports exact creation plus its persisted `baseLocale` through the existing result for in-place session adoption; later Save either reports its exact serialized update or explicit `commandInProgress`; Delete reports exact source-anchor removal without waiting for residual cleanup; strict revision coordinates and stable overlay identity give divergence/reorder/add/delete their explicit outcomes without claiming publication or translation generation. |
| V7 | Pass | Stored-package preview and public-runtime editor messaging are removed rather than renamed; Save remains source persistence. |
| V8 | Pass | Verification remains offline evidence, not editing-runtime machinery. |

This table states the required result. The independent post-implementation
audit is the implementation evidence.

## 18. Reconciliation State

```text
all-Widget source-based Bob open/preview: present in cloud-dev
one browser-memory draft and generic edit decision: present in cloud-dev
one Roma upsell Popup: present in cloud-dev
first/later source-only Save split and in-place ID adoption: deployed; owner first-Save interaction QA pending
first-Save result locale coherence: deployed contract; owner first-Save interaction QA pending
simultaneous first-Save/account-locale PATCH: separate race not serialized or solved by result adoption; no resolution claimed in this pass
Save ingress ownership: deployed; existing Save uses Tokyo's stored widgetType and consumes no caller widgetType
atomic editable source and source-key visibility: deployed; all four legacy saved instances cut over
instance Delete commit: deployed; owner Delete interaction QA pending
existing-instance command coordinator and strict revision coordinates: deployed; Republish produced strictly newer publishedAt for both public instances
stored public package use by Bob preview: removed from the deployed path
stable overlay identity after repeated-content Save: present in cloud-dev
positional overlay compatibility path: absent; explicit Generate/delete cutover required for previously stored positional overlays
account product data: four saved instances cut over; two public instances Republished through Roma
stored positional-overlay Generate/delete cutover: pending
pre-GA atomic-publication cutover: complete; no compatibility fallback exists
product commit and main push: a6678966
deploy: Worker deployment, Roma/Bob runtime reachability, and Tokyo R2 product-root sync passed
live product: corrected Save path is active; authenticated saved-instance Builder open passed; first-Save owner QA pending
```
