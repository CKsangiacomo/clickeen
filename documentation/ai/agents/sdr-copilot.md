# SDR Copilot — Conversational Widget Copilot

STATUS: REFERENCE / PRD (keep in sync with shipped code)
Created: 2024-12-27
Last updated: 2026-01-02

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

**Sibling agents**: SDR Copilot is one of multiple Clickeen agents. See also: `UXWriterAgent.PRD.md` (async localization intelligence).

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
> Or if you'd rather just customize the design, I can help with that too!"

**Priority order**:
1. **Site URL** — Copilot reads, understands domain, generates content
2. **User describes business** — Copilot generates based on description
3. **Reference material** — "What's something you want to leverage?"
4. **Design customization** — colors/fonts/layout (last resort)

**Why content-first wins**:
- User gets real value fast (their FAQs, not Clickeen's)
- Higher investment = higher conversion (sunk cost is content, not colors)
- Natural conversion moment: "Save YOUR FAQs" not "save your color changes"

### 3.6 Widget content limits (cost control)

Each widget type has generation limits to control token costs:

| Widget | Limit | Total max |
|--------|-------|-----------|
| FAQ | 4 questions per section, 2 sections max | 8 questions |
| Testimonials | 4 testimonials | 4 items |
| Logo Showcase | 8 logos | 8 items |
| Pricing Table | 3 plans | 3 items |

When a limit is reached, Copilot explains:
> "I've added 4 questions to this section — that's the max for the free preview. Want me to create a second section, or would you like to edit what we have?"

If user hits the overall widget limit:
> "You've got a full FAQ with 8 questions across 2 sections. Looking great! To add more, create a free account."

### 3.7 Token budget + conversion gate

**Session token budget**: 50,000 tokens per anonymous session.

This is generous enough to:
- Read one site (5-10K tokens)
- Generate full widget content (5-10K tokens)
- Make several design edits (5-10K tokens)
- Have a natural conversation (5-10K tokens)

**When budget is exhausted**:
> "You've been busy! 🎉 To keep using Copilot, create a free account. It takes 30 seconds and you'll keep all your customizations."

This is **the primary conversion gate**. The user has received real value (personalized content), and now we ask for the signup.

**Token efficiency guardrails**:
1. **Never send raw HTML to LLM** — preprocess to extract text, summarize to 1-2K tokens
2. **Two-stage LLM** — cheap model (GPT-4o-mini) for extraction, quality model for generation
3. **Cache site analysis** — same site = cached result (7-day TTL)
4. **Progressive generation** — generate 3-4 items, ask before generating more

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
- `POST /api/ai/sdr-copilot`

2) Bob requests a short-lived grant from Paris:
- `POST {PARIS_BASE_URL}/api/ai/grant`

3) Bob executes on San Francisco:
- `POST {SANFRANCISCO_BASE_URL}/v1/execute`

4) San Francisco calls the provider (DeepSeek) and returns structured output.

5) Bob applies ops, then waits for Keep/Undo.

6) UI reports outcomes:
- `POST /api/ai/outcome` → `POST {PARIS_BASE_URL}/api/ai/outcome` → `POST {SANFRANCISCO_BASE_URL}/v1/outcome`

### 4.2 "Two-call model" clarification
From Bob's perspective, a single Copilot request uses **two platform services**:
- Bob → Paris (grant)
- Bob → San Francisco (execute)

(San Francisco → DeepSeek is the provider call.)

---

## 5) API Contracts

### 5.1 Bob API: `POST /api/ai/sdr-copilot`

This is the only endpoint the browser should call for Copilot execution.

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

## 6) San Francisco agent contract

Current agent:
- `agentId: "cs.copilot.v1"` (alias: `sdr.widget.copilot.v1`)

The agent is expected to return:
- `message` (always)
- `ops[]` (optional; empty means "no edit")
- `cta?` (optional; conversion opportunity)
- `meta` (includes at least intent/outcome + version stamps when available)

It uses two deterministic layers before/around model output:
1) **Vocabulary resolution** (clarify ambiguous terms like "background", "item").
2) **URL guardrails** (single-page read, SSRF protections, Cloudflare HTML detection).

---

## 7) Vocabulary + i18n integration

### 7.1 Shared vocabulary (coreui.*)

Platform-level concepts that apply to all widgets are defined in the i18n catalog under `coreui.*`:

| User says | Copilot clarifies | i18n key |
|-----------|-------------------|----------|
| "background" | "Do you mean the **Stage** (outside the widget) or the **Pod** (the widget surface)?" | `coreui.stage`, `coreui.pod` |
| "padding" | "Do you mean **Pod padding** or **item card padding**?" | `coreui.pod`, `{widget}.item.singular` |
| "color" | "Which color? **Background**, **text**, or **accent**?" | `coreui.background`, `coreui.text`, `coreui.accent` |

### 7.2 Widget-specific vocabulary ({widgetName}.*)

Each widget defines its own terminology in the i18n catalog:

| Widget | `{widget}.item.singular` | `{widget}.item.plural` |
|--------|--------------------------|------------------------|
| FAQ | "Question" | "Questions" |
| Logo Showcase | "Logo" | "Logos" |
| Testimonials | "Testimonial" | "Testimonials" |
| Pricing Table | "Plan" | "Plans" |

Copilot uses these keys for:
- Greeting messages: "I see you have 3 **Questions**."
- Clarification prompts: "Do you mean the **Question card** background?"
- Action confirmations: "I've added a new **Logo**."

### 7.3 Panel-aware clarification

Copilot understands the four-panel structure (Content, Layout, Appearance, Typography) and uses it for disambiguation:

| User says | Copilot understands | Panel |
|-----------|---------------------|-------|
| "add a question" | Content (items array) | Content |
| "change spacing" | Layout (gaps, padding) | Layout |
| "make it darker" | Appearance (colors, fills) | Appearance |
| "bigger text" | Typography (font size) | Typography |

When ambiguous, Copilot asks: "Do you mean the **layout spacing** (gaps between items) or the **item padding** (space inside each card)?"

---

## 8) URL read (primary content personalization path)

URL read is the **primary way users personalize content**. When a user shares their site URL, Copilot:

1. **Fetches the page** (single page, no crawling)
2. **Preprocesses** (strip scripts/styles/nav, extract main content)
3. **Summarizes** (cheap model: business type, product, audience — ~1-2K tokens)
4. **Generates content** (quality model: FAQs, testimonials, etc. based on summary)

**Preprocessing is mandatory** — never send raw HTML to LLM.

**Constraints**:
- Only one page per request (no crawling, no following links)
- Protocol: `http`/`https` only
- Blocks localhost, `.local`, and direct IPs (SSRF hard-stop)
- Max response size: 500KB (larger pages are truncated)
- If page is an error page (Cloudflare 5xx HTML), ask for another URL

**Caching**:
- Site analysis results are cached in D1 with 7-day TTL
- Same site URL from different users = cache hit, no re-analysis
- Reduces token cost for popular/repeated sites

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
