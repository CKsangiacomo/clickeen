# 075G - Copilot Provisioning Must Not Live In Entitlements Or Shared Product Core

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

When a customer uses Copilot in Builder, the product should behave like one coherent assistant.

The entitlement system should answer:

- whether the account can use Copilot
- what limits apply

It should not also be the place where the repo defines:

- AI provider/model provisioning
- product variant agent identity
- acquisition-vs-account copilot product branching

---

## Product Scope

This PRD covers:

- Builder account Copilot product path
- where Copilot agent/provisioning truth lives
- how account entitlements relate to Copilot
- how shared product core carries Copilot variants

This PRD does not cover:

- Minibob identity removal from shared editor/product truth beyond the copilot-specific contamination already covered here and in `75C`
- broad San Francisco platform redesign

---

## Product Truth

For the real product:

1. Entitlements answer whether the account can use Copilot and what limits apply.
2. AI provisioning is not entitlement truth.
3. Account Builder should have one clear Copilot product path.
4. Acquisition-specific or variant-specific logic should not pollute shared account copilot core.

The product should not require engineers to reason across policy, provisioning, and product variants just to understand one Copilot request.

---

## 1. Where We Fucked Up / How And Why

We let the wrong package and the wrong layer own too much Copilot truth.

### A. Entitlements started carrying AI product provisioning

The policy package currently knows about:

- providers
- models
- execution surfaces
- widget copilot agent variants

That happened because AI/product provisioning got attached to the entitlement layer instead of staying near AI execution or product orchestration.

### B. Shared product code carries product-variant logic

Builder and account Copilot paths currently reason about named agent variants and variant-specific settings.

That happened because we tried to preserve flexibility instead of enforcing one boring account Copilot product path.

### C. Acquisition/product experimentation leaked into the core

Once acquisition-specific and variant-specific Copilot behavior enters shared product code, the account product path stops feeling like one assistant and starts feeling like a matrix of variants.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The entitlement package stops being about entitlements

If `ck-policy` also owns AI provisioning/product variant truth, it becomes a product-configuration hub instead of an entitlement boundary.

### B. Copilot becomes harder to reason about than the product needs

To understand one Builder Copilot path, engineers should not need to reason through:

- policy profile
- agent variant registry
- provider/model picker rules
- acquisition-vs-account product branching

### C. Variant sprawl creates fake product complexity

The more the core carries named Copilot variants, the more the repo starts acting like there are many equal Copilot products where the customer only sees one.

### D. AI keeps preserving the wrong ownership

When provisioning lives in `ck-policy`, AI naturally treats it as foundational product truth and keeps routing future work through it.

---

## 3. How We Are Fixing It

### A. Entitlements go back to owning entitlements only

`ck-policy` should answer:

- can this account use Copilot?
- what limits/budgets apply?

Not:

- which agent-variant product we are running
- how providers/models are provisioned

### B. Account Copilot becomes one clear product path

The account Builder path should have one boring Copilot story.

Variant and experimentation logic must stop owning the shared product core.

### C. AI provisioning moves to an AI/product-owned boundary

Provisioning truth belongs with AI execution/product orchestration, not the entitlement package.

This is a responsibility correction, not an invitation to add a new abstraction layer.

### D. Shared product core stops carrying acquisition/product variant contamination

Anything that exists only to preserve multiple copilot product identities inside the shared account path is a deletion target.

---

## 4. What The System Looks Like Before / After

### Before

- `ck-policy` knows about Copilot provisioning and agent variants
- account product routes validate and preserve multiple named agent variants
- shared Builder Copilot code carries more product variation than the customer actually experiences

### After

- entitlements own entitlements
- AI/product orchestration owns AI provisioning
- account Builder has one clear Copilot path
- shared product core no longer carries unnecessary Copilot variant sprawl

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

- `packages/ck-policy/src/ai.ts`
- `packages/ck-policy/src/types.ts`
- `roma/lib/ai/account-copilot.ts`
- `roma/app/api/account/instances/[publicId]/copilot/route.ts`
- `bob/app/api/ai/widget-copilot/handler.ts`
- `bob/components/CopilotPane.tsx`
- any shared Copilot core that still carries acquisition/product variant logic

### Toxic LOCs and concepts that will be removed from the system

- AI provisioning truth embedded in `ck-policy`
- shared product code branching on multiple named copilot product variants that the account product does not need
- account Copilot paths that preserve acquisition/product experimentation inside the shared core
- dead or excess AI provisioning fields/surfaces that are not required by the real product

### Toxic workflows that will be removed

- reasoning about Builder Copilot through entitlement-package provisioning logic
- preserving multiple copilot product identities in the shared account path
- routing future Copilot work through `ck-policy` because that is where the registry happened to land

### Files or branches that should disappear if they only preserve variant/provisioning sprawl

- variant-specific shared Builder branches that do not improve the real account Copilot UX
- provisioning metadata in `ck-policy` that is not required for entitlement truth

---

## Done Means

- entitlements no longer own AI provisioning/product variant truth
- account Builder Copilot reads like one product path
- shared Copilot core no longer carries unnecessary acquisition/variant sprawl
- future Copilot work follows cleaner ownership boundaries without adding new layers
