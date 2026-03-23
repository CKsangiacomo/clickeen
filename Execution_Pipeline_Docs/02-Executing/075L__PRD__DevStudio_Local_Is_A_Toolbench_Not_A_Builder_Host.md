# 075L — DevStudio Local Is A Toolbench, Not A Builder Host

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/devstudio.md`
- `documentation/services/bob.md`
- `documentation/README.md`

---

## What This PRD Is About

This PRD is about one product and system promise:

DevStudio local is an internal toolbench.
It is not a second host for real widget authoring.

If someone needs the real Builder product path, the host is Roma.

This matters even in local development.

We are removing the product and codebase choices that existed only to keep the old DevStudio-hosted local Bob authoring lane alive.

---

## Product Scope

This PRD covers:

- what local DevStudio is allowed to be
- what local DevStudio is not allowed to be
- Bob boot and host assumptions that only existed to support local DevStudio authoring
- local trust/auth assumptions created only for the removed DevStudio authoring lane
- local scripts and verification that still treat DevStudio like a Builder host

This PRD does not cover:

- real Roma-hosted Builder transport cleanup from `75I`
- Minibob cleanup from `75C`
- asset-path cleanup from `75B`
- legitimate DevStudio toolbench pages, Dieter previews, or internal verification pages that do not host authoring

---

## Product Truth

For local development:

1. DevStudio is an internal toolbench.
2. Bob is the editor runtime.
3. Roma is the real Builder host for product authoring.
4. Local Bob/Tokyo/Berlin may run for debugging and development.
5. DevStudio does not become a second authoring host, second account shell, or fake local customer session.
6. Local scripts may prepare internal verification data, but they must not recreate a hidden DevStudio authoring product.

There is no supported local DevStudio widget-authoring lane.

---

## 1. Where We Fucked Up / How And Why

We removed the DevStudio local authoring lane in product truth, but we left too much of its system design alive.

### A. We let DevStudio behave like a second Builder host

The real product has one authoring host story:

- Roma hosts Builder
- Bob edits

But the local system kept supporting a second story where DevStudio could act like a Bob host or a near-host.

That happened because local authoring convenience was allowed to shape the editor instead of the editor shaping local tooling.

### B. We preserved Bob self-boot and hostless launch paths

Bob still carries URL/self-boot machinery and boot-mode branching that only make sense if Bob sometimes launches outside the real Roma host flow.

That happened because local DevStudio needed Bob to stand up as if it were a first-class host lane.

The real product does not need that ambiguity.

### C. We normalized fake local trust instead of real product boundaries

The local lane explicitly treated DevStudio and Bob as tool-trusted and skipped real local persona/bootstrap expectations.

That happened because the removed local authoring lane needed to work without the real product shell.

This is not harmless dev convenience.
It teaches the codebase that local authoring can have a different authority model than the product.

### D. We duplicated product instance/localization verification around DevStudio

Local scripts and verification still expect DevStudio instance routes, localization routes, and host-lane behavior even though DevStudio is no longer supposed to host widget editing.

That happened because the verification stack was built around the old lane and never fully collapsed after the product decision changed.

### E. We bent local platform seeding around the dead lane

Some local seeding and Tokyo snapshot materialization still describe themselves in terms of DevStudio-visible platform rows and the old host lane.

That happened because the system was preparing local data to make DevStudio-hosted editing feel real.

Once the lane was removed, that rationale became residue.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

This is toxic because it teaches the repo the wrong product.

### A. The codebase thinks there are two legitimate Builder hosts

If DevStudio local can still shape Bob startup and verification like a host, then the product no longer has one boring answer to:

- who opens the editor?

That confusion leaks into transport, boot, docs, and future implementation decisions.

### B. Local tooling starts dictating product architecture

The moment local convenience becomes a reason to keep alternate boot modes, fake trust, or duplicate host routes, the product path gets polluted by owner-machine residue.

That is upside down.

### C. Fake trust models make auth and ownership harder to reason about

If local DevStudio/Bob can act as tool-trusted stand-ins for removed product behavior, the system starts carrying two authority stories:

- real account/product authority
- fake local tool authority

That makes future cleanup slower and makes AI preserve the wrong branches.

### D. Docs say the lane is gone while scripts still preserve it

That is documentation drift in system form.

The product says:

- DevStudio is a toolbench

But the local runtime still carries behavior and verification built for:

- DevStudio as Builder-adjacent host

That contradiction makes the repo harder to trust.

### E. Every leftover reference becomes preservation pressure

As long as boot modes, verification scripts, route expectations, and trust assumptions still mention or depend on the old lane, every future AI and every future engineer will hesitate to delete them.

That is how dead product lanes stay undead.

---

## 3. How We Are Fixing It

We are making local development obey the same product boundary as the product itself.

### A. DevStudio becomes explicitly toolbench-only

DevStudio local may:

- host internal tools
- host Dieter previews
- support curation and verification

DevStudio local may not:

- host Builder authoring
- act like a second Bob host
- expose local product-like instance/localization routes for the removed authoring lane

### B. Bob stops carrying local-host residue

Bob will keep the real hosted Builder path.

Bob will stop carrying boot and subject logic that exists only because local DevStudio used to launch it like a product host.

### C. Local trust stops pretending to be product authority

If a local flow is just internal tooling, it should say so explicitly.

It should not preserve fake product-auth, fake editor-host, or fake account-session semantics just to make the old lane easy to use.

### D. Local verification will verify the current system, not the removed lane

Verification must test:

- DevStudio as toolbench
- Bob local services as services
- Roma as real Builder host

It must stop testing hidden DevStudio host-lane assumptions.

### E. Local seeding only survives if it serves current reality

If a seed/sync/materialization step still helps:

- internal curation
- runtime verification
- local Tokyo asset truth

it may stay.

If it exists only to support removed DevStudio-hosted authoring, it is a deletion target.

---

## 4. What The System Looks Like Before / After

### Before

- DevStudio is documented as a toolbench but local scripts still preserve a Builder-adjacent host lane.
- Bob still carries alternate boot logic shaped by hostless/local launch needs.
- Local runtime still talks about tool-trusted authoring-like behavior.
- Verification still expects DevStudio instance/localization/l10n host surfaces.
- Local seeding still describes itself in terms of the dead DevStudio host lane.

### After

- DevStudio local is just a toolbench.
- Roma is the only real Builder host story.
- Bob no longer carries local DevStudio-host residue that the product does not need.
- Local verification checks the current product/system topology, not a removed lane.
- Any remaining local seeding is justified by current curation/verification value, not by fake hosting.

---

## 5. Files Touched + Toxic LOCs / Workflows / Files Removed

### Files touched

- `documentation/architecture/Overview.md`
- `documentation/services/devstudio.md`
- `documentation/services/bob.md`
- `documentation/README.md`
- `scripts/dev-up.sh`
- `scripts/dev/seed-local-platform-state.mjs`
- `scripts/dev/seed-local-platform-assets.mjs`
- `bob/lib/session/sessionPolicy.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`
- any remaining `admin/` local host artifacts still tied to removed authoring

### Toxic LOCs and code shapes to remove or collapse

- `bob/lib/session/sessionPolicy.ts`
  - `resolveBootModeFromUrl()`
  - `resolveSubjectModeFromUrl()`
  - toxic when preserved only for non-Roma local hosting of Builder

- `bob/lib/session/useSessionBoot.ts`
  - `if (bootMode === 'url') { ...loadFromUrlParams()... }`
  - any acceptance of non-product boot shapes kept only for local DevStudio hosting

- `bob/lib/session/sessionTransport.ts`
  - any host/subject branching that survives only to support removed DevStudio local authoring assumptions

- `scripts/dev-up.sh`
  - `Skipping local persona seed (local auth bootstrap is deprecated; DevStudio/Bob are tool-trusted)`
  - any startup messaging that still advertises DevStudio as a Bob-hosting lane

- `documentation/architecture/Overview.md`
  - any architecture wording that still normalizes Bob URL boot or a second non-Roma host story for Builder
  - toxic because it preserves removed local-host residue as if it were system truth

- `scripts/dev/seed-local-platform-state.mjs`
  - any description of local state preparation that still exists only to support DevStudio-hosted editing

- `admin/vite.config.ts`
  - any DevStudio-served Builder/open-editor contract artifact that exists only because DevStudio used to host Bob authoring

### Toxic workflows to remove

- launching Bob as if DevStudio were a real Builder host
- preserving a second local host story beside Roma
- using fake tool trust to stand in for removed product authoring flows
- verifying DevStudio-local instance/localization host routes after the lane was removed
- seeding local platform state to make a dead local authoring lane feel real

### Files removed from the system

None are locked upfront.

75L is a residue-deletion PRD first.

If a touched local script, helper, route artifact, or doc section becomes dead once the DevStudio host lane is removed from the system model, delete it in the same slice.

---

## Done Means

75L is done only when all of the following are true:

1. A human can describe local development truthfully as:
   DevStudio is the toolbench, Roma is the Builder host, Bob is the editor.
2. No local DevStudio-only authoring host path shapes Bob boot or session semantics.
3. Local scripts no longer verify or advertise removed DevStudio widget-authoring routes.
4. Local trust/auth language no longer preserves a fake authoring authority model for DevStudio.
5. Any remaining local seeding/verification clearly earns its place for current toolbench, curation, or runtime verification needs.
