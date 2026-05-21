# EXEC 103_03 - Translation Generation Job State

Status: Planning Hold / Superseded By `103_DB_Pivot`
Owner: Product + Architecture
Date: 2026-05-21
PRD: `103_03__PRD__Translation_Generation_Job_State.md`

## 2026-05-21 Execution Hold

This execution ledger is paused and moved back to planning. The slice produced useful behavior and tests, but its storage-backed job-state primitive is not the final architecture. `103_DB_Pivot` owns the next execution pass and must move translation generation job state into Supabase-backed product rows before PRD 103 resumes.

## Execution Rule

Execute one slice at a time. Do not move to the next slice until the current slice has code, tests, docs, and verification evidence.

This PRD exists because human smoke proved Bob can show "Generating translations..." while no Generate command reaches Tokyo and no San Francisco translation job runs.

## Slice 103_03.1 - Current-State Proof And Contract Lock

Status: Green

Goal: lock the actual product contract before implementation.

Evidence to attach:

- Current failing FAQ instance state: one changed FAQ question, 14 ready locales, 14 missing changed-question locales.
- Current route/tail proof: polling `GET /translations` without `POST /translations/generate`.
- Current code references showing Bob local generating state, Roma command forwarding, Tokyo Generate, San Francisco terminal failure behavior.
- Final choice of Tokyo-owned job-state primitive.

Do not close until the surviving authority is named:

```text
Tokyo owns translation generation job state.
Bob owns display only.
Roma owns account/session boundary only.
San Francisco owns text production and terminal outcome reporting only.
```

### 103_03.1 Evidence

Human smoke instance:

```text
accountPublicId: 00000001
instanceId: UZ3JEJSHII
widget: faq
editable content fields: 12
changed content field: sections.0.faqs.0.question
ready locales: 14
missing changed-question locales: 14
invalid partial state: some localeStatus entries said ok while translatedValues had no string
```

Runtime proof captured during smoke:

```text
Tokyo received repeated GET /__internal/instances/UZ3JEJSHII/translations
Tokyo did not receive POST /__internal/instances/UZ3JEJSHII/translations/generate for the stuck click
San Francisco did not receive queue work for that stuck click
Bob still showed Generating translations...
```

Current code references:

```text
bob/src/components/TranslationsPanel.tsx
  Owns local "generation in progress" display state and polls translated-locale readiness.

roma/app/api/account/instances/[instanceId]/translations/generate/route.ts
  Owns account/session forwarding only. It must not compute jobs or inspect storage.

tokyo-worker/src/domains/render/translation-operations.ts
  Computes the saved-content delta and currently queues San Francisco work, but has no persisted/current job state.

sanfrancisco/src/instance-translation-queue.ts
  Produces translated locale values and reports success, but permanent failure is not product-visible Tokyo job state yet.
```

Locked primitive:

```text
Tokyo persists one private current job document:
accounts/{accountPublicId}/instances/{instanceId}/translation-generation-job.json
```

This object is not public product vocabulary and is not read by Bob, Roma, or San Francisco directly. It is only accessed through the product operations named in the PRD.

Verification:

```text
git diff --check
```

## Slice 103_03.2 - Tokyo Job State Operation

Status: Green

Goal: add the Tokyo-owned generation job operation.

Required behavior:

- `generateTranslations(instanceId)` creates, resumes, or supersedes one current job for the instance.
- `readTranslationGeneration(instanceId)` returns job status and progress.
- Repeated Generate for the same unresolved delta does not enqueue duplicate locale jobs.
- Generate after newer saved base content supersedes old work.
- `localeStatus: ok` without string value is not ready.

Verification:

- Tokyo-worker unit tests for create/resume/supersede.
- Tokyo-worker unit tests for the FAQ `14/28` changed-question case.
- Tokyo-worker unit tests for invalid `ok` without value.
- Typecheck.

### 103_03.2 Evidence

Implemented:

```text
tokyo-worker/src/domains/render/translation-generation-state.ts
tokyo-worker/src/domains/render/translation-operations.ts
tokyo-worker/src/routes/internal-render-routes.ts
```

Tokyo now owns one current generation job per instance behind:

```text
GET /__internal/instances/{instanceId}/translations/generation
POST /__internal/instances/{instanceId}/translations/generate
PUT /__internal/instances/{instanceId}/translations/{locale}/complete
```

Proved behavior:

- Generate creates a current Tokyo job and queues locale work.
- Repeated Generate for the same unresolved active job returns the current job and does not enqueue duplicates.
- Generate after newer saved base content supersedes old active work and queues from latest saved content.
- Old active completions are rejected when the current job has been superseded.
- `localeStatus: ok` without a translated string is treated as missing.
- Generation progress can be read from Tokyo job state.

Verification:

```text
pnpm --filter @clickeen/tokyo-worker test
# 41/41 passing

pnpm --filter @clickeen/tokyo-worker typecheck
# passing

git diff --check
# passing
```

## Slice 103_03.3 - San Francisco Terminal Outcome Reporting

Status: Green

Goal: make San Francisco report every terminal locale outcome to Tokyo.

Required behavior:

- Completion success updates translated values through Tokyo.
- Stale/superseded completion is reported.
- Provider/model failure is reported.
- Validation failure is reported.
- Retry exhausted is reported.
- Permanent failure is product-visible through Tokyo job state.

Verification:

- San Francisco queue tests for success, stale, validation failure, provider failure, and retry exhaustion.
- Tokyo completion/failure route tests.
- Typecheck.

### 103_03.3 Evidence

Implemented:

```text
tokyo-worker/src/domains/render/translation-operations.ts
tokyo-worker/src/routes/internal-render-routes.ts
sanfrancisco/src/tokyo-translation-client.ts
sanfrancisco/src/instance-translation-queue.ts
```

Tokyo now accepts a terminal failure report through:

```text
PUT /__internal/instances/{instanceId}/translations/{locale}/fail
```

San Francisco now reports terminal provider/model/validation/retry-exhausted outcomes to Tokyo before acking a permanently failed queue message. If reporting the terminal outcome to Tokyo fails, the queue message is retried instead of being silently acknowledged.

Verification:

```text
pnpm --filter @clickeen/tokyo-worker test
# 42/42 passing

pnpm --filter @clickeen/sanfrancisco test
# 12/12 passing

pnpm --filter @clickeen/tokyo-worker typecheck
# passing

pnpm --filter @clickeen/sanfrancisco typecheck
# passing
```

## Slice 103_03.4 - Bob/Roma Product UX Wiring

Status: Green

Goal: Bob reads Tokyo job state and never spins from local state alone.

Required behavior:

- Bob enters generating state only after Tokyo accepts or returns an active job.
- Bob polls job state, not translated-locale inventory alone.
- Bob still shows ready translated locales from Tokyo inventory.
- Bob shows failed locales and retry/regenerate path when job state fails.
- Roma only forwards account-authenticated product commands and reads.

Verification:

- Bob unit tests for accepted, existing active job, failure, superseded/restarted, and no indefinite spinner.
- Roma route/client tests for Generate and job read.
- Typecheck/lint.

### 103_03.4 Evidence

Implemented:

```text
roma/lib/account-instance-translations.ts
roma/app/api/account/instances/[instanceId]/translations/generation/route.ts
roma/components/builder-domain.tsx
bob/lib/session/sessionTypes.ts
bob/lib/session/sessionTransport.ts
bob/lib/session/WidgetDocumentSession.tsx
bob/components/TranslationsPanel.tsx
```

Bob no longer treats `accepted: true` alone as proof that generation is active. It requires Tokyo job state with `queued` or `running` status. Bob polls `readTranslationGeneration(instanceId)` while active and uses the returned Tokyo job summary for progress, failed status, and completion messages.

Roma remains a product-operation proxy. It forwards:

```text
POST /api/account/instances/{instanceId}/translations/generate
GET /api/account/instances/{instanceId}/translations/generation
```

Verification:

```text
pnpm --filter @clickeen/bob typecheck
# passing

pnpm --filter @clickeen/roma typecheck
# passing

pnpm --filter @clickeen/bob test
# 18/18 passing

pnpm --filter @clickeen/roma test
# 5/5 passing

git diff --check
# passing
```

## Slice 103_03.5 - Data Repair And Guard

Status: Green

Goal: prevent old invalid partial translated-locale state from surviving.

Required behavior:

- Product runtime treats `ok` without translated string as missing.
- Completion writes value and status atomically.
- Optional repair-only operator command can normalize existing invalid current content.
- No runtime compatibility mode silently heals product truth into a new normal.

Verification:

- Tokyo-worker tests for invalid partial state.
- Repair tool dry-run/output proof if implemented.
- Documentation update explaining the invariant.

### 103_03.5 Evidence

No new repair sidecar was added. The surviving invariant is enforced at the Tokyo product boundary:

```text
translated locale ready = every editable content path has localeStatus[locale] = ok
                          and translatedValues[locale] is a string
```

Invalid partial state (`ok` without a string) is not ready, is not returned in translated locale inventory, is not readable as locale values, and is picked up by Generate as missing work. Completion writes status and value atomically through Tokyo content update.

Verification:

```text
pnpm --filter @clickeen/tokyo-worker test
# 42/42 passing

pnpm --filter @clickeen/tokyo-worker typecheck
# passing
```

Docs:

```text
documentation/architecture/CONTEXT.md
```

## Slice 103_03.6 - End-To-End Verification

Status: Automated Green / Human Smoke Pending

Goal: prove the product path no longer stalls.

Required proof:

```text
Roma opens FAQ instance.
One FAQ question is changed and saved.
Translations panel Generate sends POST through Roma to Tokyo.
Tokyo creates/returns job state.
San Francisco consumes locale jobs.
Tokyo records success/failure/stale terminal outcomes.
Bob shows deterministic progress.
The instance reaches 28/28 or shows visible failed locales.
No indefinite spinner.
```

Verification:

- Automated integration proof where practical.
- Human smoke evidence after automated checks pass.
- Docs and execution ledger updated before closure.

### 103_03.6 Evidence

Automated product proof is green across the affected services:

```text
pnpm --filter @clickeen/tokyo-worker test
# 42/42 passing

pnpm --filter @clickeen/sanfrancisco test
# 12/12 passing

pnpm --filter @clickeen/bob test
# 18/18 passing

pnpm --filter @clickeen/roma test
# 5/5 passing

pnpm --filter @clickeen/tokyo-worker typecheck
# passing

pnpm --filter @clickeen/sanfrancisco typecheck
# passing

pnpm --filter @clickeen/bob typecheck
# passing

pnpm --filter @clickeen/roma typecheck
# passing

pnpm --filter @clickeen/bob lint
# passing

pnpm --filter @clickeen/roma lint
# passing

git diff --check
# passing
```

Human smoke remains the release gate because this workspace cannot truthfully prove a deployed click path from the terminal alone. Required smoke:

```text
Open Roma/Bob FAQ instance.
Edit one FAQ string and save.
Open Translations panel and click Generate.
Confirm Bob shows Tokyo job-state progress, not a local spinner.
Confirm Tokyo receives POST /translations/generate and GET /translations/generation.
Confirm San Francisco consumes locale jobs.
Confirm Bob reaches completed ready count or visible failed locale state.
Confirm no indefinite generating state.
```

## Do Not Proceed Gates

- Do not continue PRD 103 runtime slices while 103_03 is open.
- Do not add broad workflow framework code before the Tokyo-owned primitive is named.
- Do not use Bob local state, San Francisco telemetry, storage object presence, or translated-locale inventory alone as generation job truth.
- Do not reintroduce `sourceVersion`, `language-generation.json`, `languageSource`, overlay IDs, selected pointers, or generation lanes.
