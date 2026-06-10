# LLM Provider Landscape — Clickeen Decision Brief

**Date:** June 9, 2026  
**Scope:** All production-grade LLM APIs beyond OpenAI/Anthropic, evaluated for Clickeen's three core use cases: Babel (mass translation), San Francisco copilot (interactive turns), GTM agent / durable orchestration  
**Recommendation:** Multi-model routing strategy built into the SF signed policy — not a single-provider bet

---

## Pricing Reference (per 1M tokens, June 2026)

| Model | Input | Output | Context | Data Routing |
|---|---|---|---|---|
| **DeepSeek V3** | $0.14 | $0.28 | 128K | China (caution for EU/enterprise) |
| **DeepSeek R1** (reasoning) | $0.55 | $2.19 | 128K | China |
| **DeepSeek V4 Preview** | $1.74 | $3.48 | 1M | China |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | Google global |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | 1M | Google global |
| **Gemini 2.5 Pro** | $1.00–$1.25 | $10.00 | 1M | Google global |
| **Mistral Small** | $0.10 | $0.30 | 32K | EU by default |
| **Mistral Large 3** | $2.00 | $6.00 | 128K+ | EU by default |
| **Codestral** (Mistral) | $0.30 | $0.90 | 256K | EU by default |
| **Llama 4 Scout** (Together/Groq/Fireworks) | $0.10 | $0.25 | **10M** | US (provider-dependent) |
| **Llama 4 Maverick** | $0.20 | $0.60 | 1M | US (provider-dependent) |
| **GPT-4.1 mini** | $0.40 | $1.60 | 1M | US |
| **Claude Haiku 3.5** | $0.80 | $4.00 | 200K | US |

---

## Use Case Routing Map

### Use Case 1 — Babel (mass translation, 29+ languages × N widgets)

**Task profile:** High volume, structured output, field-by-field, no reasoning needed, batch-friendly  
**Quality bar:** Accurate, on-brand, correct field paths, no hallucinated keys  
**Cost sensitivity:** High — this is a recurring cost on every new widget × every locale

**Primary recommendation: Gemini 2.5 Flash-Lite ($0.10/$0.40)**  
- Cheapest frontier-adjacent model with 1M context  
- Google infrastructure = no data sovereignty concerns  
- Large enough context to process a full widget field set in one call  
- No China routing risk for EU/enterprise customers

**Backup / cost-floor alternative: Llama 4 Scout via Together AI ($0.10/$0.25 with 10M context)**  
- Extraordinary context window for batch jobs (entire widget catalog in one call)  
- Cheapest option on the market at this quality tier  
- Caveat: open-weight served by third party — verify Together AI quantization quality before production use

**What to avoid for Babel:** DeepSeek if EU or enterprise customers are on the roadmap — data routing to China is a sales friction point and a GDPR risk.

---

### Use Case 2 — San Francisco Copilot (interactive, per-user turns)

**Task profile:** Latency-sensitive, medium complexity, tool-use, instruction following. User is waiting.  
**Quality bar:** Good reasoning for Builder Copilot, accurate widget manipulation ops, fast  
**Cost sensitivity:** Medium — per-user, per-turn, but controlled by the 8-inflight ceiling

**Primary recommendation: Gemini 2.5 Flash ($0.30/$2.50)**  
- Configurable thinking budget: set to 0 for simple turns (Flash speed + cost), raise for complex ops  
- 221 tok/s output speed  
- 1M context — can hold full widget spec + conversation history in one call  
- Strong on instruction following and tool use

**Strong alternative: DeepSeek V3 ($0.14/$0.28)**  
- OpenAI-compatible API (near-zero integration cost — drop-in swap)  
- Excellent on coding tasks — relevant for widget manipulation ops  
- Risk: Chinese infrastructure, reliability SLA concerns for production, not suitable where EU data residency is required

**Why not DeepSeek R1 here:** R1's reasoning adds latency. For interactive copilot turns where the user is waiting, the latency cost of chain-of-thought is not justified for most turn types.

---

### Use Case 3 — GTM Agent / Durable Orchestrator (PRD 108D)

**Task profile:** Complex, multi-step, long-running (potentially hours), high-stakes, tool use, code generation, site analysis  
**Quality bar:** Strong agentic reasoning, reliable tool calling, accurate multi-hop planning  
**Cost sensitivity:** Low relative to correctness — a bad GTM agent run is worse than an expensive correct one

**Primary recommendation: Gemini 2.5 Pro ($1.00–$1.25 / $10.00)**  
- Top-tier benchmarks: 84.4% GPQA Diamond, strong SWE-Bench agentic performance  
- 1M context — can ingest a full competitor site, widget catalog, and CRM signal in one pass  
- Structurally cheaper than Claude Sonnet 4 ($3/$15) for input-heavy agentic tasks  
- Google native function calling and tool use

**High-upside alternative: DeepSeek R1 ($0.55/$2.19)**  
- Cheapest reasoning model on the market — by a large margin  
- Competitive with Claude Sonnet on several agentic benchmarks  
- Best for internal / non-customer-facing agents where data routing to China is not a blocker  
- If the GTM agent is purely internal-ops (not touching customer data directly), R1's economics are extraordinary

---

## Two Wild Cards Worth Tracking

### Mistral (EU Sovereignty Play)

Mistral is the only frontier-class provider with EU data residency as the **default**, not an enterprise add-on.  

- **Mistral Small ($0.10/$0.30):** As cheap as anything on the market, EU-hosted, GDPR-native  
- **Codestral ($0.30/$0.90):** Purpose-built for code in 80+ languages — relevant if any agent generates or manipulates widget code  
- **Mistral Large 3 ($2.00/$6.00):** Strong multilingual performance — relevant for Babel if EU customer data requirements tighten

**When to use:** The moment Clickeen has EU enterprise customers or the sales process includes data sovereignty questions. Mistral gives you a clean answer — EU data residency by contract, not by exception.

### Llama 4 Scout via Together AI / Fireworks / Groq (Extreme Context + Cost)

$0.10/$0.25 with a **10M token context window** — nothing else comes close at this price for context size.  

- For batch translation jobs: feed the entire widget catalog + glossary in one call  
- For GTM agent site analysis: ingest a competitor's full site in one pass  
- **Best provider for production:** Together AI (most consistent quantization quality vs. Groq/Fireworks)
- **Caveat:** Open-weight models served by third parties have variable quality depending on quantization. Benchmark before committing.

---

## Strategic Recommendation

**Do not pick one model. Route by task class via the SF signed policy.**

The SF plane's model selection already lives in the per-agent signed policy (per PRD 108 architecture). The architecture already supports routing. The only implementation decision is which providers to onboard first.

### Recommended onboarding order:

1. **Gemini 2.5 Flash** → default copilot model (ship with 108A)
2. **Gemini 2.5 Flash-Lite** → default Babel translation model (ship with 108A)
3. **Gemini 2.5 Pro** → GTM agent / durable orchestrator (ship with 108C/D)
4. **DeepSeek V3** → cost-floor alternative for non-EU copilot workloads (evaluate post-108A)
5. **Mistral Small** → EU data residency option (add when first EU enterprise deal appears in pipeline)
6. **Llama 4 Scout** → batch/extreme-context jobs (evaluate once Together AI production quality confirmed)

### What this routing buys you:

| Task | Model | Est. cost vs. Claude Sonnet ($3/$15) |
|---|---|---|
| Babel translation (per widget × 29 locales) | Gemini Flash-Lite | ~96% cheaper |
| Copilot interactive turn (avg complexity) | Gemini 2.5 Flash | ~90% cheaper |
| GTM agent complex run | Gemini 2.5 Pro | ~67% cheaper on input |
| EU customer workloads | Mistral Small | ~97% cheaper |

The architecture already supports this. The policy-per-agent model means you can change model assignments without touching agent code. That's the entire point of building the SF plane first.

---

## Data Routing Risk Matrix

| Provider | Data location | EU GDPR safe | Enterprise safe | China risk |
|---|---|---|---|---|
| Gemini (Google) | Google global | Yes | Yes | No |
| Mistral | EU by default | Yes | Yes | No |
| Llama 4 (Together AI) | US | Depends on DPA | With DPA | No |
| DeepSeek | China | **No** | **Risk** | **Yes** |
| OpenAI | US | With DPA | Yes | No |
| Anthropic | US | With DPA | Yes | No |

---

*Document prepared June 9, 2026. Prices current as of publication — LLM API pricing is in active competition and should be re-verified quarterly.*
