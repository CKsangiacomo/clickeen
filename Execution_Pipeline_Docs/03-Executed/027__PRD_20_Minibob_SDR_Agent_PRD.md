# 18 — Minibob SDR Agent PRD (Next-Gen Lead Capture)

**Status:** Executed  
**Owner:** Product Dev Team (Bob/Minibob + San Francisco)  
**Primary surface:** Minibob (anonymous playground on clickeen.com)  
**Agent:** `sdr.widget.copilot.v1` (San Francisco execution; Minibob subject/policy)

---

## Peer review focus (what we need eyes on)
1) **Allowlist contract** — is `sdr.allowlist.json` strict enough to scale to 100s of widgets without special cases?  
2) **ConversationLanguage determinism** — is the resolution + stickiness rule precise and implementable without ML?  
3) **Consent + fetch guardrails** — do we keep website fetches fully server-side and consent-gated?  
4) **Action surface discipline** — do we keep set-only ops and avoid new modes/verbs in Minibob?

## 1. Summary

Minibob’s SDR Agent is a **conversion-first, product-bounded, multilingual lead capture flow** that replaces a traditional signup form.

Its job is to guide an anonymous visitor from:

**Generic widget → Personalized widget copy → Publish intent → Free account creation**

This agent is **not** a general-purpose chatbot for the internet. It is an acquisition surface tightly scoped to Clickeen’s product and funnel.

---

## Current codebase reality (2026-01-27)

This PRD is already largely aligned with runtime behavior:

- The SDR agent exists and is wired:
  - San Francisco executes `sdr.widget.copilot.v1` via `sanfrancisco/src/index.ts`
  - Implementation lives in `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
- The allowlist model is already implemented correctly:
  - San Francisco loads `tokyo/widgets/{widgetType}/sdr.allowlist.json`
  - Non-production fallback to `localization.json` exists with filtering
  - In production, missing `sdr.allowlist.json` fails visibly with message-only (no ops)
- Minibob grants are already constrained as intended:
  - Paris mints Minibob grants via `POST /api/ai/minibob/grant`
  - The grant is hard-scoped to `subject=minibob`, `agentId=sdr.widget.copilot.v1`, and `mode=ops`
  - Budgets are clamped in Paris
  - Public mint security + throttling is defined in PRD 023 (now executed code; Cloudflare ops pending):
    - `Execution_Pipeline_Docs/03-Executed/023__DESIGN_20_Minibob_Public_Mint.md`

What remains is not “new architecture,” but finishing the platform contract across widgets and tightening guardrails.

---

## 2. Goals and Non-Goals

### 2.1 Goals

1) **Increase free account creation** from Minibob sessions.  
2) Deliver a fast “aha” by converting generic widget text into **business-specific copy**.  
3) Work reliably across **100s of widgets** with a single global agent logic.  
4) Provide a **global** UX by responding in the **language the user uses** (ConversationLanguage).  
5) Handle **consent** cleanly for website reading and optional email capture.

### 2.2 Non-Goals

- Not a universal “copilot” for arbitrary internet queries.  
- Not a full editor copilot for deep widget styling.  
- Not a schema-mutation agent (no structural edits) in Minibob by default.  
- Not a crawler (only one page fetch, only with explicit consent).  
- Not allowed to write to Michael/Supabase during Minibob editing (see §9.4).

---

## 3. Key Tenets (SDR-specific)

### 3.1 Conversion is the primary objective
Every turn must do one of:
- Apply a small, visible personalization win  
- Ask one tight question that directly unlocks personalization  
- Move the user toward **Create Account / Publish**

### 3.2 Product-bounded scope
The agent only discusses:
- The widget being built
- The value of publishing/claiming
- The next step in Minibob flow

### 3.3 Do, don’t chat
Default behavior: **apply set-only copy edits** and confirm what changed in 1–2 sentences.

### 3.4 Minimal friction
Ask at most **one question at a time**. Prefer quick-reply choices.

### 3.5 Consent-first (hard requirement)
- No website fetch without explicit user consent.
- No email capture/use without explicit user consent.

### 3.6 Fail-closed edits
If a request cannot be mapped to allowed edits, the agent must ask a constrained question or propose a safe alternative. No speculative ops.

### 3.7 Language follows the user (not geo)
The agent responds in the language the user types (ConversationLanguage). If the user switches languages, the agent follows. Geo/Accept-Language/URL locale are **tertiary hints only** (never authoritative).

---

## 4. User Experience (Conversation as Signup Form)

### 4.1 Happy path (URL available)
1) User asks to customize for their business  
2) Agent asks for **website URL** (in user language)  
3) Agent asks **consent** to read one page  
4) Agent reads one page, rewrites generic widget copy into business-specific copy  
5) Agent: “Looks ready. Create a free account to publish and get the embed code.” (CTA)

### 4.2 Happy path (no URL)
1) Agent asks 2–3 compact fields:
- business/offer (industry + what you sell)
- audience (who you sell to)
- optional tone (friendly/premium)
2) Agent personalizes copy
3) Agent shows CTA to create account to publish/claim

### 4.3 Optional email capture (only if user requests)
If user asks “send me this / save this / email me the link”:
- Ask for email
- Ask for explicit email consent
- Confirm and proceed with CTA

---

## 5. Allowed Action Set (Global Verbs)

This is intentionally small. These are **the only** actions the SDR agent performs in Minibob.

### 5.1 Lead capture + consent
- `AskWebsiteUrl`
- `AskBusinessBasics` (industry, offer, audience)
- `AskConsentWebsiteRead` (single-page)
- `AskEmail`
- `AskConsentEmailContact`

### 5.2 Value delivery
- `PersonalizeCopy` (**set-only ops** on allowlisted text fields)
- `SuggestNextStep` (template suggestion or “publish next”)

### 5.3 Conversion
- `CTA_CreateAccount` (claim widget, publish, get embed code)
- `CTA_Publish` (if publish is the conversion trigger)

**CTA rendering (explicit):**
- Agent returns CTA in the response (localized to ConversationLanguage).
- Bob renders the CTA button below the agent message.
- Bob remains a dumb pipe: it does not decide *when* to show CTA, only renders what the agent returns.

**Explicitly disallowed in Minibob SDR (default):**
- Insert/remove/move ops
- Any styling work unless user explicitly requests it
- Any “global help” unrelated to the product
- Any direct writes to Paris/Michael (see §9.4)

---

## 6. Per-Widget Contract (Surface Area)

Actions remain global. The per-widget contract is only the **target surface** the agent may edit.

### 6.1 Canonical allowlist (SDR-specific; required for production)
**Canonical source-of-truth for SDR editing:**
- `tokyo/widgets/{widgetType}/sdr.allowlist.json`

Rationale:
- `localization.json` is designed for translation workflows; it may include strings that are not appropriate for SDR rewrite (instructional/help copy, disclaimers, etc.). SDR needs a narrower “conversion copy” subset.

**Production rule:**
- If `sdr.allowlist.json` is missing for a widget, SDR personalization is **disabled** for that widget (fail visibly: return message-only explaining the widget is not yet SDR-enabled).

### 6.2 Dev fallback (temporary; explicitly non-production)
For development convenience only:
- If `sdr.allowlist.json` is missing, the system MAY fall back to `tokyo/widgets/{widgetType}/localization.json`, but must:
  - filter to `type in {string, richtext}`
  - exclude paths matching `branding|legal|disclaimer|powered|copyright` (case-insensitive)
  - include a meta warning: `meta.allowlistSource="localization_fallback"`

**Hard production gate (required):**
- In production, **never** use the fallback. If `sdr.allowlist.json` is missing, fail visibly and return message-only (no ops).

**Stage gate (explicit):**
- Fallback is allowed only when `ENV_STAGE` is `local` or `cloud-dev`.
- For any other stage, missing `sdr.allowlist.json` must fail closed with a user-visible message.

### 6.5 Rollout contract (quality gate)
Before a widget appears in the Minibob gallery:
1) Widget MUST include `sdr.allowlist.json`.
2) Allowlist paths must resolve to `string|richtext` fields in the widget spec.
3) At least 3 editable paths must be present (minimum utility threshold).

This fallback exists only to unblock early widgets in dev.

### 6.3 Allowlist schema (normative)
`sdr.allowlist.json` shape:

```json
{
  "v": 1,
  "paths": [
    { "path": "title", "type": "string", "role": "headline" },
    { "path": "sections.*.heading", "type": "string", "role": "subhead" },
    { "path": "sections.*.faqs.*.question", "type": "string", "role": "question" },
    { "path": "sections.*.faqs.*.answer", "type": "richtext", "role": "answer" }
  ]
}
```

Fields:
- `path` (string, required): allowlisted path or glob pattern (`*` for array indices)
- `type` (enum, required): `string | richtext`
- `role` (enum, optional): `headline | subhead | cta | label | question | answer | helper | emptyState | note`

### 6.4 Role hints (now specified)
Role hints are optional but standardized (see schema above). They are used only to improve rewrite quality; they do not change safety constraints.

---

## 7. ConversationLanguage (Global, User-Driven)

### 7.1 Definition
**ConversationLanguage** is the language the user is actively using (or explicitly requested), independent of geo location and independent of a page’s locale.

### 7.2 Resolution order (normative)
1) Explicit user instruction (“reply in German”)  
2) Current user message language (script + stopword evidence)  
3) Session sticky language  
4) Fallback: `en`

### 7.3 Stickiness rule (avoid thrash)
Do **not** switch languages unless:
- user explicitly requests it, or
- the current message has a high-confidence signal for a different language (see 7.4)

### 7.4 Determinism contract (required; implementable without ML)
Language is resolved deterministically via:

**A) Script detection (confidence 0.95; allows switching immediately)**
- Cyrillic → `ru` (or `uk` if strong Ukrainian stopwords)
- Arabic → `ar`
- Hebrew → `he`
- Devanagari → `hi`
- Hangul → `ko`
- Kana present → `ja`
- Han (no kana/hangul) → `zh`

**B) Stopword lexicon scoring (Latin script; confidence 0.85 required to switch)**
Supported initially: `en, es, fr, de, it, pt, nl`

**Safety rule (unsupported Latin locales):**
- If a Latin-script message is not confidently classified into the supported set, do **not** switch. Remain in the current sticky language.

**C) Explicit language names (override)**
“In German / auf Deutsch / in italiano / en español” overrides detection.

**Fixtures (acceptance examples)**
- "Привет, помоги с FAQ" → `ru`
- "مرحبا اريد تعديل الاسئلة" → `ar`
- "こんにちは FAQ を直して" → `ja`
- "¿Puedes mejorar el título?" → `es`
- "Bitte antworte auf Deutsch" → `de` (explicit override)
- "Make the title clearer" → `en`

### 7.7 Explicit language override (escape hatch)
Users can force a language switch by typing any of:
- "/lang:ru"
- "language: español"
- "switch to German"

On detection:
1) Switch ConversationLanguage immediately.
2) Confirm in the new language (short message).
3) Persist the sticky language for the session.

### 7.5 Output requirement
All user-visible strings must be in ConversationLanguage:
- agent `message`
- consent prompts
- CTA text

### 7.6 Consent parsing (multilingual; deterministic)

---

## Thinnest execution slice (finish the contract, avoid new complexity)

This should be a narrow closeout slice, not a redesign:

1) **Make SDR allowlists real for golden widgets (Tokyo-only)**
- Add/confirm `sdr.allowlist.json` for the widgets we actually promote in Minibob.
- Keep them extremely tight (headlines, questions, answers, primary CTAs).
- Do not expand the editable surface beyond conversion-critical copy.

2) **Do not expand the action surface**
- Keep set-only ops.
- Do not add insert/remove/move in Minibob SDR.
- Do not introduce new agent modes or special cases per widget.

3) **Close the production guardrail loop**
- Ensure Minibob uses the constrained mint path (`/api/ai/minibob/grant`) everywhere.
- Ensure the missing-allowlist path is a clear, user-facing “not yet supported” message (already present in SF; keep it consistent in UI).

4) **Add a minimal contract check (small, scalable)**
- Add a simple repo check that asserts:
  - promoted Minibob widgets have `sdr.allowlist.json`
  - allowlist paths resolve to string/richtext fields in current configs/specs
- This prevents drift without adding runtime complexity.

This slice is elegant because it:
- keeps the AI contract small and enforceable,
- scales across 100s of widgets via allowlists,
- and aligns tightly with the current architecture (policy gate in Paris, execution in San Francisco, widget contract in Tokyo).
Consent is recognized via lexicon-based affirmative/negative sets. If ambiguous, ask a single Yes/No question in ConversationLanguage.

---

## 8. ConversationLanguage vs Localization Overlays (Clarification)

This section locks down how SDR personalization interacts with Clickeen’s overlay-based localization system.

### 8.1 Minibob SDR edits are base-config edits (in-memory)
- During Minibob editing, SDR ops apply to **Bob’s in-memory instanceData** only.
- The SDR agent does not create or write locale overlays in Supabase during anonymous sessions.

### 8.2 Publish behavior (after signup)
- On Publish (which triggers signup/claim), the **current in-memory config** is persisted as the instance’s base config.
- That base config may be in any language (ConversationLanguage). Clickeen does not assume English as the base.
- **Architecture impact:** this is a cross-system decision; update `documentation/architecture/CONTEXT.md` and `documentation/capabilities/localization.md` to reflect “base config may be non-English.”

**Downstream implications (explicit):**
- Localization overlays may be generated from a non-English base (no assumption of English).
- Any content QA or analytics relying on English defaults must be updated to detect actual base language.
- Prague marketing surfaces must treat base language as data, not a fixed assumption.

### 8.3 Future localization (post-signup)
- After signup, if the user enables additional locales, the localization pipeline may generate overlays from whatever base content is stored.
- Persisting ConversationLanguage as an overlay (instead of base config) is out of scope for Phase 1.

---

## 9. System Architecture and Data Flow

### 9.1 Surfaces
- **Bob/Minibob UI**: captures user prompt, shows agent responses, applies ops to in-memory state
- **Bob Edge route**: forwards to grant mint + execute (server-to-server); browser never receives secrets
- **Paris**: issues signed grants; stamps subject/policy; clamps budgets; enforces public mint gates (Phase 2)
- **San Francisco**: runs the SDR state machine; stores session state in KV; performs consented website fetch

### 9.2 Outcomes/events
Use existing outcomes where possible:
- `cta_clicked`
- `signup_started`
- `signup_completed`

All outcomes must include:
- `sessionId`
- `widgetType`
- derived `ConversationLanguage`

### 9.3 Public grant issuance (hard boundary; explicit owner and enforcement)
**Owner:** Platform / Paris Worker (security boundary) + Cloudflare edge controls

A production SDR flow requires a public minting path for **minibob** subject, enforced in two layers:
1) **Cloudflare edge** (primary rate limiting / abuse controls)
2) **Paris Worker** (fail-closed semantic gates)

Details: Appendix C.

**Dependency note (required before GA):**
This PRD depends on PRD 023 (Minibob public mint) security hardening:
- Server-issued session tokens (`POST /api/ai/minibob/session`)
- Session token verification on grant mint
- KV throttling behind `MINIBOB_RATELIMIT_MODE`

### 9.4 Two-API-Call pattern / publish semantics (hard requirement)
**Rule: SDR edits are in-memory only.**
- Agent ops are applied by Bob to React state (`instanceData`) and preview updates via postMessage.
- The agent must not call any Paris instance update endpoints.
- The only base-config write is user-initiated Publish (after signup/claim).

This preserves:
- two-call base config pattern (Load + Publish)
- zero DB pollution from anonymous Minibob sessions

---

## 10. Security, Privacy, and Consent

### 10.1 Website fetch ownership (explicit)
**Owner:** San Francisco (server-side only)

- Website fetch is executed only inside San Francisco as part of SDR agent execution.
- Bob and the browser never fetch user-provided URLs.
- Fetch may only occur after consent is recorded in SDR KV session state.
- Enforcement uses SSRF protections and single-page fetch utilities (block private networks, file URLs, localhost, etc.).
- One-page only, bounded text extraction, strict timeouts.

### 10.2 Email capture
- Only with explicit consent
- Default conversion path is signup CTA; pre-signup emailing is optional and may be Phase 2.

---

## 11. Failure Behavior (Tenet compliance)

- Never claim changes were applied if no ops were returned.
- If ops validation fails: ask one constrained question or propose narrower rewrite.
- If URL fetch fails: ask for a different URL or offer business-basics path.
- If widget lacks SDR allowlist: fail visibly with a short message that the widget is not yet SDR-enabled.

---

## 12. Acceptance Criteria (Definition of Done)

### 12.1 Functional
- For any widget with `sdr.allowlist.json`, SDR agent can:
  - personalize copy in user language
  - produce valid set ops
  - drive CTA after visible win

### 12.2 Safety
- No fetch without consent
- No email capture without consent
- No ops outside allowlisted paths
- No writes to Paris/Michael until Publish

### 12.3 Scale
- Works for 3 widgets (FAQ, Countdown, LogoShowcase) with no widget-specific logic
- Works across at least 5 languages (en, es, it, ru, ar)

---

## 13. Implementation Plan (for Cursor/Codex)

### Phase 1 — Make it reliably do something
1) Refactor `sanfrancisco/src/agents/sdrWidgetCopilot.ts` into funnel state machine.
2) Implement allowlist loader with canonical `sdr.allowlist.json` and visible failure when missing.
3) Implement ConversationLanguage determinism + multilingual consent parser.
4) Replace “full config dump” prompting with allowlisted text slice only.
5) Ensure model routing uses consistent identity (`sdr.widget.copilot.v1`).
6) Wire agent in `sanfrancisco/src/index.ts` (execute router) to map `sdr.widget.copilot.v1` → `executeSdrWidgetCopilot`.

### Phase 2 — Public grant mint path (security-gated)
Implement Appendix C in Paris + Cloudflare.

### Phase 3 — Eval harness
Extend eval scripts with Minibob SDR scenarios and language tests.

---

## 14. Open Questions

1) Do we support pre-signup emailing at all (Phase 1), or force account creation first?  
2) Should widgets be required to ship `sdr.allowlist.json` before they appear in Minibob gallery?  
3) CTA integration: returned by agent vs injected by UI.

---

## Execution Notes (local)

**Executed scope (code + docs):**
- Added SDR allowlists for FAQ, Countdown, LogoShowcase (Tokyo).
- Added allowlist validation script and validated (`scripts/validate-sdr-allowlists.mjs`).
- Implemented explicit ConversationLanguage override patterns in SDR agent.
- CTA rendering handled in Bob (agent-returned CTA).
- Updated docs: base config may be non-English; SDR allowlist guide; Minibob SDR integration.

**Verification (local):**
- Allowlist validation script passes.
- Minibob SDR flow runs end-to-end with DeepSeek after API credit top-up.

**Human/manual remaining (cloud-dev/CF):**
- Cloudflare edge rate limits + bot controls for Minibob mint/execute (see PRD 023 manual steps).

---

## Appendix A — Response Schema (Agent → Bob)

```json
{
  "message": "string (in ConversationLanguage)",
  "ops": [
    { "op": "set", "path": "title", "value": "..." }
  ],
  "cta": { "text": "Create free account", "action": "signup" },
  "meta": {
    "state": "personalize|convert|collect|consent",
    "language": "ru",
    "languageConfidence": 0.9,
    "allowlistSource": "sdr_allowlist|localization_fallback"
  }
}
```

---

## Appendix B — Consent Signals (Examples)

- RU yes: “да”, “ок”, “хорошо”
- AR yes: “نعم”, “موافق”
- DE yes: “ja”, “klar”
- IT yes: “sì”, “va bene”
- ES yes: “sí”, “vale”

If ambiguous, ask: “Yes / No?” in ConversationLanguage.

---

## Appendix C — Public Minibob Grant Mint Path (Security Spec)

**Purpose:** allow anonymous Minibob sessions to obtain an AI grant for SDR execution **without any privileged surface**.

**Implementation spec:** see `Execution_Pipeline_Docs/03-Executed/023__DESIGN_20_Minibob_Public_Mint.md`.

### C.1 Where this lives (explicit)
- **Service-zone ownership (required):** Cloudflare rules are defined on the **service zones** (`paris.*`, `sanfrancisco.*`) and scoped to the **mint + execute paths**, not marketing domains.
- **Paris Worker** owns minting and subject scoping (security boundary).
- **Cloudflare edge** owns primary rate limiting / bot mitigation on the mint endpoint and execute endpoint.

### C.2 Endpoint shape (recommended)
Option A (recommended): new endpoint in Paris, e.g.:
- `POST /api/ai/minibob/grant`

This avoids expanding semantics of the dev-gated `/api/ai/grant`.

**Paris router touchpoints (exact files):**
- `paris/src/index.ts` — add route handler for `/api/ai/minibob/grant`
- `paris/src/domains/ai/index.ts` — implement `handleAiMinibobGrant` (gates + clamps)
- `paris/src/shared/types.ts` — extend types if needed (grant payload/response)

### C.3 Fail-closed semantic gates (Paris; mandatory)
Server must ignore/override any client-provided escalation fields:
- subject is forced to `minibob`
- workspaceId must be absent (reject if present)
- agentId must be exactly `sdr.widget.copilot.v1` (reject otherwise)
- mode is forced to `ops` (or a dedicated restricted mode)
- requested budgets are ignored except for down-clamping (never up)

### C.4 Hard budget caps (Paris; mandatory)
Clamp regardless of request:
- `maxTokens`: 350–500 (recommend 420)
- `timeoutMs`: 10–20s
- `maxRequests`: 1–2 (recommend 2 for repair pass)

### C.5 Rate limiting (Cloudflare + Paris; mandatory)
**Layer 1 (Cloudflare):**
- Apply Cloudflare Rate Limiting rules on **service zones** (`paris.*`, `sanfrancisco.*`) for:
  - mint endpoint: `POST /api/ai/minibob/grant`
  - execute endpoint (San Francisco): SDR execute path
- Use Bot Management / Turnstile optionally for suspicious traffic.

**Rule definitions (explicit; Cloudflare expression syntax):**
- **Paris mint rule**
  - Expression: `(http.request.method eq "POST" and http.request.uri.path eq "/api/ai/minibob/grant")`
  - Threshold: `10 requests / 5 minutes / IP`
  - Burst: `3 requests / 30 seconds / IP`
- **San Francisco execute rule**
  - Expression: `(http.request.method eq "POST" and http.request.uri.path eq "/v1/execute")`
  - Threshold: `30 requests / 10 minutes / IP`
  - Burst: `6 requests / 60 seconds / IP`

**Layer 2 (Paris in-code):**
- KV counters with privacy-safe fingerprint:
  - `fp = hash(daySalt + ip + userAgent + acceptLanguage)` (computed server-side)
  - store only fp hash, not raw IP/UA
- Enforce:
  - per-fp mint limit / minute
  - per-sessionId mint limit / hour
  - denylist repeated abuse patterns

**Phase note (reduce complexity):**
- Phase 1 may ship with Cloudflare-only controls if needed for speed, but **Phase 2 must add Paris KV limits** before GA.

### C.6 Abuse handling (mandatory)
- Return explicit deny errors (no silent success).
- Log deny reasons (rate_limit, agent_forbidden, workspace_forbidden, budget_forbidden).
- Do not degrade into “grant anyway” behavior.

### C.7 Ownership and review (mandatory)
- **Owner:** Platform/Paris (security) + Cloudflare config owner
- **Security review required before rollout:** verify no path enables workspace/devstudio privileges and no other agents can be minted.

**San Francisco router touchpoints (exact files):**
- `sanfrancisco/src/index.ts` — ensure `sdr.widget.copilot.v1` resolves to `executeSdrWidgetCopilot`
- `sanfrancisco/src/agents/sdrWidgetCopilot.ts` — state machine, consented fetch, ops output, KV session
