# Clickeen Context Compaction Service — Plan

**Status:** PLANNING
**Date:** June 25, 2026
**Sibling:** `Headroom_Context_Compression_Eval_June2026.md` (the eval that motivates this)
**Owner:** San Francisco (governed model execution)
**Scope:** A Clickeen-owned, in-Worker, schema-aware context-compaction capability on the model-call path. **Not** a fork of Headroom, **not** a separately deployed service, **not** always-on.

> This is a plan with a recommendation, not a build authorization. Scope and build/no-build are the human's call. Every capability below must be forced by a named use case — if none forces it, it is deleted from scope, not deferred.

---

## 0. What this is — in one paragraph

A small, pure-TypeScript compaction capability that sits at San Francisco's single model-call chokepoint (`sanfrancisco/src/ai/chat.ts:41`, `callChatCompletion`), rewrites outgoing `messages` to cost fewer tokens before they hit the provider, measures the savings against a passthrough control group, and ships behind per-agent flags — off by default. It does the ~10% of Headroom that matches Clickeen's actual payloads (structured widget JSON), does it *better* because Clickeen knows its own schema, and runs where the product runs (a Worker). Headroom is the **spec reference**, never a dependency.

## 1. Use cases that force this — and what they do NOT force

Clickeen's model traffic funnels through San Francisco. The real callers and their payloads:

| Caller | Path | Payload shape | What compaction can safely do |
|---|---|---|---|
| **Product Copilot** | service binding → `/model/chat` | account state + widget config/content JSON + conversation | Lossless normalize; drop stale/repeated context; reversibility useful |
| **Translation Agent (Babel)** | service binding → `/model/chat` | field maps (paths → source strings) to translate | **Lossless only.** Lossy drops fields that must be translated. Possible delta-slice (only changed fields) — but that is a Babel concern, see §1.1 |
| **Roma account-copilot** | HTTP `SANFRANCISCO_BASE_URL` → `/model/chat` | interactive context | Same as Product Copilot |
| **Prague l10n strings** | hardcoded `/v1/responses` (`prague-l10n-strings.ts:143`) | prompt + json_schema | Out of scope for v0 — different call path; revisit only if measured cost justifies |

**What this forces:** a lossless JSON normalizer + dedup, measurement, and an A/B harness. These are safe for *every* caller including Translation.

**What this does NOT force (do not build speculatively):**
- Prose ML compression (Kompress-style) — Clickeen agents don't send prose-heavy payloads.
- Code AST compression — agents don't send source code to the model.
- A separately deployed service/Worker — compaction must run *on* the model-call path; a separate Worker only adds a hop.
- An always-on global rewrite — unsafe (Translation) and unmeasured.
- A reversibility store — only if a caller actually needs dropped bytes back.
- A new schema/identity system — reuse the existing widget-spec + `editable-fields.json` + `arrayItemIdentity` substrate (same rule as PRD 124A).

### 1.1 The Translation constraint is the scope anchor
Translation sends content that must all come back translated. Therefore: **lossy strategies are permanently opt-in and never enabled for `surface = translation-agent`.** This single constraint is what keeps the design honest — it prevents a "compress everything aggressively" default.

## 2. Where it lives (the boundary)

- **Package:** `packages/ck-context-compaction` — pure TypeScript, zero Workers-runtime imports, fully unit-testable in isolation (mirrors the `packages/ck-runtime-materializer` / `ck-contracts` pattern).
- **Wired in:** `sanfrancisco/src/ai/chat.ts`, inside `callChatCompletion`, between message assembly and `callProviderForSelection`. One call site. Every caller (Copilot, Translation, Roma) already funnels here, so one insertion covers all production model traffic.
- **NOT** a separate Worker or container. A separate deployable is a boundary no use case forces — it would only add a network hop and a new failure mode.

## 3. The contract

```ts
// packages/ck-context-compaction — pure, deterministic, no I/O in the compact path

export type Strategy =
  | 'passthrough'        // control group / fail-open fallback; bytes unchanged
  | 'lossless'           // normalize + minify JSON content blocks (safe for ALL surfaces)
  | 'lossless-dedup';    // lossless + replace repeated identical blocks with a reference
  // 'schema-slice' and 'lossy-drop' are NOT in v0; see §4/§7 (gated on measured need)

export interface CompactInput {
  messages: ChatMessage[];     // { role: 'system'|'user'|'assistant'; content: string }
  agentId: string;
  surface: string;             // 'product-copilot' | 'translation-agent' | 'roma-account-copilot' | ...
  selection: ModelSelection;   // provider + model (from resolveModelSelection)
  holdout: boolean;            // true → force 'passthrough' (control group)
}

export interface CompactConfig {
  strategy: Strategy;
  minTokensToCompact: number;  // don't bother on small payloads
  protectRecent: number;       // never touch the last N messages
}

export interface CompactMetrics {
  tokensBefore: number;
  tokensAfter: number;
  strategy: Strategy;
  reverted: boolean;           // true if inflation guard kicked in
  droppedMarkers: number;      // 0 in v0 (no lossy strategies)
}

export interface CompactResult { messages: ChatMessage[]; metrics: CompactMetrics; }

export function compact(input: CompactInput, config: CompactConfig): CompactResult;
```

**Purity rule (non-negotiable):** `compact()` reads `messages` in, returns `messages` out, touches no network, no bindings, no storage. Reversibility storage (§5) is a *separate, explicit* step, never inside the compact path. This mirrors PRD 124B's materializer-purity rule and keeps the hot path deterministic and testable.

## 4. Strategies (concrete, each forced by a use case)

- **S1 — Lossless normalize (v0):** detect JSON-typed content in message blocks, parse, re-emit minified with stable key order, strip cosmetic whitespace/indentation. Information-identical. Safe for Translation. This is the baseline win and the only strategy enabled broadly.
- **S2 — Lossless dedup (v0, if measured duplication exists):** when the same content block recurs across messages in one call, replace repeats with a short reference marker. Lossless. Safe for Translation.
- **S3 — Schema-aware slice (NOT v0):** using widget spec + `editable-fields.json` + the current turn's intent, keep only the fields the turn needs and drop the rest behind a marker. This is the "better than Headroom" capability (Headroom is schema-blind; Clickeen isn't) — but it is higher complexity and only justified when a measured caller routinely sends large schema payloads where most fields are irrelevant to the turn. Build only if §6 measurement proves it.
- **S4 — Lossy row-drop (NOT v0, Translation-blocked):** for repeated arrays where not every row matters to the turn, keep first/last N, drop the middle behind a marker. **Hard-blocked for `surface = translation-agent`.** Build only if a measured non-translation caller forces it.

S3 and S4 are described here so the design accommodates them, but they are explicitly out of v0 scope.

## 5. Reversibility (CCR-lite) — only if forced

If S3/S4 ever drop content a caller later needs: store the dropped bytes keyed by SHA-256 (copy Headroom's CCR keying) in **D1/KV** (San Francisco already binds `SF_D1`/`SF_KV`), expose a retrieve path. **Do not build this in v0.** v0 is lossless only — nothing is dropped, so nothing needs retrieving. Reversibility is added exactly when a lossy strategy is first enabled, not before.

## 6. Measurement & rollout (the anti-speculation core)

This is the most important section. Nothing ships always-on; everything is measured.

1. **Instrument first.** San Francisco already captures `usage.prompt_tokens`/`completion_tokens` per call (`providers/openai.ts:157`) and already has an events queue (`SF_EVENTS`) + D1 (`SF_D1`). Emit one compaction-metrics event per call: `{agentId, surface, strategy, tokensBefore, tokensAfter, reverted, ts}`. No new infrastructure — reuse `SF_EVENTS`.
2. **A/B holdout (copy Headroom's discipline).** A deterministic fraction of calls (start 10%) are assigned `holdout=true` → `passthrough`. Savings are then *measured* (compressed vs control), never estimated. Assignment is a stable hash of `(agentId, threadId)` so a conversation stays in one arm.
3. **Flag-gated, off by default.** Per-`surface` flags in SF config/env; a global kill switch. v0 enables `lossless` only, and only on surfaces where measurement shows meaningful input-token spend.
4. **Gate every strategy on measured evidence.** S2 ships only if instrumentation shows real duplication. S3/S4 ship only if a measured caller forces them. No strategy is built on assumption.

Net: Step 1 (measurement) is valuable *on its own* — it answers "is token cost even a problem, and where?" — and is the prerequisite for everything else.

## 7. Build steps (ordered, each gated on the prior step's evidence)

| Step | Builds | Acceptance | Gate to proceed |
|---|---|---|---|
| **1** | Measurement scaffold: compaction-metrics event → `SF_EVENTS` → D1; a query/dash showing per-`agentId`×`surface` input-token spend | Can read real per-surface token cost over a window | Does any surface show material input-token spend? If no → **stop here**, ship only the measurement. |
| **2** | `packages/ck-context-compaction` with `passthrough` + `lossless` (S1) + inflation guard + A/B holdout + flag wiring at `chat.ts:41` | Lossless runs behind a flag on one surface; parity fixtures show zero output drift; measured savings reported vs control | Savings material and no accuracy regression? |
| **3** | S2 dedup | Only if Step-2 instrumentation shows real repeated content | Measured duplication present |
| **4** | S3 schema-slice and/or S4 lossy-drop | Only if a measured non-Translation caller forces it | Measured large-irrelevant-schema payloads |
| **5** | Reversibility (CCR-lite in D1/KV + retrieve) | Only if a lossy strategy (Step 4) is enabled | A lossy strategy is shipping |

Steps 1–2 are the v0. Steps 3–5 are conditional, each requiring measured justification. Nothing is "deferred to a phase" — it is either forced by evidence or removed from scope.

## 8. Failure & accuracy contract

- **Inflation guard (copy Headroom):** if `compact()` would increase token count, revert to the original messages, set `metrics.reverted = true`. Never ship a "compression" that makes things bigger.
- **Fail-open to the call, fail-closed on accuracy:** a compaction error must NOT break the model call → fall back to `passthrough` and the call still goes through. But output regressions must be *caught* (by the A/B harness + parity fixtures), never hidden.
- **No silent meaning change:** lossless strategies are information-identical (asserted by fixtures); any future lossy strategy emits explicit markers, never silent drops.
- **Parity fixture set:** a scrubbed set of real San Francisco payloads (one per surface) → assert that a model run on `lossless`-compressed input produces equivalent output to `passthrough` input. This is the accuracy gate for enabling any strategy on a surface.
- **Translation invariant:** `surface = translation-agent` is hardcoded to `lossless`-or-`passthrough` only; lossy strategies are rejected at the config layer, not trusted to a flag.

## 9. Doctrine compliance — what we explicitly do NOT build

- No fork/vendoring of Headroom code (Apache 2.0 permits it; doctrine forbids the legacy inertia).
- No ONNX / ML / prose / code compressors (no use case forces them; they can't run in a Worker).
- No separately deployed service/Worker/container (no use case forces it; adds a hop).
- No always-on global rewrite (unsafe for Translation; unmeasured).
- No speculative reversibility store, status flags, readiness ledger, or compatibility reader (mirrors PRD 124A/G non-builds).
- No new schema/identity layer — reuse the existing widget-spec + `editable-fields.json` + `arrayItemIdentity` substrate.

## 10. Open decisions (human's call)

1. **Is the measured token spend real?** Step 1 answers this. If not, the deliverable is just the measurement — and that's a fine outcome.
2. **Package vs inline?** Recommend `packages/ck-context-compaction` (testable, reusable) over inlining in San Francisco. Confirm.
3. **Which surfaces get v0 `lossless`?** Recommend starting with Product Copilot only (Translation stays passthrough until explicitly validated by parity fixtures), then expanding on evidence.
4. **Ever build S3/S4/reversibility?** Only on measured evidence — this is a gate, not a roadmap commitment.

## 11. Citations

**Clickeen (repo-relative):**
- `sanfrancisco/src/ai/chat.ts:41` — `callChatCompletion`, the single chokepoint (insert compaction here).
- `sanfrancisco/src/ai/chat.ts:48-50` — `resolveModelSelection` / `resolveGrantBudgets`.
- `sanfrancisco/src/providers/openai.ts:103-157` — env base URL, fetch, `usage` readback.
- `sanfrancisco/src/grants.ts:155-237` — grant budgets incl. `maxTokensPerCall`, `maxMonthlyTurns`, `timeoutMs` (compaction extends these).
- `sanfrancisco/src/types.ts:136-141` — `Env` (`OPENAI_*`, `DEEPSEEK_*`, `AI_GRANT_HMAC_SECRET`).
- `sanfrancisco/wrangler.toml` — `SF_KV`, `SF_D1`, `SF_R2`, `SF_EVENTS` bindings (reuse for metrics + reversibility).
- `agents/translation-agent/src/worker.ts:308-317`, `agents/product-copilot/src/worker.ts:90-100` — service-binding callers (all funnel through SF).
- `packages/ck-runtime-materializer`, `packages/ck-contracts` — sibling-package pattern to follow.
- Schema substrate: widget spec + `editable-fields.json` + `arrayItemIdentity` (per PRD 124A).

**Headroom (spec reference only, not a dependency):** SmartCrusher lossless+lossy scheme, CCR SHA-256 keying + retrieval, per-content routing, output-holdout measurement discipline. See the sibling eval for the full source-cited breakdown and the reasons not to adopt/fork Headroom directly.
