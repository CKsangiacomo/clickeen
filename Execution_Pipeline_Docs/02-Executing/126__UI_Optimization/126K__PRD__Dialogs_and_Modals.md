# 126K - PRD: Dialogs And Modals

Status: CODEX BASELINE - Phase 1 step 2.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit input: `audits/126K__AsBuilt_Codex.md`.
KB doc: `documentation/engineering/UI/dialogs-and-modals.md`.

This is Codex baseline only. It is not final doctrine, does not converge with
GLM, does not select fixes, and does not run step 4+.

## Role

126K owns the overlay system domain: modal, dialog, popover, confirmation,
backdrop, focus/dismissal, stacking, scroll, and overlay motion mechanics.

This PRD must not reinterpret the task into "build one ideal modal system" in
Phase 1. It records current reality and known gaps only.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in this PRD.

Once the 126K dialogs-and-modals standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

## Phase 1 Step 2 Boundary

MAMA says step 2 is baseline/directional PRD: current reality plus known gaps,
no fixes. Therefore this document:

- records what the Codex as-built audit found;
- names known gaps;
- preserves separate overlay families;
- avoids implementation prescriptions;
- does not update code;
- does not update product data;
- does not update living docs yet.

## Current Overlay Baseline

### Dieter Full-Screen Modals

Current reality:

- `bulk-edit` is the strongest Dieter modal pattern.
- `bulk-edit` has `role="dialog"`, `aria-modal="true"`, fixed backdrop CSS,
  `[hidden]` state, Escape close with `preventDefault`, backdrop click close,
  and first-input focus on open.
- `bulk-edit` still lacks verified focus trap, return focus, and scroll-lock.
- `object-manager` has modal markup and CSS similar to `bulk-edit`.
- `object-manager` source markup lacks `role`, `aria-modal`, and accessible
  panel naming on the modal body.
- `object-manager` JS opens/closes the modal and closes on backdrop click, but
  inspected code does not show Escape close, initial focus, focus trap, return
  focus, or scroll-lock.
- `object-manager` is not exported from `dieter/components/index.ts` as a
  source TS hydrator; a JS hydrator exists in the component directory and built
  Tokyo artifact.

Known gaps:

- `bulk-edit` is not a complete overlay doctrine.
- `object-manager` is not semantically equivalent to `bulk-edit`.
- Full-screen modal stacking uses raw `z-index: 1000`.

### Dieter Anchored Popovers And Dialog Popovers

Current reality:

- `dropdownToggle` is the shared engine for several dropdown/popover hosts.
- `dropdownToggle` manages `data-state`, trigger `aria-expanded`, outside-click
  close, and Escape close.
- `dropdownToggle` does not provide focus trap, return focus, scroll-lock,
  stack management, or ARIA role assignment.
- `dropdown-edit` is a dialog popover using `dropdownToggle`; it focuses the
  editor on open.
- `dropdown-upload` is a dialog popover using `dropdownToggle`; it syncs state
  on open.
- `dropdown-actions`, `dropdown-fill`, `dropdown-border`, and related controls
  are listbox popovers, not dialogs.
- `textedit` is its own overlay lifecycle. It has dialog popover markup and
  initial editor focus, but uses a separate outside-click engine and the
  inspected code only handles Escape inside the nested link input, not at the
  host popover level.
- `popaddlink` is nested popover/form content hosted inside other overlays; it
  is not an independent modal or dialog host.
- Shared popover CSS uses `z-index: 12` and opacity/transform transitions.

Known gaps:

- There are at least two outside-click engines: `dropdownToggle` and `textedit`.
- Escape behavior differs between `bulk-edit`, `dropdownToggle`, and `textedit`.
- Dialog popovers and listbox popovers share visual substrate but need distinct
  semantics.
- Overlay reduced-motion handling is not consistently local to Dieter overlay
  CSS.

### Roma Local Modal Family

Current reality:

- Roma has verified local `.roma-modal-backdrop`, `.roma-modal`, and
  `.roma-modal__actions` CSS.
- Roma modal CSS uses fixed backdrop, scrim, centered panel, and raw
  `z-index: 1000`.
- Roma renders local modals for widget upgrade prompts, page instance picking,
  asset bulk upload, and account lifecycle notices.
- Roma widget upgrade modal state is driven by API 402 `UPGRADE_REQUIRED`
  responses from create, duplicate, and publish limit paths.
- Roma modal markup generally includes `role="dialog"`, `aria-modal="true"`,
  and `aria-labelledby`.
- Roma uses Dieter buttons inside local modal containers.
- Inspected Roma modal code does not show shared focus trap, return focus,
  Escape close, backdrop click close, or scroll-lock.
- Roma also uses browser-native `window.confirm` for unsaved Builder and widget
  defaults navigation guards.

Known gaps:

- Roma modal ARIA exists, but modal lifecycle behavior is not shared with Dieter
  or Bob.
- Browser-native confirmations sit outside the Clickeen overlay system.
- Roma modal convergence belongs to later planning and execution, not this
  Step 2 baseline.

### Bob Local Modal And Overlay Family

Current reality:

- Bob has a local `UpsellPopup`.
- `UpsellPopup` has `role="dialog"`, `aria-modal="true"`, initial close-button
  focus, Escape close with `preventDefault`, and backdrop mouse-down close.
- `UpsellPopup` uses local `.ck-upsellOverlay` / `.ck-upsellModal` classes and
  raw `z-index: 1000`.
- Bob workspace status overlays use `role="status"` / `role="alert"` and are
  not modal dialogs.
- Bob ToolDrawer detects transient upload/bulk-edit/object-manager modal work
  and blocks panel switching with inline `role="alert"` feedback.
- Bob CSS defines `.ck-publishOverlay` / `.ck-publishModal`; current runtime
  usage was not verified in the Codex audit.

Known gaps:

- Bob upsell is another local modal family, not shared Dieter/Roma doctrine.
- Focus trap, return focus, and scroll-lock are not verified in Bob upsell.
- Publish modal CSS usage remains an evidence gap.

### DevStudio Token Editor Overlay

Current reality:

- DevStudio creates a token editor overlay imperatively in `admin/src/main.ts`.
- The overlay appends to `document.body`, closes on backdrop/close controls,
  includes a live diff region, and has local CSS.
- Its injected panel does not include inspected `role="dialog"` or
  `aria-modal`.
- It uses `z-index: 40`, separate from Dieter/Roma/Bob modal literals.
- DevStudio utilities CSS includes a global reduced-motion override.

Known gaps:

- DevStudio token editor overlay is not governed by the Dieter overlay family.
- Dialog ARIA, Escape close, focus trap, return focus, and scroll-lock are not
  verified for this overlay.

### Widget Runtime Layered Menus And Status

Current reality:

- Tokyo widget runtime has layered share, toast, locale switcher, and fixed
  stage surfaces.
- Social share uses a `details` menu with `role="menu"` and a toast with
  `role="status"` / `aria-live="polite"`.
- Social share closes on outside click and Escape.
- These are not dialogs or modals, but they are part of the broader layering
  and stacking reality.
- Widget runtime CSS adds raw `z-index` values including `70`, `80`, and
  `1000`.

Known gaps:

- Widget runtime layering is outside the current Dialogs doc snapshot.
- These surfaces need classification before any later overlay doctrine can
  claim complete stacking coverage.

## Comparative Baseline

| Family | Current Strength | Current Gap |
| --- | --- | --- |
| Dieter `bulk-edit` | Best modal ARIA and dismissal baseline | No verified trap/return/scroll-lock |
| Dieter `object-manager` | Similar fixed modal surface | Missing panel dialog ARIA; lifecycle gaps |
| Dieter `dropdownToggle` popovers | Shared outside/Escape mechanics | Not a full modal system |
| Dieter `textedit` | Dialog popover with initial editor focus | Separate outside engine; no host Escape found |
| Dieter listbox popovers | Correctly not dialog semantics | Still share overlay mechanics without system doctrine |
| Roma `.roma-modal` | Dialog ARIA in local product modals | Parallel family, no shared lifecycle |
| Bob upsell | Dialog ARIA, initial focus, Escape, backdrop close | Local family, no verified trap/return/scroll-lock |
| DevStudio token editor | Working governance overlay | No inspected dialog ARIA or modal lifecycle |
| Browser `window.confirm` | Native unsaved-work confirmation | Outside Clickeen/Dieter UI system |
| Widget runtime layers | Share menu/status and fixed runtime surfaces | Raw stacking values outside current overlay doc snapshot |

## Known Documentation Drift / Clarifications

- The living doc's Roma modal claim is now verified by current code.
- The living doc's Roma convergence reference says 126D, but current MAMA maps
  126D to typography and 126K to dialogs-and-modals.
- The UI README labels dialogs-and-modals as `(126B/126D)`, stale against
  current MAMA.
- `popaddlink` should be treated as nested form/popover content, not an
  independent overlay host.
- A "single overlay system" cannot flatten dialog popovers and listbox popovers
  into the same ARIA semantics.
- `bulk-edit` is strongest current evidence, not final doctrine.
- The current z-index snapshot in living docs is incomplete for broader 126K
  because Bob, Roma, DevStudio, and widget runtime add more layered values.

## Compliance To Architecture, Product, And Product Law

Architecture:

- Keeps Dieter, Roma, Bob, DevStudio, and browser-native confirmation paths
  distinct as current state.
- Preserves semantic differences between dialogs and listboxes.
- Does not invent a new overlay abstraction.

Product:

- No visual redesign.
- No behavior changes.
- No save, translation, account, deploy, or product-data changes.
- Upgrade and unsaved-work flows are recorded, not changed.

Product law:

- No code changes.
- No Step 4+ convergence.
- No AI convergence of Codex and GLM.
- No new enforcement machinery.
- No reinterpretation into an ideal system.

## Out Of Scope For This Step

- Creating a shared `Modal` primitive.
- Migrating Roma modals.
- Replacing `window.confirm`.
- Changing Bob upsell behavior.
- Changing DevStudio token editor behavior.
- Adding focus trap, return focus, scroll-lock, or z-index tokens.
- Updating `documentation/engineering/UI/dialogs-and-modals.md`.
- Any runtime code change.

## Codex Baseline Done

- Step 1 input exists: `audits/126K__AsBuilt_Codex.md`.
- Step 2 baseline exists in this file.
- Step 3 source research exists: `research/126K_Research_Codex.md`.
- This file remains directional and non-binding until human convergence.

## GLM Addendum — Phase 1 Step 2 (feedback)

> GLM's adversarial critique of the Codex Baseline above. This is feedback only;
> it does not merge, override, or rewrite Codex's text. Every charge is backed by
> a `file:line` GLM read independently for its own as-built
> (`audits/126K__AsBuilt_GLM.md`). Where Codex over-claims, GLM says so; where
> Codex under-claims or omits, GLM adds.

### What Codex gets right

- The three-family shape is correct: full-screen modals (`bulk-edit`,
  `object-manager`), anchored dialog popovers (`dropdown-edit`, `textedit`,
  `popaddlink`, shared `popover`), and the shared `dropdownToggle` engine.
  GLM confirms each family exists in code.
- "`bulk-edit` is closest to a complete modal baseline" — agreed, and GLM can
  sharpen this: bulk-edit is the ONLY Dieter overlay with `role="dialog"` +
  `aria-modal="true"` (`bulk-edit.html:18`), Escape with `preventDefault`
  (`bulk-edit.ts:344`), and backdrop-click close (`bulk-edit.ts:373-375`). It is
  not just "closest" — it is the sole reference implementation; every other
  overlay is missing at least one of those three.
- "Popover-style controls have shared outside-click/Escape mechanics through
  `dropdownToggle`, but they are not a general modal system" — correct.
  `dropdownToggle` (`shared/dropdownToggle.ts:71-95`) gives outside-click +
  Escape to its consumers but provides no focus trap, no return focus, no
  scroll-lock, no stacking management (`dropdownToggle.ts:1-98`).

### Where Codex under-claims or misses (omissions to add)

1. **`object-manager`'s ARIA gap is markup-verifiable now, not speculative.**
   Codex says it "lacks verified dialog ARIA." GLM read the markup: the panel
   `.diet-object-manager__modal-body` has NO `role`, NO `aria-modal`, and NO
   accessible name (`object-manager.html:39-54`). This is no longer "lacks
   verified" — it is positively missing. The baseline should state the defect,
   not hedge it.
2. **`object-manager` has NO Dieter hydrator at all.** It is not exported from
   `dieter/components/index.ts:1-19` and has no `.ts` in
   `dieter/components/object-manager/`. Its runtime behavior (Escape, focus,
   backdrop) is therefore unverifiable from Dieter and lives in DevStudio/Bob.
   Codex's "structurally similar" claim is true for markup/CSS
   (`object-manager.css:19-42` mirrors `bulk-edit.css:14-38`) but unproven for
   behavior. The baseline should flag this as a known-unknown rather than imply
   parity.
3. **`textedit` is NOT in the `dropdownToggle` family and has NO host Escape.**
   Codex lumps textedit with the shared-mechanics popovers. It is not.
   `textedit/textedit.ts` implements its own outside-click
   (`handleDocumentPointer`, `textedit.ts:355-362`) and has no host-level
   Escape handler — only the link input binds Escape, and only to close the
   link form (`textedit.ts:119-127`). So a `textedit` popover cannot be
   dismissed with Escape at all. This is a third, distinct overlay lifecycle in
   Dieter, and it is a concrete a11y/UX defect the baseline does not mention.
4. **Escape semantics are inconsistent across families.** bulk-edit calls
   `preventDefault` on Escape (`bulk-edit.ts:344`); `dropdownToggle` does not
   (`dropdownToggle.ts:89-95`); textedit has none. Codex's "Escape handling" is
   treated as a single concept; the code shows three different behaviors.
5. **Two parallel outside-click engines coexist.** `dropdownToggle` binds one
   capture-phase `document` `pointerdown` listener
   (`dropdownToggle.ts:71-87`); textedit binds a second, independent one
   (`textedit.ts:50-51,355-362`). They do not coordinate. This is an
   architecture smell the baseline should name.
6. **`aria-modal` is used exactly once in the entire Dieter overlay surface**
   (bulk-edit only). Codex lists "`aria-modal`/`role=dialog`" as a rule to
   verify but does not state how rarely it is actually applied. GLM's
   inventory: `role="dialog"` on `dropdown-edit.html:7` and `textedit.html:13`
   (the popovers), `role="listbox"` on `dropdown-actions.html:31` and
   `dropdown-border.html:35` (NOT dialogs), and `aria-modal="true"` only on
   `bulk-edit.html:18`.
7. **Initial focus is inconsistent.** bulk-edit, dropdown-edit, and textedit
   focus their first control on open (`bulk-edit.ts:332-333`,
   `dropdown-edit.ts:13-15`, `textedit.ts:167`); dropdown-actions/fill/upload/
   border do NOT set focus on open (their `dropdownToggle` configs lack a
   focusing `onOpen`). Codex's "focus trap not verified" is right but understates:
   even the lesser bar of initial-focus is not uniformly met.
8. **Stacking literals are concentrated and named.** Codex says "raw stacking
   values." GLM pins them: popovers at `z-index: 12` (`popover.css:16`,
   `textedit.css:119`); full-screen modals at `z-index: 1000`
   (`bulk-edit.css:20`, `object-manager.css:25`). The two scales are
   unconnected, and a popover (`12`) hosted inside a modal (`1000`) works only
   by DOM order, not by an encoded scale. The baseline can be more specific.
9. **No `prefers-reduced-motion` handling in any overlay CSS read.** Codex lists
   reduced-motion as "not verified." GLM read `popover.css`, `textedit.css`,
   `bulk-edit.css`, `object-manager.css`, `dropdown-edit.css` and found zero
   `@media (prefers-reduced-motion)` blocks. The only motion control is the
   `--duration-base` token (`popover.css:19-20`), with no reduced-motion
   override. This is a confirmed gap, not just an unverified one.

### Where Codex over-claims or is imprecise

- **"Popaddlink, shared `popover`" grouped under dialog overlays.** `popaddlink`
  is a nested popover body with NO role and NO `aria-modal`
  (`popaddlink.html:1`); it does not manage its own open/close and is hosted by
  `dropdown-edit` or `bulk-edit`'s upload control. Calling it an overlay family
  overstates its independence. It is a sub-component of the two hosts.
- **The listbox popovers (`dropdown-actions`, `dropdown-border`, and by pattern
  `dropdown-fill`/`dropdown-shadow`) are NOT dialogs.** They use
  `role="listbox"` / `aria-haspopup="listbox"`
  (`dropdown-actions.html:14,31`, `dropdown-border.html:15,35`). Any future
  "one overlay system" doctrine must respect that a `listbox` popover and a
  `dialog` popover have different semantics even when they share the
  `dropdownToggle` engine. Codex's "overlay rules as one system" framing risks
  flattening this.
- **Codex's second-pass "weakest evidence" list omits the textedit Escape
  defect and the two-engine outside-click problem.** Those are concrete,
  code-backed weaknesses stronger than "raw stacking values."

### Where evidence is thin (for both passes)

- **Roma `.roma-modal` / `.roma-modal-backdrop`.** Neither Codex nor GLM has
  opened the actual `roma.css` in these passes (Codex's baseline asserts
  "Roma local modals (.roma-modal-backdrop, .roma-modal)" without a citation;
  GLM could not locate the file either and marks it UNVERIFIED in its as-built).
  The Roma convergence item is therefore standing on indirect references
  (`dialogs-and-modals.md:18-19`, MAMA §8) until the real CSS is read. The
  baseline should mark this as an open evidence gap, not treat Roma divergence
  as established.
- **The "upgrade popup" (PRD 125 monetization modal)** referenced at
  `dialogs-and-modals.md:20` is not covered by either pass.

### Net assessment of the Codex Baseline

Directionally correct and safe (it does not invent fixes, consistent with
MAMA §9 step 2). But it is **under-specified** where the code is already
decisive: the object-manager ARIA defect is markup-positive, the textedit
Escape defect is code-positive, and the two-engine outside-click duplication is
structural. Before human convergence (step 4), Codex's baseline should be
tightened to state these as findings rather than "not yet verified," and the
Roma item should be flagged as evidence-thin on both sides.
