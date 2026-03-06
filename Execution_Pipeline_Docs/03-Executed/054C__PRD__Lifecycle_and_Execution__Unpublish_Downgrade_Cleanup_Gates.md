# PRD 54C — Lifecycle + Execution: Unpublish, Downgrades, Cleanup, and Acceptance Gates

Status: EXECUTED (with systemic regressions; remediated by subsequent PRDs)
Date: 2026-03-01
Owner: Product Dev Team
Priority: P0

> **Execution Note (2026-03-05):** This PRD was executed and moved to `03-Executed`. Multiple parts of the rollout caused systemic failures across auth, runtime, and storage contracts. Those failures are addressed by subsequent PRDs (starting with PRD 56 and follow-ons). Treat this document as execution history, not the current runtime source of truth.

Part of:
- PRD 54 (spine): `Execution_Pipeline_Docs/03-Executed/054__PRD__Snapshot_First_Rendering_Pipeline_Isolation_and_DB_Touch_Budgets.md`

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare) — Roma on the admin account
- Local is for building blocks only (DevStudio, Dieter, widgets), not for proving PRD 54 end-to-end
- Canonical startup (when local is used): `bash scripts/dev-up.sh`

---

## One-line objective

Make the pivot operable and non-chaotic by defining the lifecycle rules that keep Tokyo a mirror:
- unpublish/go-dark means “remove the live surface from Tokyo” (pointers and bytes),
- downgrades/closure mean forced deletes (including assets),
- execution is sliced into boring, verifiable gates so we don’t re-create the monster.

---

## Core tenets (non-negotiable)

### T1) Decide first in Bob/Roma, mirror exactly that
- The system must never generate outputs the account is not entitled to.
- Tokyo-worker jobs must contain the **exact live plan** (`localePolicy` + whether SEO exists).

### T2) Venice public is dumb: serve Tokyo bytes only
For public traffic:
- `GET /e/:publicId` and `GET /r/:publicId` MUST serve only Tokyo/R2 bytes (the live mirror).
- They MUST NOT call Paris or Supabase.
- They MUST NOT mutate anything at request time (no healing, no fallbacks, no re-rendering).

### T3) Tokyo-worker is dumb: fingerprints + writes only
- Tokyo-worker computes fingerprints and writes files/indexes.
- Tokyo-worker MUST NOT “discover” what to do by reading DB.
- Tokyo-worker MUST NOT call Venice to render content.

### T4) Locale and asset pipelines are isolated
- Locale pipeline may write ONLY translatable string content (allowlisted paths).
- Asset pipeline may write ONLY asset blobs + asset metadata (and MAY delete them).
- Locale pipeline must never touch asset refs, media URLs, posters, etc.

### T5) Locales are incremental and entitlement-bounded
- Base changes trigger targeted locale updates only for changed allowlisted fields.
- Final locale set is capped by entitlement (`l10n.locales.max`) BEFORE generating anything.

### T6) Assets are user-managed (Roma), never system-healed
- No auto-repair, no auto-replace, no fallback asset values at runtime.
- Missing assets must be explicit and observable (not silently swapped).

### T7) DB touch budgets are fixed and few
Acceptable DB-touch moments:
1. **Editor session load:** 1 read to load account + instance.
2. **Save (draft):** 1 write per explicit save boundary (draft config/text + minimal metadata).
3. **Go live / go dark:** 1 write to flip the instance live flag (`published`) and enqueue Tokyo mirror jobs.
4. **Instance create:** 1 write (plus minimal metadata), not a cascade.

Non-acceptable:
- Any DB reads on Venice public embed hot path.
- Tokyo-worker reads of Supabase for “enforcement”, “rehydration”, “discovery”, or orchestration.

### T8) SEO/GEO optimized embed is tier-gated when making things live
Non-negotiable truth:
- SEO/GEO optimized embed (`/r` payload + `/r?meta=1` meta-only payload) is only available to entitled tiers.
- It MUST NOT be generated/stored for every user.
- Bob/Roma must not offer the SEO/GEO embed option to non-entitled tiers.

### T9) Tokyo is a mirror (not an archive)
Non-negotiable:
- Tokyo/R2 must not accumulate “dead” bytes.
- If Bob/Roma says something is not live / not entitled, it must not exist in Tokyo under Clickeen-managed namespaces:
  - instance render/config/meta files (`renders/...`)
  - locale text packs + pointers (`l10n/...`)
  - assets (`assets/...`)

Why:
- Prevents an R2 landfill that becomes impossible to reason about.
- Avoids accidental serving of stale/paid bytes due to pointer bugs.
- Keeps “Venice is dumb” true forever (no runtime cleanup/fallback logic).

Clarification:
- Assets are mirrored to what Roma Assets says exists for the account (within plan). Assets are not deleted just because an instance is unpublished; they are deleted when Roma/Bob policy deletes them (including forced deletes on downgrade/closure).

### T10) Downgrade/closure storage is a hard delete (assets included)
Non-negotiable:
- When an account downgrades (trial ends, cancels, drops tier), we do a forced storage cleanup:
  - Keep only what the new plan allows.
  - Delete everything else from Tokyo/R2 (including assets).

Plain English:
- We do not “pause” storage for non-paying users. We delete it.
- Draft config/text may still exist in DB, but it may reference missing assets after downgrade. That is expected and must be messaged in UI.

---

## Unpublish contract (public embed must go dark cleanly)

Unpublish is not “render something different”. Unpublish is “remove the live surface from Tokyo”.

### What unpublish means

When an instance is unpublished:
- Public embeds must behave as if nothing exists:
  - `GET /e/:publicId` → `404 NOT_PUBLISHED`
  - `GET /r/:publicId` → `404 NOT_PUBLISHED`

### What Paris must do (1 DB write)

When user unpublishes in Bob/Roma:
1. Paris flips `published=false` with exactly 1 DB write.
2. Paris enqueues an “unpublish” job to Tokyo-worker.

### What Tokyo-worker must do

Tokyo-worker must remove the instance from Tokyo/R2 entirely (public bytes must not accumulate):
1. Delete live pointers first (go dark immediately):
   - Delete `renders/instances/<publicId>/live/...`
   - Delete `l10n/instances/<publicId>/live/...`
2. Delete immutable packs for the instance:
   - Delete `renders/instances/<publicId>/config/...`
   - Delete `renders/instances/<publicId>/meta/...`
   - Delete `l10n/instances/<publicId>/packs/...`
3. In practice, the safest implementation is prefix delete:
   - Delete `renders/instances/<publicId>/...` (entire subtree)
   - Delete `l10n/instances/<publicId>/...` (entire subtree)

Notes:
- We delete the bytes (not just the pointers) to avoid drift into an “R2 landfill” that becomes impossible to reason about or operate.
- Venice must not try to “find an old pack” when pointers are missing.
- Assets are not part of instance unpublish. Asset deletion is managed by Roma Assets policy (including forced deletes on downgrade/closure). See T10.

---

## Concrete code impact (what actually changes)

This is the “no smoke” checklist so engineers can connect the PRD to the repo.

### Bob (editor + “Publish” modal)

Must change:
- On save: split changes into two independent pipelines:
  - config pipeline → `write-config-pack`
  - text pipeline → `write-text-pack` + trigger San Francisco translations
- When the instance is live and either `configFp`, `localePolicy`, or SEO entitlement changes: enqueue `sync-live-surface` (single writer of `renders/.../live/r.json`).
- On go live / go dark: flip the DB flag and enqueue Tokyo mirror work (create/delete live pointers).
- Embed snippet gating (SEO/GEO snippet only when entitled):
  - `bob/components/PublishEmbedModal.tsx`

Must remain true:
- “Safe embed” snippet is always available.
- SEO/GEO snippet is never shown to non-entitled tiers.

### Roma (account boundary + downgrades)

Must change:
- On downgrade/closure: compute allowed live set and trigger Tokyo cleanup (including forced asset deletes).
- For kept-live instances where entitlements changed (SEO removed, locale cap reduced): enqueue `enforce-live-surface` so Tokyo-worker applies the new rules using the existing live pointer.

Must remain true:
- Roma Assets is the only place that can create/delete assets.

### Paris (write boundary + queue)

Must change:
- Replace “publish plan (variants)” logic with:
  - `published` flag writes
  - entitlement-capped locale set
  - SEO/GEO boolean (tier-gated in Bob/Roma; validated only for shape in Paris)
- Queue payloads must be self-contained (no worker DB reads).

### Tokyo-worker (fingerprints + writes + deletes)

Must change:
- Stop calling Venice internal render routes to generate bytes.
- Stop Supabase reads for enforcement/state.
- Implement pack writers:
  - `write-config-pack` (verify `configFp` matches bytes; write the pack)
  - `write-text-pack` → `textFp`
  - `write-meta-pack` → `metaFp` (entitled tiers only)
- Implement `sync-live-surface` (the only writer of `renders/.../live/r.json`; go live/go dark + cleanup).
- Implement `enforce-live-surface` (tier-drop helper: reuse existing `live/r.json` + call `sync-live-surface` so Paris/Roma doesn’t have to read Tokyo).
- Implement mirror cleanup:
  - unpublish/delete instance = delete `renders/instances/<publicId>/...` and `l10n/instances/<publicId>/...`
  - downgrade/closure = delete disallowed instances + forced asset deletes

### Tokyo (R2)

No business logic changes. Path contracts must be obeyed:
- `renders/instances/<publicId>/live/...`
- `renders/instances/<publicId>/config/<configFp>/...`
- `renders/instances/<publicId>/meta/<locale>/<metaFp>.json` (entitled tiers only)
- `l10n/instances/<publicId>/live/...`
- `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- `assets/versions/<accountId>/...`

### Venice (public embed runtime)

Must change:
- `/r/:publicId` serves `renders/instances/<publicId>/live/r.json` (no-store).
- `/r/:publicId?meta=1&locale=...` serves the meta pointer (and the loader fetches the pack by `metaFp`).
- 0 DB calls on public `/e` and `/r`.
- Remove old “published index + package fingerprint” snapshot logic.

---

## Execution slices (boring, direct, verifiable)

### Slice A — Tokyo paths + pack writers (Tokyo-worker)

Goal:
- Tokyo-worker can write config/text/meta packs and move pointers.
- Tokyo-worker deletes old bytes so Tokyo stays a mirror.

Acceptance gates:
- Gate A1: Writing the same pack twice yields the same fingerprint.
- Gate A2: After a pack update, only the newest pack remains referenced and older packs are deleted.

### Slice B — Public Venice serves live pointers (0 DB)

Goal:
- Public `/r` is pointer-only and DB-free.
- Public `/e` is a static shell and DB-free.

Acceptance gates:
- Gate B1: `GET /e/:publicId` and `GET /r/:publicId` perform **0** DB calls.
- Gate B2: When `renders/instances/<publicId>/live/r.json` is deleted, `/r/:publicId` immediately returns `404 NOT_PUBLISHED`.

### Slice C — Bob/Roma decides entitlements (and only writes what’s allowed)

Goal:
- Entitlements are applied once (Bob/Roma) and never re-decided downstream.

Acceptance gates:
- Gate C1: Non-entitled tiers never see SEO/GEO embed option in UI.
- Gate C2: Non-entitled tiers never have `renders/instances/<publicId>/live/meta/...` in Tokyo.

### Slice D — Locale pipeline writes text packs (incremental + isolated)

Goal:
- Locale pipeline writes only allowlisted strings.
- Locale generation is incremental, but output is full packs.

Acceptance gates:
- Gate D1: Changing one base string translates only that key (carry-forward works).
- Gate D2: Any attempt to write non-string keys or non-allowlisted paths is rejected.

### Slice E — Cleanup (unpublish, downgrade, closure)

Goal:
- Tokyo never drifts into a landfill.
- Downgrades force-delete storage (including assets).

Acceptance gates:
- Gate E1: Unpublish deletes `renders/instances/<publicId>/...` and `l10n/instances/<publicId>/...`.
- Gate E2: Downgrade deletes all disallowed instances and forced-deletes assets under `assets/versions/<accountId>/...`.

---

## Delta to full execution (as of 2026-03-02)

This is the honest “what’s left” list to reach the Definition of Done for PRD 54.

Environment reminder:
- We validate this **only** in cloud-dev (Cloudflare). Local is not the integration truth for this pivot.

Already true in the repo (foundation is in place):
- Venice public `/e/:publicId` and `/r/:publicId` are Tokyo-only and DB-free.
- Tokyo-worker has the new mirror job primitives:
  - write packs (`write-config-pack`, `write-text-pack`, `write-meta-pack`)
  - move the live pointer (`sync-live-surface`)
  - delete an instance mirror by prefix (`delete-instance-mirror`)
- Paris can enqueue Tokyo mirror jobs when an instance is already `published`.
- Bob now sends the **explicit live plan** (`localePolicy` + `seoGeo`) on live writes; Paris validates shape and mirrors exactly that (no recompute in the instance update path).
- Bob “Save” no longer silently marks the instance as published (save ≠ live).
- Bob gates the SEO/GEO embed snippet by entitlement (it is not shown to non-entitled tiers).
- Locale policy is now a real product setting in Bob (base locale, enabled locales, IP mode, switcher) and is persisted via Paris account locale policy endpoints.

Remaining blockers (must be green to claim PRD 54 executed):
1. **Gate 0 infra: cloud-dev Auth V1 wiring**
   - Supabase Auth (cloud-dev project) must have Google provider enabled + redirect URLs allowlisted.
   - Roma must run on `roma.dev.clickeen.com` (custom domain) so session cookies can be shared across `.dev.clickeen.com` to Bob.
   - Berlin must be configured with `BERLIN_LOGIN_CALLBACK_URL` pointing at the canonical Roma callback.
2. **Billing events (later, not required pre-GA)**
   - The plan-change enforcement flow is wired and works today via Roma Settings (“Plan change (tier)”).
   - When Stripe/webhooks exist, they should call the same server-side enforcement endpoint (no new semantics).
3. **Email sender (later, but the trigger exists now)**
   - Tier-drop / plan-change enforcement persists an `account_notices` row with `email_pending=true`.
   - We add an email sender later that drains these rows and sends the customer notification email.

This delta becomes our execution checklist, gate-by-gate, below.

---

## Cloud-dev execution runbook (Do X → Expect Y)

This is the “boring runbook” we follow to execute PRD 54 without rebuilding the monster.

Rules:
- We execute this in cloud-dev only.
- We do not start Gate N+1 until Gate N is green.
- Every gate has **one obvious verification** that a human can do (browser/curl) + one storage expectation.

### Gate 0 — Cloud-dev wiring + Auth V1 works

Do:
1. Deploy/confirm these services exist in cloud-dev:
   - Berlin (auth boundary)
   - Roma/Bob (product/editor surface)
   - Paris (write boundary)
   - Tokyo-worker (R2 mirror + HTTP read surface)
   - Venice (public embed runtime)
2. Log into Roma/Bob via “Continue with Google”.
   - Roma entry: `GET /login` → `GET /api/session/login/google` (redirect to Google via Berlin)
   - Callback: `GET /api/session/login/google/callback` (exchanges `code+state` with Berlin; sets session cookies)
3. Configure Supabase Auth (cloud-dev project) to allow Google login:
   - Enable the **Google** provider.
   - Create a Google OAuth client (Google Cloud Console) and set:
     - Authorized redirect URI: the Supabase callback URL shown in Supabase Auth (typically `https://<project>.supabase.co/auth/v1/callback`)
     - Authorized JavaScript origins: your Roma/Bob domains (cloud-dev)
   - Set Google OAuth client ID/secret (from Google Cloud Console).
   - Add the redirect URL that Berlin uses (Roma callback):
     - Canonical (required for cookie sharing): `https://roma.dev.clickeen.com/api/session/login/google/callback`
     - Transitional (only if Roma is still on Pages default): `https://roma-dev.pages.dev/api/session/login/google/callback`
   - Set Berlin env `BERLIN_LOGIN_CALLBACK_URL` to the canonical URL above (otherwise cookies land on the wrong domain).
4. Wire Roma to a `*.dev.clickeen.com` custom domain (Cloudflare Pages):
   - Add `roma.dev.clickeen.com` as a Pages custom domain for Roma.
   - Ensure DNS points to Cloudflare Pages.
   - Why: cookie sharing. If Roma stays on `pages.dev`, it cannot share cookies to `bob.dev.clickeen.com`.

Quick verify (no browser required):
- `node scripts/dev/cloud-dev/check-google-oauth.mjs`
  - Expects Berlin to return a Google OAuth `url` (meaning Supabase provider is enabled + redirect is allowed).

Expect:
- You land back in Roma authenticated (httpOnly cookies set).
- Bob can load an account/instance without copying tokens into localStorage.
- If Roma runs on `roma.dev.clickeen.com`, session cookies are shared across `.dev.clickeen.com`, so one login covers both Roma and Bob:
  - `ck-access-token` + `ck-refresh-token`

Important:
- Intended state: session tokens are **not** handled in browser JS.
- Transitional exception (while Roma is on `pages.dev`): Roma Builder may bridge an access token to Bob so the team can keep moving.

Quick verify:
- Open an **unpublished** instance public route:
  - `GET <VENICE_BASE>/r/<publicId>` → `404 { ok:false, reason:"NOT_PUBLISHED" }`

Why this gate matters:
- If auth and cloud wiring isn’t real, we’ll be tempted back into local-only hacks and parity smoke.

### Gate 1 — Go live / go dark works (and Venice stays dumb)

Do (implementation):
1. Add an explicit product control in Bob/Roma: “Live: On/Off”.
   - Turning it ON flips instance `status` to `published`.
   - Turning it OFF flips instance `status` to `unpublished`.
2. On ON:
   - enqueue `write-config-pack`
   - enqueue `write-text-pack` for the base locale
   - enqueue `sync-live-surface` (writes `renders/.../live/r.json`)
3. On OFF:
   - enqueue `delete-instance-mirror` (prefix delete `renders/instances/<publicId>/` + `l10n/instances/<publicId>/`)

Where to implement (starting points):
- Bob UI: `bob/components/TopDrawer.tsx` or settings in `bob/components/ToolDrawer.tsx`
- Session plumbing: `bob/lib/session/useWidgetSession.tsx`
- Paris status transition: `paris/src/domains/workspaces/update-handler.ts`
- Tokyo delete: `tokyo-worker/src/domains/render.ts` (`deleteInstanceMirror`)

Expect (behavior):
- After “Live: ON” completes and Tokyo jobs run:
  - `GET <VENICE_BASE>/r/<publicId>` → `200` (JSON pointer)
  - `GET <VENICE_BASE>/e/<publicId>` → loads the widget UI (no DB calls)
- After “Live: OFF” completes and delete job runs:
  - `GET <VENICE_BASE>/r/<publicId>` → `404 NOT_PUBLISHED`

Expect (Tokyo storage):
- When live:
  - `renders/instances/<publicId>/live/r.json` exists
  - `renders/instances/<publicId>/config/<configFp>/config.json` exists
  - `l10n/instances/<publicId>/live/<baseLocale>.json` exists
  - `l10n/instances/<publicId>/packs/<baseLocale>/<textFp>.json` exists
- When not live:
  - `renders/instances/<publicId>/...` does not exist (prefix delete)
  - `l10n/instances/<publicId>/...` does not exist (prefix delete)

Quick verify (no special tools):
- Read the pointer via Venice:
  - `GET <VENICE_BASE>/r/<publicId>` and note `configFp`.
- Confirm the config pack bytes are reachable:
  - `GET <VENICE_BASE>/renders/instances/<publicId>/config/<configFp>/config.json`

### Gate 2 — “Text changes don’t change config” (hashed parts are real)

Do:
1. Make the instance live (Gate 1 must be green).
2. Edit only styling/layout (fonts/background/layout). Click Save.
3. Edit only copy (text). Click Save.

Expect:
- Config-only edit:
  - `/r/<publicId>` returns a new `configFp`
  - The base locale `textFp` stays the same
- Text-only edit:
  - `/r/<publicId>` keeps the same `configFp`
  - The base locale `textFp` changes

Why this gate matters:
- This is the “common sense” cost-control: we can change copy without regenerating everything.

### Gate 3 — Locale pipeline pivots to “text packs + pointers” (no ops overlays on the hot path)

Do (implementation):
1. Stop treating translations as “ops overlays” that Venice has to interpret later.
2. Make the locale pipeline output **full locale text packs**:
   - write `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
   - move `l10n/instances/<publicId>/live/<locale>.json`
3. Update Bob translations UI to:
   - trigger translation generation (San Francisco) from the base text pack
   - write manual overrides by emitting a new locale text pack (not “user ops”)
4. Remove Tokyo-worker Supabase reads from the PRD 54 l10n write path (Tokyo-worker must be DB-blind for PRD 54).

Expect:
- `GET <VENICE_BASE>/e/<publicId>?locale=fr` works with 0 DB calls when French exists in `availableLocales`.
- Changing one base string updates only that string in translation work, but the published output is still a full pack.

### Gate 4 — Locale policy becomes a real product setting

Do:
1. Add UI in Bob to manage:
   - base locale (what the author edits in Content panel)
   - enabled locales (entitlement-capped)
   - “IP locale on/off” (initial pick by viewer geo)
   - “Show switcher on/off” (viewer can change language)
2. Persist those settings in DB (one write per save boundary).
3. On live instances, mirror the resulting localePolicy into `renders/.../live/r.json` via `sync-live-surface`.

Expect:
- If IP locale is OFF: everyone sees `baseLocale` unless a fixed `?locale=` is used.
- If IP locale is ON: viewers get best-match locale by country mapping, bounded to enabled locales.
- If switcher is ON: viewer can change language in the widget UI (still DB-free).

### Gate 5 — SEO/GEO (tier gated) is real (meta packs exist only when entitled)

Do:
1. For entitled tiers only:
   - generate meta packs per live locale
   - mirror meta pointers:
     - `renders/instances/<publicId>/live/meta/<locale>.json`
     - `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`
2. For non-entitled tiers:
   - ensure meta pointers/packs do not exist (delete if present)

Expect:
- Non-entitled:
  - Bob never shows the SEO/GEO embed option.
  - `GET <VENICE_BASE>/r/<publicId>?meta=1&locale=en` → `404 SEO_NOT_AVAILABLE`
- Entitled:
  - `GET <VENICE_BASE>/r/<publicId>?meta=1&locale=en` → `200` pointer with `metaFp`
  - Loader injects the meta into the host page when `data-ck-optimization="seo-geo"` is used.

### Gate 6 — Downgrade/closure cleanup keeps Tokyo a mirror (forced deletes, including assets)

Do:
1. Implement downgrade/closure flows in Roma/Bob (server-side):
   - apply the plan change (tier change) in DB
   - compute what stays live under the new plan (or apply a deterministic default)
   - mark the rest as not live in DB
   - enqueue cleanup to Tokyo-worker
   - for kept-live instances: enqueue `enforce-live-surface` to remove SEO meta bytes (if no longer entitled) and trim `localePolicy.availableLocales` (if the cap dropped)
2. Cleanup must delete:
   - disallowed instances:
     - `renders/instances/<publicId>/...`
     - `l10n/instances/<publicId>/...`
   - disallowed assets (hard rule):
     - `assets/versions/<accountId>/...`
3. Trigger user notifications:
   - create an `account_notices` row (`kind=tier_drop`, `status=open`) so Roma can show a popup
   - set `email_pending=true` so an email sender can be added later (no semantics change)

Implementation hooks (this repo snapshot):
- Paris (Roma Assets surface): `DELETE /api/accounts/:accountId/assets?confirm=1` (calls Tokyo-worker)
- Paris (downgrade helper): `POST /api/accounts/:accountId/instances/unpublish?confirm=1` with `{ keepLivePublicIds: [...] }`
- Paris (plan change trigger): `POST /api/accounts/:accountId/lifecycle/plan-change?confirm=1` with `{ nextTier, keepLivePublicIds? }`
- Paris (dismiss popup): `POST /api/accounts/:accountId/notices/:noticeId/dismiss`
- Tokyo-worker: `DELETE /assets/purge/:accountId?confirm=1` (deletes metadata + `assets/versions/<accountId>/...` bytes)
  - Roma instance delete now enqueues `delete-instance-mirror` so Tokyo does not leak instance bytes

Expect:
- After downgrade/closure:
  - Venice returns `404 NOT_PUBLISHED` for instances beyond the plan.
  - If the new tier is not entitled to SEO/GEO:
    - `GET /r/<publicId>?meta=1&locale=<baseLocale>` returns `404 SEO_NOT_AVAILABLE` even for the kept-live instance.
    - Tokyo deletes `renders/instances/<publicId>/live/meta/...` and `renders/instances/<publicId>/meta/...` for those instances.
  - If the new tier reduces locale caps:
    - `renders/.../live/r.json.localePolicy.availableLocales` is trimmed to the cap.
    - Tokyo deletes removed locale pointers/packs under `l10n/instances/<publicId>/...`.
  - Storage cost converges down (we are not paying for non-paying users).
- Roma UX:
  - an in-app popup explains what changed and where to go (Settings) to pick what stays live
  - when email is implemented, the same event produces an email alert

Quick verify (repeatable, safe; uses a fresh test account so it won't destroy the admin account):
- `node scripts/dev/cloud-dev/gate6-tier-drop.mjs`

---

## Definition of done

All must be true:
1. Bob/Roma decide what is allowed and live; system does not create forbidden paid bytes.
2. Tokyo-worker only computes fingerprints + writes/deletes files (no DB reads, no Venice render calls).
3. Tokyo is raw storage/CDN; no business logic.
4. Venice public routes are DB-free and serve only Tokyo bytes.
5. Config pipeline and locale pipeline are isolated (config never writes `l10n/`; locale never writes `renders/`).
6. Locales are incremental and entitlement-capped.
7. SEO/GEO meta is tier-gated and does not exist in Tokyo for non-entitled tiers.
