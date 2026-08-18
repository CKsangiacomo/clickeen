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
3. **Clickeen is a closed, trusted system.** Once a named Clickeen authority
   produces an artifact or result, downstream Clickeen services consume it as
   trusted system truth. Do not add guards, checks, validators, allowlists,
   filters, repair passes, or schema re-interpretation to re-prove another
   Clickeen authority's output. Authentication, authorization, and external
   input acceptance remain at the boundary where non-Clickeen input enters or
   authority is minted; they are not repeated as internal semantic validation.
4. **No silent substitution or fallback.** Missing, invalid, stale, or
   unavailable truth fails visibly. Do not replace it with another account,
   locale, model, provider, storage path, compatibility shape, or invented
   default.
5. **No silent healing.** Non-Clickeen input may be accepted or rejected by its
   owning ingress boundary. Once accepted as Clickeen truth, downstream
   services do not normalize, coerce, repair, filter, or revalidate it. An
   explicit authorized operation may change authoritative truth; an internal
   read or handoff may not.
6. **Product commands stay boring.** User intent travels through the current
   account and the owning route/service to one explicit result. Do not add
   orchestration machinery, broad registries, runtime discovery, compatibility
   layers, or meta-frameworks around deterministic work.
7. **A Widget is software that uses Clickeen.** Its structured contract and
   mandatory unique Core HTML/CSS/JavaScript own its product meaning and
   behavior. Stage, Pod, Header,
   Bob editing, Roma account operations, materialization, storage, localization,
   assets, connectors, integrations, and future capabilities are shared
   Clickeen services. Every Widget uses a shared service through the same
   structured contract. If a shared service must grow, augment it generically
   for every applicable Widget; never put Widget-specific meaning or branches
   in Bob, Roma, Tokyo-worker, Dieter, or another shared service.
   Each Widget's internal `discovery.json` declares what it is and which exact
   customer-content parts and relationships matter to search and answer
   systems. Users do not edit that file. Only Publish materialization turns it
   into technical public output.
8. **Bob edits in browser memory.** Draft edits, undo, preview, and Product
   Copilot changes remain local until the user saves through Roma. Bob and
   Product Copilot do not independently persist or publish. Bob preview uses
   deploy-built Widget software plus the one current draft; it never requires,
   parses, or executes the instance's stored public package. Public
   `runtime.js` contains no Bob editing protocol.
9. **Storage follows ownership.** `accounts/` is runtime-managed account data;
   `dieter/`, `fonts/`, `product/`, and `prague/` are git-authored deploy
   roots. Global Clickeen fonts live under `fonts/`; do not turn them into one
   account's uploads or create alternate storage authorities.
10. **Translation overlays are exact files.** Locale values live at the exact
   account/instance/locale coordinate. Translation Agent generates them;
   Tokyo-worker stores and serves them without inventing meaning.
11. **Content source authority is preserved.** Human-generated content follows
    human intent, AI-generated content may be operated inside approved product
    rules, and integration-sourced truth changes only through an explicitly
    authorized integration write path.
12. **Publish generates; public runtime serves complete materialized truth.** One saved Widget
    instance is one complete logical state containing its exact shared
    Header/Stage/Pod/capability values and its exact Core values. Bob edits that
    document in browser memory. Create writes the first editable source and
    Save updates that source. Only explicit allowed Publish invokes Roma's one
    generic Widget materializer; that materializer is the sole authority that
    generates the served complete `index.html`, complete `styles.css`, and
    complete `runtime.js`. Tokyo-worker does not generate those files: it
    writes the canonical account source documents from Roma's exact semantic
    source payloads, stores Roma's exact package bytes, and serves them.
    Mandatory `runtime.js` owns Widget and shared visitor functionality; it
    does not create the first meaningful page, materialize, localize, validate,
    or host an instance so that Clickeen can serve it. Bob preview is an editing
    concern built from Widget software plus browser-memory draft truth; it never
    consumes or dictates the public package. Tokyo-worker serves the
    stored base package or applies the trusted exact overlay into semantic HTML
    for a selected non-base locale under publication policy; visitor requests
    do not call models, read Supabase, rebuild Widgets, regenerate translations,
    repair state, or fall back to another identity.
13. **Dieter tokens and primitives come first.** Use the existing design-system
    contract before creating local UI styling or controls.
14. **Documentation is operator truth.** `documentation/` describes canonical
    product law and current implementation truth. When implementation has not
    reached that law, the owning manual names the mismatch explicitly instead
    of presenting either side falsely. Planning and history live in
    `Execution_Pipeline_Docs/`.

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

For Widget work, apply this boundary gate before editing:

1. If the behavior or presentation is unique to one Widget, it belongs to that
   Widget's Core.
2. If the state is editable or operable, it belongs to the Widget's structured
   contract; Bob consumes that contract but does not become the Widget.
3. If an existing shared Clickeen capability can perform the work, the Widget
   uses it through its existing contract.
4. If a shared capability is genuinely missing, prove the current need and
   augment the shared service once, without a Widget-name branch, path-specific
   semantic rule, or second consumer workflow.
5. A downstream Clickeen service trusts artifacts produced by the owning
   Clickeen authority. Do not add a validator or filter to reconstruct the
   upstream contract.
6. Published Widgets are static-first: only explicit allowed Publish
   materializes complete semantic HTML, CSS, and JavaScript. Create writes the
   first editable source; Save updates that source; neither generates public
   files. Core JavaScript is mandatory and owns genuine Widget behavior; it is
   never the instance renderer,
   materializer, localizer, validator, preview host, or serving engine.
   Explicit Save remains Bob's editable-source persistence boundary. Publish
   remains the separate release boundary.
7. Bob preview consumes deploy-built Widget software plus the current draft.
   It does not read an account instance's stored `index.html`, `styles.css`, or
   `runtime.js`, and public Widget JavaScript contains no Bob state-update
   receiver.
8. Keep Widget source, logical instance state, and stored public package
   distinct. The Widget folder authors reusable software; the account instance
   owns its customized shared and Core values; Roma's generic materializer
   generates the public package; Tokyo-worker only persists and serves it.

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

These are implementation and reconciliation audit questions. They do not
authorize runtime guards, validators, probes, equality checks, or repair paths.
Correct the producing authority; downstream Clickeen consumers continue to
trust its exact output.

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
