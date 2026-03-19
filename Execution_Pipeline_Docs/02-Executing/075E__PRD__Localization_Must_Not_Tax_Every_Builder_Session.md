# 075E - Localization Must Not Tax Every Builder Session

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md`
- `documentation/architecture/CONTEXT.md`

---

## What This PRD Is About

This PRD is about one product promise:

Builder always edits one widget in one active locale at a time.
Translation is async follow-up work after save.

Localization is a real feature, but it is not the editor itself.
It is a subordinate feature layered onto the editor.

---

## Product Scope

This PRD covers:

- how Builder edits one active locale
- how locale switching affects the active editing context
- how localization affects save and async follow-up translation work
- how much localization machinery lives in the always-on editor core

This PRD does not cover:

- asset cleanup from `75B`
- Minibob cleanup from `75C`
- broad account locale-settings redesign outside Builder

---

## Product Truth

For the real product:

1. Builder always edits one widget in one active locale at a time.
2. Switching locale changes the active editing context; it does not create a second widget or a second editing product.
3. Save still means save this widget.
4. Translation happens asynchronously after save; it is not the same thing as editing.
5. Localization is contextual/downstream complexity, not the core identity of the editor.
6. The editor must not be modeled as if it is fundamentally a multi-locale state machine.

This is not a question of one locale vs many locales.
Editing itself is always one-locale.
Translation is the async part.

---

## 1. Where We Fucked Up / How And Why

We embedded a translation-management system into the core session path.

### A. Localization lives inside the always-on editor core

The core Builder session always carries locale machinery, even though the customer is always editing one active locale.

That happened because localization was implemented as part of the base session model, not as a subordinate lane activated when needed.

### B. Save semantics got more complex than the product

Localization added:

- overlay state
- dirty tracking
- fingerprints
- translation monitoring
- locale-only persistence

Those are real implementation needs, but they were allowed to reshape the mental model of Save.

The key mistake was conceptual:

- editing is one active locale
- translation is async follow-up

The code blurred those together.

### C. Every session pays for cross-locale complexity

Even when localization is inactive, the core session still mounts and reasons about localization structures.

That happened because we optimized for one generalized multi-locale session instead of one boring one-locale editor with async translation behavior around it.

### D. Multi-language machinery leaked into the base widget contract

Localization should be subordinate to the same widget and the same active-locale edit.
Instead, the codebase often treats it like editing and translation are one fused system.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The simple case becomes harder than it should be

If a customer is editing one widget in one active locale, Builder should feel tiny and direct.

Instead, they pay hidden complexity for:

- overlay state
- status tracking
- translation aftermath
- cross-locale orchestration

### B. Save becomes harder to trust

The customer should not need to care whether Builder is doing:

- base save
- locale save
- translation status follow-up

The more translation machinery is embedded into the main save path, the less boring Save becomes.

### C. The editor becomes harder to simplify

Once localization owns a large share of the session layer, every future cleanup has to tiptoe around it.

That makes one-active-locale editing harder to keep clean.

### D. Product understanding erodes

If the editor is built like translation is part of editing instead of async aftermath, the code stops reflecting the real product hierarchy.

---

## 3. How We Are Fixing It

### A. The base Builder path becomes one active-locale editing again

The base Builder path should model:

- one widget
- one active locale
- one save

without carrying unnecessary cross-locale orchestration in the hot path.

### B. Localization becomes an activated feature lane

Localization machinery should become active only when the account and the current editing situation actually require it.

Not every session.

### C. Translation becomes explicit async aftermath

If translation follow-up still exists:

- it remains subordinate to the same Save action
- it does not redefine what Save means
- it does not turn editing into a multi-locale control plane

### D. Locale switching stays a context switch, not a second editor

Switching locale means:

- the customer is now editing a different active locale context
- not that the editor became several simultaneous editing truths

### E. The base session stops over-owning translation management

Only the minimum localization state required for the active session should live in the base path.

Everything else should stop taxing one-active-locale editing.

---

## 4. What The System Looks Like Before / After

### Before

- Every Builder session carries a large localization system.
- One-active-locale editing still pays cross-locale complexity.
- Save and session state are harder to reason about because translation is embedded into the core editing path.

### After

- Builder editing is clearly one active locale at a time.
- Localization activates only when needed.
- Translation is clearly async aftermath, not editing itself.
- The editor remains one widget editor, not a translation-management shell.
- Save remains one customer action with clear truth.

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `bob/lib/session/useWidgetSession.tsx`
- `bob/lib/session/useSessionLocalization.ts`
- `bob/lib/session/sessionLocalization.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/components/LocalizationControls.tsx`
- `roma/lib/account-locales.ts`
- any Builder host routes that exist only to preserve always-on localization complexity

### Toxic LOCs and concepts that will be removed from the system

- always-on localization machinery in the default Builder session
- save-path complexity that exists only because translation was embedded into editing itself
- overlay/status/tracking state that taxes one-active-locale editing without improving active-locale UX
- product language that implies the editor is a translation-management product first

### Toxic workflows that will be removed

- one-active-locale open/edit/save paying for cross-locale orchestration
- default Builder session carrying localization state it does not need
- translation aftermath behavior obscuring the main save contract

### Files or branches that should disappear if they only serve always-on localization tax

- core-session locale branches that do nothing for single-language product use
- default-save branches that exist only to preserve translation-management machinery in the hot path

---

## Done Means

- Builder editing is clearly one active locale at a time
- translation is clearly subordinate async aftermath, not editing identity
- one-active-locale Builder sessions no longer carry unnecessary localization burden
- localization is clearly subordinate to the base widget editor
- Save remains one boring action even when localization exists
- the session layer becomes more proportional to the real default product
