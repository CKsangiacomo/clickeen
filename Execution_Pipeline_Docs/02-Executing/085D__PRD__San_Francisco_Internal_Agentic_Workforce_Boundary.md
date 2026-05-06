# PRD 085D - San Francisco Internal Agentic Workforce Boundary

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines the boundary for Clickeen's internal AI workforce.

Internal agents can run sales, support, marketing, localization, content, and ops work. They must be governed like production workers, not experiments with broad access.

Do not execute this PRD as an abstract framework.

The first real internal/product-internal jobs are now named:

- `widget.instance.translator` - translates one account-owned widget instance.
- `website.prague.copy.translator` - translates Prague website copy.

The old `l10n.instance.v1` name must be replaced by `widget.instance.translator`. Prague translation must not share the account-widget translation agent.

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

Do not build the generic type below as a framework in this slice. It is a planning shape only:

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

For this execution, use the minimal real fields required to remove ambiguity:

- `owner`
- `jobType`
- `boundary`
- input contract
- output contract
- cost policy
- audit path

---

## 4. Approach

### 4.1 Explicit Job Registry

Create no standalone registry service.

Use the existing AI registry/contracts plus docs. Build only around the two real surviving jobs:

- `widget.instance.translator`
- `website.prague.copy.translator`

Required fields are minimal: `owner`, `jobType`, and `boundary`, plus the existing input/output/runtime policy definitions.

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

For this slice:

- `widget.instance.translator` may read the translation request passed by Tokyo-worker and write only generated widget translation ops back through the existing account-widget translation flow.
- `website.prague.copy.translator` may translate Prague website copy from explicit tooling inputs and write only to the Prague translation output workflow.
- Personalization/onboarding receives no tools because it is deleted.

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
- `agent.personalization.onboarding.v1`.
- `/v1/personalization/onboarding`.
- `SanfranciscoCommandMessage` / `sf.command`, once personalization/onboarding is deleted.
- Active `l10n.instance.v1` naming after it is replaced by `widget.instance.translator`.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/personalization-jobs.ts`
- `sanfrancisco/src/agents/*`
- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`
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

The first step is not a broad workforce platform. It is cleaning two real translation jobs and deleting one fake personalization/onboarding job.

---

## 9. Execution Readiness Checklist

Before execution:

- First internal jobs are decided: `widget.instance.translator` and `website.prague.copy.translator`.
- Personalization/onboarding is decided: delete it.
- Prague translation is decided: keep the need, clean the current shared-secret/script cluster into `website.prague.copy.translator`.
- Job registry location is decided: existing contracts/policy/docs only, no new framework.
- Approval rules are decided for this slice: Prague generated copy is reviewed/committed through the Prague tooling workflow; account-widget translation writes generated overlay ops for the owning account/widget instance.

Execution is green only when:

- surviving internal jobs have registry entries
- deleted internal jobs have no routes/callers/registry entries
- shared-secret product-like internal paths are gone or explicitly tooling-only
- tool permissions are explicit for the two surviving translation jobs
- audit path exists for surviving jobs
- no generic workforce registry exists without at least one real surviving job
- `l10n.instance.v1` has no active-code or live-doc residue after rename

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- queue/private binding checks if runtime changes
- `rg` residue checks for deleted/renamed internal routes/agent IDs/secrets: `agent.personalization.onboarding.v1`, `/v1/personalization/onboarding`, `SanfranciscoCommandMessage`, `sf.command`, `l10n.instance.v1`
- smoke test for surviving translation jobs
- git-based Cloudflare deploy after implementation
