# CRITICAL ERRORS TO NOT REPEAT

1) Adding unapproved workflows/automation
- Do not add GitHub Actions (e.g., schema syncs) or any automation without explicit CEO approval and Techphases freeze.

2) Introducing PR templates / guardrails mid-execution
- No PR templates or guardrail workflows unless frozen in Techphases and approved by CEO.

3) Committing debug artifacts to repo
- No `_reports/`, scratch files, or local audit outputs committed to the repo.

4) Incomplete codename scrubs
- All legacy codenames must be scrubbed in a single pass across **entire repo**, not just docs.

5) Violating “CEO drives, AI executes”
- Do not assign verification back to CEO. AI executes; CEO reviews.

6) Reintroducing patterns that were removed
- Treat `origin/main` as the **only** truth. Do not resurrect deleted files/patterns from old prompts.

7) Overcomplicating simple changes
- Keep prompts boring and minimal. No scaffolding that slows or confuses Phase-1 execution.

8) Opening many PRs instead of committing to main
- For Phase-1: commit to `main` directly (unless CEO says otherwise). Avoid PR sprawl that triggers extra checks.

9) Deferring merge conflict decisions to CEO
- Default to keeping `main` stable unless CEO instructs otherwise. Resolve conflicts decisively.

10) Mixing sources of truth
- Always align to `origin/main`. Do not mix local snapshots, repomix dumps, and UI states inconsistently.

11) Verbose/noisy communication
- Communicate like a Principal Engineer: concise, authoritative, and action-oriented.

---

# ADR-001 Monorepo on pnpm + Turbo

- Decision: single monorepo; pnpm workspaces; Turbo tasks  
- Status: Accepted  
- Consequence: Single root lockfile; installs must run at repo root

# ADR-002 Edge Cache via Atlas

- Decision: Edge KV-backed cache for configs  
- Status: Accepted  
- Consequence: Venice reads from Atlas first; Michael as fallback

# ADR-003 AI Centralization via Copenhagen

- Decision: Single AI gateway (Supabase Edge Functions)  
- Status: Accepted


## ADR-004 — Single Source of Truth for Tool Versions
**Status:** Accepted (September 11, 2025)  
**Context:** CI failed with `ERR_PNPM_BAD_PM_VERSION` due to pnpm version declared both in workflows and `package.json`.  
**Decision:** The **only** source of pnpm version is `package.json` `packageManager`. Workflows MUST NOT specify a pnpm version. All CI installs use `--frozen-lockfile`. Deployable packages pin Node via `"engines": { "node": "20.x" }`. Implemented at repo root: `pnpm@10.15.1`.
**Consequences:** Deterministic builds across local, CI, and Vercel. CI guardrails fail PRs on version drift.  

## ADR-005 — Dieter Assets: Copy-on-Build (No Symlinks)
**Status:** Accepted (September 11, 2025)  
**Context:** Symlinked assets behaved inconsistently across CI/Vercel and broke static caching.  
**Decision:** Dieter builds artifacts to `dieter/dist/`. A build step copies them to `apps/app/public/dieter/`. Symlinks are not supported. Implemented via `scripts/build-dieter.js` and `scripts/copy-dieter-assets.js`; CI guard ensures no tracked files under `apps/app/public/dieter/`.
**Consequences:** CDN-served static assets, predictable builds, no symlink fragility.

## ADR 06: Modular Monolith First

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
Early designs pushed for microservices from day one. This added unnecessary complexity for a team of two engineers.  

### Decision
We adopt a **modular monolith** for Phase 1. Split off embed as the first microservice only when scale demands it.  

### Consequences
- Simpler development and deployment in early phases.  
- Easier debugging and maintenance.  
- Provides a clean path to split services later without premature overhead.  

---

## ADR 07: Embed Loader Size Constraint

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
The embed loader must be lightweight to ensure adoption and reduce performance penalty.  

### Decision
Hard budget: **28 KB (gzipped)** for the embed loader including runtime and widget bootstrap.  

### Consequences
- Forces careful choice of dependencies.  
- Encourages performance discipline.  
- Excludes heavy frameworks or unused libraries.  

---

## ADR 08: Supabase as Primary Backend

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
We need a backend that is fast to adopt and provides auth, RLS, and Postgres compatibility without heavy ops burden.  

### Decision
Use **Supabase** as the primary backend for Phase 1.  

### Consequences
- Accelerates development.  
- Some vendor lock-in, mitigated by Postgres base.  
- Limits scalability at extreme scale but acceptable for Phase 1.  

---

## ADR 09: Vercel for Hosting

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
We need reliable, zero-maintenance hosting and deployment.  

### Decision
Use **Vercel** for hosting all frontend apps and the embed service in Phase 1.  

### Consequences
- Fast iteration with built-in CI/CD.  
- Higher cost at scale but acceptable trade-off for Phase 1.  
- Future option to self-host if margins require.  

---

## ADR 10: Token-Based Auth

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
We need secure, flexible authentication for widgets and services.  

### Decision
Use **JWT tokens with scoped claims** for widget instances and user access.  

### Consequences
- Enforces least-privilege by scoping tokens to resources.  
- Integrates with Supabase easily.  
- Requires careful key rotation and expiration handling.  

---

## ADR 11: Design Tokens with SF Symbols

**Status:** Accepted  
**Date:** 2025-09-11  

### Context
Consistency in design system is critical. We extracted all 6950 SF Symbols into `/tools/sf-symbols/svgs/` and integrated them into Dieter tokens.  

### Decision
Adopt **system UI font stack** and **SF Symbols** as design token base.  

### Consequences
- Ensures consistency across widgets.  
- Zero-maintenance system icon integration.  
- No external dependency on icon libraries.  

## ADR-012 — Edge Config & Workflow Evolution (Revised, Dec 2024)

**Status:** Updated (supersedes prior role separation notes)

### Context
The project no longer uses Cursor. We build in VS Code with context-aware AIs (Codex/Git) that have full repo visibility. PRDs remain the single source of truth.

### Decisions

#### Edge Config Write Model (unchanged)
- **Runtime:** Atlas remains **read-only**.
- **Emergency override:** `INTERNAL_ADMIN_KEY` permits a *gated* runtime write for ops only.
- **Documentation:** This override is an **operations playbook**, not a public API.
- **Long-term:** Move all writes to CI/CD and remove the runtime override.

#### Development Workflow (replaces old “principal/executor” split)
- **Codex/Git AIs:** Implement with full codebase visibility.
- **Claude/GPT:** Review PRDs and cross-doc consistency (not implementation).
- **PRD-driven:** System PRDs + Phase-1 Specs guide all changes.
- **Change Control:** Any new surface or behavior requires an ADR and doc updates in the same PR.

### Consequences
- Eliminates blind-execution errors.
- Faster, safer implementation with context.
- PRDs stay the single source of truth.
- Atlas override remains ops-only; no Paris admin endpoint.

### Implementation Notes
- Remove references to “Cursor” and “principal/executor” from docs.
- Update `CONTEXT.md` to reflect the workflow above.
- Keep Atlas read-only enforcement language in all system PRDs.

---

## ADR: Accidental Introduction of Unscoped Workflows
**Context:** `supabase-schema-sync.yml` added without CEO approval, overwrote handcrafted dbschemacontext.md.
**Decision:** Remove all unapproved workflows; no new workflows without explicit Techphases freeze.
**Consequences:** Data loss, wasted cycles, trust damage.

---

## ADR: Created Guardrail CI / PR Templates
**Context:** Added `.github/pull_request_template.md`, guard-no-oslo.yml, docs-check, Dieter playground deploys.
**Decision:** Delete all guardrail CI/templates. Only CEO-approved templates may exist.
**Consequences:** PR blockage, complexity, wasted time.

---

## ADR: Polluting Repo with _reports Directory
**Context:** Introduced `_reports/` artifacts (repomix status) into repo.
**Decision:** Remove `_reports/` and forbid debug artifacts in repo.
**Consequences:** Repo noise, confusion over source of junk.

---

## ADR: Forgetting to Scrub Oslo Fully
**Context:** Multiple passes needed to remove “Oslo” references.
**Decision:** Enforce one-pass full scans for codenames.
**Consequences:** Days lost, repeated cycles.

---

## ADR: Failure to Respect “CEO Drives” Rule
**Context:** Tasks (verification, UI checks) pushed back to CEO.
**Decision:** AI executes fully; CEO reviews only.
**Consequences:** Violated process, wasted CEO time.

---

## ADR: Reintroducing Deleted Patterns
**Context:** After deletion, workflows/templates reappeared.
**Decision:** Treat origin/main as truth; never reintroduce deleted patterns.
**Consequences:** Confusion, CEO saw items reappear.

---

## ADR: Overcomplication of Simple Tasks
**Context:** Simple deletes/commits wrapped in heavy guardrails.
**Decision:** Keep prompts minimal, Phase-1 aligned.
**Consequences:** Complexity, brittleness.

---

## ADR: PR Explosion Instead of Simple Direct Commits
**Context:** Multiple PRs opened (`chore/final-scrub`, etc.) causing Vercel overload.
**Decision:** Push direct to main for Phase-1; no PR sprawl.
**Consequences:** Vercel rate-limited, failed deploys.

---

## ADR: Conflict Mismanagement
**Context:** Merge conflicts pushed back to CEO.
**Decision:** Default to keeping main stable unless CEO directs otherwise.
**Consequences:** Stalled merges, broken trust.

---

## ADR: Inconsistent Use of Repo Sources
**Context:** Mixed local repo, repomix, and GitHub UI states.
**Decision:** Treat origin/main as single source of truth.
**Consequences:** Discrepancies, wasted cycles.

---

## ADR: Noise in Communication
**Context:** Repeated verbose explanations, contradictions.
**Decision:** Tight, disciplined communication; Principal Engineer tone.
**Consequences:** Time wasted, CEO frustration.
