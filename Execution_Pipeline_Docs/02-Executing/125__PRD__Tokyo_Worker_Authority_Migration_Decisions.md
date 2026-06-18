# PRD 125 - Tokyo-worker Authority Migration Decisions

Status: EXECUTING
Origin: PRD 124E split
Owner: Product architecture
Date: 2026-06-17

## Purpose

PRD 124 deleted and tightened the Tokyo-worker storage boundary where the work was
bounded and deterministic. The remaining Tokyo-worker findings require product
authority decisions before code execution. They must not be completed inside PRD
124 by renaming, warning, compatibility wrapping, or adding enforcement machinery.

Bottom line: Tokyo is storage/CDN. Tokyo-worker may add exact files, delete exact
files, read/list storage facts, and serve exact files. Product meaning belongs to
Roma, Bob, San Francisco, or shared product contracts.

## Product Truth

- Roma owns account policy, tier policy, current-account product operations, and
  save/publish commands.
- Bob edits one widget in browser memory.
- Tokyo-worker owns account R2/storage, byte safety, storage integrity reads, and
  public static serving.
- San Francisco owns AI execution.
- Tier policy defines locale capacity.
- Roma account settings define the account active locales. Active locales apply
  to all widgets as soon as the account settings save succeeds; they are not
  saved into each widget instance.
- Per-widget locale readiness is only the presence and validity of stored
  overlays/artifacts for that widget and locale.
- Tokyo-worker must not become the owner of account policy, widget/page
  composition semantics, translation orchestration policy, or default
  materialization unless product law is explicitly changed.

## Split Findings

| Source                                        | Decision needed                                                                                                                        | Why PRD 124 did not finish it                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TW-02 registry/serve-state split truth        | Decide whether Supabase registry remains Tokyo-worker operational storage truth or moves to an R2 runtime record / another owner.      | Not a deletion. It changes runtime identity/status authority for instance listing, publish state, and public serving.     |
| TW-04 page package/publish pipeline           | Decide the page package writer and package readiness authority.                                                                        | Tokyo-worker currently reads/checks page package files, but no current Roma page package writer exists in this PRD scope. |
| TW-05 page source authority                   | Decide how much page source contract validation/versioning/list summaries belong in Roma/shared contracts versus Tokyo-worker storage. | Moving this changes page create/save/list/open contracts and cannot be faked with local checks.                           |
| TW-06 instance source/content composition     | Remove per-instance active-locale truth and decide the remaining content extraction/overlay remap owner.                               | Active locales are account settings. Removing Tokyo extraction/remap requires Roma/Bob save payload changes first.        |
| TW-07 translation orchestration               | Decide whether translation orchestration moves to Roma/San Francisco and what storage artifacts Tokyo-worker keeps.                    | This changes policy, AI job creation, ledger ownership, and San Francisco contracts.                                      |
| TW-10 account widget defaults materialization | Decide whether Roma or shared build contracts materialize account widget defaults and Tokyo-worker only stores exact bytes.            | Current Tokyo-worker seeding from widget specs is real product behavior and needs a replacement writer before deletion.   |

## Execution Law

- Do not reinterpret these findings into an ideal storage platform.
- Execute one authority decision at a time.
- Before code edits, name the surviving owner and the exact product flow.
- If a current Tokyo-worker behavior remains the owner, update product law and
  docs explicitly instead of pretending it was deleted.
- If behavior moves out of Tokyo-worker, delete the old Tokyo-worker behavior in
  the same slice after the replacement owner is active.
- No runtime test/probe dependency.
- No silent fallback, healing, omission, or partial-success masquerade.

## Initial Execution Order

1. Instance locale/source fact contract subset from TW-06:
   remove per-instance `targetLocales` truth. Roma account settings remain the
   active-locale authority; translation generation uses the current account
   active locales at request time. Operation locale snapshots may remain inside
   translation jobs/ledgers, but they are not widget instance state.
2. Account widget defaults materialization from TW-10:
   move seeding/materialization to Roma or a shared build contract, then make
   Tokyo-worker store/read exact defaults only.
3. Page package authority from TW-04:
   add/confirm the package writer or disable publish paths that depend on absent
   page package files.
4. Page source contract ownership from TW-05.
5. Registry/serve-state authority from TW-02.
6. Translation orchestration from TW-07.

## Closure Criteria

- Every moved behavior has one active owner.
- The old Tokyo-worker behavior is deleted, not wrapped.
- Runtime account storage still fails on corrupt persisted state.
- Docs and PRD ledger identify the owner of each surviving behavior.

## Execution Notes

2026-06-17 TW-06 locale-authority slice:

- Removed per-instance `targetLocales` from the active account instance config
  document model, Tokyo-worker instance create/open payloads, Roma instance
  create payloads, and Roma duplicate flow.
- Removed retired `targetLocales` from the instance `meta` surface so stale
  metadata is not returned, copied, or persisted as per-instance locale truth.
- Roma translation generation now reads current account locale settings at
  request time and sends that account active-locale snapshot for the operation.
  Bob request-body locale lists are no longer authority for generation.
- Tokyo-worker translation generation no longer falls back to stale instance
  locale state. A missing or malformed operation locale snapshot fails
  explicitly; an empty account active-locale snapshot remains a valid no-work
  result.
- Translation job/ledger `targetLocales` remains only as an operation snapshot,
  not widget instance state.
- Active docs now state that Roma account settings own active locales, active
  locales apply to all widgets immediately after settings save, and per-widget
  readiness comes from stored overlays/artifacts.

Open after this slice:

- TW-06 remaining: content extraction and overlay remap still live in
  Tokyo-worker and require a separate owner decision before deletion.
- TW-10, TW-04, TW-05, TW-02, and TW-07 remain open.
