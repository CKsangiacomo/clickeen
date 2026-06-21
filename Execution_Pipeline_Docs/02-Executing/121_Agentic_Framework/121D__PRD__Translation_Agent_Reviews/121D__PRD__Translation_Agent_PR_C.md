# Peer Review C - 121D Translation Agent

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121D__PRD__Translation_Agent.md`
Verdict: Pass conceptually; blocked for execution until authority and first slice are narrowed.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `Execution_Pipeline_Docs/03-Executed/105_Instance_Runtime_And_Verification_Batch/105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`
- `packages/ck-contracts/src/ai.ts`
- `sanfrancisco/src/l10n-account-routes.ts`
- `sanfrancisco/src/agents/l10nTranslationCore.ts`
- `tokyo-worker/src/domains/account-instances/keys.ts`

Verified runtime truth:

- 105E is explicit: 103 translation PRDs are historical evidence and must not
  remain active execution authority where they conflict.
- Canonical agent id is `widget.instance.translator`.
- The registry marks this as a `system_agent` with execution surface `endpoint`,
  not generic `/v1/execute`.
- San Francisco endpoint accepts `translate_saved_instance` requests containing
  account id, instance id, widget type, base locale, target locale, job id, and
  `currentSavedTextGraph`.
- San Francisco validates normalized saved text items, translates exact path
  sets, and uses translated-value primitive validation to reject missing or extra
  paths visibly.
- Tokyo-worker key authority places durable locale overlay output under
  `accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json`.

Second-pass correction: 121D must be treated as blocked until it switches active
authority from 103 to 105E and narrows V1 to the existing saved-instance
translation boundary. It should not propose a generic artifact agent until the
current endpoint and Tokyo overlay authority are reconciled.

## 0b. Best-Practice Research Lens

Best-practice guidance draws a useful distinction here: Translation is much
closer to a governed agentic workflow than an open-ended autonomous agent. The
task is bounded, the input artifact is known, the output shape is known, and the
product can validate exact paths. That is a strength, not a weakness.

Best-practice alignment:

- Deterministic extraction, path locking, provider policy, and output validation
  should surround the LLM translation step.
- The LLM should translate and preserve meaning/tone; it should not choose
  product scope, persistence, locale overlay shape, or readiness.
- Output guardrails should reject missing paths, extra paths, structure changes,
  and invalid translated-value primitives.

Required PRD tightening:

- Frame V1 as `widget.instance.translator` focused workflow/system agent through
  the existing endpoint, not as a generic internal-agent template.
- Use 105E as active authority and state that San Francisco produces governed
  translation text only; Tokyo/product routes own durable overlay writes.
- Defer glossary systems, multi-locale orchestration, Copilot-triggered
  translation, and generic artifact-agent review surfaces.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA does not mean Translation Agent should become generic. It means Clickeen
can correct any wrong translation contract decisively instead of preserving old
103-era or partial endpoint assumptions.

Pre-GA amendment:

- If 103-era docs, endpoint names, or payload fields conflict with 105E and the
  intended saved-instance translation workflow, replace them rather than
  supporting both.
- Do not keep translation behaviors that silently omit fields, relax exact path
  validation, or preserve historical overlay mistakes for compatibility.
- Keep the first slice narrow enough that a clean cutover is possible:
  saved account-widget instance, one target locale, exact text graph, exact path
  validation, product-owned overlay write.

The no-back-compat advantage is that Translation Agent can be made boring and
correct before GA instead of carrying legacy translation semantics into the
agent framework.

## 1. Elegant Engineering And Scalability

The PRD correctly identifies Translation Agent as a focused internal artifact
agent, not a Copilot.

That is the right second proof after Product Copilot because it exercises a
different agent shape:

```text
product artifact in
-> locale-aware reasoning
-> translated artifact out
-> validation/review
-> product-owned durable apply
```

This proves the 121 architecture can support non-chat workers without making all
agents inherit Product Copilot behavior.

The scalable version should lean on existing Clickeen translation truth:

- widgets declare translatable authored fields;
- protected schema/product structure must not be translated;
- San Francisco produces governed AI text;
- product/Tokyo-owned workflow applies durable locale output.

## 2. Compliance To Architecture, Product Law, And Tenets

Directionally compliant:

- Translation Agent is separate from Product Copilot.
- San Francisco does not directly mutate saved product state.
- Durable apply remains product-owned.
- Protected structure cannot be translated or dropped silently.

Blocking authority issue:

- The PRD cites 103B/103J as active related authority. Those are historical
  translation docs. The current execution authority should be reconciled with
  `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`.

Product law that must be explicit:

- San Francisco owns AI text production only.
- San Francisco must not read R2 directly for source truth.
- San Francisco must not decide sync/readiness.
- San Francisco must not own locale overlay shape.
- Tokyo/product routes own durable translated overlays.

## 3. Overarchitecture Or Unnecessary Complexity

The dangerous word is "artifact."

If the first slice starts generic, it will overbuild:

- generic artifact-agent framework;
- review platform;
- glossary system;
- multi-locale orchestration;
- Copilot-triggered translation;
- subjective brand-voice evaluation;
- model-judge review loops.

The first slice should be narrower:

```text
saved account-widget instance
one target locale
declared editable/translatable fields
protected structure
San Francisco translation
terminal validation result
product-owned apply/review path
```

Multi-locale output should not be first slice because it creates partial-success
masquerade risk.

## 3b. Academic / Meta-Work / Gold-Plating Risks

These are valid future concepts but risky in V1:

- brand voice;
- locale-specific conventions;
- glossary;
- prior translations;
- uncertainty flags;
- ask-for-review loops.

For first execution, uncertainty should be operational and deterministic:

- missing output;
- extra path;
- empty provider output;
- malformed rich text;
- placeholder mismatch;
- tag/anchor mismatch;
- stale marker;
- unsupported field type;
- provider failure;
- contract mismatch.

Do not build subjective translation quality infrastructure before the basic
agent works.

## 4. Why This Is Simple And Boring

The boring flow is the right flow:

```text
product workflow requests translation
-> product/Tokyo path extracts declared saved text fields and marker
-> San Francisco translates exactly those fields under policy
-> output validates against contract
-> product workflow reviews/applies
-> Tokyo/product route writes durable locale overlay
```

This is clean because the agent does one job and product storage remains with
the owning product path.

## 5. Required Corrections Before Execution

Required:

- Replace active 103 authority with current 105E authority; keep 103 only as
  historical background if needed.
- Narrow first scope to saved account-widget instance translation.
- Use canonical agent id `widget.instance.translator`.
- State current execution surface is the instance-translation endpoint, not
  generic `/v1/execute`, unless 121B explicitly changes that architecture.
- Start with one target locale per request.
- Define invocation fields:
  - account coordinate;
  - instance id;
  - widget type;
  - base locale;
  - target locale;
  - saved base content marker;
  - editable-fields contract hash;
  - field identity/path/type/role/label;
  - base text;
  - policy;
  - request id.
- Define output as exactly requested translated fields plus same marker,
  telemetry, and terminal complete/fail status.
- Make these terminal visible failures:
  - missing path;
  - extra path;
  - empty provider output;
  - malformed rich text;
  - placeholder mismatch;
  - stale marker;
  - contract mismatch;
  - provider failure.
- State Product Copilot invocation is later work through explicit child-agent
  permission, not part of first Translation Agent execution.

## 6. V1-V8 Audit

- V1 Silent substitution: Watch. Missing/extra paths and empty provider output
  must fail, not be invented.
- V2 Silent healing: Watch. Translation output must not repair malformed source
  state.
- V3 Silent omission: Watch. Active 105E authority must be cited before
  execution.
- V4 Fail-open control: Watch. Contract/marker/provider mismatch must fail
  closed.
- V5 Corruption-as-absence: Watch. Stale marker/corrupt source cannot become
  "no translation needed."
- V6 Partial-success masquerade: Watch. Multi-locale and partial-field success
  must not claim complete.
- V7 Masquerade/redress: Pass. Translation Agent is not presented as Copilot.
- V8 Runtime test dependency: Pass. No runtime dependency on test rituals.
