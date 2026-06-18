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
| TW-02 registry/serve-state split truth        | Decision executed: R2 `serve-state.json` is instance publish/public-serving truth; listing reads R2 instance folders.                 | Supabase `instances.publish_status` is no longer runtime truth. Translation registry cleanup remains TW-07.              |
| TW-04 page package/publish pipeline           | Decision executed: current account page publish is unavailable until Roma writes page packages.                                         | No current Roma page package writer exists in this PRD scope.                                                            |
| TW-05 page source authority                   | Decision executed: Roma owns page source validation, save shaping, version stamps, summaries, and placement checks.                   | Tokyo-worker now stores/reads/lists exact page source objects and keeps storage coordinate checks.                        |
| TW-06 instance source/content composition     | Decision executed: active locales are Roma account settings; Roma materializes and composes source artifacts; Tokyo-worker stores exact files. | Active locales are account settings. Removing Tokyo extraction/remap required Roma/Bob save payload changes first.        |
| TW-07 translation orchestration               | Decide whether translation orchestration moves to Roma/San Francisco and what storage artifacts Tokyo-worker keeps.                    | This changes policy, AI job creation, ledger ownership, and San Francisco contracts.                                      |
| TW-10 account widget defaults materialization | Decision executed: Roma materializes and validates account widget defaults; Tokyo-worker stores exact submitted defaults.              | Tokyo-worker seeding from widget specs required a replacement Roma writer before deletion.                                |

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
   disable publish paths that depend on absent page package files.
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

Open after this locale-authority slice, before the source/content artifact slice:

- TW-06 still required removal of Tokyo-worker content extraction and overlay
  remap after Roma source artifact materialization was in place.
- TW-10, TW-04, TW-05, TW-02, and TW-07 remain open.

2026-06-17 TW-06 source/content artifact slice:

- Roma now materializes the exact split source artifacts for account instances:
  `instance.config.json` content-free config plus `instance.content.json` saved
  text fields. Tokyo-worker stores those submitted files.
- Roma composes stored config/content back into the full Builder config when
  opening an instance for Bob.
- Tokyo-worker no longer extracts text fields from submitted config, strips text
  fields out of config, composes config/content for open, or remaps locale
  overlays during save.
- Existing locale overlays are left as stored artifacts. Per-widget readiness is
  determined by stored overlay markers versus the current submitted content
  artifact; save no longer silently carries translations forward.
- Tokyo-worker translation operations read saved text fields from
  `instance.content.json` and use the widget contract only for metadata/hash
  facts. They do not extract saved text from instance config.

Open after this source/content artifact slice:

- TW-10, TW-04, TW-05, TW-02, and TW-07 remain open.

2026-06-17 TW-10 account widget defaults materialization slice:

- Roma now materializes the initial `accounts/{accountPublicId}/widget-defaults.json`
  document at account creation from Shell factory defaults and product widget
  Core defaults.
- Roma validates account widget defaults against compiled Builder controls and
  explicit software metadata before account creation storage, Widget Defaults
  GET/PUT, and new instance creation.
- Roma owns the `updatedAt` stamp on Widget Defaults save. Tokyo-worker no
  longer mutates widget-default timestamps.
- Tokyo-worker no longer seeds account widget defaults from widget specs, no
  longer imports Shell factory defaults for account defaults, and no longer
  derives account-default control paths from widget definitions.
- Tokyo-worker widget-default routes now require submitted `widgetDefaults` on
  create and store/read/save the normalized storage-shape document only.

Open after this account widget defaults slice:

- TW-04, TW-05, TW-02, and TW-07 remain open.

2026-06-17 TW-04 page package/publish pipeline slice:

- No active Roma page package writer exists in this PRD scope, so account page
  publish is explicitly unavailable.
- Roma page publish UI now disables publish and explains that page package
  generation is not enabled.
- Roma page publish API now returns `coreui.errors.page.publishUnavailable`
  without calling Tokyo-worker.
- Tokyo-worker page publish route now returns
  `coreui.errors.page.publishUnavailable` for direct internal calls.
- Roma disables page source edits while a page is published. Tokyo-worker
  rejects direct save/delete calls on a published page; users must unpublish
  before changing or deleting page source until Roma writes page packages.
- Roma disables public page copy/open actions, and Tokyo-worker returns not
  found for public page URLs until Roma writes page packages.
- Deleted Tokyo-worker page package readiness checks and the dead Roma direct
  page publish wrapper. Tokyo-worker no longer pretends publish can proceed
  based on incidental R2 files.
- Unpublish remains storage behavior.

Open after this page package/publish slice, before the page source authority slice:

- TW-05, TW-02, and TW-07 remain open.

2026-06-17 TW-05 page source authority slice:

- Roma now owns account page source validation and normalization through
  `roma/lib/account-page-source.ts`.
- Roma page save loads the current source, rejects published-page saves, stamps
  the next `version` and `updatedAt`, preserves `createdAt`, and sends the exact
  shaped source to Tokyo-worker.
- Roma derives account page summaries from exact page sources returned by
  Tokyo-worker; Tokyo-worker no longer returns page list summaries.
- Roma performs the placed-on-page check before account instance delete.
  Tokyo-worker no longer scans page placements to decide whether an instance can
  be deleted.
- Tokyo-worker page source operations now keep storage coordinate/existence
  checks, JSON parse failure, serve-state integrity reads, and exact source
  put/delete/list behavior. It no longer validates page product fields, mutates
  page source version/timestamps, or derives summaries.

Open after this page source authority slice, before the registry/serve-state authority slice:

- TW-02 and TW-07 remain open.

2026-06-17 TW-02 registry/serve-state authority slice:

- Instance publish status now lives in
  `accounts/{accountPublicId}/instances/{instanceId}/serve-state.json`.
- Tokyo-worker instance listing, open, save live-state read, publish/unpublish,
  delete, and public serving no longer read Supabase `instances.publish_status`.
- Tokyo-worker normal instance create, save, rename, and delete no longer read,
  create, touch, or delete the Supabase instance registry row. Those operations
  mutate only the account instance R2 files.
- Malformed stored `instance.config.json` now fails as invalid persisted state
  instead of being treated as a missing instance.
- Roma enforces `instances.published.max` before calling the Tokyo-worker publish
  storage transition.
- Existing account instance folders were migrated after `pnpm cf:preflight`:
  `pnpm migrate:instance-serve-state -- --apply` wrote 12 R2 serve-state files,
  and a follow-up dry-run reported `writes=0`.
- Supabase `instances` remains only inside the open TW-07 translation
  orchestration path until TW-07 removes translation ownership from
  Tokyo-worker.

Open after this registry/serve-state authority slice:

- TW-07 remains open.
