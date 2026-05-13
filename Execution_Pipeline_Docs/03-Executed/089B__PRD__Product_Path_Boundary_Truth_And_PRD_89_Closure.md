# PRD 089B - Product Path Boundary Truth And PRD 089 Closure

Status: Executed
Owner: Codex
Date: 2026-05-11
Source PRD: `Execution_Pipeline_Docs/03-Executed/089__PRD__Close_PRD_088_Widget_Instance_Runtime_And_Storage_Contract.md`
Closure addendum: `Execution_Pipeline_Docs/03-Executed/089__Slice_10_Closure_Addendum.md`
Architecture source: `documentation/architecture/CONTEXT.md`
Additional UI/UX audit: `/Users/pietro_macpro_home/Downloads/PRD_88_89_uiux_audit.docx`, reviewed 2026-05-11

## 1. Purpose

PRD 089 removed many PRD 088 legacy identifiers, but it did not fully close the product behavior contract.

PRD 089B exists to close the remaining product-path gaps without creating a new product theory, a compatibility layer, a second authoring mode, or verification that proves itself by reading its own source code.

The UI/UX audit confirms that the storage cut is real progress: active code is clean of `publicId`, `wgt_curated_*`, `wgt_system_*`, old l10n/render instance routes, and legacy curated source vocabulary. PRD 089B therefore must not reopen the storage identity debate. It must fix the layer above it: the product user path, API verb boundaries, orchestration ownership, and scalability cliffs that still prevent the runtime contract from being boring.

This PRD is not a permission slip for broad refactoring. It is an execution contract for bringing the account Builder path back to the architecture:

```text
Roma account opens existing Tokyo-owned instance
Bob edits one active instance config in memory
Roma saves that same existing instance to Tokyo
Translation is async follow-up after base save
Tokyo publish state gates Venice public serving and embed copy
```

## 2. Non-Negotiable Product Truth

The surviving product path is:

1. A real account owns an existing widget instance.
2. A real user opens Builder from Roma for that one instance.
3. Bob edits one widget type and one active locale at a time.
4. Roma saves that same instance to Tokyo.
5. Tokyo owns instance identity, saved base config, l10n overlay state, publish state, and public serving lookup.
6. Venice serves only published instances through the Tokyo-owned public lookup.

The following must not define product behavior:

- Minibob/demo/funnel paths as users, accounts, policy profiles, editor identities, or save-capable modes.
- Preview as a second widget truth.
- Body-submitted widget type as authority over Tokyo instance identity.
- Compiled defaults as a silent repair mechanism for malformed saved account config.
- Public embed copy as proof that an unpublished widget is usable.
- Source-code grep checks as proof that the product path works.
- Paris-era Cloudflare, env, route, or documentation residue as active product vocabulary.

## 3. Current Remaining Toxic Behavior

### 3.0 Account Cold-Start Dead End

Current risk:

- A brand-new account can reach Roma with zero account-owned `ins_*` instances and no visible way to create the first widget.
- `roma/components/widgets-domain.tsx` exposes actions for existing instances: edit, duplicate, rename, delete, publish, unpublish.
- `roma/components/home-domain.tsx` frames the account path around opening existing widget instances and duplicating when needed.
- PRD 089 Slice 10 intentionally deferred a starter gallery, but no replacement first-instance creation verb was introduced.

Why this is toxic:

- The storage contract can be correct while the user cannot use the product.
- "Duplicate existing" is not a day-one path for an empty account.
- Reintroducing starter/gallery/system identities would violate PRD 088/089; not creating anything leaves the account product dead on arrival.

Surviving authority:

- The replacement is not a starter gallery. It is a real account create verb that creates a normal account-owned instance.
- Tokyo must mint the `ins_*` instance identity and return it to Roma.

Required product behavior:

- Roma home and widgets empty-state must expose a clear create-widget CTA.
- The CTA must create a real account-owned instance from a widget type and Tokyo-owned widget defaults without curated/system identities.
- Roma/client may send create intent such as `widgetType` and optional display label; it must not submit the authoritative initial config body.
- Tokyo-worker must load the current widget definition defaults, mint the `ins_*` ID, write the account instance documents, and return the new instance ID.
- The created instance must immediately be editable in Builder and visible in the account widgets list.

### 3.1 Roma Save Can Still Behave Like Covert Create Or Type Switch

Current risk:

- `roma/app/api/account/instance/[instanceId]/route.ts` accepts `widgetType` from the request body and calls the direct save path.
- `tokyo-worker/src/domains/render/saved-config.ts` can write the saved config document for the supplied `(accountId, widgetType, instanceId)` tuple even when that tuple did not previously exist.

Why this is toxic:

- The real product operation is save existing instance.
- A save route that can create or relocate truth is a hidden product mode.
- A body field must not be able to move an account instance across widget types.

Surviving authority:

- Tokyo's existing saved instance document owns `widgetType`, `displayName`, `meta`, and source identity.

### 3.2 Bob Still Heals Saved Config At Open

Current risk:

- `bob/lib/session/useSessionBoot.ts` materializes compiled defaults into the saved config before loading.
- `bob/lib/session/sessionConfig.ts` can normalize invalid primitive control values back into compiled defaults.

Why this is toxic:

- It converts malformed saved truth into a new normal inside the editor.
- It hides boundary failures that should be caught before Bob opens.
- It makes the UI look healthy while Tokyo/Roma saved truth may be broken.

Surviving authority:

- Saved config must already satisfy the widget config contract before Bob opens it.
- Editor-operation normalization may exist only after a valid saved config is loaded.

### 3.3 Translation Acceptance Failure Can Look Like Clean Save

Current risk:

- Roma save may return `ok: true` for the base save while `translationFollowup.ok === false`.
- Bob save state can clear dirty/error state without surfacing the failed translation acceptance as a visible product condition.

Why this is toxic:

- Translation is async follow-up, but acceptance failure is still product-relevant.
- The user should not be told the full product path is clean when downstream accepted work already failed.

Surviving authority:

- Base config save and translation follow-up are separate states.
- Base save success may clear base dirty state; translation failure must remain visible and actionable.

### 3.4 Embed Copy Is Not Publish-Aware

Current risk:

- Bob/Roma can expose copy-code affordances for any opened instance ID.
- The UI does not clearly gate public embed snippets on Tokyo publish state.

Why this is toxic:

- It teaches users that instance existence is the same as public availability.
- It breaks the publish-state contract and creates support confusion.

Surviving authority:

- Tokyo-owned `published` / `unpublished` state gates public serving and public embed copy.

### 3.5 Product-Path Smoke Is Not Real Product Truth

Current risk:

- `scripts/health/product-path-smoke.mjs` does not fully match current Roma builder-open response shape or public render routes.
- The GitHub workflow checks health/reachability slices, not the authenticated Roma -> Bob -> Tokyo product path.
- Without a real Roma cookie, authenticated product-path smoke is blocked, but repeated red CI creates noise without making product truth clearer.

Why this is toxic:

- It can fail for stale route assumptions.
- It can pass or fail without proving the real customer workflow.
- It can become a self-checking flow if it validates source expectations rather than behavior.

Surviving authority:

- Product-path verification must exercise real deployed behavior or clearly report the missing credential/blocker.

### 3.6 Active Documentation And Env Still Teach Removed Concepts

Current risk:

- Active docs still contain older storage paths such as account instance l10n paths outside the current widget tree.
- Ignored local env files still contain Paris-era values.
- Cloudflare still shows a `paris-dev` Worker/Page, which may be operational residue even if repo code no longer uses Paris.

Why this is toxic:

- Docs and env are operating interfaces for AI-native development.
- Stale names cause future agents to preserve removed product modes.

Surviving authority:

- Active docs and local env must teach only current product vocabulary.
- Any external Cloudflare residue must be inventoried before deletion, not guessed from repo topology.

### 3.7 Venice Still Carries Pre-GA Compatibility Surfaces

Current risk:

- Venice contains legacy/compat routes and names that may no longer have a product reason.
- Pre-GA architecture says strict contracts and breaking changes are acceptable when no PRD requires compatibility.

Why this is toxic:

- Compatibility code before GA preserves fake external contracts.
- It increases blast radius and makes runtime behavior harder to reason about.

Surviving authority:

- Only current embed routes required by the product should remain.
- Any retained compatibility surface must have a named owner and reason.

### 3.8 Dual Roma REST Trees For One Resource

Current risk:

- Account instance CRUD currently uses a singular route family:
  - `roma/app/api/account/instance/[instanceId]/route.ts`
- Account instance actions use a plural route family:
  - `roma/app/api/account/instances/[instanceId]/rename`
  - `roma/app/api/account/instances/[instanceId]/publish`
  - `roma/app/api/account/instances/[instanceId]/unpublish`
  - `roma/app/api/account/instances/[instanceId]/translations`
  - `roma/app/api/account/instances/[instanceId]/copilot`

Why this is toxic:

- The same product entity has two route personalities.
- It makes future agents preserve accidental topology instead of product truth.
- It increases the chance that fixes land in one tree while another tree keeps old semantics.

Surviving authority:

- The account instance route contract should be one plural resource tree with action sub-resources.

### 3.9 Roma Mints Tokyo Instance IDs

Current risk:

- Roma duplicate currently generates a new instance ID before asking Tokyo to persist it.
- The generator is timestamp/random-string based rather than a Tokyo-owned identity primitive.

Why this is toxic:

- PRD 088/089 says Tokyo owns instance identity.
- Roma minting IDs makes Tokyo a disk behind Roma instead of the authority for account instance identity.
- Collision/scalability reasoning belongs at the storage owner, not in the BFF.

Surviving authority:

- Tokyo must mint `ins_*` instance IDs for create/duplicate and return the new ID to Roma.

### 3.10 Roma Orchestrates Tokyo State Back To Tokyo

Current risk:

- Save asks Berlin for locale state, writes Tokyo config, asks Tokyo whether the instance is live, then passes Tokyo's live answer back into Tokyo sync enqueue.
- Publish writes Tokyo publish state, reads Tokyo live status, enqueues Tokyo sync, and rebuilds Tokyo indexes through multiple calls.
- Duplicate is a Roma-layer saga: write saved config, enqueue sync, then attempt compensating delete if sync acceptance fails.
- Delete preflights by reading Tokyo before calling Tokyo's idempotent delete.

Why this is toxic:

- Roma is acting as the brain for Tokyo-owned state.
- Multi-call user actions create partial-success windows and support ambiguity.
- Reading Tokyo state only to send it back to Tokyo is a self-checking flow, not an authority boundary.

Surviving authority:

- Tokyo owns instance state transitions. Roma is the BFF that exposes user-facing verbs and account/session auth context.
- Save, publish/unpublish, duplicate, delete, and sync acceptance should collapse into named Tokyo verbs where Tokyo owns the internal state reads/writes.

### 3.11 Base Locale Has Split Ownership

Current risk:

- Berlin account locale policy is treated as canonical account-level locale truth.
- Tokyo instance documents also carry base-locale-like state for instance localization.
- Roma reconciles account policy and instance state during save/orchestration.

Why this is toxic:

- Every save becomes a reconciliation between two authorities.
- It obscures whether base locale is an account default, an instance invariant, or a derived projection.

Surviving authority:

- Berlin owns account-level locale policy.
- Tokyo may store base locale as an instance projection needed for saved/runtime state, but the PRD execution must name whether it is derived or authoritative for the instance.

### 3.12 Widgets List Fans Out Across Berlin And Tokyo

Current risk:

- Roma account widgets listing joins Berlin account-level publish budget with Tokyo per-instance state on every dashboard load.

Why this is toxic:

- The list endpoint is a hot path.
- Fan-out makes UI availability depend on multiple services for a view whose primary truth is Tokyo-owned instance state plus account policy.

Surviving authority:

- The user-facing list should be served by one product verb that returns the joined view, with account policy fetched once at the owning boundary or cached through a named projection.

### 3.13 Account Index Rebuild Is A Mutation Hot-Path Scalability Cliff

Current risk:

- `rebuildAccountInstanceIndexes` lists instance keys and performs per-instance reads.
- It is called from mutation paths such as save, publish/unpublish, and live surface changes.

Why this is toxic:

- Full rebuild is appropriate as a repair operation, not as the steady-state mutation path.
- Tier 3 or unlimited accounts turn one save into an account-wide read fan-out.

Surviving authority:

- Hot-path mutations should update the one affected index entry.
- Full rebuild remains a repair/admin boundary.

### 3.14 Venice Catch-All Proxies Lack Path Shape Defense

Current risk:

- Venice catch-all routes under `/l10n/*` and `/renders/*` can forward removed path shapes to Tokyo and rely on Tokyo to 404.

Why this is toxic:

- Edge runtime still teaches that unknown old shapes are worth forwarding.
- Removed route cleanup should be defended at the public edge, not only at Tokyo.

Surviving authority:

- Venice should allow only current public path shapes and reject old/unknown l10n/render shapes at the edge.

### 3.15 Dead Conditional In Account Sync

Current risk:

- `tokyo-worker/src/domains/account-instance-sync.ts` contains an immediately redundant locale predicate after already continuing the base-locale case.

Why this matters:

- It is small, but it is exactly the kind of copy/paste residue PRD 089 was meant to eliminate.
- It should be simplified when touching the sync path.

Surviving authority:

- Sync code should express the current base-locale rule once: base locale is source config, non-base locales may have overlays.

## 4. Engineering Quality Lens

### 4.1 Elegant Engineering And Scalability

The desired fix shape is small, boring, and centralized:

- One first-instance create verb creates a normal account-owned widget without starter/system identities.
- One save boundary proves existing instance truth before write.
- One route family describes account instance resources.
- One Tokyo-owned create/duplicate/save/publish/delete verb owns Tokyo state transitions internally.
- One strict config contract rejects malformed saved config before Bob opens.
- One publish-state field crosses Roma -> Bob for embed UX.
- One product-path smoke script tests current routes and fails explicitly when credentials are missing.
- One docs/env cleanup removes stale vocabulary.
- One incremental index update path handles hot mutations; rebuild remains repair.

Scalability comes from eliminating duplicate truth, not adding orchestration.

### 4.2 Architecture And Tenet Compliance

Every change must comply with:

- Product truth before code topology.
- Invalid state fails at the named boundary.
- Builder is the only real account authoring surface.
- Translation is async follow-up after save.
- Preview is not second truth.
- Tokyo owns account instance storage and publish state.
- No public-facing compatibility shims unless explicitly required by a PRD.

### 4.3 Overarchitecture To Avoid

Do not introduce:

- A generic instance lifecycle framework.
- A second save mode named "strict" beside the old save mode.
- A starter/gallery/system-identity workaround for cold-start.
- A migration framework for pre-GA compatibility.
- A config healing registry.
- A cross-app publish-state event bus.
- A Roma-side transaction saga that compensates for Tokyo-owned state failures.
- A new verification service that revalidates source text instead of behavior.
- A "temporary" Paris abstraction.
- A broad widget schema platform beyond the active widget defaults and contracts needed now.

### 4.4 Academic / Meta-Work / Gold-Plating To Avoid

Do not spend PRD 089B effort on:

- New terminology layers.
- Abstract contract DSLs.
- Multi-version loader compatibility theory.
- Exhaustive historical migration cleanup unrelated to active product behavior.
- New docs that explain why toxic flows are okay.
- Test harnesses whose primary proof is that code contains or does not contain strings.

## 5. Self-Checking Flow Ban

This PRD treats "system checking itself" as a product smell.

Forbidden verification patterns:

- A script that passes because it greps source code for expected route names.
- A workflow that calls health endpoints only and claims the product path is green.
- A public-only smoke that skips public instance read and still passes.
- A write smoke that chooses its source instance from the same API under test.
- A save route that writes, then reads its own output, and treats that as proof that the pre-write authority existed.
- A Roma action that asks Tokyo for Tokyo-owned state only to pass the same answer back to another Tokyo endpoint.
- A duplicate/create route that writes partial Tokyo state and then attempts cleanup from Roma as proof of atomicity.

Required verification patterns:

- Prove existing Tokyo instance before save.
- Exercise the current public render route: `/renders/widgets/{instanceId}/live/r.json`.
- Authenticated product-path smoke must require `CK_ROMA_COOKIE` / `ROMA_COOKIE`.
- If credential is missing, the result is blocked, not green.
- UI/UX verification must inspect the actual user affordance state, especially copy-code behavior for unpublished instances.

## 6. Execution Slices

Execution must happen one slice at a time. Do not move to the next slice until the current slice's acceptance gates are green or the blocker is documented in this PRD.

### Slice 0 - Cold-Start Account Create Verb

Files expected in scope:

- `roma/components/home-domain.tsx`
- `roma/components/widgets-domain.tsx`
- `roma/app/api/account/instances/route.ts` or equivalent plural account-instance collection route
- Tokyo-worker create-instance domain/route files
- Docs for account widget creation behavior

Requirements:

1. New accounts with zero instances must see a clear create-widget CTA.
2. Create must mint a normal account-owned `ins_*` instance.
3. Tokyo, not Roma, must mint the instance ID.
4. Tokyo, not Roma or the browser, must source the initial config from the current widget definition defaults.
5. Create must not accept arbitrary client-provided default config as source truth.
6. Create must not introduce curated/system identities, starter gallery identity, or Prague/demo authoring truth.
7. The created instance must appear in the widgets list and be openable in Builder.

Acceptance gates:

- Empty account UI has a visible create path.
- Created instance uses the same account-owned storage model as every other instance.
- Roma does not generate the instance ID.
- Roma/client does not submit the initial saved config as authoritative create truth.
- No starter gallery or duplicate-from-hidden-system-instance is introduced.

### Slice 1 - Save Boundary Hard Cut

Files expected in scope:

- `roma/app/api/account/instance/[instanceId]/route.ts`
- `roma/lib/account-instance-direct.ts` only if helper shape requires it
- Focused tests or smoke coverage for the save boundary, if existing test harness supports it

Requirements:

1. `PUT /api/account/instance/:instanceId` must load the existing Tokyo saved document before write.
2. Missing instance must return 404 and must not create a saved document.
3. Submitted `widgetType` must match Tokyo-owned `widgetType`; mismatch must fail with validation.
4. Save must use Tokyo-owned `widgetType`.
5. If Bob does not explicitly send display metadata, save must preserve existing Tokyo-owned display metadata.
6. Tokyo low-level write may remain a create primitive for duplicate/create flows, but the Roma account save route must not expose create/type-switch behavior.

Acceptance gates:

- Build/typecheck for Roma passes with required env.
- A focused negative test or documented manual curl proves missing instance save does not create.
- A focused negative test or documented manual curl proves widget-type mismatch fails.
- No new alternate save route or mode is added.

### Slice 2 - Route Contract Collapse

Files expected in scope:

- `roma/app/api/account/instance/[instanceId]/route.ts`
- `roma/app/api/account/instances/[instanceId]/*`
- Roma client callers for save/delete/rename/publish/unpublish/translations/copilot
- Documentation for account instance API routes

Requirements:

1. Pick one account instance URL shape. The target shape is plural resource routes: `/api/account/instances/:instanceId`.
2. Save/delete/action semantics must live under one route family.
3. Slice completion must not leave an active alias that preserves the old singular tree.
4. Temporary aliases are allowed only inside the implementation window and must be removed before the slice is marked green.
5. Route collapse must not change product truth or introduce compatibility theory.

Acceptance gates:

- Roma client calls only the surviving route family.
- Static route scan shows no active duplicate account-instance route tree.
- Build/typecheck for Roma passes.

### Slice 3 - No Bob Open-Time Healing

Files expected in scope:

- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionConfig.ts`
- `roma/lib/widget-config-contract.ts`
- Active widget defaults under `tokyo/product/widgets/*/spec.json` only as read-only contract input unless a real malformed default is found

Requirements:

1. Bob must load the saved config as saved; no default merge on account open.
2. Bob must not coerce invalid saved primitive values to defaults during open.
3. Editor-operation normalization may remain for user edits after load.
4. Roma/Tokyo saved config validation must require default-owned shape for active widgets before Bob opens.
5. Validation must be strict enough to catch missing top-level/default-owned fields but not invent a broad theoretical schema system.

Acceptance gates:

- Bob build/typecheck passes.
- Roma build/typecheck passes if validator is changed.
- A malformed saved config cannot silently open as healed config.
- No generic schema framework is introduced.

### Slice 4 - Collapse Tokyo-Owned Orchestrations

Files expected in scope:

- `roma/app/api/account/instance/[instanceId]/route.ts`
- `roma/app/api/account/instances/[instanceId]/publish/route.ts`
- `roma/app/api/account/instances/[instanceId]/unpublish/route.ts`
- `roma/app/api/account/instances/[instanceId]/duplicate/route.ts`
- Tokyo-worker internal render/control routes
- Tokyo-worker domains for saved config, live surface, sync enqueue, and instance index

Requirements:

1. Save must not ask Tokyo for live status only to pass that value back to Tokyo.
2. Publish/unpublish must be a single Tokyo-owned verb from Roma's perspective.
3. Duplicate must be a single Tokyo-owned verb from Roma's perspective; Roma must not own compensation cleanup.
4. Delete must rely on a Tokyo idempotent delete boundary and return `{ existed }` or equivalent if the UI needs that distinction.
5. Tokyo must own state reads/writes needed for sync enqueue, live card updates, publish lookup, and index patching.

Acceptance gates:

- Save, publish/unpublish, duplicate, and delete have no Roma-layer self-checking loops.
- Partial-success windows are owned inside Tokyo boundaries or fail explicitly.
- Build/typecheck for Roma and Tokyo-worker pass.

### Slice 5 - Translation Follow-Up Visibility

Files expected in scope:

- `roma/app/api/account/instance/[instanceId]/route.ts`
- `bob/lib/session/useSessionSaving.ts`
- `bob/lib/session/sessionTypes.ts`
- `bob/components/ToolDrawer.tsx` or current save/error UI component

Requirements:

1. Base save success remains distinct from translation follow-up acceptance.
2. If `translationFollowup.ok === false`, Bob must surface a visible translation follow-up error.
3. Base dirty state may be cleared only for the base config save.
4. Translation failure must not block loading the saved base config unless the product intentionally chooses that in this slice.
5. Error copy must be user-facing and not expose internal implementation detail as the main message.

Acceptance gates:

- Bob build/typecheck passes.
- Manual or unit-level verification proves translation follow-up failure is visible.
- Existing base save success UX remains intact.

### Slice 6 - Publish-Aware Embed UX

Files expected in scope:

- `roma/lib/builder-open.ts`
- `roma/components/builder-domain.tsx`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/components/TopDrawer.tsx`
- `bob/components/EmbedModal.tsx`

Requirements:

1. Roma builder-open payload must include Tokyo-owned publish status.
2. Bob session metadata must carry publish status.
3. Copy-code affordance must be disabled or unavailable for unpublished instances.
4. Embed modal must not emit live snippets for unpublished instances.
5. Published instances must preserve the existing copy-code path.

Acceptance gates:

- Roma and Bob build/typecheck pass.
- UI verification confirms unpublished instance copy-code is gated.
- UI verification confirms published instance copy-code still works.
- No client-side inference from instance ID replaces Tokyo publish status.

### Slice 7 - Base Locale Ownership Cut

Files expected in scope:

- `roma/lib/account-locales-state.ts`
- `roma/lib/account-base-locale-lock.ts`
- Roma save/publish/sync callers that pass locale policy
- `tokyo-worker/src/domains/render/types.ts`
- Tokyo-worker l10n/sync domains
- Architecture docs that describe account locale versus instance locale truth

Requirements:

1. Name the authority: Berlin owns account-level locale policy.
2. If Tokyo stores base locale on instance state, declare it derived instance projection unless product explicitly makes it instance-owned.
3. Save/sync code must not reconcile two equal authorities.
4. Base locale remains source config, not an overlay.

Acceptance gates:

- Code and docs name one authority and one projection.
- No save path treats Berlin and Tokyo as competing base-locale authorities.
- Existing non-base overlay behavior remains intact.

### Slice 8 - Scalable Listing And Index Maintenance

Files expected in scope:

- `roma/app/api/account/widgets/route.ts`
- `tokyo-worker/src/domains/render/instance-index.ts`
- `tokyo-worker/src/domains/render/live-surface.ts`
- `tokyo-worker/src/domains/render/saved-config.ts`
- Tokyo-worker account widgets/list route

Requirements:

1. Hot-path mutations must patch the affected index entry instead of rebuilding the full account index.
2. Full index rebuild remains available as a repair/admin operation.
3. Widgets list should avoid repeated Berlin + Tokyo fan-out from Roma where a single product verb can return the joined account view.
4. Publish budget/account policy joins must have a named owner and cache/projection strategy if they remain in the hot list path.

Acceptance gates:

- Save/publish/delete mutation paths do not call full rebuild except through repair.
- Widgets dashboard list has one intentional product boundary, not ad hoc service fan-out.
- Load implications for high-instance accounts are documented.

### Slice 9 - Product-Path Smoke Truth

Files expected in scope:

- `scripts/health/product-path-smoke.mjs`
- `.github/workflows/cloud-dev-runtime-verify.yml` only if the workflow can honestly run the authenticated product path
- Documentation for required smoke env/cookie

Requirements:

1. Smoke script must match current Roma builder-open response shape.
2. Public render check must use `/renders/widgets/{instanceId}/live/r.json`.
3. Authenticated product-path smoke must require `CK_ROMA_COOKIE` / `ROMA_COOKIE`.
4. Missing cookie must report blocked, not green.
5. Workflow must not claim product-path verification if it only performs unauthenticated health checks.

Acceptance gates:

- `node --check scripts/health/product-path-smoke.mjs` passes.
- Public-only mode cannot pass without an instance ID.
- Write/authenticated mode cannot pass without cookie/source instance.
- Workflow naming accurately describes what it verifies.

### Slice 10 - Toxic Residue Cleanup

Files expected in scope:

- `documentation/strategy/Clickeen-Babel.md`
- `documentation/services/venice.md`
- Other active docs found by static scan
- Ignored local env files, if present
- Cloudflare inventory notes, if browser-auth inspection is performed

Requirements:

1. Active docs must use `accounts/{accountId}/widgets/{widgetType}/{instanceId}` storage vocabulary.
2. Removed Paris product env keys must be deleted from ignored local env files.
3. Cloudflare `paris-dev` must be inventoried before any external deletion.
4. If Paris remains externally, the PRD execution note must say whether it is unused residue, blocked for deletion, or still referenced by deployed config.
5. No secret values may be printed into logs or docs.

Acceptance gates:

- Static docs scan shows no active old storage vocabulary outside historical PRDs/archives.
- Env scan shows no local Paris keys, with values redacted if reported.
- Cloudflare status is recorded from authenticated dashboard/API inspection or marked blocked by unavailable auth.

### Slice 11 - Venice Pre-GA Compatibility And Edge Path Cut

Files expected in scope:

- `venice/app/embed/v1/*`
- `venice/app/embed/pixel/*`
- `venice/app/l10n/[...path]/route.ts`
- `venice/app/renders/[...path]/route.ts`
- `venice/lib/tokyo.ts`
- `documentation/services/venice.md`

Requirements:

1. Delete v1/pixel compatibility routes unless a current product owner and reason are documented.
2. Remove Tokyo legacy path-prefix acceptance unless required by deployed current config.
3. Add path-shape allow-listing for Venice `/l10n/*` and `/renders/*` catch-all routes so removed shapes are rejected at the edge.
4. Current `/embed/latest/loader.js` and v2/current embed paths must remain working.
5. Docs must list only surviving Venice routes.

Acceptance gates:

- Venice build/typecheck passes.
- Health/smoke still checks current loader route.
- No pre-GA compatibility surface or removed path shape remains forwarded without explicit justification.

### Slice 12 - Dead Branch And Residue Simplification

Files expected in scope:

- `tokyo-worker/src/domains/account-instance-sync.ts`
- Nearby tests or smoke coverage for sync behavior

Requirements:

1. Remove the redundant `locale !== baseLocale` branch after the base-locale continue.
2. Keep the base-locale overlay suppression behavior unchanged.
3. Do not expand this into a sync rewrite.

Acceptance gates:

- Tokyo-worker build/typecheck passes.
- Existing sync behavior remains green.
- Diff is limited to the dead branch unless the slice uncovers a real adjacent defect.

## 7. Global Verification Gates

Run after the relevant slice, and again at the end:

```bash
corepack pnpm --filter @clickeen/roma build
corepack pnpm --filter @clickeen/bob build
corepack pnpm --filter @clickeen/venice build
node --check scripts/health/product-path-smoke.mjs
```

If package-manager shims or required env are missing, record the exact blocker and rerun with the minimal explicit env needed. Do not mark a gate green because the command could not run.

Required static scan at closure:

```bash
rg -n "publicId|public_id|data-ck-public-id|wgt_curated|wgt_system|systemInstanceRef|curatedRef|/l10n/instances|/renders/instances|public/instances|accounts/\\$\\{accountId\\}/instances" bob roma venice prague tokyo-worker tokyo/product/widgets packages scripts documentation --glob '!Execution_Pipeline_Docs/**' --glob '!**/CompetitorAnalysis/**' --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/.vercel/**' --glob '!**/.wrangler/**' --glob '!**/dist/**'
```

Expected closure state:

- No active product-path hits.
- Historical PRDs may retain old terms only as historical evidence.
- Generated build output is excluded.

## 8. Non-Goals

PRD 089B must not:

1. Build a starter gallery.
2. Add a new widget creation framework.
3. Reintroduce Michael widget instance truth.
4. Recreate Paris under a new name.
5. Add compatibility with removed public IDs or old l10n/render routes.
6. Make translation synchronous in the Builder save loop.
7. Rewrite the whole Bob/Roma/Venice architecture.
8. Add broad abstractions that are larger than the active defects.
9. Preserve Roma as the state-machine owner for Tokyo instance transitions.
10. Treat a new account with no widgets as an acceptable product state without a create path.

## 9. Completion Criteria

PRD 089B is complete only when:

1. New accounts can create their first normal account-owned widget instance.
2. Tokyo mints instance IDs for create/duplicate.
3. Roma save proves existing Tokyo instance truth before writing.
4. A save cannot covertly create an instance or switch widget type.
5. Account instance routes use one coherent route family.
6. Roma no longer narrates Tokyo-owned state back to Tokyo for save/publish/duplicate/delete.
7. Bob cannot hide malformed saved config by merging defaults on open.
8. Translation follow-up acceptance failure is visible to the user.
9. Embed copy respects Tokyo publish state.
10. Base locale ownership is named and no longer reconciled as two competing truths.
11. Hot-path index maintenance is incremental; full rebuild is repair-only.
12. Smoke verification uses real current routes and reports missing auth as blocked.
13. Active docs/env no longer teach Paris or old instance storage concepts.
14. Venice has no unjustified pre-GA compatibility surfaces and rejects removed path shapes at the edge.
15. Dead sync residue is removed without expanding into gold-plating.
16. All touched-package gates are green or explicitly blocked with owner/action.

## 10. Execution Rule

This PRD must be executed one slice at a time.

Before code execution begins, the executor must:

1. Confirm the target slice.
2. Name the surviving authority for that slice.
3. Name the files expected in scope.
4. Run only the checks relevant to that slice.
5. Stop if the slice is not green.

Do not execute a later slice to compensate for an earlier failed slice.

## 11. Execution Notes

### Slice 10 - Cloudflare Paris Inventory

Local repo/env Paris residue was removed from ignored local env without printing secret values.

External Cloudflare `paris-dev` inventory is blocked in this shell: `npx wrangler@latest whoami` can start Wrangler but cannot retrieve account IDs because neither `CLOUDFLARE_ACCOUNT_ID` nor `CLOUDFLARE_API_TOKEN` is available here. Do not delete or classify external `paris-dev` from repo topology alone; complete this inventory from an authenticated Cloudflare dashboard/API session.

### Slice 11 - Venice Pre-GA Compatibility And Edge Path Cut

Venice now exposes only the current loader plus published widget render/l10n proxy shapes. The pre-GA v1 loader route and no-op tracking compatibility endpoint were deleted. The `/renders/*` and `/l10n/*` catch-all routes now reject unknown/removed path shapes at the Venice edge instead of forwarding them to Tokyo.

Verification:

- `corepack pnpm --filter @clickeen/venice build` passed.
- Static scan for removed embed compatibility names across Venice active docs and source returned no active hits.

### Slice 12 - Dead Sync Residue

The account-instance sync locale loop now expresses the base-locale rule once: the base locale is skipped as source config, and incomplete non-base locales are skipped by the `incompleteLocales` set. The redundant `locale !== baseLocale` predicate was removed without changing overlay generation behavior.

Verification:

- `node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit` passed.
- Static scan for the removed redundant predicate returned no hits.

### Cleanup Pass - LOC Legitimacy And Route Family Closure

The first implementation pass still carried too much scaffolding and one route-family miss. The cleanup pass removed the parts that were implementation noise rather than product truth:

- Roma's Tokyo client now uses one JSON/error helper instead of repeating response parsing per verb.
- Roma l10n intent loading is one helper instead of repeated Berlin error mapping in each route.
- Tokyo create/duplicate ID minting no longer does theoretical R2 collision pre-reads around UUIDs.
- Tokyo create/save/duplicate/publish/unpublish behavior is in one account-instance transition module; the separate create helper file was removed.
- Tokyo transition routes use the Roma account authz capsule boundary consistently for create/save/duplicate/publish/unpublish.
- Account duplicate moved from the old widgets-level duplicate action to the account-instance route family: `POST /api/account/instances/:instanceId/duplicate`.

Final LOC shape after cleanup:

- Tracked diff: `1452 insertions / 1719 deletions`.
- Untracked new code files: `857` lines.
- PRD 089B document: `875` lines.
- Honest code-only total including untracked files: `2309 insertions / 1719 deletions`.

The remaining added code is the surviving product boundary: plural Roma account-instance routes, Tokyo-owned account-instance transitions, and the shared l10n intent helper. It is not compatibility scaffolding for removed public IDs, old render/l10n routes, Paris, minibob, or starter/system identities.

### Closure Verification - 2026-05-11

Passed:

- `NEXT_PUBLIC_TOKYO_URL=http://localhost:8787 corepack pnpm --filter @clickeen/roma build`
- `corepack pnpm --filter @clickeen/bob build`
- `corepack pnpm --filter @clickeen/venice build`
- `node_modules/.bin/tsc -p tokyo-worker/tsconfig.json --noEmit`
- `node --check scripts/health/product-path-smoke.mjs`
- `git diff --check`
- `corepack pnpm -r --if-present run typecheck`
- `corepack pnpm -r --if-present run lint`
- `corepack pnpm -r --if-present run test`
- Required PRD 089B legacy storage vocabulary scan returned no active hits.
- Removed Venice embed compatibility scan returned no active hits.
- Removed old widgets-level duplicate active-route scan returned no active hits.
- Local ignored env scan for Paris-era keys returned no hits.

Blocked:

- Root `corepack pnpm lint`, `corepack pnpm typecheck`, and `corepack pnpm test` fail before package scripts run because Turbo cannot find the package manager binary in this Corepack-only shell (`Unable to find package manager binary: cannot find binary path`). Direct package-level equivalents above were run and passed.
