# PRD 068 — Pre-GA Architecture Audit Corrections

Status: EXECUTED
Date: 2026-03-13
Owner: Product Dev Team
Priority: P0

Supersession rule:
- PRD 068 supersedes PRD 064, PRD 065, PRD 066, and PRD 067 as the forward-looking execution track.
- PRD 064/065/066/067 remain historical snapshots only.
- Future implementation, review, QA, and audit work should reference PRD 068 and later PRDs only.

Environment contract:
- Read truth: local + cloud-dev
- Write order: local first, then cloud-dev
- Canonical startup: `bash scripts/dev-up.sh`

---

## One-line objective

Take the external architecture audit seriously, verify it against current repo/runtime truth, and fix the real pre-GA security, configuration, enforcement, and verification gaps without reopening the old architectural mistakes closed by PRD 064/065/066/067.

---

## Why this PRD exists

The external audit is useful because it highlights real pre-GA hardening gaps.

It is not fully current and it overstates some items, but the core message is right:

1. Architecture is ahead of operational hardening.
2. Several config/security defaults are still not safe enough for pre-GA.
3. Enforcement and verification are still incomplete in a few important areas.
4. We need one clean correction track instead of reopening old PRDs and re-litigating already-closed architectural decisions.

This PRD is that correction track.

---

## Non-negotiable architectural baseline

PRD 068 does **not** reopen these decisions:

1. `Berlin` remains the canonical product/account truth boundary.
2. `Roma` remains the customer shell.
3. `DevStudio` remains local-only internal toolbench.
4. No fake `operator` role.
5. No global account browser/account shell in `Roma`.
6. No internal/company-plane god-mode stuffed into `Berlin`.

Any correction that pushes against those rules is wrong, even if it looks operationally convenient.

---

## Audit-derived corrections that are confirmed real

The following items are treated as real and in scope for execution:

1. `BERLIN_SESSION_KV` and `USAGE_KV` are bound to the same KV id in `berlin/wrangler.toml`.
2. `Berlin` refresh-token signing still has a default secret fallback.
3. `Bob` and `Roma` still commit live Supabase anon keys in `wrangler.toml`.
4. `production` env blocks still point at dev hosts.
5. Supabase local config still has:
   - pooler disabled
   - `max_rows = 1000`
6. widget compile is still not a CI gate.
7. published instance count cap is not clearly enforced.
8. customer-facing member removal is still missing as a canonical product route.
9. Paris still has auth/error-shape inconsistencies.
10. Paris aftermath still uses `200` warning responses in places where failure/partial-failure semantics need to be explicit.
11. asset usage sync/mirror behavior still contains stale or misleading no-op behavior and must be removed or replaced with explicit truth.

---

## Audit claims that are explicitly not treated as forward work

These are not the forward execution track for PRD 068:

1. DevStudio as a Cloudflare/shared runtime
   - already removed from repo truth
2. zero automated tests
   - false as an absolute statement
   - the real problem is insufficient business-logic coverage
3. dual workspace/account schema as current canonical runtime truth
   - stale or overstated
   - old migrations/history existing in repo is not itself a current architectural blocker
4. email confirmations as a standalone pre-GA patch
   - this is a real future requirement
   - but it belongs in the communications/email-system architecture, not as an isolated toggle inside PRD 068
5. broad test-program work
   - PRD 068 is not a generic testing initiative
   - verification here must stay narrow and tied to the concrete corrections in scope

These items may be mentioned historically, but they do not define this PRD.

---

## Execution phases

### Phase 1 — Security and configuration hardening

Goal: remove the highest-risk pre-GA configuration/security mistakes.

Scope:
1. split `BERLIN_SESSION_KV` and `USAGE_KV` into distinct bindings/ids
2. remove Berlin refresh-secret fallback
3. remove committed live anon keys from Pages config and move to the correct repo/config model
4. stop `production` env blocks from pointing at dev hosts
5. make Supabase config intentional for current pre-GA runtime posture:
   - pooler
   - `max_rows`
   - document that email-confirmation work is deferred to the communications/email system track

Acceptance:
1. no binding/id collision between session and usage KV
2. Berlin refuses to boot without explicit refresh secret where required
3. Pages config no longer commits live environment values that should not live in repo
4. `production` config no longer targets dev hosts
5. Supabase local config is aligned with intended current pre-GA runtime posture and no fake email-confirmation “completion” is claimed from this PRD

### Phase 2 — Runtime enforcement corrections

Goal: make the runtime actually enforce the product/commercial limits it claims to have.

Scope:
1. implement clear published instance count enforcement
2. add the missing straightforward customer-facing member-removal product route
3. normalize Paris auth/error shape
4. replace misleading `200` warning semantics with explicit degraded/failure behavior
5. clean up the stale asset-usage sync/no-op path so the system stops pretending asset usage management exists where it does not

Acceptance:
1. published instance count cap is explicit and enforced
2. member removal exists as a canonical product path
3. Paris auth failures use one explicit error shape
4. aftermath semantics are explicit and no caller can read partial failure as full success
5. no fake asset-usage sync behavior remains in runtime

### Phase 3 — CI and narrow verification hardening

Goal: make the repo reject the specific breakage this PRD is correcting, without turning PRD 068 into a broad testing program.

Scope:
1. wire widget compile into CI
2. add only the minimum targeted automated coverage needed for the corrected routes/logic where a compile gate or typecheck is not enough
3. add narrow verification around the corrected routes and limits

Acceptance:
1. widget compile is a required CI gate
2. the corrected routes/logic have only the targeted coverage needed to stop the specific regressions this PRD is fixing
3. corrected routes are exercised in CI or scripted verification

### Phase 4 — Cloud-dev validation

Goal: prove the corrected system works in the shared runtime.

Scope:
1. deploy the corrected slices to `cloud-dev`
2. verify the corrected auth/config/enforcement behavior in `cloud-dev`
3. update docs to match the new truth immediately

Acceptance:
1. local and cloud-dev agree on the corrected behavior
2. docs match runtime
3. no manual “remember this caveat” gap remains for the corrected areas

---

## Immediate execution order

Do the work in this order:

1. KV binding split
2. Berlin refresh-secret hard fail
3. env/config cleanup
4. Supabase config hardening
5. widget compile CI gate
6. published instance count enforcement
7. member-removal product path
8. Paris auth/error-shape normalization
9. aftermath semantics cleanup
10. asset-usage sync cleanup
11. narrow verification
12. cloud-dev verification

This order is intentional:
- fix the most dangerous config/security mistakes first
- then enforce product/runtime truth
- then close the verification gap

---

## What simple and boring looks like here

This PRD is intentionally not a reinvention.

It is simple because it does not ask for:

1. a new architectural rewrite
2. a new service graph
3. a new control plane model
4. a return to old PRD debates

It asks for straightforward corrections:

1. fix unsafe config
2. remove fake defaults
3. enforce the limits the product already claims to have
4. add the missing obvious product action that should already exist
5. remove fake runtime behavior that teaches the wrong system
6. make CI catch the specific breakage we already know about
7. verify the corrected behavior in `cloud-dev`

That is the boring path, and it is the right path.

---

## Acceptance gates

PRD 068 is done only when all of these are true:

1. no shared session/usage KV binding remains
2. Berlin refresh secret cannot silently fall back
3. Pages/env config is cleaned up
4. Supabase pooler/`max_rows` posture is intentionally set and documented, and email-confirmation work is explicitly deferred to the communications track
5. widget compile is enforced in CI
6. published instance count enforcement exists and is verified
7. canonical member-removal product route exists and is verified
8. Paris auth/error shape is normalized
9. aftermath warning semantics are explicit and documented
10. fake asset-usage sync behavior is gone or explicitly replaced with real truth
11. local and cloud-dev verification both pass for the corrected areas
12. docs match the corrected runtime

---

## Failure conditions

Stop and reassess if execution starts doing any of these:

1. reopening PRD 064/065/066/067 architecture debates
2. reintroducing fake `workspace` or `operator` product concepts
3. using “temporary” default secrets or silent fallbacks
4. adding speculative abstractions instead of fixing the concrete audit findings
5. widening scope into new architecture work before the audit corrections are closed
