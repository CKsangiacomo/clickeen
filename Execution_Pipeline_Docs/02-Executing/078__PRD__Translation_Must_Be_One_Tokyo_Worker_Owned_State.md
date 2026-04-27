# 078 PRD - Translation Must Be One Tokyo-Worker-Owned State

Status: READY FOR EXECUTION
Owner: Tokyo-worker, Roma Builder save, Bob translations panel, San Francisco generation
Priority: P0
Date: 2026-04-27

## 1. The Problem

Translation is a core Clickeen product promise. Today it is not simple enough to be reliable.

The current system spreads translation truth across too many places:

- Roma account language settings.
- Roma Builder save.
- Tokyo-worker saved widget l10n summary.
- Tokyo-worker overlay work items.
- Tokyo-worker queues.
- San Francisco generation.
- Bob translation panel readiness checks.
- Published/live text pack pointers.

That means a user can save a widget, see a success response, and still have translation silently fail later. It also means Bob has to guess whether translations are ready by reading scattered signals instead of one clear state.

This PRD fixes the product architecture, not only one bug.

## 2. Product Truth

Clickeen translation must work like this:

1. Account languages belong to the account.
2. Builder edits one widget in one active base locale at a time.
3. After save, translation generation is async follow-up work.
4. Async does not mean invisible or best-effort.
5. Tokyo-worker owns the translation state for each saved widget revision.
6. Bob reads that Tokyo-worker state.
7. Publish uses that Tokyo-worker state.
8. Queues are internal machinery only. They are not product truth.
9. San Francisco generates translation ops. It does not own account translation state.

The surviving authority is:

**Tokyo-worker translation state per widget revision.**

Everything else either writes that state, reads that state, or becomes internal machinery.

## 3. Current Broken Flow

Current code shows the break clearly:

- `roma/app/api/account/instance/[publicId]/route.ts` saves the widget, then tries to enqueue translation work. If enqueue fails, the route logs the error and still returns success.
- `roma/lib/account-locales-sync.ts` loops instances and logs per-instance enqueue failures as warnings.
- `tokyo-worker/src/domains/account-localization-state.ts` calls San Francisco generation through an internal service token and treats generated ops, work items, saved summaries, and live pointers as separate signals.
- `bob/components/TranslationsPanel.tsx` hides or shows locale choices based on derived readiness instead of one authoritative translation state.

This is why the product can look like it accepted translation work while the actual translation path is broken.

## 4. What Must Change

Create one Tokyo-worker-owned translation state for each saved widget revision.

The state must answer simple questions:

- What widget revision is this?
- What is the base locale?
- What account locales are requested?
- Has translation work been accepted?
- Is generation working?
- Which locales are ready?
- Which locales failed?
- What error should the product show or log?

Suggested shape:

```ts
type WidgetTranslationState = {
  v: 1;
  publicId: string;
  accountId: string;
  widgetType: string;
  baseLocale: string;
  requestedLocales: string[];
  baseFingerprint: string;
  generationId: string;
  status: "accepted" | "working" | "ready" | "failed";
  readyLocales: string[];
  failedLocales: Array<{
    locale: string;
    reasonKey: string;
    detail?: string;
  }>;
  updatedAt: string;
};
```

Exact storage key can be chosen during implementation, but the rule is fixed:

**Builder, account settings, queues, publish, and public artifact generation must all converge on this one Tokyo-worker state.**

## 5. User-Facing Behavior

When a user saves a widget:

- Roma must save the base widget.
- Tokyo-worker must accept translation state for the current widget revision.
- If translation state cannot be accepted, the save must not pretend everything is fine.
- LLM generation can remain async.
- The UI can say translations are being prepared only after Tokyo-worker has durably accepted the work.

When a user opens Builder:

- Bob asks Tokyo-worker for translation state.
- Bob does not infer readiness from live pointers, queue rows, saved l10n summaries, or local guesses.
- Older saved widgets that existed before this state file must not show fake unavailable. Tokyo-worker may bootstrap the missing state once from its own saved pointer plus matching text pointers, persist that state, and then return the state.
- If translation is accepted or working, the panel shows that state.
- If translation failed, the panel shows a clean failure state.
- If translation is ready, locales are available.

When a widget is published:

- Publish uses the same Tokyo-worker state.
- Publish cannot invent ready locales.
- Public artifacts are serving artifacts, not the source of product truth.

## 6. Non-Goals

This PRD does not:

- Make LLM translation synchronous inside the user save request.
- Move translation ownership into Roma.
- Move translation ownership into Bob.
- Move translation ownership into San Francisco.
- Add another readiness layer on top of the current system.
- Preserve overlay work items as a product-facing truth source.
- Keep swallowed translation failures as acceptable save success.

## 7. Deletion And Replacement Candidates

These are deletion or replacement targets during execution:

- The warning-only translation enqueue catch in `roma/app/api/account/instance/[publicId]/route.ts`.
- The warning-only fanout behavior in `roma/lib/account-locales-sync.ts`.
- Bob readiness logic that treats missing scattered signals as "preparing" or "unavailable" without reading one Tokyo-worker state.
- Tokyo-worker Builder status logic that derives product readiness from saved l10n summary plus live text pointers plus work items.
- Any product-facing dependency on overlay work items as the source of translation status.
- Any product-facing dependency on public/live artifacts as the source of Builder translation truth.
- Documentation that describes queues, work items, or text pointers as the product translation state.

Queues may remain only as internal execution machinery.

## 8. Execution Plan

Each cut must be green before moving to the next one.

### Cut 0 - Prove Current Failure

Inspect the live cloud-dev path and identify the exact failing link.

Required proof:

- A saved widget with multiple account locales.
- The save response.
- The Tokyo-worker translation state or missing state.
- The San Francisco generation call result.
- The Bob translation panel response.

Do not guess from local env only.

Green gate:

- Current failure is documented with request/response evidence.
- We know whether the immediate break is enqueue, Tokyo-worker state, San Francisco auth, generation, artifact write, or Bob read.

### Cut 1 - Add The Tokyo-Worker State Module

Add a small Tokyo-worker module that can write and read `WidgetTranslationState`.

Rules:

- No UI changes yet.
- No Roma behavior change yet.
- No queue truth exposed.
- State is tied to `publicId`, `accountId`, and `baseFingerprint`.

Green gate:

- Unit or integration test proves write/read/update of translation state.
- Typecheck passes.

### Cut 2 - Make Save Accept Translation State

Update the real Roma Builder save path so success means:

- base widget saved, and
- translation state accepted by Tokyo-worker.

Rules:

- Do not swallow translation acceptance failure.
- Do not hide the failure behind a generic success response.
- Do not run LLM generation in the save HTTP request.

Green gate:

- A failing Tokyo-worker translation acceptance produces a visible save failure.
- A successful save creates or updates one Tokyo-worker translation state.

### Cut 3 - Make Queue/Generation Update The Same State

Update async generation so it only moves the Tokyo-worker state forward:

- `accepted` to `working`.
- `working` to `ready`.
- `working` to `failed`.

Rules:

- San Francisco returns generated ops only.
- Tokyo-worker writes the state.
- Queue records are not read as product state.

Green gate:

- Successful generation marks requested locales ready.
- Failed generation marks failed state with a reason.
- Retry does not create a second product truth.

### Cut 4 - Make Bob Read Only The State

Update Builder translations UI/API to consume the Tokyo-worker translation state.

Rules:

- Bob does not infer readiness from saved summaries, live pointers, queue rows, or local fallback rules.
- Bob can render only these states: accepted, working, ready, failed.

Green gate:

- Builder panel reflects the state payload exactly.
- Search confirms old product-facing readiness inference is deleted.

### Cut 5 - Make Publish Use The Same State

Update publish path so ready locales come from the same Tokyo-worker state.

Rules:

- Publish cannot create locale truth independently.
- Public artifacts remain serving output only.

Green gate:

- A ready locale publishes.
- A non-ready locale does not publish as ready.
- Public runtime serves the expected locale artifact after publish.

### Cut 6 - Fix Account Locale Changes

Update account language changes so they update translation state for existing widgets.

Rules:

- Account settings cannot silently skip instances.
- Per-instance failures must be visible to the product path or returned as an explicit failure summary.
- Do not add another fanout status system.

Green gate:

- Adding an account locale creates or updates state for affected widgets.
- Removing an account locale removes it from requested locales.
- Failures are not logged-only.

### Cut 7 - Delete Old Product Truth

Delete or demote old paths after the new state is live.

Required searches:

```bash
rg "overlay sync enqueue failed after save|account_locales_sync_failed|tokyo_saved_l10n_summary_missing|tokyo_saved_text_base_missing" roma bob tokyo-worker documentation
rg "readOverlayWorkItem|writeOverlayWorkItem|transitionOverlayWorkItemState" tokyo-worker bob roma documentation
rg "translationOk|translationState" bob roma tokyo-worker
```

Green gate:

- Old product-facing truth is gone.
- Remaining queue/work-item references are clearly internal executor code.
- Documentation names Tokyo-worker translation state as the product truth.

### Cut 8 - Cloud-Dev End-To-End Verification

Run the real product path in cloud-dev.

Required scenario:

1. Account has base locale plus at least one additional locale.
2. User opens Roma Builder.
3. User saves a widget.
4. Tokyo-worker records accepted translation state.
5. Async generation moves state to ready or failed.
6. Bob translation panel reads that same state.
7. Publish serves ready locale artifacts.

Green gate:

- Evidence is captured for each step.
- No hidden local-only secret or local-only service path is required.

## 9. Verification Commands

At minimum, execution must run:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/tokyo-worker typecheck
git diff --check
```

If app-specific scripts differ, use the repo's actual package scripts and record the exact commands.

Deployment verification must include:

- Roma save route.
- Tokyo-worker translation state endpoint.
- San Francisco generation path.
- Bob Builder translations panel endpoint.
- Published widget locale artifact.

## 10. Execution Tenets

Do not drift from these rules:

- Delete broken product truth. Do not wrap it.
- One translation state owner: Tokyo-worker.
- One Builder read path: the Tokyo-worker state.
- One publish source: the Tokyo-worker state.
- No best-effort success for translation acceptance.
- No hidden local-only auth path.
- No new generic framework.
- No fake "preparing" state unless work was actually accepted.
- No product logic branching on queue internals.
- No product logic branching on public artifact existence as readiness.
- No save-time LLM blocking.

The target is not more checks.

The target is fewer places where translation truth can disagree.

## 11. Documentation To Update During Execution

Update these docs when behavior changes:

- `documentation/capabilities/localization.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/architecture/CONTEXT.md` if the architecture summary changes.

Docs must say the same simple thing as the code:

**Tokyo-worker owns translation state. Everything else reads or writes that state.**
