# Pitch Agent — Investor Relations AI

## What This Is

The Pitch Agent represents Piero to investors via a Custom GPT. Investors receive a ChatGPT link, ask questions, and the agent answers based on Clickeen's documentation — accurately, with sources.

**Why it exists:** Piero is exceptional at building but admits he's not great at pitching. The Pitch Agent does what he's weak at. The fact that an AI pitches for him IS the proof of concept — he builds with AI, runs with AI, pitches with AI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INVESTOR FLOW                           │
│                                                                 │
│   Investor                Custom GPT              Pitch Worker  │
│      │                        │                        │        │
│      │  "What is Clickeen?"   │                        │        │
│      │───────────────────────►│                        │        │
│      │                        │  GET /v1/pitch/search  │        │
│      │                        │   ?query=...           │        │
│      │                        │───────────────────────►│        │
│      │                        │                        │        │
│      │                        │   { items: [...] }     │ Query  │
│      │                        │◄───────────────────────│Vectorize│
│      │                        │                        │        │
│      │  Answer + sources      │                        │        │
│      │◄───────────────────────│                        │        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        INDEXING FLOW                            │
│                                                                 │
│   CI / Manual Sync       Pitch Worker             Vectorize     │
│      │                        │                        │        │
│      │  Push to docs/         │                        │        │
│      │───────────────────────►│                        │        │
│      │                        │                        │        │
│      │  POST /v1/pitch/upsert │                        │        │
│      │   { items: [...] }     │                        │        │
│      │───────────────────────►│  Embed + upsert       │        │
│      │                        │───────────────────────►│        │
│      │                        │                        │        │
│      │  { upserted: N }       │                        │        │
│      │◄───────────────────────│                        │        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pitch Worker Implementation

The Pitch Agent lives in a **dedicated Pitch Worker** (separate from San Francisco) so investor/pitch infra can never block core AI deploys.

### Endpoints (Pitch Worker)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/healthz` | GET | None | health check |
| `/v1/pitch/search` | GET | None (public) | GPT searches docs |
| `/v1/pitch/answer` | GET | None (public) | GPT gets a retrieval-only answer + citations |
| `/v1/pitch/upsert` | POST | `X-API-Key` header | Index docs from `pitch/scripts/sync-docs.mjs` (manual or CI) |

### Why No Grant?

The grant system (`/v1/execute`) is for authenticated users with budgets. The Pitch Agent is:
- Public-facing (investors aren't Clickeen users)
- Read-only (no state mutations)
- Low-risk (worst case: someone learns about Clickeen)

A simple API key for upsert is sufficient. Search is fully public.

---

## Components

### 1. Vectorize Index

**Name:** `clickeen-pitch-docs`
**Dimensions:** 1536 (text-embedding-3-small)
**Metric:** cosine

**Provisioning note (execution):**
- Pitch is deployed from `pitch/` (package `@clickeen/pitch`).
- Deploy is idempotent: it creates the Vectorize index if missing, then deploys:
  - `pnpm --filter @clickeen/pitch run deploy`

**Binding in `pitch/wrangler.toml`:**

```toml
[[vectorize]]
binding = "PITCH_DOCS"
index_name = "clickeen-pitch-docs"
```

### 2. Search Handler

Implementation:
- `pitch/src/search.ts`

Route:
- `GET /v1/pitch/search?query=...&top_k=...` → `{ items: [...] }`

### 3. Upsert Handler

Implementation:
- `pitch/src/upsert.ts`

Route:
- `POST /v1/pitch/upsert` (requires `X-API-Key: PITCH_SERVICE_KEY`) → `{ upserted: number }`

### 4. Embedding Helper

Implementation:
- `pitch/src/embed.ts`

### 5. Router Update

Routing lives in `pitch/src/index.ts`:
- `GET /healthz`
- `GET /v1/pitch/search`
- `GET /v1/pitch/answer`
- `POST /v1/pitch/upsert`

---

## Indexing Pipeline

Canonical implementation:
- `pitch/scripts/sync-docs.mjs`

Sources (current):
- `documentation/_pitch/**`
- `documentation/strategy/WhyClickeen.md`
- `documentation/strategy/GlobalReach.md`

Manual run:
```bash
PITCH_API_URL=http://localhost:8790 \
PITCH_SERVICE_KEY=your-service-key \
pnpm --filter @clickeen/pitch sync-docs
```

Notes:
- Upsert auth uses `X-API-Key: PITCH_SERVICE_KEY`.
- This repo does not currently include a dedicated GitHub Action for pitch indexing. Use `pnpm --filter @clickeen/pitch deploy:full` (deploy + sync) or wire the commands above into your CI.

---

## Custom GPT Configuration

### Name

```
Piero | Clickeen Founder
```

### Description

```
AI agent representing Piero, solo founder of Clickeen. I can answer investor questions about the company, technology, vision, and investment opportunity. Piero builds with AI, runs with AI, pitches with AI — that's the thesis.
```

### Instructions

See `INSTRUCTIONS.md` section below.

### Action (OpenAPI)

```yaml
openapi: 3.1.0
info:
  title: Clickeen Pitch Agent
  version: "1.0"
servers:
  - url: https://pitch-dev.clickeen.workers.dev
paths:
  /v1/pitch/search:
    get:
      operationId: searchPitchDocs
      summary: Search Clickeen documentation
      parameters:
        - in: query
          name: query
          required: true
          schema:
            type: string
          description: Natural language question to search for
        - in: query
          name: top_k
          required: false
          schema:
            type: integer
            default: 5
            minimum: 1
            maximum: 10
          description: Number of results to return
      responses:
        "200":
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      type: object
                      properties:
                        text:
                          type: string
                        title:
                          type: string
                        url:
                          type: string
                          nullable: true
                        section:
                          type: string
                          nullable: true
                        source_id:
                          type: string
                        score:
                          type: number
  /v1/pitch/answer:
    get:
      operationId: answerPitchQuestion
      summary: Answer an investor question (retrieval-first)
      parameters:
        - in: query
          name: query
          required: true
          schema:
            type: string
        - in: query
          name: locale
          required: false
          schema:
            type: string
            default: en
        - in: query
          name: top_k
          required: false
          schema:
            type: integer
            default: 6
            minimum: 1
            maximum: 10
      responses:
        "200":
          description: Answer + citations
          content:
            application/json:
              schema:
                type: object
                properties:
                  answer:
                    type: string
                  citations:
                    type: array
                    items:
                      type: object
                      properties:
                        source_id:
                          type: string
                        title:
                          type: string
                        url:
                          type: string
                          nullable: true
                        section:
                          type: string
                          nullable: true
                        score:
                          type: number
                      required:
                        - source_id
                required:
                  - answer
                  - citations
```

### Conversation Starters

```
What is Clickeen and why should I care?
Why can't Mailchimp or Elfsight just copy this?
What's built vs what's still planned?
Why are you the right person to build this?
What's the ask?
How does this become a $100M+ company?
```

---

## GPT Instructions (System Prompt)

```
You are an AI agent representing Piero, the solo founder of Clickeen. Your job is to answer investor questions clearly, honestly, and compellingly.

This agent exists because Piero is exceptional at building and execution but admits he's not great at pitching. The fact that you exist IS the pitch — he built an AI to do what he's weak at. That's how he builds everything.

# HOW YOU WORK

You have access to a searchPitchDocs action that searches Clickeen's documentation.

For ANY question about Clickeen:
1. Call searchPitchDocs with the user's question
2. Read the returned chunks carefully
3. Answer ONLY based on what you find — don't make things up
4. Cite your sources: "According to [document title]..."

If you can't find relevant information, say: "I don't have specific information on that. Would you like to schedule a call with Piero?"

# THE PITCH

## The Core Insight

Every software company is building AI copilots. Why? Because that's all legacy codebases allow. We asked a different question: what if you built software from scratch for AI to operate?

## The One-Liner

"Widgets are the Trojan horse. They're the perfect starting point—high-ROI, viral, fast. But once you're using widgets, you're already on the platform that extends to emails, landing pages, creatives, and the connections between them. Same AI-native architecture. Same AI workforce. Same global-by-default primitives."

## The Investment Thesis

**Proving software can be built for AI to operate.**

1. **Phase A (Current)**: Widgets — prove the architecture works. Could hit 1-3M ARR with viral PLG.

2. **Phase B**: Extend outputs — emails, landing pages, creatives. Multiplicative, not additive.

3. **Phase C**: Connect outputs — light CRM, marketing automation, social. Compete with Keap/Thryve.

4. **Phase D**: Unknown — if A-C work, implications snowball beyond what we can model.

## Why Incumbents Can't Follow

They're adding AI to legacy codebases. We're building AI-operable infrastructure from scratch. To match Clickeen, they'd need to rewrite everything.

## The Moat

AI-operable codebase + composable 100⁵ architecture + content as touchpoint + geography as non-concept + design-led PLG + the playbook (no one else is doing this work).

# THE ASK

Piero is seeking a secondary transaction on his equity in his current company to fund working on Clickeen full-time.

He's NOT raising for Clickeen directly right now. He needs personal runway.

If asked for specifics, say: "I'd need to connect you with Piero directly for those details."

# HOW TO RESPOND

1. Always search first. Call searchPitchDocs before answering.
2. Be direct and clear. No fluff.
3. Be honest about what's built vs planned.
4. Don't make things up. If you can't find it, say so.
5. Cite sources when answering.
6. Close when appropriate: "Would you like to schedule a call with Piero?"

# TONE

Professional but human. Confident but not arrogant. Match their energy.
```

---

## Secrets & Configuration

### CI/Local (doc sync)

| Env var | Purpose |
|--------|---------|
| `PITCH_API_URL` | Base URL of the Pitch Worker (e.g. `https://pitch-dev.clickeen.workers.dev`) |
| `PITCH_SERVICE_KEY` | Upsert auth key (sent as `X-API-Key`) |

### Cloudflare Worker Secrets (Pitch Worker)

| Secret | Value |
|--------|-------|
| `OPENAI_API_KEY` | `sk-...` (for embeddings) |
| `PITCH_SERVICE_KEY` | Same value used by the sync script |

---

## Security

| Concern | Mitigation |
|---------|------------|
| **Search abuse** | Rate limit by IP if needed (Cloudflare has built-in) |
| **Upsert abuse** | Protected by `X-API-Key` header |
| **Sensitive info** | Agent only returns what's in docs |
| **Cost** | OpenAI embeddings are cheap (~$0.0001/query) |

---

## What Gets Indexed

| Folder | Indexed? | Why |
|--------|----------|-----|
| `documentation/_pitch/` | ✅ | Investor-facing pitch docs |
| `documentation/strategy/WhyClickeen.md` | ✅ | Vision and moats |
| `documentation/strategy/GlobalReach.md` | ✅ | Scale model |
| Everything else under `documentation/` | ❌ (today) | Keep scope small; expand in `pitch/scripts/sync-docs.mjs` when needed |

---

## Verification

### Acceptance Criteria

1. **Search works**: `GET /v1/pitch/search?query=what is clickeen` returns relevant chunks
2. **Answer works**: `GET /v1/pitch/answer?query=what is clickeen` returns `{ answer, citations }`
3. **Upsert works**: `pnpm --filter @clickeen/pitch sync-docs` successfully indexes docs
4. **GPT works**: Custom GPT answers questions accurately with sources
5. **Honest when unsure**: GPT says "I don't have information" rather than hallucinating

---

## Key Files

| File | Purpose |
|------|---------|
| `pitch/src/index.ts` | Worker router |
| `pitch/src/search.ts` | Search handler |
| `pitch/src/answer.ts` | Retrieval-first answer + citations |
| `pitch/src/upsert.ts` | Upsert handler |
| `pitch/src/embed.ts` | Embedding helper |
| `pitch/wrangler.toml` | Vectorize binding + env vars |
| `pitch/scripts/ensure-vectorize.mjs` | Idempotent index provisioning (deploy step) |
| `pitch/scripts/sync-docs.mjs` | Docs → Vectorize sync script |

---

## References

- `documentation/ai/overview.md` — San Francisco architecture
- `documentation/ai/infrastructure.md` — San Francisco operations
- `documentation/strategy/WhyClickeen.md` — Vision and moats
