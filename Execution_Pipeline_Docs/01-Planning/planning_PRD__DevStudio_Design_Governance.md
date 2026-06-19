# Planning PRD - DevStudio Design Governance

Status: PLANNING
Owner: Internal platform (DevStudio) + Dieter
Date: 2026-06-09
Stage: 01-Planning
Numbering: deliberately unnumbered per product owner; sibling of
`Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md`.
Prerequisite status: `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md`
is complete through Step 7. This PRD is not executing in the migration-cleanup pass.
Policy-section extension remains deferred to the San Francisco AI-plane schema
authority in `Execution_Pipeline_Docs/03-Executed/120/120A1__EXEC__AI_Plane_Capability_Conformance_Routing.md`.

Related:

- `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md`
  (§3.5 write path — reused here; §3.6 design freeze — binding here; Appendix A
  hash-frozen pages — the visual baseline)
- `dieter/components/*` (stencils, specs, CSS — component truth)
- `dieter/tokens/*` (`dieter-color-tokens.css`, `dieter-typography.css`,
  `dieter-foundation-tokens.css`, `tokens.css` — token truth)
- `dieter/icons/icons.json` + `dieter/icons/svg/*` (icon source truth; Tokyo is
  build/deploy output)
- `tokyo/product/dieter/**` (Dieter build output synced to Tokyo R2 `dieter/**`)
- `admin/scripts/generate-typography-json.cjs` (existing half-built generation)
- `admin/scripts/generate-component-pages.ts` and `admin/src/data/componentRenderer.ts`
  (existing partial component generation — must be hardened or deleted, not bypassed)
- Memory/context: design-freeze mandate; one-human + AI-workforce operating model

## PRD Tenets

- Execute one step at a time.
- Do not start Step N+1 until Step N is green.
- Green requires named completion evidence.
- A blocker report stops execution; it does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- If existing code contradicts this PRD's intended architecture, delete it, fence
  it, or stop; do not preserve it and work around it.
- **Design freeze applies (Migration PRD §3.6):** the page layouts are the frozen
  templates. Generation changes where content comes from, never how it looks.

## Authority

| Concern                         | Authority                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Page layout/visual design       | Product owner; frozen templates from the migrated pages                            |
| Component truth                 | `dieter/components/*` (stencil + spec + CSS)                                       |
| Token truth                     | `dieter/tokens/*`                                                                  |
| Icon truth                      | `dieter/icons/icons.json` + `dieter/icons/svg/*`; Tokyo output is not source truth |
| Served page artifacts           | Generated static HTML under `admin/src/html/**` until a PRD replaces routing       |
| Token deployment                | Source token commit -> CI `pnpm build:dieter` -> `tokyo-r2-deploy-sync --remote`   |
| Write-path mechanics            | Migration PRD §3.5 (Pages Functions + GitHub commits + validators)                 |
| What is editable from DevStudio | This PRD, Step 0 decision                                                          |

---

## 0. Pre-execution verdict

This PRD is **blocked from execution until this section is reflected in the plan
below**. The original draft described the intended architecture, but it missed
current code topology that changes blast radius:

- Component pages are not purely hand-authored today. `admin/package.json`
  already runs `generate-component-pages.ts` before build, and `routes.ts`
  reads the generated `showcase.generated.ts` registry for static HTML.
- Therefore "delete `admin/src/html/components/`" is not literal. The surviving
  artifact model is: **generated static HTML remains under `admin/src/html/**`,
  carries a generated-file header, and is guarded against manual edits\*\*. The
  generator is the source of page truth.
- The existing component generator is incomplete. It renders defaults/previews
  but does not prove every spec attribute/state is shown, can leave stencil
  markers in output, and misses `textedit`.
- Migration cleanup deleted the wrong-target `dieter/dieteradmin/.../icons.html`
  generation lane. The served `admin/src/html/foundations/icons.html` page still
  needs Step 3 generation before this PRD can edit icon truth.
- The token-editor deploy story is not automatic today. Worker R2 sync currently
  triggers on `tokyo/product/dieter/**`, not `dieter/tokens/**`. Token editing
  must not ship until CI proves source token edits rebuild Dieter artifacts and
  sync Tokyo R2.
- Guards must land before token writes. A commit-to-main editor without guards is
  a product-wide footgun.
- DevStudio is remote-only. No local dev-server middleware, local token mutation
  route, or fake local runtime can survive this PRD.

## 1. Why (product truth)

Clickeen is built by one human and a fleet of AIs. The human cannot read every diff;
he supervises the UI layer by **looking at rendered truth**. DevStudio's showcase
pages are that instrument — the only place the human "sees" what is being built.

The instrument has three failure modes, named by the product owner:

- **(a)** the product drifts from Dieter (the token lever silently stops reaching);
- **(b)** Dieter is not updated for what the product needed (the contract falls
  behind reality);
- **(c)** the showcase pages themselves get tweaked so what the human sees is not
  what ships (the supervised can edit the supervision instrument).

The fix is one trust model, three properties:

```text
SEE truth     pages are DERIVED from the same source the product consumes —
              hand-authoring is abolished; the page cannot lie or go stale.
CHANGE truth  design control collapses into token control: a token edit in
              DevStudio is an attributed commit; the Dieter build propagates it
              product-wide. Edit one token -> the whole company re-renders.
TRUST truth   CI guards make "everything is tokenized" and "everything is shown"
              checked invariants, not conventions AIs can quietly exit.
```

This is the Policy Editor pattern (see → edit → commit → propagate) applied to the
design system, and the product's own propagation moat (edit one instance → every
page recomposes) applied inward to design.

## 2. Verified current state (audit of 2026-06-09 — the baseline this PRD fixes)

Good news first, measured:

- **Skin fidelity is high.** Class-level drift across all 20 component pages: one
  ghost class total (`segmented` uses `diet-btn-txt__label`).
- **Chrome tokenization is real.** `bob/app/bob_app.css`: 0 hex literals / 148
  `var(--)` uses. `roma/app/roma.css`: 0 / 140. The token lever currently reaches
  the product chrome. Failure mode (a) has **not** occurred at stylesheet level
  (inline TSX styles not yet scanned — Step 5 closes that).

The failures, measured and corrected against the current repo:

| Surface    | Truth                                                                                                 | Derived today?                                                                                                         | Measured drift                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | Spec-backed Dieter components                                                                         | Partially — an existing generator rewrites `admin/src/html/components/*.html`, but it is incomplete and unguarded      | `dieter/components` has **21 specs**, DevStudio has **20 component pages**, and the built Dieter manifest lists **23 components**. `textedit` has a spec/stencil/CSS but no page. `textrename` has stencil/CSS/hydrator but no spec. Current generated output can contain unresolved stencil syntax and does not prove full attribute coverage. |
| Colors     | Color declarations in `dieter/tokens/dieter-color-tokens.css` plus approved themed color declarations | No — hand-picked                                                                                                       | Source has **132 color declarations**. Served page has **216 hand-authored chips** and only **36 unique `var()` refs**; references **2 tokens that do not exist** (`--neutral-base`, `--radius-4`) — the audit surface displays invented tokens.                                                                                                |
| Typography | `dieter-typography.css`                                                                               | **Half** — `generate-typography-json.cjs` runs at build, but the page's section lists are hand-frozen arrays           | Generated JSON has **33 roles**; `typography.ts` renders **30**. Missing rendered roles: `body`, `body-small`, `body-large`.                                                                                                                                                                                                                    |
| Icons      | `dieter/icons/icons.json` + SVG files                                                                 | Not generated into the served page yet — migration cleanup deleted the wrong-target `dieter/dieteradmin/...` generator | Source has **157 icon symbols** and **157 SVG files**. Served icons page shows **143 unique icons**, missing 14. The old manual trigger `/api/rebuild-icons` is deleted by the Migration PRD; Step 3 must add the served generation path.                                                                                                       |
| CI/deploy  | Remote-only build/deploy graph                                                                        | Incomplete for this PRD                                                                                                | PR gates do not explicitly cover `admin/**`; no DevStudio canonical-host verify workflow exists yet; Tokyo R2 sync does not trigger from `dieter/tokens/**`.                                                                                                                                                                                    |

Conclusion: the pages are honest about the skin and lie by omission about the
system. Only typography is even half-derived. Every gap above is a place where the
human's supervision is structurally blind.

## 2.1 Surviving authorities and deletion targets

This is the deletion ledger for execution. If a target conflicts with the
Migration PRD, the Migration PRD runs first and this PRD validates it is gone
before continuing.

| Area                    | Survives                                                                                                          | Delete/fence                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| DevStudio serving model | Generated static HTML under `admin/src/html/**`, discovered by current routing, with generated headers and guards | Hand-authored ownership of generated pages; direct manual edits to generated HTML                                                            |
| Component generator     | One hardened generator path using spec + stencil + CSS and a named frozen template                                | Parallel component renderers, per-component generator forks, stale `dieter/components/registry.json` if it remains non-authoritative         |
| Component inventory     | Directories with `{name}.spec.json`, `{name}.html`, and `{name}.css` are governed components                      | `textedit` missing page; `textrename` lacking spec; `icon`/`shared` helper treatment must be explicit                                        |
| Icons                   | `dieter/icons/**` source and one served DevStudio icons page                                                      | Reintroducing wrong-target `dieter/dieteradmin/**` generation or manual regeneration lanes                                                   |
| Typography              | Generated role data + generated page sections                                                                     | Hand-frozen section arrays; missing `body`, `body-small`, `body-large`                                                                       |
| Colors                  | Generated page from governed color tokens                                                                         | Hand-authored chip list; ghost refs `--neutral-base` and `--radius-4`; page-local helper tokens masquerading as source truth                 |
| Local APIs              | Pages Functions from Migration PRD, remote-only                                                                   | Local dev-server token/theme/rebuild routes, `/api/rebuild-icons`, `/api/themes/*`, local-only write routes, local Tokyo static conveniences |
| Bob-native tool         | Whatever survives Migration PRD by explicit evidence                                                              | `bob-ui-native` route and `BobNativeCatalog` after Migration PRD says they are deleted                                                       |
| Build output            | Source-controlled Dieter source; CI-generated Tokyo deploy artifacts for R2 sync                                  | Treating `tokyo/product/dieter/**` as token source truth                                                                                     |

## 3. The fix, per surface

### 3.1 Component pages → generated from spec + stencil (fixes (b) and (c))

A hardened build-time generator becomes the only authority for component pages:

- **Inputs:** each component's `{c}.spec.json` (the declared attribute/variant
  surface), `{c}.html` (stencil), `{c}.css`, plus shared Dieter CSS — the exact
  files Bob's compiler and the product consume.
- **Inventory:** governed components are directories that have `{name}.spec.json`,
  `{name}.html`, and `{name}.css`. Step 0 records explicit treatment for
  `textedit`, `textrename`, `icon`, `shared`, and any helper-only directory.
- **Enumeration:** the generator walks the spec's attributes/placeholders and
  renders every meaningful variant/size/state combination through the stencil,
  with spec labels next to each instance — exactly the current page format. The
  generator must prove coverage without creating unusable combinatorial noise.
- **Layout:** poured into the **frozen layout template** extracted from today's
  pages (rows, spec-wrapper labels, preview wrappers — §3.6 freeze; the migrated
  hash-frozen pages are the visual regression baseline the generated output must
  match).
- **Coverage guard:** generation **fails** if a stencil attribute or spec variant
  is not rendered or if generated output contains unresolved stencil markers
  (`{{...}}`). Staleness becomes a build error, not a silent lie.
- **Hand-authoring abolished:** files in `admin/src/html/components/` remain only
  as generated served artifacts with headers. The showcase can no longer be
  changed except by changing the component source or generator template — failure
  mode (c) becomes impossible for these pages.
- Hydration: components whose hydrators exist get them wired uniformly (the
  static-seven inherit interactivity for free since the generator wires hydration
  from one list, not per-page).

### 3.2 Colors → generated from the token files (fixes (b), (c); enables the lever)

- Parse the approved color custom properties from `dieter/tokens/dieter-color-tokens.css`
  and any approved theme color declarations; render every governed color token as
  a chip, grouped by ramp/system, in both themes. Do not sweep spacing,
  foundation, or typography tokens into the color page.
- Ghost tokens become impossible (the page can only render what is defined). The
  two current ghosts are resolved at the source: define them properly in tokens or
  correct the page-local helpers — named decision in Step 2, not silently healed.

### 3.3 Typography → finish the half-built generation (the flagship lever)

- The generated JSON already exists; the drift vector is the hand-frozen section
  arrays in `admin/src/data/typography.ts`. Derive the section lists from the
  generated data — all 28 roles always visible, new roles appear automatically.
- This page is the product owner's stated primary use case: _change the size of a
  typography token from DevStudio_. See §3.5.

### 3.4 Icons → generation moves into the Dieter build (fixes staleness class)

- The icons page is regenerated from `dieter/icons/icons.json` + SVG files during
  the Dieter/Admin build and writes to the **served** DevStudio page or to a
  generated module imported by that page.
- The dead manual trigger is already deleted by the Migration PRD; this PRD must
  not recreate a manual regeneration lane.

### 3.5 The token editor — CHANGE truth (the §3.5 write path, generalized)

Extends the Migration PRD's Pages Functions + GitHub-commit machinery from policy
matrices to Dieter tokens:

- **Scope v1 (deliberately narrow): edit the _values_ of existing tokens.**
  Typography size and line-height tokens plus color values. Typography weights
  are editable only if they are already tokenized as custom properties; otherwise
  they are read-only until a separate tokenization PRD creates weight tokens.
  Adding/removing/renaming tokens stays code work — it changes the contract, not a
  value, and belongs in a reviewed diff.
- **Mechanics:** the Colors and Typography pages gain edit affordances on each
  governed token. Interaction is explicit draft -> validate -> old/new diff ->
  confirm commit -> commit SHA/build status. No auto-save-on-blur for product-wide
  token changes.
- **Write semantics:** POST validates the token exists and the value is valid for
  that token kind, edits the exact declaration in
  `dieter/tokens/dieter-color-tokens.css` or `dieter/tokens/dieter-typography.css`,
  preserves comments/order, and commits to `main` with a message like
  `dieter(devstudio): --fs-18 1.125rem -> 1.25rem`.
- **Deployment semantics:** the commit changes source tokens only. CI triggered by
  `dieter/**` runs `pnpm build:dieter`, produces `tokyo/product/dieter/**` in the
  runner, and syncs those artifacts to Tokyo R2 with
  `tokyo-r2-deploy-sync --remote`. The Pages app and product chrome rebuild from
  the same source commit.
- Berlin-session/account-verified, sha-conflict-handled, typed failures, no
  silent merges — identical contract to the policy write path.

### 3.6 CI guards — TRUST truth (fixes (a) permanently)

A `scripts/dieter/governance-guards.mjs` (or equivalent) wired into CI:

1. **Tokenization guard:** no raw hex/rgb/oklch color literals and no raw
   font-size literals in product chrome (`bob/app`, `bob/components`, `roma/app`,
   `roma/components`, selected `admin/src` CSS **and inline TSX styles**). Dieter
   token files themselves are the only place governed color values may be literal.
   The guard must define explicit exemptions for generated demos, token swatches,
   third-party/fixture files, and intentional example values. Current Admin CSS is
   not fully clean (`dieter-previews.css` still has raw `#f4f5f7`), so Step 0
   records the baseline and Step 5 either fixes or fences every exemption.
2. **Coverage guard:** generation fails on unrendered spec attributes/variants
   (§3.1), missing tokens (§3.2), missing roles (§3.3), missing icons (§3.4).
3. **Ghost guard:** no `var(--x)` reference anywhere in DevStudio pages to a token
   not defined in `dieter/tokens/*` (automatic for generated pages; the guard
   catches regressions and the shell).
4. **No-hand-authoring guard:** generated outputs carry a header comment; CI fails
   if a generated file is edited without its inputs changing.

## 4. Steps

| Step | Action                                                                                                                                                                                                                                                                                                                                                                                   | Completion evidence                                                                                                                                                                                                                                                                             | NOT_ALLOWED                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| 0    | **Preflight/topology lock:** prove Migration PRD Steps 1–6 are green; run Cloudflare preflight for remote-only work; record exact token/icon/component counts; lock generated static HTML as the served artifact model; record treatment for `textedit`, `textrename`, `icon`, `shared`; record ghost-token resolution; lock token deploy model as source commit -> CI build -> R2 sync. | This PRD updated with a decision/evidence record: workflow links, counts, component inventory table, deletion ledger.                                                                                                                                                                           | Starting execution from stale counts; deleting served HTML without replacing routing; inventing a new route framework; preserving local-only write paths. |
| 1    | **Typography generation completed:** section lists derived from generated JSON; all 33 generated roles render unless Step 0 proves a new source count; hand-frozen arrays deleted.                                                                                                                                                                                                       | Page shows 33/33 roles (or Step 0 current source count); visual parity vs frozen baseline; arrays gone (`rg "BODY_SCALE                                                                                                                                                                         | LABEL_SCALE                                                                                                                                               | WEBSITE_BODY_SCALE" admin/src` → 0). | New layout/styles; hand-curating role lists. |
| 2    | **Colors generation:** chip grid generated from token CSS; both themes; ghost tokens resolved per Step 0 decision.                                                                                                                                                                                                                                                                       | Page shows the Step 0 governed color-token count exactly; ghost-guard green; visual parity vs frozen baseline.                                                                                                                                                                                  | Hand-picking tokens; inventing chip styles; silently defining ghost tokens without the Step 0 decision.                                                   |
| 3    | **Icons generation wired into the served DevStudio page;** page derived every build from source icons.                                                                                                                                                                                                                                                                                   | Page shows 157/157 (or current count); a test icon added to `dieter/icons/icons.json` appears without manual steps; no wrong-target `dieter/dieteradmin/**` output is reintroduced.                                                                                                             | Manual regeneration lanes; writing generated icons to an unserved artifact.                                                                               |
| 4    | **Component page generator hardened:** spec+stencil enumeration through the frozen layout template for all governed components; hydration wired uniformly; generated files carry headers.                                                                                                                                                                                                | Coverage guard green per component (every governed spec attribute/variant rendered — including `min-items`, `allow-structure`, `data-axis`, `data-databinding`, repeater's full surface); no unresolved `{{...}}`; visual parity vs frozen baselines; `textedit`/`textrename` treatment proven. | New visual language; per-component generator forks; keeping hand pages "as backup"; deleting the static artifact folder without replacing `routes.ts`.    |
| 5    | **CI guards live before writes:** tokenization (incl. inline TSX styles with explicit exemptions), coverage, ghost, no-hand-authoring, generated-output validity.                                                                                                                                                                                                                        | Guards run in CI; a seeded violation of each class fails the build (negative fixtures); current tree passes; `admin/**` is included in relevant PR/verify gates.                                                                                                                                | Warn-only guards; scoping guards down to pass dirty code; enabling token writes first.                                                                    |
| 6    | **Reusable DevStudio write path:** extract/reuse Migration PRD §3.5 GitHub commit mechanics for token routes; no local dev-server write path.                                                                                                                                                                                                                                            | Berlin session/account identity -> server-side GitHub commit; no client secrets; path allowlist to token files; typed 401/403/409/422; conflict and rollback SOP documented.                                                                                                                    | New auth model; dashboard-only manual commits; local-only mutation APIs.                                                                                  |
| 7    | **Token editor (values-only):** edit affordances on Typography + Colors pages; full round-trip proven.                                                                                                                                                                                                                                                                                   | On `devstudio.clickeen.com`: edit `--fs-*` → source token commit on `main` with correct diff → CI `build:dieter` → Tokyo R2 updated → Bob/Roma/Admin computed styles reflect it; invalid value → typed 422, no commit; conflict → typed 409.                                                    | Add/remove/rename tokens; client-side tokens/secrets; auto-save-on-blur; new editor styling beyond Policy Editor patterns.                                |
| 8    | Docs sync: `devstudio.md` gains the remote-only governance model (derived pages, token editor, guards); Dieter docs note generation as the only showcase path and token deploy graph.                                                                                                                                                                                                    | Docs diff in same PR as final code step.                                                                                                                                                                                                                                                        | Deferring docs; leaving `devstudio.md` describing local-only DevStudio as canonical.                                                                      |

## 5. Out of scope

- Adding/removing/renaming tokens from the UI (v1 is values-only; revisit after use).
- Editing component code (stencils/specs/CSS) from DevStudio — components are code;
  governance for them is see + enforce, not UI editing.
- Any layout/visual redesign of the pages (freeze: the templates are the design).
- Widget-level token compliance (widget configs allow user HEX overrides by
  design; the tokenization guard covers product chrome, not customer content).
- Prague/marketing surfaces.
- The Policy section (owned by the Migration PRD and the archived San Francisco
  AI-plane schema authority).
- Turning DevStudio into a generic design governance platform. This PRD is a
  boring generator/guard/write-path job.

## 6. Acceptance criteria

- Zero hand-authored showcase ownership remains: every Foundations and Component
  page is generated from the same Dieter source the product consumes, and every
  generated static artifact is guarded.
- Coverage is total and guarded: 28/28 typography roles, all color tokens, all
  icons, every spec attribute/variant per component — with CI failing on any gap.
- The token lever works end-to-end: a value edit in DevStudio becomes an attributed
  source commit, propagates through the Dieter build and Tokyo R2 sync to product
  chrome and showcase alike.
- Failure modes closed: (a) tokenization guard green incl. inline styles; (b)
  coverage guards make Dieter-behind-product visible at build time; (c) generated
  pages + no-hand-authoring guard make showcase tampering fail CI.
- Visual parity: every generated page matches its hash-frozen migrated baseline
  (the product owner's design, untouched).
- Remote-only proof: no DevStudio local write lane, stale dev-server mutation API,
  or unserved generated artifact remains in the live execution path.
- Security proof: token writes are Berlin-session/account-authenticated,
  path-allowlisted, server-side only, conflict-safe, rollback-documented, and
  never expose GitHub or Cloudflare secrets to the client.

## 7. Planning review (per pipeline README)

1. **Elegant engineering, scales?** Yes — one generator + one guard set abolishes
   hand-maintained showcase ownership; every future component/token/icon gets a
   showcase page and a guard for free. O(1) per addition.
2. **Compliant with architecture/tenets?** Yes — kills a duplicate-truth violation
   (hand copies of component markup); reuses the ratified write-path machinery;
   keeps DevStudio inside its boundary (no product data, no account model).
3. **Avoids over-architecture?** Yes — values-only editor, no new visual language,
   no new backend beyond the already-ratified Functions; generation reuses the
   existing typography/icons machinery instead of inventing a framework.
4. **Moves toward intended architecture?** Directly — this is the operating thesis
   made mechanical: the one human steers design through tokens with an instrument
   that cannot lie; the AI workforce builds underneath, inside checked invariants.
