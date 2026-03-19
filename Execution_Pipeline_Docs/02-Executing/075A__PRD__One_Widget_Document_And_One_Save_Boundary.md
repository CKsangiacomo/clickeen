# 075A — Builder Must Edit And Save One Real Widget

Status: EXECUTED
Date: 2026-03-18
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`

---

## What This PRD Is About

This PRD is about one product promise:

When a customer opens a widget in Builder, edits it, and presses Save, Clickeen must behave as if they are editing and saving one real widget.

Not:

- one base widget plus a hidden second version
- one preview version plus one saved version plus one derived version
- one Save button that secretly means several different workflows

Builder must feel trustworthy.

---

## Product Scope

This PRD covers:

- what the customer sees when they open a widget in Builder
- what Builder treats as the real widget while the customer edits
- what Save means to the customer
- how Builder handles localized accounts without turning localization into a second hidden product
- how Clickeen prevents Builder from showing or saving fake widget state
- how Roma decides whether the saved widget is valid

This PRD does not cover:

- asset-path cleanup
- hosted editor transport cleanup
- Minibob cleanup
- panel/compiler cleanup
- shared policy cleanup

---

## Product Truth

For the active product path:

1. The customer opens one widget in Builder.
2. Builder shows one real widget.
3. The customer edits that widget.
4. The customer presses Save once.
5. Clickeen saves that widget.
6. If follow-up work happens after save, Builder tells the truth about it.

Roma is the save/open server boundary.  
Bob is the editor.  
Tokyo/Tokyo-worker own saved/live truth downstream.

---

## 1. Where We Fucked Up / How And Why

We let the codebase forget what the product is.

The product is simple: open widget, edit widget, save widget, done.

The implementation drifted into a system where Builder behaves like it is managing several competing versions of the same widget at once.

### A. We turned one widget into several competing truths

In the real product, the customer is editing one widget.

In the current implementation, the active Builder path still carries several shapes that can all look authoritative:

- the widget the customer sees
- the widget Bob treats as the editable base
- the widget the system remembers as last saved
- a separate shadow preview widget
- locale overlay state
- software-default-backed state on some paths

That happened because we kept adding machinery for preview, localization, dirty tracking, limits, and recovery without forcing one surviving authority.

The result is not "flexibility." The result is that nobody can answer a simple product question:

What is the real widget right now?

### B. We made Save mean more than one thing

The customer sees one Save button.

The current system can treat that one action as:

- save the base widget
- save only locale overrides
- save base and then save locale overrides
- save and then start translation aftermath work

That happened because localization is real behavior, but we let save absorb locale persistence and translation aftermath instead of keeping editing and save brutally simple.

### C. We split document truth between Builder and Roma

Builder still sanitizes and reshapes config on load.
Builder still performs limit logic during edit flows.
Roma still validates on open and save.

That happened because distrust accumulated in layers.

Instead of saying:

- Roma decides what a valid saved widget is
- Bob edits what Roma opened

we let several layers "help."

That help turned into duplicated authority.

### D. We built a fake-generic validation story

The current validation language sounds like platform safety.

The real implementation is mostly:

- FAQ has real contract logic
- other active widgets fall through

That happened because we talked in generic platform terms without doing the smaller honest thing: narrow persisted-document checks for the widgets we actually ship.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

This is not just a code quality problem. It is a product trust problem.

### A. The customer cannot trust what Builder is showing

If several internal states can all act like "the widget," then Builder can show something that is not clearly the saved widget, not clearly the editable widget, and not clearly just a preview.

That makes the editor feel slippery.

### B. The customer cannot trust what Save means

If Save can trigger several different meanings depending on locale and internal dirtiness, then:

- success is ambiguous
- failure is ambiguous
- "saved with warning" becomes hard to reason about
- localized accounts feel like a special broken lane

### C. Builder can feel valid while Roma rejects the save

If Builder heals, sanitizes, and reshapes visible state while Roma separately validates the saved document, then the product can drift into this failure mode:

- the customer edits what looks like a valid widget
- Save fails or mutates in a surprising way
- nobody can explain whether Builder or the server was "right"

That is poisonous product behavior.

### D. The team cannot safely evolve the product

If nobody can answer "what is the widget" and "what does Save do," then every future change becomes risky.

That slows product iteration, makes AI execution worse, and turns a simple Builder into something nobody fully trusts.

---

## 3. How We Are Fixing It

We are restoring one simple Builder contract.

### A. Builder will edit one canonical widget document

For account-mode Builder:

- there is one canonical widget document in memory
- Builder shows that same widget while the customer edits
- Preview does not get its own widget-shaped state

Rules:

- preview is not document truth
- preview is not save truth
- preview is not dirty-state truth
- preview is not its own widget
- hidden defaults are not document truth
### B. Save will mean one boring thing

Save means:

- save this widget for this account

Save does not mean:

- save only locale overrides
- save base and then run a second hidden locale save
- save and then make the user reason about translation machinery

Any translation work happens after save. It is not part of the product meaning of Save.
Builder no longer owns a localization authoring lane.

### C. Roma will stay the only persisted-document authority

Roma decides whether the widget Builder is trying to save is a valid saved widget.

Bob may give non-authoritative UI guidance before save.
Bob may reject impossible local edit operations before they mutate the session.
Bob may not silently heal widget truth, mint a second validity model, or overrule Roma's saved-document decision.
Bob does not become the saved-document authority.

### D. Validation will be real and narrow

We are not building a second widget-truth layer in Roma.

We are fixing the actual product:

- Builder open/save must ask only the narrow persisted-document sanity questions that actually belong at the save boundary
- saved rows must not be judged against current full software defaults
- Roma must not re-litigate widget software truth with a second widget-shape validator
- malformed saved rows must fail at the Roma/Tokyo open boundary instead of being healed or masked as "not found"

### E. Silent client-side healing will stop pretending to be truth

Allowed:

- explicit entitlement sanitization
- explicit UX guidance

Forbidden:

- silently rewriting the visible widget and then treating that rewritten version as normal saved truth

---

## 4. What The System Looks Like Before / After

### Before

- Customer opens one widget, but the system internally behaves like several widget truths are in play.
- Builder can show values that are not clearly from the real saved widget.
- Save can mean different things depending on hidden internal state.
- Localization behaves like a parallel save lane.
- Validation talks like a platform but only really protects part of the active product.

### After

- Customer opens one widget and Builder is editing one real widget.
- What Builder shows is either:
  - real widget document state
  - explicit entitlement-owned sanitization
- Save means one product action: save this widget.
- Localized accounts still work while Builder edits and saves one widget.
- Roma is the clear saved-document gate.
- Roma only applies narrow storage-boundary checks that actually belong at save.

---

## 5. Files Touched + Toxic LOCs / Workflows / Files Removed

### Files touched

- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/useWidgetSession.tsx`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionPolicy.ts`
- `bob/components/TdMenu.tsx`
- `bob/components/TdMenuContent.tsx`
- `bob/components/td-menu-content/useTdMenuBindings.ts`
- `bob/components/td-menu-content/dom.ts`
- `bob/components/ToolDrawer.tsx`
- `bob/components/SettingsPanel.tsx`
- `bob/components/Workspace.tsx`
- `bob/app/bob_app.css`
- `roma/app/api/account/instance/[publicId]/route.ts`
- `roma/app/api/builder/[publicId]/open/route.ts`
- `roma/components/builder-domain.tsx`
- `roma/lib/builder-open.ts`
- `roma/lib/account-instance-direct.ts`
- `dieter/components/dropdown-fill/asset-picker-data.ts`
- `dieter/components/dropdown-fill/asset-picker-overlay.ts`
- `dieter/components/dropdown-fill/dropdown-fill.ts`
- `dieter/components/dropdown-fill/dropdown-fill-types.ts`
- `dieter/components/dropdown-fill/media-controller.ts`
- `dieter/components/dropdown-upload/dropdown-upload.ts`
- `dieter/components/shared/assetResolve.ts`
- `dieter/components/shared/assetUpload.ts`
- touched Bob/Roma/context docs for current-truth wording
- `documentation/architecture/Overview.md`
- `documentation/ai/overview.md`
- `documentation/services/roma.md`

### Toxic LOCs and code shapes to remove or collapse

- `bob/lib/session/useWidgetSession.tsx`
  - any dirty/discard API that depends on a second saved-widget shadow in Bob
  - toxic because it turns one widget into current-truth plus saved-shadow truth

- `bob/components/Workspace.tsx`
  - `const runtimeData = previewData ?? instanceData;`
  - toxic because preview must not select between two widget truths

- `bob/lib/session/useSessionBoot.ts`
  - any account-path fallback that reintroduces `compiled.defaults` as visible widget truth
  - any load sanitization that silently rewrites the visible widget and makes that rewrite look normal

- `bob/components/ToolDrawer.tsx`
  - any account-path fallback that recovers asset picker/upload context from iframe URL query params instead of the Roma open envelope
  - any global document dataset bridge used to leak Builder host/account/widget context into shared controls
  - toxic because Builder host context must come from the one explicit Roma boot payload, not ambient URL leakage or a hidden side-channel bridge

- `dieter/components/dropdown-fill/*` and `dieter/components/dropdown-upload/*`
  - any hosted asset picker/upload/resolve helper, overlay, or fallback path surviving inside Builder controls after the bridge/path is removed
  - toxic because deleted Builder asset authoring must not survive as dormant control architecture

- `bob/lib/session/useSessionSaving.ts`
  - locale-only save as a separate user meaning of Save
  - base-save plus any second hidden save workflow
  - translation-monitor aftermath living inside the user meaning of Save
  - any save response loop that re-hydrates the same widget back into Bob just to confirm the write

- `bob/lib/session/sessionTypes.ts`
  - any extra top-level widget-shaped state beyond the one real widget being edited
  - `previewData` and any other shadow preview state that duplicates the widget
  - `baseInstanceData` and any duplicate live-widget alias that preserves a second in-memory truth
  - `savedBaseInstanceData` and any saved-widget shadow used only for dirty/discard comparison

- `roma/lib/account-instance-direct.ts`
  - any persisted-document validation that is broader than the real saved-row contract
  - any duplicated validation branch that survives without a clear boundary reason
  - any shared helper mode-switch that makes document-open and publish/live-status lookup share one mixed loader

- `bob/lib/session/sessionPolicy.ts`
  - any Bob-side policy re-validation/parsing layer that re-checks the Roma open envelope instead of trusting the named host boundary

### Toxic workflows to remove

- customer edits one widget while the system behaves like several widgets are in play
- Builder shows hidden non-document state as if it were the real widget
- Save has multiple hidden meanings
- localization behaves like a second product inside Builder
- Builder asset authoring survives as disabled-but-still-architected helper code
- Builder and Roma both act like saved-document authorities
- validation claims platform coverage while only partially protecting the real product

### Files removed from the system

- `roma/lib/widget-config-contract.ts`
  - deleted because it was a fake-generic second widget-shape validator hanging off the Roma save boundary
- `bob/lib/session/useSessionLocalization.ts`
  - deleted because Builder no longer carries a localization overlay/session subsystem
- `bob/lib/session/sessionLocalization.ts`
  - deleted because Builder no longer reconstructs widget truth from locale overlays
- `bob/components/LocalizationControls.tsx`
  - deleted because Builder no longer exposes a localization panel or locale preview lane
- `bob/lib/session/sessionPolicy.ts`
  - deleted because Builder no longer re-validates policy shape after Roma opens the session
- `roma/lib/account-localization-control.ts`
  - deleted because Roma no longer wraps Builder-owned localization snapshot/status/user-layer calls
- `roma/app/api/account/instances/[publicId]/localization/route.ts`
- `roma/app/api/account/instances/[publicId]/l10n/status/route.ts`
- `roma/app/api/account/instances/[publicId]/layers/user/[locale]/route.ts`
  - deleted because Builder no longer owns localization rehydrate/status/user-layer flows

---

## Done Means

75A is done only when all of the following are true:

1. A human can describe Builder truthfully as:
   open widget, edit widget, save widget, done.
2. Builder is editing one real widget, not several competing versions of it.
3. Save means one boring thing to the customer.
4. Localized accounts still work without turning Builder into a second localization product.
5. Builder does not show hidden default-backed values as if they were the real widget.
6. Roma is the clear saved-document authority.
7. Roma save/open does not re-litigate widget software truth with a second widget-shape validator.
