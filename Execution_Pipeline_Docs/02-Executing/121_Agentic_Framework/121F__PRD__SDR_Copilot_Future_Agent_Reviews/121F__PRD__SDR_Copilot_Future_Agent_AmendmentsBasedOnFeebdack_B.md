# Recommendations based on peer reviews — 121F (SDR Copilot Future Agent)

Source reviews: `_PR_A` (Approve as direction; demote/merge with 121E), `_PR_B` (Accept as-is; highest-value guardrail), `_PR_C` (Pass; tighten the negative ban).
**My recommendations + reasoning — not decisions. Build/cut/sequence is yours.**

## What I recommend (and why)

1. **Keep the separation guardrail — PR_B calls it the highest-value guardrail in the series, and I agree.** §4's three concrete leaks (Builder context / widget-edit tool / save-publish-as-success hardcoded into the general architecture) are what make it enforceable.
2. **Add an enforceable negative ban:** Product Copilot code must not introduce SDR-specific prompts, prospect/lead state, CRM abstractions, funnel metrics, sales goals, or sales-tool placeholders; **and prospect input must be treated as data, not instructions** (prompt-injection / exfiltration hardening). Why: PR_B/PR_C — this is the concrete leak to prevent.
3. **Make it testable via 121C acceptance:** assert that no Builder-specific vocabulary has leaked into the shared agent contract. Why: PR_B — enforcement belongs at the point it can be violated.
4. **Elevate data boundaries from a bullet to the named primary SDR risk** — prospect PII / consent / privacy is the load-bearing future work. Why: PR_A — it's currently under-weighted.

## My take on where the reviews split
Separation itself is unanimous. The split is **disposition** (PR_A: merge with 121E as near-duplicate; PR_B/PR_C: keep standalone) and **breadth of the negative ban** (PR_C wants a long enumerated blacklist; PR_A wants only data-boundaries elevated). I'd take PR_C's enumeration AND elevate data-boundaries — they're not in conflict.

## Decisions that are yours (product/scope)
- **Merge with 121E vs standalone:** I'd merge (they're near-duplicates). PR_B/PR_C would keep separate. Your call.
- **`Status: EXECUTING`:** I wouldn't mark a future-scope guardrail executing; and I'd state it creates no implementation tickets and the SDR surface is unresolved. Your call.
- **"Tool-call transport" as shared infra:** I'd drop it until the loop-location decision (121B/121C) settles. Your call.
- **Reconcile with executed PRD 027 (Minibob SDR):** I'd add a note on what's already decided vs what 121F adds. Your call.

## Net
Recommendations 1–4 make the guardrail enforceable and testable, with data-boundaries named as the primary risk. Whether it merges with 121E and its status are your calls.