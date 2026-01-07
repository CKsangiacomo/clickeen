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
│   Investor                Custom GPT              San Francisco │
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
│   GitHub Action          San Francisco            Vectorize     │
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

## San Francisco Integration

The Pitch Agent lives in a **dedicated Pitch Worker** (separate from San Francisco) so pitch infra can never block core AI deploys.

### Endpoints (Pitch Worker)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/healthz` | GET | None | health check |
| `/v1/pitch/search` | GET | None (public) | GPT searches docs |
| `/v1/pitch/answer` | GET | None (public) | GPT gets a retrieval-only answer + citations |
| `/v1/pitch/upsert` | POST | `X-API-Key` header | Index docs from GitHub Action |

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
  - `pnpm --filter @clickeen/pitch deploy`

**Binding in `sanfrancisco/wrangler.toml`:**

```toml
[[vectorize]]
binding = "PITCH_DOCS"
index_name = "clickeen-pitch-docs"
```

### 2. Search Handler

**File:** `sanfrancisco/src/pitch/search.ts`

```typescript
export async function handlePitchSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const topK = Math.min(parseInt(url.searchParams.get('top_k') || '5'), 10);

  if (!query) {
    return Response.json({ error: 'Missing query' }, { status: 400 });
  }

  // 1. Embed query using OpenAI
  const vector = await embedText(env.OPENAI_API_KEY, query);

  // 2. Query Vectorize
  const results = await env.PITCH_DOCS.query(vector, {
    topK,
    returnMetadata: true,
  });

  // 3. Format response
  const items = results.matches.map((m: any) => ({
    text: m.metadata?.text || '',
    title: m.metadata?.title || '',
    url: m.metadata?.url || null,
    section: m.metadata?.section || null,
    source_id: m.id,
    score: m.score,
  }));

  return Response.json({ items });
}
```

### 3. Upsert Handler

**File:** `sanfrancisco/src/pitch/upsert.ts`

```typescript
type UpsertItem = {
  id: string;
  text: string;
  title?: string;
  section?: string | null;
  url?: string | null;
};

export async function handlePitchUpsert(request: Request, env: Env): Promise<Response> {
  // Auth check
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey !== env.PITCH_SERVICE_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json() as { items: UpsertItem[] };
  if (!body?.items?.length) {
    return Response.json({ error: 'No items' }, { status: 400 });
  }

  // Embed and upsert each item
  const vectors = [];
  for (const item of body.items) {
    const values = await embedText(env.OPENAI_API_KEY, item.text);
    vectors.push({
      id: item.id,
      values,
      metadata: {
        text: item.text.slice(0, 10000), // Vectorize limit
        title: item.title || '',
        section: item.section || null,
        url: item.url || null,
      },
    });
  }

  await env.PITCH_DOCS.upsert(vectors);

  return Response.json({ upserted: vectors.length });
}
```

### 4. Embedding Helper

**File:** `sanfrancisco/src/pitch/embed.ts`

```typescript
export async function embedText(apiKey: string, input: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: input.slice(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.data[0].embedding;
}
```

### 5. Router Update

**In `sanfrancisco/src/index.ts`:**

```typescript
import { handlePitchSearch } from './pitch/search';
import { handlePitchUpsert } from './pitch/upsert';

// ... existing routes ...

// Pitch Agent endpoints
if (url.pathname === '/v1/pitch/search' && request.method === 'GET') {
  return handlePitchSearch(request, env);
}

if (url.pathname === '/v1/pitch/upsert' && request.method === 'POST') {
  return handlePitchUpsert(request, env);
}
```

---

## Indexing Pipeline

### GitHub Action

**File:** `.github/workflows/index-pitch-docs.yml`

```yaml
name: index-pitch-docs

on:
  push:
    paths:
      - 'documentation/**'
  workflow_dispatch: {}

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm i glob gray-matter
      - name: Index docs
        run: node scripts/index-pitch-docs.mjs
        env:
          DOCS_DIR: documentation
          SF_URL: ${{ secrets.SANFRANCISCO_URL }}
          SERVICE_API_KEY: ${{ secrets.PITCH_SERVICE_KEY }}
```

### Indexer Script

**File:** `scripts/index-pitch-docs.mjs`

```javascript
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';

const DOCS_DIR = process.env.DOCS_DIR || 'documentation';
const SF_URL = process.env.SF_URL;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

// Find markdown files (exclude competitor analysis, screenshots)
const files = await glob(`${DOCS_DIR}/**/*.md`, {
  nodir: true,
  ignore: [
    '**/node_modules/**',
    '**/CompetitorAnalysis/**',
    '**/*.png',
    '**/*.jpg',
  ],
});

// Chunk text with overlap
function chunk(text, size = 2000, overlap = 200) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + size));
    i += size - overlap;
  }
  return out;
}

// Extract first heading
function extractHeading(md) {
  const match = md.match(/^#\s+(.+)$/m) || md.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Build items
const items = [];
for (const filePath of files) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { content } = matter(raw);
  
  if (!content.trim() || content.length < 100) continue;
  
  let n = 0;
  for (const part of chunk(content)) {
    if (part.trim().length < 50) continue;
    
    items.push({
      id: `${filePath}#${n++}`,
      text: part,
      title: path.basename(filePath, '.md'),
      section: extractHeading(part),
      url: `https://github.com/CKsangiacomo/clickeen/blob/main/${filePath}`,
    });
  }
}

console.log(`Indexing ${items.length} chunks from ${files.length} files...`);

// Send to San Francisco
const response = await fetch(`${SF_URL}/v1/pitch/upsert`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': SERVICE_API_KEY,
  },
  body: JSON.stringify({ items }),
});

if (!response.ok) {
  console.error('Upsert failed:', await response.text());
  process.exit(1);
}

const result = await response.json();
console.log(`✓ Upserted ${result.upserted} chunks`);
```

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
  - url: https://sanfrancisco.clickeen.workers.dev
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

## The One-Liner

"Widgets are my wedge. The architecture I'm building to win widgets is a platform that can systematically disrupt email marketing, landing pages, CRMs, and creatives — because incumbents are siloed and legacy, and I'm building the interconnected, AI-native infrastructure they'd have to rebuild from scratch to match."

## The Investment Thesis

**Focused execution. Massive optionality. Structural threat to incumbents.**

1. **Focused Wedge**: Widgets — a $1B+ market where incumbents are lazy and legacy.

2. **Platform Architecture**: AI-native, composable, Cloudflare-powered — applies to email, landing pages, CRMs, creatives.

3. **Why Incumbents Can't Follow**: They're siloed and legacy. To match Clickeen, they'd rebuild from scratch.

4. **The Moat**: AI-native + composable + Cloudflare economics + design-led + PLG.

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

### GitHub Secrets (clickeen repo)

| Secret | Value |
|--------|-------|
| `SANFRANCISCO_URL` | `https://sanfrancisco.clickeen.workers.dev` |
| `PITCH_SERVICE_KEY` | Random 32+ character string |

### Cloudflare Worker Secrets (San Francisco)

| Secret | Value |
|--------|-------|
| `OPENAI_API_KEY` | `sk-...` (for embeddings) |
| `PITCH_SERVICE_KEY` | Same as GitHub secret |

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
| `documentation/strategy/` | ✅ | Vision, moats, scale model |
| `documentation/architecture/` | ✅ | Platform design, current state |
| `documentation/capabilities/` | ✅ | Supernova, SEO/GEO, multitenancy |
| `documentation/ai/` | ✅ | Agent architecture |
| `documentation/services/` | ✅ | System details |
| `documentation/widgets/` | Partial | PRDs yes, CompetitorAnalysis no |
| Screenshots, images | ❌ | Not indexable |

---

## Verification

### Acceptance Criteria

1. **Search works**: `GET /v1/pitch/search?query=what is clickeen` returns relevant chunks
2. **Upsert works**: GitHub Action successfully indexes docs on push
3. **GPT works**: Custom GPT answers questions accurately with sources
4. **Sources cited**: GPT mentions document titles when answering
5. **Honest when unsure**: GPT says "I don't have information" rather than hallucinating

---

## Files to Create

| File | Purpose |
|------|---------|
| `sanfrancisco/src/pitch/search.ts` | Search handler |
| `sanfrancisco/src/pitch/upsert.ts` | Upsert handler |
| `sanfrancisco/src/pitch/embed.ts` | Embedding helper |
| `.github/workflows/index-pitch-docs.yml` | Indexing action |
| `scripts/index-pitch-docs.mjs` | Indexer script |

---

## References

- `documentation/ai/overview.md` — San Francisco architecture
- `documentation/ai/infrastructure.md` — San Francisco operations
- `documentation/strategy/WhyClickeen.md` — Vision and moats

