# 075J - Compiler And Panels Must Stop Hiding The Editor Contract

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

The Builder surface should be understandable from the product contract, not reverse-engineered from compiler heuristics and panel runtime tricks.

The compiler may compile and harden.
It must not quietly become the true author of the editor contract.

Panels may be opinionated.
They must not be implicit magic.

---

## Product Scope

This PRD covers:

- compiler authority over the editor contract
- panel contract explicitness
- path-specific panel/runtime special cases
- `show-if` / dynamic panel behavior on active widgets

This PRD does not cover:

- asset routing from `75B`
- hosted transport from `75I`
- broad widget-source redesign unrelated to the touched panel path

---

## Product Truth

For the real product:

1. The authoring contract should be visible and explainable.
2. The compiler may harden and compile widget truth.
3. Bob should render a clear editor contract, not discover it through scattered implicit rules.
4. If active widgets depend on dynamic panel behavior, that dependency must be named honestly.

---

## 1. Where We Fucked Up / How And Why

We let compiler and panel behavior become more magical than the product.

### A. The compiler owns more than compile/harden

The compiler still injects or rewrites too much of the final authoring surface.

That makes it hard to tell whether a panel/control comes from widget truth, compiler rewriting, or Bob-owned UI behavior.

### B. The panel contract is too implicit

The product should not require engineers to reconstruct panel order, panel identity, and panel ownership from several files.

### C. Dynamic runtime behavior carries too much editor theory

Path-specific branches, linked-op special cases, DOM-binding glue, and `show-if`-style behavior still make panel/runtime behavior more magical than it should be.

### D. The repo can mistake widget-source migration for Bob cleanup

If active widget sources still depend on `show-if` or similar behavior, that must be said explicitly.

Otherwise the code pretends one-file Bob cleanup is possible when it is really a wider contract change.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The editor contract becomes hard to explain

If panels and controls are shaped by hidden compiler/runtime behavior, the Builder surface becomes harder to trust and harder to modify.

### B. Engineers cannot name the surviving authority

If compiler and Bob both quietly own overlapping editor-contract truth, every future change risks preserving two parallel contracts.

### C. AI keeps preserving magic

Implicit panel behavior with active callers looks important to AI.
So it survives even when it mostly encodes old editor theory instead of product need.

---

## 3. How We Are Fixing It

### A. Compiler authority becomes narrower and explicit

The compiler will stay in a compile/harden posture.
It will stop silently acting like the real author of large parts of the editor contract.

### B. The panel contract becomes more source-visible

The product should be explainable without reverse-engineering Bob internals.

### C. Runtime special cases get deleted when the simpler control contract can absorb them

We prefer deletion over adding another panel framework.

### D. `show-if` work stays honest

If active widgets still depend on it, the work must declare whether it is:

- Bob/runtime reduction only
- or widget-source migration too

---

## 4. What The System Looks Like Before / After

### Before

- compiler and panel behavior jointly hide the editor contract
- panel identity/order/ownership are harder to read than the product deserves
- dynamic runtime branches preserve old editor theory

### After

- the editor contract is more source-visible
- compiler authority is narrower and easier to explain
- panel/runtime behavior is smaller and less magical
- `show-if` reduction is scoped honestly against real widget callers

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `bob/lib/compiler.server.ts`
- `bob/lib/types.ts`
- `bob/components/TdMenu.tsx`
- `bob/components/ToolDrawer.tsx`
- `bob/components/SettingsPanel.tsx`
- `bob/components/td-menu-content/useTdMenuBindings.ts`
- `bob/components/td-menu-content/showIf.ts`
- touched Dieter/panel runtime files if they still preserve the same implicit contract

### Toxic LOCs and concepts that will be removed from the system

- compiler rewriting that silently authors the editor contract
- implicit panel-contract behavior spread across unrelated files
- path-specific runtime branches that survive only because the panel contract is still unclear
- dynamic glue that exists only to preserve hidden panel/runtime theory

### Toxic workflows that will be removed

- reverse-engineering the editor contract from compiler/runtime behavior
- making panel behavior more explicit while silently preserving the same hidden compiler rewriting
- pretending `show-if` is a one-file Bob cleanup when active widget sources still depend on it

### Files or branches that should disappear if they only preserve hidden editor-contract magic

- touched linked-op special cases that no longer earn their keep
- touched DOM-binding glue that becomes unnecessary after panel/runtime simplification
- touched implicit panel behavior that can be made direct by deletion

---

## Done Means

- compiler and Bob ownership are clearer on the touched path
- the editor contract is easier to explain as a product contract
- panel/runtime behavior is smaller and more explicit
- touched `show-if` work is honest about whether widget-source migration is required
