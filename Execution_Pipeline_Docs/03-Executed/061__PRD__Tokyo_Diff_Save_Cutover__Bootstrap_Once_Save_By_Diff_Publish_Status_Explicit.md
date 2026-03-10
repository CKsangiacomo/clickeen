# PRD 061 — Tokyo Diff Save Cutover: Bootstrap Once, Save By Diff, Publish Status Explicit

Status: EXECUTED
Date: 2026-03-09
Owner: Product Dev Team
Priority: P0 (core architecture convergence)

> Core mandate: normal editor operations must stop flowing through Paris and must stop treating Michael/Supabase as the save hub. Paris composes the user+account entitlement snapshot once at login/account bootstrap. Roma and Bob hold that snapshot for the session. Paris is never a per-operation allow/deny oracle after bootstrap. Save becomes the only user-facing write action. Save diffs the current editor state against the current saved Tokyo revision. Text, translations, assets, and config update from that diff, independently. Publish/unpublish only changes live status.

Pre-GA hard-cut rule:
- Clickeen is pre-GA.
- There is currently one effective admin account in cloud-dev.
- There is no backcompat requirement, no legacy compatibility requirement, and no multi-path migration requirement for editor open/save behavior.
- If a route/model is wrong, delete or replace it. Do not quarantine it under `legacy`, `compat`, `v1`, or parallel fallback paths.
- Any active editor surface still used day-to-day must converge on the same canonical open/save model. DevStudio/admin is not an exception for compatibility reasons.

Context note:
- PRD 054 established snapshot-first public runtime semantics: Venice serves Tokyo bytes, not DB-composed request-time state.
- PRD 055 moved overlays/assets/l10n write-plane state away from Supabase where appropriate.
- The remaining architectural drift is on the editor save path: current code still centers Paris and DB writes instead of a Tokyo diff/save model.

Environment contract:
- Integration truth: cloud-dev.
- Local is for iteration and verification.
- Canonical local startup: `bash scripts/dev-up.sh`.
- No destructive Supabase resets.
- No git reset/rebase/force-checkout.

---

## One-line Objective

Cut the product editor onto the intended architecture:
- bootstrap account context, entitlements, enabled locales, and authz session material once in Roma/Bob per account session
- diff `Save` against the current saved Tokyo revision
- update text, translation, assets, and config from that diff
- keep translation and assets independent from each other
- make publish/unpublish the only live-status changes

---

## Straightforward Intended Behavior

1. User opens instance `XYZ` in Bob to edit.
2. On first local edit, Bob shows `Discard` and `Save`.
3. `Discard` restores the exact loaded saved revision. All unsaved changes are lost.
4. `Save` compares the current editor state to the current saved Tokyo revision.
5. `Save` then does exactly 2 independent checks from that same Tokyo diff base:
   - text check: compare translatable text against the saved Tokyo text state for enabled locales already loaded in Roma bootstrap; if translation is stale, update it automatically
   - asset/config check: compare asset refs and config against the saved Tokyo revision; if anything changed, update Tokyo artifacts automatically
6. These aftermaths are independent:
   - text changes do not force asset work unless asset refs changed
   - asset changes do not force translation unless translatable text changed
7. If the instance is `published`, public Tokyo/Venice output updates automatically from the saved revision.
8. If the instance is `unpublished`, public output stays off, but editor-visible translations still update.
9. `Publish` / `Unpublish` only flips live status. They are not edit/save workflows.

---

## Non-Negotiable Product / Architecture Rules

1. Roma bootstrap is the one place where account context, role, entitlements, enabled locales, and authz session material are loaded for the editor session.
2. Entitlements are scoped to the current `user x account` session. Account switch or authz expiry requires re-bootstrap.
3. Bob/Roma must use the bootstrap entitlement snapshot for allow/deny decisions during the logged-in session.
4. Write/status boundaries must authorize from server-verifiable session material issued at bootstrap, not from client-carried policy JSON.
5. Paris is never called after bootstrap to decide whether a normal Bob/Roma operation is allowed.
6. `Save` is the only user-facing write action inside Bob.
7. `Discard` must restore the loaded saved revision exactly.
8. `Save` must diff against the current saved Tokyo revision, not against Michael/Supabase.
9. `Save` must perform exactly 2 independent aftermath checks from that Tokyo diff base: text/translation and asset/config.
10. Text diff must start translation update automatically. No separate translation action exists in the editor.
11. Translation availability in the editor must not depend on `published` / `unpublished`.
12. Asset/config aftermath must be independent from translation aftermath.
13. `Publish` / `Unpublish` are explicit status changes owned by Roma `widgets` domain.
14. Public runtime reads Tokyo only.
15. Pre-GA execution must use one canonical runtime path for editor open/save behavior. Parallel compatibility routes are forbidden.

---

## Scope Lock

This PRD covers:
- Roma bootstrap/editor host behavior
- Bob edit/save/discard behavior
- Tokyo-backed saved instance revision
- automatic translation aftermath from save
- Tokyo asset/config aftermath from save
- explicit publish/unpublish in Roma `widgets` domain

This PRD does not cover:
- redesigning MiniBob handoff
- changing Venice snapshot contract

Hard rule:
- because the repo is pre-GA with one effective admin account, there is no compatibility carve-out for admin/DevStudio editor open/save behavior
- active editor surfaces must converge on the same canonical open/save path
- do not add compatibility aliases or keep old routes alive “just in case”

---

## Command Ownership Model

Every command must have exactly one owner and one side-effect domain.

| Command | Owner | Data plane | Side effects allowed |
|---|---|---|---|
| `bootstrap` | Roma -> control plane | control/account plane | yes, bootstrap-only composition |
| `saveInstance` | Bob/Roma -> Tokyo save boundary | Tokyo saved revision plane | yes, diff aftermath only; no status change |
| `uploadAsset` | Bob/Roma -> Tokyo-worker | Tokyo asset plane | asset only |
| `deleteAsset` | Bob/Roma -> Tokyo-worker | Tokyo asset plane | asset only |
| `publishInstance` | Roma `widgets` domain -> status boundary | Tokyo live plane | explicit live-status change only |
| `unpublishInstance` | Roma `widgets` domain -> status boundary | Tokyo live plane | explicit live-status change only |
| `syncTranslationsAfterSave` | internal save aftermath | Tokyo text plane + translation worker | translation only; publish-status independent |
| `syncAssetsAndConfigAfterSave` | internal save aftermath | Tokyo config/asset plane | asset/config only |
| `syncLiveAfterSaveIfPublished` | internal save aftermath | Tokyo live plane | only when current status is `published`; no status change |

Design note:
- the internal aftermath labels above are explanatory only
- they must not become new user-facing verbs
- they do not require separate public APIs, services, or queues if a simpler internal implementation satisfies the same contract

Hard rule:
- normal base-instance open/load/save is not allowed to route through Paris or Michael/Supabase
- no post-bootstrap operation may call Paris to ask whether the current user/account session is allowed
- no post-bootstrap operation may refresh entitlements/policy in its response
- `saveInstance` never flips live status
- `publishInstance` / `unpublishInstance` never become generic save commands
- no compatibility alias route is allowed for old editor open/save behavior

Paris responsibilities after cutover:
- compose the user+account entitlement snapshot at login/account bootstrap
- refresh that session snapshot only on account switch, explicit session refresh, or authz expiry
- never act as a hot-path permission oracle for open/save/asset/translation/status operations

---

## Target State

### 1. Bootstrap once

Roma loads:
- identity
- default account
- role
- entitlements snapshot
- enabled locales snapshot
- authz capsule / expiry metadata

Bob uses that bootstrap snapshot for:
- local gating
- UX state
- deciding which locales translation aftermath should target
- all allow/deny decisions for the logged-in session

Write/status boundaries must validate the bootstrap session material server-side.
The policy snapshot visible in Bob is for UX and local gating. It is not the server source of truth.

Save does not fetch locale entitlements or refreshed policy in the hot path.

This snapshot is scoped to the current `user x account` session.
Only these events may replace it:
- login
- account switch
- explicit authz/session refresh
- authz expiry / reauthentication

No normal Bob/Roma operation may call Paris to re-evaluate the user/account entitlements mid-session.

### 2. Tokyo owns the saved revision

Tokyo stores:
- current saved authoring revision for the instance
- text/config/assets for that saved revision
- live/public pointers separately

Michael/Supabase is not the save diff base and not the normal save hub.

### 3. Save is a diff against Tokyo

`Save` compares:
- current editor state
- current saved Tokyo revision

It computes independent diff buckets:
- `textDiff`
- `assetDiff`
- `configDiff`

If there is no diff, save is a no-op.

If there is a diff, save writes the next saved revision to Tokyo and then runs exactly 2 independent aftermath checks from that same saved revision:
- text/translation check from `textDiff`
- asset/config check from `assetDiff` and `configDiff`

These checks share the same Tokyo diff base but do not own each other.

### 4. Translation comes from text diff

There is no user-facing translation command in the editor flow.

When `textDiff` is non-empty:
- translation update starts automatically
- enabled locales come from the bootstrap snapshot already loaded in Roma
- translation freshness is evaluated against the saved Tokyo text state, not a DB row snapshot
- translated results become visible in the editor when ready
- this happens whether the instance is `published` or `unpublished`

If the instance is `published`, translated locale results also sync to public Tokyo/Venice output when ready.

### 5. Assets/config come from asset/config diff

When `assetDiff` or `configDiff` is non-empty:
- Tokyo assets/config artifacts update automatically
- no translation work starts unless `textDiff` is also non-empty

Text and asset/config aftermaths are sibling pipelines, not parent/child pipelines.

### 6. Publish/unpublish only changes live status

`Publish`:
- turns live status on
- ensures live/public pointers target the saved Tokyo revision

`Unpublish`:
- turns live status off
- removes live/public pointers

Save while already `published`:
- does not call `publish`
- does not change status
- does refresh live/public output from the newly saved revision

### 7. Public reads are Tokyo-only

Public runtime must never read current editable state from Michael/Supabase or from Bob session state.

Unsaved changes are never public.

Saved changes become public only through Tokyo live/public sync and only when the instance is currently `published`.

---

## Core Design Decision

This PRD hard-cuts the system into 4 planes:

### A. Bootstrap / control plane
- Roma bootstrap
- account/authz composition
- locale availability snapshot

### B. Saved revision plane
- Tokyo saved authoring revision
- Tokyo diff base for save

### C. Independent aftermath planes
- translation aftermath from `textDiff`
- asset/config aftermath from `assetDiff` / `configDiff`

### D. Live runtime plane
- Tokyo live/public pointers
- Venice public reads

These plane labels are descriptive, not a requirement to introduce new services, APIs, or queues.
This is the architecture. One save, one diff base, independent aftermaths, explicit live-status changes.

---

## Deterministic Execution Plan

Execution order is mandatory. No later step starts before the previous step is green.

### Phase 1 — Freeze session entitlement model and editor semantics

Objective:
- make Bob/Roma behave like the intended session and UX model before deeper boundary rewiring

Required changes:
1. load entitlements once per login/account bootstrap and hold them as the session truth in Roma/Bob
2. ensure save/publish boundaries authorize from server-verifiable session material issued at bootstrap
3. remove any post-bootstrap Paris allow/deny call from the normal product path
4. stop returning refreshed policy/entitlements from normal operation responses
5. make `Save` and `Discard` the only dirty-state actions in Bob
6. remove any separate translation action from the editor

Done when:
- viewer/update/upsell gating comes from the bootstrap snapshot already loaded in Roma/Bob
- write/status boundaries do not trust client-carried policy JSON
- save response does not refresh entitlements/policy
- first local edit shows `Discard` and `Save`
- `Discard` restores the loaded saved revision exactly
- no translation write button exists in the editor

### Phase 2 — Establish Tokyo as the save diff base

Objective:
- make Tokyo the authoritative source for current saved instance revision

Required changes:
1. define/read current saved revision from Tokyo
2. split saved authoring revision from live/public pointers
3. remove Michael/Supabase as the normal save diff base

Done when:
- normal save compares against Tokyo saved revision
- save no longer depends on Michael/Supabase reads/writes for instance content

### Phase 3 — Cut base-instance routes to Tokyo

Objective:
- move normal base-instance open/load/save off Paris/Michael

Required changes:
1. replace Bob/Roma instance `GET` with Tokyo-backed saved-revision read
2. replace Bob/Roma instance `PUT` with Tokyo diff/save boundary
3. ensure save uses bootstrap-loaded enabled locales, not a fresh locale fetch

Done when:
- base-instance open/load works with Paris unavailable after bootstrap
- base-instance save works with Paris unavailable after bootstrap
- base-instance save no longer uses Michael/Supabase as hot-path persistence

### Phase 4 — Implement independent save aftermaths

Objective:
- derive translation and asset/config work from the save diff without coupling them

Required changes:
1. compute `textDiff`, `assetDiff`, and `configDiff` independently
2. trigger translation aftermath only from `textDiff`
3. trigger asset/config aftermath only from `assetDiff` / `configDiff`
4. do not let one pipeline become the gatekeeper for the other

Done when:
- text-only save does not force asset work unless asset refs changed
- asset-only save does not start translation
- mixed save can run both aftermaths without one redefining the other

### Phase 5 — Make translation automatic and publish-status independent

Objective:
- make translation editor-visible from save, regardless of live status

Required changes:
1. start translation aftermath automatically from save when translatable base content changed
2. target locales from the bootstrap snapshot already loaded in Roma
3. surface translation progress/result in the editor without a second write action
4. keep publish status out of the decision to translate

Done when:
- unpublished instance save updates editor translation state automatically
- published instance save updates editor translation state automatically
- publish status only decides whether completed locale results also sync publicly

### Phase 6 — Keep publish/unpublish explicit in Roma widgets domain

Objective:
- make live status ownership explicit and separate from save

Required changes:
1. Roma `widgets` domain owns publish/unpublish controls and status
2. Bob does not own publish/unpublish
3. publish/unpublish updates live/public pointers only

Done when:
- publish/unpublish can be initiated from Roma `widgets` domain without Bob owning the action
- save on a published instance refreshes live/public output without a second publish click
- save on an unpublished instance never turns the instance live

### Phase 7 — Cleanup drift

Objective:
- remove DB-centric and Paris-centric assumptions from the product path

Required changes:
1. remove dead Bob translation-refresh UX
2. remove dead Paris/Michael proxy code from normal base-instance save path
3. remove stale comments/docs/naming that describe the old model, only after runtime cutover is in place
4. remove compatibility aliases / duplicate routes that preserve old open/save behavior under a different path

Done when:
- no normal base-instance save path proxies through Paris
- no normal base-instance save path recenters Michael/Supabase as the save hub
- no compatibility alias or duplicate editor route exists to preserve prior behavior

---

## Save Contract (Hard Lock)

Save is not a DB-first workflow.
Save is not a publish workflow.
Save is a diff against the current saved Tokyo revision.
Save has one diff base and exactly 2 independent aftermath checks.

Required request shape:
- current editor state
- `expectedSavedRevision` (or equivalent optimistic concurrency token)

Required response shape:
- `savedRevision`
- diff summary: `textChanged`, `assetChanged`, `configChanged`
- current live status
- automatic aftermath metadata:
  - translation aftermath started / not started
  - translation target locales derived from Roma bootstrap snapshot
  - asset/config aftermath started / not started
  - live sync accepted / not needed

Response must not include:
- refreshed entitlements
- refreshed policy
- any signal that Bob must ask Paris whether save was allowed after the fact

Required save evaluation order:
1. compare current editor state against the current saved Tokyo revision
2. persist the next saved Tokyo revision if a diff exists
3. run text/translation aftermath only if `textDiff` is non-empty
4. run asset/config aftermath only if `assetDiff` or `configDiff` is non-empty
5. if current status is `published`, sync the saved revision to live/public Tokyo pointers automatically
6. if current status is `unpublished`, do not create or update live/public output

Hard rule:
- save never flips live status
- save may start translation aftermath automatically
- save must not fetch a fresh locale list in the hot path; it uses the locales already loaded in Roma bootstrap
- save must not recenter Michael/Supabase as the comparison base or transport hub
- save must not ask Paris whether the user/account session is allowed
- save boundary must authorize from server-verifiable session material issued at bootstrap, not from client-carried policy JSON
- save may refresh live/public output automatically only when current status is `published`

---

## Publish Contract (Hard Lock)

Publish/unpublish is a status change, not a workflow.

Publish request:
- target `publicId`
- explicit publish intent

Publish result:
- live status is now `published`
- live/public pointer metadata

Unpublish request:
- target `publicId`
- explicit unpublish intent

Unpublish result:
- live status is now `unpublished`
- live/public pointer removal metadata

Hard rule:
- publish/unpublish does not become a generic save endpoint
- publish/unpublish must not call Paris to re-resolve entitlements for the current logged-in session
- publish/unpublish must authorize from server-verifiable session material issued at bootstrap, not from client-carried policy JSON

---

## Acceptance Gates

All gates are mandatory.

### Gate A — Bootstrap isolation

After Roma bootstrap succeeds:
- Bob can open/load instance even if Paris becomes unavailable
- Bob can stay open and save even if Paris becomes unavailable
- save uses locales already loaded in bootstrap, not a new locale fetch
- asset list/upload/delete still work if Paris becomes unavailable
- Bob/Roma continue to allow or deny actions from the already loaded entitlement snapshot
- no normal operation calls Paris to ask whether the action is allowed
- no normal operation response refreshes entitlements/policy

### Gate B — Save / Discard semantics

1. open instance
2. make first local edit
3. verify `Discard` and `Save` appear
4. click `Discard`
5. verify loaded state is restored exactly and dirty state clears

### Gate C — Non-text save on published instance

For a published instance:
1. edit non-translatable config or asset refs
2. save
3. verify:
   - save diff base was Tokyo saved revision
   - no translation aftermath started
   - Tokyo config/asset artifacts updated as needed
   - public/live output updates automatically after system sync / CDN propagation
   - no explicit publish action was required

### Gate D — Text save on unpublished instance

For an unpublished instance:
1. edit translatable base text in more than one place
2. save
3. verify:
   - save diff base was Tokyo saved revision
   - translation aftermath started automatically
   - translation targeted locales already loaded in Roma bootstrap
   - editor locale state updates when translation completes
   - no public/live surface changed

### Gate E — Text save on published instance

For a published instance:
1. edit translatable base text
2. save
3. verify:
   - base live/public output updates automatically
   - translation aftermath started automatically
   - localized public/live output updates when translation completes
   - no explicit publish action was required for either base or locale update

### Gate F — Translation / asset independence

1. perform a text-only save
2. verify asset/config pipeline did not run beyond what the text diff required
3. perform an asset-only save
4. verify translation aftermath did not start
5. perform a mixed save
6. verify both aftermaths ran from the same Tokyo diff base without one owning the other

### Gate G — Publish ownership

Verify that:
- Roma `widgets` domain is the publish/unpublish owner surface
- Bob does not own publish/unpublish
- save never flips live status

### Gate H — Public isolation

For a published instance:
1. make an unsaved editor change
2. load public surfaces
3. verify public surfaces are unchanged
4. save
5. load public surfaces again
6. verify public surfaces changed only through Tokyo live/public sync

### Gate I — No DB-centric save drift

Verify that:
- normal base-instance save does not use Michael/Supabase as the save diff base
- normal base-instance save does not proxy through Paris
- public runtime does not read current editable state from Michael/Supabase

### Gate J — Session entitlement isolation

Verify that:
- login/account bootstrap loads the entitlement snapshot once for the current `user x account` session
- account switch or authz expiry triggers re-bootstrap
- normal Bob/Roma operations do not call Paris to ask whether they are allowed
- local viewer/update/upsell gating continues to work from the bootstrapped session snapshot
- normal operation responses do not refresh policy/entitlements
- save/publish boundaries do not trust client-carried policy JSON

---

## Hard Failure Conditions

PRD 061 is not complete if any of these remain true:

1. normal base-instance save still diffs against Michael/Supabase instead of Tokyo
2. normal base-instance save still routes through Paris
3. any normal logged-in Bob/Roma operation still calls Paris to ask whether it is allowed
4. any normal operation response still refreshes policy/entitlements mid-session
5. save/publish boundaries still trust client-carried policy JSON instead of server-verifiable bootstrap session material
6. product editor still exposes a separate translation action
7. translation availability in the editor still depends on `published` / `unpublished`
8. asset-only save still triggers translation aftermath
9. save does not evaluate text/translation and asset/config as 2 independent checks from the same Tokyo diff base
10. save on a published instance still requires a second publish click to update public/live output
11. save on an unpublished instance changes public/live output
12. save still flips live status
13. public runtime still reads current editable state from Michael/Supabase
14. any compatibility alias / duplicate route remains in place for old editor open/save behavior

---

## Success Definition

PRD 061 is complete when the product path behaves like this:

1. user enters Roma
2. Roma bootstraps once for the current `user x account` session, including entitlements and enabled locales
3. Bob uses that bootstrapped session snapshot for all allow/deny decisions
4. Bob edits locally in memory
5. first edit reveals `Discard` and `Save`
6. `Discard` restores the loaded saved revision
7. `Save` diffs against the current saved Tokyo revision
8. `Save` performs exactly 2 independent checks from that same Tokyo diff base:
   - text/translation
   - asset/config
9. text diff updates translation state automatically for locales already loaded at Roma bootstrap
10. asset/config diff updates Tokyo automatically
11. Paris is never called mid-session to decide whether the operation is allowed
12. published status only controls public/live sync
13. publish/unpublish remains an explicit status change in Roma `widgets` domain

That is the intended architecture, and that is the convergence target for this PRD.
