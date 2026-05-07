# PRD 085D - San Francisco Internal Agentic Workforce Boundary

STATUS: EXECUTED - 2026-05-06

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines the boundary for Clickeen's internal AI workforce.

Internal AI jobs can run sales, support, marketing, localization, content, and ops work. They must be governed like production workers, not experiments with broad access.

Do not execute this PRD as an abstract framework.

The first real internal/product-internal jobs are now named:

- `widget.instance.translator` - translates one account-owned widget instance.
- `website.prague.copy.translator` - translates Prague website copy.

The old `l10n.instance.v1` name must be replaced by `widget.instance.translator`. Prague translation must not share the account-widget translation agent.

---

## 1. Product Goal

Clickeen wants explicit AI jobs to operate the company.

That eventually requires explicit internal jobs with:

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

This execution is narrower than the long-term workforce idea. It cleans two translation jobs and deletes one fake personalization/onboarding job. Do not build a general workforce framework.

---

## 2. Surviving Product Owner

San Francisco owns:

- internal job execution
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
- any broad tool access beyond the two concrete translation-job boundaries named in this PRD

---

## 3. Runtime Boundary

Internal AI work runs as explicit jobs.

No internal job should gain product write power through a shared-secret HTTP route.

For this execution, use the minimal real fields required to remove ambiguity:

- `owner`
- `jobType`
- `boundary`
- input contract
- output contract
- cost policy
- audit path

Boundary values for this execution are concrete:

- `account_widget_translation_overlay` - the job reads the request passed by Tokyo-worker and writes only generated translation ops through the owning account-widget translation flow.
- `prague_copy_tooling_output` - the job translates explicit Prague copy inputs and writes only to Prague tooling output for review/commit.

Current Prague translation transport, confirmed before execution:

- `scripts/prague-l10n/translate.mjs` calls San Francisco over HTTP.
- The script sends requests to `POST /v1/l10n/translate`.
- That endpoint is in `sanfrancisco/src/l10n-routes.ts`.
- It is gated to `ENVIRONMENT in {local,dev}`.
- It requires `Authorization: Bearer ${CK_INTERNAL_SERVICE_JWT}`.

Target Prague translation boundary:

- Keep Prague translation as a real internal/tooling job.
- Rename/formalize it as `website.prague.copy.translator`.
- Do not mix it with account-widget translation.
- Do not leave it looking like product runtime.
- Do not build broad workforce infrastructure while cleaning it.

Shared translation core rule:

- `widget.instance.translator` and `website.prague.copy.translator` may share translation prompt/validation/helpers.
- Do not duplicate the same translation core into two drifting implementations.
- Only triggers, write policy, approval policy, and output flow differ.

---

## 4. Approach

### 4.1 Explicit Job Registry

Create no standalone registry service.

Use the existing AI registry/contracts plus docs. Build only around the two real surviving jobs:

- `widget.instance.translator`
- `website.prague.copy.translator`

Required fields are minimal: `owner`, `jobType`, and `boundary`, plus the existing input/output/runtime policy definitions.

### 4.2 Concrete Tool Boundaries

Do not create a broad tool-permission taxonomy in this PRD.

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

For this slice:

- `widget.instance.translator` writes only generated translation ops through the existing owning account-widget translation flow.
- `website.prague.copy.translator` produces Prague website copy output through the explicit Prague tooling workflow.
- Prague generated copy is reviewed/committed through the Prague workflow.

Broader approval policies are out of scope until a concrete job exists and earns a PRD of its own.

---

## 5. Deletion Targets

- Shared-secret internal routes that behave like product runtime.
- Open-ended internal chat endpoints with no named owner, input contract, output contract, or approval path.
- Internal jobs without owner.
- Internal jobs without trigger.
- Internal jobs without write policy.
- Internal jobs without audit trail.
- Speculative workforce agents without a real current owner.
- `agent.personalization.onboarding.v1`.
- `/v1/personalization/onboarding`.
- `SanfranciscoCommandMessage` / `sf.command`, once personalization/onboarding is deleted.

Deletion ownership:

- PRD 085D owns `agent.personalization.onboarding.v1`.
- PRD 085D owns `/v1/personalization/onboarding`.
- PRD 085D owns `SanfranciscoCommandMessage` / `sf.command`.
- PRD 085D owns `l10n.instance.v1` -> `widget.instance.translator` rename because the widget translator is an internal product job, not a customer-facing chat agent.

Data-safety audit for the rename:

- D1 stores `agentId` in `copilot_events_v1`.
- Before renaming `l10n.instance.v1`, query the deployed San Francisco D1 binding for distinct `agentId` values.
- If `l10n.instance.v1` exists in D1, add a D1 migration updating historical rows or document the cutover date and why old history intentionally keeps the old ID.
- Check R2 learning prefixes for `learning/{env}/l10n.instance.v1/`.
- If old R2 samples exist, decide whether to leave historical raw samples as immutable history or migrate/copy/delete them. Do not silently strand reporting paths.
- Audit public/external docs before rename. If old agent IDs are public API, add a deprecation plan; if not public, proceed as internal rename.

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
- `scripts/prague-l10n/translate.mjs`

Docs:

- `documentation/ai/*`
- operational docs for internal jobs
- parent PRD 085

No customer-facing product path should be forced through the internal job model.

---

## 7. Why This Is World-Class SaaS

AI workforce can reduce operating cost, but unmanaged internal jobs create security, cost, and trust risk.

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

Clickeen's thesis is that explicit AI jobs run sales, support, marketing, localization, and ops.

This PRD turns that thesis into a disciplined operating model.

It lets Clickeen build an AI workforce without polluting customer-facing product paths or giving experiments broad product write access.

The first step is not a broad workforce platform. It is cleaning two real translation jobs and deleting one fake personalization/onboarding job.

---

## 9. Execution Readiness Checklist

Before execution:

- First internal jobs are decided: `widget.instance.translator` and `website.prague.copy.translator`.
- Internal boundary values are decided: `account_widget_translation_overlay` and `prague_copy_tooling_output`.
- Personalization/onboarding is decided: delete it.
- Prague translation current transport is identified: `scripts/prague-l10n/translate.mjs` -> `POST /v1/l10n/translate` -> `CK_INTERNAL_SERVICE_JWT`, local/dev only.
- Prague translation is decided: keep the need, clean the current shared-secret/script cluster into `website.prague.copy.translator`.
- Job registry location is decided: existing contracts/policy/docs only, no new framework.
- Approval rules are decided for this slice: Prague generated copy is reviewed/committed through the Prague tooling workflow; account-widget translation writes generated overlay ops for the owning account/widget instance.
- Full-monorepo grant issuance audit must prove no personalization/onboarding grants survive after deletion.
- D1/R2 rename safety must be checked before `l10n.instance.v1` code rename lands.
- Public/external agent-ID audit must prove the rename is internal or provide a deprecation path.
- Shared translation core is preserved: prompt/validation/helper logic is not duplicated between widget and Prague translation jobs.

Execution is green only when:

- surviving internal jobs have registry entries
- deleted internal jobs have no routes/callers/registry entries
- `l10n.instance.v1` has no active-code or live-doc residue after the rename, except documented historical D1/R2 records if intentionally retained
- shared-secret product-like internal paths are gone or explicitly tooling-only during Prague cleanup
- tool permissions are explicit for the two surviving translation jobs
- audit path exists for surviving jobs
- no generic workforce registry exists without at least one real surviving job
- personalization/onboarding grant issuance is gone

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- queue/private binding checks if runtime changes
- `rg` residue checks for deleted/renamed internal routes/agent IDs/secrets: `agent.personalization.onboarding.v1`, `/v1/personalization/onboarding`, `SanfranciscoCommandMessage`, `sf.command`, `l10n.instance.v1`
- full-monorepo grant issuance scan for `agent:agent.personalization.onboarding.v1` and `agent.personalization.onboarding.v1`
- deployed D1 check for historical `agentId` rows before/after migration/cutover decision
- R2 prefix check for old `learning/{env}/l10n.instance.v1/` samples
- public/external docs scan for old agent IDs before rename
- Prague translation transport check against `scripts/prague-l10n/translate.mjs` and `sanfrancisco/src/l10n-routes.ts`
- smoke test for surviving translation jobs
- git-based Cloudflare deploy after implementation
