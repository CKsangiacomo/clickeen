# 075E Execution Plan - Localization Must Not Tax Every Builder Session

Status: READY TO EXECUTE  
Date: 2026-03-23  
Owner: Product Dev Team  
References:
- `Execution_Pipeline_Docs/02-Executing/075E__PRD__Localization_Must_Not_Tax_Every_Builder_Session.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/services/roma.md`

---

## What This Doc Is

This file is the coding order for the current repo state.

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

---

## Code Truth Already Green

These are current code truths. They are not planned work for `075E`.

- `roma/app/api/account/instance/[publicId]/route.ts`
  - Save already hands off async translation convergence with `runAccountInstanceSync(... live: false)` after successful save.
- `bob/lib/session/WidgetDocumentSession.tsx`
  - `loadTranslations` already lives in transport context, not `WidgetDocumentSessionValue`.
- `bob/lib/session/useWidgetSession.tsx`
  - already re-exports `useWidgetSessionTransport`.
- `venice/app/e/[publicId]/route.ts`
  - remains the embed/reference truth for locale output semantics; do not fork Builder behavior away from it.

Do not turn any of the above into speculative cleanup.

---

## Remaining Real Gaps

These are the actual remaining problems in the current codebase:

1. The translations panel route still returns too much product surface: `inspectionLocale`, per-locale `localeStatuses`, `localeBehavior`, and `activeLocales` instead of current/ready locale truth.
2. Bob is mid-rewire and not coherent:
   - `BuilderApp.tsx` uses `inspectionLocale`
   - `ToolDrawer.tsx` and `Workspace.tsx` still expect `previewLocale`
   - `TranslationsPanel.tsx` calls `session.loadTranslations` from the wrong hook surface
3. Bob does not yet carry explicit `baseLocale` bootstrap truth for preview locking; that truth currently lives in Roma current-account context and must be threaded once through the existing Bob open flow.
4. The shared locale switcher in `tokyo/widgets/shared/localeSwitcher.js` still self-navigates the iframe URL.
5. `tokyo/widgets/shared/previewL10n.js` still treats missing locale artifacts as normal consumer control flow instead of as an invariant break.
6. `loadAccountLocalizationBaseContext()` still calls `ensureSavedRenderL10nBase()` on the read path, which can write missing base snapshot state during a panel/status read instead of failing at the Tokyo/Tokyo-worker boundary.

---

## Actual Write Set

This slice should stay inside this file set:

- `tokyo-worker/src/domains/account-localization-state.ts`
- `tokyo-worker/src/domains/render.ts`
- `roma/lib/account-instance-translations.ts`
- `roma/app/api/account/instances/[publicId]/translations/route.ts`
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
- drive that dropdown from `readyLocales` only
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
