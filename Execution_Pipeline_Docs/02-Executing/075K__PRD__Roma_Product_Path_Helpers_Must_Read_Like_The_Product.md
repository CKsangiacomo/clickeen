# 075K - Roma Product-Path Helpers Must Read Like The Product

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `documentation/architecture/CONTEXT.md`

---

## What This PRD Is About

This PRD is about one product promise:

On the active product path, Roma code should read like the product:

- open widget
- save widget
- manage account assets

The answer is not to move orchestration elsewhere.
The answer is to make Roma's own product-path helpers smaller and more direct.

---

## Product Scope

This PRD covers:

- Roma helpers on the active open/save/asset product path
- duplicated response/decision logic inside Roma product-path helpers
- Roma-side helper stacks that are harder to read than the product itself

This PRD does not cover:

- asset-path semantics from `75B`
- hosted transport from `75I`
- reopening Paris or creating a new gateway/orchestration layer

---

## Product Truth

For the real product:

1. Roma is the product/account shell.
2. Roma owns the account product path.
3. Tokyo/Tokyo-worker remain the downstream saved/live authority.
4. The right owner chain is already Roma -> Tokyo/Tokyo-worker.
5. The problem is helper thickness, not owner-boundary confusion.

---

## 1. Where We Fucked Up / How And Why

We got the owner boundary mostly right, then let some helper stacks become thicker than the product.

### A. Helper indirection accumulated

Some Roma helpers are harder to read than the underlying product flow they are supposed to express.

### B. Response and decision logic duplicated

When the same decision or response-shaping logic exists more than once, the product path gets harder to follow and harder to simplify.

### C. The repo can mistake helper thickness for architectural wrongness

That creates a dangerous temptation:

- move it to Paris
- add a gateway
- invent another coordinator

Those are the wrong answers.
The owner chain is already right.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The code stops reading like the product

If Roma helpers are thicker than the flow they represent, every future change feels bigger than it really is.

### B. Engineers reach for wrong fixes

When local helper thickness is misread as architecture failure, people start proposing new layers instead of deletion and simplification.

### C. AI preserves indirection

If helper stacks look active and important, AI keeps routing future work through them instead of collapsing the shape.

---

## 3. How We Are Fixing It

### A. Keep the owner chain, shrink the helpers

Roma stays the product shell.
Tokyo/Tokyo-worker stay the downstream authority.

We are simplifying inside that chain, not moving it.

### B. Prefer deletion, inlining, and direct product-path logic

If a helper no longer earns its keep, remove it.
If response shaping is duplicated, collapse it.

### C. Keep the product path direct

When a future engineer reads the active Roma path, it should be obvious how the product works.

---

## 4. What The System Looks Like Before / After

### Before

- some Roma product-path helpers are thicker than the product
- response/decision logic is harder to trace than it should be
- the code invites wrong "move it elsewhere" instincts

### After

- Roma product-path helpers are smaller and more direct
- the open/save/asset path reads like the product
- the owner chain stays intact
- simplification happens by deletion, not by new architecture

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `roma/lib/account-instance-direct.ts`
- `roma/lib/account-assets-gateway.ts`
- `roma/components/builder-domain.tsx`
- any touched Roma helper files on the active product path that duplicate response/decision logic

### Toxic LOCs and concepts that will be removed from the system

- Roma helper indirection that no longer earns its keep
- duplicated response/decision logic on open/save/asset paths
- local helper stacks that make the product path harder to read than the product itself

### Toxic workflows that will be removed

- solving Roma helper thickness by proposing a new service/gateway layer
- preserving indirection just because it already exists

### Files or branches that should disappear if they only preserve helper thickness

- touched wrapper/helper branches that do not improve owner-boundary clarity
- touched repeated response shaping that can be collapsed safely inside Roma

---

## Done Means

- Roma product-path helpers are smaller and more direct on the touched path
- the product path still clearly reads as Roma -> Tokyo/Tokyo-worker
- no new gateway/service/orchestration layer was introduced to get there
