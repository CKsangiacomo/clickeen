# PRD 086 - DevStudio Local Policy Editor And Product Truth Cleanup

STATUS: EXECUTED

This PRD makes DevStudio's Entitlements Matrix page an honest local admin policy editor.

DevStudio may stay local. That is fine. The rule is simple:

`DevStudio edits local policy files -> git commit -> push main -> Cloudflare deploy -> product uses the new policy`

The problem today is not local editing. The problem is that the page mixes real product truth, read-only inspection, and stale entitlement rows that no live product path appears to enforce.

---

## 1. Product Goal

Clickeen needs one local admin page where we can safely edit product policy values before deploy.

The page must:

- show only real Clickeen product policy
- edit policy values directly
- make read-only sections visually and semantically obvious
- delete stale entitlement rows that are not consumed by live product paths
- keep product mechanics in code
- keep policy values in explicit policy files

The page must not:

- preserve dead product concepts because they are already in the matrix
- imply that read-only AI runtime sections are editable
- create a second AI policy truth
- create a database/admin-service control plane before GA
- hide the commit/push/deploy step
- duplicate policy validation in DevStudio
- introduce policy inheritance, profile aliases, JSON-schema frameworks, or a policy DSL

---

## 2. Surviving Product Truth

DevStudio is a local admin tool, not a runtime service.

It is allowed to edit repo files because Clickeen policy is currently policy-as-code.

The surviving authority split is:

| Concern | Owner |
| --- | --- |
| Account tiers | `packages/ck-policy` |
| SaaS entitlements, flags, limits | `packages/ck-policy/entitlements.matrix.json` |
| AI provider/model catalog | `packages/ck-contracts/src/ai.ts` |
| AI runtime values by tier/agent | `packages/ck-policy` policy file |
| AI grant signing/enforcement | Roma + San Francisco |
| Upload/storage enforcement | Tokyo-worker + Roma display |
| Account/authz capsule | Berlin |
| UI editing of policy values | DevStudio local page |

Code owns mechanics.

DevStudio owns local editing of values.

Cloudflare uses only committed code after git deploy.

---

## 3. Current State

### 3.1 Real Editable Section

The current Entitlements Matrix page edits:

`packages/ck-policy/entitlements.matrix.json`

through DevStudio's local Vite middleware:

- `GET /api/entitlements/matrix`
- `POST /api/entitlements/matrix/cell`

This is correct for flags and limits.

These values are used by product paths after deploy through `@clickeen/ck-policy`.

### 3.2 Real But Read-Only AI Sections

The page also renders AI sections from:

- `packages/ck-contracts/src/ai.ts`
- `packages/ck-policy/src/ai-runtime.ts`

Those sections are currently read-only.

That is honest only if the UI clearly says they are inspectors, not editors.

The current `AI / LLM Access` section is not a pure model catalog. It merges runtime policy across agents and tiers, then displays provider/model access. Execution must split this into honest surfaces:

- model catalog: all known providers/models from `ck-contracts`, read-only
- copilot runtime policy: customer-facing copilot policy by tier, editable
- internal AI jobs: internal job policy by tier, read-only in this PRD

### 3.3 Stale Or Suspect Entitlement Rows

The current entitlement registry/matrix includes rows that may not belong in the product anymore.

Execution must audit each row against live product code and delete stale rows instead of preserving them.

Known active rows from current code inspection:

- `l10n.locales.max`
- `l10n.versions.max`
- `copilot.turns.monthly.max`
- `storage.bytes.max`
- `uploads.size.max`
- `embed.seoGeo.enabled`
- `instances.published.max`

Rows that were initially treated too aggressively as deletion candidates:

- `views.monthly.max`
- `widgets.types.max`
- `items.group.small.max`
- `items.group.medium.max`
- `items.group.large.max`
- `branding.remove`

Correction from execution: missing enforcement is not proof that a plan limit is dead. These are real product limits and must stay visible with explicit enforcement status. If a limit is product truth but enforcement is missing, mark it as an enforcement gap and wire enforcement in a follow-up. Do not delete it.

Follow-up correction: internal artifact rebuild counters are internal ops-control ideas, not clean user-facing SaaS entitlements, and they are not enforced. They were removed from active policy instead of being preserved as product rows.

Rows that remain deletion targets because the owning personalization product surface was removed:

- personalization website depth
- personalization runs
- personalization website crawls

Pre-GA rule: do not keep a row because "we may use it later." Also do not delete a real SaaS plan limit because enforcement is incomplete. Product truth wins; missing enforcement becomes a named gap.

---

## 4. Desired State

The DevStudio page must have four honest sections.

### 4.1 Plan Entitlements

Editable.

Backed by:

`packages/ck-policy/entitlements.matrix.json`

Includes only real product entitlements:

- language limits
- upload size
- account storage
- copilot turns
- published instance limits
- widget type limits
- monthly view limits
- branding removal
- widget item limits
- SEO/GEO embed flag

Each entitlement row must show whether it is enforced now or a product-limit enforcement gap.

### 4.2 AI Model Catalog

Read-only in this PRD.

Backed by:

`packages/ck-contracts/src/ai.ts`

Shows provider/model IDs, product labels, and model availability known by the codebase.

This section is not the place to edit provider integrations.

This section must show the catalog only. It must not mix in per-tier runtime permission as if catalog rows are account entitlements.

### 4.3 Copilot Runtime Policy

Editable in this PRD.

Backed by a policy file under `packages/ck-policy`, not by route-local code.

Target file:

`packages/ck-policy/ai-runtime.matrix.json`

This replaces hardcoded editable values currently inside `packages/ck-policy/src/ai-runtime.ts`.

The JSON must be boring and explicit. No inheritance. No hidden profiles. No `$ref`. No generated policy language. No "default tier" expansion.

Each surviving agent and tier must carry its own explicit runtime value block.

Editable values:

- default provider/model per tier
- allowed provider/model list per tier
- model picker enabled/disabled
- max tokens per call
- max requests per grant
- max turns per thread
- monthly turn ceiling
- timeout
- learning raw sample percent

Only customer-facing copilot rows are editable in DevStudio in this PRD.

Internal job rows may live in the same validated runtime matrix file, but they are displayed read-only by DevStudio in this PRD.

Not editable here:

- agent IDs
- provider integration code
- grant signing
- enforcement behavior
- route ownership
- validation rules

### 4.4 Internal AI Jobs

Read-only in this PRD.

Shows internal jobs separately from customer-facing copilots:

- `widget.instance.translator`
- `website.prague.copy.translator`

This section must not call every agent a copilot.

Customer-facing agents are copilots.

Internal agents are jobs.

Execution must stop filtering the DevStudio AI view to only `executionSurface === "execute"` when rendering the full policy picture. Customer-facing copilots and endpoint/internal jobs must be split into different sections instead of hiding internal jobs.

---

## 5. Execution Plan

Do not move to the next step until the current step is green.

### Step 1 - Audit Current Entitlement Keys

For every key in `packages/ck-policy/entitlements.matrix.json` and `packages/ck-policy/src/registry.ts`:

1. `rg` the key across live product code.
2. Classify it as active, product-limit enforcement gap, stale, or blocked.
3. Active means a live product path reads/enforces/displays it.
4. Product-limit enforcement gap means it is a real SaaS plan limit but the code path is missing/incomplete.
5. Stale means the owning product surface was removed or only historical docs mention it.
6. Blocked means unclear and must be decided before code changes.

Docs, PRDs, markdown plans, and historical execution reports do not make a key active.

Search live code first:

- `berlin/`
- `bob/`
- `roma/`
- `tokyo-worker/`
- `sanfrancisco/`
- `prague/`
- `packages/`

Then update docs only if they describe stale rows as current product truth.

Output: a short table in the execution report.

### Step 2 - Delete Stale Entitlement Keys

Remove stale keys from:

- `packages/ck-policy/entitlements.matrix.json`
- `packages/ck-policy/src/registry.ts`
- DevStudio metadata rendering, if any direct assumptions exist
- docs that describe the row as live product truth

Do not leave inert keys for future features.

Do not delete real product limits because enforcement is missing. Restore/keep those rows and mark the enforcement gap in `packages/ck-policy/src/registry.ts`.

Verification:

- `rg` stale key returns no live code references.
- `pnpm --filter @clickeen/ck-policy exec tsc -p tsconfig.json --noEmit` if package tsconfig exists, otherwise root typecheck.
- `pnpm typecheck`

### Step 3 - Rename DevStudio Sections

Update `admin/src/html/tools/entitlements.html` so the page names match product truth:

- `Entitlements Matrix` -> `Policy Editor`
- `Flags` / `Limits` stay grouped under `Plan Entitlements`
- `AI / LLM Access` -> `AI Model Catalog`
- `AI Runtime Access` -> `Copilot Runtime Policy`
- add a separate `Internal AI Jobs` read-only section

The page copy must say clearly:

- local edits are not live until committed and deployed
- entitlement values are editable
- AI catalog is read-only
- copilot runtime policy values are editable
- internal AI job policy is read-only in this PRD

Verification:

- DevStudio loads locally.
- Page has no ambiguous "AI profile" wording.
- Read-only controls are visibly read-only.

### Step 4 - Move AI Runtime Values To JSON

Create:

`packages/ck-policy/ai-runtime.matrix.json`

Move value data out of `packages/ck-policy/src/ai-runtime.ts` into the JSON file.

Keep TypeScript responsible for:

- validating the JSON
- asserting every tier has runtime policy for every agent
- asserting model IDs exist in the catalog
- deriving UI options
- resolving signed runtime policy
- validating safe local value updates for DevStudio

Do not move validation into DevStudio.

DevStudio edits values by calling `ck-policy` validation/update helpers. Code validates them.

The validation helper must be shared by both runtime import and DevStudio local editing. Do not hand-roll a second validator inside `admin/vite.config.ts`.

The helper boundary is pure:

- `ck-policy` may parse and validate an in-memory runtime matrix object
- `ck-policy` may validate and apply an in-memory proposed value update
- `ck-policy` must not import `fs`
- `ck-policy` must not know DevStudio, Vite, local paths, or file writes
- `admin/vite.config.ts` owns reading and writing local JSON files

Keep the current imperative assertion style. Do not add Zod, JSON Schema, schema generators, or a validation framework for this slice.

Preserve the existing `policyVersionFor` behavior. Moving values to JSON must not change the deterministic policy hash semantics.

Preserve the existing `assertAiRuntimeMatrix` validation intent. After migration, the same direct checks must run against the imported JSON data.

The JSON shape must stay flat:

```json
{
  "v": 1,
  "agents": {
    "cs.widget.copilot.v1": {
      "free": { "...": "explicit values" },
      "tier1": { "...": "explicit values" },
      "tier2": { "...": "explicit values" },
      "tier3": { "...": "explicit values" }
    }
  }
}
```

No inheritance, tier aliases, profile aliases, `$ref`, generated overlays, or generic policy language.

Verification:

- malformed JSON fails fast during policy package import
- unknown agent ID fails fast
- unknown provider/model fails fast
- missing tier fails fast
- runtime policy resolution returns the same policy as before for unchanged values
- DevStudio local update helper rejects invalid values before writing the file

### Step 5 - Make Copilot Runtime Policy Editable

Add local DevStudio API routes for the AI runtime matrix:

- `GET /api/ai-runtime/matrix`
- `POST /api/ai-runtime/matrix/cell`

The editor must allow only value edits, not arbitrary object mutation.

The local API must call shared pure `ck-policy` helpers to validate:

- tier exists
- agent exists
- provider/model exists in catalog
- default model is in allowed models
- numbers are finite or null where allowed
- booleans are booleans
- learning sample percent is `0..100`

Do not duplicate this logic inside the Vite middleware.

DevStudio may have local request-shape validation for HTTP basics, but product policy validation belongs in `ck-policy`.

File I/O stays in `admin/vite.config.ts`.

`ck-policy` must never import Node `fs` or become an admin file-writing library.

Verification:

- edit one harmless value locally
- file changes in git
- reload shows the updated value
- invalid edit returns validation error and does not corrupt the file

### Step 6 - Product Path Verification

Verify the policy still drives live product paths:

- Berlin bootstrap mints entitlements from `resolvePolicy`.
- Roma Assets shows and uses storage/upload entitlements.
- Tokyo-worker enforces upload size and account storage.
- Roma AI uses the copilot turn limit and AI runtime policy.
- San Francisco receives signed model/runtime policy and enforces it.
- Publish route enforces published instance limits.

Commands:

- `pnpm --filter @clickeen/devstudio lint`
- `pnpm --filter @clickeen/devstudio build`
- `pnpm --filter @clickeen/roma build`
- `pnpm --filter @clickeen/sanfrancisco exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @clickeen/tokyo-worker exec tsc -p tsconfig.json --noEmit`
- `pnpm typecheck`

If one command is unavailable because a package lacks that script, record it and run the closest direct `tsc` or build command.

### Step 7 - Remove Misleading AI View Shapes

Delete the current merged per-tier AI access view.

Specifically:

- remove the `aiAccessByTier` union view that merges all agents into one tier-level provider/model list
- replace it with a pure catalog view from `ck-contracts`
- render customer-facing copilot runtime policy separately
- render internal job runtime policy separately
- remove the `executionSurface === "execute"` filter as the only AI visibility gate
- remove any `debug.` agent filter unless an actual live debug agent exists

Why: a tier does not have one universal AI access shape. Each agent/job has its own runtime policy. Merging them creates fake product truth.

Verification:

- DevStudio shows known models without implying all tiers can use them.
- DevStudio shows `cs.widget.copilot.v1` under copilot runtime policy.
- DevStudio shows `widget.instance.translator` and `website.prague.copy.translator` under internal AI jobs.
- No code path builds a union provider/model list across unrelated agents as account truth.

---

## 6. Blast Radius

Expected touched areas:

- `admin/src/html/tools/entitlements.html`
- `admin/src/main.ts`
- `admin/vite.config.ts`
- `packages/ck-policy/entitlements.matrix.json`
- `packages/ck-policy/src/registry.ts`
- `packages/ck-policy/src/ai-runtime.ts`
- new or updated `packages/ck-policy` AI runtime matrix validator/helper module
- new `packages/ck-policy/ai-runtime.matrix.json`
- tests or fixtures if present
- docs only where they currently describe stale rows as live product truth

Expected non-touched areas:

- Berlin auth mechanics
- Roma account bootstrap mechanics
- Tokyo storage layout
- San Francisco provider implementations
- Cloudflare deploy workflows
- Supabase migrations

---

## 7. Deletion Targets

Delete all stale entitlement keys confirmed by Step 1.

Probable deletion targets:

- personalization limits

Not deletion targets:

- monthly views limit
- widget type limit
- item group limits
- branding removal flag

Those are product-limit truth. If enforcement is missing, they must be kept and marked as enforcement gaps.

Execution correction: internal artifact rebuild counters are deletion targets because they are internal mechanics, not product truth.

Sequencing dependency:

- Before deleting the personalization run and website-crawl rows, verify that no surviving `agent.personalization.onboarding.v1`, grant issuer, route, queue consumer, or registry alias still depends on them.
- If such a dependency remains, delete the dead personalization agent/path in this PRD or mark the entitlement row blocked. Do not leave a broken required entitlement.

Do not delete active entitlement keys.

Do not leave registry-only keys.

Do not leave matrix-only keys.

---

## 8. Best-Practice Rationale

This is SaaS-correct because a SaaS plan page must be able to answer:

- what does this tier get?
- what limit blocks this user?
- where is that limit enforced?
- what file changes if we change the limit?
- when does the change become live?

This is Clickeen-correct because AI agents and humans both need policy to be legible.

A local policy editor plus git deploy is clean for pre-GA:

- no premature admin backend
- no hidden database state
- no environment-variable policy drift
- no stale product rows
- no runtime guessing

The boring system is:

`policy files -> typed validators -> signed account/runtime capsules -> product enforcement`

DevStudio edits policy values.

Runtime code enforces policy truth.

Git deploy makes it live.

---

## 9. Definition Of Done

This PRD is done only when:

- DevStudio policy page shows no stale product concepts.
- All displayed entitlement rows are backed by live product paths, explicit product-limit enforcement gaps, or explicitly marked read-only catalog/runtime inspection.
- Entitlement values are editable locally.
- Copilot runtime policy values are editable locally.
- Internal AI job runtime policy is shown read-only, not hidden and not mislabeled as copilot policy.
- AI runtime values live in a validated policy file, not hardcoded as editable value data in TS.
- DevStudio AI runtime edits call shared `ck-policy` validators/update helpers instead of duplicating policy validation.
- `ck-policy` validators are pure and do not import `fs`.
- Existing imperative matrix assertions and deterministic policy hashing are preserved.
- The merged tier-level `aiAccessByTier` AI view is gone.
- No stale entitlement key remains in matrix, registry, docs-as-product-truth, or UI.
- All validations are green.
- A final execution report lists:
  - deleted keys
  - kept keys and why
  - files touched
  - verification commands
  - any intentionally deferred items

---

## 10. Execution Report

Executed on May 7, 2026.

### 10.1 Deleted Entitlement Keys

Deleted because the owning personalization product surface was removed:

- personalization website-depth row
- personalization-runs row
- personalization website-crawls row

Deletion scope:

- removed from `packages/ck-policy/entitlements.matrix.json`
- removed from `packages/ck-policy/src/registry.ts`
- removed from current docs where they were tied to the killed personalization surface

### 10.2 Kept Entitlement Keys

Kept because they are real SaaS product limits. Some are enforced today; some are explicitly marked as enforcement gaps in `ENTITLEMENT_META`.

- `l10n.locales.max` - translated languages the account can add; base language is implied and not counted
- `l10n.versions.max` - account instance l10n version limit
- `branding.remove` - branding removal plan flag
- `embed.seoGeo.enabled` - embed SEO/GEO behavior
- `copilot.turns.monthly.max` - copilot monthly turn policy
- `storage.bytes.max` - account storage limit
- `views.monthly.max` - monthly public embed views limit, enforcement gap
- `instances.published.max` - published instance limit
- `widgets.types.max` - widget types per account limit, enforcement gap
- `uploads.size.max` - per-upload size limit
- `items.group.small.max` - widget item limit group
- `items.group.medium.max` - widget item limit group
- `items.group.large.max` - widget item limit group

### 10.3 Implemented Changes

- DevStudio Entitlements page is now `Policy Editor`.
- Plan policy sections are named `Plan Flags` and `Plan Limits`.
- Plan entitlement rows now show enforcement status and owner so missing enforcement is visible instead of being confused with dead policy.
- AI catalog is read-only and no longer merged with account runtime permission.
- Customer-facing copilot runtime policy is shown separately and editable.
- Internal AI jobs are shown separately and read-only in this PRD.
- Removed the misleading tier-level `aiAccessByTier` union view.
- Removed the speculative `debug.` agent filter.
- AI runtime values moved from TypeScript value constants to `packages/ck-policy/ai-runtime.matrix.json`.
- `ck-policy` keeps the pure validation/update boundary and does not import `fs`.
- DevStudio Vite middleware owns local JSON file reads/writes.
- Existing imperative AI runtime assertions and deterministic policy hashing were preserved.

### 10.4 Verification

Green:

- `node -e` JSON parse for `entitlements.matrix.json` and `ai-runtime.matrix.json`
- stale entitlement key grep outside this PRD and executed history returned no matches
- `pnpm --filter @clickeen/devstudio exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @clickeen/devstudio build`
- `pnpm --filter @clickeen/sanfrancisco exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @clickeen/tokyo-worker exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter @clickeen/devstudio test`
- `pnpm lint`
- `pnpm typecheck`
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm build`

Notes:

- `pnpm --filter @clickeen/devstudio lint` reports that DevStudio has no `lint` script, so root `pnpm lint` and targeted DevStudio TypeScript/build were used.
- The first full workspace build failed because Roma requires explicit `NEXT_PUBLIC_TOKYO_URL`; rerunning with the required Tokyo URL passed.
- DevStudio local API smoke passed:
  - `GET /api/ai-runtime/matrix` returned the three runtime policies.
  - a harmless valid edit persisted.
  - invalid `rawSamplePercent=200` returned 422 and did not corrupt the file.

### 10.5 Deferred Items

- Internal AI job runtime policy remains read-only in DevStudio by design.
- Provider integration code, grant signing, San Francisco enforcement, Berlin auth, Roma bootstrap, Tokyo storage layout, Cloudflare deploy workflows, and Supabase migrations were intentionally untouched.
