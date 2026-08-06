# 127D — Peer Review (GLM)

Status: **PEER REVIEW — CONSOLIDATED**

Subject: `127D__PRD__Page_Freshness_And_Explicit_Update.md`

Date: 2026-08-04

Model: builtin:zai-coding-plan/GLM-5.2

Three independent peer reviews under the locked mandate: accuracy against the
codebase/tenets, executor-readiness gaps where an AI will invent, documentation
coverage. **Primary focus: NOT inventing machinery.** No redesign, no
re-litigation of settled decisions. All claims grounded in real files read fresh.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127D — Staff Engineer Peer Review (GLM)

#### 1. Elegant engineering and scalability

- **Two-state freshness derived purely from consumed revisions, not stored.** The PRD's strongest decision is that Current/Needs update is *computed* at list/open time (127D §"Deriving freshness", lines 82-93) from a minimal `generatedFrom` snapshot plus current saved truth, rather than persisted as a third lifecycle field. This keeps `serve-state.json` as a record of "what we generated from" and avoids any state machine, which is the leanest design that satisfies the freshness question and scales to N placements per page with no extra stored state.
- **Reuse/batch of existing reads instead of a new dependency service.** §"Deriving freshness" lines 98-101 explicitly forbids per-cell/per-placement remote loops and frames batching as an implementation-efficiency requirement, not authorization for a registry/cache. This is the correct way to keep Page freshness O(existing account reads) rather than O(placements × pages).
- **Concurrency safety via revision recheck, not locks.** §"Concurrent changes" lines 162-174 rechecks consumed Instance revisions at Roma acceptance and rejects mixed sets with zero new stored state. This is the right minimal optimistic-concurrency model and avoids any lock/Queue machinery.
- **Single effective Instance revision covering source + overlays + package.** §"Revision contract" lines 55-57 unifying accepted source, direct HTML/CSS/JS, and overlays under one advancing value is the correct abstraction: it collapses what could have been three fingerprint families into one comparable scalar, which is exactly the anti-overengineering move the slice requires.

#### 2. Compliance with architecture and tenets

- **Tenet 1 (Agents operate structured artifacts) — PASS.** `PageGeneratedFrom` (127D lines 67-75) is a small typed artifact; freshness is derived from structured revisions, not ad-hoc flags.
- **Tenet 2 (Named authorities own boundaries) — PASS.** The Authorities table (lines 41-48) assigns Page source/snapshot to Tokyo-worker Page root and Instance revision to the existing Instance authority; §"Authorities" lines 50-51 explicitly bars Instance-Save hooks from mutating Pages and public requests from deriving freshness.
- **Tenet 3 (No fallbacks / silent substitution) — PASS.** §"Deriving freshness" lines 95-96 and the Failure table (lines 216-217) classify missing/cross-account/template/corrupt referenced Instances as explicit source failures, not Needs update or absence. This is the explicit-failure rule.
- **Tenet 4 (No silent healing) — PASS.** §"Concurrent changes" lines 168-174 rejects mixed revision sets and stores nothing; the Update flow (lines 127-142) only rebuilds from current truth and never mutates referenced Instances. No coercion.
- **Tenet 5 (Product commands stay boring) — PASS.** Update is one explicit user action through Roma→Tokyo (lines 128-139); no registry, discovery, or meta-framework is introduced.
- **Tenet 7 (Bob edits in browser memory) — PASS.** §"What changes an Instance revision" lines 105-106 states draft Bob edits do nothing to the effective revision; only successful Save or approved overlay write advances it.
- **Tenet 10 (Content source authority preserved) — PASS.** Page-owned overlay writes advance the Page source revision through the existing localization authority (lines 121-125); no second freshness flag or auto-generation job.
- **Tenet 11 (Public runtime serves stored artifacts) — PASS.** §"Authorities" lines 50-51 bars public requests from deriving or repairing freshness; Update success purges caches only after a real stored result (line 139).
- **Tenet 13 (Documentation is operator truth) — RISK (minor).** The §"Documentation after deployment" list (lines 224-231) omits several docs that 127C's behavior and 127D's own behavior both touch — see §5.
- **Tenet 14 (Tier-gated actions stay visible) — PASS.** Update validates `pages.max` access (line 132) through the normal product gate; no private lock state is added.
- **V1 (Silent substitution) — PASS.** No invented revision values; missing/corrupt = explicit failure.
- **V2 (Silent healing) — PASS.** Mixed/concurrent revisions are rejected, not normalized.
- **V3 (Silent omission) — PASS.** Every referenced Instance is checked; none can be silently dropped.
- **V4 (Fail-open control) — PASS.** The edit gate (lines 144-160) blocks editing/publishing on Needs update with no read-only escape.
- **V5 (Corruption-as-absence) — PASS.** Corrupt serve-state is reported, not treated as Current/missing (line 216).
- **V6 (Partial-success masquerade) — PASS.** Update failure leaves Needs update with retry (line 219); no success claim on partial work.
- **V7 (Masquerade/redress) — PASS.** No retry/renamed-path continuation of a failing update.
- **V8 (Runtime test dependency) — PASS.** Freshness derivation reads real saved revisions, not probes or validation rituals.

#### 3. Over-architecture / unnecessary complexity IN THE PRD

The PRD is lean and explicitly anti-overarchitecture. Verified it does **not** reintroduce any rejected machinery:

- No fingerprints: §"Revision contract" lines 60-61 ("Do not introduce separate HTML, CSS, JavaScript, overlay, or package fingerprint families") and Code work line 188 ("Delete package/file/overlay fingerprint families").
- No `save_failed` / Needs fixing: §"Customer result" lines 36-37 and Code work line 188.
- No dependency graph / evidence product: §"Goal" lines 14-16 and line 78.
- No Queue / poller / background job / auto-regeneration: §"Goal" lines 15-16, §"What changes an Instance revision" lines 112-113, Code work line 190, Verification lines 208-210.
- No Instance Save fan-out: §"Authorities" lines 50-51, Verification line 197 ("without writing those Pages").
- No new locale representation: uses existing overlays only.

One mild note (not a finding of overarchitecture): the Code work checklist item "Delete package/file/overlay fingerprint families, `save_failed`, Needs fixing, failure overrides, and related tests/UI" (line 188) is written as cleanup of *existing* machinery, but a codebase grep confirms none of `save_failed`, `Needs fixing`, or Page-package fingerprint families exist in the current runtime (`tokyo-worker`, `roma`). These are 127-program exclusions being re-stated as deletions. The item is harmless as a guardrail, but an executor could spend time searching for code to delete that does not exist. This is a precision issue, not overarchitecture.

#### 3b. Academic / theoretical abstractions and gold-plating IN THE PRD

No aspirational prose or forward-looking hooks found. The PRD is tightly scoped to the two-state comparison and the explicit Update operation. The "Definition of done" (lines 233-239) and "Verification" (lines 192-210) sections are concrete and bounded. The only mildly theoretical phrase is "one effective revision covering the accepted structured source, direct HTML/CSS/JavaScript, and exact overlays" (lines 55-57) — but this is immediately grounded by the instruction to reuse or add one minimal revision at the existing authority, so it does not float as an abstraction.

#### 4. Prose that leaves executors room to invent

- **127D line 58-59:** "Use the existing saved revision if one already owns this meaning; otherwise add one minimal revision at the existing Instance serve/source authority."
  - **Code reality:** A saved Instance has NO numeric revision today. `AccountInstanceConfigDocument` (`tokyo-worker/src/domains/account-instances/types.ts:14-25`) carries only `publicPackageFingerprint?: string` and `updatedAt: string`. `writeAccountInstanceSource` (`source.ts:228-258`) sets `updatedAt: now` and nothing else on save. The `/list-facts` route returns `updatedAt` (`internal-instance-routes.ts:142-151`), not a revision. So "the existing saved revision if one already owns this meaning" does **not** exist.
  - **Executor guess:** Because no numeric Instance revision exists, an executor must choose between (a) promoting `publicPackageFingerprint` (a package-bytes hash, which does NOT cover source/overlays and therefore does NOT "own this meaning"), (b) minting a new numeric `revision` on the Instance config doc, or (c) reusing `updatedAt` as a string revision. The PRD does not name which. The `savedInstanceRevision` type (line 73, `string`) hints at (c), but 127B and 127C both type it as `number` (see below), so even the type is ambiguous. This is the single largest guess surface in the PRD.

- **127D line 109-110:** "Translation Agent writing an approved Instance overlay must finish through the existing saved Instance/localization authority and advance the same effective saved revision used for Page freshness."
  - **Code reality:** The overlay write path today (`roma/lib/account-instance-translations.ts` `writeAccountInstanceTranslationValues`, and Tokyo's `updateContentDocumentByLocation` in `source.ts:171-188`) writes the overlay value file and advances nothing else. There is no revision bump on overlay write.
  - **Executor guess:** Whether the "existing localization authority" that must advance the revision is Tokyo-worker (which stores overlays) or Roma (which proxies and validates) is unstated; the executor must decide which boundary owns the revision increment on overlay write.

- **127D line 73 vs 127B line 466 vs 127C line 75:** `savedInstanceRevision: string` (127D) vs `savedInstanceRevision: number` (127B/127C).
  - **Executor guess:** Which PRD's type wins when 127B/127C/127D are implemented against a shared `PageGeneratedFrom`. An executor will pick one and silently break the other slice's contract.

- **127D line 139:** "success returns Current and purges affected Page locale caches if published."
  - **Executor guess:** Whether "purges affected Page locale caches" reuses the existing `purgeAccountPagePublicCache` path (present in `tokyo-worker/src/routes/internal-page-routes.ts:164` and `domains/pages`) or introduces a new purge trigger is unstated. Likely the former, but the phrase "if published" leaves the purge-condition (published at start of Update? published at end? both?) open.

- **127D line 96:** "Missing, cross-account, template, or corrupt referenced Instances are explicit source failures, not Needs update and not absence."
  - **Executor guess:** "template" referenced Instance is named as a failure, but 127A/127F establish that templates are a separate `isTemplate` source family; an executor must decide whether a placement referencing a template Page-source is rejected at validation (127A) or surfaces here as a freshness failure. The PRD does not say which layer owns that rejection.

#### 5. Needed documentation / updates (DEV perspective)

**Docs the PRD explicitly lists — assessment**

- **`documentation/architecture/CONTEXT.md`** — PRD line 226. **Needs change.** Current truth: "Page publish and public serving are currently disabled because Roma does not currently write page packages" (CONTEXT.md:305-307) and the Product Flows §Clickeen Pages bullet (lines 298-307). After 127D, publish is gated on Current (not merely unavailable), and the edit gate exists. Exact sentence at CONTEXT.md:306 becomes false and must state that Pages derive Current/Needs update from a minimal revision snapshot and that Publish is unavailable while Needs update.
- **`documentation/architecture/Overview.md`** — PRD line 226. **Needs change.** Overview.md:240-243 and the Account Pages flow (lines 232-243) become false once 127C+127D ship; must describe the revision-snapshot freshness model and the explicit Update operation.
- **`documentation/services/roma.md`** — PRD line 228. **Needs change.** The Pages Domain section (roma.md:441-466) currently says page publish is disabled, source does not store child artifact references, and shifts "page package materialization" to a future PRD. After 127D it must state: Roma derives Current/Needs update by batching referenced Instance revisions against `serve-state.generatedFrom`; Roma owns the explicit Update route and the edit/publish gate; the `saveRequiresUnpublish` guard behavior is superseded by the 127C Save/Update + 127D freshness model.
- **`documentation/services/bob.md`** — PRD line 228. **Needs change.** bob.md's Instance-save truth ("Bob treats the save response as source/root persistence truth only") must confirm that an Instance Save does NOT fan out to Pages — which 127D makes an explicit invariant. Minor but real.
- **`documentation/services/tokyo-worker.md`** — PRD line 228. **Needs change.** The Account Widget Instances section (lines 104-156) describes Instance storage with `publicPackageFingerprint` and `updatedAt` only. After 127D this doc must state: each saved Instance carries one effective numeric revision advancing on Save and approved overlay write; Page `serve-state.json` stores `generatedFrom`. The current "Current account page publish is unavailable until Roma writes page packages" sentence (line 175-177) becomes false.
- **`documentation/engineering/UI/interactions.md`** — PRD line 229 (conditional). **Verify ownership.** The file exists. The PRD hedges "if that document owns the interaction." The edit-gate modal copy and the Update-failure retry message are interaction-feedback strings; if `interactions.md` owns modal/retry copy it must be updated, otherwise this belongs in the 127E/Page-Builder surface doc.

**Docs the PRD MISSES**

- **`documentation/architecture/Tenets.md`** — Missing. Mama 127 §14 explicitly lists `Tenets.md`; 127C's own doc list includes it. 127D introduces a new product invariant (Needs update blocks edit/publish; no auto-regeneration) that is tenet-shaped.
- **`documentation/architecture/AccountManagement.md`** — Missing. Listed by Mama 127 §14 and 127C.
- **`documentation/architecture/OverlayArchitecture.md`** — Missing. Listed by Mama 127 §14 and 127C. 127D §"Page-owned changes" makes approved Page metadata-overlay writes advance the Page source revision and drive Needs update; this is a non-trivial change to how overlay writes interact with Page lifecycle.
- **`documentation/architecture/RuntimeProfiles.md`** — Missing. Listed by Mama 127 §14 and 127C.
- **`documentation/capabilities/localization.md`** — Missing. Listed by Mama 127 §14 and 127C. 127D's rule that approved Page-overlay writes advance the Page revision and force Needs update is a localization-product behavior.
- **ck-contracts shared type doc** — Missing. The shared `PageGeneratedFrom` type currently exists in NO `packages/ck-contracts` file (confirmed by grep), yet 127B/127C/127D all reference it as a shared contract.
- **`documentation/ai/agents/translation-agent.md`** — Missing. 127D imposes a new requirement on the Translation Agent write path (must finish through the authority that advances the revision).

**Docs the PRD lists that likely DON'T need changing**

- **"Page capability/current product documentation at its accepted existing home"** (127D line 231) — This bullet is too vague to be actionable; it defers to an unnamed "existing home." An executor will guess which file this means.

**Verdict:** Architecturally clean, lean, and tenet-compliant; ship-ready once the Instance-revision ownership (§4, line 58-59), the `savedInstanceRevision` string/number mismatch vs 127B/127C, and the missing Tenets/AccountManagement/OverlayArchitecture/capabilities/contracts doc entries (§5) are resolved.

---

## 2. Senior Product Manager Peer Review

### 127D — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

The two-state model is clean and the scope discipline is strong: freshness is derived at read time, no Instance-save hook, no fan-out, no graph, no queue, no background regeneration. This is the right minimal design and it scales by composition (more Pages/Instances add reads, not cascade machinery).

Two execution-readiness observations that affect robustness of the freshness signal, not the design:

- **`generatedFrom` must survive publish/unpublish serve-state rewrites.** The current Tokyo `serveStatePayload()` (`tokyo-worker/src/domains/pages/serve-state.ts:21`) reconstructs the serve-state object from scratch on every `writeAccountPageServeState` call, and `internal-page-routes.ts:165` invokes it on publish/unpublish. If 127D adds `serve-state.json.generatedFrom` but that write path is not changed to preserve it, a publish or unpublish after a Save will silently wipe the consumed-revision snapshot, and the Page will mis-derive freshness on the next list/open. The code-work checklist covers *storing* the snapshot but should explicitly call out that publish/unpublish transitions must not clobber it.

- **List/open batching is a real contract, not a nicety.** The PRD's "Do not perform one remote request per table cell or placement" is load-bearing. Today `loadAccountWidgetInstanceFacts` (`roma/lib/account-instance-direct.ts:653`) fetches each Instance list-fact in its own Tokyo call (concurrency 8). "Batch" in 127D therefore means concurrent fan-out today, not a single batched endpoint. The verification item should be read as "bounded concurrency over the already-required account Instance reads," and executors should confirm the list route reuses one shared Instance-facts fetch rather than re-issuing it per Page.

#### 2. Compliance with Product UX best practices

The hard edit gate, the human-only Update invocation, the explicit concurrency recheck, and the fail-visible treatment of corrupt/missing/cross-account/template referenced Instances are all consistent with the accepted dialog/interaction law and the V1–V8 core violations. The "no merge, no silent refresh, no mixed revision set" rule is exactly right.

One accuracy tension to reconcile before execution:

- **"Current and Needs update API/UI values only" vs. "explicit source failures, not Needs update and not absence."** The open-page case is handled (the failure table makes invalid source an explicit failure). But the *list* case is not fully reconciled: when `Your pages` renders a row for a Page whose referenced Instance is missing/corrupt/cross-account/template, the freshness API is restricted to two values, yet that row must not render as Current or Needs update. The PRD should state plainly how that row surfaces — e.g., the list route returns the row with an explicit invalid-source error rather than a freshness value — so executors do not collapse corrupt Pages into one of the two states.

#### 3. Bad UX writing for the user (if present)

The edit-gate modal body copy diverges between the two governing PRDs for the same user-facing modal:

- Mama §8: "A widget or page translation has changed. Update the page to continue."
- 127D edit gate: "A widget or translated Page information has changed. Update the page to edit it."

These are two different approved strings for one modal. One must be chosen and the other retired before execution, or the shipped copy will depend on which PRD the executor reads. The action label "Update page" and the retry string "We couldn't update this page. Try again." are consistent with 127E and are fine.

#### 4. Alignment with "Clickeen is different from legacy SaaS" (product perspective)

Strongly aligned. Legacy SaaS would build an Instance-save webhook, a dependency graph, a regeneration queue, and a persistent "Needs fixing" job state. 127D forbids every one of these explicitly and replaces them with read-time derivation over saved truth. "No Instance Save hook mutates Pages" is the central anti-legacy move: the Page never reacts to dependency changes; it is compared on demand and rebuilt only by an explicit human action. Fail-visible handling of corrupt serve state and the refusal to merge or silently refresh mixed revisions directly satisfy the source-truth-fidelity and fail-visible tenets. No ceremonial phasing labels, compatibility wrappers, or registries are introduced.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

127D's "Documentation after deployment" list is missing or under-specified in three places:

- **`documentation/architecture/OverlayArchitecture.md` is not listed.** 127D's revision contract makes an approved Page metadata-overlay write advance the Page source revision and derive Needs update — the first time a *Page* overlay drives a freshness/revision signal. OverlayArchitecture.md is currently Instance-overlay-centric. The overlay architecture doc must record it.

- **"Page capability/current product documentation at its accepted existing home" is vague.** `CONTEXT.md`'s detail-doc table does not list a Pages capability doc, and `multitenancy.md` currently carries the Pages tier/planned-127 notes. Name the concrete file or confirm `multitenancy.md` is that home before execution.

- **`interactions.md` ownership of the update modal is conditional.** Confirm that `documentation/engineering/UI/interactions.md` is the actual owner of the gate/modal pattern before treating the update as optional. The file exists; the ownership should be resolved rather than left conditional.

**Verdict:** Accurate and execution-ready on the settled two-state design; reconcile the divergent modal copy, the two-values-vs-explicit-source-failure list path, and the serve-state preservation across publish/unpublish before acceptance.

---

## 3. Principal TPM Peer Review

### 127D — Principal TPM Peer Review (GLM)

#### 1. Cohesive and cost-effective architecture

127D is cohesive within its settled scope and is the leanest possible design that answers the freshness question. The two-state model, the single consumed-revision snapshot, the explicit Update operation, the concurrent-revision recheck, and the hard edit gate form one closed loop with no orphan machinery. The architecture is cost-effective: freshness is *derived* at list/open time from revisions Tokyo already stores, not maintained by a poller, Queue, or fan-out. That matches Mama §8 and Tenet 5.

Two cohesion gaps must be closed before execution, both rooted in code-grounding reality:

- **The "existing saved revision" the PRD tells the executor to reuse does not exist.** `tokyo-worker/src/domains/account-instances/source.ts` writes only `updatedAt` (ISO timestamp, `source.ts:257`) — there is no numeric/string revision field. `AccountInstanceConfigDocument` (`types.ts:14-25`) carries `updatedAt` and optional `publicPackageFingerprint`, nothing else. `ck-contracts/src/` has zero `revision`/`Revision` exports. So the executor is forced into the "otherwise add one" branch — but the PRD presents that as the fallback, not the primary path. §Revision contract and the Code work checklist should state plainly that **127D adds one minimal Instance revision** because none exists, and name where (`AccountInstanceConfigDocument` is the natural home).

- **The overlay-write "advances the same effective revision" claim is unsatisfied by the current write path and must be made a hard Code-work item.** `tokyo-worker/src/domains/account-translations/values.ts:123` calls `writeLocaleOverlay`, which only `putJson`s `overlays/locales/{locale}.json` (`overlays.ts:77-98`); it never writes `instance.config.json`, so it advances no timestamp and no revision. The Code work checklist has an item for Page-owned overlay writes but **no matching item for Instance overlay writes**. Without it, a translated Instance overlay would silently NOT flip referencing Pages to Needs update — a V3 (silent omission). Add the Instance-overlay-write Code-work item explicitly.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

127D does **not** invent subsystems. It correctly routes every responsibility through the existing named authorities. No new Worker, Queue, poller, dependency index, cache registry, or background job is introduced.

Three clarity defects for the executor:

- **`savedInstanceRevision` type disagrees with the upstream contract PRDs.** 127D declares `string`; 127B and 127C both declare `number`. One-token fix, but must be fixed or 127C's serving equality check and 127D's derivation will disagree at the type level.

- **`PageGeneratedFrom` does not exist in `packages/ck-contracts/src/`.** Confirmed by grep. 127D should state the dependency ("127B adds `PageGeneratedFrom` to `@clickeen/ck-contracts`; 127D consumes it unchanged").

- **The "batched freshness derivation" requirement names Roma list/open routes that do not yet exist for Pages.** The existing batched helper is `loadAccountWidgetInstanceFacts` (`roma/lib/account-instance-direct.ts:653-707`), but it batches all account instances via per-instance `list-facts` calls (concurrency 8), not a targeted set. For a Page with N placements, Roma today would need N `list-facts` calls or a full account scan. The PRD should name whether the executor adds a targeted batched route or reuses the full scan result.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

Descriptive comparison, not authoritative.

The two-state, derived-freshness model is the right industry pattern for a static-site/composition product and is materially better than what most competitors ship:

- **No background rebuild cascade.** Competitors that auto-rebuild on dependency change either surprise the customer with unreviewed published changes, or build a fragile job graph that stalls. 127D's "Needs update blocks edit/publish; explicit Update regenerates" is the same posture Figma takes with component updates and Vercel/Next take with ISR `revalidate` — the customer owns the publish moment.
- **No `save_failed` purgatory.** Many builders persist a "broken" state and force the customer into a repair flow. 127D treats Save/Update failure as an ordinary operation error and leaves the last good state intact.
- **Revision snapshot, not content fingerprinting.** Storing `pageRevision + per-placement savedInstanceRevision` is cheaper and more debuggable than evidence-product/hash-family approaches.

#### 4. Absence of V1–V8 violations

- **V1 (Silent substitution): PASS.** Explicit rejection of substitution; corrupt/missing = failure.
- **V2 (Silent healing): PASS.** No normalization or coercion of stored state.
- **V3 (Silent omission): RISK — one missing Code-work item.** The Instance-overlay-write path does not advance any revision today, and 127D's Code-work checklist omits the Instance side. If execution follows the checklist literally, approved Instance overlay translations would not flip referencing Pages to Needs update — a silent omission. Fix: add the Instance-overlay-write Code-work item.
- **V4 (Fail-open control): PASS.** Edit gate and publish gate fail closed while Needs update.
- **V5 (Corruption-as-absence): PASS.** Corrupt serve state reported as corruption.
- **V6 (Partial-success masquerade): PASS.** Update failure leaves Needs update with retry.
- **V7 (Masquerade/redress): PASS.** No retry/rename/path workaround.
- **V8 (Runtime test dependency): PASS.** No product work depends on tests/probes.

Net: **V3 has one addressable gap** (Instance-overlay Code-work item); all others PASS at the PRD level.

#### 5. Needed documentation / updates (TPM perspective)

127D §Documentation after deployment lists the right homes but misses several specific updates:

- **`packages/ck-contracts` README/changelog must record `PageGeneratedFrom`.** Currently absent.
- **`tokyo-worker.md` "Account Widget Instances" section must be updated** to document the new Instance revision field on `instance.config.json`, and to state that approved overlay writes advance it. Today that section says config carries "package fingerprint when present, and timestamps."
- **`tokyo-worker.md` internal route table and `/__internal/instances/{instanceId}/list-facts` description must reflect the new revision field.** Today `list-facts` returns "updated timestamp, and publish status"; it will also need to return the revision.
- **`roma.md` "Pages Domain" section.** Today it says source "does not currently store child widget artifact references" and defers to "a future Page Package PRD." 127D's `generatedFrom.placements[].savedInstanceRevision` is exactly such a child-reference shift.
- **Missing: `documentation/architecture/Tenets.md`.** Mama §14 explicitly names it. 127D changes Instance source truth and Page source truth — both are Tenet 1 territory.
- **Missing: Translation Agent doc** (`documentation/ai/agents/translation-agent.md`). 127D imposes a new requirement on the Translation Agent write path.

**Verdict:** APPROVE WITH REQUIRED FIXES — add the missing Instance-overlay-write Code-work item (closes the only V3 gap), fix the `savedInstanceRevision: string → number` type disagreement with 127B/127C, restate the "existing revision" preamble as "127D adds one" since code proves none exists, name `PageGeneratedFrom` as a 127B ck-contracts dependency, and resolve the batched-derivation route question; scope and architecture are sound and invent no subsystems.

---

## 4. Consolidated Verdict & Convergence

All three seats: **APPROVE WITH CHANGES**. No BLOCK. The PRD is the leanest possible design for the freshness question — it correctly refuses every piece of rejected machinery (no fingerprints, no evidence product, no `save_failed`, no graph, no Queue, no fan-out, no auto-regeneration). The findings are accuracy gaps, cross-slice contract mismatches, and one missing Code-work item — not redesign.

### Convergent blockers-to-resolve (all three or majority flagged)

1. **The "existing saved Instance revision" does not exist in code.** (Staff §4; PM §1; TPM §1)
   All three seats verified: `AccountInstanceConfigDocument` carries only `updatedAt` (ISO timestamp) and optional `publicPackageFingerprint`. No numeric revision. `list-facts` returns a timestamp, not a revision. The PRD's instruction "use the existing saved revision if one already owns this meaning" is the fallback, not the primary path — the executor is forced into "otherwise add one minimal revision." **Must restate as: "127D adds one minimal Instance revision because none exists today."**

2. **`savedInstanceRevision` type disagreement across slices.** (Staff §4; TPM §2)
   127D types it `string`; 127B and 127C both type it `number`. An executor will pick one and silently break the other slice's contract. **One-token fix: change 127D to `number`.**

3. **The Instance-overlay-write path does not advance any revision today, and the Code-work checklist omits the Instance side.** (Staff §4; TPM §1, §4)
   `writeLocaleOverlay` only writes `overlays/locales/{locale}.json`; it never touches `instance.config.json`. Without a Code-work item to make approved Instance overlay writes advance the revision, a translated Instance overlay would silently NOT flip referencing Pages to Needs update — a **V3 (silent omission)**. **Must add the Instance-overlay-write Code-work item.**

4. **`PageGeneratedFrom` does not exist in `@clickeen/ck-contracts`.** (Staff §5; TPM §2)
   Grep returns zero matches. 127D uses it as if shared. **Restate as a 127B ck-contracts dependency.**

5. **`generatedFrom` must survive publish/unpublish serve-state rewrites.** (PM §1)
   Current `serveStatePayload()` rebuilds serve-state from scratch on every publish/unpublish. If not changed to preserve `generatedFrom`, a publish after a Save silently wipes the revision snapshot. **Must add a Code-work item: publish/unpublish transitions must not clobber `generatedFrom`.**

### Executor-invention gaps

- Which boundary (Tokyo or Roma) owns the revision increment on Instance overlay write. (Staff §4)
- The purge condition "if published" — published at start of Update, at end, or both? (Staff §4)
- Which layer rejects a placement referencing a template Instance — 127A validation or 127D freshness failure? (Staff §4)
- Whether the batched derivation adds a targeted route or reuses the full account scan. (TPM §2)
- How a corrupt/missing-referenced-Instance Page row surfaces in the list (two API values only, but the row must not be Current or Needs update). (PM §2)

### V1–V8 audit convergence

**V1, V2, V4, V5, V6, V7, V8 PASS.** One gap: **V3 (silent omission)** — the Instance-overlay-write Code-work item is missing, which means approved Instance overlay translations would not flip referencing Pages to Needs update. Fix: add the Code-work item. This is the single V-audit finding across all three seats.

### Documentation coverage

**Docs 127D omits but must touch:**
- `Tenets.md` (Mama §14 lists it; 127C lists it; 127D drops it)
- `AccountManagement.md` (Mama §14 and 127C list it)
- `OverlayArchitecture.md` (Page-overlay-driven revision semantics are new)
- `RuntimeProfiles.md` (Mama §14 and 127C list it)
- `capabilities/localization.md` (Page-overlay revision advance is a localization behavior)
- `packages/ck-contracts` (`PageGeneratedFrom` must be added and documented)
- `documentation/ai/agents/translation-agent.md` (Translation Agent write path now must advance Instance revision)
- `tokyo-worker.md` must document the new Instance revision field AND that `list-facts` returns it

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** 127D is the leanest possible freshness design — two states, one revision comparison, no rejected machinery. Execution should not begin until the five convergent blockers are resolved: restate the "existing revision" as "127D adds one" (verified: none exists); fix the `string`→`number` type mismatch; add the Instance-overlay-write Code-work item (closes V3); restate `PageGeneratedFrom` as a 127B dependency; and add the serve-state-preservation Code-work item for publish/unpublish. The doc list needs the same expansion 127C needed (Tenets, AccountManagement, OverlayArchitecture, etc.).
