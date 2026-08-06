# 127C — Peer Review (GLM)

Status: **PEER REVIEW — CONSOLIDATED**

Subject: `127C__PRD__Page_Publication_And_Public_Serving.md`

Date: 2026-08-04

Model: builtin:zai-coding-plan/GLM-5.2

Three independent peer reviews under the locked mandate: accuracy against the
codebase/tenets, executor-readiness gaps where an AI will invent, documentation
coverage. No redesign, no re-litigation of settled decisions, no invented
machinery. All claims grounded in real files read fresh from disk.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127C — Staff Engineer Peer Review (GLM)

#### 1. Elegant engineering and scalability

- **Reusing the single root + overlay serving law for Pages.** 127C's exact-locale completion ("uses base values when the request equals `baseLocale`, otherwise uses only the exact matching Page and placement overlays"; "CSS and runtime remain the same across locales") mirrors the proven instance path in `tokyo-worker/src/routes/clk-live-routes.ts` (`responseForLocalizedIndex` sets `no-store`; `indexHtmlWithLocaleContext` swaps exactly one `window.CK_LOCALE_CONTEXT = null;` marker and the `<html lang>` tag). Pages get the same "one root runtime + one exact overlay = localized rendering" rule from `OverlayArchitecture.md` with no per-locale CSS/JS — exactly the right scaling posture.
- **`generatedFrom` as the sole revision/integrity contract.** Storing `pageRevision` + per-placement `savedInstanceRevision` as R2 object metadata on the four generated objects (`overlays.json`, `index.html`, `styles.css`, `runtime.js`) and then requiring all four to match `serve-state.json` before serving is a clean, byte-evident extension of the existing instance fingerprint check in `verifyInstancePublicPackageReady` (`clk-live-routes.ts:188-200`). It reuses the existing "mixed package state fails closed" pattern rather than inventing a new integrity product.
- **Cache keying by `account + pageId + pageRevision + exactLocale`, not raw country.** The explicit rule ("Do not vary completed HTML cache keys by raw country when country only selected an exact locale") is the correct cost-control decision and is consistent with V1 (no invented locale variant). It lets many countries share one approved locale response while keeping the exact-locale URL the single cache dimension.
- **Country is a selection hint only, terminating at `baseLocale`.** The ladder `remembered choice → browser language → country → baseLocale` with the explicit base-locale fallback ("a country without a matching approved locale reaches the explicit base-locale result rather than an invented locale") is the minimal correct design and cannot manufacture a country Page.
- **Human-only invocation gate.** "Publish is a separate Roma command" and "Publish never invokes Web Code Generator or Translation Agent" cleanly preserve Tenet 5 (no orchestration bus) and the existing instance publish law.

#### 2. Compliance with architecture and tenets

- **Tenet 1 (Agents operate structured artifacts) — PASS.** `serve-state.json` stays a small typed object; `overlays.json` reuses the existing overlay value-map model. No ad-hoc stringly conventions introduced.
- **Tenet 2 (Named authorities own boundaries) — PASS.** Authorities table assigns Current account→Berlin/Roma, Page bytes/state→Tokyo-worker, Page generation→127B, Public response→Tokyo-worker, Cache→Cloudflare. Public routes "never call Roma, Bob, Page Builder, Translation Agent, Web Code Generator, or child public Widget URLs" matches the Tokyo-worker public-serving boundary.
- **Tenet 3 (No fallbacks / no silent substitution) — PASS.** "If it is missing, unsupported, incomplete, or malformed, return the explicit public failure/404 defined by the existing serving contract. Never substitute another locale." "Overlay application fails → Return explicit failure; do not emit partial HTML." Exact-overlay rules enforced.
- **Tenet 4 (No silent healing) — PASS.** "If any step fails, full success is not claimed and `serve-state.json` is not advanced." First-create partial-root cleanup is a bounded, request-scoped delete, explicitly "not retention, rollback history, or background cleanup."
- **Tenet 5 (Product commands stay boring) — PASS.** Save/Update/Publish are direct Roma→Tokyo commands; no broad registry, runtime discovery, or meta-framework.
- **Tenet 6 (Widget software is product truth) — PASS.** No widget-specific semantics invented by 127C; child Instance traversal on public requests is explicitly forbidden.
- **Tenet 7 (Bob edits in browser memory) — PASS** (out of 127C's direct scope; 127B/127E own Page Builder editing).
- **Tenet 8 (Storage follows ownership) — PASS.** Direct storage under `accounts/{accountPublicId}/pages/{pageId}/` only; no `published/`, no package version folders, no second root.
- **Tenet 9 (Translation overlays are exact files) — PASS.** "existing Instance/Page overlays" and "existing deterministic overlay markers/field paths" — reuses the exact-overlay rule, no new locale representation.
- **Tenet 10 (Content source authority preserved) — PASS.** No source-truth rewriting on public requests.
- **Tenet 11 (Public widget runtime serves stored artifacts) — PASS** — and this is the tenet 127C most directly advances. "127C never runs Web Code Generator or Translation Agent on a public request" plus the cache-miss step list (`serve-state.json` + last generated `index.html`/`overlays.json` only) is the Page analogue of the instance rule. Note: Tenet 11 currently states "Page publish and page public serving are currently unavailable until Roma writes page packages" and "Tokyo-worker must not compose pages from source on visitor requests" — 127C's deployment will flip the first clause (see §5).
- **Tenet 12 (Dieter tokens first) — N/A** for 127C (generation owns styling; 127C serves stored bytes).
- **Tenet 13 (Documentation is operator truth) — RISK.** 127C's "Documentation after deployment" list omits files whose current truth becomes false (see §5 for the concrete list, e.g. `AccountManagement.md`, `multitenancy.md`, the `publishUnavailable`/`saveRequiresUnpublish`/`deleteRequiresUnpublish` reason-key story).
- **Tenet 14 (Tier-gated actions stay visible) — PASS.** Publish "require `pages.max` access"; no private lock state introduced.
- **V1 (Silent substitution) — PASS.** No locale/account/revision substitution; explicit 404/500.
- **V2 (Silent healing) — PASS.** No coercion; mixed revisions fail closed ("a mixed or mismatched direct-object revision is never served").
- **V3 (Silent omission) — RISK.** The "Exact-locale HTML completion" step 6 ("writes matching `<html lang>`, title, metadata, canonical URL, alternate locale links, and supported source-backed structured data") is a large surface; an executor could omit one head element silently. See §4.
- **V4 (Fail-open control) — PASS.** Missing config/purge token already fails closed in `purgeAccountPagePublicCache`; 127C keeps "Cache purge fails → Report incomplete operation; do not claim full success."
- **V5 (Corruption-as-absence) — PASS.** Revision mismatch is corruption, treated as fail-closed, not as missing/empty.
- **V6 (Partial-success masquerade) — PASS.** "returns success only after the complete direct result is readable"; "A failed operation does not announce a new current revision."
- **V7 (Masquerade/redress) — PASS.** No retry/renamed-workflow machinery.
- **V8 (Runtime test dependency) — PASS.** No test/probe dependency in the public path.

#### 3. Over-architecture / unnecessary complexity IN THE PRD

The PRD is lean relative to the team's settled simplifications and contains essentially no over-architecture. Specific notes:

- The "Code work" checklist item "Delete obsolete package selection, last-good, country-variant, and request-time generation code" is a removal task, not new machinery — appropriate.
- `PageGeneratedFrom` is minimal (one revision + one placement array) and is explicitly shared with 127B/127D, avoiding a per-slice type. This is the right level of abstraction.
- No `save_failed` state, no failure history, no evidence product, no package folders, no candidate installs, no last-good retention — all correctly absent.
- The one mild excess: step 8 of Publish ("update discovery/cache state") and step 3 of Unpublish ("purges affected cache keys") and step 3 of Delete ("purges affected cache/discovery state") list "discovery state" as a noun without an owning operation. Given sitemap/discovery is later described under "SEO, GEO, and AEO output" as "Host-level robots and sitemap ownership remain with Tokyo," an executor may invent a discovery-state store. This is a wording risk (captured in §4), not architecture in the PRD.

#### 3b. Academic / theoretical abstractions and gold-plating IN THE PRD

- "Clickeen guarantees valid source-backed output, not indexing or ranking outcomes." — This is a scope-bounding sentence, not gold-plating; it correctly forecloses a ranking/learning system. Keep.
- "supported source-backed JSON-LD with matching localized text" / "one appropriate `x-default` relation to the stable selection URL" — These name concrete output artifacts 127C must produce (the head-completion step 6), so they are not aspirational. They are, however, under-specified for executors (see §4).
- No forward-looking hooks, V2 phasing labels, registry/extension points, or "future-proof" prose found. The PRD does not introduce machinery for later programs.

#### 4. Prose that leaves executors room to invent

1. **"applies values through existing deterministic overlay markers/field paths"** (Exact-locale HTML completion, step 5). An executor will guess which markers. The only marker today is the single `window.CK_LOCALE_CONTEXT = null;` string in `packages/ck-runtime-materializer/src/html.ts:113`, swapped by `indexHtmlWithLocaleContext` in `clk-live-routes.ts:119-150`. The PRD does not state whether Page HTML completion reuses that exact marker/`inlineJson` replacement, or introduces placement-level/field-path markers for "Page and placement overlays."
2. **"uses only the exact matching Page and placement overlays"** (step 4). An executor will guess the `overlays.json` internal shape (Page-metadata overlay vs. per-placement Instance-overlay merge order and conflict rule), since no schema is given and `overlays.json` does not yet exist in code (`grep` for `overlays.json`/`pageOverlays` in `tokyo-worker`, `roma`, `packages` returns nothing).
3. **"writes matching `<html lang>`, title, metadata, canonical URL, alternate locale links, and supported source-backed structured data"** (step 6). An executor will guess how each head element is sourced and rewritten on a cache miss — the current `indexHtmlWithLocaleContext` only rewrites `<html lang>` and the locale-context script (`clk-live-routes.ts:139-149`); it does not touch `<title>`, canonical, hreflang, or JSON-LD, and no current code produces hreflang/JSON-LD for serving (`grep` returns only the materializer's static `<title>`).
4. **"returns complete HTML and an exact revision/locale cache identity."** An executor will guess the concrete cache-identity header shape (ETag value? `vary`? a custom `x-ck-page-revision` header?) since the PRD names the dimension ("by account, Page, Page revision, and exact locale") but not the wire form.
5. **"account-approved mapping from Cloudflare country to an approved locale"** (Stable URL step 3). An executor will guess where this mapping lives. Current code has Roma-side `countryLocaleRules` inside `AccountPageLocalization` (`roma/lib/account-page-direct.ts:39`) and `account-translation-policy.ts` `countryToLocale`, but Tokyo public serving has no `request.cf.country` / `CF-IPCountry` consumer today (`grep` of `tokyo-worker/src` for country metadata returns nothing). The PRD does not state which document Tokyo reads on a public request.
6. **"explicit remembered visitor choice scoped to Clickeen's existing global privacy/choice authority"** (Stable URL step 1). An executor will guess the cookie/header name and parsing rule, because no such authority is implemented today and the Mama PRD §5 explicitly says "PRD 127 adds no remembered-locale cookie." 127C reintroduces "remembered visitor choice" without naming the existing authority or its read boundary.
7. **"best approved browser language match"** (Stable URL step 2). An executor will guess the `Accept-Language` parsing and the approved-locale matching rule (exact match vs. language-subtag fallback to an approved locale), since the PRD gives examples but no normalization contract.
8. **"writes `generatedFrom.pageRevision` as R2 object metadata on the generated `overlays.json`, `index.html`, `styles.css`, and `runtime.js`"** (Tokyo Save step 3). An executor will guess the metadata key name and type, since current instance package fingerprinting uses a different mechanism (`publicPackageFingerprint` via `verifyInstancePublicPackageReady`) and the PRD does not name the metadata header.
9. **"verifies the required bytes are present and those four generated objects' revisions match"** (Tokyo Save step 4) and the public-miss step 2 ("every generated direct object's stored revision matches `serve-state.json`"). An executor will guess whether match means "all four carry the same `pageRevision` metadata" or "all four equal `serve-state.generatedFrom.pageRevision`," and what happens if `source.json` was mutated by an approved metadata translation (the PRD says `source.json` is excluded from serving equality, but does not say how a newer `source.json` coexists with the four generated objects' shared revision).
10. **"update discovery/cache state"** (Publish step 8) and "purges affected cache/discovery state" (Delete step 3). An executor will guess what "discovery state" is — a sitemap object? a KV index? — because the only discovery prose is later ("Sitemap/discovery includes published, complete exact-locale URLs … Host-level robots and sitemap ownership remain with Tokyo") with no storage coordinate or operation.
11. **"For an already-published Page, a successful Save/Update makes the new direct current files authoritative and purges that Page's public cache keys."** This directly contradicts current runtime behavior: `internal-page-routes.ts:228-235` throws `coreui.errors.page.saveRequiresUnpublish` when a published Page is saved. An executor will guess whether to delete that guard or keep it, since the PRD does not name the reason key or the guard to remove.
12. **"updates discovery/cache state" (Publish) vs. Roma "purges only the affected Page's known stable/exact-locale keys."** An executor will guess which service (Roma or Tokyo) owns the purge call. Today `purgeAccountPagePublicCache` lives in Tokyo (`tokyo-worker/src/domains/pages/package-files.ts`), but the PRD's "Code work" lists purge under "Reuse existing … Cloudflare country, cache, and purge authorities" without saying whether Roma or Tokyo issues it for each of Save/Update/Publish/Unpublish/Delete.

#### 5. Needed documentation / updates (DEV perspective)

**Docs the PRD lists that DO need changing — with the exact sentence that becomes false**

- **`documentation/architecture/CONTEXT.md`**
  - Line 306-307 ("Page publish and public page serving are currently disabled because Roma does not currently write page packages.") becomes false. Must say: Page publish and public serving are enabled through direct current Page files; public serving completes exact-locale HTML from `overlays.json` and never runs the generator on a public request.
  - Line 248 storage block ("`serve-state.json # when submitted`", "`index.html # when submitted`", etc.) must add `overlays.json` and reflect that `serve-state.json` now carries `published` + `generatedFrom` + timestamps, and that the four generated objects are written together on Save/Update.
  - Line 175 ("Public serving state | Tokyo-worker") is correct but should be read alongside the new direct-file shape.

- **`documentation/architecture/Overview.md`**
  - Lines 240-242 ("Page publish and public page serving are currently disabled. Tokyo-worker parses page public routes but returns `404`, and internal publish returns `coreui.errors.page.publishUnavailable` until Roma writes page packages.") becomes false. Must say publish/serving are active and name the direct-file completion path.
  - Lines 159-165 storage block must add `overlays.json` and the new `serve-state.json` shape.

- **`documentation/architecture/OverlayArchitecture.md`**
  - Currently instance-only (lines 20-31). After 127C it must add the Page exact-overlay rule: one Page root runtime + one `overlays.json` (Page metadata + per-placement Instance overlays) = localized Page; locale never owns Page HTML/CSS/JS; the same `CK_LOCALE_CONTEXT`-style completion law applies.

- **`documentation/architecture/RuntimeProfiles.md`**
  - Lines 22-29 (Tokyo-worker Runtime Boundary) list only instance routes. Must add `/pages/{pageId}`, `/pages/{pageId}/{locale}`, and the support-file routes.
  - Lines 38-50 (Storage Runtime) describe the instance `CK_LOCALE_CONTEXT` marker injection; must add the Page completion rule (revision equality across the four generated objects, exact-locale completion, base-locale uses base values).

- **`documentation/services/roma.md`**
  - Lines 451-456 ("Current account page publish is disabled until Roma has a real page package writer. Public page copy/open actions are disabled until that writer exists. While a page is published, Roma requires unpublish before page source edit or delete.") — the first two clauses become false, and the third is directly contradicted by 127C's "already-published Page … successful Save/Update makes the new direct current files authoritative." Must say: Save/Update on a published Page writes new authoritative direct files and purges cache; only Delete requires unpublish first.
  - Lines 462-466 ("Any shift to generated child artifact coordinates, child evidence, or page package materialization belongs to a future Page Package PRD.") becomes false for the materialization-coordinate part — 127C introduces `generatedFrom.placements[].savedInstanceRevision`.

- **`documentation/services/tokyo-worker.md`**
  - Lines 175-182 ("Current account page publish is unavailable until Roma writes page packages. Tokyo-worker rejects save/delete operations against published page source until Roma unpublishes the page.") — first clause false; second clause (reject save against published source) is contradicted by 127C and must be removed/rewritten.
  - Lines 199-202, 233-234 ("Account page public serving is unavailable until Roma writes page packages. Tokyo-worker does not generate page package files." / "current page public serving returns `404` until Roma writes real page packages.") becomes false.
  - Lines 280-283 internal route table must reflect the new Save/Update contract (direct files + `generatedFrom` metadata + serve-state advanced last) and the now-active publish route replacing the `publishUnavailable` stub at `internal-page-routes.ts:152-161`.
  - Storage shape around line 169 must add `overlays.json`.

- **`documentation/capabilities/localization.md`**
  - Lines 132-149 (Public Serving) are instance-only. Must add the Page exact-locale URL (`/pages/{pageId}/{locale}`), the stable-URL selection ladder, and the rule that base content is never served for a requested non-base locale (Page analogue of lines 147-149).

- **`documentation/capabilities/seo-geo.md`**
  - Line 55 ("Public page serving currently returns `404` because page package serving is not active."), lines 178-183 ("3. Page public serving is not active." / "Do not create a work item … page route, locale route, schema output"), line 204 ("by page when page package serving exists"), line 229 ("Public page request | `404` because page package serving is not active") — all become false. Must describe Page exact-locale serving, hreflang/x-default/JSON-LD completion, and sitemap inclusion of published complete exact-locale URLs.

- **`documentation/engineering/CloudflareOperations.md`**
  - 127C says update "only for actual changed Page cache/purge operations." The current `purgeAccountPagePublicCache` (`tokyo-worker/src/domains/pages/package-files.ts`) already purges `base`, `base/`, `base/index.html`, `styles.css`, `runtime.js`. 127C adds exact-locale and stable-URL keys and purge-on-Save/Update. The doc must state the expanded purge set and that raw country is never a cache key.

**Docs the PRD MISSES**

- **`documentation/architecture/AccountManagement.md`** (not in 127C's list). Line 190-193 already says "When page public serving is enabled, the public route shape is: `/{accountPublicId}/pages/{pageId}`" — this becomes current truth, not conditional. Also lines 110-111 ("A downgrade does not automatically … publish, unpublish … Pages") stays valid but should be reconciled with active serving. Mama 127 explicitly lists `AccountManagement.md`; 127C omits it.
- **`documentation/capabilities/multitenancy.md`** (not in 127C's list). Lines 29-30 reference "Roma page publish disabled route" and the doc owns `pages.max` tier visibility. After 127C, "page publish disabled route" is false and must describe the active publish + `pages.max` gate. Mama 127 lists `multitenancy.md`; 127C omits it.
- **Reason-key registry** (`packages/ck-contracts/src/reason-keys.ts`). `coreui.errors.page.publishUnavailable`, `coreui.errors.page.saveRequiresUnpublish`, and `coreui.errors.page.deleteRequiresUnpublish` are all referenced in `internal-page-routes.ts:157,231,260`. 127C flips publish from `publishUnavailable` stub to real, and removes the `saveRequiresUnpublish` guard (per "already-published Page … Save/Update makes the new direct current files authoritative"). `deleteRequiresUnpublish` stays. The reason-key doc/registry must be reconciled, and 127C does not mention it.
- **`documentation/architecture/Tenets.md`** Tenet 11 (lines 324-326: "Page source is current account-owned product data. Page publish and page public serving are currently unavailable until Roma writes page packages. Tokyo-worker must not compose pages from source on visitor requests."). The "currently unavailable" clause becomes false; the "must not compose from source" clause stays and should be sharpened to "completes exact-locale HTML from stored `overlays.json`, never from source." Mama 127 lists `Tenets.md`; 127C omits it.
- **`packages/ck-contracts`** — 127C states `PageGeneratedFrom` is "the one shared `@clickeen/ck-contracts` type used unchanged by 127B, 127C, and 127D," but `grep` shows `PageGeneratedFrom` exists only in the three PRDs, not in `packages/ck-contracts/src/`. The contract type must actually be added (127B/127C/127D dependency), and the contract changelog/README updated.

**Docs the PRD lists that DO NOT need changing**

- **`documentation/services/tokyo.md`** — not in 127C's list and correctly so; its lines 80-81 ("Public account page serving remains `404` until Roma writes real page artifacts") will need updating, so this actually belongs in the "misses" column above (127C neither lists nor addresses it). Flagging here only to note the gap: `tokyo.md` line 80-81 will become false.
- None of the widget authoring/shared docs or the eight widget docs need changes for 127C (generation/instance changes are 127B's scope).

**Verdict:** Architecturally clean and tenet-compliant; APPROVE WITH CHANGES — fix the §4 under-specified completion/selection prose (especially the `CK_LOCALE_CONTEXT` marker reuse, `overlays.json` shape, country-mapping source, and "remembered choice" authority), reconcile the published-Page Save/Update contradiction with the current `saveRequiresUnpublish` guard, and expand the §5 doc list to include `AccountManagement.md`, `multitenancy.md`, `Tenets.md`, `tokyo.md`, the reason-key registry, and the actual `ck-contracts` `PageGeneratedFrom` type.

---

## 2. Senior Product Manager Peer Review

### 127C — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

The slice is well-shaped and scales without legacy machinery. Worth affirming:

- **Revision-gated direct storage is the right elegance.** Attaching `generatedFrom.pageRevision` as R2 object metadata on all four generated objects, advancing `serve-state.json` last, and failing closed on any mismatch lets Tokyo reject mixed Page state deterministically — no package versions, no last-good pointer, no evidence product. This is the accepted law implemented cleanly.
- **Cache keying by (account, page, revision, exact locale) — not raw country — is the correct scalability call.** "Many countries may share the same approved locale response" prevents per-country fragmentation and keeps the edge cheap. CSS/runtime shared across locales compounds this.
- **No agent on the public path.** "Tokyo never resolves a product tier" and "public routes never call Roma, Bob, Page Builder, Translation Agent, Web Code Generator, or child public Widget URLs" keeps public serving O(1) and edge-cacheable. This is the moat expressed at the runtime boundary.
- **One shared `PageGeneratedFrom` contract across 127B/127C/127D** prevents drift between generation, storage, and currency — the lean alternative to a dependency graph.
- **"Needs update keeps serving the last successful saved result" with no separate last-good store** works because current files *are* the last-good result once serve-state only advances on full success. Minimal and correct.

One scalability watch-item (also picked up in §2 verification): the current instance index HTML ships with `s-maxage=300, stale-while-revalidate=86400`. Combined with best-effort Cloudflare purge, a post-Save/Update edge may briefly serve the prior revision. The revision gate protects against *mixed* files, not against serving a *valid older* revision, so the SWR window versus purge semantics is the one cost-control spot to confirm operationally.

#### 2. Compliance with Product UX best practices

Accuracy and execution-readiness findings, ordered by weight.

1. **Publish gate depends on a slice that ships after 127C.** 127C declares `Depends on: deployed and verified 127A and 127B`, and the Mama's mandated order is `127A → 127B → 127C → 127D → 127E → 127F`. Yet 127C's Publish step 5 requires `127D freshness = Current`. 127D owns Currency/Needs-update. At 127C deployment there is no 127D, so this Publish step cannot be evaluated. Reconcile: either scope 127C's Publish gate to what 127C owns (direct-file revision matches serve-state) and leave the source-vs-generated Currency gate to 127D, or correct the dependency line. As written, the Publish contract references a capability that does not yet exist.

2. **The four-step locale ladder is accepted as settled; the issue is the authority its step 1 relies on.** Step 1 is "explicit remembered visitor choice scoped to Clickeen's existing global privacy/choice authority." The Mama explicitly states PRD 127 "adds no remembered-locale cookie, visitor-preference store, consent authority, or preference synchronization" and that remembered choice may come "only through the global privacy authority" in "a later program." So that authority is future work, not "existing." Either the authority is built inside 127's scope (then it is a real, currently-undocumented deliverable) or step 1 is a no-op until a later program (then the wording "existing" is inaccurate and the stable URL effectively resolves via steps 2–4 today). The ladder is not in question; the anchor of step 1 is.

3. **Sitemap/robots behavior is asserted but missing from the Code work checklist.** The SEO section states "Sitemap/discovery includes published, complete exact-locale URLs" and "Host-level robots and sitemap ownership remain with Tokyo," and the Verification list includes "sitemap output is correct." But the Code work list contains no item to implement the sitemap/robots surface, and no such surface exists in `clk-live-routes.ts` today. A described output with no implementing work item is an execution-readiness gap.

4. **Exact-locale URL shape diverges from the established widget convention.** 127C uses a path segment: `clk.live/{accountPublicId}/pages/{pageId}/{locale}`. Widget public serving uses a query param: `/{accountPublicId}/{instanceId}?locale={locale}` (see `clk-live-routes.ts` and `localization.md`). A path-based locale URL is the better SEO/canonical choice for Pages and is defensible, but the current `parseClkLivePath` parser treats the 4th Page segment as a delivery *file* (`isPageDeliveryFile`), so it must be rewritten; and the two conventions will coexist. Confirm the divergence is intentional and captured (see §5).

5. **`serve-state.json` may carry a field nothing consumes.** 127C's own minimality rule is "Keep only serving and freshness data actually consumed by 127C/127D." Freshness is revision-based (`generatedFrom.pageRevision` + `savedInstanceRevision`). `publishedAt` is legitimately part of publication state; `savedAt` is not clearly consumed by serving or by revision-based Currency. Either show the consumer or drop `savedAt` to honor the contract's own bar.

6. **Verification list omits a post-purge stale-serve check.** Given `stale-while-revalidate=86400` and best-effort purge, the verification set should explicitly prove that a prior-revision response is not served after a successful Save/Update/Publish/Unpublish once the purge completes. "Cache purge fails → do not claim full success" is present and correct; the positive "stale bytes are not served after success" is the missing complement.

7. **Edge case: referenced Instance deletion is invisible to revision-based Currency.** Deletion is not a revision bump. A published Page that embeds a later-deleted Instance could remain "Current" and keep serving that Instance's content from its own generated files. That may be intended (the Page is a self-contained snapshot from last Save/Update), but neither 127C nor the Mama states it. Confirm with 127D so the behavior is deliberate, not silent.

#### 3. Bad UX writing for the user (if present)

No findings.

127C is internal contract throughout. The only customer-facing copy it touches indirectly ("Page needs updating / A widget or page translation has changed. Update the page to continue.") is owned by the Mama and is unchanged here. Failure mappings reuse existing serving strings (`404`, "Locale not available", "Locale data invalid").

#### 4. Alignment with "Clickeen is different from legacy SaaS" (product perspective)

Strong alignment. Direct current files with no package/pointer/version machinery, deterministic stored-overlay completion (not request-time generation), fail-closed mixed-revision rejection, revision-based Currency, and a agent-free public path are exactly the lean, schema-first, fail-visible thesis. The slice deliberately refuses last-good retention, evidence products, dependency graphs, country variants, and request-time generation — the machinery legacy SaaS accumulates.

The one place to hold the line on leanness is the §2.2 point: step 1 of the locale ladder depends on a "global privacy/choice authority." Building a real preference/consent authority is legacy-shaped work; if it enters 127's scope it should do so as a named, minimal authority, not an ad-hoc remembered-locale cookie. Keep that boundary explicit.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

127C's own "Documentation after deployment" list is sound for the surfaces it names. Add the gaps it does not cover:

1. **`embed.seoGeo.enabled` registry conflict reconciliation.** `packages/ck-policy/src/registry.ts` marks it `enforced` with owner "Roma product save/publish and public code flow," while `multitenancy.md` and `seo-geo.md` both flag it as *conflicting metadata* with no proven consumer. 127B + 127C are what make that consumer real. Once deployed, flip the capability-doc status from "gap/conflicting" to "enforced" in the same change, or the registry will keep contradicting the docs.

2. **Locale URL convention divergence.** `documentation/capabilities/localization.md` and `seo-geo.md` document only the widget `?locale=` shape. 127C introduces a path-based `/{locale}` for Pages. Record both conventions (and the SEO rationale) so the divergence is current truth, not drift.

3. **The "global privacy/choice authority."** No current doc owns it, and 127C references it as "existing." Either document it as a new authority built under 127 (with its operator doc and scope) or record that stable-URL step 1 is deferred to a later program and the stable URL currently resolves via steps 2–4. CONTEXT.md or a dedicated privacy-authority doc should hold this, not an inline PRD reference.

4. **`views.monthly.max` surface widened.** 127C newly serves Pages publicly while `views.monthly.max` remains a documented `gap` (registry + multitenancy.md) with no deny/upsell. Confirm the gap description still accurately covers post-127C Page public traffic, which now counts nowhere.

5. **Tokyo sitemap/robots surface.** Once 127C implements the sitemap/host-robots behavior from §2.3, `tokyo-worker.md` (and Cloudflare operations docs if cache/purge rules change) should own it. There is currently no documented Tokyo sitemap/robots responsibility.

**Verdict:** Accurate to product intent and strongly on-thesis, but ships with one hard dependency contradiction (Publish gate requires not-yet-deployed 127D), one step-1 locale authority that the Mama defers, and an asserted-but-unimplemented sitemap output — fix those three before acceptance.

---

## 3. Principal TPM Peer Review

### 127C — Principal TPM Peer Review (GLM)

#### 1. Cohesive and cost-effective architecture

The slice is cohesive. It reuses the existing Roma→Tokyo authority chain, the existing account Page storage root (`accounts/{accountPublicId}/pages/{pageId}/`), the existing Cloudflare purge path (`tokyo-worker/src/domains/pages/package-files.ts`), and the existing overlay-application marker (`window.CK_LOCALE_CONTEXT = null;` in `tokyo-worker/src/routes/clk-live-routes.ts:119`). It correctly refuses to invent a package layer, candidate installs, version history, or a request-time generator, matching Mama §4 and §12.

Cost profile is sound: public serving is a stored-overlay read + deterministic head completion, no model/DB/generator hop on the request path, and CSS/runtime are shared across locales so only the localized HTML varies. This is the right shape for a CDN-fronted public surface.

Two cohesion gaps that should be tightened before execution, neither a redesign:

- **`serve-state.json` shape regression.** 127C's proposed `PageServeState = { published; generatedFrom; savedAt; publishedAt? }` (127C:72-78) drops the `accountId`/`pageId` self-identification that the current `readStoredServeState` enforces as an anti-corruption check (`tokyo-worker/src/domains/pages/serve-state.ts:46-54`, `readStoredServeState` rejects records whose `accountId`/`pageId` don't match the coordinate). The minimal shape is settled, but the executor should keep coordinate self-checks (or move them to the read boundary) so a Page serve-state read can still reject an object written under the wrong key. Flag as a V2/V5 watch item, not a shape change.

- **Two-state model ambiguity.** Current code treats the Page serve state as a literal string union `'published' | 'unpublished'` (`tokyo-worker/src/domains/pages/types.ts:1`, returned from `readStoredServeState`). 127C models it as `{ published: boolean; generatedFrom; ... }`. The PRD is clear that this is the intended migration; the executor just needs an explicit conversion at the storage boundary rather than a silent coerce (Tenet 4). Note it in the code-work checklist.

No invented subsystems; no package/version/last-good machinery. Cohesive.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

Mostly clean. The authority table (127C:29-39) correctly assigns each concern to a named owner and repeats the hard rule that public routes never call Roma/Bob/generator/Translation Agent. That matches Tenet 11 and `tokyo-worker.md`.

Three clarity defects, ordered by severity:

- **(High) The stable-URL ladder references an authority that does not exist and that Mama forbids.** 127C:170 lists as step 1: "explicit remembered visitor choice scoped to Clickeen's existing global privacy/choice authority." There is no such authority in the codebase or docs (grep across `documentation/`, `tokyo-worker/src`, `roma` for `privacy authority`, `choice authority`, `remembered locale`, `consent authority` returns nothing). Worse, Mama §5 explicitly states: "PRD 127 adds no remembered-locale cookie, visitor-preference store, consent authority, or preference synchronization." So 127C's ladder step 1 contradicts its parent PRD. The other three ladder steps (browser language → country→locale mapping → baseLocale) match Mama §5 exactly. Step 1 must be removed, or Mama must be amended first. This is the one item I'd block execution on for clarity.

- **(Medium) `PageGeneratedFrom` is asserted to already live in `@clickeen/ck-contracts` but does not.** 127C:80-82: "`PageGeneratedFrom` is the one shared `@clickeen/ck-contracts` type used unchanged by 127B, 127C, and 127D." A source-only scan of `packages/ck-contracts/src` shows zero matches for `PageGeneratedFrom`, `generatedFrom`, `pageRevision`, or `savedInstanceRevision`; the only Page-related export is `isCompactPageId`/`createCompactPageId` (`packages/ck-contracts/src/overlay-identity.ts:50-63`). The current Page serve-state is the string union in `tokyo-worker/src/domains/pages/types.ts`. So this type has to be authored (almost certainly in 127B, since 127B owns the generator output contract) before 127C can consume it "unchanged." The PRD should say "127B adds `PageGeneratedFrom` to `@clickeen/ck-contracts`; 127C consumes it unchanged" rather than implying it already exists. Accuracy fix only.

- **(Medium) `savedInstanceRevision` has no defined source today.** 127C's `generatedFrom.placements[].savedInstanceRevision` (127C:69) assumes each saved Instance carries a discrete revision stamp consumable by Page serving. The current Instance model uses an `updatedAt` ISO timestamp as its saved-revision proxy (`tokyo-worker/src/domains/account-instances/source.ts` uses `updatedAt`, not a revision string); the Page `AccountPageSource` does carry a numeric `revision` (`roma/lib/account-page-direct.ts:56`), but Instances do not expose one in `list-facts` (`tokyo-worker.md` lists `updated timestamp`, not a revision). 127C is silent on where `savedInstanceRevision` comes from. This is a 127B contract gap that 127C depends on. Note it as a cross-slice dependency to close, not new 127C machinery.

No invented subsystems. The PRD does not invent a queue, poller, evidence product, dependency graph, chunk registry, or locale registry. Section 2's real intent (verify no invented machinery) is satisfied; the defects above are accuracy/dependency gaps, not invented subsystems.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

Descriptive, not a mandate to copy. The plan lands well against what public-page SaaS competitors (Webflow, Framer, Wix, Shopify localization, Vercel Next.js i18n) get judged on:

- **Exact-locale URLs with self-canonical + hreflang + x-default** (127C:233-243) is the current best-practice shape for crawlable multi-locale pages; many competitors still serve `?locale=` query variants, which 127C correctly avoids for Pages by using path segments (`/{locale}`). This is ahead of several incumbents.
- **Per-locale HTML cache keyed by (account, page, revision, locale), not raw country** (127C:218-225) is the correct cost/privacy posture and avoids the IP-in-cache-key antipattern that has bitten competitors. Country-as-hint-only is the right call.
- **Crawler-complete HTML per locale with shared CSS/JS** matches the "complete semantic HTML before JS runs" baseline Mama §6 sets; this is the differentiator versus competitors that ship client-rendered primary content.
- **Stable-URL redirect to exact locale** is the standard pattern and 127C's 3-step fallback (browser language → country→locale → baseLocale) is the conventional ladder.
- **Revision as ETag/integrity value, not a cache dimension** (Mama §9, echoed 127C:201-202) is a clean invalidation model.

One competitive caveat worth noting (not a defect): competitors increasingly offer per-locale sitemap entries and `hreflang` round-trips; 127C:248-252 owns sitemap/discovery at Tokyo but leaves the exact sitemap surface underspecified. For parity, the executor should confirm the sitemap lists each published exact-locale URL, not just the stable URL.

Technically this is at or above the bar the Mama PRD sets. The gap is not the technical bar; it's the dependency gaps in §2.

#### 4. Absence of V1–V8 violations

Audited against the PRD text and the current runtime grounding. The design intent is violation-free; the gaps below are execution-time watch items, not violations in the PRD itself.

- **V1 Silent substitution — PASS by design, one watch.** 127C:162-163, 318-319 explicitly forbid locale substitution ("Never substitute another locale"). Watch item: the stable-URL ladder's terminal fallback to `baseLocale` (127C:173, 185) is the one allowed deterministic default; the executor must keep it as the explicit contract and not let a corrupt/missing overlay silently fall through to base.
- **V2 Silent healing — PASS, one watch.** 127C does not repair state; the first-create partial-root cleanup (127C:118-122) is an explicit request-scoped delete, not healing. Watch: the `serve-state` shape migration noted in §1 must be an explicit conversion, not a silent coerce of the old `{status:'published'|'unpublished'}` record into the new `{published:boolean}` field.
- **V3 Silent omission — PASS.** Failure table (127C:312-322) names every omission (missing locale, overlay-application failure, cache-purge failure) as an explicit failure, never a drop.
- **V4 Fail-open control — PASS.** Cache-purge failure is reported as incomplete, not swallowed (127C:320); purge config missing already throws `UPSTREAM_UNAVAILABLE` in `package-files.ts:14-20`, matching the design.
- **V5 Corruption-as-absence — PASS, one watch.** 127C:316 distinguishes "revision does not match serve state → fail closed, never serve mixed" from absence. Watch: this is the strongest reason to keep coordinate self-checks in the new `serve-state` shape (see §1) — dropping `accountId`/`pageId` from the record weakens corruption detection at the read boundary.
- **V6 Partial-success masquerade — PASS.** 127C:114-116 and 126 ("full success is not claimed and serve-state is not advanced"; "A failed operation does not announce a new current revision") directly satisfy V6. `serve-state.json` advanced last (127C:111) is the correct commit-marker ordering, mirroring the Instance pattern (`tokyo-worker.md`: "The config document carries the package fingerprint and is the source commit marker").
- **V7 Masquerade/redress — PASS.** No retry/redirect under a different name; unpublish→delete is an explicit two-command sequence.
- **V8 Runtime test dependency — PASS.** No probes/tests on the public path.

Net: design is GREEN on V1–V8. Three execution watch items (shape-migration coerce, locale-fallback-as-contract, serve-state coordinate checks) flagged for the implementing slice.

#### 5. Needed documentation / updates (TPM perspective)

127C's own "Documentation after deployment" list (127C:326-333) is the right starting set but is incomplete against the actual runtime drift this slice introduces. Concretely:

- **`tokyo.md` and `OverlayArchitecture.md` and `RuntimeProfiles.md` must be updated, not just listed.** All three currently state that localized public responses are served `no-store` (`tokyo.md`: "uses `no-store`"; `OverlayArchitecture.md`: "serves the response with `no-store`"; `RuntimeProfiles.md`: localized serving is `no-store`). 127C's core serving model is the opposite: completed exact-locale responses are CDN-cached (127C:216-225). Current code confirms the `no-store` baseline for locale responses (`clk-live-routes.ts:152-161`, `responseForLocalizedIndex`). This is a confirmed doc/runtime mismatch that 127C creates and must fix with the behavior change. Flag this explicitly so it isn't missed — the three docs listed in 127C:328-329 are named, but the specific "no-store → cacheable per-locale" reversal is not called out and is easy to miss.
- **`tokyo-worker.md` internal route table and purge scope.** The purge list today is the fixed 5-key set (`base`, `base/`, `index.html`, `styles.css`, `runtime.js`) in `package-files.ts:31`. 127C adds per-locale cache keys (`/{locale}`) and `overlays.json`. The service doc's "Public Serving" and the route table should reflect the expanded purge set and the new `pages/{pageId}/{locale}` public path shape (path-locale, not the current `?locale=` query used for Instances).
- **`roma.md` Pages Domain section.** It currently documents the `publishUnavailable`/`saveRequiresUnpublish` stubs (`roma.md` ~line 454: "Current account page publish is disabled until Roma has a real page package writer"). 127C flips publish on; that paragraph and the `coreui.errors.page.publishUnavailable` reference in `internal-page-routes.ts:157` and `roma/app/api/account/pages/[pageId]/publish/route.ts:44` become stale and must be updated.
- **Path-locale vs query-locale divergence.** Public Instance serving uses `?locale=` (`clk-live-routes.ts:203`); 127C Page serving uses `/{locale}` path segments (127C:155). This is an intentional difference but should be documented somewhere (likely `tokyo-worker.md` Public Serving) so the two models aren't conflated by future agents.
- **`PageGeneratedFrom` contract home.** Once 127B lands it in `@clickeen/ck-contracts`, the ck-contracts package doc/README should note it is the shared revision-snapshot type for 127B/127C/127D, since 127C asserts that single-source property.
- **Mama PRD §5 / 127C §stable-URL alignment.** If the ladder step 1 (remembered visitor choice) is removed per §2 above, both PRDs should be reconciled in the same change so the stable-URL ladder is stated identically in parent and child.

No new docs are needed beyond 127C's list; the gaps are (a) calling out the `no-store`→cacheable reversal explicitly in the three named architecture docs, and (b) the purge-scope and path-locale updates in `tokyo-worker.md`.

**Verdict:** Approve with two required fixes before execution — remove/forbid the non-existent "remembered visitor choice" ladder step (contradicts Mama §5), and restate `PageGeneratedFrom`/`savedInstanceRevision` as explicit 127B contract dependencies rather than pre-existing types; everything else is execution-watch, not redesign.

---

## 4. Consolidated Verdict & Convergence

All three seats: **APPROVE WITH CHANGES**. No BLOCK. The PRD is lean, on-thesis, and correctly refuses the machinery the team rejected (no package folders, no last-good, no `save_failed`, no evidence product). The findings are accuracy gaps, executor-invention gaps, and documentation coverage — not redesign.

### Convergent blockers-to-resolve (all three or majority flagged)

1. **The stable-URL ladder step 1 ("remembered visitor choice") references an authority that does not exist and that Mama §5 explicitly forbids.** (Staff §4-6; PM §2-2; TPM §2)
   Mama §5: "PRD 127 adds no remembered-locale cookie, visitor-preference store, consent authority, or preference synchronization." 127C step 1: "explicit remembered visitor choice scoped to Clickeen's existing global privacy/choice authority." No such authority exists in code or docs. **Must remove step 1 or amend Mama first.**

2. **`PageGeneratedFrom` is asserted as an existing `@clickeen/ck-contracts` type but does not exist there.** (Staff §5; TPM §2)
   Grep of `packages/ck-contracts/src` returns zero matches. The type must be authored in 127B before 127C can consume it "unchanged." **Restate as an explicit 127B contract dependency.**

3. **`savedInstanceRevision` has no defined source.** (TPM §2)
   Current Instance model uses `updatedAt` ISO timestamp, not a revision string; `list-facts` returns a timestamp, not a revision. 127C's `generatedFrom.placements[].savedInstanceRevision` depends on a 127B contract that hasn't been pinned. **Cross-slice dependency to close.**

4. **Publish step 5 requires 127D freshness = Current, but 127D ships after 127C.** (PM §2-1)
   127C declares `Depends on: 127A and 127B`; the Mama's order is `127A→127B→127C→127D→127E→127F`. At 127C deployment, the 127D Currency gate does not exist. **Reconcile: either scope 127C's Publish gate to direct-file revision matching, or correct the dependency.**

5. **The published-Page Save/Update behavior contradicts the current `saveRequiresUnpublish` guard.** (Staff §4-11)
   127C: "For an already-published Page, a successful Save/Update makes the new direct current files authoritative." Current code (`internal-page-routes.ts:228-235`) throws `coreui.errors.page.saveRequiresUnpublish`. The PRD does not name the guard or reason key to remove. **Name the guard deletion explicitly.**

### Executor-invention gaps (where an AI will guess)

These are the unpinned contracts an executor will invent behavior for:

- **The locale-completion marker:** "applies values through existing deterministic overlay markers/field paths" — does Page completion reuse the instance `CK_LOCALE_CONTEXT` marker, or introduce placement-level markers? (Staff §4-1)
- **The `overlays.json` internal shape:** "Page and placement overlays" — what is the merge order, the key grammar, the Page-metadata vs per-placement structure? (Staff §4-2)
- **The head-completion surface:** `<html lang>`, title, canonical, hreflang, x-default, JSON-LD — current `indexHtmlWithLocaleContext` only rewrites `<html lang>` and the locale-context script. None of the rest exists in code. (Staff §4-3)
- **The cache-identity wire form:** ETag? Custom header? Vary? Named dimension but not the wire shape. (Staff §4-4)
- **The country-mapping source Tokyo reads on a public request:** Roma-side `countryLocaleRules` exists; Tokyo has no `request.cf.country` consumer today. (Staff §4-5)
- **The `Accept-Language` parsing rule for step 2:** exact match vs. language-subtag fallback. (Staff §4-7)
- **The R2 metadata key name for `pageRevision`:** current instance fingerprinting uses a different mechanism. (Staff §4-8)
- **"discovery state" ownership:** is it a sitemap object? A KV index? No storage coordinate or operation named. (Staff §4-10)
- **Which service issues the purge for each operation:** Roma or Tokyo? Today `purgeAccountPagePublicCache` is in Tokyo. (Staff §4-12)
- **The `serve-state.json` shape migration:** string union `'published'|'unpublished'` → `{published: boolean; ...}`. Must be an explicit conversion, not a silent coerce. (TPM §1)

### V1–V8 audit convergence

**V1–V8 all PASS by design.** Three execution watch items:
- V2/V5: keep coordinate self-checks (`accountId`/`pageId`) in the new serve-state shape, or move them to the read boundary — dropping them weakens corruption detection.
- V2: the serve-state shape migration must be an explicit conversion, not a silent coerce.
- V1: the baseLocale terminal fallback must stay explicit contract, not a silent fallthrough.

### Documentation coverage (primary deliverable)

**The one structural doc miss all three flagged:** the `no-store` → cacheable-per-locale reversal. Three architecture docs (`tokyo.md`, `OverlayArchitecture.md`, `RuntimeProfiles.md`) currently state localized public responses are served `no-store`. 127C's core model is the opposite (completed exact-locale responses are CDN-cached). The PRD lists these docs but does not call out the specific reversal. **Easy to miss; high-impact if missed.**

**Docs 127C omits but must touch:**
- `AccountManagement.md` (Page public route shape becomes current truth)
- `multitenancy.md` (page publish disabled route becomes active; `pages.max` gate)
- `Tenets.md` (Tenet 11 "currently unavailable" clause flips)
- `tokyo.md` (the `no-store` reversal + Page serving becomes active)
- Reason-key registry (`publishUnavailable`, `saveRequiresUnpublish` removed; `deleteRequiresUnpublish` stays)
- `packages/ck-contracts` (`PageGeneratedFrom` must actually be added)

**Docs 127C lists that need the specific reversal called out:**
- `OverlayArchitecture.md`, `RuntimeProfiles.md` — the `no-store` → cacheable flip
- `tokyo-worker.md` — purge scope expansion + path-locale vs query-locale divergence

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** 127C is structurally lean, tenet-compliant (V1–V8 PASS), and on-thesis. Execution should not begin until the five convergent blockers are resolved (remove the non-existent step-1 authority; restate `PageGeneratedFrom`/`savedInstanceRevision` as 127B dependencies; reconcile the 127D Publish-gate dependency; name the `saveRequiresUnpublish` guard removal) and the ten executor-invention gaps are pinned. The `no-store` → cacheable doc reversal is the single highest-impact documentation miss.
