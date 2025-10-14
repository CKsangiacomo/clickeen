# Phase‑1 Infra Backlog (Trimmed for P1; Dieter WIP)

Last Updated: 2025-10-10
Scope: Platform infra verification only (Paris, Venice, Michael, Geneva). Bob is blocked on Dieter components; avoid app‑layer scope.

Overall Status: Pre‑GA — a few critical verifications left

---

## Status Summary

- Verified
  - Paris API endpoints implemented; auth, tokens, submissions, usage, entitlements
  - Venice SSR for 6 widget types; CSP nonce + strict CSP; pixel + submit proxy
  - Michael schema applied (RLS, dedup/indexes); Geneva seeds for 6 widget types
  - Rate limiting with Redis optional + breaker and SQL fallback
  - Pre‑ship harness covers core infra (CSP, CORS, PUT guard, status‑only, dedup)

- Needs Verification (P0 unless noted)
  - Loader overlay a11y: add Esc close + basic focus trap (Phase‑1 contract)
  - Loader bundle size ≤ 28KB gz (current implementation to be measured)
  - Widget SSR initial ≤ 10KB gz (measure representative renders)
  - Venice validators: 304 on ETag/Last‑Modified; `Vary` present (spot check)
  - CORS happy path: allowed Origin returns 200 (we test disallowed + S2S already)
  - AJV availability: ensure validator present in staging/prod (health signal)
  - Static vs DB catalog alignment for templates (see ALIGN‑1 risk)

---

## 1) Infra Verification Tasks

### Priority 0 — Critical Pre‑GA

#### [ ] ALIGN‑1: Align Template Sources (Static vs DB)
Risk: HIGH — Template switches use DB descriptors; static catalog IDs differ for several types. Instances created with static IDs can fail later transforms.
Action: For Phase‑1, either seed DB with static IDs in `paris/lib/catalog.ts` or resolve schemaVersion via static catalog when switching, falling back to DB. Pick one path and document.

#### [ ] INFRA‑1: Loader Overlay A11y + Bundle Size
Files: `venice/app/embed/v1/loader.ts`
Checks:
- Add Esc to close overlay; minimal focus trap on open; click‑to‑dismiss preserved
- Gzip size ≤ 28KB
Measure:
```bash
cd venice && pnpm build
gzip -c .next/server/app/embed/v1/loader.js | wc -c   # ≤ 28672
```

#### [ ] INFRA‑2: Widget SSR Budgets (10KB gz)
Quick sample (light/desktop):
```bash
for t in forms.contact content.faq social.testimonials engagement.announcement engagement.newsletter social.proof; do
  curl -s "http://localhost:3002/e/wgt_${t}?theme=light&device=desktop" | gzip -c | wc -c
done  # each ≤ 10240
```

#### [ ] INFRA‑3: Venice Validators & Caching
Checks:
- ETag + Last‑Modified present; 304 on If‑None‑Match/If‑Modified‑Since
- `Vary: Authorization, X-Embed-Token`

#### [ ] INFRA‑4: CORS Happy Path
Set `ALLOWED_ORIGINS` with an allowed origin and confirm `PUT /api/instance/:id` with that Origin returns 200; disallowed remains 403; S2S no Origin returns 200.

#### [ ] HEALTH‑1: AJV Present in Non‑dev
Add a health signal: if AJV fallback is active, mark validator=false in `/api/healthz` (treated as 503 in staging/prod). Do not add CI gate.

### Priority 1 — High

#### [ ] INFRA‑5: Pre‑Ship Harness Full Pass
Run as documented; keep as regression net, not a CI blocker.
```bash
pnpm --filter @clickeen/pre-ship verify
```

#### [ ] PERF‑1: Spot Performance Checks (non‑blocking)
- Edge TTFB Venice `/e/:publicId` ≲ 100ms (env‑dependent)
- TTI via Lighthouse on a test page (informational)

---

## 2) Post‑Launch (Non‑Blocking)

#### [ ] DB‑IDX: Verify FK Index Applied
Migration exists; verify on envs when practical.
```sql
SELECT indexname FROM pg_indexes WHERE tablename='widget_instances' AND indexname='idx_widget_instances_widget_id';
```

#### [ ] A11Y‑POLISH: Loader overlay polish (transitions/ARIA fine‑tuning)

#### [ ] PERF‑REVISIT: Publishing count query revisit if scale demands

---

## 3) Test Consolidation (No CI Bloat)

- Keep pre‑ship as primary automated harness; extend minimally to:
  - Add a “allowed origin” happy‑path check
  - Add a 304 conditional GET check on Venice
  - Record loader and a couple of widget gz sizes to artifacts
- Do not introduce new error checks for already fixed issues (CORS S2S, PUT guard, dedup, etc.). Keep them as regressions only.

---

## 4) Risk Register (Focused)

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Template catalog mismatch (static vs DB) | MED | HIGH | ALIGN‑1 (seed or resolve via static) |
| R2 | Loader bundle >28KB or missing a11y | LOW | HIGH | INFRA‑1 (optimize + add Esc/focus trap) |
| R3 | Widget SSR >10KB | MED | MED | INFRA‑2 (trim CSS/markup) |
| R4 | AJV missing in prod → silent accept‑all | LOW | HIGH | HEALTH‑1 (health flag; treat as 503) |
| R5 | CORS allowlist misconfigured in prod | LOW | MED | Add allowed‑origin check before GA |

---

## 5) Review Summary (Phase‑1 Lens)

- Scope adherence: Good — embeds SSR only; strict CORS; tokens; plan/branding enforced; Bob intentionally deferred.
- Engineering: Clean separation; pragmatic fallbacks (Redis/AJV) with safe degradation.
- Complexity: Within P1; avoid elevating static/DB duality — fix via ALIGN‑1.
- Systemic risks: Primarily template source mismatch and validator presence; both actionable.
- Legacy/noise: Historical shim migration retained; acceptable. Keep TEMP artifacts isolated; no CI changes.
- No new checks for solved issues: Maintain current tests as regression only; do not add CI gates.
- CI/CD minimalism: Preserve current on‑demand harness; no blocking pipelines until P2.

---

Next Steps (GA path): ALIGN‑1 → INFRA‑1/2/3/4 → HEALTH‑1 → Pre‑ship full pass
