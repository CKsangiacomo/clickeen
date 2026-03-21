# 075 — Authoring System Simplification Audit And Slice Map

Status: audit input for follow-on PRDs
Date: 2026-03-18
Owner: Product Dev Team
Priority: P0 (product-path simplification + reliability)
Depends on:
- `072__PRD__Roma_Boring_SaaS_Shell__Current_Account_Truth_And_Direct_Product_Flows.md`
- `073__PRD__Audit_Driven_Architecture_Upleveling_And_Simplification.md`
- `074__PRD__Authoring_System_Architecture_Alignment.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`

Source inputs:
- human product-direction correction (2026-03-18):
  - "Clickeen a simple product"
  - "Accounts assets etc and one widget editor"
  - "User wants to edit a widget, they open it - they edit it - they save it - done"
  - "only limits comes from entitlements"
- deep repo audit of the authoring/product path (2026-03-18)
- additional product-truth audit focused on persisted-document truth vs `spec.defaults`, Bob UI fallback truth, compiler rewrite authority, and multi-product Bob drift (2026-03-18)
- abstraction-focused audit covering `WidgetOp` complexity, custom validation, `account-instance-direct.ts`, and request-rate-limiting concerns (2026-03-18)
- state-and-distrust audit focused on duplicated session state slots, split dirty/save semantics, repeated validation/healing, and client/server authority drift (2026-03-18)
- full self-fight audit from `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md` covering hot-path normalization, Minibob runtime bleed, ghost scaffolding, and session-layer disproportion (2026-03-18)
- current active-path code in:
  - `roma/components/builder-domain.tsx`
  - `roma/lib/account-instance-direct.ts`
  - `roma/lib/account-assets-gateway.ts`
  - `bob/lib/session/*`
  - `bob/components/td-menu-content/*`
  - `dieter/components/shared/hostedAssetBridge.ts`
  - `dieter/components/dropdown-*/*`

Golden-audit rule:
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md` is a mandatory extraction source for follow-on PRDs under `075`
- if a finding from that audit is not executed directly, it must be explicitly folded into a named `075x` PRD
- execution may update time-sensitive counts/examples, but it may not ignore the diagnosis

---

## Read this first

This document is intentionally narrow and intentionally strict.

It exists because the product is simple, but the code around the product is still too abstract, too polymorphic, and too willing to invent machinery that the product itself does not need.

This document is therefore not an architecture-expansion PRD.
It is a simplification PRD.

If execution adds a new layer, a new framework, a new protocol family, a new schema language, a new metadata plane, a new adapter stack, or a new reusable abstraction that the product itself does not explicitly need, then execution is wrong.

---

## Sub-PRD Extraction Map

`075` is not executed directly.
It is only valid if every active finding is mapped into a real follow-on PRD.

### Extracted PRDs

- `075A__PRD__One_Widget_Document_And_One_Save_Boundary.md`
  Covers:
  - one widget truth in Builder
  - one save meaning
  - Bob/Roma persisted-document boundary
  - `spec.defaults` not being saved-row schema

- `075B__PRD__Builder_Asset_Actions_Must_Follow_One_Clear_Account_Path.md`
  Covers:
  - one account asset path
  - upload/list/resolve/denial path cleanup
  - duplicate host/bridge/consumer asset routing

- `075C__PRD__Minibob_Is_A_Demo_Not_A_User_Account_Or_Editor.md`
  Covers:
  - Minibob runtime bleed
  - fake anonymous-editor identity
  - `minibob` as subject/profile/account contamination
  - shared Builder/Copilot branching caused by Minibob

- `075D__PRD__Builder_Must_Stop_Healing_And_Revalidating_The_Same_Widget.md`
  Covers:
  - repeated validation/healing
  - visible editor truth vs silent repair
  - normalization/validation ownership
  - duplicate client/server distrust loops

- `075E__PRD__Localization_Must_Not_Tax_Every_Builder_Session.md`
  Covers:
  - localization tax in the core session
  - the truth that editing is always one active locale
  - translation as async aftermath, not editor identity

- `075F__PRD__Delete_Ghost_Scaffolding_And_Dead_Future_Product_Paths.md`
  Covers:
  - dead or speculative future-product scaffolding
  - dual boot residue
  - dead AI fields/surfaces
  - unnecessary future-facing session/product modes

- `075G__PRD__Copilot_Provisioning_Must_Not_Live_In_Entitlements_Or_Shared_Product_Core.md`
  Covers:
  - AI/product-variant contamination inside `ck-policy`
  - shared copilot/product core carrying acquisition or provisioning logic
  - account copilot path vs variant/provisioning sprawl

- `075H__PRD__Active_Widgets_Must_Have_Real_Open_And_Save_Contracts.md`
  Covers:
  - active-widget boundary safety
  - per-widget save/open contract closure
  - stopping full software defaults from acting like saved-row schema

- `075I__PRD__Hosted_Builder_Transport_Must_Be_Boring_Plumbing.md`
  Covers:
  - hosted-editor transport reduction
  - duplicate lifecycle/message-shaping cleanup
  - keeping iframe concerns distinct but minimal

- `075J__PRD__Compiler_And_Panels_Must_Stop_Hiding_The_Editor_Contract.md`
  Covers:
  - compiler authority reduction
  - panel contract explicitness
  - `show-if` / panel-runtime reduction without a new framework

- `075K__PRD__Roma_Product_Path_Helpers_Must_Read_Like_The_Product.md`
  Covers:
  - Roma-side product-path reduction
  - direct Roma -> Tokyo/Tokyo-worker product-path clarity
  - deleting unnecessary Roma helper indirection without changing owner boundaries

- `075L__PRD__DevStudio_Local_Is_A_Toolbench_Not_A_Builder_Host.md`
  Covers:
  - removed DevStudio local authoring lane residue
  - local DevStudio-as-host assumptions
  - fake local tool-trust preserving a dead Builder path
  - local verification/seeding still shaped around removed DevStudio Bob hosting

### Coverage rule

Every major active finding from the golden audit must be covered by one of the PRDs above:

- one widget / one save / duplicate document truths -> `075A`
- account asset routing duplication -> `075B`
- Minibob as fake editor/account identity -> `075C`
- distrust, silent healing, duplicate validation -> `075D`
- localization disproportion in the core session, with editing always one active locale and translation async -> `075E`
- ghost scaffolding / dual boot / dead future abstractions -> `075F`
- AI provisioning and product-variant contamination -> `075G`
- active-widget open/save contract closure -> `075H`
- hosted-editor transport reduction -> `075I`
- compiler/panel contract reduction -> `075J`
- Roma-side product-path reduction -> `075K`
- DevStudio-local host-lane residue after authoring removal -> `075L`

If a future audit item is added under `075`, this map must be updated in the same change.

---

## One-line objective

Reduce the authoring system until it matches the true product shape:
- account opens widget
- user edits widget
- user saves widget
- done

Limits and budgets may exist, but they come only from entitlements/policy.

Everything else must justify itself by deleting complexity, not by adding a new concept.

---

## Product truth

The product truth for the active authoring path is:

1. An account owns widgets.
2. An account owns assets.
3. Roma opens the widget for the current account.
4. Bob edits the widget in memory.
5. Roma saves the authored document back to Tokyo.
6. Entitlements/policy are the only allowed source of limits, caps, budgets, and upsell gates.
7. Publish/live/public runtime are downstream concerns, not excuses to make open/edit/save abstract or multi-headed.
8. `spec.defaults` is widget software truth, not persisted-instance-row schema.
9. If the editor shows a value, that value must come from the actual instance document or from explicit entitlement sanitization.

If a piece of code cannot be explained in that model, it is suspect by default.

---

## Core premise

The current system already contains the correct boring owner chain:
- Roma is the account/product shell
- Bob is the editor
- Tokyo/Tokyo-worker own saved/live truth
- entitlements come from policy

The system is fighting itself because distrust has accumulated as code.
Bob, Roma, and Tokyo each keep re-validating, re-deriving, reapplying, or re-healing the same underlying widget state because no single layer is treated as the clean, boring authority for each concern.

The problem is that the authoring system still carries too much extra machinery around that chain:
- multiple competing editor truths
- multiple meanings of "save"
- full-config normalization and limit evaluation in hot edit paths
- more than one asset interaction mechanism
- more than one transport/protocol shape for one editor session
- widget validation that is partly generic in ambition but still bespoke in reality
- compiler authority that exceeds "compile and harden"
- panel contracts that are too implicit and too hardcoded
- one Bob kernel still carrying multiple product identities
- acquisition-funnel logic still embedded as runtime branching inside the shared editor/product-policy path
- dead speculative scaffolding still present in shared types and boot/transport modes
- panel/runtime behavior that encodes platform theory instead of product simplicity

This audit exists to remove that mismatch.

This audit also rejects fake simplification.

Fake simplification examples:
- swapping one bespoke validator for a generic schema library while keeping the wrong contract semantics
- replacing a deterministic editor mutation contract with vague generic state mutation while losing explicit edit semantics
- moving active product-path orchestration back into Paris
- turning an authoring simplification PRD into a Cloudflare/WAF/platform-infra project
- deleting server-owned authorization or save/publish boundary checks and pretending a client/session snapshot is now the authority

---

## Non-negotiable execution law

### Hard rule 1 — No new layer

No new layer may be introduced.

That means:
- no new service
- no new package
- no new manager
- no new bridge
- no new orchestration layer
- no new framework
- no new schema DSL
- no new metadata plane
- no new generic editor engine
- no new protocol family

Tiny local helpers are allowed only if they immediately delete more complexity than they add and do not create a new reusable concept.

### Hard rule 2 — No invention

Do not solve hypothetical future problems.

Do not build for:
- possible future widgets
- possible future editor hosts
- possible future transport portability
- possible future asset backends
- possible future AI surfaces

Solve only the active product path.

### Hard rule 3 — `spec.defaults` is not persisted schema

Do not validate saved instance rows against the current full widget software defaults as if `spec.defaults` were a database schema.

Allowed:
- using widget truth to derive a narrow persisted-document sanity contract
- using widget truth to compile the editor/runtime contract

Forbidden:
- rejecting Builder open because a historical saved row does not match the current full software default shape
- treating software-default expansion as the definition of persisted-document correctness

### Hard rule 4 — Visible editor values must be real

If the editor shows a value, that value must come from one of two places only:
- the actual instance document
- explicit entitlement sanitization that is visible and owner-correct

Forbidden:
- hidden UI fallback from `compiled.defaults`
- silent panel values that are not actually present in the canonical saved document
- mixing software defaults into the user-visible document state without making that state explicit

### Hard rule 5 — No parallel path

Do not keep old and new paths active in parallel.

If a slice simplifies a path, the old path must be deleted in that same slice unless keeping it is strictly required for current production behavior and the PRD explicitly says so.

### Hard rule 6 — Net reduction, not net growth

Every slice must reduce active-path complexity.

Default rule:
- touched active-path LOC must be net-negative in the same slice

If a slice cannot be net-negative, it must:
- still delete a larger conceptual burden than it adds
- justify the exception explicitly in the execution notes before code lands

### Hard rule 7 — If you start inventing, stop

If implementation starts producing:
- a new abstraction name
- a new "shared generic" layer
- a new transport wrapper
- a new compatibility framework
- a new data model that duplicates an existing one

stop and redesign the change to be simpler inside the existing owner boundary.

### Hard rule 8 — No architecture regression disguised as simplification

Forbidden:
- reopening Paris as a product-path coordinator
- solving a semantic contract bug by adding a second schema-authoring system
- replacing a deterministic editor contract with a generic library migration unless that replacement is provably smaller and preserves the required product semantics
- broadening this work into infra/vendor/platform cleanup because that seems more standard

Simpler does not mean:
- "use a more famous library"
- "move it to another service"
- "wrap it in a cleaner abstraction"

Simpler means:
- fewer active concepts
- fewer active paths
- fewer competing truths
- less code carrying the same product behavior

### Hard rule 9 — Simplification must not weaken server authority

This document simplifies active authoring code.
It does not move server authority into the client.

Required:
- server-owned authorization stays server-owned
- server save/publish boundaries stay authoritative for server actions
- client-side checks may exist as UX helpers only when they do not silently become alternate authority

Forbidden:
- trusting client/session state in place of server authorization
- deleting server-side save/publish checks just to reduce line count
- treating a cached policy snapshot in Bob as permission to remove server-owned enforcement

---

## What this document is and is not

This document is:
- a simplification PRD
- a product-truth restoration PRD
- a delete-and-reduce PRD
- a reliability PRD
- an anti-invention PRD for AI execution

This document is not:
- a new architecture PRD
- a new widget platform PRD
- a new Bob framework PRD
- a new transport abstraction PRD
- a new localization platform PRD
- a new asset platform PRD
- a new AI platform PRD

If a proposed fix needs more framework than the product needs, it is out of contract for this audit.

---

## Normalized diagnosis

These are the active ways the system is fighting itself.

### 1. One widget document is represented as too many competing truths

Active path evidence:
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/useSessionLocalization.ts`

Current shape:
- `instanceData`
- `baseInstanceData`
- `savedBaseInstanceData`
- `previewData`
- locale `baseOps`
- locale `userOps`
- locale `overlayEntries`

Also active today:
- the editor can still surface fallback values from software defaults even when those values are not present in the persisted document

The product does not have that many truths.
The product has one widget document being edited by one user in one editor session.

This is the most important simplification target.

`previewData` is not a product concept.
It is a widget-shaped shadow-state mechanism in the current codebase.
On the active authoring path, that mechanism is presumed wrong by default and should be deleted.
Preview must reflect the same widget the user is editing, not a second hidden widget truth.

### 2. Dirty state and "save" do not currently mean one thing

Current active behavior:
- base-document dirty state
- locale dirty state
- combined unsaved-state behavior derived from both
- base document save
- locale-layer-only save
- post-save translation monitoring
- differing code paths depending on active locale and dirty state

The user-level product says "save widget."
The system currently says "maybe save base document, maybe save locale overrides, maybe start aftermath polling," and that decision depends on more than one dirty concept.

That mismatch is real product-path complexity.

### 3. Asset editing crosses too many mechanisms for one product concern

Active path evidence:
- `roma/lib/account-assets-gateway.ts`
- `bob/lib/session/sessionTransport.ts`
- `dieter/components/shared/hostedAssetBridge.ts`
- `dieter/components/dropdown-upload/dropdown-upload.ts`
- `dieter/components/dropdown-fill/media-controller.ts`
- `bob/components/td-menu-content/useTdMenuBindings.ts`

Today, asset editing uses some combination of:
- same-origin account APIs
- Bob host account commands
- a global hosted asset bridge
- DOM custom events
- parent-window postMessage signals

One product concern should not require that many shapes.

### 4. The account-hosted editor path carries too much protocol machinery

Active path evidence:
- `roma/components/builder-domain.tsx`
- `bob/lib/session/sessionTransport.ts`
- `admin/vite.config.ts`

The product has one account-hosted editor.
The runtime now has one real Roma↔Bob message contract, but DevStudio/build residue still advertises an older shared lifecycle artifact shape.

Some transport is unavoidable.
Transport inflation is not.

### 5. Full-config normalization is still happening in the hot edit path

Active path evidence:
- `bob/lib/session/useSessionEditing.ts`

Current state:
- `applyWidgetNormalizationRules` runs during committed edit ops
- `applyWidgetNormalizationRules` runs during preview ops
- `applyWidgetNormalizationRules` runs during Minibob injected state
- Roma save/open does not share that same normalization contract

Full-config traversal and repair logic should not be the tax paid on every keystroke or preview interaction for the active product path.

Normalization belongs on well-defined boundaries.
The hot edit path should stay as close as possible to "apply explicit user change and update local state."

### 6. Validation, limits, and healing are duplicated across layers

Active path evidence:
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`
- `roma/lib/widget-config-contract.ts`
- `roma/lib/account-instance-direct.ts`

Current state:
- Bob sanitizes at load
- Bob evaluates limits again during edit flows
- Roma validates again on save/open
- the active layers are not asking exactly the same question
- client-side healing can mutate visible state before the user saves again

Client-side guidance is allowed.
Client-side silent healing is not a substitute for boundary truth.

If a saved config is no longer valid under entitlement-owned rules, the system must move toward explicit rejection/repair at the correct boundary rather than hiding the problem by mutating the document on open and letting a later save make the mutation look normal.

### 7. Validation is still narrower than the platform story

Active path evidence:
- `roma/lib/widget-config-contract.ts`

Current state:
- FAQ has real boundary validation
- other widget types currently fall through to no equivalent contract enforcement
- the current FAQ boundary still risks validating historical saved rows against the current full FAQ software shape if the contract is not kept narrow and persisted-document-specific

So the system talks like a generic authoring platform, while the concrete safety net is still mostly FAQ-first and partially bespoke.

That mismatch must be closed without inventing a new schema platform.

### 8. Tiny shared-contract duplication is still a symptom of owner-friction

Active path evidence:
- repeated `isRecord` / plain-object guard copies across `bob`, `roma`, `tokyo-worker`, `sanfrancisco`, and shared packages

This is not the biggest product problem by itself.
It is still a real signal that simple contract code is being re-authored independently because modules do not have a clear, boring shared place to depend on.

Touched work should collapse these copies only by using an already-correct existing shared boundary.
Do not answer this by creating another helper package or another validation layer.

### 9. Panel/runtime behavior still encodes editor theory more than product simplicity

Active path evidence:
- `bob/components/td-menu-content/useTdMenuBindings.ts`
- `bob/components/td-menu-content/showIf.ts`
- `bob/lib/session/useSessionEditing.ts`

Too much of the active editor contract still depends on:
- dynamic DOM hydration
- path-specific branches
- linked-op expansion behavior
- a custom `show-if` expression language

These may remain temporarily where they are the least bad option, but this audit treats them as reduction targets, not as platform assets to expand.

### 10. The compiler still has too much authority over the final authoring contract

Active path evidence:
- `bob/lib/compiler.server.ts`

Current state:
- compiler strips author-declared panel content
- compiler injects major shared panel groups
- compiler rewrites/relabels clusters heuristically

The compiler should compile and harden.
It should not silently become the true authoring-contract author for large parts of the editor surface.

### 11. The panel contract is too implicit for a simple product

Active path evidence:
- `bob/lib/types.ts`
- `bob/components/TdMenu.tsx`
- `bob/components/ToolDrawer.tsx`
- `bob/components/SettingsPanel.tsx`

Current state:
- `PanelId` is effectively unconstrained
- canonical panel order is hardcoded in Bob
- localization is not a fully explicit first-class panel contract and reuses content HTML
- settings are split between widget-defined content and Bob-owned account/context UI

The product can tolerate opinionated panels.
It should not require engineers to reconstruct the panel contract from multiple unrelated files.

### 12. One Bob kernel still carries multiple product identities

Active path evidence:
- `bob/components/ToolDrawer.tsx`
- `bob/components/CopilotPane.tsx`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionPolicy.ts`
- `roma/components/builder-domain.tsx`

Current state:
- one kernel still carries account-mode Builder, Minibob/public, hosted account transport, asset bridge behavior, and AI delegation concerns

That is not one simple widget editor.
That is one editor kernel still acting like a multi-product host.

Minibob in particular is still too present as runtime branching inside the shared editor/product-policy path.
The simplification target is to reduce or delete that branching so acquisition flow does not tax the core editor as a default condition.

### 13. Entitlement sanitization is allowed, but it must remain explicit truth

Active path evidence:
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionEditing.ts`
- `packages/ck-policy/src/limits.ts`
- `tokyo/widgets/faq/limits.json`

The system does perform entitlement-owned load sanitization.
That is acceptable.

What is not acceptable is letting explicit entitlement sanitization blur together with accidental default-fallback or extra hidden document mutation.

It is also not acceptable for touched active paths to silently truncate or reshape visible config on open and then normalize that mutation as if it were ordinary document truth.
Client-side limit evaluation may remain as UX guidance.
Server-side boundaries remain the authority for save/publish acceptance.

### 14. Localization ownership is right, but Bob still carries too much orchestration

Active path evidence:
- `bob/lib/session/useSessionLocalization.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionSaving.ts`

The l10n model is not the architecture problem.
The concentration of coordination logic and repeated overlay reapplication inside the Bob session path is the simplification target.

This should be reduced only by making the active editor path simpler, not by inventing a new localization framework.

### 15. Dead scaffolding still survives in active shared types and modes

Active path evidence:
- `packages/ck-policy/src/ai.ts`
- `packages/ck-policy/src/gate.ts`
- `bob/lib/session/sessionPolicy.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`

Current state still includes things like:
- execution-surface/type members that have no active authoring-path caller
- phantom generic action keys that always allow
- dev-only or secondary boot/messaging shapes that still burden the shared production editor path
- open-request/session bookkeeping that may exceed the reality of one host, one frame, one editor

These are reduction targets when touched.
Do not preserve speculative scaffolding just because it already exists.

### 16. `account-instance-direct.ts` is a real reduction target, but the owner boundary is already correct

Active path evidence:
- `roma/lib/account-instance-direct.ts`

The open/save shape is right:
- Roma reads/writes the product path
- Tokyo/Tokyo-worker own saved/live truth

The issue is not that this logic belongs in Paris.
The issue is that the current Roma-side orchestration can still be made smaller and more legible while keeping the correct owner boundary.

### 17. The `WidgetOp` contract is heavier than the simplest possible editor, but it is still a real product contract

Active path evidence:
- `bob/lib/edit/ops.ts`
- `bob/lib/ops.ts`

The current op system is not just random abstraction.
It is also the explicit deterministic mutation contract used by Bob editing surfaces and AI/copilot flows.

That means:
- the active target is reduction of accidental complexity around the ops contract
- not an automatic rewrite to generic React state mutation

If a smaller replacement is ever proposed, it must preserve explicit deterministic edit semantics and delete more complexity than it adds.

### 18. The validator bug is semantic before it is technological

Active path evidence:
- `roma/lib/widget-config-contract.ts`

The main problem is:
- validating the wrong contract

The main problem is not:
- "this is not Zod"

Do not answer a wrong persisted-document contract by introducing a second schema-authoring system unless that move clearly deletes more total complexity than it adds.

### 19. Request-level rate limiting is not the core authoring simplification problem

Active path evidence:
- `roma/lib/request-ops.ts`

This file may contain future reduction opportunities.
It is not the main reason the authoring system fights itself.

Do not let this work drift into:
- WAF migration work
- vendor/library substitution work
- general infra cleanup

unless a touched authoring-path slice can delete same-boundary code immediately and safely.

---

## Goals

1. Make the active account authoring path legible in one pass.
2. Make "open widget / edit widget / save widget" mean exactly that in code.
3. Keep entitlements as the only allowed source of limits and upsell gates.
4. Reduce competing editor truths and state replicas.
5. Collapse dirty/unsaved state on the active path to one explainable model.
6. Move full-config normalization out of hot edit/preview paths on touched flows and toward explicit load/save boundaries.
7. Reduce transport/protocol complexity around the hosted editor.
8. Reduce asset-path duplication and signaling duplication.
9. Extend document-boundary safety for active widgets without inventing a new schema platform.
10. Reduce compiler authority so compile/harden does not become silent authoring-contract rewriting.
11. Make the panel contract explicit enough that it can be understood without reverse-engineering Bob internals.
12. Keep Bob one editor, not one multi-product kernel.
13. Reduce acquisition-funnel/Minibob branching inside the shared editor core and shared policy path.
14. Delete dead speculative scaffolding when touched instead of carrying it forward.
15. Simplify inside the correct owner boundary rather than moving logic to another service or library by default.
16. Delete code, not move code into a new conceptual box.
17. End silent client-side healing on touched paths so invalid state is rejected or surfaced at the correct boundary instead of being normalized invisibly on open.
18. Leave the system simpler, more reliable, and easier for AI to modify safely.

---

## Non-goals

1. No new editor framework.
2. No new panel framework.
3. No new generic widget-schema language.
4. No new transport system.
5. No new asset abstraction layer.
6. No new localization abstraction layer.
7. No new AI/agent platform work unless it directly reduces active authoring-path complexity.
8. No broad rewrite of all widgets.
9. No speculative portability work.
10. No "temporary compatibility" code without same-slice deletion.
11. No Paris reintroduction for product-path reads/writes.
12. No library-swap execution where the semantics stay wrong and only the implementation looks more standard.
13. No automatic replacement of the `WidgetOp` contract with generic state management unless that move is explicitly proven smaller and still preserves deterministic authoring semantics.
14. No infra/WAF vendor migration work under this simplification track unless it is directly required by a touched authoring simplification slice.

---

## Primary reduction targets

The highest-value reduction targets in this audit are:
- `roma/components/builder-domain.tsx`
- `roma/lib/account-instance-direct.ts`
- `roma/lib/account-assets-gateway.ts`
- `roma/lib/request-ops.ts`
- `roma/lib/widget-config-contract.ts`
- `bob/lib/compiler.server.ts`
- `bob/lib/edit/ops.ts`
- `bob/lib/types.ts`
- `bob/components/TdMenu.tsx`
- `bob/components/ToolDrawer.tsx`
- `bob/components/SettingsPanel.tsx`
- `bob/components/CopilotPane.tsx`
- `bob/lib/session/useSessionLocalization.ts`
- `bob/lib/session/useSessionEditing.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/runtimeConfigMaterializer.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/sessionPolicy.ts`
- `bob/components/td-menu-content/useTdMenuBindings.ts`
- `bob/components/td-menu-content/showIf.ts`
- `packages/ck-policy/src/ai.ts`
- `packages/ck-policy/src/gate.ts`
- `dieter/components/shared/hostedAssetBridge.ts`
- `dieter/components/dropdown-upload/dropdown-upload.ts`
- `dieter/components/dropdown-fill/media-controller.ts`

These are not automatically all in scope for one change.
They are the main places where the code currently carries more machinery than the product needs.

---

## Pre-execution clarifications

The following points are locked before implementation begins.

### Clarification 1 — Normalization owner must be named before hot-path deletion

This audit requires full-config normalization to leave the hot edit path.
That does not mean "delete Bob normalization first and figure out the boundary later."

Before any touched slice removes `applyWidgetNormalizationRules` from edit/preview flows, execution must name the new authoritative normalization boundary for the touched path and prove all three of these stay aligned:
- what Bob shows
- what Roma accepts on save/open
- what runtime/rendered widget state expects

Forbidden:
- a temporary state where normalization is no longer authoritative anywhere
- moving the same normalization pass into another hidden client wrapper and calling that simplification

Default expectation:
- load-time normalization may remain temporarily where it already exists
- save-boundary normalization should become explicit if touched product behavior still requires it

### Clarification 2 — Localization is subordinate, but it is still real product behavior

Slice B should simplify the editor to one explainable save/dirty model.
That does not authorize deleting locale-layer persistence semantics by accident.

Rules:
- localized account-mode editing must keep working for existing localized accounts
- locale persistence may remain temporarily if it is explicitly subordinate to the main authored document model
- any reduction of locale-only save branches must preserve current overlay correctness until a simpler owner-correct replacement exists in the same slice

Forbidden:
- improving single-locale simplicity by silently breaking localized accounts
- collapsing dirty/save state in a way that destroys `userOps` / overlay persistence invariants without replacement

Structural contract for Slice B:
- before Slice B code starts, execution notes must name the primary top-level session fields targeted for deletion or collapse on the touched path
- the initial candidate set is:
  - `savedBaseInstanceData`
  - `previewData`
  - `previewOps`
  - `undoSnapshot`
  - `minibobPersonalizationUsed`
- if execution keeps any of these, it must justify why the field still earns its keep after the touched simplification
- Slice B verification must include a before/after accounting of the touched top-level session fields so simplification is structural, not only rhetorical

### Clarification 3 — Minibob reduction must follow a cutover order

Minibob is a high-blast-radius concern because it touches Bob, Roma, San Francisco, and `ck-policy`.

Execution order for touched Minibob work:
1. Define the surviving boundary for Minibob on the touched path.
2. Remove shared editor/runtime branching that is no longer needed after that boundary is explicit.
3. Remove shared policy and AI branching that only existed to support the old embedded shape.

Forbidden:
- deleting random `policy.profile === 'minibob'` branches opportunistically without a cutover order
- leaving half-removed Minibob behavior distributed across editor, host, and policy code

If Slice E touches Copilot surfaces, deletion is preferred over further splitting.
Do not answer Minibob reduction by creating another shared Copilot shell/core decomposition that preserves the same branches under cleaner file names.

Primary deletion-first candidates when the touched boundary allows it:
- `MinibobCopilotPane`
- `pendingMode: 'signup'`
- `minibobPersonalizationUsed`

### Clarification 4 — Verification must prove the state model, not just the routes

For Slice B, Slice E, Slice F, and Slice G, route-level checks alone are not enough.

Required additional proof on touched paths:
- editor-state transition tests for open -> edit -> save -> discard behavior
- panel-binding tests covering removal of hidden `compiled.defaults` fallback behavior
- regression tests for localized account behavior when locale-related code is touched

Forbidden:
- claiming simplification success with only endpoint-level tests while the editor-state model changes underneath

### Clarification 5 — `show-if` scope must be measured before Slice G starts

`show-if` is not currently a theoretical feature.
Active widget sources do use it.

Before Slice G starts, execution must:
- grep active widget sources for `show-if=` / `data-bob-showif`
- record which active widgets depend on it
- state whether the touched work is a Bob-only reduction or a widget-source migration

Forbidden:
- starting Slice G as if `show-if` were a one-file Bob deletion when active widget definitions still depend on it

### Clarification 6 — ACK/retry deletion needs a failure-mode answer first

Before Slice D removes or reduces ACK/retry behavior in the hosted-editor open flow, execution must answer:
- what concrete race/failure the current ACK/retry path is handling
- whether that failure still exists in the current Roma -> Bob iframe open sequence

Forbidden:
- deleting retry/ACK logic only because it sounds overly abstract without proving Builder open still behaves correctly under current timing/race conditions

### Clarification 7 — Slice B and Slice F are one touched control loop

On any touched widget path, Bob state/save semantics and Roma save/open validation form one control loop.

Execution may stage work across Slice B and Slice F, but it may not treat them as semantically independent cleanup tracks.

Required:
- before hot-path normalization/state-replica deletion lands on a touched path, execution must name the paired authoritative save/open boundary for that same path
- before Roma-side contract tightening lands on a touched path, execution must prove Bob open/edit/save behavior still matches that boundary

Forbidden:
- landing Bob-side simplification that outruns the touched Roma boundary and creates temporary Bob/Roma/runtime divergence
- landing Roma-side contract changes that make Bob’s current edit/open/save behavior wrong until a later slice

Default expectation:
- touched Slice B and Slice F work should land together or as an explicitly ordered pair with proof after each step

### Clarification 8 — Asset and transport reduction target duplicate mechanisms, not every mechanism

Iframe-hosted editing is a real product boundary.
Some mechanics exist because there is a host/editor split, not because the code is automatically wrong.

Required:
- Slice C and Slice D must target duplicated representations of the same concern
- execution must preserve one boring mechanism per concern where the boundary genuinely requires one

Forbidden:
- collapsing distinct hosted-editor concerns into one mega-mechanism just to reduce the mechanism count on paper
- treating "one shape per concern" as "one mechanism total" across upload, asset resolve, command routing, preview, and host lifecycle

### Clarification 9 — Compiler authority must be named before Slice G makes panels more explicit

Before Slice G makes the panel contract more explicit on a touched path, execution must state:
- what compiler still owns on that path
- what Bob still owns on that path

Forbidden:
- making Bob panels more explicit while the compiler still silently injects or rewrites the same touched surface
- creating a dual panel contract where compiler and Bob each describe overlapping truths differently

### Clarification 10 — Slice I requires caller proof, not aesthetic cleanup

Slice I is for dead or speculative residue on touched shared paths.
It is not license for broad cleanup based on taste.

Required:
- any deletion from touched shared policy/AI/types paths must carry direct caller proof or a narrow call-graph note showing why the member is dead on the active product path

Forbidden:
- deleting shared behavior because it looks abstract
- treating active files such as `packages/ck-policy/src/ai.ts` or `packages/ck-policy/src/gate.ts` as cleanup wins without proving the touched members are actually dead or phantom

### Clarification 11 — Slice F must stay narrow and per-widget before it gets generic

Slice F exists to correct wrong persisted-document contract semantics on active widgets.
It does not authorize building a validation platform.

Default expectation:
- on touched active widgets, start with narrow persisted-document sanity checks per widget type using existing widget truth
- only generalize further if the smaller path is impossible and the execution notes prove the generalization deletes more complexity than it adds

Forbidden:
- building a validator generator, schema compiler, or generic validation framework just because more than one active widget needs boundary safety
- turning "derive from current widget truth" into a second authoring system

---

## Execution posture

This document proposes a strict reduction track.

Rules:

1. One vertical slice at a time.
2. Each slice must name one primary owner.
3. Each slice must name what gets deleted or collapsed.
4. Docs update in the same slice as behavior change.
5. No slice may introduce a new named abstraction unless it replaces an old one and the result is clearly simpler.
6. If a slice preserves complexity for safety, it must still reduce shape around that complexity.
7. Any touched user-facing behavior must stay boring and predictable.
8. If a simplification idea cannot be explained without a diagram, it is probably the wrong simplification.
9. If a proposal says "replace it with X library/service" before it says which product-path truths get deleted, it is probably the wrong move.

---

## Execution slices

### Slice A — Product-truth lock

Owner: docs + touched product-path owners

Problem:
- the code still behaves as if the authoring surface is a more abstract platform than the product actually is

Required move:
- write the active product truth explicitly into the touched docs and code comments where ambiguity currently encourages invention
- remove touched wording that implies equal support for multiple product identities when the active path is account-mode widget authoring

Rules:
- no new documentation taxonomy
- no architecture rewrite
- truth only
- keep Slice A timeboxed to touched docs/comments and do not let it become a standalone documentation project

Done means:
- touched docs and touched code both describe the same simple product path

### Slice B — Single boring editor-state and save semantics

Owner: `bob`

Problem:
- one user editing one widget currently flows through too many competing document/state/save semantics

Required move:
- reduce editor-state complexity so the active session clearly has one canonical authored document
- keep secondary data truly secondary
- collapse touched dirty/unsaved semantics toward one explainable model
- make "save" mean one boring thing on the active account path
- if locale-specific persistence remains necessary, it must be explicit and subordinate to the main widget-document model, not an alternative hidden save meaning
- remove hidden editor fallback behavior where panel values are sourced from `compiled.defaults` instead of the actual instance document
- if entitlement sanitization changes visible state, keep that behavior explicit and owner-correct rather than letting it look like normal document truth
- `previewData` and the shadow-preview mechanism around it are deletion targets by default
- preview must reflect the same widget the user is editing, not a second widget-shaped state
- touched client-side limit checks may assist UX, but they must not silently heal/truncate the authored document and then present that mutated state as ordinary saved truth
- move touched full-config normalization out of per-keystroke/per-preview hot paths and into explicit boundaries

Deletion targets:
- branches that make save behavior materially different based on editor mode without explicit product reason
- touched state replicas that no longer need to exist once the main document model is simplified
- touched `previewData`, `setPreviewOps`, `clearPreviewOps`, `bob-preview`, and any equivalent shadow-preview glue that creates a second widget-shaped state
- touched hidden fallback-to-default UI logic
- touched duplicate dirty-state logic that no longer needs to exist once the main document/save model is simplified
- touched full-config normalization calls that run on every edit/preview without being boundary-owned

Rules:
- no new session state layer
- no new document-upgrade framework
- no new save orchestration layer
- no hidden software-default fallback in the active editor UI
- no second widget-shaped preview state on the active account path
- no touched client-load healing that silently rewrites user-visible document state and then makes that rewrite look normal
- no touched hot-path full-config traversal unless it is demonstrably required by the active product behavior
- no localized-account regression caused by collapsing state/save semantics without same-slice replacement proof
- no touched Slice B simplification that lands ahead of its paired authoritative Slice F boundary on the same product path

Done means:
- a new engineer can explain Bob’s active account-mode save behavior in a few sentences
- the code matches that explanation
- the editor does not display non-document values unless they are explicit entitlement-owned sanitization
- touched unsaved-state logic is explainable without describing multiple competing dirty truths
- touched preview behavior no longer relies on a shadow widget state (`previewData` or equivalent)
- touched edit/preview flows are closer to "apply edit and update local state" than to "re-run boundary processing"
- touched localized accounts still persist and reopen locale-layer state correctly if locale behavior remains in scope
- touched top-level session state on the active path is structurally smaller than before, or any narrow exception is explicitly justified against the named candidate deletions

### Slice C — Asset-path collapse

Owner: `roma` account asset boundary + `bob`/`dieter` consumers

Problem:
- one asset interaction currently crosses too many mechanisms

Required move:
- keep Roma as the account asset boundary
- collapse the active authoring asset path to one boring interaction shape per concern
- remove duplicated signaling and duplicated bridging where the same action is currently represented more than once
- keep real hosted-editor boundary mechanics that still earn their keep for distinct concerns

Deletion targets:
- touched duplicate signaling paths
- touched redundant bridge/event glue

Rules:
- no new asset bridge
- no new account asset abstraction
- no new event framework
- no "one mechanism total" simplification that collapses distinct upload, resolve, preview, or entitlement concerns into one blurrier path

Done means:
- upload, resolve, and entitlement denial each have one clear product-path story in the active editor
- touched asset simplification removes duplicated mechanisms for the same concern without deleting necessary hosted-editor mechanics for different concerns

### Slice D — Hosted-editor transport reduction

Owner: `roma` Builder host + `bob` transport

Problem:
- the hosted editor path carries more protocol shape than the product needs

Required move:
- keep the existing owner boundary
- reduce the transport surface to the minimum contract required for account-hosted Bob
- collapse redundant lifecycle and command handling where possible
- preserve distinct hosted-editor mechanics that still correspond to distinct real concerns on the iframe boundary

Deletion targets:
- touched lifecycle/retry/host-command indirection that no longer earns its keep
- touched duplicated route-resolution or message-shaping logic

Rules:
- no new protocol
- no new transport abstraction
- no new command bus
- no touched ACK/retry deletion without a recorded failure-mode answer and proof that Builder open still works under current timing/race conditions
- no "one mechanism total" simplification that removes necessary hosted-editor command routing or lifecycle mechanics just because multiple concerns currently exist

Done means:
- the active hosted-editor transport is boring enough that it reads as plumbing, not as a platform
- touched lifecycle reduction is supported by a concrete explanation of what race/failure was removed or why the current retry/ACK path no longer earns its keep
- touched transport reduction collapses duplicated mechanics, not distinct concerns that the iframe-hosted product path still genuinely requires

### Slice E — Bob kernel de-mixing

Owner: `bob` + `roma` host contract + touched shared policy/gating owners

Problem:
- one Bob kernel still carries more than one product identity and too many runtime concerns

Required move:
- reduce the amount of product identity carried directly inside the shared editor kernel
- keep Bob focused on being the widget editor
- remove or reduce touched account/minibob/copilot/host branching where that branching is making Bob behave like a multi-product container
- reduce touched `minibob` runtime branching in shared editor and shared policy paths so acquisition flow is less of a default tax on the core editor
- when a touched Copilot or Minibob surface can be removed outright, prefer deletion over further shell/core/component decomposition
- when Minibob reduction touches gating or subject resolution, include the touched shared policy/gating surface in the same cutover story rather than treating this as UI-only cleanup

Deletion targets:
- touched multi-product branching that no longer belongs in the shared editor kernel
- touched host/runtime glue that only exists because Bob is still carrying too many product roles
- touched `policy.profile === 'minibob'` or equivalent subject-resolution branches that can be removed by making product boundaries more explicit
- touched `MinibobCopilotPane`, `pendingMode: 'signup'`, and `minibobPersonalizationUsed` branches when the surviving touched boundary makes them unnecessary
- touched shared gating/subject-resolution branches that only exist to preserve the old mixed product shape on the active editor path

Rules:
- no new product-shell layer
- no new Copilot framework
- no new host abstraction
- no new deployment-neutral runtime mode layer to preserve Minibob inside the shared editor core
- no touched Minibob branch deletion without a declared surviving boundary for the touched path
- no extra shared Copilot shell/core split that preserves the same Minibob branches under cleaner file names
- no partial Minibob cleanup that deletes editor/UI branches while leaving the same touched path alive in shared policy, gating, or host code without an explicit surviving boundary

Done means:
- Bob reads more like one editor and less like one editor-plus-multi-product kernel
- touched shared editor code carries less acquisition-funnel logic than before
- touched Minibob reduction is coherent enough that the remaining boundary can be described in one paragraph
- touched Copilot/Minibob work is smaller by deletion, not merely redistributed into more files
- touched Minibob/account reduction is coherent across editor, host, and any touched shared gating surface

### Slice F — Validation closure without invention

Owner: `roma` save/open boundary using existing widget truth

Problem:
- authoring safety is more bespoke than the platform story suggests

Required move:
- extend save/open contract enforcement for active widgets from existing widget truth
- derive from current widget source and current compiler-owned contract where possible
- do not invent a new schema language or new authoring metadata plane
- prefer narrow per-widget persisted-document sanity checks on touched active widgets before any broader generalization is considered
- explicitly stop treating current full widget software defaults as persisted-instance schema
- Builder open must ask a narrow persisted-document sanity question, not "does this row match today’s full software default shape?"
- keep server save/open authority explicit
- if client-side validation or limit evaluation remains on touched paths, it must be helper behavior only and must not silently diverge from what the server will accept
- on touched paths, prefer explicit server-side rejection of invalid/stale document state over client-side healing that mutates the document on load
- execute touched Slice F work as the paired authoritative boundary for touched Slice B work, not as an isolated cleanup track

Deletion targets:
- touched ad hoc validation branches that become unnecessary once enforcement is simpler and owner-correct
- any touched full-default-shape validation logic on Builder open/save that is really software-shape checking instead of persisted-document sanity checking
- touched client-side healing branches that only exist because invalid state is allowed to drift forward invisibly

Rules:
- no new schema framework
- no new validation service
- no new generic metadata model
- no validator generator or schema compiler unless the smaller per-widget path is explicitly proven insufficient and the replacement is still net simpler
- no full-current-default validator used as a saved-row gate
- no library swap justified only by "standard practice" if the persisted-document contract is still wrong
- no client-trust simplification that weakens server-owned save/publish authority
- no deletion of the current normalization pass on a touched path until the replacement authoritative boundary is named and verified
- no touched Slice F cleanup that assumes Bob state/save behavior will be fixed later on the same path

Done means:
- active widgets have owner-correct boundary safety
- the solution is simpler than the current mismatch between "generic platform" and "FAQ-only real guardrails"
- Builder open does not fail merely because a saved row is older or narrower than the current software default shape
- touched save/open flows reject invalid state at the right boundary instead of relying on future client healing to clean it up
- touched normalization behavior is explainable as one explicit boundary contract, not implied editor magic
- touched validation closure reads as direct per-widget boundary logic unless a broader move was explicitly justified as even smaller

### Slice G — Panel/runtime reduction only by deletion

Owner: `bob` + `dieter`

Problem:
- panel behavior still carries too much dynamic/editor-theory machinery

Required move:
- reduce path-specific panel logic where a simpler existing control contract can absorb it
- reduce dynamic runtime logic only where doing so deletes real special cases
- keep compiler and panel runtime in a compile/harden posture, not a silent authoring-contract rewrite posture
- make the panel contract itself more explicit where it is currently split across unconstrained ids, hardcoded menu order, content-panel reuse, and Bob-owned wrapper behavior
- name the surviving compiler-vs-Bob ownership split on the touched panel path before making that path more explicit

Deletion targets:
- touched path-specific branches
- touched linked-op special cases
- touched DOM-binding glue that becomes unnecessary after simplification
- touched implicit panel-contract behavior that can be made explicit by deletion rather than by adding a framework

Rules:
- no new panel engine
- no new DSL
- no "generalized show-if platform"
- compiler may compile and harden, but touched work must not increase silent rewriting of the authoring contract
- no new panel metadata layer
- if active widgets still depend on `show-if`, the touched work must declare whether it is Bob-only reduction or widget-source migration and execute accordingly
- no touched panel explicitness work that creates a second panel contract alongside unchanged compiler-owned rewriting of the same surface

Done means:
- touched panel/runtime code is smaller and more explicit than before
- touched compiler/panel behavior is more source-visible than before, not more magical
- touched panel behavior is easier to explain as a direct product contract
- touched `show-if` reduction is scoped honestly against real active widget callers, not treated as a one-file Bob cleanup when widget-source migration is actually required

### Slice H — Roma-side product-path reduction without owner-boundary regression

Owner: `roma`

Problem:
- some Roma product-path helpers are thicker than they need to be, but the answer is not to move product orchestration into Paris or another service boundary

Required move:
- reduce touched Roma-side product-path orchestration where it is currently harder to read than the product itself
- keep the current owner chain intact
- prefer deletion, inlining, and clearer direct product-path logic over new helper stacks

Deletion targets:
- touched Roma helper indirection that no longer earns its keep on open/save/asset paths
- touched duplicated response/decision logic that can be collapsed without changing owner boundaries

Rules:
- no Paris reintroduction
- no new gateway layer
- no "frontend coordinator to backend coordinator" shuffle disguised as simplification

Done means:
- touched Roma product-path helpers are smaller and more direct
- the product path still reads as Roma -> Tokyo/Tokyo-worker, not as a reopened multi-service handoff

### Slice I — Dead scaffolding deletion on touched shared paths

Owner: touched shared owners (`bob`, `roma`, `packages/ck-policy`, `sanfrancisco`)

Problem:
- active shared types and boot/transport code still carry speculative or residual shapes that are not earning their keep on the real product path

Required move:
- when a touched path contains dead or speculative members, delete them instead of preserving them "just in case"
- reduce touched unused execution-surface members, phantom action keys, dev-only boot shapes, and retry/request bookkeeping that no longer matches the reality of one product path
- if tiny shared contract helpers can be collapsed into an already-correct existing shared package, do that instead of leaving copy-paste guards in place

Deletion targets:
- touched dead enum/type members with no active product-path caller
- touched always-allow phantom action keys that do not encode a real product gate
- touched production-visible dev-only boot branches
- touched duplicate plain-record guards that can be deleted by depending on an existing shared boundary

Rules:
- no new package
- no new utility layer
- no compatibility aliases to preserve deleted speculative types
- do not broaden this into general package cleanup unrelated to the touched authoring path
- do not treat `packages/ck-policy/src/ai.ts` or `packages/ck-policy/src/gate.ts` as blanket-delete targets while they still have active product-path callers; reduce dead members and phantom keys, not live owner-correct behavior
- no touched shared deletion without caller proof on the deleted member/path

Done means:
- touched shared code describes shipped product reality more than speculative future modes
- touched shared types are smaller and less theory-laden than before
- touched shared cleanup is justified by actual caller absence or phantom semantics, not by aesthetic dislike of the abstraction

---

## Verification floor

Verification for follow-on implementation PRDs should stay boring.

Required verification style:
- narrow authoring-path regression tests
- editor-state transition tests on touched high-blast-radius flows
- direct assertions against product-path behavior

Forbidden verification style:
- giant new harness
- fake end-to-end theater
- vendor/platform testing detours

Minimum proof expected for touched slices:
1. open widget still works
2. edit widget still works
3. save widget still works
4. entitlements still gate limits correctly
5. asset flows still work on the active account path
6. malformed widget state is rejected at the right boundary for touched widgets
7. touched Builder open flows do not reject saved rows merely for not matching current full software defaults
8. touched editor panels do not display hidden non-document fallback values
9. touched compiler changes reduce or bound authoring-contract rewriting instead of increasing it
10. touched Bob-kernel changes reduce product-mode mixing instead of relocating it
11. touched simplification work does not reintroduce Paris or a substitute coordinator layer
12. touched validation work fixes contract semantics, not just implementation style
13. touched editor-state work leaves one explainable unsaved-state model instead of competing dirty truths
14. touched client-side limits/sanitization work does not silently truncate visible document state on open
15. touched simplification work does not weaken server-owned authorization or save/publish enforcement
16. touched normalization work removes or reduces hot-path full-config traversal rather than relocating it into another client-side wrapper
17. touched Bob-kernel reduction work decreases Minibob/acquisition branching in shared editor paths
18. touched shared cleanup deletes speculative or dead type/path residue instead of renaming it
19. touched high-blast-radius editor changes include direct tests for open -> edit -> save/discard state transitions
20. touched fallback-removal work includes direct tests proving panels no longer read hidden `compiled.defaults` values as document truth
21. touched localization simplification work includes regressions for localized account behavior if locale code is touched
22. touched Slice B work includes a before/after accounting of the top-level session fields deleted or collapsed on the active path
23. touched hosted-editor transport reduction work includes proof that any removed ACK/retry behavior was not required by the current Builder open race/timing model
24. touched `show-if` reduction work includes proof that active widget callers were counted and that the shipped scope matches that count
25. touched Slice B and Slice F work includes proof that Bob open/edit/save semantics and Roma save/open enforcement stayed aligned on the touched path
26. touched Slice E work includes proof that any Minibob reduction is coherent across editor, host, and any touched shared policy/gating path
27. touched Slice I work includes direct caller proof for deleted shared members or a narrow note proving they were phantom-only
28. touched Slice F work proves contract correction without introducing a validator generator, schema compiler, or second authoring system unless that broader move was explicitly justified as smaller

---

## Success criteria

This simplification track would be complete only if all of the following are true:

1. The active authoring path can be described truthfully as:
   - open widget
   - edit widget
   - save widget
   - done
2. Touched code paths are materially smaller or materially less concept-heavy than before.
3. No new layer was introduced.
4. No new generic abstraction was introduced.
5. No new protocol family was introduced.
6. No old/new parallel authoring path remains active from the touched slices.
7. Entitlements remain the only allowed source of limits and upsell gating.
8. Documentation for touched behavior matches the shipped code.
9. No touched saved-instance gate treats current full widget software defaults as persisted-row schema.
10. No touched editor surface presents hidden fallback values as if they were saved document truth.
11. No touched slice increases silent compiler authority over the authoring contract.
12. No touched slice leaves Bob more multi-product than before.
13. No touched slice reopens Paris or introduces a substitute orchestration service for the active product path.
14. No touched slice replaces semantics with a library swap while leaving the same product-path complexity in place.
15. No touched simplification weakens server-owned authorization or save/publish enforcement.
16. No touched client-side load path silently heals/truncates user-visible widget state and then normalizes that mutation as ordinary document truth.
17. Touched editor-state changes move the active path toward one explainable dirty/unsaved model, not more competing flags.
18. No touched slice keeps full-config normalization in the hot edit path unless that work is explicitly justified as unavoidable product behavior.
19. No touched slice leaves Minibob/acquisition logic more embedded in shared editor or shared policy paths than before.
20. Touched shared cleanup removes dead speculative residue instead of preserving it behind a better-sounding abstraction.
21. High-blast-radius editor-state simplification work ships with direct state-transition proof, not only route-level proof.
22. No touched slice breaks localized account authoring behavior while claiming single-locale simplification.
23. Touched Slice B work shows structural reduction in the active session-state model, not only renamed or redistributed state.
24. No touched Slice D or Slice G work claims simplification without first proving the real caller/failure scope it is deleting.
25. No touched Slice B or Slice F work leaves Bob and Roma describing different authoritative contracts on the same product path.
26. No touched Slice G work creates a dual panel contract between compiler-owned rewriting and Bob-owned explicit panel logic.
27. No touched Slice I work counts aesthetic cleanup as success without caller-proof deletion of real dead or phantom members.
28. No touched Slice F work turns boundary safety for active widgets into a new generic validation platform without proving that move is actually smaller.

---

## Failure conditions

Execution fails this simplification track if any touched slice does one of the following:

1. creates a new layer
2. creates a new reusable abstraction that the product does not need
3. keeps complexity but moves it into a better-sounding box
4. adds a temporary compatibility path without deleting the old one
5. broadens the system’s conceptual surface while claiming simplification
6. solves an active-path problem by preparing for a hypothetical future

If a proposed change triggers one of those conditions, reject it and redesign the slice to be simpler.

---

## Final instruction to AI executors

Do not try to be clever.

Do not try to make the system more general.

Do not try to protect future optionality.

Do not turn a simple product path into a framework.

Make the codebase as simple, reliable, and elegant as the product actually is.
