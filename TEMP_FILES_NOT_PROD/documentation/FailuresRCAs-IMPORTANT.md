STATUS: INFORMATIVE — CONTEXT ONLY
Do NOT implement from this file. For specifications, see:
1) documentation/dbschemacontext.md (DB Truth)
2) documentation/*Critical*/TECHPHASES/Techphases-Phase1Specs.md (Global Contracts)
3) documentation/systems/<System>.md (System PRD, if Phase-1)

> **Note (Dec 2024):** Cursor-era workflow references are historical. The project now uses VS Code + context-aware AIs per ADR-012 (Revised). Keep these RCAs for lessons learned; do not treat them as current process.

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

# Failures & RCAs — Important

## RCA — pnpm Version Conflict in CI (ERR_PNPM_BAD_PM_VERSION)
**Date:** September 11, 2025  
**Summary:** CI failed due to pnpm version specified both in workflow and `package.json`, causing version drift and blocking installs.  
**Impact:** Multiple failed runs, delayed merges, repeated retries.  
**Root Cause:** Duplicate tool version declarations.  
**Resolution:** Single source of truth is `package.json` `packageManager`. Workflows must not pin pnpm. Enforce `--frozen-lockfile`.  
**Prevention:** ADR-004, ADR-005; Playbooks; CI guards to detect drift; copy-on-build for Dieter assets. Mitigations implemented: root `packageManager=pnpm@10.15.1`, `--frozen-lockfile` enforced, no nested lockfiles, Dieter assets copied (no symlinks), SVG normalization + verification, public assets untracked enforcement.

## RCA: P0 — Principal Engineer Scope Drift

**Date:** 2025-09-12  
**Severity:** P0  

### Symptoms
- CI failures and hangs from heredoc prompts (`command not found: #`, endless waiting).
- Rework from updating `SERVICES_INDEX.md` despite it being temporary.
- Repo churn with extra scripts and ops files not part of scope.
- Confusion about roles (GPT vs Cursor).

### Root Cause
- Principal engineer introduced scope drift beyond documentation/.
- Temporary artifacts treated as tracked deliverables.
- Prompts written with heredocs and zsh-incompatible syntax.
- Roles blurred, leading to mixed instructions.

### Corrective Actions
1. ADR 12: enforce scope discipline and role separation.  
2. Generator explicitly marked: outputs are temporary, not tracked.  
3. Prompts standardized to plain bash, no heredocs.  
4. Roles clarified: GPT = principal, Cursor = executor.  

### Preventive Measures
- All future changes must be reflected in ADRs or RCAs.  
- Principal must confirm alignment with documentation before introducing new elements.  
- CI workflows limited to documentation/ scope only.  


---

## RCA: Accidental Introduction of Unscoped Workflows
**Failure:** `supabase-schema-sync.yml` added without approval; nuked dbschemacontext.md.
**Impact:** Lost schema, wasted recovery days.
**Root Causes:** Skipped Techphases; added infra mid-execution.
**Resolution:** Workflow deleted; policy frozen.
**Prevent Recurrence:** No new workflows unless frozen in Techphases.

---

## RCA: Created Guardrail CI / PR Templates
**Failure:** Unapproved PR template + guardrail workflows blocked PRs.
**Impact:** PR failures, wasted effort.
**Root Causes:** Over-engineering; not frozen in scope.
**Resolution:** Deleted templates/workflows.
**Prevent Recurrence:** CEO approval required for all CI/templates.

---

## RCA: Polluting Repo with _reports Directory
**Failure:** `_reports/` dir added to repo.
**Impact:** Confusion about junk files.
**Root Causes:** Debug artifacts committed.
**Resolution:** Deleted `_reports/`.
**Prevent Recurrence:** Forbid debug artifacts in repo.

---

## RCA: Preview Harness CSS Polluted Dieter Package
**Date:** 2025-09-24 · **Severity:** P1
**Symptoms:** Dieter button preview showed every variant in the primary blue styling; icon-only buttons collapsed because layout helpers overrode the component contract.
**Root Cause:** Preview-only selectors (`.button-table`, `.button-row`, etc.) lived under `dieter/components` and loaded with `button.css`, so any consumer of the component inherited docs scaffolding.
**Resolution:** Moved preview scaffolding to `tests/styles/`, loaded it only inside the harness iframe, and added a Playwright check verifying variant backgrounds differ.
**Prevent Recurrence:** Preview chrome stays in `tests/`; component packages ship component CSS only.

---

## RCA: Forgetting to Scrub Oslo Fully
**Failure:** Oslo references remained after “final” scrubs.
**Impact:** Days of repeated patching.
**Root Causes:** Incomplete scans.
**Resolution:** Full repo-wide grep + purge.
**Prevent Recurrence:** One-pass, zero-debate codename scrubs.

---

## RCA: Failure to Respect “CEO Drives” Rule
**Failure:** Pushed verification back to CEO.
**Impact:** Violated project process; wasted CEO cycles.
**Root Causes:** Default LLM behavior; ignored rule.
**Resolution:** Re-aligned: AI executes, CEO reviews.
**Prevent Recurrence:** Never assign execution back to CEO.

---

## RCA: Reintroducing Deleted Patterns
**Failure:** Deleted workflows/templates reappeared.
**Impact:** CEO saw “ghosts”; trust lost.
**Root Causes:** Pattern-following from old runs.
**Resolution:** Re-scrubbed; confirmed in origin/main.
**Prevent Recurrence:** Work only from origin/main.

---

## RCA: Overcomplication of Simple Tasks
**Failure:** Basic deletes wrapped in excessive guardrails.
**Impact:** Complexity, brittleness.
**Root Causes:** Misapplied Critical Rules.
**Resolution:** Simplified prompts.
**Prevent Recurrence:** Keep to Phase-1 boring discipline.

---

## RCA: PR Explosion Instead of Simple Direct Commits
**Failure:** Opened many PRs, caused Vercel overload.
**Impact:** “Deployment rate limited”; failed previews.
**Root Causes:** Misuse of PR flow.
**Resolution:** Switch to main-only commits.
**Prevent Recurrence:** For Phase-1: no PRs, direct main.

---

## RCA: Conflict Mismanagement
**Failure:** Merge conflict punted to CEO.
**Impact:** Stalled merge, delay.
**Root Causes:** Did not default to stable main.
**Resolution:** Keep main version by default.
**Prevent Recurrence:** Always resolve to stable unless CEO says otherwise.

---

## RCA: Inconsistent Use of Repo Sources
**Failure:** Mixed local, repomix, GitHub UI states.
**Impact:** Discrepancies, confusion.
**Root Causes:** No single truth.
**Resolution:** Align to origin/main as truth.
**Prevent Recurrence:** Never mix sources.

---

## RCA: Noise in Communication
**Failure:** Verbose, contradictory explanations.
**Impact:** Wasted CEO time, frustration.
**Root Causes:** Default LLM verbosity.
**Resolution:** Switch to tight Principal Engineer tone.
**Prevent Recurrence:** Keep comms concise, authoritative.

---

## RCA: CI/CD Automation Blocking Development
**Date:** 2025-09-29 · **Severity:** P0  
**Summary:** Documentation referenced CI automation (bundle size checks, PR gates, deployment workflows) that did not exist in Phase-1, confusing engineers and blocking iteration.  
**Root Cause:** Specs documented automated checks (CI-enforced budgets, gated deployments) instead of the manual process actually in use.  
**Resolution:** Removed all CI automation language from Phase-1 docs; budgets remain normative targets verified manually.  
**Prevention:**
- Phase-1 uses manual verification only.
- No automated bundle size enforcement.
- No PR gates or required checks.
- Direct-to-main commits remain allowed.
- Documentation focuses on what to build; deployment process stays manual unless an updated ADR says otherwise.
