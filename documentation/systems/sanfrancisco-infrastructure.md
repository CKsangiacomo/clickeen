# San Francisco Infrastructure

**STATUS: PLANNING — SYSTEM ARCHITECTURE**  
**Created:** 2024-12-27  
**Dependencies:** sanfrancisco.md, sanfrancisco-learning.md, `CurrentlyExecuting/Clickeen_Next/01_TODO_Infrastructure_Cloudflare_Plan.md`

---

## Overview

San Francisco is more than an API. It's a stateful system that:
- Handles agent requests (API)
- Tracks sessions across interactions (State)
- Runs scheduled analysis and updates (Jobs)
- Evolves algorithms over time (Learning)
- Provides admin visibility (Dashboard)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SAN FRANCISCO SYSTEM                           │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐       │
│  │    API    │  │   State   │  │   Jobs    │  │   Admin   │       │
│  │           │  │           │  │           │  │           │       │
│  │ • Agents  │  │ • Sessions│  │ • Crons   │  │ • Review  │       │
│  │ • Routes  │  │ • Context │  │ • Pipes   │  │ • Metrics │       │
│  │ • LLM     │  │ • History │  │ • Analysis│  │ • Config  │       │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘       │
│        │              │              │              │               │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                      │
│                    ┌─────────┴─────────┐                           │
│                    │   Data Layer      │                           │
│                    │                   │                           │
│                    │ D1 + KV + R2      │                           │
│                    └───────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. API Layer (Cloudflare Workers)

Handles all agent requests from Bob, Minibob, Site, etc.

```typescript
// sanfrancisco/src/index.ts (conceptual)
export async function handleExecute(req: ExecuteRequest, env: Env, ctx: ExecutionContext) {
  // 1) Verify grant (signature + expiry + caps + budgets)
  const grant = await verifyGrant(req.grant, env.AI_GRANT_HMAC_SECRET);
  assertCap(grant, `agent:${req.agentId}`);

  // 2) Route to agent handler (single endpoint, many agents)
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const result = await agents[req.agentId].execute({ requestId, grant, input: req.input }, env, ctx);

  // 3) Async log (never blocks response)
  ctx.waitUntil(env.SF_EVENTS.send({ requestId, agentId: req.agentId, startedAt, result }));

  return { requestId, agentId: req.agentId, result, usage: result.usage };
}
```

**Routes:**
```
GET  /healthz                 → service health (no auth)
POST /v1/execute              → all agents (strict grant required)
POST /v1/learning/outcome     → attach outcomes (internal; called by Paris)
```

---

### 2. State Layer

#### Session Storage (Cloudflare KV)

Fast, edge-local storage for active sessions:

```typescript
interface Session {
  id: string;
  agentId: AgentType;
  createdAt: number;
  lastActiveAt: number;
  
  // Conversation history (last N turns)
  history: Turn[];
  
  // Accumulated context
  context: {
    widgetType?: string;
    widgetConfig?: object;
    interactionCount: number;
    opsApplied: number;
    conversionPrompted: boolean;
  };
}

// KV operations
await env.KV.put(`session:${id}`, JSON.stringify(session), {
  expirationTtl: 60 * 60 * 24  // 24 hours
});

const session = await env.KV.get(`session:${id}`, 'json');
```

**Why KV:**
- Fast reads at edge (< 10ms)
- No cold starts
- Automatic expiration
- Simple key-value model

#### Persistent Storage (D1 + R2)

San Francisco owns its learning storage. It does **not** read/write Michael (Supabase).

- **KV**: hot session state (short TTL; used on the request path)
- **R2**: immutable raw payloads (full input/output, traces, outcomes)
- **D1**: queryable indexes + metadata (sessions, interaction rows pointing to R2 keys, prompt versions, example refs)

```sql
-- D1 (SQLite) schema (conceptual; names can change)
CREATE TABLE sf_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  subject_kind TEXT NOT NULL, -- 'anon' | 'user' | 'service'
  subject_id TEXT NOT NULL,
  locale TEXT
);

CREATE TABLE sf_interactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  score REAL
);

CREATE TABLE sf_prompts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sf_examples (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  score REAL NOT NULL,
  tags_json TEXT
);
```

---

### 3. Jobs Layer (Cloudflare Queues + Cron Triggers)

San Francisco uses Cloudflare-native primitives for learning jobs:
- **Queues**: async ingestion of interaction logs (request path enqueues; consumer persists to R2 + indexes in D1)
- **Cron Triggers**: periodic scoring + example bank refresh + prompt improvement suggestions

Minimal Phase‑1 job surface:
- `sanfrancisco-events-*` queue: write payload → R2, write index row → D1 (must never block the request path)

Skeleton (conceptual):
```ts
export default {
  async queue(batch, env, ctx) {
    // persist payloads to R2 and index to D1
  },
  async scheduled(event, env, ctx) {
    // periodic scoring / refresh / analysis
  },
};
```

**Job Schedule Summary:**

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `score-interactions` | Hourly | Calculate quality scores |
| `update-example-banks` | Daily 3AM | Refresh golden examples |
| `analyze-and-improve` | Weekly Sunday | Generate prompt suggestions |
| `cleanup-old-sessions` | Daily 2AM | Remove expired session data |
| `ab-test-evaluation` | Daily 4AM | Check if A/B tests have winner |
| `on-user-converted` | Event | Update outcomes on conversion |
| `on-user-paid` | Event | Update outcomes on payment |
| `on-translation-corrected` | Event | Learn from corrections |

---

### 4. Algorithm Layer

Where learning logic lives. Not a separate service—just well-organized code:

```
sanfrancisco/
├── src/
│   ├── agents/               # Agent implementations (behind /v1/execute)
│   ├── jobs/
│   │   ├── cron.ts           # Cron Triggers (scheduled jobs)
│   │   └── queue.ts          # Queue consumers (async ingestion)
│   ├── learning/
│   │   ├── scoring.ts        # Score calculation per agent
│   │   ├── selection.ts      # Example selection algorithms
│   │   ├── analysis.ts       # Failure pattern analysis
│   │   └── evolution.ts      # Prompt improvement logic
│   ├── lib/
│   │   ├── llm.ts            # LLM client (DeepSeek, Claude)
│   │   ├── d1.ts             # D1 helpers (queryable metadata)
│   │   ├── r2.ts             # R2 helpers (raw payloads)
│   │   ├── kv.ts             # KV session helpers
│   │   └── prompts.ts        # Prompt building utilities
│   └── types/
│       └── index.ts          # Shared types
```

**Scoring Algorithm Example:**

```typescript
// sanfrancisco/src/learning/scoring.ts

export function scoreSDRInteraction(
  interaction: AgentInteraction
): number {
  const { outcomes } = interaction;
  
  let score = 0;
  
  // Technical success (required baseline)
  if (!outcomes.technical?.valid) return 0;
  score += 0.1;
  
  if (outcomes.technical?.applied) score += 0.1;
  
  // Behavioral signals
  if (outcomes.behavioral?.continued) score += 0.2;
  if (outcomes.behavioral?.abandoned) score -= 0.1;
  
  // Business outcomes (high weight)
  if (outcomes.business?.converted) score += 0.4;
  if (outcomes.business?.paid) score += 0.2;
  
  // User feedback (explicit signal)
  if (interaction.quality?.userFeedback === 'helpful') score += 0.1;
  if (interaction.quality?.userFeedback === 'not-helpful') score -= 0.2;
  
  return Math.max(0, Math.min(1, score));  // Clamp 0-1
}

export function scoreEditorInteraction(
  interaction: AgentInteraction
): number {
  // Different weights for editor copilot
  // ...
}

export function scoreTranslation(
  interaction: AgentInteraction
): number {
  // Translation-specific scoring
  // ...
}
```

**Example Selection Algorithm:**

```typescript
// sanfrancisco/src/learning/selection.ts

export function selectDiverseExamples(
  candidates: GoldenExample[],
  count: number
): GoldenExample[] {
  // 1. Cluster by characteristics
  const clusters = clusterByTags(candidates);
  
  // 2. From each cluster, pick top-scoring
  const perCluster = Math.ceil(count / clusters.length);
  
  const selected: GoldenExample[] = [];
  
  for (const cluster of clusters) {
    const topFromCluster = cluster
      .sort((a, b) => b.score - a.score)
      .slice(0, perCluster);
    selected.push(...topFromCluster);
  }
  
  // 3. If we have too many, keep highest scores
  return selected
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

function clusterByTags(examples: GoldenExample[]): GoldenExample[][] {
  // Group by widget type, request type, outcome
  const clusters = new Map<string, GoldenExample[]>();
  
  for (const ex of examples) {
    const key = ex.tags.sort().join('|');
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(ex);
  }
  
  return Array.from(clusters.values());
}
```

---

### 5. Admin Layer (DevStudio Integration)

Part of the existing admin/DevStudio app:

```
admin/src/
├── pages/
│   ├── sanfrancisco/
│   │   ├── overview.tsx       # System health, metrics
│   │   ├── agents/
│   │   │   ├── index.tsx      # List all agents
│   │   │   └── [id].tsx       # Agent detail + config
│   │   ├── interactions/
│   │   │   └── index.tsx      # Browse/search interactions
│   │   ├── examples/
│   │   │   └── index.tsx      # Manage example banks
│   │   ├── prompts/
│   │   │   └── index.tsx      # Prompt versions + A/B tests
│   │   └── review/
│   │       └── index.tsx      # Human review queue
```

**Key Admin Views:**

1. **Overview Dashboard**
   - Success rates per agent
   - Conversion metrics
   - Cost tracking
   - Recent failures

2. **Agent Detail**
   - Current prompt
   - Example bank
   - Performance over time
   - A/B test status

3. **Review Queue**
   - Flagged interactions
   - Suggested improvements
   - Approve/reject/edit

4. **Prompt Editor**
   - Edit system prompts
   - Preview with examples
   - Start A/B test
   - View historical versions

---

## Data Flow

### Request Flow

```
	User types in Minibob
	        │
	        ▼
	┌───────────────────┐
	│ Minibob (Site)    │
	│                   │
	│ POST /v1/execute  │
	│   (agentId:       │
	│    sdr.copilot)   │
	└───────────────────┘
	        │
	        ▼
	┌───────────────────┐
	│ San Francisco Worker │
	│                   │
	│ 1. Get session    │◀──── KV
	│ 2. Get prompt     │◀──── D1
	│ 3. Get examples   │◀──── D1
	│ 4. Call DeepSeek  │◀──── LLM API
	│ 5. Enqueue log    │────▶ Queue → R2 + D1
	│ 6. Update session │────▶ KV
	│                   │
	│ Return response   │
	└───────────────────┘
        │
        ▼
User sees AI response + ops applied
```

### Learning Flow

```
                    ┌─────────────────┐
                    │  Interactions   │
                    │    (logged)     │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │   Hourly    │   │   Events    │   │   Weekly    │
   │   Score     │   │   Update    │   │   Analyze   │
   │   Job       │   │   Outcomes  │   │   Job       │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                  │                  │
          ▼                  ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │  Scored     │   │  Outcomes   │   │  Prompt     │
   │  Interacts  │   │  Updated    │   │  Suggests   │
   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Daily Update   │
                    │  Example Bank   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Better Prompt  │
                    │  + Examples     │
                    └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Next Request   │
                    │  Uses Improved  │
                    │  Context        │
                    └─────────────────┘
```

---

## Deployment

### Cloudflare Workers

```toml
# sanfrancisco/wrangler.toml
name = "sanfrancisco-dev"
main = "src/index.ts"
compatibility_date = "2025-12-28"

[vars]
ENVIRONMENT = "dev"

[[kv_namespaces]]
binding = "SF_KV"
id = "xxx"  # Sessions, cache

[[d1_databases]]
binding = "SF_D1"
database_name = "sanfrancisco_d1_dev"
database_id = "xxx"

[env.prod]
name = "sanfrancisco-prod"
[env.prod.vars]
ENVIRONMENT = "prod"
```

### Queues + Cron Triggers

San Francisco uses Cloudflare-native primitives:
- Queues: async ingestion + background work
- Cron Triggers: scheduled scoring/refresh/analysis (Phase‑2+)

### Environment Variables

```bash
# .env
AI_GRANT_HMAC_SECRET=xxx
DEEPSEEK_API_KEY=xxx
# Future providers are allowed only via explicit grants (no silent switching).
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx
```

---

## Cost Estimate (Monthly)

| Component | Usage | Cost |
|-----------|-------|------|
| Cloudflare Workers | 100M requests | ~$50 |
| Cloudflare KV | 10M reads, 1M writes | ~$5 |
| Cloudflare D1 | indexed metadata | TBD |
| Cloudflare R2 | raw payload storage | TBD |
| Cloudflare Queues + Cron Triggers | background work | TBD |
| DeepSeek API | tokens | TBD |
| Claude API (analysis) | tokens | TBD |
| **Total** | | TBD |

---

## Implementation Phases

### Phase 1: Foundation
- [ ] San Francisco Worker with `POST /v1/execute`
- [ ] KV session management
- [ ] D1 schema + R2 buckets (SanFrancisco-owned)
- [ ] Interaction logging

### Phase 2: Learning Infrastructure
- [ ] Queues + Cron Triggers wiring
- [ ] Scoring algorithms
- [ ] Example bank management
- [ ] Daily update jobs

### Phase 3: Admin Interface
- [ ] DevStudio San Francisco pages
- [ ] Review queue
- [ ] Prompt editor
- [ ] Metrics dashboard

### Phase 4: Automation
- [ ] Failure analysis job
- [ ] Auto-suggested improvements
- [ ] A/B testing framework
- [ ] Outcome tracking webhooks

---

## Open Questions

1. **Session TTL:** 24 hours? Configurable per agent?
2. **Retention policy:** how long to keep raw logs in R2 (per agent / per env)?
3. **Admin auth:** Same as DevStudio? Separate?
4. **Cost monitoring:** Alert when AI spend exceeds threshold?
5. **Backup/export:** How to export learned data for analysis?
