# PRD 074 — Authoring System Architecture Alignment

Status: COMPLETE
Date: 2026-03-18
Owner: Product Dev Team
Priority: P0 (core authoring-system correctness + simplification)
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`
- `072__PRD__Roma_Boring_SaaS_Shell__Current_Account_Truth_And_Direct_Product_Flows.md`
- `073__PRD__Audit_Driven_Architecture_Upleveling_And_Simplification.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/services/bob.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/FAQ/FAQ_PRD.md`

Environment contract:
- Read truth: local repo + canonical architecture/widget docs
- Write order for execution: local first, then cloud-dev only where deployed product paths must be verified
- Canonical startup: `bash scripts/dev-up.sh`

Source inputs:
- staff-engineer audit of FAQ widget, Dieter components, compiler, and Bob panels (2026-03-18)
- external authoring-system audit focused on saved-config boundary, FAQ curated-instance risk, compiler/panel contract visibility, and Dieter/editor boundary (2026-03-18)
- `clickeen-authoring-audit.pdf` (2026-03-18, repo PDF)
- product-direction correction: Minibob SDR Copilot and Roma CS Copilot are different systems; CS Copilot must align with Clickeen’s AI-operated SaaS architecture instead of remaining a Minibob-shaped chat surface (2026-03-18)
- external audit: authoring system architecture audit covering FAQ, Dieter, compiler, and Bob panels with emphasis on compiler strength, owner-boundary correctness, spec-version hardening, and non-blocking large-file hotspots (2026-03-18)
- active repo/runtime contracts in `tokyo/widgets/faq/*`, `dieter/components/*`, `bob/lib/compiler*`, and `bob/components/td-menu-content/*`

Scope note:
- this PRD treats external audits as repo-grounded authoring-system inputs, not as a live dump of every current production FAQ row

Current execution snapshot:
- Slice A landed for FAQ-first save/open boundary safety in Roma
- Slice B landed for FAQ contract truth cleanup (dead FAQ fields removed, answer-media contract corrected)
- Slice C landed for repo-visible FAQ proof-lane coverage; active FAQ page refs were restored because repo-only checks are not the authority for curated/admin instance truth, and stale editor-richtext leakage in checked-in FAQ proof-lane l10n artifacts was repaired with correct base-fingerprint renames
- Slice D landed for Bob strict-document behavior on the active account-hosted product path
- Slice E was reviewed and intentionally closed without further structural change; the FAQ content panel remains a literal widget-spec contract because the alternative would have reintroduced hidden compiler mechanics
- Slice F landed for the concrete compiler hardening that was actually justified here: widget spec version guarding at the compile boundary, with no broader compiler rewrite smuggled in
- Slice G landed by deleting redundant linked-field checkbox branches from `useTdMenuBindings.ts` and reusing shared linked-op semantics; no further safe Bob panel-runtime reduction target remained worth opening a new cleanup project
- Slice H1 landed further by making ToolDrawer choose explicit account/minibob Copilot surfaces, moving Bob-side product semantics into explicit surface contracts, and pushing account/minibob surface ownership out of the shared pane so only shared thread / staged-ops behavior remains common there
- Slice H2 landed by moving remaining SDR/CS product semantics out of `sanfrancisco/src/agents/widgetCopilotCore.ts` into explicit product-owned files so the shared core now coordinates shared execution plumbing while SDR/public and CS/account own their own prelude, prompt-shaping, allowlist/website-consent, and post-filter behavior
- Slice I landed by making Dieter’s authoring-runtime boundary explicit in active docs instead of treating hosted asset behavior as accidental drift
- Slice J landed by clarifying `appearance.theme` / `context.websiteUrl` as canonical non-runtime fields in the authored document, keeping FAQ runtime independent from them, and proving the save/open boundary still accepts them as canonical state
- Slice K landed for the touched seams: FAQ boundary/proof-lane, linked-op behavior, Copilot product/runtime boundaries, and Dieter hosted-asset bridge behavior
- Slice L was reviewed and intentionally not executed because no remaining low-risk dedupe was worth adding new shared shape after the correctness/closure slices landed

Closure result:
- PRD 074 finishes net-negative on active-path code touched in this track
- the remaining non-trivial authoring hotspots are no longer architecture-mismatch blockers for this PRD
- any future work from here should be a new focused reduction PRD, not an extension of 074

---

## One-line objective

Bring Clickeen’s authoring system back into explicit alignment with the current architecture by making:
- widget truth deterministic
- Dieter the real authoring-primitive owner
- Bob a strict in-memory editor instead of a config-healing layer
- compiler/panel behavior smaller, more legible, and easier for humans and AI agents to modify safely

---

## Core premise

The core architecture is not the problem.

The current owner chain is broadly right:
- Tokyo widget definitions are the software truth
- instance config is the document
- Bob is the in-memory editor kernel
- Roma is the hosted product shell / host bridge
- Tokyo/Tokyo-worker own saved, localized, live, and public truth
- Venice consumes published truth

The mismatch is inside the authoring surface:
- saved config is not yet schema-safe before it reaches strict runtime code
- FAQ contract drift across PRD/spec/agent/runtime
- FAQ curated instances have not been re-certified against the current platform contract
- FAQ spec carries a large literal authoring contract that is hard to manage, but it remains widget-owned truth
- Bob still healing and mutating canonical config
- compiler behavior still relies on too much hidden panel/slot heuristics
- Bob panel contract is still more implicit than the architecture should allow
- the Copilot panel is still Bob/Minibob-shaped even in Roma account-mode Builder
- panel behavior spread across low-level HTML strings, compiler rewrites, DOM hydration, and path-specific binding branches
- Dieter now carries real editor/runtime behavior beyond pure visual primitives, but that boundary is not yet explicit enough
- the authoring-system test floor is still materially behind the service-boundary test floor
- the boundary between runtime-rendering fields and other canonical authored-document fields is not explicit enough

PRD 074 is therefore **not** a new architecture PRD.
It is an authoring-system closure PRD.

Its job is to make the authoring layer match the architecture Clickeen already says it has.

---

## What this PRD is and is not

This PRD is:
- an authoring-contract correction PRD
- a simplification PRD
- a code-reduction PRD
- a stale-LOC deletion PRD
- a Dieter/compiler/Bob boundary cleanup PRD

This PRD is not:
- a Bob rewrite
- a new panel framework
- a new schema language
- a “generic authoring engine” initiative
- a save/publish/runtime ownership rewrite
- a justification to add more abstraction than the current problem requires

If a proposed fix adds more framework shape than it deletes, it is out of contract for PRD 074.

---

## Normalized findings

### Accepted as valid

1. FAQ contract drift is real and must be closed.
   - `documentation/widgets/FAQ/FAQ_PRD.md`
   - `tokyo/widgets/faq/spec.json`
   - `tokyo/widgets/faq/agent.md`
   - `tokyo/widgets/faq/widget.client.js`

2. Saved config is not schema-safe enough before it reaches strict runtime code.
   - the save/open boundary still validates “persistable object + URLs/assets,” not widget-schema correctness
   - FAQ runtime and shared helpers remain strict and will hard-fail on malformed booleans / required fields

3. FAQ curated instances must be re-certified as the gold-standard proof lane.
   - FAQ is reused across Prague, templates/examples/features/pricing, and curated rows can fan out across Builder, Venice, Prague, and l10n surfaces

4. Bob still heals canonical config, which conflicts with the strict authoring model.
   - `bob/lib/session/sessionConfig.ts`
   - `bob/lib/session/sessionNormalization.ts`
   - `bob/lib/session/useSessionEditing.ts`

5. FAQ carries a very large literal panel contract in `spec.json`, and any cleanup must preserve that literal widget-spec model.
   - the issue is maintainability inside the canonical widget contract, not a license to add compiler indirection

6. Compiler hidden magic is too large a part of the executable authoring contract.
   - panel stripping, injection, and cluster rewriting still depend on compiler heuristics that are not explicit enough in widget source

7. Bob panel runtime remains a maintenance hotspot.
   - `bob/components/td-menu-content/*`
   - especially `useTdMenuBindings.ts`, `showIf.ts`, `dom.ts`

8. The Bob panel contract is too implicit for a deterministic authoring platform.
   - canonical panels are hardcoded
   - localization reuses content-panel HTML
   - settings mix widget HTML with Bob-owned account/context UI

9. The Copilot panel is now wrong in Roma because account-mode execution moved to Roma, but the panel contract stayed Bob-owned and Minibob-shaped.
   - `bob/components/ToolDrawer.tsx` still hardcodes the top-level `manual|copilot` switch as if Copilot were one universal Bob mode
   - `bob/components/CopilotPane.tsx` mixes Minibob/public SDR behavior and Roma account-mode Builder behavior in one pane via `subject` branching, inline provider/model UI, local storage, CTA differences, and Keep/Undo differences
   - `bob/lib/session/sessionTransport.ts` correctly delegates account-mode execution to Roma host commands, but the UI/product contract is still being driven from Bob as if both surfaces were the same product
   - `roma/components/builder-domain.tsx` owns the backend command boundary, but not an explicit account-mode Copilot surface contract
   - this is why the Copilot panel now feels wrong in Roma: the backend ownership moved, but the panel semantics did not

10. SDR/public Copilot and CS/account Copilot are different products, not two skins on one widget-copilot contract.
   - SDR/public Copilot is a conversion/sales surface with bounded public-edit capabilities and CTA behavior
   - CS/account Copilot is an authenticated product/operator surface and should be architected as part of Clickeen’s AI-operated SaaS thesis
   - current shared shaping is still too strong:
     - `sanfrancisco/src/agents/widgetCopilotCore.ts`
     - `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
     - `sanfrancisco/src/agents/csWidgetCopilot.ts`
     - `documentation/ai/widget-copilot-rollout.md`
     - `documentation/services/sanfrancisco.md`
   - shared grant plumbing and telemetry shape may be correct, but shared product contract, shared UX assumptions, and shared agent-core semantics are now suspect

11. Dieter is now part of the authoring runtime, not just a styling layer, and that boundary needs an explicit decision.

12. Some canonical authored-document fields are non-runtime authoring/product fields, and the repo must be explicit about that boundary without treating those fields as accidental leaks.

13. The authoring test floor is behind the service-boundary test floor.
   - complex authoring seams currently have much less direct verification than Berlin/Roma/Tokyo/Venice service boundaries

14. There is real source/build duplication in the authoring stack, but most of it is maintenance debt, not an architecture blocker.
   - utility/helper duplication in widget runtime code
   - shared Dieter hydration logic duplicated in built bundles

15. The compiler is one of the strongest parts of the authoring system and should be hardened, not reinvented.
   - the stateless Tokyo-spec -> compiled-widget model is correct
   - the right follow-up is contract hardening such as an explicit widget spec version guard, not a compiler architecture rewrite

16. The compiler route currently lacks an explicit spec version guard.
   - `bob/app/api/widgets/[widgetname]/compiled/route.ts` compiles and caches `spec.json` with freshness signals and content hashing
   - `tokyo/widgets/faq/spec.json` currently has no top-level `v`
   - a breaking `spec.json` shape change could therefore miscompile until detected by code failure rather than being rejected at the route boundary

17. `bob/lib/session/useSessionLocalization.ts` is a real maintenance hotspot, but it is a future simplification target rather than a current architecture blocker.
   - large file size alone does not justify moving the l10n authoring surface or broadening `074`

18. `venice/app/embed/v2/loader.ts` is a real maintainability hotspot, but it is outside the main authoring-boundary closure path of `074`.
   - keep it as a later Venice reduction target, not a distraction from saved-config / FAQ / Bob / Copilot truth closure

19. The earlier postMessage timeout concern from this audit is already closed in the current repo state.
   - `bob/lib/session/sessionTransport.ts` now uses `15_000`
   - this is not an active PRD 074 work item

### Explicitly rejected interpretations

1. The solution is **not** to move more authoring intelligence into Roma, Tokyo-worker, or Venice.
2. The solution is **not** to add a new cross-runtime shared library for panel orchestration.
3. The solution is **not** to create a new abstraction language or schema DSL for all widgets before fixing the concrete FAQ/Bob mismatches.
4. The solution is **not** to let Bob keep healing state because it is “convenient.”
5. The solution is **not** to treat Dieter/editor-hosted asset behavior as “just design system stuff” and leave the boundary undocumented.
6. The solution is **not** to build a giant authoring test harness before adding the few contract/smoke tests that would actually close the current risks.
7. The solution is **not** to let low-risk dedupe work outrank the saved-config boundary, FAQ proof-lane truth, or Bob strict-document closure.
8. The solution is **not** to add Storybook/catalog/meta-documentation work as part of architecture alignment unless it directly closes an active contract risk.
9. The solution is **not** to move account-mode Copilot execution back into Bob just because the current panel contract is muddled.
10. The solution is **not** to keep one giant subject-branching Copilot pane and call that “shared UI.”
11. The solution is **not** to keep treating SDR/public and CS/account Copilot as one product just because they can share some low-level execution plumbing.
12. The solution is **not** to answer the AI-operated SaaS requirement by adding vague “agent framework” abstractions instead of making CS Copilot’s capabilities and ownership explicit.
13. The solution is **not** to turn `074` into a Venice-loader cleanup PRD just because `venice/app/embed/v2/loader.ts` is large.
14. The solution is **not** to rewrite the compiler. The right move is to harden the existing deterministic compiler contract.
15. The solution is **not** to broaden `074` around already-closed timeout concerns.

### Confirmed aligned / not primary targets in PRD 074

The following areas were explicitly re-affirmed by the audit and should stay boring:

1. Bob -> Roma -> Tokyo save flow is correct in shape.
2. Venice public-instance proxy ownership is correct in shape.
3. `limits.json` + `ck-policy` capability gating is correct in shape.
4. Tokyo-owned localization overlay ops and base fingerprint model are correct in shape.
5. Minibob handoff as transient KV-backed state is correct in shape.
6. The compiler’s stateless Tokyo-spec -> compiled-widget model is correct in shape.
7. FAQ self-containment under `tokyo/widgets/faq/*` is the right boundary.

---

## Architecture target

The target authoring shape after PRD 074 is:

1. Widget PRD, widget spec, agent contract, runtime, curated proof instances, and localization allowlist all describe the same state model.
2. Saved/open boundaries reject or explicitly repair invalid persisted widget state before Bob or strict runtime consumes it.
3. Dieter owns reusable authoring primitives, and any editor-hosted asset/runtime behavior it carries is explicitly part of the architecture instead of accidental drift.
4. Widget specs declare panels and state paths, but do not embed mini applications as giant serialized UI blobs when a primitive or explicit widget-side template/module would be cleaner.
5. Compiler remains deterministic and visible:
   - widget spec + Dieter stencil/spec in
   - compiled controls/panels/assets out
   - heuristics are minimized in favor of explicit slots/feature markers where doing so reduces magic
6. Bob panel surfaces are explicit enough to be treated as platform contract, not just emergent runtime behavior.
7. Copilot surface ownership is explicit:
   - Bob owns generic chat-thread rendering and deterministic ops preview / Keep / Undo mechanics
   - Roma account-mode Builder owns the account-mode product contract/capabilities for Copilot
   - Minibob/public keeps its own SDR/public Copilot shell and CTA behavior
8. CS/account Copilot is architected as an operator surface, not just as “authenticated widget chat.”
   - capabilities are explicit
   - account/workspace context is explicit
   - deterministic document mutation remains explicit
   - outcomes and follow-up actions are shaped for a future AI-operated SaaS surface rather than a public conversion flow
9. Bob edits exactly the document it was given.
   - no silent default healing
   - no editor-owned canonical state mutation
   - no “best effort” correction of broken widget state
10. If historical instance repair is needed, it happens as an explicit bounded migration or owner-correct saved-document repair path, not as permanent Bob behavior.

---

## Goals

1. Make the saved/open boundary schema-safe for the authoring document, starting with FAQ as the proof lane.
2. Close FAQ authoring contract drift completely.
3. Re-certify FAQ curated instances against current platform truth.
4. Remove Bob-side canonical config healing from the active product path.
5. Reduce FAQ authoring-surface complexity by moving UI implementation to the correct owner.
6. Reduce compiler hidden magic where it currently defines authoring behavior implicitly.
7. Reduce Bob panel special-casing where it is currently standing in for missing primitive/control contracts.
8. Fix the Copilot panel so Roma account-mode Builder is no longer forced through a Minibob-shaped Bob surface contract.
9. Split SDR/public Copilot and CS/account Copilot at the product-contract level, keeping shared code only where it is truly low-level execution plumbing or deterministic editor mechanics.
10. Make the Dieter/editor-runtime boundary explicit.
11. Add an explicit widget spec version guard at the compiler route boundary instead of relying on silent freshness/cache behavior for breaking spec changes.
12. Delete stale config fields, stale code paths, stale documentation, and stale fixtures/tests in the same slices that replace them.
13. Add the minimum authoring verification floor needed to prove the corrected contract is real.
14. Capture any remaining low-risk authoring dedupe only after the architecture-correctness slices are done.

## Non-goals

1. No redesign of FAQ UX for end users.
2. No broad rewrite of all widgets at once.
3. No new service owner.
4. No reintroduction of DevStudio as a product authoring host.
5. No generic migration framework.
6. No new authoring metadata plane unless the narrow FAQ-first move is clearly simpler than retaining the current leak.
7. No generic widget-schema framework unless the FAQ-first proof lane cannot be closed without it.
8. No Storybook/component-catalog/doc program unless authoring verification or onboarding is blocked by a concrete current need.
9. No Venice embed-loader reduction work in `074` unless a touched authoring-contract change forces it.
10. No `useSessionLocalization.ts` split in `074` unless a touched authoring-contract change makes that split directly necessary.

---

## Execution posture

PRD 074 must execute as a **reduction-and-closure** track.

Rules:

1. One vertical slice at a time.
2. Each slice must name one primary owner and one deletion path.
3. If a slice needs more than one primary owner, split it before execution.
4. Docs must be updated in the same slice as behavior.
5. Old and new authoring paths must not remain active in parallel “for now.”
6. Any new primitive must earn its keep across more than one real use case or clearly delete widget-owned UI complexity immediately.
7. If a problem can be solved by deleting dead state or moving code to the correct owner, prefer that over inventing a framework.
8. Each slice must declare the exact files/functions/fields expected to be deleted or reduced.
9. Hard reduction gate: if a slice adds more than ~200 net-new active-path LOC, it must delete at least that many active-path LOC in the same slice or explicitly justify the exception before implementation.
10. PRD 074 only closes if the aggregate active-path code touched by this PRD is net-negative LOC, unless a narrow exception is explicitly documented and still removes a larger architecture risk.

Forbidden execution posture:

1. keeping Bob healing while also claiming strict document semantics
2. replacing FAQ’s giant inline template with an even more generic meta-template system
3. creating a new authoring orchestration layer outside Dieter/compiler/Bob
4. landing temporary compatibility logic without a same-slice deletion plan
5. combining Bob, Roma, and San Francisco Copilot cleanup into one mega-slice
6. inventing a new authoring metadata platform before proving the current canonical non-runtime field model is insufficient
7. landing broad net-new code growth under the label of “simplification”

---

## Execution slices

### Slice A — Saved-config boundary schema closure

Owner: `roma` save/open boundary, consuming compiler-authored widget contract

Problem:
- persisted widget config can still be saved/reopened without widget-schema validation even though runtime is strict

Required move:
- derive the minimum FAQ-first document contract from widget source/compiler truth
- enforce that contract at the Roma save/open boundary before Bob open and before save persistence accepts a new document
- keep Bob as a consumer of validated document truth, not as a second validation owner
- if invalid historical FAQ state exists, handle it via an explicit bounded repair or migration path rather than permanent Bob healing
- start with narrow FAQ-first field guards for the concrete malformed-state failures already observed
- only widen beyond those guards if the proof lane cannot be closed without it

Deletion targets:
- any Bob-side malformed-document protection that only exists because the boundary is currently too weak
- any save/open compatibility branches made unnecessary by FAQ-first contract enforcement

Rules:
- no generic schema framework unless FAQ-first proof cannot be closed without it
- default to FAQ-first field guards, not a general schema runner
- no silent repair in Bob
- compiler defines contract shape; Roma enforces; Bob consumes
- no widening of Roma/Tokyo owner boundaries

Blast radius:
- very high
- Builder open/save, curated FAQ instances, public runtime trust

Done means:
- invalid FAQ document state is rejected or explicitly repaired before strict runtime/Bob consumption
- saved/open path is materially safer than “object + persistable URLs/assets”
- Bob no longer needs healing as protection against malformed persisted state
- validation ownership is explicit: compiler/source contract, Roma enforcement, Bob consumption
- Slice A does not introduce a general schema-validation framework unless explicitly re-approved after the FAQ-first proof fails

### Slice B — FAQ contract truth closure

Owner: `tokyo/widgets/faq/*` + FAQ docs

Problem:
- FAQ currently says different things in different places about answer media, editor-only fields, and canonical state.

Required move:
- reconcile:
  - `documentation/widgets/FAQ/FAQ_PRD.md`
  - `tokyo/widgets/faq/spec.json`
  - `tokyo/widgets/faq/agent.md`
  - `tokyo/widgets/faq/widget.client.js`
  - any affected FAQ localization / schema files

Default direction:
- remove dead answer-media toggles from FAQ if the intended product shape is “URLs link only; no media embedding”
- keep one explicit answer behavior contract and delete all contradictory state/wording

Blast radius:
- high within FAQ
- low cross-widget

Done means:
- every persisted FAQ config path is intentional
- every authorable FAQ path has one coherent PRD/spec/agent/runtime story
- no dead FAQ state remains in defaults or Binding Map docs

### Slice C — FAQ curated-instance re-certification

Owner: FAQ proof lane + curated instance truth

Problem:
- FAQ is a broad platform proof lane, but curated FAQ rows have not been re-certified against the current authoring/runtime contract

Required move:
- audit curated FAQ instances against the reconciled FAQ contract
- repair or regenerate stale rows where needed
- verify Builder, Venice, Prague, and localization surfaces against those rows
- treat repo-visible FAQ l10n artifacts as supporting proof data, not as the sole authority for curated/admin instance truth

Rules:
- no open-ended data cleanup campaign
- FAQ only in this PRD
- any repair path must be explicit and bounded
- do not rewrite curated/admin page refs just because repo-only proof data is incomplete

Blast radius:
- high within FAQ proof lanes
- medium across Prague/Venice/Builder/l10n surfaces that reuse FAQ

Done means:
- curated FAQ instances are trustworthy proof rows again
- no known stale FAQ curated row remains in the active proof lane

### Slice D — Bob strict-document closure

Owner: `bob`

Problem:
- Bob still merges missing defaults and injects typography values into the canonical config during load/editing.

Required move:
- remove permanent Bob-side healing from:
  - `bob/lib/session/sessionConfig.ts`
  - `bob/lib/session/sessionNormalization.ts`
  - `bob/lib/session/useSessionEditing.ts`
- preserve only explicit, declared widget normalization rules that are part of the compiler/widget contract
- if historical document repair is needed, do it outside Bob as an explicit bounded repair mechanism

Rules:
- no new “document upgrade framework”
- no hidden fallback path left in Bob
- if missing required state becomes visible, that is a correctness signal to fix at the source

Blast radius:
- very high
- all widgets, all editor sessions

Done means:
- Bob no longer silently manufactures canonical config values
- required state comes from widget defaults / saved document / explicit normalized contract, not editor healing
- Bob docs remain true without caveat

### Slice E — FAQ content-surface reduction

Owner: `faq` widget + `bob/compiler` + possibly `dieter`

Problem:
- FAQ content authoring currently carries a very large literal panel contract inside `spec.json`.

Required move:
- only reduce this area if the result stays truthful to the literal widget-spec contract
- the preferred moves are:
  1. delete dead or redundant literal panel markup inside FAQ `spec.json`
  2. introduce a clearly reusable Dieter/tooldrawer primitive only if reuse is already concrete and the literal spec remains explicit

Rules:
- do not externalize widget-owned panel content into side files
- do not add compiler include/preprocessor behavior
- do not create a generic meta-template system
- do not expand compiler responsibility beyond deterministic composition
- default to no structural change if the only alternative is hidden mechanics
- option 2 is only allowed if reuse beyond FAQ is already concrete and same-slice

Blast radius:
- medium-high
- FAQ + Bob compiler + any reused primitive

Done means:
- if this slice is touched, FAQ content authoring is smaller or clearer while remaining a literal widget-spec contract
- compiler complexity does not increase
- no hidden include/preprocessor behavior exists

### Slice F — Compiler contract visibility reduction

Owner: `bob/compiler`

Problem:
- too much authoring behavior still depends on compiler heuristics that are not explicit enough in widget source

Required move:
- keep the good shared injections that the platform actually wants
- move heuristic behavior toward explicit slot markers or declared feature flags where doing so makes the authoring contract more source-visible
- add an explicit widget spec version guard at the compiler route boundary for the proof lane, so breaking spec-shape changes fail closed instead of being cached/served optimistically
- especially review:
  - typography panel stripping/injection
  - stage/pod layout injection
  - header injection
  - cluster relabeling/rewrite behavior

Deletion targets:
- any touched compiler heuristic branch that is replaced by a clearer explicit marker
- any touched compatibility path that exists only to preserve hidden compiler behavior

Rules:
- no new compiler framework
- no “make everything explicit” churn if the current heuristic is already small and stable
- only convert hidden behavior that currently creates contract ambiguity
- the spec version guard is the concrete P1 for this slice
- any additional compiler change must tie to a specific ambiguity bug, source-visible contract gap, or same-slice net deletion target

Blast radius:
- very high
- every widget and panel compile path

Done means:
- the executable authoring contract is more visible in widget source than it is today
- compiler keeps deterministic composition but carries less magic
- compiler hard-fails clearly on unsupported widget spec versions for the touched proof lane instead of silently attempting to compile them
- Slice F does not become a broad compiler rewrite in disguise

### Slice G — Bob panel-runtime reduction

Owner: `bob` + `dieter`

Problem:
- too much panel behavior currently lives in path-specific branches and bespoke DOM/runtime logic.

Required move:
- reduce the remaining path-regex special cases where the behavior is actually a stable surface pattern
- especially review linked field semantics for:
  - radius groups
  - four-side padding groups
  - inside-shadow groups
- move stable linked semantics into clearer component/control contracts where doing so deletes real Bob runtime branching

Deletion targets:
- path-specific linked-field branches in `bob/components/td-menu-content/useTdMenuBindings.ts`
- any redundant panel-runtime DOM adapters in `bob/components/td-menu-content/dom.ts`
- any touched `TdMenuContent` glue that becomes unnecessary once stable linked semantics are explicit

Rules:
- no new general panel engine
- no DSL expansion
- keep `show-if` as-is unless a direct deletion opportunity emerges
- only move behavior when the destination owner is clearly more correct and the Bob runtime gets smaller
- one stable pattern at a time; no broad “panel cleanup” sweep

Blast radius:
- high
- every widget panel

Done means:
- Bob binding logic is smaller and less path-specific
- repeated control semantics are represented more declaratively than they are today
- no new abstraction layer is introduced

### Slice H1 — Copilot surface-contract split

Owner: `bob` UI shell + `roma` Builder host contract

Problem:
- account-mode Copilot execution correctly moved to Roma, but the panel contract did not move with it
- `bob/components/CopilotPane.tsx` still tries to serve both Minibob/public SDR and Roma account-mode Builder as one subject-branching pane
- `bob/components/ToolDrawer.tsx` still presents Copilot as a universal Bob mode instead of an explicit subject-aware authoring surface
- this is why the Copilot panel now feels wrong in Roma: workspace/account concerns are being expressed through a Bob-owned public-style panel contract
- deeper architectural issue: SDR/public and CS/account are different products, but the current Bob surface still treats them as one widget-copilot family

Required move:
- make the Copilot surface explicit and owner-correct:
  1. Bob owns only the truly shared chat-thread rendering and deterministic ops preview / Keep / Undo mechanics
  2. Minibob/public keeps its own SDR/public Copilot shell and CTA behavior
  3. Roma account-mode Builder gets its own explicit Copilot contract for account-mode behavior and capabilities
- remove the current “one pane with many `subject` branches” shape where doing so deletes real complexity
- account-mode provider/model availability, workspace/account context affordances, and product copy must come from an explicit account-mode contract instead of being inferred ad hoc inside the shared pane

Deletion targets:
- the current cross-subject branching inside `bob/components/CopilotPane.tsx`
- any `ToolDrawer` mode assumptions that only exist because Copilot is treated as one universal Bob surface
- any Roma/Bob host glue that becomes unnecessary once account-mode Copilot has its own explicit contract

Rules:
- no second Copilot execution path
- no new generic chat framework
- no moving Builder Copilot backend ownership back into Bob
- prefer a small shared thread/ops core plus thin subject-specific shells over one giant polymorphic pane
- no San Francisco runtime split work in H1

Blast radius:
- high
- Bob ToolDrawer, Bob Copilot UX, Roma Builder host contract, account-mode authoring experience

Done means:
- Roma Builder Copilot no longer feels like Minibob UI with account routing bolted underneath
- Minibob/public and Roma/account-mode have explicit UI contracts
- shared Bob-side Copilot code is smaller because only truly shared thread/ops behavior remains shared

### Slice H2 — Copilot runtime-core reduction (only if still needed after H1)

Owner: `sanfrancisco`

Problem:
- after H1, the remaining shared SDR/CS runtime may still carry product semantics inside `sanfrancisco/src/agents/widgetCopilotCore.ts`
- if so, the repo will still be expressing two different products through one shared agent-core contract

Required move:
- review the remaining shared SDR/CS runtime shaping after H1
- keep only low-level execution plumbing shared:
  - grant verification/plumbing
  - telemetry/outcome envelope where still appropriate
  - deterministic ops protocol if still common
- if `widgetCopilotCore.ts` still carries product semantics, split it so SDR/public and CS/account become explicit product contracts
- architect CS/account Copilot as the first operator-facing AI surface in the product, with explicit capabilities, explicit context, and explicit outcome semantics

Deletion targets:
- product-semantic branches inside `sanfrancisco/src/agents/widgetCopilotCore.ts`
- any shared SDR/CS runtime logic that exists only because the two products were treated as one family

Rules:
- execute H2 only if H1 proves the shared core is still carrying product semantics
- no new agent framework
- no broad telemetry refactor
- prefer deletion/reduction inside `widgetCopilotCore.ts` over introducing a new abstraction layer

Blast radius:
- high
- San Francisco widget-copilot runtime/docs, Bob/Roma Copilot contract assumptions

Done means:
- shared San Francisco Copilot code is reduced to genuinely mechanical execution plumbing only
- SDR/public and CS/account are explicit product contracts at the runtime layer too
- CS/account Copilot is documented and implemented as an operator surface aligned with the AI-operated SaaS thesis

### Slice I — Dieter authoring-runtime boundary decision

Owner: `dieter` + authoring contract docs

Problem:
- Dieter now carries editor-hosted asset behavior and picker/upload flows, but the architecture still talks about it too much like a pure design system

Required move:
- explicitly decide and document one of:
  1. Dieter may own authoring primitives that include hosted asset/editor behavior
  2. those behaviors should move up into Bob and Dieter should narrow back toward primitives

Rules:
- no oscillation between boundaries
- no large move unless it deletes real complexity
- if the current boundary is acceptable, bless it explicitly and stop treating it as accidental

Blast radius:
- medium-high
- Dieter, Bob authoring surfaces, asset picker/upload flows

Done means:
- Dieter’s role in the authoring system is explicit
- no silent boundary drift remains in docs

### Slice J — Canonical non-runtime field boundary

Owner: `faq` first, then broader authoring contract only if needed

Problem:
- some canonical authored-document fields are used by editor/Copilot/product flows rather than runtime rendering, and the repo is not explicit enough about that boundary.

Required move:
- decide explicitly for FAQ in this order:
  1. first, document legitimate canonical non-runtime fields honestly
  2. keep runtime from depending on them accidentally
  3. only if that remains too messy, move a field out of canonical config through a FAQ-first simplification slice

Rules:
- legitimate canonical fields are not “leaks” or “exceptions” just because runtime ignores them
- new plane only if forced by real complexity reduction
- do not invent a broad metadata platform if FAQ-first separation is not clearly simpler
- if a new authoring-only plane is introduced, it must not reopen the save/runtime ownership boundaries closed in 070A/072/073

Blast radius:
- medium
- FAQ first, potentially broader if generalized later

Done means:
- the repo is explicit about which fields are canonical non-runtime fields
- runtime dependence stays owner-correct
- no new metadata plane exists unless it is clearly simpler than the current canonical-field model

### Slice K — Verification and stale-LOC closure

Owner: owning services + PRD/docs

Problem:
- PRD 074 should not close on verbal alignment alone.

Required move:
- add the narrow verification floor for the corrected authoring contract:
  - malformed-config regression coverage at the saved/open boundary
  - FAQ contract coverage for answer behavior / state truth
  - curated FAQ proof-lane verification, with repo-visible l10n checks kept honest about their scope
  - Bob compile/open/edit path coverage for strict-document behavior
  - compiler contract visibility coverage for any newly explicit slot/feature behavior
  - ToolDrawer hydration/binding smoke coverage for touched panel-runtime paths
  - show-if contract coverage if touched
  - Dieter hosted-asset behavior coverage where boundary work lands
  - any new primitive or authoring module coverage where introduced
- delete stale helper code, stale fields, stale docs, and stale tests in the same slices

Rules:
- no giant integration-harness project
- no snapshot theater
- tests must prove active contract seams, not just freeze markup

Blast radius:
- medium

Done means:
- the repo proves the new authoring contract at the seams that changed
- no stale compatibility code is left behind

### Slice L — Low-risk authoring dedupe (only if still worth it after closure slices)

Owner: widget shared runtime / Dieter build only after the architecture-correctness slices

Problem:
- the authoring audit correctly spots some low-risk maintenance debt:
  - duplicated simple widget helper functions
  - Dieter shared hydration logic duplicated in built bundles

Required move:
- only after the architecture-correctness slices are closed, review:
  1. tiny shared widget-runtime helper extraction where it clearly prevents multi-widget drift
  2. Dieter build output dedupe where it actually reduces shipped redundant code without changing the source ownership model

Rules:
- not before the saved/open boundary is safe
- not before FAQ is re-certified
- not if it creates new shared-runtime abstraction for trivial code
- no “cleanup PR” that mixes cosmetic dedupe with correctness work

Blast radius:
- low to medium

Done means:
- any kept dedupe work has real maintenance or bundle-size payoff
- no helper extraction exists just to satisfy an audit line item

---

## Blast-radius map

Low blast radius:
- FAQ docs / agent / localization allowlist alignment
- FAQ-only stale field deletion

Medium blast radius:
- FAQ curated proof-lane recertification
- FAQ content-editor reduction
- Dieter boundary clarification
- canonical non-runtime field boundary clarification
- any new Dieter primitive if narrowly justified

High blast radius:
- compiler contract visibility reduction
- Bob panel-runtime reduction
- Copilot surface-contract split / runtime-core reduction if needed
- Bob strict-document closure once the boundary is safe

Very high blast radius:
- saved/open boundary schema closure

This is why the execution order matters:
1. make the saved/open boundary schema-safe first
2. close FAQ truth
3. re-certify curated FAQ proof rows
4. then remove Bob healing
5. then reduce FAQ content-surface complexity
6. then reduce compiler hidden magic only where the contract becomes clearer
7. then do narrower Bob panel-runtime cleanup
8. then split the Copilot surface contract so Roma account-mode and Minibob/public stop sharing the wrong Bob UI contract
9. only if still necessary, reduce any remaining shared San Francisco Copilot core that still carries product semantics
10. then decide Dieter boundary + canonical non-runtime field handling only where still needed
11. only then consider low-risk dedupe if it still matters

---

## Success criteria

1. FAQ-saved document state is validated or explicitly repaired before Bob/strict runtime consumes it.
2. FAQ PRD/spec/agent/runtime no longer disagree on answer behavior.
3. Dead FAQ config flags are deleted if the product does not support them.
4. Curated FAQ proof instances are re-certified against current contract truth.
5. If Slice E is touched, FAQ content authoring becomes smaller or clearer without breaking the literal widget-spec contract or adding compiler indirection.
6. Bob no longer silently merges missing defaults into canonical config in the active product path.
7. Bob no longer injects editor-owned typography defaults/scales into saved document state.
8. Any remaining normalization in Bob is explicitly declared by widget/compiler contract and is not healing.
9. The executable authoring contract is more source-visible and less compiler-magic-dependent in the touched areas.
10. Bob panel binding logic is smaller or clearer in the touched areas; no new abstraction layer is introduced.
11. Roma account-mode Builder Copilot and Minibob/public Copilot no longer share one muddled subject-branching pane contract.
12. If `H2` is executed, shared San Francisco Copilot code is reduced to genuinely mechanical execution plumbing only.
13. CS/account Copilot is explicitly treated as an operator-facing product surface rather than as a public-widget-copilot variant.
14. The compiler route hard-fails clearly on unsupported widget spec versions for the touched proof lane.
15. Dieter’s authoring-runtime role is explicit in both code and docs.
16. The repo is explicit that `appearance.theme` / `context.websiteUrl` are canonical non-runtime fields in the authored document, and FAQ runtime does not depend on them.
17. The authoring test floor materially improves for the touched seams.
18. Docs are updated in the same slices as code changes.
19. Stale fields, stale helper logic, stale docs, stale fixtures, and stale tests are deleted in the same PRD track, not deferred casually.
20. Any low-risk runtime/helper/build dedupe accepted into this PRD lands only after the architecture-correctness slices and does not introduce new framework shape.
21. The aggregate active-path code touched by PRD 074 ends net-negative LOC, unless a narrow exception is explicitly documented and still deletes a larger architecture risk.

---

## Why this is simple and boring

Because it does **not** invent new architecture.

It does the minimum owner-correct work:
- make the saved/open boundary safe
- fix the FAQ contract
- re-certify the FAQ proof lane
- stop Bob from healing data
- reduce hidden compiler magic where it obscures truth
- reduce only the parts of the FAQ literal spec that can be simplified without changing the widget-contract model
- make the panel contract more explicit
- split shared Copilot mechanics from subject-specific Copilot product contracts
- make the Dieter boundary honest
- add only the minimum authoring tests that prove the corrected seams
- keep Dieter as the real primitive owner
- keep compiler deterministic
- delete stale code/docs while doing it
- hold the PRD to a net-negative active-path LOC bar

The tempting wrong moves are:
- building a new authoring meta-framework
- turning compiler into a generic UI runtime
- keeping Bob healing forever because migrations are uncomfortable
- adding more shared layers instead of deleting the wrong ones
- prioritizing tidy helper dedupe over the actual broken contract boundaries
- turning authoring audit follow-up into a docs/catalog/storybook program

PRD 074 rejects those moves.

Its success condition is a smaller, truer, more legible authoring system that better matches the architecture Clickeen already claims:
- one document
- one editor
- one primitive owner
- one save truth
- fewer hidden corrections
- less stale LOC

---

## Initial recommended execution order

1. Slice A — saved-config boundary schema closure
2. Slice B — FAQ contract truth closure
3. Slice C — FAQ curated-instance re-certification
4. Slice D — Bob strict-document closure
5. Slice E — FAQ content-surface reduction
6. Slice F — compiler contract visibility reduction
7. Slice K — verification + stale-LOC closure for A-F
8. Slice G — Bob panel-runtime reduction only where it deletes real branching
9. Slice H1 — Copilot surface-contract split
10. Slice K — verification + stale-LOC closure for G-H1
11. Slice H2 — San Francisco Copilot runtime-core reduction only if H1 shows it is still needed
12. Slice I — Dieter boundary decision
13. Slice J — canonical non-runtime field handling only if still needed after the prior slices
14. Slice K — verification + stale-LOC closure for I-J-H2 where touched
15. Slice L — low-risk dedupe only if still justified after closure

This order keeps the highest-risk architectural mismatch addressed early, while delaying the most temptation-prone cleanup until the contract and document model are already correct.
