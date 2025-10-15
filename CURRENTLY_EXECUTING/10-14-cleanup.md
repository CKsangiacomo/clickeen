# 2025-10-14 Cleanup Log & Proposed Remediations

Purpose: Catalog and de-risk legacy/unused/misaligned artifacts that confuse AI engineers. Each item includes specific evidence, action, SCOPE/CAP, and reviewer verification steps.

---

## Completed: “testbutton” widget full purge

- Summary: Removed the bootstrap test widget across code and docs; Venice preview no longer references it.
- Changes (paths):
  - Deleted: `venice/lib/renderers/testButton.ts`
  - Edited: `venice/app/e/[publicId]/route.ts` (removed import/branch; preview script now generic + FAQ-safe)
  - Edited: `paris/lib/catalog.ts` (removed `WIDGET_CATALOG['testbutton']` and `TEMPLATE_CATALOG['testbutton-pill']`)
  - Edited: `bob/lib/ui-schemas.ts` (removed `MOCK_UI_SCHEMA['testbutton']`)
  - Edited: `bob/app/bob/bob.tsx` (no fallback to `'testbutton'` when posting preview patches)
  - Docs scrubbed: `documentation/**`, `CURRENTLY_EXECUTING/**`, and `gitmeta/**` references removed
- Verify:
  - Command: `rg -n "testbutton|TestButton|testButton" -S` → Expect no matches
  - Venice route still builds: check `venice/app/e/[publicId]/route.ts:169-244` contains a single `const script = ...` and injects `script` (not `scriptFaq`)

---

## Applied: Content — Categories via Expander (Bob)

- Scope: `bob/app/bob/ToolDrawer.tsx` (one file)
- Change: Render each category as a Dieter Expander with inline edit of:
  - Category title (Textfield)
  - Questions list (question text + answer textarea, add/remove)
  - Delete Category, Add Question buttons
- Data written:
  - `config.categories[i].title`
  - `config.categories[i].items[] = { id, question, answer }`
- Verify:
  - Content tab shows expanders labeled "{Title} · N questions"
  - Editing title/question/answer updates preview state; Save persists
  - Add/Remove Question and Delete Category mutate the list accordingly

---

## Applied: Paris Dev Stability (bounded waits + CORS)

- Scope:
  - `paris/lib/timeout.ts` — implement Promise.race timeout (no hangs if callee ignores AbortSignal)
  - `paris/app/api/instance/[publicId]/route.ts` — bound `loadInstance` and `transformConfig` to 2s; 504 on timeout
  - `paris/middleware.ts` — allow `http://localhost:5173` and `http://127.0.0.1:5173` by default in dev
  - `scripts/dev-up.sh` — cap healthz wait with `curl -m 1`
- Verify (after restarting Paris):
  - `curl -m 2 http://localhost:3001/api/healthz` → returns quickly (200/503, not hanging)
  - `curl -m 2 http://localhost:3001/api/instance/wgt_faq_dieter_001` → 200 JSON or 504 (not hang)
  - Bob opens: `http://localhost:3000/bob?publicId=wgt_faq_dieter_001`

---

## Applied: Bob↔Paris Highway (timeouts + write-through)

- Scope:
  - `bob/app/api/paris/instance/[publicId]/route.ts` — 5s timeout to upstream Paris; returns 504 on abort
  - `bob/lib/paris.ts` — generic fetch timeout (AbortController + Promise timer)
  - `bob/hooks/useWidgetConfig.ts` — write-through autosave (debounced 400ms); updates `savedSnapshot` on ACK; surfaces `isSaving`
- Behavior:
  - Controls update local config immediately; a debounced PUT persists to Paris (one path only).
  - If Paris is slow, Bob proxy fails fast (504) instead of hanging the UI.
- Verify:
  - Change Title → config updates locally, `isSaving` flips, and after ACK a soft preview swap occurs.
  - Kill Paris → control change quickly stops showing `isSaving`, Bob proxy responds 504; page remains interactive.

---

## Finding F1 — Logo Showcase type ID drift

- Evidence:
  - Doc uses `content.logoshowcase`: `documentation/widgets/LogoShowcase/LogoShowcase.md:6`
  - Runtime type is `social.proof`:
    - `paris/lib/catalog.ts:92` (widget id) and `:217` (template.widgetType)
    - Seed: `supabase/migrations/20251009100000__seed_geneva_phase1.sql:150,298`
- Impact: AI/code drift—docs drive wrong widget type during instance creation or schema discussions.
- Proposed action (Option A — minimal): Update the doc to set Type ID to `social.proof` and note alias history.
- SCOPE/CAP: 1 file, ≤20 LOC.
- Verify:
  - `rg -n "content.logoshowcase" documentation/widgets/LogoShowcase/LogoShowcase.md` → Expect 0 after change
  - `rg -n "social.proof" paris venice supabase` → Confirms runtime alignment

---

## Finding F2 — FAQ defaults mismatch (catalog vs renderer)

- Evidence:
  - Catalog defaults: `paris/lib/catalog.ts:132-145` defines `content.faq` defaults with `items: [...]`
  - Renderer uses categories: `venice/lib/renderers/faq.ts:17-18` expects `categories = (cfg as any).categories || []`
- Impact: New instances created from catalog may render empty unless transform or ToolDrawer fills categories.
- Proposed action: Change `defaults` to category shape, e.g.:
  - `categories: [{ id: 'cat_1', title: 'General', items: [{ id:'q1', question:'…', answer:'…' }] }]`
- SCOPE/CAP: 1 file (`paris/lib/catalog.ts`), ≤15 LOC.
- Verify:
  - Create instance (dev) and confirm Venice shows one category with entries.
  - Or locally check transform: `PUT /api/instance/:id?dryRun=true` returns populated config without errors.

---

## Finding F3 — Empty root files (noise for AIs)

- Evidence: zero-byte files at repo root:
  - `useInstance.ts` (0 bytes)
  - `useWidgetConfig.ts` (0 bytes)
- Impact: AI may assume they are active code hooks.
- Proposed action: Delete both.
- SCOPE/CAP: 2 files, ≤5 LOC.
- Verify: `rg -n "useInstance.ts|useWidgetConfig.ts" -S` → no references; `ls -la` shows removed.

---

## Finding F4 — `TEMP_FILES_NOT_PROD/` in repo (large, deprecated content)

- Evidence:
  - Deprecated file: `TEMP_FILES_NOT_PROD/apps/app/lib/supabaseServer.ts:3` → `// DEPRECATED: Use createSupabaseServer() …`
  - Bundled `node_modules/` inside: `TEMP_FILES_NOT_PROD/node_modules/...`
  - Many legacy docs and assets not relevant to Phase‑1 code.
- Impact: Major AI confusion surface; slows ripgrep and indexing; increases false positives.
- Proposed action: Remove the entire directory from the repo; keep an archive branch if needed.
- SCOPE/CAP: 1 directory delete.
- Verify: `test -d TEMP_FILES_NOT_PROD || echo removed`; confirm no build scripts reference it.

---

## Finding F5 — Workspace entry with no folder (`lab/*`)

- Evidence: `pnpm-workspace.yaml:9` includes `lab/*`; no `lab/` in repo root.
- Impact: pnpm workspace discovery churn; AI may infer non-existent packages.
- Proposed action: Remove `lab/*` from `pnpm-workspace.yaml` (or add `lab/.gitkeep` and a README if intentionally reserved).
- SCOPE/CAP: 1 file, ≤5 LOC.
- Verify: `rg -n "^\s*- lab/\*" pnpm-workspace.yaml` → 0 matches after change.

---

## Finding F6 — Dieter CSS include coverage in Bob

- Evidence:
  - Bob includes: `bob/app/layout.tsx: link tokens.css, segmented.css, button.css, textfield.css, textrename.css, dropdown.css`
  - Controls in use also leverage: `toggle.css` and `expander.css` (present under `dieter/components/`)
- Impact: Visual/styling anomalies in ToolDrawer when Toggle/Expander present.
- Proposed action: Add `<link rel="stylesheet" href="/dieter/components/toggle.css" />` and `/expander.css` to `bob/app/layout.tsx`.
- SCOPE/CAP: 1 file, ≤6 LOC.
- Verify: Visual sanity in Bob; no 404s for CSS files.

---

## Finding F7 — Duplicate “base tables” migrations (clarity)

- Evidence:
  - `supabase/migrations/20251004100000__phase1_base_tables.sql`
  - `supabase/migrations/20251006150000__phase1_base_tables.sql`
- Impact: New contributors unsure which is canonical (both use IF NOT EXISTS, so functionally fine).
- Proposed action: Add a brief `supabase/migrations/README.md` stating the later file supersedes earlier; keep both for history.
- SCOPE/CAP: 1 new doc, ≤30 LOC.
- Verify: README present; references to both files clarified.

---

## Finding F8 — Docs with scattered TODOs

- Evidence:
  - `documentation/systems/bob.md:661` — “Permanent fix (TODO) … lab.* types”
  - `tooling/pre-ship/src/cli.mjs:558` and `tooling/pre-ship/src/cli.ts:582` — index verification TODOs
- Impact: AIs may chase TODOs instead of primary tasks.
- Proposed action: Move or mirror into `CURRENTLY_EXECUTING/TODO.md` and replace in-file TODOs with pointers (“tracked in CURRENTLY_EXECUTING/TODO.md”).
- SCOPE/CAP: 3–5 files, ≤60 LOC total.
- Verify: Grep for `TODO` returns only acceptable contexts after move.

---

## Finding F9 — Venice preview patch expectations vs renderer markup

- Evidence (current):
  - Preview script looks for `data-widget-element="container|title|question|answer"` and `.faq-search-input` in `venice/app/e/[publicId]/route.ts:170-244`.
  - `venice/lib/renderers/faq.ts` does not mark a `data-widget-element="container"` or `title`; it uses a plain `h2` and `.card`.
- Impact: Generic preview patch runs safely but may no-op if selectors aren’t present.
- Proposed action: Either add minimal `data-widget-element` attributes in renderers (e.g., set container/title/answer) or keep the script as best-effort; document the gap.
- SCOPE/CAP: If we add attributes to `faq.ts`, 1 file, ≤10 LOC.
- Verify: With `?preview=1`, title updates and search placeholder patch react live.

---

## Batch Plan (SCOPE/CAP per batch)

1) Delete empty root files
   - SCOPE: `useInstance.ts`, `useWidgetConfig.ts`
   - CAP: 2 files, ≤5 LOC

2) Align Logo Showcase doc to `social.proof` (Option A)
   - SCOPE: `documentation/widgets/LogoShowcase/LogoShowcase.md`
   - CAP: 1 file, ≤20 LOC

3) Fix FAQ defaults in catalog
   - SCOPE: `paris/lib/catalog.ts`
   - CAP: 1 file, ≤15 LOC

4) Remove `lab/*` from workspace (or create stub)
   - SCOPE: `pnpm-workspace.yaml`
   - CAP: 1 file, ≤5 LOC

5) Add missing Dieter CSS includes in Bob
   - SCOPE: `bob/app/layout.tsx`
   - CAP: 1 file, ≤6 LOC

6) Remove `TEMP_FILES_NOT_PROD/` (pending approval)
   - SCOPE: `TEMP_FILES_NOT_PROD/**`
   - CAP: 1 directory delete

7) Migrations README note
   - SCOPE: `supabase/migrations/README.md`
   - CAP: 1 new file, ≤30 LOC

8) Consolidate TODOs
   - SCOPE: `documentation/systems/bob.md`, `tooling/pre-ship/src/cli.mjs`, `tooling/pre-ship/src/cli.ts`, `CURRENTLY_EXECUTING/TODO.md`
   - CAP: 4 files, ≤60 LOC total

---

## Reviewer Checklist (copy/paste)

- [ ] `rg -n "testbutton|TestButton|testButton" -S` → 0 matches
- [ ] Logo Showcase doc shows `social.proof` as Type ID; `rg -n "content.logoshowcase"` → 0 in docs
- [ ] `paris/lib/catalog.ts` FAQ defaults use `categories` structure
- [ ] Root has no `useInstance.ts` or root-level `useWidgetConfig.ts`
- [ ] `pnpm-workspace.yaml` has no `lab/*` entry (unless `lab/` exists intentionally)
- [ ] `bob/app/layout.tsx` includes toggle/expander CSS
- [ ] `supabase/migrations/README.md` explains base-table duplicates
- [ ] Consider removal of `TEMP_FILES_NOT_PROD/` or confirm archival decision
- [ ] Venice preview (`?preview=1`) applies patches where selectors exist (container/title/search)

---

## Out of Scope (DB cleanup)

Per owner’s guidance, Supabase cleanup is handled separately. For completeness, a purge snippet (to run manually, not in repo migrations):

```sql
-- Danger: irreversible. Ensure backups.
DELETE FROM widget_instances WHERE widget_id IN (SELECT id FROM widgets WHERE type = 'testbutton');
DELETE FROM widgets WHERE type = 'testbutton';
DELETE FROM widget_templates WHERE widget_type = 'testbutton';
DELETE FROM widget_schemas WHERE widget_type = 'testbutton';
```
