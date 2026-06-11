# PRD 107 — Fallback Eradication

Status: PLANNING — audit complete, dispositions await product-owner ratification
Owner: All services (cross-cutting)
Date: 2026-06-10
Numbering note: the product owner ordered this written as PRD 107. A planning doc
named `107__PRD__SEO_GEO_Static_Build_And_Page_Block_Strategy.md` already exists;
one word from Pietro renumbers either. Until then this doc is the active 107.

Audit method: four parallel subagents read EVERY source file in their area
(2026-06-10): (A) sanfrancisco + ck-policy + ck-contracts + l10n — 47 files;
(B) bob + dieter components — full tree; (C) roma + berlin + admin/functions —
152 files; (D) tokyo-worker + widget runtime + widget-shell + scripts — 85 files.
Every finding carries file:line. Verdicts: **ABOMINATION** (silent substitution of
product/user state — P0 by tenet), **GRAY** (judgment call, disposition needed),
**OK-BY-DESIGN** (verified non-finding).

## Why (the product rule)

Clickeen is an editor. An editor makes one promise: **what you set is what you
get.** A fallback — any code that silently substitutes, heals, defaults, or invents
a value when the real one is missing or invalid — breaks that one promise. There is
no degraded mode for an editor; an editor that shows something other than what you
told it is not an editor. Fix on sight, P0.

What is NOT a fallback (the three legitimate patterns, used as the bar everywhere):
1. **Fail visibly:** typed error at a named boundary, 404 for missing artifacts.
2. **Creation-time defaults:** factory defaults written INTO state when an
   instance/account is created (one atom, persisted).
3. **Declared contracts:** spec-declared normalization rules; ratified,
   telemetry-recorded alternates (the D8 failover contract).

## Headline counts

| Area | ABOMINATION | GRAY | Exemplary modules |
| --- | --- | --- | --- |
| San Francisco + ck-policy + ck-contracts + l10n | 9 | 28 | ck-policy matrix asserts; translated-value primitives |
| Bob + Dieter | 5 | ~34 | compiler throw-discipline; edit/ops strict coercion |
| Roma + Berlin + admin/functions | 7 | 22 | DevStudio policy write path (zero findings) |
| Tokyo-worker + widget runtime + shell + scripts | 5 | 26 | clk.live 404 serving; strict overlay reads; FAQ runtime |
| **Total** | **26** | **~110** | |

The single deepest pattern: **the widget runtime has two contradictory cultures in
one directory** — `header.js`, `typography.js`, and every widget client throw on
invalid state (FAQ's header comment literally states the rule), while `fill.js`,
`stagePod.js`, `coreSize.js`, `localeSwitcher.js`, `appearance.js` silently heal the
same classes of error. Same split in Bob: the compiler throws, the session loader
heals. Eradication = converge every module onto the strict culture that already
exists next door.

---

## PART I — THE 26 ABOMINATIONS (P0, fix-on-sight)

### A. Bob — the editor heals what it opens

| # | Where | The lie | Fix |
| --- | --- | --- | --- |
| AB-1 | `bob/lib/session/sessionConfig.ts:46` — stored config silently merged with compiler defaults on every session open; dirty-signature computed AFTER healing (`useSessionBoot.ts:56`) so the heal is undetectable and unsaveable | User's saved widget is missing a key → editor opens clean, shows the default, never flags drift. **Every widget Bob opens is silently healed.** | Fail typed at session boot (`coreui.errors.instance.config.invalid` + missing paths) |
| AB-2 | `sessionConfig.ts:49-61` — coerce failure → `continue` (invalid value kept, session loads clean); coerce success silently rewrites values in memory | Stored `pod.contentWidth = "abc"` → zero error, garbage rendered | On `!coerced.ok` → SessionError listing bad paths |
| AB-3 | `dieter/components/dropdown-fill/dropdown-fill-gradient.ts:564-575` — radial/conic/css gradients rebuilt as **linear with default red→blue stops** on any commit | User nudges the angle slider on a radial gradient → state silently becomes a default linear gradient | Reject non-linear/css with visible "unsupported" state, or round-trip faithfully |
| AB-4 | `bob/components/td-menu-content` (`dom.ts:87-113`, `useTdMenuHydration.ts:82-86`) — control CSS/JS load failures and hydrator exceptions swallowed in production | A control script 404s → user edits through a dead panel; edits silently do nothing | Visible panel error in all envs |
| AB-5 | `bob/lib/api/compiled-widget-route.ts:102-103` — support file referenced by widget.html fails to fetch → silently omitted from the package | Compiled payload ships incomplete widget, no error anywhere | 502 naming the failing URL (keep silent-skip only for declared-optional shell probes) |

### B. San Francisco — the plane invents policy

| # | Where | The lie | Fix | Ownership |
| --- | --- | --- | --- | --- |
| AB-6/7/8 | `l10nTranslationCore.ts:209,253,324` — `provider = 'deepseek'` default params | Every error attributed to deepseek regardless of who ran the job | Required param | **Already owned by 108A1 Step 7** |
| AB-9 | `l10n-account-routes.ts:279` — `?? 'deepseek'` chain | Account never authorized deepseek; errors stamped with it anyway | Derive from `usage.provider` only | **108A1 Step 7** |
| AB-10 | `l10nPragueStrings.ts:117` — `env.OPENAI_MODEL ?? 'gpt-5.2'` | Policy matrix decorative; env var decides Prague copy | requireEnvVar / policy | **108A1 Step 7** |
| AB-11 | `grants.ts:239` — missing `budgets.timeoutMs` → invented 20s (while `maxTokens` two functions up correctly throws) | Tier budget says 8s; issuer omission silently grants 20s of model time | Throw `GRANT_INVALID` (symmetry with maxTokens) | this PRD |
| AB-12 | `widgetCopilotCore.ts:567` — model ops filtered by shape check, survivors applied, **success message still claims the full edit** | "Make the title red and bigger" → 1 of 2 ops applied, copilot says "Done!" | Any invalid op → typed `invalidStructuredEditError` | this PRD (coordinate with 108B1 Step 4 rewrite) |
| AB-13 | `widgetCopilotCsProduct.ts:173-175` — link-ops silently discarded when prompt lacks trigger words; model's "I've updated the link" message still shipped | User asks to change a URL without saying "link" → nothing applied, success claimed | Filter fires → force clarify outcome + honest message | this PRD (coordinate 108B1) |
| AB-14 | `ck-contracts/index.ts:429-444` — locale-switcher placement healed (bad position → `top-right`) | User set bottom-left; typo'd stored value renders top-right forever | Return null → caller fails typed | this PRD |

### C. Roma + Berlin — the orchestrator improvises

| # | Where | The lie | Fix |
| --- | --- | --- | --- |
| AB-15 | `roma/lib/berlin-publish-containment.ts:25` — malformed Berlin containment payload → `active: false` | **Abuse-frozen account publishes anyway** — the kill-switch fails open on payload shape | 502 unless `active` is literally boolean |
| AB-16 | `roma/app/api/account/pages/[pageId]/publish/route.ts` — page publish never checks containment at all (instance publish does) | Contained account can't publish one widget but can publish a page of them | Same containment gate + 403 |
| AB-17 | `roma/lib/widget-public-package.ts:209-211` — missing stylesheet silently omitted from published package | Widget publishes unstyled, reports success | Throw `packageMissing:<key>` → 422 |
| AB-18 | `widget-public-package.ts:261` — same for JS runtime modules | Widget ships without the script that makes it work | Same |
| AB-19 | `roma/lib/account-page-direct.ts:139-144` — invalid geo→locale rules silently dropped | User mapped Brazil→pt; slightly-off stored rule → Brazilians get default locale forever, no error | Invalid rule → 502 `page.invalidPayload` |
| AB-20 | `roma/app/api/account/pages/route.ts:28-39` — provided-but-invalid `robots` healed to `noindex,nofollow` | User typos robots value → page silently noindex; they never learn why Google ignores it | 422 when present-but-invalid (absent = creation default, fine) |
| AB-21 | `roma/lib/request-ops.ts:187-188` + `berlin/src/http/request-ops.ts:110-118` — missing USAGE/SESSION KV binding → rate limiting silently off (incl. login brute-force protection) | Ops believes limits exist; a binding typo removes them with zero signal | 500/503 `misconfigured` at the boundary |

### D. Tokyo-worker + widget runtime — storage heals, runtime paints lies

| # | Where | The lie | Fix |
| --- | --- | --- | --- |
| AB-22 | `tokyo-worker/src/domains/account-widget-defaults.ts:190-194` — corrupt/missing stored account defaults → silently seeded from factory defaults | Account customized its defaults; corruption → new instances quietly seed factory state as if customization never happened | Throw `widgetDefaults.invalid:<type>` |
| AB-23 | `account-widget-defaults.ts:262-264` — normalizer's healed output **persisted back on read** | Storage rewrites the account's document on read, destroying the evidence of AB-22 | Reads are read-only; byte-diff → typed failure |
| AB-24 | `tokyo-worker/src/domains/pages/source.ts:107-129` — corrupt pages index → healed to empty, then **persisted** on next save | Owner has 10 pages; index corrupts → "no pages", and the next save permanently erases the other 9 summaries | Stored-but-invalid index → typed `page.indexInvalid`; empty only when key truly absent |
| AB-25 | `tokyo/product/widgets/shared/fill.js:106-113` — malformed image fill → transparent background, no error | Owner set an image background; visitors see transparent. `header.js` throws for the same error class; `fill.js` heals | Throw `[CKFill] image fill requires src` |
| AB-26 | `tokyo/product/widgets/shared/appearance.js:33-45` — CKFill missing → fill objects coerced via `String()` → literal `"[object Object]"` styling | Module load failure renders garbage CSS silently instead of failing like every sibling module | Throw `[CKAppearance] Missing CKFill` |

---

## PART II — GRAY INVENTORY (disposition needed, compact)

Recurring families first — one disposition decision each, then the per-file list.

**Family G1 — Fabricated telemetry/usage (8 sites).** Zero-token Usage records and
`provider:'unknown'` invented on failure paths: `l10n-account-routes.ts:169-183`,
`index.ts:69-78`, `instance-translation-queue.ts:51-60,138`, `deepseek.ts:76`,
`openai.ts:196`. Disposition lean: usage-less events (`usage: null`), never invented
zeros — the learning/billing stream must not contain fiction.

**Family G2 — Swallowed audit/learning writes (6 sites).** `SF_EVENTS` missing →
silent no-op; `.catch(console.error)` on event/D1/R2 writes; malformed queue message
ack'd with no DLQ: `l10n-account-routes.ts:195,224`, `index.ts:148-155,318-333`,
`telemetry.ts:326`. Lean: fail healthz when bindings absent outside local; retry/DLQ
on write failure.

**Family G3 — Widget runtime soft modules (12 sites).** `fill.js` gradient
kind/angle/color heals (:58,:90,:139), video → cleared layer (:116);
`stagePod.js` floating anchor/offset → bottom-right/24 (:260), padding → 0 (:49),
canvas → wrap (:218), alignment → center (:428), white-underlay branch (:228),
CKFill presence skips (:400); `coreSize.js` fixed/responsive invented dimensions
(:29,:35); `appearance.js` radius/shadow heals (:19,:52); `localeSwitcher.js`
enum + appearance heals (:65,:85); `branding.js:154` missing flag → badge shown;
`socialShare.js` locale copy → English (:46), missing channel map → enabled (:129);
`typography.js:286,322` missing presets → 'normal'; `previewL10n.js:36-95` missing
overlay → base state shown as translated (editor preview). Lean: converge ALL onto
the throw-on-invalid convention of `header.js`/widget clients; one PRD slice.

**Family G4 — Bob editor-chrome and hydrator silent-skips (~20 sites).** Dieter
hydrators `return null` on missing DOM (repeater:244, object-manager:160,
dropdown-fill:153, dropdown-border:77, dropdown-shadow:97, dropdown-actions:60,
choice-tiles:425, textrename:707, dropdown-upload:100 — while textedit/dropdown-edit
correctly throw); corrupt JSON → `[]`/null silently (repeater:52,308,
object-manager:312, fieldValue.ts:35 — items render as zero items);
fill-parser heals corrupt media objects (:18-60) and `resolveModeFromFill` first-mode
substitution (:140); dropdown-border legacy healing (:350) and enable-over-invalid
resets (:137); media-controller commit resets fit/loop to hardcoded defaults
(:149-199); sanitizers strip content silently (dropdown-edit:540, textedit-content:69);
slider min-substitution (useTdMenuBindings:246); showIf parse failure → always
visible (showIf.ts:276); bulk-edit flags fail OPEN — premium columns render without
entitlement (bulk-edit.ts:124); compiler GRAY: allowImage path-heuristic
(controls.ts:276), stencil label defaults (stencils.ts:199+), silent preset/theme
drops (compiler.server.ts:157,194), `{{token}}`→'' (stencil-renderer:44), coerce
rule with no default keeps invalid value (normalization.ts:63). Lean: hydrators
converge on throw (A4 fix makes them visible); fail-closed for entitlement flags;
compile errors for spec-author mistakes.

**Family G5 — Roma/Berlin payload healing and fail-open plumbing (~20 sites).**
Tokyo ack healing (`account-instance-direct.ts:533,604,718`, displayName mining
:223); createdAt rewritten on save (`account-page-direct.ts:253`); page create
hardcodes `defaultLocale:'en'` (pages/route.ts:69); copilot failures returned as
HTTP 200 chat strings (copilot route:120-166, account-copilot.ts:283, outcome:27);
cookie lifetimes invented (session.ts:218, cookies.js:66); logout best-effort +
`ck-authz-capsule` survives (logout:28); Berlin 500 → "please sign in"
(berlin-product-shared.ts:88); upload filename/content-type invented
(upload/route.ts:54,178 + tokyo asset-utils:65); corrupted usage counter → 0
(account-limit-usage.ts:39); KV fail-open limiter reads (request-ops:141, berlin:120);
Berlin session timestamp healing feeding the refresh grace window (kv.ts:36);
KV outage labeled 401 (kv.ts:55); `BERLIN_ISSUER` default 'berlin.local' minting AND
verifying (types.ts/config); silent rotation-key drop (jwt.ts:117); corrupted
members/invitations vanish from Team (state.ts:419, invitations.ts:201);
`lang="und"` (page-package-composer:203); published runtime's `?locale` →
baseLocale substitution (widget-public-package:230).

**Family G6 — Storage corruption-as-absence (5 sites).** `storage.ts:33,40`
corrupt JSON → "not found"; registry rows filtered (registry.ts:120); overlay docs
filtered (overlays.ts:121); translation marker catch → undefined
(operations.ts:493); CDN purge fire-and-forget + 1-day SWR (operations.ts:83,
package-files.ts:146, clk-live-routes.ts:66). Lean: corruption gets its own typed
reason (`*.corrupt` not `*.notFound`); purge becomes a checked publish step.

**Family G7 — SF copilot/text plumbing (7 sites).** Refusal-as-content
(openai.ts:181); placeholder-spacing heal + JSON salvage (l10nTranslationCore:110,135);
richtext type coerced to string (l10n-account-routes:109); grant policy entries
pruned (grants.ts:122); language→en pinning (language.ts:158, core.ts:446);
prompt truncation untracked (csPromptPayload:552); temperature default 0.2
(chat.ts:86); fail-open turn ceiling on missing matrix key (ai-runtime.ts:299);
fail-open token expiry (ck-contracts:148); optimistic `isCurrentBaseContent`
(translation-product-state:157); timezone heal-to-first (user-settings-geo:280);
asset metadata invention incl. fresh createdAt (ck-contracts:237);
materializeConfigMedia keeps stale src silently (ck-contracts:510).

**OK-BY-DESIGN (verified, keep):** clk.live 404 serving; strict overlay reads;
widget-shell validators; ck-policy matrix asserts; translated-value primitives;
compiler throw paths; edit/ops strict coercion; creation-time factory defaults;
`null = unlimited` declared limits semantics; copilot local preludes (labeled
`provider:'local'`); idempotent logout; free-tier system-locale substitution
(declared policy, surfaced via `usesSystemChosenTargetLocale`); DevStudio policy
write path (zero findings — the model to copy).

---

## PART III — Eradication plan (step-gated)

| Step | Action | Completion evidence | NOT_ALLOWED |
| --- | --- | --- | --- |
| 0 | Pietro ratifies: (a) the GRAY family dispositions (G1–G7 leans above); (b) ownership splits — AB-6..10 stay in 108A1 Step 7, AB-12/13 coordinate with 108B1 Step 4; (c) priority order below. | Decision record in this PRD. | Starting fixes with undecided dispositions. |
| 1 | **Kill-switch + published-output abominations** (the visitor-facing lies): AB-15/16 (containment), AB-17/18 (package files), AB-25/26 (runtime fill/appearance), AB-24 (pages index data loss), AB-22/23 (defaults heal-on-read). | Each fix lands with a regression test proving the typed failure fires (seeded corrupt fixture per item); commit per service slice. | Fixing by adding more defaults; warn-only modes. |
| 2 | **Editor-trust abominations:** AB-1/2 (session healing — coordinate with 108B1 Step 1 compiler work), AB-3 (gradient destruction), AB-4 (hydration swallowing), AB-5 (package omission), AB-14 (switcher heal). | Seeded-corrupt-instance fixture: Bob opens it → visible typed error, not a healed editor; gradient round-trip test; hydration failure renders a visible panel error. | Healing "just for the transition." |
| 3 | **Plane abominations not owned elsewhere:** AB-11 (timeout invention), AB-12/13 if 108B1 hasn't landed them first. | Unit tests: grant missing timeoutMs → `GRANT_INVALID`; invalid op in model output → typed error, zero ops applied. | — |
| 4 | **GRAY family G3+G4 convergence** (runtime modules + dieter hydrators onto throw-culture). One slice per module, FAQ's convention as the template. | Per-module: seeded invalid state → thrown named error; `rg` for the healed patterns → 0 in that module. | Per-widget exceptions. |
| 5 | **GRAY families G1/G2/G5/G6/G7** per ratified dispositions, ordered: security-adjacent first (Berlin session healing, fail-open limiters, issuer defaults, logout capsule), then storage corruption labeling + purge step, then telemetry honesty, then chrome cosmetics. | Family-by-family commits with tests; ledger updated per family. | Batch-fixing without tests. |
| 6 | **The guard:** extend `pr-architecture-gates` with a fallback-pattern lint for the highest-signal shapes (`?? '` / `\|\| '` on config/policy/state paths in named directories; `catch` blocks returning defaults in runtime modules) — advisory list reviewed in PR, not auto-fail (the pattern is too context-dependent for a hard gate; the hard gate is the per-fix regression tests). | Lint output in CI; zero new ABOMINATION-class patterns in touched files. | Pretending a grep can adjudicate fallbacks; skipping the human/agent review of the advisory list. |

## Acceptance

- All 26 abominations fixed with regression tests proving typed failure at the named
  boundary (or explicitly re-dispositioned by Pietro in Step 0).
- Every GRAY item carries a ratified disposition: fixed, declared-as-contract (and
  documented), or accepted with a name and reason. None remain silent.
- The widget runtime has ONE culture: every shared module throws like header.js.
- The published-package path cannot ship a widget missing declared CSS/JS.
- Publish containment cannot fail open, on any payload, on any route.
- An editor session can never open healed state as clean.

## Planning review

1. **Elegant/scalable?** Yes — convergence onto patterns that already exist in the
   codebase (FAQ runtime, compiler throws, DevStudio write path); no new machinery
   except one advisory lint.
2. **Tenet-compliant?** This PRD IS the tenet ("No Fallbacks") executed.
3. **Avoids over-architecture?** Yes — no framework; fix-by-fix with tests; the
   guard is advisory because greps cannot adjudicate intent.
4. **Moves toward goals?** Directly: the editor's one promise (what you set is what
   you get) becomes mechanically true, and every future agent inherits a codebase
   with one visible-failure culture to copy.
