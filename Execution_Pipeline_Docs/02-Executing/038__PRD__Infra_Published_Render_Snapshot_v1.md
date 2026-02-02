# PRD 38 — Infra: Published Render Snapshot v1
*(Jackpot-scale embed economics + reliability)*

**Status:** EXECUTING  
**Priority:** P0 (economics + reliability at GA traffic)  
**Owner:** Product Dev Team (Paris/Venice/Tokyo-worker)  
**Date:** 2026-01-31  

## Goal (v1)
Eliminate per-view dynamic work against **Paris/Michael** for **published widget instances** by serving Venice’s embed endpoints from **immutable artifacts** in Tokyo (R2).

Concretely: for published instances, Venice `/e/:publicId` and `/r/:publicId` (incl. `?meta=1`) must be servable without a Paris call.

This spec **extends** existing Tokyo + Venice architecture. It does not introduce widget semantics into orchestrators.

---

## Non-Goals
- No per-view LLM calls
- No per-view upstream connector refresh
- No per-view durable analytics writes
- No breaking change to draft/preview flows

---

## Current State (What Exists Today)

### ✔ Immutable assets already exist
- Localization overlays published as **fingerprinted, immutable** files  
  `cache-control: public, max-age=31536000, immutable`
- Stored in **Tokyo (R2)**

### ✔ Venice embed runtime exists (dynamic today)
Endpoints (real code):
- `GET /e/:publicId` — iframe HTML (see `venice/app/e/[publicId]/route.ts`)
- `GET /r/:publicId` — render payload (renderHtml + assets + state + schema/excerpt) (see `venice/app/r/[publicId]/route.ts`)
- `GET /r/:publicId?meta=1` — meta-only payload used by “iframe++ discoverability” (schemaJsonLd + excerptHtml)

What happens per view today:
- Venice calls Paris `GET /api/instance/:publicId?subject=venice` (Michael read)
- Venice fetches `widget.html` from Tokyo
- Venice applies instance overlays via `applyTokyoInstanceOverlay(..., explicitLocale: true)`
  - **Important:** Venice instance embeds are locale-driven (locale + user layer), not geo/industry/experiment.
- Venice derives `schemaJsonLd` + `excerptHtml` from widget state (Venice owns schema/excerpt semantics)

### ❌ Missing piece
- No **immutable, versioned render artifact** for the *final published widget output*
- Every view still requires Venice + Paris/KV involvement

---

## Core Idea

**Publishing a widget produces an immutable render snapshot.**

After publish:
- Venice should serve **static artifacts**
- Dynamic assembly is bypassed for normal views
- Dynamic path is reserved for:
  - drafts
  - previews
  - auth-gated content
  - immediate post-publish window (optional)

---

## Decisions (locked v1)

- **Venice is the canonical renderer** for widget HTML + schema/excerpt. Tokyo-worker must not re-implement rendering semantics.
- **Snapshot variants are locale-only (v1).** Theme/device are runtime parameters and must not multiply snapshot artifacts (iframe: bootstrap reads query params; shadow: loader overrides payload).
- **Snapshot fast path is public-only.** Any auth signals (`Authorization`, `X-Embed-Token`) force the dynamic path.
- **Fail visibly, never silently:** missing/stale snapshots fall back to dynamic and emit explicit headers/metrics.

---

## New Concepts

### Render Fingerprint (immutable identity)
A deterministic, **content-hash** of the artifact bytes we publish to Tokyo (R2).

- `renderFingerprint = sha256(bytes)`
- Artifacts are **never overwritten**. New bytes → new fingerprint → new URL.
- This keeps caching honest even when overlays are republished (locale/user ops can change without a base publish).

### Render Index Pointer (tiny, mutable)
A small pointer file per `publicId` that selects the “current” renderFingerprint per **locale** (v1).

- `index.json` is the only mutable object in the system.
- Everything else is immutable and safe to cache forever.

---

## Artifacts Produced (v1)

### Tokyo/R2 paths (authoritative)

Mutable pointer:
```
tokyo/renders/instances/<publicId>/index.json
```

Immutable artifacts (content-hashed):
```
tokyo/renders/instances/<publicId>/<renderFingerprint>/e.html
tokyo/renders/instances/<publicId>/<renderFingerprint>/r.json
tokyo/renders/instances/<publicId>/<renderFingerprint>/meta.json
```

Headers:
- Immutable artifacts: `cache-control: public, max-age=31536000, immutable`
- `index.json`: `cache-control: public, max-age=60, s-maxage=300`

### 1) `e.html` (required)
The published iframe HTML for `/e/:publicId` for a given locale.

v1 rule: theme/device are runtime parameters and must not multiply snapshot variants (they are applied at runtime by Venice/loader).

### 2) `r.json` (required)
The published render payload for `/r/:publicId` used by shadow embeds / Bob preview-shadow.

### 3) `meta.json` (required)
The published meta-only payload for `/r/:publicId?meta=1` used by iframe++ discoverability (JSON-LD + excerpt).

### 4) `index.json` (required)
One pointer per instance that selects the current artifacts per locale.

Shape:
```json
{
  "v": 1,
  "publicId": "wgt_main_faq",
  "current": {
    "en": { "e": "<fp>", "r": "<fp>", "meta": "<fp>" },
    "fr": { "e": "<fp>", "r": "<fp>", "meta": "<fp>" }
  }
}
```

Notes:
- Fingerprints are per-artifact (e/r/meta can differ).
- Old artifacts are safe to keep (immutable); rollback is pointer-only.

---

## Snapshot Generation (publish + l10n)

**Owner:** Tokyo-worker (materializes artifacts into Tokyo/R2)

### Triggers (v1)
- **Base publish (Bob “Publish”)** → Paris enqueues a Tokyo-worker job to (re)generate snapshots.
  - Curated instances: generate for all supported locales.
  - User instances: generate for base locale + workspace-selected locales (bounded by entitlement).
- **Locale/user overlay publish** (l10n pipeline) → Tokyo-worker regenerates snapshots for the affected `{publicId, locale}` only.
- **Unpublish** → Paris enqueues a Tokyo-worker job to delete/tombstone `tokyo/renders/instances/<publicId>/index.json` (so Venice cannot serve stale public artifacts).

### Generation algorithm (v1)
For each target locale:
1) Fetch Venice dynamic endpoints (Venice remains the single renderer):
   - `/e/:publicId?locale=<locale>`
   - `/r/:publicId?locale=<locale>`
   - `/r/:publicId?locale=<locale>&meta=1`
   - Include header `X-Ck-Snapshot-Bypass: 1` so Venice never serves the *existing* snapshot while generating the *next* snapshot.
     - Do **not** use `?ts=` as a bypass for `/e` because `ts` mutates asset URLs inside `e.html`.
2) Compute `renderFingerprint = sha256(bytes)` per response and write immutable artifacts:
   - `.../<fp>/e.html`, `.../<fp>/r.json`, `.../<fp>/meta.json`
3) Update `index.json.current[locale]` pointers to the new fingerprints.

---

## Venice Runtime Changes

### Fast Path (Snapshot)

Applies to:
- `GET /e/:publicId` (iframe HTML)
- `GET /r/:publicId` (render payload)
- `GET /r/:publicId?meta=1` (meta-only)

Algorithm:
1) If request includes `Authorization` or `X-Embed-Token` → **skip snapshot** (must honor gated flows)  
2) If request includes `ts` (cache-bust/dev) → **skip snapshot**  
3) If request includes `X-Ck-Snapshot-Bypass: 1` → **skip snapshot** (internal regeneration jobs)  
4) Resolve `locale` (normalize; default `en`)  
5) Fetch `tokyo/renders/instances/<publicId>/index.json` (cached)  
6) Resolve `current[locale]` (must include fingerprints for `e`, `r`, `meta`)  
7) Fetch immutable artifact from Tokyo and return:
   - `/e` → `.../<fp>/e.html`
   - `/r` + `meta=1` → `.../<fp>/meta.json`
   - `/r` (full) → `.../<fp>/r.json`
8) Emit `X-Venice-Render-Mode: snapshot`

Result:
- **No Paris call** on the hot path
- View cost becomes “static bytes + edge cache”

---

### Slow Path (Dynamic Fallback)

Venice falls back to the current dynamic behavior when:
- preview/draft/auth flows are in play
- `index.json` missing, stale, or invalid
- requested locale has no snapshot yet
- emergency rollback / kill-switch is enabled

Slow path MUST be fail-visible:
- Emit `X-Venice-Render-Mode: dynamic`
- Emit `X-Venice-Snapshot-Reason: <reason>`

---

## Cache Strategy Summary

| Artifact | TTL | Mutable | Purpose |
|---|---|---|---|
| `e.html` | 1 year | ❌ | iframe HTML (`/e/:publicId`) |
| `r.json` | 1 year | ❌ | render payload (`/r/:publicId`) |
| `meta.json` | 1 year | ❌ | schema + excerpt (`/r/:publicId?meta=1`) |
| `index.json` | 1–5 min | ✔ | per-locale pointer to latest artifacts |

---

## Paris Responsibilities

- Authorize publish/unpublish actions (policy + entitlement enforcement).
- Enqueue Tokyo-worker snapshot jobs on publish/unpublish (and pass the locale list to generate).
- Remain **out of the view-time render path** for published snapshots.

---

## Tokyo Responsibilities

- Store immutable render artifacts + the mutable `index.json` pointer in R2.
- Serve immutable artifacts with long-lived caching headers.

---

## Bob / Admin Responsibilities

- Trigger publish/unpublish as usual (no extra user workflow).
- Optional: surface “snapshot ready / using dynamic fallback” status for debugging.

---

## Failure & Rollback

- If snapshot generation fails:
  - Venice continues dynamic rendering (fail-visible via headers/metrics)
- Rollback = update `index.json.current[locale]` pointers
- No cache purge needed (new fingerprint = new URL)

---

## Security & Abuse Considerations

- Static artifacts are public by design
- Snapshot fast path is public-only: any auth headers must force the dynamic path
- Unpublish must remove/tombstone `index.json` so snapshots cannot leak after unpublish
- Sensitive widgets must opt out of snapshot mode
- Abuse throttling still applies at request level
- Domain allowlists can be enforced **before** snapshot resolution

---

## Why This Solves Jackpot Traffic

| Before | After |
|---|---|
| 1 Worker + 1 KV + SSR per view | Static CDN hit |
| Cost scales linearly with views | Cost ≈ flat |
| Apple-scale = infra risk | Apple-scale = marketing win |

---

## Open Questions (v2+)

- Embed code including an explicit fingerprint (skip `index.json` lookup)
- Snapshot generation strategy for very large locale sets (batching + rate limits)
- Paid-only add-ons (custom domains/SLA) without renderer changes
- Snapshot analytics sampling (strictly out-of-band)

---

## Success Criteria (v1)

- For published instances with snapshots, `/e` and `/r` perform **0 Paris calls** and emit `X-Venice-Render-Mode: snapshot`.
- Snapshot miss rate trends to <1% after warm (cloud-dev first).
- No user-visible regression for draft/preview/unpublished flows (dynamic path unchanged).

---

## Next Steps (execution order)

1) Tokyo-worker: implement snapshot generation job (call Venice `/e`, `/r`, `/r?meta=1` → write artifacts + update `index.json`).
2) Venice: implement snapshot fast-path for `/e` + `/r` (index.json resolve → artifact fetch), add headers/metrics.
3) Venice/loader: ensure theme/device remain runtime parameters so snapshot variants stay locale-only.
4) Paris: enqueue snapshot jobs on publish/unpublish (pass locale list).
5) Gate behind a kill-switch and load-test (prove Paris calls drop to ~0 for published views).
