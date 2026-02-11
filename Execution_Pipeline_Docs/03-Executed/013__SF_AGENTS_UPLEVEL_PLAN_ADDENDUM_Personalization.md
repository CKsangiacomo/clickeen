# SF Plan Addendum — Personalization Agents

Status: Executed / superseded. Addendum implemented in current AI registry + routing.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

**File:** SF_AGENTS_UPLEVEL_PLAN_ADDENDUM_Personalization.md  
**Purpose:** Minimal deltas to incorporate Personalization Agents into the SF/Paris plan.

---

## 1) Add to Agent Registry
Add two entries:

- `agent.personalization.preview.v1`
  - category: `agent`
  - taskClass: `personalization.acquisitionPreview`
  - defaultProviders: `[deepseek]`
  - allowProviderChoice: false
  - budgetsByProfile:
    - `free_low`: low tokens + short timeout
  - tools: `tool:fetchHeadMeta`, `tool:fetchHomepageSnippet`

- `agent.personalization.onboarding.v1`
  - category: `agent`
  - taskClass: `personalization.onboardingProfile`
  - defaultProviders: `[deepseek, openai, anthropic]`
  - allowProviderChoice: true (paid tiers)
  - requiredEntitlements: `personalization.onboarding.enabled`
  - tools: `tool:fetchWebsite`, `tool:fetchGBP`, `tool:fetchFacebook`, `tool:writeWorkspaceProfile` (all tier gated)

---

## 2) Add task classes to Model Router policy
- `personalization.acquisitionPreview`:
  - cheap model (DeepSeek), low token budget, strict timeout
- `personalization.onboardingProfile`:
  - tier-based budgets, provider choice enabled for higher tiers

---

## 3) Paris grant issuance updates
When minting grants/jobs for these agents, Paris must:
- resolve entitlements
- compute `ai.profile` and allowed providers for the task class
- include those in the policy capsule (`grant.ai`) so SF can enforce without fetching billing state

**Profile names (v1):** `free_low`, `paid_standard`, `paid_premium`, `curated_premium`.

---

## 4) Tooling implications
These agents require safe web-fetch tools.
If you already have a “fetch URL” tool in CS Copilot, extract it into a reusable tool and:
- harden SSRF protections
- add byte caps and timeout
- add “head-only” mode for the preview agent

**Storage note:** Onboarding results write to Supabase `workspace_business_profiles` (not D1).

---
