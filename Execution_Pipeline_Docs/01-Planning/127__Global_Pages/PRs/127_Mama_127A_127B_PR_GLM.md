# 127 Mama + 127A + 127B — Peer Review Appendix (GLM)

Status: **PEER REVIEW — CONSOLIDATED APPENDIX**

Subject: `127__PRD__Global_Pages_Program.md` (Mama), `127A__PRD__Page_Source_And_Policy.md`, `127B__PRD__Web_Code_Generator.md` — current versions on disk as of 2026-08-04.

Date: 2026-08-04

Model: builtin:zai-coding-plan/GLM-5.2

This appendix consolidates three peer reviews written under a locked mandate:
the product decisions in these PRDs are settled by the human product owner, and
the reviewers' job is (1) accuracy against the codebase and tenets, (2)
executor-readiness gaps where an AI will invent because a contract is unpinned,
and (3) documentation coverage. No redesign, no re-litigation, no invented
machinery, no competitor-benchmark mandates.

All three reviewers read every PRD and foundation doc fresh from disk and
grounded every accuracy claim in real files and line numbers.

The three reviews are reproduced verbatim in their authored order, followed by a
convergence note.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127 Mama + 127A + 127B — Staff Engineer Peer Review (GLM)

Scope note: this review covers the Mama (`127__PRD__Global_Pages_Program.md`), `127A__PRD__Page_Source_And_Policy.md`, and `127B__PRD__Web_Code_Generator.md`. Slices 127C–127F are named but out of scope here. All accuracy claims are verified against current files on disk.

#### 1. Elegant engineering and scalability

- **Single discriminated Page source contract (`isTemplate` flag, not a template subsystem).** 127A §"Source contract" (`127A__PRD__Page_Source_And_Policy.md:152-164`) unifies ordinary Pages and Page templates under one `AccountPageSource = AccountPage | AccountPageTemplate` union that shares `PageSourceCommon`. This composes cleanly with the existing `isCompactPageId`/`isCompactAccountPublicId` validators in `packages/ck-contracts/src/overlay-identity.ts` (consumed at `roma/lib/account-page-source.ts:6`) and avoids a parallel template storage tree — consistent with Tenet 8's single-account-root model.
- **Evidence-derived currency with no fan-out.** Mama tenet 9 (`127__…Program.md:43-45`) and §7 (`:517-525`) define `out_of_date` purely by comparing selected-package evidence against current Page/Instance-package/overlay fingerprints at list/open time, with explicit `Update page` as the sole repair. This keeps the write path explicit (no queue/poller) and is directly compatible with the existing package-fingerprint mechanism at `tokyo-worker/src/domains/pages/serve-state.ts` and `packages/ck-runtime-materializer/src/fingerprint.ts`.
- **Generator consumes only authorized booleans, never tiers.** 127B §"Public-search output" and product decisions 14/18 (`127B__…Web_Code_Generator.md:419-470`) keep `embed.seoGeo.enabled` resolution in Roma and feed the generator a single `seoGeoAeoEnabled` boolean. This is a clean separation that lets the generator stay deterministic and side-effect-free, matching the materializer's existing "never reads storage / calls a model" contract at `packages/ck-runtime-materializer/README.md:30-33`.
- **Reusing the existing composed-page runtime marker.** 127B §"Build Page `index.html`" (`127B__…:600-607`) stamps placement roots with "composed-Page coordinates." The runtime substrate already exists: `tokyo/product/widgets/shared/runtime.js:52-55` exposes `isComposedPage()` reading `data-ck-composed-page="true"`, and all eight widget `widget.client.js` files already consume `runtimeContext.composedPage`. No new browser discovery mechanism is needed.

#### 2. Compliance with architecture and tenets

- **Tenet 1 (structured artifacts): PASS.** 127A exports a typed conditional union from `packages/ck-contracts/src/page-source.ts` (to be created) and makes Roma + Tokyo-worker import it (`127A__…:343-346`). Today both sides declare their own shape: Roma at `roma/lib/account-page-direct.ts:49-59` and Tokyo-worker treating source as `unknown` at `tokyo-worker/src/domains/pages/source.ts:100`. Consolidating is a Tenet 1 win.
- **Tenet 2 (named authorities): PASS.** Mama §11 authority table (`127__…Program.md:780-798`) keeps Roma = account/policy, Tokyo-worker = storage, Web Code Generator = final files. This matches `documentation/architecture/Overview.md:89-104`.
- **Tenet 3 (no silent substitution): PASS.** 127A validation rules (`127A__…:172-202`) and Mama §13 (`127__…:898-920`) require missing locale/overlay/Instance to fail explicitly. Aligns with `OverlayArchitecture.md:50` (missing/malformed overlays are corruption).
- **Tenet 4 (no silent healing): PASS.** 127A "Stored source is corrupt → Report corruption; never treat it as a blank Page" (`127A__…:446`).
- **Tenet 6 (widget software is product truth): RISK.** 127B §"The file law" (`127B__…:126-155`) renames the widget source contract from `widget.html`/`widget.css`/`widget.client.js` to `index.html`/`styles.css`/`runtime.js`. Tenet 6 (`Tenets.md:182-205`) and `documentation/widgets/authoring/WidgetFiles.md:5-15` currently specify the OLD six-file contract. This is a deliberate contract change with explicit doc updates listed (Mama §14, 127B "Required documentation"). The contract migration is compliant *if* the doc updates land with the code; until then the in-tree tenet and the PRD contradict each other (see §5).
- **Tenet 7 (Bob edits in browser memory): PASS.** 127B §"Bob and Instance Save" (`127B__…:519-557`) keeps persistence behind explicit Save through Roma.
- **Tenet 8 (storage follows ownership): PASS** for the account root. Mama §3 (`127__…:166-188`) keeps everything under `accounts/{accountPublicId}/pages/{pageId}/`. **RISK**: the new `packages/{packageFingerprint}/` subfolder (Mama `:173`) conflicts with the current FLAT key shape at `tokyo-worker/src/domains/pages/keys.ts:21-23` (`{pageId}/index.html`) and the cache-purge list at `tokyo-worker/src/domains/pages/package-files.ts:31`. 127C owns the R2 writes (Mama `:434-437`), so this is expected — but 127A/127B must not assume the subfolder exists.
- **Tenet 11 (public serving reads stored artifacts): PASS.** Mama §6 (`127__…:416-475`) keeps public requests off models/Supabase/generation. 127B §"Slice boundary" (`127B__…:489-491`) explicitly disclaims Page routes/caching.
- **Tenet 13 (docs are operator truth): RISK.** `documentation/capabilities/seo-geo.md:144` already references `seoGeoAeoEnabled` (future field) and `:218` already says "current JavaScript branding… until 127B is deployed." The field does not exist in any code today (verified: no `seoGeoAeoEnabled` in `packages/ck-contracts/src/` or Roma/Tokyo). This is a pre-existing doc/future-state drift, not introduced by these PRDs, but the PRDs depend on it. See §5.
- **Tenet 14 (tier-gated actions visible): PASS.** Mama tenet 15 (`127__…:63-67`), §10 (`127__…:720-757`), and 127A product rule 13 (`127A__…:87-90`) all codify the visible-action Upgrade law and name Save-as-template as the sole contextual exception — matching `Tenets.md:396-403`.
- **V1–V8: PASS at contract level.** 127A and 127B both carry explicit V1–V8 audit sections. V5 (corruption-as-absence) and V7 (no parallel path) are the two most exposed by this slice; both are called out.

#### 3. Over-architecture / unnecessary complexity IN THE PRD

No findings. The PRDs are deliberately lean. They repeatedly refuse machinery: Mama §11 "does not include" list (`127__…:806-816`), 127A "Do not build a generalized Page-source migration system" (`127A__…:325`), 127B §"Slice boundary" refusing Queues/registries/generic editors (`127B__…:494-496`). The only structural addition is the `packages/{packageFingerprint}/` storage subfolder, which is a legitimate atomic-install mechanism owned by 127C and explicitly bounded ("Tokyo keeps only the current package and the immediately previous working package," Mama `:186-188`).

#### 3b. Academic / theoretical abstractions and gold-plating IN THE PRD

- **The "Web Code Generator as Clickeen's expert frontend developer expressed as a deterministic service" framing** (Mama `127__…:253-272`, repeated 127B `127B__…:55-71`) is aspirational prose. The *contract* (three files in, three files + private locale data out, deterministic, fail-visible) is concrete and executable. The "expert frontend developer" persona is untestable and an executor cannot derive a check from it. It does not cause invention by itself because the surrounding bullet list (`127__…:258-272`) is operational, but it is gold-plating that could be trimmed without loss.
- **The "Why this supports SEO, geographic delivery, GEO, and AEO" section** (Mama `127__…:476-494`) is marketing/positioning rationale, not a contract. It is correctly walled off from the normative sections and does not ask for new machinery, so it is harmless; flagged for completeness.
- **The Mama's `<meta name="generator" content="Clickeen">` rule** (Mama `127__…:311`, 127B `127B__…:251`) is a *new* output requirement, not gold-plating — it does not exist in the current materializer head (`packages/ck-runtime-materializer/src/html.ts:109-115`, which emits only charset/viewport/title). Listed here only so it is not mistaken for existing behavior.

No other academic abstractions. The identity map (127B `127B__…:272-299`) is typed and ships with the generator; it is not a runtime lookup service.

#### 4. Prose that leaves executors room to invent

This is the highest-risk section. Each item quotes the PRD sentence and names the guess.

1. **127A `127A__PRD__Page_Source_And_Policy.md:155-157`** — `overlays: Record<string, { values: PageOwnedValues }>` for `AccountPage`. The Page-overlay value shape is given only as "one exact entry for every selected non-base locale" (`:184-185`) keyed by locale string. An executor will guess: is the key the bare locale (`"es"`), a BCP-47 lowercased tag matching `normalizeLocale` (`roma/lib/account-page-source.ts:18`), and does each `values` strictly equal a `PageOwnedValues` (all five fields required) or a partial? The grammar is unpinned.

2. **127B `127B__PRD__Web_Code_Generator.md:591-592`** — "every saved `index.html` contains one complete stamped Widget root and no nested document shell." The word "stamped" is undefined for Page input. Today `stampPackageRoot` (`packages/ck-runtime-materializer/src/html.ts:55-97`) stamps `data-ck-widget` + `data-ck-instance-id` on Instance save. An executor will guess which attributes identify a "complete stamped Widget root" when reading a saved Instance file inside Page generation (does it require `data-ck-instance-id`? `data-ck-placement-id`? both?), and what "nested document shell" detection means operationally.

3. **127B `127B__PRD__Web_Code_Generator.md:604-606`** — "stamp the Page placement with the existing Widget, Instance, placement, and composed-Page coordinates." "Existing … coordinates" is asserted but not specified. An executor will guess the attribute names (e.g., `data-ck-page`, `data-ck-placement`, `data-ck-composed-page="true"`). The runtime already reads `data-ck-composed-page="true"` (`tokyo/product/widgets/shared/runtime.js:54`) and `data-ck-instance-id` (`:29-44`), but Page-placement stamping is new and the exact attribute contract is not pinned.

4. **127B `127B__PRD__Web_Code_Generator.md:641-647`** — "identify existing shared/Dieter chunks through their current stable markers" (CSS) and the parallel rule for JS (`:659-663`, "fail if one stable chunk identity has conflicting bytes"). "Current stable markers" and "stable chunk identity" are asserted to already exist but are not named. An executor will guess what a "stable marker" is (an HTML comment? a `data-ck-chunk` attribute? a CSS `/* ck-chunk:dieter-core */` banner?) and what "chunk identity" hashes (name only? name+version?). The widget CSS/JS files (`tokyo/product/widgets/shared/*.css|.js`) contain no visible chunk-marker convention today.

5. **127B `127B__PRD__Web_Code_Generator.md:672-685`** — private Page locale data "contains placement values keyed by stable placement ID and exact existing Instance field path… Concrete field paths such as `items.0.title` are required." "Exact existing Instance field path" is given by one example. An executor will guess the path grammar (dot-separated? bracket? how are array indices expressed for repeatable controls?), and whether it must match the Bob `editable-fields.json` path set exactly or the `instance.content.json` key set.

6. **Mama `127__PRD__Global_Pages_Program.md:435-437`** — "127C must define the exact R2 writes and selection using existing Tokyo-worker storage operations; it must not create a new service or public Build/version product." This pushes the `packages/{packageFingerprint}/` install detail to 127C, which is fine, but 127B's Page-generation result (`127B__…:717-725`) returns "file, locale-data, and internal package fingerprints" that 127C must consume. The handoff contract between 127B's outputs and 127C's install is not specified anywhere in these three PRDs. An executor of 127B will guess which fingerprint shapes 127C needs.

7. **127B `127B__PRD__Web_Code_Generator.md:76-78`** — "The serving-code responsibility currently carried by `@clickeen/ck-runtime-materializer` must move into that authority; the old and new systems cannot survive as parallel paths or wrappers." Today the materializer is Instance-only: `RuntimeMaterializerArtifactCoordinate.kind = 'account-instance-widget'` (`packages/ck-runtime-materializer/src/types.ts:22-26`) and the contract version is `'ck-runtime-materializer:126-overlay-runtime'` (`:4`). "Move serving-code responsibility out" concretely means either (a) extend this package with a Page coordinate kind + Page logic, or (b) create a new package and delete this one. The PRD defers this to "the accepted detailed specification" (`:78`). This is the settled-ambiguity the rules say to flag once: **the "service" vs "package" home of the Web Code Generator is unpinned.** An executor will guess.

8. **Mama `127__PRD__Global_Pages_Program.md:308-310`** — "Generated documents identify the generating software with `<meta name="generator" content="Clickeen">`." Required output, but the materializer's `buildIndexHtml` (`packages/ck-runtime-materializer/src/html.ts:109-115`) emits no such tag today. An executor will guess where the tag lives (Instance `index.html` head? Page head only? both?) and whether it is added by the generator or by Tokyo at serve time.

9. **127A `127A__PRD__Page_Source_And_Policy.md:197`** — "An `instanceId` may appear once in the first Pages release." "May appear once" is permissive; an executor will guess whether a second occurrence is a validation rejection or silently deduplicated. The validation-rules section (`:172-202`) does not state the failure.

10. **127A `127A__PRD__Page_Source_And_Policy.md:131-141`** — `PageOwnedValues` requires `socialTitle`, `socialDescription`, and optional `socialImageAssetRef`. These fields do not exist in the current Page source (`roma/lib/account-page-direct.ts:29-47` has only `title`/`description`/`robots`/`canonicalUrl`). The PRD does not state whether empty strings are valid for `socialTitle`/`socialDescription` on a new Page or whether they must be customer-authored before Save. An executor will guess the required-ness semantics for social fields.

11. **127B `127B__PRD__Web_Code_Generator.md:272-299`** — the `ClickeenPublicProductIdentityMap` type uses `WidgetType` as a `Record` key, but `WidgetType` is not an exported type in `packages/ck-contracts/src/index.ts` and widget identity today is the `widgetname` string in each `spec.json` (verified for all 8 widgets). An executor will guess whether `WidgetType` is a new string-union to be added to contracts, a synonym for the spec `widgetname`, or the literal widget folder name.

12. **127A `127A__PRD__Page_Source_And_Policy.md:262` (table)** lists `tier99 | null` for `pages.max`, and Mama §10 (`127__…:729-730`) lists `tier99 | unlimited (null)`. But the policy matrix validator `assertEntitlementsMatrix` (`packages/ck-policy/src/matrix.ts:6,11-20,48-52`) hard-requires `REQUIRED_TIERS = ['free','tier1','tier2','tier3','tier4']` and rejects unknown tiers. Adding `tier99` to the JSON *without* adding it to `REQUIRED_TIERS` throws "Unknown policy tier." An executor will guess whether `REQUIRED_TIERS` is updated in the same edit or whether `tier99` lives outside `REQUIRED_TIERS` (which then breaks the per-tier value requirement at `:82-95`).

13. **127A `127A__PRD__Page_Source_And_Policy.md:262`** — `pages.max` is listed as a new entitlement, but the registry `ENTITLEMENT_KEYS` (`packages/ck-policy/src/registry.ts:2-16`) is a readonly tuple and `assertEntitlementsMatrix` rejects unknown keys (`matrix.ts:58-62`). An executor will guess whether `pages.max` is a `flag` or `limit` (the PRD table implies `limit`), and whether it belongs in `PLAN_LIMIT_KEYS` (`registry.ts:26-37`). The PRD does not say.

#### 5. Needed documentation / updates (DEV perspective)

**Docs the PRDs correctly identify as needing updates — confirmed**

- **`documentation/widgets/authoring/WidgetFiles.md`** — Becomes false on 127B. Today it states the six-file source contract `widget.html`/`widget.css`/`widget.client.js` (`:5-15`) and maps each to materialization (`:27-29, :38-40`). After 127B it must say the widget source contract is `index.html`/`styles.css`/`runtime.js`, drop the "Static Shell/Core DOM skeleton" framing for `widget.html` (since `index.html` must now contain complete default content, not a skeleton), and reconcile the "Source Vs Compiled Package" section (`:48-73`) which currently says generated `styles.css`/`runtime.js` are *sealed from* `widget.css`/`widget.client.js` — under the new law the source files ARE the same names as the output files.
- **All 8 widget docs under `documentation/widgets/widgets/`** (`big-bang.md`, `calltoaction.md`, `cards.md`, `countdown.md`, `faq.md`, `logoshowcase.md`, `split-carousel-media.md`, `split-media.md`) — 127B `:897` names "all eight affected Widget docs." Any file-reference prose in them becomes false when `widget.client.js`/`widget.html`/`widget.css` are renamed. Confirmed count is 8 widget docs + 1 README.
- **`documentation/widgets/shared/ShellUtilities.md`** — Mama `:986` names it for "the branding cutover." 127B step 13 (`127B__…:769-772`) replaces `CKBranding.applyBacklink` DOM construction with generated markup. `tokyo/product/widgets/shared/branding.js:141-150` currently builds the badge in JS with `link.href = 'https://clickeen.com'` and `rel = 'noreferrer'`. Doc must state that branding is generated HTML/CSS, with `rel="nofollow noreferrer"` (the PRD's relation, which is stricter than today's `noreferrer`).
- **`documentation/architecture/OverlayArchitecture.md`** — Becomes partially false. It documents the Instance overlay shape only (`:19-31`); 127A introduces Page-owned overlays (`AccountPage.overlays`) with a different value type (`PageOwnedValues`, not the Instance `values` map). Must add the Page-overlay contract and the private Page locale-data artifact (`overlays.json`, Mama `:176`) which is explicitly "not a fourth public Page file."
- **`documentation/services/roma.md`** — Becomes false in multiple places. `:453-466` describes the *current* Page source (`metadata`, `localization.defaultLocale`, `countryLocaleRules`, `ipLocalizationEnabled`, `missingLocaleBehavior`) which 127A wholly replaces with `baseLocale`/`values`/`robots`/`overlays`/`seoGeoAeoEnabled`/`isTemplate`. `:337` ("Widget catalog renders the canonical widget definitions as Dieter-styled cards") becomes false when 127F replaces definition cards with `CLICKEEN` Widget templates (Mama `:713-717`).
- **`documentation/services/tokyo-worker.md`** — `:160-182` describes Page source at `source.json` and package files at the flat `{pageId}/` root. The Mama's `packages/{packageFingerprint}/` subfolder (`127__…:173`) changes the package-file location; the doc must be updated when 127C lands (127B correctly defers the tokyo-worker doc update to "after 127C consumes Page completion," `127B__…:895`).
- **`documentation/architecture/CONTEXT.md`** and **`Overview.md`** — Both state the Page storage shape without the `packages/{fingerprint}/` subfolder (`CONTEXT.md:241-248`, `Overview.md:158-165`). Update on 127C.
- **`documentation/architecture/Tenets.md`** — Tenet 6 (`:182-205`) hard-specifies the six widget source files. Update on 127B to the three-file law, or add a forward reference. Currently the tenet and 127B contradict.
- **`documentation/architecture/AccountManagement.md`** — 127A `:486` lists it for Tier99. `:160` documents `accounts(id,status,status_changed_at,tier,created_at)` with `account_tier` enum implicitly 5-valued; Tier99 adds a sixth. Update on 127A.
- **`documentation/capabilities/localization.md`, `multitenancy.md`** — listed by 127A (`:488-489`) and Mama (`:977`). Confirmed to exist. `multitenancy.md` must state the Tier99 = non-sellable CLICKEEN profile.

**Docs the PRDs list that likely do NOT need changing (flag for trimming)**

- **`documentation/strategy/WhyClickeen.md`, `MarketPosition.md`, `GlobalReach.md`** (Mama `:983-984`). These are strategy/positioning docs, not operator truth. The Mama asserts they need updates "for product-led distribution and language-truth doctrine," but Tenet 13 (`Tenets.md:354-366`) says `documentation/` is current-system operator truth, not strategy. Unless these files currently state something factally false about runtime behavior, they should be reviewed for *accuracy* only, not doctrine edits — otherwise this is scope creep into strategy docs under a Pages PRD.
- **`documentation/ai/sanfrancisco.md`** (127A `:491`). 127A adds Tier99 to San Francisco's `AI_POLICY_PROFILE_SET` (`sanfrancisco/src/grants.ts:7`). The doc update is real but tiny — one line that the AI policy profile set includes `tier99`. Confirm the doc currently lists the set before editing.

**Docs the PRDs MISS entirely**

- **`packages/ck-runtime-materializer/README.md`** — This is the canonical operator doc for the package 127B explicitly retires ("the serving-code responsibility currently carried by `@clickeen/ck-runtime-materializer` must move into that authority," `127B__…:76-78`). Neither Mama §14, 127A, nor 127B "Required documentation" lists this README. It must be updated/replaced when the generator's execution home is decided (the open package-vs-Worker question). This is the single largest doc miss.
- **`packages/ck-policy/` registry/matrix docs** — 127A adds `pages.max` and `tier99`, which require coordinated edits to `packages/ck-policy/src/registry.ts` (ENTITLEMENT_KEYS, PLAN_LIMIT_KEYS, ENTITLEMENT_META), `packages/ck-policy/src/types.ts` (`AccountTier`), `packages/ck-policy/src/matrix.ts` (`REQUIRED_TIERS`), `packages/ck-policy/entitlements.matrix.json`, `packages/ck-policy/ai-runtime.matrix.json`, plus the exhaustive test `packages/ck-policy/tests/run-entitlements-matrix-invariants.ts`. None of these are documentation per se, but the registry's `ENTITLEMENT_META` entries (`:50-168`) are effectively operator-readable docs and need a `pages.max` entry.
- **`admin/src/html/tools/entitlements.html`** — 127A `:383` names it. The DevStudio entitlements tool hardcodes `preferredTierOrder = ['free','tier1','tier2','tier3','tier4']` (`entitlements.html:1173`). This is operator-facing UI; it must render Tier99 and `pages.max`. Not a doc but a UI surface the PRD correctly calls out.
- **`documentation/services/devstudio.md`** — 127A `:493` lists it. Confirmed needed because the entitlements tool changes.
- **`AGENTS.md`** — Not listed by any PRD. `:185-193` and `CONTEXT.md:347-358` describe deploy/verify surfaces. Adding a Web Code Generator authority (new named service/package) is a peer to the "Product Copilot Worker" / "Translation Agent Worker" entries in `CONTEXT.md:179-183`. If the generator is a Worker, it joins the System Map (`CONTEXT.md:196-210`); if it is a package, it does not. Either way AGENTS.md/CONTEXT.md must name it. The PRDs list CONTEXT.md/Overview.md but not AGENTS.md's authority gate.

**Whether `documentation/capabilities/pages.md` should exist**

Yes. There is no `documentation/capabilities/pages.md` today (confirmed: only `localization.md`, `multitenancy.md`, `seo-geo.md`, `supernova.md` exist). Pages is a first-class product capability spanning source, generation, publication, currency, templates, and tier policy — comparable in surface area to localization. A `pages.md` capability doc is the right home for: the three-file law, `pages.max` semantics, Page currency states, the Save/Update/Publish operation model, and the template/Catalog rule. Both the Mama (`:971-988`) and 127A (`:484-496`) "Required documentation" lists omit it; they scatter Pages truth across CONTEXT.md, Overview.md, roma.md, and tokyo-worker.md instead. A dedicated capability doc would consolidate the operator contract and is the natural pair to `seo-geo.md` (which already exists for the related entitlement).

**Where the Web Code Generator contract documentation should live**

Given the materializer's current README at `packages/ck-runtime-materializer/README.md` (47 lines, "Pure builder for the one public root artifact of a saved widget instance," contract version `ck-runtime-materializer:126-overlay-runtime`), the generator contract doc should live at the generator's accepted execution home once decided:

- If the generator is a **package** (e.g., `packages/ck-web-code-generator/`), the contract doc should be that package's `README.md`, mirroring the materializer's pattern (Purpose / Contract / Forbidden / Commands). The materializer README must then be deleted or rewritten to point to the new authority — not left as a stale parallel contract.
- If the generator is a **Worker** (e.g., `web-code-generator/`), the contract doc should be `documentation/services/web-code-generator.md`, matching the pattern of `documentation/services/tokyo-worker.md`, `berlin.md`, `sanfrancisco.md` for the other Worker authorities named in Mama §11.

127B `:898` says "the Web Code Generator operator/package documentation at its accepted home" — correctly deferring to the home decision, but the materializer README (`packages/ck-runtime-materializer/README.md:5`) is the doc that becomes false the moment 127B's Instance-generation contract replaces `materializeRuntimePackage`. It must be updated in the same slice that moves the responsibility, not left for later.

**One-line verdict:** APPROVE WITH CHANGES — the contract is sound and compliant; the gaps are unpinned prose (§4 items 1–6, 10–13) and the open generator-home question (§4 item 7), not product-design defects.

---

## 2. Senior Product Manager Peer Review

### 127 Mama + 127A + 127B — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

- **The three-file law as the unifying contract.** Tenets 3-4 in the Mama, plus 127B's "file law" section, make Widget/Instance/Page share one serving contract (`index.html` + `styles.css` + `runtime.js`) that differs only in *how the files are produced* (Bob customizes one Widget; the Web Code Generator combines several Instances). This is elegant because it lets Page serving reuse the exact existing Instance serving path and lets "Page currency" reduce to a fingerprint comparison — no new serving tier, no browser assembly. Code grounding confirms this is a true *restoration*, not an invention: every shipped widget (`tokyo/product/widgets/*/`) already ships `widget.html`/`widget.css`/`widget.client.js`, and the Instance folder (`roma/lib/account-page-direct.ts`, `AccountManagement.md` storage shape) already stores `index.html`/`styles.css`/`runtime.js`. The PRDs rationalize names and remove the shell drift; they do not invent a parallel model.
- **Three verbs kept distinct (Save / Update / Publish) with evidence-derived currency.** The Mama's §6-7 and 127A's product rules make `out_of_date` a *derived* state from fingerprint comparison, not a written flag or a fan-out job. This scales: an Instance Save performs zero Page work; currency is recomputed lazily at list/open/publish. This is the right design for an account-owned R2 product with no background worker — it avoids the exact queue/graph/poller machinery the PRDs explicitly forbid.
- **`pages.max = 0` as a visibility-with-denial pattern, and Tier99 as a non-sellable mirror of Tier 4.** Both reuse the existing entitlement matrix and tier enum rather than adding a boolean or a policy layer. Code grounding confirms `pages.max` and `tier99` do not yet exist in `entitlements.matrix.json`/`registry.ts` — so the PRDs are correctly described as *additions through the same system*, and the `0`-means-denied-but-visible semantics align with the established "everything visible to every tier; access controlled by tier" law in `CONTEXT.md` and `roma.md`.
- **Page templates as `isTemplate: true` on the same Page contract, not a subsystem.** 127A's discriminated union (`AccountPage | AccountPageTemplate`) and the Mama's §9 keep one Page authority, one storage root, one editor. The "templates have no selected locales/overlays/translations" rule is enforced by the discriminator, and `seoGeoAeoEnabled` is rejected on templates because they never generate. This is a clean way to get Catalog behavior without a Catalog object.

#### 2. Compliance with Product UX best practices

Standard SaaS UX law is applied only where it surfaces a real accuracy/alignment or executor-guess problem.

- **The `out_of_date` hard modal is internally consistent and matches best-practice "blocking gate with one primary resolution."** Mama §7, §13 and 127B product decision 9 specify: primary action is **Update page**, prior package stays live, `save_failed` is a *separate* state that remains editable without this modal. This separation is important because it prevents the V6 (partial-success masquerade) and V5 (corruption-as-absence) failures: a `save_failed` Page is not silently treated as `out_of_date`. No finding against the settled modal — it is correct as written.
- **Real accuracy issue — `AccountManagement.md` and `multitenancy.md` already state the Free/Tier1 = 0 + retained-visibility law as *planned 127 behavior*, but `pages.max` is not in the matrix.** The capability doc (`multitenancy.md` lines 290-297) explicitly says "PRD 127 also adds `pages.max` through the same policy system" and restates the visibility/denial law. This is forward-looking doc, not current truth, and it is labeled as such. No accuracy violation, but it means an executor reading these docs *today* will see `pages.max` language that the matrix does not yet contain — the doc/PRD alignment is correct *as a plan*, and the PRDs are honest that this is unbuilt. No change requested; flagged for §5.
- **`embed.seoGeo.enabled` registry-vs-runtime conflict is carried forward unresolved.** `multitenancy.md` lines 274-278 and 333 flag that the registry marks `embed.seoGeo.enabled` as `enforced` but no proven runtime consumer exists. The PRDs (Mama §5, 127B §"Customer SEO/GEO/AEO enhancement") correctly make Roma the enforcement owner and treat this as a gap to close — they do not pretend the gate already works. This is the right product stance. The executor risk is low because 127B explicitly owns "Roma Save enforcement" of the flag. No finding against the PRDs; the underlying registry/runtime mismatch is pre-existing and out of scope.
- **Executor will guess on one point: the relationship between the new `seoGeoAeoEnabled` Instance/Page source field and the existing `embed.seoGeo.enabled` entitlement key.** Mama §5 and 127B clearly separate them (entitlement = gate; source field = authorized input to the generator). But neither PRD states whether the *old* `embed.seoGeo.enabled` flag is retired, renamed, or kept as-is once `seoGeoAeoEnabled` exists. 127B code-work item 10 says "consume the Page field deployed by 127A" and "add the ordinary Instance `seoGeoAeoEnabled` source field," and the Mama keeps `embed.seoGeo.enabled` as the entitlement. This is consistent, but an executor could reasonably ask: does the registry key name stay `embed.seoGeo.enabled` while the source field is `seoGeoAeoEnabled`? The PRDs imply yes (different layers, different names) but never state it. Minor unpinned point — recommend a one-line clarification in 127B that the entitlement key name is unchanged and only the per-object source field is new.

#### 3. Bad UX writing for the user (if present)

Reviewing only genuine user-facing copy that leaks.

- **The `out_of_date` modal copy is factually accurate and correctly scoped.** Mama §7 gives the modal text:
  > Page needs updating — One or more widgets in this page have changed. Update the page to edit it.

  This matches the product behavior (one or more referenced Instances/overlays changed; Update is the only resolution). It does not leak internal terminology ("package fingerprint," "out_of_date," "Web Code Generator") to the user. No finding.
- **The customer-facing status labels "Current / Needs update / Needs fixing" are clear and match the three internal states** (`current | out_of_date | save_failed`). The mapping in Mama §8 is one-to-one and uses plain language. No finding.
- **No other user-facing copy in the three PRDs leaks internal contract terms.** Terms like `baseLocale`, `serve-state.json`, `packageFingerprint`, `overlays.json`, `Web Code Generator`, `embed.seoGeo.enabled`, `tier99`, `pages.max`, `isTemplate` appear only in internal/contract context, not in customer-rendered strings. The customer-visible controls are named "Enable SEO/GEO/AEO," "Save," "Update page," "Publish," "Use template," "Save as template" — all plain and accurate.

No findings.

#### 4. Alignment with "Clickeen is different from legacy SaaS" (product perspective)

Where the PRDs reinforce the thesis, stated as fact (not re-litigation of settled decisions).

- **The three-file law is the strongest thesis reinforcement in the program.** `WhyClickeen.md` and `CONTEXT.md` define the moat as "structured, AI-legible schema that agents operate" and "fail-visible behavior instead of silent fallback." 127B's removal of the shell/state/client-render path (confirmed in code: `widget.html` files are DOM shells with empty `data-role` containers and a `widget.client.js` that fills them) directly restores the "stored artifact is the product" principle that distinguishes Clickeen from the Elfsight-style loader architecture 127B names explicitly. This is the program doing the thesis work, not describing it.
- **Source-truth fidelity is applied consistently across all three source authorities** (`AGENTS.md` Content Source Authority). The PRDs treat Page-owned values, Page overlays, and Instance overlays as authoring source (human-generated); the Web Code Generator output as derived (AI-generated under product rules); and asset/typography coordinates as referenced truth that must resolve through the existing asset authority (integration/account-sourced). The generator "does not invent customer content, missing values, product behavior, or design-system rules" (127B) — this is the source-truth fidelity rule from `CONTEXT.md` applied to a new surface.
- **Tier99 and `pages.max` extend the lean entitlement/tier substrate rather than adding product machinery.** `WhyClickeen.md` warns against "framework machinery, compatibility wrappers, broad registries." The PRDs add one enum value and one limit key through the exact existing `@clickeen/ck-policy` system (confirmed: `registry.ts` + `entitlements.matrix.json` are the typed source of truth) and explicitly forbid a Tier99 policy layer, a Page-specific policy service, or a counter store. This is the moat discipline applied to commercial boundaries.
- **The identity-map-as-reviewed-product-data decision keeps distribution honest without a crawler/agent.** `WhyClickeen.md` Product-Led Distribution section requires "real authoritative product pages" and "consistent machine-readable product identity." 127B's identity map is "product data inside the generator authority, not a new service, agent, crawler, registry API, or request-time lookup" — it ships with the generator and is reviewed like code. This avoids the V8 (runtime test dependency) and V1 (invented claims) failures while still producing the crawlable attribution loop the thesis requires. The `rel="nofollow noreferrer"` choice and the "Clickeen is software/service, never author/owner" rule are factually aligned with the "never compromise source-truth fidelity" tenet.
- **Fail-visible is operationalized, not just stated.** 127B's failure table and V1-V8 gate, 127A's "stored source is corrupt → report corruption, never treat as blank," and the Mama's §13 requirement that "no missing Instance, overlay, locale, package, or entitlement is silently substituted" all map directly to the V1/V2/V5 violations in `AGENTS.md`. The PRDs do not just cite the law; they enumerate the exact failure coordinates (Page/placement/Instance/locale/field/asset/chunk) the generator must name.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

This is the primary deliverable. I cross-checked the PRDs' own doc lists (Mama §14, 127A "Required documentation," 127B "Required documentation") against what each slice actually changes and against current doc contents read fresh from disk.

**A. Docs the PRDs correctly identify and that genuinely need updates**

| Doc (full path) | What product truth it needs | PRD list accurate? |
| --- | --- | --- |
| `documentation/architecture/CONTEXT.md` | Storage shape (lines 222-248) currently shows flat `pages/{pageId}/source.json + serve-state.json + index.html/styles.css/runtime.js`. Must move to the 127A package-folder shape (`packages/{packageFingerprint}/...` + private `overlays.json`) and state the three-file Widget/Instance contract as current law. Also: System Map and Authorities get Tier99 and the Web Code Generator authority. | Yes — listed by all three PRDs. |
| `documentation/architecture/OverlayArchitecture.md` | Must record that Page overlays are Page-owned source in `source.json`, while Instance overlays stay at `overlays/locales/{locale}.json`; and that 127B emits private Page locale data (`overlays.json` inside the package) consumed by Tokyo at cache-miss, *not* a fourth public file. | Yes — listed by Mama and 127A. |
| `documentation/capabilities/localization.md` | Currently (read fresh, dated 2026-07-30) already has a 127-anticipating paragraph (lines 19-26) and the widget overlay contract. Needs the **Page-overlay + private locale-data** story added: Page `overlays` live in `source.json` (Page-owned values only), the generator produces private per-package locale data, and Tokyo completes HTML at cache miss. The PRDs do not yet make this distinction legible in localization.md. | Yes — listed by all three. This is a real gap to fill, not just a touch. |
| `documentation/capabilities/multitenancy.md` | Already (read fresh) contains the `pages.max` planned-127 paragraph (lines 290-297) and the Free/Tier1=0 visibility law. After 127A deploys, this converts from "planned 127 behavior" to current truth: add `pages.max` to the entitlement table (lines 232-246), add `tier99` to the tier values, and drop the "planned" framing. | Yes — listed by 127A. The PRD's own forward-looking text here is accurate *as a plan*. |
| `documentation/capabilities/seo-geo.md` | Currently (read fresh) a "DIRECTIONAL CAPABILITY NOTE" with `embed.seoGeo.enabled` gap language. After 127B, this becomes a real capability: complete-HTML baseline for all tiers, the `seoGeoAeoEnabled` per-object source field, the Roma Save enforcement, and the generator's enhanced output. Also must record the `branding.remove` vs `embed.seoGeo.enabled` separation and the Clickeen identity-map distribution loop. | Yes — listed by Mama and 127B. The doc's current "directional, not fully specified" status (line 4) is exactly what 127B resolves. |
| `documentation/services/roma.md` | Owns Pages Domain (lines 441-466), which still describes the *old* Page source shape (placement references, no package writer, publish disabled). Must be rewritten for: 127A source contract, 127B generator invocation on Save/Update, 127C publish/serving, 127D currency, 127E Page Builder, 127F templates. The PRD list is accurate; the *scope* of the rewrite is larger than a touch. | Yes — listed by all three. |
| `documentation/services/bob.md` | Currently documents the `widget.html`/`widget.css`/`widget.client.js` file shape (lines 332-356) and the open/save contract. 127B's three-file cutover (`index.html`/`styles.css`/`runtime.js`) and removal of the client-render path change the Widget Software section, the Save Contract, and the Open Contract. | Yes — listed by Mama and 127B. |
| `documentation/services/tokyo-worker.md` | After 127C consumes Page completion, must document fingerprinted package install, last-good retention, locale completion at cache miss, and the private `overlays.json` input. 127B correctly defers the 127C-dependent parts ("after 127C consumes Page completion"). | Yes — listed by Mama and 127B (with the correct deferral). |
| `documentation/widgets/authoring/WidgetFiles.md` + the 8 widget docs | The widget file shape change (`widget.*` → three-file) is the core of 127B's cutover. Confirmed 8 widgets exist (`big-bang, calltoaction, cards, countdown, faq, logoshowcase, split-carousel-media, split-media`). | Yes — listed by Mama and 127B. |
| `documentation/services/berlin.md`, `michael.md` | Tier99 enum addition touches the persisted tier row (Michael/Supabase) and the bootstrap capsule (Berlin). | Yes — listed by Mama and 127A. |
| `documentation/ai/sanfrancisco.md` | Tier99 must be accepted in San Francisco grant validation (127A code checklist). | Yes — listed by 127A. |
| `documentation/services/devstudio.md` | DevStudio surfaces entitlements (127A lists `admin/src/html/tools/entitlements.html`); the doc should reflect Tier99 + `pages.max`. | Yes — listed by 127A. |

**B. Docs the PRDs miss or under-specify**

- **`documentation/capabilities/pages.md` — does not exist and arguably should.** There is a capability doc for `localization`, `multitenancy`, `seo-geo`, and `supernova`, but Pages is currently documented only as a section inside `roma.md` and `CONTEXT.md`. After this program, Pages becomes a first-class account-owned product surface with its own source contract, generator authority, currency model, publication/serving, and template/catalog rules. The Mama's doc list (§14) does not propose a `pages.md`. **Recommendation: the program should create `documentation/capabilities/pages.md` as the Pages capability owner, mirroring the structure of `localization.md`/`multitenancy.md`.** This is the single largest doc-coverage gap. Without it, Pages truth stays fragmented across roma.md, OverlayArchitecture.md, and the PRDs themselves (which are planning history, not current truth per AGENTS.md).
- **`documentation/capabilities/localization.md` needs the Page-overlay + private locale-data story explicitly.** The PRDs list localization.md, but the *content* gap is specific: the doc currently only covers Instance overlays (`overlays/locales/{locale}.json`). It must add (a) Page-owned overlays as `source.json` fields, (b) the generator's private per-package locale artifact, and (c) the rule that this private artifact is Tokyo input, not a public file. This is not a touch; it is a real extension.
- **A Web Code Generator operator/package doc at "its accepted home."** 127B's own list ends with "the Web Code Generator operator/package documentation at its accepted home" — but 127B's "Specification gate" explicitly leaves the implementation home un-pinned. This is honest, but it means the doc plan has a placeholder. Once the home is decided (likely under `packages/ck-runtime-materializer` replacement or a new package), that doc must exist before 127B can be called done. Flagged as an execution-readiness dependency, not a PRD defect.

**C. Strategy docs — which actually need a Pages paragraph vs over-listing**

The Mama §14 lists `WhyClickeen.md`, `MarketPosition.md`, and `GlobalReach.md`. Read fresh against their actual content:

- **`documentation/strategy/WhyClickeen.md` — needs a light touch, justified.** Its "Wedge" section (lines 83-94) names widgets as the first proof and explicitly anticipates "pages, sites, emails, reports." After 127 ships, Pages is real and the three-file law is the proof that "structured source + agent-operated edits + account-owned storage + public runtime artifacts" works beyond widgets. A short paragraph confirming Pages as the second proof is warranted. **Not over-listed.**
- **`documentation/strategy/GlobalReach.md` — likely needs a paragraph.** The Mama's locale-URL design (self-canonical exact-locale URLs, `hreflang`, `x-default`, country-as-hint-not-identity) directly operationalizes the GlobalReach thesis ("Locale is product context, not product identity"). Worth a paragraph. **Not over-listed** if GlobalReach currently lacks a Pages/locale-URL example.
- **`documentation/strategy/MarketPosition.md` — review for over-listing.** Without reading it fresh I cannot confirm, but the Mama's only MarketPosition-relevant output is the distribution loop (Free Widget attribution, identity map). If MarketPosition.md already covers product-led distribution, it may need only a sentence; if it does not mention Pages, the PRD's listing is fine. **Flag: verify MarketPosition.md actually needs a Pages paragraph before editing — the Mama may over-list it.**
- **`documentation/strategy/Clickeen-Babel.md` — not listed by the PRDs, but worth considering.** The Mama's overlay/private-locale-data design is a Babel-moat application (one Page source → many locales without copy-based localization). The PRDs do not list it. Minor under-listing; one paragraph would be appropriate since Babel is named as a moat in `WhyClickeen.md`.

**D. Docs the PRDs list that likely do NOT need touching (flag for triage)**

- **`documentation/architecture/Tenets.md`** — listed by Mama §14. Tenets docs are typically stable product law; the three-file law and the Save/Update/Publish distinction may belong here, but only if Tenets.md is the right home (vs. the new `pages.md`). **Flag: confirm Tenets.md is not duplicating what should live in a Pages capability doc.** Possible over-list.
- **`documentation/architecture/RuntimeProfiles.md`** — listed by Mama and 127B. Only needs a touch if Page serving introduces a new runtime profile (it does not — Pages serve from the same `clk.live`/`dev.clk.live` Tokyo-worker path confirmed in `seo-geo.md` and `Overview.md`). **Likely over-listed** unless RuntimeProfiles explicitly enumerates Page artifacts.
- **`documentation/engineering/UI/interactions.md`** — listed by 127A and 127B. Justified only for the `out_of_date` modal dismissal rule and the SEO/GEO/AEO toggle Upsell behavior. **Confirm it owns modal dismissal matrices** (roma.md references it for exactly this) before editing; if so, the touch is real but small.
- **`documentation/widgets/README.md` and `documentation/widgets/shared/ShellUtilities.md`** — listed by Mama for "the branding cutover." 127B code-work item 13 confirms `CKBranding.applyBacklink` is replaced by generated markup. **Justified** — these docs describe the JS branding injector that 127B deletes.

**E. Cross-PRD doc-list consistency check**

- 127A lists `documentation/architecture/AccountManagement.md` (correctly — Tier99 + retained-Page-visibility law live there). The Mama §14 does *not* list AccountManagement.md. **Minor inconsistency: the Mama's §14 list should include AccountManagement.md** since 127A correctly identifies it as touched. The Mama list is otherwise a superset, so this is a single omission.
- 127B does *not* list `multitenancy.md`, but 127B changes the runtime behavior of `embed.seoGeo.enabled` (closing the gap `multitenancy.md` lines 274-278 and 333 documents). **127B should list `multitenancy.md`** so the gap language can be resolved to "enforced" with Roma Save as the owner.

**Verdict:** The three PRDs are product-truth-aligned and execution-ready on the settled decisions; the load-bearing gaps are (1) no `documentation/capabilities/pages.md` exists despite Pages becoming a first-class product, (2) `localization.md` needs the Page-overlay + private-locale-data story, (3) the `seoGeoAeoEnabled` source-field vs `embed.seoGeo.enabled` entitlement-key naming is unpinned for executors, and (4) the Mama's doc list omits `AccountManagement.md` and 127B's omits `multitenancy.md` — otherwise the documentation coverage is accurate and honestly scoped as post-deployment current-truth updates.

---

## 3. Principal TPM Peer Review

### 127 Mama + 127A + 127B — Principal TPM Peer Review (GLM)

#### 1. Cohesive and cost-effective architecture

The three documents are **cohesive as written**. The fifteen Mama tenets, the 127A source/policy contract, and the 127B generator boundary reinforce one another: the three-file law is the same contract at Widget → Instance → Page; the human-only invocation gate (Save/Update only) is restated consistently across the Mama (§5, §7) and 127B (§"Bob and Instance Save", "Page code generation"); currency-as-derivation is consistent between Mama §7 and 127B product decision #9; and the SEO/GEO/AEO toggle on mandatory complete HTML is consistent between Mama §5 and 127B §"Public-search output".

Real cost/cohesion findings (accuracy-grounded, no redesign):

- **The fingerprinted-page-package storage shape is decided twice.** Mama §3 (lines 166-183) commits the storage shape to `accounts/{accountPublicId}/pages/{pageId}/packages/{packageFingerprint}/{index.html,styles.css,runtime.js,overlays.json}` and 127B §"Page" (lines 195-200) re-states it. But 127C is named (Mama §6 line 437, 127A slice boundary) as the owner of "the exact R2 writes and selection." This is a real tension: the Mama fixes the storage shape, then says 127C "must define the exact R2 writes." The current code at `tokyo-worker/src/domains/pages/keys.ts:17-23` uses a **flat** `accountPagePublishFileKey(...)/{fileName}` shape, not a fingerprinted subfolder. As written, either the Mama is the authority (and 127C inherits a fixed shape) or 127C is (and the Mama's §3 path is provisional). Both readings are defensible; the docs should say which. This is a wording/ownership clarification, not a redesign.

- **The "service" wording for the Web Code Generator is a real ambiguity the PRDs already flag.** Mama §5 calls it "an important shared service" (line 247) and "Clickeen's expert frontend developer expressed as a deterministic service" (line 254). 127B repeats "service" throughout but also says "Its exact implementation home and call boundary are part of the detailed specification still to be accepted" (line 73-77) and lists "the accepted detailed specification will name the Web Code Generator's final execution home" (line 788). Per the review rules this is a known wording question; flagging it once here and not prescribing package-vs-Worker-vs-Roma-internal. The only accuracy note: today's serving-code responsibility lives in a **package** (`packages/ck-runtime-materializer`, called from `roma/lib/account-instance-public-package.ts:7,10,339`), so the cutover moves a package-owned responsibility regardless of where the generator lands.

- **Tier99 "matches Tier 4" has a real, non-obvious cost at the CLICKEEN account cutover.** The CLICKEEN account is currently on **`tier3`**, not tier4 — `supabase/migrations/20260526110000__prd104a_admin_account_coordinate.sql:80` asserts the migrated admin account is `tier = 'tier3'`. Mama §10 (line 770) and 127A §Tier99 (line 310) say Tier99 values "match Tier 4." So the tier99 cutover is not a no-op rename: it shifts the operating account's effective entitlements (e.g., `widgets.instances.max` 100→250, `instances.published.max` 25→100 per `entitlements.matrix.json:80-99`; AI runtime budgets per `ai-runtime.matrix.json`). This is fine and intended, but the deploy sequence (see §5) must account for it. No redesign.

- **The ai-runtime matrix is silently coupled to tier99.** `packages/ck-policy/src/ai-runtime.ts:119-122` iterates `getEntitlementsMatrix().tiers` and throws if any tier lacks a runtime config. So adding `tier99` to `entitlements.matrix.json` without adding a `tier99` block to `ai-runtime.matrix.json` will throw at matrix load. 127A's checklist (line 374-376) names both matrices, so this is covered — but it is the kind of silent coupling that makes "add tier99" a single atomic unit, not two independent edits.

No other cohesion/cost issues. The design as written avoids queues, fan-out, compatibility readers, and a second renderer — all consistent with the settled law and the codebase.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

**Every cross-PRD conversation is between named authorities.** Verified against Mama §11 (lines 780-798), 127A §"Existing authority chain" (lines 93-101), and 127B §"Authorities" (lines 500-516):

- Roma ↔ Web Code Generator: explicit Instance Save / Page Save / Update page only (Mama §5 line 243; 127B §"Bob and Instance Save"). No other caller.
- Roma ↔ Tokyo-worker: existing Page/Instance route family (127A lines 104-112; 127B line 551). No new route invented.
- Roma ↔ `@clickeen/ck-policy`: `pages.max` and tier access (127A lines 252-280; Mama §11 line 796). Uses the existing registry/matrix.
- Berlin ↔ Roma: bootstrap/capsule (127A line 96). No change.
- Web Code Generator ↔ (nothing): 127B line 577 "does not call Roma, Tokyo, R2, Bob, Translation Agent, San Francisco, an agent, or a public Widget URL." Correctly isolated.
- Catalog read: Roma service-authenticated Tokyo read fixed to owner `CLICKEEN` + `isTemplate: true` (Mama §9 lines 675-679). This is described as "the narrow read boundary," not a subsystem.

**No hidden subsystem is invented inside the PRDs.** Specifically verified:
- The "Web Code Generator" is introduced as one named authority (Mama §5), separate from the "Bob Editor Compiler" (127B lines 32-43). Both are named, both have a narrow boundary. Not a hidden subsystem.
- `overlays.json` is named as "private generated locale data used by Tokyo" (Mama §3 line 176; 127B §"Overlays are not a fourth public file"). It is an artifact, not a service.
- The fingerprinted package path is a storage detail, not a "Build/version product" (Mama §3 lines 185-188). Correctly framed.
- "Account management" is repeatedly and explicitly stated NOT to be a new service (Overview.md line 67-69; AccountManagement.md line 100-101; Tenets.md line 244-247). The PRDs do not contradict this.
- The Clickeen public product identity map is "product data inside the generator authority, not a new service, agent, crawler, registry API, or request-time lookup" (127B line 260-262). Correctly bounded.

**One wording ambiguity to flag (not a subsystem):** the word "service" for the Web Code Generator (see §1). The PRDs themselves flag that the implementation home is undecided (127B specification gate). No subsystem is hidden behind it; the boundary (inputs, outputs, no network/storage) is fully specified even though the deploy home is not.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

Descriptive only — where Clickeen's chosen design sits in the landscape.

- **vs Elfsight / the loader-SaaS pattern:** 127B §"Why this slice exists" (lines 102-122) explicitly names this. Elfsight-style products ship `empty/partial HTML + state payload + browser renderer`. Clickeen's three-file law (complete semantic HTML persisted per Instance, JS for behavior only) is the opposite architectural choice. The SEO/GEO/AEO baseline-for-every-tier rule (Mama §5 lines 307-310; 127B §"Complete semantic output for every tier") means Free output is never a weaker rendering architecture than paid. This is a deliberate divergence, not a gap.

- **vs Next.js / Astro (SSG/SSR frameworks):** Those frameworks pre-render per route/locale at build or request time. Clickeen's model is **explicit human Save/Update produces deterministic files, Tokyo serves stored bytes** (Mama §6; Tenet 11). Clickeen does not pre-render per locale; it stores one root HTML plus private locale data and completes the response on cache miss (127B §6 line 690-697). This sits between static-only and SSR: deterministic generation, locale completion at the edge, no per-visitor rendering. Descriptively, this is closer to the "generated static site + edge locale selection" point in the design space than to either pure SSG or SSR.

- **vs the incumbents on distribution/attribution:** Free Widget attribution as truthful crawlable HTML with `rel="nofollow noreferrer"` plus matching JSON-LD (Mama §5 lines 336-348; 127B §"Clickeen identity and Free Widget distribution") is a distinct choice. Legacy widget-SaaS attribution is typically JS-injected (which 127B explicitly removes at line 769-772, replacing `CKBranding.applyBacklink` at `tokyo/product/widgets/shared/branding.js:172`). Clickeen's choice makes attribution crawlable without pretending every embed is editorial endorsement.

- **Where Clickeen deliberately does not follow competitors:** no per-locale pre-rendering (one root + overlay completion), no compatibility readers during cutover (Mama §12 line 890-891), no migration subsystem for legacy Page data (127A §"Existing Page data and cutover"), no SEO agent/crawler/recommendation system (Mama §11 line 815). These are omissions by design, not gaps.

This is a description of where the design sits. It is not a recommendation to copy any competitor.

#### 4. Absence of V1–V8 violations

Exhaustive, per-violation, against PRD clauses and code.

**V1 (Silent substitution) — PASS.** Mama §13 (lines 906-907: "Required Instance is missing or invalid → Generation fails; the Instance is not omitted"; "Required overlay is missing or invalid → Generation/exact serving fails; no locale is substituted"), 127A validation rules (line 183-184: ordinary Page overlays must contain one exact entry per non-base locale; line 200: unknown keys/corrupt source fail explicitly), 127B §"Validate all input" (line 595: "Any mismatch returns one exact failure. No placement or file is skipped"). Code-grounded: `packages/ck-runtime-materializer/src/materialize.ts` already returns `RuntimeMaterializerFailure` with reasons like `widget_package_root_invalid` rather than substituting.

**V2 (Silent healing) — PASS.** 127A validation rules (line 200-201: "Unknown keys, corrupt source, and invalid discriminated variants fail explicitly"); 127A template rule (line 189: "Page templates reject `locales`, `overlays`, and `seoGeoAeoEnabled`; they never silently discard those fields"); 127B line 879: non-entitled `seoGeoAeoEnabled: true` "Return the existing entitlement failure; write nothing." Code-grounded: `normalizePolicyProfile` in `packages/ck-policy/src/authz-capsule.ts:101-112` returns null for unknown tiers rather than coercing.

**V3 (Silent omission) — PASS.** Mama §13 (lines 958-959: "no placement, package file, affected Page, or publication step is silently omitted"); 127B line 873: "Page placement lacks one saved Instance file → Name Instance/file and fail the complete Page generation"; 127B line 877: "Locale marker is absent, duplicated, or unsafe → Name marker/path and fail." The atomic cutover rule (Mama §12 line 890-891: no compatibility readers, transitional routes, or duplicate contracts) directly prevents omission-by-compatibility-path.

**V4 (Fail-open control) — PASS.** Mama §10 (lines 752-753: "Roma rechecks `pages.max` and tier access at the owning route before any write or generator call"); 127A failure table (line 440: "Resolved total policy lacks a valid `pages.max` value → Fail closed through the existing policy error path"); 127B line 879 (non-entitled SEO/GEO/AEO at Save writes nothing). Code-grounded: `packages/ck-policy/src/matrix.ts:39-100` (`assertEntitlementsMatrix`) throws on missing/unknown tiers and entitlement keys, and `REQUIRED_TIERS` at line 6 is a closed list that fails closed on unknowns.

**V5 (Corruption-as-absence) — PASS.** 127A failure table (line 446: "Stored source is corrupt → Report corruption; never treat it as a blank Page"); 127B line 874: "Exact overlay is missing or corrupt → Name Page/Instance, locale, and path; never substitute"; 127B line 872: "Instance HTML is a shell or requires JS for primary content → Save fails; do not install it." OverlayArchitecture.md lines 51-52 already encode this ("Missing, unexpected, malformed, or non-text values are corruption and fail visibly. They are never filtered, repaired, or treated as absence").

**V6 (Partial-success masquerade) — PASS.** Mama §7 (lines 508-510: "if source saves but generation fails, the saved source remains, the prior package remains selected ... and the Page shows **Needs fixing**"); Mama §13 (line 909: "Cache or discovery update fails → The incomplete step is reported; full success is not claimed"); 127B line 914: "success means all three public files and required private locale data are complete." The Save-vs-generate-vs-install separation is explicit and terminal-state-distinct (`current | out_of_date | save_failed`).

**V7 (Masquerade/redress) — PASS.** Mama §12 (lines 890-891: "Executors must not add compatibility readers, transitional routes, duplicate contracts, or temporary UI to keep the obsolete Pages implementation alive"); 127B line 916: "the client-rendered content path is removed, not wrapped or renamed"; 127B line 776-778: delete `widget.client.js`, any `widget.render.*`, duplicate DOM render functions. Code-grounded: today's `widget.html`/`widget.css`/`widget.client.js` files exist across all 8 widgets and are slated for direct replacement, not wrapping.

**V8 (Runtime test dependency) — PASS.** 127A line 531: "normal Page work does not depend on tests, probes, fixtures, or migration helpers"; 127B line 917: "normal editing, Save, generation, and serving do not depend on tests or probes"; Mama §13 line 965: "normal runtime never depends on tests, probes, or fixtures." The materializer package today (`packages/ck-runtime-materializer/README.md`) already forbids service/runtime imports and environment reads.

**Net: V1–V8 PASS.** No gaps found. Every violation class is addressed by an explicit PRD clause, and the codebase patterns the PRDs extend already enforce the same invariants.

#### 5. Needed documentation / updates (TPM perspective)

**Docs the PRDs touch — each file, the exact sentence that becomes false, what it must say after the slice lands**

*127A scope (Page source contract, `pages.max`, tier99):*

- **`documentation/architecture/CONTEXT.md`** — "Current Authorities" table (line 175: "Clickeen Pages | Tokyo-worker over `accounts/{accountPublicId}/pages/`") and Storage Shapes (lines 240-248) show `pages/{pageId}/{source.json, serve-state.json, index.html, styles.css, runtime.js}` with no template discriminator and no package subfolder. After 127A: must state that Page source is a discriminated `AccountPage | AccountPageTemplate` contract from `@clickeen/ck-contracts/page-source`; that templates carry base source + `baseLocale` but no selected locales/overlays/translations and cannot generate or publish; and that Page templates count under `pages.max`.

- **`documentation/architecture/Overview.md`** — "Storage Ownership" (lines 158-165) shows the same flat Page shape. Same update as CONTEXT.md. Also "Named Authorities" (line 93) references "Account storage lifecycle" — must note tier99 as the non-sellable `CLICKEEN` account tier with no special authority.

- **`documentation/architecture/AccountManagement.md`** — line 87 (`account_status`/`account_tier` enums discussed) and "Current Tables" (line 160: `accounts(id,status,status_changed_at,tier,created_at)`). After 127A: must state `tier99` is a valid `account_tier` enum value used only by the `CLICKEEN` account, never sold, no special authorization authority; and that `pages.max` is enforced at first Save through the normal policy system.

- **`documentation/services/michael.md`** — "Current Enums And Columns" (lines 86: `public.account_tier | free, tier1, tier2, tier3, tier4`). This becomes false after 127A. Must list `tier99` in the enum values and note it is non-sellable/internal-only.

- **`documentation/services/berlin.md`** — Account Public Coordinate section and the bootstrap tier handling. After 127A: must state that Berlin bootstrap accepts and carries `tier99` in the authz capsule profile, with the same fail-closed rule for unknown tiers. (Note: `berlin/src/bootstrap/state.ts:80-91` `normalizeTier` and `packages/ck-policy/src/authz-capsule.ts:101-112` `normalizePolicyProfile` must both be updated in-commit; the doc must reflect that.)

- **`documentation/services/roma.md`** — "Pages Domain" (lines 441-466) currently says page publish is disabled and "Any shift to generated child artifact coordinates, child evidence, or page package materialization belongs to a future Page Package PRD." After 127A: page source contract is now the 127A discriminated contract; publish remains disabled until 127C, but the source shape and `pages.max` enforcement are now current. The "future Page Package PRD" sentence becomes partially false (source/policy is now this PRD; package materialization still belongs to 127B/127C).

- **`documentation/services/tokyo-worker.md`** — "Pages" section (lines 159-182) and the storage shape. After 127A: must reflect the new Page source contract (template discriminator), and that `pages.max`/tier checks are Roma's authority (Tokyo stores exact bytes, unchanged).

- **`documentation/services/devstudio.md`** — if DevStudio renders tier labels or entitlement matrices (127A line 383 references `admin/src/html/tools/entitlements.html`), the doc must state tier99 appears in internal tier views but never in customer sale/provisioning flows.

- **`documentation/capabilities/multitenancy.md`** and **`documentation/capabilities/localization.md`** — must state the Page template localization rule (base source + `baseLocale` only; no selected locales/overlays/translations; template carrying locale state is invalid and fails visibly) and the tier99 internal-account framing.

- **`documentation/architecture/OverlayArchitecture.md`** — must state Page-owned overlays follow the same exact-overlay rule (one entry per selected non-base locale; missing = fail, never substitute) and that Instance overlays remain Instance-owned.

- **`documentation/ai/sanfrancisco.md`** — must state `tier99` is an accepted `AiPolicyProfile` value (since `sanfrancisco/src/grants.ts:7` `AI_POLICY_PROFILE_SET` must be updated in-commit) with values matching tier4.

- **`documentation/engineering/UI/interactions.md`** — must state the visible-action Upgrade law applies to Pages (`pages.max = 0` and exhausted positive limits open the standard Upgrade dialog; actions remain visible/clickable) and that **Save as template** is the named conditional-visibility exception.

*127B scope (three-file cutover, Web Code Generator):*

- **`documentation/architecture/RuntimeProfiles.md`** — "Current Runtime Surfaces" (lines 9-13) and "Storage Runtime" (lines 38-45) describe the current `index.html`/`styles.css`/`runtime.js` per instance. After 127B: must state these are the three-file contract produced by the Web Code Generator, JS carries behavior only (no primary-content construction), and the old `widget.html`/`widget.css`/`widget.client.js` source names are gone.

- **`documentation/widgets/authoring/WidgetFiles.md`** — must state the new three-file authoring contract (`index.html`, `styles.css`, `runtime.js`) and that `widget.html`/`widget.css`/`widget.client.js` are removed.

- **`documentation/widgets/README.md`** and **`documentation/widgets/shared/ShellUtilities.md`** — must state the branding cutover: `CKBranding.applyBacklink` (`tokyo/product/widgets/shared/branding.js:172`) is removed and attribution is generated into `index.html` by the Web Code Generator.

- **All eight affected Widget docs** (big-bang, calltoaction, cards, countdown, faq, logoshowcase, split-carousel-media, split-media) — each must reflect the rename to the three-file contract.

- **`documentation/services/bob.md`** — must state Bob edits the three-file working copy directly and the old content-payload → DOM rendering path is removed.

- **`documentation/services/tokyo-worker.md`** — after 127C consumes Page completion, must state the fingerprinted-package storage shape (Mama §3) and locale-completion behavior. (127B correctly defers the tokyo-worker doc update until 127C.)

- **`@clickeen/ck-runtime-materializer` README** (`packages/ck-runtime-materializer/README.md`) — currently says "Pure builder for the one public root artifact of a saved widget instance" and lists the Instance-only output. After 127B, the serving-code responsibility moves to the Web Code Generator. This README must be updated in-commit with the cutover (or the package removed) — it must not survive describing a responsibility that has moved.

- **The Web Code Generator operator/package documentation** at its accepted home (127B line 898). Does not exist yet; must be created when 127B lands.

- **`documentation/strategy/WhyClickeen.md`, `MarketPosition.md`, `GlobalReach.md`** — must state the product-led distribution doctrine (Free Widget attribution in initial HTML) and the language-truth doctrine (no country-manufactured locales, `availableLanguage` derived from existing locale authority).

**Docs the PRDs miss**

- **`documentation/engineering/CloudflareOperations.md`** — not in 127A/127B doc lists but 127B line 772 and Mama §6 invoke cache purge and CDN behavior. If 127C adds Page cache-purge steps, CloudflareOperations.md should be updated; 127B itself does not add cache operations, so this is a 127C concern, but flagging it because the Mama's §13 deploy list (lines 925-930) references the repo Cloudflare paths.

- **`AGENTS.md`** — not in any doc list. If tier99 becomes a first-class tier concept operators must know, the "Authority Gate" / admin account coordinate section (lines 138-142) should note tier99. Optional; the PRDs do not require it.

- **`packages/ck-policy` registry/matrix documentation** — there is no standalone doc, but the `ENTITLEMENT_META` in `packages/ck-policy/src/registry.ts:50-168` is operator-visible through DevStudio (`admin/src/html/tools/entitlements.html`). After 127A, a `pages.max` entry must be added to `ENTITLEMENT_META` with label/description/enforcement owner, or DevStudio will render an incomplete entitlements view.

**Deploy-sequencing notes (execution guidance, not redesign)**

These are real ordering constraints derived from the code coupling, stated as guidance for the executor:

1. **tier99 is a single atomic unit across five files, not a sequence of independent edits.** The coupling: `packages/ck-policy/src/types.ts:1` (`AccountTier`), `packages/ck-policy/src/matrix.ts:6` (`REQUIRED_TIERS`), `packages/ck-policy/src/authz-capsule.ts:101-112` (`normalizePolicyProfile`), `packages/ck-policy/entitlements.matrix.json`, `packages/ck-policy/ai-runtime.matrix.json` (validated against entitlements tiers at `ai-runtime.ts:119-122`), `packages/ck-contracts/src/ai.ts:2` (`AiPolicyProfile`), `sanfrancisco/src/grants.ts:7` (`AI_POLICY_PROFILE_SET`), `berlin/src/bootstrap/state.ts:80-91` (`normalizeTier`), and the Supabase enum + CHECK constraints (`supabase/migrations/20260602120000__account_tier4.sql` pattern; note both `accounts_tier_allowed` and `workspaces_tier_allowed` constraints exist). All code edits + the Supabase enum migration must land together; a partial landing makes the policy package throw at matrix load.

2. **`pages.max` must land in the registry, matrix, and `ENTITLEMENT_META` together.** `registry.ts:1-16` (`ENTITLEMENT_KEYS`) and the matrix are validated against each other (`matrix.ts:58-66` rejects unknown/missing keys). `ENTITLEMENT_META` is not validated at load but is consumed by DevStudio. Add all three in one commit.

3. **tier99 + `pages.max` should commit together with the Supabase enum migration, before any Worker/Pages deploy that reads them.** 127A deployment checklist (lines 411-425) already orders this correctly: land and test code support → deploy Supabase enum migration → deploy Berlin/San Francisco/Roma/Tokyo-worker → verify tier readers → change CLICKEEN account row last. This ordering is correct and should be preserved. The Supabase migration must extend both the `account_tier` enum (ADD VALUE) and the `accounts_tier_allowed` CHECK constraint; the `workspaces_tier_allowed` constraint in the same migration pattern should also be extended for consistency (the `workspaces` table appears legacy/unused in berlin source, but the constraint exists and would reject tier99 if anything writes to it).

4. **The CLICKEEN account tier update (tier3 → tier99) must be LAST, after every tier reader is deployed and verified.** Because tier99 matches tier4 values, this cutover shifts the operating account's effective entitlements (e.g., `widgets.instances.max` 100→250). Doing it before all readers accept tier99 would make `normalizeTier`/`normalizePolicyProfile` return null and break bootstrap. 127A line 421-423 already states this; reaffirming because the current tier is tier3 (not tier4), which the PRDs do not explicitly state.

5. **The materializer README and `roma/generated/widget-materializer-artifacts.ts` must be updated in-commit with the 127B cutover, not after.** 127B line 788 says "the accepted detailed specification will name the Web Code Generator's final execution home." Wherever that home is, the serving-code responsibility currently in `packages/ck-runtime-materializer` (called from `roma/lib/account-instance-public-package.ts:339`) must move atomically. The atomic cutover rule (Mama §12) forbids parallel paths, so the materializer package README, the Roma call site, and the new generator home must all change in one slice. 127B's doc list (lines 886-898) includes "the Web Code Generator operator/package documentation at its accepted home" but does not explicitly name the materializer README update; the executor should treat that README as part of the cutover commit.

6. **The fingerprinted-package storage shape (Mama §3) should be confirmed as Mama-decided vs 127C-decided before 127C executes.** Today's `tokyo-worker/src/domains/pages/keys.ts:17-23` is flat. If the Mama §3 shape is authoritative, 127C inherits it; if 127C owns it, the Mama §3 path is provisional. This is a one-line clarification, not a redesign. Recommend the product owner confirm which, so 127C does not re-litigate.

**Verdict:** Cohesive and execution-ready; V1–V8 PASS with no gaps; the only real execution risks are the tier99 atomic-five-file coupling, the CLICKEEN account's actual current tier being tier3 (not tier4), and a one-line ownership clarification on whether Mama §3 or 127C owns the Page storage shape.

---

## 4. Consolidated Verdict & Convergence

All three seats returned **APPROVE WITH CHANGES**. No seat BLOCKED. Under the locked mandate (no redesign, no re-litigation, accuracy + executor-readiness + documentation coverage only), the three reviews converge cleanly.

### Convergent execution-readiness gaps (where an AI will invent)

These are the unpinned contracts an executor will guess on. Quoted at PRD-line granularity across the seats:

1. **The Web Code Generator's "service" vs "package" home is unpinned.** (Staff Eng §4-7; Principal TPM §1, §2)
   The Mama calls it a "service"; 127B defers the home to the specification gate. Today's serving-code responsibility lives in a package (`packages/ck-runtime-materializer`, imported by Roma at `roma/lib/account-instance-public-package.ts:339`). An executor will guess Worker vs package vs Roma-internal. **One-line clarification needed in 127B.**

2. **The Page-overlay key grammar is unpinned.** (Staff Eng §4-1)
   `overlays: Record<string, { values: PageOwnedValues }>` — locale key format and required-ness of all five `PageOwnedValues` fields are not stated.

3. **The private Page locale-data shape is pinned only by example.** (Staff Eng §4-5)
   "Concrete field paths such as `items.0.title`" — the grammar (dot-separated, numeric array index, no wildcards/brackets) is implied but not normatively stated. The existing `applyExactOverlay` (`runtime.ts:88-134`) already rejects `[`,`]`,`*` — that's the grammar, it just isn't named in the PRD.

4. **"Complete stamped Widget root" / "composed-Page coordinates" / "stable chunk markers" are asserted but not defined.** (Staff Eng §4-2, §4-3, §4-4)
   The runtime already reads `data-ck-composed-page="true"` and `data-ck-instance-id`, but the Page-placement stamping attribute contract and the CSS/JS chunk-marker convention are not named. The widget CSS/JS files today contain no visible chunk-marker convention.

5. **The 127B→127C handoff contract is unspecified.** (Staff Eng §4-6)
   127B returns "file, locale-data, and internal package fingerprints" that 127C must consume, but the fingerprint shapes 127C needs are not stated in either PRD.

6. **The `<meta name="generator" content="Clickeen">` tag location is undefined.** (Staff Eng §4-8)
   Required output, but the materializer's `buildIndexHtml` emits no such tag today. An executor will guess Instance head vs Page head vs Tokyo-at-serve.

7. **The `seoGeoAeoEnabled` source field vs `embed.seoGeo.enabled` entitlement key naming relationship is implied but not stated.** (PM §2)
   Both layers coexist; the PRDs never say the registry key name is unchanged and only the per-object source field is new.

8. **The `tier99` + `REQUIRED_TIERS` + `pages.max` + `ENTITLEMENT_KEYS` coupling is not stated as an atomic commit.** (Staff Eng §4-12, §4-13; Principal TPM §5)
   The matrix validator throws at module load if any cell is missing. This is execution guidance, not a design change — the PRD should state these ship as one unit.

9. **`WidgetType` in the identity map is not a contracts type today.** (Staff Eng §4-11)
   An executor will guess whether it's a new string-union, the spec `widgetname`, or the folder name.

### V1–V8 audit convergence

**V1–V8 all PASS** across all three seats. No gaps found. Every violation class is addressed by explicit PRD clauses and reinforced by existing codebase invariants (the materializer's fail-visible returns, the policy matrix's fail-closed validation, the atomic-cutover rule).

### Documentation coverage (the primary deliverable)

Three seats converged on a single highest-priority doc gap and a concrete per-file update list.

**The one structural gap all three flagged:**
- **`documentation/capabilities/pages.md` does not exist and should.** Every other first-class capability (localization, multitenancy, seo-geo, supernova) has a doc. Pages is currently scattered across roma.md, CONTEXT.md, OverlayArchitecture.md, and the PRDs themselves. A `pages.md` capability doc is the right home for the three-file law, `pages.max`, Page currency, Save/Update/Publish, and the template/Catalog rule. **Mama §14 omits this file.**

**Doc-list inconsistencies between the three PRDs:**
- Mama §14 omits `AccountManagement.md` (127A correctly lists it).
- 127B omits `multitenancy.md` (it closes the `embed.seoGeo.enabled` runtime-owner gap that doc flags).
- No PRD lists `packages/ck-runtime-materializer/README.md`, which becomes false the moment 127B moves serving-code responsibility.

**Docs the PRDs list that likely don't need touching (trim):**
- `documentation/strategy/MarketPosition.md` (verify before editing — Mama may over-list).
- `documentation/architecture/RuntimeProfiles.md` (likely over-listed unless it enumerates Page artifacts specifically).
- `documentation/architecture/Tenets.md` (may duplicate what belongs in `pages.md`).

**Docs the PRDs miss:**
- `packages/ck-runtime-materializer/README.md` — must update in-commit with 127B's cutover.
- `AGENTS.md` Authority Gate — if the generator is a Worker it joins the System Map; either way the new authority should be named.
- The Web Code Generator operator/package doc at its accepted home — does not exist yet; must be created when 127B lands.

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** The three PRDs are architecturally sound, tenet-compliant (V1–V8 PASS), and thesis-aligned. The work remaining is purely execution-readiness: pin the nine unpinned contracts above (most are one-line clarifications), close the documentation-coverage gaps (primarily create `pages.md` and update the materializer README in-commit), and state the tier99+pages.max atomic-commit sequencing. No product redesign is needed or warranted.
