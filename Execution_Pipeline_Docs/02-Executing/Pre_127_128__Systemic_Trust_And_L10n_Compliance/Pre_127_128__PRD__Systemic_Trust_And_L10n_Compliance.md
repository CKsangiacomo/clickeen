# Pre-127/128 PRD — Authenticated Product Systemic Trust And English UI-Source Compliance

Status: **READY TO RESUME — SCOPE CORRECTED; NO PRODUCT CORRECTION SLICE IS CURRENTLY IN PROGRESS; BLOCKS CONTINUED PRD 127 AND PRD 128 WORK**

Owner: Clickeen product owner/architect

Execution coordinator: Primary Clickeen implementation agent

Date: 2026-08-21

Planning baseline: `e958529d03108edd7d32683b865da89a3a3c0e2d`

## 1. Goal

Correct the current authenticated Clickeen product before PRD 127 or PRD 128
continues.

The pass removes concrete, current or reachable instances of:

1. AI-invented hardcoded product copy and undocumented one-off UX;
2. incorrect loading, empty, command, success, error, and missing-truth states;
3. English product-UI copy stored outside its existing l10n owner;
4. downstream checks, guards, filters, coercion, repair, and validation that
   distrust truth already produced by a named Clickeen authority; and
5. undocumented alternate workflows or shared-service exceptions that make
   the product hard for agents to operate reliably.

This is a correction pass over the product that members currently use. It is
not PRD 127's translation implementation, PRD 128's release reconciliation, a
public-Widget pass, a Prague pass, or a DevStudio pass.

## 2. Why It Must Happen First

PRD 127 must not translate or standardize accidental English copy, invented
helpers, local component semantics, or inconsistent UX states. Doing so would
multiply those errors across languages.

PRD 128 must not release agents into a product whose behavior depends on
hidden conventions, competing validators, silent substitution, or services
that do not trust each other's named outputs. Agents require explicit product
meaning and direct authority boundaries.

Closing this pass does not automatically resume either program. The product
owner separately authorizes the next PRD 127 or PRD 128 action.

## 3. Product-Owner Authority

The human product owner/architect owns product direction, UX judgment,
architecture judgment, policy, and final authority.

`documentation/` is the current Clickeen operator knowledge base. It records
product law and proved implementation truth; it is not an authority above the
product owner. When the owner changes a decision, the execution plan, owning
implementation, and current manuals are corrected together.

Agents may recommend. They may not defend AI-authored implementation or
documentation against an owner decision, and they may not convert a
recommendation into product law.

## 4. Exact Scope

### 4.1 Included product

- Roma's authenticated customer/member application;
- Bob as opened through Roma's Builder;
- Product Copilot product UI inside Bob;
- Translation Agent product UI inside Bob;
- Dieter components only where Roma or Bob currently consumes them;
- the current Widgets' ToolDrawer structure, adjacent labels, and contextual
  upsell copy as rendered inside Bob;
- Roma Widget Defaults as an authenticated account-product editor;
- Save, Publish, Republish, Unpublish, asset, team, settings, and other current
  authenticated product commands;
- the Berlin, Michael, Tokyo-worker, San Francisco, and agent boundaries
  concretely reached by those included product journeys; and
- current manuals owned by an implemented correction.

The pass follows an included journey only far enough to verify its real product
result and the trust handoff it uses. A reached service is not thereby opened
for a service-wide cleanup.

### 4.2 Explicitly excluded

- DevStudio, including its operator copy, l10n, implementation, and internal
  optimization;
- Prague, including marketing copy, localization, and `/l10n/translate`;
- published/public Widget visitor UI, public runtime copy, public Widget Core
  controls, public locale selection, and public package presentation;
- customer-authored Widget content;
- customer-content overlays and public Widget translation;
- Translation Agent generation/model execution, generated translation truth,
  overlay writes, translation quality, and translation-generation redesign;
- non-English product-UI generation;
- product UI-language selection, preference activation, or locale switching;
- PRD 127 Stages 3–5;
- PRD 128 release, deployment, or 128F reconciliation;
- theoretical future products, consumers, and failure modes;
- new features, redesigns, frameworks, registries, compatibility layers,
  validators, or deployment/storage topology; and
- product-data mutation, commit, push, or deployment unless separately and
  explicitly authorized.

Public serving may be named only as the excluded downstream boundary of an
authenticated publication command. It is not inspected or accepted as part of
this pass. DevStudio may be used only as optional read-only evidence that a
Dieter source contract exists; DevStudio itself is never changed or used as an
acceptance gate.

## 5. Clickeen L10n Model Applied By This Pass

This pass enforces the existing English source model. It does not design a new
l10n system.

### 5.1 Two product-UI copy categories

1. **Application Chrome** — copy Roma or Bob declares because it is part of
   that application. Roma Chrome belongs under `roma/l10n/`; Bob Chrome belongs
   under `bob/l10n/`. Bob-owned ToolDrawer shell, navigation, system controls,
   and editor states remain Bob Chrome even though they render inside the
   ToolDrawer.
2. **Widget-declared ToolDrawer labels** — copy whose product meaning is
   declared by a Widget through `$label:` tokens in its `spec.json`. It belongs
   to that Widget's adjacent English label contract and is compiled by Bob into
   that Widget's editor artifact.

Ownership follows the declaration of product meaning, not the DOM location in
which the words happen to render.

The existing Widget contextual upsell contract remains adjacent to its Widget.
It does not become a global catalog or a third general UI-copy authority.

### 5.2 Feature-owned application sources

`roma/l10n/` and `bob/l10n/` are application ownership roots. They are not
requirements to place every application string in one flat `en.json` file.

This pass may create feature or domain subfolders inside either root when a
real current copy set proves the need. The exact topology is established by
the slice that owns the product journey. It must:

- follow product domain or feature meaning rather than arbitrary React
  component boundaries;
- keep copy close to the feature that owns and renders it;
- create no empty future folder or speculative catalog;
- preserve English as the direct application path through the existing
  application composition;
- avoid a new runtime copy loader, registry, or fallback; and
- keep separately owned messages separate even when their current English text
  happens to match.

### 5.3 Ownership table

| Included wording | Exact owner |
| --- | --- |
| Roma visible and accessible Chrome | The owning Roma feature's English source under `roma/l10n/` |
| Bob visible and accessible Chrome | The owning Bob feature's English source under `bob/l10n/` |
| Bob-authored ToolDrawer shell, navigation, system controls, operations, and editor states | The owning Bob ToolDrawer feature source under `bob/l10n/` |
| Widget-declared ToolDrawer labels, placeholders, options, helpers, accessible names, and component inputs | The declaring Widget's adjacent `tokyo/product/widgets/{widgetType}/labels/en.json`, resolved from its `spec.json` `$label:` tokens and compiled by Bob |
| Widget-context entitlement/upsell message shown in Builder | The Widget's existing adjacent `upsell/en.json` contract |
| Dieter component mechanics | No wording ownership; Dieter receives the caller's exact resolved string |
| Static product UI around an agent | Bob Chrome |
| Dynamic agent narration | The operating agent's structured event/result contract; Bob renders it without inventing substitute narration |
| Internal route/provider reason | Internal structured truth; the owning Roma or Bob surface owns any user-facing message |

### 5.4 ToolDrawer provenance test

For every word rendered inside the ToolDrawer:

```text
Declared by Bob independently of the Widget spec
→ owning Bob feature source under bob/l10n/

Declared by the Widget through spec.json
→ that Widget's adjacent labels/en.json

Hardcoded by Dieter
→ violation; move the approved meaning to the actual Bob or Widget caller
```

Bob Chrome is not compiled into every Widget artifact. Widget labels are not
moved into Bob merely because Bob renders them.

### 5.5 Compliance rules

- English remains the direct default path. It is not obtained through a
  runtime locale fetch or fallback.
- Every included visible or accessibility string has exactly one owner above.
- A component literal is not an acceptable substitute for its owning English
  source.
- Copy is organized by its product feature and meaning, not deduplicated by
  spelling or collected according to rendered location.
- Messages remain complete translatable units, not stitched sentence
  fragments.
- Missing owned copy fails at the producer/build boundary. Runtime does not
  silently substitute English or another string.
- Dieter does not gain a copy catalog, locale folder, or consumer meaning.
- Bob does not gain a global all-Widget label catalog.
- Roma and Bob do not gain flat catch-all catalogs that erase feature
  ownership.
- Customer content, overlays, published Widget copy, Prague, and DevStudio do
  not enter Roma or Bob product-UI catalogs.
- This pass does not create translated files, locale-specific artifacts,
  language selection, or an active non-English path.

## 6. Established Systemic UX Laws

These owner decisions are already approved and do not require repeated
confirmation when a concrete mismatch is fully covered by them.

| ID | Established law |
| --- | --- |
| D1 | Undocumented hardcoded product messages are presumed AI-invented. Remove them or place the owner-approved meaning in the exact source defined in Section 5. |
| D2 | An undocumented one-off behavior, helper, fallback, component treatment, alternate route, or consumer-specific shared-service branch is not precedent. Remove it or stop for an owner decision. |
| D3 | An unresolved data-value slot renders no invented value, prose, placeholder, skeleton, Spinner, or Empty State in place of missing truth. |
| D4 | Passive loading uses the systemic Dieter Spinner at the owning state boundary, with no visible loading prose. The caller supplies its accessible name. A Spinner never replaces a data value. |
| D5 | Successful exact-zero uses the systemic Dieter Empty State: fixed ellipsis Icon plus exactly one caller-owned short string. Loading, failure, unauthorized, corrupt, and partial states are not empty. |
| D6 | Command pending feedback remains on the exact operated control. The control keeps its real identity and owns its busy state and Spinner. |
| D7 | Save is the independent named pink control: `Save`; Spinner + `Saving…`; then the system-green checkmark + `Saved` for exactly one second before the control disappears. |
| D8 | Republish is the independent named green control: current Icon + `Republish`; Spinner + `Republishing…`; checkmark + `Live widget updated`. The receipt belongs to the exact instance/source revision. |
| D9 | Errors expose the real failed operation and remain distinct from loading and successful zero. Retry cannot disguise or repeat a different failed workflow. |
| D10 | Dieter owns reusable structure, presentation, and generic interaction. It owns no caller meaning or copy. |

Exact technical literals are not automatically violations. Routes, protocol
names, storage coordinates, structured enum values, and deterministic contract
constants may remain literals when their named authority owns them. The target
is hidden product meaning, not text characters in general.

## 7. Closed-System Trust Law

A named Clickeen authority owns the correctness of what it produces. A
downstream Clickeen consumer uses that exact truth without revalidating,
filtering, normalizing, coercing, repairing, projecting, or interpreting it
against a second semantic schema.

### Keep at the owning boundary

- authentication and authorization;
- current-account and grant minting;
- browser, human upload, and request ingress;
- third-party and model-provider response acceptance;
- producer validation before an artifact becomes Clickeen truth; and
- build/source verification owned by the producer.

### Remove when a current included journey reaches it

- downstream semantic revalidation of Clickeen-produced truth;
- duplicated schemas or allowlists used to project an upstream artifact;
- normalization, coercion, repair, or silent healing;
- compatibility parsing or alternate accepted shapes;
- fallback to another account, locale, provider, model, identity, artifact, or
  invented default; and
- runtime dependence on tests, probes, scans, or validation rituals.

The audit must not respond to distrust by adding a better validator. Correct
the producing authority when it is wrong; otherwise consume its output
directly.

## 8. Execution Outputs

This parent document owns scope, product law, process, slice status, decisions,
and final closure.

Execution produces a series of adjacent evidence documents. Create a slice
document only when that slice actually starts. Each records:

- context reset and routed manuals read;
- real journey and user intent;
- PM/UX state map;
- concrete findings and reachability;
- copy and truth ownership;
- approved implementation plan;
- files and product-data effects;
- checks and product replay;
- independent V1–V8 audit; and
- commit, push, deploy, live, and remaining-work reconciliation.

Do not create empty future slice documents. Do not treat an inventory document
as completion of a product correction.

## 9. Context Reset Before Every Slice

The primary agent and every participating agent must reset before each slice
and after context compaction or replacement:

1. read `AGENTS.md` completely;
2. read `documentation/README.md`, `architecture/CONTEXT.md`,
   `architecture/Tenets.md`, and `strategy/WhyClickeen.md` completely;
3. follow the documentation router and read every manual owned by the included
   journey and every authority it concretely reaches;
4. read this complete parent document and the complete active slice document;
5. read PRD 127 or PRD 128 only where the slice directly depends on its current
   contract;
6. refresh Git/worktree and relevant source/runtime state; and
7. record the read set and baseline in the slice document.

The primary agent performs its own reading. A subagent summary does not replace
it.

## 10. Product-First Agent Process

Use at most four concurrent agent slots and only where the work can be divided
without overlapping authority or files.

### Step 1 — PM/UX reconstruction before code

An independent PM/UX agent enters through the real included product journey
and records:

- what the member is trying to accomplish;
- actions in order;
- authoritative truth available at every state;
- visible and accessible presentation;
- passive loading, successful zero, command pending, receipt, failure,
  recovery, cancellation, and navigation behavior; and
- long-copy/localization pressure on the current English UI.

It recommends outcomes but cannot invent product law.

### Step 2 — Reachability classification

Classify each candidate as:

- **happening now** — observed in the current owning product surface;
- **concretely reachable** — exact current flow and conditions are proved;
- **latent** — current code path exists but no current authoritative input
  reaches it; or
- **theoretical** — conjecture without a current product flow.

Only happening-now and concretely reachable problems are implemented unless
the owner explicitly expands scope. Latent residue may be removed only when it
is part of the smallest correction to the same owning path.

### Step 3 — Ownership trace

After the UX map exists, trace the exact code, copy source, contract, route,
storage coordinate, service handoff, and runtime surface. Identify:

- product surface;
- account/session coordinate;
- route/API boundary;
- storage coordinate;
- runtime/deploy surface;
- verification surface;
- truth producer and trusted consumer; and
- copy owner and exact feature source under Section 5, including whether a
  ToolDrawer string is Bob-authored Chrome or Widget-declared meaning.

If the trace changes an authority statement or requires new product law, stop,
correct the plan, and ask the product owner.

### Step 4 — Classify the outcome

- **keep** — already correct and owned;
- **fix** — concrete mismatch covered by established law;
- **remove** — invented, duplicated, obsolete, or unreachable machinery whose
  removal is part of the current correction;
- **decision required** — a reachable product question not settled here; or
- **out of scope** — belongs to an excluded surface or a later program.

### Step 5 — Plan the smallest owning correction

Separate:

- code changes;
- product-data changes;
- deploy/runtime verification; and
- documentation changes.

Assign non-overlapping implementation ownership. Reuse current authorities,
contracts, Dieter primitives, and generators. Do not create a framework for an
inventory problem.

### Step 6 — Implement in bounded parallel work

Implementation agents change only their assigned authority. The primary agent
owns shared-contract integration and generator sequencing. No agent may expand
from an included consumer into excluded DevStudio, Prague, or public Widget
work.

### Step 7 — Verify through producers

Run focused generation, type, test, build, lint, syntax, and diff checks in
proportion to the real blast radius. Tests prove the producer; they do not
become runtime dependencies.

### Step 8 — Replay the member journey

The PM/UX agent repeats the same journey against the corrected owning surface.
Source/local evidence and deployed cloud-dev evidence remain distinct. Never
claim live correction before an authorized deploy.

### Step 9 — Independent V1–V8 audit

A fresh non-implementing agent audits the correction. Every confirmed blocker
is corrected and re-audited before the slice closes.

### Step 10 — Reconcile and close

Record files, checks, manuals, product-data state, PM/UX replay, V1–V8 result,
commit/push/deploy/live state, owner decisions, and exact remaining work. Then
reset context before the next slice.

## 11. Product Journey Slices

The following is the execution order. It is a product journey map, not a set of
service-wide audits.

### Slice 1 — Authentication, bootstrap, and Roma entry

- Login and invitation-recipient entry.
- Login-time invitation acceptance.
- Bootstrap, current-account truth, initial authenticated shell, session
  expiry, failure, and recovery.
- Roma Chrome copy reached by those states, stored with the owning Roma
  authentication or shell feature under `roma/l10n/`.

### Slice 2 — Roma navigation, collections, and account surfaces

- Navigation and intentional shell-only Home.
- Widgets inventory/catalog, Assets inventory, Team/invitations, Profile,
  Billing, Usage, AI, and Settings.
- Passive loading, successful zero, filtering, failure/retry, confirmation,
  and command states.
- Roma English Chrome ownership by product domain, including feature subfolders
  under `roma/l10n/` where the real copy sets require them, plus reached
  authority handoffs.

### Slice 3 — Builder open, editing, and ToolDrawer

- New and saved Builder open, exact identity truth, unavailable truth, initial
  preview, and ToolDrawer state.
- ToolDrawer navigation, fields, nested controls, dirty state, Undo, preview,
  and Manual/Copilot transition.
- Widget Defaults as a separate authenticated Roma editor.
- Bob-authored ToolDrawer Chrome versus Widget-declared ToolDrawer labels and
  Widget upsell copy, classified by declaration rather than rendered location.
- Bob feature-owned English sources under `bob/l10n/`, with subfolders created
  only where the current Builder product proves they are required.
- Dieter only through components consumed in these product flows.

### Slice 4 — Save and publication controls

- Save, Saving, Saved, failure, edit-after-receipt, first Save, later Save,
  reopen, and unsaved leave.
- Publish, Republish, Live widget updated, Unpublish, dirty-versus-published
  status, confirmation, failure, and recovery in the authenticated product.
- Bob-to-Roma-to-Tokyo source and command handoffs.
- Stop at the public-serving boundary; public visitor output is excluded.

### Slice 5 — Assets and Builder media

- Asset collection, choose, passive stored-asset resolution, upload, replace,
  remove, failure, retry, and referenced-asset behavior.
- Exact distinction between passive state, successful zero, and the operated
  command control.
- Roma/Bob/Widget caller copy and reached Tokyo asset truth.

### Slice 6 — Product Copilot product experience

- Manual/Copilot transition, submit, stream, tool request, exact draft result,
  rejection, Stop, incomplete result, Undo, and explicit Save presentation.
- Bob static Chrome, dynamic agent narration, and internal transport reasons
  keep separate owners.
- Static Copilot Chrome stays with the owning Bob Copilot feature source rather
  than a flat application catch-all.
- Reached Bob/Roma/San Francisco/Product Copilot trust handoffs.

### Slice 7 — Translation Agent product experience

- The Translations panel and its visible/accessibility Chrome in Bob.
- The Generate control and the panel's defined pending, activity,
  success/partial/failure, retry, and translated-preview presentation are
  audited as Bob product UI through source, existing exact contracts, and
  non-mutating local evidence.
- Bob static Chrome and dynamic Translation Agent narration keep separate
  owners.
- Static Translations Chrome stays with the owning Bob Translations feature
  source rather than Widget labels or a flat application catch-all.
- The slice stops before the generation operation boundary. It does not invoke
  translation generation, model execution, overlay reads/writes, or translated
  preview data, and it does not accept translation quality, overlay
  architecture, generated customer content, public localized output, or
  translation-generation behavior.

### Slice 8 — In-scope residual and final reconciliation

- Re-scan only the files and generated artifacts owned by Slices 1–7 for the
  same concrete hardcodes, one-offs, state violations, l10n ownership gaps,
  and internal distrust.
- Tie every correction to an included current or reachable journey.
- Reconcile feature-owned Roma/Bob English source coverage, Bob-authored
  ToolDrawer Chrome, and current Widget-declared ToolDrawer label/upsell
  coverage without crossing those authorities.
- Run final PM/UX and independent V1–V8 reconciliation.
- Produce the resume recommendation for the product owner.

## 12. Finding Record

Each finding records:

```text
Finding ID:
Slice:
Included user/product flow:
Exact triggering conditions:
Reachability: happening now | concretely reachable | latent | theoretical
Product/runtime evidence:
Source/contract evidence:
Current behavior and why it exists:
Available authoritative truth:
Truth producer and trusted consumer:
Copy owner and exact feature source:
Axes: product meaning/one-off | systemic UX state | trust | l10n
V1-V8 classification:
Disposition: keep | fix | remove | decision required | out of scope
Established owner law or required decision:
Smallest owning correction:
Code files/authority:
Product-data effect:
Documentation effect:
Verification and replay surface:
Final result:
```

Finding IDs exist only for execution traceability. They do not become a
runtime registry.

## 13. Execution And Mutation Gates

An execution request authorizes the in-scope code and documentation work
required by the active slice. It does not automatically authorize:

- product-data writes;
- commit or push;
- deployment;
- managed-service mutation; or
- resumption of PRD 127 or PRD 128.

Before any product-data write, record the exact account/session and object
coordinate, current state, owning route, requested operation, expected result,
restoration/reconciliation plan, and proof surface. Use the normal product
route; never mutate storage directly as a substitute.

## 14. Slice Status Ledger

| Slice | Product journey | Status | Evidence document |
| --- | --- | --- | --- |
| 1 | Authentication, bootstrap, and Roma entry | pending | create when started |
| 2 | Roma navigation, collections, and account surfaces | pending | create when started |
| 3 | Builder open, editing, and ToolDrawer | pending | create when started |
| 4 | Save and publication controls | pending | create when started |
| 5 | Assets and Builder media | pending | create when started |
| 6 | Product Copilot product experience | pending | create when started |
| 7 | Translation Agent product experience | pending | create when started |
| 8 | In-scope residual and final reconciliation | pending | create when started |

No product correction slice is currently started.

## 15. Slice Completion Gate

A slice closes only when:

- the context reset and routed read set are recorded;
- the PM/UX journey and state map are complete;
- every finding has reachability and disposition;
- no owner decision is guessed around;
- l10n ownership, systemic UX, and reached trust handoffs are all audited;
- the smallest authority-correct changes are implemented;
- current manuals match the corrected implementation;
- focused producer checks pass;
- the same member journey is replayed on the strongest authorized surface;
- source, product-data, commit, push, deploy, and live states are explicit; and
- an independent V1–V8 audit passes.

## 16. Program Closure Gate

This program closes only when, for every included current or concretely
reachable journey:

- undocumented hardcoded product messages and one-off UX are removed or placed
  in their exact owner-approved contract;
- Roma English Chrome is complete in Roma's source;
- Bob English Chrome is complete in Bob's source;
- Roma and Bob copy remains feature-owned under their l10n roots rather than
  accumulated in flat catch-all files;
- Bob-authored ToolDrawer Chrome comes from the owning Bob feature source;
- every Widget-declared ToolDrawer word comes from that Widget's adjacent
  English label contract;
- Bob Chrome is not compiled into Widget artifacts and Widget-declared copy is
  not moved into Bob;
- every reached Widget-context upsell message uses its adjacent contract;
- Dieter owns no consumer meaning or copy;
- passive loading, successful zero, command pending, receipts, errors, and
  unavailable truth obey Section 6;
- downstream services trust exact Clickeen-produced truth;
- legitimate authentication, authorization, ingress, provider-acceptance, and
  producer checks remain intact;
- runtime does not depend on tests, scans, probes, or audit rituals;
- no excluded surface was silently pulled into the program;
- current manuals and execution evidence are reconciled;
- all focused and final checks pass;
- final PM/UX replay and independent V1–V8 audit pass;
- product-data, commit, push, deploy, and live state are explicit; and
- the product owner accepts closure.

The closure gate does not require public Widget copy ownership, public locale
behavior, Prague, DevStudio, customer overlays, or non-English product UI.

## 17. Decision Ledger

| ID | Date | Owner decision | Program effect |
| --- | --- | --- | --- |
| P1 | 2026-08-20 | Undocumented hardcoded messages and one-offs are AI-invented unless explicitly approved and placed in their owner. | Establishes Sections 5 and 6. |
| P2 | 2026-08-20 | Passive loading, successful zero, command pending, Save, and Republish use the systemic states recorded in Section 6. | Applies across included journeys. |
| P3 | 2026-08-20 | Named Clickeen authorities trust one another; downstream distrust is removed while real ingress/security checks remain. | Establishes Section 7. |
| P4 | 2026-08-21 | DevStudio is an English-only internal admin tool and is excluded. | Removes DevStudio implementation, l10n, and acceptance work. |
| P5 | 2026-08-21 | Prague and the published/public Widget visitor experience are separate later work. | Removes Prague, public Widget copy/runtime, and public localization from this program. |
| P6 | 2026-08-21 | Roma and Bob are application l10n roots, but their English copy remains organized by the feature or domain that owns its meaning; this pass may create proven subfolders and does not create flat catch-all catalogs. English remains direct and translations come later. | Establishes the distributed application-source rules in Section 5.2. |
| P7 | 2026-08-21 | ToolDrawer ownership follows declaration, not rendered location: Bob-authored ToolDrawer Chrome belongs to Bob l10n, while Widget-declared editing meaning belongs to that Widget's adjacent `labels/en.json`. Dieter owns neither. | Establishes the provenance split in Sections 5.1, 5.3, and 5.4 and the Slice 3/closure gates. |

There are no open product-copy decisions for excluded public Widget or Prague
surfaces in this program.
