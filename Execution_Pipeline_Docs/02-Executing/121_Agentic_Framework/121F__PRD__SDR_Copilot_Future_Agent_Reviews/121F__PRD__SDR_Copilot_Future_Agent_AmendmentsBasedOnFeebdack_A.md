# Amendments Based On Feedback A - 121F SDR Copilot Future Agent

Source PRD: `121F__PRD__SDR_Copilot_Future_Agent.md`
Peer reviews synthesized: PR_A, PR_B, PR_C

## 0. Product Owner Authority

This file is an AI-generated technical recommendation, not a product decision.
Only the human Product Owner decides what gets built, deferred, deleted,
combined, or accepted. The language below states my engineering recommendation
and the reason for it; it does not mark scope as closed or forbidden.

## 1. Recommendation Verdict

Amend as a recommendation-oriented future guardrail.

The core point is important: SDR Copilot and Product Copilot are separate
agents. My recommendation is that 121F not create implementation authority or
leak SDR concerns into Product Copilot.

## 2. Feedback Conflict Resolution

Resolved conflict: standalone versus fold/demote.

Keep the separation guardrail binding, but state that 121F may be folded into
121A/121E later. It creates no build scope by itself.

## 3. Recommended Amendments

1. State recommended future-agent status.

   SDR Copilot requires its own future PRD, including:

   - agent definition;
   - product surface;
   - user/context model;
   - tools;
   - policy;
   - metrics;
   - trace model;
   - safety/review boundary.

2. Ban SDR leakage into Product Copilot.

   My recommendation is that Product Copilot code and 121C implementation avoid:

   - SDR prompts;
   - sales goals;
   - prospect context;
   - lead state;
   - CRM abstractions;
   - funnel metrics;
   - SDR tool placeholders.

3. Name SDR's primary future risks.

   Future SDR work must lead with:

   - prospect/anonymous data;
   - PII;
   - consent;
   - untrusted input;
   - prompt injection;
   - data exfiltration;
   - conversion-pressure/product-law boundaries.

4. Clarify shared infrastructure.

   Shared infrastructure becomes shared only after Product Copilot proves a
   piece and SDR has its own PRD proving it needs that piece. Product Copilot's
   prompt/context/tool set is not reusable by default.

5. Avoid surface commitment.

   Prague/Minibob may be likely, but this PRD should not commit an SDR surface.

## 4. Recommendations To Avoid Unless Product Owner Chooses Otherwise

My recommendation is to avoid adding these under 121F unless the Product Owner
explicitly decides they belong there:

- CRM implementation;
- lead scoring;
- outreach sequencing;
- prospect memory;
- sales playbooks;
- Minibob/Prague implementation commitments;
- SDR manager agents;
- generic chat-widget engine work;
- shared `tool-call transport` contract while loop location remains unsettled.

## 5. Recommended Human Decision Gate

My recommendation is that 121F remain a separation guardrail: block SDR
assumptions from Product Copilot and require a future SDR execution PRD before
SDR build work begins, unless the Product Owner decides otherwise.
