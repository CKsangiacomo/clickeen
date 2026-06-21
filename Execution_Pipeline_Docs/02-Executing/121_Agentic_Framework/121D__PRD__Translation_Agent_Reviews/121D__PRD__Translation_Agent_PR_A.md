# Peer Review A — 121D (Translation Agent)

Reviewer: Architecture (staff-level, code-grounded)
Reviewed file: `121D__PRD__Translation_Agent.md`
Date: 2026-06-20
Verdict: **APPROVE WITH REQUIRED REVISIONS.** The framing is correct and well-aligned with best practice: a focused *artifact* agent (artifact in, localized artifact out, with validation) — not a Copilot — that preserves protected structure and lets a product workflow own the apply. That is exactly where an agent beats a raw translate API. But the PRD **overclaims "durable,"** leaves the **review/artifact store unscoped**, doesn't call out that the **product path is compiled-disabled today**, and has **no eval**. Fix the honesty/scoping gaps and it's a legitimate first internal agent.

Research lens applied (sources in the umbrella's Revision A.1).

---

## 0. Code surfaces this PRD touches (grounding, verified this session)

| Surface | Verified reality | What 121D requires |
|---|---|---|
| SF executor — `sanfrancisco/src/agents/l10nTranslationCore.ts` | Multi-batch (chunks of 80 items / 4000 chars), **multiple model calls per job**, **synchronous** HTTP, returns `{values, usage}` | §6 "execute through SF orchestrator" — executor exists; orchestration/durability does not |
| Roma product path — `roma/lib/account-instance-translations.ts` | `generateAccountInstanceTranslations` returns a **hardcoded 503** "SF translation generation owner is not enabled." No flag — compiled disabled | §3/§6 invoke from Roma — **the product calling path is OFF; 121D never says "re-enable it"** |
| Tokyo write path — `tokyo-worker/.../account-translations/values.ts` | `writeAccountInstanceTranslatedLocaleValues` → `writeLocaleOverlay` → `overlays/locales/{locale}.json`. **Direct write**, status `inSync/outOfSync/failed` only | §5 "reviewable artifact, apply after review" — **no review store exists; writes are direct** |
| Durability | None — no queue/DO for translation (queue premise removed in 120); sync HTTP | Umbrella calls Translation the "first durable agent" — **nothing durable is built or scoped here** |
| Registry — `ck-contracts/ai.ts` | `widget.instance.translator`: system_agent, `endpoint` surface, `account_widget_translated_values`, deepseek default; **no durability field** | §1 "focused internal agent" — registry can't express durable vs interactive |

---

## 1. Elegant engineering and scalability — GOOD

The artifact-agent shape (artifact + locale target in → validated localized artifact out) is the right design for localization and scales across widget types and locales. §2's list of what translation must preserve (meaning, brand voice, CTA intent, formatting, variables/placeholders, URLs, product tokens, schema structure, field ownership, locale conventions) is exactly the complexity that justifies an agent over a raw translate API — this maps directly onto the research's "agent when rules are complex / unstructured-data interpretation." The existing multi-batch executor already handles chunking and richtext reconstruction, so the substrate is real. Scaling risk is fanout (29 locales × batches) under a sync path with an isolate concurrency cap — see Omissions-E.

---

## 2. Compliance to architecture and tenets — STRONG

- §1 "Translation is not a Copilot" and §4 "context is artifact-specific, not Product Copilot context" — correctly keeps internal agents and Copilots from sharing logic (umbrella §4.3, 121E).
- §5 "does not directly mutate saved product state unless a product-owned workflow accepts and applies it" — correct; agent doesn't own truth.
- §7 "protected product structure cannot be translated or dropped silently" + "product routes/workflows own durable mutation" — tenet-aligned and the right safety bar.
- Default provider DeepSeek, `account_widget_translated_values` boundary, `endpoint` surface — all consistent with the verified registry.

---

## 3. Overarchitecture / unnecessary complexity — LOW, BUT ONE HONESTY FIX NEEDED

121D is appropriately focused (six slices, single agent). The one overreach is **calling it "durable" without building or scoping durability.** The executor is synchronous; no queue/DO is scoped in §6. Two honest options: (a) declare it a **synchronous artifact agent** for v1 (legitimate — most translation jobs fit one sync call; the research says start simple), or (b) if durability is required, scope the queue/DO + separate budget (120 OQ10). Calling it durable while shipping sync is a V7 masquerade. **Fix:** pick one and name it.

---

## 3b. Academic abstraction / pre-work / gold-plating — LOW

§5's "reviewable translation artifact" with warnings/uncertainty/validation/trace is reasonable and matches the research's evaluator-optimizer pattern for translation (one model translates, another flags). But the **review store it implies doesn't exist and isn't scoped** (Omissions-B). For a first proof, a lighter shape — auto-apply with trace + uncertainty flags, no human-review gate — may be enough (translation overlays are regenerable and not public until publish). Don't gold-plate a full drafted/needs_review/approved/applied workflow before the product needs it.

---

## 4. Simple, boring, toward goals — GOOD

The boring path is right: reuse the existing executor, route through SF, write through the existing Tokyo overlay path, keep it artifact-scoped. The slices (§6) correctly start with "reconcile existing 103 contracts" (don't reinvent). This genuinely proves the architecture supports a non-Copilot agent, which is the stated goal.

---

## Omissions & blast radius

### A. "Durable" is claimed but neither built nor scoped.
Umbrella positions Translation as the first durable agent; 121D inherits that label but §6 has no queue/DO/budget work. **Blast radius:** an implementer either ships sync under a "durable" label (masquerade) or stalls trying to infer the durability design. **Fix:** declare v1 synchronous-artifact (recommended) or scope durability explicitly.

### B. The review/artifact store is implied but unscoped.
§5 "reviewable artifact … apply through product-owned workflow after review" implies a review store; the verified write path is direct (`writeLocaleOverlay`, no review states). **Blast radius:** reviewer/implementer disagree on whether human review is required. **Fix:** decide explicitly — for v1, either (i) auto-apply with trace + uncertainty flags (simplest, fits regenerable overlays), or (ii) scope the minimal review store if a real workflow demands it. Don't leave it implied.

### C. The product path is compiled-disabled; 121D never says "re-enable it."
`generateAccountInstanceTranslations` returns a hardcoded 503. Building the "first real internal agent" requires re-enabling the Roma→SF→Tokyo path. 121D §6 assumes it. **Blast radius:** the agent is "built" but unreachable from product. **Fix:** call out re-enabling (and the owner path) as an explicit slice.

### D. No translation eval.
§7 acceptance ("protected structure cannot be translated or dropped silently," "output is reviewable") is not measurable. Translation quality needs an eval: protected-token integrity (never corrupted/dropped), schema/structure preservation, and meaning/tone (LLM-judge calibrated to human). The **D9 29-locale regression gate** (from 120) is the perfect seed. **Blast radius:** shipping translations with no way to detect quality regression. **Fix:** add a translation eval suite as a blocking criterion.

### E. Fanout cost + concurrency under a sync path.
29 locales × multi-batch per locale = many sequential model calls per job, against SF's isolate concurrency cap (verified `MAX_INFLIGHT_PER_ISOLATE`). A sync artifact agent could block or 429. **Blast radius:** a large fanout job stalls or fails under load. **Fix:** address fanout concurrency/latency (batch locales, parallelize within budget, or queue) — or this reinforces that durability (Omissions-A) is actually needed.

---

## V1–V8 scan

| ID | Risk | Status |
|---|---|---|
| V3 Silent omission | "Durable agent" shipped as sync; review store implied but absent | Open — Omissions-A/B |
| V5 Corruption-as-absence | Failed translation written as `failed` status but could be treated as "not done" and silently skipped on read | Verify read path treats `failed` loudly |
| V6 Partial-success masquerade | Reporting a locale job "translated" when some batches failed/dropped protected tokens | Open — needs eval + per-field integrity check (Omissions-D) |
| V7 Masquerade | Sync executor relabeled "durable agent" | Open — Omissions-A |

---

## Required revisions before execution

1. **Declare v1 synchronous-artifact OR scope durability** — stop calling it "durable" without building it. (Omissions-A)
2. **Decide the review boundary explicitly** — auto-apply with trace+uncertainty for v1, or scope the minimal review store. Don't leave "reviewable" implied. (Omissions-B)
3. **Call out re-enabling the disabled Roma→SF→Tokyo product path** as an explicit slice. (Omissions-C)
4. **Add a translation eval suite** (protected-token integrity + schema preservation + LLM-judge meaning/tone), seeded from the D9 29-locale gate. (Omissions-D)
5. **Address fanout cost/concurrency** under the sync path, or accept that durability is actually required. (Omissions-E)

Framing is right and the substrate (executor + overlay write path) is real. These revisions make it honest about what's built and give it a measurable quality bar.

---

# Revision B — Pre-GA + eval-flywheel lens

Pre-GA freedom + OpenAI agent-improvement-loop cookbook. Full lens in the umbrella's Revision B.

## What changes for 121D

**"Roma path compiled-disabled" → clean slate.** Pre-GA, delete the disabled 503 stub and build the target path directly — no "carefully re-enable" ceremony (original Omission-C softens to "just build it").

**"Durable vs sync" → pick sync for v1, outright.** No legacy reason to overbuild durability; the research says simplest solution. Sync artifact agent for v1; only add a queue/DO if a real fanout job proves it's needed (which doubles as the durability trigger).

**Translation is the canonical eval-flywheel use case.** Both Anthropic (evaluator-optimizer) and OpenAI cite translation as the textbook loop candidate. So 121D's eval (Omission-D) should be a real flywheel: protected-token integrity + schema preservation as deterministic graders, LLM-judge for meaning/brand-voice, pass@1/pass^k, seeded from the D9 29-locale gate. Translation outputs are cheap to regenerate, which makes the loop fast to iterate.

## Revised bottom line
- Sync for v1 (delete the "durable" claim); build the target Roma→SF→Tokyo path (delete the disabled stub).
- Review boundary: auto-apply with trace + uncertainty for v1 (regenerable overlays), no human-review gate yet.
- Eval = a real flywheel (translation is the ideal candidate), seeded from D9.
