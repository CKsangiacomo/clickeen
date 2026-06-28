# 126C Iconography — GLM Pre-Execution Peer Review

Status: PRE-EXECUTION peer review (main-thread, 3 lenses: Staff Engineer, Senior PM,
Principal TPM). Subject: `126C__PRD__Iconography.md` (Status: PRE-EXECUTION REVIEW REDRAFT).
Grounded in `audits/126C__AsBuilt_{Codex,GLM}.md`, `research/126C_Research_{Codex,GLM}.md`,
`documentation/engineering/UI/iconography.md`, and code/file checks. **Verified this
pass:** `dieter/scripts/build-icons.mjs` exists but is **orphaned** (not wired into any
`package.json` or `scripts/build-dieter.js`), and its claimed output `dieter/dist/icons.js`
+ `dist/icons.d.ts` **do not exist** — so the kb doc describes a stale pipeline.

This review checks execution-readiness. It does not change the PRD.

---

## Lens 1 — Staff Engineer (architecture & product law)

### 1. Elegant engineering & scalability
- The **Icon Consumer Decision Table** (§2, 174-186) is the deterministic core: six
  consumer lanes (Dieter component / Bob compiler / DevStudio-Admin / Public widgets /
  Roma / Account assets), each with target authoring shape, render path, and
  forbidden/gap. An agent looks up its lane and gets one answer instead of copying
  whatever it saw last. This is the "framework that expands" — a new lane is a new
  table row, not new machinery.
- **Source artifact pair** (`icons.json` + `svg/*`) with required name/count parity
  (§1, 167-169) is a clean integrity contract.
- **Four independent size dimensions** (§5, 222-224): glyph / wrapper / slot / control.
  Precisely prevents the "icon size = touch target" conflation that poisons a11y
  discussions.
- V1-V8 pre-mapped (§363-380).

### 2. Compliance to architecture & tenets
- **No-invented-machinery:** no registry platform, no Admin runtime icon system, no
  runtime hydrator, no new icon component, no optical/filled/outlined variants (Role;
  Out of Scope 347-361). Holds.
- **Pre-GA no-legacy:** `svg_new/` dead path and source-mutating build behavior slated
  for removal (§3, 210-212); `process-svgs.js`/`verify-svgs.js` scoped (blast radius
  301-302). Compliant.
- **Not-the-product-owner / human-owned origination:** agents consume only; new icons
  human-originated via `tooling/sf-symbols` (Human Decisions 70-72). Strong.

### 3. Overarchitecture / unnecessary complexity
- None. The Consumer Decision Table is practical, not abstract.

### 3b. Academic abstractions / pre-work / meta-work / gold-plating
- Concrete throughout (exact token ladder, exact lanes, exact file paths). Not academic.

### 4. Prose / bedtime stories / leeway to invent
- **Leeway (§2 Roma lane, 185):** "Consume Dieter operational icons through the Roma
  implementation path decided by 126M." Until 126M decides, a dev has no deterministic
  Roma icon path today. Acceptable deferral (126M owns Roma), but note the temporary gap.
- **Leeway (§2 / blast-radius DevStudio missing-icon behavior, 183, 312):** "must not
  silently turn missing truth into absence" and "icon insertion only if needed to remove
  silent absence" — V4 says *don't* silently skip, but never says *what to do instead*
  (throw? log? placeholder?). Specify the replacement behavior so a dev isn't left
  guessing.
- §5 anti-masquerade (252-254): "one regular monochrome path per icon… must not pretend
  to support optical variants until they exist." Good — removes leeway.

### 5. Needed documentation updates (DEV perspective)
- **`iconography.md` describes a stale/orphaned pipeline (verified).** Lines 19-22 claim
  `dieter/scripts/build-icons.mjs` runs svgo → `dist/icons.js` + `dist/icons.d.ts`
  (an `IconName` union + `iconPath()` registry), orchestrated by
  `dieter/scripts/build-dieter.js`. Reality:
  - `dieter/scripts/build-icons.mjs` exists but is **orphaned** — not referenced by
    `dieter/package.json`, root `package.json`, or `scripts/build-dieter.js`.
  - `dieter/dist/icons.js` and `dist/icons.d.ts` **do not exist**.
  - The active build is root `scripts/build-dieter.js` (per PRD §3 and the 126G/126H
    audits), which copies `icons.json` + `svg/*` to Tokyo — it does **not** orchestrate
    `build-icons.mjs`.
  - The kb doc must be rewritten to the active path; the orphaned `build-icons.mjs`
    should be verified for any other caller and removed if none.
- **Blast-radius omission (PRD):** the orphaned `dieter/scripts/build-icons.mjs` is toxic
  dead code that misleads agents, yet it is **not** in the PRD's blast-radius removal
  scope (which lists root `scripts/process-svgs.js`/`verify-svgs.js` but not
  `dieter/scripts/build-icons.mjs`). Add it.
- Cross-refs in `components.md`, `ops.md`, `accessibility.md`, `README.md`,
  `services/{dieter,bob,devstudio}.md` (blast radius 318-324).

### Blast radius (Staff Engineer)
PRD table is detailed. Active build path (root `scripts/build-dieter.js`) correctly
stated in §3.
- **Omission:** orphaned `dieter/scripts/build-icons.mjs` + its nonexistent
  `dist/icons.js` output not in removal scope (see #5).
- Otherwise accurate: icon source (`dieter/icons/*`), deploy output
  (`tokyo/product/dieter/icons/**`), Bob (`bob/lib/icons.ts`, `compiler/stencils.ts`),
  DevStudio (`admin/src/data/icons*.ts`, `generate-static-registries.mjs`), widgets, Roma.

**VERDICT: GREEN** — PRD is execution-ready; the orphaned-script + stale-kb-doc issue is
hygiene fixable in execution (the PRD already scopes "remove inactive build behavior"),
but the blast radius should explicitly name `dieter/scripts/build-icons.mjs`. Note-level.

---

## Lens 2 — Senior PM (product UX)

### 1. Elegant product UX & scalability
- Numeric sizing ladder (12-40) gives consistent icon scale across dense builder/Roma
  UI; icons clarify commands (151-152). `currentColor` inherits brand/state. Good UX
  substrate.
- Icon-only controls named on the control (§7, 274) — UX + a11y win.

### 2. Compliance to product-UX best practices
- SF Symbols port, `currentColor`, numeric sizing, decorative-hidden, icon-only-named —
  all aligned with Apple/M3 icon practice.
- Honest about capability: one monochrome path per icon, no optical/filled/outlined
  variants (§6, 266) — no masquerade of features that don't exist.

### 3. Bad UX writing for the user
- Internal doctrine; governs icon meaning consistently. No bad user-facing copy.

### 4. How Clickeen differs from legacy SaaS + alignment
- SF Symbols port = world-class icon source (Apple system symbols). Human-owned
  origination preserves quality — agents cannot inject random/lower-quality icons.
  Aligned with "don't fix what's world-class."
- **Account-asset boundary (§8, 280-289):** customer/content/admin SVGs stay account
  assets, never become operational icons. Important for the widget-based product (users
  upload brand/content SVGs). Correct lane discipline.

### 5. Needed documentation updates (vision/architecture/system)
- `iconography.md` must be rewritten to the active path and the orphaned-pipeline claim
  removed (see Staff #5) — otherwise the vision doc actively misleads.

### Blast radius (PM)
Operational icons across Bob/Roma/DevStudio/widgets covered. Account/content SVGs
correctly excluded from Dieter icon doctrine (§8).

**VERDICT: GREEN** — findings note-level (kb-doc rewrite; account-asset boundary clarity
for widget authors).

---

## Lens 3 — Principal TPM (systems, V1-V8, competitive)

### 1. Cohesive, cost-effective architecture
- Asset/token-layer doctrine, no new subsystem. The Consumer Decision Table routes each
  lane to its owning path. Account assets routed to account-asset authority (clean
  boundary); Bob icon replacement stays compiler-owned (no scattered `getIcon`). Cohesive.

### 2. Clarity on systems — no invented subsystems
- No new subsystem. Boundaries clean: Bob compiler owns `data-icon` replacement;
  DevStudio owns reveal/docs; account assets own content; 126M owns Roma; 126L owns
  DevStudio render.

### 3. SaaS world-class vs competitors (technical)
- SF Symbols port + `currentColor` + numeric ladder + single human-owned 157-set =
  Apple-grade discipline. Strong vs competitors who mix icon libraries (Heroicons +
  custom + emoji). The account-asset boundary is a real differentiator (content icons
  don't pollute system iconography).

### 4. Absence of V1-V8 violations — PRD pre-maps these (§363-380); verified:
- **V1 Silent substitution — PASS.** Invented names/missing icons/account SVGs not
  substituted for approved icons (365).
- **V2 Silent healing — PASS.** Deploy build must not normalize/rewrite committed
  source (367) — directly addresses the SVG-normalization-mutates-source issue found in
  the 126G audit.
- **V3 Silent omission — PASS.** Blast radius spans source/deploy/Bob/DevStudio/widgets/
  Roma/docs (369).
- **V4 Fail-open control — PASS (with note).** Missing icons must not silently skip to
  absence (371) — but the replacement behavior is unspecified (see Staff #4). Mitigated
  by the rule, but tighten.
- **V5 Corruption-as-absence — PASS.** Invalid refs must not become empty UI (373).
- **V6 Partial-success masquerade — PASS.** Source/Tokyo parity must not be claimed while
  consumer lanes drift (375).
- **V7 Masquerade/redress — PASS.** Admin local replacement must not reappear as a
  "shared contract"/runtime system (377).
- **V8 Runtime test dependency — PASS.** Normal consumption must not depend on validation
  rituals (379).
- **All 8 PASS, pre-mapped.**

### 5. Needed documentation updates (TPM perspective)
- Track the orphaned `dieter/scripts/build-icons.mjs` + stale kb pipeline as an execution
  item (remove dead code, rewrite kb doc) — currently absent from the blast radius.
- Cross-PRD index: build-dieter.js → 126G/126H; Roma icon path → 126M; DevStudio render →
  126L; account assets → account-asset authority.

### Blast radius (TPM)
Icon source + deploy + Bob + DevStudio + widgets + Roma + docs. **No**
services/routes/data touched. Accurate, with the one orphaned-script omission.

**VERDICT: GREEN** — all V1-V8 PASS and pre-mapped; orphaned-script omission is note-level.

---

## Consolidated Verdict

| Lens | Verdict | Blocking? |
| --- | --- | --- |
| Staff Engineer | GREEN | No |
| Senior PM | GREEN | No |
| Principal TPM | GREEN (V1-V8 all PASS, pre-mapped) | No |

**126C is execution-ready.** All three lenses green. Note-level findings:

1. **Orphaned `dieter/scripts/build-icons.mjs` (verified).** Exists but is not wired into
   any `package.json` or `build-dieter.js`, and its claimed output `dist/icons.js` /
   `dist/icons.d.ts` do not exist. **Not in the PRD blast-radius removal scope** — add it
   (verify no other caller, then remove).
2. **`iconography.md` describes a stale pipeline** (`build-icons.mjs` → svgo →
   `dist/icons.js` `IconName` registry, orchestrated by `dieter/scripts/build-dieter.js`).
   Active path is root `scripts/build-dieter.js` copying `icons.json`+`svg/*` to Tokyo.
   Rewrite the kb doc; this is the same `dieter/scripts/` path drift 126G/126H flagged.
3. **§2 Roma lane underspecified** until 126M decides — no deterministic Roma icon path
   today (acceptable deferral; note the temporary gap).
4. **DevStudio missing-icon replacement behavior unspecified** (V4 says don't silently
   skip; doesn't say what to do instead). Tighten.
5. **Strength noted:** V1-V8 pre-mapped (§363-380); the Consumer Decision Table is a clean
   expandable framework; account-asset boundary is a real differentiator.

None block execution. Proceed to 126D.
