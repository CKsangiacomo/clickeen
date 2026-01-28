# Minibob SDR Agent Integration

## User flow (public)
1. User types in their language (ConversationLanguage).
2. Agent asks for URL or business basics.
3. Agent personalizes copy (set‑only ops).
4. Agent returns CTA to create account/publish.
5. User signs up → publish persists base config.

## Technical flow
1. `POST /api/ai/minibob/session` → `sessionToken`
2. `POST /api/ai/minibob/grant` → `grant`
3. `POST /v1/execute` (San Francisco) → `{ ops, message, cta }`
4. Bob applies ops in memory; preview updates via postMessage.
5. Publish writes base config to Michael.

## Contracts
- Allowlist: `tokyo/widgets/{widgetType}/sdr.allowlist.json`
- Ops: **set‑only** and **allowlist‑only**
- Consent: website fetch is SF‑only and consent‑gated
- Language: deterministic ConversationLanguage (no ML)
- **No translation goal:** the SDR agent does not translate the widget as a goal; it personalizes copy using website or business context.

## CTA
Agent returns CTA; Bob renders button and routes to signup/publish.

## Minibob keep gate (public UX)
- Minibob does **not** allow “Keep” without signup.
- After a visible change, the CTA is the only way to keep/publish edits.
