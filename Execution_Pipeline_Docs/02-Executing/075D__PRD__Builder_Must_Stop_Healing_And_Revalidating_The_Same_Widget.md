# 075D - Builder Must Stop Healing And Revalidating The Same Widget

Status: EXECUTED
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

When Builder opens a widget, shows a widget, and saves a widget, Clickeen must not silently "heal" or re-validate that same widget at every layer.

The customer should be able to trust:

- what Builder is showing
- what Save is trying to save
- which layer is responsible when data is invalid

Builder should not behave like every layer distrusts the one before it.

---

## Product Scope

This PRD covers:

- what Builder does to saved widget data when it opens
- what Builder is allowed to silently reshape while editing
- where normalization belongs
- where validation belongs
- how invalid widget data is surfaced to the customer

This PRD does not cover:

- Minibob identity cleanup from `75C`
- asset-path cleanup from `75B`
- localization product scope beyond the specific distrust it adds to the base editor path
- broad compiler or panel redesign

---

## Product Truth

For the real Builder product:

1. Roma opens the widget for the current account.
2. Builder shows the widget Roma opened.
3. Builder may give UX guidance while editing.
4. Roma decides whether the saved widget is valid.
5. If data is invalid, the product must fail truthfully.
6. The system does not get to silently rewrite widget truth at every layer and call that reliability.

One widget.  
One visible truth.  
One real save boundary.  
No hidden healing loop.

---

## 1. Where We Fucked Up / How And Why

We let every layer "help."

That help turned into repeated validation, repeated shaping, and silent repair.

### A. Builder reshapes data before the customer even sees it

On open and on some non-user injections, Builder sanitizes and reshapes widget data before presenting it.

That happened because we accumulated distrust in the saved document instead of deciding which layer owns saved-document validity.

### B. Builder and Roma both act like they own correctness

Builder does some shape/limit work.
Roma does save validation.
Roma also validates on read.

That happened because we added protection at each layer without deleting the previous protection.

### C. Silent repair became normal behavior

The system currently tends to:

- sanitize
- normalize
- reshape
- then replace local state with server-returned state

without making the bug visible.

That happened because the repo optimized for "keep going" instead of "tell the truth."

### D. Product-invalid data can hide until later

If Builder silently heals a widget and Roma separately validates again later, the customer can end up in a product where:

- the widget looked fine
- the save was surprising
- or a saved widget later becomes unloadable

That is not resilience.
That is uncertainty.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. Builder stops feeling trustworthy

If the widget shown to the customer is not clearly the real saved/editing widget, Builder feels slippery and unsafe.

### B. Bugs become invisible instead of solvable

Silent repair hides:

- bad saved data
- bad AI output
- bad editor mutations
- bad contract assumptions

The team loses the ability to see where truth was actually broken.

### C. Save failures become hard to explain

If Builder and Roma each keep their own idea of validity, nobody can answer:

- what exactly was invalid
- when it became invalid
- which layer should have caught it

### D. Future simplification becomes harder

Every healing layer makes the next engineer preserve it.
AI then sees active callers and defends the extra machinery.

---

## 3. How We Are Fixing It

### A. Roma remains the saved-document authority

Roma decides whether a widget is valid to persist.

Builder may help the user edit.
Builder does not become a second persisted-document authority.

### B. Builder stops silently normalizing widget truth on the active edit path

Normalization belongs only at explicit boundaries that the product can defend.

Not:

- every edit
- every preview
- every opportunistic injection

### C. Invalid data fails visibly

If saved widget data is invalid, the product should say so.

Allowed:

- explicit entitlement sanitization
- explicit UX messaging

Forbidden:

- silent rewriting followed by pretending nothing was wrong

### D. Validation ownership becomes boring

- Builder validates enough to support editing UX
- Roma validates persisted-document correctness
- the same concern does not get re-owned three times

### E. Read-path validation stops acting like speculative migration policy

The product should not casually make previously-saved widgets unloadable because current software expectations changed.

The open path must remain honest about saved-document reality.

---

## 4. What The System Looks Like Before / After

### Before

- Builder silently reshapes widget data.
- Roma separately validates the same widget on save and on read.
- The customer cannot tell whether Builder or Roma owns correctness.
- Data bugs are healed around instead of exposed.

### After

- Builder shows one real widget truth.
- Roma owns persisted-document validity.
- Invalid data fails visibly and specifically.
- Normalization is not an always-on editing reflex.
- The product becomes easier to trust and easier to debug.

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/useWidgetSession.tsx`
- `roma/lib/account-instance-direct.ts`
- `tokyo-worker/src/routes/internal-render-routes.ts`
- `tokyo-worker/src/domains/render.ts`
- any shared contract helpers used by both Bob and Roma

### Toxic LOCs and concepts that will be removed from the system

- silent Builder-side healing that mutates visible widget truth without explicit product meaning
- repeated validation ownership for the same persisted-document concern
- normalization running on hot edit/preview paths
- read-path persisted-document rejection based on software-shape drift that does not reflect real saved-row truth
- UI/state flows that treat server-returned replacement state as normal product behavior instead of a visible correction

### Toxic workflows that will be removed

- open -> sanitize -> reshape -> edit -> save -> revalidate -> replace local truth
- edit-path mutation logic acting like persisted-document migration logic
- invisible healing of AI/editor mistakes that should instead fail visibly

### Files or branches that should disappear if they only exist to preserve silent healing

- Builder-side hot-path normalization branches that do not serve a real product boundary
- duplicated config-validity checks that Roma already owns for persistence
- fallback logic that invents visible widget values instead of surfacing invalid state

---

## Done Means

- Builder no longer silently heals the same widget at multiple layers
- Roma is the clear persisted-document authority
- invalid widget data fails visibly instead of being normalized into ambiguity
- hot edit/preview paths are no longer carrying persisted-document repair logic
- customers can trust what Builder is showing and what Save means
- Tokyo no longer keeps one saved-document truth for Builder open and a second null-collapsing truth for sibling sync/localization flows
- product-path save no longer reads backward into the previous saved pointer to recover sibling metadata in Tokyo
- Tokyo product-path save no longer validates the same widget payload twice in parallel route/helper layers
- Roma no longer keeps a successful-200 saved-document guard after Tokyo has already passed its named read boundary
