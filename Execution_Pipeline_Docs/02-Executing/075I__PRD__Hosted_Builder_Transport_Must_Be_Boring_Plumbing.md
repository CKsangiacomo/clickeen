# 075I - Hosted Builder Transport Must Be Boring Plumbing

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`

---

## What This PRD Is About

This PRD is about one product promise:

Builder is a hosted editor inside Roma.
That transport should read like plumbing, not like a platform lifecycle protocol.

Some iframe mechanics are real and necessary.
But the product does not need transport theory everywhere.

---

## Product Scope

This PRD covers:

- Roma -> Bob hosted editor open flow
- Builder host command routing on the iframe boundary
- duplicated lifecycle/message-shaping logic
- retry/ACK/lifecycle behavior that may no longer earn its keep

This PRD does not cover:

- asset-path semantics from `75B`
- Minibob/product-identity cleanup from `75C`
- panel/runtime cleanup from `75J`

---

## Product Truth

For the real product:

1. Roma hosts Builder.
2. Bob loads inside that host.
3. Roma opens the current account widget in Bob.
4. Bob sends back only the minimum host/editor messages required to edit that widget.

The boundary is real.
The extra platform feeling is not.

---

## 1. Where We Fucked Up / How And Why

We treated one hosted editor like a generalized cross-runtime protocol.

### A. The host/editor path carries more lifecycle shape than the product needs

The product only needs a hosted Builder that opens, edits, and exchanges a few real commands.
The code still carries more protocol feeling than that.

### B. Duplicated message shaping and route resolution accumulated

Transport logic exists in more than one place, which makes a simple host/editor relationship feel more abstract than it is.

### C. Retry/ACK behavior may still be preserved out of fear, not product need

Some retry/acknowledgement logic may have been added to handle timing/race conditions that no longer justify the complexity.

The product should only keep the part that still earns its place.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. A simple iframe boundary looks like a transport platform

That makes the product harder to understand and harder to modify safely.

### B. Engineers cannot tell which mechanics are real and which are residue

When lifecycle and command logic are more abstract than the product, every change feels riskier.

### C. AI preserves protocol machinery because it looks active

If transport code looks foundational, AI keeps protecting it instead of judging whether it still serves the real Builder path.

---

## 3. How We Are Fixing It

### A. Keep the real boundary, delete the extra protocol feeling

We are not removing the iframe boundary.
We are reducing transport shape to the minimum required for the hosted Builder product.

### B. Collapse duplicated lifecycle and message-shaping logic

Where the same concern is represented more than once, the duplicate shape is deleted.

### C. Only keep retry/ACK behavior that still has a named failure mode

If a race still exists, we keep the minimal machinery that solves it.
If the failure no longer exists, the residue goes away.

---

## 4. What The System Looks Like Before / After

### Before

- hosted Builder transport feels more like a protocol system than product plumbing
- message shaping and lifecycle handling are harder to reason about than the product requires
- retry/ACK behavior may survive without a current failure-model justification

### After

- hosted Builder transport reads like boring plumbing
- only real iframe concerns remain
- duplicated message/lifecycle machinery is removed
- retry/ACK behavior exists only if a current race still requires it

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `roma/components/builder-domain.tsx`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/useSessionBoot.ts`
- `documentation/architecture/Overview.md`
- any touched lifecycle message contracts on the active Builder path

### Toxic LOCs and concepts that will be removed from the system

- duplicated route-resolution/message-shaping logic
- host/editor lifecycle machinery that no longer corresponds to a real current race or concern
- protocol-shaped indirection that makes one hosted editor feel like a platform
- transport docs that still describe stale subject-driven or URL-boot editor semantics as part of the active hosted Builder contract

### Toxic workflows that will be removed

- preserving lifecycle complexity without naming the failure it handles
- reasoning about Builder open as a generalized protocol instead of a hosted product flow

### Files or branches that should disappear if they only preserve transport inflation

- touched ACK/retry branches that no longer protect a real current race
- touched duplicated host-command shaping that can be collapsed without losing a distinct concern

---

## Done Means

- hosted Builder transport is easier to explain than before
- the remaining transport mechanics correspond to real iframe concerns
- removed lifecycle/retry complexity is justified by a concrete failure-mode answer
- the hosted editor boundary reads like product plumbing, not transport theory
