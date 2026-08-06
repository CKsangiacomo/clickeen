# 127 MAMA PRD — Consolidated Peer Review (GLM)

> **Historical review — not execution authority.** This review predates the
> product-owner corrections now incorporated into the Mama and 127A–127F.
> Where it proposes migration machinery, locale lifecycle machinery, or a
> special Tier99 system, the accepted PRDs supersede it.
> It also predates the direct three-file Widget/Instance/Page law now owned by
> the Mama and rewritten 127B.
> It predates the accepted Web Code Generator name and authority; any Page
> Compiler recommendation below is historical.

Status: **PEER REVIEW — CONSOLIDATED**

Subject: `127__PRD__Global_Pages_Program.md` (the MAMA) and its five execution slices 127A–127E.

Date: 2026-08-03

Model: builtin:zai-coding-plan/GLM-5.2

This file consolidates three independent peer reviews of the MAMA PRD, each
written by a subagent operating from a single seat (Staff Engineer, Senior
Product Manager, Principal TPM) and grounded in the deployed codebase, the
named tenets, and the V1–V8 core-violation audit. Each review was instructed to
break down code vectors, blast radiuses, and product/architecture implications
and to expose findings concretely rather than to rubber-stamp.

The three reviews are reproduced verbatim below in their authored order, then a
short convergence note ties them together. No review was edited by the
consolidator.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127 MAMA PRD — Staff Engineer Peer Review (GLM)

This review grounds the MAMA and the five lettered PRDs against the deployed
code, the typed contracts in `packages/`, and the named tenets. Where the PRD's
prose and the code disagree, the code wins (Tenet 13), and I say so.

#### 1. Elegant engineering and scalability

**Genuinely elegant decisions, and why they hold up:**

- **Single renderer for preview and publish (127B §"Preview", 127C §"Authorities").**
  "There is no second Page Builder renderer and no 'close enough' preview DOM"
  is the single highest-leverage decision in the program. It collapses what
  would otherwise be two drift-prone HTML/CSS/JS pipelines into one. The 127B
  `PageCompilerResult` carries `files` plus `evidence`, and 127E preview +
  127C publish consume the same export. This is correct and rare; most teams
  ship a preview that lies. It also forces the determinism requirement to be
  honored once, not twice.

- **Deterministic compiler with content-addressed fingerprinting (127B §7,
  127C §"Keeping cached files consistent").** Fingerprinting each of the four
  files, then the ordered four-file set plus `compilerContractVersion`, gives
  `serve-state.json` a real selection coordinate and gives the CDN a stable
  cache identity (`styles.css?v={packageFingerprint}`). The "same canonical
  input → byte-identical files and evidence" rule is the right invariant to
  anchor on. This is the kind of determinism that lets last-good replacement
  be safe.

- **Last-good replacement via candidate-install-then-select (127C §"Publish,
  step by step").** Writing four objects under
  `packages/{packageFingerprint}/`, reading them back, verifying fingerprints,
  and only then mutating `serve-state.json` once, is the correct atomic-install
  pattern for R2 (which has no multi-object transaction). "The previous
  serve-state remains authoritative until step 4 succeeds" is exactly the
  V3/V5 protection the rest of the PRD claims. The fingerprinted support-file
  URL also solves the mixed-package problem cleanly: an older cached HTML
  physically cannot load newer CSS because the `?v=` query differs.

- **Direct Roma recompile instead of a queue/graph/poller (127D).** Refusing a
  Queue, reverse index, dependency graph, and background job — and instead
  scanning account Page sources after an Instance save — is the right call
  *for this product stage*, and it matches the AGENTS.md "no ceremony" rule and
  Tenet 5. The escape hatch ("If the direct operation cannot finish exactly
  within the current product request boundary, execution stops and returns to
  the product owner") is honest. It does not silently cap.

- **Refusing the Build/version product (MAMA §3, 127C §"Public and storage
  names").** "The fingerprinted package path is an internal atomic-install
  detail, not a customer Build/version product" prevents a whole accidental
  product line. Keeping only current + previous package and never exposing
  package history in Roma is correct restraint.

- **Page composition does not consume `instances.published.max` (MAMA §9, 127A
  rule 7).** Letting an unpublished-but-saved Instance appear in a Page is the
  right model: a Page is a different publication surface. This avoids forcing
  users to publish widgets standalone just to use them in a page.

**Where scalability claims are under-proven or risky at the code level:**

- **The single biggest scalability risk is the "Instance contribution"
  abstraction grafted onto a fundamentally single-instance materializer.**
  `packages/ck-runtime-materializer/src/materialize.ts` is built around one
  `RuntimeMaterializerArtifactCoordinate` of
  `kind: 'account-instance-widget'` with one `instanceId` and one
  `publicPath`. `buildIndexHtml` (html.ts:100) emits one `<html>` with one
  `<title>`, one `window.CK_LOCALE_CONTEXT = null;` marker, and one
  stylesheet/script pair. The generated `runtime.js` (runtime.ts:75) sets
  `window.CK_WIDGETS[instanceId]` exactly once and reads one
  `window.CK_LOCALE_CONTEXT`. `stampPackageRoot` (html.ts:90) *rejects*
  anything that is not exactly one top-level `data-role="root"` element. 127B
  §"The Instance contribution" hand-waves this as "Extend the existing runtime
  materializer with one reusable in-memory operation" and "This operation must
  reuse the same Widget package parsing, root stamping, styles, runtime
  modules, field paths, and validation." That is a substantial refactor, not an
  extension. The PRD's own fallback ("If the existing materializer cannot
  expose a contribution without changing standalone Widget behavior, execution
  stops") is the correct safety valve, but it is doing a lot of load-bearing
  work and the prose underestimates the effort. The determinism claim ("same
  input → same output") is also unproven for the deduplication rules: "emit
  identical shared CSS bytes once" and "emit byte-identical shared runtime
  modules once ... preserve first-use execution order for distinct modules"
  require a stable, canonical module identity and ordering. The current module
  keying in `runtime.ts` is by `resolveProductPath(widgetname, src)` (e.g.
  `product/widgets/{widget}/widget.client.js`) — across two different widget
  types those keys never collide, but the "shared" modules (socialShare,
  accountTypographyData) are keyed by fixed strings. The dedup contract is
  plausible but not yet defined; a dev is left to invent the canonicalization.

- **The 127C locale-completion path is a new mechanism, not a reuse.** Today,
  Tokyo public serving (`tokyo-worker/src/routes/clk-live-routes.ts:128-249`)
  completes locale HTML by replacing the single
  `window.CK_LOCALE_CONTEXT = null;` marker and reading one
  `overlays/locales/{locale}.json` per instance. 127C §"Completing exact
  locale HTML" describes reading a single compiled `overlays.json` that
  bundles all Page + per-placement values for every locale, then applying a
  "locale-completion contract from 127B." That is a different data shape (one
  multi-locale file vs. N per-locale files) and a different injection target
  (Page-level `<html lang>` + a multi-instance runtime that does not exist
  yet). The claim "Reuse the 127B locale-completion contract; do not create a
  second HTML renderer in Tokyo" is aspirational — the contract does not exist
  yet and the runtime that would consume it does not exist yet. This is the
  single most under-specified load-bearing piece of the program.

- **127D's "scan all account Page sources after every Instance save" has a real
  but unbounded cost.** `listAccountPageSourcesInTokyo`
  (roma/lib/account-page-direct.ts:163) fetches and normalizes *every* Page
  source for the account on every Instance save. Today that is cheap because
  Pages are disabled. At Tier 4/Tier99 (unlimited Pages), an account could
  have hundreds of Page sources, each normalized through
  `normalizeAccountPageSource` (which validates locales, placements, metadata,
  etc.). 127D §"Performance proof" correctly names the measurements required,
  but the PRD provides no ceiling and no sampling — it bets the whole farm on
  "the direct scan stays within the request boundary." That is fine as a V1
  bet, but the MAMA's tenet 10 ("Tier 4 and Tier99 are unlimited") makes the
  worst case unbounded by product limit. The escape hatch protects
  correctness; it does not protect against a future where every Instance save
  becomes slow for large accounts.

#### 2. Compliance with architecture and tenets

**Strongly compliant:**

- **Tenet 2 (Named Authorities) — well mapped.** MAMA §10 and each lettered
  PRD's "Authorities" table assign Page routes/compiler orchestration to Roma,
  package storage and public response to Tokyo-worker, entitlements to
  `@clickeen/ck-policy`, the tier row to Michael/Supabase, and Dieter to UI.
  This matches the existing authority table in
  `documentation/architecture/Overview.md` and the runtime route ownership in
  `documentation/services/roma.md`. No boundary is silently reassigned.

- **Tenet 8 (Storage Follows Ownership) — exact.** MAMA §3 keeps Page source
  and packages under `accounts/{accountPublicId}/pages/{pageId}/`, which is the
  existing account-owned path confirmed in
  `tokyo-worker/src/domains/pages/keys.ts` and `CONTEXT.md`. The
  `packages/{packageFingerprint}/` subdirectory is an internal detail under the
  account root, not a new root. Compliant.

- **Tenet 3 and Tenet 9 (No silent substitution; overlays are exact) —
  repeatedly and correctly enforced.** MAMA §4 ("if a required overlay is
  missing or invalid, compilation fails; never substitute baseLocale"), 127A
  rule 5, 127B §1 and §6 ("The compiler never invents a missing overlay value
  or substitutes another locale"), and 127C's exact-locale-URL contract all
  refuse base-locale fallback. This matches `OverlayArchitecture.md`'s "Missing
  and corrupt overlay truth are distinct" and the existing `clk-live-routes.ts`
  behavior (`localeNotAvailable()` 404, `localeDataInvalid()` 500). This is the
  strongest part of the PRD's tenet compliance.

- **Tenet 11 (Public serving reads stored artifacts only) — correctly
  extended.** 127C §"Authorities" and the "public request path stays simple"
  block forbid public requests from loading Page source, traversing child
  Instances, invoking the compiler, or calling an agent. This directly
  continues the existing instance-serving rule in
  `tokyo-worker/src/routes/clk-live-routes.ts`, which reads stored artifacts
  and does locale injection only.

- **Tenet 5 (Product commands stay boring) — direct Roma operation, no
  orchestration bus.** MAMA §7 and 127D explicitly refuse a Queue, graph,
  poller, and background job. The recompile path is
  `Roma route → compiler → Tokyo install`. This is the boring path the tenet
  demands.

- **Tenet 7 (Bob edits in browser memory) — preserved.** 127E §"Opening an
  Instance in Bob" keeps Bob as the Instance editor; Page Builder does not
  embed a second Bob state owner and does not save Instance source through
  Page routes. Page Builder holds only an unsaved Page draft in client state.
  Compliant.

- **Tenet 12 (Dieter tokens first) — 127E §"Dieter conformance"** forbids
  `page-operational-table`, custom selects, bespoke popups, and Page-only
  color roles, and requires a missing primitive to be added to Dieter before
  use. This is the right application of the tenet.

- **V1–V8 coverage — unusually thorough.** Every lettered PRD ends with V1–V8
  review questions mapped to its own surface. MAMA §12 enumerates the
  program-level invariants. The separation of "save succeeded / replacement
  failed" (anti-V6), "corrupt source is corruption not absence" (anti-V5), and
  "no replaced stubs/paths/migration code survives" (anti-V7) are all called
  out.

**Risks of tenet violation:**

- **Tenet 1 (structured, typed, AI-legible artifacts) — at risk from the
  "Instance contribution" abstraction.** The PRD introduces
  `PageInstanceContribution` (127B) with `html`, `css[]`, `javascript[]`,
  `baseValues`, `overlays`. That is a reasonable intermediate type, but it is
  described as an in-memory only value ("not stored"). The risk is that the
  *contract* between the materializer's contribution and the compiler's
  HTML/CSS/JS consolidation is left to the implementer. Tenet 1 requires
  artifacts to "stay structured, typed, and AI-legible" and warns against
  hiding meaning in "ad hoc code." The contribution boundary is exactly the
  kind of seam where ad-hoc string concatenation will creep in ("consolidates
  and deduplicates CSS without weakening Instance isolation"). The PRD must
  specify the contribution contract more concretely, or it risks a V3 (silent
  omission of a placement's CSS/JS) and a V6 (a Page that renders but is
  missing a widget's runtime).

- **Tenet 4 (No silent healing) — at risk in the 127A migration of "initialize
  Page-owned social values as empty strings."** 127A §"Current-source
  migration" says to "initialize Page-owned social values as empty strings
  only where the old source had no such field and the new blank-Page contract
  defines empty as the real starting value." That is defensible *if* the
  blank-Page contract genuinely defines empty as the starting value. But it is
  one sentence away from silent healing: if an old source had a non-empty
  value with no exact destination, the PRD says "stop for product-owner
  review," which is correct. The risk is in the implementation: a dev under
  time pressure could treat "no social field" as "empty string" without
  proving the old source truly lacked it. The 127A V1–V8 question "Migration
  does not omit unexplained stored truth" is the right guard, but the prose
  should be harder: every field initialized to empty must be proven absent,
  not assumed absent.

- **Tenet 2 (no rediscovery) — at risk in the 127C "remembered visitor choice"
  and "Cloudflare-country mapping" selection.** 127C §"Stable Page URL" says
  selection uses "explicit/remembered visitor choice, when the global privacy
  policy permits remembering it" and "an account-approved Cloudflare-country
  mapping." Today there is *no* global privacy/cookie-consent authority (grep
  finds it only in a prague doc), and the country→locale mapping lives in
  `AccountLocalePolicy.ip.countryToLocale` (`packages/ck-contracts/src/index.ts`),
  which is account-translation-policy shaped, not Page-shaped. The PRD
  correctly says "127C does not invent a Page-only cookie policy," but it then
  *depends* on a "global privacy authority" that does not exist. A dev will
  either invent one (Tenet 2 violation: rediscovering authority) or hardcode a
  choice. This needs to be resolved before 127C, not during.

- **Tenet 3 (no silent substitution) — at risk in the stable-URL locale
  fallback chain itself.** MAMA §6 and 127C §"Stable Page URL" define a
  four-step selection ending in "Page baseLocale when no configured signal
  matches." That final step *is* a deterministic default ("the explicit
  contract of that request parameter" — allowed by Tenet 3), but only because
  the stable URL is documented as a *redirector* (`private, no-store`
  temporary redirect) to the exact locale URL. The PRD gets this right. The
  risk is implementation drift: if a dev makes the stable URL serve HTML
  directly (not redirect), the baseLocale fallback becomes a silent
  substitution for a visitor whose language was unavailable. The PRD must
  state more forcefully that the stable URL *always* redirects and never
  serves composed HTML.

- **V8 (runtime test dependency) — low risk but worth flagging.** 127B
  §"Deployment and verification" says "Use browser/runtime tests for behavior
  that static string assertions cannot prove. Do not make normal runtime
  depend on those tests." 127D repeats the rule. This is correctly stated. The
  risk is the determinism proof: "two runs over the same input are
  byte-identical" is easy to assert in a test but the proof that *production*
  runtime never depends on those tests requires discipline. The PRD's V8
  questions cover it.

- **MAMA tenet 10 vs. existing Tier semantics — the only place the PRD
  redefines product law, and it does so carefully.** Adding Tier99 as
  "internal operating account, not a superuser" with identical authorization
  is a real change to `AccountTier`
  (`packages/ck-policy/src/types.ts:1` currently
  `'free'|'tier1'|'tier2'|'tier3'|'tier4'`), the Supabase enum
  (`account_tier AS ENUM ('free','tier1','tier2','tier3','tier4')` in
  `supabase/migrations/20260522090000__prd103_db_core_foundation.sql:251`), the
  CHECK constraints on both `accounts` and `workspaces`, Berlin's
  `normalizeTier` switch (`berlin/src/bootstrap/state.ts:80`), and the matrix
  JSON. The PRD's deployment order (127A §"Deployment order": additive code
  first, then schema, then Berlin/Roma/Tokyo, then verify, then migrate
  `CLICKEEN` only if Tier 4) is the correct fail-closed sequence. This is
  compliant — but see §3 for the blast radius.

#### 3. Over-architecture / unnecessary complexity

- **The `packages/{packageFingerprint}/` indirection is justified, not
  over-architecture.** It would be tempting to call a per-fingerprint
  subfolder "a Build product." It is not — it is the minimum needed for atomic
  install + last-good retention + cache identity on R2, which has no
  multi-object transaction. The PRD earns this abstraction. Keep it.

- **`PageServeState` discriminant type (127C) is more ceremony than the
  current code, but justified.** The current
  `tokyo-worker/src/domains/pages/types.ts:1` is
  `PageServeState = 'published' | 'unpublished'` and `serve-state.ts` stores
  only `{accountId, pageId, status, publishedAt?, updatedAt}`. 127C's proposed
  discriminated union with `packageFingerprint`, `fileFingerprints`,
  `pageRevision`, `instanceRevisions[]`, `compilerContractVersion`,
  `baseLocale`, `locales` is a big jump. It is *necessary* for last-good and
  `current | out_of_date` (127D), but it is a near-total rewrite of the
  serve-state module and its readers. The blast radius: every reader of
  `readAccountPageServeState` (internal-page-routes.ts, the public serving
  path) must change. This is not over-architecture; it is the cost of the
  feature. But the PRD should acknowledge that `serve-state.ts` is being
  replaced, not "extended" — 127C §"Code work" point 2 says "Extend the
  existing Page package/serve-state modules rather than creating a second
  storage subsystem," which is the right anti-ceremony stance, but a dev
  reading "extend" will under-budget the work.

- **`PagePackageStatus = 'none' | 'current' | 'out_of_date'` (127D) is the
  right amount of vocabulary.** 127D §"The two states customers need"
  explicitly resists adding more ("No additional product vocabulary is
  needed"). Good. This is the PRD pushing back against over-architecture
  rather than introducing it.

- **127A's "Page source contract in one shared code authority" — correct, but
  the home is ambiguous.** The PRD says "Put the Page source contract in one
  shared code authority and use it from Roma and Tokyo validation" and lists
  both `packages/ck-contracts/**` and `packages/ck-policy/**` as likely
  owners. Today the Page source type lives in
  `roma/lib/account-page-direct.ts:49` (Roma-local) and Tokyo has its own
  `types.ts`. Putting it in `ck-contracts` is the right call (it is a shared
  typed contract). But the PRD should *name the package* — "one shared code
  authority" is vague enough that a dev could put it in `ck-policy` (wrong: it
  is not policy) or leave a copy in Roma. Concrete blast radius:
  `AccountPageSource` is currently imported across
  `roma/lib/account-page-source.ts`, `roma/lib/account-page-direct.ts`,
  `roma/app/api/account/pages/route.ts`, and mirrored implicitly in Tokyo's
  validation. Moving it touches all of them. Name the home.

- **127C's "robots.txt and sitemap discovery" as a Tokyo-owned host-level
  authority.** This is a new responsibility for Tokyo-worker, which today
  serves `clk.live` instance routes but owns no robots/sitemap. 127C §"Code
  work" point 7 says "Add Page entries to the existing clk.live robots/sitemap
  authority" — but there is no existing authority. The PRD silently invents one
  and calls it "existing." This is mild over-architecture dressed as reuse.
  Either name the new authority honestly or confirm where robots/sitemap for
  `clk.live` is owned today (it appears nowhere in `tokyo-worker/src`). A dev
  will guess.

- **The 127C stable-URL redirector with a four-step selection is the most
  complex piece of public-serving logic in the system and is not strictly
  necessary for V1.** The exact-locale URL
  (`/{accountPublicId}/pages/{pageId}/{locale}`) is the SEO/AEO-critical
  surface. The stable URL (`/{accountPublicId}/pages/{pageId}`) with
  remembered-choice/cookie/browser-language/country/baseLocale selection
  introduces cookie consent, country mapping, and a redirect layer — none of
  which have owning authorities today. A leaner V1 would serve the baseLocale
  at the stable URL (deterministic default, Tenet 3-compliant) and defer the
  multi-signal selector. The MAMA §6 wording ("The shorter URL selects only
  from locales the customer made available, in this order...") makes the
  selector a launch blocker. This is the clearest case of the PRD adding
  machinery ahead of proven product need.

- **Tier99 is a surprisingly wide blast radius for an "internal account"
  label.** 127A §"Tier99" lists the consumers that must accept it: policy
  types and matrix validation, entitlement and AI runtime matrices, authz
  capsules and Berlin bootstrap normalization, shared AI profile contracts,
  Roma account-context normalization and plan labels, account-management and
  tier-change validation, tests, and docs. That is roughly correct —
  `AccountTier` flows through `packages/ck-policy`, `packages/ck-contracts`
  (AI model management), `berlin/src/bootstrap/state.ts:80`,
  `berlin/src/bootstrap/capsule.ts`, Roma account context, and the Supabase
  enum + two CHECK constraints. The PRD is honest about the breadth. The mild
  over-architecture is *introducing a whole new tier* to express "this is the
  Clickeen account." A leaner alternative would have been a boolean
  `isInternal` flag on the account, leaving the tier enum at tier4. The PRD
  chose the more ceremonial option. It is defensible (tier is the existing
  entitlement axis, and `pages.max: null` already encodes "unlimited"), but it
  is the most expensive single decision in 127A and the one most likely to
  leak bugs (every closed consumer must be found).

#### 3b. Academic / theoretical abstractions and pre-work, meta-work, gold-plating

- **The SEO/GEO/AEO section (MAMA §6 "Why this supports SEO, geographic
  delivery, GEO, and AEO") is marketing-grade prose that does not belong in a
  MAMA at this density.** "AI search systems can read and cite complete
  server-delivered content at stable locale URLs," "semantic headings,
  attributable visible facts, supported structured data, and consistent
  metadata make answers easier to extract and verify" — this is best-time
  storytelling (see §4). The actual engineering requirements (complete
  semantic HTML, self-canonical exact locale URL, reciprocal hreflang,
  x-default, sitemap discovery, robots) are legitimate and already enumerated
  in 127C §"SEO, GEO, and AEO output." The MAMA's restatement adds nothing a
  dev can act on and reads like a pitch deck. Trim it.

- **127B §"Build `overlays.json`" — the path-key contract (`page.title`,
  `placements.{placementId}.{instanceFieldPath}`) is "typed and tested" but
  the typing is left to the implementer.** This is necessary foundation, not
  gold-plating, *but* the PRD spends prose on key-naming examples without
  committing to the type. Either specify the type in the PRD or point to the
  contract file that will own it. As written, it is half-specified
  scaffolding.

- **"Widget-specific structured data is included only when the Widget already
  owns a declared compatible contribution whose visible content supports it"
  (127B §3).** This is academic hedge. No widget today owns a "declared
  compatible structured-data contribution." The Widget package shape
  (`spec.json`, `widget.html`, `widget.css`, `widget.client.js`,
  `editable-fields.json`, `limits.json` — per `documentation/services/bob.md`
  and Tenet 6) has no structured-data file. So this sentence describes a
  feature that depends on a contract that does not exist. It is theoretical
  scaffolding. Either drop it for V1 ("no widget-specific structured data in
  V1; Page-level structured data only") or name the widget contract change
  required. As written, a dev will either invent a widget structured-data file
  or silently omit the feature with no way to know which is correct.

- **127E's one-card catalogue ("Blank page ... Start with an empty page and
  add your saved Widget Instances").** The PRD justifies the catalogue route
  by saying "The catalogue exists now so future Page starting points have the
  correct product home without changing the route model." That is
  designing-for-designing — a whole route (`/pages/catalog`) and navigation
  subitem for a single card, justified by hypothetical future templates the
  MAMA §10 explicitly excludes ("Page templates beyond blank"). This is mild
  gold-plating. A leaner V1 would put a "Create page" action on Your pages
  (which 127E already has) and skip the catalogue route until a second
  starting point exists. The PRD even admits the catalogue creates a blank
  Page through the same create route. The route is ceremony for ceremony's
  sake.

- **The 127D `PageUpdateSummary` / `AffectedPageResult` typed return from
  Instance save.** This is *necessary* foundation (the Instance save route
  must tell Bob/Roma which Pages were affected), not meta-work. But note the
  current Instance save route
  (`roma/app/api/account/instances/[instanceId]/route.ts`) returns the
  Instance save result only; threading an exhaustive
  `results: AffectedPageResult[]` through it is a real contract change to the
  Instance save response that 127D under-specifies. Bob's save handling
  (`documentation/services/bob.md` Save Contract) treats the response as
  "source/root persistence truth only." Changing that response shape is a Bob
  contract touch the PRD lists only as "127D adds no new service" — it adds a
  new field to an existing response, which is a contract change.

- **The repeated "definition of done" + "V1–V8 review questions" + "failure
  behavior" tables in every lettered PRD.** This is not gold-plating — it is
  the discipline AGENTS.md and Tenet 13 demand, and it maps cleanly to the
  V1–V8 audit gate. Keep it. This is the opposite of ceremony: it is the
  structured checklist the Plan Gate requires.

#### 4. Prose / best-time stories useless or harmful for devs

- **MAMA §6: "Clickeen guarantees valid crawlable output, not search
  ranking."** Harmless as a promise, useless to a dev. What is "valid"? A dev
  implementing the compiler cannot test against this. The actionable version
  is in 127C §"SEO, GEO, and AEO output" (the bullet list of required tags).
  The MAMA line should defer to that list and drop the guarantee prose.

- **MAMA §6: "Important content is not hidden behind client-side rendering or
  overlay requests."** This is a best-time story about the *goal* (GEO/AEO)
  framed as an engineering rule. The dev-left-guessing question: what counts
  as "important content"? The compiler emits *all* Instance HTML server-side
  (127B §3), so the rule is satisfied by construction. The prose implies a
  content-classification step that does not exist. Say "all Instance HTML is
  server-rendered in the compiled document; no primary content requires
  client-side execution" and drop "important."

- **MAMA §5: "consolidates and deduplicates CSS without weakening Instance
  isolation" and "consolidates and deduplicates JavaScript without merging
  Instance state."** These are the two most load-bearing engineering sentences
  in the entire program and they are aspirations, not specs. "Without
  weakening Instance isolation" — what *is* Instance isolation today? The
  materializer scopes CSS via `styleChunk(id, body)` with marker ids
  (`packages/ck-runtime-materializer/src/runtime.ts:23`) and keys runtime
  state by `instanceId` in `window.CK_WIDGETS`. "Isolation" presumably means:
  per-instance CSS scoping is preserved, and per-instance runtime state is
  keyed by placement/instance. The PRD never says that. A dev is left to
  invent what "isolation" means and could ship a Page where two instances of
  the same widget share state (the runtime currently sets
  `window.CK_WIDGETS[instanceId]` — for two placements of the *same*
  instanceId, which 127A forbids ("an instanceId may appear only once"), this
  is fine; but for two placements of *different* instances of the *same widget
  type*, the widget's `widget.client.js` runs once per placement and must
  initialize twice — the PRD's "initialize each placement once" (127B §5) is
  the only spec, and it is one line). This is the prose most likely to become
  invented code.

- **MAMA §6: "Country is only a selection hint. It cannot create a locale,
  write an overlay, guess a visitor's language, or change an exact locale
  URL."** This is good, hard rule-prose. Keep all of it. But it is immediately
  preceded by "an account-approved Cloudflare-country mapping" — and as noted
  in §2, there is no "account-approved Cloudflare-country mapping" authority
  for Pages today. The `AccountLocalePolicy.ip.countryToLocale` map exists but
  is shaped for translation-policy, not Page locale selection. The
  dev-left-guessing question: which map does the stable URL read? The PRD must
  name it.

- **127B §"The Instance contribution": "It must reuse the same Widget package
  parsing, root stamping, styles, runtime modules, field paths, and validation
  already used to create a standalone Instance package. It must not create a
  second Widget renderer."** The intent is correct and anti-ceremony. The
  harm: a dev reads "reuse" and underestimates that `stampPackageRoot`
  (html.ts:55) enforces exactly one top-level root and the runtime
  (runtime.ts:75) emits exactly one `CK_WIDGETS` payload. "Reuse" here means
  "refactor the single-instance materializer so it can emit N contributions
  without changing standalone output." That is not reuse; it is surgery. The
  PRD should say so.

- **127C §"Completing exact locale HTML" step 5: "applies those values to the
  compiled document using the locale-completion contract from 127B."** The
  locale-completion contract from 127B is one sentence in 127B §"Preview"
  ("asks the same locale-completion function to produce preview HTML for the
  selected locale") and otherwise undefined. A dev is left to invent the
  function. This is the most harmful piece of under-specification in 127C
  because it is the public-serving path: getting it wrong means wrong locale
  HTML served to crawlers.

- **127C §"Cache policy" table: "Missing locale | Explicit short-lived or
  non-cacheable 404 according to existing Tokyo error policy."** What is the
  "existing Tokyo error policy"? The current `clk-live-routes.ts` returns
  `localeNotAvailable()` with `no-store` on all three cache layers. So the
  policy is observable but unnamed. The PRD should say `no-store` (matching
  the existing instance-serving behavior) rather than deferring to an unnamed
  policy. A dev could read "short-lived" as `s-maxage=60`, which would cache a
  404 and violate the "no base-locale output" rule if the locale is later
  added.

- **127D §"How Roma finds affected Pages": "The codebase already has the
  starting helpers: `listAccountPageSourcesInTokyo`,
  `pageIdsPlacingInstance`."** True (`roma/lib/account-page-direct.ts:163` and
  `roma/lib/account-page-source.ts:142`). But note `pageIdsPlacingInstance` is
  currently used in the Instance *delete* path to block deletion
  (`roma/app/api/account/instances/[instanceId]/route.ts:243`). The PRD does
  not mention that the same helper is load-bearing in a different guard. A dev
  reusing/simplifying it could break delete protection. Mention it.

- **127E §"Page Builder" §"Page header": "one primary action: Save when
  source is dirty, otherwise Publish when the Page is unpublished."**
  Reasonable UX rule. But "one secondary action when required: Retry for
  out-of-date Pages or Unpublish for published Pages" leaves a dev to decide
  what happens when a Page is *both* dirty *and* out of date (source edited
  but last replacement failed). Which action is primary? The PRD does not say.
  This is exactly the kind of leeway that becomes invented behavior.

#### 5. Needed documentation / updates (DEV perspective)

**Docs the PRD correctly identifies and that genuinely need updates:**

- `documentation/architecture/CONTEXT.md` — "Clickeen Pages" flow (currently
  lines 286-296) says "Page publish and public page serving are currently
  disabled because Roma does not currently write page packages." After 127C
  this must be rewritten to describe publish, the package install, and public
  serving. The Storage Shapes block (lines 214-237) must add
  `packages/{packageFingerprint}/` and the four compiled files. The
  Authorities table must reflect Tier99.

- `documentation/architecture/Overview.md` — "Account Pages" block (lines
  215-227) says "Page publish and public page serving are currently disabled.
  Tokyo-worker parses page public routes but returns 404... until Roma writes
  page packages." Same rewrite as CONTEXT.md. The Storage Ownership block must
  reflect the package path.

- `documentation/architecture/RuntimeProfiles.md` — currently lists "Composed
  page | page-owned composition over referenced saved instances" (line 13) as
  a runtime surface, but there is no Page public-serving section. 127C must
  add the Page public-serving boundary (stable URL redirect, exact locale URL,
  fingerprinted support files, cache policy) parallel to the existing
  Tokyo-worker Runtime Boundary block.

- `documentation/architecture/OverlayArchitecture.md` — currently
  instance-only. 127A/127B introduce Page-owned overlays and a compiled
  `overlays.json` that is a different shape (multi-locale, Page+placement
  keyed). This doc must add the Page overlay contract or a cross-reference to
  a new Page overlay section, *and* must clarify that Instance overlays are
  unchanged (the PRD's strongest tenet compliance point).

- `documentation/services/roma.md` — the Pages Domain section (lines 421-446)
  must be rewritten for the three-route model, the compiler orchestration
  role, the `pages.max` gate, and the recompile path. The Builder
  Orchestration section's last paragraph on package materialization must note
  the Page compiler shares the materializer. The AI/entitlement sections must
  reflect Tier99 and `pages.max`.

- `documentation/services/tokyo-worker.md` — the Pages section (lines 137-160)
  must describe package install, serve-state with selection evidence, public
  page serving, the stable-URL redirect, exact-locale completion,
  fingerprinted support files, robots/sitemap ownership, and bounded package
  retention. The Private Roma Routes table (lines 244-266) must add the
  install operation and retry route. The Worker env table (lines 344-353)
  already lists `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN`; the
  doc must note Page cache purge uses them.

- `documentation/services/bob.md` — 127D may change the Instance save response
  (adding `PageUpdateSummary`). The Save Contract section (lines 256-288) must
  be updated if the response shape changes. 127B's contribution boundary may
  change a Bob/materializer statement; 127B flags this correctly.

- `documentation/services/berlin.md` — Tier99 must be added to the bootstrap
  normalization description (mirroring `berlin/src/bootstrap/state.ts:80`
  change).

- `documentation/services/michael.md` — the `account_tier` enum change and the
  conditional `CLICKEEN` row update must be recorded as current truth (the
  migration files already exist under `supabase/migrations/`).

- `documentation/capabilities/multitenancy.md` — Tier99 semantics ("internal
  operating account, not sellable, not assignable through customer flows") and
  `pages.max` per-tier table belong here.

- `documentation/capabilities/localization.md` — Page overlays, the compiled
  `overlays.json`, and the stable-URL locale selection must be documented as
  current behavior. The existing `baseLocale` authority statement must be
  reaffirmed (the PRD's strongest compliance point).

**Docs the PRD lists that may not need changing:**

- `documentation/architecture/Tenets.md` — the MAMA lists this, but the tenets
  themselves do not change. The only candidate edit is Tenet 8 / Tenet 11 if
  Page serving introduces a new storage root or a new public-serving rule; it
  does not (Page packages stay under `accounts/`, and public serving continues
  to read stored artifacts). Tenets.md should likely *not* be edited; if it
  is, only to add Page public serving to the Tenet 11 example list. Flag this
  so a dev does not gratuitously rewrite the tenets.

- `documentation/services/tokyo.md` — listed in 127C. This doc covers Tokyo
  storage/deploy, not Page behavior. It likely needs only a one-line note that
  Page packages follow the same R2 deploy rules. Confirm before editing.

**Docs the PRD missed:**

- `documentation/engineering/CloudflareOperations.md` — 127C adds Page cache
  purge (root, locale HTML, CSS, JS, robots, sitemap) and may add a "supported
  Page evidence command" (127C flags this as conditional). The existing
  `tokyo-worker/src/domains/pages/package-files.ts` purge helper already
  exists but purges the *old* shape (`/pages/{pageId}` without fingerprinted
  support files). The runbook must be updated for the new purge set.

- A new or updated **runtime materializer contract doc** — 127B changes the
  materializer's exported surface (the Instance contribution). There is no
  standalone materializer contract doc today; the closest is the "Editor
  Artifact Build" section in `documentation/services/bob.md`. The contribution
  contract, its determinism rules, and its module-dedup contract should be
  documented somewhere a dev can find. The PRD's 127B "Required documentation"
  mentions "the current runtime materializer contract documentation" but no
  such file is named. Either name it or create it.

- `documentation/widgets/` — 127B's "Widget-specific structured data is
  included only when the Widget already owns a declared compatible
  contribution" implies a widget-contract change. If widget structured-data
  contributions are real for V1, the widget authoring manual must document the
  file. If they are not real for V1, no doc change is needed — but the PRD
  should say so. (See §3b.)

- **A Page overlay path-key contract reference** — the `page.title`,
  `page.description`, `placements.{placementId}.{instanceFieldPath}` keys in
  127B §6 are a new typed contract that Tokyo (public serving), the compiler,
  and preview all depend on. There is no doc home for it. It belongs in either
  `documentation/architecture/OverlayArchitecture.md` (extended) or a new
  `documentation/architecture/PageCompiler.md`.

**Verdict: APPROVE WITH CHANGES** — The program's tenets, authority mapping,
V1–V8 discipline, and last-good/determinism design are staff-grade and
code-grounded, but the two load-bearing seams (the single-instance→
multi-instance materializer refactor dressed up as "reuse," and the undefined
locale-completion contract that the entire public-serving path depends on) are
under-specified enough that a dev would invent behavior at exactly the points
where invented behavior causes silent locale/runtime corruption.

---

## 2. Senior Product Manager Peer Review

### 127 MAMA PRD — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

**Genuinely elegant decisions that make the customer's life simpler and scale
cleanly:**

- **One blank Page in the catalogue** (127 §2: "the first catalogue contains
  one blank Page option"; 127E §Page catalogue). This is the strongest
  product-UX call in the whole program. It gives the customer exactly one
  mental model ("start empty, add your instances") and refuses the
  template-gallery trap that defines every legacy site builder. The
  empty-state copy ("Start with an empty page and add your saved Widget
  Instances") is honest and on-thesis.
- **Exact-locale URLs** (`https://clk.live/{accountPublicId}/pages/{pageId}/{locale}`,
  127 §6, 127C §Locale URLs). Deterministic, cacheable, crawlable, and
  shareable. The rule that "the exact URL always wins and always requests that
  locale" (127 §6) is the kind of invariant that makes the whole serving model
  legible to customers, crawlers, and agents. Pairing it with a
  non-shared-cacheable short URL that only *selects* an authored locale is the
  correct separation.
- **`current | out_of_date` status** (127 §7, 127D §The two states customers
  need). This is honest product state. It refuses the legacy pattern of
  silently serving stale content while implying freshness, and it refuses the
  opposite failure of taking a working page offline because a recompile
  failed. Keeping the last-good package live is the right customer-first
  default.
- **Retry as a first-class action tied to the visible status** (127E: "Retry
  is shown directly for an out-of-date Page because it resolves the visible
  status, not as an unrelated hidden action"). Surfacing retry where the
  problem is visible, rather than burying it in a menu, is good progressive
  disclosure.
- **Save vs publish separation** (127E §Save, publish, and status UX).
  Treating source save and public replacement as two distinct outcomes — and
  refusing to say "Page updated" when only the source saved — is more honest
  than most CMS products. The Bob return flow (carrying one validated Roma
  return coordinate, never an arbitrary redirect) is clean and safe.
- **Three route-owned surfaces** (`/pages`, `/pages/catalog`,
  `/pages/{pageId}`, 127E §Routes). Splitting list / create / edit into real
  routes instead of one query-string-driven component is the correct
  scalability move and matches how Roma already treats Widgets.

**UX that may NOT scale well for real customers:**

- **The synchronous recompile-after-instance-save flow is the program's
  biggest scaling risk.** 127D §Performance proof is explicit: after an
  instance save, Roma "lists current Page sources for that same account...
  scans each Page's placements... selects the affected Pages whose serve state
  is published... recompiles each selected Page once," all within the
  instance-save request, and "If the direct operation cannot finish exactly
  within the current product request boundary, stop and return the measured
  evidence to the product owner." Consider a Tier 4 customer with
  `widgets.instances.max = 250` and unlimited pages: a shared "header" or
  "footer" instance placed in 40 pages means one Bob Save blocks on 40
  sequential compile + Tokyo install + cache purge cycles. The customer
  pressing Save in Bob has no visibility into why their save is slow, and the
  PRD's only escalation is "stop and return to product owner." That is a sound
  engineering guardrail but a weak product answer — it converts a perf cliff
  into a halted feature rather than a designed boundary. The PRD should at
  minimum define the customer-facing behavior when an instance save is slow
  because of fan-out (e.g., async post-save notification, partial-result
  surfacing in Page Builder), even if the implementation stays direct.
- **Manual retry burden.** If a shared instance breaks compilation across many
  pages (e.g., a removed overlay), every affected page goes `out_of_date` and
  the customer must retry each one individually from the Your pages table.
  There is no "Retry all out of date" and no agent that notices and repairs.
  For an account with 10–100 pages this is real drudge work and the customer
  will reasonably ask why the system that knows the pages are broken cannot
  fix them.
- **Locale-authoring burden for near-duplicate locales (en-us / en-gb).** 127
  §6 is explicit and architecturally correct: "A customer who needs different
  US and UK content selects and authors en-us and en-gb; Clickeen does not
  manufacture country versions from IP addresses." This is the right call for
  source-truth fidelity, but it hands the customer a real cost: the Page-owned
  values (title, description, social title, social description) for every
  selected non-base locale must be authored (127A §Page source contract, 127E
  §Page controls point 2), and **the PRD never defines who or what generates
  Page-owned overlays**. The Translation Agent exists for instance overlays
  (per `roma.md`/`bob.md`), but nothing in 127A–127E wires it to Page-owned
  values. So a customer selecting 5 locales must hand-write 4 sets of page
  metadata or compilation fails (127A: "Required Page overlay is missing or
  malformed → Reject the save"). This is a real product gap, not just a
  nicety.
- **No customer visibility into short-URL locale selection.** The four-step
  selection ladder (remembered choice → browser-language match → country
  mapping → baseLocale, 127 §6) is invisible to the customer. A customer who
  asks "why did my US visitor see en-gb?" has no in-product answer. The
  architecture is right (country is a hint, not truth), but the product gives
  the owner no observability into the visitor experience.

#### 2. Compliance with product UX best practices

**Where the PRD excels:**

- **Progressive disclosure.** Page header carries one primary action (Save or
  Publish), one secondary (Retry or Unpublish), and the rest under the Dieter
  More popover (127E §Page header). This is textbook progressive disclosure
  and avoids the action-bar bloat that characterizes legacy CMS editors.
- **Error recovery and fail-visible behavior.** The failure tables across
  127C/127D/127E are unusually disciplined: a failed compile installs nothing;
  a failed candidate leaves the previous package selected; a corrupt source is
  never rendered as a blank page; an instance that disappears is marked
  invalid, never omitted (127E §Failure behavior: "Instance disappears → Mark
  its placement invalid; never omit it"). This is well above SaaS-norm.
- **Status visibility.** The Your pages table exposes Status as a sortable
  column with values Current / Out of date / — and a header filter "Out of
  date" (127E §Your pages). Customers can find broken pages without hunting.
- **"Don't make me think."** The mental model is genuinely small: a Page is a
  list of your saved widgets in order. There is no site tree, no template
  picker, no theme settings, no layout grid. That minimalism is the product's
  strongest UX asset.
- **Empty state.** "No pages yet. Start with a blank page in Page catalogue.
  [Open Page catalogue]" (127E §Your pages) is a good empty state: it
  explains the situation and offers the single next action.
- **Confirmation patterns.** Unpublish asks for confirmation; delete requires
  unpublish first and uses the existing Dieter confirmation dialog (127E). The
  unsaved-changes guard reuses the existing pattern. No new dialog machinery
  is invented.

**Where the PRD falls short of good UX:**

- **Discoverability of failure cause is under-specified and risks technical
  leakage.** 127D's `PageRecompileFailure` carries `reason, placementId,
  instanceId, locale, paths[]`. 127E says the UI must "show the exact failure
  and time" and "point to the exact control that must be fixed." But nothing
  in 127E defines how those internal coordinates are translated into
  customer-readable copy. If a customer sees "out of date — placement p_3,
  instance i_abc123, locale fr-fr, paths [page.title]" they are looking at a
  stack trace, not a product message. The PRD needs an explicit UX-writing
  contract for failure surfacing.
- **The save-succeeded-but-page-is-out-of-date moment is the hardest UX beat
  in the program and is under-designed.** 127E §Save says "on source
  success/replacement failure, states plainly that edits were saved but the
  live Page is out of date." That sentence does the right *thing* but does not
  specify the *experience*: Does Save return green (saved) with a warning
  badge, or amber? Does the Publish button change? Is there an inline path to
  Retry from that moment, or must the customer navigate to the Your pages
  table? This is the moment most likely to generate support tickets and it is
  left to implementation.
- **No bulk operations.** No multi-select in Your pages, no "retry all out of
  date," no bulk unpublish. For a Tier 3/4 account this will hurt.
- **Mobile/portrait Page Builder is hand-waved.** 127E §Page body says "At
  responsive widths, the controls use the established editor drawer behavior
  and the preview remains usable." But Page Builder is a
  `Page controls | Page preview` split (127E §Page body), which is exactly the
  composition `surfaces.md` warned is hard in portrait. Bob owns an explicit
  portrait boundary; Page Builder does not acknowledge the same risk. The PRD
  should state whether portrait Page Builder gets the controls-as-drawer
  pattern, a read-only preview, or an explicit boundary — silence here will
  produce a broken mobile editor.
- **Tier-limit UX for `pages.max = 0` is unspecified.** Free and Tier 1
  accounts cannot create Pages at all (127 §9, 127A). The Your pages empty
  state assumes the customer *can* create. What does a Free customer see? Is
  the Pages nav item hidden, shown-but-empty, or shown with an upgrade CTA?
  127E's failure table covers "Account loses create entitlement → Existing
  Pages remain usable; catalogue Create is blocked explicitly," but the
  never-entitled Free/Tier1 first-run experience is not designed. Given Roma's
  accepted dialog/upsell law (`roma.md` §Accepted Dialog And Upsell Law), this
  needs a defined treatment.
- **No loading/preview-failure UX contract for the compiler preview.** 127E
  §Preview says "missing values show the compiler failure in the controls and
  do not display a different locale" and "Loading uses the shared modern
  loading treatment... do not replace the Page with 'Loading page...' text."
  Good instincts, but "show the compiler failure in the controls" is not a
  concrete pattern — is it inline validation per field, a banner, a disabled
  preview with a status line? This is load-bearing UX and needs a concrete
  spec.

#### 3. Bad UX writing for the user (if present)

The PRDs are mostly well-written at the *product-law* level but leak internal
vocabulary into places a customer would see it. Concrete problems:

- **"out_of_date" / "Out of date"** (127D §The two states customers need;
  127E table). The snake_case form belongs in source/types only. The
  customer-facing "Out of date" is borderline: it is honest but slightly
  clinical and does not tell the customer what to do. A clearer customer label
  would be **"Needs update"** or **"Live page behind source"** — both name the
  problem; the second also names *which* surface is stale, which matches the
  product's own two-state model (publication vs package). Pair it with the
  existing Retry action and the meaning is unambiguous.
- **The save + out-of-date message.** 127E §Save: "states plainly that edits
  were saved but the live Page is out of date." Recommended customer copy:
  **"Your changes are saved. We could not update the published page
  automatically — review and retry."** This (a) confirms the save succeeded,
  (b) names the public surface that did not update, (c) offers the next
  action. The current phrasing leaves "out of date" dangling without a verb
  the customer can act on.
- **"replacement" / "package"** (127D throughout, 127E §Out of date). These
  are internal nouns. A customer does not think in "packages" or
  "replacements." The customer-facing vocabulary should be "the published
  page" and "updating the published page." The PRD uses "last working package
  remains live" internally, which is fine, but 127E must not surface that noun
  in UI copy.
- **Preview failure messaging** (127E §Preview: "missing values show the
  compiler failure in the controls"). If shown raw, this leaks "compiler."
  Recommended pattern: inline field-level validation ("French title is missing
  — add it or remove French from this page") plus a disabled preview with a
  one-line status ("Preview unavailable until required fields are filled").
  Never use the word "compile" or "compiler" in customer UI.
- **Publish partial-failure messaging** (127C failure table; 127E §Publish:
  "shows success only when compile, install, cache/discovery update, and
  public verification meet the route's success contract"). The *contract* is
  excellent; the *customer message* must not enumerate those four internal
  steps. Recommended: **"Page published"** only on full success; on partial
  failure, **"Publish did not finish. Your page may not be live yet —
  details: [one customer-readable reason]. Retry."** The internal step list
  belongs in Roma logs, not the Page header.
- **Tier-limit messaging for `pages.max`** is absent entirely. This is the
  largest UX-writing gap. When a Tier 2 customer with 3 pages tries to create
  a 4th, what copy do they see? The PRD defines the HTTP 402 `UPGRADE_REQUIRED`
  contract (inherited from Widgets, `roma.md`) but never specifies the
  Pages-specific customer message or whether the catalogue Create card is
  disabled, clickable-then-blocked, or hidden. Per Roma's accepted law, Create
  "remains a clickable user-intent action" for widgets; Pages should follow
  the same pattern, but the customer copy ("You have 3 of 3 pages on your
  plan") is undefined.
- **"Retry"** (127D, 127E). This is good, plain language. Keep it.
- **"— when unpublished"** for the Status column (127E §Your pages table).
  Using an em-dash for "no status" is a reasonable empty-cell convention but
  should be paired with the Published column showing Off, so the customer
  reads the row as a coherent picture. The PRD implies this but does not state
  it.

#### 4. How this PRD aligns with Clickeen being different from legacy SaaS (product perspective)

**Where Pages leans INTO the agent-operated, schema-first thesis well:**

- **Pages = ordered references to saved instances, not copied source** (127 §1
  tenets 1–2; 127A §Page source contract). This is the cleanest possible
  expression of the schema-first composition thesis from
  `SchemaFirstApps.md` ("schema → tokens → product atoms → surfaces"). A Page
  is literally a composition of existing atoms, with no new source truth
  created. This is exactly the "shared schema truth → many app expressions"
  law the strategy doc demands.
- **One deterministic compiler, no public-request compilation, no second
  renderer** (127 §5, 127B). The rule that "Roma uses the same compiler result
  for preview and publication; there is no second Page renderer" kills the
  legacy-CMS pattern of preview-vs-production drift. This is agent-operable:
  an agent can reason about one compilation contract.
- **Refusal of the legacy site-builder feature set** (127 §2: "It is not a
  Website, navigation system, template marketplace, or general-purpose site
  builder"; 127 §10 exclusions; 127E §Page controls: "no columns, freeform
  canvas, navigation menus, site header/footer, arbitrary HTML blocks, design
  grid, templates"). This is the strongest anti-legacy-SaaS discipline in the
  program. It directly refuses the feature-bloat path that defines
  Wix/Squarespace/WordPress.
- **Native Babel extension.** Reusing `baseLocale` + exact overlays for Pages
  (127 §4, 127A §Page overlays) extends the Babel moat to a new surface
  without copying locale trees — precisely what `Clickeen-Babel.md` and
  `GlobalReach.md` prescribe.
- **Honest failure law everywhere.** The repeated "never substitute, never
  omit, never repair, fail closed" discipline (every lettered PRD's V1–V8
  questions) is the operational expression of WhyClickeen's "fail-visible
  behavior instead of silent fallback."

**Where Pages drifts toward legacy SaaS product patterns or undermines the
thesis:**

- **The single biggest thesis gap: Pages is designed as a human-operated form,
  not an agent-operated surface.** Across all six PRDs there is **zero**
  mention of Product Copilot, Translation Agent, or Agent Activity in the
  Pages product. `AGENTS.md` states "the intelligence lives in the agents, not
  in hardcoded pipelines" and `WhyClickeen.md` names Product Copilot as the
  operator of product editing and Translation Agent as the operator of locale
  overlays. Yet Page Builder (127E §Page controls) exposes Page-owned
  title/description/social copy and per-locale overlay values as **manual text
  fields with no agent path**. A customer authoring a page for 5 locales must
  hand-write 4 overlay sets or compilation fails (127A failure table). The
  Translation Agent already exists for instance overlays; not wiring it to
  Page-owned overlays is an arbitrary product boundary that makes Pages feel
  like a 2010-era CMS form, not an agent-operated surface. This is the place
  where Pages most clearly undermines the "agent-operated, not legacy SaaS"
  premise.
- **The recompile flow is a hardcoded orchestration pipeline, and its recovery
  loop is human-operated.** `AGENTS.md` explicitly warns: "A hardcoded flow
  with an AI call in the middle... is a legacy pipeline, not an agent." The
  127D flow (instance save → scan pages → recompile each → install each → set
  status) is a hardcoded pipeline without even an AI call. That is defensible
  for deterministic compilation. But the *failure recovery* — surfacing
  `out_of_date` and waiting for a human to press Retry per page — is a
  human-operated legacy workflow. An agent-operated product would have an
  agent that detects `out_of_date` pages, diagnoses whether the failure is
  transient, and retries through the same authorized path, narrating via
  Agent Activity. The PRD's hard stop against any "Queue, graph, poller,
  hidden retry system" (127 §7, 127D) is right *technically* but is phrased so
  broadly that it also forbids the agent-operated recovery that would make
  Pages on-thesis. The product answer is not a hidden retry system; it is a
  visible agent that operates retry on the customer's behalf.
- **The catalogue establishes a template-gallery shape.** 127E §Page
  catalogue: "The catalogue exists now so future Page starting points have the
  correct product home without changing the route model." This is a hook
  toward exactly the template marketplace the program claims to refuse (127
  §2). Today it is one blank card; tomorrow it is the place feature-bloat
  lands first. The PRD should name the rule that constrains future catalogue
  entries to schema-backed compositions (not hand-authored templates), or this
  becomes the legacy drift point.
- **Page Builder duplicates the Bob typography/asset mental model without an
  agent seam.** The customer must understand that Page-owned metadata lives in
  Page Builder while widget content/typography lives in Bob (127E §Page
  controls: "Page Builder does not expose Widget content, appearance,
  typography"). That separation is architecturally correct, but operationally
  it forces the customer to context-switch between two editors with no
  copilot continuity. In an agent-operated product, the agent would follow the
  customer across that seam; here the customer is the integration layer.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

A PM reviewing this program would expect the following documentation touched.
Paths are from repo root.

**Missing capability doc (highest priority):**

- **`documentation/capabilities/pages.md` — does not exist and must be
  created.** Pages is now a first-class product surface on par with
  localization and multitenancy. Every other major capability has a doc
  (`localization.md`, `multitenancy.md`, `seo-geo.md`, `supernova.md`). Pages
  needs one owning: the Page source contract, the compile/preview/publish
  boundary, `current | out_of_date`, `pages.max`, exact-locale vs short-URL
  selection, and the recompile authority chain. Without it, the only Pages
  truth lives in execution PRDs, which violates `AGENTS.md` Documentation
  Discipline ("Detail docs own surface-specific behavior").

**Strategy docs the PRD omits but a PM would expect touched:**

- **`documentation/strategy/WhyClickeen.md`** — needs a Pages paragraph. It
  currently says "Current Clickeen product work proves this through
  account-owned widgets and Clickeen Pages" but does not articulate Pages as
  the *first proof of cross-atom composition* (the schema-first thesis). Pages
  is the wedge that moves Clickeen from "widgets" to "schema-first apps"; the
  strategy doc should say so.
- **`documentation/strategy/SchemaFirstApps.md`** — says "Widgets compose
  into pages. Pages can compose into sites." but treats Pages as a future
  tense. After 127 ships, Pages is the live proof of `schema → atoms →
  surfaces`. This doc should reference Pages as the realized first composition
  layer.
- **`documentation/strategy/GlobalReach.md`** and
  **`documentation/strategy/Clickeen-Babel.md`** — both currently describe
  global reach through widgets/instances. Pages is the first *multi-locale
  public surface with crawlable exact-locale coordinates, hreflang, sitemap,
  and structured data* (127 §6, 127C §SEO, GEO, and AEO output). That is a
  strategic milestone for the Global-Reach and Babel theses and these docs
  should reflect that Babel now extends to Pages — **but only after the
  Page-owned overlay generation gap (Section 4) is resolved**, otherwise the
  strategy claim outpaces the product.
- **No product/marketing narrative for Pages.** Prague is the marketing
  surface (`CONTEXT.md` System Map). Is there a Prague landing/page for Pages?
  The PRD never mentions go-to-market. A PM would flag this as a gap even if
  it is out of scope for 127 itself.

**Capability and architecture docs needing updates (the PRD lists some, but
misses key product truths):**

- **`documentation/capabilities/localization.md`** — currently instance-only.
  Must add Page overlays: the Page-owned value set, the rule that Page
  overlays are required (not fallback), and **must define who generates them**
  (the undefined Translation Agent wiring flagged in Section 4). This is the
  single most important capability-doc gap.
- **`documentation/capabilities/seo-geo.md`** — currently states "Page public
  serving is not active" and "Public page request → 404." After 127C this is
  false. The whole "Current Runtime Truth" and "Current Failure Semantics"
  sections need rewriting for Pages, and the `embed.seoGeo.enabled`
  registry/runtime conflict (flagged in `multitenancy.md` and `seo-geo.md`)
  must be resolved or explicitly scoped to widgets only.
- **`documentation/capabilities/multitenancy.md`** — must add `pages.max` to
  the entitlement table (currently absent), Tier99 to the profile set, and
  flip the Known Current Gap "page publish is disabled" to resolved.
- **`documentation/architecture/AccountManagement.md`** — already documents
  Page references; needs Tier99 added to the tier model and the Page
  publish-disabled note removed.
- **`documentation/architecture/RuntimeProfiles.md`** — Tier99 profile.
- **`documentation/architecture/OverlayArchitecture.md`** — Page overlays
  (Page-owned values) alongside instance overlays.
- **`documentation/architecture/Tenets.md`** — already says "Pages are
  account-owned stacks of saved instances"; confirm the
  `current | out_of_date` and recompile law is captured as a tenet, since it
  is a new product-law invariant.
- **`documentation/services/roma.md`** — the Pages Domain section currently
  says "Current account page publish is disabled until Roma has a real page
  package writer" and "While a page is published, Roma requires unpublish
  before page source edit or delete." The second sentence is *contradicted* by
  127D step 9 ("Remove the current rule that requires a Page to be
  unpublished before source can save"). This is a confirmed doc/runtime
  mismatch that `AGENTS.md` says must be fixed with the behavior change.
- **`documentation/services/bob.md`** — needs the Bob return-coordinate
  contract for Page Builder (currently only the Widgets/Bob return is
  specified) and the Instance-save → affected-Pages result that Bob renders
  (127D references this).
- **`documentation/services/tokyo-worker.md`** and
  **`documentation/services/tokyo.md`** — Page package install,
  candidate/readback/select, bounded retention, public Page routes,
  robots/sitemap additions.

**Verdict: APPROVE WITH CHANGES — The architecture, failure law, and
anti-legacy discipline are excellent, but Pages ships without the
agent-operated overlay generation and recovery that the Clickeen thesis
demands, and the customer-facing UX writing, tier-limit, and mobile-portrait
contracts are under-specified.**

---

## 3. Principal TPM Peer Review

### 127 MAMA PRD — Principal Technical Program Manager Peer Review (GLM)

Scope: This is a principal-depth peer review of the Master PRD
(`127__PRD__Global_Pages_Program.md`) and its five execution slices (127A–127E),
grounded against the deployed codebase, the current-system docs (`CONTEXT.md`,
`Tenets.md`, `Overview.md`, service docs, `CloudflareOperations.md`,
`RuntimeProfiles.md`), and the AGENTS.md operating rules. It is not a rubber
stamp: it names ambiguities and deploy-order risk.

#### 1. Cohesive and cost-effective architecture

**Verdict on cohesion: strong and deliberate.** The end-to-end flow — Roma
compile orchestration → Tokyo atomic install/select → Cloudflare cache → Tokyo
public serving — reuses exactly the authorities that already exist (Roma Pages
routes, Tokyo-worker over `accounts/{accountPublicId}/pages/{pageId}/`, the
`clk.live`/`dev.clk.live` host, the Cloudflare purge token already bound to
Tokyo-worker). The MAMA's explicit "no Queue, no new Worker, no DB, no
registry, no graph" stance (§7, §10, and each slice's "Code work") is the
correct read of Tenet 5 and the AGENTS.md "no framework machinery" rule. It is
the single most important cohesion decision in the document and it is right.

**Verdict on cost: mostly cost-effective, with three concrete risks the PRD
under-specifies.**

1. **Per-locale R2 package reads on the public hot path (127C §"Completing
   exact locale HTML").** On an exact-locale cache miss, Tokyo reads
   `serve-state.json`, then the four package files under
   `packages/{packageFingerprint}/`, then applies `overlays.json`. The
   `overlays.json` is a *single aggregated* locale file (one entry per non-base
   locale) — so a cache miss for *any* locale reads the *whole* overlays blob,
   not a per-locale slice. For a Page with many locales and large instance
   field maps, this is an amplification multiplier on every cold locale
   request. The current instance model
   (`tokyo-worker/src/routes/clk-live-routes.ts`) reads one exact
   `overlays/locales/{locale}.json` per request — O(1) in locale count. The
   Page model makes the public read O(total Page overlay size) per miss. The
   PRD does not acknowledge this regression or set a size budget.
   **Recommendation:** require 127C to state the overlays.json read cost
   explicitly and consider whether per-locale splitting (mirroring the instance
   overlay shape) is warranted before the aggregated shape is locked in.

2. **Recompile fan-out cost on every Instance save (127D §"How Roma finds
   affected Pages").** This is grounded and already partially real:
   `listAccountPageSourcesInTokyo` (`roma/lib/account-page-direct.ts:163`)
   calls Tokyo's `listAccountPageSources`
   (`tokyo-worker/src/domains/pages/source.ts:69`), which does an R2 `list` of
   every `source.json` under the account, then **reads each source.json in
   full, and each read also re-reads `serve-state.json`**. Today this scan
   runs only on the Instance **DELETE** path
   (`roma/app/api/account/instances/[instanceId]/route.ts:235`) to block
   deletion of a placed instance. 127D proposes running this same scan on
   **every Instance save (PUT)** and then compiling + installing every
   affected published Page inline. The PRD's "performance proof" section
   (127D) is the right safety valve — it explicitly says "if the direct
   operation cannot finish exactly within the current product request
   boundary, stop." That is correct discipline. But the PRD presents the
   current scan as cheap ("The codebase already has the starting helpers").
   It is not cheap at the storage layer: it is `1 list + 2N reads` per save
   (N = account page count), before any compile. For a Tier 4 account with
   dozens of pages this turns a widget save into a multi-second synchronous
   operation. **Recommendation:** 127D must measure the *storage* scan cost
   separately from compile cost, and the MAMA should acknowledge that the
   Instance-save path is now the critical latency surface for the whole
   program.

3. **Cache-purge fan-out (127C §"Keeping cached files consistent" and
   unpublish).** Each publish purges "Page root, exact locale HTML responses,
   and affected stable file routes." Each exact locale URL is a separate purge
   entry, and purge scope grows linearly with selected-locale count. The
   existing `purgeAccountPagePublicCache`
   (`tokyo-worker/src/domains/pages/package-files.ts`) already fails closed
   (503 on missing config, 502 on purge failure) — good. But the PRD does not
   bound purge batch size or define behavior when a Page has many locales and
   the Cloudflare purge API rejects an oversized `files` array.
   **Recommendation:** 127C should state the purge batching rule and the
   partial-purge reporting contract (it already requires "report partial
   completion; never claim full publish success," which is the right V6 guard
   — just make the batch boundary explicit).

**Package retention storage growth** is handled correctly: "at most the
current package and the immediately previous working package" (127C). This
bounds R2 object growth to 8 objects per page plus source/serve-state. This is
genuinely lean and better than a naive version-history model. No concern.

**Sitemap/robots generation cost** is under-specified. 127C says "Tokyo serves
host-level robots.txt and sitemap discovery" and "sitemap output lists
published, indexable exact locale Page URLs." Generating a host-level sitemap
implies enumerating *all* published pages across *all* accounts on
(presumably) a cache miss for `/sitemap.xml`. The PRD does not say whether
this is precomputed, cached, or computed per request. A per-request
enumeration of every published page in the system is an unbounded
cross-account read on the public hot path and would violate Tenet 11
("Visitor requests must not… read Supabase… compose widgets from authoring
source"). **Recommendation:** 127C must define sitemap/robots generation as
bounded and cacheable, or scope the first release to per-Page robots/meta
only and defer host-level sitemap to a later slice. This is the most likely
place the program silently invents an unbounded public-path cost.

**Request-path efficiency on public serving** is otherwise sound:
fingerprinted CSS/JS are long-lived immutable (correct), exact-locale HTML is
shared-cacheable by account+page+locale+package (correct, and a real
improvement over the current instance `?locale=` model which is `no-store`).
Note the explicit conflict flagged in §2 below.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

I traced every boundary the MAMA and slices define. The named-authority
mapping is almost entirely clean and matches `Tenets.md` Tenet 2 and the
`CONTEXT.md` "Current Authorities" table. The table below is the publish path
(confirmed against code):

```
Browser Save/Publish intent
  → Roma /api/account/pages/{pageId} (Roma = current account + policy authority)
  → Roma loads Page source + each placed Instance via existing Roma→Tokyo routes
  → Roma invokes 127B Page Compiler (in-process Roma/shared-package function; NOT a service)
  → Roma POSTs one install command to Tokyo-worker /__internal/pages/{pageId}/install (service binding)
  → Tokyo-worker writes 4 objects under packages/{fingerprint}/, readback, one serve-state selection
  → Tokyo-worker purges Cloudflare zone (existing CLOUDFLARE_CACHE_PURGE_TOKEN binding)
  → Roma verifies public URL on dev.clk.live / clk.live
```

This is a clean Roma↔Tokyo-worker↔Cloudflare-CDN conversation. No new
subsystem. Good.

**Public-serving path** is also clean and is in fact already partly built:
`tokyo-worker/src/routes/clk-live-routes.ts:parseClkLivePath` already
recognizes the `/{accountId}/pages/{pageId}` coordinate (returns
`kind: 'page'`) and currently responds `404` for it (line 177-179). So 127C is
*enabling* an already-parsed route, not inventing one. That is the right level
of continuity.

The boundaries I flag:

**AMBIGUITY 1 (most important): "locale completion" is one contract claimed
by two owners.** 127B §"Preview" step 3 and §"Code work" step 5 say locale
completion is "a pure function shared by preview and later Tokyo serving where
the runtime boundary permits." 127C §"Completing exact locale HTML" step 5
says "Tokyo applies those values to the compiled document using the
locale-completion contract from 127B." So is locale completion (a) one pure
function that lives in a shared package and is called by *both* Roma-preview
and Tokyo-serving, or (b) two implementations (one in Roma for preview, one in
Tokyo for serving) that share only a typed contract? This is not a stylistic
question: if it is one shared function, then Tokyo-worker gains a new package
dependency on the Page compiler package and the "Tokyo stores and serves
bytes, it does not compile" rule (`tokyo-worker.md`, `tokyo.md` Hard Stops,
Tenet 11) is *technically* strained — because completing HTML on a cache miss
is a form of compilation/rendering on the public request path. If it is two
implementations, the PRD's "do not duplicate the rules" instruction is
violated. **The MAMA must resolve this before 127B/127C execute.** My
recommendation: locale completion must be a single pure function in the shared
compiler package, called by both Roma (preview) and Tokyo (serving), and the
service docs (`tokyo-worker.md`, `tokyo.md`) must be updated to acknowledge
that Tokyo performs *bounded, deterministic locale-value injection into a
pre-compiled document* — explicitly NOT compilation from source, NOT instance
traversal, NOT model calls. That keeps Tenet 11 intact while making the
shared-function design honest. As written, the PRD lets either reading win,
and that is a system-boundary ambiguity a principal review must expose.

**AMBIGUITY 2: who owns sitemap/robots.** 127C §"SEO, GEO, and AEO output"
says "Tokyo serves host-level robots.txt and sitemap discovery" and "Add Page
entries to the existing clk.live robots/sitemap authority." But there is no
existing `clk.live` robots/sitemap authority in the codebase
(`clk-live-routes.ts` has no robots/sitemap handler) and no doc names one. The
PRD is silently minting a new responsibility for Tokyo-worker and calling it
"existing." This is the one place the MAMA risks inventing a hidden subsystem
by misnaming a new duty as pre-existing. **Recommendation:** either (a) scope
127C to per-Page `<meta>` robots + canonical/hreflang only and defer host
sitemap to a future PRD, or (b) explicitly name robots/sitemap as a *new*
Tokyo-worker public route family in 127C and in `tokyo-worker.md`, with its
bounded cache contract. Do not call it "existing."

**AMBIGUITY 3: the "install" command vs the existing internal page routes.**
127C §"Publish, step by step" refers to "one Tokyo install request" and the
"Code work" lists `tokyo-worker/src/routes/internal-page-routes.ts` as an
owner. The current `internal-page-routes.ts` has
`POST /__internal/pages/{id}/publish` returning `publishUnavailable`. The PRD
does not specify whether the new install is a *new* route (e.g.
`POST /__internal/pages/{id}/install`) or a rewrite of the existing `publish`
route. This matters for the atomicity contract: 127C's candidate-write →
readback → one-step-selection is a genuinely new operation shape, not a
`serve-state` flip. **Recommendation:** 127C should name the exact internal
route and method (I'd expect `POST /__internal/pages/{pageId}/install`
carrying the four files + evidence), and explicitly state that the old
`publish` route is replaced/deleted, satisfying the V7 guard. The MAMA's §12
"replaced Page stubs, paths, and temporary migration code are deleted" covers
the intent, but the slice should name the route.

**AMBIGUITY 4 (minor): retry route placement.** 127D defines
`POST /api/account/pages/{pageId}/retry`. This is a new Roma route. It is
clean and Roma-owned. No subsystem invented. Confirmed fine — flagging only
that 127E's UI must call this exact route and not invent a client-side retry.

**No hidden subsystems otherwise.** The compiler is explicitly "a module owned
by Roma or an existing shared package; do not create a service" (127B §"Code
work" step 1). The `packages/ck-runtime-materializer` package exists and is
the correct home for the Instance contribution refactor. The materializer
already exports `materializeRuntimePackage` and
`RUNTIME_MATERIALIZER_CONTRACT_VERSION` — 127B's "extend the existing runtime
materializer with one reusable in-memory operation" is a real, grounded
extension point, not greenfield. Good.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

**Where this design is genuinely best-in-class:**

- **Deterministic compile + edge-cache, single compiled document.** This is
  the correct architecture and is what separates serious page/SaaS platforms
  (Webflow, Framer) from "embed-stacker" tools. The MAMA's insistence on "one
  HTML document, one stylesheet, one runtime" (127B §3) and "not a
  browser-side list of Widget embeds" (MAMA §2) is the right call.
  Competitors that iframe-stack widgets (early Wix, many no-code tools) pay a
  permanent SEO and performance tax. Clickeen avoids it by construction. The
  fingerprinted, byte-identical-output contract (127B §7) is stronger than
  what most competitors document — it makes cache identity provable.

- **Atomic package install with last-good rollback.** The candidate-write →
  readback → fingerprint-verify → one-step-selection sequence (127C §"Publish,
  step by step") with "previous serve-state remains authoritative until step 4
  succeeds" is a correct atomic-publish design. This is what Vercel/Netlify do
  for deploys; bringing it to a per-Page R2 package is appropriately scaled.
  The "public serving never mixes files from different packages" rule (MAMA
  §6) and the `?v={packageFingerprint}` cache-busting on support files (127C
  §"Keeping cached files consistent") is exactly how Next.js/Astro handle
  immutable asset hashing. This is at or above competitor bar.

- **Locale-as-exact-URL with reciprocal hreflang + x-default.** The
  `/{accountPublicId}/pages/{pageId}/{locale}` exact-URL design (127C) with
  self-canonical, reciprocal hreflang, and `x-default` → stable Page URL is
  the correct international SEO architecture and matches what Webflow's
  localization and Shopify's markets do at the URL level. The explicit rule
  "country is only a selection hint; it cannot create a locale" (MAMA §6,
  127C) is the right discipline and avoids the IP-geolocation content-forking
  anti-pattern that hurts smaller SaaS competitors. This is genuinely strong.

- **Instance-reference-only Page source.** "A placement never contains copied
  Instance source" (MAMA §3, 127A) is the correct single-source-of-truth model
  and is cleaner than Wix/Framer's duplicated-content-per-page model. It is
  the architectural reason the recompile story is even possible.

**Where competitors do something better/cleaner that the PRD should learn
from:**

- **The short-URL locale resolver is `private, no-store` and redirects.** 127C
  makes the stable Page URL a `private, no-store` 302/307 to the exact locale
  URL. This is safe but it means the *most-marketed* URL
  (`clk.live/{acct}/pages/{page}`) is never cached and always costs a redirect
  + a resolver read on every hit. Webflow and Framer instead serve the
  default-locale HTML directly at the canonical URL and use
  hreflang/`x-default` to point crawlers at locale variants — one cached
  response at the canonical URL, no redirect for the default visitor.
  **Recommendation:** consider serving `baseLocale` HTML directly at the
  stable Page URL (cacheable) and reserving the redirect behavior for the case
  where a visitor signal selects a *non-base* locale. This removes a redirect
  from the default happy path and improves LCP vs. the redirect-then-cache
  model. The PRD as written optimizes for correctness over default-visitor
  latency.

- **Per-request locale completion on cache miss is a render-on-the-fly model
  dressed as static.** 127C §"Completing exact locale HTML" has Tokyo read the
  base compiled `index.html` + the locale entry from `overlays.json` and
  *apply those values to the compiled document* on every cache miss. This is
  effectively SSR/edge-render of locale variants — closer to what Next.js does
  with ISR/edge than to true static export (Astro/Hugo). That is fine and is
  what Framer does, but the PRD should be honest that this is edge-rendering
  of locale variants, not "static serving." The implication: the
  locale-completion function is now on the public hot path and must be O(page
  size) and bug-free forever. Astro/Next competitors pre-render each locale to
  its own static file at build time, eliminating the runtime completion step
  entirely. **Recommendation:** the PRD should at least name the trade-off it
  is making (one compiled base + runtime locale injection vs. N pre-compiled
  locale files) and justify the storage/correctness win. The current choice
  (one base + injection) saves R2 objects and guarantees HTML parity across
  locales, which is a legitimate win — but say so.

- **No staging/preview-at-public-URL story.** World-class competitors (Vercel
  preview deploys, Webflow staging) let a customer see the *exact* published
  artifact before it goes live at the public URL. 127B provides an in-Builder
  preview, and 127C verifies the public URL *after* publish. There is no
  "publish to a preview URL the customer can share" step. This is a real
  product gap vs. competitors but is correctly out of scope for the first
  release; flag it as a follow-up, not a blocker.

- **Sitemap is not a first-class competitor-grade artifact.** Webflow/Shopify
  ship per-locale sitemap entries with `hreflang` annotations in the sitemap
  XML itself. 127C says the sitemap "lists published, indexable exact locale
  Page URLs and their alternate relationships" — good intent, but as flagged
  in §2 the generation path is unspecified and possibly unbounded.
  Competitors precompute and CDN-cache sitemaps. Clickeen should too, and the
  PRD should say so.

**Overall technical bar:** This is a credible, above-average static-page
architecture that is stronger than embed-stacking competitors on
SEO/performance and roughly on par with Webflow/Framer on atomic-publish and
i18n URL design. It is weaker on the default-URL cacheability story and
under-specifies the sitemap/rendering-cost surfaces. None of these are
architectural blockers; they are precision gaps.

#### 4. Absence of V1–V8 violations

This is the exhaustive audit. For each violation I state whether the PRD's
*design* (not just intent) avoids it, with the clause citation or the gap.

**V1 — Silent substitution.** The design is strongly guarded. MAMA §4 ("never
substitute `baseLocale` or another locale to hide the failure"), §12 ("no
missing Instance, overlay, locale, package, or entitlement is silently
substituted"), 127A Product rule 5 ("A locale missing required Page or
Instance values is an error. Nothing falls back silently"), 127B step 1 ("Any
mismatch returns one explicit failure. No placement is filtered out"), 127C
exact-locale URL ("never returns another locale"; 404/500 only), 127C cache
table ("Unpublished Page → Public 404, never stale published content"). **No
gap in design.** The one place to watch in execution: the short-URL resolver's
step 4 fallback to `baseLocale` (MAMA §6) is a *designed* deterministic
default, which Tenet 3 permits ("Deterministic defaults are allowed only when
they are the explicit contract of that request parameter") — but only because
it selects among *already-authored, available* locales, never inventing one.
The PRD is correct that this is not V1. Confirmed clean.

**V2 — Silent healing.** Well guarded. 127A "Current-source migration"
explicitly: "Do not translate, infer a locale, invent social copy, discard an
unexplained stored value." 127A failure table: "Stored source is corrupt →
Report corruption; do not treat it as a blank Page." 127C: "Corrupt packages
and locale data are not repaired on public reads"; "Selected package is
corrupt → Fail closed."
`tokyo-worker/src/domains/pages/serve-state.ts:readStoredServeState` already
fails closed (`'tokyo.errors.page.serveStateInvalid'`) on malformed
serve-state — confirming the runtime already enforces this. 127D: "Retry does
not replay old bytes, use saved test input, or call a different repair path."
**No gap.** Clean.

**V3 — Silent omission.** This is the violation the program is most at risk
of, and the PRD mostly catches it but has one under-specified surface. Strong
guards: 127B step 1 ("No placement is filtered out"); 127D ("One Page failure
also does not omit the other affected Pages"; "If discovery itself cannot
complete, the response says discovery failed; it does not return an empty
affected list"; `affectedPageIds` and `results` "must reconcile exactly").
127E ("Instance disappears → Mark its placement invalid; never omit it").
**Gap (execution risk, not design flaw):** 127C's purge step lists "Page root,
exact locale HTML responses, and affected stable file routes" but does not
require the purge-result to enumerate *which* locale URLs were purged. If the
purge API silently drops some files (e.g., oversized batch), a later cache hit
could serve stale locale HTML — an omission the publish response would not
surface. The PRD's V6 guard ("report partial completion") partially covers
this, but the purge contract should require a per-URL purge reconciliation or
a bounded batch with explicit completion. **Recommendation:** tighten 127C
purge reporting to per-URL or bounded-batch granularity before execution.

**V4 — Fail-open control.** Strongly guarded. 127A: "`pages.max` is missing or
malformed → Fail closed"; "Tier99 consumer is not deployed → Do not migrate
the account row"; "unknown profiles must continue to fail closed." This
matches the real `ck-policy` matrix validator
(`packages/ck-policy/src/matrix.ts:assertEntitlementsMatrix`), which *throws*
on unknown tier or missing key — confirmed fail-closed by construction. 127C:
"Authorization, publication state, exact locale, and fingerprints fail closed."
**No gap.** Clean. Note the deploy-order coupling: because the matrix requires
every entitlement to have every tier value and every tier to be present,
adding `pages.max` and `tier99` must land together with full matrix values or
`getEntitlementsMatrix()` throws at module load — this is fail-closed-by-
construction and is actually a *protective* property, addressed in §5.

**V5 — Corruption-as-absence.** Well guarded. 127A: "Stored source is corrupt
→ Report corruption; do not treat it as a blank Page"; migration "Old source
contains unmapped truth → Stop migration and name the Page/value." 127C:
"Corrupt selected state is not treated as unpublished or absent"; serve-state
"Malformed serve state is corruption and public serving fails closed." 127D:
"Corrupt Page source is not treated as an unrelated Page"; "A corrupt source
is reported as a failed affected-Page check." The existing
`source.ts:loadStoredPageSource` fails closed (`failSourceInvalid`) on JSON
parse error — consistent. **No gap.** Clean.

**V6 — Partial-success masquerade.** Heavily and explicitly guarded — this is
the PRD's strongest area. MAMA §12 failure table ("Package installation is
incomplete → Previous package remains selected"; "Cache or discovery update
fails → The incomplete step is reported; full success is not claimed"). 127C
§"Publish step by step" step 7 ("reports compile, install, cache, and
public-verification outcomes separately") and failure table ("Cache purge
fails after selection → Report partial completion; never claim full publish
success"; "Public verification fails after selection → Report exact failure
and retain evidence for redress"). 127D ("The source save and public
replacement are separate outcomes. Roma must not claim 'Page updated' without
saying that the source saved but the public Page remained out of date"). 127E
("Publish partly fails → Show the exact incomplete step; do not claim
success"). **No gap in design.** This is the cleanest V6 posture I have
reviewed.

**V7 — Masquerade/redress.** Well guarded. MAMA §12 ("replaced Page stubs,
paths, and temporary migration code are deleted"). 127A ("Delete the replaced
old Page source/localization types, validators, UI assumptions, and
migration-only code after verification"; "no old source continues under a
second name or compatibility wrapper"). 127B ("Delete any replaced Page
preview, iframe-snippet, or browser composition path"; "No second renderer or
renamed iframe stack survives"). 127C ("Delete disabled-publish text, Page
iframe embed copy, stub public routes"). 127E ("The old combined Pages screen
and its query selection, iframe-copy model, obsolete controls, helpers, and
CSS are gone"). 127D Retry "uses the same operation rather than hiding the
failure behind a wrapper." **No gap.** Clean and explicit on every slice.

**V8 — Runtime test dependency.** Well guarded. 127B ("Use browser/runtime
tests for behavior that static string assertions cannot prove. Do not make
normal runtime depend on those tests"; "Product runtime does not depend on
compiler fixtures or verification probes"). 127A ("Normal Page work does not
depend on migration scripts or test fixtures"). 127D ("Normal saves do not
depend on tests, probes, or performance fixtures"). MAMA §12 ("normal runtime
never depends on tests, probes, fixtures, or migration helpers"). **No gap.**
Clean.

**V-audit summary:** The design avoids V1, V2, V4, V5, V6, V7, V8 cleanly. V3
has one under-specified execution surface (127C purge reconciliation) that
should be tightened before 127C executes. No violation is present in the
*design*; the audit is GREEN with one V3 precision note.

#### 5. Needed documentation / updates (TPM perspective)

From a program and system-integration perspective, the following current-
system docs need updates after their owning slice is deployed and proven.
Paths are from repo root.

**Tier99 / policy / entitlement (owned by 127A):**
- `documentation/services/michael.md` — add `tier99` to the
  `public.account_tier` enum table and the `CLICKEEN` row note; this doc
  currently lists only `free, tier1, tier2, tier3, tier4` (confirmed against
  `supabase/migrations/20260602120000__account_tier4.sql`).
- `documentation/services/berlin.md` — Berlin bootstrap normalization must
  accept `tier99`; the doc's account/tier vocabulary must reflect it.
- `documentation/architecture/CONTEXT.md` and
  `documentation/architecture/Overview.md` — the System Map / Authorities
  tables gain the Page public-serving authority and the Tier99 distinction.
- `documentation/architecture/Tenets.md` — Tenet 11 currently says "Page
  publish and page public serving are currently unavailable until Roma writes
  page packages." That sentence must flip to current truth after 127C.
- `documentation/capabilities/multitenancy.md` — tier table must list Tier99
  and the "never sellable" rule.

**Page source / overlay (owned by 127A, 127B):**
- `documentation/architecture/OverlayArchitecture.md` — Page-owned overlays
  (Page-owned values only; Instance overlays remain Instance-owned) is a new
  overlay class that must be documented.
- `documentation/architecture/RuntimeProfiles.md` — the "Composed page" row
  currently says "page-owned composition over referenced saved instances."
  After 127C this must describe the compiled-package + locale-completion model
  and the `packages/{fingerprint}/` shape.
- The runtime-materializer contract doc (referenced from 127B) must document
  the new Page Instance Contribution operation.

**Publication / public serving / cache (owned by 127C):**
- `documentation/services/tokyo-worker.md` — currently says "Page public
  serving is unavailable until Roma writes real page packages" and
  "Tokyo-worker does not generate page package files." Both must be rewritten
  for the install/select/serve/locale-completion contract, **including an
  honest statement that Tokyo performs bounded deterministic locale-value
  injection into a pre-compiled Page document** (resolving Ambiguity 1 from
  §2). The Public Serving and Private Roma Routes tables gain the page install
  + public page routes.
- `documentation/services/tokyo.md` — the Account Runtime Shape and Public
  Serving sections gain the `packages/{packageFingerprint}/` child and the
  page public URL shape; the Hard Stops list ("introduce a second artifact
  root for one instance") must be reconciled with the per-package-fingerprint
  directory (which is a *package* root, not a second *instance* root — the doc
  should say so explicitly to prevent a future V5/V7 regression).
- `documentation/engineering/CloudflareOperations.md` — if a new
  supported-Page evidence command is added (127C flags this conditionally), it
  belongs here; otherwise no change.
- `documentation/engineering/CloudflarePagesCloudDevChecklist.md` — no change
  (Pages apps unaffected; Tokyo-worker is Worker-deployed).

**Recompilation / status (owned by 127D):**
- `documentation/services/roma.md` — the Pages Domain section currently states
  page publish is disabled and "Any shift to generated child artifact
  coordinates… belongs to a future Page Package PRD." That future has arrived;
  the section must describe compile orchestration, the post-save recompile
  fan-out, `current | out_of_date`, and the retry route.
- `documentation/services/bob.md` — only if the Instance-save result shown to
  Bob now carries the exhaustive Page-recompile summary (127D flags this
  conditionally).

**Roma Pages UI (owned by 127E):**
- `documentation/services/roma.md` — Runtime Routes table gains
  `/pages/catalog` and `/pages/{pageId}`; the Workspace Capability section
  gains Page Builder.
- `documentation/architecture/Overview.md` — Product Flows gain the Page
  publish flow.

**TPM execution-sequencing risk across 127A→127E:**

The mandatory order `127A → 127B → 127C → 127D → 127E` is correct *as a
dependency chain* (each slice consumes deployed behavior from the prior), but
there are three concrete deploy/doc-order hazards a TPM must actively manage:

1. **The 127A internal ordering is itself a multi-step deploy sequence with a
   hard gate.** 127A's "Deployment order" is: (1) additive Tier99 + new source
   code → (2) Supabase enum migration for `tier99` → (3) Berlin/Roma/Tokyo-
   worker deploy → (4) verify readers accept both shapes → (5) Page-source
   migration → (6) conditional `CLICKEEN` Tier 4→5 migration → (7) remove temp
   migration code and redeploy. **Hazard:** the `ck-policy` matrix validator
   (`packages/ck-policy/src/matrix.ts`) requires *every entitlement to have a
   value for every tier* and *every required tier to be present*, and it
   throws at module load otherwise. This means `pages.max` and `tier99` are
   **mutually coupled**: you cannot add `pages.max` to the registry without
   also giving it a `tier99` value, and you cannot add `tier99` to
   `REQUIRED_TIERS` without giving every existing entitlement a `tier99` value.
   So step 1 (additive code) must add `tier99` to `AccountTier`,
   `REQUIRED_TIERS`, the matrix JSON, *and* `pages.max` with all six tier
   values, **in one atomic code change**, or the policy package fails to load.
   The PRD lists these as separate bullet points but does not call out that
   they are a single load-bearing commit. **Recommendation:** 127A must
   explicitly state that the Tier99 profile addition and the `pages.max`
   entitlement addition ship as one code unit, with the matrix JSON and the
   TypeScript `AccountTier`/`PolicyProfile`/`REQUIRED_TIERS` updated together.
   The Supabase enum migration (step 2) is correctly sequenced after code but
   before the `CLICKEEN` row update (step 6), and the conditional
   `CHECK (tier in ('free','tier1','tier2','tier3','tier4','tier99'))` must be
   in the same migration as the `ADD VALUE 'tier99'` — note Postgres
   `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in older
   PG, so the migration author must use the `IF NOT EXISTS` form already
   established in `20260602120000__account_tier4.sql`. This is a known-good
   pattern; flag it so the executor doesn't reinvent it.

2. **127C is the slice that flips Tenet 11's "page serving disabled"
   sentence.** Until 127C deploys, `tokyo-worker.md`, `tokyo.md`,
   `CONTEXT.md`, `Overview.md`, and `Tenets.md` all say page serving is
   unavailable, and the code returns `publishUnavailable`/`404`. 127C must, in
   one slice, (a) deploy the Roma publish route, (b) deploy the Tokyo-worker
   install + public page routes, (c) verify, and (d) update all five docs.
   **Hazard:** Roma (Pages Git deploy) and Tokyo-worker (GitHub Actions Worker
   deploy) are two different deploy planes with two different evidence sources
   (`AGENTS.md` DevOps Gate). If Roma deploys before Tokyo-worker, the publish
   route will call an install endpoint that does not exist yet.
   **Recommendation:** 127C must state the deploy order explicitly: Tokyo-
   worker install route first, then Roma publish route, then verification. The
   slice currently lists both deploys but not the ordering. This is the single
   most likely break-a-later-slice hazard.

3. **127D removes the "unpublish before save" rule, but only after its own
   recompile path is live.** `tokyo-worker/src/routes/internal-page-routes.ts`
   currently rejects source PUT while published (`saveRequiresUnpublish`), and
   `roma/lib/account-page-source.ts` reflects that. 127D §"Code work" step 9
   says "Remove the current rule that requires a Page to be unpublished before
   source can save, but only after the save-and-recompile result above is
   deployed." **Hazard:** this is a behavioral inversion that crosses the
   Roma↔Tokyo-worker contract. If Roma deploys the new save-with-recompile path
   while Tokyo still enforces the old `saveRequiresUnpublish`, saves of
   published pages will 422. **Recommendation:** 127D must sequence: (1) deploy
   Tokyo-worker with the relaxed PUT validation + new serve-state shape, (2)
   deploy Roma with the recompile-on-save path, (3) verify, (4) remove the old
   rule text from docs. Same-plane ordering discipline as 127C.

**Doc-order dependency:** `Tenets.md` Tenet 11 and
`tokyo-worker.md`/`tokyo.md` "page serving disabled" sentences must not be
edited until 127C is proven in cloud-dev — the MAMA §13 rule ("Planning text
does not change current-system documentation before deployment") governs this
and is correct. The only doc that may change *during* 127A is the PRD set
itself.

**Verdict: APPROVE WITH CHANGES** — The architecture is cohesive, correctly
reuses named authorities without inventing subsystems, and has an exceptionally
clean V1–V8 posture; it should be approved after the four precision gaps are
closed (locale-completion single-owner resolution, sitemap/robots ownership and
bounding, 127C purge per-URL reconciliation, and explicit deploy-order
statements in 127A's coupled Tier99 + `pages.max` commit and in the
127C/127D Roma-vs-Tokyo-worker deploy sequencing).

---

## 4. Consolidated Verdict & Convergence

All three seats returned **APPROVE WITH CHANGES**. No seat BLOCKED. The three
reviews converge on a small set of load-bearing issues that the product owner
should resolve in the MAMA and/or lettered PRDs before execution begins.

### Convergent blockers-to-resolve (all three or a clear majority flagged)

1. **The "locale completion" contract is under-specified and has ambiguous
   ownership.** (Staff Eng §1, §4; Principal TPM §2 Ambiguity 1)
   It is referenced by both 127B (preview) and 127C (public serving), but is
   neither fully defined nor clearly owned by one module. Since it sits on the
   public-serving hot path, this is the highest-priority precision gap.
   *Resolution:* name it as one pure function in the shared compiler package,
   called by both Roma and Tokyo, and update `tokyo-worker.md`/`tokyo.md` to
   honestly describe bounded locale-value injection into a pre-compiled
   document.

2. **The single-instance → multi-instance materializer refactor is
   misrepresented as "reuse."** (Staff Eng §1, §4)
   `stampPackageRoot` enforces exactly one root and `runtime.ts` keys state by
   a single `instanceId`. Producing N "Instance contributions" without
   weakening isolation is a real refactor with real dedup/module-identity
   contract decisions. The PRD should state the effort honestly and define the
   dedup canonicalization.

3. **Sitemap/robots ownership is silently minted as "existing."** (Staff Eng
   §3; Principal TPM §2 Ambiguity 2, §1 cost)
   There is no `clk.live` robots/sitemap authority in the code today, and a
   host-level sitemap implies an unbounded cross-account public-path read
   (Tenet 11 risk). *Resolution:* either name it as a new bounded/cached
   Tokyo-worker route family, or scope V1 to per-Page `<meta>` robots + defer
   host sitemap.

4. **Pages is not wired to the agent-operated thesis.** (Senior PM §4)
   Page-owned overlay values (title, description, social) must be authored
   manually per locale with no Translation Agent path, and recompile failure
   recovery is human-operated retry per page. This is the largest on-thesis
   drift. The Translation Agent already exists for instance overlays; the
   product owner should decide whether 127 ships without it (and accepts the
   manual-authoring cost) or adds a Page-overlay generation path.

5. **Deploy-order hazards are under-specified across slices.** (Principal TPM
   §5)
   - 127A's Tier99 + `pages.max` are mutually coupled through the
     `ck-policy` matrix validator and must ship as one atomic code change.
   - 127C must deploy Tokyo-worker install route *before* the Roma publish
     route (different deploy planes).
   - 127D must deploy Tokyo-worker's relaxed PUT validation *before* Roma's
     recompile-on-save path, or published-page saves 422.

### Single-seat findings worth product-owner attention

- **Staff Eng:** the stable-URL four-step selector depends on a "global
  privacy authority" and "Cloudflare-country mapping" that do not exist as
  Pages authorities today (Tenet 2 risk). Consider serving `baseLocale`
  directly at the stable URL for V1 and deferring the multi-signal selector.
- **Staff Eng / Principal TPM:** the SEO/GEO/AEO prose in MAMA §6 is
  marketing-grade; the actionable engineering requirements already live in
  127C. Trim the MAMA restatement.
- **Staff Eng:** the 127E one-card catalogue route (`/pages/catalog`) is mild
  gold-plating for V1; a "Create page" action on Your pages would suffice
  until a second starting point exists.
- **Senior PM:** customer-facing UX writing is under-specified — `out_of_date`
  label, save+out-of-date messaging, tier-limit copy, preview-failure pattern,
  and the Free/Tier1 never-entitled first-run all need concrete copy/patterns.
- **Senior PM:** a missing `documentation/capabilities/pages.md` — every other
  first-class capability has a doc; Pages needs one.
- **Principal TPM:** 127C purge reporting should be per-URL or bounded-batch
  to fully close the V3 (silent omission) gap on locale cache purges.

### V1–V8 audit convergence

All three seats ran the V1–V8 audit. Convergent result:

| Violation | Design posture | Notes |
| --- | --- | --- |
| V1 Silent substitution | CLEAN | Strong, repeated guards; stable-URL baseLocale default is Tenet-3-compliant |
| V2 Silent healing | CLEAN | Migration and corruption rules explicit |
| V3 Silent omission | GREEN with 1 precision gap | 127C purge reconciliation needs per-URL/bounded-batch reporting |
| V4 Fail-open control | CLEAN | `ck-policy` matrix throws on missing/unknown by construction |
| V5 Corruption-as-absence | CLEAN | Serve-state and source loaders fail closed |
| V6 Partial-success masquerade | CLEAN (strongest area) | Step-level outcome separation across all slices |
| V7 Masquerade/redress | CLEAN | Explicit deletion of stubs/paths/migration code on every slice |
| V8 Runtime test dependency | CLEAN | Runtime-vs-test separation stated on every slice |

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** The MAMA's tenets, authority mapping,
deterministic-compile + last-good design, and V1–V8 discipline are
staff/principal-grade and code-grounded. Execution should not begin until the
five convergent items above are resolved in the PRDs, with the locale-
completion contract and the 127C/127D deploy ordering as the two non-
negotiable pre-execution fixes.
