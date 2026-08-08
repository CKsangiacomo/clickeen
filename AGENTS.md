# Clickeen Agent Guidelines

## Read This First

Clickeen is built and operated by AI under one human product owner/architect.

The human owns product direction, architecture judgment, and final authority.
AI coding, devops, and runtime agents perform the implementation, operation,
documentation, and verification work through the product's named authorities.

This operating model makes two things non-negotiable:

1. Agents must reason deeply without expanding the requested scope.
2. Agents must understand and preserve the Clickeen tenets.

Failure on either point does not merely produce a poor answer. It adds
unrequested machinery, corrupts product boundaries, and makes a one-human,
AI-operated company harder to operate.

## Understand The System Before Doing Anything

Before doing any Clickeen investigation, plan, review, explanation, code change,
product-data operation, documentation change, or managed-service operation:

1. Read `documentation/README.md` completely.
2. Read `documentation/architecture/CONTEXT.md` completely.
3. Read `documentation/architecture/Tenets.md` completely.
4. Read `documentation/strategy/WhyClickeen.md` completely.
5. Follow the documentation router and read every document owned by the
   affected surface completely.
6. Only then inspect the runtime code, schema, workflow, stored data, or
   deployed configuration that owns the behavior.

Do not skim the documentation. Do not rely on search snippets, a prior-memory
summary, or a subagent's summary instead of reading the required documents
yourself. Do not start from code and infer the product around it.

Documentation defines intended product behavior and authority. Runtime code,
migrations, stored data, and deployed configuration prove the current
implementation. When they disagree, establish the concrete mismatch and fix
the owning documentation with the behavior change that exposed it.

## Request Authority

The user's request defines both the outcome and the authorized action.

- Analyze, explain, review, inspect, audit, verify, or report means read-only.
  Do not edit files, mutate product data, deploy, or perform external writes.
- Change, fix, build, implement, remove, or do authorizes only the changes
  required for the explicitly requested outcome.
- A staged request authorizes only the current stage. “Before we edit, verify”
  authorizes verification, not the later edit.
- A question, objection, or request for explanation does not authorize the
  implementation of a proposed fix.

More reasoning, time, tools, autonomy, or subagents never creates additional
authority.

## Reasoning Is For Depth, Not Scope

More reasoning, time, tools, or subagents do not authorize broader scope.

Use additional reasoning to deepen work inside the requested outcome:

- read the applicable Clickeen documentation completely;
- understand why the current product and architecture work as they do;
- trace the actual code, data, runtime, and user flow;
- verify claims with concrete repository or deployed-product evidence;
- reduce uncertainty;
- identify the smallest change that satisfies the request;
- verify that change proportionally to its real risk.

Do not use additional reasoning to:

- expand the user's request;
- invent product requirements;
- promote theoretical possibilities into product problems;
- invent abstractions, terminology, containers, services, registries,
  compatibility layers, migrations, or validation machinery;
- redesign adjacent systems;
- add future-proofing without a proven current need;
- replace the product owner's stated architecture with an inferred one.

Before calling something a problem, state:

1. The real current user or product flow that reaches it.
2. The exact conditions required for it to happen.
3. Whether it is happening now, concretely reachable, latent, or only
   theoretical.
4. The evidence proving that classification.

If no concrete current or reachable product scenario exists, label the finding
theoretical and do not recommend or implement machinery for it unless the user
explicitly asks.

Before proposing a fix, explain why the existing design exists and how it
works. Prefer the smallest change through existing authorities. Stop when the
requested outcome is complete.

## Before Inventing Anything

Before introducing any new file, abstraction, term, container, service,
registry, compatibility path, migration, workflow, validation layer, or other
machinery, ask:

1. Did the user request it?
2. Is it required to complete the requested outcome now?
3. Which concrete current or reachable product scenario proves the need?
4. Can the existing authority, contract, or pattern solve the requirement?
5. Is this product work, or is this AI reasoning derailing into invented work?

If it is not required, do not add it. If answering these questions would
materially change the requested product or architecture, stop and ask the human
architect before acting.

## The Clickeen Tenets

The canonical tenets are in `documentation/architecture/Tenets.md`. Read that
document completely; this summary does not replace it.

1. **Agents operate structured artifacts.** Keep schemas, controls, field maps,
   policies, grants, account files, overlays, and routes structured, typed, and
   AI-legible. A hardcoded service pipeline with a model call in the middle is
   not an agent.
2. **Named authorities own boundaries.** Berlin owns authentication/bootstrap;
   Roma owns current-account routes and product policy; Bob owns browser-memory
   editing; Tokyo-worker owns account runtime storage and public serving;
   Michael/Supabase owns relational truth; San Francisco owns governed model
   execution; agent homes own their operational domains; Dieter owns the design
   system. Do not bypass or duplicate those authorities.
3. **No silent substitution or fallback.** Missing, invalid, stale, or
   unavailable truth fails visibly. Do not replace it with another account,
   locale, model, provider, storage path, compatibility shape, or invented
   default.
4. **No silent healing.** Invalid persisted or user state may be rejected or
   repaired only through an explicit authorized operation. Never coerce or
   rewrite it while pretending the original operation succeeded.
5. **Product commands stay boring.** User intent travels through the current
   account and the owning route/service to one explicit result. Do not add
   orchestration machinery, broad registries, runtime discovery, compatibility
   layers, or meta-frameworks around deterministic work.
6. **Widget software is product truth.** Widget behavior lives in its
   git-authored contract. Bob compiles editor controls, Roma saves/materializes
   instances, and Tokyo-worker stores account runtime files; those systems do
   not invent widget-specific semantics.
7. **Bob edits in browser memory.** Draft edits, undo, preview, and Product
   Copilot changes remain local until the user saves through Roma. Bob and
   Product Copilot do not independently persist or publish.
8. **Storage follows ownership.** `accounts/` is runtime-managed account data;
   `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy
   roots. Global Clickeen fonts live under `fonts/`; do not turn them into one
   account's uploads or create alternate storage authorities.
9. **Translation overlays are exact files.** Locale values live at the exact
   account/instance/locale coordinate. Translation Agent generates them;
   Tokyo-worker stores and serves them without inventing meaning.
10. **Content source authority is preserved.** Human-generated content follows
    human intent, AI-generated content may be operated inside approved product
    rules, and integration-sourced truth changes only through an explicitly
    authorized integration write path.
11. **Public runtime serves saved truth.** Tokyo-worker serves the stored base
    package and exact saved locale overlay under publication policy. Visitor
    requests do not call models, read Supabase, rebuild widgets, regenerate
    translations, repair state, or fall back to another identity.
12. **Dieter tokens and primitives come first.** Use the existing design-system
    contract before creating local UI styling or controls.
13. **Documentation is operator truth.** `documentation/` describes the current
    system. Planning and history live in `Execution_Pipeline_Docs/`. Confirmed
    documentation/runtime mismatches are fixed with the change that exposes
    them.

These tenets are product law, not suggestions. A fix that violates them is not
a valid fix.

## Authority And Plan Gates

Before a product-path change, name:

- product surface;
- account/session coordinate;
- storage coordinate;
- route/API boundary;
- runtime/deploy surface;
- verification surface.

For cross-system work, shared contracts, managed services, or remote product
data, use a written checklist that separates:

- code changes;
- product-data changes;
- deploy/runtime verification;
- documentation changes.

If investigation changes a named authority, stop, correct the authority
statement and plan, and only then continue.

## Execution Discipline

- Use the existing product route for product mutations.
- Use the exact managed-service command path and preflight documented by the
  owning engineering manual. If preflight fails, stop at that boundary.
- Treat source code and remote product data as separate authorities. Verify and
  report each independently.
- Start from product behavior, then inspect file topology.
- Preserve working behavior outside the requested change.
- Keep diffs inside the named authority and affected surface.
- Reuse existing patterns, helpers, Dieter tokens, and primitives before adding
  anything new.
- Run focused checks for the changed surface; broaden only when the actual
  blast radius crosses systems.
- Keep documentation current with behavior.

## Core Violation Audit

After every execution task, verify the result against these eight violations:

| ID | Violation | Audit question |
| --- | --- | --- |
| V1 | Silent substitution | Did the change replace missing, invalid, stale, or malformed truth with an invented value? |
| V2 | Silent healing | Did the change normalize, coerce, repair, or rewrite invalid persisted/user state without failure? |
| V3 | Silent omission | Did the change drop a required input, artifact, operation, edit, module, event, or policy? |
| V4 | Fail-open control | Did enforcement turn off when a dependency was missing, malformed, or unavailable? |
| V5 | Corruption-as-absence | Did corrupt stored state become treated as missing, new, empty, ignored, or overwritten? |
| V6 | Partial-success masquerade | Did the product claim full success after some requested work was dropped, rejected, or filtered? |
| V7 | Masquerade/redress | Did the same failing workflow continue under a different wrapper, name, path, retry, or log? |
| V8 | Runtime test dependency | Did normal product work start depending on tests, probes, helper checks, or validation rituals? |

For product-path, cross-system, managed-service, deploy, remote-data, or shared
architecture work, use an independent subagent for the post-implementation
V1-V8 audit when available. If unavailable, run it locally and say so.

## Verification And Completion

Verify through the owner of every truth touched. Product runtime evidence comes
from cloud-dev and the owning surface; local commands are debugging and build
evidence, not deployed-product proof.

End execution work with a compact reconciliation:

- files changed;
- checks and results;
- commit, push, deploy, and live state when code changed;
- product-data state when remote data changed;
- verification through the owning surface;
- V1-V8 result when required;
- remaining work only when proven.
