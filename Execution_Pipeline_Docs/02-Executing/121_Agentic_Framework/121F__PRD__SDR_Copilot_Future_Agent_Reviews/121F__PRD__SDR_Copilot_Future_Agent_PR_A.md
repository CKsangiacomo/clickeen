# Peer Review A — 121F (SDR Copilot Future Agent)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121F__PRD__SDR_Copilot_Future_Agent.md`
Date: 2026-06-20
Verdict: **APPROVE AS DIRECTION, BUT DEMOTE OR FOLD — AND CONSOLIDATE WITH 121E.** The Product-Copilot-vs-SDR separation is genuinely important (SDR handles anonymous/prospect data, conversion, and a different risk/privacy profile), and §4 is a sharp guardrail ("don't bake Bob/Roma assumptions, Builder context, widget-edit tools, or save/publish success into the general agent architecture"). But this is the **same non-build guardrail marked `Status: EXECUTING`** problem as 121E, and it is **structurally a near-duplicate of 121E** — same shape, same "share only infrastructure" rule, same future-scope posture. Demote to `01-Planning` or fold into 121A, and merge with 121E.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 1. Elegant engineering and scalability — GOOD INTENT

Keeping SDR Copilot separable (so the architecture doesn't assume all agents are Builder Copilots) preserves optionality for the second user-facing Copilot. §2's 10-axis difference list (user/surface/context/tools/permissions/goals/risk/success-metrics/conversation-style/data-boundaries) is a correct and useful separation checklist. §3 "only infrastructure may be shared *when proven*" is the right discipline and matches the research's "extract shared framework only from real repeated need."

## 2. Compliance to architecture and tenets — STRONG

- §2 separation aligns with product boundaries: SDR lives on Prague/Minibob (funnel/acquisition), Product Copilot lives in Bob/Roma (authenticated product work). Correct.
- §4 guardrail prevents Product Copilot's implementation from leaking into the general architecture — directly supports the umbrella's two-Copilot taxonomy.
- References executed `027__PRD_20_Minibob_SDR_Agent_PRD.md` — good lineage (though doesn't reconcile against it).

## 3. Overarchitecture — LOW

Explicitly anti-shared-framework: §3 "that is not a shared Copilot framework," §5 "do not build this in the Product Copilot PRD." Good discipline.

## 3b. Academic abstraction / pre-work / meta-work — REDUNDANT + STATUS-INCOHERENT

- **Near-duplicate of 121E.** Both are "keep future agents separate from Product Copilot; share only infrastructure; don't hardcode the architecture to one agent." 121E generalizes to internal agents; 121F specializes to SDR. Maintaining two standalone PRDs for the same guardrail is process sprawl.
- **Status incoherence (same as 121E).** `Status: EXECUTING` + "future separate user-facing agent" + §6 "Product Copilot work cannot claim SDR Copilot has been solved." A future-scope guardrail is not executed.

## 4. Simple, boring, toward goals — GOOD, IF CONSOLIDATED

The guardrail is simple and correct. The non-boring part is carrying three overlapping docs (121A agent shape + 121E future-internal + 121F future-SDR) that all say "keep agents separate, share only infra." One section in 121A (or one merged future-scope note) does this job.

---

## Omissions & blast radius

### A. Data boundaries raised but not developed (the actually-hard SDR part).
§2/§5 list "data boundaries" as a difference and a future-scope item, but SDR's defining difficulty is **anonymous-visitor / prospect PII / conversion data under consent-and-privacy constraints** — exactly the governed-signal problem the umbrella flags for learning (§Omissions-F, OQ8). When SDR is actually built, this is the load-bearing work. A guardrail need not solve it, but should name it as the primary risk, not a bullet.

### B. §3 "tool-call transport" as shared infrastructure inherits the unresolved topology.
SDR Copilot will be interactive/conversational like Product Copilot — so it hits the same loop-location question (client loop vs capsule-reasoning; no SF→product callback) flagged in the 121B/121C reviews and the umbrella Revision A.1. Listing "tool-call transport" as shared infra assumes that question is settled. It isn't.

### C. Depends on 121A's rails (same as 121E).
§3's shared infrastructure list (envelope, adapters, trace, policy) is only as real as 121A's concretization — which is still a concept list.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V7 Masquerade | Future-scope guardrail labeled EXECUTING implies build progress | Open — demote/fold |
| V1 Silent substitution | SDR prospect/PII data flowing into a shared infra path without its own data-boundary contract | Future risk — name it (Omissions-A) |

---

## Required revisions

1. **Demote to `01-Planning` or fold into 121A**, and **merge with 121E** — one future-agent-separation guardrail, not two.
2. **Name data-boundaries/PII/consent as SDR's primary risk** (not a bullet) so the future SDR PRD inherits the right priority (Omissions-A).
3. **Drop "tool-call transport" from the shared-infra list** until the loop-location decision (121B/121C) is settled (Omissions-B).
4. **Reconcile with executed PRD 027** (Minibob SDR) — note what's already decided vs what this guardrail adds.

Content is correct; the fix is consolidation + honest status.

---

# Revision B — Pre-GA + eval-flywheel lens

Pre-GA: SDR can be built fresh later with zero back-compat — so the separation guardrail is still right, but there's even less reason to carry a standalone future-scope file. **Delete and fold into 121A** alongside 121E (one future-agent-separation note, not two). Flywheel lens: when SDR is eventually built, it will need its own eval flywheel (qualification/conversion quality, PII-safety graders) — note that as the future-SDR PRD's spine, but it's future. Original fixes (consolidate with 121E, name PII/consent as the primary risk, drop "tool-call transport" until loop-location settles) all stand.
