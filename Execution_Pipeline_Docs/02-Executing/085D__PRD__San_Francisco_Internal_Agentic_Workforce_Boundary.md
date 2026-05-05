# PRD 085D - San Francisco Internal Agentic Workforce Boundary

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines the boundary for Clickeen's internal AI workforce.

Internal agents can run sales, support, marketing, localization, content, and ops work. They must be governed like production workers, not experiments with broad access.

Do not execute this PRD as an abstract framework. It is blocked until one real internal job is named. The recommended first job is the existing localization worker path because it already has real input, output, cost, and product value.

---

## 1. Product Goal

Clickeen wants AI agents to operate the company.

That requires explicit internal jobs with:

- owner
- trigger
- subject
- input contract
- output contract
- allowed tools
- write policy
- human approval policy
- cost policy
- audit trail
- retention policy

Internal workforce jobs are not customer-facing product agents and should not share vague chat/runtime paths with them.

---

## 2. Surviving Product Owner

San Francisco owns:

- internal agent execution
- provider/model enforcement
- internal job metering
- internal job audit indexes
- raw artifacts when bounded

The business/system owner owns:

- what job exists
- why it exists
- what it is allowed to change
- who approves output
- where final product truth is written

San Francisco does not own:

- account truth
- billing truth
- widget truth
- public content publication policy unless explicitly delegated
- unrestricted access to GitHub, Cloudflare, Supabase, Tokyo, or support inboxes

---

## 3. Runtime Boundary

Internal agents run as explicit jobs.

Each job must declare:

```ts
type InternalAgentJob = {
  jobType: string;
  owner: string;
  trigger: "queue" | "schedule" | "admin_action" | "cli_tool";
  subject: "internal_service" | "account" | "anonymous_visitor";
  inputContract: string;
  outputContract: string;
  allowedTools: string[];
  writePolicy: "read_only" | "draft_only" | "human_approved_write" | "autonomous_safe_write";
  approvalPolicy: string;
  runtimePolicyVersion: string;
  auditLevel: "metering_only" | "index_and_artifact" | "full_review";
  retentionPolicy: string;
};
```

The type above is a planning shape. During execution, free-form fields such as `approvalPolicy` and `retentionPolicy` should become named enum/config values only for the first real job being implemented. Do not build a general framework before a concrete job needs it.

No internal job should gain product write power through a shared-secret HTTP route.

---

## 4. Approach

### 4.1 Explicit Job Registry

Create a registry for internal workforce jobs.

Build the registry around the first real surviving job, not around imagined future workers.

Required fields:

- job type
- owner
- trigger
- input contract
- output contract
- tools
- write policy
- approval policy
- runtime policy
- audit policy

### 4.2 Tool Permissions

Tools are explicit capabilities.

Examples:

- web fetch
- Tokyo read
- Tokyo write
- Supabase/Michael read
- GitHub read
- GitHub write
- Cloudflare read
- Cloudflare write
- support inbox read
- support inbox reply draft

No internal agent receives broad tool access by default.

### 4.3 Job State Storage

Use:

- KV for short-lived status
- D1 for queryable job indexes
- R2 for bounded artifacts
- Supabase only when the owning service intentionally changes product/account truth

### 4.4 Approval Policy

Require human approval for:

- public content publication
- account-impacting writes
- billing/account changes
- production infra changes
- outbound customer messages unless explicitly safe

Allow autonomous execution only for:

- read-only reports
- safe maintenance
- bounded internal QA
- non-customer-impacting summaries

---

## 5. Deletion Targets

- Shared-secret internal routes that behave like product runtime.
- Open-ended internal chat endpoints with broad tool access.
- Internal jobs without owner.
- Internal jobs without trigger.
- Internal jobs without write policy.
- Internal jobs without audit trail.
- Speculative workforce agents without a real current owner.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/personalization-jobs.ts`
- `sanfrancisco/src/agents/*`
- `packages/ck-contracts/src/ai.ts`
- San Francisco wrangler bindings if queues/private bindings are added
- Prague translation tooling if moved or formalized

Docs:

- `documentation/ai/*`
- operational docs for internal jobs
- parent PRD 085

No customer-facing product path should be forced through the internal job model.

---

## 7. Why This Is World-Class SaaS

AI workforce can reduce operating cost, but unmanaged internal agents create security, cost, and trust risk.

Best practice is:

- narrow jobs
- explicit tools
- approval rules
- audit
- bounded cost
- clear ownership

That creates scalable operations without turning internal automation into an unreviewable black box.

---

## 8. Why This Is Right For Clickeen

Clickeen's thesis is that AI agents run sales, support, marketing, localization, and ops.

This PRD turns that thesis into a disciplined operating model.

It lets Clickeen build an AI workforce without polluting customer-facing product paths or giving experiments broad product write access.

---

## 9. Execution Readiness Checklist

Before execution:

- Decide first internal workforce job to keep. Default recommendation: localization worker.
- Decide whether personalization/onboarding survives.
- Decide whether Prague translation is tooling, internal job, or private binding.
- Decide job registry location.
- Decide approval levels.

Execution is green only when:

- surviving internal jobs have registry entries
- deleted internal jobs have no routes/callers/registry entries
- shared-secret product-like internal paths are gone or explicitly tooling-only
- tool permissions are explicit
- audit path exists for surviving jobs
- no generic workforce registry exists without at least one real surviving job

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- queue/private binding checks if runtime changes
- `rg` residue checks for deleted internal routes/agent IDs/secrets
- smoke test for surviving internal job
- git-based Cloudflare deploy after implementation
