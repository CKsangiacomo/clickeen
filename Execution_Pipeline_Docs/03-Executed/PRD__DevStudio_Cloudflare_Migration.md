# PRD — DevStudio Cloudflare Migration

Status: MIGRATION COMPLETE through Step 7; post-108 policy extension deferred
Owner: Internal platform (DevStudio)
Date: 2026-06-09 (revised same day after full page-by-page inspection)
Stage: 03-Executed / migration record
Numbering: deliberately unnumbered per product owner — this PRD is not part of the
106 or 108 series. It executes in the window while the 108 D1–D9 decisions are being
ratified and 106F lands, and runs parallel to (never ahead of) the 108 P0 slices.

Decision record:

- 2026-06-09 (Pietro): **in-UI policy editing is kept.** The cloud version ships a
  real write path (§3.5), not a read-only downgrade.
- 2026-06-09 (Pietro): **DevStudio canonical host is `https://devstudio.clickeen.com`,
  not a `*.dev.clickeen.com` surface. Auth is Berlin/Google using the existing
  Clickeen admin account. Cloudflare Access is not the DevStudio auth boundary.**
- 2026-06-10 (Pietro): **108 is not a blocker for DevStudio migration closure.**
  The Cloudflare migration is complete through Step 7. The former Step 8 policy-page
  extension is post-migration follow-up after 108A-1 owns the new AI routing,
  capability, conformance, and schema truth.

Related:

- `documentation/services/devstudio.md` (current truth — contains drift this PRD fixes)
- `documentation/architecture/Overview.md` (system map and domain table)
- `documentation/architecture/CloudflarePagesCloudDevChecklist.md` (Pages deploy contract)
- `Execution_Pipeline_Docs/01-Planning/108__REVIEW__Peer_Review_And_Execution_Augmentation.md`
  (sequencing decision recorded in Part VI; Policy-console coupling to 108A-1)
- `packages/ck-policy/` (`entitlements.matrix.json`, `ai-runtime.matrix.json`,
  `applyAiRuntimeMatrixCellUpdate`, `assertAiRuntimeMatrix`, `ENTITLEMENT_META`)

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- If existing code contradicts this PRD's intended architecture, delete it, fence
  it, or stop; do not preserve it and work around it.

## Authority

| Concern                                        | Authority                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| DevStudio product boundary (what it is/is not) | `documentation/services/devstudio.md` tenets, carried over unchanged                  |
| Pages deploy mechanics                         | `CloudflarePagesCloudDevChecklist.md`                                                 |
| Policy/AI matrix schemas and validation        | `packages/ck-policy` for today's matrices; 108A-1 owns future AI routing/capability/conformance schema truth |
| Local-emulation teardown execution             | **Not this PRD** — this PRD produces the ledger; teardown is a separate follow-up PRD |

---

## 1. Why (product truth)

DevStudio is Clickeen's internal toolbench. Today it is a local-only Vite app on the
owner's machine (`localhost:5173`). Three reasons it must move to Cloudflare:

1. **Verification truth.** Internal verification currently points at the local
   emulation plane (miniflare queues with isolated state, a local Tokyo CDN stub,
   generated local keys). The repo's own debugging-order rule says truth is runtime
   code + deployed Cloudflare config; local state is a third, fake truth. Cloud
   DevStudio observes the same R2, bindings, and edge runtime that serve customers.
2. **AI-operability.** Clickeen's operating thesis is 1 human + AI workforce. A
   toolbench reachable only from one human's laptop is structurally invisible to
   cloud coding agents, CI, scheduled routines, and future workforce agents. Moving
   it behind Berlin/Google login on the canonical internal domain makes the
   internal surface agent-reachable through the same product identity system —
   including policy edits, which become reviewable commits instead of silent local
   disk writes.
3. **It unblocks the local-emulation teardown.** DevStudio-on-localhost is the anchor
   tenant of the local fake-Cloudflare stack (`scripts/dev-up.sh` — 502 lines,
   `[env.local]` forks in three wrangler.tomls, the Tokyo local CDN stub, `.dev.vars`
   key generation, `Logs/`, `.wrangler/state`). Migrating DevStudio removes the last
   surface that _requires_ that plane to exist. The teardown itself is a follow-up
   PRD fed by the ledger this PRD produces (Step 7).

Scope in one sentence: lift the design-system showcase as-is, keep the Policy Editor
**including its editing capability** by giving it a cloud write path (§3.5), delete
the dead weight found during review, and stop the migration there. The 108A-1-gated
Policy extension is a later DevStudio update, not a migration blocker.

## 2. What DevStudio actually is today (verified page-by-page, 2026-06-09)

### 2.1 The mechanism

All pages are HTML fragments under `admin/src/html/`, compiled into the JS bundle at
build time (`import.meta.glob` raw). On navigation, `main.ts` injects the fragment
and runs three passes: icon hydration (`data-icon` → inline SVG from Dieter's icon
set), inline `<script>` re-execution, and Dieter component hydration (real component
JS attaches to previews). There is no server runtime — **except** the policy API that
`vite.config.ts` implements as dev-server middleware (§2.3).

### 2.2 Page inventory

| Group                                                              | Content                                                                                                                                                                                                                                                                                                                                                                                                           | Mechanism                                                                                                                                                                                                                      | Verdict                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Dieter Components (20 pages)                                       | Live variant galleries with spec labels. **Interactive** (hydrators wired): textfield, valuefield, choice-tiles, segmented, tabs, menuactions, popaddlink, dropdown-actions/-border/-edit/-fill/-shadow/-upload (fill/upload use a stubbed assets client; uploads deliberately error in showcase). **Static previews** (no hydrator wired): button, toggle, slider, popover, object-manager, repeater, bulk-edit. | Hand-authored HTML; sizes 46–1,594 lines                                                                                                                                                                                       | **Carry (A1)**                    |
| Foundations → Colors                                               | Chip grid of every color token; light/dark derived steps via `data-theme` CSS                                                                                                                                                                                                                                                                                                                                     | Hand-authored static (992 lines)                                                                                                                                                                                               | **Carry (A1)**                    |
| Foundations → Typography                                           | Every type role with sample text + specs                                                                                                                                                                                                                                                                                                                                                                          | 23-line shell filled at runtime from `admin/src/data/typography.ts`                                                                                                                                                            | **Carry (A1)**                    |
| Foundations → Icons                                                | Grid of the full icon set                                                                                                                                                                                                                                                                                                                                                                                         | Build-generated, committed (8,941 lines); regeneration lives in the Dieter build                                                                                                                                               | **Carry (A1)**                    |
| Tools → Entitlements (**"Policy Editor"**)                         | A real **editor**, not a viewer: tier × entitlement table with live inputs (flags toggle, limits edit, copilot default-model cells edit; system agents display-only)                                                                                                                                                                                                                                              | Page fetches `/api/entitlements/matrix` and `/api/ai-runtime/matrix`; each edit POSTs a cell update; **the Vite dev server writes the JSON back to `packages/ck-policy/*.json` on local disk** (vite.config.ts:48,212,245,312) | **Carry + cloud write path (A4)** |
| Tools → Bob UI Native                                              | 3-line stub + `BobNativeCatalog.ts` (139 lines) rendering a one-item catalog (`tdheader` is `.tsx`, never matched by the html glob)                                                                                                                                                                                                                                                                               | Husk                                                                                                                                                                                                                           | **Delete (A2)**                   |
| (code) dead `'dieter'` folder branch in `admin/src/data/routes.ts` | Handles a folder that does not exist; never renders                                                                                                                                                                                                                                                                                                                                                               | Dead code                                                                                                                                                                                                                      | **Delete (A2)**                   |
| (code) dead API lanes in `vite.config.ts`                          | `/api/themes/list`, `/api/themes/update`, `/api/rebuild-icons` — **no consumer in `admin/src`**                                                                                                                                                                                                                                                                                                                   | Dead middleware                                                                                                                                                                                                                | **Delete (A2)**                   |

Known doc drift fixed by this PRD: `documentation/services/devstudio.md` lists
Bob UI Native as a current tool (it is a husk) and describes the local-only model.

Note: `bob/bob_native_ui/` itself is real Bob code (`ToolDrawer.tsx` imports
`TdHeader`). It stays with Bob, untouched.

### 2.3 The policy write path today (the part that cannot lift as-is)

`admin/vite.config.ts` (645 lines) doubles as a local API server:

| Endpoint                              | Method | Behavior today                                                                      |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `/api/entitlements/matrix`            | GET    | Read `packages/ck-policy/entitlements.matrix.json` from disk                        |
| `/api/entitlements/matrix/cell`       | POST   | Validate + write the updated matrix back to disk                                    |
| `/api/ai-runtime/matrix`              | GET    | Read `ai-runtime.matrix.json` from disk                                             |
| `/api/ai-runtime/matrix/cell`         | POST   | Apply via `applyAiRuntimeMatrixCellUpdate` + `assertAiRuntimeMatrix`, write to disk |
| `/api/themes/*`, `/api/rebuild-icons` | —      | Dead (no consumers) — delete                                                        |

A Pages deployment has no disk and no Vite middleware, so §3.5 replaces this
mechanism while keeping the page's fetch contract intact.

## 3. Target shape

### 3.1 Information architecture (three sections)

```text
Foundations          Colors, Typography, Icons
Dieter Components    the 20 showcase pages
Policy               the Policy Editor (entitlements + AI runtime, editable
                     per today's editability rules) +
                     [post-108A-1 extension] routing tables, capability
                     registry, conformance status (read-only views)
```

The showcase sections are static/bundle-rendered. The Policy section is backed by
the cloud write path (§3.5): reads always reflect current `main`; edits become
commits.

### 3.2 Domains and auth

| Environment        | Domain                   | Notes                                                                                            |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------ |
| Canonical internal | `devstudio.clickeen.com` | Ships in this PRD. This is the only canonical DevStudio URL.                                     |
| Fallback           | Pages default host       | Non-canonical, must redirect or be blocked unless required for Cloudflare project health checks. |

Auth model (the named boundary):

- **Berlin/Google login is the sole authentication.** DevStudio uses the existing
  Berlin session model and the same product account identity as Roma.
- The authorized account is the existing Clickeen/admin account. DevStudio must
  validate the Berlin session and account bootstrap/authz context server-side; an
  authenticated user outside the Clickeen admin account is not authorized.
- DevStudio does not invent its own users, allowlist, Access role, account model,
  or product-session bypass.
- DevStudio may set host-scoped Berlin session cookies for `devstudio.clickeen.com`
  through its own finish route. Sharing Roma cookies is not required and must not
  be assumed.
- The policy API (§3.5) independently verifies the Berlin session/account context
  on every request — the write path is not reachable by a static bundle load,
  unauthenticated request, or non-admin account.

### 3.3 Tenets carried over unchanged (hosting changes, boundary does not)

- Not Roma 2; not a customer account shell; no second account model.
- Not a superadmin portal; `CLICKEEN` remains a normal account coordinate, never a
  bypass.
- The removed widget-authoring workspace stays removed; no hidden API lanes
  reintroduce it (106 umbrella rule).
- Future company-plane actions (moderation, commercial overrides, support authority)
  still belong to a separate internal control plane, not to DevStudio.

### 3.4 Build/deploy

Cloudflare Pages **Git build only**, per the Pages deploy contract (workflows verify;
they do not deploy). The existing Vite build is kept for the app bundle — replacing
the toolchain is not a goal. The policy API moves out of `vite.config.ts` into Pages
Functions on the same project (§3.5). Repo hygiene that falls out regardless:
committed `admin/dist/` removed; jsdom shims removed if the lift makes them dead.

### 3.5 Policy write path (cloud) — the one new build in this PRD

Decision (Pietro, 2026-06-09): in-UI policy editing is kept. Design:

- **Surface:** Pages Functions on the DevStudio project, serving the **same four
  routes the page already calls** (`/api/entitlements/matrix` GET,
  `/api/entitlements/matrix/cell` POST, `/api/ai-runtime/matrix` GET,
  `/api/ai-runtime/matrix/cell` POST). The page's fetch contract does not change;
  the page itself ports with minimal diff.
- **Backend:** the GitHub repository is the storage. GET reads the matrix file from
  current `main` via the GitHub contents API (so the editor always shows the latest
  committed state, not the build snapshot). POST applies the cell update **using the
  same `ck-policy` validators the local middleware uses today**
  (`applyAiRuntimeMatrixCellUpdate`, `assertAiRuntimeMatrix`, `ENTITLEMENT_META`
  checks) and commits the updated file to `main` with a descriptive message, e.g.
  `policy(devstudio): copilot.turns.monthly.max tier2 300 -> 500`.
- **Why commit-to-main, not PR:** pre-GA, single operator, Berlin-auth-gated — this is
  the cloud equivalent of today's trust level (local disk write + manual commit),
  with a strict improvement: every edit is now an attributed, revertable commit.
  PR-based review mode is named future hardening, not v1.
- **Concurrency:** GitHub contents-API sha is the optimistic lock. On sha mismatch,
  the Function refetches and returns a typed conflict; the page refetches and the
  user retries. No silent merge.
- **Auth:** Berlin access/refresh session is resolved in the Function, then
  Berlin bootstrap/account authz is verified for the Clickeen admin account. The
  GitHub token is a Pages secret scoped to this repo. No token, path, or repo
  coordinates in client code.
- **Failure rule:** invalid updates are rejected typed (422 + reason) with **no
  commit**; upstream GitHub failures return typed errors; the page never silently
  loses an edit (it refetches after every save, as it already does today).
- **Editability scope is unchanged from today:** entitlement flags/limits editable;
  copilot AI-runtime rows editable; system agents display-only. The post-108 views
  (routing/capabilities) are **read-only** — extending editing to them is out of
  scope until decided after 108A-1.
- **Side effect, accepted:** each policy commit to `main` triggers a DevStudio
  redeploy (Pages Git build). Pre-GA this is acceptable and even desirable — policy
  state and deployed state cannot drift.

Known coupling: the AI-runtime _editor_ edits today's matrix schema, which 108A-1
rewrites. The editor ports as-is now (it must keep working through the migration)
and is **adapted in the post-108 follow-up** together with the new read-only views. Build-once does
not apply here because the editor already exists and is in use.

### 3.6 Design freeze (binding, product-owner mandate)

The visual design of every page — layout, spacing, typography, colors, table
styles, chip grids, spec labels, the docs shell itself — is **frozen**. This
migration changes where pages run, never how they look. Executing agents must not
"improve," modernize, normalize, or restyle anything, regardless of how reasonable
the improvement looks.

Mechanical enforcement:

- **A1 pages are hash-frozen.** The HTML fragment files and all CSS they depend on
  (shell CSS, page-scoped `<style>` blocks, Dieter CSS resolution) move
  byte-identical. Evidence: `git hash-object` of each fragment pre/post migration
  matches; any file whose hash changes fails the step.
- **The Policy Editor file is hash-frozen too.** Its fetch routes are unchanged by
  design (§3.5), so `entitlements.html` requires zero edits. If execution discovers
  a genuinely unavoidable diff, it must be enumerated line-by-line in the step PR
  and approved by the product owner before merge — not committed and explained
  after.
- **The shell changes exactly two things:** nav group titles/order (`tools` retired,
  `Policy` added) and the entitlements route. No CSS, class, spacing, or markup
  changes beyond those two.
- **Post-108 new views (routing/capabilities) invent nothing visually.** They compose
  the existing `entitlements-table` styles and Dieter tokens verbatim. Zero new
  color values, font sizes, spacing values, border treatments, or component
  patterns. If a new view genuinely needs a style that does not exist, that style
  is a named blocker for product-owner approval — not an agent decision.
- **No styling dependencies.** No CSS frameworks, resets, utility libraries, or
  design-token additions enter `admin/` in this PRD.

## 4. Relationship to PRD 108 (sequencing contract)

- This PRD executes **now**, in the window while 108's D1–D9 decisions are ratified
  and 106F lands. It must not delay 108A-1/108B-1; if contention arises, 108 P0 wins.
- 108 is **not** a blocker for DevStudio Cloudflare migration completion. Migration
  closure is Steps 0-7: cloud host, Berlin auth, route contract, policy read/write
  path, local DevStudio decommission, docs sync, and teardown ledger.
- 108A-1 is the authority for the future AI routing/capability/conformance schema.
  DevStudio must not invent that schema or duplicate its logic.
- The former Step 8 is therefore reclassified as a **post-migration follow-up**:
  update the DevStudio Policy section after 108A-1 is green, using 108's surviving
  authority and existing DevStudio/Dieter visual patterns.

## 5. Steps

| Step | Action                                                                                                                                                                                                                                                                                                                                                      | Completion evidence                                                                                                                                                                                                                                                                                                                                                                          | NOT_ALLOWED                                                                                                                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0    | Product owner ratifies: canonical domain `devstudio.clickeen.com`, Berlin/Google auth with the existing Clickeen admin account, host-scoped DevStudio cookies, and the write-path design (§3.5 — **ratified 2026-06-09**: commit-to-main, Berlin-session/account-verified, ck-policy validators reused).                                                    | This PRD updated with the decision record.                                                                                                                                                                                                                                                                                                                                                   | Starting Step 1 with the old Access/dev-subdomain model.                                                                                                                                     |
| 1    | Create the Pages project (Git build) for `admin/`; wire `devstudio.clickeen.com`; configure Berlin login/finish for DevStudio; block or redirect the Pages fallback.                                                                                                                                                                                        | Unauthenticated request → Berlin login flow; authenticated Clickeen admin account → app; authenticated non-admin account → forbidden; fallback host blocked/redirected.                                                                                                                                                                                                                      | Public exposure window; deploying via GitHub Actions; any non-Berlin auth boundary; `devstudio.dev.clickeen.com` as canonical.                                                               |
| 2    | Execute the page-by-page contract in **Appendix A**: carry the 24 surviving pages, regroup nav to three sections, move the Policy Editor to `#/policy/entitlements`. Delete the husk and dead code: `bob-ui-native.html`, `BobNativeCatalog.ts`, the dead `'dieter'` routes branch. Remove committed `admin/dist/`.                                         | Appendix A checklist fully ticked; **design-freeze hash check (§3.6): `git hash-object` of all 24 carried HTML fragments + shell/page CSS matches pre-migration**; cloud nav shows exactly three sections; `rg "BobNativeCatalog                                                                                                                                                             | bob-ui-native"`→ 0 in`admin/`; lint/typecheck green.                                                                                                                                         | Renaming/redesigning showcase content; **any layout/style/color/markup change to carried pages or shell CSS (§3.6)**; adding pages not in Appendix A; touching `bob/bob_native_ui/`. |
| 3    | Verify the showcase sections and the Policy Editor's **read** lane on `devstudio.clickeen.com` (matrices render from `main`; tiers/limits/flags/AI-runtime values correct).                                                                                                                                                                                 | Screenshot set; spot-check of three entitlement values against `entitlements.matrix.json`.                                                                                                                                                                                                                                                                                                   | Wiring writes in this step (that is Step 4).                                                                                                                                                 |
| 4    | Build the **cloud write path** (§3.5): Pages Functions for the four routes; GitHub contents-API backend with sha conflict handling; `ck-policy` validators reused; Berlin session/account verification; typed failures. Page fetch contract unchanged.                                                                                                      | On `devstudio.clickeen.com`: edit a flag → commit appears on `main` with correct diff and message → page refetch shows the new value. Invalid edit → typed 422, **no commit**. Stale sha → typed conflict. Unauthenticated/cross-origin POST → blocked. Non-admin account → 403. **`entitlements.html` hash unchanged (§3.6), or its diff enumerated and product-owner-approved pre-merge.** | Client-side GitHub tokens; bypassing ck-policy validators; silent retries/merges; widening editability beyond today's rules; **any visual change to the editor (§3.6)**.                     |
| 5    | Docs sync: rewrite `documentation/services/devstudio.md` (cloud model, three-section IA, Berlin auth boundary, cookie rule, write-path description, removed-husk note); update the `Overview.md` system map row (DevStudio: Local Vite → Cloudflare Pages, internal Berlin-authenticated).                                                                  | Docs diff in the same PR as Steps 2–4 code.                                                                                                                                                                                                                                                                                                                                                  | Deferring docs; leaving the husk listed as a tool.                                                                                                                                           |
| 6    | Decommission local DevStudio: remove it from `scripts/dev-up.sh` and local workflow docs; delete the entire policy/themes/rebuild-icons middleware from `vite.config.ts` (superseded by Step 4; themes/rebuild-icons lanes are dead today).                                                                                                                 | dev-up diff; `rg "api/entitlements                                                                                                                                                                                                                                                                                                                                                           | api/ai-runtime                                                                                                                                                                               | api/themes                                                                                                                                                                           | rebuild-icons" admin/vite.config.ts`→ 0;`rg "5173"` in scripts/docs → 0 (excluding historical PRDs). | Tearing down any non-DevStudio local infrastructure in this step. |
| 7    | Produce the **local-emulation teardown ledger** as a planning artifact for a follow-up PRD: enumerate `scripts/dev-up.sh`, `[env.local]` forks (berlin/tokyo-worker/sanfrancisco wrangler.tomls), the Tokyo local CDN stub, `.dev.vars` + `generate-berlin-keys.mjs`, `Logs/`, `.wrangler/state` — each with a delete/keep/fence proposal and blast radius. | Ledger document committed to `01-Planning`.                                                                                                                                                                                                                                                                                                                                                  | Executing any teardown item inside this PRD.                                                                                                                                                 |
| Follow-up | After 108A-1 is green, extend the Policy section: read-only routing tables and capability/conformance views from the post-108A-1 schema; adapt the AI-runtime **editor** to the new schema (routing-table cells per D8 editability rules, if 108A-1's D8 decision allows; otherwise display-only). | Views render the new schema; one conformance-status value spot-checked against its report file; editor round-trip green against the new schema; **new views use only existing `entitlements-table` styles + Dieter tokens — `rg` for new hex/rgb/oklch literals in `admin/` → 0 (§3.6)**. | Treating this as a blocker for migration closure; starting before 108A-1 is green; inventing editability rules not decided in D8; duplicating plane logic in the viewer; **any new visual style without named product-owner approval (§3.6)**. |

## 6. Out of scope

- Any teardown execution of the local emulation plane (Step 7 produces the ledger;
  a follow-up PRD executes it).
- PR-based review mode for policy edits (named future hardening; v1 is
  commit-to-main per §3.5).
- Editing affordances on the post-108 routing/capability views beyond what D8 decides.
- Widget verification or QA surfaces (106-series QA belongs to product surfaces and
  the Playwright harness, not DevStudio).
- Workforce-agent review UI (future, 108C-era; cloud DevStudio is the candidate host
  — one forward note, no build).
- Hydrating the seven static-preview component pages (button, toggle, slider,
  popover, object-manager, repeater, bulk-edit) — nice-to-have, separate change.
- Curation tooling, account switching, product-session integration, any backend
  beyond the §3.5 Pages Functions.
- Toolchain replacement (Vite stays for the bundle).
- A `devstudio.dev.clickeen.com` deployment.

## 7. Acceptance criteria

- `devstudio.clickeen.com` serves the three-section app behind Berlin/Google auth;
  the Pages fallback is blocked or redirects to the canonical host.
- The app sets/reads only the Berlin session cookies needed for DevStudio and the
  policy/write APIs verify the Berlin session plus Clickeen admin account context.
- Policy Editor read lane reflects current `main`; write lane produces attributed
  commits with ck-policy validation; invalid edits produce typed failures and no
  commit; sha conflicts surface typed.
- Husk + dead code + dead API lanes deleted with `rg` guards green; `admin/dist/`
  no longer committed.
- Local DevStudio is no longer started, documented, or required by `dev-up.sh`;
  the vite.config.ts middleware is gone.
- `devstudio.md` and `Overview.md` match shipped reality in the same PR as the code.
- **Design freeze holds (§3.6): every carried page and CSS file is hash-identical to
  its pre-migration source; the shell diff is exactly the two permitted changes; no
  new color/style literals or styling dependencies entered `admin/`.**
- Teardown ledger exists with per-item delete/keep/fence proposals.
- Post-108A-1 Policy section work is excluded from migration acceptance. It is a
  follow-up DevStudio update after 108A-1 defines the new schema authority.

## 8. Planning review (per pipeline README)

1. **Elegant engineering, scales?** Yes — a static lift plus one small, well-fenced
   write path that reuses the existing page contract and the existing ck-policy
   validators; storage is the repo itself, so no new state authority is invented.
2. **Compliant with architecture/tenets?** Yes — the DevStudio boundary tenets move
   unchanged; Berlin/Google is the sole identity gate; Pages Git build follows the
   deploy contract; policy edits become reviewable commits (an improvement over
   silent local disk writes).
3. **Avoids over-architecture?** Yes — the review shrank this PRD twice (husk
   deleted, future sections cut); the write path is commit-to-main v1 with PR-mode
   explicitly deferred; the 108-coupled work is a post-migration follow-up so it is
   built once against 108's surviving authority.
4. **Moves toward intended architecture?** Yes — agent-reachable internal surface
   (the company thesis), policy changes as attributed commits, and the local
   emulation plane unblocked for teardown (the 10x simplification), while feeding
   108 an observation deck for the AI plane rebuild.

---

## Appendix A — Page-by-page execution contract

Every page DevStudio serves today, one row each. Step 2 is green only when every row
is ticked. No page may ship that is not in this table.

### Contracts

- **A1 (byte-identical lift):** same HTML source file from `admin/src/html/...`, same
  docs shell/renderer, same hash route, same CSS resolution and hydration behavior
  (interactive pages stay interactive; static-preview pages stay static). Evidence
  per page: route loads on `devstudio.clickeen.com`, renders without console errors, spot visual
  parity vs local.
- **A2 (delete):** file/code removed; `rg` guard green; route 404s into the shell's
  default redirect (first nav item).
- **A4 (editor with cloud write path):** same page renderer and editability rules as
  today; fetch contract unchanged; backend swapped from Vite-middleware-disk-writes
  to the §3.5 Pages Functions. Evidence: Step 3 (read) + Step 4 (write) gates.

### Section: Dieter Components — 20 pages, all contract A1, route `#/dieter/{slug}`

| Page             | Current source                                                                          | Hydration today | Contract |
| ---------------- | --------------------------------------------------------------------------------------- | --------------- | -------- |
| Button           | `html/components/button.html` (1,081 ln — every variant/size/icon combo)                | static preview  | A1       |
| Toggle           | `html/components/toggle.html`                                                           | static preview  | A1       |
| Textfield        | `html/components/textfield.html`                                                        | interactive     | A1       |
| Valuefield       | `html/components/valuefield.html`                                                       | interactive     | A1       |
| Slider           | `html/components/slider.html`                                                           | static preview  | A1       |
| Segmented        | `html/components/segmented.html`                                                        | interactive     | A1       |
| Tabs             | `html/components/tabs.html`                                                             | interactive     | A1       |
| Choice Tiles     | `html/components/choice-tiles.html`                                                     | interactive     | A1       |
| Dropdown Actions | `html/components/dropdown-actions.html`                                                 | interactive     | A1       |
| Dropdown Border  | `html/components/dropdown-border.html`                                                  | interactive     | A1       |
| Dropdown Edit    | `html/components/dropdown-edit.html`                                                    | interactive     | A1       |
| Dropdown Fill    | `html/components/dropdown-fill.html` (1,594 ln — largest; stubbed assets client)        | interactive     | A1       |
| Dropdown Shadow  | `html/components/dropdown-shadow.html`                                                  | interactive     | A1       |
| Dropdown Upload  | `html/components/dropdown-upload.html` (stubbed assets client; uploads error by design) | interactive     | A1       |
| Menu Actions     | `html/components/menuactions.html`                                                      | interactive     | A1       |
| Popover          | `html/components/popover.html` (46 ln — smallest)                                       | static preview  | A1       |
| Popaddlink       | `html/components/popaddlink.html`                                                       | interactive     | A1       |
| Object Manager   | `html/components/object-manager.html`                                                   | static preview  | A1       |
| Repeater         | `html/components/repeater.html`                                                         | static preview  | A1       |
| Bulk Edit        | `html/components/bulk-edit.html`                                                        | static preview  | A1       |

### Section: Foundations — 3 pages, all contract A1, route `#/dieter/{slug}` (unchanged)

| Page       | Current source                                   | Mechanism                                                      | Contract |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------- | -------- |
| Colors     | `html/foundations/colors.html` (992 ln)          | hand-authored token chip grid; light/dark via `data-theme` CSS | A1       |
| Typography | `html/foundations/typography.html` (23-ln shell) | filled at runtime from `admin/src/data/typography.ts`          | A1       |
| Icons      | `html/foundations/icons.html` (8,941 ln)         | build-generated committed grid; cells hydrate to inline SVG    | A1       |

### Section: Policy

| Page                                      | Current source                                                                                                                        | New route                                                                                   | Contract                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Policy Editor (entitlements + AI runtime) | `html/tools/entitlements.html` (1,387 ln incl. inline module script) + matrix wiring in `main.ts` + **local API in `vite.config.ts`** | `#/policy/entitlements` (moved from `#/tools/entitlements`; no redirect — internal, pre-GA) | **A4.** Renders tier columns (`free`→`tier4`); limit rows (editable; `null` = ∞), flag rows (editable toggles) from `entitlements.matrix.json`; per-agent AI runtime block from `ai-runtime.matrix.json` (copilot rows editable: default model per tier; system agents display-only; sampling policy shown). Backend per §3.5. |

### Deleted (contract A2)

| Item                          | Source                                                                                                        | Guard                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------- |
| Bob UI Native                 | `html/tools/bob-ui-native.html` + `BobNativeCatalog.ts`                                                       | `rg "BobNativeCatalog                                       | bob-ui-native" admin/` → 0 |
| Dead `'dieter'` folder branch | `admin/src/data/routes.ts`                                                                                    | branch removed; nav builds from the three real folders only |
| Dead API lanes                | `vite.config.ts` `/api/themes/list`, `/api/themes/update`, `/api/rebuild-icons` (no consumers in `admin/src`) | removed with the rest of the middleware in Step 6           |

### Shell

| Surface       | Contract                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar nav   | Three groups in order: Foundations, Dieter Components, Policy. Generated from the folder structure as today; `tools` group retired. |
| Default route | Unknown/empty hash → first item of first group (today's behavior, kept).                                                            |
| Brand header  | "DevStudio" (unchanged).                                                                                                            |

### Post-108 Policy Additions (follow-up, not migration closure)

| Page          | New route               | Contract                                                                                                                                                                                                             |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing       | `#/policy/routing`      | Per agent: turn-class → model table, escalation rule, failover entries, from the post-108A-1 policy schema. Read-only unless D8 decides otherwise.                                                                   |
| Capabilities  | `#/policy/capabilities` | One row per `ModelCapabilityProfile`: provider, model, endpoint family, token param, reasoning values, structured-output support, picker/durable eligibility, conformance status + `lastRunAt` freshness. Read-only. |
| Policy Editor | (existing)              | AI-runtime editor adapted to the post-108A-1 schema; `inputBudget`/`residency` columns appear if the schema adds them.                                                                                               |

Exact column layouts are execution detail; data sources, editability rules, and the
read/write contracts are binding.
