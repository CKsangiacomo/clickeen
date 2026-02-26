# SDR Copilot — Conversational Widget Copilot

STATUS: REFERENCE / PRD (keep in sync with shipped code)
Created: 2024-12-27
Last updated: 2026-02-26

---

## 0) What SDR means

**SDR Copilot is a Sales Development Representative.**

The widget editing capability is the hook. Conversion is the goal.

SDR Copilot's mission is to guide anonymous visitors toward:
1. **Creating an account** (primary conversion)
2. **Upgrading to a paid plan** (secondary conversion, for existing free users)

This must be done in a **non-pushy, friendly way**. The Copilot earns trust by genuinely helping with edits, then naturally surfaces conversion opportunities when the moment is right (e.g., after a successful edit, when a feature requires an account, when the user has invested time in customization).

**Key differentiator**: SDR Copilot is not just a widget editor with a chat interface. It's a conversion-optimized AI sales agent that happens to edit widgets. Every design decision — from greeting to CTA timing to follow-up messaging — is informed by this mission.

We'll improve the conversion strategy as we learn from real interactions, but the SDR mindset is foundational.

---

## 1) Overview

SDR Copilot is the ToolDrawer "Copilot" tab that lets an anonymous visitor customize a widget using natural language.

Key properties:
- **Chat-only UI** (full-height conversation + bottom input).
- **Ops-based edits**: Copilot returns `ops[]` (machine diffs), never "instructions".
- **Deterministic application**: Bob applies ops as pure transforms (no coercion of widget config). It blocks only obvious protocol abuse (e.g. prototype pollution path segments).
- **Explicit commit**: after an edit, the user must **Keep** or **Undo** (no silent commits).
- **Budgeted + signed**: every model execution is authorized by a short-lived **AI Grant** minted by Paris and verified by San Francisco.
- **Conversion-aware**: Copilot includes CTAs (signup/upgrade) at appropriate moments without degrading the editing experience.

Current runtime contract (February 26, 2026):
- SDR widget copilot is constrained to FAQ sales workflow:
  1. Rewrite existing FAQ questions/answers.
  2. Personalize FAQ questions/answers from one website URL (single-page read, explicit consent).
- Requests outside those two capabilities return seller guidance plus a signup CTA (no fallback style/layout edits in SDR mode).
- Paid workspace users (`tier1|tier2|tier3`) are routed to `cs.widget.copilot.v1` (CS policy), not this SDR behavior pack.

**Sibling agents**: SDR Copilot is one of multiple Clickeen agents. See also: `documentation/ai/agents/ux-writer.md` (async localization intelligence).

---

## 2) Goals / Non-goals

### Goals
- Visitors can make a **small edit successfully** in under 30 seconds.
- The system remains deterministic and safe:
  - ops apply deterministically to the current config
  - ambiguous vocabulary triggers clarifying questions
- Copilot guides users toward conversion (signup/upgrade) without being pushy.
- Copilot tracks conversion attribution to measure SDR effectiveness.

### Non-goals
- Crawling whole sites, multi-page scraping, or following links.
- Free-form CSS/HTML generation.
- Auto-save or persistence (Bob's in-memory model remains unchanged).
- Aggressive or interruptive sales tactics.

---

## 3) UX Spec (ToolDrawer → "Copilot" tab)

### 3.1 Layout
- Copilot panel is **only chat**:
  - conversation list fills the height
  - input is pinned to the bottom
  - no "quick actions", no extra instruction blocks

### 3.2 Message styling
- Chat text uses `.body-m` typography.
- User bubble:
  - background: `--color-system-gray-5`
  - padding: `--space-2`
  - rounded: `--control-radius-md`
- Assistant bubble:
  - no background
  - no extra padding

### 3.3 Default first message (all widgets)

See **Section 3.5** for the content-first greeting strategy.

The greeting:
- Acknowledges the widget type and placeholder content
- Offers content personalization as the primary path
- Uses widget-specific item nouns from i18n (`faq.item.plural` → "questions")

### 3.4 Keep / Undo loop (core interaction)
When Copilot returns `ops[]`:
1) Bob applies ops immediately (preview updates).
2) Copilot asks: "Want to keep this change?"
3) UI shows **Keep** and **Undo** buttons.
4) Until a decision is made, Copilot blocks new prompts and nudges:
   - "Keep or Undo? (Use the buttons above, or type 'keep' / 'undo'.)"

Typed commands are supported:
- typing `keep` commits the last ops batch
- typing `undo` reverts the last ops batch

### 3.5 Content personalization (first interaction priority)

**Content personalization is the primary hook, not design customization.**

When a user lands on Minibob, the widget has placeholder content (e.g., FAQs about "Clickeen"). The first goal is to replace this with THEIR content.

**Default first message** (content-first):
> "Hi! I see you have an FAQ widget with placeholder questions. Want me to personalize them for your business?
> 
> **Option 1**: Share your website URL — I'll read it and write relevant FAQs for you.
> **Option 2**: Tell me what your business does — I'll create FAQs based on that.
> 
> Tell me if you want me to rewrite your current FAQs, or generate new ones from your site."

**Priority order**:
1. **Site URL** — Copilot reads, understands domain, generates content
2. **User describes business** — Copilot generates based on description
3. **Reference material** — "What's something you want to leverage?"
4. **Unsupported requests** — if user asks for layout/style edits, return seller guidance + signup CTA.

**Why content-first wins**:
- User gets real value fast (their FAQs, not Clickeen's)
- Higher investment = higher conversion (sunk cost is content, not colors)
- Natural conversion moment: "Save YOUR FAQs"

### 3.6 FAQ content limits (cost control)

SDR widget copilot is FAQ-only right now, with bounded generation limits:

| Widget | Limit | Total max |
|--------|-------|-----------|
| FAQ | 4 questions per section, 2 sections max | 8 questions |

When a limit is reached, Copilot explains:
> "I've added 4 questions to this section — that's the max for the free preview. Want me to create a second section, or would you like to edit what we have?"

If user hits the overall widget limit:
> "You've got a full FAQ with 8 questions across 2 sections. Looking great! To add more, create a free account."

### 3.7 Token budget + conversion gate

Runtime budgets are grant-scoped and strict (there is no 50K session budget):

- Minibob public grant (local): `maxTokens=650`, `maxRequests=2`, `timeoutMs=45_000`
- Minibob public grant (non-local stages, including cloud-dev): `maxTokens=420`, `maxRequests=2`, `timeoutMs=12_000`
- Minibob session turns budget: `budget.copilot.turns = 4` (entitlements policy)

Effective upper bound for anonymous Minibob sessions:
- Local: up to `5,200` tokens (`650 * 2 * 4`) before turn budget is exhausted
- Non-local/cloud-dev: up to `3,360` tokens (`420 * 2 * 4`) before turn budget is exhausted

When budgets/turns are exhausted, Paris/San Francisco return explicit deny + upsell signals.

**Token efficiency guardrails**:
1. **Single-page only** — no crawling, no follow-links, SSRF-blocked URL fetch.
2. **Bounded page payload** — source page read is byte-limited before model call.
3. **Grant-capped execution** — max tokens, timeout, and max requests are enforced by signed grant.
4. **Repair pass is bounded** — second pass runs only when grant/time budget still allows it.

### 3.8 Conversion moments (SDR behavior)

Beyond the token gate, Copilot surfaces CTAs at natural moments:

| Moment | CTA type | Example message |
|--------|----------|-----------------|
| After content generation | Soft signup | "Your FAQ is looking great! Want to save it? Create a free account to embed this on your site." |
| User requests premium feature | Feature gate | "That feature is available on our Pro plan. Want to see what's included?" |
| User hits content limit | Limit gate | "To add more questions, create a free account." |
| Token budget exhausted | Hard gate | "To keep using Copilot, create a free account." |
| User explicitly asks about saving | Direct | "To save and embed this widget, you'll need a free account. Takes 30 seconds." |

CTAs are **never interruptive**. They appear as part of the natural conversation flow, after Copilot has provided value.

### 3.6 Error behavior (chat never degrades)
- If any upstream returns HTML (Cloudflare 502/5xx), Copilot must **not** display raw HTML. It displays a short friendly message instead.
- If the model returns invalid JSON, Copilot displays a friendly message ("Model did not return valid JSON") and applies **no ops**.

---

## 4) Architecture

### 4.1 Call chain

1) UI calls Bob (same-origin):
- `POST /api/ai/widget-copilot`

2) Bob requests a short-lived grant from Paris:
- `POST {PARIS_BASE_URL}/api/ai/grant`

3) Bob executes on San Francisco:
- `POST {SANFRANCISCO_BASE_URL}/v1/execute`

4) San Francisco calls the provider selected by grant profile + agent constraints and returns structured output.

Prompt profiles (runtime persona pack):
- `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts` defines SDR vs CS prompt objectives/focus as first-class assets.

5) Bob applies ops, then waits for Keep/Undo.

6) UI reports outcomes:
- `POST /api/ai/outcome` → `POST {PARIS_BASE_URL}/api/ai/outcome` → `POST {SANFRANCISCO_BASE_URL}/v1/outcome`

### 4.2 "Two-call model" clarification
From Bob's perspective, a single Copilot request uses **two platform services**:
- Bob → Paris (grant)
- Bob → San Francisco (execute)

(San Francisco calls the provider/model resolved by grant policy; Minibob public mint currently defaults to Amazon Nova unless request overrides are accepted.)

---

## 5) API Contracts

### 5.1 Bob API: `POST /api/ai/widget-copilot`

This is the only endpoint the browser should call for Copilot execution.

Compatibility note (current cloud-dev deploys): `POST /api/ai/sdr-copilot` is still served as a compatibility entrypoint and forwards into the same handler path.

Request body:
```json
{
  "prompt": "string",
  "widgetType": "faq",
  "currentConfig": {},
  "controls": [],
  "sessionId": "anon-session-id",
  "instancePublicId": "wgt_..." 
}
```

Notes:
- `controls` must be derived from `compiled.controls[]` (binding + AI context). Controls are organized by panel (Content, Layout, Appearance, Typography) per `WidgetArchitecture.md`.
- `sessionId` is used for learning + conversion attribution.
- Each widget has an `agent.md` file defining editable paths, enums, and binding maps. Copilot uses this + `spec.json` to understand what's editable.
- `agentId` (when provided by the UI) is restricted to widget-copilot IDs only: `widget.copilot.v1`, `sdr.widget.copilot.v1`, `cs.widget.copilot.v1`.
- `subject` is normalized server-side to `workspace|minibob` only (`workspace` requires `workspaceId`).

Response shape (success):
```json
{
  "message": "string",
  "ops": [],
  "cta": { "text": "string", "action": "signup" },
  "meta": { "requestId": "uuid", "intent": "edit", "outcome": "ops_applied" }
}
```

HTTP semantics (intentional):
- `422` for **client validation errors** (missing prompt/widgetType/controls/currentConfig/sessionId).
- `200` with `{ "message": "..." }` for **upstream issues** (Paris/SF/provider down), to avoid noisy "Failed to load resource" console spam in Pages/DevStudio surfaces.

### 5.2 Bob API: `POST /api/ai/outcome`
Best-effort outcome attach used by the UI:
```json
{
  "requestId": "uuid",
  "sessionId": "anon-session-id",
  "event": "ux_keep",
  "occurredAtMs": 1735521234567,
  "timeToDecisionMs": 1200
}
```

Supported `event` values:
- `ux_keep`, `ux_undo`
- `cta_clicked`
- `signup_started`, `signup_completed`
- `upgrade_clicked`, `upgrade_completed`

HTTP semantics:
- Always returns `200` with `{ ok: true|false }` (best-effort logging; UX continues even if logging fails).

---

## 6) San Francisco widget-copilot contract (SDR + CS)

Current request alias:
- `agentId: "widget.copilot.v1"`

Paris resolves this alias by policy profile:
- `minibob` + `free` -> `sdr.widget.copilot.v1`
- `tier1`/`tier2`/`tier3` -> `cs.widget.copilot.v1`
- If callers force `sdr.widget.copilot.v1` or `cs.widget.copilot.v1`, Paris still canonicalizes to the profile-resolved ID for widget-copilot requests.

The agent is expected to return:
- `message` (always)
- `ops[]` (optional; empty means "no edit")
- `cta?` (optional; conversion opportunity)
- `meta` (includes at least intent/outcome + version stamps when available)

It uses two deterministic layers before/around model output:
1) **Vocabulary resolution** (clarify ambiguous terms like "question", "answer", or "rewrite vs generate").
2) **URL guardrails** (single-page read, SSRF protections, Cloudflare HTML detection).

---

## 7) Vocabulary + i18n integration

### 7.1 Shared vocabulary (coreui.*)

Shared terminology lives in i18n catalogs, but SDR runtime currently focuses on FAQ-content wording:

| User says | Copilot clarifies | i18n key |
|-----------|-------------------|----------|
| "question" | "Do you want to rewrite existing questions, or generate new FAQs from your website?" | `faq.item.singular`, `faq.item.plural` |
| "answer" | "Should I rewrite the answer tone, or replace it with website-specific content?" | `faq.item.singular` |

### 7.2 Widget-specific vocabulary ({widgetName}.*)

Each widget defines its own terminology in the i18n catalog:

| Widget | `{widget}.item.singular` | `{widget}.item.plural` |
|--------|--------------------------|------------------------|
| FAQ | "Question" | "Questions" |

Copilot uses these keys for:
- Greeting messages: "I see you have 3 **Questions**."
- Clarification prompts: "Do you want me to rewrite this **Question** or its answer?"
- Action confirmations: "I've added a new **Question**."

### 7.3 Panel-aware clarification

For SDR runtime, supported edits are FAQ content rewrites/personalization only. Non-supported requests (layout/appearance/typography/other widget types) return seller guidance + signup CTA.

| User says | SDR handling |
|-----------|--------------|
| "rewrite these questions" | Supported (FAQ content rewrite) |
| "use my website to generate FAQs" | Supported (single-page read + FAQ personalization) |
| "change spacing/colors/typography" | Not supported in SDR policy pack (seller guidance + CTA) |

When ambiguous within supported FAQ content scope, Copilot asks focused clarification questions.

---

## 8) URL read (primary content personalization path)

URL read is the **primary way users personalize content**. When a user shares their site URL, Copilot:

1. **Fetches the page** (single page, no crawling)
2. **Extracts plain text** from HTML (bounded size, scripts/styles stripped)
3. **Uses that source text directly** in the FAQ rewrite/personalization prompt
4. **Generates FAQ-only content ops** (or asks for clarification)

**Preprocessing is mandatory** — never send raw HTML to LLM.

**Constraints**:
- Only one page per request (no crawling, no following links)
- Protocol: `http`/`https` only
- Blocks localhost, `.local`, and direct IPs (SSRF hard-stop)
- Max response size: 750KB (larger pages are truncated)
- If page is an error page (Cloudflare 5xx HTML), ask for another URL

**Fallback if URL fails**:
> "I couldn't read that page. Can you tell me what your business does instead? I'll create content based on your description."

---

## 9) Learning + Regression Protection

### 9.1 Learning signals (outcomes, not "more logs")
San Francisco logs every interaction and Paris/Bob attach outcomes:
- edit success (ops applied)
- undo/keep decisions
- CTA clicks + conversions (critical for SDR effectiveness)
- failure reasons (invalid ops, timeouts, upstream errors)

### 9.2 Golden set (deterministic regression harness)
The golden set protects:
- routing decisions (explain vs clarify vs edit)
- vocabulary clarifications
- URL guardrails / Cloudflare HTML detection
- CTA timing appropriateness

Location + runner:
- `fixtures/copilot/prompts.jsonl`
- `fixtures/copilot/widgets/{widgetType}.json`
- `scripts/eval-copilot.mjs` (`pnpm eval:copilot`)

---

## 10) Rollout model

San Francisco indexes events by exposure stage (`envStage`), stamped into grants by Paris (`ENV_STAGE`):
- `local` (developer machine)
- `cloud-dev` (integration surface; can break)
- `uat` / `limited-ga` / `ga` (release stages; production infra with controlled exposure)

---

## 11) Success criteria

### Editing metrics
- Valid ops rate: ≥ 80%
- Undo rate: ≤ 25%
- p95 latency: < 8 seconds for simple edits
- Content generation success: ≥ 90% (URL read + generate completes without error)

### Conversion metrics (SDR effectiveness)
- Signup conversion rate: measure and improve over time
- Content-first path adoption: % of users who share URL or describe business (target: >50%)
- Token gate conversion: % of users who hit 50K limit and convert (target: >20%)
- Upgrade conversion rate: measure and improve over time

### Cost metrics (token efficiency)
- Average tokens per session: target <30K (budget is 50K)
- Cost per signup: target <$0.50
- Cache hit rate for site analysis: target >30%
- Preprocessing efficiency: raw HTML → extracted text ratio >10:1

The goal is **positive conversion lift without harming editing success or blowing token budget**. If conversion tactics degrade the experience, we dial them back. If token costs spike, we tighten limits.
