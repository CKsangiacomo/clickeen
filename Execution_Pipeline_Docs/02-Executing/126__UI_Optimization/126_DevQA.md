# 126 — DevQA: Where We Actually Stand

Status: PRE-EXECUTION STEPS 1-8 COMPLETE - every 126A-126M execution contract
is frozen and exact-tree peer-reviewed; Step 9 has not started.
This document reconciles PRD claims with Git and current source evidence. It does
not define product law, approve unresolved architecture choices, prove that every
intermediate commit deployed, or close any PRD whose required verification is
still missing.

Date: 2026-07-14
Last reconciled: 2026-07-21
Scope: premature A-H code-change reality, final A-M current-source audits,
executable PRDs, exact-tree peer reviews, and the Step-9 starting boundary.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).

Read-order note: this is a pre-execution correction ledger, not runtime or
product authority. Runtime code remains behavior truth; the human product owner
accepts product/architecture law and assigns it to the appropriate living doc or
final PRD. This file sits in `02-Executing/` as part of the repo pipeline topology;
that folder name does not make this work execution.

---

## 1. Headline

Substantial A-H foundation code changes landed prematurely during Phase 1. They
remain current as-built input, not completed execution slices. The renewed
read-only pass is now complete across A-M: every domain has a current gap and
deletion map, a final executable PRD, and an exact-tree three-lens GREEN review.
Reviewed trees are A `c06fa7db`; B `4b480e50`; C `b5efaefc`; D `31b81152`;
E `ec1ed486`; F/G/H `4c5458b4`; I/J/K/L/M `22a92ec9`. This grants no execution
credit. All Step-9 implementation, product-data, deploy, and visual/runtime
evidence remains open.

1. **The 126 process was not followed.** The human has now confirmed that every A–M
   domain completes steps 1–8 before step 9 begins. A–H code changes landed while
   I–M remained baseline or directional documents. Those changes receive no step-9
   execution credit.
2. **The review bar was applied inconsistently.** A pre-execution review may be
   GREEN while naming code that the accepted PRD is explicitly designed to change.
   It should not be GREEN while a required human decision, mandated blast-radius
   coverage, or required execution precondition remains unresolved.
3. **The 126 status docs were stale before this realignment.** Every A-H PRD said
   `PRE-EXECUTION READY`, but their as-builts predated later code changes. The
   renewed current-source read, D1/D2/D3 propagation, exact gap maps, final PRDs,
   and exact-tree reviews are now complete across A-M. Step 9 remains unstarted.
4. **The 126I pivot-layer input errors are now proven and corrected in active
   decision docs:** current source has 25 directories including `shared`, no
   `command-activity`, and no current `--color-surface`, `--radius-2`, or
   `--hspace-*` component references.
5. **The font-migration evidence question is closed.** Authenticated Roma routes show
   all seven fonts as `CLICKEEN` account assets; widget defaults expose the account
   font library; `QD1G068MX7` and its public runtime use account-asset URLs. The
   untracked local copies are mechanical future cleanup, not migration input.
6. **Product-owner convergence is complete.** D1 defines dialog dismissal, D2
   defines global workspace capability, and D3 keeps Upgrade connected to one
   honest pre-GA upsell scaffold. No new A-H product decision is open.

---

## 2. What The Review And Premature Code-Change Sequence Proves

### Commit timeline (Jun 28–29)

All eight GREEN peer-review commits land before the first premature code-change commit.
However, Git history does not prove that the reviews examined the detailed PRD
versions later committed by `5688403c`: tracked 126D–H PRDs were still short
directional skeletons at the review commits, while the reviews describe
"human-converged" documents. The reviewed working-tree content/tree is not recorded.
Code changes then continue and are corrected through subsequent commits.
This ordering is Git evidence; it is not review-provenance or deployment evidence.

| Time (Jun 28–29) | SHA | Commit |
|---|---|---|
| 15:27–15:39 | `ec699533`…`4e752989` | docs(126A–H): peer review — all GREEN (8 commits) |
| 22:27 | `5688403c` | commit labeled `feat(126A-D): execute UI foundation slices`; under the confirmed process this is a premature Phase-1 code change, not step-9 execution |
| 22:52–23:08 | `866c6be9`…`76af1ed4` | temporary Roma locale-package route work |
| 23:33–02:12 | `b132dfde`…`c299c783` | remove temporary route and continue/correct 126D–H code changes |

The ordering is unambiguous. Whether any intermediate commit reached a Cloudflare
runtime before the next commit requires GitHub Actions/Cloudflare deployment evidence
and is not asserted here.

### What GREEN meant, and where it was too permissive

The 126F, 126G, and 126H reviews were pre-execution reviews of final-PRD readiness.
Naming current code gaps and routing them to an exact future step-9 target is
compatible with a GREEN review. Later premature code changes addressing those gaps
do not convert the reviews or changes into execution.

The reviews were too permissive where they recorded unresolved prerequisites and
still returned GREEN:

- The 126F review says the easing value remains human-owned and that its future
  step-9 change is blocked until the human chooses it.
- The 126F–H reviews say structured blast-radius and V1–V8 sections described by
  the draft parent are absent, yet still label the PRDs execution-ready.
- The human-confirmed process requires every A–M domain to reach step 8 before
  step-9 execution. I–M had not done so.
- The reviewed tree/hash is absent, so the GREEN commits do not prove that the
  executable PRD versions committed later received peer review.

The reviews also correctly named future code targets that premature commits later
addressed. Those changes remain current as-built input for re-audit:

- **126F GREEN** named: "2 dead duration tokens, button untokenized (3× literal
  `150ms ease`), `--easing-standard` dangling (referenced, never defined), repeater
  JS inline transitions bypassing reduced-motion." → `5da0a36d fix(126F): align
  system motion law` fixes every one of these.
- **126G GREEN** named: "remove the `unknown` gitSha fallback, remove stale
  bridge-era/local-upload concepts and refusal guards." → `de408dda fix(126G):
  simplify ui ops pipeline truth` fixes all of these.
- **126H GREEN** named: "de-scope/delete `--focus-ring-*`, remove the numeric
  alias concept." → `c299c783 fix(126H): clean Dieter foundation substrate`
  removes `--radius-3/4`, `--focus-ring-*`, `--min-touch-target`.

**Verified in code:** `dieter/tokens/dieter-foundation-tokens.css:71-73` now
defines `--duration-snap: 140ms`, `--duration-base: 160ms`, and
`--easing-standard: ease`, confirming that current source changed.

### The first premature code-change commit was documentation-heavy

`5688403c` touched approximately 19.5k changed Markdown lines and 10.5k changed
non-Markdown lines. That is a scope/commit-shaping signal, not proof that the code
work was invalid. The commit combined pre-execution corpus changes with broad product
code changes, which blurred the phase boundary and made review harder. Later commits changed or
corrected several behaviors:

| Commit | What Git history proves |
|---|---|
| `caa0a6bf fix(126D)` | Corrected account-font preview/asset resolution after `5688403c`; `ResolvedAccountAsset` gained the metadata required to distinguish font assets. |
| `0c71faa9 fix(126E)` | Added missing translation terminal feedback and corrected Save command visibility after `5688403c`. |
| `866c6be9`…`76af1ed4`, removed by `b132dfde` | A temporary 219-line Roma locale-package refresh route was added after `5688403c`, expanded in two commits, and then deleted. It was not introduced by `5688403c`. |

**Human-confirmed gate rule:** a named code gap may be routed to future step-9
execution when the reviewed PRD specifies the intended result, blast radius, deletion
boundary, and verification. An unresolved human decision or mandatory pre-execution
artifact may not receive GREEN. The reviewed commit/tree must be recorded. No code or
product-data mutation resumes until every A–M domain completes steps 1–8.

---

## 3. Status-Doc Sweep — Every A–H Status Line Vs. Code Reality

Before this correction, every A–H PRD carried the identical status line
`PRE-EXECUTION READY - three-lane review green`, and each audit carried a READY/current
variant. Slice-related code changes had landed after those status lines were written.

### Original status lines found before correction

| Slice | PRD status (`126X__PRD__*.md:3`) | Audit status (`audits/126X__Audit__*.md:3`) |
|---|---|---|
| 126A | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126B | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126C | `PRE-EXECUTION READY - three-lane review green.` | `PRE-EXECUTION READY - three-lane review green.` |
| 126D | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| 126E | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |
| **126F** | `PRE-EXECUTION READY - three-lane review green.` | **`FROZEN PRE-EXECUTION AUDIT - not current source truth after 126F execution.`** |
| 126G | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - current execution map.` |
| 126H | `PRE-EXECUTION READY - three-lane review green.` | `CODEX PRE-EXECUTION AUDIT - three-lane review green.` |

### The original 126F internal contradiction (verified and now corrected)

- `126F__PRD__Motion.md:3`: `Status: PRE-EXECUTION READY - three-lane review green.`
- `audits/126F__Audit__Motion.md:5`:
  `Status: FROZEN PRE-EXECUTION AUDIT - not current source truth after 126F execution.`
  That wording incorrectly grants execution credit. Lines 11–17 describe outcomes
  after premature code changes:
  "`--easing-standard` is defined as a foundation token, `--duration-spin` is
  removed... system motion literals were replaced by Dieter motion tokens."

**Code truth (`dieter/tokens/dieter-foundation-tokens.css:71-73`):**
`--duration-snap`, `--duration-base`, and `--easing-standard: ease` are all defined.
Motion-related code changes landed. **Neither old status was correct: the PRD was
not pre-execution-ready, and the audit could not call the changes execution. The
fresh current-source pass and every later pre-execution gate required by that
finding are now complete; Step 9 remains unstarted.**

### Corrections applied

The status lines keep all A-H slices in pre-execution. Code changes exist, but
they landed before the all-domain gate and receive no Step-9 credit. Human
convergence and Steps 5-8 are complete across A-M at the reviewed trees recorded
in §1. Step 9 remains unstarted.
A public read on 2026-07-14 confirmed
`https://tokyo.dev.clickeen.com/dieter/manifest.json` reports Git SHA `c299c783`,
which proves that the currently deployed Dieter bytes are observable at the public
Tokyo product root. The corresponding GitHub Actions deploy run has not been verified on this
machine, and the public read does not convert premature changes into execution.
Initial convention applied during the realignment, before later Step-5/6/7
progress (historical wording, not the current status authority):

```text
Status: PRE-EXECUTION CURRENT SOURCE RE-AUDITED - settled law retained; step-5 doctrine and step-6/7/8 artifacts pending; no step-9 execution credit.
```

126D additionally records the authenticated read-only evidence that the account-font
migration is complete. This closes the former product-data uncertainty but grants no
execution credit.

Audit and historical as-built/review status lines were normalized to frozen
point-in-time conventions. They are evidence, not current readiness authority:

```text
Status: FROZEN POINT-IN-TIME PRE-EXECUTION AUDIT — code changed afterward; no execution credit; see provenance note and current source.
```

---

## 4. Foundation Convergence Signals Are Real

This is not inferred from status lines. A drift read cross-checked every
`var(--...)` in Roma/Bob/Admin against the custom properties defined across
`dieter/tokens/*.css`. These are current-state inputs to the renewed pre-execution
audit. They do not prove implementation completion or replace later step-9 verification.

| Signal | Severity | Evidence |
|---|---|---|
| Hardcoded hex colors in inspected operational app source | **clean in inspected scope** | 0 raw hex in `roma/app/roma.css`, `bob/app/bob_app.css`, `admin/src/css/*.css`, or inspected app TSX. Dieter component CSS retains intentional hue-spectrum stops at `dieter/components/dropdown-fill/dropdown-fill.css:603-610`. This does not claim all product/widget CSS is hex-free. |
| Typography delivery | **multiple intentional lanes, explicit** | Dieter typography roles use `var(--font-ui)` / `var(--font-mono)`. Roma and Bob apply `next/font` Inter Tight body classes (`roma/app/layout.tsx:2-20`, `bob/app/layout.tsx:2-22`); DevStudio imports its font/source locally. Public-widget account-font delivery is separately proven through account assets. One delivery path is neither required nor planned. |
| Dieter token consumption | **shared source, different delivery** | Roma links the Tokyo Dieter root, Bob links its `/dieter` surface, and DevStudio bundles local Dieter source. All consume the Dieter token package, but this scan does not claim byte/provenance parity across those delivery lanes. |
| Current phantom component-token references | **clean** | Current `dieter/components/**/*.css` has 0 references to `--color-surface`, `--radius-2`, or `--hspace-*`. Historical source did contain them; see §6. |
| Ghost/undefined `var()` refs | **low** | 1 real ghost: `admin/src/css/utilities.css:74` references `--shadow-lg` (undefined; has fallback so it renders). Dieter defines `--shadow-elevated`/`--shadow-floating`/`--shadow-inset-control` (`dieter-foundation-tokens.css:76-78`), not `--shadow-lg`. |
| Parallel component systems | **med** | See §5. |

**Current contract/consumer evidence:** the `--btn-bg`/`--btn-color`/
`--btn-hover-*` pattern at `dieter/components/button/button.css:8-18` is an observed
source/consumer override contract used by `admin/src/css/layout.css:121-122`.
Preserve it unless a human-approved contract change includes every consumer; do not
delete it merely because it resembles an alias.

---

## 5. Roma Inventory Questions And Convergence

The drift read identified local Roma UI families for 126M classification. The
converged rule does not treat every `.roma-*` class as legacy or pretend one
class represents a parallel component system.

- **39 distinct `.roma-*` selectors** are defined in `roma/app/roma.css`. Roma also
  carries separate `.rd-*` shell/layout selectors and a substantial
  `.widget-defaults-*` control family, so `.roma-*` alone is not the full inventory.
- Bob has no `.bob-*` parallel namespace and consumes Dieter controls extensively.
  That is a useful comparison, not proof that every Bob or Roma surface has already
  converged.
- `.roma-input` is used for text inputs and selects. Its text-input role overlaps
  Dieter Textfield, but `diet-textfield` is structured component markup, not a class
  that can safely replace `.roma-input` in place. Selects require a separate product
  decision.
- Widget Defaults currently renders the compiled Bob/Dieter control package. The
  old hand-written input, textarea, and toggle rules under `.widget-defaults-*` are
  dead CSS deletion targets. Active `.widget-defaults-*` host/layout rules remain
  legitimate Roma composition and must not be deleted with the dead controls.
- `.roma-table`, `.roma-card`, `.roma-modal`, `.roma-toolbar`, and `.roma-nav*`
  were classified during convergence: Dieter owns the bounded shared table,
  field, and dialog mechanics; Roma retains application layout, state, and
  specialized composition.

**QA conclusion:** the complete Roma inventory is carried into 126M, the
mandatory ownership boundary is recorded in the owner register, and the
accepted D1/D3 outcomes now govern Roma dismissal and upsell behavior.

---

## 6. 126I Historical Input Corrections Applied

The original 126I convergence inputs contained two inventory errors and a set of
valid point-in-time findings presented as current. Active decision inputs are now
corrected. Historical audits remain point-in-time evidence; the exact uncommitted
working tree they inspected may be unknown.

### Current input 1: `command-activity` does not exist now

Both as-builts and the PRD cite `command-activity` as a known gap ("empty dead
directory"). It does not exist in the current worktree or tracked tree. Verified via
`ls`, `test -d`, and `find`; `git log` shows tracked source was replaced by
`agent-activity` in commit `8375e93a`. Because Git does not track empty directories
and the audit working tree is unrecorded, this does not prove the historical auditors
did not see an empty local directory.

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | `command-activity` removed from current inventory/gaps; tracked source uses `agent-activity`. |
| `audits/126I__AsBuilt_Codex.md` | Preserve the observation; annotate that exact working-tree provenance is unknown and current/tracked source has no directory. |
| `audits/126I__AsBuilt_GLM.md` | Preserve and annotate using the same provenance rule. |

### Current input 2: component count is 25 now

The current active decision documents must use 25. Historical counts may include an
untracked empty directory, so preserve them as point-in-time observations with unknown
exact worktree provenance rather than silently rewriting history.

| Inventory | Codex claim | GLM claim | Code truth | Evidence |
|---|---|---|---|---|
| Source dirs under `dieter/components/` | 26 (incl. `shared` + empty `command-activity`) | 27 | **25** | `ls -d dieter/components/*/` → 25 entries |
| `manifest.json components` | 24 | — | 24 ✓ | `tokyo/product/dieter/manifest.json:3-28` |
| `manifest.json componentsWithJs` | 20 | ~20 | 20 ✓ | `tokyo/product/dieter/manifest.json:29-49` |
| DevStudio `specModules` | 22 | ~24 | 22 ✓ | `admin/src/data/componentRegistry.generated.ts:73-96` |
| DevStudio `templateModules` | 23 | — | 23 ✓ | `componentRegistry.generated.ts:98-122` |
| DevStudio `cssModules` | 24 | — | 24 ✓ | `componentRegistry.generated.ts:124-149` |

The 25 actual dirs: agent-activity, bulk-edit, button, choice-tiles,
dropdown-actions, dropdown-border, dropdown-edit, dropdown-fill,
dropdown-shadow, dropdown-upload, icon, menuactions, object-manager, popaddlink,
popover, repeater, segmented, shared, slider, tabs, textedit, textfield,
textrename, toggle, valuefield.

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | Current source count set to 25; other inventories qualified. |
| `documentation/engineering/UI/components.md` | Current catalog count set to 25; current `command-activity` entry removed. |
| `audits/126I__AsBuilt_{Codex,GLM}.md` | Preserve historical counts; annotate current count and unknown exact working-tree provenance. |

### Stale input 3: historical CSS-variable findings were later fixed

The historical PRD and Codex as-built listed `--color-surface`, `--radius-2`, and
`--hspace-*` as current drift. Active PRD/living inputs are now corrected and
current source has zero hits, but these were not
invented audit findings: source at `75a5872b` contained all three patterns. Later
126 commits corrected them. The current baseline must mark them resolved; the
historical as-built must retain them with a provenance/superseded note; use an exact
source SHA only if it is recoverable.

Current source contains the following canonical token families, but QA does not
claim they are one-for-one semantic replacements for the old names:

| Cited (absent) | Current defined example/family | Evidence |
|---|---|---|
| `--color-surface` | `--role-surface` | `dieter/tokens/dieter-color-tokens.css:11` |
| `--radius-2` | `--control-radius-sm` | `dieter/tokens/dieter-foundation-tokens.css:46` |
| `--hspace-*` | `--vertspace-*` | `dieter/tokens/dieter-foundation-tokens.css:17-25` |

| File | Applied treatment |
|---|---|
| `126I__PRD__Components.md` | Names removed from the current-gap list and retained as resolved historical findings. |
| `audits/126I__AsBuilt_Codex.md` | Preserve the findings and annotate that later commits resolved them. Record the inspected source SHA only if recoverable; otherwise state that the exact working tree is unknown and cite the nearest Git evidence. |
| `audits/126I__AsBuilt_GLM.md` | Preserve point-in-time findings with the same provenance discipline; do not rewrite historical evidence to current source. |

**The real styling observations** (which the PRD should name instead, at line 88):
1. All z-index values are component-local and some share numeric values:
   `bulk-edit.css:20 z-index: 1000`, `object-manager.css:25 z-index: 1000`,
   `popover.css:16 z-index: 12`, and `textedit.css:119 z-index: 12`. This is a
   stacking-context question for 126J/126K convergence. The evidence does not by
   itself require a new global z-index token layer.
2. Hardcoded modal/surface widths: `bulk-edit.css:32 width: min(96vw, 980px)`,
   `object-manager.css:36-37 min-width: 320px; max-width: 520px`,
   `popaddlink.css:7 max-width: 360px`, `popover.css:34 inline-size: min(320px, 100%)`.
3. Redundant `var(--vertspace-N, …)` fallbacks in 11 component CSS files even
   though the token is defined (cosmetic).
4. Raw rgba shadow fallback at `textedit.css:167` (token `--shadow-floating` is
   defined, so the fallback is redundant).
5. Raw hue-rainbow gradient at `dropdown-fill.css:603-610` — intrinsic to the
   color-picker, likely intentional but untokenized.

---

## 7. Human-Convergence Boundary After Current-Source Re-Audit

The renewed pass removed false owner choices. Product law and current evidence
already decide the following:

- Toggle remains native checkbox HTML/CSS/spec; its unused custom Enter-key
  hydrator is deleted rather than exported into a new keyboard program.
- `textrename` has no current product consumer and is deleted rather than turned
  into a governance project.
- `repeater` and `object-manager` are distinct, active product workflows. Both
  stay; their exact component dependencies must be declared.
- Component-local stacking stays local unless the final dialog/surface gap map
  proves a shared mechanic is required. No global z-index scale is authorized.
- The component count is 25 source directories including `shared`; the runtime
  manifest contains 24 components. `command-activity` is absent.
- ToolDrawer specs, surface vocabulary, app/Dieter ownership, overlay semantics,
  dialog lifecycle correctness, tooltips, native dropdown triggers, and Bob-only
  translation attention are mandatory law, not owner choices.

Product judgment is complete for D1/D2/D3 in
`126__Product_Owner_Execution_Decisions.md`:

1. the accepted row-by-row blocking-dialog dismissal policy;
2. global operational workspace capability across Roma, Bob, and DevStudio;
3. legitimate Upgrade actions open or transition to the shared pre-GA upsell
   dialog scaffold without implying a working billing operation.

Operational native fields and operational table appearance are not owner
alternatives: Dieter-only design-system law requires the small shared visual
contracts and the register now records them as mandatory execution law.

This corrected boundary prevents implementation details, dead code, and semantic
correctness from being presented to the product owner as optional architecture.

---

## 8. Font-Migration Tail - Read-Only Evidence Closed

### What `b132dfde` already removed
- `tokyo-worker/src/asset-utils.ts`: removed `handleGetTokyoFontAsset` +
  `normalizeTokyoFontKey` (−25 lines).
- `tokyo-worker/src/routes/asset-routes.ts`: removed `/fonts/` route branch (−11).
- `tokyo-worker/wrangler.toml`: removed `/fonts/*` route.
- `roma/app/api/.../translations/packages/route.ts`: deleted the entire temporary
  route handler (−219 lines).
- Docs updated: `documentation/capabilities/localization.md` (−35), `services/bob.md`,
  `services/roma.md`.

**Verified current state:** `grep -rn '/fonts' tokyo-worker/src/` returns nothing.
`grep -n 'fonts' tokyo-worker/wrangler.toml` returns nothing. The `/fonts` edge
route is fully gone from code and config.

### Local residue

1. **Untracked local folder:** `tokyo/product/fonts/special/` (7 font files:
   `Frari.woff2`, `Giudecca.woff`, `Marin.woff`, `Orio.woff`, `Pachuka.woff2`,
   `Pachuka_line.woff2`, `Rialto.woff2`). Commit `5688403c` deleted these seven
   files from Git while temporarily retaining the Tokyo `/fonts` route because its
   commit record says remote inventory still used Orio and Pachuka Line. Copies are
   present untracked on this machine. `b132dfde` later removed the route.
   - **Not in the deploy-sync roots:** `scripts/tokyo-r2-deploy-sync.mjs:24-27`
     syncs only `tokyo/product/widgets`, `tokyo/product/dieter`, `tokyo/roma`,
     `tokyo/prague`. There is no `tokyo/product/fonts` root. These files do not
     deploy to R2 through the current sync.
   - **Not referenced in live source:** a scoped grep for the font names
     (Frari/Giudecca/Marin/Orio/Pachuka/Rialto) across `roma/`, `bob/`,
     `tokyo-worker/src/`, `packages/`, `dieter/`, `tokyo/product/widgets/`,
     `admin/src/` returns no hits (excluding false positives like
     `Europe/San_Marino` matching "Marin"). No live product code references them.
   - **Not in `.gitignore`:** the folder is simply untracked.

2. **Instance `QD1G068MX7`** currently uses Orio + Pachuka Line through the
   account font library. Its public `runtime.js` resolves both through
   `https://tokyo.dev.clickeen.com/assets/account/CLICKEEN/...`, not a Tokyo
   global font root.

3. **`fontLibrary` wiring is present in source:**
   `roma/lib/account-widget-defaults-direct.ts:10,22,23,33`,
   `roma/lib/account-instance-public-package.ts:264,266,278,328`,
   `roma/lib/account-widget-defaults-materialization.ts:76`,
   `roma/lib/builder-open.ts:14,79`. Source represents fonts as account assets under
   `accounts/{accountPublicId}/assets/...`, and the deprecated `source: 'tokyo'` path
   returns no hits. Authenticated product-route and public-runtime reads confirm this
   contract is active.

### Current conclusion

- `GET /api/account/assets` for `CLICKEEN` returns all seven fonts with the
  expected font MIME/byte records.
- `GET /api/account/widget-defaults` returns the account `fontLibrary` containing
  those account-asset records.
- `GET /api/account/widgets` and Builder-open routes are healthy in the
  authenticated product lane.
- `QD1G068MX7` uses Orio and Pachuka Line; its public runtime embeds the account
  asset URLs.
- No font product-data migration remains. Step 9 may delete the seven untracked
  local copies after the final plan records this evidence. No remote mutation is
  required.

---

## 9. What Happens Next - Step 9

The execution boundary is now concrete:

1. **Steps 1-8 are complete for all A-M domains.** Each final peer review records
   the exact reviewed commit/tree; no review grants runtime execution credit.
2. **There is no remaining product-owner decision.** D1/D2/D3 and all A-M
   authority, scope, deletion, and verification choices are frozen.
3. **Historical audits remain evidence, not current authority.** The final PRDs,
   current audits, owner register, and this ledger define the Step-9 boundary.
4. **Font migration is closed.** Only the explicitly named local untracked-file
   cleanup remains in its owning Step-9 slice.

### Recommended order
1. Completed: statuses, frozen historical evidence, and product-owner decisions
   are reconciled.
2. Completed: settled law, current-source gap maps, deletion maps, final PRDs,
   and exact-tree peer reviews cover every A-M domain.
3. Next: begin Step 9 with 126A. Continue in dependency order through 126M,
   one PRD and one slice at a time.
4. Do not advance a slice until its implementation, focused checks, visual proof,
   docs, deploy/runtime evidence, product-data reconciliation where applicable,
   and independent V1-V8 audit are GREEN.
5. Premature A-H changes may be kept, changed, or deleted only according to their
   frozen final PRDs; their presence does not count as prior execution.

---

## 10. Final Pre-Execution V1-V8 Audit

The independent exact-tree review is GREEN. This document is a QA/process
artifact. The completed pre-execution work corrects shared architecture and
doctrine inputs but changes no runtime product behavior, product data,
managed-service state, or deployed architecture. V1-V8 applied to the final
pre-execution corpus:

| ID | Question | Result |
|---|---|---|
| V1 Silent substitution | Does this doc replace missing/invalid truth with an invented value? | No. Every completion claim points to a current audit, executable PRD, and exact reviewed tree; premature code changes receive no Step-9 credit. |
| V2 Silent healing | Does this doc normalize/coerce invalid state without failure? | No. Historical audits remain point-in-time evidence with recoverable provenance or an explicit unknown-tree note; only active decision inputs are updated. |
| V3 Silent omission | Does this doc drop a required input/artifact/operation? | No. It retains the all-A-M pre-execution gate, complete Roma inventory, review-provenance gap, closed read-only font evidence, mandatory execution law, and accepted D1/D2/D3 decisions. |
| V4 Fail-open control | Does enforcement turn off when a dependency is missing? | N/A — no enforcement added. |
| V5 Corruption-as-absence | Does this doc treat corrupt state as missing/new/empty? | No. The stale status lines are named as drift, not ignored. |
| V6 Partial-success masquerade | Does this doc claim full success after some work was dropped? | No. Steps 1-8 are complete for A-M; all Step-9 implementation, deploy, product-data, and runtime work is explicitly unstarted. |
| V7 Masquerade/redress | Does the same failing workflow continue under a different wrapper? | No. Verification cannot mutate code/product data or grant execution credit; exact reviewed-tree provenance is mandatory before step 9. |
| V8 Runtime test dependency | Does normal product work start depending on tests/probes? | No. |

---

## 11. Evidence index

Key claims were checked against current source and Git history through
2026-07-21.
Runtime/deploy claims are bounded as stated above:

- `--easing-standard` defined: `dieter/tokens/dieter-foundation-tokens.css:71-73`
- Review→code-change continuation/correction ordering: `git log --oneline` (shas in §2)
- Public Dieter artifact observation: `https://tokyo.dev.clickeen.com/dieter/manifest.json` → `gitSha: c299c783...` on 2026-07-14; Actions provenance not verified
- Premature code-change commit doc:code ratio: `git show --stat 5688403c`
- Reviewed-PRD provenance gap: compare PRD blobs at the GREEN review commits with the detailed versions introduced by `5688403c`
- Current token source: `dieter/tokens/{tokens,dieter-color-tokens,dieter-foundation-tokens,dieter-typography}.css`
- Roma UI inventories: `.roma-*`, `.rd-*`, and `.widget-defaults-*` in `roma/app/roma.css`; representative consumers in `roma/components/**`
- `command-activity` absent: `ls dieter/components/` (25 dirs), `git log 8375e93a`
- Former variable names: present at `75a5872b`; absent from current `dieter/components/**/*.css`
- Toggle export gap: `dieter/components/index.ts:2-18`, `admin/src/main.ts:11-27,258-272`
- Temporary locale-package route chronology: `git show 866c6be9 617099ba 76af1ed4 b132dfde`
- Font route removed: `tokyo-worker/wrangler.toml` (no `/fonts`), `git show b132dfde`
- Font migration law: `126D__PRD__Typography.md:218-223,530-560`
- Deploy-sync roots: `scripts/tokyo-r2-deploy-sync.mjs:24-27`
- `fontLibrary` source wiring: `roma/lib/account-widget-defaults-direct.ts:10,22,23,33`, `roma/lib/account-instance-public-package.ts:264,266,278,328`
- Authenticated Roma evidence: `/api/account/assets`,
  `/api/account/widget-defaults`, `/api/account/widgets`, and Builder-open routes
  for `CLICKEEN` on 2026-07-14.
- Public font runtime evidence:
  `https://dev.clk.live/CLICKEEN/QD1G068MX7/runtime.js` uses Tokyo account-asset
  URLs for Orio and Pachuka Line.
- Human decision boundary:
  `126__Product_Owner_Execution_Decisions.md`; D1/D2/D3 accepted.
