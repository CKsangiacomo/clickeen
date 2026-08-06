# Codebase-Wide God-File & God-Service Structural Audit

Status: **STRUCTURAL AUDIT — CURRENT CODEBASE**

Date: 2026-08-04

Method: Phase 1 LOC recon sweep → Phase 2 seven surface-specific subagents
(locked structural mandate: no product redesign, no PRD re-litigation, no tenet
grading — only structural decomposition findings grounded in real files) →
Phase 3 consolidation.

This audit does **not** grade against tenets and does **not** propose product
changes. It exposes where one file or one named authority concentrates multiple
unrelated responsibilities, and proposes splits along the existing named
authority boundaries in `AGENTS.md`.

The seven per-surface audits are summarized here. The full per-surface findings
live in the conversation history; this file is the codebase-wide view.

---

## 1. Headline findings

1. **The disease is real, codebase-wide, and concentrated in two structural templates.**
   - A **god-file template** (`roma/components/*-domain.tsx`) where every Roma product surface grows one React component that owns data load + cache + CRUD + form state + full JSX + inline helpers + error-copy maps.
   - A **god-barrel** (`packages/ck-contracts/src/index.ts`) where every new "shared helper" lands inline because no domain home exists, and the barrel also re-exports six unrelated domain modules.

2. **The widget runtime is monolithic for an accidental reason that 127B will force a fix on.** Every `widget.client.js` >430 LOC mixes primary content construction (the part that should die under the three-file law) with genuine behavior (the part that should stay), wrapped in ~40% copy-pasted validators and a 7-call shared-applier ceremony that has no orchestrator. The shared leaf modules (`CKStagePod`, `CKTypography`, etc.) are correctly extracted; the orchestrator + shared validator layer was never built.

3. **One genuine authority leak exists** in `roma/app/api/account/locales/route.ts` — a Roma account route that embeds a hand-rolled Supabase admin REST client and writes directly to the DB with the service-role key. Every other Roma write goes `route → lib/*-direct → tokyo-client`. This is the lone exception.

4. **Tokyo-worker and San Francisco are the reference architectures.** Tokyo-worker's `domains/<area>/{source,operations,package-files,serve-state,keys,types}` split and SF's thin-entrypoint + cohesive-grant-file shape are what the rest of the codebase should look like.

5. **Most admin HTML "god-files" are generated showcase output, not real god-files.** Only `entitlements.html` (1238 LOC, hand-written, two policy domains in one inline app) is a true god-file. The rest are 0-script build artifacts.

---

## 2. Ranked worst offenders (codebase-wide)

| Rank | File | LOC | Surface | Why it's a god-file |
| --- | --- | --- | --- | --- |
| 1 | `roma/components/pages-domain.tsx` | 1248 | Roma | List + detail editor + localization-rules editor + publish flow + URL/embed builder + widget picker, all in one component. The `*-domain.tsx` template's worst instance. |
| 2 | `packages/ck-contracts/src/index.ts` | 462 | Packages | God-file (asset-refs + locale-policy + media-materialization + JWT + primitives all inlined) AND god-barrel (re-exports 6 unrelated domains; 69 callers hit the barrel for `isRecord`). Highest blast-radius file in the codebase. |
| 3 | `roma/components/widgets-domain.tsx` | 1056 | Roma | Same template as pages-domain + a 120-LOC hand-rolled portal popover that belongs in Dieter. |
| 4 | `tokyo/product/widgets/logoshowcase/widget.client.js` | 971 | Widgets | 328 LOC validators + content construction + motion engine fused in one IIFE. |
| 5 | `tokyo/product/widgets/countdown/widget.client.js` | 957 | Widgets | 346 LOC validators + 3 timer engines + copy-pasted ceremony. Large because of missing shared extractions, not inherent complexity. |
| 6 | `roma/components/builder-domain.tsx` | 947 | Roma | Bob postMessage protocol types + SSE reader + open-editor handshake + unsaved-changes guard + iframe render. A host integration layer disguised as a React component. |
| 7 | `admin/src/html/tools/entitlements.html` | 1238 | Admin | Two policy domains (entitlements matrix + AI runtime matrix) + HTTP layer + formatters + two parallel renderers in one inline app. |
| 8 | `berlin/src/auth/routes.ts` | 773 | Berlin | OAuth flow + dev-admin login modality + structured logging all in one route file. |
| 9 | `roma/components/widget-defaults-domain.tsx` | 783 | Roma | JSON-path editor library + widget-shell contract classifiers + Bob-control adapter + dirty guard + save flow. |
| 10 | `agents/translation-agent/src/worker.ts` | 658 | Agents | HTTP server + grant verifier + SF client + Tokyo client + run orchestrator + SSE transport in one worker file. |
| 11 | `roma/lib/account-instance-direct.ts` | 758 | Roma lib | 13 types + 10 normalizers + instance CRUD + publish transitions + widget-definitions listing + worker-pool fan-out. Cohesion leak (not authority leak). |
| 12 | `prague/src/components/InstanceEmbed.astro` | 648 | Prague | iframe URL + brand SVG sprite + share-chrome + 240 LOC CSS + resize handler + 18-channel share dispatch + menu UX. Self-described as "self-contained" — the anti-pattern signature. |

---

## 3. The four cross-cutting structural patterns

### Pattern A — `roma/components/*-domain.tsx` is a god-file template (Roma-wide)

There are 13 `*-domain.tsx` files. The 5 biggest (`pages` 1248, `widgets` 1056, `builder` 947, `widget-defaults` 783, `assets` 722) each follow the identical recipe: a `*Page` shell wrapper + a `*Domain` component that owns data load + cache + CRUD + form state + full JSX for every sub-section + inline error-copy maps + helpers. The smaller domains (`profile` 278, `team` 329, `usage` 90) approximate the target shape.

**The disease is structural, not file-by-file.** The template teaches authors to add the next piece of logic into the same file. Every new Roma surface will grow a god-file unless the template changes.

**Fix shape:** each `*-domain.tsx` becomes a thin wrapper composing (a) a `use-*-data.ts` hook (data + cache + normalization, lifted out), (b) section components (`*-list-section.tsx`, `*-form-section.tsx`, `*-actions.tsx`), and (c) shared infrastructure from `roma/lib/`. The existing smaller domains already approximate this.

### Pattern B — `packages/ck-contracts/src/index.ts` is a god-barrel + god-file

Two failures fused:

1. **God-file:** the barrel itself inlines ~7 unrelated responsibilities: account-asset-ref parsing, account-locale-policy validation, media-asset materialization (recursive runtime tree-walking that mutates widget config — this is transform logic, not a contract), JWT helpers, generic primitives (`isRecord`, `asTrimmedString` — the most-imported symbols in the codebase), and HTML-error-page sniffing.
2. **God-barrel:** `index.ts` ends with `export * from './user-settings-geo'; export * from './observability'; export * from './reason-keys'; export * from './translated-value-primitives'; export * from './overlay-codebooks'; export * from './overlay-identity';`. So importing for `isRecord` drags in the translated-value path model, the 250-country timezone table, observability shapes, and overlay identity.

The package.json already declares subpath exports and 51 consumers use them correctly; 69 still hit the barrel, mostly for primitives that live only in `index.ts`.

**Fix shape:** extract primitives to `./primitives`, asset-refs to `./account-asset`, locale-policy to `./account-locale-policy`, move media-materialization out of contracts entirely (it is transform logic belonging in the materializer/generator), and move the AI runtime registry data from `ai.ts` into `ck-policy` (leaving `ai.ts` as pure types). The barrel becomes a ~40-line re-export file.

### Pattern C — duplicated low-level infrastructure across Roma domains

Three concrete duplications, each a one-time extraction:

1. **SSE reader:** `text/event-stream` parsing appears near-verbatim in `builder-domain.tsx` (`readJsonOrStreamedCommandResult`) and `account-instance-translations.ts` (`readTranslationAgentResponse`).
2. **Unsaved-changes navigation guard:** `beforeunload` + `a[href]` click-interception + `popstate`-hold is hand-written in both `builder-domain.tsx` and `widget-defaults-domain.tsx`.
3. **Country-locale-rules table UI:** rendered in both `pages-domain.tsx` and `account-locale-settings-card.tsx`.

**Fix shape:** one `roma/lib/sse-command-result.ts`, one `roma/lib/unsaved-changes-guard.ts`, one shared `roma/components/locale-country-rules-table.tsx`. Each extraction removes a maintenance hazard and shrinks the god-files.

### Pattern D — widget `widget.client.js` monolith (the content-vs-behavior fusion)

Every widget >430 LOC is one IIFE mixing five jobs: (1) ~40% copy-pasted validators, (2) primary content construction (`renderStrips`/`renderItems`/`renderCard`), (3) genuine behavior (motion engines, accordion state machines, timer engines), (4) a 7-call shared-applier ceremony copy-pasted across all 8 widgets, (5) preview-l10n plumbing copy-pasted 8×.

The shared leaf modules (`CKStagePod`, `CKTypography`, `CKHeader`, `CKCoreSize`, `CKLocaleSwitcher`, `CKBranding`, `CKSocialShare`) are correctly extracted. **The extraction stopped at the leaves and never produced the orchestrator or the shared validator layer.** That is why every widget reimplements `assertBoolean/Number/String/Object/Enum/Fill/BorderConfig/ShadowConfig/CardWrapper/CoreSize/LocaleSwitcher/SocialShare` from scratch.

**Fix shape (no new authorities):**
- `shared/validators.js` — the assert primitives + shared shape validators. Kills ~40% of every widget file.
- `shared/sanitizeInlineHtml.js` — one copy (currently duplicated 5× including in `shared/header.js`).
- `shared/applyRuntime.js` — orchestrates the 7-call ceremony. Kills ~60-80 LOC × 8 widgets.
- Per widget >500 LOC: split `widget.client.js` into `render.js` (content construction — the 127B-dying slice, isolated so deletion is one file) + `{behavior}.js` (the surviving engine) + a thin `widget.client.js` orchestrator.

**This is the highest-leverage structural change for 127B.** Separating content construction from behavior today means the three-file cutover deletes one file per widget without touching the motion/accordion/timer engines.

---

## 5. Per-surface verdict summary

| Surface | God-files | Authority leaks | Verdict |
| --- | --- | --- | --- |
| **Roma** | 5 god-`*-domain.tsx` + 3 god-libs (`account-instance-direct.ts`, `-translations.ts`, `-public-package.ts`) | **1 real leak:** `locales/route.ts` embeds Supabase admin REST client + service-role DB writes | Worst surface. Structural template disease + one authority leak. |
| **Bob** | 2 god-components (`CopilotPane.tsx`, `Workspace.tsx`) + 1 god-function (`stencils.ts` `buildContext` 320 LOC) + `linkedOps.ts` branch list | None (Bob stays in browser memory; no persistence writes) | Localized. Session + compiler/modules layers are exemplary. |
| **Tokyo-worker** | None | None | Reference architecture. Do not change. |
| **tokyo/product/widgets** | 5 widget god-files (`logoshowcase`, `countdown`, `faq`, `cards`, `split-carousel-media`) | None | The content-vs-behavior monolith disease. Fixable by shared extraction + per-widget split. |
| **Berlin** | 3 (`auth/routes.ts`, `invitations.ts`, `bootstrap/state.ts`) | 1 intra-Berlin: bootstrap exports account-management member listing | Medium. All fixable by extraction within Berlin. |
| **San Francisco** | None | None | Reference architecture. Leanest surface. |
| **Agents** | 2 (`translation-agent/worker.ts`, `product-copilot/index.ts`) | None (both delegate correctly to Tokyo/SF) | Authority-clean; concentration is intra-module. |
| **Packages** | `ck-contracts/index.ts` (god-barrel + god-file), `ck-contracts/ai.ts` (contracts + runtime registry), `widget-shell/font-library.ts` | None | The shared-package blast radius is the concern. |
| **Admin** | 1 real (`entitlements.html`), 1 borderline (`main.ts` token-editor cluster) | None | 9 of 11 large HTML files are generated showcase output, not god-files. |
| **Prague** | 1 (`InstanceEmbed.astro`) | None | One god-component; self-described anti-pattern. |
| **Dieter** | 1 borderline (`repeater.js`) + **family-level duplication** (dropdown-* color engine copied 3×, `captureNativeValue` copied 6×) | None | The dropdown-* family hides ~230 LOC of duplicated primitives per sibling because `color-utils.ts` sits inside one sibling instead of `shared/`. |

---

## 6. The three highest-leverage actions (codebase-wide)

These three changes shrink the most god-files and remove the most duplication without touching any product behavior or authority boundary:

1. **Extract the widget shared layer** (`shared/validators.js`, `shared/sanitizeInlineHtml.js`, `shared/applyRuntime.js`) and split each widget >500 LOC into `render.js` + `{behavior}.js` + thin orchestrator. Eliminates ~40% of every widget file and isolates the 127B-dying content-construction code. **This is the structural prerequisite for a clean 127B cutover.**

2. **Decompose `packages/ck-contracts/src/index.ts`** into subpath modules (`./primitives`, `./account-asset`, `./account-locale-policy`) and move media-materialization out of contracts entirely. The barrel becomes a thin re-export. Highest blast-radius single file in the codebase.

3. **Break the Roma `*-domain.tsx` template** by extracting the duplicated infrastructure (SSE reader, unsaved-changes guard, country-locale-rules table, error-copy maps) into named `roma/lib/` and `roma/components/` modules, and converting the top-5 god-domains to wrapper + section components + data hooks. Shrinks the top-5 by ~30-40% without touching the Roma→Tokyo authority boundary.

**Secondary:** fix the `locales/route.ts` authority leak (move the Supabase admin client to a Michael-facing service module); fix the Dieter dropdown-* family duplication (move `color-utils.ts` to `shared/`); split `entitlements.html` into its two policy domains.

---

## 7. What is lean and should stay (the reference architectures)

These are the structural templates the rest of the codebase should follow. Do not change them:

- **Tokyo-worker `domains/<area>/{source,operations,package-files,serve-state,keys,types,normalize,utils}`** — the model decomposition. Route files are thin dispatchers; domain files own one document family.
- **San Francisco** — thin entrypoint (`index.ts` 157 LOC dispatching to 4 routes) + cohesive grant file (`grants.ts` 201) + well-decomposed supporting modules. The leanest surface.
- **Bob `lib/session/`** — 12 files, all ≤271 LOC, each with a clear single name. The cleanest decomposition in Bob.
- **Bob `lib/compiler/modules/`** — 6 files, one per widget domain concern (stagePod, header, typography, settings, normalization, coreSize).
- **Roma smaller domains** (`usage-domain` 90, `billing-domain` ~40, `ai-domain` ~40, `settings-domain` 193) — the target shape the big-5 should be refactored toward.
- **Admin `functions/`** — 5-LOC route handlers delegating to `_shared/` modules. Excellent.
- **The Roma→Tokyo authority boundary** (`roma/lib/*-direct.ts` → `tokyo-client.ts` → Tokyo-worker) — correct substrate. The god-file disease is a cohesion problem, not an authority problem (except `locales/route.ts`).
- **The widget shared leaf modules** (`CKStagePod`, `CKTypography`, `CKHeader`, `CKCoreSize`, `CKLocaleSwitcher`, `CKBranding`, `CKSocialShare`, `CKAppearance`, `CKSurface`, `CKFill`) — correctly factored single-responsibility units. The defect is only that no orchestrator composes them.

---

## How this audit was produced

- **Phase 1 (recon):** bash LOC sweep across every `.ts`/`.tsx`/`.js`/`.astro`/`.css`/`.html` file outside `node_modules`/`.next`/`dist`/`.turbo`, grouped by surface.
- **Phase 2 (fan-out):** seven subagents (Roma, Bob, Tokyo-worker+widgets, Berlin+SF+agents, packages, admin, Prague+Dieter), each with a locked structural mandate: open every file >threshold LOC, list responsibilities, name the concentration, propose a split along existing authorities. No product redesign, no PRD re-litigation, no tenet grading.
- **Phase 3 (consolidation):** this file.

The per-surface audits (verbatim, with per-file responsibility lists and concrete split proposals) are the source material for this consolidation.
