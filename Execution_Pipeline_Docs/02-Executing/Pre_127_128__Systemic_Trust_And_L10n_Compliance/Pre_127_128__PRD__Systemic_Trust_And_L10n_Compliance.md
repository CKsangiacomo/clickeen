# Pre-127/128 — Hardcoded/L10n And Internal-Trust Cleanup

Status: **IMPLEMENTED — OWNER CLOSURE PENDING**

Owner: Clickeen product owner/architect

Date: 2026-08-21

## Goal

Before PRD 127 or PRD 128 continues:

1. remove hardcoded visible and accessibility product copy, placing approved
   English copy in the exact l10n source that owns it; and
2. remove downstream checks, guards, filters, validation, coercion, repair,
   and fallback that distrust truth already produced by a named Clickeen
   authority.

That is the complete program. It does not create product behavior, redesign
workflows, or add machinery.

## Why

PRD 127 needs every English product string to have one real owner before
localization can build on it.

PRD 128 needs named Clickeen services to exchange exact trusted truth instead
of surrounding every handoff with duplicate defensive code.

Hardcoded and one-off behavior is toxic in an AI-operated product because the
next agent cannot distinguish product law from wording or behavior invented by
a previous agent. Duplicate internal guards are equally toxic: they create a
second unnamed authority that may omit, repair, or reinterpret valid product
truth.

## Included Scope

- Roma's authenticated customer application;
- Bob as opened through Roma Builder;
- Product Copilot and Translation Agent product UI inside Bob;
- current Widget-declared ToolDrawer labels and contextual upsell copy;
- Dieter only where included Roma or Bob UI consumes its components; and
- the exact internal Berlin, Michael, Tokyo-worker, San Francisco, or agent
  handoffs used by those included surfaces.

## Excluded Scope

- DevStudio;
- Prague;
- published/public Widget visitor UI and runtime copy;
- customer-authored Widget content and translation overlays;
- translation generation, translation quality, and non-English generation;
- new workflows, routes, recovery states, abstractions, registries, loaders,
  validators, or compatibility systems;
- product-data mutation, commit, push, deploy, or live release.

An included handoff does not authorize unrelated cleanup across its service.
Only a concrete current or reachable included flow is changed.

## L10n Ownership

English remains the direct application path. There is no runtime copy loader,
registry, or fallback.

- Roma application copy is imported directly from the owning feature source
  under `roma/l10n/{feature}/en.json`.
- Bob application copy is imported directly from the owning feature source
  under `bob/l10n/{feature}/en.json`.
- Bob-owned ToolDrawer shell, navigation, operations, and editor states are
  Bob application copy.
- A Widget's `$label:` declarations in `spec.json` resolve from that Widget's
  adjacent `labels/en.json`; Bob compiles and renders the exact result.
- A Widget's contextual upsell message remains in its adjacent
  `upsell/en.json`.
- Dieter owns reusable mechanics and presentation, never caller meaning or
  caller copy.
- Dynamic agent narration belongs to the agent's structured event/result and
  is rendered exactly.

Ownership follows who declares the product meaning, not where the words appear
in the DOM. Roma and Bob l10n roots may contain feature folders; they are not
flat catch-all catalogs. Complete messages remain complete units rather than
fragments stitched in components.

## Internal Trust Rule

Validation remains where outside or untrusted input first enters Clickeen and
where an authority produces its artifact. Keep:

- authentication and authorization;
- browser, route, upload, iframe, provider, and model-output admission;
- HTTP, JSON, SSE, and storage transport handling;
- producer/compiler/build completeness validation; and
- explicit user-input validation and ordinary UI projection.

After a named Clickeen authority has produced successful typed truth, its
downstream consumer uses that exact truth. It does not re-check, normalize,
coerce, filter, repair, default, or silently omit it.

## Simplicity Rule

This cleanup must reduce machinery.

- Import owned English JSON directly; do not wrap it in one-line copy modules.
- Do not add runtime registries, loaders, fallbacks, or compatibility paths.
- Do not add tests that scan source text to enforce architectural wording.
- Do not add CI/CD gates for this cleanup.
- Keep normal behavioral tests, typechecks, builds, and the existing sole
  producer validators.
- Keep current product manuals accurate; do not retain per-slice evidence
  reports after reconciliation.

The five ordinary execution steps are:

1. trace one current product flow and name its existing authorities;
2. move hardcoded product copy to its exact owner;
3. remove only downstream distrust of already-produced truth;
4. run the existing focused behavior/type/build checks for the changed owner;
5. reconcile the owning manuals and audit V1–V8.

If a proposed change requires new product behavior or a new authority, stop for
the product owner. It is not part of this program.

## Implemented Result

- Included Roma and Bob copy is organized in feature-owned English sources and
  imported directly.
- Widget-declared ToolDrawer copy remains Widget-owned and is resolved once at
  the producer/compiler boundary.
- Included downstream consumers now use exact successful truth from their
  named upstream authorities.
- Redundant copy wrappers, source-scanning compliance tests, and slice evidence
  documents were removed.
- Existing authentication, authorization, external-ingress, transport,
  producer validation, build, and deployment authorities were preserved.

No product data was changed. No commit, push, deployment, or live release is
part of this document.
