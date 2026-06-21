# 121D PRD - Translation Agent

Status: EXECUTING
Owner: Product + Localization + San Francisco
Priority: P0
Date: 2026-06-20
Type: Sub-PRD / focused internal agent proof
Pre-execution amendment state: settled for first execution slice after peer-review convergence.

Related:

- `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
- `121A__PRD__Agent_Architecture.md`
- `121B__PRD__San_Francisco_Orchestrator_And_Routing.md`
- `Execution_Pipeline_Docs/03-Executed/105_Instance_Runtime_And_Verification_Batch/105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`
- `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103B__PRD__Instance_Translation_Agent_Contract.md`
- `Execution_Pipeline_Docs/03-Executed/103_Translation_Field_And_Agent_Contract_Batch/103J__PRD__Generic_Widget_Translation_System.md`

---

## 1. Purpose

Define Translation Agent as a real focused internal agent.

Translation is not a Copilot.

Translation Agent is an artifact agent: product artifact in, localized artifact
out, with review and validation.

V1 is a structured-output workflow/system agent, not an open-ended Copilot loop:

```text
bounded saved-instance input
-> governed model output
-> deterministic validation
-> product-owned overlay apply
```

The product name can remain Translation Agent. The implementation must not
import Product Copilot loop machinery it does not need.

## 2. Why This Is Agent Work

Translation is not only a raw translate API call.

Clickeen translation must preserve:

- meaning;
- brand voice;
- CTA intent;
- formatting;
- variables/placeholders;
- URLs;
- product tokens;
- schema structure;
- field ownership;
- locale-specific conventions.

The agent must know when to ask for review or flag uncertainty.

For V1, uncertainty must be operational and deterministic. Structurally invalid
output fails the workflow; it is not converted into a vague review flag.

## 3. Invocation

Translation Agent may be invoked by:

- Roma workflow;
- Product Copilot later;
- background job;
- admin/product operation.

The invoking surface must identify:

- artifact;
- source locale;
- target locale(s);
- allowed fields;
- protected fields;
- review/apply boundary.

V1 scope:

- canonical id `widget.instance.translator`;
- saved account-widget instance only;
- existing instance-translation endpoint as invocation entry point;
- one target locale per request;
- exact current saved text graph;
- exact field/path set;
- protected structure preserved;
- product/Tokyo-owned overlay apply.

The existing translation endpoint remains the invocation entry point.

The Translation Agent brain still calls San Francisco for model execution under
the San Francisco model-execution contract. Keeping the endpoint does not mean
skipping San Francisco.

For account-triggered translation, Roma/account authority mints or derives the
grant.

For background/admin translation, the invoking service must provide a
service-scoped grant with explicit account, artifact, and locale authority.

San Francisco verifies the grant before model execution.

## 4. Context

Translation Agent context is artifact-specific.

It is not Product Copilot context.

It should include:

- artifact type;
- translatable field map;
- source content;
- protected tokens/structure;
- target locale;
- brand/tone guidance where available;
- glossary or prior translations where available;
- output schema.

The V1 invocation envelope must include:

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

## 5. Output

Translation Agent returns a reviewable translation artifact.

Output must include:

- translated fields;
- unchanged protected fields;
- warnings;
- uncertainty flags;
- validation metadata;
- model/provider metadata;
- trace id.

It does not directly mutate saved product state unless a product-owned workflow
explicitly accepts and applies it.

V1 output must contain exactly the requested translated fields plus the same
content marker, telemetry, and terminal complete/fail status.

Protected fields, URLs, placeholders, tags, anchors, product tokens, schema
paths, and non-translatable structure must be represented as typed slots and
validated deterministically after model output. Prompt instruction alone is not
enough.

Terminal failures include:

- missing path;
- extra path;
- empty provider output;
- malformed rich text;
- placeholder/tag/anchor mismatch;
- stale marker;
- editable-fields contract mismatch;
- provider failure.

Terminal failures must not be silently repaired, dropped, or applied as partial
success.

## 6. Execution Slices

1. Use 105E as current execution authority.
2. Treat 103-series docs as historical keep/replace/wrap input only.
3. Define Translation Agent V1 as synchronous saved-instance single-locale
   workflow unless queue/DO/runtime durability is explicitly built.
4. Define invocation envelope and grant source for account-triggered,
   background, and admin translation.
5. Define translatable/protected field context capsule.
6. Define structured output artifact and deterministic post-validation.
7. Execute model call through San Francisco model-execution contract.
8. Apply through product-owned route/workflow only after review or allowed
   acceptance.
9. Add queue/fanout/durable workflow only when explicitly selected.

## 6.1 Day-One Translation Evals

Translation Agent V1 requires evals for:

- protected-token integrity;
- exact schema/path preservation;
- malformed rich text rejection;
- placeholder/tag/anchor mismatch;
- locale spot checks;
- meaning/tone judge;
- pass@1 and pass^k tracking;
- seed evidence from D9/29-locale checks where applicable.

## 7. Acceptance Criteria

- Translation Agent is a focused internal agent, not a Copilot.
- The agent works on explicit artifacts and locale targets.
- Protected product structure cannot be translated or dropped silently.
- Output is reviewable and traceable.
- Product routes/workflows own durable mutation.
- V1 cites 105E as current authority and treats 103-series docs as historical
  input where they conflict.
- V1 is synchronous unless real queue/DO/runtime durability is built.
- V1 uses the existing instance-translation endpoint as invocation entry point
  while calling San Francisco for model execution.
- Account-triggered and internal/background/admin grant sources are explicit.
- Protected structure is validated through typed slots and deterministic
  post-validation.
- Terminal failures are explicit and cannot become partial success.
- Translation evals cover protected-token integrity, schema preservation,
  malformed rich text, locale checks, meaning/tone, and pass@1/pass^k.
- The implementation proves the agent architecture can support a non-Copilot
  agent.
