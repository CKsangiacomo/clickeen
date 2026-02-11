### PRD: Bob Preview Mode — Decouple SEO/GEO from Editor Preview Engine

### Status
- **Status**: Executing (peer review required before code changes)
- **Owner**: Bob (editor) + Venice (embed runtime)
- **Scope (this execution slice)**: Slice A only — decouple `seoGeo.enabled` from preview engine selection. No new preview modes yet.
- **Environment**: Local code changes in `bob/`; no cloud-dev writes required.

---

### Execution decision (locked for this slice)

We will execute **only Slice A** now:
- Remove the implicit `seoGeo.enabled -> /bob/preview-shadow` switch.
- Keep the preview canonical and Tokyo-driven.
- Defer explicit preview modes (Slice B) to a later PRD.

Canonical preview statement (non-negotiable):
- **Standard preview (Tokyo runtime) is the only canonical preview.**
- Any future embed-parity preview must be explicitly diagnostic and opt-in.

---

### Current codebase reality (2026-01-27)

This coupling is real today and is the core drift this PRD should fix first:

- Bob still switches preview engines based on `seoGeo.enabled`:
  - `bob/components/Workspace.tsx` computes `seoGeoEnabled`
  - when true, it switches iframe `src` to `/bob/preview-shadow?...`
- That embed preview depends on correct Venice base URL wiring:
  - `bob/lib/env/venice.ts` fail-fast behavior confirms this dependency

This means a content toggle (`seoGeo.enabled`) can still blank or destabilize the preview.

Runtime reality (SEO/GEO today):
- In this repo snapshot, `seoGeo.enabled` does affect Venice output for FAQ schema JSON-LD:
  - gate: `venice/lib/schema/faq.ts`
  - used in render payload: `venice/app/r/[publicId]/route.ts`

---

### Problem
Today, enabling **SEO/GEO optimization** in Bob (`seoGeo.enabled`) implicitly switches the Workspace preview iframe away from the **Tokyo widget runtime** (`compiled.assets.htmlUrl`) to **Bob’s “preview-shadow” page**, which loads the **Venice embed loader**.

This creates a confusing editing experience:
- The user toggles a setting and the preview can **appear to “disappear”** (blank iframe / scroll / loader failures).
- Debugging becomes ambiguous: is the widget broken, or is the embed loader / environment broken?
- A settings toggle becomes a hidden “switch preview engine” control, which is not a predictable UX pattern.

This also increases fragility:
- The preview now depends on correct **Venice base URL configuration** and loader correctness, even when the user is just editing.
- The core “Bob previews Tokyo deterministically” loop becomes conditional, which undermines the platform’s simplicity.

---

### Goals
- **Keep the default editing loop stable**: Bob’s preview should remain Tokyo-driven by default (fast, deterministic, easy to debug).
- **Treat SEO/GEO as an embed/runtime capability**: the behavior that matters is at embed time (Venice), but **Workspace preview remains the canonical rendering**.
- **Venice must match Workspace preview**: Venice’s job is to ensure the public embed looks like the widget as previewed in Bob.
- **Make preview context switching explicit**: if we want embed parity preview, it must be a clear user choice (a preview mode), not a side effect of a settings toggle.
- **Reduce “blank preview” incidents**: remove implicit dependencies that cause the preview to vanish.

---

### Non-goals
- Shipping “full SEO/GEO indexable host-DOM embedding” in this PRD. (That is a separate capability/roadmap item.)
- Changing widget packages in `tokyo/widgets/*` beyond what’s needed for preview compatibility.
- Re-architecting Paris or instance storage.

---

### User Stories
- As a user editing a widget, I can toggle SEO/GEO-related settings **without losing my preview**.
- As a user, I can intentionally switch between:
  - a **Standard preview** (Tokyo runtime) and
  - an **Embed preview** (Venice runtime / loader),
  and clearly understand what I’m looking at.
- As a developer, when preview breaks I can quickly tell which surface is failing (Tokyo widget runtime vs Venice embed runtime).

---

### Proposed UX

Note: the full preview-mode UX is still directionally correct, but **out of scope for this execution slice**. This slice focuses only on decoupling.

#### A) Preview Mode control (explicit)
Add a preview mode selector in the Workspace overlay (near device/theme controls):
- **Standard** (default): loads the widget directly (Tokyo widget runtime) and streams state via `ck:state-update`.
- **Embed** (optional): loads an **embed-parity preview surface** that simulates the Venice embed environment (asset proxy/base URL, token/shadow mode, iframe constraints) **but still streams the same in-memory state** via `ck:state-update`.

The selector should be:
- clearly labeled (e.g. “Preview mode”)
- persistent per session (stored in Bob session state)

#### B) SEO/GEO toggle no longer switches preview engine
Enabling/disabling `seoGeo.enabled` must not automatically change the preview iframe URL.

SEO/GEO settings still exist and still apply to:
- instance config (what gets saved/published),
- validation rules (if any),
- Venice runtime behavior (embed responses, schema output, deep link behavior),
but not the core editor preview engine.

---

### Functional Requirements

#### 1) Bob: Preview engine selection is no longer coupled to `seoGeo.enabled`
- Toggling `seoGeo.enabled` must not change iframe `src`.
- The preview must remain Tokyo-driven by default.

#### 2) Bob: Remove hidden “preview-shadow on seoGeo.enabled”
- The current conditional iframe switch in `bob/components/Workspace.tsx` must be removed.
- `/bob/preview-shadow` may remain for internal testing, but it must never be triggered implicitly by config.

#### 3) Non-goal for this slice: explicit preview modes
- No `preview.mode` UI or behavior changes are required in this execution slice.
- Preview modes remain a valid future direction, but are intentionally deferred.

---

### Technical Approach (Slice A — minimal and surgical)

#### Bob changes (single-file diff)
Change only `bob/components/Workspace.tsx`:

1) Remove the `seoGeoEnabled`-based branch for `iframeSrc`.
2) Always use `compiled.assets.htmlUrl` when a widget is compiled.

Current drift (to remove):
- `seoGeoEnabled` is computed from `instanceData.seoGeo.enabled`
- when true, `iframeSrc` switches to `/bob/preview-shadow?...`

Target behavior:
- `iframeSrc = compiled.assets.htmlUrl` for all configs
- no preview engine switches based on config flags

#### Venice changes
- None required for Slice A.

---

### Execution Plan (peer-review ready)

#### Scope of change (tight)
- Files to edit:
  - `bob/components/Workspace.tsx`
- Files explicitly not in scope:
  - Tokyo widget packages
  - Paris APIs or DB schema
  - Venice embed behavior
  - Any new preview UI controls

#### Step-by-step
0) Pre-check hidden dependencies:
   - Search for `preview-shadow` across `bob/`, `venice/`, `admin/`, and `documentation/`.
1) Update `iframeSrc` selection in `Workspace.tsx` to remove the `seoGeo.enabled` branch.
2) Keep all existing postMessage behavior (`ck:state-update`) unchanged.
3) Verify locally using the canonical dev flow: `bash scripts/dev-up.sh`

#### Local verification checklist
- In Bob/DevStudio:
  - Load a widget with `seoGeo.enabled = false`
  - Toggle `seoGeo.enabled = true`
  - Confirm the preview remains visible and updates normally
- Regression checks:
  - Device switch still works
  - Theme switch still works
  - Stage sizing and background behavior still works

---

### Behavioral Notes / Tradeoffs
- **Standard preview**: canonical, fastest loop (widget package + streamed state).
- **Embed preview**: same widget + same streamed state, but under embed-like constraints. This is for catching differences that only appear in embeds (asset origin, token mode, sandboxing, sizing).

---

### Success Metrics
- **0%** of users experience a blank preview as a side effect of toggling SEO/GEO settings.
- Fewer internal “preview disappeared” debugging reports.
- Clear separation: editor preview issues vs embed runtime issues.

---

### Acceptance Criteria (Slice A only)
- Toggling `seoGeo.enabled` does **not** change iframe `src` in Workspace.
- Preview remains visible and continues to reflect in-memory edits via `ck:state-update`.
- No regressions in device/theme/stage behavior during normal editing.

---

### Rollout Plan (minimal)
- No feature flag required for Slice A.
- This is a simplification: remove implicit coupling and keep the canonical preview path only.

---

### Peer review prompts (targeted)
1) Are we aligned that Slice A should ship alone first (decouple now, preview modes later)?
2) Any hidden dependencies on `/bob/preview-shadow` that would break by removing the implicit switch?
3) Do we want a follow-up PRD specifically for explicit preview modes (Slice B)?

---

### Known `/bob/preview-shadow` usages (as of 2026-01-27)
- `bob/components/Workspace.tsx` (the implicit coupling we are removing)
- `bob/lib/env/venice.ts` (fail-fast comment about preview-shadow Venice origin)
- `venice/app/embed/v2/loader.ts` (shadow-mode comment referencing preview-shadow / SEO flows)
