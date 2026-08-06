# 127A — Peer Review Appendix (GLM)

> **Historical review — not execution authority.** This review predates the
> product-owner decisions now incorporated into 127A. Recommendations for a
> Page-source migration, locale-lock lifecycle, special Tier99 machinery, or
> templates preserving overlays are superseded. Execute the Mama and rewritten
> 127A/127F contracts.

Status: **PEER REVIEW — CONSOLIDATED APPENDIX**

Subject: `127A__PRD__Page_Source_And_Policy.md` (Page Source and Policy), the first execution slice of PRD 127.

Date: 2026-08-04

Model: builtin:zai-coding-plan/GLM-5.2

This appendix consolidates three independent peer reviews of 127A, each written
by a subagent operating from a single seat (Staff Engineer, Senior PM, Principal
TPM) and grounded in the deployed codebase, the named tenets, and the V1–V8
core-violation audit. Each review was instructed to break down code vectors,
blast radiuses, and product/architecture implications and to expose findings
concretely rather than to rubber-stamp.

Note on scope: these reviews were written against the **current** 127A, which
now includes the `isTemplate` designation, product rules 10–11 (draft-vs-save),
and references the 127F Catalog slice. Reviewers read the live PRD file, not a
snapshot. The three reviews are reproduced verbatim in their authored order,
followed by a convergence note.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127A — Staff Engineer Peer Review (GLM)

#### 1. Elegant engineering and scalability

**Earned elegance.**

- **Placement-as-reference, not copy.** `AccountPagePlacement = { placementId; instanceId }` (127A §Page source contract) and the existing `roma/lib/account-page-source.ts:46-48` already enforce this. This is the single most important Pages decision and it is correct: a Page is a thin reference layer over Instances, so Instance save/overlay/publish lifecycles stay untouched (Mama tenet 2, Tenet 8). An AI executor cannot accidentally invent a "copy widget source into the page" path because the contract forbids it and the existing `pageIdsPlacingInstance` helper (`roma/lib/account-page-source.ts:142-151`) already traverses placements by reference.

- **`pages.max` enforcement at first Save, not at draft open.** 127A §`pages.max` and §Product rule 10 pin the gate to "the first successful Save." This matches the existing `widgets.instances.max` pattern documented in `documentation/services/roma.md:368-374` and the registry note (`packages/ck-policy/src/registry.ts:127-130`): "Roma create and duplicate enforce this before minting a new instance id." Putting `pages.max` at the same point (pre-ID-mint, in the create route) is consistent and scales: list/open/edit/delete/publish never re-consume the entitlement.

- **`baseLocale` inheritance from account at create time.** Product rule 3 + the create rule "baseLocale must equal the current account baseLocale when the Page is created" reuses the existing `loadCurrentAccountLocalesState` → `localePolicy.baseLocale` path already in `roma/app/api/account/pages/route.ts:129-163`. No second locale registry (Mama tenet "PRD 127 adds no second locale registry"). This is the right call and avoids the V1 (silent substitution) trap of guessing a Page locale.

- **Tier99 as "not a superuser."** §Tier99 ("It does not create a superuser. Account and member authorization remain exactly the same") is architecturally sound: it keeps `MemberRole` and authz unchanged and uses the existing `PolicyProfile` axis only to differentiate entitlements + AI runtime. This is cleaner than an `isInternal` flag threaded through authz, because the policy matrix is already the entitlement source of truth.

**Where the design does NOT scale / creates friction.**

- **The Page source contract is a hard rewrite, not an extension.** The proposed `AccountPageSource` (127A §Page source contract) shares only `pageId`, `accountPublicId`, `displayName`, `placements`, `revision`, `createdAt`, `updatedAt` with the *current* type at `roma/lib/account-page-direct.ts:49-59`. It drops `metadata` (→ `values`), drops the entire `localization` object (`defaultLocale`, `ipLocalizationEnabled`, `countryLocaleRules`, `languageSwitcherEnabled`, `missingLocaleBehavior`), adds `baseLocale`, `locales`, `overlays`, `robots`, `isTemplate`. This is not additive; every consumer of the current shape breaks. The PRD frames this as "replace the old Page normalization" (§Code work 2, 8) but underestimates the friction: as Pages grow (compiler in 127B, currency in 127D, Builder in 127E), every field added to `PageOwnedValues` must be mirrored in `overlays[locale].values` (127A: "each overlay supplies the complete Page-owned value set"). That is a high-surface-area invariant — any new Page-owned field becomes N locale copies. The contract will scale, but the overlay-completeness validator will become a maintenance choke point.

- **The typed contract is not actually shared today, and the PRD does not name where it lands.** Tokyo-worker's `domains/pages/source.ts` currently stores `unknown` and performs **no** source-shape validation (see `createAccountPageSource`/`saveAccountPageSource` at `tokyo-worker/src/domains/pages/source.ts:96-144` — they only validate `accountId`/`pageId` formats). All normalization lives in Roma (`roma/lib/account-page-source.ts`). The PRD's §Code work 1 ("Put the Page source contract in one shared code authority and use it from Roma and Tokyo-worker") is aspirational: today there is no shared Page type in `packages/ck-contracts/` (confirmed: `find packages/ck-contracts -iname '*page*'` returns nothing). See §4 for the "which package" gap.

#### 2. Compliance with architecture and tenets

**Strongly compliant.**

- **Tenet 2 (named authorities):** 127A §Authority and coordinates assigns every operation to a named owner (Berlin bootstrap for tier/baseLocale, Roma for page commands/validation, Tokyo-worker for source storage, `@clickeen/ck-policy` for entitlements, Michael/Supabase for the tier row). This matches `Tenets.md:74-88` and the existing `documentation/services/roma.md:423-435`.

- **Tenet 8 (storage follows ownership):** Page source stays at `accounts/{accountPublicId}/pages/{pageId}/source.json` (127A §Authority; `tokyo-worker/src/domains/pages/source.ts:62`). No new root. Compliant.

- **Tenet 10 (content source authority):** Page-owned values and overlays are human/AI-generated content authored by the customer; 127A treats them as source-of-truth edited only through Save. Compliant.

- **V1 (silent substitution) / V2 (silent healing):** 127A §Page overlays ("missing or malformed overlay → fail"), §Failure behavior ("Stored source is corrupt → Report corruption; do not treat it as a blank Page"), and §Current-source migration ("Do not translate, infer a locale, invent social copy, discard an unexplained stored value") are directly anti-V1/V2. Good.

**Tenet risks.**

- **Tenet 1 (structured typed artifacts) — PARTIAL GAP.** The contract is typed, but the PRD leaves the locale regex unspecified. The current code uses `/^[a-z]{2}(?:-[a-z0-9]{2,8})?$/` (`roma/lib/account-page-source.ts:18`). The PRD says "every locale must be allowed by the current account locale policy" but does not reference this validator. An executor will either reuse the existing regex (correct) or invent a new one (Tenet 1 erosion). This is a small but real gap.

- **Tenet 3 (no silent substitution) — RISK in migration.** §Current-source migration step "initialize Page-owned social values as empty strings only where the old source had no such field" is a deterministic default *only if* the new contract defines empty-string as the legal starting value. But the current validator requires `isExactNonEmptyString(metadata.title)` (`roma/lib/account-page-source.ts:68`). The PRD's `PageOwnedValues.title: string` does not say whether empty is allowed. If the new validator rejects empty titles, the migration's "empty strings" rule produces sources that fail validation on read-back — a V2 (silent healing) hazard where the migration writes something the validator later rejects. The PRD must state the exact post-migration validation outcome for `title`.

- **Tenet 4 (no silent healing) — RISK.** The migration's "read the source back through the same route and compare it with the intended result" is good, but the PRD does not specify what happens to the existing `metadata.canonicalUrl`, `localization.countryLocaleRules`, `ipLocalizationEnabled`, and `languageSwitcherEnabled` fields. Step 3 says "prove whether any current Page contains a non-empty custom canonical URL, country-locale rule, or language-switcher setting" and "stop for product-owner review if any value has no exact destination." But the default path *drops* those fields silently for pages that have only default values. Dropping `ipLocalizationEnabled: false` is fine; but the PRD does not define the threshold. An executor must be told: "fields with default values are dropped; fields with non-default values block migration." As written, "no exact destination" is undefined for `countryLocaleRules: []` (empty array — is that "a country-locale rule"?).

- **V5 (corruption-as-absence):** 127A §Failure behavior handles this correctly for stored source ("Report corruption; do not treat it as a blank Page"). But the existing Tokyo `loadStoredPageSource` (`tokyo-worker/src/domains/pages/source.ts:34-45`) already returns `failSourceInvalid` on JSON parse failure — so the corruption boundary exists. The risk is the *new Roma validator*: if it returns `null` for a structurally-valid-but-old-shape source, that is V5. The PRD must require the migration to run *before* the new validator becomes the only reader, or require the validator to distinguish "old shape" from "corrupt."

#### 3. Over-architecture / unnecessary complexity

**Tier99 is the right mechanism, but the PRD under-specifies its real blast radius and the "copies Tier 4" rule is a landmine.**

127A §Tier99 says "Tier99 copies the accepted Tier 4 product configuration except..." This is clean *conceptually*, but the implementation surface is large and the PRD's "Implementation must add `tier99` to every closed profile consumer" list (§Tier99) is incomplete against the actual code. Grounded blast radius:

1. `packages/ck-policy/src/types.ts:1` — `AccountTier` union. Must add `'tier99'`.
2. `packages/ck-policy/src/matrix.ts:6` — `REQUIRED_TIERS = ['free','tier1','tier2','tier3','tier4']`. Must add `'tier99'`. This is the load-bearing constant: `assertEntitlementsMatrix` throws on unknown tiers (`matrix.ts:16-17`) and on missing required tiers (`matrix.ts:48-52`).
3. `packages/ck-policy/entitlements.matrix.json` — `tiers` array (line 2-8) AND every entitlement's `values` object must add a `tier99` key. The validator at `matrix.ts:82-95` iterates `REQUIRED_TIERS` and throws `must be number or null` / `must be boolean` if a value is missing. **Adding `tier99` to `REQUIRED_TIERS` without adding `tier99` to all 13 entitlements throws at module load.**
4. `packages/ck-policy/ai-runtime.matrix.json` — **every agent** (`product.copilot`, `widget.instance.translator`) needs a `tier99` block. The AI runtime validator (`packages/ck-policy/src/ai-runtime.ts:119`) iterates `getEntitlementsMatrix().tiers` and throws `AI runtime matrix missing ${agentId}/${tier}` if absent. This is a hard runtime coupling the PRD does not name explicitly. The PRD's "entitlement and AI runtime matrices" (§Tier99) gestures at it, but an executor could add tier99 to the entitlements matrix and miss one AI agent block, breaking `AI_RUNTIME_MATRIX = assertAiRuntimeMatrix(...)` at `ai-runtime.ts:149` on import.
5. `packages/ck-policy/src/authz-capsule.ts:101-112` — `normalizePolicyProfile` switch. Must add `case 'tier99'`. **Without this, a Tier99 account's authz capsule fails verification** (`normalizeAccountPayload` returns `null` → `payload_invalid`). This is the highest-severity miss: it would lock the CLICKEEN account out of Roma entirely.
6. `packages/ck-contracts/src/ai.ts:2` — `AiPolicyProfile = 'free'|'tier1'|'tier2'|'tier3'|'tier4'`. Must add `'tier99'`.
7. `packages/ck-contracts/src/ai-model-management.ts:38` — `AI_POLICY_PROFILES` array, plus the tier4 default-profile block at line 76 (`policyProfile: 'tier4'`). The PRD does not say whether Tier99 gets its own managed-model default profile entry; an executor will guess.
8. `berlin/src/bootstrap/state.ts:80-86` — `normalizeTier` switch. Must add `case 'tier99'`, else bootstrap logs `accounts.{id}.tier_invalid` and fails.
9. `roma/components/use-roma-me.ts:69,103-110` — `RomaAuthzPolicy['profile']` union and `normalizeProfile`. Must add `tier99`.
10. `roma/lib/format.ts:29-44` — `formatAccountTierLabel`. Must add `case 'tier99'` or it returns "Invalid plan" for the CLICKEEN account.
11. `packages/ck-policy/tests/run-entitlements-matrix-invariants.ts:9` — `const tiers = [...'tier4']` hardcoded. Must add `'tier99'`.
12. `supabase/migrations/*.sql` — the `account_tier` enum (`20260522090000__prd103_db_core_foundation.sql:251`) and the `accounts_tier_allowed` CHECK constraint (`20260602120000__account_tier4.sql:23`, also `20260522090000__prd103_db_core_foundation.sql:47`). The CHECK constraint must be dropped/recreated to include `'tier99'`, and `ALTER TYPE account_tier ADD VALUE IF NOT EXISTS 'tier99'`.

The PRD lists "policy types and matrix validation; entitlement and AI runtime matrices; authorization capsules and Berlin bootstrap normalization; shared AI profile contracts; Roma account-context normalization and plan labels; account-management and tier-change validation; tests...; current documentation." That list is *directionally* complete but does not name the **module-load-time coupling** between `REQUIRED_TIERS` and the AI runtime matrix. An executor reading "copies Tier 4" could add `tier99` to `AccountTier`, the entitlements matrix, and the enum, then watch `ck-policy` fail to import because `ai-runtime.matrix.json` has no `tier99` block. The PRD should state: *"Adding `tier99` to `REQUIRED_TIERS` is a breaking change to `assertAiRuntimeMatrix`; every agent in `ai-runtime.matrix.json` must gain a `tier99` block in the same change."*

**`pages.max` gate placement is correct.** Enforcing at the create/first-save route (`roma/app/api/account/pages/route.ts` POST) matches `widgets.instances.max` exactly. No over-architecture here.

**Tier99 vs. `isInternal` flag.** Tier99 is the right choice. An `isInternal` boolean would thread a second axis through authz, policy, and every entitlement consumer, duplicating the `PolicyProfile` mechanism that already exists. The PRD's decision is defensible.

**Migration scaffolding is appropriately scoped** — the conditional `CLICKEEN`-only Tier99 migration and the separate source migration are the right separation. No over-architecture.

#### 3b. Academic / theoretical abstractions and pre-work, meta-work, gold-plating

- **The `PageOwnedValues` overlay-completeness invariant is necessary foundation, not gold-plating.** Requiring every non-base locale overlay to supply the complete value set (127A §Page source contract rules) is the only way to avoid V1 (silent substitution) at compile/serve time. This is load-bearing for 127B/127C.

- **The `revision` field is necessary** — it is the optimistic-concurrency and currency-evidence primitive 127D depends on. Not gold-plating.

- **`isTemplate` in 127A is pre-work that is not used in 127A.** 127A §Product rules and §Definition of done do not exercise templates; that is 127F's scope. Adding `isTemplate: boolean` to the source contract now is reasonable forward-compatibility *only if* it is a single boolean with a `false` default. The PRD keeps it minimal ("the minimal `isTemplate` designation"), which is fine. But an executor could read §Code work 5 ("Extend Page list/open responses with the source information later Roma screens require") as license to start surfacing template badges/list-splitting in 127A. The PRD should explicitly say: *"`isTemplate` is stored and validated in 127A; no Roma list/open UI filtering or badge logic is built in 127A."* As written, that boundary is soft.

- **`socialImageAssetRef?: string` (optional) is mild gold-plating for 127A.** 127A does not compile or serve; no social preview is rendered until 127B/127C. Including the field is harmless, but an executor might invent asset-reference validation/resolution logic in 127A that belongs in 127B. The PRD should note this field is stored unvalidated-beyond-format in 127A.

- **No academic meta-work detected** (no registries, no compatibility layers, no phasing labels). The PRD is lean.

#### 4. Prose / best-time stories useless or harmful for devs

This is the section that determines whether an AI executor will improvise. 127A has several load-bearing ambiguities.

**(a) "Put the Page source contract in one shared code authority" (§Code work 1) — WHICH PACKAGE?**

This is the single most executor-ambiguous sentence in the PRD. Today there is no Page type in `packages/ck-contracts/` (confirmed empty). The current type lives in `roma/lib/account-page-direct.ts:49-59` and Tokyo stores `unknown`. An executor must choose between:
- `packages/ck-contracts/src/account-page.ts` (new file) — most consistent with how `overlay-identity.ts`, `ai.ts` live in ck-contracts;
- `packages/ck-policy/src/...` — wrong, policy is for entitlements;
- keeping it in Roma and importing into Tokyo — violates "shared."

The PRD must name the file: e.g., *"Add `packages/ck-contracts/src/account-page.ts` exporting `AccountPageSource`, `PageOwnedValues`, `PagePlacement`, `PageRobots`; re-export from `packages/ck-contracts/src/index.ts`; Roma and Tokyo-worker import from `@clickeen/ck-contracts`."* As written, an executor will guess and may split the type across Roma and Tokyo (re-introducing the current duplication).

**(b) "initialize Page-owned social values as empty strings only where the old source had no such field and the new blank-Page contract defines empty as the real starting value" (§Current-source migration) — UNDEFINED VALIDATION OUTCOME.**

The current validator requires non-empty title (`roma/lib/account-page-source.ts:68`). The PRD's `PageOwnedValues.title: string` does not say if empty is valid. An executor must know: does the new validator accept `title: ''`? If yes, the blank-Page creation path must also produce `title: ''` (contradicting current `defaultPageMetadata()` which sets `'Untitled page'`, `roma/app/api/account/pages/route.ts:40`). If no, the migration rule "empty strings" produces invalid sources. The PRD must state the exact post-migration validation for each field. This is a V2 (silent healing) landmine.

**(c) "Likely owners include:" list (§Code work) — INACCURATE AND INCOMPLETE.**

The list names `roma/lib/account-page-*.ts`, `roma/app/api/account/pages/**`, `roma/components/use-roma-pages.ts`, `tokyo-worker/src/domains/pages/**`, `tokyo-worker/src/routes/internal-page-routes.ts`. Confirmed against code:
- `roma/components/use-roma-pages.ts` exists (5751 bytes). ✓
- `roma/app/api/account/pages/**` exists. ✓
- **MISSING: `roma/components/pages-domain.tsx` (1248 lines).** This file is *deeply* coupled to the current `localization` shape being destroyed: `pageSource.localization.defaultLocale`, `.countryLocaleRules`, `.ipLocalizationEnabled`, `.languageSwitcherEnabled` (lines 382, 389, 396-397, 510-547, 920-981). 127A's new contract removes all of these. An executor who follows the PRD's file list will miss this file and leave a broken UI that references `pageSource.localization.*` at runtime. This is a Tenet 13 (docs/runtime mismatch) and a hard executor gap.
- **MISSING: `roma/app/api/account/instances/[instanceId]/route.ts`** — uses `pageIdsPlacingInstance` and `listAccountPageSourcesInTokyo` (lines 235-246) to block instance deletion when placed on a page. The source-shape rewrite changes what `listAccountPageSourcesInTokyo` returns; this route must be re-verified. The PRD's "127A does not change Instance overlay storage" is true, but 127A *does* change the Page source shape that this instance route reads.
- **MISSING: `roma/tests/run-account-page-source.ts`** — uses the old shape (`localization`, `metadata`, `version`/`schemaVersion`). Must be rewritten.
- The PRD's caveat "The executor must confirm the exact file list from current code before editing" is a disclaimer, not a fix. It transfers the discovery work to the executor.

**(d) "Tier99 copies the accepted Tier 4 product configuration except..." (§Tier99) — WHERE EXACTLY DOES TIER 4's CONFIG LIVE?**

The PRD never points at `packages/ck-policy/entitlements.matrix.json` (Tier 4 column) or `packages/ck-policy/ai-runtime.matrix.json` (tier4 blocks at lines 111-139, 222-241). An executor is told to "copy Tier 4" without being told the source of truth is two JSON files with explicit `tier4` keys. The PRD should say: *"Copy the `tier4` value column in `entitlements.matrix.json` to a new `tier99` column for all 13 entitlements, and copy the `tier4` block under each agent in `ai-runtime.matrix.json` to a new `tier99` key."* As written, an executor might hand-write a tier99 config that drifts from tier4.

**(e) "its AI runtime policy matches the existing Tier 4 policy" (§Tier99) — UNVERIFIABLE WITHOUT A TEST.**

The PRD §Verification says "every valid profile consumer accepts Tier99." But there is no existing test that asserts *Tier 4 and Tier99 AI runtime policies are identical*. An executor will add tier99 and move on. The PRD should require: *"Add a matrix-invariant test asserting `tier99` equals `tier4` across the entitlements matrix and every AI runtime agent block."* The existing `run-entitlements-matrix-invariants.ts` is the right place; it currently hardcodes `tiers = [...'tier4']` (line 9) and must be extended.

**(f) "the conditional `CLICKEEN` account only if it is currently Tier 4" (§Current-source migration, §Tier99) — FACTUALLY WRONG AGAINST CURRENT DATA.**

This is the most serious prose defect. The CLICKEEN account is **currently `tier3`, not `tier4`**. Grounding:
- `supabase/migrations/20260304090000__account_only_tenancy.sql:62` sets the admin account `tier = 'tier3'`.
- `supabase/migrations/20260526110000__prd104a_admin_account_coordinate.sql:80` asserts the migrated CLICKEEN account `tier = 'tier3'` and raises if not.
- No later migration changes CLICKEEN to tier4 (confirmed: only two migrations reference CLICKEEN).

So the PRD's precondition "must conditionally update the one exact `CLICKEEN` account only if it is currently Tier 4" would **always stop without changing any account** (§Failure behavior: "`CLICKEEN` is not exactly Tier 4 at migration time → Stop without changing any account"). Tier99 would never be assigned. The PRD must either (i) change the precondition to "currently Tier 3," or (ii) add a prior migration promoting CLICKEEN from tier3→tier4 before the tier99 migration, or (iii) reconcile with the Mama PRD §10 which says "verify the exact `CLICKEEN` account is Tier 4." As written, 127A's central data migration is a no-op against real cloud-dev data. An executor who trusts the prose will ship a migration that does nothing and report success — a V6 (partial-success masquerade) and a V7 (masquerade) hazard.

**(g) "Page overlays follow the existing Clickeen rule" (§Page overlays) — conflates two different overlay shapes.**

The existing overlay rule (`OverlayArchitecture.md`, Tenet 9) is for *Instance* overlays: `accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json` with body `{ "values": { "[field path]": "..." } }`. The PRD's Page overlay is `{ values: PageOwnedValues }` — a *typed object*, not a path→string map. These are structurally different. An executor could conclude "Page overlays should also be stored as `overlays/locales/{locale}.json` files beside source.json" by analogy. The PRD does not say where Page overlays are stored. §Page source contract puts `overlays` *inside* `source.json` (`overlays: Record<string, { values: PageOwnedValues }>`), which is a different storage model than Instance overlays (separate files). The PRD must explicitly state: *"Page overlays are stored inline in `source.json`, not as separate locale files; this is intentional and differs from Instance overlay storage."* Without this, an executor will guess the storage shape.

**(h) "an `instanceId` may appear only once in the initial Pages release" (§Page source contract rules) — DOES 127A ENFORCE THIS OR IS IT A 127B/127E CONCERN?**

The PRD lists this under source-contract rules, implying the 127A validator rejects duplicate instanceIds. But 127A §Goal says it does not compile or build UI. An executor must know: is duplicate-instanceId rejection part of `normalizeAccountPageSource` in 127A, or a 127E Page Builder constraint? The PRD should say *"The 127A source validator rejects duplicate `instanceId` within `placements`."*

#### 5. Needed documentation / updates (DEV perspective)

127A's §Required documentation list is broadly right but imprecise. Concrete updates, grounded in current doc text:

**Must update (sentence-level falsehoods after 127A):**

- `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/CONTEXT.md` — line 294: "Page publish and public page serving are currently disabled because Roma does not currently write page packages." Still true after 127A (127A does not enable publish). But the *Storage Shapes* block (lines 230-237) shows `pages/{pageId}/source.json` + `serve-state.json` + `index.html/styles.css/runtime.js`. After 127A, `source.json` shape changes and `overlays` move inline; the storage diagram must reflect the new `source.json` contract (or at least note `source.json` now carries `baseLocale`, `locales`, `overlays`, `values`, `robots`, `isTemplate`).

- `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/Tenets.md` — line 268-270 (Tenet 11): "Page publish and page public serving are currently unavailable until Roma writes page packages." Still true post-127A. No change needed *unless* 127A is misread as enabling publish. The Tenet 1 list (line 51-66) includes "page source files" — the *typed* contract should be referenced. Consider adding a one-line note that Page source is now a shared typed contract in `@clickeen/ck-contracts`.

- `/Users/piero_macpro/code/VS/clickeen/documentation/services/michael.md` — line 86: `public.account_tier` enum table lists `free, tier1, tier2, tier3, tier4`. **This becomes false after the Tier99 migration.** Must add `tier99`. Also line 97 (`accounts` columns) is unaffected.

- `/Users/piero_macpro/code/VS/clickeen/documentation/services/berlin.md` — does not currently list tier values exhaustively, but the bootstrap behavior implicitly depends on `normalizeTier` (`berlin/src/bootstrap/state.ts:80`). After tier99 is added, if berlin.md is unchanged it is not *false*, but the doc should note Tier99 as a non-customer, non-purchasable internal profile consistent with `AccountManagement.md`.

- `/Users/piero_macpro/code/VS/clickeen/documentation/services/roma.md` — lines 423-446 (Pages Domain): "Current page source references saved widget instances by placement id and instance id. It does not embed widget source and does not currently store child widget artifact references." Still true. But the doc does not describe the *source shape*; after 127A the source shape is a typed contract and the doc should reference it. Lines 432-435 ("Current account page publish is disabled until Roma has a real page package writer") remain true.

- `/Users/piero_macpro/code/VS/clickeen/documentation/services/tokyo-worker.md` — lines 136-160 (Pages): "Current page source is a source document with widget placement references." Still true, but Tokyo will now receive a validated typed object (once 127A makes Tokyo validate). The doc should note Tokyo validates against `@clickeen/ck-contracts` `AccountPageSource`.

- `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/AccountManagement.md` — not in 127A's list but should be: it is the account-model authority and is silent on Tier99. After 127A, a line under §Core Terms or a note that Tier99 is a non-sellable internal profile owned by the `CLICKEEN` account is warranted.

**127A lists but likely does NOT need changing (verify before editing):**

- `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/OverlayArchitecture.md` — covers *Instance* overlays. 127A explicitly does not change Instance overlay storage (§Page overlays). Page overlays are inline in `source.json`, a different model. Editing this doc risks implying Instance and Page overlays share storage. **Recommend: do not edit OverlayArchitecture.md in 127A; instead add the Page-overlay-inline note to roma.md/tokyo-worker.md.**

- `/Users/piero_macpro/code/VS/clickeen/documentation/capabilities/localization.md` and `multitenancy.md` — 127A does not change localization capability (baseLocale/overlay model is preserved). `multitenancy.md` may need a Tier99 note if it lists tiers. The PRD should check these before editing rather than auto-touch.

**127A missed:**

- `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/RuntimeProfiles.md` — listed in Mama §14 but not in 127A's list. If it enumerates tiers/profiles, it needs Tier99.
- There is no `documentation/architecture/Overview.md` in the repo root of architecture (Mama §14 names it). The executor should confirm it exists before assuming an update target.

**Verdict: APPROVE WITH CHANGES — the Page-source contract, `pages.max` placement, and Tier99 mechanism are architecturally sound, but the PRD must (1) correct the false "CLICKEEN is currently Tier 4" migration precondition (it is Tier 3 today), (2) name `packages/ck-contracts/src/account-page.ts` as the shared contract home, (3) add `roma/components/pages-domain.tsx` and the instance-DELETE route to the owners list, and (4) pin the Tier 4→Tier99 parity as an explicit matrix-invariant test before an executor can safely proceed.**

---

## 2. Senior Product Manager Peer Review

### 127A — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

127A makes several genuinely elegant product decisions that keep the customer's mental model of "a page" simple and that scale cleanly across tiers and locales.

**What is elegant and scales well**

- **Blank page as the only starting point, and Save as the only create authority.** Product rule 10 — "Opening a blank Page draft is not Page creation. The first successful **Save** is the create authority: it enforces `pages.max`, mints server-owned identity/timestamps, and writes the first source" — gives the customer one unambiguous model: you sketch, then you commit. The current code (`roma/app/api/account/pages/route.ts` POST) creates a Page object on the very first request, so 127A replaces an immediate-persistence model with a honest draft-then-commit model. That is a real product upgrade and it scales: there is exactly one create path, not two.
- **`baseLocale` is inherited from the account, never re-chosen.** Source-contract rule "`baseLocale` must equal the current account `baseLocale` when the Page is created" removes the legacy-SaaS "pick your language again on every surface" trap. Locale is product context, not product identity (WhyClickeen, GlobalReach tenet), and 127A enforces it at the source. This is the Babel moat applied to a new surface without ceremony.
- **Placements are references, not copied source.** `PagePlacement = { placementId; instanceId }` plus rule 2 ("references only saved Instances from that same account") and the Mama tenet "A placement never contains copied Instance source" means a Page is a *view* over account truth, not a fork. Reorder, add, remove — the Instances stay where they are. This is the schema-first model at its cleanest, and it is what makes the later currency/update model (127D) even possible.
- **`pages.max` counts identities, not published pages.** Rule 6 and the `pages.max` table count every Page whether published or not. This is the correct unit of value: the customer "owns" the Page the moment they save it, independent of whether it is live. It also makes the downgrade rule clean.
- **Downgrade never deletes; it only blocks creation.** Rule 8 — "A downgrade never deletes or chooses Pages for the customer. It blocks only new Page creation while the account is at or above its current finite limit" — is trust-building and operationally simple. No silent cleanup, no "Clickeen picked which of your Pages to kill." This is fail-visible product law.
- **Page composition does not consume `instances.published.max`** (rule 7). This is a subtle, excellent decision: an Instance may appear in a Page even when it is not published as a standalone widget. The Page is the publication; the Instances are ingredients. This decouples two entitlements in a way that matches how customers actually think ("I'm building a page, not publishing a widget").
- **`isTemplate` as the single template distinction.** No template source format, no Catalog object (Mama §9). One boolean, one shape. This is lean and avoids the legacy "template engine" machinery that AGENTS.md explicitly warns against.

**What does NOT scale well for real customers**

- **The Page-owned-overlay authoring burden is unaddressed — this is the biggest scaling flaw.** 127A §"Page overlays" restates the existing rule (`baseLocale → values; non-base → exact overlay; missing → fail`) and the source contract requires "each overlay supplies the complete Page-owned value set" for `title`, `description`, `socialTitle`, `socialDescription`, `socialImageAssetRef`. But 127A defines **no generator** for Page-owned overlays, and no PRD-127 slice defines one: the Mama §12 execution list (127A–127F) contains no "Page overlay translation" slice, and the Translation Agent today only operates Instance overlays (`documentation/capabilities/localization.md`). So a Tier 3 account with `l10n.locales.max: 28` must hand-author up to 27 Page overlays × 5 fields per Page, or compilation/serving fails (rule 5). For the product's flagship new surface to have a localization story weaker than Widgets undermines the Babel moat at exactly the point it should be strongest. A senior PM must flag: *who generates Page-owned overlays, and in which slice?* 127A cannot ship a credible Tier 2/3 Pages product without an answer.
- **The Tier 1 → Tier 2 Pages cliff is severe.** `free=0`, `tier1=0`, `tier2=3`. A paying Tier 1 customer (who already gets 10 widget instances per `entitlements.matrix.json`) gets **zero** Pages. Pages is effectively a Tier 2+ feature, but the tier wall is placed one tier above the first paid tier. From a PLG perspective, hiding the new flagship surface behind a second upsell (Tier 1 already paid) is a risky choice. Worth at least considering `tier1=1` so a paid customer can try one Page.
- **One Instance per Page in the initial release.** Source rule "an `instanceId` may appear only once in the initial Pages release" caps composition. Acceptable for v1, but it should be called out as a deliberate, visible constraint so 127E doesn't accidentally present it as a bug.

#### 2. Compliance with product UX best practices

127A is a source/policy slice, so I am judging the product-truth decisions that 127E's UI will inherit, not UI chrome.

**Where 127A excels**

- **Progressive disclosure (draft → save).** Rule 10 + rule 11 ("A draft change never writes source and never invokes the Page Compiler") give a clean two-state model: browser draft, then committed source. This is textbook progressive disclosure and it maps to one create authority.
- **"Don't make me think" on locale.** Inheriting `baseLocale` from the account and constraining "every locale must be allowed by the current account locale policy" means the customer never has to reconcile two locale registries. One source of truth.
- **Empty states are honest.** The Mama §2 "Choosing **Use template** opens an unsaved Page Builder draft... no placements or invented content" means no fake placeholder Page. Good — no invented content (consistent with V1/V3).
- **Error states are fail-closed and explicit.** The failure table (corrupt source → "do not treat it as a blank Page"; missing overlay → reject save; placement Instance missing/cross-account → reject) maps directly onto the V1–V8 audit and the "fail-visible, no invented fallback" tenet.

**Where 127A falls short**

- **Tier-limit UX regresses vs. the Widgets domain — the "author into a wall" problem.** Roma Widgets enforces `widgets.instances.max` *at command time, before minting an ID* (`roma.md`: "Create and duplicate enforce `widgets.instances.max` at command time before minting a new instance id, materializing package bytes, or calling Tokyo create/write routes"). The user is rejected before they invest. 127A instead enforces `pages.max` "in the first-save/create route before it mints a Page ID" — i.e., a Free/Tier 1 user can open a blank draft, add placements, edit metadata, and only discover at **Save** that their tier forbids Pages. The draft is preserved (failure table: "preserve the browser draft"), so it is not data loss, but it is an upsell wall placed *after* investment rather than before. This is a worse product-truth decision than the one Widgets already made, and 127A owns it (enforcement point is specified here, not deferred to 127E). Recommend: fail-fast at "Blank page / Use template" entry for `pages.max === 0` accounts, or surface the limit the moment a draft is opened, so the user never authors into a wall.
- **Discoverability of Pages for `pages.max === 0` accounts is unspecified.** 127A does not state whether the Pages nav item is hidden, shown-but-locked, or shown-with-upsell for Free/Tier 1. That is a product-truth decision (not pure UI), because it determines whether the surface is a discovery/upsell entry or invisible. It should be pinned in 127A or explicitly delegated to 127E.
- **Migrated customers hit unexplained empty social fields.** Migration rule "initialize Page-owned social values as empty strings only where the old source had no such field" means a migrated customer opens their existing Page and sees blank `socialTitle`/`socialDescription`. Not bad copy, but an empty state the customer did not author and may not understand. Minor, but worth a one-line product note.

#### 3. Bad UX writing for the user (if present)

127A is mostly an internal contract and contains very little user-facing copy. What would leak is narrow:

- **The Tier 1 "Save into a wall" moment is the one bad-UX-writing risk 127A creates.** 127A's failure table row "Account cannot save a new Page → Reject before ID creation or storage writes" will surface to a Free/Tier 1 user as an upgrade prompt *after* they have built a draft. The reasonKey/copy itself is 127E's job, but 127A's choice of enforcement-at-Save is what manufactures the bad moment. The copy that lands will feel like "do work, then pay" unless 127E is very careful. Flagging so 127E knows the entry condition is hostile.
- **"Tier99 means 'Clickeen's internal operating account,' not 'more powerful admin.'" (rule 9)** — internal phrasing, will not leak. Good. And the guard "Customer pricing, checkout, billing, upgrade, provisioning, and account-tier change routes must reject Tier99" keeps it from ever reaching a customer-facing plan label.
- **Machine status states (`current | out_of_date | save_failed`)** are not 127A's to label; the Mama §8 already maps them to clean customer copy ("Current", "Needs update", "Needs fixing"). Consistent and jargon-free.
- **`baseLocale`, `overlays`, `placements`, `revision`** are internal field names and should never appear verbatim in UI. 127A does not put them in copy. No leak.
- **`robots: 'index,follow' | 'noindex,nofollow'`** is standard SEO vocabulary; acceptable if surfaced as a customer "Allow search engines" toggle in 127E.

Net: no egregious jargon leak in 127A itself. The only real copy risk is structural (the Save-time tier wall), owned by 127A's enforcement-point decision.

#### 4. How this PRD aligns with Clickeen being different from legacy SaaS (product perspective)

**Where 127A reinforces the thesis strongly**

- **Page source is a native expression of the schema-first, source-truth-fidelity model.** The typed `AccountPageSource`, placements-as-references, exact Page overlays, monotonic `revision`, and server-owned timestamps are exactly the "structured, typed, AI-legible schema that agents read and operate" (CONTEXT.md). A Page is not an opaque blob; it is a legible substrate. This is the moat, made real on a new surface.
- **Source vs. derived is clean.** The Mama §3 "source.json is editable product source. The four compiled files are derived output" and 127A's insistence that "this is the source contract to implement, not an invitation to add generic metadata bags" keeps the operable source minimal and forbids the legacy "everything is a metadata map" drift. That sentence is one of the most thesis-aligned lines in the PRD.
- **Overlay-native localization, no copy-based fork.** Page overlays reuse the existing Babel rule rather than duplicating Pages per locale. This is the Babel moat extended.
- **`isTemplate` boolean instead of a template engine.** No Catalog object, no template source format, no commit machinery (Mama §9, §12). This is the lean, agent-operable pattern; it explicitly refuses the legacy "template marketplace" pattern.
- **Fail-visible everywhere.** Rule 5 ("Nothing falls back silently") and the V1–V8 review questions are the operational expression of "fail-visible behavior instead of silent fallback."

**Where 127A drifts or carries tension**

- **Tier99 is defensible but expensive, and arguably premature.** Tier99 is *functionally identical to Tier 4* in 127A: `pages.max` unlimited for both, `instances.published.max=100` and `widgets.instances.max=250` copied verbatim, AI runtime policy copied. The *only* product difference is "permanently unavailable to pricing, checkout, upgrade, billing, provisioning." So 127A invents a sixth profile — replicated across "policy types and matrix validation; entitlement and AI runtime matrices; authorization capsules and Berlin bootstrap normalization; shared AI profile contracts; Roma account-context normalization and plan labels; account-management and tier-change validation; tests; docs" — purely to mark one account as non-sellable. Two concerns from a product/architect view:
  1. **Is this schema-consistent or legacy machinery?** Because *every* entitlement is already a pure function of profile (ck-policy `policy.ts`), extending the profile enum is the *consistent* pattern — arguably more agent-operable than introducing a second `isInternal` boolean axis that every consumer would also have to learn. On that reading, Tier99 is the right call.
  2. **But it is YAGNI-weight.** In 127A, Tier99 produces *no* product behavior distinct from Tier 4. The CLICKEEN account could be Tier 4 today with zero product change and Pages would work identically (unlimited). The distinction only pays off if a *future* slice makes "internal vs highest-customer" matter (e.g., internal-only widgets, dogfooding flags, cost accounting). 127A should either (a) name the near-term product behavior that requires the distinction, or (b) defer Tier99 to the slice that actually needs it. Carrying a six-profile matrix with two identical rows is the kind of weight AGENTS.md warns against ("Do not add framework machinery... phasing labels... ceremony"). This is the one place a senior PM should push back and ask for the product reason, now.
- **No agent operator for Pages yet — the operability promise is half-met.** WhyClickeen: "A new agent exists only when it has a structured authority, product-law boundary, source-truth policy, operation path, and verification surface." 127A creates the structured authority (source contract) and the product-law boundary, but PRD 127 defines no Page agent (no analogue to Product Copilot / Translation Agent for Pages). That is acceptable for a source slice, but a PM should note that the "agent-operated" thesis is, for Pages, currently *substrate-only*. The substrate is excellent; the operator is absent from the program.
- **Tier99 as "Clickeen uses its own product"** is, on balance, a clean statement: the operating account is a normal account at a non-sellable profile, using the same routes and storage (`accounts/CLICKEEN/...`). It does *not* introduce a superuser role or alternate routes (rule 9), which is the correct anti-legacy-SaaS call. The tension is only the YAGNI-weight above, not the role design.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

127A's "Required documentation after deployment" list is: `CONTEXT.md`, `OverlayArchitecture.md`, `RuntimeProfiles.md`, `localization.md`, `multitenancy.md`, `berlin.md`, `michael.md`, `roma.md`, `tokyo-worker.md`. Measured against the Mama §14 list and against product-truth needs, the following gaps and specifics apply.

**Documents 127A omits but the Mama §14 lists (flag the omission)**

- `documentation/architecture/Overview.md` — needs the Page source model in the system overview once shipped.
- `documentation/architecture/Tenets.md` — the Mama defines fourteen Pages tenets; Tenets.md is the natural home for the source/policy tenets (Page = ordered Instance references; placements never copy source; `pages.max` counts identities; downgrade-never-deletes). 127A dropping it is a real omission.
- `documentation/services/tokyo.md` — `CONTEXT.md` storage shapes currently list `pages/{pageId}/source.json` + `serve-state.json` + `index.html/styles.css/runtime.js`. 127A adds Page `overlays` and (per Mama) moves compiled files under `packages/{packageFingerprint}/`. Tokyo storage doc needs the new Page source shape and the package path. Listed by Mama, dropped by 127A.
- `documentation/services/bob.md` — defensible to omit for 127A specifically (Bob is the Instance editor; Page Builder is 127E), but the Mama lists it, so 127A should either include it with a "no change in 127A" note or explicitly justify the drop.

**Documents neither list but a PM would expect touched**

- **`documentation/capabilities/pages.md` — does not exist and should.** The capabilities directory today contains `localization.md`, `multitenancy.md`, `seo-geo.md`, `supernova.md` — there is **no Pages capability doc**. Pages is a new product surface with its own source contract, its own entitlement (`pages.max`), its own policy (Tier99), and its own overlay rules. By the pattern of every other capability doc, a `pages.md` is the expected product-truth home: Page source contract, `baseLocale`/overlay rule, `pages.max` tier table, Tier99 non-sellable rule, placement/same-account rules, and the migration/currency contracts as they land. This is the single biggest documentation omission across both 127A and the Mama. It should be referenced from 127A even if authored alongside/after 127E.
- **`documentation/capabilities/multitenancy.md` — needs three concrete updates 127A implies but does not enumerate:**
  1. New entitlement row in the entitlement-keys table: `pages.max` (limit), enforcement owner "Roma Page create/save route", status `enforced`.
  2. New finite-limits table for `pages.max` (`free=0, tier1=0, tier2=3, tier3=10, tier4=null, tier99=null`) alongside the existing `widgets.instances.max`/`instances.published.max` table.
  3. Tier99 in the profile set with the explicit "non-sellable, internal CLICKEEN account only, functionally Tier 4" note, and the invariant that customer tier-change routes reject `tier99`.
  4. The "Code Authority" table needs the Page routes/lib files (`roma/app/api/account/pages/**`, `roma/lib/account-page-*.ts`).
- **`documentation/strategy/WhyClickeen.md` — light update.** Line 36 already says "Current Clickeen product work proves this through account-owned widgets and Clickeen Pages." Once Pages source/policy is real, the strategy entry point should reference the Page source model (schema-first, reference-not-copy, overlay-native) as proof of the thesis rather than leaving "Clickeen Pages" as an unelaborated promise. Not blocking, but a PM would expect the canonical strategy doc to reflect the flagship surface once it ships.

**Documents 127A lists — confirm the product truth each needs**

- `documentation/architecture/CONTEXT.md` — Storage Shapes block: add Page `overlays` to `source.json` and the `packages/{packageFingerprint}/` path; "Clickeen Pages" Product Flow currently says "Page publish and public page serving are currently disabled" — update as later slices ship; add Tier99 to the account-tier product law.
- `documentation/architecture/OverlayArchitecture.md` — add Page-owned overlays as a new overlay surface distinct from Instance overlays; restate "Page overlay contains only Page-owned values; Instance translations remain owned by each Instance."
- `documentation/architecture/RuntimeProfiles.md` — add `tier99` profile; document that it is non-sellable and functionally Tier 4.
- `documentation/capabilities/localization.md` — needs to state the Page-owned-overlay rule *and* explicitly flag the open question from §1: whether/which slice adds a Page-overlay translation generator. Today this doc only describes Instance translation; leaving Page overlays undocumented here would be a real gap.
- `documentation/services/berlin.md` — `normalizeTier` (`berlin/src/bootstrap/state.ts`) gains `tier99`; authz capsule/bootstrap normalization accepts `tier99`; customer tier-change routes reject it.
- `documentation/services/michael.md` — the `accounts.tier` enum/profile gains `tier99`; document the conditional `CLICKEEN`-only Tier 4 → Tier99 migration and its preconditions.
- `documentation/services/roma.md` — Pages Domain section: replace the current "Page source references saved widget instances by placement id and instance id... does not currently store child widget artifact references" with the new Page source contract; document `pages.max` enforcement point (and, per §2, ideally move enforcement to entry/draft-open); document Tier99 in account-context normalization and plan labels.
- `documentation/services/tokyo-worker.md` — Page source read/write now includes `overlays`; document exact validation (reject base-locale overlay key, require complete Page-owned value set, reject missing/extra locales) and the migration reader-removal rule.
- `AGENTS.md` — consider adding a "Pages" row to the read-order Work Area table pointing at the new `documentation/capabilities/pages.md`.

**Verdict: APPROVE WITH CHANGES** — 127A is a strong, thesis-aligned source/policy slice, but it must (1) answer who generates Page-owned overlays or the Pages localization story is weaker than Widgets, (2) move `pages.max` enforcement to fail-fast at draft entry instead of authoring-into-a-wall at Save, and (3) either justify Tier99's product behavior now or defer it to the slice that actually needs the distinction.

---

## 3. Principal TPM Peer Review

### 127A — Principal TPM Peer Review (GLM)

Review scope: PRD `127A__PRD__Page_Source_And_Policy.md` as the first execution slice of the MAMA PRD 127, grounded against current runtime code, migrations, policy packages, and deploy workflows. Every claim below is tied to a real file/path.

#### 1. Cohesive and cost-effective architecture

**Directionally cohesive, minimally infra-additive, but the Tier99 / `pages.max` coupling forces an atomic commit and the migration blast radius is larger than the PRD admits.**

The design is architecturally lean and consistent with Tenet 1/2/8 (structured artifacts, named authorities, storage follows ownership). It introduces **no new service, no new R2 root, no queue, no registry**. Every mutation still flows `Roma account route → Tokyo-worker → accounts/{accountPublicId}/pages/{pageId}/source.json`. That is the right shape for an agent-operated substrate, and it correctly avoids the legacy-SaaS trap AGENTS.md warns against.

What keeps it cost-effective:
- The Page source is a **reference model** (`AccountPageSource.placements[]` carries `placementId` + `instanceId` only), not a content-copy model. This means 127A adds ~one small `source.json` per Page to R2 — no duplication of instance bytes, no fan-out writes. Confirmed against `roma/lib/account-page-direct.ts:44-59` (`AccountPagePlacement`) and `tokyo-worker/src/domains/pages/source.ts` (stores `unknown` source verbatim under the page key).
- `isCompactPageId` / `createCompactPageId` already exist in `packages/ck-contracts/src/overlay-identity.ts:50-65`, so 127A adds **zero new identity machinery**.

Three cohesion/cost risks the PRD under-states:

1. **The matrix validator forces an atomic, all-or-nothing commit.** `packages/ck-policy/src/matrix.ts:6` hardcodes `REQUIRED_TIERS = ['free','tier1','tier2','tier3','tier4']`, and `assertEntitlementsMatrix` (matrix.ts:48-66) **throws at module load** (`getEntitlementsMatrix()` is called eagerly in `policy.ts:43`, `limits.ts:73`, `ai-runtime.ts:119,149`) if (a) `tier99` is missing from `tiers[]`, (b) any entitlement key lacks a `tier99` value, or (c) an unknown key appears. Adding `pages.max` means **every one of the 13 existing entitlements must also gain a `tier99` cell**, or `import @clickeen/ck-policy` throws on every Worker/Pages cold start. The PRD lists `pages.max` and Tier99 as separable work items but the validator makes them a single atomic unit. This is recoverable but must be called out as one coordinated commit, not two.

2. **Three independent tier lists must move in lockstep, not two.** The PRD names `ck-policy` and Berlin, but the codebase has a *third* tier authority: `packages/ck-contracts/src/ai.ts:2` (`AiPolicyProfile = 'free'|...|'tier4'`) and `packages/ck-contracts/src/ai-model-management.ts:38` (`AI_POLICY_PROFILES`). The AI runtime matrix (`ai-runtime.ts:111-147`) iterates `getEntitlementsMatrix().tiers` and asserts a config block exists for each tier per agent — and there are **two agents** (`product.copilot`, `widget.instance.translator`), each needing a `tier99` block cloned from `tier4`. Miss any of these and `assertAiRuntimeMatrix` throws at module load (ai-runtime.ts:149). The PRD's "shared AI profile contracts" bullet (127A Tier99 section) gestures at this but does not name the files.

3. **Migration blast radius crosses live account data, not just CLICKEEN.** Step 5 ("Run the Page-source migration through Roma") touches **every account that has a `source.json`** under `accounts/{accountPublicId}/pages/`. Tokyo's `listAccountPageSources` (tokyo-worker/src/domains/pages/source.ts:69-94) walks all `*/pages/*/source.json` keys. The old shape (`roma/lib/account-page-direct.ts:36-59`: `metadata`, `localization.defaultLocale`, `countryLocaleRules`, `ipLocalizationEnabled`, `languageSwitcherEnabled`, `missingLocaleBehavior`) has **no `baseLocale`, no `overlays`, no `values`, no `isTemplate`**. The PRD's "initialize social values as empty strings" and "initialize overlays as empty" is a rewrite of every stored Page, and the old `canonicalUrl`/`countryLocaleRules`/`ipLocalizationEnabled` fields have **no destination in the new contract** — the PRD itself flags this in migration step 3 ("stop for product-owner review if any value has no exact destination"). That stop is correct, but it means 127A may deliver Tier99 + `pages.max` + the new validator while **deferring the source migration**, and the PRD does not separate those outcomes cleanly.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

**Boundaries are mostly clean and named, but two ownership seams are fuzzy: "one shared code authority" for the Page source type is under-specified, and the validator ownership between Roma and Tokyo is not actually shared today.**

System-boundary map, traced against code:

| Conversation | From → To | Named authorities | Verdict |
| --- | --- | --- | --- |
| Page source type ownership | Roma + Tokyo both import it | "one shared code authority" (127A Code work #1) | **Fuzzy.** Today the type lives in `roma/lib/account-page-direct.ts:49-59` (Roma-local), and Tokyo's `domains/pages/source.ts` treats source as `unknown` and does **no** structural validation. The PRD does not name the package. The only candidate is `packages/ck-contracts`, which already owns `isCompactPageId` and the instance/asset validators — but ck-contracts currently has **no** Page source type (`grep` of `packages/ck-contracts/src` shows only `COMPACT_PAGE_ID_LENGTH`). The PRD must state explicitly: the `AccountPageSource` type + validator move to `@clickeen/ck-contracts`, and Tokyo begins to validate it too (or explicitly remains byte-honest and Roma is the sole validator). Right now Tokyo's `loadStoredPageSource` (source.ts:34-45) only catches JSON parse errors; it does not shape-validate. |
| `pages.max` enforcement | Roma create route → policy | Roma at first-save (127A §"pages.max", rule 6) | **Confirmed correct placement**, and matches the existing pattern: `roma/app/api/account/instances/route.ts:150-162` uses `readFinitePolicyLimit(policy.limits,'widgets.instances.max')` + `policyContractFailure` + 402 `UPGRADE_REQUIRED`. The current Pages POST route (`roma/app/api/account/pages/route.ts:115-204`) has **no** `resolvePolicy` call and **no** limit check — so 127A is adding the gate at the right point. |
| Tier99 normalization | Berlin bootstrap | `berlin/src/bootstrap/state.ts:80-91` `normalizeTier` | **Confirmed Berlin owns it**, but the switch is hardcoded to stop at `tier4`. `AccountTier` is `type AccountTier = PolicyProfile` (berlin/src/bootstrap/types.ts:3), so the *type* flows from ck-policy automatically, but the *runtime normalizer* does not — it must be edited independently. |
| Entitlement values | `@clickeen/ck-policy` matrix + registry | matrix.ts + registry.ts + entitlements.matrix.json | **Confirmed**, but the PRD lists `pages.max` as a single addition; the registry (`ENTITLEMENT_KEYS`, `PLAN_LIMIT_KEYS` in registry.ts:3-37) and the invariants test (`packages/ck-policy/tests/run-entitlements-matrix-invariants.ts`) must also be updated, and the test hardcodes `tiers=['free',...'tier4']` at line 9. |
| Relational tier row | Michael/Supabase migration | `account_tier` enum + CHECK constraints | **Confirmed**, with a defect — see §5 and the migration note below. |
| Authz capsule profile | Berlin mints, Roma/Tokyo verify | `authz-capsule.ts:101-112` `normalizePolicyProfile` | **Confirmed.** This is a *fourth* hardcoded tier switch (after `normalizeTier`, `REQUIRED_TIERS`, `AI_POLICY_PROFILES`). The capsule verifier rejects unknown profiles → fail-closed, which is correct, but it means Tier99 must land here too or the CLICKEEN account's capsule becomes `payload_invalid`. |

**No invented subsystem.** I checked explicitly for the legacy-SaaS smells AGENTS.md lists: no new Worker, no broad registry, no compatibility wrapper is *required* (the PRD even mandates deleting the old shape after migration — §"Current-source migration" last bullet). The one risk is the migration reader: the PRD says "do not retain a compatibility reader after the migration is proven," which is the right call, but during the deploy window (steps 4-7) both shapes must be readable. That is a temporary dual-read, not a permanent subsystem — acceptable if step 7 truly deletes it.

**Two ambiguity flags to resolve before execution:**
- Does Tokyo-worker validate the new `AccountPageSource` shape, or does it stay byte-honest (store/serve `unknown`, only JSON-parse-check)? Today it is byte-honest. The PRD's "shared by Roma and Tokyo validation" implies Tokyo gains a validator. That is a real behavior change for Tokyo and should be explicit.
- The `overlays` field in the new contract is `Record<string, { values: PageOwnedValues }>`, but Instance overlays live at `accounts/{...}/instances/{id}/overlays/locales/{locale}.json` as separate files (tokyo-worker.md, Tenet 9). **Page overlays are stored inline in `source.json`; Instance overlays are stored as separate R2 objects.** This split is intentional (Page overlays are Page-authored source; Instance overlays are generated) but the PRD should state the storage difference explicitly so a future agent doesn't try to materialize Page overlay files.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

**The placement-as-reference model and entitlement-at-create-point are genuinely best-in-class. The Tier99 "internal account" concept is cleaner than admin-flag competitors but under-specifies how internal content becomes the global Catalog.**

Where 127A is genuinely ahead:

- **Reference, not copy, for Page composition.** `AccountPageSource.placements[]` references saved Instances by id; it never embeds widget source (127A rule 2; confirmed `AccountPagePlacement` in account-page-direct.ts:44-48 carries only `placementId`+`instanceId`). Webflow and Shopify both duplicate page/template content into per-page DOM; Framer copies component instances. Clickeen's model means a single source of truth per Instance, with the Page as an ordering/ownership layer — this is closer to Notion's "block reference" model than to a traditional site builder, and it makes future currency/update semantics (127D) tractable because there is exactly one Instance source to diff against. This is a real technical moat, not marketing.
- **Entitlement enforced at the create boundary, not the UI.** `pages.max` is checked in the Roma POST route before `createCompactPageId()` and before any Tokyo write (127A rule 6, §"pages.max"). This mirrors the existing `widgets.instances.max` gate (instances/route.ts:150) and matches how Stripe/Vercel enforce project limits — server-side, pre-mutation, returning 402. Webflow's site-count limits are enforced similarly at creation; the differentiator here is the **fail-closed contract**: a missing/malformed `pages.max` returns a 500 policy-contract failure, not unlimited usage (127A Failure behavior row 2). Most competitors fail open silently on misconfigured entitlements.
- **Tier99 as a real account tier, not a boolean.** The PRD's "Tier99 = internal operating account, not a superuser" (rule 9) is architecturally cleaner than Webflow's `is_internal` / Shopify's `plus` flag. Because Tier99 flows through the *same* `PolicyProfile` pipeline as every customer tier, it gets matrix-validated entitlements, AI runtime policy, and capsule signing for free — there is no shadow authz path. This is the right design.

Where competitors do something cleaner, and the gap:

- **Internal-vs-customer account separation.** Notion solves this with a workspace `is_workspace`/`is_guest` model plus a separate "team space" concept; Shopify uses a `plus_partner` flag plus a separate staff-account type. Clickeen's Tier99 is simpler but it **conflates "internal operating account" with "the Catalog source"** (Mama tenet 12: "The `CLICKEEN` account's templates are every account's Catalog"). That coupling is fine for 127A, but the Catalog read path (127F) will need every customer-tier Roma to read `CLICKEEN`-owned Page templates without a cross-account authz hole. The PRD's "Tier99 creates no alternate product routes or cross-account authority" (127A rule 9) is correct for *this* slice but the Catalog read in 127F is the real test. Flag for 127F, not a 127A blocker.
- **Page-count gating granularity.** Vercel and Netlify gate by project; Webflow gates by site; all count "live" entities. 127A counts *every Page identity, published or not* (rule 6), which is simpler and avoids the "soft-delete to dodge the limit" exploit. Clean.
- **Migration story.** This is where Clickeen is behind. Webflow/Shopify have versioned schema migrations with rollback; Clickeen's Page-source migration is a one-shot Roma-route rewrite of every Page (127A §"Current-source migration") with a manual "stop for product-owner review" on unmapped values. There is no rollback path documented — if step 5 corrupts sources, recovery is per-object R2 repair via `pnpm cf:r2:put`. The PRD's "read the source back and compare" (migration bullet) is good, but a principal-TPM would want a stated rollback or at-minimum a pre-migration R2 listing of affected keys (which step 1 "record the exact accounts and Page IDs" provides — good) retained as the recovery manifest.

Net: technically on par with or ahead of competitors on the entitlement and reference-model axes; behind on migration reversibility.

#### 4. Absence of V1–V8 violations

Exhaustive audit of 127A *as designed*:

- **V1 (Silent substitution) — AVOIDED with one gap.** Rule 5 ("A locale missing required Page or Instance values is an error. Nothing falls back silently") and the overlay rule (§"Page overlays") directly forbid substituting baseLocale for a missing overlay. Failure behavior row "Required Page overlay missing/malformed → reject." *Gap:* the migration's "initialize `locales` with that `baseLocale`" and "initialize `overlays` as empty" is a substitution of *new* structure for *absent* old structure — defensible because the old source had no overlay concept, but it must be gated by the "prove the current Page locale matches the account `baseLocale`" precondition (migration step 4). If that proof is skipped, V1 is violated. The PRD has the guard; execution must honor it.
- **V2 (Silent healing) — AT RISK; the PRD's own wording invites it.** The migration says "initialize Page-owned social values as empty strings only where the old source had no such field." Setting a field to `""` because the old source lacked it is *exactly* normalizing absent persisted state — the textbook V2. The PRD's qualifier "where the new blank-Page contract defines empty as the real starting value" narrows it, but only to fields where `""` is the *contractual default* for a *new* Page. That is a Tenet-4-allowed "deterministic default ... explicit contract of that request parameter," so it is compliant *if and only if* the blank-Page fixture (Code work #3) also produces `socialTitle: ""`, `socialDescription: ""`. The executor must prove the migrated value equals the new-Page default byte-for-byte; otherwise this is silent healing. **Recommend the PRD add an explicit invariant: "migrated social fields must equal `defaultPageValues()` output."**
- **V3 (Silent omission) — AVOIDED.** Migration step 3 ("stop for product-owner review if any value has no exact destination") and the V-questions section ("Migration does not omit unexplained stored truth") directly guard it. The old `canonicalUrl`, `countryLocaleRules`, `ipLocalizationEnabled`, `languageSwitcherEnabled`, `missingLocaleBehavior` fields (account-page-source.ts:29-44, 64-87) have **no destination** in the new contract — so migration step 3 *will* fire for any Page that set them. That is correct non-omission behavior. The PRD must accept that migration may block on the first real Page that used these.
- **V4 (Fail-open control) — AVOIDED by design, and the design is the strongest part.** Failure behavior row "`pages.max` missing or malformed → Fail closed" and row "Tier99 consumer not deployed → Do not migrate the account row" are explicit fail-closed controls. Code-side, `resolvePolicy` reads `entry.values[args.profile]` (policy.ts:47); for an unknown profile this is `undefined`, and `readFinitePolicyLimit` returning `null` triggers `policyContractFailure` (the 500 path in instances/route.ts:154). So an unset `pages.max` for a tier yields a 500, not unlimited. This is textbook V4 avoidance. The `account_tier` enum + CHECK constraints (see §5) provide the database-side fail-closed: inserting `tier99` before the enum migration is applied is rejected by Postgres.
- **V5 (Corruption-as-absence) — AVOIDED in code; verify the migration honors it.** Tokyo's `loadStoredPageSource` (tokyo-worker/src/domains/pages/source.ts:34-45) calls `failSourceInvalid` (throws `PageOperationError` kind `VALIDATION`) on JSON parse failure — corrupt source is an error, not a blank Page. 127A Failure behavior row "Stored source is corrupt → Report corruption; do not treat it as a blank Page" reinforces this. *Risk:* the migration's per-source "read back and compare" loop must treat a corrupt source as a stop, not as "migrate the fields we could parse." The PRD's migration step 1-2 (inventory, record) supports this. Compliant if execution treats parse-failure as a hard stop per Page.
- **V6 (Partial-success masquerade) — AVOIDED.** The deployment order (steps 1-7) separates code deploy, schema deploy, reader verification, source migration, and tier migration into distinct verifiable steps. Step 4 ("Verify all deployed readers accept both current pre-migration data and the approved migration command") is the explicit partial-success guard. The Mama PRD §13 reinforces: "save, compile, install, currency derivation ... remain separate and exact outcomes."
- **V7 (Masquerade/redress) — AT RISK during the deploy window; mitigated by step 7.** Steps 4-6 require Roma/Tokyo to read *both* the old `metadata`/`localization` shape and the new `values`/`baseLocale`/`overlays` shape. That is a compatibility reader — the exact V7 surface ("same failing workflow continue under a different ... name"). The PRD's last migration bullet ("do not retain a compatibility reader after the migration is proven") and Code work #8 ("Delete the replaced old Page source/localization types ... and migration-only code after verification") are the correct V7 guards, *provided step 7 is not skipped*. **Recommend the PRD make step 7 a hard gate with a V7-specific audit, not a cleanup afterthought.**
- **V8 (Runtime test dependency) — AVOIDED.** No part of 127A makes normal Page work depend on the entitlements test or migration fixtures. The `test:entitlements` gate (cloud-dev-roma-app.yml:59-60) is a *build-time* gate, not a runtime dependency. Compliant.

**V-audit summary: V1, V3, V4, V5, V6, V8 avoided; V2 and V7 carry residual risk that the PRD's wording partially invites.** Both are closable with two PRD edits (V2: assert migrated social fields equal `defaultPageValues()`; V7: make step-7 deletion a hard V7 gate).

#### 5. Needed documentation / updates (TPM perspective)

**Deploy-order sequencing (the 7 steps) is sound but step 6 has a false precondition; multiple docs become literally false after 127A and must update in a specific order.**

**Deploy-order note (TPM):** The 7-step order is correct *in principle* — additive code first (1), then schema (2), then worker/Pages deploy (3), then reader verification (4), then data migration (5,6), then cleanup redeploy (7). This matches AGENTS.md DevOps Gate (Workers via `cloud-dev-workers.yml`, Pages via Git, Supabase via `supabase-migrations.yml`). Two sequencing refinements:

- **Step 2 (Supabase) and step 1 (code) have a Postgres-version hazard.** The tier4 migration (`20260602120000__account_tier4.sql`) uses `ALTER TYPE ... ADD VALUE IF NOT EXISTS` *inside* a `DO $$ ... BEGIN ... END $$` block wrapped in `BEGIN/COMMIT`. `ALTER TYPE ... ADD VALUE` inside a transaction block is disallowed on Postgres < 12 and behaves specially on later versions; Supabase is on PG 17 (`SupabaseOperations.md` local config), where `ADD VALUE IF NOT EXISTS` is allowed inside a transaction *only* if the value isn't used later in the same transaction. The Tier99 migration must follow the **same `DO $$ ... ADD VALUE IF NOT EXISTS 'tier99'` pattern** (tier4 migration lines 3-14) and **also drop/recreate both CHECK constraints** (`accounts_tier_allowed`, `workspaces_tier_allowed` — tier4 migration lines 16-36) to include `tier99`. The PRD does not name the CHECK constraints; the executor must, or the row update in step 6 violates `accounts_tier_allowed`.
- **Step 6 precondition is FALSE in the deployed schema.** The PRD says "conditionally update the one exact `CLICKEEN` account only if it is currently Tier 4." The deployed `CLICKEEN` account is **tier3**, not tier4. Evidence: `supabase/migrations/20260526110000__prd104a_admin_account_coordinate.sql:80` asserts `tier = 'tier3'` post-migration, and no later migration changes it (the only `UPDATE ... tier` hits are that migration and `20260304090000__account_only_tenancy.sql:62`, also tier3). The 127A migration as written would **stop without changing any account** (Failure behavior row 9: "`CLICKEEN` is not exactly Tier 4 at migration time → Stop"). The PRD must either (a) correct the precondition to `tier3`, or (b) add a prior step that moves CLICKEEN tier3→tier4→tier99. Option (a) is correct and simpler.

**Doc-order dependencies (update after deploy, in this order):**

1. `documentation/services/michael.md` — **becomes false at line 87** (`account_tier` enum table lists only `free`–`tier4`) and the "Current Enums And Columns" section. After step 2, this row is literally wrong. Update immediately after the Supabase migration is verified.
2. `documentation/capabilities/multitenancy.md` — **becomes false at lines 227-233** (the tier table stops at `tier4`) and lacks a `pages.max` column. This is the customer-facing entitlement reference; it must add the `tier99` row and the `pages.max` column after step 3.
3. `documentation/architecture/CONTEXT.md` — the "Clickeen Pages" product-flow bullets (lines 286-296) say "Page publish and public page serving are currently disabled because Roma does not currently write page packages." 127A does not enable publishing, so this sentence stays true — *but* the storage-shape block (lines 213-237) shows `pages/{pageId}/source.json` without the new `values`/`overlays`/`isTemplate` fields. Update the shape after step 5.
4. `documentation/services/tokyo-worker.md` — the Pages section (lines 137-159) describes source as "a source document with widget placement references" with no mention of `baseLocale`/`overlays`/`isTemplate`. Update after step 3 if Tokyo gains the validator, or clarify Tokyo stays byte-honest.
5. `documentation/services/roma.md` — the Pages Domain section (lines 421-446) must add the `pages.max` enforcement paragraph, mirroring the Widgets Domain enforcement text (lines 368-374).
6. `documentation/services/berlin.md` — the `normalizeTier` behavior is not documented as a tier list today, but after Tier99 it should note that Berlin normalizes `tier99` and rejects unknown tiers (state.ts:80-91).
7. `documentation/architecture/RuntimeProfiles.md` and `OverlayArchitecture.md` — listed in the PRD's required-docs; update only if they enumerate tiers or the Page overlay model.
8. `documentation/architecture/Tenets.md` — Tenet 11 (lines 268-270) says "Page publish and page public serving are currently unavailable until Roma writes page packages." 127A does not change this, so no update needed *for 127A*. Do not touch.

**Specific sentences that become false (must fix in the same PR as the deploy, not "later"):**
- `michael.md:87`: "`public.account_tier` | `free`, `tier1`, `tier2`, `tier3`, `tier4`" → add `tier99`.
- `multitenancy.md:233`: the tier table row ending at `tier4` → add `tier99` row + `pages.max` column header at line 227.
- `roma.md`: no current sentence about `pages.max` exists; the addition is net-new, not a correction.

**Files (absolute paths) the executor must touch (confirmed from code, supersedes the PRD's "Likely owners" list):**
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/types.ts` (line 1: `AccountTier`)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/matrix.ts` (line 6: `REQUIRED_TIERS`)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/authz-capsule.ts` (lines 101-112: `normalizePolicyProfile`)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/src/registry.ts` (add `pages.max` to `ENTITLEMENT_KEYS` + `PLAN_LIMIT_KEYS` + `ENTITLEMENT_META`)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/entitlements.matrix.json` (add `tier99` to `tiers[]` + a `tier99` cell for **all 13** entitlements + a new `pages.max` block)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/ai-runtime.matrix.json` (add `tier99` block for **both** `product.copilot` and `widget.instance.translator`)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-policy/tests/run-entitlements-matrix-invariants.ts` (line 9: extend `tiers`; add `pages.max` invariant row)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-contracts/src/ai.ts` (line 2: `AiPolicyProfile`) and `/Users/piero_macpro/code/VS/clickeen/packages/ck-contracts/src/ai-model-management.ts` (line 38: `AI_POLICY_PROFILES`, line 76 `policyProfile: 'tier4'` default)
- `/Users/piero_macpro/code/VS/clickeen/packages/ck-contracts/src/index.ts` or a new `page-source.ts` (the shared `AccountPageSource` type + validator — currently absent from ck-contracts)
- `/Users/piero_macpro/code/VS/clickeen/berlin/src/bootstrap/state.ts` (lines 80-91: `normalizeTier`)
- `/Users/piero_macpro/code/VS/clickeen/roma/lib/account-page-source.ts` + `roma/lib/account-page-direct.ts` (rewrite to the new shape; these currently own the type and the `metadata`/`localization` validator)
- `/Users/piero_macpro/code/VS/clickeen/roma/app/api/account/pages/route.ts` (add `resolvePolicyFromEntitlementsSnapshot` + `pages.max` gate before `createCompactPageId()`)
- `/Users/piero_macpro/code/VS/clickeen/supabase/migrations/` (new Tier99 enum + CHECK-constraint migration, modeled on `20260602120000__account_tier4.sql`)
- `/Users/piero_macpro/code/VS/clickeen/documentation/services/michael.md`, `documentation/capabilities/multitenancy.md` (tier tables)

**Verdict: APPROVE WITH CHANGES — the architecture is cohesive and V4/V5-safe, but the PRD must (1) correct the false "CLICKEEN is Tier 4" migration precondition to tier3, (2) name the CHECK constraints and the third tier authority (`ck-contracts/ai.ts`), and (3) tighten the V2 "empty-string social values" wording to assert equality with the blank-Page default before execution begins.**

---

## 4. Consolidated Verdict & Convergence

All three seats returned **APPROVE WITH CHANGES**. No seat BLOCKED. They converge on a small set of load-bearing defects and gaps that must be fixed in 127A before an AI executor can safely proceed without improvising.

### Convergent blockers-to-resolve (all three seats flagged)

1. **The "CLICKEEN is currently Tier 4" migration precondition is factually false — it is Tier 3 in deployed data.**
   (Staff Eng §4f; Principal TPM §1, §5)
   Grounded in `supabase/migrations/20260304090000__account_only_tenancy.sql:62` and `20260526110000__prd104a_admin_account_coordinate.sql:80`. As written, the Tier99 migration would always stop without changing any account, and an executor who trusts the prose would ship a no-op migration and report success (V6/V7 hazard). **Must correct the precondition to `tier3` or add a tier3→tier4 step.**

2. **The Page source contract's shared home is unnamed.**
   (Staff Eng §4a; Principal TPM §2)
   The PRD says "one shared code authority" without naming the package. Today no Page type exists in `packages/ck-contracts/`; the type is Roma-local and Tokyo stores `unknown`. An executor will guess where to put it and may split the type across Roma and Tokyo. **Must name `packages/ck-contracts/src/account-page.ts` (or equivalent) as the home.**

3. **Tier99 has a larger, partially-unlisted blast radius with module-load-time coupling.**
   (Staff Eng §3; Principal TPM §1, §2)
   Adding `tier99` to `REQUIRED_TIERS` forces a `tier99` cell in all 13 entitlements AND a `tier99` block for both AI agents in `ai-runtime.matrix.json`, or `ck-policy` throws at import on every cold start. The PRD lists these as separable work items; the validator makes them one atomic commit. Four hardcoded tier switches must all move in lockstep: `REQUIRED_TIERS`, `normalizeTier` (Berlin), `normalizePolicyProfile` (authz capsule), and `AI_POLICY_PROFILES` (ck-contracts). **Must name the atomic-commit requirement and all four switches.**

4. **The "Likely owners" file list is incomplete and will cause an executor to miss coupled files.**
   (Staff Eng §4c; Principal TPM §5)
   Missing: `roma/components/pages-domain.tsx` (1248 lines, deeply coupled to the destroyed `localization` shape), `roma/app/api/account/instances/[instanceId]/route.ts` (uses `pageIdsPlacingInstance`), `roma/tests/run-account-page-source.ts`. **Must add these to the owners list or an executor will leave broken references.**

### V1–V8 audit convergence

| Violation | Design posture | Notes |
| --- | --- | --- |
| V1 Silent substitution | AVOIDED (one migration gap) | Gated by the "prove locale matches baseLocale" precondition |
| V2 Silent healing | **AT RISK** | "Empty strings" migration rule needs an explicit invariant: migrated social fields must equal `defaultPageValues()` output |
| V3 Silent omission | AVOIDED | Migration step 3 stops on unmapped values |
| V4 Fail-open control | CLEAN (strongest area) | `pages.max` missing → 500; matrix validator throws on unknown tier |
| V5 Corruption-as-absence | CLEAN | Tokyo `loadStoredPageSource` already fails closed on parse errors |
| V6 Partial-success masquerade | CLEAN | 7-step deploy order separates outcomes |
| V7 Masquerade/redress | **AT RISK** | Step 7 (delete compatibility reader) must be a hard V7 gate, not a cleanup afterthought |
| V8 Runtime test dependency | CLEAN | Build-time gates only |

### Single-seat findings worth product-owner attention

- **Senior PM:** the Page-owned-overlay authoring burden is unaddressed — no slice in 127A–127F defines who generates Page-owned overlays, yet compilation fails without them. This is the biggest product scaling flaw.
- **Senior PM:** the Tier 1→Tier 2 Pages cliff (`0 → 3`) hides the flagship surface behind a second upsell.
- **Senior PM:** a `documentation/capabilities/pages.md` does not exist and should — every other first-class capability has a doc.
- **Staff Eng:** `isTemplate` and `socialImageAssetRef` are stored in 127A but unused until 127B/127F; the PRD should explicitly state no UI/badge/validation logic is built for them in 127A.
- **Staff Eng / TPM:** the migration's handling of old `countryLocaleRules: []` / `ipLocalizationEnabled: false` default values is undefined — "no exact destination" needs a threshold (default-value fields dropped; non-default fields block).
- **Principal TPM:** migration reversibility is behind competitors (Webflow/Shopify have rollback); the pre-migration R2 listing from step 1 should be retained as the recovery manifest.

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** 127A's architecture — placement-as-reference, `pages.max` at create, Tier99 as a non-superuser profile, baseLocale inheritance — is sound and thesis-aligned. Execution should not begin until the four convergent blockers are resolved in the PRD text, with the Tier 3 migration precondition and the shared-contract home as the two non-negotiable corrections.
