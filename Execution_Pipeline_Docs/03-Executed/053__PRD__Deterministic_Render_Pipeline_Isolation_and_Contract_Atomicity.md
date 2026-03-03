# PRD 53 - Stop Runtime Healing: One Truth for Assets and Locales

> superseded by PRD 54

## Hard tenets (cross-PRD)

### Venice must be a dumb renderer of Tokyo output.
Desired STATE=One truth. Venice public `/e/:publicId` and `/r/:publicId` serve Tokyo snapshot bytes as-is.
SYSTEM FAILURE STATE=Venice fixes/changes/fallbacks data at request time.
SYSTEM FAILURE STATE=Same instance+locale renders differently by path/environment.

### Locale and asset pipelines must be isolated.
Desired STATE=Locale pipeline updates only translatable content.
Desired STATE=Asset pipeline updates only asset refs/blobs.
Desired STATE=Asset pipeline and locale pipelines are two different and indipendent systems and pipelines
SYSTEM FAILURE STATE=Locale jobs can break media or media jobs can look like locale bugs.

### Locales must be incremental from base and entitlement-bounded.
Desired STATE=Base changes trigger targeted locale updates for changed fields only.
Desired STATE=Final locale set is capped by entitlement.
SYSTEM FAILURE STATE=Mixed locale generations (new + stale) and unpredictable entitlement behavior.

### Assets must be user-managed (Roma), never system-healed.
Desired STATE=Users manage assets in Roma Assets only.
SYSTEM FAILURE STATE=Bob/Tokyo/Venice auto-repair, auto-replace, or fallback asset values.
SYSTEM FAILURE STATE=Audit trail breaks (user choice vs silent system mutation).

### Same rules for curated and user instances.
Desired STATE=Curated and user instances use the same publish/runtime contracts.
SYSTEM FAILURE STATE=Special curated behavior creates a second architecture and hides parity bugs.

## Hard invariants (implementation rules)

1. Venice public serving is snapshot-only and byte-faithful. No public dynamic fallback.
2. Tokyo-worker must not move publish pointer to a revision that contains forbidden legacy asset paths (at minimum `/arsenale/`).
3. Runtime media resolution uses canonical refs only (`asset.versionId` / `poster.versionId`).
4. Missing canonical asset refs must be unavailable and observable (no silent fallback):
   - `/r` payload includes explicit asset availability signal.
   - response headers include explicit asset availability signal.
5. Snapshot locale set is resolved then entitlement-capped (`l10n.locales.max`) before snapshot generation.
6. Snapshot orchestration endpoint behavior is identical for curated and user instances.

---

Status: EXECUTED IN CODE (awaiting peer validation + move to 03-Executed)
Date: 2026-02-28
Owner: Product Dev Team
Priority: P0

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

Pre-GA posture (locked):
- We are pre-GA and admin-owned today.
- Prefer boring deletion of fallback/special-case logic over new abstractions.
- No new services, no speculative migrations, no redesign work in this PRD.

---

## One-line objective

Stop snapshot drift and runtime healing so one instance has one truth across Builder, Roma workflows, and Venice embeds.

---

## Why this PRD exists

Observed break:
1. Dynamic Venice (`X-Ck-Snapshot-Bypass: 1`) returned canonical asset refs.
2. Public snapshot Venice served stale locale artifacts containing legacy `/arsenale/` asset paths.
3. Same instance diverged between dynamic path and public snapshot path.

This is exactly the failure state this architecture forbids: two truths.

---

## End state

1. Tokyo-worker rejects invalid snapshot artifacts before publish pointer move.
2. Venice public routes remain dumb snapshot serving (no healing/fallback).
3. Shared fill stops reading raw legacy media URL fields.
4. Missing asset refs are unavailable and explicitly signaled to callers.
5. Locale cap is applied to the final resolved locale set.
6. Curated/user snapshot orchestration path is unified.

---

## Scope

In scope:
1. Tokyo-worker snapshot validation/carry-forward hardening.
2. Shared fill canonical asset resolution hardening.
3. Paris final-locale entitlement cap hardening.
4. Paris curated/user orchestration parity hardening.
5. Runtime verification evidence.

Out of scope:
1. New widget features.
2. UX redesign.
3. New infrastructure/services.
4. Full render data-model redesign.

---

## Execution slices (small, boring changes)

### Slice A - Tokyo snapshot guardrails

Goal: never publish bad snapshot artifacts.

Actions:
1. Validate generated `r.json` and `meta.json` before publish pointer move.
2. Reject locale artifact if it contains forbidden legacy path patterns (starting with `/arsenale/`).
3. Re-validate carry-forward locale artifacts from prior revision; if invalid, exclude from new revision index.
4. Keep publish pointer on previous healthy revision when target artifact validation fails.

Acceptance:
1. Invalid locale artifact never appears in `current` map for published revision.
2. Publish pointer does not advance when validation fails.
3. Failure reason is visible in render health/publish status.

### Slice B - Shared fill strict asset resolution

Goal: runtime media path follows canonical asset contract only.

Actions:
1. Remove raw media fallback reads (`src`, `url`, `poster`, `posterSrc`) in `tokyo/widgets/shared/fill.js`.
2. Resolve media only from canonical version refs (`asset.versionId`, `poster.versionId`).
3. Emit explicit unavailable signal when canonical refs are missing:
   - add field in `/r` payload.
   - add response header for diagnostics.

Acceptance:
1. Runtime no longer emits legacy `/arsenale/` asset requests from fallback fields.
2. Missing canonical refs are fail-visible (unavailable + explicit signal), not silently healed.

### Slice C - Paris locale entitlement cap after merge

Goal: final snapshot locale set is deterministic and entitlement-bounded.

Actions:
1. Resolve locale candidates from workspace locales + persisted overlays.
2. Apply `l10n.locales.max` to the final merged set before snapshot generation.
3. Keep stable reason reporting when locales are capped/skipped.

Acceptance:
1. Final snapshot locale set never exceeds entitlement.
2. Persisted overlay history cannot bypass entitlement cap.

### Slice D - Curated/user orchestration parity

Goal: remove instance-kind branch from snapshot orchestration.

Actions:
1. Remove curated-only restriction in workspace snapshot orchestration handler.
2. Keep authz/policy checks unchanged.

Acceptance:
1. Same endpoint contract works for curated and user instances.
2. No curated-specific branch remains in orchestration path.

### Slice E - Verification and evidence

Goal: prove one-truth behavior end-to-end.

Actions:
1. Compare dynamic `/r` (bypass) vs public snapshot `/r` for same instance/locales.
2. Verify published artifacts contain no forbidden legacy asset paths.
3. Verify missing asset refs are marked unavailable with explicit signal.
4. Run targeted lint/typecheck.

Acceptance:
1. Asset refs are parity-consistent between dynamic and snapshot paths.
2. No `/arsenale/` path appears in published `r.json`/`meta.json`.
3. Evidence recorded in `053__Execution_Report.md`.

---

## Required commands

Local:
```bash
bash scripts/dev-up.sh
pnpm typecheck
pnpm lint
```

Targeted runtime checks:
```bash
curl -sS -H 'X-Ck-Snapshot-Bypass: 1' "http://localhost:3003/r/<publicId>?locale=es" | jq '.'
curl -sS "http://localhost:3003/r/<publicId>?locale=es" | jq '.'
```

Artifact checks:
```bash
curl -sS "http://localhost:3001/renders/instances/<publicId>/published.json" | jq '.'
```

---

## Definition of done

All must be true:
1. Tokyo-worker blocks publish pointer move when snapshot artifacts fail legacy-path validation.
2. Shared fill uses canonical version refs only; raw URL fallback reads are removed.
3. Missing canonical refs are unavailable and observable in payload/headers.
4. Locale cap is applied after merged locale resolution.
5. Curated and user snapshot orchestration contracts are identical.
6. `053__Execution_Report.md` contains command outputs and parity evidence.
