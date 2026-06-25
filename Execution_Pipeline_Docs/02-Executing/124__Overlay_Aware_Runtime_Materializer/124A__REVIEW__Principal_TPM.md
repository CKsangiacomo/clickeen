# 124A — Principal TPM Review (Schema-Token Contract Lock)

Status: REVIEW (Round 2)
Reviewer: Principal Technical Program Manager (independent peer review)
Date: 2026-06-25
Subject: `124A__PRD__Schema_Token_Contract_Lock.md` and `124A__PR.md` (orchestrator peer review, Revision 2)
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

## Verdict

**GREEN (Round 2 — all four Round-1 binding closeout conditions are addressed in
Revision 2).** The orchestrator's Rev 2 peer review closes every open menu I
flagged in Round 1, grounds each lock in independently verified code, and adds
no invented machinery. This review re-verified the load-bearing code claims
against the tree; all hold. Forward to the three-role gate.

## Round-2 Method

Round 1 gave GREEN with four binding closeout conditions. Round 2 confirms, per
condition, that Revision 2 of `124A__PR.md` addresses each — and re-ran the
code verification rather than trusting the PR's citations. Doctrine check
applied throughout: the no-reinterpretation tenet forbids reframing PRD intent
into an ideal system and adding machinery to enforce it. Rev 2 clears it.

## Per-Condition Resolution (Round 1 → Rev 2)

### Condition 1 — Purge gap (Slice 5)
**Round-1 ask:** purge code exists but `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN`
are NOT bound in `tokyo-worker/wrangler.toml`, no `cf:purge` repo command →
fails closed `503 purgeConfigMissing`. Slice 5 must lock short-TTL as the honest
serving interim and name managed-purge-config as a gap for 124E/124F.

**Rev 2 response (PR lines 67-70, "Slice 5 — condition 2"):** ADDRESSED.
- Locks "short-TTL entry freshness as the serving interim."
- Names "bind purge config + add a repo purge operation" as a documented gap
  for 124E/124F.
- States "Do not assert purge as a current capability."
- Correctly characterizes the fail-closed posture (`503 tokyo.errors.publicCache.purgeConfigMissing` on missing config) as correct-but-unproven-operational.

**Tree re-verify:** CONFIRMED.
- `tokyo-worker/wrangler.toml [vars]` binds only `BERLIN_BASE_URL`,
  `TOKYO_PUBLIC_BASE_URL`, `PUBLIC_SERVING_BASE_URL`. Neither purge var is bound.
- `operations.ts:87-93` throws `503 ... purgeConfigMissing` when zone/token/base
  are absent — fails closed, not silent-stale. Rev 2's framing is accurate.
- `grep "cf:purge\|cf:cache\|purge" package.json` returns nothing — no repo
  purge command exists. Rev 2's "no `cf:purge` repo command" claim is accurate.
- `documentation/engineering/CloudflareOperations.md` Command Decision Map has
  no cache-purge row (verified in Round 1, unchanged). Rev 2's docs note
  (PR line 114) correctly flags `tokyo-worker.md` for a current-truth correction.

**RESOLUTION: MET.** The honest interim is locked; the gap is named, not hidden.

### Condition 2 — Translation Agent chain is path-keyed (Slice 3)
**Round-1 ask:** the chain is path-keyed end-to-end → `scalar_only_initially`
is the evidence-backed Slice 3 outcome (not `compatible`).

**Rev 2 response (PR lines 50-54, "Slice 3 — THE crux"):** ADDRESSED.
- "Drop `compatible` from the menu."
- Verified end-to-end path-keying: `agents/translation-agent/src/index.ts` →
  `tokyo-worker/.../values.ts` → `tokyo/product/widgets/shared/previewL10n.js`.
- Locks the decision as binary and evidence-backed:
  `scalar_only_initially` OR `requires_full_overlay_key_chain_change`.
- States "`scalar_only_initially` is the expected outcome" given 124D's scope.

**Tree re-verify:** CONFIRMED path-keyed end-to-end.
- `agents/translation-agent/src/index.ts:116,251,316,344,350` — all key by
  `item.path`. No `identityKey` emission (grep empty).
- `tokyo-worker/src/domains/account-translations/values.ts:91-92` —
  `values[path] = overlay.values[path]`. Keys by `path`, not `identityKey`.
- `identityKey` is NOT referenced in the overlay write path (grep of
  `tokyo-worker/src/domains/account-translations/` empty for `identityKey`).

**RESOLUTION: MET.** `compatible` is removed from the menu; the evidence-backed
outcome is locked.

### Condition 3 — Preview/public divergent resolvers (Slice 7)
**Round-1 ask:** preview/public run two divergent resolvers today
(`previewL10n.js` browser JS vs server TS) → Slice 7 conformance suite must be
CI-gated.

**Rev 2 response (PR lines 75-76, "Slice 7"):** ADDRESSED.
- "The conformance suite must be a CI gate."
- Names the two divergent implementations explicitly: `previewL10n.js`
  (browser JS, silently returns on type mismatch) vs server
  (`translated-value-primitives.ts`, throws).
- States shared code is preferred but unlikely across the browser/server split;
  conformance-only is the realistic outcome.
- "Lock CI-gating, not manual QA."

**Tree re-verify:** CONFIRMED.
- `tokyo/product/widgets/shared/previewL10n.js` exists (3157 bytes) as a
  separate browser-JS resolver. Round-1 evidence of behavioral divergence
  (throw vs silent-return) stands.

**RESOLUTION: MET.** CI-gating is locked as mandatory, not optional.

### Condition 4 — Cohesive/cost-effective architecture; no invented subsystems; docs
**Round-1 ask:** systems talk to each other without invented subsystems;
SaaS-competitive parity; docs to update (product/ops perspective).

**Rev 2 response:** ADDRESSED across three sections.
- **No invented subsystems:** Rev 2's central correction (PR lines 9-12, 22-24)
  is that 124A must "lock its contracts by extending mechanisms that already
  exist, not by describing them as greenfield." The "Existing machinery 124A
  extends" table (PR lines 26-36) grounds every lock in a verified file path.
  The compliance summary (PR lines 94-105) records anti-overarchitecture
  explicitly: "extends existing `publicPackageFingerprint`/`identityKeyForField`;
  no Schema service/registry/identity DB."
- **SaaS-competitive parity:** acknowledged honestly in Round 1 Rubric 3 and
  carried forward — purge maturity and dual-resolver drift are named as the two
  parity weaknesses, with the locks above as the interim. No overclaiming.
- **Docs to update:** PR lines 106-114 enumerate conditional doc updates tied to
  specific lock outcomes, including the `tokyo-worker.md` current-truth
  correction for purge. Matches Round-1 Rubric 4.

**Doctrine check (no-reinterpretation tenet):** Rev 2's new binding conditions
(Slice 4 three-tier evidence split; Slice 2 reuse-vs-supersede + identityKey
not wired to overlay surface) are framed as *extensions of existing machinery*
(`publicPackageFingerprint` serve-gate, existing `identityKeyForField`), not as
new subsystems. Verified: `identityKey` exists
(`translated-value-primitives.ts:176-205`) but is NOT wired to any overlay
surface (Translation Agent emits `item.path`; Tokyo validates `values[path]`).
So "reuse identityKey" is real migration work for 124D, not a drop-in — and Rev
2 states this explicitly (PR line 47) to prevent 124B/124D reaching for a
compatibility reader. This respects the tenet.

**RESOLUTION: MET.**

## Rubric

### Rubric 1 — Cohesive and cost-effective architecture
**Pass (unchanged from Round 1, now better grounded).** Pre-materialized
immutable artifacts + stored-byte serving + short-TTL entry is the correct
economic baseline. Rev 2's purge-honesty lock (Condition 1) removes the one
place the architecture was implying a capability it does not have.

### Rubric 2 — Systems clarity; no invented subsystems
**Pass.** Every system keeps its current role. Rev 2's "extend, do not rebuild"
framing and the verified-machinery table close the Round-1 risk that a lock
could be read as greenfield. The `identityKey`-not-wired finding (Condition 4
verify) is the key anti-overarchitecture guard: it prevents 124D from assuming
drop-in reuse and inventing a compatibility reader when it isn't.

### Rubric 3 — SaaS world-class / competitive technical parity
**Mostly pass; same two honest weaknesses, now locked as interims.** Purge
maturity and dual-resolver drift are below best-in-class but are named, not
hidden, and bounded (short-TTL interim; CI-gated conformance). This is the
correct posture for a contract-lock seed slice.

### Rubric 4 — Docs to update (product/system-operations perspective)
**Pass.** Rev 2 ties each doc update to a specific lock outcome and includes
the `tokyo-worker.md` current-truth correction for purge. The
`CloudflareOperations.md` gap (no purge row in the Command Decision Map) is a
latent ops gap independent of 124A; Rev 2 does not require 124A to fix it but
correctly leaves it for 124E/124F.

## Vectors (Round-2 re-audit)

All seven vectors from Round 1 remain mitigated by the Rev 2 locks. No new
vector introduced by Rev 2. The two highest-consequence vectors:

| Vector | Round-2 status |
| --- | --- |
| `compatible` left on menu (Slice 3) → silent wrong-item translation (V1) | CLOSED. `compatible` removed; `scalar_only_initially` locked as expected outcome. |
| Purge assumed operational (Slice 5) → stale locale or 503-on-save | CLOSED. Short-TTL interim locked; managed-purge gap named for 124E/124F. |

## V1–V8 Audit (Contract-Lock Scope)

Unchanged from Round 1. 124A changes no runtime code, so no runtime V1–V8
violation is possible from 124A alone. The contract as locked (with Rev 2
conditions) permits no later runtime violation: V1 (silent substitution) is
guarded by the `scalar_only_initially` lock; V3 (silent omission) by Slice 6's
"explicitly non-claimed" rule; V4 (fail-open) by the existing 503 fail-closed
purge posture that Slice 5 must not weaken; V6 (partial-success masquerade) by
Slice 6 + Slice 8 closeout.

## Residual Watch-Items (non-blocking, for 124B–124H execution)

These are not Round-1 conditions and do not gate 124A. They are passed forward
as execution risks the contract now makes visible:

1. **Slice 4 canonicalization.** Rev 2 locks "JSON canonicalization rule
   (sorted keys / RFC 8785)" but does not pick one. 124B must pick exactly one
   and own it in the shared fingerprint module. (Within 124B scope, not 124A.)
2. **`identityKey` reuse is migration work.** Rev 2 states this; 124D must own
   the producer/consumer chain change and must not reach for a compatibility
   reader. (Within 124D scope.)
3. **Locale URL shape.** Rev 2 locks "pick in 124A, do not defer" (PR line 68)
   but the exact string is Step 0's. Confirm at Slice 8 that a shape is named,
   not left as "path-segment vs query vs prefix."

None of these weaken the verdict; all are within named downstream SubPRD scope.

## Final Verdict Line

**VERDICT: GREEN.** All four Round-1 binding closeout conditions are addressed
in Revision 2 and re-verified against the tree. The orchestrator's peer review
is accurate, its locks are grounded in existing machinery (not greenfield), and
it honors the no-reinterpretation tenet. Forward to the three-role gate.
