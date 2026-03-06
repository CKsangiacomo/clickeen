# PRD 54A — Read Plane: Tokyo Paths, Live Pointers, Packs, Caching, and Venice Contract

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

Define the **public read surface** as:
- **immutable hashed packs** (`configFp`, `textFp`, `metaFp`) stored in Tokyo/R2, plus
- **tiny live pointer files** that move as the user edits,

…and make Venice public routes (`/e`, `/r`) serve **only Tokyo bytes** with **0 DB calls**, including locale selection rules and tier-gated SEO/GEO behavior.

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

## Storage model (Tokyo/R2 paths)

This PRD uses **folders on purpose**. Not for aesthetics — for deletion and operability.

Rules:
- Everything is scoped by `publicId` (instances) or `accountId` (assets), so Tokyo-worker can delete by prefix.
- We keep two kinds of files:
  1. **Immutable packs** addressed by fingerprints (cacheable forever).
  2. **Tiny live pointers** that move as the user edits (no-store).

### Instance config (Tokyo namespace: `renders/`)

Immutable config packs (content-addressed):
- `renders/instances/<publicId>/config/<configFp>/config.json`

Tiny live pointers (mutable):
- `renders/instances/<publicId>/live/r.json`
  - This is what `GET /r/:publicId` serves.
  - It is the entrypoint that tells the runtime where to fetch config + text.

`renders/instances/<publicId>/live/r.json` shape (v1):
```json
{
  "v": 1,
  "publicId": "wgt_...",
  "widgetType": "faq",
  "configFp": "sha256hex...",
  "localePolicy": {
    "baseLocale": "de",
    "availableLocales": ["de", "en", "fr"],
    "ip": {
      "enabled": true,
      "countryToLocale": {
        "DE": "de",
        "US": "en",
        "FR": "fr"
      }
    },
    "switcher": {
      "enabled": true
    }
  },
  "l10n": {
    "liveBase": "l10n/instances/<publicId>/live",
    "packsBase": "l10n/instances/<publicId>/packs"
  },
  "seoGeo": {
    "metaLiveBase": "renders/instances/<publicId>/live/meta",
    "metaPacksBase": "renders/instances/<publicId>/meta"
  }
}
```

Rules:
- `seoGeo` exists only when the account is entitled. Otherwise it must be absent.
- `localePolicy.baseLocale` must be included in `localePolicy.availableLocales`.
- `localePolicy.availableLocales` must include only locales that have a live pointer + pack (no “pending locale” in the public embed).
- `localePolicy.ip.enabled` and `localePolicy.switcher.enabled` are independent (both can be true).
- If `localePolicy.ip.enabled=true`:
  - runtime picks locale by viewer location (no DB) using `X-Ck-Geo-Country` + `localePolicy.ip.countryToLocale`.
  - `localePolicy.ip.countryToLocale` values must be included in `localePolicy.availableLocales`.
  - Country keys are ISO-3166-1 alpha2 (uppercase).
- If `localePolicy.switcher.enabled=true` and there is more than one `availableLocale`:
  - runtime shows an in-widget language switcher for `availableLocales`.
- Venice never “decides”. Venice serves what exists in Tokyo.

### Text + locales (Tokyo namespace: `l10n/`)

Immutable text packs:
- `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`

Tiny live pointers (mutable):
- `l10n/instances/<publicId>/live/<locale>.json` → `{ textFp, ... }`

Pointer shape (v1):
```json
{
  "v": 1,
  "publicId": "wgt_...",
  "locale": "fr",
  "textFp": "sha256hex...",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

Rule:
- One locale pointer always points to exactly one `textFp` (no variants in v1).

### SEO/GEO meta (Tokyo namespace: `renders/`) (tier-gated)

Only for entitled tiers.

Immutable meta packs:
- `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`

Tiny live meta pointers:
- `renders/instances/<publicId>/live/meta/<locale>.json` → `{ metaFp, ... }`

Pointer shape (v1):
```json
{
  "v": 1,
  "publicId": "wgt_...",
  "locale": "fr",
  "metaFp": "sha256hex...",
  "updatedAt": "2026-03-01T00:00:00.000Z"
}
```

Non-entitled tiers:
- `renders/instances/<publicId>/live/meta/...` must not exist.
- `renders/instances/<publicId>/meta/...` must not exist.

### Assets (Tokyo namespace: `assets/`) (Roma-owned)

Assets are not overlays. They are user-managed in Roma and referenced by config.

- `assets/versions/<accountId>/...`

Non-negotiable:
- On downgrade/closure we hard delete assets not allowed by the plan (T10).

### Why “more folders” matters (keeping Tokyo clean)

Tokyo-worker must be able to clean up without guessing:
- Delete/unpublish an instance: delete `renders/instances/<publicId>/...` and `l10n/instances/<publicId>/...`
- Remove a locale: delete `l10n/instances/<publicId>/live/<locale>.json` and `l10n/instances/<publicId>/packs/<locale>/...` (and SEO meta for that locale if it exists)
- Downgrade/closure: delete everything not allowed (instances + locales + **assets**)
- Account deletion: hard delete `assets/versions/<accountId>/...` and all instance prefixes for that account (Bob/Roma supplies the `publicId` set).

### Concrete example (what changes where)

Assume the instance is live (`published=true`) and `baseLocale="en"` for this instance.

The instance is currently serving:
- `renders/instances/<publicId>/live/r.json` → `configFp = AAA`
- `l10n/instances/<publicId>/live/en.json` → `textFp = EN1`
- `l10n/instances/<publicId>/live/fr.json` → `textFp = FR1`

Now:
1) User changes layout/fonts/background (config change):
- Tokyo-worker writes `renders/instances/<publicId>/config/BBB/config.json`
- Tokyo-worker updates `renders/instances/<publicId>/live/r.json` (`configFp` becomes `BBB`)
- Text packs/pointers do not change.

2) User changes English copy (text change):
- Tokyo-worker writes `l10n/instances/<publicId>/packs/en/EN2.json`
- Tokyo-worker updates `l10n/instances/<publicId>/live/en.json` (`textFp` becomes `EN2`)
- Translation runs; when French is ready:
  - Tokyo-worker writes `l10n/instances/<publicId>/packs/fr/FR2.json`
  - Tokyo-worker updates `l10n/instances/<publicId>/live/fr.json` (`textFp` becomes `FR2`)
- Config pack/pointer does not change.

3) User overrides French translation manually:
- Tokyo-worker writes `l10n/instances/<publicId>/packs/fr/FR3.json`
- Tokyo-worker updates `l10n/instances/<publicId>/live/fr.json` (`textFp` becomes `FR3`)
- No config writes. No asset writes.

---

## Locale selection at view-time (runtime)

The runtime picks one locale to load for this viewer; it never asks the DB.

Using `r.json.localePolicy`:
- If `/e/:publicId?locale=<token>` is present and `<token>` is in `availableLocales`, use it (fixed locale embed).
- Else if `localePolicy.ip.enabled=true`:
  - read `X-Ck-Geo-Country` from the `/r/:publicId` response header
  - map country → locale via `localePolicy.ip.countryToLocale`
  - if the result is not in `availableLocales`, fall back to `baseLocale`
- Else start at `baseLocale`
- If `localePolicy.switcher.enabled=true` and there is more than one `availableLocale`:
  - viewer can switch among `availableLocales` in the widget UI (which sets `?locale=` and reloads)

---

## Fingerprint model (what Tokyo-worker must do)

### What a fingerprint is (in this PRD)

A fingerprint is a deterministic hash ID (sha256 hex) of some bytes.

In this PRD we use fingerprints for packs:
- `configFp` fingerprints `config.json` bytes.
- `textFp` fingerprints a locale text pack (`.../<locale>/<textFp>.json`).
- `metaFp` fingerprints SEO meta bytes (only when entitled).

If bytes are identical, the fingerprint is identical. If bytes change, the fingerprint changes.

### Why fingerprints exist

Fingerprints make packs immutable and cacheable:
- Immutable packs live at fingerprinted paths and never change in place.
- “What’s live” changes by moving tiny pointers.
- Venice stays dumb: it serves whatever bytes Tokyo has, with no DB calls and no request-time fixing.

### Fingerprint rules (must be stable)

- Do not include timestamps in the bytes being fingerprinted.
- Do not include request IDs or environment values in the bytes being fingerprinted.
- JSON packs must be written in a stable format (same key order, same encoding) before hashing.

---

## Cache + CDN rules (why this is cheap)

This is where “Tokyo is raw storage/CDN” becomes real.

### Immutable packs (fingerprinted keys)

All objects under these prefixes are immutable by definition:
- `renders/instances/<publicId>/config/<configFp>/...`
- `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
- `renders/instances/<publicId>/meta/<locale>/<metaFp>.json` (entitled tiers only)

Cache rules:
- `cache-control: public, max-age=31536000, immutable`
- Safe to cache at every layer (browser + CDN).

### Live pointers (mutable, tiny)

All objects under:
- `renders/instances/<publicId>/live/...`
- `l10n/instances/<publicId>/live/...`

Are mutable by definition (they move when the user edits, downgrades, unpublishes, or changes locales).

Cache rules:
- `cache-control: no-store`

Why:
- “Go dark” must converge immediately.
- We never want stale pointers to keep serving paid bytes.

### Venice caching behavior

Venice public responses mirror the above:
- `/r/:publicId` is a live pointer response → `no-store`.
- Fingerprinted pack fetches can be long TTL and immutable.

---

## Public Venice contract (simple and strict)

Public routes:
- `GET /e/:publicId` (iframe UI)
- `GET /r/:publicId` (live runtime pointer)
- `GET /r/:publicId?meta=1` (SEO/GEO meta pointer; entitled tiers only)

Query parameters (public):
- `/e/:publicId?locale=<token>` (optional)
  - Fixed-locale embed (runtime reads this in the browser).
  - If the requested locale is not in `r.json.localePolicy.availableLocales`, runtime uses `baseLocale`.
- `/r/:publicId?meta=1&locale=<token>`
  - `locale` is required when `meta=1` is used.
  - No best-match logic. No fallback to other locales. It fetches exactly that locale pointer (or 404).

What Venice serves (source of truth = Tokyo):
- `/e/:publicId`
  - Returns a static iframe document (no DB calls).
  - The document is allowed to be the same bytes for every instance.
  - It must read `publicId` from the URL and boot by fetching `/r/:publicId`.
- `/r/:publicId`
  - Serves the live runtime pointer:
    - `GET <TOKYO_BASE>/renders/instances/<publicId>/live/r.json`
  - If 404: respond `404` with reason `NOT_PUBLISHED`.
- `/r/:publicId?meta=1&locale=<locale>` (entitled tiers only)
  - Serves the live meta pointer:
    - `GET <TOKYO_BASE>/renders/instances/<publicId>/live/meta/<locale>.json`
  - If 404: respond `404` with reason `SEO_NOT_AVAILABLE`.
  - The loader then fetches the immutable meta bytes by fingerprint:
    - `GET <TOKYO_BASE>/renders/instances/<publicId>/meta/<locale>/<metaFp>.json`

Success response (required):
- Body:
  - Exactly the bytes from Tokyo/R2.
  - Venice must not parse or rewrite.
- `content-type`:
  - Passed through from Tokyo if present; otherwise a sane default (`text/html` for `/e`, `application/json` for `/r`).
- Caching:
  - Live pointer responses (`/r` and `?meta=1`) must be `no-store`.

Error response (required):
- Content type: `application/json; charset=utf-8`
- Shape:
```json
{
  "ok": false,
  "reason": "NOT_PUBLISHED | SEO_NOT_AVAILABLE"
}
```

Required headers:
- `X-Venice-Render-Mode: snapshot`
- `X-Ck-Geo-Country: <ISO2|ZZ>` (from Cloudflare request geo; used when `localePolicy.ip.enabled=true`)
- `X-Ck-L10n-Requested-Locale: <locale>` (only when `?meta=1` is used)

Forbidden behavior:
- Calling Paris or Supabase.
- Any request-time healing or fallback.
- Any runtime tier branching.

---

## Public files + runtime contracts (what exists in Tokyo)

This PRD intentionally stops treating “published embed” as one big per-locale snapshot.
Instead, the public embed is built from:
- one **config pack** (`configFp`)
- one **text pack** (`textFp`, per locale)
- optional **SEO meta pack** (`metaFp`, per locale, tier-gated)
- assets referenced by config (account-scoped; Roma-owned)

### `/e/:publicId` (iframe shell)

- Venice serves a static iframe document (no DB calls).
- The document must not embed instance state.
- It reads `publicId` from the URL and boots by fetching `/r/:publicId`.

### `/r/:publicId` (live runtime pointer)

Served from Tokyo:
- `renders/instances/<publicId>/live/r.json` (no-store)

This file is the entrypoint for runtime composition. It must include:
- `widgetType`
- `configFp`
- where to fetch locale pointers + packs under `l10n/`
- `seoGeo` block only when entitled

### Config pack (immutable)

Stored in Tokyo:
- `renders/instances/<publicId>/config/<configFp>/config.json`

Rules:
- Deterministic encoding (so `configFp` is stable).
- Must not contain localized strings.
- May contain asset refs (Roma assets).

Config pack bytes (v1):
- The file is the instance config JSON, but with **all translatable string fields blanked** (set to `""`).
- This keeps the structure (layout/settings/asset refs) stable while removing “words”.
- No wrapper is required; the runtime treats this JSON as the base widget state.

Example shape (v1) (illustrative):
```json
{
  "header": { "title": "", "subtitleHtml": "" },
  "cta": { "label": "" },
  "sections": [
    {
      "title": "",
      "faqs": [{ "question": "", "answer": "" }]
    }
  ],
  "design": { "...": "..." },
  "assets": { "...": "..." }
}
```

### Text pack (immutable, per locale)

Stored in Tokyo:
- `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`

Rules:
- Deterministic encoding (so `textFp` is stable).
- Contains only allowlisted string keys.

Text pack bytes (v1):
- A flat JSON map: `path -> string`.
- Paths are dot-separated, with numeric segments for array indexes (example: `sections.0.faqs.3.question`).

Example shape (v1):
```json
{
  "header.title": "…",
  "cta.label": "…",
  "sections.0.title": "…",
  "sections.0.faqs.0.question": "…",
  "sections.0.faqs.0.answer": "…"
}
```

Live text pointer (mutable):
- `l10n/instances/<publicId>/live/<locale>.json` → `{ textFp }` (no-store)

### SEO/GEO meta (tier-gated)

Live meta pointer (mutable):
- `renders/instances/<publicId>/live/meta/<locale>.json` → `{ metaFp }` (no-store)

Meta pack (immutable):
- `renders/instances/<publicId>/meta/<locale>/<metaFp>.json`

Minimal required meta shape (v1):
```json
{
  "schemaJsonLd": "{...}",
  "excerptHtml": "<section>...</section>"
}
```

Tier gating:
- If the account is not entitled to SEO/GEO, `live/meta/...` and `meta/...` must not exist in Tokyo.
