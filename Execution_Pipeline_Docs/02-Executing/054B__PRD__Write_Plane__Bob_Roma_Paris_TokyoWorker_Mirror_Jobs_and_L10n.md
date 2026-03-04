# PRD 54B — Write Plane: Bob/Roma → Paris → Tokyo-worker Mirror Jobs (and Locale Pipeline)

Status: EXECUTING (spec)
Date: 2026-03-01
Owner: Product Dev Team
Priority: P0

Part of:
- PRD 54 (spine): `Execution_Pipeline_Docs/02-Executing/054__PRD__Snapshot_First_Rendering_Pipeline_Isolation_and_DB_Touch_Budgets.md`

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare) — Roma on the admin account
- Local is for building blocks only (DevStudio, Dieter, widgets), not for proving PRD 54 end-to-end
- Canonical startup (when local is used): `bash scripts/dev-up.sh`

---

## One-line objective

Define the **write plane** as a boring, explicit pipeline:
- Bob/Roma (server-side) decides the live plan (entitlements + localePolicy + SEO boolean),
- Paris validates + commits minimal DB writes,
- Tokyo-worker does only fingerprinting + R2 writes/deletes (no DB reads),

…so Tokyo stays a clean mirror and Venice stays dumb forever.

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

## Tokyo mirror contract (who decides; when bytes change)

### Contract A — The live plan is explicit (and server-side)
Bob/Roma (server-side) decides:
- which locales exist for this instance (entitlement-capped)
- whether SEO/GEO meta exists (tier-gated)

Paris and Tokyo-worker must not be a second brain. They must not “recompute entitlements”.

### Contract B — Packs are immutable; pointers move last
Every change follows the same boring rule:
1. Write the new immutable pack bytes under a fingerprinted key.
2. Move/update the tiny live pointer that points at that fingerprint **last**.
3. Delete the prior pack bytes that are no longer referenced.

This is how we avoid partial states and keep Tokyo clean.

### Contract C — “Go dark” is pointer-delete first, bytes-delete second
When something must stop being live (unpublish, downgrade, account closure):
1. Delete live pointers first (so Venice immediately returns 404).
2. Delete the now-unreferenced bytes under instance/account prefixes.

---

## Tokyo-worker job payloads (exact JSON shapes) (v1)

These payloads are the “no smoke” layer between Bob/Roma and Tokyo-worker.
They are intentionally simple: write packs, move pointers, delete old bytes.

### 1) Go live / go dark request (Bob/Roma → Paris) (v1)

Shape:
```json
{
  "v": 1,
  "publicId": "wgt_...",
  "live": true,
  "widgetType": "faq",
  "configFp": "sha256hex...",
  "localePolicy": {
    "baseLocale": "de",
    "availableLocales": ["de", "en", "fr"],
    "ip": {
      "enabled": true,
      "countryToLocale": { "DE": "de", "US": "en", "FR": "fr" }
    },
    "switcher": {
      "enabled": true
    }
  },
  "seoGeo": true
}
```

Rules:
- `localePolicy.availableLocales` is already entitlement-capped in Bob/Roma.
- `seoGeo` is already tier-gated in Bob/Roma.
- When `live=true`, `configFp` is required (this is what `/r/:publicId` will point to).
- `configFp` must be the sha256 of the canonical (stable) `configPack` bytes Bob/Roma is making live.
- Paris validates auth/ownership + payload shape only.

### 2) Tokyo-worker: write config pack (v1)

Shape:
```json
{
  "v": 1,
  "kind": "write-config-pack",
  "publicId": "wgt_...",
  "widgetType": "faq",
  "configFp": "sha256hex...",
  "configPack": { "...": "..." }
}
```

Worker behavior:
- Canonicalize `configPack` to stable JSON bytes.
- Compute `sha256(configBytes)` and require it equals `configFp`.
- Write `renders/instances/<publicId>/config/<configFp>/config.json` (immutable).
- Must not touch `renders/instances/<publicId>/live/r.json`.
  - Single-writer rule: only `sync-live-surface` updates `live/r.json`.

### 3) Tokyo-worker: write text pack (v1)

Shape:
```json
{
  "v": 1,
  "kind": "write-text-pack",
  "publicId": "wgt_...",
  "locale": "fr",
  "textPack": { "title": "...", "items.0.question": "..." }
}
```

Worker behavior:
- Compute `textFp` from `textPack`.
- Write `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`.
- Update `l10n/instances/<publicId>/live/<locale>.json`.
- Delete the prior text pack for that locale.

### 4) Tokyo-worker: write SEO meta pack (entitled tiers only) (v1)

Shape:
```json
{
  "v": 1,
  "kind": "write-meta-pack",
  "publicId": "wgt_...",
  "locale": "fr",
  "metaPack": { "schemaJsonLd": "{...}", "excerptHtml": "<section>...</section>" }
}
```

Worker behavior:
- Compute `metaFp` from `metaPack`.
- Write `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`.
- Update `renders/instances/<publicId>/live/meta/<locale>.json`.
- Delete the prior meta pack for that locale.

### 5) Tokyo-worker: sync live surface (go live / go dark) (v1)

This job is what keeps Tokyo a mirror when:
- an instance is made live
- an instance is unpublished
- entitlements change (locales reduced, SEO removed, etc.)

Shape:
```json
{
  "v": 1,
  "kind": "sync-live-surface",
  "publicId": "wgt_...",
  "widgetType": "faq",
  "live": true,
  "configFp": "sha256hex...",
  "localePolicy": {
    "baseLocale": "de",
    "availableLocales": ["de", "en", "fr"],
    "ip": {
      "enabled": true,
      "countryToLocale": { "DE": "de", "US": "en", "FR": "fr" }
    },
    "switcher": {
      "enabled": true
    }
  },
  "seoGeo": true
}
```

Worker behavior (high level):
- If `live=false`: delete `renders/instances/<publicId>/...` and `l10n/instances/<publicId>/...` (go dark).
- If `live=true`:
  - verify `renders/instances/<publicId>/config/<configFp>/config.json` exists (do not move pointers to missing bytes)
  - write/update `renders/instances/<publicId>/live/r.json` with `configFp` + `localePolicy` + l10n bases
  - delete any locale pointers/packs that are no longer in `localePolicy.availableLocales`
  - if `seoGeo=false`, delete all meta pointers/packs for the instance
  - delete the prior config pack (the one previously referenced by `live/r.json`)

### 5b) Tokyo-worker: enforce live surface (tier drop / plan change) (v1)

Why this exists (plain language):
- On tier drop / plan change, we must remove paid surfaces (SEO meta) and trim locales **even for the instance(s) that remain live**.
- Paris/Roma should not fetch Tokyo to discover “what’s currently live”.
- Tokyo-worker already has direct access to the live pointer in R2, so it can re-use it.

Shape:
```json
{
  "v": 1,
  "kind": "enforce-live-surface",
  "publicId": "wgt_...",
  "localePolicy": {
    "baseLocale": "en",
    "availableLocales": ["en"],
    "ip": { "enabled": false, "countryToLocale": {} },
    "switcher": { "enabled": false }
  },
  "seoGeo": false
}
```

Worker behavior:
- Load `renders/instances/<publicId>/live/r.json` to get the current `widgetType` + `configFp`.
- Delegate to `sync-live-surface` internally using those values + the requested `localePolicy` + `seoGeo`.
- If `live/r.json` does not exist, it’s a no-op (best-effort cleanup of meta prefixes when `seoGeo=false`).

---

## Bob/Roma: what changes in product behavior (explicit)

### Entitlements are applied here (no exceptions)

Bob/Roma must be the only place that decides:
- Which locales can be live for this account.
- Which embed optimizations can be used for this account (SEO/GEO).
- Which paid bytes are allowed to exist in Tokyo for this account.

### Embed snippet UX (what users actually get)

Non-negotiable behavior:
1. All tiers get the “safe embed” snippet (iframe UI only).
2. Only entitled tiers get the “SEO/GEO optimized embed” snippet.
3. Non-entitled tiers must not see the SEO/GEO option in UI.

Concrete snippets:
- Safe embed (all tiers):
  - Loads iframe UI via `/e/:publicId`.
  - Does not request `/r?meta=1` because it never opts into SEO/GEO.
- SEO/GEO embed (entitled tiers only):
  - Still loads iframe UI via `/e/:publicId` (UI does not change).
  - Opts into meta injection by setting `data-ck-optimization="seo-geo"`.
  - The loader then requests:
    - `/r/:publicId?meta=1&locale=<locale>` (meta pointer), then
    - the immutable meta pack by `metaFp` (only exists for entitled tiers).

---

## Paris endpoints: validation rules (no surprises)

Paris is a write boundary. It rejects invalid writes up front (one error, one place).
Paris is not a product brain.

### Required validations (v1)

For any request that can affect what exists in Tokyo, Paris MUST validate:
1. `publicId` exists and belongs to the account.
2. `widgetType` is valid (when present).
3. `locale` tokens are valid (when present):
   - normalized
   - no duplicates (when a list is provided)
4. Payload shape + size constraints:
   - Tokyo-worker jobs must be self-contained, but must fit within practical queue/message limits.
   - If limits are hit, fail explicitly (never silently drop fields).

Important:
- Tier/entitlement logic lives in Bob/Roma. Paris must not be a second brain.

### What Paris must write (DB budgets)

Paris must keep DB writes minimal:
- Save: 1 DB write (draft config/text + minimal metadata).
- Go live / go dark: 1 DB write to flip `published`.

No cascades. No orchestration tables required for correctness.

### What Paris must enqueue

Paris must enqueue only self-contained Tokyo-worker jobs:
- `write-config-pack`
- `write-text-pack` (per locale)
- `write-meta-pack` (only when entitled)
- `sync-live-surface` (the only writer of `renders/.../live/r.json`)
- `enforce-live-surface` (plan-change helper: reuse existing live pointer + call `sync-live-surface`)
- cleanup jobs (`unpublish`, `downgrade`, `account-closure`) that delete by prefix

Paris must NOT enqueue jobs that require workers to read Supabase later.

---

## Tokyo-worker: mirror algorithms (the only real work)

Tokyo-worker’s job is boring on purpose:
- hash packs (compute fingerprints)
- write packs to Tokyo
- move tiny live pointers
- delete old bytes so Tokyo stays a mirror

It must do that deterministically and without Supabase.

### Worker invariants (v1)

1. No Supabase reads.
2. No Venice render calls.
3. No entitlement decisions.
4. Write new packs first; move pointers last.
5. Delete old/unreferenced bytes (Tokyo is not an archive).
6. Only `sync-live-surface` writes `renders/instances/<publicId>/live/r.json`.

### Algorithm: `write-config-pack` (v1)

Inputs:
- `publicId`, `widgetType`, `configFp`, `configPack`

Steps:
1. Canonicalize `configPack` to stable JSON bytes (deterministic encoding).
2. Compute `sha256(configBytes)` and require it equals `configFp`.
3. Write immutable bytes:
   - `renders/instances/<publicId>/config/<configFp>/config.json`
   - cache-control: `public, max-age=31536000, immutable`
4. Stop. (Live pointer updates + mirror cleanup happen in `sync-live-surface`.)

### Algorithm: `write-text-pack` (v1)

Inputs:
- `publicId`, `locale`, `textPack`

Steps:
1. Canonicalize `textPack` to stable JSON bytes.
2. Compute `textFp = sha256(textBytes)`.
3. Write immutable bytes:
   - `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
   - cache-control: `public, max-age=31536000, immutable`
4. Update `l10n/instances/<publicId>/live/<locale>.json` (tiny, no-store)
5. Delete the prior text pack for that locale (the one previously pointed to).

### Algorithm: `write-meta-pack` (v1) (entitled tiers only)

Inputs:
- `publicId`, `locale`, `metaPack`

Steps:
1. Canonicalize `metaPack` to stable JSON bytes.
2. Compute `metaFp = sha256(metaBytes)`.
3. Write immutable bytes:
   - `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`
   - cache-control: `public, max-age=31536000, immutable`
4. Update `renders/instances/<publicId>/live/meta/<locale>.json` (tiny, no-store)
5. Delete the prior meta pack for that locale (the one previously pointed to).

### Algorithm: `sync-live-surface` (v1)

Inputs:
- `publicId`, `widgetType`, `live`, `configFp`, `localePolicy`, `seoGeo`

Steps:
1. If `live=false`:
   - Delete `renders/instances/<publicId>/live/r.json` (go dark immediately).
   - Byte deletion is done by the separate lifecycle job (`delete-instance-mirror`, see PRD 54C).
2. If `live=true`:
   - Require `renders/instances/<publicId>/config/<configFp>/config.json` exists.
   - Require **every** locale in `localePolicy.availableLocales` has `l10n/instances/<publicId>/live/<locale>.json` (so Venice never requests a missing locale pointer).
   - When `seoGeo=true`, also require `renders/instances/<publicId>/live/meta/<locale>.json` exists for every available locale.
   - Read the current `renders/instances/<publicId>/live/r.json` if it exists (to capture the prior `configFp` before overwriting).
   - Write/update `renders/instances/<publicId>/live/r.json` with:
     - `publicId`, `widgetType`, `configFp`
     - `localePolicy`
     - `l10n.liveBase` + `l10n.packsBase`
     - `seoGeo` block only when `seoGeo=true`
   - If the prior `configFp` exists and is different: delete `renders/instances/<publicId>/config/<priorConfigFp>/...`.
   - Enforce locale set:
     - delete `l10n/instances/<publicId>/live/<locale>.json` and `.../packs/<locale>/...` for any locale not in `localePolicy.availableLocales`
     - delete `renders/instances/<publicId>/live/meta/<locale>.json` and `.../meta/<locale>/...` for any locale not in `localePolicy.availableLocales`
   - If `seoGeo=false`, delete all meta pointers/packs for this instance.

### Idempotency rules (all jobs)

- Writing the same pack twice is allowed.
- If the fingerprinted object already exists, Tokyo-worker may no-op the write.

### Failure rules (keep the world clean)

If a write fails:
- Do not move live pointers.
- Return one explicit error.

---

## Locale pipeline contracts (incremental + isolated)

### Contract C — Locale text packs live in Tokyo, not in DB
Locales are not DB rows and not “ops overlays” in the hot path.
Locales are **text packs** stored in Tokyo/R2.
When an instance goes dark (`published=false`), its `l10n/instances/<publicId>/...` subtree is deleted (Tokyo mirror rule).

What a locale text pack is:
- One immutable JSON file containing only translated strings for allowlisted keys.
- It must not contain anything that looks like an asset ref, URL, or media metadata.

Paths:
- Text pack (immutable):
  - `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- Live pointer (mutable, tiny):
  - `l10n/instances/<publicId>/live/<locale>.json` → `{ textFp }`

Rules:
- Text packs are full packs (not diffs).
- Text packs contain only allowlisted keys.
- Asset refs/media URLs are never translatable and must never appear in text packs.

### Contract C0 — One write path for locale updates (agent + manual)

All locale updates go through the same boring path:
1. Paris stores the locale overlay as **set-only ops** in Supabase (`widget_instance_overlays`, `layer=locale`, `layerKey=<locale>`).
   - User overrides are stored separately as `layer=user` (same `layerKey=<locale>`), so they can be reverted independently.
2. If the instance is live (`published=true`), Paris immediately enqueues:
   - `write-text-pack` for that `(publicId, locale)` where the **full pack** is computed as `baseSnapshot + localeOps + userOps` (user wins per key)
   - and, if SEO/GEO is entitled+enabled, `write-meta-pack` for that locale

Non-negotiable:
- There is no separate “locale publish queue”.
- Tokyo-worker does not read Supabase for locale content. It only writes the bytes it is told to write.

### Contract C1 — Widget localization allowlist is the only authority

Each widget type must ship a file:
- `tokyo/widgets/<widgetType>/localization.json`

Shape (v1 example):
```json
{
  "v": 1,
  "paths": [
    { "path": "header.title", "type": "richtext" },
    { "path": "cta.label", "type": "string" },
    { "path": "sections.*.title", "type": "string" },
    { "path": "sections.*.faqs.*.question", "type": "string" },
    { "path": "sections.*.faqs.*.answer", "type": "richtext" }
  ]
}
```

Rules:
- `paths[].type` is either `string` or `richtext` (no numbers/booleans/objects).
- `paths[].path` is dot-separated, and may use `*` to mean “numeric index here”.
  - Example: `sections.*.faqs.*.question` matches `sections.0.faqs.3.question`.
- Paths must not include (non-negotiable):
  - asset IDs
  - URLs
  - poster fields
  - any media blob refs

### Contract C2 — Base text is explicit (and fingerprinted)

The base locale is just another text pack (it is not special storage):
- `l10n/instances/<publicId>/packs/<baseLocale>/<textFp>.json`
- `l10n/instances/<publicId>/live/<baseLocale>.json` points to the current base `textFp` when the instance is live.

No extra “base snapshot” format is required.

### Contract D — Incremental locale generation (still incremental, still boring)

We keep translation work incremental, but we store the output as full packs.

Inputs:
- Allowlist: `tokyo/widgets/<widgetType>/localization.json`
- New base (`baseLocale`) text pack
- Prior base (`baseLocale`) text pack (optional)
- Prior locale pack for `(publicId, locale)` (optional)

Algorithm (high level):
0. Determine the target locale set from Bob/Roma entitlements (cap first; never translate more than allowed).
1. Compute `changedKeys` by comparing new base pack vs prior base pack (only allowlisted keys).
2. For each locale (every locale except `baseLocale`):
   - Reuse prior locale values for keys not in `changedKeys`.
   - Translate only the base values for `changedKeys`.
   - Write one new full locale pack (new `textFp`) and move `live/<locale>.json`.
