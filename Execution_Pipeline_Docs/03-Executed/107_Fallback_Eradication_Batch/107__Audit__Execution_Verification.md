# PRD 107 — Execution Verification Audit

Auditor: Claude Code (independent verification pass)
Date: 2026-06-13
Branch: `prd106f-devstudio-runtime`
Scope: `../../01-Planning/109__PRD__Fallback_Eradication.md` — verify that rows
marked **COMPLETE** were actually executed (toxic workflow deleted, typed visible
failure at the named boundary, downstream mutation blocked), not masqueraded.

---

## Bottom line

The **deletion work is real and the typed boundaries hold.** I independently
re-proved the two highest-risk data-loss rows end-to-end (page source + widget
fill) with fresh harnesses, and read the source for the rest. No masquerade
(renamed fallback, helper-throw caught-and-relabeled, retry-to-success, mutation
before failure) was found in the completed rows.

The remaining exposure is **process and durability, not correctness**:

- gating actions marked `LOCKED` while their rows shipped (bookkeeping lie),
- zero retained regression coverage — every downstream-block proof was a
  throwaway script,
- one genuinely unfinished violation (`TW-107-CACHE-PURGE-IGNORED`).

---

## Part 1 — Independent re-verification (executed, not trusted)

I reconstructed two downstream-block harnesses from scratch and ran them against
current source. Each asserts both halves of the PRD contract: the boundary fails
with the named typed reason, **and** the downstream mutation never fires.

### AB-24 — Tokyo page source mutation-block — 11/11 PASS

File: `tokyo-worker/src/domains/pages/source.ts`
Method: imported `saveAccountPageSource` / `deleteAccountPageSource` /
`createAccountPageSource` / `readAccountPageSource` with a recording fake R2 that
counts every `put`/`delete`.

| Case                                                               | Result                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Save over corrupt-JSON stored source                               | throws `tokyo.errors.page.sourceInvalid`, **0 puts**                           |
| Save over malformed stored source (not a record)                   | throws `…sourceInvalid`, **0 puts**                                            |
| Save with valid stored but invalid _submitted_ source (bad robots) | throws `…sourceInvalid`, **0 puts**                                            |
| Delete over corrupt stored source                                  | throws `…sourceInvalid`, **0 deletes**                                         |
| Valid save                                                         | writes **exactly** `accounts/{acct}/pages/{page}/source.json` and nothing else |
| Valid read                                                         | returns source, **0 writes**                                                   |

The valid-save case writing only `source.json` independently re-confirms the
AB-24 claim that the pages **index** was removed from active truth (no
`index.json` write).

### AB-25/26 + WRT-107-FILL — runtime visual mutation-block — 11/11 meaningful PASS

File: `tokyo/product/widgets/shared/fill.js`
Method: loaded the IIFE into a fake DOM that records every style/append/remove/
textContent mutation.

| Case                                                    | Result                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| `applyMediaLayer` image fill missing `src`              | throws `[CKFill] image fill requires src`, **0 mutations**     |
| `applyMediaLayer` video fill missing `src`              | throws `[CKFill] video fill requires src`, **0 mutations**     |
| `applyMediaLayer` 1-stop gradient                       | throws `[CKFill] Invalid gradient fill`, **0 mutations**       |
| `toCssBackground({})` empty object                      | throws `[CKFill] Invalid fill` (no `transparent` substitution) |
| `toCssColor('#ff0000')` string shorthand                | throws — old `String()` stringification path is gone           |
| `toCssColor` on a gradient fill                         | throws `[CKFill] Fill is not a color`                          |
| Valid color                                             | succeeds (`#123456`)                                           |
| Contract: valid non-video fill over a stale video layer | removes the stale `.ck-fill-layer`                             |

(One positive-path video case threw only because the fake DOM lacks
`container.prepend` — a harness limitation, not a product defect. All
negative/contract assertions, which are the actual zero-mutation proof, pass.)

### Source-level verification (read, not run)

All confirmed as genuine deletions with typed throws at the named boundary:

| Row(s)                   | Verified                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| AB-6…9                   | `deepseek` default gone; only a legit `provider === 'deepseek'` key check remains            |
| AB-10                    | `requireEnvVar(env.OPENAI_MODEL, …)`; fake AI-runtime matrix JSON deleted                    |
| AB-11                    | `resolveGrantBudgets` throws `GRANT_INVALID` on non-positive `timeoutMs`                     |
| AB-14 / CKC-107-01       | locale-switcher `top-right` default gone; returns `localeSwitcher.positionInvalid`           |
| AB-21 / R107-RB-004      | Roma 503 `rateLimit.kv_missing`; Berlin throws `kv_missing` / `client_ip_missing`            |
| R107-RB-005 / CKC-107-04 | `parseRateLimitRecord` throws `ck.rateLimit.recordInvalid` on corrupt state                  |
| CKC-107-03               | malformed JWT `exp` throws `ck.jwt.expInvalid` (not treated as not-expired)                  |
| AB-17/18 + WS-107        | `packageMissing` with structured `paths`; orphan `roma/lib/widget-public-package.ts` deleted |
| AB-22/23                 | read throws `widgetDefaults.missing/invalid`; write only at creation (`seededAt`)            |
| CKP-107-01               | `sanitizeConfig` rewrite deleted; only surviving `sanitizeTo` ref is a `throw`               |
| SF-107-08                | retry-to-success removed — no retry loop / `lastError` / `isRetryableProviderFailure`        |
| SF-107-06 / SF-107-07    | provider/copilot JSON-slicing gone (covered by AB-6 / AB-12 exact-contract parse)            |

A repo-wide scan for placeholder/generic reason keys (`…errors.*.n'`,
`reasonKey: 'n'`) returned **nothing** — no generic-relabel masquerade.

---

## Part 2 — Actionable gaps (ranked)

| #   | Finding                                                                                                                                                                                                                                                      | Where                                        | Action                                                                                            | Owner          | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- | -------- |
| 1   | **Gating actions still `LOCKED` while 30+ rows are `COMPLETE`.** `AI-107-0` (Step 0), `AI-107-H` (harness), `AI-107-M` (masquerade) read LOCKED, yet the masquerade table is fully filled and rows shipped. The doc contradicts its own state.               | Action Item Ledger                           | Flip the three to COMPLETE (or to the real status) so the gates reflect reality                   | PRD owner      | High     |
| 2   | **No downstream-block proof is retained in-repo.** Every "0 puts / ack=0" proof was a temporary harness deleted after running. Nothing guards these boundaries against a future refactor reintroducing a fallback. (I just proved they are reconstructable.) | All completed rows; `AI-107-H` is LOCKED     | Commit the AB-24 + fill harnesses (and peers) as regression tests under each package              | Each package   | High     |
| 3   | **`TW-107-CACHE-PURGE-IGNORED` is genuinely open**, blocked on `D-107k` = PENDING. Publish/save can return `ok:true` while Cloudflare cache purge is skipped → stale `clk.live`.                                                                             | Step 0 D-107k                                | Decide D-107k (eradicate here vs. split to a publish-integrity PRD), then close or formally defer | Product + Arch | High     |
| 4   | **`WSH-107-01` (widget-shell validators) has no evidence or masquerade row** though the code looks addressed (`isShellWidgetDefaults` rejects non-records). Status ambiguous.                                                                                | `packages/widget-shell/src/validators.ts:31` | Add the evidence row, or confirm it is still open                                                 | widget-shell   | Medium   |
| 5   | **`SF-107-06` / `SF-107-07` folded into AB-6 / AB-12 with no explicit mapping.** Source confirms slicing is gone, but the row IDs can't be traced to a proof.                                                                                                | l10n + copilot parsers                       | Add "covered by AB-6 / AB-12" note to each row                                                    | SF             | Low      |
| 6   | **Per-slice ≥3× delete:add ratio not individually audited.** Aggregate is 3.79:1 (authored source), but a few slices self-report under 3× (AB-1 = 3.0; page-save-package = 0:6).                                                                             | Evidence ledger shortstats                   | Spot-check sub-3× slices, or note the gate is met in aggregate by design                          | Reviewer       | Low      |

---

## LOC accounting (context)

Measured across all PRD 107 commits (`2a870df6` → `fbcc40e8`, 50 commits):

| Scope                                             | Added | Deleted | Net        | Ratio  |
| ------------------------------------------------- | ----- | ------- | ---------- | ------ |
| Authored source (excl. compiled bundles)          | 1,618 | 6,125   | **−4,507** | 3.79:1 |
| Compiled Dieter bundles (`tokyo/product/dieter/`) | 42    | 3,126   | −3,084     | —      |
| All source (PRD's counted scope)                  | 1,660 | 9,251   | −7,591     | 5.57:1 |
| Docs / PRD evidence (excluded by PRD rule)        | 642   | 402     | +240       | —      |

The **−4,507 authored-source** figure is the honest headline; the compiled
bundles shrank because their authored inputs shrank (counting both double-counts
the same removal).

---

## Verification method note

- Independent harnesses imported product modules directly with recording fakes
  for R2 / DOM; they did **not** hit the running dev stack.
- Downstream-block claims for rows I did _not_ re-run are taken from the
  Evidence Ledger (temporary Playwright/TS proofs, since deleted). I confirmed
  the boundary throws exist in source for those rows; "the mutation truly never
  fires" rests on the recorded evidence, not a fresh run.
- The two harnesses I ran are trivially reconstructable and should be the seed
  for action item #2.
