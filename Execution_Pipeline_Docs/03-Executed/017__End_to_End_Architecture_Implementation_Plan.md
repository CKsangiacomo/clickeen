# 17 - End-to-End Architecture Implementation Plan (Widgets -> Bob -> Prague -> Edge)

Status: Executed locally (Phase 0 + 0.5); cloud-dev rollout complete
Environment: local repo only (no cloud-dev writes unless explicitly called out; no Supabase resets; no instance creation/editing by agents)
Pre-GA validation uses curated instances + dev auth; no published or user instances required.

Goal
Deliver deterministic, layered overlays end-to-end across widgets, Bob, Paris, Tokyo-worker, Venice, and Prague.

Non-goals
- Asset upload versioning
- UI i18n catalogs (tokyo/i18n)
- New widgets or new block types
- Backward compatibility shims for old localization system

---

## 0) Execution decisions (locked)

1) Layer order
base -> locale -> geo -> industry -> experiment -> account -> behavior -> user

2) Layer selection semantics
- locale/geo/industry/account: 0 or 1 key (deterministic)
- experiment/behavior: multi-key (deterministic ordering by key)

3) User overrides are locale-aware
layer=user with layerKey=<locale> and optional layerKey=global fallback

4) Bob truth vs delivery
Bob reads/writes overlays from Paris only. Tokyo index is publish status/delivery, not editor truth.

5) Stale overlay handling
Never apply stale overlays (baseFingerprint mismatch -> skip).

6) Allowlist fallback
If no layer-specific allowlist exists for a widget, that layer is disabled for that widget (no ops allowed).

7) Publish atomicity
Rebuild index.json from DB state on publish; serialize per publicId/pageId only if needed.

8) Caching policy
Immutable overlays/widgets/dieter are cacheable; index.json short TTL.

---

## A) Target flow

1) Widget base config + allowlists in tokyo/widgets
2) Bob editor writes overlays to Paris (layer + layerKey)
3) Paris stores overlays and enqueues publish
4) Tokyo-worker writes overlay artifacts + index.json to Tokyo
5) Venice runtime composes base + overlays
6) Prague pages consume the same layered overlays

---

## B) Workstreams (blocking only)

C) Widgets and widget files
- Locale allowlist exists per widget
- Non-locale layers are explicitly enabled via allowlist or disabled
Done criteria
- Locale allowlist present and allowlisted paths align to base config
- Non-locale layer allowlists exist only where needed

D) Bob editor
- Locale-only UI in Phase 1-3; other layers hidden
- Curated locales come from instance layer list; user locales come from workspace locales
- User overrides written to layer=user
Done criteria
- Locale selection and save/revert work end-to-end against Paris
- Preview uses Paris overlays (not Tokyo index)

E) Paris APIs + storage
- Enforce allowlists and baseFingerprint checks
- Store latest overlay per (publicId, layer, layerKey)
- Enqueue publish on upsert/delete
Done criteria
- Layer endpoints return baseFingerprint + timestamps
- Overlay upsert/delete paths succeed for locale + user layers

F) Tokyo-worker + Tokyo assets
- Deterministic overlay paths
- index.json rebuilt from DB state
Done criteria
- index.json reflects DB after publish (no lost keys)

G) Venice runtime
- Deterministic layer order
- Skip stale/missing overlays (curated missing required locale fails fast in dev)
Done criteria
- Runtime matches layered composition spec

H) Prague pages + blocks
- Layered overlays emitted under tokyo/l10n/prague
- Page JSON uses canonical publicIds
Done criteria
- /en and /fr render correctly for curated pages

---

## C) End-to-end gate (blocking)

1) Bob edit -> Venice render
Edit locale field in Bob, publish, verify Venice embed shows updated copy.

2) Prague multi-locale render
/en and /fr render with correct overlays.

Status (local): curated instance overlay upsert + Venice render verified via dev auth; Prague l10n verify passed.

---

## D) Cloud-dev rollout (human-run)

Deployment order
Tokyo-worker -> Paris -> Venice -> Prague -> Bob

Validation gate
- Curated instances load in Venice and Prague
- Bob preview matches Paris state
- No 404s for overlay paths

Status (cloud-dev): tokyo-worker, Paris, Venice, Prague, Bob deployed.
