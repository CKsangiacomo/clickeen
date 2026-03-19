# 075B — Builder Asset Actions Must Follow One Clear Account Path

Status: READY FOR REVIEW
Date: 2026-03-18
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/architecture/CONTEXT.md`

---

## What This PRD Is About

This PRD is about one product promise:

When a customer uses assets in Builder, Clickeen must behave like one account-owned asset system.

That means:

- when the customer uploads an asset, there is one clear upload path
- when the customer chooses an existing asset, there is one clear inventory path
- when Builder resolves an asset for preview/runtime, there is one clear resolve path
- when the customer is denied by plan limits, there is one clear denial path

The customer should not be moving through a maze of bridges, events, and host-only message shapes just to pick an image.

---

## Product Scope

This PRD covers:

- how Builder uploads account assets
- how Builder lists and chooses account assets
- how Builder resolves asset ids into preview/runtime bytes
- how Builder handles asset entitlement denial
- how Roma hosts those asset actions for the active account

This PRD does not cover:

- general hosted-editor transport cleanup outside asset actions
- panel/compiler cleanup
- Minibob cleanup
- save/document-state cleanup from `75A`
- broad Assets panel redesign

---

## Product Truth

For the active Builder product path:

1. Assets belong to the current account.
2. Roma is the current-account asset boundary.
3. Builder uses that account boundary for upload, list, resolve, and denial.
4. Tokyo-worker remains the underlying asset/storage authority downstream.
5. Upload, choose, resolve, and denial are distinct concerns, but each concern gets one clear product-path story.

This is already the canonical asset contract in the repo:

- asset management is intentionally small: upload, list, use, delete
- Roma product routes proxy current-account-safe operations
- Bob owns upload triggers and asset assignment

The problem is not the product contract.
The problem is that Builder currently reaches that contract through too many mechanisms.

---

## 1. Where We Fucked Up / How And Why

We let one simple product concern spread across too many technical shapes.

The customer is trying to do something simple:

- upload a file
- choose a file
- use that file in the widget

But the implementation currently crosses several mechanisms for the same concern.

### A. We split one asset system into several routing mechanisms

Today the Builder asset path uses some combination of:

- same-origin account APIs
- Bob host account commands
- a global hosted asset bridge on `window`
- document dataset wiring
- DOM custom events
- parent-window `postMessage`

That happened because we kept solving the same asset action at different layers instead of naming one product-path owner per concern.

### B. We duplicated the same concern in different files

Examples:

- upload is routed through `assetUpload.ts`, but it can go through a hosted bridge or direct endpoint resolution
- asset resolve is routed through `assetResolve.ts`, but preview/runtime also carries its own resolve path in Bob
- asset list for chooser overlays has its own fetch path in `asset-picker-data.ts`
- the host injects a global bridge in `sessionTransport.ts`, while Dieter consumers independently decide whether to use it

That happened because the implementation optimized for "make this work here" instead of "one clear Builder asset path."

### C. We duplicated denial signaling for the same product event

Asset plan denial currently signals in more than one way:

- local Bob upsell UI events
- host-level `bob:asset-entitlement-denied` messaging to Roma

That happened because denial was handled as both a local editor concern and a navigation concern without choosing one clear product story.

### D. We duplicated resolve logic between Builder subsystems

Preview/runtime asset resolution currently exists in more than one place:

- Dieter asset consumers resolve assets
- Bob session transport resolves assets
- runtime materialization can still fall back through its own hosted bridge or direct API logic

That happened because asset use in the editor was allowed to grow separate lookup paths instead of one Builder resolve story.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

This is not "technical debt" in the abstract.
It directly damages product trust and product speed.

### A. A basic Builder action becomes hard to reason about

If uploading one image can travel through several mechanism families, then:

- failures become hard to diagnose
- permission bugs become boundary bugs
- the Builder host path becomes harder to trust than the product deserves

### B. The asset experience becomes inconsistent

If upload, choose, resolve, and denial each use a different shape depending on where the action started, then Builder stops feeling like one coherent product.

The customer does not think:

- "this upload is using a hosted bridge"
- "this chooser is using same-origin fetch"

They think:

- "I’m using my account assets in Builder"

### C. AI and humans both preserve the mess

When one concern is represented by several mechanisms, every mechanism looks "active."

That means:

- engineers hesitate to delete anything
- AI preserves whatever still has a caller
- the repo becomes harder to simplify safely

### D. Roma becomes harder to evolve

Roma should be the boring current-account asset boundary.

If Builder reaches Roma through bridge logic, command logic, dataset logic, and message logic for the same concern, then Roma is no longer the simple boundary described by the product.

That slows every future asset change.

---

## 3. How We Are Fixing It

We are restoring one clear account asset path for Builder.

### A. Roma remains the only account asset boundary

For Builder asset actions:

- Roma owns the current-account route family
- Bob delegates account asset actions to the Roma host
- Tokyo-worker remains the downstream storage/control authority

Builder does not get its own parallel asset system.

### B. Each asset concern gets one clear Builder story

The product concerns are:

- upload
- list/choose
- resolve for preview/runtime
- entitlement denial

Each one gets one story.

Not one mechanism total.
One mechanism per concern.

### C. Duplicate bridge/event glue gets deleted

If the same concern is represented by more than one of these:

- global hosted bridge
- same-origin direct fetch fallback in a consumer
- duplicate command wrapper
- DOM custom event path
- parent `postMessage` path

then the duplicate path is deleted.

### D. Asset denial gets one product behavior

If the customer is denied because of uploads/storage entitlements, Builder should produce one clear result:

- show the correct denial UX
- route to the correct account asset/upgrade surface if that is the chosen product behavior

It should not signal the same denial through several independent mechanism families.

### E. Asset resolve becomes one Builder-owned flow

If Builder needs asset ids resolved into usable URLs for preview/runtime, that should happen through one clear account asset resolve path.

Builder should not have:

- one resolve path for controls
- another resolve path for runtime materialization
- another hidden hosted-bridge fallback for the same concern

---

## 4. What The System Looks Like Before / After

### Before

- Customer uses one asset system in Builder, but the code routes through several different mechanism families.
- Upload can go through bridge logic or direct endpoint logic depending on environment.
- Asset chooser list and asset resolve have their own consumer-specific fetch rules.
- Asset denial can signal both local editor UX and host navigation separately.
- Builder asset behavior feels more like platform plumbing than a product path.

### After

- Customer uses one account asset system in Builder.
- Upload has one clear Builder path.
- Choose/list has one clear Builder path.
- Resolve has one clear Builder path.
- Denial has one clear Builder path.
- Roma is the boring current-account asset boundary the product says it is.

---

## 5. Files Touched + Toxic LOCs / Workflows / Files Removed

### Files touched

- `roma/lib/account-assets-gateway.ts`
- `roma/components/builder-domain.tsx`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/runtimeConfigMaterializer.ts`
- `dieter/components/shared/hostedAssetBridge.ts`
- `dieter/components/shared/assetUpload.ts`
- `dieter/components/shared/assetResolve.ts`
- `dieter/components/dropdown-fill/asset-picker-data.ts`
- `dieter/components/dropdown-fill/media-controller.ts`
- `dieter/components/dropdown-upload/dropdown-upload.ts`
- `bob/components/td-menu-content/useTdMenuBindings.ts`
- touched current-truth docs for asset behavior if behavior changes

### Toxic LOCs and code shapes to remove or collapse

- `bob/lib/session/sessionTransport.ts`
  - global hosted asset bridge injection on `__CK_CLICKEEN_HOSTED_ACCOUNT_ASSET_BRIDGE__`
  - duplicate asset resolve logic living alongside other Builder asset routing

- `dieter/components/shared/hostedAssetBridge.ts`
  - global bridge lookup as a parallel asset routing mechanism

- `dieter/components/shared/assetUpload.ts`
  - consumer-level choice between hosted bridge and direct endpoint path for the same upload concern

- `dieter/components/shared/assetResolve.ts`
  - consumer-level choice between hosted bridge and direct endpoint path for the same resolve concern

- `bob/lib/session/runtimeConfigMaterializer.ts`
  - separate asset resolve fallback logic for preview/runtime materialization
  - toxic because it duplicates resolve concern already present elsewhere on the Builder path

- `dieter/components/dropdown-fill/asset-picker-data.ts`
  - chooser-specific list path selection logic
  - toxic because list/choose becomes another consumer-owned asset route family

- `dieter/components/dropdown-fill/media-controller.ts`
  - asset denial signaling through both `bob-upsell` and `window.parent.postMessage`

- `dieter/components/dropdown-upload/dropdown-upload.ts`
  - asset denial signaling through both `bob-upsell` and `window.parent.postMessage`

- `roma/components/builder-domain.tsx`
  - asset command routing and asset denial routing that survive without a clear one-path-per-concern explanation

### Toxic workflows to remove

- one Builder asset action crossing bridge, dataset, command, and direct-fetch logic
- chooser/list behavior owning its own route story
- resolve behavior duplicated between editor controls and runtime materialization
- one entitlement denial producing more than one parallel signal path
- asset consumers deciding their own transport shape instead of following one Builder asset path

### Files removed from the system

None are locked upfront.

75B is a duplicate-mechanism deletion PRD first.

If a touched file becomes dead after the collapse, delete it in the same slice.
But 75B does not invent file deletion just to create churn.

---

## Done Means

75B is done only when all of the following are true:

1. A human can explain Builder asset behavior in a few sentences.
2. Upload has one clear account path.
3. Choose/list has one clear account path.
4. Resolve has one clear account path.
5. Entitlement denial has one clear account path.
6. Roma reads like the boring current-account asset boundary described by the product.
7. Duplicate bridge/event/message glue for the same concern is materially smaller or gone.

