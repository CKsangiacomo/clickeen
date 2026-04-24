# 075E Execution Plan - Localization Must Not Tax Every Builder Session

Status: HOT PATH GREEN; MANUAL VERIFICATION NEXT  
Date: 2026-03-23  
Owner: Product Dev Team  
References:
- `Execution_Pipeline_Docs/02-Executing/075E__PRD__Localization_Must_Not_Tax_Every_Builder_Session.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`
- `documentation/architecture/OverlayArchitecture.md`
- `Execution_Pipeline_Docs/02-Executing/Overlay_Architecture_Contradiction_Inventory.md`

---

## What This Doc Is

This file is the coding order for the current repo state.

Update 2026-03-24:

- Most Bob/Tokyo-worker execution work described below is already closed in code.
- Treat the detailed phase/file notes below as execution history and residual implementation context, not as the current contradiction gate.
- The current gate for forward overlay work is `Overlay_Architecture_Contradiction_Inventory.md`.
- `published` / `unpublished` was clarified after this plan was written: it is only the Tokyo-owned per-instance serve flag that tells Venice whether the instance may be served publicly. It is not widget state, overlay health, or Michael row-status truth.
- The serve-state authority closure is now implemented in product code:
  - widgets/status reads use Tokyo serve-state, not Michael row status
  - publish/unpublish mutate Tokyo live truth, not Michael row status
  - save remains one handoff of the instance to Tokyo-worker; Tokyo-worker owns reconciliation of locales and R2/runtime artifacts
  - account locale fanout now resolves all account-owned saved instances and sets `live` per Tokyo serve-state
  - curated starter discovery no longer filters on `published`
- The Builder consumer read slice is now implemented in product code:
  - while `Translations` is open, Bob reads one Roma/Tokyo-backed translations status route
  - successful Save bumps that same read so Builder rechecks current locale status after Tokyo-worker takes the save
  - if translations are still preparing while the panel is open, Builder may perform a small bounded recheck of that same status read
  - the Translations panel shows one global readiness answer; it does not show per-locale readiness
  - the preview locale selection unlocks only when the current account locale set is fully ready for the latest saved widget
  - lower-tier accounts see a policy-derived language upsell message in the panel
- The queue-handoff dead-flow is now closed in product code:
  - if Tokyo cannot enqueue overlay work after writing the durable work item, Tokyo marks that work item `failed` immediately instead of leaving fake `pending/updating` state behind
- The active deletion slice is now closed in product code:
  - public/product l10n control routes no longer admit legacy `layer='user'`
  - Michael core-row helpers no longer surface instance `status` as product truth
- The latest-save localization truth slice is now implemented in product code:
  - newer saves delete older overlay work items for the same instance
  - current locale readiness no longer treats missing generation output as ready
  - published live locale policy now advances with the current-ready locale subset only
- The account-locale fanout slice is now implemented in product code:
  - account locale changes fan out across all account-owned saved instances, not only published ones
  - published instances enqueue sync with `live: true`; unpublished instances enqueue sync with `live: false`
  - curated starter instances are no longer locale-fanout targets
- The account-locale fail-open slice is now implemented in product code:
  - one broken saved widget no longer blocks locale fanout for healthy widgets
  - non-404 saved-document failures are now per-instance warnings
  - 404 historical saved-document residue remains silent skip-only behavior
- Because that reset slice is closed, the next code slice can return to narrower overlay/localization work.

The PRD is still product truth.
This file is narrower:

- what is already green and must be left alone
- what is actually still broken
- what exact files are in the real write set
- what each phase must prove before moving on

If implementation starts naming extra subsystems, extra preview paths, or generic cleanup that is not tied to the file set below, implementation has drifted.

---

## Non-Negotiable Execution Rules

1. Bob keeps one preview surface. No second iframe. No panel preview. No Bob-only renderer.
2. Any Builder panel other than `Translations` is editing mode. Editing mode preview is locked to base content / `baseLocale`.
3. `Translations` is the only place locale overlay preview is active.
4. While `Translations` is open, the panel dropdown and in-widget locale switcher are two controls for one `overlayPreviewLocale`.
5. Outside `Translations`, the in-widget locale switcher is blocked.
6. Blocked click copy is exact:
   - `Translations not available while in editing mode. Preview translations in Translations panel.`
7. Locale overlay display in Bob must use the same Tokyo-backed runtime/display path that embed uses when locale switching is allowed.
8. Only current/ready locales are exposed to Builder preview and embed runtime.
9. Incomplete locales are internal Tokyo/Tokyo-worker work, not selectable/renderable consumer state.
10. The Translations panel and preview locale-switcher must consume only that ready locale set.
11. Translation/status/runtime reads stay read-only. No `ensure`, backfill, or heal-on-read writes on the Builder/embed consumer path.
12. No compatibility shims.
13. No translated text surface inside the `Translations` panel.
14. No fallback locale, best-available output, or heal-on-click behavior in Builder preview.
15. Do not reopen session-core architecture unless a file in this write set makes it strictly necessary.
16. If a phase is not green, do not move to the next phase.
17. `readyLocales` is the only Builder/embed consumer locale set for this slice. Do not reintroduce `activeLocales` on the consumer path.
18. If repo-level architecture docs still contradict `75E` at the end of execution, the slice is not done.
19. Small text edits must not trigger whole-widget retranslation for locales that already have overlay ops. Save/sync must diff previous vs current saved bases and send only changed/removed translatable paths to San Francisco. Locales with no existing ops may still require a full first generation.
20. Builder and embed must read the same current locale pointer truth. Builder differs only in when locale preview is enabled, not in a separate required pointer surface.
21. Once the base widget save succeeds, Roma must return success even if overlay enqueue fails afterward.
22. Queue absence or enqueue failure must not trigger inline overlay convergence on the Save request path.
23. Tokyo/Tokyo-worker must own one durable overlay work item for the current `publicId + baseFingerprint`; queue delivery is a trigger, not workflow truth.
24. Builder must expose one honest system-owned state from that work item plus ready artifact truth: `ok`, `updating`, or `failed`.
25. Permanent queue failure must become durable work-item state, not a console-only event and not infinite `updating`.
26. `published` / `unpublished` in this slice means only Tokyo's per-instance serve flag.
27. That serve flag is not widget-type state, draft state, or overlay health.
28. Unpublish turns public serving off; it is not shorthand for purging saved docs or internal overlay authoring state.
29. Any remaining Michael status usage is cutover residue, not an authority to preserve.

### Discipline Checks

These checks are here to stop implementation drift:

- If code introduces a second preview surface, stop.
- If code introduces server-owned selected-locale UI state, stop.
- If code reintroduces `activeLocales` to Builder preview selection, stop.
- If code adds any read-path healing or `ensure` behavior on Builder/embed consumer reads, stop.
- If code makes the Translations panel render translated widget content itself, stop.
- If code makes Bob responsible for translation truth instead of preview interaction, stop.
- If code adds files outside the declared write set, justify them against product truth before proceeding.
- If code tries to re-couple overlay generation back into the Save request path, stop.
- If code handles queue failure only with logs and no durable state, stop.
- If code treats the queue message itself as workflow truth instead of a trigger to process durable Tokyo work, stop.

---

## Code Truth Already Green

These are current code truths. They are not planned work for `075E`.

- `roma/app/api/account/instance/[publicId]/route.ts`
  - Save still means only `save this widget`. Tokyo-worker owns the post-save reconciliation of locale and R2/runtime artifacts.
- `roma/app/api/account/instances/[publicId]/publish/route.ts`
  - Publish is now the explicit Tokyo live-plane boundary. It no longer writes Michael status rows.
- `roma/app/api/account/instances/[publicId]/unpublish/route.ts`
  - Unpublish now removes the Tokyo live surface only. It no longer writes Michael status rows or treats unpublish as delete.
- `roma/lib/michael-catalog.ts`
  - Widgets-domain status and account-locales fanout now derive `published` / `unpublished` from Tokyo serve-state instead of Michael row status.
- `roma/app/api/account/templates/route.ts`
  - The curated starter gallery now lists admin-owned curated instances without treating `published` as a starter-availability gate.
- `bob/lib/session/WidgetDocumentSession.tsx`
  - `loadTranslations` already lives in transport context, not `WidgetDocumentSessionValue`.
- `bob/lib/session/useWidgetSession.tsx`
  - already re-exports `useWidgetSessionTransport`.
- `bob/components/BuilderApp.tsx`
  - owns one shared translations snapshot while `Translations` is open and bumps it after successful Save.
- `bob/components/useTranslationsPreviewState.ts`
  - reads one Tokyo-backed translations status payload only when Builder opens `Translations`, after successful Save, or during a bounded preparing-state recheck while the panel is open.
- `bob/components/TranslationsPanel.tsx`
  - is one global readiness answer + display-locale chooser + policy-derived lower-tier upsell; it does not expose per-locale readiness.
- `bob/components/Workspace.tsx`
  - accepts only the shared fully-ready locale set for translation preview selection; stale, partial, or incomplete locales do not stay selectable.
- `venice/app/e/[publicId]/route.ts`
  - remains the embed/reference truth for locale output semantics; do not fork Builder behavior away from it.

Do not turn any of the above into speculative cleanup.

---

## Current Status

The hot `75E` product path is green in code.

That means:

- `Save` still means one handoff of the instance to Tokyo-worker.
- Tokyo-worker owns post-save locale + runtime reconciliation.
- `Publish` / `Unpublish` still means only Tokyo's per-instance serve flag for Venice.
- Builder still has one read-only `Translations` surface with one overall status. `readyLocales` remains backend safety truth, but partial readiness is not a user-facing panel model.
- latest-save translation truth is closed:
  - older work items are deleted when a newer save becomes current
  - missing current generation output does not leak into `readyLocales`
- account locale changes now fan out across all account-owned saved instances
  - published instances refresh public serving truth too
  - unpublished instances refresh Builder/saved locale truth only
  - one broken saved widget no longer blocks healthy widgets

## Remaining Drift

The remaining drift is no longer the hot code path.

It is:

1. missing manual product verification for the latest-save and account-locale scenarios

## Next Step

Run the manual product checks before opening another feature slice:

1. save once -> `Translations` reflects the current save
2. save twice quickly -> only the newest save owns status/ready locales
3. add/remove account locale -> unpublished widgets pick up the new locale set without a fake content save
4. add/remove account locale -> published widgets refresh public serving truth too

The historical phase notes below remain as execution archive only. They are not the current contradiction gate.

---

## Actual Write Set
- `Execution_Pipeline_Docs/02-Executing/075E__ExecutionPlan__Localization_Must_Not_Tax_Every_Builder_Session.md`
- `documentation/capabilities/localization.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `bob/components/TranslationsPanel.tsx`
- `roma/lib/account-locales-sync.ts`
- `roma/app/api/account/instance/[publicId]/route.ts`

Read-only:

- `documentation/services/sanfrancisco.md`
- `documentation/strategy/Clickeen-Babel.md`
- `tokyo-worker/**`

Default rule: this step is manual verification first. Do not touch product code unless a manual check fails and the failure points to one narrow contradiction.

#### Current code truths to preserve

- latest-save translation truth is already closed in Tokyo/Tokyo-worker
- account locale fanout already reaches all account-owned saved instances
- published/unpublished is already Tokyo serve-state only
- Builder already reads one shared translations payload with one `readyLocales` set
- non-canonical docs no longer teach dead `layer=user` or safe-stale runtime behavior as active truth

Do not reopen or re-solve those.

#### Real gaps this slice must close

1. The current `75E` path is still mostly green only by static verification; the product scenarios above have not been run end to end.
2. If any of those scenarios fail, the next slice must stay narrow and fix only the named contradiction exposed by that scenario.

#### To-do list

1. Run the four manual product scenarios listed above.
2. Record whether each scenario is green or points at one narrow contradiction.
3. If a contradiction appears, open the smallest possible follow-up slice against that one contradiction only.
4. Keep the active canonical docs and hot-path code unchanged unless a scenario failure proves otherwise.

#### Explicit deletions in this slice

- Delete any remaining assumption that static `tsc`/lint success means the product path is fully green.

#### Stop conditions

Stop immediately if implementation starts doing any of the following:

- touching Roma/Bob/Tokyo-worker product code before a manual scenario actually fails
- reopening publish/unpublish semantics
- reintroducing Michael status
- reintroducing widget-catalog locale fanout
- widening a failure investigation into a generic cleanup pass

#### Done criteria

This slice is done when all of these are true:

- the next action is clearly manual verification, not speculative refactoring
- the product team can run the four named scenarios without guessing what “green” means
- any follow-up slice can be opened from one failed scenario instead of repo archaeology

#### Verification

Required verification for this slice:

- `pnpm exec tsc -p roma/tsconfig.json --noEmit`
- `pnpm exec tsc -p tokyo-worker/tsconfig.json --noEmit`
- `pnpm --filter @clickeen/roma lint`

Manual verification:

- save once -> `Translations` reflects the current save
- save twice quickly -> only the newest save owns status/ready locales
- add/remove account locale -> unpublished widgets pick up the new locale set without a fake content save
- add/remove account locale -> published widgets refresh public serving truth too

---

## Historical 75E Write Set

This file set is now historical `75E` execution context, not the next immediate slice:

- `tokyo-worker/src/domains/account-localization-state.ts`
- `tokyo-worker/src/domains/account-instance-sync.ts`
- `tokyo-worker/src/domains/render.ts`
- `tokyo-worker/src/routes/internal-render-routes.ts`
- `roma/lib/account-instance-translations.ts`
- `roma/lib/account-instance-direct.ts`
- `roma/lib/account-instance-sync.ts`
- `roma/app/api/account/instances/[publicId]/translations/route.ts`
- `roma/app/api/account/instance/[publicId]/route.ts`
- `roma/components/builder-domain.tsx`
- `bob/lib/session/sessionTypes.ts`
- `bob/lib/session/useSessionBoot.ts`
- `bob/lib/session/sessionTransport.ts`
- `bob/components/BuilderApp.tsx`
- `bob/components/ToolDrawer.tsx`
- `bob/components/TranslationsPanel.tsx`
- `bob/components/Workspace.tsx`
- `tokyo/widgets/shared/localeSwitcher.js`
- `tokyo/widgets/shared/previewL10n.js`
- `tokyo/widgets/faq/widget.client.js`
- `tokyo/widgets/countdown/widget.client.js`
- `tokyo/widgets/logoshowcase/widget.client.js`

If execution wants more files than this, stop and justify them against real product truth first.

---

## Phase 0A - Restore Incremental Overlay Sync After Save

Goal:
make save follow the incremental translation contract already promised by the PRD.

### Product behavior after this phase

- Save still means only `save this widget`.
- Save still hands translation work off asynchronously, but it does so by writing/updating one durable Tokyo overlay work item for the new `baseFingerprint` and then triggering queue delivery before the request completes.
- If enqueue fails after the base commit succeeded, Save still returns success and the durable work item remains the system-owned source of follow-up convergence truth for the current fingerprint.
- Tokyo-worker can now compare the previous saved base against the new saved base.
- Locales that already have overlay ops update only changed/removed translatable paths.
- Locales that do not yet have overlay ops still get a full first generation.
- Tiny copy edits no longer fan out into whole-widget translation work for already-synced locales.
- Tokyo sync no longer rediscoveries desired locales from Berlin on the save path; Roma passes the deterministic locale intent snapshot directly.

### Files To Change

#### 1. `roma/app/api/account/instance/[publicId]/route.ts`

Code this:

- keep the one boring save boundary
- pass previous saved-base identity plus deterministic locale intent into durable Tokyo overlay work creation after a successful save

Do not code:

- synchronous translation work inside Save
- Builder-owned diffing logic

#### 2. `roma/lib/account-instance-direct.ts`

Code this:

- return the previous saved `baseFingerprint` from the Tokyo saved-write boundary so Roma can hand that forward to sync

Do not code:

- route-side localization diffing
- a second source of saved l10n truth in Roma

#### 3. `roma/lib/account-instance-sync.ts`

Code this:

- thread optional previous saved-base identity and deterministic locale intent into the Tokyo work-item request
- keep Roma as the save-path trigger only; do not make Roma the owner of queue lifecycle or workflow truth

Do not code:

- client-side changed-path computation

#### 4. `tokyo-worker/src/routes/internal-render-routes.ts`

Code this:

- return previous saved-base identity from the saved-write route
- accept optional previous saved-base identity and deterministic locale intent on the sync route
- add a private enqueue route that writes/updates the durable Tokyo overlay work item and then enqueues only a locator job instead of relying on best-effort Roma callbacks

#### 5. `tokyo-worker/src/domains/account-instance-sync.ts`

Code this:

- diff previous saved base snapshot vs current saved base snapshot when previous identity is available
- derive `changedPaths` and `removedPaths` from those two saved bases
- reuse existing locale ops from the previous/current saved base when possible
- ask San Francisco only for changed work for locales that already have ops
- fall back to full generation only for locales that do not yet have ops or when previous diff input is genuinely unavailable
- consume Roma-owned locale intent directly instead of live-reading Berlin on the sync path
- expose one shared convergence function that the durable queue consumer runs against the work item for the current fingerprint

Do not code:

- whole-widget translation calls for tiny edits when reusable locale ops already exist
- Builder-side fallback logic to hide slow or stale overlays

#### 6. `tokyo-worker/src/domains/account-localization-state.ts`

Code this:

- pass `changedPaths` / `removedPaths` through to San Francisco

### Green Gate

Phase 0A is green only if all of the following are true:

- save can durably create/update overlay work for the current fingerprint with previous saved-base identity and locale intent
- base save no longer returns failure after a successful base commit just because overlay enqueue failed afterward
- Tokyo-worker diffs previous/current saved bases when that identity is available
- locales with existing ops no longer require a full-widget translation request for tiny edits
- locales without existing ops still get a full first generation
- Tokyo-worker sync no longer depends on Berlin reads or bearer-token auth on the sync path
- queue delivery is no longer the workflow truth; the Tokyo work item is
- Roma typecheck passes
- Tokyo-worker typecheck passes

---

## Phase 1 - Collapse The Translations Route To Status Truth

Goal:
make Tokyo-worker and Roma return only the panel truth `75E` actually needs.

### Product behavior after this phase

- Opening `Translations` still hits one Roma same-origin route.
- That route returns only:

```ts
{
  publicId: string
  widgetType: string
  baseLocale: string
  readyLocales: string[]
  translationOk: boolean
}
```

- The route does not return selected locale.
- The route does not return per-locale status rows.
- The route does not return switcher/runtime behavior.
- The route does not return translated output.
- The route does not return activated-but-not-ready locales.
- `readyLocales` contains only locales current for the current base fingerprint.
- the route exposes honest convergence state for that current fingerprint: `ok`, `updating`, or `failed`
- Opening `Translations` is a read-only status operation; it must not write or heal localization base/artifact state.

### Files To Change

#### 1. `tokyo-worker/src/domains/account-localization-state.ts`

Code this:

- keep existing internal status derivation
- collapse panel truth to one `translationOk: boolean`
- keep `baseLocale` and the current/ready locale set only
- ensure `baseLocale` is always included in `readyLocales`
- compute `translationOk=true` only when every account-activated locale is current for the current base fingerprint
- make `loadAccountLocalizationBaseContext()` read-only for panel/status consumers
- remove `ensureSavedRenderL10nBase()` from the panel/status read path
- if the saved document points to a missing/unreadable base snapshot for the current base fingerprint, fail at the Tokyo/Tokyo-worker boundary instead of silently writing one on read

Delete from the returned panel payload:

- `inspectionLocale`
- `localeStatuses`
- `localeBehavior`
- `activeLocales`

Do not add:

- translated text payloads
- preview-mode data
- selected-locale data

#### 2. `tokyo-worker/src/domains/render.ts`

Code this:

- expose or add a read-only way to load the saved base snapshot/fingerprint for panel/status consumers
- keep `ensureSavedRenderL10nBase()` available for save/sync paths that legitimately materialize the base

Do not code:

- a read helper that writes missing base state
- a compatibility layer that hides missing base state from Tokyo/Tokyo-worker consumers

#### 3. `roma/lib/account-instance-translations.ts`

Code this:

- replace the current payload type and validation with the new contract
- validate `translationOk`
- validate `readyLocales`
- fail invalid payloads instead of healing them

Delete:

- `inspectionLocale`
- `localeStatuses`
- `localeBehavior`
- `activeLocales`

#### 4. `roma/app/api/account/instances/[publicId]/translations/route.ts`

Keep this route thin.

Code this:

- continue forwarding one same-origin request through Roma
- return the new contract only

Do not add:

- route-side truth reconstruction
- route-side locale selection logic

### Green Gate

Phase 1 is green only if all of the following are true:

- the translations route returns only `publicId`, `widgetType`, `baseLocale`, `readyLocales`, `translationOk`
- selected/inspection locale is gone from the server contract
- per-locale status rows are gone from the server contract
- `localeBehavior` is gone from the server contract
- activated-but-not-ready locales are gone from the server contract
- `tokyo-worker/src/domains/account-localization-state.ts` no longer calls `ensureSavedRenderL10nBase()` on the panel/status read path
- Roma typecheck passes
- Tokyo-worker typecheck passes

### Verification

```bash
pnpm --filter @clickeen/roma exec tsc --noEmit
pnpm --filter @clickeen/tokyo-worker exec tsc --noEmit
pnpm --filter @clickeen/roma lint
rg -n "inspectionLocale|localeStatuses|localeBehavior|activeLocales" \
  tokyo-worker/src/domains/account-localization-state.ts \
  roma/lib/account-instance-translations.ts \
  'roma/app/api/account/instances/[publicId]/translations/route.ts'
rg -n "ensureSavedRenderL10nBase" \
  tokyo-worker/src/domains/account-localization-state.ts
```

Expected result:

- those names may still exist only where current code is being rewritten
- they must not survive in the final route contract for the panel
- `activeLocales` must not survive in the final route contract for the panel
- `ensureSavedRenderL10nBase` must not survive in the final panel/status read path

---

## Phase 2 - Rebuild Bob Around Editing Gating And One Overlay Locale

Goal:
make Bob honest:

- editing mode = base content only
- `Translations` = overlay inspection only
- one preview surface throughout

### Product behavior after this phase

- Opening `Translations` lazy-loads the new Roma route.
- `Translations` shows one global translation-health answer and one locale dropdown.
- Outside `Translations`, preview is locked to `baseLocale`.
- Outside `Translations`, clicking the in-widget switcher shows:
  - `Translations not available while in editing mode. Preview translations in Translations panel.`
- Leaving `Translations` returns preview to `baseLocale`.

### Files To Change

#### 1. `roma/components/builder-domain.tsx`

Code this:

- source `baseLocale` from existing Roma current-account locale policy
- thread that `baseLocale` into the existing `ck:open-editor` bootstrap message
- remove dead request-locale plumbing from the `load-translations` host bridge

Do not code:

- a new route just to learn `baseLocale`
- a second Builder bootstrap path

#### 2. `bob/lib/session/sessionTypes.ts`

Code this:

- make `baseLocale` explicit in the Bob open/bootstrap types
- make `baseLocale` explicit in Bob session meta/chrome truth

Do not leave `baseLocale` as unnamed/floating generic payload data.

#### 3. `bob/lib/session/useSessionBoot.ts`

Code this:

- store the bootstrapped `baseLocale` when Roma opens Bob

Do not make the `Translations` panel the way Bob learns `baseLocale`.

#### 4. `bob/lib/session/sessionTransport.ts`

Code this:

- simplify `loadTranslations` to a status-only panel read
- remove request-locale input from the Bob transport type for this route

#### 5. `bob/components/BuilderApp.tsx`

Code this:

- own `previewMode: 'editing' | 'translations'`
- own one `overlayPreviewLocale`
- reset both when `publicId` changes

Delete:

- current `inspectionLocale` state

#### 6. `bob/components/ToolDrawer.tsx`

Code this:

- `activePanel === 'translations'` means `previewMode='translations'`
- every other Builder panel means `previewMode='editing'`
- pass `overlayPreviewLocale` only to the `Translations` panel

Delete:

- current `previewLocale` prop path

#### 7. `bob/components/TranslationsPanel.tsx`

Rebuild this file against current code truth.

Code this:

- use `useWidgetSessionTransport()`, not `useWidgetSession()` for `loadTranslations`
- read only the Phase 1 server contract
- render one translation-health answer
- render one locale dropdown
- unlock that dropdown only when `translationOk` is true; do not show partial per-locale readiness
- show policy-derived lower-tier language upsell copy
- change only Bob-local `overlayPreviewLocale`
- stay read-only

Do not code:

- translated text output inside the panel
- per-locale status rows
- per-locale editing
- panel-owned preview rendering

#### 8. `bob/components/Workspace.tsx`

Code this:

- accept `previewMode`, `baseLocale`, and `overlayPreviewLocale`
- compute one `effectivePreviewLocale`
  - editing mode => `baseLocale`
  - translations mode => `overlayPreviewLocale`
- send that locale through the existing `ck:state-update` message
- keep using the same preview surface
- ensure `overlayPreviewLocale` is always a member of `readyLocales` when `previewMode='translations'`

Do not code:

- a second preview surface
- a second locale state for the iframe
- a Bob-side branch for not-ready locale artifacts

### Green Gate

Phase 2 is green only if all of the following are true:

- Bob bootstraps `baseLocale` through the existing Roma -> Bob open path
- `TranslationsPanel.tsx` uses `useWidgetSessionTransport()`
- outside `Translations`, preview stays on `baseLocale`
- leaving `Translations` returns preview to `baseLocale`
- incomplete locales are not present in the Builder locale chooser path
- the panel does only the 2 allowed visible jobs
- Bob typecheck passes
- Bob lint passes except unrelated pre-existing warnings
- Roma typecheck still passes after the host-bridge cleanup

### Verification

```bash
pnpm --filter @clickeen/bob exec tsc --noEmit
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma exec tsc --noEmit
rg -n "inspectionLocale|previewLocale" \
  bob/components/BuilderApp.tsx \
  bob/components/ToolDrawer.tsx \
  bob/components/TranslationsPanel.tsx \
  bob/components/Workspace.tsx
```

Manual product check:

1. Open Builder on a localized widget.
2. Stay in `Content`.
   Expected:
   - preview shows base content only
3. Open `Translations`.
   Expected:
   - panel lazy-loads once
   - panel shows one translation-health answer
   - panel shows one locale dropdown
   - dropdown shows only current/ready locales
4. Leave `Translations`.
   Expected:
   - preview returns to `baseLocale`

---

## Phase 3 - Make The Shared Runtime Switcher Host-Controlled In Bob

Goal:
keep one Tokyo/embed-aligned display path and make locale switching in Bob honest without teaching consumers to cope with incomplete artifacts.

### Exact Seam To Build

`Workspace` already sends `ck:state-update` into the iframe.
This slice extends that same path. It does not build a second preview system.

Add `previewMode` to the runtime context Bob sends into the iframe.

Use these exact iframe -> host messages:

- `ck:preview-locale-switch-blocked`
- `ck:preview-locale-change-request`

`ck:preview-locale-change-request` must carry the requested locale token.
That token must already belong to the ready locale set. Missing-artifact selection is not a supported state.

### Files To Change

#### 1. `bob/components/Workspace.tsx`

Code this:

- include `previewMode` in the existing `ck:state-update` payload
- listen for:
  - `ck:preview-locale-switch-blocked`
  - `ck:preview-locale-change-request`
- on blocked message:
  - show the exact product copy
- on locale-change request while `previewMode='translations'`:
  - update Bob-local `overlayPreviewLocale`

Do not code:

- iframe-local truth that bypasses Bob

#### 2. `tokyo/widgets/shared/localeSwitcher.js`

Code this:

- if `runtimeContext.previewMode` is absent:
  - keep live/embed behavior unchanged
- if `runtimeContext.previewMode === 'editing'`:
  - do not mutate `window.location`
  - post `ck:preview-locale-switch-blocked`
- if `runtimeContext.previewMode === 'translations'`:
  - do not mutate `window.location`
  - post `ck:preview-locale-change-request`

Do not code:

- Bob-only locale fallback
- Bob-only repair logic

#### 3. `tokyo/widgets/faq/widget.client.js`

#### 4. `tokyo/widgets/countdown/widget.client.js`

#### 5. `tokyo/widgets/logoshowcase/widget.client.js`

Code this in all three shipped widget clients:

- pass `previewMode` through their existing preview/runtime context
- thread `previewMode` into `CKLocaleSwitcher.applyLocaleSwitcher(...)`
- do not add widget-specific switcher behavior

#### 6. `tokyo/widgets/shared/previewL10n.js`

Code this:

- keep reading locale overlays from Tokyo
- stop silently returning `baseState` when locale artifacts are unavailable
- stop modeling missing locale artifacts as a supported consumer path
- treat missing locale artifacts as an invariant break, not as selectable preview behavior

Non-negotiable rule:

- silent base-locale substitution is forbidden
- Builder preview must assume ready locales are current

### Green Gate

Phase 3 is green only if all of the following are true:

- outside `Translations`, clicking the switcher shows the exact blocked copy and does not change locale
- inside `Translations`, the panel dropdown and widget switcher both change the same `overlayPreviewLocale`
- both controls drive the same preview result
- Builder preview still uses the Tokyo/embed locale display path
- silent base-state fallback is gone
- incomplete locales are not exposed in the dropdown or switcher

### Verification

```bash
pnpm --filter @clickeen/bob exec tsc --noEmit
rg -n "window\\.location\\.href|window\\.location =" tokyo/widgets/shared/localeSwitcher.js
rg -n "return baseState" tokyo/widgets/shared/previewL10n.js
```

Manual product check:

1. Stay in `Content`, click the widget locale switcher.
   Expected:
   - `Translations not available while in editing mode. Preview translations in Translations panel.`
   - locale does not change
2. Open `Translations`, change locale from the panel.
   Expected:
   - main preview changes locale
3. While still in `Translations`, change locale from the widget switcher.
   Expected:
   - panel dropdown stays in sync
   - main preview shows the same locale output

---

## Phase 4 - Final Verification

Goal:
prove the old mixed-mode flow is gone.

### End-State Truths

These statements must all be true:

- The server contract returns only `publicId`, `widgetType`, `baseLocale`, `readyLocales`, `translationOk`.
- Bob has one preview surface only.
- Any non-`Translations` panel is editing mode and preview stays on `baseLocale`.
- `Translations` is read-only overlay inspection only.
- The panel does not render translated widget text as its own surface.
- Outside `Translations`, the widget locale switcher is blocked with the exact product copy.
- Inside `Translations`, the panel dropdown and widget switcher are two controls for one `overlayPreviewLocale`.
- The panel does not show readiness by language; it shows whether translations are ready or not.
- Lower-tier users see language upsell copy derived from account policy.
- Builder preview uses the Tokyo/embed display path when locale switching is allowed.
- incomplete locales are not selectable/renderable until Tokyo/Tokyo-worker mark them current for the active base fingerprint.
- Save still means save.
- Publish still means publish.

### Final Commands

```bash
pnpm --filter @clickeen/roma exec tsc --noEmit
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/bob exec tsc --noEmit
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/tokyo-worker exec tsc --noEmit

rg -n "inspectionLocale|localeStatuses|localeBehavior|activeLocales" \
  roma/lib/account-instance-translations.ts \
  tokyo-worker/src/domains/account-localization-state.ts \
  bob/components/TranslationsPanel.tsx

rg -n "best-available|one active locale at a time|Switching locale changes the active editing context" \
  documentation/architecture/CONTEXT.md \
  documentation/architecture/Tenets.md
```

### Final Manual Product Scenarios

1. Open Builder and stay in `Content`.
   Expected:
   - preview shows base content only
   - switcher click is blocked with the exact copy

2. Open `Translations`.
   Expected:
   - one translation-health answer
   - one locale dropdown
   - dropdown contains only current/ready locales
   - same preview surface, now allowing overlay inspection

3. Change locale from the panel dropdown.
   Expected:
   - preview switches locale

4. Change locale from the widget switcher while still in `Translations`.
   Expected:
   - panel stays in sync
   - preview stays on the same selected locale

5. Leave `Translations`.
   Expected:
   - preview returns to `baseLocale`

6. Save after editing base content.
   Expected:
   - save path still behaves the same
   - translation follow-up remains background system work

---

## What Must Not Be Coded

Do not code any of the following:

- a second preview surface
- a second locale renderer
- translated text output inside the panel
- per-locale editing
- user-facing pipeline taxonomy
- Bob-side translation truth reconstruction
- a new localization client store
- a generic localization SDK in Bob
- iframe-local locale truth that bypasses Bob
- locale switching while editing
- any best-available or heal-on-click behavior
- any product-path handling that assumes a user can choose a locale whose artifact is not current
- any compatibility path for the old translations payload

---

## Bottom Line

`075E` is not a localization-platform rewrite.

It is four concrete moves:

1. Collapse the translations route to status truth only.
2. Rebuild Bob around one preview surface, explicit editing gating, and one overlay preview locale drawn only from ready truth.
3. Make the shared runtime switcher host-controlled in Bob while keeping the Tokyo/embed display path and the “ready locales only” invariant.
4. Prove the old mixed-mode flow is gone.

That is the execution plan.
