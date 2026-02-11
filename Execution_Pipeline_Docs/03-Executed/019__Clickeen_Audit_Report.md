# Clickeen Audit Report (Local Repo)

Environment: local (/Users/piero_macpro/code/VS/clickeen)
Sources: The requested /mnt/data/*.md files are not present in this environment. This audit is based on repo code plus in-repo docs (documentation/*) and wrangler configs.

## Executive Summary (Top 10 Risks)
1. P0 - Ops allowlist can be bypassed and ops apply can write arbitrary paths (client-supplied controls + setAt creates missing objects).
2. P0 - Provider keys are used outside San Francisco (Pitch worker), violating the AI execution boundary.
3. P0 - Copilot budgets are enforced client-side only; Paris grants are not tied to tier/usage, so caps can be bypassed.
4. P1 - Venice contains widget-specific logic (FAQ schema + deep-link behavior), violating "widget files = truth".
5. P1 - Paris public instance endpoint is callable directly; Venice-only front door is not enforced in code.
6. P1 - AI grant budgets enforce maxTokens/timeout only; maxCostUsd is unused and maxRequests is best-effort.
7. P1 - URL fetch in sdrWidgetCopilot lacks DNS-level SSRF protection; public URL fetch remains risky.
8. P1 - Asset uploads have no size limits and weak auth gating; potential cost/abuse.
9. P1 - Outcome events for signup/upgrade are defined but not emitted anywhere; learning attribution incomplete.
10. P2 - AI endpoints return HTTP 200 on failures and load-time sanitization hides violations, weakening fail-fast behavior.

## Findings by Category

### A) Discrepancies vs Principles
#### A1. Ops allowlist not enforced at apply time (P0)
Files: `bob/lib/edit/ops.ts` applyWidgetOps, `bob/lib/utils/paths.ts` setAt, `bob/components/CopilotPane.tsx` handleSend, `bob/app/api/ai/sdr-copilot/route.ts` POST, `sanfrancisco/src/agents/sdrWidgetCopilot.ts` validateOpsAgainstControls
Why: Deterministic edits require ops applied strictly against compiled.controls[] allowlists. The allowlist is derived from client-supplied controls and applyWidgetOps does not verify paths, while setAt creates missing objects. This permits edits outside widget spec.
Fix: Enforce controls allowlist at apply time (Bob) using compiled.controls and reject unknown paths; change setAt to fail when path does not exist unless the control is explicit; ensure Bob server (or Paris) computes or signs controls so clients cannot invent allowlists.

#### A2. Copilot budgets are not enforced server-side (P0)
Files: `bob/components/CopilotPane.tsx` consumeBudget, `paris/src/index.ts` handleAiGrant, `tooling/ck-policy/src/policy.ts` resolvePolicy
Why: Hard caps must be enforced server-side. Budget checks happen in Bob UI only, while Paris grants accept client-provided budgets with no tie to tier/usage.
Fix: Enforce budgets in Paris/SF: compute grant budgets from policy + usage, persist usage per workspace/session, and reject grants when limits exceeded.

#### A3. Load-time sanitization hides violations (P1)
Files: `bob/lib/session/useWidgetSession.tsx` loadInstance, `tooling/ck-policy/src/limits.ts` sanitizeConfig
Why: Orchestrators must fail visibly; sanitizing config on load silently "heals" disallowed values instead of surfacing violations.
Fix: Change load enforcement to reject with explicit errors/upsell or surface a visible warning instead of mutating config.

#### A4. AI endpoints mask failures with 200 responses (P2)
Files: `bob/app/api/ai/sdr-copilot/route.ts` POST, `bob/app/api/ai/outcome/route.ts` POST
Why: Returning 200 for failures hides outages and makes monitoring/automation brittle, conflicting with fail-fast contracts.
Fix: Return appropriate status codes (4xx/5xx) and centralize error formatting for UI-friendly messages.

### B) Cost Risk
#### B1. AI budgets ignore maxCostUsd and only partially enforce maxRequests (P1)
Files: `sanfrancisco/src/grants.ts` getGrantMaxTokens/getGrantTimeoutMs, `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
Why: Grants include maxCostUsd/maxRequests but SF does not enforce them, so runtime costs can exceed budgets.
Fix: Track cost from provider usage and reject when maxCostUsd would be exceeded; enforce maxRequests in the execution path.

#### B2. Copilot usage caps are client-side only (P0)
Files: `bob/components/CopilotPane.tsx` consumeBudget, `paris/src/index.ts` handleAiGrant
Why: Clients can bypass UI budgets by calling `/api/ai/sdr-copilot` directly, leading to uncontrolled LLM spend.
Fix: Server-side usage counters and grant issuance tied to tier/usage.

#### B3. URL fetch can hit arbitrary public targets (P1)
Files: `sanfrancisco/src/agents/sdrWidgetCopilot.ts` fetchSinglePageText/isBlockedFetchUrl
Why: Size/time limits exist, but there is no DNS resolution guard. A public hostname can resolve to private IPs (SSRF + cost).
Fix: Resolve DNS and block private ranges; consider allowlists or proxy-only fetch.

#### B4. Asset uploads lack size limits (P1)
Files: `bob/app/api/assets/upload/route.ts` POST, `tokyo-worker/src/index.ts` handleUploadWorkspaceAsset
Why: No explicit payload size limits. Large uploads can blow bandwidth/R2 costs and degrade edge performance.
Fix: Enforce max content length, reject oversized payloads, and validate content types.

#### B5. Pitch LLM calls are uncapped (P1)
Files: `pitch/src/answer.ts` openaiAnswerFromSources/handlePitchAnswer, `pitch/src/search.ts`, `pitch/src/upsert.ts`
Why: Calls to OpenAI are uncapped and not under AI grant budgets, creating unbounded cost paths.
Fix: Move pitch LLM calls behind SF grants or add explicit caps and rate limits.

### C) Learning Gaps
#### C1. Missing version stamps for some agents (P1)
Files: `sanfrancisco/src/agents/sdrCopilot.ts` executeSdrCopilot, `sanfrancisco/src/agents/editorFaqAnswer.ts` executeEditorFaqAnswer, `sanfrancisco/src/index.ts` indexCopilotEvent
Why: Outcomes need promptVersion/policyVersion/dictionaryHash for attribution. These agents return no meta.
Fix: Add meta fields to results for all agents and include in InteractionEvent logging.

#### C2. Signup/upgrade outcome events are never emitted (P1)
Files: `bob/components/CopilotPane.tsx` reportOutcome, `bob/app/api/ai/outcome/route.ts`
Why: Learning pipeline expects signup/upgrade outcomes but no code emits them.
Fix: Instrument Prague/Bob flows to emit signup_started/signup_completed/upgrade_clicked/upgrade_completed.

#### C3. Outcomes table lacks envStage/version fields (P2)
Files: `sanfrancisco/src/index.ts` copilot_outcomes_v1 schema, `paris/src/index.ts` handleAiOutcome
Why: Outcomes cannot be attributed without joining to events; linkage is not enforced.
Fix: Store envStage/agentId/promptVersion/policyVersion/dictionaryHash in outcomes or enforce join integrity.

#### C4. Golden set not enforced by CI (P2)
Files: `scripts/eval-copilot.mjs`, `package.json` scripts
Why: A golden set exists but no repo evidence of CI enforcement. Regression protection may be manual.
Fix: Add CI job that runs `pnpm eval:copilot` against a fixed fixture set.

### D) Security / Boundary Gaps
#### D1. Provider keys outside San Francisco (P0)
Files: `pitch/src/answer.ts`, `pitch/src/search.ts`, `pitch/src/upsert.ts`
Why: Non-negotiable boundary says provider keys only in SF; pitch uses OpenAI directly.
Fix: Route pitch LLM calls through San Francisco with signed grants; remove OpenAI keys from pitch worker.

#### D2. Paris public instance endpoint bypasses Venice front door (P1)
Files: `paris/src/index.ts` handleGetInstance, `venice/app/r/[publicId]/route.ts`
Why: Third-party embeds should hit Venice only; Paris is publicly callable by any browser.
Fix: Require Venice-only tokens/headers, or enforce Cloudflare firewall rules to block direct browser access.

#### D3. SSRF guard incomplete (P1)
Files: `sanfrancisco/src/agents/sdrWidgetCopilot.ts` isBlockedFetchUrl
Why: Blocking direct IPs is insufficient; DNS rebinding can still reach private networks.
Fix: Resolve DNS server-side and block private ranges; consider an allowlist or proxy.

#### D4. San Francisco fallback targets dev domains (P1)
Files: `bob/app/api/ai/sdr-copilot/route.ts` SANFRANCISCO_FALLBACKS
Why: Production requests could leak to dev environments if SANFRANCISCO_BASE_URL is misconfigured.
Fix: Remove dev fallbacks in production or gate them behind NODE_ENV.

#### D5. Asset upload endpoint lacks auth (P1)
Files: `bob/app/api/assets/upload/route.ts` POST
Why: Endpoint only validates workspaceId; if Tokyo dev auth is disabled or misconfigured, uploads are unauthenticated.
Fix: Require signed upload grants or workspace auth; propagate auth to Tokyo worker.

### E) Scalability Gaps
#### E1. Rate limiting is per-instance only (P2)
Files: `bob/app/api/ai/sdr-copilot/route.ts` rateLimit Map
Why: In-memory rate limiting does not scale across regions/isolates.
Fix: Move rate limiting to SF/Paris or use KV/edge rate limiting.

#### E2. Widget limits fetched without caching (P2)
Files: `paris/src/index.ts` loadWidgetLimits
Why: `cache: no-store` fetch per publish can become a hot path at scale.
Fix: Add short TTL caching in Paris or prefetch limits per widget.

#### E3. Per-event R2 writes without batching (P2)
Files: `sanfrancisco/src/index.ts` queue handler
Why: One R2 put per event can increase costs; no batching or compression.
Fix: Batch log writes or use a compacted log pipeline.

#### E4. Concurrency cap is per isolate only (P2)
Files: `sanfrancisco/src/index.ts` MAX_INFLIGHT_PER_ISOLATE
Why: Global concurrency control is missing; uneven load could spike costs or errors.
Fix: Add queue backpressure or per-tenant throttles.

### F) Architecture Drift
#### F1. Widget-specific logic in Venice (P1)
Files: `venice/lib/schema/index.ts` generateSchemaJsonLd, `venice/lib/schema/faq.ts` faqSchemaJsonLd, `venice/app/embed/v2/loader.ts` activateDeepLink
Why: Widget behavior should live in tokyo/widgets/*; Venice should be a dumb pipe.
Fix: Move schema/deeplink behavior into widget assets (e.g., widget.client.js or a widget-provided schema file).

#### F2. Path-based UI special casing risks growing widget semantics in Bob (P2)
Files: `bob/components/TdMenuContent.tsx` expandLinkedOps/handleContainerEvent
Why: Path-specific logic can drift into orchestrator behavior as widgets grow.
Fix: Keep shared behaviors strictly tied to documented shared fields (stage/pod/layout) and move widget-specific logic into widget code.

#### F3. Localization overlay applies ops without allowlist (P2)
Files: `venice/lib/l10n.ts` applySetOps/setAt
Why: Ops applied without compiled.controls verification; could drift from widget truth if overlays are wrong.
Fix: Validate l10n ops against widget controls before applying.

## Cost Blow-up Checklist
| Path | Potential unbounded cost | Capped? | Enforcement |
| --- | --- | --- | --- |
| `sanfrancisco/src/agents/sdrWidgetCopilot.ts` | LLM calls (1-2) | Partial | maxTokens/timeout; no maxCostUsd |
| `sanfrancisco/src/agents/sdrCopilot.ts` | LLM calls | Partial | maxTokens/timeout |
| `sanfrancisco/src/agents/editorFaqAnswer.ts` | LLM calls | Partial | maxTokens/timeout |
| `pitch/src/answer.ts` | LLM calls | No | no grant budgets |
| `sanfrancisco/src/agents/sdrWidgetCopilot.ts` | URL fetch | Partial | size/time capped; DNS not guarded |
| `bob/app/api/ai/sdr-copilot/route.ts` | Copilot requests | No | per-instance in-memory rate limit only |
| `bob/app/api/assets/upload/route.ts` | Asset uploads | No | no size limit |
| `tokyo-worker/src/index.ts` | Asset uploads | No | no size limit |

## AI-run Readiness Scorecard (0-5)
- Determinism (ops + allowlist): 2/5 (allowlist not enforced at apply time; client-supplied controls)
- Budget enforcement (grants + runtime): 1/5 (client-side only; maxCostUsd unused)
- Outcome attribution (events + versioning): 2/5 (missing meta for some agents; signup/upgrade events absent)
- Regression protection (golden set): 2/5 (script exists, not enforced by CI in repo)
- Boundary/security (provider keys only in SF): 1/5 (pitch uses OpenAI directly)
- Global scalability (Cloudflare/caching/front-door): 3/5 (edge-first design, but front-door rules not enforced in code)

## Prioritized Action Plan (Next 2 Weeks)
1. P0 - Enforce controls allowlist at apply time in Bob and remove client-supplied allowlist trust (reject unknown paths, require controls hash or server-compiled controls).
2. P0 - Move pitch LLM calls behind SF grants (or fold pitch into SF), removing provider keys from pitch.
3. P0 - Enforce copilot budgets server-side (Paris/SF) using policy tiers and usage counters.
4. P1 - Remove widget-specific logic from Venice; move schema + deep-link behavior into tokyo/widgets assets.
5. P1 - Add server-side SSRF protection (DNS resolution + private IP block) for page fetch.
6. P1 - Add size limits and auth on asset upload endpoints.
7. P1 - Add outcome emission for signup/upgrade and include prompt/policy/dictionary hashes in all agent results.
8. P2 - Add caching for widget limits in Paris and centralize rate limiting in SF/Paris.
