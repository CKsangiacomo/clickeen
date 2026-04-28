# 080 PRD - Account Widget L10n Generation Private Worker Boundary

Status: READY FOR EXECUTION
Owner: Tokyo-worker, San Francisco, Roma/Bob translation status surface
Priority: P0
Date: 2026-04-28

## 1. Product Truth

Account widget translation belongs to one account-owned instance.

The surviving storage truth is:

```txt
accounts/<accountId>/instances/<publicId>/l10n/...
```

Tokyo-worker owns that truth.

San Francisco does not own widget state, account state, locale policy, storage paths, live pointers, or readiness state. San Francisco is a translation worker. It receives approved text items and returns translated text.

Admin widgets and customer widgets use the same flow. Admin is a normal account with broader permissions. Translation must not branch on owner type.

## 2. Problem

The current account-widget generation boundary still has toxic code:

1. Tokyo-worker calls San Francisco through an HTTP URL.
2. Tokyo-worker authenticates that call with `CK_INTERNAL_SERVICE_JWT`.
3. San Francisco exposes `POST /v1/l10n/account/ops/generate` from the public fetch router.
4. San Francisco receives widget config plus allowlist and decides what to extract.
5. Tokyo-worker uses the vague status `accepted`.
6. Failure can leave Builder showing fake "preparing" progress.

This is wrong because:

- A missing or mismatched shared secret breaks translation generation.
- An internal product job is modeled as a public HTTP API.
- San Francisco is asked to understand too much of the widget contract.
- The state names do not explain what is happening.
- Old flows can survive as fallback paths and keep breaking the product later.

## 3. Scope

This PRD covers account-owned widget instance localization generation after Builder save or explicit instance sync.

In scope:

- Tokyo-worker account-widget l10n generation call.
- San Francisco account-widget l10n generation worker boundary.
- Translation job state names on the Tokyo saved pointer.
- Bob/Roma translation panel status mapping for those states.
- Docs for account-widget l10n generation.
- Deletion of the old account-widget l10n HTTP/shared-secret path.

Out of scope:

- Prague website string translation.
- Personalization/onboarding command auth.
- General San Francisco agent execution auth.
- Existing repaired legacy translation data.
- A new localization product UI.

Important: this PRD may leave `CK_INTERNAL_SERVICE_JWT` in unrelated non-account-widget paths if those paths are not touched here. It must remove `CK_INTERNAL_SERVICE_JWT` from the account-widget l10n generation path.

## 4. Surviving Architecture

### 4.1 Tokyo-worker owns the product job

Tokyo-worker does all product decisions:

- resolve account instance
- read saved config
- compute base snapshot and `baseFingerprint`
- read account desired locales
- apply entitlement/account policy
- read widget localization metadata
- extract the approved text items
- enqueue/update job state
- write overlays, packs, pointers, and live projection

### 4.2 San Francisco translates only approved items

Tokyo-worker sends San Francisco a narrow payload:

```ts
type AccountWidgetL10nGenerateRequest = {
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  items: Array<{
    path: string;
    type: "string" | "richtext";
    value: string;
  }>;
  existingOpsByLocale: Record<string, Array<{
    op: "set";
    path: string;
    value: string;
  }>>;
  changedPaths: string[] | null;
  removedPaths: string[];
  policyProfile: "free" | "tier1" | "tier2" | "tier3";
};
```

Important merge rule:

- `items` is the full approved text item index for the current base snapshot.
- `changedPaths` limits which items need fresh AI translation.
- `existingOpsByLocale` carries the previous locale ops.
- San Francisco must preserve existing ops for unchanged current paths.
- Removed paths are deleted only when they match `removedPaths`.

Do not send only changed items unless the San Francisco merge function is first changed and verified to preserve existing untouched ops without needing the full current item index. The boring and safe execution path is: **send all approved current items, translate only changed target paths.**

San Francisco returns:

```ts
type AccountWidgetL10nGenerateResponse = {
  results: Array<
    | {
        locale: string;
        ok: true;
        ops: Array<{ op: "set"; path: string; value: string }>;
        usage?: {
          provider: string;
          model: string;
          promptTokens: number;
          completionTokens: number;
          latencyMs: number;
          costUsd?: number;
        };
      }
    | {
        locale: string;
        ok: false;
        ops: Array<{ op: "set"; path: string; value: string }>;
        error: string;
      }
  >;
};
```

San Francisco does not receive widget config.

San Francisco does not receive allowlists.

San Francisco does not read Tokyo storage.

San Francisco does not write Tokyo storage.

### 4.3 Private worker boundary

Tokyo-worker calls San Francisco through a private Cloudflare worker-to-worker binding.

Required shape:

```ts
env.SANFRANCISCO_L10N
```

Rules:

- No public `/v1/l10n/account/ops/generate` route for account-widget generation.
- No bearer token.
- No `CK_INTERNAL_SERVICE_JWT` on this path.
- No public HTTP fallback.
- If the private binding is absent, Tokyo-worker marks the translation job `failed`.

Implementation choice:

- A typed Worker RPC method is acceptable only if it is already supported cleanly by the repo/runtime.
- A plain Cloudflare service-binding `fetch()` call is also acceptable.
- The requirement is privacy and deletion of the public/shared-secret account-widget path, not an RPC framework.

For this execution, choose the smallest boring service-binding implementation that works in local and cloud-dev. Do not add a platform abstraction layer, client SDK package, or RPC compatibility framework unless it is strictly required to remove the old path.

## 5. State Machine

Delete `accepted`.

Use only:

```txt
queued -> working -> ready
queued -> working -> failed
```

Definitions:

- `queued`: Tokyo-worker saved the instance and queued follow-up translation work.
- `working`: the latest generation job is owned by the queue and is being processed, including bounded retry delay between attempts.
- `ready`: every requested locale for the current `baseFingerprint` has current artifacts.
- `failed`: latest generation job could not produce all requested current artifacts.

Rules:

- `queued` is not a UI success state. It means work is pending.
- `working` is valid only while a real latest-generation job is in the bounded queue/retry lifecycle.
- If the queue permanently exhausts retries, Tokyo-worker must mark `failed`.
- Do not add a `retrying` state in this PRD unless product explicitly asks for it. Retry is machinery; the user-facing state remains `working`.
- `ready` requires current account-first live pointers for every requested locale.
- `failed` must include useful failed locale reasons.
- A stale queued job must lose to the current saved pointer `generationId`.
- Builder must never show endless "preparing" for a job that has failed.

## 6. Scale And Cost Model

This must scale to 1M users, each with multiple instances and widgets.

The unit of work is:

```txt
one account
one instance
one baseFingerprint
only requested locales
only changed text paths when possible
```

The system must never scan all accounts, all widgets, or all instances to translate one save.

### 6.1 Cost controls

- AI is called only after save or explicit sync, never on render.
- If the current `baseFingerprint` already has ready locale artifacts, skip generation.
- If only some paths changed, send the full approved current item index plus changed path metadata and existing ops; San Francisco must call AI only for changed paths.
- Locale count comes from account entitlement/policy.
- Free/tier-limited accounts must not generate all admin/tier3 locales.
- San Francisco uses policy profile to choose provider/model/budget.
- Translation results are stored as deterministic ops and full packs, so render cost is R2/CDN, not AI.

### 6.2 Runtime scale

Public serving remains cheap:

- Venice reads public projection.
- Tokyo serves live pointers and immutable packs.
- No San Francisco call on render.
- No database read on render.
- No global lookup on render.

### 6.3 Queue scale

Queue jobs must be idempotent:

- Same `generationId` + `baseFingerprint` can safely retry.
- Older jobs are ignored.
- Failed locale generation marks `failed`; it does not loop forever.
- Backpressure delays translation but does not block saving the widget.

## 7. Deletion Targets

The implementation is not green unless these account-widget l10n paths are deleted or replaced.

### Tokyo-worker

Delete/replace:

- `generateLocaleOpsWithSanfrancisco` as an HTTP/shared-secret client.
- Account-widget l10n reads of `env.CK_INTERNAL_SERVICE_JWT`.
- Account-widget l10n dependency on `SANFRANCISCO_BASE_URL`.
- Any account-widget l10n fallback to old `l10n/instances/...` storage.
- `accepted` translation status.

Survives:

- Tokyo-worker account-first storage.
- Tokyo-worker queue ownership.
- Tokyo-worker saved pointer `l10n` block.
- Tokyo-worker public projection after account artifacts are current.

### San Francisco

Delete/replace:

- Public `POST /v1/l10n/account/ops/generate` account-widget generation route.
- `assertInternalAuth` usage for account-widget generation.
- Widget config extraction inside San Francisco account-widget generation.
- Allowlist parsing inside San Francisco account-widget generation.

Survives:

- Translation core.
- Richtext safety.
- Provider/model/budget execution.
- Locale-by-locale error reporting.

### Bob/Roma

Delete/replace:

- UI state mapping for `accepted`.
- Any endless "preparing" interpretation when Tokyo says `failed`.
- Any Builder/Roma read from legacy account-widget l10n storage.

Survives:

- One Roma same-origin translations route backed by Tokyo-worker.
- Bob Translations panel reading the Tokyo saved-pointer truth.

## 8. Execution Steps

Do not move to the next step until the current step is green.

### Step 1 - Freeze the current call graph

Map every active account-widget generation caller.

Required checks:

```bash
rg "generateLocaleOpsWithSanfrancisco" tokyo-worker/src
rg "/v1/l10n/account/ops/generate" tokyo-worker/src sanfrancisco/src
rg "CK_INTERNAL_SERVICE_JWT" tokyo-worker/src sanfrancisco/src
rg "accepted" tokyo-worker/src roma bob packages
```

Green means the exact deletion list is known before editing.

### Step 2 - Move text extraction into Tokyo-worker

Tokyo-worker must produce approved translation items before calling San Francisco.

Rules:

- Use `tokyo/product/widgets/<widgetType>/localization.json`.
- Do not send full widget config to San Francisco.
- Do not send allowlist to San Francisco.
- Preserve path/type/value identity.
- Preserve changed-path and removed-path behavior.
- Send the full approved current item index so San Francisco can preserve existing ops for unchanged paths.
- San Francisco may call AI only for paths selected by `changedPaths`; unchanged existing ops stay intact.

Green means unit/type checks prove San Francisco receives only approved items and that an incremental update does not drop untouched translated ops.

### Step 3 - Add the private San Francisco worker method

Add a private worker-to-worker service-binding entrypoint for account-widget translation.

Rules:

- The method accepts only approved items.
- The method returns locale results.
- The method uses one structured richtext translation path: extract visible text segments, translate strings only, rebuild original HTML, then validate.
- The method does not touch Tokyo storage.
- The method is not mounted in San Francisco public fetch routing.
- Prefer the smallest Cloudflare service-binding implementation. Typed RPC is optional, not required.
- Do not introduce a new shared client package or generic RPC framework for this PRD.

Green means Tokyo can call the private binding locally or in cloud-dev without `CK_INTERNAL_SERVICE_JWT`.

### Step 4 - Replace Tokyo-worker generation client

Tokyo-worker must call the private binding.

Rules:

- No HTTP URL.
- No bearer token.
- No public route fallback.
- Missing binding is a named `failed` status.
- Partial locale failures become failed locale entries.

Green means account-widget generation can run without `CK_INTERNAL_SERVICE_JWT` in Tokyo-worker.

### Step 5 - Delete the old public account generation route

Remove the account-widget route from San Francisco public routing:

```txt
POST /v1/l10n/account/ops/generate
```

Green means public HTTP calls to that route return 404 and no account-widget product code calls it.

### Step 6 - Replace `accepted` with `queued`

Update types, writers, readers, and UI mapping.

Rules:

- `accepted` no longer exists in account-widget l10n types.
- Old saved pointers with `accepted` may be treated as `queued` only in a one-time normalization if needed during pre-GA execution.
- New writes must never write `accepted`.
- Bob copy says queued/working/ready/failed clearly.

Green means:

```bash
rg "accepted" tokyo-worker/src roma bob packages
```

has no account-widget l10n state references.

### Step 7 - Ensure failure is honest

Force a generation failure.

Expected behavior:

- Tokyo saved pointer becomes `failed`.
- `failedLocales` is present.
- Bob/Roma show failed/retry, not "preparing".
- Public ready locales do not advance for failed locales.

Green means the UI cannot show fake progress for a failed generation.

### Step 8 - Verify scale path

Run one save/sync against:

- one admin/tier3 instance with many locales
- one lower-tier/user instance with limited locales
- one existing-ready instance where nothing changed
- one changed-path-only save

Green means:

- no AI call for unchanged ready artifacts
- AI call count is bounded by requested locales and changed items
- lower-tier account does not generate admin locale volume
- no render path calls San Francisco

## 9. Hard Anti-Preservation Checks

These checks must be run before declaring the PRD done.

Incremental generation must preserve existing translations:

```bash
# Targeted test name may change during execution, but coverage must prove:
# one changed path in, unchanged existing ops still out.
```

Expected: a test fails if San Francisco receives only changed items and drops untouched existing ops.

Account-widget l10n must not depend on shared secret:

```bash
rg "CK_INTERNAL_SERVICE_JWT" tokyo-worker/src/domains tokyo-worker/src/routes
```

Any result must be proven unrelated to account-widget l10n, or deleted.

Old account generation HTTP route must be gone:

```bash
rg "/v1/l10n/account/ops/generate" tokyo-worker/src sanfrancisco/src
```

Expected: no product caller and no public San Francisco route.

Old generation client must be gone:

```bash
rg "generateLocaleOpsWithSanfrancisco" tokyo-worker/src
```

Expected: no results.

Old vague state must be gone:

```bash
rg "accepted" tokyo-worker/src roma bob packages
```

Expected: no account-widget l10n state.

Legacy storage must not be account-widget truth:

```bash
rg "l10n/instances" tokyo-worker/src roma bob
```

Expected: only public serving compatibility/projection reads, never account authoring/generation truth.

San Francisco must not decide widget contract:

```bash
rg "allowlist|config" sanfrancisco/src/l10n-account-routes.ts sanfrancisco/src
```

Any result in the account-widget private method must be deleted or proven to be non-account-widget code.

## 10. Required Runtime Verification

Use real cloud-dev after deploy.

### Success case

1. Save an account-owned FAQ instance.
2. Confirm saved pointer status moves:

```txt
queued -> working -> ready
```

3. Confirm Tokyo writes:

```txt
accounts/<accountId>/instances/<publicId>/l10n/live/<locale>.json
accounts/<accountId>/instances/<publicId>/l10n/packs/<locale>/<textFp>.json
```

4. Confirm public projection writes only after account artifacts exist:

```txt
public/instances/<publicId>/l10n/live/<locale>.json
public/instances/<publicId>/l10n/packs/<locale>/<textFp>.json
```

5. Confirm Venice/Tokyo public locale pointer returns `200`.

### Failure case

1. Disable or break the private San Francisco binding in dev.
2. Save/sync an instance.
3. Confirm saved pointer becomes `failed`.
4. Confirm Bob/Roma do not show endless preparing.
5. Confirm public ready locales do not advance for missing current artifacts.

### Cost case

1. Save an unchanged instance.
2. Confirm no San Francisco generation call.
3. Change one translatable text path.
4. Confirm payload contains the full approved item index, `changedPaths` contains only the changed text path, and San Francisco calls AI only for that changed path.
5. Confirm untouched existing locale ops remain in the output.

## 11. Documentation Updates Required

Update these docs as part of execution:

- `documentation/capabilities/localization.md`
- `documentation/services/tokyo-worker.md`
- `documentation/architecture/CONTEXT.md` if the glossary/runtime flow changes
- San Francisco service docs if a service doc exists or is created during execution

Docs must say:

- Tokyo-worker extracts approved text items.
- San Francisco translates only approved text items.
- Account-widget generation uses private worker binding.
- `CK_INTERNAL_SERVICE_JWT` is not part of account-widget l10n generation.
- `queued`, `working`, `ready`, `failed` are the only account-widget l10n job states.

## 12. Definition Of Done

This PRD is done only when:

- Account-widget l10n generation works without `CK_INTERNAL_SERVICE_JWT`.
- Public account-widget l10n generation route is gone.
- San Francisco no longer receives account-widget config or allowlists.
- Tokyo-worker writes only account-first l10n truth and public projections.
- `accepted` is gone from account-widget l10n state.
- Failure becomes `failed`, not endless "preparing".
- Admin and customer instances use the same flow.
- Lower-tier accounts do not generate tier3/admin locale volume.
- Render/public serving never calls San Francisco.
- All anti-preservation checks are green.
- Typecheck/lint/build gates pass for touched packages.
- Docs are updated.

## 13. Non-Negotiable Execution Tenets

- Delete old paths. Do not wrap them.
- No fallback to public HTTP.
- No fallback to legacy `l10n/instances` account truth.
- No admin-specific translation path.
- No owner-specific translation path.
- No vague status names.
- No fake progress.
- No global scans.
- No AI on render.
- No San Francisco product-state ownership.
