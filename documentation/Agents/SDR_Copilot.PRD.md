# SDR Copilot (Minibob) — Conversational Widget Copilot (V1)

STATUS: REFERENCE / PRD (keep in sync with shipped code)
Created: 2024-12-27
Last updated: 2025-12-30

This doc defines the **chat-first Copilot UX** inside Minibob (DevStudio’s Dev Widget Workspace). It is also a conversion surface: Copilot can include CTAs (signup/upgrade) when appropriate.

When debugging reality, treat runtime code + Cloudflare bindings as truth and update this doc when they drift.

---

## 1) Overview

SDR Copilot is the ToolDrawer “Copilot” tab that lets an anonymous visitor customize a widget using natural language.

Key properties:
- **Chat-only UI** (full-height conversation + bottom input).
- **Ops-based edits**: Copilot returns `ops[]` (machine diffs), never “instructions”.
- **Deterministic application**: Bob applies ops as pure transforms (no coercion of widget config). It blocks only obvious protocol abuse (e.g. prototype pollution path segments).
- **Explicit commit**: after an edit, the user must **Keep** or **Undo** (no silent commits).
- **Budgeted + signed**: every model execution is authorized by a short-lived **AI Grant** minted by Paris and verified by San Francisco.

---

## 2) Goals / Non-goals

### Goals
- Visitors can make a **small edit successfully** in under 30 seconds.
- The system remains deterministic and safe:
  - ops apply deterministically to the current config
  - ambiguous vocabulary triggers clarifying questions
- Copilot supports conversion messaging (CTA) without degrading the editing loop.

### Non-goals (V1)
- Crawling whole sites, multi-page scraping, or following links.
- Free-form CSS/HTML generation.
- Auto-save or persistence (Bob’s in-memory model remains unchanged).

---

## 3) UX Spec (Minibob ToolDrawer → “Copilot” tab)

### 3.1 Layout
- Copilot panel is **only chat**:
  - conversation list fills the height
  - input is pinned to the bottom
  - no “quick actions”, no extra instruction blocks

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
Copilot starts with a short contextual greeting based on the loaded instance.

Template (example for FAQ):
> Hello! I see you have an FAQ widget with 3 questions. You can ask me to change the title, colors, layout, add or edit questions, adjust fonts, or modify any other settings listed in the editable controls. What would you like to customize?

### 3.4 Keep / Undo loop (core interaction)
When Copilot returns `ops[]`:
1) Bob applies ops immediately (preview updates).
2) Copilot asks: “Want to keep this change?”
3) UI shows **Keep** and **Undo** buttons.
4) Until a decision is made, Copilot blocks new prompts and nudges:
   - “Keep or Undo? (Use the buttons above, or type ‘keep’ / ‘undo’.)”

Typed commands are supported:
- typing `keep` commits the last ops batch
- typing `undo` reverts the last ops batch

### 3.5 Error behavior (chat never degrades)
- If any upstream returns HTML (Cloudflare 502/5xx), Copilot must **not** display raw HTML. It displays a short friendly message instead.
- If the model returns invalid JSON, Copilot displays a friendly message (“Model did not return valid JSON”) and applies **no ops**.

---

## 4) Architecture (shipped)

### 4.1 Call chain (Minibob)

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

### 4.2 “Two-call model” clarification
From Bob’s perspective, a single Copilot request uses **two platform services**:
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
- `controls` must be derived from `compiled.controls[]` (binding + AI context). `controls[]` is binding/context, while enforcement lives in Clickeen-owned widget definition + editor surfaces.
- `sessionId` is used for learning + conversion attribution.

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
- `200` with `{ "message": "..." }` for **upstream issues** (Paris/SF/provider down), to avoid noisy “Failed to load resource” console spam in Pages/DevStudio surfaces.

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

Supported `event` values (V1):
- `ux_keep`, `ux_undo`
- `cta_clicked`
- `signup_started`, `signup_completed`
- `upgrade_clicked`, `upgrade_completed`

HTTP semantics:
- Always returns `200` with `{ ok: true|false }` (best-effort logging; UX continues even if logging fails).

---

## 6) San Francisco agent contract (V1)

Current Minibob uses:
- `agentId: "sdr.widget.copilot.v1"`

The agent is expected to return:
- `message` (always)
- `ops[]` (optional; empty means “no edit”)
- `cta?` (optional)
- `meta` (includes at least intent/outcome + version stamps when available)

It uses two deterministic layers before/around model output:
1) **Global edit vocabulary** (clarify ambiguous terms like “background”).
2) **URL guardrails** (single-page read, SSRF protections, Cloudflare HTML detection).

---

## 7) Global edit vocabulary (shared across all widgets)

San Francisco owns the shared dictionary:
- `sanfrancisco/src/lexicon/global_dictionary.json`

Purpose:
- Map user language into canonical widget concepts (stage vs pod vs content).
- Trigger deterministic clarification prompts when a request is ambiguous.

Example:
- User: “Make the background darker”
- Copilot: “Do you mean the stage (outside the widget) or the pod (the widget surface)?”

---

## 8) URL read (V1 capability)

Copilot may read **one public URL** to propose edits (for example: “Update these FAQs from my homepage”).

Constraints:
- Only one page (no crawling).
- Protocol: `http`/`https` only.
- Blocks localhost, `.local`, and direct IPs (SSRF hard-stop).
- Caps response size to avoid token explosions.
- If the page is an error page (Cloudflare 5xx HTML), Copilot should ask for another URL or suggest manual edits.

---

## 9) Learning + Regression Protection

### 9.1 Learning signals (outcomes, not “more logs”)
San Francisco logs every interaction and Paris/Bob attach outcomes:
- edit success (ops applied)
- undo/keep decisions
- CTA clicks + conversions
- failure reasons (invalid ops, timeouts, upstream errors)

### 9.2 Golden set (deterministic regression harness)
The golden set protects:
- routing decisions (explain vs clarify vs edit)
- dictionary clarifications
- URL guardrails / Cloudflare HTML detection

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

## 11) Success criteria (initial)

- Valid ops rate: ≥ 80% in Cloud-dev
- Undo rate: ≤ 25% in Cloud-dev
- p95 latency: < 8 seconds for simple edits
- Conversion lift: positive signal without harming editing success
