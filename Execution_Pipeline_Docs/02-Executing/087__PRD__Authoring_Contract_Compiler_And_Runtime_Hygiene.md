# PRD 087 - AI-Native Widget Authoring Contract, Compiler, And Runtime Hygiene

Status: PRE-EXECUTION FIRST DRAFT  
Source review: `Execution_Pipeline_Docs/01-Planning/Clickeen_codebase_review.md`  
Owner: Clickeen product architecture  
Last updated: 2026-05-08

## 1. Purpose

This PRD turns the codebase review into a product-first cleanup plan for the real Clickeen authoring path:

1. Account opens a widget in Roma.
2. Bob edits one widget in one active locale.
3. Roma saves the widget to Tokyo.
4. Tokyo serves the saved widget and assets.

The goal is not to refactor large files because they are large. The goal is to make the Clickeen widget system work as an AI-native product:

1. It must be easy and reliable for an AI builder to create a new widget.
2. It must be easy and safe for an AI Copilot to edit one saved widget instance inside Bob.
3. It must scale cleanly to hundreds of widgets without special-case compiler patches or hidden runtime behavior.

Any improvement in this PRD exists only because it moves Clickeen toward those three product outcomes.

Important correction from peer review: the current product problem is not simply "Bob scrapes `widget.html`." In current widgets, `widget.html` is already mostly the runtime template. The editor contract often lives inside `spec.json` as an HTML-like `"html"` array containing `<bob-panel>`, `<tooldrawer-cluster>`, and `<tooldrawer-field>` strings. The real problem is:

> Bob parses an HTML-like editor DSL from widget contract files. We want that contract to become structured, explicit data.

This is a first draft. Every uncertain area is marked as `OPEN`. No implementation should begin until the relevant open areas for that slice are resolved.

## 2. Product Model This PRD Must Preserve

### 2.1 `widget.html` stays

`widget.html` is still required. Some widgets need different markup, scripts, DOM shape, and runtime behavior. That belongs in `widget.html`.

The intended split is simple:

| File | Surviving role |
|---|---|
| `widget.html` | Runtime widget template: markup, scripts, runtime DOM structure, widget-specific behavior |
| `spec.json` | Builder contract: editable fields, defaults, controls, allowed settings, limits, normalization rules |

Bob should not need to discover product truth by parsing HTML-like editor DSL strings. Bob should read the explicit Builder contract and apply it to the runtime template.

OPEN: exact boundary between runtime template, current `spec.json.html` editor DSL, and future structured Builder contract must be mapped before changing compiler behavior.

### 2.2 Current Widget File Roles

The target widget folder remains intentionally simple:

```text
tokyo/product/widgets/{widgetname}/
├── spec.json          Builder contract, defaults, normalization, structured editable controls
├── widget.html        Runtime DOM template and script/style links
├── widget.css         Widget styling
├── widget.client.js   Widget-specific runtime behavior
├── agent.md           Copilot editing guidance and path semantics
├── limits.json        Plan limits for this widget
├── localization.json  Translatable path allowlist
└── layers/*.allowlist.json Future layer/overlay contracts where explicitly supported
```

The intended division:

| File | Product responsibility | AI-builder responsibility |
|---|---|---|
| `spec.json` | Defines saved config shape, defaults, editable fields, control metadata, normalization | Add/edit structured fields, panels, paths, defaults, and validation rules |
| `widget.html` | Defines runtime skeleton, DOM roles, script/style links | Add widget-specific markup and scripts without encoding Builder controls |
| `widget.css` | Defines widget presentation using Dieter/token-compatible styling | Style the runtime surface, not the Builder control UI |
| `widget.client.js` | Applies saved config to DOM and handles runtime interactions | Implement widget behavior and fail visibly on invalid state |
| `agent.md` | Explains safe Copilot edits and widget-specific path meaning | Give AI Copilot accurate edit rules |
| `limits.json` | Declares widget-specific product limits | Keep plan enforcement explicit and reviewable |
| `localization.json` | Declares translatable paths | Keep translation async and path-bounded |

OPEN: confirm whether every current and future widget must have all files, or whether some files are optional with explicit fail-fast rules.

### 2.3 Dieter is not automatically refactored

Dieter components are not refactored just because they are large.

Before any Dieter component changes, we must prove:

1. What product workflow the component supports.
2. Which behavior is a real shared UI primitive.
3. Which behavior is widget/editor-specific work hiding inside Dieter.
4. What the new component split would be.
5. What visual and functional verification proves the split did not break Builder.

OPEN: Dieter decomposition is investigation-only in this draft. No Dieter implementation slice is approved yet.

Hard rule: this PRD does not authorize Dieter implementation changes. Any Dieter code change requires a follow-up PRD or a separately approved execution slice after the investigation proves the product reason.

## 3. Core Product Intent

This PRD is core product architecture, not cosmetic cleanup.

### 3.1 AI builders must be able to create widgets

A Clickeen widget should be buildable by an AI agent without reverse-engineering compiler quirks.

The AI-builder path should be:

1. Create a widget folder.
2. Define default saved config in `spec.json.defaults`.
3. Define editable controls as structured data in `spec.json.editor`.
4. Define runtime DOM/scripts in `widget.html`.
5. Define behavior in `widget.client.js`.
6. Define safe Copilot semantics in `agent.md`.
7. Define translatable paths and limits in contract files.
8. Run validation.
9. Open the widget in Builder.

Current blocker:

- The editable contract is partly encoded as HTML-like strings in `spec.json.html`. This is hostile to AI code generation because JSON contains HTML strings containing escaped JSON/templates.

Target:

- AI agents edit structured JSON objects, not escaped DSL strings.

### 3.2 Copilot must edit instances safely

Bob Copilot edits the same product surface the user can edit manually.

The intended Copilot edit contract:

```text
compiled editable controls
        +
current instance config
        +
agent.md widget semantics
        ↓
Copilot proposes ops
        ↓
Bob validates ops against compiled controls and limits
        ↓
Only valid ops mutate the in-memory instance
        ↓
Roma saves to Tokyo
```

Copilot must not:

1. Edit paths that are not in the compiled editable contract.
2. Invent config branches.
3. Heal malformed widget state.
4. Treat preview/l10n/overlays as second widget truth.
5. Bypass the same limits and control semantics manual editing uses.

Target:

- `compiled.controls` must be generated from structured `spec.json.editor` fields, not reverse-derived from HTML-like markup.

### 3.3 The system must scale to hundreds of widgets

At 200 widgets, the system must stay boring:

1. Adding a widget means adding a widget folder and passing validation.
2. The compiler should not need one-off widget hacks.
3. Editor controls should be structured and machine-readable.
4. Runtime template behavior should stay in widget runtime files.
5. Shared runtime should be explicit and version-safe.
6. Dieter controls should remain reusable primitives.
7. Malformed contracts should fail at compile/open time, not produce partial Builder UI.

The desired operational loop:

```text
Add widget folder
  → validate widget contract
  → compile Builder controls
  → open in Roma/Bob
  → edit manually or by Copilot
  → save to Tokyo
  → publish/runtime serves same saved intent
```

This PRD should remove anything that makes that loop rely on hidden guesses.

## 4. Review Findings We Keep

The review correctly identifies these risks:

1. The Bob compiler still has too much responsibility and still parses authoring structure from HTML-like editor DSL strings.
2. Live theme dependency in the compiler is risky. Builder compile should not silently depend on remote Tokyo truth.
3. `tokyo/product/widgets/shared/typography.js` is large enough to require a shared-runtime contract review.
4. `tokyo/product/widgets/_fragments` is an empty product-folder residue and should be deleted or documented.
5. Some large files deserve conformance review, especially `roma/lib/account-instance-direct.ts`.

## 5. Review Findings We Must Correct Before Execution

The source review has stale or overbroad claims:

1. `packages/ck-policy/src/gate.ts` is not a pure always-allow stub anymore. It denies viewer-role mutations and is used by Berlin projection routes. It is still too generic-sounding for what it does.
2. "Refactor Dieter components" is not execution-ready. It requires product behavior mapping first.
3. "Move AI grant minting into ck-policy" is too broad. `ck-policy` should own pure policy truth. Runtime signing and account-session boundary work should not be moved into a pure policy package without a separate decision.
4. Berlin auth expansion is out of scope for this PRD.
5. Shared runtime is not inherently wrong. The problem is unclear, unversioned, oversized shared behavior.

## 6. Tenets For This PRD

1. Product truth before file topology.
2. No fake generic platform layers.
3. No compiler guessing when a structured contract can state the truth.
4. No silent fallback when authoring input is malformed.
5. No Dieter rewrite without a proven product reason.
6. No runtime-template deletion. `widget.html` is real and remains real.
7. No broad rewrite of Roma, Bob, Tokyo, or Dieter in one pass.
8. AI builder ergonomics are product requirements, not developer convenience.
9. Copilot edit safety comes from the same compiled contract as manual editing.
10. The system must be understandable from widget files without reading compiler internals.

## 7. Expected Product Functionality

After any approved execution slice, the real product must still behave like this:

1. A user opens an account-owned widget in Roma Builder.
2. Bob loads the same widget document and shows the same expected controls.
3. The user edits one widget in one active locale.
4. Saving preserves the same instance config shape unless a slice explicitly changes that shape.
5. Roma saves through the same single account widget path to Tokyo.
6. Published/runtime embed output remains unchanged unless a slice explicitly changes runtime behavior.
7. Asset, image, background, and fill controls continue to resolve account-owned assets correctly.
8. A malformed widget authoring contract fails with a named Bob compiler error instead of producing a half-rendered editor.

Reference widgets for verification:

1. FAQ: primary reference widget for the first executable slice.
2. Countdown: secondary check for non-FAQ structure.
3. Logo showcase: secondary check for richer layout/content structure.

OPEN: exact browser verification steps for Builder open, edit, save, refresh, and runtime preview must be written before execution.

## 8. Target Contract Model

### 8.1 Structured Builder contract

Target direction:

```json
{
  "editor": {
    "panels": [
      {
        "id": "appearance",
        "label": "Appearance",
        "clusters": [
          {
            "id": "stage-pod",
            "label": "Stage/Pod",
            "showIf": "stage.enabled == true",
            "fields": [
              {
                "id": "stage-background",
                "type": "dropdown-fill",
                "path": "stage.background",
                "label": "Stage background",
                "fillModes": ["color", "gradient", "image", "video"]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

This is not final schema. It is the product shape we want:

1. Panels are data.
2. Clusters are data.
3. Fields are data.
4. Paths are explicit.
5. Labels and localization keys are explicit.
6. Allowed control options are explicit.
7. `showIf` stays visible and testable.
8. Nested/repeater controls are data, not escaped templates.

OPEN: final schema for repeaters, object managers, nested items, rich text, and list operations.

OPEN: final `showIf` expression syntax and validation. Recommendation: keep existing simple expressions only if they can be validated fail-fast.

OPEN: final localization-key shape for labels and item names.

### 8.2 Compiled output Bob needs

Bob needs two outputs:

1. Rendered ToolDrawer UI.
2. `compiled.controls`, the machine-readable edit allowlist used by manual editing and Copilot.

The structured contract should compile into:

```json
{
  "panels": [
    {
      "id": "appearance",
      "label": "Appearance",
      "html": "<rendered Dieter controls>"
    }
  ],
  "controls": [
    {
      "path": "stage.background",
      "type": "dropdown-fill",
      "label": "Stage background",
      "groupId": "stage-pod",
      "groupLabel": "Stage/Pod",
      "options": [],
      "constraints": {
        "fillModes": ["color", "gradient", "image", "video"]
      }
    }
  ]
}
```

OPEN: exact `compiled.controls` shape needed by manual editing, linked ops, and Copilot.

### 8.3 Runtime output must not change by accident

`widget.html`, `widget.css`, shared runtime scripts, and `widget.client.js` continue to render saved config.

The first structured-contract slice should not change runtime embeds.

OPEN: exact runtime parity check for FAQ after the first slice.

## 9. Proposed Slices

### Slice 0 - Evidence Refresh And Scope Lock

Intent: verify current code state before writing execution tasks.

Required checks:

1. List all widgets and classify which files they use: `spec.json`, `widget.html`, widget JS, shared runtime imports.
2. Map current Bob compiler reads: which truth comes from structured `spec.json` fields, which truth comes from `spec.json.html` editor DSL strings, which truth comes from `widget.html`, which truth comes from Tokyo fetches, which truth comes from Dieter stencils.
3. Map current Dieter large-component behavior without changing it.
4. Map `ck-policy/gate.ts` callers and decide whether the surviving concept is "role action check" or "policy gate".
5. Confirm FAQ as the first reference widget or name a better one.
6. Map what Copilot currently receives from `compiled.controls`.
7. Map what AI builders currently need to write manually to create a widget.

OPEN: choose whether this evidence lives in this PRD, a separate audit appendix, or an execution report.

Green condition:

- We have a current table of authoring truth sources by widget and by compiler stage.
- We can explain the minimum files/fields an AI builder must write for one new widget.
- We can explain the exact contract Copilot uses to edit an instance.

### Slice 1 - Authoring Contract Boundary

Intent: make the Builder contract explicit.

Target architecture:

1. `spec.json` owns the editable contract.
2. `widget.html` owns runtime markup and widget-specific scripts.
3. Bob reads structured authoring truth instead of deriving it from HTML-like editor DSL strings.

Non-goal:

- Do not remove `widget.html`.
- Do not make all widgets generic.
- Do not move widget runtime behavior into `spec.json`.

OPEN: final structured control shape in `spec.json`.

OPEN: exact schema fields that should move from the current `spec.json.html` editor DSL into structured JSON.

OPEN: whether existing tooldrawer tags remain as transitional markup or are deleted immediately after structured coverage exists.

Recommendation for pre-GA: hard cut after one widget proves the structured contract works. Avoid carrying both systems longer than needed.

OPEN: widget-by-widget migration order. FAQ is the recommended first executable target, but this must be confirmed by Slice 0.

Blast radius:

- Bob compiler.
- Widget product files under `tokyo/product/widgets/*`.
- Possibly Dieter stencil rendering if editor controls are currently discovered through tags.

Green condition:

- FAQ has an explicit Builder contract with no hidden editor-control discovery from HTML-like DSL strings.
- Compiler fails visibly if required authoring contract fields are missing.
- Builder open/edit/save still works for FAQ.
- Countdown and logo showcase either remain supported through clearly temporary legacy mode or are migrated in the same hard-cut slice.
- `compiled.controls` for FAQ is generated from structured fields and is still sufficient for manual editing and Copilot.
- AI builder instructions for creating FAQ-like widgets become shorter and less error-prone.

### Slice 2 - Bob Compiler Strictness

Intent: remove soft guessing from the compiler without changing widget runtime behavior.

Candidate targets:

1. Replace fragile regex/line parsing with contract-first lookup where possible.
2. Fail the compile when malformed authoring markup is encountered.
3. Remove silent panel/control drops.
4. Keep widget output behavior unchanged.

OPEN: parser choice. Options include a short transitional structured parser or eliminating parsing through structured `spec.json` first.

Recommendation: do not build a better long-term parser for a DSL we intend to delete. Use parser work only as a transitional hardening step if needed.

OPEN: exact malformed-input behavior. Recommendation: named compiler error with widget name, file, and failed contract section.

OPEN: whether this slice can be done before Slice 1 or must follow Slice 1.

Recommendation: Slice 2 should follow the first structured-contract slice. Strictness should enforce the new contract, not polish the old DSL.

Blast radius:

- `bob/lib/compiler.server.ts`
- `bob/lib/compiler/*`
- Bob build and Builder open flow.

Green condition:

- Existing widgets compile.
- Malformed authoring contract fails visibly in tests.
- No fallback path creates a panel-less or control-less editor.
- Compiler errors identify widget name, contract section, and invalid field where possible.
- Compiler does not silently skip unknown field types, unknown paths, or malformed nested controls.

### Slice 3 - Theme Truth And Compiler Remote Dependency

Intent: remove or harden compiler dependency on live Tokyo theme fetches.

Problem:

Builder compile should not silently depend on remote theme availability for product truth.

OPEN: surviving authority for theme registry. Options:

1. Local package/file checked into repo.
2. Tokyo-generated artifact copied into repo during build.
3. Remote fetch allowed only with fail-fast behavior and pinned cache key.

Recommendation:

- Prefer local, explicit, versioned theme registry for Builder compile.

Blast radius:

- Bob compiler.
- Tokyo theme artifact publication if we choose generated artifact.
- Build/deploy order.

Green condition:

- Compiler theme truth is deterministic.
- Theme registry missing or malformed fails visibly.
- No soft `null` theme registry fallback remains in product compile path.
- Theme controls remain available to Builder and Copilot only when backed by deterministic theme truth.

### Slice 4 - Policy Gate Naming And Boundary Cleanup

Intent: remove misleading policy terminology.

Current state:

`packages/ck-policy/src/gate.ts` performs a narrow role check for `instance.create` and `instance.update`. Berlin projection routes call it.

Problem:

The name `gate` implies a full policy enforcement layer. The real enforcement lives in explicit entitlement/limit helpers and product routes.

OPEN: choose final shape:

1. Rename to an explicit role/action helper.
2. Delete and inline the two Berlin checks.
3. Make it a real top-level policy gate that delegates to limits and role checks.

Recommendation:

- Do not create a generic policy engine. Use explicit role/action helper or inline checks.

Blast radius:

- `packages/ck-policy/src/gate.ts`
- `packages/ck-policy/src/index.ts`
- Berlin projection routes.

Green condition:

- No misleading `gate.ts` abstraction remains.
- Berlin still denies viewer mutation.
- Entitlement/limit enforcement remains owned by explicit limit helpers and route boundaries.

### Slice 5 - Shared Widget Runtime Contract

Intent: make shared runtime behavior explicit and safe to evolve.

Problem:

Shared runtime files are legitimate, but large unversioned shared behavior can become hidden widget truth.

First target:

- `tokyo/product/widgets/shared/typography.js`

OPEN: decide whether shared runtime gets a version pinned per widget.

OPEN: decide whether `runtimeVersion` belongs in each widget `spec.json`, another manifest, or Tokyo product metadata.

OPEN: decide which typography behavior is shared runtime vs widget-specific editable contract.

Recommendation:

- Keep shared runtime, but make its contract explicit and versioned before trimming.
- Do not move runtime behavior into `spec.json`; move only editable contract metadata into `spec.json`.

Blast radius:

- All widgets that import shared runtime.
- Published embeds if runtime URLs change.
- Tokyo asset/runtime serving.

Green condition:

- Shared runtime contract is named.
- Breaking shared runtime changes cannot silently alter old widgets.
- Typography behavior that belongs to the editable contract is not hidden only in runtime JS.
- Shared runtime remains understandable to an AI builder creating a new widget.

### Slice 6 - Dieter Large Component Investigation

Intent: understand whether large Dieter files are carrying product behavior that belongs elsewhere.

Components to inspect:

1. `dropdown-fill`
2. `dropdown-upload`
3. `textedit`

No implementation is approved in this slice.

This is not a refactor slice. It is an evidence slice only.

Required output before any refactor:

1. Responsibility map for each component.
2. Product workflows using each component.
3. Internal sub-parts that might be true primitives.
4. State ownership map: Bob, Dieter, widget spec, widget runtime, Tokyo assets.
5. Verification plan: visual, behavior, accessibility, mobile/desktop.
6. Whether the component's current complexity blocks AI widget creation or Copilot-safe edits.

OPEN: whether these components should be split at all.

OPEN: whether any split should happen in Dieter or in Bob/widget-specific controls.

Blast radius if later approved:

- Dieter components.
- Bob controls.
- Asset/background editing flows.
- Potentially Roma Builder screenshots.

Green condition:

- We can explain exactly why a component split is needed before touching Dieter.
- If no strong product reason is found, Dieter remains unchanged.

### Slice 7 - Roma Direct Instance Boundary Audit

Intent: confirm Roma remains a boring account shell and Builder host.

File to inspect:

- `roma/lib/account-instance-direct.ts`

Current understanding:

This file appears aligned with the real product path: Roma opens/saves account widget documents through Tokyo. Size alone is not proof of toxic behavior.

OPEN: identify whether the file mixes route error mapping, Tokyo client calls, normalization, and product logic in a way that should be split.

OPEN: decide whether any split is readability-only or product-boundary enforcing.

Non-goal:

- Do not move widget truth to Berlin.
- Do not create a second instance authority.

Blast radius:

- Roma account instance API routes.
- Builder open/save path.
- Tokyo product-control calls.

Green condition:

- The file either stays with documented reason, or is split into clearer modules without behavior drift.

## 10. Blast Radius Table

| Slice | Product surface | Code vectors | Blast radius | Execution readiness |
|---|---|---|---|---|
| Slice 0 evidence refresh | None directly | Widget files, Bob compiler, Dieter, policy gate, Roma boundary | Read-only | Ready |
| Slice 1 authoring contract | Builder controls for first widget | `tokyo/product/widgets/*/spec.json`, Bob compiler | High for selected widget, medium for compiler | OPEN |
| Slice 2 compiler strictness | Builder open/compile failures | `bob/lib/compiler.server.ts`, `bob/lib/compiler/*` | Medium-high | OPEN |
| Slice 3 theme truth | Builder theme controls | Bob compiler, theme artifact source | Medium | OPEN |
| Slice 4 policy gate cleanup | Berlin projection mutation guard | `ck-policy`, Berlin projection routes | Low | Near-ready after final decision |
| Slice 5 shared runtime contract | Runtime embeds for all widgets | `tokyo/product/widgets/shared/*`, widget specs/manifests | High | OPEN |
| Slice 6 Dieter investigation | None directly | Dieter components and Bob control usage | Read-only | Ready |
| Slice 7 Roma boundary audit | Builder open/save path | Roma instance direct path and routes | Medium if code changes, low if audit only | OPEN |

## 11. Explicit Non-Goals

1. No Berlin auth provider expansion.
2. No Dieter implementation changes in this PRD draft.
3. No deletion of `widget.html`.
4. No generic policy engine.
5. No new authoring surface.
6. No changes to Prague, Venice, or San Francisco unless a concrete dependency is discovered.
7. No runtime behavior change hidden behind "cleanup".
8. No long-lived dual authoring contract system unless explicitly approved.

## 12. Verification Requirements

No slice can be closed without:

1. Typecheck for touched workspaces.
2. Lint for touched workspaces.
3. Build or targeted compile for touched Builder/widget path.
4. At least one real Builder open/save verification for a representative widget.
5. Before/after explanation of deleted legacy behavior.
6. Explicit list of files deleted, LOC removed, and surviving authority for each deleted concept.

OPEN: exact automated test coverage needed for compiler malformed-contract failures.

OPEN: exact browser/screenshot workflow for Dieter and Builder checks if Dieter changes are later approved.

OPEN: exact FAQ Builder open/edit/save verification steps.

## 13. Initial File Targets

Investigation targets:

- `bob/lib/compiler.server.ts`
- `bob/lib/compiler/*`
- `tokyo/product/widgets/*/spec.json`
- `tokyo/product/widgets/*/widget.html`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/_fragments`
- `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.js`
- `tokyo/product/dieter/components/dropdown-upload/dropdown-upload.js`
- `tokyo/product/dieter/components/textedit/textedit.js`
- `packages/ck-policy/src/gate.ts`
- `berlin/src/projection/routes.ts`
- `roma/lib/account-instance-direct.ts`

OPEN: final execution file list depends on Slice 0 evidence refresh.

## 14. First-Draft Recommendation

The PRD should execute in this order after open areas are resolved:

1. Slice 0 - evidence refresh.
2. Slice 4 - misleading `gate` cleanup, because it is small and low risk.
3. Delete or document `_fragments`, because it is obvious residue.
4. Slice 1 for FAQ only after the structured contract shape is decided.
5. Slice 2 compiler strictness only after the first structured contract works.
6. Slice 3 theme truth cleanup.
7. Slice 5 shared runtime contract.
8. Slice 6 Dieter investigation only. Dieter implementation requires a follow-up PRD or approved execution slice.
9. Slice 7 Roma audit only if evidence shows mixed responsibility.

This keeps the work product-first. We remove obvious residue, then fix the authoring contract, then harden the compiler, and only then consider lower-level component or runtime changes.
