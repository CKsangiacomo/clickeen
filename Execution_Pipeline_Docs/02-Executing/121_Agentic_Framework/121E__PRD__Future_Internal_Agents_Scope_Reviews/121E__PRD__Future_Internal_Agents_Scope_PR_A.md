# Peer Review A — 121E (Future Internal Agents Scope)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121E__PRD__Future_Internal_Agents_Scope.md`
Date: 2026-06-20
Verdict: **APPROVE AS DIRECTION, BUT DEMOTE OR FOLD.** The guardrail content is sound and useful — especially §3 (don't assume every agent is conversational / a Copilot / chat-UI / widget-editing / immediate / shares one context). That is exactly the anti-overfitting discipline the research's single-agent-first-but-don't-assume-one-shape principle calls for. But this is a **non-build guardrail marked `Status: EXECUTING` whose own §6 says "not implementation commitments."** You do not execute a guardrail. Demote to `01-Planning` (future-scope) or fold into 121A as a section.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 1. Elegant engineering and scalability — GOOD INTENT, NO MECHANISM

The intent is right: keep the first architecture from hard-coding Product Copilot as the template for all agents, so focused non-conversational workers (translation, analytics, QA, etc.) fit later. That preserves optionality and scales. But 121E provides no mechanism — it's a list of "the architecture must not assume X" and "each future agent must have Y." As a guardrail that's acceptable; as a standalone PRD it's the lightest possible artifact.

## 2. Compliance to architecture and tenets — STRONG

- §3 anti-assumptions (not every agent is Copilot/conversational/chat/editing/immediate/shared-context) directly protect the Copilot-vs-internal distinction (umbrella §4).
- §4 makes Copilot→internal-agent calls explicit and permissioned — correctly defers agent-to-agent (research: multi-agent = ~15× tokens, defer hard).
- §5 "internal agents keep their own domain contracts" — correct; shared rails, not shared product logic.

## 3. Overarchitecture — LOW (it's explicitly anti-platform)

§1 is clear: "not a build-now list," "not a generic workforce platform," "does not commit Clickeen to a set of named internal agents." Good discipline — this is the opposite of gold-plating.

## 3b. Academic abstraction / pre-work / meta-work — THE DOC ITSELF IS META-WORK

- **Process incoherence (the main issue).** `Status: EXECUTING` + §6 "creates future-scope guardrails, not implementation commitments" is self-contradictory. The pipeline movement gate says a doc reaches Executing when it's intended to be made real. A guardrail isn't built; it's obeyed. This is the same finding as the umbrella review's §3 (4 of 8 PRDs are guardrails marked EXECUTING).
- **Redundancy with 121A.** §2's 10-item "each future internal agent must have" (owner/trigger/subject/input/output/tools/review/policy/trace/relationship) substantially duplicates 121A's agent-specific shape. As a standalone PRD it adds tracking weight for content that belongs in 121A's "agent-specific contract" section.

## 4. Simple, boring, toward goals — GOOD, IF PLACED CORRECTLY

The guardrail is simple and boring in the good sense. The non-boring part is maintaining a standalone EXECUTING PRD for a paragraph of "don't over-fit." Folded into 121A (or kept as a short planning note) it does its job at near-zero process cost.

---

## Omissions & blast radius

### A. Depends on rails 121A hasn't defined.
§5 "SF orchestrates internal agents through the same execution rails (identity, envelope, model/tool routing, trace)" assumes the concrete rails exist. Per the 121A review they don't (concept list, no types). **Blast radius:** 121E's promise of shared rails is only as real as 121A's concretization. **Fix:** either this PRD waits on 121A's types, or it stops referencing "the same rails" as if they exist.

### B. Registry can't express the diversity §3 protects.
§3 protects non-conversational/non-editing agents, but the verified registry (`copilot`/`system_agent`, `execute`/`endpoint`) can't express durability, trigger type, or review boundary. **Fix:** note that the registry extension (called out in the 121A review) is what actually enables §3's diversity — otherwise the guardrail has no teeth.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V7 Masquerade | A guardrail labeled EXECUTING implies build progress where there is none | Open — demote/fold (main finding) |
| V3 Silent omission | "Same rails" referenced as if real | Open — Omissions-A |

---

## Required revisions

1. **Demote to `01-Planning` (future-scope) or fold into 121A as a section.** A non-build guardrail should not be `EXECUTING`.
2. **Stop referencing "the same execution rails" as if they exist** until 121A concretizes them (Omissions-A).
3. **De-duplicate §2 against 121A's agent-specific shape** — keep one canonical list.
4. **Note the registry extension** (durability/trigger/review fields) as the thing that actually enables §3's diversity, or the guardrail has no enforcement point.

Content is fine; placement and status are the fixes.

---

# Revision B — Pre-GA + eval-flywheel lens

Pre-GA doesn't materially change this one (still demote/fold — no legacy either way), and the flywheel lens is mostly N/A for a non-build guardrail. One addition: pre-GA makes the cleanest fix **delete the standalone doc and fold its §3 anti-overfitting list into 121A** (rather than "demote to 01-Planning") — there's no reason to carry a separate guardrail file when there's no back-compat keeping it alive. Original fixes (demote/fold, de-duplicate vs 121A, name the registry extension) all stand.
