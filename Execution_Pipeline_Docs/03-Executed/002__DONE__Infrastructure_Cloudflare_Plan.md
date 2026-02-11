# Infrastructure Plan: Cloudflare-First Architecture

Status: Executed / superseded. Cloudflare-first infrastructure is in place; this doc is historical planning context.
Source of truth: `documentation/` and current infra configs in-repo.

**STATUS: PLANNING — REVIEW BEFORE EXECUTION**  
**Created:** 2024-12-27  
**Decision:** Migrate from Vercel to Cloudflare for production deployment

---

## Executive Summary

Clickeen requires infrastructure that supports:
- 1M+ free users with unlimited widget views
- **Global GA from day one** (not US-only)
- 15+ widget types
- AI-powered editor (SanFrancisco)
- Zero DevOps (AI agents manage ops)

**Recommendation:** Cloudflare + Supabase (Michael) + Cloudflare-native jobs (Queues + Cron Triggers)

**Why not Vercel:** Egress costs at scale ($6,000+/month vs $0)  
**Why not AWS/GCP:** Complexity incompatible with AI-agent ops model

### Global by Default

Cloudflare's edge architecture means global distribution is **automatic, not additional work**:
- Workers run in 300+ locations worldwide
- R2 is globally distributed with zero egress
- No per-region deployment or configuration needed
- **Same cost whether serving 1 country or 50**

Limiting to US-only would require extra geo-blocking code and would cripple the PLG viral loop (widgets are seen globally, viewers become users).

See: `Localization_Global_Strategy.md` for language, invoicing, and content nuances.

---

## Phase 1 (Setup): What’s needed + decisions (detailed)

This is the **foundation**. It is mostly Cloudflare-console work (human steps) plus a small amount of repo wiring so local dev and deploy stay deterministic.

### Decisions to make (and recommended defaults)

1) **DNS control plane**
   - Decision: move `clickeen.com` DNS to Cloudflare nameservers now?
   - Recommendation: **Yes**. This enables clean subdomains + consistent security/caching for everything.

2) **Environment naming**
   - Decision: dev subdomains as `*.dev.clickeen.com` vs `*-dev.clickeen.com`
   - Recommendation: **`*.dev.clickeen.com`** (cleaner; groups naturally).
   - Decision: use generic names (`ai`, `assets`, `api`) vs **system names**
   - Recommendation: **system names** (more character, less scan-noise, aligns with internal architecture docs).
     - Dev: `sanfrancisco.dev`, `tokyo.dev`, `venice.dev`, `paris.dev`, `devstudio.dev`
     - Prod: `sanfrancisco`, `tokyo`, `venice`, `paris` (and `devstudio` can stay dev-only)

3) **Email / MX safety**
   - Decision: do we rely on `@clickeen.com` email right now?
   - If yes: treat DNS cutover as a “do not break email” migration: verify MX/SPF/DKIM/DMARC records import correctly before switching nameservers.

4) **How to serve Tokyo assets from R2**
   - Decision: expose R2 via a direct public bucket/custom domain vs front with a small “assets worker”
   - Recommendation: **assets worker** (more control: caching headers, versioning, auth if needed, consistent URLs even if storage changes).

5) **Jobs system**
   - Decision: Cloudflare-native (Queues + Cron Triggers) for SanFrancisco learning pipeline
   - Recommendation: **Yes** (simpler, fewer vendors; service separation stays clean).

6) **Deployment automation**
   - Decision: deploy via `wrangler deploy` manually vs CI from day one
   - Recommendation: start manual for the first week, then add CI once routes/domains stabilize.

### Concrete setup checklist (dev + prod)

#### A) Cloudflare account hardening (one-time)
- Enable 2FA (TOTP “Mobile App Authentication”).
- Enable billing / pay-as-you-go (Workers/R2/D1 require this for real usage).
- Create a scoped API token for later CI:
  - DNS edit for `clickeen.com`
  - Workers Scripts edit + Tail
  - R2 read/write
  - D1 read/write
  - KV read/write
  - Queues read/write
  - Pages (if using Pages)

#### B) Add the domain to Cloudflare (DNS cutover)
- Add `clickeen.com` as a zone in Cloudflare.
- In Cloudflare DNS, confirm records exist (especially mail records if any).
- In Hostinger, change nameservers to Cloudflare’s nameservers.
- Wait for propagation; verify Cloudflare is authoritative.

#### C) Create the Cloudflare resources (keep dev/prod separated)

**Workers**
- `sanfrancisco-dev` (bind to `sanfrancisco.dev.clickeen.com`)
- `sanfrancisco-prod` (bind to `sanfrancisco.clickeen.com`)
- `venice-dev` (bind to `venice.dev.clickeen.com`)
- `venice-prod` (bind to `venice.clickeen.com`)
- Optional: `tokyo-assets-dev` and `tokyo-assets-prod` as “assets worker” proxies for R2
- `paris-dev` (bind to `paris.dev.clickeen.com`) — Cloudflare Worker (repo: `paris-worker/`)
- Optional later: `paris-prod` (bind to `paris.clickeen.com`)

**R2**
- `tokyo-assets-dev`
- `tokyo-assets-prod`
- (Later) `sanfrancisco-logs-dev`, `sanfrancisco-logs-prod` (raw interaction logs)

**KV (sessions / small hot state)**
- `sanfrancisco_kv_dev`
- `sanfrancisco_kv_prod`

**D1 (learning indexes + prompt versions + example refs)**
- `sanfrancisco_d1_dev`
- `sanfrancisco_d1_prod`

**Queues (async logging / learning ingestion)**
- `sanfrancisco-events-dev`
- `sanfrancisco-events-prod`

**Pages (staging UIs)**
- DevStudio on Pages (dev only), protected by Cloudflare Access:
  - `devstudio.dev.clickeen.com`
- (Later) marketing site + widget pages + dashboard.

#### D) DNS records / subdomain bindings (Cloudflare DNS)
- `sanfrancisco.dev` / `sanfrancisco` → SanFrancisco worker routes
- `venice.dev` / `venice` → Venice worker routes
- `tokyo.dev` / `tokyo` → R2 via tokyo-assets-worker routes (recommended)
- `paris.dev` / `paris` → Paris origin (initially) or Paris worker (later)
- `devstudio.dev` → Pages

#### E) Baseline security + performance defaults (Cloudflare)
- Enforce HTTPS + “Always Use HTTPS”.
- Enable Brotli + HTTP/3.
- Create cache rules for `assets.*` (long cache for versioned assets).
- Protect dev surfaces with Access (DevStudio, and optionally `sanfrancisco.dev`, `paris.dev`).

### Definition of done for Phase 1 (Setup)
- DNS is on Cloudflare and `*.dev.clickeen.com` records are managed in Cloudflare DNS.
- Dev + prod Cloudflare resources exist (even if code isn’t deployed yet).
- You have at least one working dev endpoint in the wild:
  - `https://sanfrancisco.dev.clickeen.com/healthz` (SanFrancisco)
  - `https://tokyo.dev.clickeen.com/healthz` (Tokyo assets worker) or a known file served from R2

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLOUDFLARE                            │
│                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Pages    │  │  Workers  │  │    R2     │  │  Queues  │ │
│  │           │  │           │  │           │  │          │ │
│  │ • Bob     │  │ • Venice  │  │ • Tokyo   │  │ • Jobs   │ │
│  │ • Site    │  │ • Paris   │  │   assets  │  │ • AI     │ │
│  │ • Minibob │  │           │  │           │  │   calls  │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
│                                                             │
│  Zero egress │ Edge-first │ Simple for AI agents           │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
      ┌──────────┐                      ┌──────────┐
      │ Supabase │                      │ AI APIs  │
      │ (Michael)│                      │          │
      │          │                      │ OpenAI   │
      │ Postgres │                      │ Anthropic│
      │ Auth     │                      │ DeepSeek │
      └──────────┘                      └──────────┘
```

---

## System Mapping

| Clickeen System | Cloudflare Service | Notes |
|-----------------|-------------------|-------|
| **Bob** (editor) | Pages | Next.js on Edge |
| **Venice** (embeds) | Workers | SSR at edge, highest volume |
| **Paris** (API) | Workers | Stateless API gateway |
| **Tokyo** (CDN) | R2 | Zero egress, CDN-backed |
| **Site + Minibob** | Pages | Marketing + PLG playground |
| **SanFrancisco** (AI) | Workers + Queues | Orchestrates AI calls |
| **Michael** (DB) | Supabase | External, Postgres + Auth |
| **Background jobs** | Cloudflare Queues + Cron Triggers | Workflows, retries, schedules |

---

## Cost Forecast: 1M Free Users

### Assumptions

| Metric | Value |
|--------|-------|
| Free users (widget instances) | 1,000,000 |
| Countries | 8 |
| Widget types | 15 |
| Avg views per widget/month | 1,000 |
| **Total embed renders/month** | **1 billion** |
| Active editors (10%) | 100,000/month |
| Marketing visitors | 10M/month |

### Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| Cloudflare Workers | 1.2B requests | $585 |
| Cloudflare R2 | 50MB storage, 5TB egress | $5 |
| Cloudflare Pages | Pro | $20 |
| Supabase | Pro + scaling | $150 |
| Cloudflare Queues + Cron Triggers | background jobs | $150 |
| AI APIs (SanFrancisco) | 55k calls | $250 |
| Email (Resend) | 100k/month | $100 |
| **TOTAL** | | **~$1,260/month** |

### Cost Per User

| Metric | Value |
|--------|-------|
| Monthly ops cost | $1,260 |
| Free users | 1,000,000 |
| **Cost per free user** | **$0.00126/month** |

### Comparison: Vercel at Same Scale

| Component | Cloudflare | Vercel |
|-----------|------------|--------|
| Compute | $585 | $480 |
| **Bandwidth** | **$0** | **$6,000** |
| Other | $675 | $675 |
| **TOTAL** | **$1,260** | **$7,155** |

**Cloudflare saves ~$5,900/month** at 1M users.

---

## Unlimited Views Strategy

### The Competitive Advantage

| Platform | Free Tier |
|----------|-----------|
| Elfsight | 1 widget, 200 views/month |
| JEONG | 1 widget, 500 views/month |
| Common Ninja | 1 widget, 1,000 views/month |
| **Clickeen** | **1 widget, UNLIMITED views** |

### Why This Works

| Cost Component | Per View |
|----------------|----------|
| Venice (Workers) | $0.0000005 |
| R2 egress | $0 |
| **Total** | **$0.0000005** |

Even a viral widget with 10M views/month costs only **$5**.

### Free vs Paid Tier

| Free | Paid |
|------|------|
| 1 widget | Multiple widgets |
| Unlimited views | Unlimited views |
| "Made with Clickeen" branding | Remove branding |
| Basic controls | Advanced styling, custom CSS |
| — | AI copilot features |
| — | Priority support |
| 100 submissions/month | Unlimited submissions |

**Monetization via widget count + features, not view limits.**

---

## Scaling Projections

| Users | Views/month | Cloudflare Cost | Vercel Would Be |
|-------|-------------|-----------------|-----------------|
| 100k | 100M | ~$150 | ~$750 |
| 500k | 500M | ~$650 | ~$3,500 |
| 1M | 1B | ~$1,260 | ~$7,155 |
| 5M | 5B | ~$5,500 | ~$35,000 |

---

## AI Agent Operations

Cloudflare is simpler for AI agents to manage:

### Deployment (what agents run)

```bash
# Deploy Venice
cd venice && wrangler deploy

# Deploy Paris  
cd paris && wrangler deploy

# Deploy Bob
cd bob && wrangler pages deploy

# Check status
wrangler tail venice-prod --format=json
```

### Monitoring

```bash
# Logs
wrangler tail <worker-name>

# Analytics
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/analytics" \
  -H "Authorization: Bearer {token}"
```

### Compared to AWS

```bash
# AWS equivalent (what agents would have to figure out)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ...
aws ecs update-service --cluster prod --service venice --force-new-deployment
# + IAM roles + VPC config + security groups + ALB rules + ...
```

---

## Migration Path

### Phase 1: Setup (Week 1)
- [ ] Create Cloudflare account
- [ ] Set up R2 bucket for Tokyo assets
- [ ] Configure custom domain
- [ ] Set up Wrangler CLI

### Phase 2: Tokyo Migration (Week 1-2)
- [ ] Deploy Tokyo assets to R2
- [ ] Configure CDN caching rules
- [ ] Update Bob/Venice to use R2 URLs
- [ ] Verify asset loading

### Phase 3: Venice on Workers (Week 2-3)
- [ ] Adapt Venice for Workers runtime
- [ ] Deploy to Workers
- [ ] Test embed rendering
- [ ] Configure edge caching

### Phase 4: Paris on Workers (Week 3)
- [ ] Adapt Paris for Workers runtime
- [ ] Connect to Supabase
- [ ] Deploy API routes
- [ ] Test all endpoints

### Phase 5: Bob on Pages (Week 3-4)
- [ ] Configure Pages for Next.js
- [ ] Deploy Bob
- [ ] Test editor functionality
- [ ] Verify preview sync

### Phase 6: Site + Minibob (Week 4)
- [ ] Deploy marketing site
- [ ] Deploy Minibob playground
- [ ] Test PLG flow

### Phase 7: Background Jobs (Week 4)
- [ ] Set up Cloudflare Queues + Cron Triggers
- [ ] Wire SanFrancisco job handling (events queue + scheduled jobs)
- [ ] Test AI orchestration

---

## Technical Considerations

### Next.js on Cloudflare

- Use `@cloudflare/next-on-pages` for Pages deployment
- Some Next.js features need adaptation for Edge runtime
- Server components work, some Node.js APIs don't

### Workers Limitations

- 128MB memory limit (sufficient for SSR)
- 30s CPU time limit (sufficient for API calls)
- No persistent filesystem (use R2/KV)

### Supabase Connection

- Use connection pooling (Supabase has this built-in)
- Workers can connect directly to Supabase
- Consider Supabase Edge Functions for DB-heavy operations

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Next.js compatibility issues | Test early; keep a contingency plan (Workers-native) |
| Cold starts | Workers are fast, but test latency |
| Vendor lock-in | R2 is S3-compatible, easy to migrate |
| Supabase scaling | Monitor, can upgrade or add read replicas |
| AI cost spikes | SanFrancisco rate limiting + model routing |

---

## Success Criteria

- [ ] All systems deployed and functional on Cloudflare
- [ ] Latency equal or better than current (Vercel)
- [ ] Monthly cost < $1,500 at 1M users
- [ ] Zero egress costs confirmed
- [ ] AI agents can deploy/monitor without human intervention

---

## Decision Points for Review

1. **Confirm Cloudflare over Vercel** — Egress savings justify migration effort?
2. **Unlimited views strategy** — Approved as competitive differentiator?
3. **Timeline** — 4-week migration realistic?
4. **Jobs primitive** — Cloudflare Queues + Cron Triggers for background jobs?
5. **Next.js adaptation** — Any blockers for Edge runtime?

---

## References

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- next-on-pages: https://github.com/cloudflare/next-on-pages
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
