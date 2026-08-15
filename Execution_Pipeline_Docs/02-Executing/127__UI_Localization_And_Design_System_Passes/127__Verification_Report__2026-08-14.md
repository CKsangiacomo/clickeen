# PRD 127 — Execution Verification Report

Date: 2026-08-14
Verifier: independent read-only verification session
Scope: task 2 of the owner request — verify execution of all PRD 127 components
recorded so far, and report gaps or inaccuracies for the dev team.

Verification baseline: `main` @ `8d15a06e` ("feat(dieter): add civil date
controls"), identical to `github/main` (0 ahead / 0 behind). Working tree was
clean at session start. No files were modified by this verification except this
report.

## 1. Overall Verdict

PRD 127 execution records are **accurate and reproducible** against the
repository at `8d15a06e`:

- Stage 1 (scaffold) — COMPLETE and verified end to end.
- Stage 2 (Dieter + DevStudio pass) — Foundations (5/5 tabs) and all 24 listed
  components have pass records that match the source; DevStudio generates
  exactly 24 component pages; repository gates are green.
- Stage 2 is NOT complete: the Widget catalog, Entitlements, and LLM Management
  DevStudio tabs have no pass records yet (PRD correctly names Widget catalog as
  next).
- Stages 3–5 correctly not started.

Twelve findings are listed in §5 for the dev team. Two are genuine (latent)
code-law defects in Dieter, one teardown gap, and the rest are inventory,
documentation, and hygiene items. One concurrent-work warning is in §6.

## 2. Stage 1 — Scaffold Verification (all VERIFIED)

| Claim | Result | Evidence |
| --- | --- | --- |
| Eight Widgets carry adjacent English label folders | VERIFIED | `tokyo/product/widgets/{big-bang,calltoaction,cards,countdown,faq,logoshowcase,split-carousel-media,split-media}/{type}_tooldrawer_l10n_labels/en.json` — `en.json` only, no non-English files |
| Specs declare label tokens, not literals | VERIFIED | `$label:` token counts per spec: big-bang 100, calltoaction 137, cards 167, countdown 192, faq 216, logoshowcase 198, split-carousel-media 151, split-media 137 |
| Compiler joins structure + labels + stencils and fails closed | VERIFIED | `bob/lib/compiler/tooldrawer-labels.ts` — enforces `$label:` on all copy attributes (lines 7–69), validates label-file shape (87–121), rejects missing (320–325) and unused (379–384) keys |
| English artifact path preserved, artifacts resolved | VERIFIED | 8 JSONs in `roma/public/widget-editors/`; zero `$label:` residue in all 8; `toolDrawerLabels.components["agent-activity"].title` present (e.g. countdown → `"Translation Agent"`) |
| Artifacts regenerate exactly from current source | VERIFIED | `pnpm validate:widgets` ran fresh twice during verification (inside typecheck and lint); `git status` shows no artifact drift afterwards |
| Person preference dormant (`primary_language`, `use_primary_language_for_ui` default false) | VERIFIED | Migration `supabase/migrations/20260809123000__user_ui_primary_language_preference.sql` (default false); Berlin stores/normalizes both (`berlin/src/identity/user-settings.ts`, `user-row-normalization.ts`, `bootstrap/state.ts` fails bootstrap if the flag is not boolean); Roma consumes the fields type-only (`roma/components/use-roma-me.ts:42-43`, `profile-domain.tsx` — no toggle, save payload never sends the flag); Roma passes no UI locale to Bob (`roma/components/builder-domain.tsx:564-566` — Bob URL has no locale param) |
| Bob loads no UI-language files; no `bob/l10n` / `roma/l10n` | VERIFIED | No UI-locale concept in `bob/lib/session/*`; `bob/app/layout.tsx` hardcodes `lang="en"`; neither folder exists. (Note: empty untracked dirs `bob/lib/i18n/` and `bob/app/l10n/[...path]/` exist on disk — see F10) |
| No non-English product-UI translation files | VERIFIED | Zero UI translation files in bob/roma source; `packages/l10n/locales.json` is the site-content locale registry (different authority), not UI copy |

## 3. Stage 2 — Foundations Verification (all VERIFIED, exact counts)

| Tab | Claimed | Measured | Evidence |
| --- | --- | --- | --- |
| Core styles | 53 non-layout tokens | 53 exact | `admin/src/html/foundations/core-styles.html` (53 rows, `data-governance-count="53"`); canonical source `dieter/tokens/dieter-foundation-tokens.css`; generator and write route share `admin/functions/_shared/dieter-token-contracts.js`; all 53 tokens have active consumers (zero unused) |
| Colors | 138 declarations; 4 read-only state-mix rows; edit limited to literal `--color-*` hex | 138 exact; 4 read-only rows; 34 edit buttons all on hex `--color-*` | `dieter/tokens/dieter-color-tokens.css`; `admin` generator `isWritableColorToken` + hex-only write pattern |
| Icons | 165 icons; one exporter; `currentColor`; shared optical canvas | 165 exact; all 165 use `fill="currentColor"`; single exporter `tooling/sf-symbols/scripts/extract_all_svgs.py` (CANONICAL_CANVAS_SIZE 36.0) | `dieter/icons/svg/` (165 files), `dieter/icons/icons.json` (165 symbols) |
| Typography | 31 classes; 17 shared tokens; one page-level editor | 31 exact; 17 exact; single `data-token-edit="typography"` editor | `admin/src/data/typography.generated.json`; `dieter/tokens/dieter-typography.css`; `admin/src/main.ts` hydrateTypographyPage |
| Layouts | architecture map (Roma/DevStudio shell, Bob composition, Widget Stage/Pod/Shell); 4 editable tokens | all present; exactly 4 tokens | `admin/src/html/foundations/layouts.html` (`data-layout-map="application|bob|widget"`); `dieter/layouts/main-container/main-container.spec.json` editableTokens; governance guard enforces both |

## 4. Stage 2 — Component Pass Verification (all 24 recorded passes VERIFIED in source)

Component page generation: `admin/scripts/generate-component-pages.ts`
auto-discovers Dieter components with spec+html+css and generated exactly
**24 pages** in `admin/src/html/components/` — matching the PRD list 1:1
(agent-activity, bulk-edit, button, choice-tiles, date-range-picker, datefield,
dropdown-actions/border/edit/fill/shadow/upload, menuactions, object-manager,
popover, popup, repeater, segmented, slider, table, tabs, textfield, toggle,
valuefield).

Spot-verified claims (each confirmed by direct source inspection):

1. **Button unification** — 0 occurrences of old `diet-button-text` /
   `diet-button-icon` / `diet-button-icon-text` classes anywhere in source; one
   `.diet-button` stencil with required `data-size` + `data-type`; ~362
   compliant usages across bob/roma/admin/dieter/tokyo.
2. **Segmented** — native radio group (`segmented.html`), no hydrator
   (`hydrateSegmented` = 0 matches); consumers: Bob Manual/Copilot
   (`ToolDrawer.tsx`), Bob Desktop/Mobile (`Workspace.tsx:513-547`), Dropdown
   Fill mode selector, Logo Showcase spec (3 declarations).
3. **Tabs** — native radios, no `tablist`/`aria-selected`/roving-tabindex
   residue in the Dieter component; no ToolDrawer consumer (`diet-tabs` absent
   from bob/roma/tokyo source; Roma command gate asserts absence). Note:
   `bob/components/TdMenu.tsx:43,50` uses `role="tablist"`/`role="tab"` for
   Bob's own React panel nav — not a Dieter Tabs consumer (see F9).
4. **Slider** — one idempotent `hydrateSlider`/`destroySlider`
   (`slider/slider.ts`), no inline JS in stencil; Bob, Roma Widget Defaults,
   and DevStudio all route through the same exported hydrator.
5. **Toggle** — native checkbox `role="switch"`; `data-size` owns label
   typography; zero nested typography inputs remain in Dropdown
   Border/Fill/Shadow/Repeater compositions.
6. **Menuactions** — no `primary` variant, no `aimenuactions` (0 matches
   repo-wide), no purple icon rule; spec has only size/label/icon/disabled.
7. **Datefield / Date Range Picker** — exist with hydrate+destroy and
   caller-required locale (`[Datefield] locale is required`); zero declarations
   in all 8 widget specs.
8. **Dropdown Upload** — component wired with hydrate/destroy; zero
   declarations in all 8 widget specs (matches PRD claim that no fake Widget
   field was added).
9. **Popaddlink deleted** — `dieter/components/popaddlink/` is empty (source,
   hydrator, spec gone; only an empty untracked directory remains, see F10).
10. **Textedit deleted** — no source residue; deletion documented at
    `documentation/engineering/UI/components.md:273` and `accessibility.md:66`.
11. **Rich-text prototype deleted** — no rich-text component page; generator
    emits 24 pages (22 pre-date + the two date components).
12. **Strict-throw hydrators** — malformed stored values throw
    (`dropdown_upload_value_invalid`, repeater/object-manager `parseJsonArray`,
    civil-date validators); no `??`/`||` substitution masking stored truth on
    value paths; Dropdown Fill/Shadow seed UI defaults only for explicit
    `none`/probe contexts and never commit invented values back.

Focused gates re-run during this verification (all PASS):

- `pnpm typecheck` (includes `validate:widgets`) — 15/15 tasks green.
- `pnpm lint` (includes `validate:widgets`) — green; one warning (F8).
- `pnpm dieter:governance:check` — guards passed.
- `pnpm --filter @clickeen/bob test:editor-contract` — 10/10 PASS (label
  contracts fail closed; Dropdown Upload exact value + Widget-owned copy;
  inside-shadow link preservation; Valuefield finite bounded acceptance).
- `pnpm --filter @clickeen/roma test:widget-command-gates` — PASS (incl. "Roma
  and Bob consume the final Dieter Layout, Table, and Popup contracts").
- `pnpm --filter @clickeen/roma test:widget-defaults-typography` — PASS.
- `e2e/widgets/builder-open.spec.ts` exists and asserts the recorded Builder
  smoke: opens the Appearance tab and requires a rendered Dropdown Border.

Documentation sync: `documentation/services/dieter.md` already documents
Datefield/Date Range Picker (lines 93, 167–177); `documentation/services/devstudio.md`
describes the generated component showcase and current contracts. Exception:
F5 (README structure tree omits `engineering/UI/`).

## 5. Findings For The Dev Team

Ordered by severity. Latent = no current product flow renders the defect today.

### F1 (VIOLATION, latent) — Hardcoded English error-copy catalog inside Dieter

`dieter/components/shared/account-assets.ts:16-27` — `ACCOUNT_ASSET_ERROR_COPY`
holds 10 end-user-visible English strings (e.g. `'This exceeds your current
plan limit.'`, `'Uploads are not available for this account plan.'`), exported
through `resolveAccountAssetErrorCopy` (line 53). This breaks both PRD 127 laws
"Dieter owns no caller copy" and "no Dieter translation catalog". It is
currently **dead code** — zero consumers repo-wide (all live render paths take
error copy from caller `data-copy-*` attributes in `dropdown-upload.ts` and
`dropdown-fill.ts`). Because it is unused, nothing renders it today, but any
future consumer would silently ship hardcoded English into the ToolDrawer.
Action: delete the catalog and the export, or make callers own the words.

### F2 (SUSPICIOUS) — Account-policy vocabulary inside Dieter's shared asset client

Same file, lines 11–14 and 45–116: `ACCOUNT_ASSET_UPSELL_REASONS` hardcodes
account-plan upsell reason keys (`coreui.upsell.reason.limitReached`,
`coreui.upsell.reason.platform.uploads`) and `createAccountAssetsClient`
hardcodes the consumer API's `coreui.*` error vocabulary and payload schema.
The `dieter-upsell` event itself is consumer-neutral as recorded, but Dieter
deciding which reasons constitute an upsell is account-domain knowledge.
Action: consider having the caller supply the upsell reason set alongside the
transport; keep Dieter a pure dispatcher.

### F3 (GAP) — Bulk Edit has no destroy lifecycle

`dieter/components/index.ts:16` exports `hydrateBulkEdit` only.
`hydrateBulkEdit` (`dieter/components/bulk-edit/bulk-edit.ts:112-115`) sets a
`data-bulk-edit-hydrated` guard that is never reset and creates a dialog
lifecycle whose `open()` sets `document.body.style.overflow = 'hidden'`. If a
host (Bob / Roma Widget Defaults / DevStudio) replaces the panel DOM while the
modal is open, the body scroll lock leaks and the detached root can never
re-hydrate. Every other stateful component in the completed set exports a
destroy function used by the shared control-host teardown; Bulk Edit is the
one exception (Choice Tiles is hydrate-only too but keeps all state in a
WeakMap with root-scoped listeners — acceptable). Action: add and wire
`destroyBulkEdit` through the existing host teardown seam.

### F4 (INVENTORY GAP) — Tooltip is a live Dieter primitive outside the PRD 127 component list

`dieter/components/tooltip/tooltip.css` is imported by `dieter/styles.css:28`
and its classes are consumed by Object Manager and Repeater stencils and by
`bob/components/TdMenu.tsx`. It is not on the PRD's 24-item review list and
has no DevStudio page (no `tooltip.spec.json`, so the generator skips it). It
never received a Stage 2 pass. Action: either add it to the remaining
Catalog/Policy-pass review with an explicit pass result, or record it as an
accepted CSS utility outside the component inventory.

### F5 (DOC DRIFT) — `documentation/README.md` structure tree omits `documentation/engineering/UI/`

`documentation/engineering/UI/` contains 12 operator documents (README,
accessibility, color, components, dialogs-and-modals, dieter, iconography,
interactions, motion, ops, surfaces, typography) but the README's structure
tree lists only four files under `engineering/`. Per the README's own rule,
structure drift is a P0 doc bug. Action: add the folder to the tree (and the
router table if appropriate).

### F6 (DOC/PROCESS) — Live cloud-dev verification of the newest slices is not yet recorded

The Table, Textfield/Valuefield, focus-state, Popup, and Datefield execution
entries each end with variants of "the independent V1–V8 audit and
Git-connected exact-SHA rollout follow this local execution record". Git state
confirms commit+push (`8d15a06e` == `github/main`; Pages deploys are
Git-connected), but no recorded live-surface check of the deployed SHA exists
in the PRD folder yet for those slices. Action: record the owning-surface
reconciliation when the rollout is confirmed, per PRD §12/§13.

### F7 (PRD STATUS TABLE) — Stage 2 row understates component progress

§5 says the component inventory is complete "through Textfield and Valuefield"
plus the date contracts, while §14 contains passed records for all 24 listed
components (including Table, Toggle, Tabs, Slider, Segmented, Popup, etc.).
The table is the stage gate of record; it should say the full component
inventory is complete and only the Widget catalog / Entitlements / LLM
Management tabs remain. (Left unchanged here — stage-status edits belong to
the owner.)

### F8 (HYGIENE) — Roma lint warning

`roma/app/api/account/instances/[instanceId]/copilot/route.ts:5` — unused
import `CopilotTurnRequest` (`@typescript-eslint/no-unused-vars`, warning
only). Action: remove the import.

### F9 (CLARIFICATION) — Bob TdMenu uses its own tablist ARIA

`bob/components/TdMenu.tsx:43,50` uses `role="tablist"`/`role="tab"` for Bob's
React panel navigation. This is not a Dieter Tabs consumer and does not
contradict the Tabs pass (which deleted the Dieter-side custom tab program),
but teams scanning for "no custom tab roles" will hit it. No action required
unless Stage 3 (Bob pass) wants to align it.

### F10 (LOCAL RESIDUE) — Empty untracked directories from deletions

`dieter/components/{popaddlink,command-activity,operational-table,textarea}/`,
`bob/lib/i18n/`, `bob/app/l10n/[...path]/` are empty directories left on disk
(git does not track them; a fresh clone is clean). Cosmetic only. Action:
optional local cleanup; never worth repo machinery.

### F11 (SUSPICIOUS, low) — Table stencil demo copy is not tokenized and has no caller-copy path

`dieter/components/table/table.html:3-20` embeds English demo rows
("Ordinary content records", "Homepage notice"/"Active", ...) and
`table.spec.json` declares `"attributes": {}`. Today only the DevStudio
showcase consumes the stencil and Roma owns its real Table copy, so the
"Table owns no words" claim holds in effect — but unlike every other stencil
there is no `{{token}}` path, so any future production reuse of the raw
stencil ships English verbatim. Same pattern (self-labeled example copy) in
`dieter/layouts/main-container/main-container.html:2-4`. Action: tokenize the
stencil or document it as DevStudio-demo-only.

### F12 (NOTE) — Choice Tiles hydrate-only residue

`choice-tiles.ts:49-56` installs an `Object.defineProperty(input, 'value', …)`
override that is never restored on teardown. Low risk (element-scoped), but if
hosts ever recycle input nodes across hydrations, restore the original
descriptor in a future touch of that component.

## 6. Concurrent-Work Warning (not a finding against HEAD)

During this verification (≈18:46–18:5x local), a **second session began
modifying the working tree**: 15 files initially, 26 by completion, all
uncommitted, while `HEAD` stayed at `8d15a06e`. The direction of those edits is
a coherent in-flight correction of the newest slice: they remove the Bob-side
datefield/date-range-picker session validation
(`bob/lib/session/sessionConfig.ts`), the date-related copy attributes from the
compiler's copy-attribute set (`bob/lib/compiler/tooldrawer-labels.ts`), the
datefield value sync in `bob/components/td-menu-content/useTdMenuHydration.ts`,
narrow `min`/`max` back to `number` (`packages/ck-contracts/src/ai.ts`,
`roma/components/widget-defaults-domain.tsx`,
`agents/product-copilot/src/index.ts`), and trim the editor-contract test
(-138 lines). Bob's editor-contract suite still passes 10/10 on that edited
tree.

This is consistent with removing compiler/session machinery for field shapes no
current Widget declares (no-unneeded-machinery law). It was not touched by this
verification. Whoever owns that session should finish, commit, and record it in
§14 — and the dev team should treat HEAD's datefield Bob integration as
potentially superseded.

## 7. What Should Be Next (assessment, task 1)

1. Land/reconcile the in-flight datefield-integration correction (§6).
2. Stage 2 remaining tabs, one at a time in the recorded loop: **Widget
   catalog** (named next by the PRD), then Entitlements, then LLM Management —
   each through its owning authority, not DevStudio.
3. Close the F1/F3 code-law defects through the Dieter authority (smallest
   fixes; no new machinery).
4. Fix F5/F8 doc/hygiene items with the next doc-touching change.
5. Record live owning-surface verification for the newest slices (F6).
6. Then run the Stage 2 completion-gate checklist (§7 of the PRD), update the
   stage table (F7), and stop for explicit owner authorization before Stage 3.

## 8. Verification Integrity

- This session was read-only: no source, artifact, product-data, Cloudflare, or
  remote changes. The only write is this report file.
- Evidence baseline is HEAD `8d15a06e`; concurrent uncommitted edits were
  neither reverted nor audited beyond §6.
- V1–V8: not applicable to a read-only verification (no product-path change);
  findings F1–F3 are pre-existing states surfaced by the audit, not
  introduced here.
