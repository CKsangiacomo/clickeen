# 127B — Peer Review Appendix (GLM)

Status: **SUPERSEDED BY THE 2026-08-04 REWRITE OF 127B — HISTORICAL INPUT ONLY**

The current 127B now uses the product-owner three-file law: every Widget has
HTML/CSS/JS, every Instance saves customized copies, and every Page combines
those saved files. This review predates that correction. Run a new peer review
against the rewritten PRD before execution; do not use this verdict as current
readiness evidence.

The current slice is `127B__PRD__Web_Code_Generator.md`. Every Page Compiler
reference below uses the superseded name and does not define the accepted Web
Code Generator.

Subject: `127B__PRD__Page_Compiler.md` (Page Compiler), the second execution slice of PRD 127.

Date: 2026-08-04

Model: builtin:zai-coding-plan/GLM-5.2

This appendix consolidates three independent peer reviews of 127B, each written
by a subagent operating from a single seat (Staff Engineer, Senior PM, Principal
TPM) and grounded in the deployed codebase — especially the actual
`packages/ck-runtime-materializer/` source, the widget shared runtime, and the
Tokyo locale-completion path. Each review was instructed to break down code
vectors, blast radiuses, and product/architecture implications and to expose
findings concretely rather than to rubber-stamp.

Note: these reviews were written against the **current** 127B (post-first-pass
updates: explicit Save/Update invocation gates, `pageOverlayFingerprints` and
per-instance `overlayFingerprints` in evidence, `isTemplate: false` validation,
the "last compiled preview while dirty" model). The three reviews are reproduced
verbatim in their authored order, followed by a convergence note.

---

## Table of Contents

1. [Staff Engineer Peer Review](#1-staff-engineer-peer-review)
2. [Senior Product Manager Peer Review](#2-senior-product-manager-peer-review)
3. [Principal TPM Peer Review](#3-principal-tpm-peer-review)
4. [Consolidated Verdict & Convergence](#4-consolidated-verdict--convergence)

---

## 1. Staff Engineer Peer Review

### 127B — Staff Engineer Peer Review (GLM)

#### 1. Elegant engineering and scalability

**Genuinely elegant and load-bearing at the code level**

- **Single compiler for preview + publish.** 127B §"Explicit invocation and preview" and the Mama §5 line "Roma uses the same compiler result for preview and publication; there is no second Page renderer" is the strongest decision in the slice. It structurally prevents the classic Clickeen anti-pattern (V7 masquerade) where a preview renderer drifts from the serving renderer. Grounded: today there is no page preview/renderer in Roma at all (`roma/lib/account-page-direct.ts` is pure source CRUD; grep for `preview|iframe|index.html` returns nothing), so building one renderer is strictly additive.
- **Pure, network-free compiler contract.** The result type in 127B §"What the compiler returns" is a discriminated union with `ok:true` carrying `{files, evidence}` and `ok:false` carrying exact coordinates (`placementId`, `instanceId`, `locale`, `paths`). This mirrors the existing materializer shape (`packages/ck-runtime-materializer/src/types.ts:81-89`, `RuntimeMaterializerSuccess`/`Failure`) and the existing Roma `InstancePackageFailure` (`roma/lib/account-instance-public-package.ts:58-67`), which carries `kind: 'VALIDATION'|'UPSTREAM_UNAVAILABLE'` plus `reasonKey/detail/paths`. The failure-coordinate discipline is consistent with the codebase and directly serves V1/V3.
- **Explicit invocation gate.** 127B §"Explicit invocation and preview" enumerates the only two triggers (Save, Update page) and the excluded events (draft change, instance save, overlay write, list/open, public request). This preserves Tenet 7 (Bob/browser-memory boundary) and Tenet 11, and aligns with the existing Roma rule that the instance source-save command "does not generate translations, regenerate translations, mutate locale overlays" (`documentation/services/roma.md` Builder Orchestration).
- **Determinism as a testable invariant.** "The same canonical input must return byte-identical files and evidence" (§7) plus the verification bullet "two runs over the same input are byte-identical" is the right invariant because it makes package fingerprints meaningful for 127D currency derivation. The existing `buildRuntimePackageFingerprint` (`packages/ck-runtime-materializer/src/fingerprint.ts:9-20`) is already a length-prefixed SHA-256 over `index.html`/`styles.css`/`runtime.js`, which is byte-deterministic and reusable.

**Where the design does NOT scale / contradicts the code reality**

- **"Extend the existing runtime materializer with one reusable in-memory operation" is surgery, not extension.** This is the single biggest scalability risk in 127B and the prose understates it. The materializer is hard-wired to one instance at every layer:
  - `stampPackageRoot` (`packages/ck-runtime-materializer/src/html.ts:55-98`) **rejects multiple roots**: `if (topLevelRoots.length !== 1 ...) return materializerFailure('widget_package_root_invalid')`. A Page contribution per placement is fine (one root each), but the operation that produces a contribution must not run through the current single-root gate the same way.
  - The runtime payload (`packages/ck-runtime-materializer/src/runtime.ts:76-182`) is structurally single-instance: one `payload.instanceId`, one `payload.baseState`, one `payload.baseLocale`, and it writes exactly one key: `window.CK_WIDGETS[payload.instanceId] = {...}` (lines 173-180). There is no notion of "emit a payload chunk keyed by an arbitrary placementId." The PRD's `PageInstanceContribution.javascript[]` cannot just be "the existing runtime split into an array" — the payload closure captures exactly one instance and one `CK_LOCALE_CONTEXT` read.
  - `buildIndexHtml` (`html.ts:100-122`) emits one `<title>`, one `<html lang>`, one `<script>window.CK_LOCALE_CONTEXT = null;</script>`, one stylesheet link, one runtime reference, and one body. A Page needs a different document shell entirely.
  - `publicPackagePath` (`materialize.ts:36-38`) is `/{accountPublicId}/{instanceId}` — a single-instance coordinate. A Page contribution has no public instance URL.

  So the "reusable operation" must reuse *parsing* (`extractBody`, `stripScripts`, `stripStylesheetLinks`, `packageSource`, `resolveProductPath`), *root stamping* (`stampPackageRoot`, but re-keyed to accept placementId), *styles* (`buildStyles`, which is already per-widget and dedup-by-key), and *runtime module chunking* (`runtimeModuleChunk`/`styleChunk` + `chunkMarkerId`) — but it **cannot** reuse the payload closure or `buildIndexHtml` unchanged. The PRD's line "must reuse the same Widget package parsing, root stamping, styles, runtime modules, field paths, and validation" is half-true at the file level and false at the runtime-payload level. An implementing AI reading "reuse the same … runtime modules" will either (a) emit N copies of the single-instance payload closure (breaks — global init repeats, `CK_LOCALE_CONTEXT` read duplicated), or (b) invent a new multi-instance payload and call it "the same." Both are failure modes 127B does not foreclose.

- **The browser runtime *already anticipates* composed pages; the materializer does not.** `tokyo/product/widgets/shared/runtime.js` exposes `roots(widgetType)` (returns an array via `querySelectorAll`), `resolveInstanceId(widgetRoot)` (reads `data-ck-instance-id` from root / shadow host / `.closest` ancestor), `readPayload(instanceId)` (reads `window.CK_WIDGETS[instanceId]`), and `isComposedPage(widgetRoot)` (checks `widgetRoot.closest('[data-ck-composed-page="true"]')`). The registration loop is `roots(normalized).forEach((root) => initializer(root))`. So the *client* runtime supports N roots keyed by N instance ids. **But no producer emits `[data-ck-composed-page="true"]` or populates more than one `window.CK_WIDGETS[id]` today** (grep across `packages/`, `roma/lib/`, `tokyo-worker/src/` returns zero hits for `data-ck-composed-page`). This is a latent forward-looking hook. 127B does not name it, which means an executor will either reinvent the `data-ck-composed-page` marker under a different name (V7) or fail to set it and leave `isComposedPage` returning false. The PRD must explicitly say: the Page compiler stamps `[data-ck-composed-page="true"]` on `<main>` and emits one `CK_WIDGETS[placementId-or-instanceId]` payload per placement, reusing the existing browser contract.

- **CSS/JS dedup canonicalization is undefined, and the existing dedup is key-based, not byte-based.** 127B §4 says "emit identical shared CSS bytes once" and §5 says "emit byte-identical shared runtime modules once." The existing emitter dedups by **resolved product path key**, not by byte content: `buildStyles` uses `includedStyleKeys = new Set<string>()` keyed on `href`/`key` (`runtime.ts:43-58`), and `buildRuntime` uses `includedRuntimeKeys = new Set<string>()` keyed on resolved `key` (`runtime.ts:194-209`). This is correct for standalone widgets (one widget, one resolved key per module). For a Page, the same shared module (e.g. `product/widgets/shared/header.js`) referenced by two different widgets resolves to the **same key** and dedups naturally — good. But two widgets of the same type at different placements produce the same `widget.client.js` key (`product/widgets/{type}/widget.client.js`), and the current `buildRuntime` stashes exactly one `widgetClientChunk` and appends it once (`runtime.ts:194, 204-214`). Two placements of the *same* widget type therefore share one `widget.client.js` chunk — which is correct for the module code but **wrong if that module captures placement identity at load time**. The executor needs an explicit rule: shared/runtime-module bytes are deduped by canonical key and emitted once; per-placement initialization (the `window.CK_WIDGETS[id]` payload) is emitted once per placement. 127B says "keep each Instance state keyed by its stable placement and Instance IDs" (§5) but never says *where* the per-placement payload lives or how it relates to the single-instance payload closure in `runtime.ts:76-182`.

- **Runtime state isolation across placements is asserted, not specified.** "without merging Instance state" / "keep each Instance state keyed by its stable placement and Instance IDs" is the whole isolation contract. In code, "Instance state" is the `window.CK_WIDGETS[id]` map entry plus the closure-captured `payload.baseState`/`payload.baseLocale`. Isolation today is *implicit* because there is only ever one id. With N placements, isolation means: (1) each placement gets its own `CK_WIDGETS` entry under a key that is stable and unique within the Page, (2) the locale-context application (`applyExactOverlay`) runs per-placement, not once globally, and (3) `document.documentElement.lang` is set once at Page level, not per-instance. Today `applyExactOverlay` mutates `payload.baseState` into `selectedState` and writes one `window.CK_WIDGETS[payload.instanceId]` — that model must be lifted to a per-placement loop with per-placement overlay values. 127B does not specify this loop, the keying (instanceId vs placementId — the PRD uses both: "keyed by its stable placement **and** Instance IDs"), or how `CK_LOCALE_CONTEXT` (a single global) fans out to per-placement overlay values. This is the most likely place an AI improvises.

- **The "shared locale-completion function" is currently a Tokyo-private string replacement, not a shared function.** The only locale-completion code in the repo is `indexHtmlWithLocaleContext` in `tokyo-worker/src/routes/clk-live-routes.ts:128-150`. It does two string replacements on the stored `index.html`: the unique marker `window.CK_LOCALE_CONTEXT = null;` (`LOCALE_CONTEXT_MARKER`, line 119) and the `<html lang="...">` regex. It is a module-private function in a route file, not an export, and it lives in the **Tokyo-worker** package — which Roma does not depend on (Roma depends on `@clickeen/ck-runtime-materializer` and `@clickeen/ck-contracts`, per `roma/lib/account-instance-public-package.ts`). So "the same locale-completion function used by Tokyo" does not exist as a shareable artifact today. Sharing it means (a) extracting it to a workspace package that both Roma and Tokyo-worker import, and (b) generalizing it from a single-instance `{locale, baseLocale, values, languages}` injection to a Page model where each placement has its own overlay values. That generalization is non-trivial: the current `values` is one flat map applied to one `baseState`; a Page has N placements each needing its own values, plus Page-owned values. 127B's `overlays.json` key contract (`placements.{placementId}.{instanceFieldPath}`) implies Tokyo must, on locale completion, split the flat map by placement prefix and apply each slice to the matching placement's runtime. That is a **new** completion mechanism, not a reuse of the existing one. Calling it "the same function" is the most misleading line in the PRD (see §4).

#### 2. Compliance with architecture and tenets

**Strong compliance**

- **Tenet 5 (product commands stay boring) / Tenet 2 (named authorities).** The compiler is a pure callable inside Roma; Roma reads everything first, then calls the compiler with a plain object (§"What the compiler receives"). No storage, no agent, no network. The authority chain (Roma → compiler → Roma → Tokyo) is preserved exactly as `documentation/services/roma.md` Builder Orchestration describes for instances.
- **Tenet 6 (widget software is product truth).** §"The Instance contribution" explicitly forbids "a second Widget renderer" and requires reuse of "the same Widget package parsing, root stamping, styles, runtime modules, field paths." This is the right Tenet-6 stance: the compiler must not invent widget semantics outside the six-file contract (`documentation/widgets/authoring/WidgetFiles.md`).
- **Tenet 11 (public serving reads stored artifacts).** 127B is compliant at the compiler boundary: it emits files, stores nothing, and "performs no storage, publication, cache, network, or agent work." The risk is one layer down — the shared locale-completion function (see §1 and §4) — but 127B itself does not violate Tenet 11.
- **V1/V3 discipline.** "Any mismatch returns one explicit failure. No placement is filtered out" (§1) and the failure table at the end map cleanly to V1 (no silent substitution of locale/overlay) and V3 (no silent omission of placement/file/module). The Mama §13 failure table reinforces this.

**Risks and gaps**

- **Tenet 1 (structured, typed, AI-legible artifacts) — the `PageInstanceContribution` and `overlays.json` contracts are typed only in PRD prose, and the `{instanceFieldPath}` shape is undefined.** `PageInstanceContribution` does not exist in code (grep confirms: only the PRD and a PR-history file reference it). More importantly, the `overlays.json` key contract `placements.{placementId}.{instanceFieldPath}` (§6) does not define `{instanceFieldPath}`. The codebase has two competing field-path vocabularies:
  1. `editable-fields.json` declaration paths use array-repeat syntax: `items[].title`, `cards.items[].headline` (see `tokyo/product/widgets/calltoaction/editable-fields.json` and the materializer fixture `tests/fixtures/base-input.ts` with `items[].title`).
  2. Stored instance overlays use **concrete** paths. The materializer runtime's `applyExactOverlay` (`runtime.ts:88-134`) **rejects** any path containing `[`, `]`, or `*` (`path.includes('[') || path.includes(']') || path.includes('*')` → throw). So `items[].title` can never be an overlay key. Concrete array paths must be expressed some other way (the code at `runtime.ts:106-119` accepts numeric segments like `items.0.title`).

  127B never says which vocabulary `{instanceFieldPath}` uses. An AI implementing this will guess — likely the editable-fields declaration form, which then breaks `applyExactOverlay` at runtime. This is a Tenet-1 gap: the artifact is not AI-legible because the path grammar is ambiguous. The PRD must pin `{instanceFieldPath}` to the **concrete** path grammar that `applyExactOverlay` already enforces (dot-separated, numeric index for array items, no `[]`), and must say so by reference to the existing runtime validator.

- **Tenet 1 — `overlays.json` as one aggregated file vs. per-locale files like instances.** OverlayArchitecture.md and the instance storage shape (`accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json`) establish a **per-locale file** contract: "There is no instance-level locale artifact subtree." 127B's `overlays.json` breaks that pattern by aggregating all locales into one file keyed by locale. This is defensible (a Page is one package, not N instance runtimes), but it is a deliberate divergence from the established overlay artifact shape and must be called out as such in `OverlayArchitecture.md`, not introduced silently. The PRD lists `OverlayArchitecture.md` in its doc section but does not flag the divergence.

- **Tenet 3 (no silent substitution at locale/overlay boundaries).** Strong in prose ("The compiler never invents a missing overlay value or substitutes another locale," §6; "Missing or corrupt Page/Instance truth blocks compilation," Customer result). The risk is in the **selection/completion** path deferred to 127C: the Mama §6 shorter-URL selection ladder (explicit choice → browser language → country mapping → baseLocale) is a potential V1 surface. But that is 127C's boundary, not 127B's; 127B correctly restricts itself to "compile for every selected locale" and "fail if a required overlay is missing." Within 127B's scope, Tenet 3 compliance is solid.

- **Tenet 7 (Bob edits in browser memory; save is the persistence boundary).** The explicit-invocation gate (§"Explicit invocation and preview") preserves this: draft changes never invoke the compiler; only Save/Update do. The one leak is the preview-staleness rule (see §4): "Page Builder may keep showing the last successfully compiled preview but must identify it as not reflecting the unsaved draft." That "identify it" is a 127E UI concern leaking into the 127B compiler contract. It does not violate Tenet 7 (no persistence happens), but it muddies the slice boundary.

- **Tenet 11 — shared locale-completion across Roma-preview and Tokyo-serving strains the storage/serving boundary.** If the shared function lives in a workspace package both Roma and Tokyo import, Tokyo's public-serving path depends on the same code Roma uses for preview. That is *good* for consistency (no two renderers, V7) but must be designed so the function is pure (takes stored `index.html` + a locale-context object, returns HTML) and Tokyo never calls into Roma or regenerates. The current `indexHtmlWithLocaleContext` is already pure in that sense, so this is achievable — but only if 127B names where the function lives and what its generalized Page input shape is. Today it is not named.

#### 3. Over-architecture / unnecessary complexity

- **`PageInstanceContribution` as an intermediate type is justified, not ceremony — but its shape is slightly over-specified for what the compiler consumes.** The type `{ html, css[], javascript[], baseValues, overlays }` is the right cut: it lets the compiler treat each placement as a self-contained bundle without re-reading widget source. The genuine over-specification is `overlays: Record<string, Record<string, string>>` (locale → field-path → value). This bundles *all* locales into one contribution, which forces the compiler to hold every locale's overlay for every placement in memory before emitting `overlays.json`. Given the Mama's "first release is one vertical flow of Instances," this is fine for typical sizes, but it precludes streaming emission and ties the contribution to the Page's full locale set rather than the instance's own overlay set. A leaner shape would carry the instance's own base values plus a pointer/coordinate to its overlays and let the compiler read per-placement overlay values lazily. The current shape is not wrong, but it is more than the minimum.

- **The `overlays.json` aggregated shape (vs per-locale files like instances) adds a parsing/splitting step at completion time.** Instances store one file per locale (`overlays/locales/{locale}.json`), and `indexHtmlWithLocaleContext` injects one flat `values` map. A Page with one aggregated `overlays.json` forces the completion function to (1) read the file, (2) select the locale entry, (3) split placement-prefixed keys from Page-owned keys, (4) hand each placement its slice. That is strictly more machinery than the instance model. The justification (one package, one atomic artifact) is reasonable, but the PRD does not justify it against the simpler alternative of emitting per-locale files (`packages/{fp}/overlays/{locale}.json`) that mirror the instance model and let Tokyo reuse `indexHtmlWithLocaleContext` almost verbatim. The aggregated file is a defensible choice that is not defended.

- **Four-fingerprint granularity (file + package + overlay + instance) is correct but verbose.** 127B §7 fingerprints "each exact file and then … the ordered four-file set plus the compiler contract version," and the evidence block (§"What the compiler returns") carries `fileFingerprints` (4), `packageFingerprint`, `pageOverlayFingerprints`, and per-placement `instanceRevisions[].sourceFingerprint` + `overlayFingerprints`. This is the right granularity for 127D currency derivation (which must detect a changed instance source vs. a changed overlay vs. a changed Page source independently). It is not over-architecture; it is the minimum evidence 127D needs to derive `current | out_of_date | save_failed` without re-reading. The one redundancy: `pageOverlayFingerprints` and the per-locale entries inside the aggregated `overlays.json` overlap conceptually. Pinning `pageOverlayFingerprints` to "SHA-256 of the exact `overlays.json` locale entry bytes" would remove ambiguity.

- **"Locale completion as a pure function shared by preview and later Tokyo serving where the runtime boundary permits" (Code work §5) hedges a real decision with "where the runtime boundary permits."** Either the function is shared or it is not. The hedge invites the executor to skip sharing if it looks hard, which re-introduces the two-renderer risk the rest of the PRD is trying to kill. Drop the hedge.

#### 3b. Academic / theoretical abstractions and pre-work, meta-work, gold-plating

- **"Widget-specific structured data is included only when the Widget already owns a declared compatible contribution whose visible content supports it" (§3) is dead code today.** Grep for `structuredData`, `json-ld`, `schema.org`, `application/ld`, `seoContribution`, `contribution` across `tokyo/product/widgets/**`, `packages/**`, and `roma/lib/**` returns **zero** widget-owned structured-data contributions. No widget owns such a declaration; the six-file widget contract (`spec.json`, `editable-fields.json`, `limits.json`, `widget.html`, `widget.css`, `widget.client.js` — per `documentation/widgets/authoring/WidgetFiles.md`) has no field for it. So this sentence describes behavior that can never fire in 127B. It is forward-looking prose that an executor will either ignore (fine) or try to scaffold (gold-plating: inventing a contribution registry that no widget populates). Remove it from 127B or move it to a future slice where at least one widget declares a contribution.

- **"supported Page-level structured data derived from declared Page fields" (§3) is undefined and unexercised.** "Which fields? what schema?" — 127A's `PageOwnedValues` is `{ title, description, socialTitle, socialDescription, socialImageAssetRef? }`. The only structured data derivable from that without invention is a WebSite/Breadcrumb-ish stub, and the Mama §5 explicitly says "Clickeen guarantees valid crawlable output, not search ranking" and the compiler "does not infer facts, keywords, claims, prices, FAQs, image text, or arbitrary schema from prose." So the only honest reading is: emit nothing, or emit a minimal `WebSite`/`WebPage` node from `title`/`description`/canonical. 127B must pick one and name the schema, or drop the sentence. As written, "supported Page-level structured data" + "derived from declared Page fields" leaves the executor to choose both the schema vocabulary and the derivation rules — exactly the invention the PRD claims to forbid.

- **SEO/metadata derivation claims are slightly over-reaching.** §3 promises canonical, alternate-locale links, `x-default`, social metadata, robots, and structured data. Canonical/alternate/`x-default`/robots/social are all derivable from `PageOwnedValues` + the published URL shape without invention — good. But "Page metadata and visible locale content agree" (verification) and "SEO metadata contradicts the supported source contract → fail" (failure table) name a contract that is never specified. An executor cannot write a failing test for "metadata contradicts the supported source contract" because the supported contract is not written down. Either define the agreement rule (e.g. `<title>` must equal `PageOwnedValues.title`; `og:title` must equal `socialTitle || title`) or strike the failure row.

- **No other gold-plating detected.** The slice is otherwise lean: it adds one module, one materializer operation, one locale-completion function, and deletes old preview/composition code (Code work §7). That is the right size.

#### 4. Prose / best-time stories useless or harmful for devs

This is the section that decides whether an AI can implement 127B without improvising.

- **"Extend the existing runtime materializer with one reusable in-memory operation" (§"The Instance contribution") — harmful understatement.** As shown in §1, this is surgery on a single-instance substrate: `stampPackageRoot` rejects multiple roots (`html.ts:90`), the runtime payload is one closure writing one `CK_WIDGETS[id]` (`runtime.ts:76-182`), and `buildIndexHtml` emits one document shell (`html.ts:100-122`). An executor reading "extend" will attempt a thin wrapper and hit the single-root/single-payload walls. The PRD must say: the reusable operation reuses `extractBody`/`stripScripts`/`stripStylesheetLinks`/`packageSource`/`resolveProductPath`/`buildStyles`/`runtimeModuleChunk`/`styleChunk`/`chunkMarkerId` and `stampPackageRoot` (relaxed to stamp a placement-keyed root), and does **not** reuse `buildRuntime`'s payload closure or `buildIndexHtml`. It should name the concrete files (`packages/ck-runtime-materializer/src/materialize.ts`, `html.ts`, `runtime.ts`, `files.ts`) and the concrete functions that are reusable vs. not. The existing stop-clause ("If the existing materializer cannot expose a contribution without changing standalone Widget behavior, execution stops") is good, but it must be paired with a concrete plan so "stops" is not the default outcome.

- **"consolidates and deduplicates CSS without weakening Instance isolation" / "without merging Instance state" (Mama §5; 127B §4/§5) — undefined terms.** "Instance isolation" in code means: each placement's runtime state lives under its own `window.CK_WIDGETS[id]` key, each placement's `widget.client.js` initializer binds to its own root via `CKWidgetRuntime.register` → `roots(widgetType).forEach(initializer)` and the `data-ck-${type}-runtime-bound` attribute guard (`tokyo/product/widgets/shared/runtime.js:72-91`). "Merging Instance state" would mean two placements sharing one `CK_WIDGETS` entry or one initializer binding two roots. The dedup contract must be stated as: (1) shared module bytes (anything resolved under `product/widgets/shared/` or a repeated `widget.client.js` key) are emitted once; (2) per-placement payload + root stamp are emitted once per placement; (3) CSS chunks dedup by `chunkMarkerId(key)`. The PRD says none of this. An executor will guess at what "isolation" means and likely get (2) wrong by collapsing per-placement payloads.

- **"the same locale-completion function used by Tokyo" (§"Explicit invocation and preview"; Code work §5) — does not exist as a reusable function.** Grounded in §1: the only completion logic is the module-private `indexHtmlWithLocaleContext` in `tokyo-worker/src/routes/clk-live-routes.ts:128-150`, which Roma cannot import (different package, not exported, and Roma does not depend on tokyo-worker). The PRD presents reuse as a fact; in reality the executor must (a) extract `indexHtmlWithLocaleContext` + `LOCALE_CONTEXT_MARKER` + `inlineJson` into a shared workspace package, (b) generalize the single-instance `{locale, baseLocale, values, languages}` shape to a Page shape that includes per-placement overlay slices and Page-owned values, and (c) wire both Roma-preview and Tokyo-serving to it. Step (b) is a real design, not a reuse. Calling it "the same function" sets up the executor to either skip the generalization (preview and serving diverge → V7) or to over-couple Roma and Tokyo (strains Tenet 11's "public serving reads stored artifacts only" if the shared module pulls in any Roma-side concern). The PRD must name the shared package, the generalized input type, and the single-instance → multi-placement generalization explicitly. Sharing across the Roma/Tokyo boundary is clean *only if* the function is pure and depends on no service/runtime import — the current function satisfies that, so this is achievable, but the PRD must say so.

- **"Page-level structured data derived from declared Page fields" (§3) — which fields? what schema?** Unanswerable from the PRD. `PageOwnedValues` (127A) is the only field set. See §3b.

- **"supported Page-level structured data" / "supported Page structured data" (§3) — what is "supported"?** Undefined. Either it is the empty set (no widget owns a contribution; see §3b) or it is a fixed vocabulary the PRD does not name. An executor must be told: emit no structured data in 127B unless `PageOwnedValues` maps to a named schema.

- **The `overlays.json` key contract `page.title`, `page.description`, `placements.{placementId}.{instanceFieldPath}` (§6) — `{instanceFieldPath}` is not defined.** See §2: the codebase has two path vocabularies (editable-field declaration `items[].title` vs. concrete runtime path `items.0.title`), and `applyExactOverlay` (`runtime.ts:88-134`) rejects `[`,`]`,`*`. The PRD must pin `{instanceFieldPath}` to the concrete grammar and reference the validator. Without that, an executor will use the editable-fields form and break runtime overlay application.

- **"read locale values from the Page response context supplied by Tokyo" (§5, runtime.js step) — what is the response context shape?** Undefined. Today the runtime reads `window.CK_LOCALE_CONTEXT` (`runtime.ts:136`), a single object `{locale, baseLocale, values, languages}`. A Page needs a richer context: the selected locale, the base locale, the language list, Page-owned values, and per-placement value maps. The PRD never defines this Page-level context shape, so an executor must invent it — and if they invent it independently of the `overlays.json` key contract, the two will not line up. Pin the context shape to the `overlays.json` entry shape (one entry per locale, with `page.*` and `placements.{placementId}.*` keys) and specify that the completion function injects that entry as the `CK_LOCALE_CONTEXT` payload.

- **"Page Builder may keep showing the last successfully compiled preview but must identify it as not reflecting the unsaved draft" (§"Explicit invocation and preview") — leaks 127E UI state into the 127B compiler contract.** The compiler produces files; "identify it as not reflecting the unsaved draft" is a UI affordance owned by 127E (Roma Pages and Page Builder). Stating it inside 127B invites the executor to add a staleness flag to the compiler result, which is wrong (the compiler is pure and does not know about drafts). Move this sentence to 127E and keep 127B's boundary at: "preview reads the last complete package produced by explicit Save/Update page."

- **"The materializer must identify reusable modules and per-placement initialization explicitly" (§5) — correct directive, no contract.** This is the right instinct (distinguish shared module bytes from per-placement init) but it does not define how the materializer *marks* the distinction. The existing chunk markers (`/* ck-runtime-module:{id} */` and `/* ck-style-module:{id} */`, `runtime.ts:23-29`) are the obvious mechanism: shared modules get one chunk per canonical key; per-placement init gets a new chunk kind (e.g. `/* ck-runtime-placement:{placementId} */`). The PRD should name the marker scheme so the executor does not invent a parallel one.

- **"Build tooling may perform its normal production minification after the deterministic source result is correct" (§4) — harmless but ambiguous about ordering.** If minification runs after compilation, the stored package bytes are the minified ones, and the fingerprint must be over the minified bytes (otherwise the fingerprint does not match what Tokyo stores and 127D currency derivation breaks). The PRD should say: fingerprint the exact bytes Roma submits to Tokyo, whatever those bytes are.

#### 5. Needed documentation / updates (DEV perspective)

127B's own "Required documentation after deployment" list is too short and mis-locates the materializer contract. Concrete updates needed, from a dev/implementer perspective:

- **`documentation/services/bob.md` — currently the only place the runtime-materializer contract is documented** (see "Editor Artifact Build": "Roma's server-only materializer reads a separate build artifact"). 127B changes the materializer's surface (new contribution operation, new chunk markers). This file **must** be updated, not conditionally ("only if the contribution boundary changes a current Bob/materializer statement" — it does). Add: the contribution operation signature, the placement-keyed root stamping, and the rule that standalone widget output is unchanged.

- **New file: the materializer contract needs its own doc.** Today the materializer is documented only inside `bob.md` and its package `README.md` (`packages/ck-runtime-materializer/README.md`, which says "Pure builder for the one public root artifact of a saved widget instance" — singular). 127B breaks the "one root artifact" framing. Either rewrite the README to cover both standalone-instance and Page-contribution operations, or — better, per the documentation discipline in `AGENTS.md` ("Detail docs own surface-specific behavior") — create `documentation/architecture/RuntimeMaterializer.md` owning: (a) the standalone-instance contract (current), (b) the new `PageInstanceContribution` contract (input, output, root-stamping rule, dedup-by-key rule, per-placement payload rule), (c) the reusable-vs-not function split, (d) the contract version bump.

- **New contract home for the shared locale-completion function.** It currently lives as private code in `tokyo-worker/src/routes/clk-live-routes.ts`. After 127B it must be a shared pure function imported by both Roma (preview) and Tokyo-worker (serving). Document it in: `documentation/architecture/OverlayArchitecture.md` (the natural home, since that doc already owns the `CK_LOCALE_CONTEXT` marker injection rule and the "one root runtime + one exact locale overlay" model) — add a "Page locale completion" section with the generalized Page input shape, the per-placement value-splitting rule, and the Roma/Tokyo sharing boundary. Also update `documentation/services/tokyo-worker.md` "Public Serving" to reference the shared function instead of implying Tokyo owns it privately.

- **`documentation/architecture/OverlayArchitecture.md` — must be updated to flag the `overlays.json` divergence.** This file currently states "There is no instance-level locale artifact subtree" and mandates per-locale files. A Page uses one aggregated `overlays.json`. Add a "Page package overlay shape" section that explicitly distinguishes the Page aggregated file from the instance per-locale file model and defines the `placements.{placementId}.{instanceFieldPath}` key contract, pinning `{instanceFieldPath}` to the concrete path grammar enforced by `applyExactOverlay` (`runtime.ts:88-134`).

- **`documentation/architecture/CONTEXT.md` — update the Storage Shapes block.** It currently shows `pages/{pageId}/source.json` + `serve-state.json` + `index.html/styles.css/runtime.js` flat. The Mama §3 introduces `packages/{packageFingerprint}/{index.html,styles.css,runtime.js,overlays.json}`. CONTEXT.md must reflect the fingerprinted package subpath and the four-file Page package. (This is shared with 127C, but 127B defines the four files, so 127B owns the doc update for the file set.)

- **`documentation/services/roma.md` — update "Pages Domain" and add a "Page Compiler" subsection.** Currently the Pages Domain section states "Any shift to generated child artifact coordinates, child evidence, or page package materialization belongs to a future Page Package PRD." That future PRD is now 127B/127C. Roma.md must document: the compiler is Roma-invoked, pure, and triggered only by Save/Update; Roma reads all inputs first; the compiler returns four files + evidence; preview uses the selected package.

- **`documentation/widgets/README.md` — "Generated Package Dependency Rule" section.** It currently describes only the standalone widget package. Add the Page-contribution dependency rule: a Page contribution reuses widget-local `widget.html`/`widget.css`/`widget.client.js` and selected shared modules, deduped by canonical key, with per-placement root stamping. This keeps widget authors aware that their widget must remain compose-able.

- **`documentation/widgets/shared/ShellCore.md` — add the composed-page marker to the DOM shape.** The DOM Shape section currently shows one `[data-role="root"][data-ck-widget=...]`. Document that Page compilation wraps placements under `<main data-ck-page="...">` (127B §3) and that the shared runtime keys placement state by `data-ck-instance-id` and treats `[data-ck-composed-page="true"]` as the composed-page signal (already implemented in `shared/runtime.js:52-65`, undocumented here).

- **Docs 127B lists that may not need changing:**
  - `documentation/architecture/Tenets.md` — no tenet changes from 127B; the compiler is a new mechanism under existing tenets. Skip unless a tenet needs a Page-specific clause.
  - The Mama §14 doc list includes `documentation/capabilities/localization.md` and `multitenancy.md` — those are 127A/F concerns (Page source, tiers); 127B does not change localization capability or multi-tenancy. Defer.

- **Docs 127B missed:**
  - `packages/ck-runtime-materializer/README.md` (package-local contract — must be rewritten; see above).
  - `documentation/widgets/shared/ShellUtilities.md` — owns the locale switcher; if Page-level locale switching reuses the shared `CKLocaleSwitcher`, document how it reads the Page-level `CK_LOCALE_POLICY`/`CK_LOCALE_CONTEXT` vs. the per-instance payload. (This is a real gap: `runtime.ts:169-172` sets a global `window.CK_LOCALE_POLICY` from the single payload; a Page must set it once at Page level, not per-placement.)
  - `documentation/architecture/RuntimeProfiles.md` (in the Mama's §14 list but not 127B's) — if it documents runtime artifact profiles, the Page package is a new profile and should be added.

**Verdict: APPROVE WITH CHANGES — the slice's architecture is sound and the four-file pure-compiler model is right, but "extend the materializer" and "reuse Tokyo's locale-completion function" are presented as extensions when the code shows they are surgery on a hard-single-instance substrate, and the `overlays.json`/`{instanceFieldPath}` contract is too underspecified for an executor to implement without inventing the path grammar and the per-placement runtime-keying model.**

---

## 2. Senior Product Manager Peer Review

### 127B — Senior Product Manager Peer Review (GLM)

#### 1. Elegant product UX and scalability

The genuinely elegant core of 127B is that **a Page becomes one real document, not a stack of embeds.** That single decision cascades into a string of good product consequences for the customer:

- **One compiled page, not N embeds.** 127B's "Why this slice exists" (lines 24-32) is the strongest product paragraph in the PRD: it names the failure mode customers would actually feel — "the browser downloads repeated HTML, CSS, and JavaScript, crawlers see fragmented content, and Page metadata cannot describe one coherent document." The four-file output (`index.html`, `styles.css`, `runtime.js`, `overlays.json`) means a customer's Page loads like a hand-built site, not a Frankenstein of widget iframes. That is the right product instinct and it scales: more widgets, more locales, more tiers all fold into the same one-document shape.

- **Preview = publish artifact, so there is no drift.** This is the most important elegance. Mama line 190 ("Roma uses the same compiler result for preview and publication; there is no second Page renderer") and 127B lines 291-293 ("Page Builder asks the same locale-completion function used by Tokyo to produce preview HTML from the selected complete package") make the preview and the public page the *same bytes*. A customer never sees a preview that lies about what will go live. In a world where most CMS preview/publish drift is the #1 source of trust loss, this is the correct call.

- **Explicit Save / Update invocation; the customer controls when the heavy work happens.** Compilation is gated behind a human command (lines 20-21, 282-289). This makes the cost model legible: the system never burns cycles, never surprises the user with a spinner, never races a publish against a half-finished compile. The determinism guarantee ("two runs over the same input are byte-identical," line 337) reinforces this — the user gets predictable, repeatable output.

- **The locale-completion pure function shared by preview and serving.** Line 308-309 ("Add locale completion as a pure function shared by preview and later Tokyo serving where the runtime boundary permits; do not duplicate the rules") is a quietly excellent decision. It means the locale rules cannot drift between what the customer previews and what the visitor gets. It also scales cleanly: every new locale the account enables flows through the same function.

- **Failures are coordinate-precise, not silent.** The failure shape (lines 99-106) names `placementId`, `instanceId`, `locale`, and `paths`. A missing overlay "blocks compilation instead of silently dropping a placement or falling back to another locale" (lines 44-45). This is product-truth fidelity at the compiler boundary, and it scales: more locales and more placements mean more failure surface, but every failure stays attributable.

**What does NOT scale well for real customers:**

- **Preview-only-after-Save is the wrong authoring rhythm for a Page builder.** The PRD states (lines 293-298): "While Page edits are unsaved, Page Builder may keep showing the last successfully compiled preview but must identify it as not reflecting the unsaved draft. There is no continuously compiled draft preview." The most common Page-authoring action — reordering placements, renaming the page, editing the description, toggling a locale — produces **zero visible feedback** until Save. This is especially painful for **placement reordering**, which is purely Page-owned truth (no dependency change) and is inherently visual. A customer who drags widget C above widget A and sees nothing change will assume the product is broken. Compare this to Bob, which *streams unsaved state into the preview live* (bob.md lines 501-524). The asymmetry is inverted from customer expectation: the simpler surface (one widget) gets live preview; the more complex surface (a whole page) gets a stale screenshot with a banner. That is a real scaling problem as Pages grow to 3-10 placements.

- **The "must identify it as not reflecting the unsaved draft" model is UX-truthy but under-specified.** The PRD mandates identification but never defines the customer-facing treatment. Is it a persistent banner? A dimmed preview? A timestamp? Every option has a cost: a persistent banner trains the user to ignore it; a dimmed preview implies the preview is *wrong* rather than *stale*; a timestamp leaks compile-time technicality. This is the single highest-UX-weight decision in 127B and it is left entirely to 127E. As a compiler-invocation-gate decision, it deserves a product-truth anchor here.

- **Preview freshness depends on a concept ("last successfully compiled preview") the customer has no mental model for.** On first open of a fresh draft there is no preview at all (line 294: "Before the first Save, no compiled preview exists"). After Save, the preview is a snapshot. After a dependency change, the snapshot goes further stale. The customer is being asked to maintain a three-state mental model (no preview / fresh preview / stale preview) that the product does not surface concretely.

#### 2. Compliance with product UX best practices

**Where 127B excels:**

- **Predictability of preview.** Best-practice SaaS preview is "what you see is what you get." 127B delivers the strongest possible version of this: preview bytes === publish bytes, deterministically (Mama line 190; 127B lines 337, 277). No modern builder achieves this more cleanly.

- **Honest failure, no silent healing.** The failure table (lines 360-368) maps each failure to an exact, attributable result with no partial files, no fallback locale, no omission. This satisfies the V1-V8 discipline (AGENTS.md lines 234-248) at the compiler boundary and matches the "fail-visible behavior instead of silent fallback" tenet (WhyClickeen.md line 64).

- **Source-truth fidelity at the boundary.** A missing overlay "fails; never substitute another locale" (lines 264-265, 365). This is correct product law and correct UX: a customer who forgot to author the `fr` overlay learns it at compile time, not at visitor-404 time.

**Where 127B falls short:**

- **The save-before-see rhythm is a legacy-CMS pattern, not a modern builder pattern.** Webflow, Framer, Figma, and even Clickeen's own Bob all preview unsaved edits. 127B consciously rejects this (lines 296-298: "There is no continuously compiled draft preview"). For a *compiler slice* this is defensible — you do not want a hot compiler in the edit loop. But the PRD does not even acknowledge the UX cost or name an alternative (e.g., a debounced lightweight preview for Page-owned fields only, or live preview for placement reorder specifically). A senior PM would expect at least a sentence saying "we accept stale-draft preview as a tradeoff for X" — instead the tradeoff is implicit.

- **Compile-failure surfacing is structurally weak.** The failure type (lines 99-106) uses `reason: string` alongside structured fields. Best-practice failure UX needs a **reason-key taxonomy** (the way Bob/San Francisco use `reasonKey`, bob.md lines 184, 207, 234) so downstream UI can map to localized, user-friendly copy. A bare `reason: string` invites technical leak ("CSS/runtime contribution cannot be isolated" — line 367 — is not customer copy) and gives 127E no contract to render against. This is a compiler-level decision with direct downstream UX weight.

- **No relationship is defined between Page Builder field edits and preview freshness beyond "stale."** The PRD treats all unsaved edits identically: a typo in the title and a full placement reorder both produce the same "not reflecting the unsaved draft" state. Best practice would tier the staleness: metadata edits (title/description) could plausibly update a lightweight header preview; placement reorders could update a structural preview. 127B forecloses all of this by gating the compiler monolithically. That is a product-truth decision, not just a UI decision, and it lives in 127B.

- **The `save_failed` vs `out_of_date` distinction is correct product law but heavy for the user.** Mama lines 325-336 define two failure flavors and a blocking modal. 127B inherits this. Best practice would make the *recovery path* from a compile failure obvious and inline ("Fix the missing fr overlay" with a deep link). 127B's failure shape does not carry enough structure to drive that — it carries a coordinate, not a remediation. That is acceptable for a compiler slice but worth flagging as a downstream constraint.

#### 3. Bad UX writing for the user (if present)

127B is mostly internal contract, so the leak surface is small, but several items would reach a customer via Page Builder, failure messages, or preview states:

- **"Not reflecting the unsaved draft" is internal-contract language, not customer copy.** Line 295 uses this phrase as the *spec* for the preview-staleness treatment. If it leaks verbatim it is jargon-heavy and confusing — a customer does not think of their work as "the unsaved draft," they think of it as "my edits." The PRD should anchor the customer-facing label here (e.g., "Preview shows your last saved version") rather than leaving it to 127E to invent.

- **"Update page" vs "Save" is a genuine customer comprehension risk.** Mama lines 70-79 and 127B lines 284-289 lean on this distinction: Save = my Page-authored changes; Update page = incorporate dependency (Instance/overlay) changes. To a customer, both verbs mean "make my page current." The Mama even acknowledges the confusion is real by dedicating Section 7 to it. A customer who edited the page title *and* had a widget change underneath will not know which button to press — and pressing Save when Update is required leaves the page `out_of_date` (Mama line 292). 127B does not own this verb choice (127E does), but 127B's invocation gate is what *forces* two verbs to exist. A compiler that could be invoked from a single "Save and refresh" action would eliminate the ambiguity. Worth flagging as a compiler-gate-driven UX cost.

- **`reason: string` in the failure type (line 101) is a technical-leak vector.** Lines 362-368 enumerate compiler-internal failure conditions ("CSS/runtime contribution cannot be isolated," "SEO metadata contradicts the supported source contract") that read like engineer notes, not customer copy. Without a reason-key discipline, these strings will leak into toast/banner UI. Bob and San Francisco already enforce `reasonKey` for exactly this reason (roma.md lines 519-524). 127B should match that discipline.

- **"Overlays.json is compiled server input for Tokyo, not a browser content API" (line 246)** is good internal clarity and will not leak, so no action needed — but it does signal a concept (`overlays.json`) that customers never see, which is correct.

- **The relationship between Instance save and Page staleness is invisible to the customer.** 127B reinforces (via the invocation gate) that saving a widget Instance never recompiles any Page. From the customer's view, they edited a widget, saved it, went back to their Page, and the Page now says "Needs update." The cause-and-effect is not surfaced anywhere in 127B's contract. This is acceptable for a compiler slice, but the failure-shape could carry a hint of *why* the page is stale (which dependency changed), and currently it does not.

#### 4. How this PRD aligns with Clickeen being different from legacy SaaS (product perspective)

**Where 127B leans INTO the agent-operated thesis:**

- **The deterministic single-compiler model is a native expression of the schema-first, source-truth-fidelity premise.** AGENTS.md (lines 46-48) names "widget specs, control/field maps, the overlay model, markers, product-law ownership boundaries" as the substrate. 127B operates exactly that substrate: it reads structured source, applies the existing overlay model (lines 152-161), and emits deterministic derived output without inventing state. WhyClickeen.md line 64 ("fail-visible behavior instead of silent fallback") and line 65 ("Cloudflare-backed serving of stored artifacts") are both honored. This *feels* like the product Clickeen claims to be.

- **The pure-callable compiler with no side effects (lines 62-64: "The compiler does not call Roma, Tokyo, R2, Bob, San Francisco, Translation Agent, or a public Widget URL") is maximally agent-friendly at the technical level.** An agent *could* call this function. The substrate is operable.

**Where 127B drifts toward legacy patterns:**

- **The explicit-invocation gate is human-button-only, and that is a real drift from "agents are the operators."** AGENTS.md line 9-10 states the premise: "Agents are the operators — they know what to do, where, and how, and they execute operations." WhyClickeen.md lines 175-186 says success means "agents can create, publish, localize, inspect, repair, and verify artifacts through named authorities" and "operate without... requiring humans to drive UI-only workflows." Yet 127B lines 20-21 and 282-289 restrict compiler invocation to "an explicit customer Save or Update page command." There is **no agent-operated seam** for compilation. A Product Copilot helping a customer build a Page cannot trigger a compile. A Translation Agent that updates an Instance overlay cannot trigger the Page to recompile — the customer must manually find the Page and click "Update page" (Mama lines 306-310). That is precisely the "humans drive UI-only workflows" pattern Clickeen claims to invert.

- **"Click Update" is a legacy-CMS pattern.** The Mama's Section 7 framing — a Page goes `out_of_date`, the customer must react manually, a blocking modal interrupts editing (Mama lines 312-323) — is textbook WordPress/Squarespace "your plugin updated, click Update." For an agent-operated product, the more native expression would be: an agent observes the dependency drift and either (a) recompiles within product-law authority (Instance overlays are agent-generated content, so AGENTS.md lines 75-77 already grant autonomous operation rights), or (b) surfaces the drift through Agent Activity (CONTEXT.md lines 87-95) and offers to update. 127B forecloses both by hard-gating invocation to a human command.

- **The drift is in the product rule, not the architecture — which makes it cheap to fix.** The compiler is already a pure callable (line 281). The agent seam would be a product-rule change ("a Translation Agent that just wrote an Instance overlay may invoke Update page through Roma"), not an architectural one. 127B should at least *name* this as a deliberate scope boundary and flag it for a future agent-operated path, rather than silently locking compilation behind a human button. Right now 127B reads as if human-button-gating is the *desired* end state, which undermines the thesis.

**Net:** 127B's compiler is agent-native; 127B's invocation rule is legacy-CMS. The slice is half-aligned with the Clickeen thesis, and the misaligned half is the product rule, not the code.

#### 5. Needed documentation / updates (vision, architecture, system perspective)

127B's own "Required documentation after deployment" list (lines 380-387) is too narrow — it lists `CONTEXT.md`, `OverlayArchitecture.md`, `roma.md`, `bob.md` (conditional), and "the current runtime materializer contract documentation." A senior PM review flags the following omissions:

- **`documentation/capabilities/localization.md`** — Currently instance-only: its authority chain (lines 33-41) and overlay contract (lines 90-115) describe *only* `instances/{instanceId}/overlays/locales/{locale}.json`. 127B introduces **`overlays.json` as a compiled Page-level locale-value file** (lines 244-265) — a *new* localization artifact with a different shape (`page.title`, `placements.{placementId}.{instanceFieldPath}`). localization.md must tell the Page overlay + compiled-overlays.json story or it will be silently incomplete. 127B omits this file from its update list; that is a real gap.

- **`documentation/architecture/OverlayArchitecture.md`** — Same issue, deeper. Its "Product Rule" (lines 6-9) is "one root runtime + one exact locale overlay = localized rendering" for an *instance*. Pages add a *compiled* overlay aggregation that is neither a root runtime nor a per-instance overlay. OverlayArchitecture.md must distinguish the instance overlay model from the Page compiled-overlay model, or the architecture doc will contradict deployed behavior.

- **`documentation/strategy/WhyClickeen.md`** — Mentions "widgets to pages" only in passing (lines 36, 97, 114) and treats widgets as "the wedge" (lines 84-94) without reflecting **Pages-as-composed-surface** — the fact that a Page is now a real compiled document, not embeds. The compiler is the product proof that Pages are a first-class content surface, not just a widget container. WhyClickeen should reflect this or it undersells what 127B delivers.

- **A `documentation/capabilities/pages.md` capability doc does not exist.** Capabilities today are `localization.md`, `multitenancy.md`, `seo-geo.md`, `supernova.md`. Pages are now a product capability with their own compiler, currency model, and serving path. A PM would expect a `pages.md` capability doc to own the Page product contract the way `localization.md` owns localization. Neither 127B nor the Mama's doc list (Mama lines 668-679) proposes one. This is the largest doc-ownership omission in the program.

- **`documentation/capabilities/seo-geo.md`** — 127B produces canonical, hreflang, `x-default`, social metadata, and supported structured data (lines 196-214). Mama Section 6 explicitly ties this to SEO/GEO/AEO outcomes (lines 256-273). seo-geo.md currently has no Page-compiler story. It needs one.

- **`documentation/architecture/Tenets.md`** — Lines 268-270 still state "Page publish and page public serving are currently unavailable until Roma writes page packages." 127B is the slice that makes Roma a page-package writer. Tenets must update after 127B (or, more precisely, after 127C, but the compiler is the enabling capability and should be flagged now).

- **`documentation/architecture/Overview.md`** — Lines 81 and 224-226 still say page public serving returns `404` and publish is unavailable. Same flag as Tenets.

- **`documentation/architecture/CONTEXT.md`** — "Product Flows > Clickeen Pages" point 4 (line 295) says "Page publish and public page serving are currently disabled because Roma does not currently write page packages." 127B is the slice that changes this fact. 127B does list CONTEXT.md (line 382) but only generically — the Page-flow bullets need the compiler story.

- **The runtime materializer contract documentation has no home in `documentation/`.** 127B lines 318-321 and 386-387 reference `packages/ck-runtime-materializer/**` and "the current runtime materializer contract documentation," but the only materializer docs live under `Execution_Pipeline_Docs/03-Executed/124__Overlay_Aware_Runtime_Materializer/` (execution history, not current-truth docs). AGENTS.md line 265 ("PRDs, migrations, and service docs own history and execution detail") and line 263 ("Detail docs own surface-specific behavior") imply the materializer needs a current-truth detail doc. 127B's contribution boundary (`PageInstanceContribution`, lines 122-129) is a new contract that deserves a current-truth home, not just an execution-pipeline note.

- **No widget-doc update is listed, but the Page contribution changes the widget surface contract.** `documentation/widgets/README.md` (lines 7, 13, 27-30) describes Pages as stacks of instances. 127B introduces the concept that a widget instance now has a *Page contribution* shape (`html`, `css[]`, `javascript[]`, `baseValues`, `overlays`) distinct from its standalone package. Widget authors should know their widget can be composed into a Page. Neither 127B nor the Mama flags the widget docs.

**Verdict: APPROVE WITH CHANGES — The compiler design and preview-equals-publish decision are excellent and product-correct, but 127B must (1) replace `reason: string` with a reason-key taxonomy to prevent technical leak, (2) anchor the customer-facing treatment of the stale-draft preview and the Save-vs-Update verb distinction rather than leaving them unspecified, and (3) name the human-only invocation gate as a deliberate scope boundary against the agent-operated thesis rather than silently locking compilation behind a button.**

---

## 3. Principal TPM Peer Review

### 127B — Principal TPM Peer Review (GLM)

Reviewer: Principal Technical Program Manager
Scope: PRD 127B "Page Compiler", second execution slice of the Clickeen Pages program
Grounding: Real source under `packages/ck-runtime-materializer/`, `packages/widget-shell/`, `tokyo-worker/src/routes/clk-live-routes.ts`, `roma/lib/account-page-*.ts`, `tokyo-worker/src/domains/pages/**`, `tokyo-worker/src/routes/internal-page-routes.ts`, and `tokyo/product/widgets/shared/runtime.js`.

#### 1. Cohesive and cost-effective architecture

**The pure-callable decision is correct and cohesive.** 127B defines the compiler as "a pure callable operation" that "performs no storage, publication, cache, network, or agent work" (`127B__PRD__Page_Compiler.md` §Goal, §Code work item 1: "do not create a service"). This is the right shape: it matches the existing materializer's `materializeRuntimePackage` (`packages/ck-runtime-materializer/src/materialize.ts:104`), which is already proven to be a pure, storage-free, model-free builder whose test contract forbids `roma/`, `tokyo-worker`, `next/`, `@cloudflare`, `process.env`, and `node:crypto` imports (`tests/run-runtime-materializer-contract.ts:45-67`). Keeping the compiler in the same purity class is cohesive and minimizes new infrastructure to zero — no new Worker, Queue, KV, or service.

**The single-renderer-for-preview-and-publish decision is cohesive.** §"Explicit invocation and preview" makes the same compiled package drive both Page Builder preview and 127C publication. This is a genuine cost saving: it forecloses a second HTML renderer and the divergence risk that comes with it. The Mama reinforces this at tenet 6 ("Publish makes that already-current package public. It does not run the compiler") and §5 ("Roma uses the same compiler result for preview and publication; there is no second Page renderer").

**The four-file output contract is cohesive and storage-aligned.** `index.html`, `styles.css`, `runtime.js`, `overlays.json` maps cleanly onto the existing standalone-instance three-file contract plus one new server-side locale-input file, and onto the storage shape the Mama §3 and 127C §"Public and storage names" both stake out (`accounts/{accountPublicId}/pages/{pageId}/packages/{packageFingerprint}/...`). The `overlays.json` framing as "compiled server input for Tokyo, not a browser content API" (127B §6) is the correct call — it keeps the browser contract identical to standalone widgets (root runtime + injected context) and avoids inventing a browser-side overlay fetch, which would violate Tenet 11.

**The evidence/fingerprint shape is cost-effective and reusable.** 127B's `PageCompilerResult.evidence` (pageRevision, pageOverlayFingerprints, instanceRevisions with per-placement source/overlay fingerprints, compilerContractVersion, packageFingerprint, per-file fingerprints) is exactly what 127C's `PageServeState.package` consumes and what 127D will derive `current | out_of_date | save_failed` from. This is one contract doing triple duty (install selection, cache identity, currency derivation) — high cohesion, low new-surface cost.

**COST RISK — the Instance-contribution abstraction is NOT free; it is a real refactor, and 127B understates it.** 127B §"The Instance contribution" says: "Extend the existing runtime materializer with one reusable in-memory operation" and frames it as "refactor … only enough to expose the reusable Instance contribution while preserving standalone output." The actual materializer code does not support this today. Inspecting `materialize.ts`:
- `buildPackage` (lines 50-102) is welded to standalone output: it calls `buildIndexHtml` (line 90) which emits a full `<!doctype html>` document with `<html lang>`, `<head>`, `<title>`, a `<script>window.CK_LOCALE_CONTEXT = null;</script>` marker, and support-file URLs hard-stamped to `publicPackagePath` = `/{accountPublicId}/{instanceId}` (`materialize.ts:36-38`, `html.ts:100-122`).
- `stampPackageRoot` (`html.ts:55-98`) enforces "exactly one top-level root" and bakes `data-ck-instance-id` onto it; it does not understand a `placementId`.
- The CSS chunk logic (`runtime.ts:37-64` `buildStyles`) and runtime-module logic (`runtime.ts:66-216` `buildRuntime`) emit one widget's modules with no deduplication set across N instances — there is no `PageInstanceContribution` shape, no `html/css[]/javascript[]/baseValues/overlays` return, and the exported surface (`src/index.ts`) exports only `materializeRuntimePackage` + types.

So 127B's own guardrail — "If the existing materializer cannot expose a contribution without changing standalone Widget behavior, execution stops and returns to the product owner" (§"The Instance contribution") — is the operative path, not a contingency. The PRD should be honest that this is a non-trivial extraction of `extractBody` + `buildStyles` + `buildRuntime` into a contribution-first shape, after which `materializeRuntimePackage` becomes a thin wrapper that wraps one contribution in a standalone document. The cost is justified (it is the only way to get dedup across instances), but the §Code-work framing ("refactor … only enough") undersells it and risks an executor hitting the stop condition late.

**COST RISK — recompilation on each Save/Update.** Recompilation is bounded by explicit invocation only (§"Explicit invocation and preview"), which is the correct cost control: draft edits, instance saves, overlay writes, and public requests never invoke the compiler. The compute cost per Save is one materialization per placement plus dedup — cheap and deterministic. No concern here.

**COST RISK — the locale-completion function crossing the Roma/Tokyo boundary.** 127B §Code work item 5 says "Add locale completion as a pure function shared by preview and later Tokyo serving where the runtime boundary permits; do not duplicate the rules." This is the single biggest cohesion risk in the slice and is analyzed in detail in §2 below. The function today (`tokyo-worker/src/routes/clk-live-routes.ts:119-150`, `indexHtmlWithLocaleContext`) is a private function inside the public route file, coupled to R2 reads and `Response` construction — it is not pure, not exported, and not in a shared package. Sharing it across Roma-preview and Tokyo-serving is not "add a pure function"; it is "extract, purify, and re-home." See §2.

**COST RISK — aggregated `overlays.json` read cost on the public path.** 127C §"Completing exact locale HTML" step 4 reads "the exact locale entry from compiled `overlays.json`" on every exact-locale cache miss. This is a single R2 read of one JSON file containing all selected locales for the page (127B §6 keys like `page.title`, `placements.{placementId}.{fieldPath}`). For a page with K placements and L locales, this is one bounded JSON, not K×L reads — defensible. The cost is comparable to the standalone path, which reads one `overlays/locales/{locale}.json` per instance per locale request. The page path is actually cheaper per locale miss (one read vs N reads). No concern, but the doc should state the size bound explicitly.

**HOISTING RISK — compiler living in Roma vs a shared package.** 127B §Code work item 1 leaves the home open: "a small Page compiler module owned by Roma or an existing shared package used by Roma." This is a blast-radius decision the PRD defers to the executor. The materializer is a workspace package (`@clickeen/ck-runtime-materializer`) consumed by Roma (`roma/lib/account-instance-public-package.ts:7`) and tested in isolation. Putting the Page compiler directly inside `roma/lib/` couples a deterministic, pure, fixture-testable artifact to the Next.js edge app and makes it harder for 127C's Tokyo locale-completion to share the contract cleanly. Recommendation: the compiler belongs in a workspace package (e.g., `@clickeen/ck-page-compiler`, or fold into the materializer package) so Roma, the materializer contribution, and the shared locale-completion function all import it without crossing the Roma/Tokyo runtime boundary. The PRD should not leave this to executor discretion; it should name the home.

#### 2. Clarity on systems — systems that talk to each other and don't invent subsystems

**Boundary map as designed by 127B:**

| Conversation | Caller → Callee | Named authorities | Invent subsystem? |
| --- | --- | --- | --- |
| Who calls the compiler | Roma (Save/Update only) → Page Compiler module | Roma = account/product authority (Tenet 2); Compiler = pure callable | No — module, not service |
| Who owns the Instance contribution | Materializer → exposes `PageInstanceContribution` | Materializer = widget-runtime authority | No, but today's code does not expose it (see §1) |
| Who owns locale completion | "shared function" between Roma-preview and Tokyo-serving | UNDEFINED PACKAGE | **AMBIGUOUS — see below** |
| How preview gets HTML | Roma → Compiler → locale-completion → preview HTML | Roma + Compiler | Path is right; the locale-completion home is fuzzy |
| How 127C consumes the files | Roma Save → Compiler result → Tokyo install | Roma, Tokyo-worker | Clean; 127C §"Save and package install" traces it |

**The compiler-is-a-module boundary is clean and confirmed.** 127B is explicit and consistent: "a pure callable operation" (§Explicit invocation), "do not create a service" (§Code work item 1), "It does not save Page source, write to R2, publish, purge caches, call an agent, or make a public request" (Mama §5). The compiler consumes only the plain input object described in §"What the compiler receives" and returns the `PageCompilerResult`. No hidden subsystem here. This matches the materializer's existing purity contract.

**The Instance-contribution boundary is correctly assigned to the materializer but not yet real.** 127B §"The Instance contribution" assigns ownership unambiguously: "Extend the existing runtime materializer with one reusable in-memory operation." That is the right owner — the materializer already owns Widget package parsing, root stamping, styles, runtime modules, field paths, and validation (`materialize.ts`, `runtime.ts`, `html.ts`, `files.ts`). Confirmed: no other system parses widget packages. But as shown in §1, the current materializer cannot emit a contribution without changing standalone output — the contribution abstraction is a net-new extraction, and the boundary is currently aspirational, not operational. The PRD's stop-condition ("execution stops and returns to the product owner") is the correct escape valve, but the boundary should be marked "to be proven" rather than "extend."

**THE LOCALE-COMPLETION BOUNDARY IS FUZZY AND IS THE ONE PLACE 127B COULD BE READ AS CREATING A HIDDEN SUBSYSTEM.** This is the central boundary-clarity finding.

127B §Code work item 5: "Add locale completion as a pure function shared by preview and later Tokyo serving where the runtime boundary permits; do not duplicate the rules."

127B §"Explicit invocation and preview": "Page Builder asks the same locale-completion function used by Tokyo to produce preview HTML from the selected complete package."

127C §"Completing exact locale HTML" step 5: "applies those values to the compiled document using the locale-completion contract from 127B."

So three statements, two PRDs, and two runtime surfaces (Roma preview inside Cloudflare Pages/Next.js edge; Tokyo-worker public serving inside a Cloudflare Worker) all assume ONE locale-completion function. Now inspect what exists today:

`tokyo-worker/src/routes/clk-live-routes.ts:119-150`:
```js
const LOCALE_CONTEXT_MARKER = 'window.CK_LOCALE_CONTEXT = null;';
function indexHtmlWithLocaleContext(args: { html; locale; baseLocale; values; languages }): string | null {
  const markerStart = args.html.indexOf(LOCALE_CONTEXT_MARKER);
  if (markerStart < 0 || markerStart !== args.html.lastIndexOf(LOCALE_CONTEXT_MARKER)) return null;
  const htmlTag = /<html lang="[^"]*">/;
  if (!htmlTag.test(args.html)) return null;
  return args.html
    .replace(htmlTag, `<html lang="${args.locale}">`)
    .replace(LOCALE_CONTEXT_MARKER, `window.CK_LOCALE_CONTEXT = ${inlineJson({...})};`);
}
```

This is a private, non-exported function living inside the public route file. It is pure in the narrow sense (string in, string out) but it is not in a shared package, and the surrounding `tryHandleClkLiveStaticRoutes` couples locale completion to R2 reads (`readAccountInstanceTranslatedLocaleValues`, line 228), `Response` construction, and the standalone-instance coordinate (`accounts/{accountId}/instances/{instanceId}/...`). Critically, the page path and the instance path are NOT the same completion problem:

- **Instance locale completion** (today): one root runtime, one overlay file per locale at `overlays/locales/{locale}.json`, marker replacement, `no-store`.
- **Page locale completion** (127B/127C): one compiled `index.html`, one aggregated `overlays.json` with per-placement keys (`placements.{placementId}.{fieldPath}`), and the runtime must apply per-placement values — but the page runtime payload is keyed differently than the standalone instance payload.

The 127B §6 `overlays.json` key shape (`page.title`, `placements.{placementId}.{instanceFieldPath}`) is a NEW key scheme that does not exist in the standalone overlay contract (`OverlayArchitecture.md`: `values: { "[field path]": "[translated value]" }`). The standalone runtime payload (`runtime.ts:78-82`) keys state by `instanceId` and applies one flat overlay keyed by instance field path. The page runtime must instead fan per-placement values out to N instances, each keyed by `instanceId` (resolved from `placementId`). That is a different completion transform, not the same function with a different input.

**Verdict on this boundary:** "locale completion" is ONE conceptual operation but TWO concrete functions sharing at most the marker-replacement primitive (`LOCALE_CONTEXT_MARKER` → injected JSON). 127B's phrasing ("the same locale-completion function," "do not duplicate the rules") risks an executor either (a) forcing the standalone instance function to also handle page overlays, weakening the standalone contract, or (b) duplicating the page version inside Tokyo and calling it "shared." The PRD must split this explicitly: the shared primitive is (1) the marker contract (`window.CK_LOCALE_CONTEXT = null;` exactly once) and (2) the `<html lang>` rewrite; the page-specific transform (overlays.json → per-placement runtime payloads) is page-only and lives with the page compiler contract. Naming this precisely removes the hidden-subsystem risk.

**How preview gets HTML — confirmed path, with one gap.** Roma calls the compiler (Save/Update) → gets four files + evidence → calls locale-completion to produce preview HTML for the selected locale. Confirmed: this stays inside Roma and does not touch Tokyo. Gap: 127B does not say where the preview's selected-locale `values` come from before 127C. For preview, the values must come from the compiled `overlays.json` (which 127B produces) plus the same completion primitive. The PRD should state that preview reads `overlays.json` from the in-memory compiler result (not from R2), completing the no-I/O guarantee.

**How 127C consumes the same files — clean.** 127C §"Save and package install" traces Roma → compiler → four files + evidence → one Tokyo install command → atomic candidate write under `packages/{packageFingerprint}/` → one-step `serve-state.json` selection. The compiler boundary stops at the result; 127C owns storage. No overlapping ownership.

**No invented subsystems otherwise.** The compiler is a module; the contribution is a materializer operation; evidence is a return value, not a store; `packages/{packageFingerprint}/` is an internal install coordinate owned by Tokyo, not a customer Build entity (127C §"Public and storage names"). The `serve-state.json` extension is owned by Tokyo-worker (127C), not the compiler. Boundaries are otherwise faithful to Tenet 2.

#### 3. How this plan is world-class SaaS and up to par with competitors (technical perspective)

**Where 127B is genuinely best-in-class:**

1. **Deterministic compile + edge cache, not SSR/ISR.** Next.js SSR/ISR and Astro/Hugo static export represent two industry poles. 127B picks a third: deterministic pure-function compilation at write time, with Cloudflare edge caching of completed locale responses. This beats SSR on edge cost and TTFB (no origin compute per request — 127C §"Cache policy" caches exact-locale HTML by account+page+locale+package), and beats naive static export because the compiled document is one consolidated file set rather than N iframe stacks. The "compiled document with dedup" model is materially better than the early-no-code iframe-stacking approach 127B explicitly rejects (§"Why this slice exists": "not a list of public Widget URLs or iframes").

2. **Single compiled document with CSS/JS dedup.** 127B §4-5 (emit identical shared CSS/runtime bytes once, preserve first-use order for non-identical contributions, keep per-instance state keyed by stable IDs) is the right consolidation. The substrate already supports this: `tokyo/product/widgets/shared/runtime.js:85-87` registers initializers by widget type and dispatches to all roots, and `window.CK_WIDGETS[instanceId]` (`runtime.ts:174`) keys state per instance. Two instances of the same widget reuse one init registration and one module set — exactly the dedup 127B asks for. This is cleaner than most no-code platforms, which either re-download the widget runtime per embed or bundle everything into one opaque JS file.

3. **Evidence/fingerprint contract for cache identity.** 127B §7 (fingerprint each file, then the ordered four-file set + compiler contract version) gives 127C a stable, content-addressed cache key. The fingerprint-as-query-param model in 127C (`?v={packageFingerprint}`) prevents old-HTML/new-CSS mixes during replacement. This is the same pattern used by hashed-asset CDNs and is the correct competitive bar.

4. **Explicit-invocation gate.** The compiler runs only on Save/Update (§"Explicit invocation and preview"). This is stricter than ISR's on-demand revalidation and avoids the competitor pattern of background recompilation queues. For a Pages product where currency is customer-owned (the Update-page modal), this is defensible.

**Where competitors do something cleaner — the base+injection locale model is a defensible trade-off, NOT a missed optimization, but 127B should justify it explicitly:**

Competitors at the top of the SEO/AEO bar (Astro, Next.js `export`, Hugo, Webflow) **pre-render each locale to its own static HTML file** (`/en/page.html`, `/fr/page.html`). There is no runtime locale completion at all — the edge serves a static file per locale. This eliminates the `overlays.json` runtime read and the marker-injection transform entirely.

127B instead compiles ONE base `index.html` + ONE `overlays.json`, and 127C completes locale HTML on cache miss by injecting values from `overlays.json` (127C §"Completing exact locale HTML"). This is the same base+injection model the standalone widget runtime already uses (`OverlayArchitecture.md`, `runtime.ts:136-167` `applyExactOverlay`). The trade-off:

- **127B's advantage:** one compiled document, one source of truth per page, no per-locale HTML proliferation, automatic consistency across locales (a base HTML change does not require re-rendering L locale files), and reuse of the proven standalone locale-injection runtime.
- **127B's cost:** every locale cache miss pays an `overlays.json` read + a string-transform completion (cheap, but non-zero), and the base HTML must be locale-neutral enough that injection is always correct (title, description, canonical, hreflang, social tags, visible text). 127C §"Completing exact locale HTML" steps 5-7 must inject ALL of those server-side, which means 127B's base `index.html` cannot contain any locale-specific literal in the base — it must be placeholder-driven. The PRD does not fully specify the placeholder contract. 127B §3 shows a `<title>` owned by the Page and §6 says overlays carry `page.title`, but the mechanism by which base HTML's `<title>` becomes locale-completed (marker? attribute? known-position rewrite?) is unspecified. This is the one place where the competitor "one static file per locale" approach is genuinely cleaner, because it sidesteps the placeholder/completion contract entirely.

**Verdict on the trade-off:** defensible. Reusing the standalone overlay-injection runtime keeps the system lean (Tenet 1, AGENTS.md "keep the system lean") and avoids a second delivery lifecycle per locale (OverlayArchitecture.md "zero derived locale runtimes"). But 127B must add an explicit base-HTML locale-placeholder contract (where do `page.title`, `page.description`, `<html lang>`, `<html dir>`, canonical, hreflang, og: tags live in the base document, and how does completion overwrite them?) or the executor will invent one ad hoc, which is a V1/V3 risk.

**Where competitors are cleaner — per-locale pre-render would eliminate the public-path `overlays.json` read.** Already analyzed above. The cost is small and bounded; the cohesion benefit (one runtime model for widgets and pages) outweighs it. Acceptable.

**Competitive gap — no streaming/partial hydration.** 127B emits one `runtime.js` with `defer`. Modern frameworks (Astro islands, Next.js partial prerendering) do per-island hydration. 127B's model initializes all placements once on `DOMContentLoaded`-equivalent. For a first release that is "one vertical flow of Instances" (Mama §2), this is fine; it would become a gap if pages grew to dozens of heavy widgets. Not a 127B blocker.

#### 4. Absence of V1–V8 violations

Auditing 127B as designed against each violation. Cite format: PRD clause → guard or gap.

**V1 — Silent substitution.** Does the compiler ever invent content/locale/metadata?
- GUARDED. 127B §1 "Any mismatch returns one explicit failure. No placement is filtered out." §6 "The compiler never invents a missing overlay value or substitutes another locale." §3 "The compiler does not infer facts, keywords, claims, prices, FAQs, image text, or arbitrary schema from prose." §"What the compiler receives" item 6 restricts input to referenced account asset coordinates. The failure type (`ok: false` with `reason`, `paths?`, `placementId?`, `instanceId?`, `locale?`) requires naming the exact coordinate. Aligns with Tenet 3.
- GAP. §3 "supported Page-level structured data derived from declared Page fields" and "Widget-specific structured data is included only when the Widget already owns a declared compatible contribution whose visible content supports it." The phrase "derived from declared Page fields" and "supported" are under-specified. If the executor derives a schema.org JSON-LD block, they must NOT invent field values not present in source. The PRD should add: structured-data values must be 1:1 with declared source fields; no augmentation. As written, a generous reading could invent `datePublished` or `author` from metadata that was never authored. Tighten before execution.

**V2 — Silent healing.** Does it normalize/coerce invalid input?
- GUARDED. §1 "verify … every selected locale can be resolved for the Page and every Instance." §"What the compiler receives" makes Roma responsible for all reads; the compiler validates and fails. Mama §13 "invalid or corrupt source remains an error rather than being repaired." Aligns with Tenet 4.
- No gap identified.

**V3 — Silent omission.** Does it drop a placement or module?
- GUARDED. §1 "No placement is filtered out." §2 "fail if the contribution is missing, malformed, or contains a second document shell." §"Instance contribution" requires the operation reuse the same parsing/root-stamping/validation as standalone — so a missing module fails, not omits. §7 requires all four files present on success.
- GAP (runtime-module dedup). §5 "emit byte-identical shared runtime modules once; preserve first-use execution order for distinct modules." The dedup is by byte-identity. But `tokyo/product/widgets/shared/runtime.js:85-87` registers initializers keyed by widget type into `window.CK_WIDGET_INITIALIZERS[normalized]` and dispatches to ALL roots — so two instances of the same widget type share ONE registration. This is correct only if both instances' init functions are byte-identical (they are, same widget type). The PRD's "preserve first-use execution order" must explicitly handle the case where two DIFFERENT widget types both import the SAME shared module (e.g., both import `shared/runtime.js`) — that shared module must emit once and initialize both widget types' roots, not emit twice. Today's `register()` already handles this (it queries `[data-ck-widget="${normalized}"]`), but 127B's dedup contract must guarantee the compiler does not emit `shared/runtime.js` twice when two widget types both reference it. The PRD should state: dedup is by resolved product path (`files.ts:10-25` `resolveProductPath`), not by widget type. As written, an executor could dedup by widget-type+key and double-emit shared modules.

**V4 — Fail-open control.** Does enforcement turn off when a dependency is missing?
- GUARDED. §1 requires "all required fingerprints and revisions are present." §"What the compiler receives" item 7 requires "source and contract fingerprints required for evidence." The compiler is a pure function with no fallback path — there is no dependency to fail open against. Mama §13 "account, tier, role, locale, and package controls fail closed." The instance-contribution stop-condition (§"The Instance contribution") fails to the product owner rather than inventing a renderer.
- No gap identified.

**V5 — Corruption-as-absence.** Does corrupt stored state get treated as missing/new/empty?
- GUARDED. The compiler receives already-read input from Roma; §1 validates completeness. 127B does not read storage, so it cannot conflate corruption with absence. Corruption surfaces as validation failure (`ok: false`) with the exact coordinate. Mama §13 "corrupt source remains an error."
- No gap identified.

**V6 — Partial-success masquerade.** Can a half-compiled package leak?
- GUARDED by design, but the guard is in 127C, not 127B. 127B returns either `{ok:true, files, evidence}` (all four files together) or `{ok:false, reason, ...}` — there is no partial-files return (`PageCompilerResult` §"What the compiler returns"). The compiler cannot write storage, so it cannot leak a half-package itself. The atomic-install guard is 127C's job (127C §"Save and package install" steps 1-6: candidate write, readback, one-step selection, previous remains authoritative until step 4). 127B's contribution to V6 is the all-or-nothing result shape, which is correct.
- No gap in 127B. (Note for 127C reviewers: the atomic-install proof lives there.)

**V7 — Masquerade/redress.** Does the same failing workflow continue under a different name?
- GUARDED. §"The Instance contribution" explicitly forbids "a second rendering framework inside Roma" if the materializer cannot expose a contribution — it stops. §"Explicit invocation and preview" forbids "a continuously compiled draft preview, second Page Builder renderer, or 'close enough' preview DOM." §Code work item 7 deletes replaced preview/iframe/composition code. Aligns with the Mama §13 "replaced Page stubs, paths, and legacy data are removed."
- GAP (current code). Today's `tokyo-worker/src/routes/internal-page-routes.ts:152-161` returns `coreui.errors.page.publishUnavailable` for page publish, and `roma/app/api/account/pages/[pageId]/publish/route.ts:39-50` returns the same. 127B does not delete these (that is 127C's job per §Code work), but the PRD should explicitly note that the "publish unavailable" stub is the V7 risk surface — it must be replaced, not left as a parallel path. 127C owns this; flag for 127C.

**V8 — Runtime test dependency.** Does normal runtime depend on compiler fixtures/probes?
- GUARDED. 127B §"Deployment and verification" separates behavior proof from runtime: "Use browser/runtime tests for behavior that static string assertions cannot prove. Do not make normal runtime depend on those tests." §Product-data work: "Compilation tests use committed fixtures." The compiler is invoked only by explicit Save/Update at runtime; fixtures live in tests. Aligns with AGENTS.md V8.
- No gap identified.

**V1–V8 summary:** 127B as designed avoids V2, V4, V5, V6 (within its boundary), V7 (within its boundary), and V8. V1 has one under-specified gap (structured-data derivation must not invent fields). V3 has one under-specified gap (shared-module dedup contract must be by resolved product path, not widget type). Both are fixable with two sentences added to the PRD.

#### 5. Needed documentation / updates (TPM perspective)

**Documentation files needing updates from a program/system-integration perspective after 127B deploys:**

1. `/Users/piero_macpro/code/VS/clickeen/packages/ck-runtime-materializer/README.md` — THE primary contract doc and the one most falsified by 127B. Today it states:
   - "Pure builder for the **one public root artifact of a saved widget instance**" — becomes partially false after 127B adds the N-instance contribution operation.
   - "Output: `/{accountPublicId}/{instanceId}/index.html` …" — the contribution operation has no such output; it returns `PageInstanceContribution`.
   - "This package never accepts a requested non-base coordinate, reads storage, writes storage, calls a model, or creates locale-derived files." — still true, but the README must add the contribution operation's contract (pure, in-memory, returns html/css[]/javascript[]/baseValues/overlays, no document shell).
   - "Forbidden: alternative artifact roots" — must be reconciled: the contribution is not an alternative root, it is a non-stored intermediate. Needs an explicit sentence.
   The materializer contract section in `documentation/services/bob.md` must be checked for the same statements (127B §"Required documentation" flags this conditionally — make it mandatory).

2. `/Users/piero_macpro/code/VS/clickeen/documentation/services/roma.md` — the "Pages Domain" section (lines 422-446) currently says: "Current page source references saved widget instances by placement id and instance id. It does not embed widget source and does not currently store child widget artifact references. **Any shift to generated child artifact coordinates, child evidence, or page package materialization belongs to a future Page Package PRD.**" That last sentence becomes FALSE the moment 127B deploys — the Page Package PRD has arrived. Also the "Page publish and public page serving are currently disabled until Roma has a real page package writer" (line 433) must move from "currently disabled" to "compiler deployed; publication pending 127C." The Builder Orchestration section (lines 232-243) describes standalone-instance materialization only; it needs a cross-reference to the Page compiler path.

3. `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/OverlayArchitecture.md` — §"Storage" lists only the standalone-instance overlay shape (`overlays/locales/{locale}.json` with `values`). After 127B, there is a second compiled artifact: the page `overlays.json` with key shape `page.title` / `placements.{placementId}.{fieldPath}` (127B §6). The OverlayArchitecture doc must add the compiled-page overlay contract and state explicitly that the page `overlays.json` is compiler/Tokyo input, NOT a browser API and NOT a per-instance locale runtime (to preserve the "zero derived locale runtimes" invariant, line 8). The §"Runtime Rule" currently describes only the standalone instance completion path; it must add (or cross-reference) the page completion path.

4. `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/RuntimeProfiles.md` — §"Current Runtime Surfaces" lists "Composed page: page-owned composition over referenced saved instances" as a future surface with no detail. After 127B, the composed-page runtime contract (compiled `index.html` + deduped CSS/runtime + `overlays.json`, per-placement state keyed by `instanceId` resolved from `placementId`) must be documented as current truth.

5. `/Users/piero_macpro/code/VS/clickeen/documentation/architecture/CONTEXT.md` — §"Product Flows > Clickeen Pages" (lines 286-296) currently says "Page publish and public page serving are currently disabled because Roma does not currently write page packages." That sentence becomes stale after 127B (compiler exists; packages are writable in-memory; storage/publish is 127C). Update to: compiler deployed; publication pending 127C.

6. `/Users/piero_macpro/code/VS/clickeen/documentation/services/tokyo-worker.md` — §"Pages" (lines 137-159) and §"Public Serving" describe the standalone-instance locale-completion path. After 127B lands the shared locale-completion primitive, tokyo-worker.md must cross-reference the shared primitive's home (whatever package 127B chooses) and note that the page public path (127C) will consume the same marker contract. Today's `indexHtmlWithLocaleContext` is private to `clk-live-routes.ts`; if 127B extracts the marker primitive to a shared package, tokyo-worker.md must say so.

7. A NEW cross-system contract doc (or a section in an existing one) for the **locale-completion primitive contract**: the exact marker string (`window.CK_LOCALE_CONTEXT = null;` — must appear exactly once; `clk-live-routes.ts:135-136` already enforces single-occurrence), the `<html lang>` rewrite rule, and the page-vs-instance transform boundary. This is the single most important doc to prevent the hidden-subsystem risk in §2. Recommend placing it in `documentation/architecture/OverlayArchitecture.md` as a new "Compiled Page Locale Completion" section.

**Deploy sequencing (TPM note):**
127B deploys with Roma only (§"Deployment and verification": "Deploy the compiler with Roma"). No Tokyo-worker deploy, no Supabase migration, no new Worker. This is the cleanest possible deploy surface — one Cloudflare Pages Git build for `roma-dev`. Doc-order dependencies:
- 127B MUST land after 127A is deployed and verified (Mama §12: `127A → 127B → 127C → 127D → 127E → 127F`). 127A owns the `AccountPageSource` contract that 127B consumes. CRITICAL: today's Roma `AccountPageSource` (`roma/lib/account-page-direct.ts:49-59`) uses `metadata{title,description,robots,canonicalUrl}` + `localization{defaultLocale,countryLocaleRules,ipLocalizationEnabled,...}` — this does NOT match 127A's `values{title,description,...}` + `baseLocale` + `locales[]` + `overlays`. 127B's compiler input assumes the 127A shape. If 127A's contract change slips, 127B cannot compile. The doc-order dependency is hard.
- 127B MUST land before 127C (127C consumes the four-file result + evidence + locale-completion contract). 127C's `PageServeState.package` (127C §"serve-state.json") is a direct copy of 127B's `evidence` shape — any drift between the two PRDs is a contract bug. Recommend a shared type in `@clickeen/ck-contracts` owned by 127B and imported by 127C.
- The materializer README (item 1 above) MUST update in the same PR as the contribution extraction, not in a follow-up — otherwise the contract doc is stale on landing, violating Documentation Discipline (AGENTS.md: "Confirmed doc/runtime mismatch is fixed with the behavior change that exposed it").

**Specific sentences that become false after 127B deploys:**
- `documentation/services/roma.md:444-446`: "Any shift to generated child artifact coordinates, child evidence, or page package materialization belongs to a future Page Package PRD." → FALSE; the future has arrived.
- `documentation/services/roma.md:433`: "Current account page publish is disabled until Roma has a real page package writer." → Partially false; the writer (compiler) exists, storage/publish is pending 127C.
- `documentation/architecture/CONTEXT.md:294-295`: "Page publish and public page serving are currently disabled because Roma does not currently write page packages." → Stale after 127B (packages writable in-memory; storage pending 127C).
- `packages/ck-runtime-materializer/README.md`: "Pure builder for the one public root artifact of a saved widget instance." → False after the contribution operation is added.
- `documentation/architecture/OverlayArchitecture.md` §Storage: lists only `overlays/locales/{locale}.json` → incomplete after 127B adds the compiled page `overlays.json`.

**Verdict: APPROVE WITH CHANGES — the pure-callable, single-renderer, four-file design is cohesive and V1–V8 clean in spirit, but 127B must (1) name the compiler's package home rather than defer it, (2) split the "shared locale-completion function" into the shared marker primitive vs. the page-specific per-placement transform to avoid a hidden subsystem, (3) add a base-HTML locale-placeholder contract, (4) tighten the structured-data "no invented fields" rule (V1) and the shared-module dedup-by-resolved-path rule (V3), and (5) acknowledge the Instance-contribution abstraction is a real materializer refactor, not a minor extension.**

---

## 4. Consolidated Verdict & Convergence

All three seats returned **APPROVE WITH CHANGES**. No seat BLOCKED. They converge strongly on a small set of load-bearing code-grounded findings — the kind that, if left unresolved, an AI executor will improvise around at exactly the boundaries where improvisation causes silent runtime/locale corruption.

### Convergent blockers-to-resolve (all three or a clear majority flagged)

1. **"Extend the materializer" and "reuse Tokyo's locale-completion function" are presented as extensions; the code shows they are surgery.**
   (Staff Eng §1, §4; Principal TPM §1, §2)
   The materializer is hard-single-instance at every layer: `stampPackageRoot` rejects multiple roots (`html.ts:55-98`), the runtime payload writes exactly one `window.CK_WIDGETS[instanceId]` (`runtime.ts:76-182`), `buildIndexHtml` emits one document shell (`html.ts:100-122`). The only locale-completion code (`indexHtmlWithLocaleContext`, `clk-live-routes.ts:128-150`) is a private, non-exported function in the Tokyo-worker package that Roma cannot even import. An executor reading "extend"/"reuse" will hit walls late. **Must reframe as a real refactor with a concrete reusable-vs-not function split, and extract + purify + re-home the locale-completion primitive.**

2. **The `overlays.json` / `{instanceFieldPath}` contract is too under-specified to implement without inventing.**
   (Staff Eng §2, §4; Principal TPM §2)
   The key shape `placements.{placementId}.{instanceFieldPath}` does not define the path grammar. The codebase has two competing vocabularies — `editable-fields.json` uses `items[].title`; the runtime's `applyExactOverlay` (`runtime.ts:88-134`) **rejects** `[`, `]`, `*` and accepts concrete paths like `items.0.title`. An executor will guess wrong. **Must pin `{instanceFieldPath}` to the concrete grammar and reference the validator.**

3. **The locale-completion "shared function" is one concept but two concrete transforms, and the boundary is fuzzy enough to risk a hidden subsystem.**
   (Staff Eng §1, §4; Principal TPM §2)
   The shared primitive is the `CK_LOCALE_CONTEXT` marker replacement + `<html lang>` rewrite. The page-specific transform (aggregated `overlays.json` → per-placement runtime payloads) is new and page-only. Calling them "the same function" risks either weakening the standalone contract or duplicating the page version inside Tokyo. **Must split explicitly: shared marker primitive + page-only per-placement transform, both in a named shared package.**

4. **The compiler's package home is unnamed.**
   (Staff Eng §4; Principal TPM §1)
   "Owned by Roma or an existing shared package" defers a blast-radius decision to the executor. Putting it in `roma/lib/` couples a pure, fixture-testable artifact to the Next.js edge app and blocks clean sharing with Tokyo. **Must name the home (a workspace package).**

5. **Runtime state isolation across placements is asserted ("without merging Instance state") but never specified.**
   (Staff Eng §1, §4)
   The dedup/isolation contract must be concrete: shared module bytes deduped by resolved product path (not widget type), per-placement payload + root stamp emitted once per placement, CSS chunks deduped by `chunkMarkerId(key)`. The existing `data-ck-composed-page="true"` marker and multi-root runtime registration (`shared/runtime.js:52-91`) already exist in the browser but are unproduced and undocumented. **Must name the marker scheme and the per-placement keying rule.**

### V1–V8 audit convergence

| Violation | Design posture | Notes |
| --- | --- | --- |
| V1 Silent substitution | GUARDED, one gap | "Structured data derived from declared Page fields" must be pinned to 1:1 source fields — no invented `datePublished`/`author` |
| V2 Silent healing | CLEAN | Compiler validates and fails; never normalizes |
| V3 Silent omission | GUARDED, one gap | Shared-module dedup must be by resolved product path, not widget type, or shared modules get double-emitted |
| V4 Fail-open control | CLEAN | Pure function with no fallback path |
| V5 Corruption-as-absence | CLEAN | Compiler doesn't read storage; corruption surfaces as validation failure |
| V6 Partial-success masquerade | CLEAN (within 127B) | All-or-nothing result shape; atomic install guard lives in 127C |
| V7 Masquerade/redress | CLEAN (within 127B) | Forbids second renderer; "publish unavailable" stub deletion is 127C's job |
| V8 Runtime test dependency | CLEAN | Fixtures live in tests; runtime invokes only on explicit Save/Update |

### Single-seat findings worth product-owner attention

- **Senior PM:** preview-only-after-Save is the wrong authoring rhythm for a Page builder — placement reorder is inherently visual and produces zero feedback until Save. This is inverted from Bob (live preview). Worth at least naming the tradeoff or carving out a lightweight preview path for Page-owned fields.
- **Senior PM:** the `reason: string` failure field should be a `reasonKey` taxonomy (matching Bob/San Francisco discipline) or technical-leak strings will reach the customer.
- **Senior PM:** the human-only invocation gate is a real drift from the agent-operated thesis — the compiler is agent-native at the technical level but the product rule locks it behind a human button. Should be named as a deliberate scope boundary, not silently locked.
- **Staff Eng:** the "widget-specific structured data" sentence (`§3`) is dead code — no widget owns such a contribution today; the six-file widget contract has no field for it. Remove from 127B or move to a future slice.
- **Staff Eng:** the "last compiled preview while dirty, must identify as not reflecting the unsaved draft" rule leaks 127E UI state into the 127B compiler contract. Move to 127E.
- **Principal TPM:** the base+injection locale model is a defensible trade-off vs per-locale pre-rendering (Astro/Hugo), but 127B must add an explicit base-HTML locale-placeholder contract (where `page.title`, `<html lang>`, canonical, hreflang, og: tags live and how completion overwrites them) or the executor will invent one.
- **All three seats:** a `documentation/capabilities/pages.md` does not exist and should — every other first-class capability has one. The runtime-materializer contract also has no current-truth doc home (only execution history under `Execution_Pipeline_Docs/`); it needs one, especially after the contribution operation lands.

### Final consolidated verdict

**APPROVE WITH CHANGES (GLM seat).** 127B's pure-callable, single-renderer, four-file design is cohesive, thesis-aligned at the technical level, and V1–V8 clean in spirit. Execution should not begin until the five convergent blockers are resolved in the PRD text. The two non-negotiable ones: (1) reframe the materializer/locale-completion work as the real refactor it is, with a named shared package and a concrete reusable-vs-not function split; (2) pin the `{instanceFieldPath}` grammar to the concrete form `applyExactOverlay` already enforces. The rest (compiler home, isolation/dedup contract, structured-data guard) protect against the most likely executor improvisation at the runtime and locale boundaries.
