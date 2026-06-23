# Peer Review C - 121F SDR Copilot Future Agent

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121F__PRD__SDR_Copilot_Future_Agent.md`
Verdict: Pass as future-scope guardrail; must not leak SDR concepts into Product Copilot.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/strategy/WhyClickeen.md`
- `documentation/ai/README.md`
- `packages/ck-contracts/src/ai.ts`
- `bob/components/CopilotPane.tsx`
- `roma/lib/ai/account-copilot.ts`

Verified runtime truth:

- Current user-facing account AI path is `cs.widget.copilot.v1` through Roma
  account instance Copilot routes.
- No SDR Copilot runtime path is active in the current product path.
- Prague demo/minibob is not a live AI execution surface according to current
  San Francisco docs.
- Product Copilot runtime currently carries Bob/Roma Builder assumptions. Those
  assumptions must not become the basis for future SDR.

Second-pass correction: 121F should remain a future boundary only. It should
explicitly block SDR prompts, prospect state, sales metrics, CRM concepts, and
funnel tools from entering Product Copilot code or 121A/121B V1 scope.

## 0b. Best-Practice Research Lens

Best-practice handoff and multi-agent guidance supports the product instinct
here: SDR Copilot is a separate future agent only if it has its own surface,
instructions, tools, policy, and user outcome. It should not share Product
Copilot's Builder brain just because both are conversational.

Best-practice alignment:

- Separate conversational agents are justified when they operate over different
  domains and different side-effect boundaries.
- Shared provider/model plumbing is acceptable; shared prompts, tools, context,
  and product memory are not.
- No SDR "manager agent" or sales-tool placeholder should exist until the Prague
  or minibob surface has a real product contract.

Required PRD tightening:

- Keep 121F as a future scoping document and explicitly forbid SDR concepts from
  121C's implementation.
- When SDR starts, require its own agent definition, tool manifest, outcome
  metrics, trace model, and safety/review policy.
- Do not treat Product Copilot as a reusable chat widget engine.

## 0c. Pre-GA / No Back-Compat Lens

Pre-GA reinforces the separation between Product Copilot and SDR Copilot. There
is no compatibility reason to preload Product Copilot with SDR abstractions or
to keep any shared "copilot framework" from earlier attempts.

Pre-GA amendment:

- Delete or ignore SDR placeholders in Product Copilot work unless a separate
  SDR PRD makes them real.
- Do not preserve generic chat/copolymer abstractions for a hypothetical SDR
  future.
- Reserve the right to design SDR Copilot from zero later, with its own surface,
  tools, policy, and metrics.

This prevents the same old mistake: building shared Copilot machinery before
either Copilot has a real product contract.

## 1. Elegant Engineering And Scalability

The PRD makes the important product correction: SDR Copilot is not Product
Copilot's cousin.

That is the right scalable decision. Product Copilot operates inside Clickeen
product work. SDR Copilot operates in acquisition, sales, and growth. They have
different users, surfaces, context, tools, risks, metrics, and permissions.

The PRD correctly allows only infrastructure-level overlap:

- execution envelope;
- provider/model adapters;
- trace/cost/error records;
- policy gates;
- tool-call transport;
- versioning.

That is infrastructure, not shared Copilot product logic.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is compliant with the key tenet:

> Product Copilot and SDR Copilot are separate agents.

It explicitly prevents:

- shared context;
- shared tools;
- inherited Product Copilot prompts;
- inherited Product Copilot permissions;
- treating Builder context as generic agent context.

This protects Product Copilot from becoming a lowest-common-denominator Copilot
framework and protects SDR from inheriting Bob/Roma product assumptions.

## 3. Overarchitecture Or Unnecessary Complexity

The text itself is not overbuilt.

The downstream risk is high: teams may build "future SDR support" into Product
Copilot architecture now.

Do not build now:

- SDR prompts;
- prospect context;
- lead state;
- CRM abstractions;
- funnel metrics;
- sales goals;
- SDR safety systems;
- SDR tool placeholders;
- growth-agent primitives.

Blast radius if violated:

- Product Copilot context gets polluted with non-product assumptions.
- Product Copilot execution becomes generic and weaker.
- SDR still will not be solved because its own product surface and goals remain
  undefined.

## 3b. Academic / Meta-Work / Gold-Plating Risks

The risk is speculative sales-agent architecture before the SDR product exists.

The PRD should not define:

- prospect memory;
- lead scoring;
- outreach sequencing;
- funnel orchestration;
- sales-agent playbooks;
- Minibob implementation details.

Those belong in a later SDR execution PRD.

## 4. Why This Is Simple And Boring

This PRD is simple because it says one thing:

```text
do not solve SDR inside Product Copilot
```

That is exactly the right architecture guardrail. The first agent proof remains
Product Copilot. The future SDR agent can reuse only boring infrastructure after
its own surface and product truth are defined.

## 5. Required Corrections Before Execution

Required:

- Add a stricter negative requirement: Product Copilot code must not include
  SDR-specific prompts, sales goals, prospect context, lead state, CRM
  abstractions, or funnel metrics.
- Clarify that shared infrastructure becomes shared only after Product Copilot
  proves it and SDR has its own execution PRD.
- State the future SDR surface is unresolved. Prague/Minibob may be likely, but
  this PRD should not accidentally commit the surface.
- State 121F creates no implementation tickets by itself.

## 6. V1-V8 Audit

- V1 Silent substitution: Pass. It does not claim SDR exists.
- V2 Silent healing: Pass. No current state repair is proposed.
- V3 Silent omission: Watch. It should explicitly ban SDR leakage into Product
  Copilot implementation.
- V4 Fail-open control: Pass. No product authority is changed.
- V5 Corruption-as-absence: Pass.
- V6 Partial-success masquerade: Pass. Product Copilot cannot claim SDR solved.
- V7 Masquerade/redress: Pass. It rejects shared Copilot framework.
- V8 Runtime test dependency: Pass.
