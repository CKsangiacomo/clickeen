# Peer Review C - 121 Clickeen Agentic Framework Umbrella

Reviewer: Codex, staff-engineer lens
Date: 2026-06-20
Scope: `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`
Verdict: Pass as umbrella direction, with scope-tightening required before child PRDs execute.

---

## 0. Second-Pass Runtime Evidence

This review was rechecked against:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/ai/overview.md`
- `documentation/ai/infrastructure.md`
- `packages/ck-contracts/src/ai.ts`
- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/telemetry.ts`
- `roma/lib/ai/account-copilot.ts`

Verified runtime truth:

- San Francisco already has deployed execution plumbing: `/v1/execute`,
  `/v1/outcome`, HMAC grants, provider/model routing, `SF_EVENTS`, D1/R2
  learning samples, and explicit agent ids.
- Current executable `/v1/execute` agent is `cs.widget.copilot.v1`.
- `widget.instance.translator` exists in the registry but currently uses an
  endpoint surface, not the generic `/v1/execute` executor.
- The umbrella must therefore say "build real agents from the current deployed
  spine" rather than implying every runtime primitive starts from zero.
- The old Copilot path is still a masquerade because Bob performs local
  deterministic regex/control turn and scope resolution before the model call.

Second-pass correction: the umbrella direction is right, but child PRDs must not
erase current runtime truth. They must replace the masquerade behavior while
reusing or narrowly extending real deployed execution primitives where they are
still valid.

## 0b. Best-Practice Research Lens

Research checked:

- Anthropic, `Building Effective Agents`
  (`https://www.anthropic.com/engineering/building-effective-agents`)
- OpenAI Agents SDK overview, agent definitions, orchestration, guardrails,
  tools, and tracing docs
  (`https://developers.openai.com/api/docs/guides/agents`)
- Google ADK overview (`https://adk.dev/`)
- LangChain human-in-the-loop docs
  (`https://docs.langchain.com/oss/python/langchain/human-in-the-loop`)
- OWASP Top 10 for LLM Applications
  (`https://owasp.org/www-project-top-10-for-large-language-model-applications/`)

Best-practice implication:

- Anthropic's strongest production guidance is to start simple, distinguish
  workflows from agents, and increase complexity only when flexibility or
  model-directed decisions justify the cost.
- OpenAI's current agent architecture frames agents around instructions, tools,
  structured outputs, guardrails, handoffs, sessions/state, and tracing.
- OpenAI orchestration guidance says specialists should be added only when they
  materially improve capability isolation, policy isolation, prompt clarity, or
  trace legibility.
- Guardrails and human review are first-class controls for input, output, tool
  behavior, and side effects.
- OWASP's LLM risks reinforce Clickeen's product law: prompt injection,
  insecure output handling, and excessive agency are expected failure modes when
  LLM output is allowed to act without validation.

Against that research, the umbrella is directionally best-in-class only if it
stays boring:

```text
one real Product Copilot proof
minimum San Francisco orchestration delta
explicit tools/actions
structured outputs
product-owned validation
trace/outcome records
future specialists only after contract need is proven
```

The umbrella should not promote multi-agent systems, self-hosting, global
learning, or "workforce OS" as implementation prerequisites. Modern best
practice supports those as later capability layers, not as the starting point.

## 0c. Pre-GA / No Back-Compat Lens

Clickeen is pre-GA, so this review should be sharper: there is no customer
compatibility contract requiring Clickeen to preserve the current fake-agent
shape, the 120-series implementation shape, or the Bob regex/control matcher.

Pre-GA changes the recommendation:

- Do not keep compatibility shims for masquerade behavior.
- Do not preserve old envelope names, turn classes, or regex routing just because
  runtime code already exists.
- Do not treat executed PRDs as migration constraints when they shipped the wrong
  product concept.
- Prefer replacing the bad path cleanly over wrapping it with a "real agent"
  facade.

Pre-GA does not change product law:

- product surfaces still own product truth;
- account/session/storage authorities still matter;
- invalid context must fail visibly;
- model/provider flexibility still belongs below the agent contract;
- future multi-agent/self-hosted/learning work still cannot become day-one
  machinery.

Therefore the umbrella should explicitly authorize deletion/replacement of
current fake-agent architecture where it conflicts with the real-agent design.
It should not ask teams to preserve compatibility with a Copilot behavior that
is not the intended product.

## 1. Elegant Engineering And Scalability

The PRD is strongest where it names the actual system truth:

- Clickeen has no real agents today.
- The current Builder Copilot is regex/control matching plus one model call.
- San Francisco is currently gateway/spine, not an orchestrator.
- Product surfaces remain truth owners.
- Published widget runtime and Ombra inference are different planes.

That is the right foundation for an AI-first company because it avoids the most
common failure mode: mistaking integration plumbing for intelligence.

The scalable engineering idea is also correct:

```text
closed product system
-> explicit product map
-> explicit capability/tool surface
-> agent reasoning
-> product-owned validation
-> trace/outcome records
```

That lets models reason inside Clickeen instead of wasting tokens discovering
what Clickeen is.

The Cloudflare/edge point is especially important. It prevents the architecture
from confusing high-volume published widget traffic with high-concurrency AI
traffic. That distinction keeps cost, latency, and product reliability sane.

## 2. Compliance To Architecture, Product Law, And Tenets

The PRD is compliant with the core Clickeen laws:

- Bob owns in-memory Builder editing.
- Roma owns account/session/product route authority.
- Tokyo-worker owns persisted account runtime storage.
- Berlin owns auth/session bootstrap.
- San Francisco can execute/orchestrate AI, but does not own product truth.
- Agents act through product-owned tools and validated product actions.

It also complies with the explicit tenet:

> Do not reinterpret the PRD intent into an ideal system and then add machinery
> to enforce that reinterpretation.

The PRD avoids that by stating that the current system is missing the agent
brain and by making 121A-H the decision/execution path instead of pretending the
old 085/120/regex path is a sufficient base.

The separation between Product Copilot, SDR Copilot, Translation Agent, and
future internal agents is directionally correct. The umbrella no longer treats
"copilot" as a shared product abstraction.

Runtime-truth correction: the umbrella should not imply every execution primitive
starts from absolute zero. San Francisco already has deployed spine pieces such
as `/v1/execute`, `/v1/outcome`, telemetry/events, grant verification, and model
routing. The missing piece is a governed real agent/orchestration and eval
substrate, not every byte of AI runtime plumbing.

## 3. Overarchitecture Or Unnecessary Complexity

Main risk: the umbrella is long enough that it starts to do child-PRD work.

The strongest umbrella sections are the blunt reality, product law, core thesis,
and downstream PRD map. The weaker sections are the long option catalogs inside
`OQ1` through `OQ10`. Those options are useful thinking, but some belong in
121A, 121B, 121C, 121G, or 121H.

Blast radius if left unchanged:

- Engineers may treat umbrella option leanings as implementation decisions.
- Child PRDs may duplicate or fight the umbrella.
- Reviewers may debate umbrella theory instead of executing 121A/121B/121C.

Concrete tightening before execution:

- Keep umbrella as law/direction.
- Move detailed execution-envelope decisions to 121A/121B.
- Move Product Copilot context/action details to 121C.
- Move learning mechanics to 121G.
- Move self-hosted routing details to 121H.

## 3b. Academic / Meta-Work / Gold-Plating Risks

The PRD has a controlled but real academic-drift risk around:

- "agent-to-agent";
- "durable orchestrator";
- "learning substrate";
- "global widget-network learning moat";
- "Clickeen-hosted/tuned model path."

Those are legitimate future ideas, but dangerous if they become prerequisites
for Product Copilot.

The document mostly handles this by marking future-scope guardrails, but the
language should stay strict:

```text
Product Copilot first.
Translation Agent second proof.
No workforce platform before real agents.
No self-hosting before routing/evals justify it.
No autonomous learning before trace/outcome foundations.
```

## 4. Why This Is Simple And Boring

The simple path is:

1. Admit no real agent exists.
2. Define architecture rails.
3. Make San Francisco orchestrate known agent execution.
4. Build Product Copilot as the first hard proof.
5. Build Translation Agent as the focused internal proof.
6. Capture traces/outcomes from day one.
7. Keep future model/self-hosted choices pluggable.

That is boring in the right way. It does not start by building a platform. It
starts by building one real agent and one focused internal worker against
existing product boundaries.

## 5. Required Corrections Before Execution

Required:

- Treat this as the umbrella only. Do not let it be the implementation spec.
- Ensure 121A/121B own all first-envelope/orchestration decisions.
- Ensure 121C owns Product Copilot turn behavior.
- Ensure 121D owns Translation Agent artifact behavior.
- Keep 121E/121F/121G/121H as architecture guardrails unless explicitly promoted
  into implementation PRDs.
- Replace any ambiguous "build from zero" interpretation with "build real agents
  from the current deployed spine while replacing masquerade behavior."
- Downgrade child-agent calls, self-hosting, and global widget-network learning
  to explicit non-execution guardrails for the first Product Copilot proof.
- Reconcile existing San Francisco runtime truth: `/v1/execute`, `/v1/outcome`,
  telemetry/events, grant verification, and model routing.

Recommended:

- Add a short "This umbrella does not execute code" note near the top.
- Add a "child PRD authority" table mapping each open question to the PRD that
  owns the decision.

## 6. V1-V8 Audit

- V1 Silent substitution: Pass. The PRD does not invent current agent capability.
- V2 Silent healing: Pass. It does not normalize the old Copilot as acceptable.
- V3 Silent omission: Watch. It must not omit that child PRDs own execution
  decisions.
- V4 Fail-open control: Pass. Product validation remains required.
- V5 Corruption-as-absence: Pass. Broken current Copilot is named, not ignored.
- V6 Partial-success masquerade: Pass. The PRD says the current shipped agents
  are not real agents.
- V7 Masquerade/redress: Pass with watch. Strong anti-regex language is present.
- V8 Runtime test dependency: Pass. No runtime behavior depends on this doc.
