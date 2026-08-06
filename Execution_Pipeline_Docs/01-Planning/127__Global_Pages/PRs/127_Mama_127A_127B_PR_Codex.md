# 127 Mama, 127A, and 127B — Peer Review (CODEX)

Date: 2026-08-05

Reviewed:

- `127__PRD__Global_Pages_Program.md`
- `127A__PRD__Page_Source_And_Policy.md`
- `127B__PRD__Web_Code_Generator.md`

Review lenses:

- Staff Engineer
- Senior Product Manager
- Principal TPM

## Review goal

This review protects Clickeen from AI overarchitecture. It does not search for
new systems or reopen product-owner decisions.

Each finding below is grounded in current product law, documentation, or
owning code. The review asks:

- Is the simple architecture preserved?
- Does the PRD reuse existing authorities?
- Does unnecessary machinery or academic prose remain?
- Does the execution text accurately name the current code being replaced?
- Could an executor invent because the wording is ambiguous?
- Which current documents must change with the implementation?

## Consolidated assessment

The three PRDs now describe the correct Clickeen product:

```text
browser editing in Bob or Page Builder
→ Web Code Generator writes complete HTML/CSS/JS
→ Roma applies existing account, policy, and Save authority
→ Tokyo stores and serves the files
→ Translation Agent runs only through Generate translations
→ Cloudflare caches complete public output
```

The core is cohesive, cost-effective, and agent-operable. It avoids a generator
service, background jobs, runtime composition, copied child source, revision
systems, compatibility layers, and separate Page translation machinery.

The remaining corrections are not reasons to add architecture. They are:

- remove repeated defensive prose;
- correct claims that unfinished behavior is already “existing”;
- name the actual existing code paths being replaced;
- make a few saved-source/editor boundaries explicit;
- remove revision machinery that still survives in 127C–127E;
- update stale current-truth documentation at the correct slice.

## 1. What must remain unchanged

### One direct authority chain

Keep the ownership boundaries exactly as written:

- Bob owns an Instance browser working copy.
- Page Builder owns a Page browser draft and Workspace preview.
- Web Code Generator is browser-compatible repository code.
- Roma owns current account, member, role, entitlement, and Save authority.
- Tokyo owns stored product files and public serving.
- Translation Agent translates only through the explicit Generate translations
  action.
- Cloudflare caches generated public output.

This is already consistent across the Mama, 127A, and 127B and matches the
current Clickeen authority model.

### Structured source plus complete files

Keep:

```text
structured source
+ index.html
+ styles.css
+ runtime.js
```

Complete semantic HTML before JavaScript is a necessary correction. Current
Widgets such as Cards and FAQ leave primary collections empty for
`widget.client.js` to construct. 127B correctly removes that hybrid behavior.

### Explicit customer actions

Keep the current decisions:

- Create and Duplicate open unsaved browser drafts.
- Nothing is created in Tokyo before Save.
- Save writes Page-owned or Instance-owned edits.
- Update page refreshes a Page from its latest saved Widget Instances.
- Generate translations uses the locales selected in account Settings.
- Publish exposes already-saved files and generates nothing.
- Settings changes affect only later explicit operations.

### Small Page source

Keep Page source limited to Page-owned values and ordered same-account Instance
references. Do not copy child source, store public Widget URLs, add a Page
selected-locale list, or add revision/build evidence.

### Existing overlay model

Keep:

- account Settings as selected-locale authority;
- `baseLocale` as source-language authority;
- Page-owned and Instance-owned locale values in overlays;
- generated `overlays.json` containing locale values only;
- no translation-triggered Web Code Generator run;
- no locale-specific CSS or JavaScript.

### Product UX decisions

Keep:

- Page Builder reusing Bob/Dieter structure and interactions;
- Widget SEO/GEO/AEO using the visible toggle and standard Upgrade interaction;
- Page SEO/GEO/AEO always included because Pages begin at Tier 2;
- templates carrying no locale, overlay, translation, or publication state;
- `pages.max` using the existing entitlement system;
- Tier99 as one ordinary internal-only tier, not an Admin subsystem.

### Direct pre-GA replacement

Keep the decision to delete obsolete Page UI, routes, types, storage code, old
renderers, and materializer ownership. Do not create compatibility readers,
dual shapes, migrations, or transitional UI.

## 2. Remove or simplify

### Remove the generator metaphor

Delete:

> Web Code Generator is Clickeen’s expert frontend developer expressed as
> deterministic repository code.

It adds no engineering contract and blurs the distinction between deterministic
code and agents. “Web Code Generator is shared browser-compatible repository
code” is sufficient.

### Reduce repeated prohibition lists

The Mama, 127A, and 127B repeatedly ban the same revisions, fingerprints,
validators, queues, recovery systems, compatibility paths, and background
work.

Keep the common exclusion list once in the Mama. Keep only slice-specific
exclusions in 127A and 127B. Repetition is document ceremony and creates more
places for future drift.

### Put Page UI timing proof in 127E

127B can prove that `generatePage` is a pure explicit operation. It cannot yet
prove that a customer invokes it only through Page Builder Save/Update because
127A removes the old Page UI and 127E installs the new caller.

Keep generator contract tests in 127B. Prove the Page Builder customer trigger
when 127E installs it.

### Remove revision machinery from sibling PRDs

The Mama, 127A, and 127B explicitly reject revision snapshots, fingerprints,
generated-from evidence, package history, and revision comparisons. Current
127C, 127D, and 127E still contain:

- `PageGeneratedFrom`;
- Page and Instance revision snapshots;
- `ck-page-revision`;
- revision-derived ETags and Publish checks;
- revision-based freshness comparison;
- concurrent revision rechecks;
- “minimal revision” payloads.

That is the same rejected subsystem under smaller labels. Align 127C–127E to
the accepted rule:

```text
referenced Instance Save
→ mark affected Page needsUpdate: true

explicit successful Update page
→ regenerate Page
→ clear needsUpdate
```

No comparison or evidence machinery is needed.

## 3. Clarify using current product and code

### The Widget SEO control is 127B work

The standard Upgrade interaction exists. The Widget SEO/GEO/AEO toggle and its
runtime consumer are not yet proven current behavior.

127B must say it implements:

- the Bob toggle;
- the saved Instance config value;
- Roma’s existing entitlement enforcement on Save;
- the Web Code Generator input/output behavior.

Do not call the unfinished control “existing.” Do not create a second
entitlement system.

### The Page overlay root is new Page work

The Instance overlay convention already exists. The Page overlay root is
introduced by 127A. Replace “existing Page overlay root” with “the Page overlay
root introduced by 127A.”

### Saved source is not an unsaved draft type

`AccountPageSource` requires a `pageId`; an unsaved browser draft has no
`pageId` until first Save. State explicitly:

- `AccountPageSource` is the saved Page contract;
- Page Builder holds an unsaved draft shape in browser memory;
- first Save creates the ID and saved source.

This is a type boundary, not a draft service.

### Languages belongs only to ordinary Pages

The Page Builder ToolDrawer lists Languages, while Page Builder also edits
templates. State that ordinary Pages show Languages and Generate translations;
templates do not.

### Generate translations requires a saved Page

The existing Translation UX needs a saved product coordinate. Make the Page
copy explicit:

```text
Save the Page first
→ Generate translations becomes available
```

Do not let missing translations block the first Save; that would make the
required Page coordinate impossible to create.

### Explain Save versus Update in one sentence

Use this customer wording consistently:

> Save applies your Page edits. Update page refreshes the Page from the latest
> saved Widgets.

### Name the real Create and Duplicate cutover

The desired behavior is correct, but it is not the current behavior.

Today:

- Widget Create POSTs and persists before opening Bob;
- Duplicate creates and persists immediately;
- Bob’s host contract expects an existing Instance ID and update command.

127B should name the current Roma UI/API/Bob paths being repurposed so an
executor removes create-first behavior without inventing a draft service.

### Name the browser artifact-delivery cutover

Current generated Bob editor artifacts do not include the raw Widget
HTML/CSS/JS that the browser will own after 127B. Name the coordinated change
across:

- Widget artifact generation;
- Roma Builder-open payload;
- Bob session/preview state;
- Bob Save payload;
- Roma/Tokyo accepted files.

This is one direct browser contract cutover, not a new source-fetch service.

### Include proven generator inputs

Current preview and Save paths resolve account assets and typography. The
illustrative `GenerateInstanceInput` and `GeneratePageInput` must include those
already-resolved browser values or explicitly reuse their current editor
contract.

Do not retain server regeneration to compensate for an incomplete browser
input.

### Clarify standalone document versus Page placement

A saved Instance `index.html` is a complete standalone document. A Page
placement needs the generated Widget root/content inside declarative Shadow
DOM, not a nested `<html>` document.

State this extraction/composition boundary explicitly.

### State how shared CSS reaches each Shadow Root

127B correctly chooses:

- shared Widget structure CSS once per Widget type;
- placement-specific CSS custom properties;
- declarative Shadow DOM isolation.

But ordinary document CSS does not cross a Shadow DOM boundary. The PRD must
state the one intended application shape for the shared generated stylesheet
inside each placement root. This is an implementation clarification within the
accepted CSS model—not authorization for selector rewriting, a registry, or a
new CSS system.

### Preserve renderer behavior while making required fields fail visibly

The existing stencil renderer is the right implementation to move, but it is
not currently package-independent and it silently converts some missing values
to empty output.

127B should make the cutover explicit:

- preserve escaping, conditions, parent lookup, raw-template behavior, and Bob
  compiler compatibility;
- add concrete loop index/path context;
- stop silently emptying required values or required repeaters.

This is a correction to the existing renderer, not a validator framework.

### Make Page overlay completeness precise

`Partial<PageValues>` must not mean that an overlay may arbitrarily omit a
translated field that exists in the Page source and was requested.

Clarify:

- optional source fields may be absent;
- when an optional field exists and is translated, the matching locale value
  is part of that overlay;
- generated Page and placement namespaces represent their actual saved values.

### Name the full Translation Agent coordinate cutover

Translation Agent reuse is correct, but the current code is Instance-specific
across:

- request and grant coordinates;
- `/translate-instance` handling;
- Tokyo internal write paths;
- Roma caller and result mapping.

127A should name those existing layers as the direct Page-coordinate cutover.
It must retain the same agent, provider, permission, activity, and result
behavior. It does not justify a Page agent or translation service.

### Preserve current per-locale terminal results

“No partial-result lifecycle” should mean no persisted job, retry state, or
new lifecycle. The existing Translation Agent still reports one terminal
result for every requested locale and identifies failures. Do not convert a
partial translation result into full success or hide failed locales.

### Refresh `baseLocale` on the next explicit operation

The accepted Settings law says Settings changes affect future explicit
operations. State that an existing Page receives the current account
`baseLocale` on the next Save/Update, matching the current Instance Save
pattern. Settings change alone still mutates nothing live.

### Name the runtime Page parsing owner

127A deletes the current Page parser but still requires invalid input and
corrupt stored source to fail visibly. Name the replacement parsing owner in
the existing Roma/Tokyo route/storage boundary. Do not create a shared
validator framework and do not cast unknown stored JSON directly to the type.

### Carry Tier99 through every existing tier reader

Tier99 is simple, but every closed existing reader must recognize it. The
actual blast includes:

- shared tier types and policy matrices;
- Berlin and Roma account bootstrap parsing;
- Roma tier labels/readers;
- Supabase enum and constraints;
- AI policy profile types and matrices;
- San Francisco grant-profile validation;
- tests and current documentation.

This is one ordinary tier extension, not rollout machinery or an Admin bypass.

### Use the existing unlimited-limit meaning

`pages.max: null` means unlimited in the shared policy evaluator. Some current
Instance create helpers reject non-finite values. Page first-Save enforcement
must use the shared existing unlimited meaning instead of copying the
finite-only helper.

### Delete fingerprints from all current consumers

The no-fingerprint decision is fixed. Current fingerprints exist beyond
`ck-runtime-materializer`, including:

- Tokyo Instance file writes and reads;
- Roma Builder-open and package payloads;
- Publish readiness;
- public `clk.live` serving;
- tests and operator docs.

127B must name those current consumers in its deletion blast radius so the
obsolete contract is removed completely. It must not replace fingerprints with
another integrity mechanism.

## 4. Documentation updates

### Correct already-stale locale ownership

These current documents say Page source owns selected locales, contradicting
the accepted Settings authority:

- `documentation/architecture/OverlayArchitecture.md`
- `documentation/capabilities/localization.md`

Update them with the owning slice.

### After 127A

Update current truth for Page source, Page overlay ownership, `pages.max`, and
Tier99 in:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/berlin.md`
- `documentation/services/michael.md`
- policy, AI policy, San Francisco, and Supabase operations docs
- `documentation/ai/agents/translation-agent.md`
- AI overview/agent-index docs
- Babel protocol and Page product-path test documentation where affected

Do not document Page Builder or public serving as current during 127A.

### After 127B

Update current truth for browser-owned generation, complete Widget files,
behavior-only runtime, response markers, and fingerprint removal in:

- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/architecture/RuntimeProfiles.md`
- `documentation/architecture/Tenets.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/widgets/authoring/WidgetFiles.md`
- `WidgetAuthoringChecklist.md`
- `ShellUtilities.md`
- `documentation/widgets/README.md`
- all eight Widget operator docs
- root `README.md`
- the Web Code Generator package documentation

Delete the obsolete `ck-runtime-materializer` README with its package. Do not
leave it as current or historical operator truth.

### Keep strategy lean

`WhyClickeen`, `GlobalReach`, and `Clickeen-Babel` already support one source,
explicit overlays, named authorities, and agent-operated content. Update them
only if deployed behavior makes a current statement false. Do not add a new
strategy narrative for Web Code Generator.

## 5. V1–V8 assessment

### V1 — Silent substitution

The intended architecture passes. The current stencil renderer is a concrete
cutover risk because some missing values become empty strings. 127B must not
carry that behavior into required output.

### V2 — Silent healing

The reviewed PRDs do not authorize repair or normalization of invalid source.

### V3 — Silent omission

The intended architecture passes. Required renderer fields/repeaters must not
be silently omitted. Also remove the sibling first-Save/translation circularity
that currently appears in 127E.

### V4 — Fail-open control

The authority model passes as long as Roma remains the final existing
account/role/tier/entitlement authority on Save and browser inputs never become
policy authority.

### V5 — Corruption as absence

127A correctly requires corrupt stored Page source to fail visibly instead of
becoming an empty Page. Preserve an owning runtime parser when deleting the old
one.

### V6 — Partial-success masquerade

Preserve the existing explicit per-locale Translation Agent result. Do not add
a lifecycle, but do not hide failed locale outcomes.

### V7 — Masquerade/redress

The Web Code Generator is a real ownership and output cutover. Remove the
materializer and sibling revision machinery instead of retaining them under
smaller names.

### V8 — Runtime test dependency

The PRDs use tests as verification evidence, not runtime product dependencies.
Keep Page Builder invocation proof in the slice that installs the caller.

## Final conclusion

The product and architecture are now correct:

- one direct set of authorities;
- explicit customer operations;
- complete browser files;
- no autonomous compiler;
- no separate Page translation system;
- no revision or package machinery;
- no compatibility layer;
- no legacy-SaaS runtime composition.

The required next work is a bounded specification cleanup, not another design
cycle. Tighten the current-code cutovers, remove repeated ceremony, align
127C–127E with the locked no-revision decision, and update current-truth docs at
the owning slice. No new subsystem or product-owner decision is implied by this
review.
