# 075H - Active Widgets Must Have Real Open And Save Contracts

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

If Clickeen ships a widget in Builder, that widget must have a real open/save contract at the server boundary.

That contract must answer:

- can Builder open this saved widget truthfully?
- can Clickeen save this widget truthfully?

It must not answer a different question:

- does this saved row match today's full software-default shape?

---

## Product Scope

This PRD covers:

- server-side open/save contract enforcement for active shipped widgets
- persisted-document sanity at the Roma boundary
- how active widget contracts are derived from existing widget truth
- how Builder avoids rejecting older/narrower saved rows for the wrong reason

This PRD does not cover:

- asset routing from `75B`
- Minibob cleanup from `75C`
- broad schema-platform work
- broad compiler redesign outside the parts needed to derive owner-correct widget truth

---

## Product Truth

For the real product:

1. Active shipped widgets must open and save through one real Roma boundary.
2. That boundary must validate persisted-document truth, not current full software-default expansion.
3. Builder should fail when saved widget data is truly invalid.
4. Builder should not fail because the saved row is older or narrower than today's software shape.
5. Server save/open authority remains explicit and boring.

This PRD is in scope for the active widget set:

- `faq`
- `countdown`
- `logoshowcase`

---

## 1. Where We Fucked Up / How And Why

We talked like the platform had generic authoring safety, but the actual save/open contract stayed narrower and more bespoke than the story.

### A. The platform story is broader than the real safety net

The system sounds like it has a broad, generic authoring validation layer.
In practice, the real contract coverage is still narrower and uneven across active widgets.

### B. Saved-row truth got confused with software-default truth

The deepest semantic bug is not "the validator is not fancy enough."
The real bug is that the wrong contract question keeps appearing:

- does this row match today's software shape?

Instead of:

- is this persisted widget document sane enough to open and save?

### C. Builder open can be punished for software evolution

If open/save enforcement drifts toward current full software-default shape, older saved rows can become unloadable for the wrong reason.

That is not product safety.
That is accidental incompatibility.

### D. Healing and validation drift apart

When client-side healing exists and the server boundary is asking a slightly different question, product behavior becomes unclear and hard to trust.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. Builder can reject real customer widgets for the wrong reason

If older or narrower saved rows are judged against current software shape, Builder can fail even when the saved widget is still a valid persisted document.

### B. Safety becomes both too weak and too strong

Too weak:

- active widgets do not all have equally real boundary enforcement

Too strong in the wrong place:

- saved rows risk being judged by software-shape expectations they were never meant to satisfy

### C. Engineers cannot tell what "valid widget" really means

If the product contract is not clearly "persisted-document sanity for active widgets," every future change risks repeating the same semantic mistake.

### D. AI execution gets pulled toward schema theater

Without a sharp product contract, AI tends to answer with:

- generic schema frameworks
- validator generators
- library swaps

That increases machinery without fixing the real semantic bug.

---

## 3. How We Are Fixing It

### A. Roma remains the explicit open/save authority

The server boundary decides whether an active widget document is valid to open/save.

### B. Contracts become real per active widget

For active shipped widgets, Roma will use direct persisted-document sanity checks derived from existing widget truth.

Not a second authoring system.
Not a schema platform.

### C. Saved-row truth stops being judged as software-default shape

The contract will explicitly stop treating current full widget defaults as saved-row schema.

### D. Invalid state is rejected at the right boundary

If a widget is truly invalid, the server says so clearly.

If a widget is merely older/narrower than today's software shape, Builder should still be able to open it as a persisted document.

---

## 4. What The System Looks Like Before / After

### Before

- the platform story sounds more generic than the real contract
- active widgets do not all have equally clear boundary safety
- saved rows risk being judged against current software shape instead of persisted-document truth

### After

- active shipped widgets have real open/save contracts
- Roma validates persisted-document sanity, not software-default expansion
- Builder can open older/narrower saved rows when they are still valid persisted documents
- server boundary safety becomes simpler and more defensible

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `roma/lib/widget-config-contract.ts`
- `roma/lib/account-instance-direct.ts`
- widget-contract helpers derived from current active widget truth
- any touched active widget docs that still imply full-default-shape saved-row validation

### Toxic LOCs and concepts that will be removed from the system

- save/open checks that treat current full software defaults as saved-row schema
- ad hoc widget-specific branches that exist only because active-widget contract closure is inconsistent
- boundary logic that asks the wrong semantic question about saved widget validity

### Toxic workflows that will be removed

- Builder open failing because saved rows are older/narrower than today's software shape
- pretending we have generic platform safety while real guardrails are partial and bespoke
- solving a semantic contract bug by reaching for a new schema platform

### Files or branches that should disappear if they only preserve the wrong contract semantics

- full-default-shape saved-row gates on touched active widgets
- touched client-healing branches that exist only because the server contract is still semantically wrong

---

## Done Means

- active shipped widgets have real open/save boundary safety
- Roma validates the right contract
- Builder open does not fail merely because a saved row is older or narrower than today's software defaults
- no new schema framework was introduced to achieve that
