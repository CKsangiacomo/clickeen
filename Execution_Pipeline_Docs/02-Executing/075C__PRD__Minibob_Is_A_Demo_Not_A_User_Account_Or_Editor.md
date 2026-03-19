# 075C - Minibob Is A Demo, Not A User, Account, Or Editor

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/strategy/WhyClickeen.md`

---

## What This PRD Is About

This PRD is about one product promise:

Only a real account edits and saves real widgets in Builder.

Minibob may let someone play, preview, ask for changes, and decide to sign up.
Minibob is not:

- a user
- an account
- an editor identity
- a workspace policy profile
- a second authoring mode

There is no real product concept of "an anonymous editor without an account."

---

## Product Scope

This PRD covers:

- the product boundary between Builder and Minibob
- how Bob models the active authoring subject
- how policy and entitlements model real product people
- how Roma handles Minibob-to-account conversion
- which Minibob behaviors must be deleted from shared Builder and account code

This PRD does not cover:

- asset-path cleanup from `75B`
- one-widget / one-save cleanup from `75A`, except where Minibob contaminated it
- panel/compiler cleanup
- broader Prague marketing UX redesign

---

## Product Truth

For the real product:

1. A customer gets real authoring power only after they have an account.
2. Builder is the real account authoring surface.
3. Minibob is a demo/funnel surface.
4. Minibob can preview and collect intent.
5. Minibob cannot save, update, publish, or own widget truth.
6. Minibob is not a policy profile, editor subject, or account context.
7. If Minibob hands something into signup, that payload is temporary conversion input, not a second editor identity.
8. Bob shared editor code should model account authoring truth, not account authoring plus fake-anonymous authoring.

Roma owns the real account boundary.  
Bob is the real editor for account authoring.  
Minibob is not co-equal with either.

---

## 1. Where We Fucked Up / How And Why

We let a toy acquire architectural citizenship.

Instead of treating Minibob as a demo surface, the codebase turned it into a fake kind of editor person.

### A. We invented a fake authoring identity

The code does not treat Minibob as "marketing/demo."
It treats Minibob as a real editor subject:

- shared Bob session types model `minibob` and `account` as peer subjects
- shared policy resolution maps `policy.profile === 'minibob'` into editor behavior
- shared save logic branches on `minibob`
- shared localization logic branches on `minibob`
- shared Copilot code has a full Minibob surface contract

That happened because the repo preserved a demo flow by making it look like a real product mode.

### B. We pushed the fiction down into policy and entitlements

The system currently treats `minibob` as a first-class policy profile.

That means the toy is not just a UI surface.
It has formal standing in:

- policy typing
- entitlement matrices
- action gates
- AI grant resolution
- authz payload normalization

That is the wrong abstraction.
Minibob is not a workspace tier.

### C. We let shared Bob code carry non-account runtime behavior

Shared Bob boot/session code currently supports:

- URL subject resolution for `minibob`
- Minibob-only public instance loading
- Minibob preview-state injection
- Minibob-specific save/signup upsell behavior
- Minibob-specific Copilot session token plumbing

That happened because the easiest path was "one editor kernel for everything."
But the product is not "everything."
The product is account Builder, and a toy beside it.

### D. We let Roma acknowledge the fake identity at the edge

Roma's core account routes are much cleaner than Bob.
But Roma still carries Minibob-aware behavior in:

- login/session-finish continuation intent
- Minibob handoff state
- account-adjacent profile typing
- account locale helpers

Some of that exists because conversion is real.
But we expressed conversion as if Minibob were a product person, not just a demo flow feeding into a real account.

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

This is a product-truth failure, not just a cleanup issue.

### A. The system starts lying about who is editing

There should be one simple answer:

- an account editor is editing the widget

Instead, the codebase answers:

- sometimes an account editor
- sometimes a fake Minibob editor subject

That makes the product boundary harder to understand than the product itself.

### B. A toy gets equal architectural weight with the real product

Once Minibob has:

- subject mode
- policy profile
- save gating
- Copilot mode
- session tokens
- handoff lifecycle

the codebase stops treating it like a toy.

That poisons future work because every engineer and every AI sees active callers and assumes the fake identity must be preserved.

### C. Shared Builder code becomes harder and more toxic

The active Builder path should only care about:

- account context
- current widget
- edit
- save

Instead it must constantly ask:

- is this account or minibob?
- should this upsell be signup or upgrade?
- is this a real save or a blocked save?
- is this a real editor or a toy surface?

That makes the real Builder product slower to change and easier to break.

### D. Roma gets contaminated by something that is not an account concern

Roma should model:

- user
- account
- membership
- account widget

Not:

- fake anonymous authoring profile

If account-adjacent code branches on `minibob`, Roma is carrying marketing-funnel residue inside product/account logic.

### E. AI execution gets worse

Once `minibob` is formalized as a real profile/subject, AI keeps preserving it.

That causes exactly the failure mode we keep seeing:

- preserve every caller
- preserve every branch
- preserve every type
- preserve every fake identity

The repo becomes harder to simplify because the lie is codified as structure.

---

## 3. How We Are Fixing It

We are restoring the real product hierarchy.

### A. Builder becomes explicitly account-only

Shared Builder/editor code will model one real authoring subject:

- account

Bob shared session, boot, save, localization, and Copilot logic will stop carrying a peer `minibob` editor identity.

### B. Minibob becomes explicitly a demo surface

Minibob may still:

- render a demo widget
- preview changes
- encourage signup

Minibob will not:

- become a policy profile
- become a shared editor subject
- become a fake save-capable user
- become a branch inside account product truth

### C. Policy and entitlements stop pretending Minibob is a workspace tier

`minibob` will be removed from workspace-profile semantics.

Policy/entitlements should model real account states, not funnel states.

Any Minibob-only throttles, caps, or demo restrictions belong only inside Minibob implementation.
They must not exist in shared account entitlement or policy types.

### D. Conversion/handoff becomes explicit and narrow

The only allowed Minibob-aware product boundary after this cleanup is Roma signup conversion intake.

If Minibob hands off a draft during signup:

- that handoff is one temporary conversion payload
- that payload is not a user, account, policy profile, or editor subject
- that payload does not enter shared Bob editor state
- that payload does not enter shared account entitlement logic
- real authoring starts only after Roma creates or opens a real account widget

### E. Roma account logic stops branching on Minibob

Current-account routes and account-adjacent helpers should reason only about real account profiles and roles.

Only the explicit Roma signup conversion intake may know Minibob exists.
Current-account routes, account helpers, and account types may not branch on `minibob`.

---

## 4. What The System Looks Like Before / After

### Before

- Minibob is treated like a second kind of editor subject.
- Shared Bob code branches between `account` and `minibob`.
- Policy/entitlements formally include `minibob`.
- Save denial for Minibob pretends a fake editor almost saved something.
- Roma still carries Minibob-aware account-adjacent branches.
- The repo behaves as if "anonymous editor without an account" is a real product concept.

### After

- Builder has one real authoring subject: account.
- Shared Bob code models account authoring only.
- Minibob is a demo/funnel surface, not an editor identity.
- Policy/entitlements describe real workspace/account states only.
- Roma handles conversion only at the explicit funnel edge, not inside shared account logic.
- The product truth becomes boring again:
  - visitor plays
  - visitor signs up
  - account opens Builder
  - account edits widget
  - account saves widget

---

## 5. Files Touched + Clear List Of Toxic LOCs / Workflows / Files Removed

### Files touched

Bob shared authoring path:

- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/sessionPolicy.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/useSessionLocalization.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/lib/session/useWidgetSession.tsx`
- `bob/components/CopilotPane.tsx`

Bob Minibob-only files and routes:

- `bob/app/api/instance/[publicId]/route.ts`
- `bob/app/api/ai/minibob/session/route.ts`
- `bob/app/api/ai/outcome/route.ts`
- `bob/app/api/ai/widget-copilot/handler.ts`
- `bob/lib/ai/minibob.ts`

Shared policy/authz files:

- `packages/ck-policy/src/types.ts`
- `packages/ck-policy/src/matrix.ts`
- `packages/ck-policy/entitlements.matrix.json`
- `packages/ck-policy/src/gate.ts`
- `packages/ck-policy/src/authz-capsule.ts`
- `packages/ck-policy/src/ai.ts`

Roma product/account boundary:

- `roma/components/use-roma-me.ts`
- `roma/lib/account-locales.ts`
- `roma/app/api/session/login/google/route.ts`
- `roma/app/api/session/finish/route.ts`
- `roma/lib/minibob-handoff.ts`

Documentation truth:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/strategy/WhyClickeen.md`
- any Bob/Roma service docs still treating Minibob as a peer authoring mode

### Toxic LOCs and concepts that will be removed from the system

- `SubjectMode = 'minibob' | 'account'` in shared Bob session code
- URL-driven `?subject=minibob` as a shared editor subject contract
- `resolvePolicySubject(policy)` returning `minibob` for shared Builder behavior
- any shared save/localization branch that treats Minibob as a peer authoring lane
- `isMinibob` as a shared session identity export
- `MinibobCopilotPane`, Minibob session-token plumbing, and `pendingMode: 'signup'` inside shared Builder Copilot code
- Minibob-specific signing/session assumptions inside shared AI outcome/callback plumbing
- `policy.profile === 'minibob'` as a save/create gate concept
- `PolicyProfile = 'minibob' | WorkspaceTier`
- `minibob` rows in workspace entitlements matrices
- Roma/account helpers branching on `minibob` profile
- product/account code that models Minibob as if it were a real account state

### Toxic workflows that will be removed

- shared Bob boot deciding whether the editor is `account` or `minibob`
- shared Bob save flow pretending Minibob is an editor that is merely blocked from saving
- shared localization/account behavior branching on Minibob
- account policy/authz normalization that accepts `minibob` as a real workspace profile
- account-adjacent Roma logic carrying Minibob as if it were part of account truth
- architecture and Prague docs teaching `minibob` host/subject semantics as if they were peer editor truth instead of funnel-only behavior

### Files that should be deleted entirely if they exist only to preserve fake editor identity

- `bob/app/api/instance/[publicId]/route.ts`
- `bob/app/api/ai/minibob/session/route.ts`
- `bob/lib/ai/minibob.ts`

If the product keeps demo-to-signup handoff, the only surviving Minibob-aware backend path is one narrow Roma conversion intake.
That surviving path must not preserve subject mode, policy profile, save gating, or shared editor/account branching.

---

## Done Means

This PRD is done when all of the following are true:

- no shared Bob authoring code models `minibob` as a peer subject to `account`
- no workspace policy or entitlement type models `minibob` as a real account/workspace profile
- Minibob is no longer described or implemented as a save-capable editor identity
- the only allowed Minibob-aware product boundary is one explicit Roma signup conversion intake
- Roma account logic no longer branches on `minibob`
- the codebase once again tells one simple truth:
  - Minibob is a demo
  - Builder is the editor
  - account is the only real authoring identity
