# Clickeen Pre-GA Holistic Audit

**Reviewed against commit:** [`0977a09e`](https://github.com/CKsangiacomo/clickeen/tree/0977a09e) (current `main`, May 12 2026)
**Lens:** product, architecture, codebase — bird's-eye, not service-by-service.
**Frame:** the repo was built across 200+ PRDs, mostly AI-authored, service-by-service. This pass identifies the cross-cutting patterns that no single PRD owned, and the simplification/elegance/stability opportunities that emerge only at the whole-system level.

---

## TL;DR

| Dimension | State | Pre-GA priority |
| --- | --- | --- |
| Service boundaries | Correct shape; T1-T10 mostly honored | Stable |
| Cross-service primitives | **Drift across ~28 files** — same helpers re-implemented | **High** |
| Roma → Tokyo upstream | **12 near-identical CRUD wrappers** in one 779-LOC file | **High** |
| Auth surface | Two layouts (Berlin `auth/` + `session/`), recently consolidated in Roma | Medium |
| Frontend boilerplate | Roma routes copy-paste; 34 `runtime = 'edge'` declarations | Medium |
| Venice embed loader | **660-line hand-built JS template-string** in TS | **High** |
| Error semantics | **145 unique `reasonKey` strings**, no central registry or type | High |
| Silent-failure pattern | `.catch(() => null)` × 60+ across services | Medium |
| Documentation | 19,184 LOC across `documentation/` + 99 backlog PRDs | Medium |
| Transitional shims | 2-line re-export files (e.g. `berlin-product.ts`) | Low (quick wins) |
| `console.log` in production embed | 11 in `venice/app/embed/v2/loader.ts` | High |

**Codebase size:** ~52,000 LOC across 9 services + 3 packages. The codebase is not huge; the **fragmentation tax** is.

---

## The Pattern Behind Almost Every Issue

200+ PRDs over months, mostly AI-authored, each operating with **service-local context**. The same primitive needed in two services was implemented twice, in slightly different shapes, with slightly different return types. The same proxy pattern needed in two routes was implemented twice. The same error envelope shape was implemented twice. The result is a codebase that is **architecturally correct** at the service-boundary level (Roma → Berlin/Tokyo → Venice spine is honored) but **fractally duplicated** inside each service.

**The fix is not new architecture. The fix is consolidation passes that no single PRD ever scoped.**

---

## Cluster A — Primitive Drift (HIGH)

The same five helpers are reimplemented across the repo. Pre-GA, this is the single highest-leverage cleanup.

### A1. `isRecord` — defined or re-implemented in **28 files**

Canonical: [`packages/ck-contracts/src/index.ts:138`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/packages/ck-contracts/src/index.ts). Other definitions or duplicates exist in:

- `prague/src/lib/widgetCatalog.ts:13` (the file PRD 093 introduced — created a fresh copy on its first commit)
- `tokyo-worker/src/route-helpers.ts` (PRD 093 removed the export, but five tokyo-worker `domains/*` files define private copies)
- `sanfrancisco/src/` × 9 files
- `roma/lib/` × 4 files, `roma/app/api/` × 2 routes, `roma/components/use-roma-me.ts`
- `dieter/components/shared/account-assets.ts`
- `packages/ck-policy/src/` × 4 files (sibling package importing from sibling package would be the fix)

**Why it matters:** `isRecord` is a one-liner. Drift here is harmless. But it is the signal — the same drift dynamic produced the `asTrimmedString` bug (three Roma copies returning different types) that PRD 093 spent a slice fixing. As long as the consolidation isn't enforced, every new service helper is a future scar.

**Fix:** make `@clickeen/ck-contracts` the single export for `isRecord`, `asTrimmedString`, `asTrimmedStringOrNull`, `isStringArray`, `isNonEmptyString`. Add an ESLint rule (`no-restricted-syntax`) forbidding `function isRecord` or `const isRecord =` outside the package. Cycle-blocker for `packages/l10n` is real and documented; everything else can move today.

### A2. `asTrimmedString` — 7 implementations, 2 contracts

Already partially fixed in PRD 093 (Roma side). Remaining drift:

- [`bob/components/useTranslationsPreviewState.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/bob/components/useTranslationsPreviewState.ts), [`bob/components/CopilotPane.tsx`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/bob/components/CopilotPane.tsx)
- [`tokyo-worker/src/domains/render/normalize.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/tokyo-worker/src/domains/render/normalize.ts), [`instance-index.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/tokyo-worker/src/domains/render/instance-index.ts), [`l10n-authoring.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/tokyo-worker/src/domains/l10n-authoring.ts)
- [`dieter/components/shared/account-assets.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/dieter/components/shared/account-assets.ts)

Two contract shapes:
1. `string` (returns `""` for blank) — most service-local copies
2. `string | null` (canonical in `ck-contracts`)

**This is the bug shape that actually shipped silent breakage in PRD 092.** Each new copy is one more chance for a future agent to type-cast `null` into `""` and skip a validation branch.

### A3. `sha256Hex` — 3 implementations (one cycle-blocked)

- `packages/ck-contracts/src/security.ts` (canonical)
- `packages/l10n/src/index.ts` (cycle-blocked — `ck-contracts` cannot import `l10n` because `l10n` imports `ck-contracts`)
- `tokyo-worker/src/asset-utils.ts` (could move to canonical — not cycle-blocked)

**Fix:** move tokyo-worker copy to canonical. The l10n cycle is a real architectural decision — either move `sha256Hex` to a third "no-deps" `packages/ck-primitives` package, or accept the duplicate and document.

### A4. `isUuid` / `isE164` / various string validators

Spread across `roma/lib/account-assets-gateway.ts`, multiple Tokyo-worker domain files, and `berlin/src/identity/contact-methods.ts`. Same drift dynamic.

### A5. JWT decode

`roma/lib/auth/session.ts:152` has its own `decodeJwtPayload`. Berlin has another, Tokyo-worker has another. Different leeway constants (`30s` in Roma, undocumented elsewhere). **This is a security-sensitive primitive** — drift here is exactly the kind of thing that produces "session works in one service, expired in another" bugs.

**Fix:** one `decodeJwtPayload` in `ck-contracts` (or a new `ck-security` package). One `tokenIsExpired` with one leeway constant.

---

## Cluster B — Roma `account-instance-direct.ts` is 12 wrappers around one helper (HIGH)

[`roma/lib/account-instance-direct.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/account-instance-direct.ts) is **779 LOC**, the biggest file in Roma. It exports 12 nearly-identical functions:

- `writeSavedConfigToTokyo`
- `createAccountInstanceInTokyo`
- `saveAccountInstanceInTokyo`
- `duplicateAccountInstanceInTokyo`
- `publishAccountInstanceInTokyo`
- `unpublishAccountInstanceInTokyo`
- `deleteAccountInstanceFromTokyo`
- `loadTokyoAccountInstanceDocument`
- `loadTokyoAccountInstanceServeStates`
- `loadTokyoAccountInstanceIndex`
- historical `loadTokyoWidgetCatalog`, now `listTokyoWidgetDefinitions`
- `loadSavedInstanceFromTokyo` (private)

Every one of them follows the identical pattern: build args → call `fetchTokyoJson({ path, method, body, fallbackReasonKey, fallbackDetail })` → normalize payload via a hand-written `normalize*` function → return `{ ok: true, value }` or a `RouteFailure`.

This is **boilerplate, not business logic.** Most of these wrappers exist because each was added in a different PRD with no consolidating pass.

**What the shape should be:**

```ts
// roma/lib/tokyo-client.ts
type TokyoOp<T> = {
  path: string;
  method: HttpMethod;
  body?: unknown;
  decode: (payload: unknown) => T | null;
  errorKey: string;
};

export async function callTokyo<T>(ctx: TokyoCallContext, op: TokyoOp<T>): Promise<TokyoResult<T>>;
```

One generic client. Each of the 12 wrappers becomes a 5-line typed decoder. The file shrinks by 60-70%. New CRUD operations don't need a 30-line PR template.

**Effort:** medium (touches all CRUD callers but mechanical). **LOC out:** ~400. **Risk:** low if smoke covers the saved/publish/unpublish paths.

---

## Cluster C — Roma route boilerplate (MEDIUM)

34 Roma routes. **34 copies of `export const runtime = 'edge'`.** 21 routes call `resolveCurrentAccountRouteContext` with virtually identical preamble:

```ts
const current = await resolveCurrentAccountRouteContext({ request, minRole: 'viewer' });
if (!current.ok) return current.response;
const { instanceId: instanceIdRaw } = await context.params;
const instanceId = String(instanceIdRaw || '').trim();
if (!instanceId) {
  return withSession(request, NextResponse.json({ error: { kind: 'VALIDATION', reasonKey: '...' } }, { status: 422 }));
}
```

The same param-extract → trim → empty-check → validation-envelope sequence is in roughly 18 routes.

**What the shape should be:**

```ts
export const POST = defineRomaRoute({
  minRole: 'viewer',
  params: { instanceId: trimmedString() },
  handler: async ({ instanceId, account, request }) => { ... },
});
```

A `defineRomaRoute` wrapper that owns: edge runtime declaration, account context resolution, param parsing/validation, error envelope shape, session cookie attach. The 34 routes drop from average ~50 LOC to ~20 LOC of pure business logic.

**Why this matters pre-GA:** every new product feature adds 30 LOC of boilerplate. Bugs hide in the boilerplate (each route re-implements validation slightly differently — e.g. some return 422 `VALIDATION`, some return 400 with no reasonKey).

**Effort:** medium. **LOC out:** ~600. **Risk:** medium — needs careful smoke because every route changes.

---

## Cluster D — Two account gateways doing the same job (LOW-MEDIUM)

- [`roma/lib/current-account-route.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/current-account-route.ts) — `resolveCurrentAccountRouteContext`, used by 21 routes.
- [`roma/lib/account-assets-gateway.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/account-assets-gateway.ts) — `resolveCurrentAccountAssetGatewayContext`, used by 4 routes.

Both resolve session → account → role. The assets gateway exists because asset routes need extra Tokyo-asset-control headers. That's a 10-line difference dressed as a 200-LOC separate module.

**Fix:** one `resolveAccountContext` returning a context object; asset routes call one extra helper to build asset-control headers on top. Removes ~150 LOC and one mental model.

---

## Cluster E — Berlin proxy fragmentation in Roma (MEDIUM)

Four files in `roma/lib/` for "talking to Berlin":

- [`berlin-product.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/berlin-product.ts) — **2 lines, just a re-export.** Transitional shim from an old rename, never deleted.
- [`berlin-product-shared.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/berlin-product-shared.ts) — 115 LOC, `fetchBerlinProductJson` helper
- [`berlin-proxy-route.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/berlin-proxy-route.ts) — 62 LOC, `proxyBerlinTextResponse`
- [`berlin-publish-containment.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/berlin-publish-containment.ts) — 30 LOC, one function

**Fix:** consolidate into `roma/lib/berlin-client.ts`. Delete the 2-line shim. Net ~50 LOC out and one import path instead of four.

---

## Cluster F — `account-locale*` quartet (MEDIUM)

Four files in `roma/lib/`, all about locale state:

- `account-locales.ts` (50 LOC) — normalization
- `account-locales-state.ts` (58 LOC) — read state
- `account-locales-sync.ts` (81 LOC) — write sync
- `account-l10n-intent.ts` (60 LOC) — intent loader

Total 249 LOC across four files exporting six functions. The split is arbitrary — they all operate on the same shape. This is the residue of three different PRDs each adding "their" locale file.

**Fix:** one `account-locales.ts` with three sections (normalize, read, write). Removes file proliferation; no behavior change.

---

## Cluster G — Venice embed loader is a 660-line template literal (HIGH)

[`venice/app/embed/v2/loader.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/venice/app/embed/v2/loader.ts) is **660 LOC, mostly one giant `\`...\`` template string of JavaScript** that gets served to customer pages. Inside the template:

- 11 `console.log` calls (will run on customers' websites)
- 3 silent `.catch(() => null)` failure paths
- All DOM manipulation done with `document.createElement` + manual style assignment (~120 LOC of inline style strings)
- Indentation is broken in several places (mixing tabs/spaces)

**This is the single highest customer-facing risk in the repo.** This file ships to every customer site. Bugs here are visible immediately and damage trust.

**Fix options:**

1. **Build-time bundle** — write the embed as real TypeScript, bundle with esbuild into a single IIFE at build time, ship the bundled output. ~80% of the template-string awkwardness goes away. This is what most embed SDKs do.
2. **Component-ize the error card** — the inline error UI is ~150 LOC of style strings; move to a single function with an object of styles. Removes most of the template-string size.
3. **Remove `console.log`** — these are production. They should be `if (DEBUG) console.log` at minimum.

**Effort:** medium (option 1 is half-day of bundler work; option 2 is mechanical). **Risk:** low if smoke covers the embed paths.

---

## Cluster H — `reasonKey` registry is implicit (HIGH)

145 unique `reasonKey` strings across the codebase. There is no central registry. There is no enum. There is no type. New PRDs invent new keys ad hoc:

- `coreui.errors.auth.required`
- `coreui.errors.auth.forbidden`
- `coreui.errors.account.notFound`
- `coreui.errors.instance.invalidPayload`
- `tokyo.errors.render.invalid`
- `roma.errors.auth.refresh_unavailable` (note: snake_case here vs camelCase elsewhere)

**Inconsistencies visible just from grepping:**
- Some use `snake_case`, some `camelCase` after the last dot.
- Some prefix with the service that emitted them (`tokyo.errors.*`, `roma.errors.*`), some prefix with the UI consumer (`coreui.errors.*`).
- Some use `coreui.upsell.reason.*` for non-error signals — different namespace mixed in.

**Why it matters:** Prague consumes these strings to render localized error messages. Every drift between emitter and consumer is a "key not found" bug visible to customers.

**Fix:** create `packages/ck-contracts/src/reason-keys.ts` exporting a `ReasonKey` union type and a `REASON_KEYS` const object. All emitters import from this. Prague consumes the same type. Adding a new key requires editing one file. Static check catches typos.

**Effort:** medium-low. **Risk:** very low (additive — string literals stay valid until you flip the type).

---

## Cluster I — Cross-service AI agent layout (MEDIUM)

SF copilot has three large files:

- [`widgetCopilotCore.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/sanfrancisco/src/agents/widgetCopilotCore.ts) — 646 LOC (after PRD 093 cleanup)
- [`l10nTranslationCore.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/sanfrancisco/src/agents/l10nTranslationCore.ts) — 487 LOC
- [`csPromptPayload.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/sanfrancisco/src/agents/csPromptPayload.ts) — 408 LOC

Plus eight smaller files in `sanfrancisco/src/agents/`. All three large files have:
- Their own `getSession` (the third one — and SF's `getSession` is not the same shape as Berlin's).
- Their own provider switch (DeepSeek/OpenAI).
- Their own JSON-mode prompt-payload shape.

**Fix:** extract `runAgent({ prompt, schema, provider })` as a shared SF primitive. Three big files become three small files plus one shared runtime. The provider-switching code (in `sanfrancisco/src/providers/`) should be the only place that mentions DeepSeek/OpenAI by name.

---

## Cluster J — Stability concerns (MEDIUM-HIGH)

### J1. Silent failure pattern: `.catch(() => null)` × 60+

Top offenders:
- [`tokyo-worker/src/routes/internal-render-routes.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/tokyo-worker/src/routes/internal-render-routes.ts) — 8
- [`berlin/src/auth/ticket-store.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/berlin/src/auth/ticket-store.ts) — 8
- [`prague/src/lib/pragueL10n.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/prague/src/lib/pragueL10n.ts) — 5

Some are legitimate (cache misses, optional fields). Many are not — they convert "Tokyo upstream failed" into "value is null" and the caller has no way to know which.

**Fix:** convert silent `.catch(() => null)` to `.catch((err) => { logError('context', err); return null; })` at minimum. Better: return a `Result<T, ReasonKey>` and force callers to handle the failure branch.

### J2. `as any` density

35 `as any` casts in [`sanfrancisco/src/telemetry.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/sanfrancisco/src/telemetry.ts) alone. 23 in [`prague/src/lib/blockRegistry.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/prague/src/lib/blockRegistry.ts). 22 in [`sanfrancisco/src/grants.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/sanfrancisco/src/grants.ts). Each `as any` is a place where the type system would catch a bug but isn't being asked to.

### J3. `console.log` in production paths

[`venice/app/embed/v2/loader.ts`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/venice/app/embed/v2/loader.ts) — 11. This is **customer-facing**. Every embed page logs to the customer's console.

### J4. Single-mega-commit pattern

PRD 092 and PRD 093 both shipped as one commit each. PRD 094 also (per `a954fd7c`). No bisectability. My PRD 092 and 093 reviews both flagged this; the four hotfixes between PRD 093 and now (`53837647`, `bc873831`, `a954fd7c`, `0977a09e`) suggest the mega-commit pattern is itself producing the post-ship instability.

---

## Cluster K — Documentation surface is bigger than the code it documents (MEDIUM)

- `documentation/` is **19,184 LOC** across 60+ markdown files.
- `Execution_Pipeline_Docs/` has **99 backlog PRDs**, 123 executed PRDs, 7 currently "executing".
- Several docs are stale (status lines from before commits that landed weeks ago).

**For a pre-GA codebase of ~52,000 LOC, that's a documentation-to-code ratio of ~37%.** Healthy for an enterprise platform; heavy for a pre-GA product.

**The risk is not the documentation existing — it's:**
- Stale docs gaslighting new contributors (PRD 092 still says "Draft" in `02-Executing/`).
- Multiple files claiming to be the source of truth (Tenets vs CONTEXT vs Overview vs RuntimeProfiles).
- Backlog PRDs that may have been silently superseded by other PRDs.

**Fix:** one "what's true today" doc (CONTEXT.md), every other doc references it. Quarterly cull of executed PRDs into a single rollup. Archive backlog PRDs that haven't been touched in 60 days.

---

## Cluster L — Schizophrenic flows (carry-over from earlier audits)

Most are removed. Two remain worth calling out at the holistic level:

1. **Cookie domain logic is in Roma only.** [`roma/lib/auth/session.ts:104`](https://github.com/CKsangiacomo/clickeen/blob/0977a09e/roma/lib/auth/session.ts#L104) decides `.dev.clickeen.com` vs host-scoped. If Bob, Venice, or Prague need to read these cookies, **they have to re-implement this logic identically**. The cookie scope rule should be one constant in `ck-contracts` or a tiny `ck-cookies` package.

2. **`berlin-product.ts` is a 2-line ghost file.** Re-exports a type from `berlin-product-shared.ts`. Pure transitional debt; deletable today.

---

## Recommended Pre-GA Plan (prioritized)

### Wave 1 — Foundation consolidation (1-2 days, low risk)

| Task | Effort | LOC out | Risk |
| --- | --- | --- | --- |
| Move `isRecord`, `asTrimmedString`, `isStringArray`, `isNonEmptyString`, JWT decode/expiry, `sha256Hex` (where not cycle-blocked) to canonical in `ck-contracts`. Add ESLint rule. | S | ~200 | Low |
| Delete `roma/lib/berlin-product.ts` ghost shim; consolidate Berlin proxy files into one `berlin-client.ts`. | XS | ~50 | Low |
| Consolidate four `account-locale*` files in Roma. | S | ~30 (file count, not LOC) | Low |
| Create `packages/ck-contracts/src/reason-keys.ts` with `ReasonKey` union type. Migrate emitters opportunistically. | M | additive | Very low |
| Remove `console.log` from `venice/app/embed/v2/loader.ts`. | XS | -11 lines | Low |

### Wave 2 — Boilerplate compression (2-3 days, medium risk)

| Task | Effort | LOC out | Risk |
| --- | --- | --- | --- |
| Replace `roma/lib/account-instance-direct.ts` 12 wrappers with one `callTokyo<T>` generic client. | M | ~400 | Medium |
| Add `defineRomaRoute` wrapper. Migrate 21 account routes. | M | ~600 | Medium |
| Merge two account gateways into one `resolveAccountContext`. | S | ~150 | Low |
| Convert top-offender `.catch(() => null)` sites in `tokyo-worker/src/routes/internal-render-routes.ts` and `berlin/src/auth/ticket-store.ts` to logged failures. | S | additive | Low |

### Wave 3 — Embed loader hardening (1 day, low-medium risk)

| Task | Effort | Risk |
| --- | --- | --- |
| Rewrite `venice/app/embed/v2/loader.ts` as real TypeScript bundled by esbuild into IIFE. | M | Low-medium (covered by Venice public embed smoke) |
| Extract error-card UI into typed helper. | S | Low |

### Wave 4 — Process (ongoing)

| Task | Why |
| --- | --- |
| **Stop shipping mega-commits.** PRD 092, 093, 094 all single commits. Hotfixes after each. Slice-per-commit is in three prior reviews. | Bisectability + post-ship safety |
| **Default `Result<T, ReasonKey>` for cross-service calls** instead of throwing or returning `null`. | Forces callers to handle errors |
| **Quarterly cull of executed PRDs** into one rollup doc; delete backlog PRDs untouched > 60 days. | Documentation gaslighting |
| **One CONTEXT.md as truth source**; every other doc references it. | Stops doc drift |

---

## What This Audit Does Not Recommend

- **No new architecture.** The Roma → Berlin/Tokyo → Venice spine is correct. Tenets T1-T10 are correct. Service boundaries are correct.
- **No new packages** unless the cycle-blocker forces one (`ck-primitives` for the `l10n` ↔ `ck-contracts` cycle, if you choose to break it).
- **No rewrites.** Every cluster above is mechanical consolidation.
- **No new abstractions.** The fixes are "use the helper you already have" and "delete the file that's a shim".

The point of pre-GA cleanup is not to make the code more sophisticated. It's to make it more boring. Every cluster above moves the system toward **fewer concepts**, not more.

---

## Final Verdict

| Dimension | Grade | Comment |
| --- | --- | --- |
| Architecture intent | A | Spine is right; tenets honored. |
| Service boundaries | A- | Clean; one ghost shim file remains. |
| Cross-service consolidation | C+ | Primitive drift across 28 files; one mega-CRUD file; route boilerplate. |
| Stability hygiene | B- | 60+ silent failures; embed has production `console.log`. |
| Documentation health | B- | Volume is fine; staleness is the issue. |
| Process discipline | C+ | Three consecutive mega-commits with post-ship hotfixes. |
| **Overall pre-GA readiness** | **B** | Ship-able. Wave 1 + 2 + 3 above (5-7 days of focused work) moves it to A-. |

**Bottom line:** the architecture is right. The code is fractally duplicated because no PRD ever owned consolidation. Five to seven days of focused Wave 1-3 work removes ~1,400 LOC, eliminates the primitive-drift bug class, and hardens the customer-facing embed surface. That is the most leveraged pre-GA work available, and none of it requires changing the product.
