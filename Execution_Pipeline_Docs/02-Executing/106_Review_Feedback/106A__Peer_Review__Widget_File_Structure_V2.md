# 106A Peer Review - Widget File Structure V2

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106A__PRD__Widget_File_Structure_V2.md`

## Review Lens

Clickeen is pre-GA. There is no reason to preserve duplicate runtime truth, long-lived compatibility paths, or defensive fallback behavior.

This PRD must support:

- millions of accounts;
- many widget instances per account;
- many pages composed from those widget instances;
- deterministic edit -> save package -> recompose flows;
- AI-manageable widget files.

## Consolidated Verdict

106A is directionally correct but not execution-ready.

The simple product shape is right:

```text
one widget source model
one generated widget package shape
one payload authority: CK_WIDGETS[instanceId]
one root-scoped runtime initializer
shared Stage/Pod/Header/Typography/Locale/Chrome primitives
```

The current PRD still has unresolved execution boundaries:

- first-paint HTML is required, but no materializer/static-render authority is named;
- fragment boundary is ambiguous (`.stage` / `.pod` / `[data-ck-widget]`);
- shared boot/context API is required but not named;
- runtime lifecycle cleanup is too weak for multi-instance pages;
- CK_WIDGET deletion is correct but needs explicit code acceptance gates;
- collection-editor cleanup risks becoming generic Bob/Dieter pre-work;
- social-share chrome prep belongs mostly in 106C unless it directly simplifies `branding.js`.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- Keeps current package files instead of inventing a new widget taxonomy.
- Deletes `catalog.json` / `save-rules.json` direction.
- Moves repeated Stage/Pod, payload lookup, preview binding, fill/radius/shadow work into shared code.
- Uses existing Bob shared modules instead of inventing another editor model.

Blocking gaps:

- First-paint content is specified; final execution moved package emission to the Builder/Roma save path and Tokyo package storage/readiness.
- Page Composer cannot stack empty hooks if SEO/GEO and AI crawlers matter.
- The fragment boundary must be one concrete thing before CSS/runtime cleanup starts.

### Architecture / Tenet Compliance

Compliant:

- No block object.
- Widgets remain the product unit.
- Page Composer consumes generated widget packages, not private widget source.
- `CK_WIDGETS[instanceId]` is the right payload authority.

Not compliant yet:

- Current runtime still emits/reads `CK_WIDGET`.
- Current widget clients use `document.currentScript` and single-root assumptions.
- Current shared runtime files resolve payload/locale/context independently.

### Overarchitecture / Gold-Plating Risks

- “Repeated collection editor patterns” is too broad unless one current Bob module and one deletion target are named.
- Generic paid/free chrome belongs in 106C unless 106A limits it to simplifying current `branding.js`.
- Do not create a framework. Add shared runtime only where it deletes current duplicated code.

### Simple / Boring Path

Add a “Surviving Authorities” block:

- Fragment boundary: one generated widget fragment, explicitly including or containing Stage/Pod.
- Payload authority: `window.CK_WIDGETS[instanceId]` only.
- Runtime authority: `init(root, payload, context) -> handle`.
- Static content authority: Builder/Roma saved package output, with Tokyo validating/stamping/storing the submitted files.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- Cleans widget packages before introducing pages.
- Preserves widget reuse: edit once, pages update.
- Makes pages a composition of existing widget instances, which keeps product UX simple.

User-facing risks:

- Locale UX is undecided for composed pages. Current locale switcher can show per widget and mutate the URL. Ten widgets could create ten selectors.
- Placeholder/source-shell content can leak if first-paint rendering is not real account content.
- Runtime leaks and duplicate timers can hurt perceived quality on pages with many widgets.

### Architecture / Tenet Compliance

Compliant:

- Builder remains the authoring surface.
- Translation remains tied to `editable-fields.json`.
- Entitlements stay policy-owned.

Needs tightening:

- Shared paid/free chrome must be render-only. Bob/Roma policy decides entitlement; shared runtime must not infer it.
- First-paint package authority is Builder/Roma saved package output, not Tokyo widget rendering.

### Overarchitecture / Complexity

- Collection-editor abstraction can derail FAQ/Logo editor stability.
- Social-share pre-work in 106A can become a feature framework.
- Keep 106A to file/runtimes cleanup; move feature-specific share decisions to 106C.

### Simple / Boring Product Path

Add decisions:

- V1 page locale behavior: suppress per-widget locale switchers in composed pages, or define one page-level locale policy before translated pages ship.
- Generated `index.html` must contain saved visible content.
- 20-placement fixture: repeated same widget type plus mixed widget types.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- Cleaning widget packages first is the cheapest way to make Page Composer viable.
- Avoids a second section/block source system.
- Keeps widget instance reuse as the operational primitive.

P0 operational gap:

- 106F currently reads public instance artifacts. Today those artifacts are created through publish and served by object existence.
- If a page places an unpublished/page-only widget, writing its package to the public instance path may accidentally publish the standalone widget.

Required decision:

```text
Either:
  placed widgets must be individually published
or:
  Tokyo needs a non-servable composition package path/cache
```

### Systems Talking To Each Other

Needs clarification:

- Roma Composer is UI/source authoring.
- Tokyo Page Materializer is output generation.
- Tokyo must own the reverse placement index for widget-save -> affected pages.
- Page recomposition cannot scan account page sources at scale.

### SaaS-Grade Scale

For millions of accounts, recomposition needs:

- reverse placement index;
- coalescing;
- retry/failure state;
- published-pages-only vs drafts behavior;
- no request-time assembly;
- no iframe stacking.

### Recommended Sequence

Recommended order:

```text
106A -> 106B hard package tests -> 106E using existing widgets -> 106F materializer/recomposition -> 106G publish/edge
```

Run 106D and 106C only after 106B proves the generated widget package contract.

## Consolidated Required PRD Decisions

Before executing 106A, decide or move these explicitly:

1. **Generated Package Boundary**
   - Does 106A own Tokyo materializer output changes, or do 106B/106F own them?
   - First-paint HTML must come from saved account instance state.

2. **Fragment Boundary**
   - Is the extractable fragment `.stage`, `.pod`, or `[data-ck-widget]`?
   - Current `CKStagePod` requires `.stage/.pod` ancestors, so the answer must include Stage/Pod or change the runtime.

3. **Payload Authority**
   - `CK_WIDGETS[instanceId]` only.
   - Acceptance must include no `window.CK_WIDGET =` in generated runtime and no `window.CK_WIDGET` reads in targeted widget/shared files.

4. **Shared Runtime Context**
   - Name one shared root/payload/locale/preview authority.
   - It must delete duplicated context code from FAQ, Countdown, Logo Showcase, Branding, Locale Switcher, Typography.

5. **Runtime Lifecycle**
   - `init(root, payload, context)` must return a cleanup handle when the widget attaches timers, observers, animation frames, or global listeners.

6. **Locale On Pages**
   - Decide V1 composed-page locale behavior before locale switchers are allowed on pages.

7. **Page-Only / Unpublished Widgets**
   - Decide whether page placement requires published widget packages or whether Tokyo creates non-servable composition packages.

8. **Recomposition Scale**
   - Add reverse placement index and queue/failure behavior to the relevant 106F/106E scope.

9. **Scope Control**
   - Defer generic collection editor abstraction unless backed by current Bob shared module support.
   - Keep 106A social chrome work to current `branding.js`; move social-share shape to 106C.

## Suggested Acceptance Gates

106A should not go green unless:

- `rg "window\\.CK_WIDGET\\b" tokyo/product/widgets tokyo-worker/src/domains/render/public-artifacts.ts` has no surviving runtime payload/read path except tests updated for deletion.
- FAQ, Countdown, and Logo Showcase CSS no longer duplicate generic `.stage` / `.pod` shell rules.
- Widget clients expose or register root-scoped initialization.
- Runtime listeners/timers/observers have cleanup where they exist.
- A composed fixture with 20 placements initializes independently:
  - repeated same widget type;
  - mixed widget types;
  - one `CK_WIDGETS` payload map;
  - no iframe stack;
  - no `body` / `:root` leakage from widget CSS.
- Generated widget `index.html` contains visible primary content if first-paint remains in this PRD; otherwise 106B/106F must own that test.

## Decision Status

Do not execute 106A as-is.

Recommended next action: amend 106A, 106B, 106E, and 106F with the boundary decisions above before implementation begins.
