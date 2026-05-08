# Clickeen Codebase — Staff Engineering Review

Reviewer: Staff peer review, same lenses as PRD 85B / 85C-D-E reviews
Repo: github.com/CKsangiacomo/clickeen (HEAD on default branch at time of review)
Scope: 7 areas — widget native runtime, Bob compiler, Bob editor (panels/controls/session), Berlin auth, Roma orchestration, ck-policy, Tokyo + tokyo-worker

---

## 0. TL;DR

Clickeen's codebase is in materially better shape than most early-stage SaaS platforms I review. Tenets are real (T0 "no fallbacks" is enforced in widget code, not just docs), the orchestrator/CDN/worker split is honest, and there are zero TODO/FIXME/HACK markers across ~30k LOC of TypeScript and JavaScript I inspected. ck-policy is a genuinely well-designed control plane.

The platform has four real problems, in order of severity:

1. The Bob compiler is too clever. 2,064 LOC of regex-based HTML parsing for tooldrawer tags is the largest single concentration of risk in the codebase and the only place where T0 (no fallbacks) is bent in practice.
2. Three Dieter components (dropdown-fill 3,404 LOC, dropdown-upload 1,920 LOC, textedit 1,249 LOC) are 5–10× larger than every other component in the same library. Either Dieter has a missing primitive, or these three are doing widget-level work in a design-system layer.
3. ck-policy/gate.ts is a 36-line stub that returns allow:true. The real enforcement lives in limits.ts (379 LOC) and at the Roma route layer. The gate file should either be deleted or made to do what its name says — the current state is a footgun for a future engineer who wires "the gate" expecting it to gate.
4. typography.js (954 LOC) in the shared widget runtime is 2× larger than the next-largest shared module. For a runtime that the FAQ widget treats as "complete truth, no fallbacks," 954 lines of font/typography logic loaded by every widget instance is a budget violation waiting to happen.

Everything else is healthy. Berlin is the strongest area in the codebase. Roma is appropriately dumb. tokyo-worker has clean route dispatch and a credible queue model. Recommendations at the end.

Overall verdict: Approve the architecture. Land the four fixes above before scaling Bob to a second editor surface or onboarding a second AI provider in production.

---

## 1. Lens 1 — Elegant engineering and scalability

### 1.1 What is genuinely elegant

**FAQ widget as gold standard (Area 1).** widget.client.js (853 LOC, [tokyo/product/widgets/faq/widget.client.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/faq/widget.client.js)) opens with a comment that says "Assumes canonical, typed state from the editor; no runtime fallbacks/merges" and then the code actually does that. It throws on missing DOM nodes, it does not merge defaults at runtime, it accepts overrides only via a single `ck:copy-overrides` postmessage channel for live editing in Bob. spec.json (690 LOC) holds normalization + defaults; widget.client.js is pure runtime. This is the cleanest expression of T0 + T1 in the codebase and it should be the template every other widget is mechanically conformed to.

**Berlin auth (Area 3).** 7,063 LOC across [berlin/src](https://github.com/CKsangiacomo/clickeen/tree/main/berlin/src) is appropriately sized for what it does (OAuth start/callback/finish, ticket store on a Durable Object, identity reconcile, contact methods, account membership, governance, locales, RS256 JWT minting with key rotation via kid = SHA-256 of public material). The split between `auth/`, `identity/`, `account-management/`, `bootstrap/`, `crypto/` is the right split. routes.ts in auth (531 LOC) and account-management (682 LOC) are at the upper edge of "one file" but they are route registries, not logic — the logic is in tickets.ts, ticket-store.ts, reconcile.ts, contact-methods.ts, invitations.ts, members.ts. RS256 with PKCS8/SPKI imports and JWKS publication is exactly what an editing platform needs and is what Roma + tokyo-worker consume via packages/ck-policy/authz-capsule.ts.

**ck-policy registry (Area 5).** [packages/ck-policy/src/registry.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/registry.ts) (218 LOC) declares 13 ENTITLEMENT_KEYS, 2 FLAG_KEYS, 11 PLAN_LIMIT_KEYS as exhaustive string-literal unions, with ENTITLEMENT_META carrying owner + note for each. This is the right shape: one source of truth, type-narrow, owner attribution, and the matrix.ts + entitlements.matrix.json pair makes per-tier deltas reviewable in a diff. resolvePolicy(profile, role) in policy.ts (152 LOC) is a pure function from (tier, role) to {flags, limits}. This is the spine of the platform's commercial model and it is well-built.

**tokyo-worker route dispatch (Area 6).** [tokyo-worker](https://github.com/CKsangiacomo/clickeen/tree/main/tokyo-worker) splits into asset-routes / l10n-routes / internal-render-routes / render-routes via route-dispatch, with auth.ts verifying Roma's authz capsule via cached JWKS (`__CK_TOKYO_ACCOUNT_CAPSULE_JWKS_V2__`) and a constant-time header check for internal traffic via `x-ck-internal-service`. The queue handler enumerates exactly seven operations (write-config-pack, write-text-pack, write-meta-pack, sync-live-surface, enforce-live-surface, delete-instance-mirror, sync-instance-overlays) — this is a real bounded set, not an open kitchen sink.

**Code health.** Across bob, roma, berlin, tokyo, tokyo-worker, sanfrancisco, packages: zero TODO, zero FIXME, zero HACK comments. console.log counts are 5–15 per service. For a platform that has been built by a small team under time pressure, this is unusual and worth protecting.

### 1.2 What is not elegant

**The Bob compiler (Area 2).** [bob/lib/compiler.server.ts](https://github.com/CKsangiacomo/clickeen/blob/main/bob/lib/compiler.server.ts) (772 LOC) + compiler.shared.ts (108) + compiler/{controls.ts 370, stencils.ts 476, stencil-renderer.ts 201, assets.ts 137} = 2,064 LOC. This is the single largest concentration of complexity in the codebase. The compiler:
- Parses widget.html with regex to find `<bob-panel>`, `<tooldrawer-cluster>`, `<tooldrawer-field>`, `<tooldrawer-eyebrow>` tags
- Fetches themes from Tokyo at compile time (network call inside the compiler)
- Walks spec.json to derive controls and panels
- Renders stencils via a separate stencil-renderer with its own caching layer (loadComponentStencil cache as Map<string, Promise>)

Two issues. First, regex-based HTML parsing is the classic place where you discover three months later that someone wrote `<bob-panel id="x">` with a stray attribute and the regex silently drops the panel. Second, the compiler being a network client of Tokyo at compile time couples Bob's edit experience to Tokyo's availability for what should be a static build step. The themes should be inlined into the compiled artifact at publish time and read locally in the editor.

**Three giant Dieter components.** dropdown-fill.js (3,404 LOC), dropdown-upload.js (1,920 LOC), textedit.js (1,249 LOC) at [tokyo/product/dieter/components](https://github.com/CKsangiacomo/clickeen/tree/main/tokyo/product/dieter/components). The next-largest component is dropdown-edit at 751 LOC. The mean of the other 17 components is ~250 LOC. A 13× ratio between the biggest component and the median is a structural smell: either the component is doing widget-level work that belongs in the widget or in a Bob panel, or there is a missing primitive that all three of these big files are reinventing internally. dropdown-fill at 3,404 LOC almost certainly contains a color picker + gradient editor + image picker + theme picker — those should be four components composed by a `dropdown` shell that is ~200 LOC.

**typography.js in shared widget runtime.** [tokyo/product/widgets/shared/typography.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/shared/typography.js) is 954 LOC. The next-largest shared module is stagePod.js at 468 LOC. Every widget instance loads the shared runtime. 954 lines of typography logic is a runtime payload tax on every embed and a place where T1 (widget files are complete truth) starts to leak — typography decisions made in the shared runtime are not in any single widget's spec.json.

**account-instance-direct.ts in Roma.** [roma/lib/account-instance-direct.ts](https://github.com/CKsangiacomo/clickeen/blob/main/roma/lib/account-instance-direct.ts) at 701 LOC is the largest single non-route file in Roma. Given that Roma's job is to be a dumb pipe (T2), 700 lines of "direct" instance manipulation is worth a conformance check: how much of this is orchestration (legitimate) vs. business logic that should live in Berlin or in a typed contract in ck-contracts?

### 1.3 Scalability

The architecture scales. The hot path is: embed → tokyo (CDN, static + edge) → tokyo-worker only when an authz capsule is present → Roma only for account-shell pages → Berlin only at auth boundaries → Sanfrancisco only when AI is invoked. Each layer can scale independently and the JWKS-cached capsule verification in tokyo-worker means the CDN does not synchronously call Berlin per request. The queue-based mirror sync (write-config-pack, sync-live-surface) decouples publish latency from CDN propagation.

The non-scaling risk is Bob, not the runtime. If a customer publishes 10× more widget types, the compiler's regex scan + theme fetch + stencil renderer triple-pass is what gets slower, not the embeds.

---

## 2. Lens 2 — Compliance to architecture and tenets

I read [Tenets.md](https://github.com/CKsangiacomo/clickeen/blob/main/documentation/architecture/Tenets.md) and AGENTS.md against the actual code. Conformance is high. Specific deltas:

**T0 — No fallbacks for instance identity/config.** PASS in widgets, FAQ widget.client.js explicitly assumes canonical typed state. PARTIAL FAIL in Bob compiler — the regex parsing layer absorbs malformed input rather than failing visibly (T3). Recommendation: any widget.html that does not parse cleanly should fail the compile, not produce a panel-less editor.

**T1 — Widget files are complete truth.** PASS for FAQ. UNCLEAR for the shared runtime. typography.js + branding.js + header.js + stagePod.js + localeSwitcher.js + fill.js together are 1,500+ LOC of behavior that no individual widget's files describe. Either the shared runtime needs to be declared a tenet exception ("complete truth = widget files + a versioned shared runtime contract") or its surface needs to be minimized.

**T2 — Orchestrators are dumb pipes.** PASS for Roma's middleware (60 LOC, cookie gate, public/authed prefix list, that is the entire policy). MIXED for roma/lib/* — 30+ files including account-instance-direct.ts (701) and ai/account-copilot.ts (HMAC AI grant minting). The AI grant minting in particular is policy-adjacent; it should live in ck-policy or be called via a thin Roma wrapper, not be implemented in roma/lib.

**T3 — Fail visibly.** PASS in Berlin and tokyo-worker (typed result envelopes, explicit reasonKey on 422 in copilot route). PARTIAL FAIL in Bob compiler regex paths.

**T4 — Dieter tokens.** Cannot verify without diffing component CSS against tokens; structurally the layer exists at tokyo/product/dieter/tokens. The three giant components are the place to check first — they are the most likely to have hardcoded values.

**T5 — Boring SaaS shells from minted truth.** PASS. Roma is recognizably boring Next.js with edge middleware. No exotic state management. Domain components (profile-domain 584 LOC, widgets-domain 579, assets-domain 556, builder-domain 534) are within the same band, which is itself a signal of consistent shaping.

**AGENTS.md non-negotiable boundaries.** The cleanest evidence of conformance is the INTERNAL_SERVICE_HEADER pattern in tokyo-worker auth.ts and the JWKS-signed authz capsule in ck-policy — boundary crossings are explicitly cryptographically attested, not assumed.

---

## 3. Lens 3 — Overarchitecture and unnecessary complexity

### 3.1 Real overarchitecture

**The Bob compiler.** As described above. 2,064 LOC for "load widget files, derive panels and controls, prepare for the editor" is too much. A compiler this size is justified for a real DSL with type inference; tooldrawer tags are not a DSL of that complexity. The honest version is probably closer to 600–800 LOC: parse spec.json (which already has normalization + defaults), generate panels and controls from spec, treat widget.html as a template not a source of truth for editor structure.

**ck-policy/gate.ts.** 36 lines that always return `{allow: true}` ([packages/ck-policy/src/gate.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/gate.ts)). This file should not exist in its current form. Either delete it and have callers go directly to limits.ts + role checks, or make it do what its name implies. A future engineer reading the call graph will assume "the gate" is gating something. It is not.

**Three giant Dieter components.** As described above. dropdown-fill at 3,404 LOC is overarchitecture by definition — there is no plausible single-purpose UI control that needs that many lines.

### 3.2 Pre-work / gold-plating / academic abstraction

**ck-policy is large but earned.** 1,722 LOC total. limits.ts (379), ai-runtime.ts (416), authz-capsule.ts (278), policy.ts (152), registry.ts (218), matrix.ts (97), jwks.ts (112). Every file has a clear job. ai-runtime.ts at 416 LOC is the only one I'd flag for a re-read in 6 months, because PRD 85B intentionally widened it; if it grows past 600 LOC without a structural reason, that is the warning sign.

**Berlin is large but earned.** 7,063 LOC. Auth + identity reconcile + contact methods + account management + invitations + members + governance + locales + bootstrap + crypto + JWKS publication. Every one of those is real product surface, not premature.

**Roma domain components.** profile-domain 584, widgets-domain 579, assets-domain 556, builder-domain 534 — four React components in the same size band is suspicious-looking but actually reflects T5 (boring shells, consistent shape) more than overarchitecture. I would not refactor.

**Empty `_fragments/` directory under widgets.** Just a README. Either delete it or document what is supposed to land there. Empty scaffolding is a cost.

### 3.3 What is NOT overarchitecture (despite looking like it)

- The Cloudflare Worker / Next.js / Worker / Worker / Astro multi-app split is right for a platform that needs CDN-edge widgets, account shell, AI worker, and marketing site with very different latency and caching characteristics. This is not microservices fashion; it matches the actual workload shape.
- The l10n footprint (390 files for 25+ locales) looks heavy but is data, not code.
- The 9-file bob/lib/session/ split (WidgetDocumentSession, WidgetSessionChrome, WidgetSessionCopilot, sessionTransport, useSessionBoot/Editing/Saving/Copilot) is the right cut for a real-time editing surface. Not overarchitected.

---

## 4. Lens 4 — Simple, boring path to intended architecture

The intended architecture is visible from the code: widgets are the truth; Bob composes them; Berlin authenticates; Roma orchestrates; Tokyo serves; Sanfrancisco reasons. The fixes below all move toward that, none introduce new abstractions.

### 4.1 Top recommendations (in order)

| # | Change | Effort | Risk | Blast radius |
|---|---|---|---|---|
| 1 | Refactor Bob compiler: spec.json as primary input, widget.html as template only; eliminate regex parsing of tooldrawer tags; inline themes at publish time, not compile time | M (1–2 weeks) | M | Bob editor only; widgets unchanged; runtime unchanged |
| 2 | Decompose dropdown-fill / dropdown-upload / textedit into composable Dieter primitives + thin shells | M (2–3 weeks) | L–M | Dieter consumers in Bob; visual regression risk |
| 3 | Delete ck-policy/gate.ts or make it the real gate (route role + ck-policy/limits.ts wrapper) | S (1–2 days) | L | All callers — search shows few |
| 4 | Move tokyo/product/widgets/shared/typography.js logic into per-widget spec.json normalization where possible; freeze a versioned typography contract for what cannot move | M (1–2 weeks) | M | All widgets at runtime; needs careful rollout |
| 5 | Move roma/lib/ai/account-copilot.ts AI grant minting into ck-policy or a thin contract; keep Roma a dumb pipe | S (3–5 days) | L | Copilot route in Roma; Sanfrancisco unchanged |
| 6 | Conformance pass: every widget gets the FAQ treatment (strict, no fallbacks, throws on missing nodes) | M, ongoing | L per widget | One widget at a time |
| 7 | Delete `_fragments/` README-only directory; or document its purpose | XS | none | none |

### 4.2 What does NOT need to change

- Berlin. Leave it alone. Add providers (Apple, GitHub, email magic link) by following the Google provider pattern in auth/routes.ts. The shape is right.
- ck-policy/registry.ts + matrix.ts + policy.ts. This is the spine. Adding new entitlements is a registry edit + a matrix edit; that is the right cost.
- Roma middleware. 60 lines is the right size for a cookie gate with a public/authed prefix list.
- tokyo-worker queue handler operations. The 7-operation set is bounded and clear.
- The multi-app topology.

---

## 5. Pre-execution decisions worth surfacing

These are calls the team will face in the next quarter that the codebase is currently silent on:

**Decision A — Compiler cache key strategy.** When the Bob compiler is refactored (recommendation #1), what is the cache key? Today it is implicit in `loadComponentStencil`'s Map<string,Promise>. Options: (a) hash of widget files (deterministic, invalidates on any change), (b) widgetname + version from spec.json (cheap, requires discipline), (c) widgetname only with manual bust on publish. Recommendation: (a). It is the boring choice and matches T0 (no fallbacks, no surprises).

**Decision B — Shared runtime versioning.** Does the shared widget runtime (typography, branding, header, fill, etc.) get a version that is pinned per widget? Today it is loaded as the latest. If you ever need to ship a breaking change in stagePod.js you will either be unable to or you will silently break old embeds. Recommendation: bake a `runtimeVersion` into each widget's spec.json and serve `/widgets/shared/<version>/` from Tokyo with long cache TTLs. SaaS-best-practice and matches T1.

**Decision C — Dieter component namespace.** When dropdown-fill is decomposed, the result is N new components. Are they `dieter/dropdown-fill/color-picker/`, or `dieter/color-picker/`? Recommendation: flat. The current `dropdown-fill/dropdown-fill.js` nesting is part of why these grew — a folder per component invites kitchen-sink growth.

**Decision D — Auth provider expansion.** Berlin currently supports Google. The shape supports more. Likely next step is email magic link (no third-party provider) or Apple. Recommendation: email magic link first. It exercises the ticket-store path without a third-party dependency, and it is what most prosumer SaaS users actually want.

**Decision E — Policy gate vs. limits separation of concerns.** Today ck-policy/gate.ts is empty and limits.ts does the work. Recommendation: rename, do not extend. `gate.ts` → delete. `limits.ts` → keep. Add a `roles.ts` with the role × action matrix if role-based gating becomes a thing. Avoid a "policy engine" abstraction.

---

## 6. Per-area scorecard

| Area | LOC | Health | Verdict |
|---|---|---|---|
| 1. Widgets (FAQ + shared) | ~3,800 | A− | FAQ is gold standard; shared runtime needs trim and versioning |
| 2. Bob compiler | 2,064 | C+ | Largest risk concentration; refactor target #1 |
| 2a. Bob editor (panels/controls/session) | ~3,500 | B+ | Session split is good; CopilotPane.tsx 657 LOC worth a re-read |
| 3. Berlin auth | 7,063 | A | Strongest area in the codebase |
| 4. Roma orchestration | ~6,000 | B | Mostly dumb-pipe; account-instance-direct.ts and ai/account-copilot.ts are conformance debt |
| 5. ck-policy | 1,722 | A− | Spine is clean; gate.ts must go |
| 6. Tokyo + tokyo-worker | tokyo: 756 files / tokyo-worker: ~6,000 LOC | B+ | Clean dispatch; three giant Dieter components are the visible smell |

---

## 7. Sources (file paths in repo)

- [Tenets.md](https://github.com/CKsangiacomo/clickeen/blob/main/documentation/architecture/Tenets.md)
- [tokyo/product/widgets/faq/widget.client.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/faq/widget.client.js) (853 LOC)
- [tokyo/product/widgets/faq/spec.json](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/faq/spec.json) (690 LOC)
- [tokyo/product/widgets/shared/typography.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/shared/typography.js) (954 LOC)
- [tokyo/product/widgets/shared/stagePod.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/widgets/shared/stagePod.js) (468 LOC)
- [bob/lib/compiler.server.ts](https://github.com/CKsangiacomo/clickeen/blob/main/bob/lib/compiler.server.ts) (772 LOC)
- [bob/lib/compiler/stencils.ts](https://github.com/CKsangiacomo/clickeen/blob/main/bob/lib/compiler/stencils.ts) (476 LOC)
- [bob/lib/compiler/controls.ts](https://github.com/CKsangiacomo/clickeen/blob/main/bob/lib/compiler/controls.ts) (370 LOC)
- [bob/lib/session](https://github.com/CKsangiacomo/clickeen/tree/main/bob/lib/session)
- [berlin/src](https://github.com/CKsangiacomo/clickeen/tree/main/berlin/src) (7,063 LOC total)
- [berlin/src/auth/routes.ts](https://github.com/CKsangiacomo/clickeen/blob/main/berlin/src/auth/routes.ts) (531 LOC)
- [berlin/src/identity/reconcile.ts](https://github.com/CKsangiacomo/clickeen/blob/main/berlin/src/identity/reconcile.ts) (435 LOC)
- [berlin/src/account-management/routes.ts](https://github.com/CKsangiacomo/clickeen/blob/main/berlin/src/account-management/routes.ts) (682 LOC)
- [berlin/src/crypto/jwt.ts](https://github.com/CKsangiacomo/clickeen/blob/main/berlin/src/crypto/jwt.ts)
- [roma/middleware.ts](https://github.com/CKsangiacomo/clickeen/blob/main/roma/middleware.ts) (60 LOC)
- [roma/lib/account-instance-direct.ts](https://github.com/CKsangiacomo/clickeen/blob/main/roma/lib/account-instance-direct.ts) (701 LOC)
- [roma/lib/ai/account-copilot.ts](https://github.com/CKsangiacomo/clickeen/blob/main/roma/lib/ai/account-copilot.ts)
- [packages/ck-policy/src/registry.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/registry.ts) (218 LOC)
- [packages/ck-policy/src/policy.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/policy.ts) (152 LOC)
- [packages/ck-policy/src/limits.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/limits.ts) (379 LOC)
- [packages/ck-policy/src/gate.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/gate.ts) (36 LOC, stub)
- [packages/ck-policy/src/authz-capsule.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/authz-capsule.ts) (278 LOC)
- [packages/ck-policy/src/ai-runtime.ts](https://github.com/CKsangiacomo/clickeen/blob/main/packages/ck-policy/src/ai-runtime.ts) (416 LOC)
- [tokyo-worker](https://github.com/CKsangiacomo/clickeen/tree/main/tokyo-worker) (~6,000 LOC, 38 files)
- [tokyo-worker/src/auth.ts](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo-worker/src/auth.ts)
- [tokyo/product/dieter/components/dropdown-fill/dropdown-fill.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/dieter/components/dropdown-fill/dropdown-fill.js) (3,404 LOC)
- [tokyo/product/dieter/components/dropdown-upload/dropdown-upload.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/dieter/components/dropdown-upload/dropdown-upload.js) (1,920 LOC)
- [tokyo/product/dieter/components/textedit/textedit.js](https://github.com/CKsangiacomo/clickeen/blob/main/tokyo/product/dieter/components/textedit/textedit.js) (1,249 LOC)

---

## 8. Final verdict

**Approve the architecture as built. Land four fixes before the next major scaling event:**

1. Refactor Bob compiler away from regex HTML parsing
2. Decompose the three giant Dieter components
3. Delete or implement ck-policy/gate.ts
4. Trim and version the shared widget runtime (typography.js first)

Berlin and ck-policy are the structural strong points. The FAQ widget is a real gold standard and should be the conformance target for every other widget. Bob is the part of the platform that will hurt you in 12 months if it is not addressed in 3.
