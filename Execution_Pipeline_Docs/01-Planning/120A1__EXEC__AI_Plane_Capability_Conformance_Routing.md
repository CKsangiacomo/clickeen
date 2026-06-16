# 120A1 - EXEC - AI Plane: Capability Registry, Conformance, Typed Errors, Routing

Status: EXECUTION SPEC v2 — revised 2026-06-09 after the three-perspective
pre-execution review (PM / TPM / Dev Manager)
Owner: San Francisco plane
Parent: `120A__PRD__San_Francisco_AI_Plane_Role_And_Contract.md` (120A-1 slice)
Review authority: `120R__REVIEW__Peer_Review_And_Execution_Augmentation.md`
(PR-1..PR-15; decisions D1–D9 and Q1–Q6 — all ratified 2026-06-09; round-2 review
fixes applied same day)

Decisions consumed (ratified):

- **D1:** two providers — OpenAI current-generation + DeepSeek. Model IDs are
  registry data, never code. This spec names no model IDs by design.
- **D3:** conformance = recorded attestation + 30-day CI freshness. No keys in CI.
- **D6:** picker ships; eligibility = policy ∧ conformance; user pick never silently
  overridden.
- **D8:** cascade routing + declared recorded failover; pinned picks sacred.
- **D9:** translator protected by the 29-locale regression gate; Prague translator
  frozen (deleted via 106E on 106D).
- **Q3:** `freeform` never reaches the plane (Bob refuses deterministically); it does
  not exist in the routing schema.
- **Q4:** zero interim work on the live Copilot; this refactor is the fix.

## Execution Contract

One step at a time; green = named completion evidence; blocker report stops
execution; NOT_ALLOWED is binding. **All `rg` guards are scoped to code directories**
(`packages/ sanfrancisco/ roma/ bob/ admin/ tokyo-worker/ berlin/`) — planning docs
and executed PRDs legitimately contain the guarded strings and are never in scope.

## The three plane atoms (do not merge them)

```text
capability  CAN we call this model correctly?   packages/ck-contracts/src/model-capabilities.ts
policy      MAY this agent/tier use it?         packages/ck-policy/ai-runtime.matrix.json
routing     SHOULD this unit of work use it,    AgentRoutingPolicy inside the signed policy
            and what happens when it fails?
```

**Registry location and type-derivation mechanism (Dev N1 — resolves both the
circular dependency and the TS-literal trap):** the registry lives in
**ck-contracts** beside `ai.ts` (ck-policy depends on ck-contracts, so a ck-policy
home could never feed the provider type). It is a **TypeScript const file**, not
JSON — a `.json` import widens to `string` and cannot yield a literal union:

```ts
// packages/ck-contracts/src/model-capabilities.ts
export const MODEL_CAPABILITIES = [ /* profiles */ ] as const
  satisfies readonly ModelCapabilityProfile[];
export type AiProvider = typeof MODEL_CAPABILITIES[number]['provider'];
```

ck-contracts exports the derived provider type and catalog helpers; ck-policy
imports them for the policy∧conformance eligibility computation. The conformance
script reads/updates this file (it is data-shaped; the `as const` block is the
single source).

## Schemas (binding shape)

```ts
interface ModelCapabilityProfile {
  provider: string; // derived union exported from the registry
  modelId: string;
  uiLabel: string; // user-facing; requires Pietro sign-off (Step 0)
  endpointFamily: string;
  tokenParam: string;
  reasoning: { supported: boolean; values?: string[]; default?: string | null };
  temperature: { supported: boolean; max?: number };
  structuredOutput: { jsonMode: boolean; jsonSchema: boolean };
  streaming: boolean;
  retry: { retryableStatuses: number[]; maxRetries: number };
  eligibility: { userPicker: boolean; durableAgents: boolean };
  baseUrlEnvVar?: string; // every adapter gets a base-URL override (test injection)
  apiKeyEnvVar: string; // Dev N2: provider→key mapping lives here, not in
  // adapter string comparisons — required for the
  // 'deepseek'-literal guard to be reachable
  profileVersion: string;
  conformance: {
    status: 'unverified' | 'passed' | 'failed';
    lastRunAt?: string;
    reportRef?: string;
  };
}

interface AgentRoutingPolicy {
  allowedModels: ModelRef[];
  default: ModelRef; // REQUIRED — non-turn agents (translator)
  // and any missing/unknown class route here
  routes?: Partial<Record<TurnClass, ModelRef>>; // interactive agents only
  escalation?: { trigger: 'invalid_structured_output'; to: ModelRef; maxEscalations: 1 };
  failover?: Array<{
    on: 'AI_PROVIDER_RATE_LIMITED' | 'AI_MODEL_UNAVAILABLE' | 'AI_PROVIDER_TIMEOUT';
    to: ModelRef;
  }>;
  copilotMode?: 'full' | 'conversion'; // Q6: derived by Roma at grant mint from
  // tier ∧ useful-turn usage (the USAGE_KV
  // counter — see 120B1 Step 5b), NOT from
  // entitlements alone. Conversion turns:
  // routed on `default` (cheap), grounding
  // capped at the 2KB tier, `routes`/
  // `escalation` ignored, `failover` still
  // applies, output = template schema,
  // plane-validated. A conversion grant can
  // NEVER obtain a full model execution.
}
// TurnClass = 'resolved_edit' | 'multi_op_plan' | 'advice' | 'guide'
// 'advice' (Q3 round 5): in-domain product questions, grounded in the widget
// snapshot, prose + actionable offer — routed, typically to the cheap model.
// 'guide' is reserved for 120B-2. 'freeform' does not exist: it split into
// 'advice' (routed) and out-of-domain (refused deterministically in Bob).
// Validation: Roma rejects out-of-enum turnClass (typed 422); SF defensively routes
// `default` if absent. Pinned pick (grant.selectedModel) disables routes/failover —
// failure surfaces typed with retry/switch.
//
// Type ownership (Dev B9): `TurnClass` and `AgentRoutingPolicy` are defined ONCE in
// packages/ck-contracts/src/ai.ts. Bob imports TurnClass for emission; Roma for
// validation; SF for routing. No second definition anywhere.
//
// Runtime freshness (TPM F-9): Step 3's validator is build-time. The router
// additionally emits a telemetry warning event when executing with a capability
// profile whose lastRunAt exceeds the freshness window (catches stale deploys);
// the warning count joins the Step 9 weekly review query.
```

**Escalation semantics (the handshake, both sides):** escalation is **SF-internal**.
SF schema-validates the model's structured output (ops JSON shape) before returning;
on invalid shape it escalates once per `escalation` and re-calls within the same
request (fresh per-call token budget; counts as one turn). Bob's post-hoc op
validation (paths/types/indexes) does **not** trigger re-requests — a Bob-side
rejection is a user-visible typed failure. No client-driven escalation loop exists.

**Typed errors extend the existing atom:** the `AI_*` codes join
`packages/ck-contracts/src/reason-keys.ts` (one error-code registry — no second
taxonomy). Existing codes (`PROVIDER_ERROR`, `GRANT_INVALID`, `BUDGET_EXCEEDED`) are
mapped/renamed there in one pass. The error envelope carries a **structured
`upstreamStatus` field** — required because `sanfrancisco/src/ai/chat.ts:44-65`
currently regex-parses the status out of the message string for retry decisions;
quarantining upstream text (Step 5) would silently break retryability otherwise.

**Adapter call contract (Step 4):** adapters take per-call structured-output
requirements from the caller (the agent), not hardcoded — `openai.ts:152` currently
bakes a translation-specific JSON schema (`TRANSLATION_RESPONSE_FORMAT`) into every
call including Copilot turns; the rebuild parameterizes it.

## Steps

| Step | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Completion evidence                                                                                                                                                                                                                                                                                                                                                                                                                                           | NOT_ALLOWED                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------ |
| 0    | Lineup enumeration + sign-off: query both providers' model lists (`GET /v1/models`) with the existing keys (`conformance.mjs` loads `.env.local` exactly like `scripts/prague-l10n/translate.mjs:26`); propose the candidate registry entries **including `uiLabel` strings** AND **the per-agent/per-tier routing tables** (class→model assignments are product-visible tier differentiation — Dev N6; note `advice` needs no mandatory row, `routes` is Partial and `default` catches it); **Pietro signs off the full table** (PM F8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Signed-off candidate + routing table committed in this spec.                                                                                                                                                                                                                                                                                                                                                                                                  | Hardcoding model IDs outside the registry; shipping unapproved `uiLabel`s; an agent inventing tier/model assignments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 1    | Runtime proof + schema: add direct conformance proof fixtures for `sanfrancisco/` and `packages/ck-policy/` without package `test` scripts or Turbo `test` wiring. Define `ModelCapabilityProfile` types + registry `packages/ck-contracts/src/model-capabilities.json` with Step 0 candidates (`unverified`); ck-contracts exports the derived provider type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Direct proof fixtures run explicitly; types + registry diff; typecheck green.                                                                                                                                                                                                                                                                                                                                                                                 | Capability fields in the policy matrix; a hand-maintained provider union anywhere; package `test` scripts; Turbo `test` wiring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2    | `scripts/ai/conformance.mjs`: calls each declared model with declared params; writes `conformance` block + dated report per model; prune failures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Committed reports for every surviving model; failed candidates removed.                                                                                                                                                                                                                                                                                                                                                                                       | Mock conformance; `passed` without a real call; keeping failed models.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3    | CI validator (extend `.github/workflows/pr-architecture-gates.yml` — its `packages/**` path filter already covers the registry): defaults/picker-eligible models must be `passed` within 30 days.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Validator + failing-case fixture output in CI.                                                                                                                                                                                                                                                                                                                                                                                                                | Provider keys in CI; warn-only mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4    | Registry-driven adapter rebuild (both providers): construct requests from capability profiles; per-call structured-output parameter (kills `TRANSLATION_RESPONSE_FORMAT` hardwiring); base-URL override for OpenAI (DeepSeek has one; OpenAI hardcodes `api.openai.com:137`). PR-15 deletions: `AI_MODEL_CATALOG` (ck-contracts), `ai/chat.ts` provider if-chain → registry lookup, duplicate provider unions (`modelRouter.ts:5`, `grants.ts:7` set, Roma route:16 set) → derived imports, `Env.OPENAI_MODEL` AND `Env.DEEPSEEK_MODEL` fields (`sanfrancisco/src/types.ts:119,121` — Dev N7), `assertProviderConfigured`'s provider comparisons (`l10n-account-routes.ts:87-90` → key lookup via `apiKeyEnvVar`), the adapters' own provider-literal envelopes (provider value flows from the profile). **Admin disposition:** `admin/src/main.ts` imports `listAiModelCatalog`/`labelAiModel` — re-point both at the registry's `uiLabel` (minimal change; coordinates with the in-flight DevStudio migration, do not refactor further).                                                                                                                                                                                           | Scoped guards: `rg "startsWith\('gpt" sanfrancisco/` → 0; `rg "AI_MODEL_CATALOG" packages/ sanfrancisco/ roma/ bob/ admin/` → 0; `rg "(OPENAI                                                                                                                                                                                                                                                                                                                 | DEEPSEEK)\_MODEL" sanfrancisco/ packages/` → 0 (`DEEPSEEK_BASE_URL` stays — legitimate override); adapters pass conformance; repo typecheck green (admin included).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | New provider/model literals outside registry+matrix; per-model if-ladders; breaking admin typecheck.                                                                                                                                    |
| 5    | Typed errors: `AI_*` codes added to `reason-keys.ts`; envelope with structured `upstreamStatus`; upstream bodies telemetry-only; `chat.ts` retry logic moved onto `upstreamStatus` (regex deleted).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Negative fixture (via base-URL override): distinctive upstream payload string reaches telemetry, never the response body; retry test green on simulated 429.                                                                                                                                                                                                                                                                                                  | Raw upstream text in any product-facing message; a second error-code registry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6    | Routing (D8) + conversion enforcement (Q6): `AgentRoutingPolicy` per the schema above into the signed policy; `modelRouter.ts` becomes a real router (class→model within allowed set, `default` fallback, SF-internal single escalation, declared failover, pinned-pick exemption, **`copilotMode: 'conversion'` honored per the schema comment — template path only, a conversion grant can never obtain full execution**, every decision in the learning event). SF schema-validates structured output per class: ops shape for edit turns (advice turns return plain text — no special schema, round 7), template shape for conversion turns. **Schema-chain inventory (all edited in this step):** `ck-contracts/src/ai.ts` (`AgentRuntimePolicy`), `ck-policy/src/ai-runtime.ts` (strict validators `assertAiRuntimeMatrix:121` + `applyAiRuntimeMatrixCellUpdate:198` + `resolveAiRuntimePolicy`/`deriveAiRuntimePolicyUi`), `sanfrancisco/src/grants.ts:107-185` (`normalizeAiPolicy`), `roma/lib/ai/account-copilot.ts` (`issueAccountCopilotGrant` ~100-208 — the mint; plus mode derivation per 120B1 Step 5b), `roma/lib/account-limit-usage.ts` (the call counter), `tokyo-worker` `resolveTranslationRuntime` (job.ai). | Unit tests: class routing; `default` for translator-shaped agents and missing class; failover on simulated 429; single escalation on invalid structured output (ops shape); pinned-pick typed failure without switching; **full grant vs conversion grant on identical input**; telemetry fixture shows route decisions. KV-thread test: a stored thread referencing a removed model fails typed `AI_MODEL_UNAVAILABLE` and continues on `default` next turn. | Silent switching; failover to non-`passed` models; routing in adapters/orchestrators; a total `Record<TurnClass,…>` (translator cannot satisfy it); a conversion-mode path reaching full execution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7    | Matrix rewrite to the D1 lineup as per-agent routing tables (Copilot: two-provider picker set; translator: `default` route only). D9 cleanup: delete ALL hardcoded provider literals in SF agent code — `l10nTranslationCore.ts` default params (~209/324) and `                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `(~253),`l10n-account-routes.ts:279` `??`, `l10nPragueStrings.ts:117` `env.OPENAI_MODEL ??`(Prague minimal disposition: reads model from its endpoint's policy/grant; nothing more — the agent stays frozen). Missing model in a grant = typed`AI_GRANT_INVALID`. Prague matrix rows frozen with a `"deprecated": true`field (the marker mechanism). Add reserved`residency`+`inputBudget`to the policy schema. Set`learningCapture.rawSamplePercent: 100`**on all tiers** (D7 — pre-GA all accounts are internal; the matrix has no account dimension). **DevStudio coordination (TPM F-7):** if the DevStudio migration's Step 4 (ai-runtime cell editor) has shipped, this step carries the`assertAiRuntimeMatrix`/`applyAiRuntimeMatrixCellUpdate` update so the editor keeps working; if not shipped, freeze its lane until DevStudio Step 8. | Matrix diff; validator green; **translator regression gate (defined below) green**; honest guard: `rg "'deepseek'" sanfrancisco/src` → 0 (after Step 4's if-chain deletion, zero legitimate `'deepseek'` literals remain in SF source). | Touching translator paths without the regression gate; legacy models outside declared failover; partial fallback deletion (the guard catches default-params and ` |     | `, not just `??`). |
| 8    | Bob Copilot UI: typed errors render product-safe (copy table from 120B1); picker lists exactly the eligible set. **Ordering note (TPM F-12):** this step edits `CopilotPane.tsx`, which 120B1 Step 3 also edits — execute after 120B1 Step 3 lands, or coordinate the same PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | UI fixtures; no-raw-JSON e2e assertion; picker e2e.                                                                                                                                                                                                                                                                                                                                                                                                           | Error string-matching on provider text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 9    | Docs sync + canary: update `documentation/services/sanfrancisco.md`, `documentation/ai/infrastructure.md` (incl. its two `OPENAI_MODEL` lines), purge `SANFRANCISCO_L10N` from `documentation/architecture/Overview.md`, `documentation/ai/overview.md`, `CloudflarePagesCloudDevChecklist.md` (coordinate — the first and third are also touched by the DevStudio working tree). **Post-deploy verification (TPM F-9):** after the cloud-dev deploy, run one live smoke per provider (a real copilot turn + one translator job) before calling the step green; revert = `git revert` of the matrix/registry commits (config-only rollback). Failover telemetry gets a named consumer: a weekly review query (counts of failover/escalation per provider) recorded in the sanfrancisco service doc.                                                                                                                                                                                                                                                                                                                                                                                                                                  | Docs diff; live smoke evidence; the review query documented.                                                                                                                                                                                                                                                                                                                                                                                                  | Deferring docs; declaring green without the post-deploy smoke.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## The translator regression gate (defined — Dev A3)

- **Fixture:** one FAQ instance under the seeded internal account with non-trivial
  base content (≥2 sections, ≥4 questions, rich text).
- **Environment:** **cloud-dev** (the queue path does not work across local
  `wrangler dev` processes — known constraint; local runs are a false signal).
- **Execution:** trigger instance translation for all 29 locales
  (`packages/l10n/locales.json`) through the normal Tokyo-worker operation.
- **Pass:** all **28 non-base** locale overlays reach completed state with
  schema-valid overlay files (`locales.json` has 29 entries including `en`; the base
  locale is never a translation target — `l10n.locales.max` caps at 28; confirm the
  seeded internal account's tier grants 28, Dev N3); spot-check 3 locales for
  non-empty translated values.
- **Cost/owner:** real provider calls on the dev keys; run by the executing agent;
  expected cost is small (one instance × 29 locales) — recorded in the step evidence.

## Out of scope

Durable/service plane contract (120A-2). Workforce agents (120C — translator re-base
happens there, not here; here it is only protected). Copilot behavior (120B1).
Gemini/Mistral onboarding. Closed learning loop (120F). Any SF write to product
truth. Any interim patching of the live Copilot (Q4).

Shipped-reality note carried for 120A-2 (TPM F-13): the workload-budget split is
120A-2 scope, but it is not a _future_ problem — the instance-translation queue
consumer already runs inside the SF isolate (`sanfrancisco/src/index.ts:283`) and
shares `MAX_INFLIGHT_PER_ISOLATE = 8` with interactive copilot turns today. A
saturated translation batch can 429 a user's copilot turn now. 120A-2 must treat
this as remediation of a live condition, not greenfield design.

## Acceptance

- No model callable without a fresh passing conformance profile; no request parameter
  from model-id string matching; scoped PR-15 guards green.
- Raw upstream payloads never reach product surfaces; retryability preserved via
  structured `upstreamStatus`.
- Routing: class routing, `default` fallback, single SF-internal escalation, declared
  failover, pinned-pick exemption — all proven by unit tests; decisions in telemetry.
- Translator regression gate green on cloud-dev; zero `'deepseek'` literals in SF
  source; Prague rows frozen+deprecated; missing grant model fails typed.
- Picker offers exactly the callable set; post-deploy smoke green per provider.
- Conversion enforcement (Q6): a `conversion`-mode grant can never obtain full model
  execution; template output is plane-validated; proven by the full-vs-conversion
  unit test.
- One error-code registry; one provider-type definition; repo typecheck green
  including admin.
