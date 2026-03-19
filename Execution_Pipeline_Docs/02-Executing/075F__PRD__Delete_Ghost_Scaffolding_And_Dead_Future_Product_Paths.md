# 075F - Delete Ghost Scaffolding And Dead Future Product Paths

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

The product should ship code for the product that exists today.

Not:

- code for future editor hosts
- code for future AI execution surfaces
- code for future budget systems
- code for future retry protocols
- code for future product modes that are not real

Dead future-product scaffolding is not harmless.
It teaches the repo the wrong product.

---

## Product Scope

This PRD covers:

- dead or speculative product-path scaffolding in the active authoring/editor path
- dual boot and extra runtime modes that are not the real product path
- dead fields and enum members that imply features we do not ship
- fake future-oriented branches that expand the authoring surface without improving UX

This PRD does not cover:

- Minibob identity cleanup from `75C`
- asset-path cleanup from `75B`
- localization tax from `75E`

---

## Product Truth

For the active product:

1. Roma hosts Builder for the current account.
2. Bob runs the editor.
3. The real Builder path is the current product path.
4. Code that exists only for hypothetical future product modes does not belong in the active authoring system.

If a field, mode, enum member, branch, or retry shape does not improve current product UX, it should not survive by default.

---

## 1. Where We Fucked Up / How And Why

We kept scaffolding after the imagined future failed to arrive.

### A. We left dead future modes in shared types

Some shared types still advertise capabilities that are not actually product realities.

That happened because AI tends to leave "just in case" members behind after product direction narrows.

### B. We preserved more than one boot/runtime path for one real product

The active Builder product path is not "many equal hosts."
But shared session code still carries more than one boot shape.

That happened because flexibility was preserved instead of cut over.

### C. We left dead AI/product fields behind

Some AI-related fields and surfaces still describe budgeting/provisioning shapes the product does not actually use.

That happened because speculative infrastructure was added before the product needed it.

### D. We normalized speculative product ideas into shared code

Every dead mode or dead field teaches future engineers and future AI that the product is broader than it really is.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The repo lies about what the product is

If shared code advertises modes and fields that do not correspond to real product behavior, every future change starts from false assumptions.

### B. AI preserves the dead paths

A dead branch with an enum member and a caller looks "important" to AI.

So the branch survives forever.

### C. Real product work gets slower

Every extra mode and every extra field expands review, testing, reasoning, and fear.

### D. Product boundaries blur

If one real Builder path ships beside speculative alternates, the code stops reflecting one clear product path.

---

## 3. How We Are Fixing It

### A. Dead fields and enum members get deleted

If the product does not use them now, they do not stay as placeholders.

### B. The real Builder boot path becomes the only product path

Any alternate boot/runtime shape that exists only for non-product or dev residue must be removed or clearly gated out of the product path.

### C. AI/product scaffolding gets judged by current UX, not theoretical reuse

If a field or branch does not make Builder better for customers now, it does not survive because it is "nice to have later."

### D. Shared code stops advertising futures it does not own

The product path should read like the product.
Not like a roadmap wishlist.

---

## 4. What The System Looks Like Before / After

### Before

- shared code advertises extra modes and product futures
- dead AI and runtime fields survive in core types
- alternate boot/runtime residue expands the active path
- the codebase looks broader than the actual product

### After

- shared code names only real product modes
- dead scaffolding is deleted
- Builder follows one clear product path
- the codebase becomes harder to misread and easier to simplify

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/sessionPolicy.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`
- `roma/components/builder-domain.tsx`
- `packages/ck-policy/src/ai.ts`
- any shared files carrying dead authoring/product modes or fields

### Toxic LOCs and concepts that will be removed from the system

- dead enum members such as unused AI execution surfaces
- dead AI budget/provisioning fields that the product does not populate or read
- alternate boot/runtime branches that are not part of the real Builder product path
- shared code that advertises future product modes instead of current product truth

### Toxic workflows that will be removed

- preserving production complexity for hypothetical future hosts or AI surfaces
- keeping dead product-shape fields just because they are already in types
- reasoning about Builder as multiple equal runtime paths when the product has one real path

### Files or branches that should disappear if they only preserve ghost scaffolding

- dead AI execution-surface branches
- unused provisioning/budget metadata fields
- non-product boot/runtime branches left in shared Builder code

---

## Done Means

- dead future-product scaffolding no longer survives in the active authoring path
- shared types advertise only real product modes and fields
- Builder follows one clear runtime/boot story
- the codebase is narrower, more honest, and easier to evolve
