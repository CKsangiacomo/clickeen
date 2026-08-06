# 127D — CODEX Execution-Readiness Peer Review

Status: **NOT READY — SMALL, CONCRETE CORRECTIONS REQUIRED**

Subject: `127D__PRD__Page_Currency_And_Explicit_Update.md`

Date: 2026-08-05

This review consolidates three independent lenses: Staff Engineer, Senior PM,
and Principal TPM. Each reviewer checked 127D against the 127 Mama PRD, the
accepted 127A–127C contracts, current product laws, current documentation, and
the Roma/Tokyo code that already saves Instances, translations, Page source,
and Page serving state.

This is a review of the proposed execution contract. It does not redesign the
product and it does not authorize execution.

## What 127D really does

127D adds one boolean to every ordinary Page: `needsUpdate`.

- Saving an ordinary Widget Instance marks every ordinary Page that uses it as
  needing an update.
- Saving a translation for a referenced Widget Instance also marks those Pages.
- Saving translated Page metadata marks that Page.
- Nothing recompiles automatically.
- The customer explicitly clicks **Update page**.
- A successful Update stores the newly generated Page files and clears the flag.
- A published Page that Needs update keeps serving its last stored files.
  Whether Update requires prior Unpublish remains the explicit 127C product
  decision.

That is the correct simple model. It needs no revisions, dependency graph,
reverse index, Queue, job, watcher, autonomous compiler, or recovery system.

## Verdict

The architecture is directionally correct and deliberately lean. The PRD is not
yet executable because its trigger list is incomplete, one condition invites
the exact comparison machinery the program rejected, and the boundary between
127D backend behavior and 127E customer UI is blurred.

All required corrections fit inside the existing Roma, Tokyo, overlay, and Web
Code Generator authorities. No new subsystem is justified.

## What is correct and must remain

1. **One boolean, two states.** An ordinary Page is Current or Needs update.
2. **Explicit customer action.** Saving a Widget or translation never rebuilds
   a Page. Only **Update page** does that.
3. **Last stored output remains live.** A published stale Page is not silently
   unpublished or regenerated. 127D consumes 127C's eventual decision about
   whether Update requires prior Unpublish.
4. **Existing authority chain.** Roma owns authenticated commands and product
   policy; Tokyo owns the exact stored flag; 127B generates files; 127C stores
   and serves them.
5. **Simple reference lookup.** Roma can use the existing same-account Page
   source scan to find Pages that reference an Instance. Do not replace it with
   an index, graph, registry, or background process.
6. **Settings are prospective.** Account Settings changes do not modify the
   flag or live files. A later explicit operation uses the new settings.
7. **Templates are outside this state.** Templates are saved reusable source,
   not published Pages, and do not have Current/Needs update status.

## Required corrections before execution

### 1. Add referenced Instance translation writes to the trigger list

127D currently marks Pages after an Instance Save and after a Page-overlay
write. It omits the existing operation that writes a referenced Instance's
locale overlay.

That omission is real: Instance translations can change without an Instance
Save, and 127B reads those translations when it generates the Page. Without
this trigger, a Page can remain falsely **Current** while its saved Widget
translation has changed.

Correction: after every successful referenced ordinary-Instance overlay write,
Roma uses the same same-account Page-source scan and asks Tokyo to set
`needsUpdate: true` on the matching ordinary Pages. This includes **Generate
translations** and an approved exact localized-value edit. It does not require
a new translation path or service.

### 2. Mark after every successful Page-overlay write

The PRD currently marks only when a Page overlay value is "not yet present" in
generated `overlays.json`. That is wrong. Editing an existing translated title
or description changes the source used by the next Page generation too.

It also invites Roma to compare authoring truth with generated output, which is
precisely the revision/evidence machinery 127D rejects.

Correction: every successful ordinary Page-overlay write sets
`needsUpdate: true`. Setting an already-true boolean to true is harmless.

### 3. Define the Instance trigger as Save, not inferred change

"When an Instance changes" leaves room for an executor to invent byte
comparisons, timestamps, hashes, or revision semantics. The current product has
a clear event already: successful Instance Save.

Correction: every successful Save of an existing ordinary Instance marks the
ordinary Pages that reference it. Do not add no-op detection.

### 4. Keep 127D and 127E ownership separate

127D currently requires the Page Builder modal, browser generation, and full
click journey even though 127E owns Page Builder and its customer-facing
Save/Update wiring.

Correction:

- 127D implements and verifies the stored flag, all marking triggers, Roma API
  gates, and the authenticated Update acceptance boundary for 127B-generated
  files.
- 127E implements and verifies the modal, list/detail actions, role/tier UX,
  browser Web Code Generator call, and end-to-end customer journey.

This is slice ownership, not a temporary UI or a second generation path.

### 5. Make the operation result truthful if Page marking fails

An Instance source or overlay is saved before the later writes that mark its
referencing Pages. Those are separate stored objects. A generic "Save failed"
would wrongly imply that nothing was saved; full success would wrongly hide a
Page whose flag was not updated.

Correction: the same operation response must say that the Instance/translation
was saved but Page update status could not be set, and identify the affected
Page operation failure. It must not claim full success or total failure. This
is immediate response truth only—not a persisted failure lifecycle, retry job,
recovery record, or workflow.

### 6. Do not promise transactional R2 writes that do not exist

The PRD says every failed Update leaves all previously published bytes
unchanged. Page files and `serve-state.json` are separate R2 objects, so that
blanket guarantee is stronger than the chosen direct-storage architecture.

Correction:

- generation failure stores nothing;
- any storage or flag failure returns failure;
- `needsUpdate` clears only after the Page files and flag write succeed;
- 127D does not restate or redesign the file-write behavior owned by 127C.

Do not introduce candidates, pointers, rollback files, or transactional
machinery to satisfy an unnecessary sentence.

### 7. State the gate accurately

`needsUpdate: false` does not itself authorize Edit or Publish. It only means
the currency gate does not block the action. Existing account, role, tier, and
Page policy still apply before generation or mutation.

This includes the existing product laws:

- viewers do not receive mutation actions;
- tier-blocked actions use the standard Upgrade interaction;
- everything remains visible while access is controlled by tier.

### 8. Put the state where customers can see it

The PRD promises a customer-visible Current/Needs update state but currently
surfaces it only after opening a Page.

Correction: the existing **Your pages** inventory shows the state and the Page
detail/open flow enforces it. No dashboard, activity system, or job status is
needed.

### 9. Correct the customer copy

The current sentence is grammatically wrong and mentions only Widget changes.
The flag can also be set by Page metadata translations.

Use source-neutral copy, for example:

> This page has saved changes that must be applied before you can edit or
> publish it.

Actions remain **Update page** and **Back to pages**. 127E owns the final modal
layout and interaction details.

### 10. Handle the existing stored-state cutover explicitly

127C can leave ordinary Pages whose `serve-state.json` predates the required
`needsUpdate` field. The executor must not silently treat a missing field as
false.

Correction: before deployment, inventory ordinary Pages created by the current
pre-GA system. Prove none require conversion or update each through the
authorized Page operation. Do not add a compatibility reader or migration
framework.

### 11. Remove repeated and already-owned cleanup

Delete repeated instructions in 127D to remove revisions, fingerprints,
evidence, generated history, and related code that 127A–127C already remove.
127D should only verify that it does not reintroduce them. Consolidate the
remaining exclusions into one short section.

## What the reviews rejected as unnecessary

The reviewers surfaced two theoretical concerns that do not justify more
machinery in this slice:

- A simultaneous Save and Update could race. The current product has no proven
  customer workflow requiring locks, compare-and-swap, or revision checks.
  Do not build concurrency machinery in 127D.
- Tier 4 and Tier99 can have unlimited Pages, so the Page scan is not literally
  bounded by a Page entitlement. Remove the word **bounded**; retain the simple
  same-account scan until measured product behavior proves a different need.

Neither item is a product-owner decision required to execute 127D.

## Product-owner decisions

No new product decision is required for the corrections above. They follow
already-approved laws: explicit Update, no autonomous generation, existing
translation writes, normal role/tier enforcement, and truthful operations.

127C's separate open decision about saving an already-published Page remains a
127C decision; 127D must consume that answer rather than reopen it.

## Exact documentation updates required after deployment

- `documentation/services/roma.md` — same-account reference scan, all marking
  triggers, currency gates, Update acceptance boundary, and truthful operation
  response.
- `documentation/services/tokyo-worker.md` — exact two-field Page serving-state
  shape and idempotent set/clear mutations; Tokyo does not infer freshness.
- `documentation/architecture/OverlayArchitecture.md` — Page and referenced
  Instance overlay writes mark affected ordinary Pages.
- `documentation/capabilities/localization.md` — Generate translations and
  approved overlay edits mark Pages; Settings changes do not.
- `documentation/architecture/CONTEXT.md` and `Overview.md` — only the concise
  current Page currency law after deployment.
- `documentation/engineering/UI/dialogs-and-modals.md` and
  `documentation/engineering/PlaywrightE2E.md` — customer modal/list behavior
  and deployed evidence when 127E delivers the UI.

Do not add a separate currency manual. Remove `bob.md` from 127D's required
documentation unless this slice actually changes Bob; Page Builder UI belongs
to 127E.

## V1–V8 result

| Gate | Result before correction | Reason |
| --- | --- | --- |
| V1 | Open | Missing Instance-overlay triggers can falsely report a stale Page as Current. |
| V2 | Open | Missing pre-127D state must not be silently defaulted to false. |
| V3 | Open | Referenced Instance overlay writes and the real D/E boundary are omitted. |
| V4 | Open | An omitted or failed mark can leave Edit/Publish currency enforcement open. |
| V5 | Open | Existing `serve-state.json` needs an explicit pre-GA cutover. |
| V6 | Open | The current generic failure wording can conceal a persisted source write. |
| V7 | Green | The design deletes rejected revision/evidence machinery instead of renaming it. |
| V8 | Green | Product work does not depend on tests, probes, or validation rituals. |

All open gates have direct corrections above. None requires a new service,
queue, graph, revision model, or recovery system.

## Execution-readiness conclusion

127D is ready after the PRD makes these corrections:

1. mark on ordinary Instance Save, referenced Instance overlay write, and every
   Page overlay write;
2. remove generated-output comparison and inferred-change language;
3. keep backend state/API work in D and customer Page Builder wiring in E;
4. state truthful immediate failure and non-transactional storage semantics;
5. expose Current/Needs update in **Your pages** and apply existing role/tier
   law;
6. define the pre-GA stored-state cutover and exact documentation owners;
7. remove repeated cleanup and do not introduce concurrency/index/revision
   machinery.
