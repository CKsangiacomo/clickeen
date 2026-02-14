# PRD 43 — Countdown “Gold Standard” Uplift (match FAQ bar)

**Status:** EXECUTED  
**Date:** 2026-02-07  
**Executed:** 2026-02-10  
**Owner:** Product Dev Team (Platform + Widgets)  
**Type:** Refactor + capability completion (compliance + UX + SEO/GEO)  
**User-facing change:** Cleaner editor panels + real SEO/GEO behavior for Countdown  

---

## 0) As-built execution record (authoritative)

Delivered outcomes:
- Countdown ToolDrawer now follows the panel contract (`content`, `layout`, `appearance`, `typography`, `settings`).
- Timezone input moved to a scalable textfield flow (`browser` or IANA token) instead of giant dropdown payloads.
- Allowlist type drift was corrected (`timer.headline` richtext alignment across localization/user/sdr contracts).
- Venice SEO/GEO includes Countdown excerpt support (schema remains empty unless explicitly supported).
- Canonical docs were aligned (`documentation/widgets/Countdown/Countdown_PRD.md`, `documentation/capabilities/seo-geo.md`).

Sections below preserve the original execution plan/context; runtime code and docs above are the final contract.

---

## 0) Summary

At PRD kickoff, Countdown (`tokyo/widgets/countdown/`) was below the FAQ “gold standard” bar:
- Editor panels violate the **panel contract** (extra panels).
- ToolDrawer organization is dated (clusters lack meaningful labels; some controls are overly large / brittle).
- SEO/GEO toggle exists in state/ToolDrawer but **does not produce Venice meta artifacts** (Venice supports `faq` only).
- Minor contract drift exists between runtime + allowlists.
- Runtime robustness (multi-instance + currentScript fallback) can be improved to match the patterns already used in `faq`.

This PRD is the execution-ready spec to uplift Countdown to the same *platform-quality* level as FAQ:
- strict, deterministic widget folder contracts
- disciplined ToolDrawer information architecture (panels + clusters)
- SEO/GEO (Iframe++) implemented in Venice (at least excerptHtml; schema only when semantically safe)
- no cross-system widget-specific hacks

**Canonical checklist:** `documentation/widgets/WidgetComplianceSteps.md`  
**Canonical rules:** `documentation/widgets/WidgetBuildContract.md`

---

## 1) Non‑negotiables (Architecture + Tenets)

1) **Widget folder is truth**: no Prague/Bob/Venice widget-specific hacks to “fix” Countdown.  
2) **Strict contracts, fail visibly**: no silent healing/merging of missing fields at runtime.  
3) **Editor is widget-agnostic**: Countdown must express itself via `spec.json` panels/clusters + shared primitives, not Bob special cases.  
4) **SEO/GEO is Venice-owned**: Countdown’s SEO/GEO artifacts must be generated in Venice (Iframe++), not in Prague/Bob.  
5) **No Dieter work** in this refactor (no new primitives/tokens). If we need it, stop and write a separate Dieter PRD.

---

## 2) What “Gold Standard” means (concrete acceptance criteria)

### 2.1 Widget folder completeness
Countdown folder must be cohesive and drift-free:
- `spec.json` defaults are complete and match runtime assertions.
- `widget.html` has stable `data-role` hooks for all runtime updates.
- `widget.client.js` is strict + deterministic (config updates are pure DOM updates; time-based ticking is isolated and does not create editor churn).
- Contract files align:
  - `limits.json` matches PRD entitlements mapping.
  - `localization.json` covers all user-authored copy (headline + CTA copy + after copy).
  - `layers/user.allowlist.json` and `sdr.allowlist.json` types match the actual content semantics.
- `agent.md` is AI-executable (parts map + binding map + ops semantics).

### 2.2 ToolDrawer UX
- Only panels allowed by contract: `content`, `layout`, `appearance`, `typography`, `settings`.
- Panels are composed of meaningful collapsible clusters (labels where it helps).
- Timezone UX is scalable (no 50k‑char dropdown blob).
- No dead controls.

### 2.3 SEO/GEO
If `seoGeo.enabled === true` and the host opts in with `data-ck-optimization="seo-geo"`:
- Venice returns **non-empty** `excerptHtml` for Countdown (`/r/:publicId?meta=1`), and it is locale-correct.
- Venice returns `schemaJsonLd` as empty string for Countdown unless we explicitly support a safe schema variant.
- If `seoGeo.enabled !== true`, both must be empty strings.

### 2.4 Verification gates
Local verification commands must pass:
- `node scripts/compile-all-widgets.mjs`
- `node scripts/[retired]/validate-sdr-allowlists countdown`
- (if any Prague pages changed) `node scripts/prague-l10n/verify.mjs`

---

## 3) Current gaps (why Countdown isn’t gold yet)

### 3.1 Panel contract violation (P0)
Countdown ships extra panels:
- `tokyo/widgets/countdown/spec.json` currently defines `<bob-panel id='actions'>` and `<bob-panel id='behavior'>`.

This violates the widget build contract:
- Panels MUST be only: `content`, `layout`, `appearance`, `typography`, `settings`.

### 3.2 SEO/GEO toggle is misleading (P0)
Countdown has `seoGeo.enabled` and a ToolDrawer control, but Venice meta generation supports `faq` only:
- `venice/lib/schema/index.ts` only routes `faq`.

### 3.3 ToolDrawer clusters are “technically grouped” but not “human-scannable”
Countdown uses clusters, but most are unlabeled, so the cluster toggle UX is underutilized:
- `tokyo/widgets/countdown/spec.json` contains many `<tooldrawer-cluster>` without `label`.

### 3.4 Timezone UX is unscalable
The date-mode timezone dropdown currently inlines a huge list into `spec.json`, making it brittle and painful to use.

### 3.5 Allowlist drift
`timer.headline` is treated as richtext in localization but typed as `string` in user allowlist:
- `tokyo/widgets/countdown/localization.json` → `timer.headline` is `richtext`
- `tokyo/widgets/countdown/layers/user.allowlist.json` → `timer.headline` is `string`

### 3.6 Runtime robustness gaps vs FAQ patterns
Countdown runtime works, but it’s missing a few “FAQ-grade” robustness patterns:
- `document.currentScript` fallback (FAQ uses `window.CK_CURRENT_SCRIPT` fallback).
- Multi-instance initial state resolution (`window.CK_WIDGETS[publicId]` support).

---

## 4) Solution overview (what we’ll build)

We’ll uplift Countdown by doing **three workstreams**:

### Workstream A — Tokyo widget folder compliance + editor UX
Refactor `tokyo/widgets/countdown/*` to:
- become panel-contract compliant (merge actions/behavior into allowed panels)
- improve clusters/labels for scanability
- replace unscalable timezone dropdown UX
- fix allowlist drift
- upgrade `agent.md` to AI-executable “gold standard” format
- upgrade runtime robustness patterns (multi-instance + currentScript fallback)

### Workstream B — Venice SEO/GEO support for Countdown
Implement `excerptHtml` generation for Countdown in Venice and register it in `venice/lib/schema/index.ts`.

### Workstream C — Canonical docs update (must ship with code)
Update canonical docs to match reality:
- `documentation/widgets/Countdown/Countdown_PRD.md` (panel contract alignment + SEO/GEO reality)
- `documentation/capabilities/seo-geo.md` (update supported widgets list)

---

## 5) Execution plan (detailed)

### 5.0 Preflight
- Confirm local stack is running: `bash scripts/dev-up.sh`
- Confirm widget compilation endpoint works:
  - `curl -s http://localhost:3000/api/widgets/countdown/compiled | head`

---

### 5.1 Workstream A — Tokyo: state contract + ToolDrawer refactor

#### A1) Make panels contract-compliant (P0)
**File:** `tokyo/widgets/countdown/spec.json`

Actions:
1) Delete `<bob-panel id='actions'>…</bob-panel>` and `<bob-panel id='behavior'>…</bob-panel>`.
2) Move those controls into allowed panels:
   - Put CTA + after-end behavior controls into `content` (as clusters).
   - Put backlink + SEO/GEO into `settings` (as clusters).

Target panel layout:
- **content**
  - Cluster: “Timer type” (mode selector)
  - Cluster: “Date countdown” (targetDate + timezone) — gated on `timer.mode == 'date'`
  - Cluster: “Personal countdown” (timeAmount/unit/repeat) — gated on `timer.mode == 'personal'`
  - Cluster: “Number counter” (starting/target/duration) — gated on `timer.mode == 'number'`
  - Cluster: “Headline” (timer.headline)
  - Cluster: “CTA (during)” (actions.during.*)
  - Cluster: “After end” (actions.after.*)
- **layout**
  - Cluster: “Position” (layout.position)
  - (compiler-injected) Stage/Pod layout fields
- **appearance**
  - Cluster: “Theme + motion” (appearance.theme + appearance.animation)
  - Cluster: “Text + separators” (appearance.textColor + appearance.separator)
  - Cluster: “Timer tiles” (appearance.itemBackground + appearance.cardwrapper.*)
  - Cluster: “Stage/Pod appearance” (existing stage/pod appearance controls)
- **typography**
  - compiler-injected
- **settings**
  - Cluster: “SEO/GEO” (seoGeo.enabled + any future SEO controls)
  - Cluster: “Clickeen branding” (behavior.showBacklink)

Acceptance:
- `node scripts/compile-all-widgets.mjs` passes.
- ToolDrawer no longer shows “Actions” or “Behavior” as top-level panels.

#### A2) Improve cluster labels + grouping (UX)
**File:** `tokyo/widgets/countdown/spec.json`

Actions:
- Add `label="…"` to clusters where it improves scanability (especially Content + Appearance).
- Keep `group-label` for groups only when it helps inside a cluster.
- Ensure no forbidden cluster attributes (`gap`, `space-after`).

Acceptance:
- The editor reads like a product, not a form dump.

#### A3) Fix timezone UX (scalability)
**File:** `tokyo/widgets/countdown/spec.json`

Goal:
- Remove the massive timezone options blob.

Implementation (minimal, scalable):
- Change timezone control from dropdown-with-all-options → textfield:
  - `path='timer.timezone'` becomes `type='textfield'`
  - Placeholder: `America/New_York` (and allow literal `browser`)
  - Helper copy (if available): “Use `browser` or an IANA timezone (e.g. `Europe/Paris`).”

Runtime already validates IANA vs `browser` (`isValidTimeZone`), so this aligns with strictness.

Acceptance:
- Editing timezone doesn’t require scrolling a huge list.
- Invalid timezone fails visibly (runtime error in preview), consistent with the contract.

#### A4) Upgrade runtime robustness to FAQ-grade patterns
**File:** `tokyo/widgets/countdown/widget.client.js`

Actions:
1) Add `window.CK_CURRENT_SCRIPT` fallback (match FAQ approach).
2) Resolve `publicId` more robustly:
   - check `data-ck-public-id` on widget root
   - fallback to ShadowRoot host / ancestor attribute
   - fallback to `window.CK_WIDGET.publicId`
3) Initial state resolution must support multi-instance pages:
   - prefer `window.CK_WIDGETS[publicId].state` when present
   - fallback to `window.CK_WIDGET.state`

Acceptance:
- Multiple countdown embeds on one page don’t trample each other.
- Works in embed + Bob preview + any shadow root context.

#### A5) Tighten CKFill strictness (fail-fast)
**File:** `tokyo/widgets/countdown/widget.client.js`

Actions:
- Replace “fallback to String(value)” in `resolveFillBackground/resolveFillColor` with explicit dependency checks (throw) like FAQ does.

Acceptance:
- Missing shared primitives fail visibly instead of silently degrading.

#### A6) Address “timers inside applyState” determinism
Countdown must tick over time; this is legitimate side-effect, but **editor churn must not cause interval churn**.

**File:** `tokyo/widgets/countdown/widget.client.js`

Actions (design):
- Isolate ticking scheduler from “config apply”:
  - `applyState(state)` updates DOM styles/text and updates a `runtimeConfig`.
  - Scheduler exists once per widget instance:
    - date/personal: one `setInterval` per instance
    - number: rAF loop only while animating
- Restart scheduling only when timer-critical fields change (mode/targetDate/timezone/timeAmount/timeUnit/repeat/start/target/duration).

Acceptance:
- Scrubbing appearance/typography controls does not recreate timers repeatedly.
- Timer continues to tick correctly.

---

### 5.2 Workstream A — Tokyo: contract files + agent contract

#### A7) Fix allowlist type drift
**Files:**
- `tokyo/widgets/countdown/layers/user.allowlist.json`
- `tokyo/widgets/countdown/sdr.allowlist.json`

Actions:
- Set `timer.headline` type to `richtext` (matches localization + runtime semantics).
- Keep CTA texts as `string`.

Acceptance:
- `node scripts/[retired]/validate-sdr-allowlists countdown` passes.

#### A8) Ensure localization allowlist is accurate
**File:** `tokyo/widgets/countdown/localization.json`

Actions:
- Confirm it includes all *user-authored* copy paths:
  - `timer.headline` (richtext)
  - `actions.during.text` (string)
  - `actions.after.text` (string)
- Do not attempt to localize “generic chrome” unless required by PRD (Countdown unit labels are UI chrome; they can remain runtime-localized later if desired).

Acceptance:
- Localization overlays can translate the user copy that matters.

#### A9) Upgrade `agent.md` to “gold standard” format
**File:** `tokyo/widgets/countdown/agent.md`

Actions:
- Add:
  - Identity + root scope rule
  - State encoding attributes (`data-mode`, `data-layout-position`, etc.)
  - DOM parts map (stable hooks)
  - High-signal editable schema
  - Array ops semantics (Countdown has no arrays, but document that explicitly)
  - Binding map summary (path → DOM/CSS)
  - Prohibited paths + allowlist rules

Acceptance:
- An AI agent can safely edit Countdown with no guesswork.

---

### 5.3 Workstream B — Venice SEO/GEO: Countdown excerpt support

#### B1) Implement excerpt generator
**Files:**
- Add: `venice/lib/schema/countdown.ts`
- Update: `venice/lib/schema/index.ts`

Behavior:
- If `state.seoGeo.enabled !== true` → return empty string.
- If enabled:
  - Generate a short, bounded excerpt including:
    - headline (strip HTML → text)
    - mode-specific “what and when” facts:
      - date: ends at formatted date/time in configured timezone (or show ISO if formatting unreliable)
      - personal: “Ends X {unit} after first visit” (+ repeat hint if configured)
      - number: “Counts from A to B in N seconds”
    - optional CTA text (during/after) if present
- `schemaJsonLd` remains empty for Countdown unless we ship an explicit safe schema contract.

Acceptance:
- `/r/:publicId?meta=1` returns `excerptHtml` non-empty when enabled.

#### B2) Update canonical SEO/GEO docs
**File:** `documentation/capabilities/seo-geo.md`

Actions:
- Update “Current widget support” to include Countdown:
  - Countdown: excerptHtml only (schemaJsonLd empty)

---

### 5.4 Workstream C — Canonical docs drift fixes

#### C1) Update Countdown PRD to match shipped contracts
**File:** `documentation/widgets/Countdown/Countdown_PRD.md`

Actions:
- Update ToolDrawer panels section to match the BuildContract panel set:
  - remove Behavior/Actions as top-level panels
  - describe clusters within `content`/`settings` instead
- Update SEO/GEO section to reflect Venice-owned behavior and what Countdown supports (excerpt-only).
- Ensure “Determinism” section acknowledges time-based ticking but keeps config application deterministic.

---

## 6) Risk / mitigations

1) **Breaking runtime due to strict assertions**
   - Mitigation: change sequencing carefully; keep state shape stable unless we can update all affected instances (human/system task).

2) **SEO/GEO semantics risk (wrong schema type)**
   - Mitigation: ship excerpt-only first; keep schema empty until we have explicit schema intent controls.

3) **Timezone textfield increases user error**
   - Mitigation: runtime already fails visibly on invalid timezones; keep placeholder/examples.

---

## 7) Rollout & environments

**Local dev:** all work is code-only, verified by scripts.  
**Cloud-dev:** deploy Bob + Venice after local gates pass.  
**No Supabase resets.**  
**No instance edits by AIs.** If any state shape changes require instance updates, explicitly create a Human/System checklist item before deploy.

---

## 8) Verification checklist (copy/paste)

1) `bash scripts/dev-up.sh`
2) `node scripts/compile-all-widgets.mjs`
3) `node scripts/[retired]/validate-sdr-allowlists countdown`
4) (if pages changed) `node scripts/prague-l10n/verify.mjs`
5) Manual:
   - Bob: edit headline, timer modes, CTA text; preview updates live.
   - Venice: enable `seoGeo.enabled`, verify `/r/:publicId?meta=1` includes excerptHtml.
