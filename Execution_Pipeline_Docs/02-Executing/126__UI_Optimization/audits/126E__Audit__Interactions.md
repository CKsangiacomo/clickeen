# 126E - Current-Source Gap Audit: Interactions

Status: STEP 6 COMPLETE - current source audited at tree `cd3324dfe220ee4af80061d6e3a98ce15490dbdc`; no step-9 execution credit.
PRD: `../126E__PRD__Interactions.md`.

This audit replaces the frozen point-in-time 126E audit. It separates behavior
that is already correct from the one proven remaining interaction gap. It does
not authorize a generic interaction framework, global state store,
toast/snackbar system, dialog framework, copy registry, or product-data change.

## Authority

- Product behavior: `126E__PRD__Interactions.md` and
  `documentation/engineering/UI/interactions.md`.
- Account/session coordinate: Roma current account and Bob's open editor
  session.
- Command truth: Roma same-origin account routes and Bob's typed account-command
  bridge.
- Dialog mechanics: 126K and
  `documentation/engineering/UI/dialogs-and-modals.md`.
- Roma screen/component consumption: 126M.
- Persisted product data: out of scope; 126E must not rewrite account, widget,
  translation, asset, or page data.
- Verification: current source, focused Bob/Roma checks, and later browser
  evidence from the owning outer-screen slice.

## Commands And Scope Read

```bash
git show --stat 0c71faa9
rg -n "Upgrade|upgrade|/billing|UPGRADE_REQUIRED|upsell" roma/components bob/components
rg -n "useState|Loading|Refreshing|Unavailable|role=|Saving|failed|success" roma/components/*-domain.tsx
rg -n "reasonKey|coreui\.errors|role=\"alert\"|role=\"status\"" bob/components bob/lib/session roma/components
pnpm --filter @clickeen/bob test:translations-panel
pnpm --filter @clickeen/roma test:widget-command-gates
```

Step 6 ran both focused checks. Bob's translation suite passed. Roma's widget
command-gate suite also passed, but its final assertion says
`PASS Bob upsell CTA routes to billing without raw detail copy`; that is negative
evidence because the test faithfully protects the D3 behavior that execution
must delete. No source or runtime state was mutated.

## Current Truth: Preserve, Do Not Rebuild

| Surface | Current evidence | Step-9 disposition |
| --- | --- | --- |
| Roma account boundary | `roma-account-context.tsx` and `use-roma-me.ts` own loading, auth redirect, retryable account failure, no-context/reload, then render. | Preserve. Do not add a global state model. |
| Static Roma domains | `home-domain.tsx`, `ai-domain.tsx`, and `billing-domain.tsx` have no local async command. | Account-shell state is sufficient. Do not add fake loading/empty states. |
| Widgets | `widgets-domain.tsx:73-83`, `:96-123`, and `:381-404` distinguish pending action, loading, refreshing, recoverable error, and empty catalog. | Preserve all state behavior. Only the Upgrade destination remains wrong. |
| Assets | `assets-domain.tsx:23-32`, `:266-343`, and `:458-509` already expose per-file status, aggregate progress, partial success, failure details, and terminal close. | Preserve. Do not rebuild bulk upload or add a new progress subsystem. |
| Pages | `pages-domain.tsx:130-145` and `:583-793` distinguish loading, refreshing, command error, empty, unavailable publishing, pending save, and low-risk transient copy status. | Preserve. Publishing availability is product scope, not a 126E interaction rewrite. |
| Settings/team/profile | Their local commands already expose pending labels, durable errors, and confirmed results; mapped reason keys stay behind user copy. | Preserve. No shared command-state abstraction. |
| Usage | `usage-domain.tsx:17-24` and `:60-85` show an explicit load error and an unavailable value instead of silently presenting zero. | Preserve. Do not invent usage data or retry machinery. |
| Widget Defaults | `widget-defaults-domain.tsx:296-325` and `:577-695` distinguish loading, contract failure, dirty, blocked save, and saving. | Preserve. Contract work belongs to the owning widget-defaults path. |
| Account notice | `roma-account-notice-modal.tsx:78-95` keeps dismissal pending and failure visible. | Preserve; 126K owns its modal lifecycle. |
| Bob Save | `TopDrawer.tsx:14-48` hides Save when clean, shows it when dirty, shows `Saving...` in flight, and hides after reconciliation. `useSessionSaving.ts:45-116` clears dirty state only after confirmed persistence and signature reconciliation. | Regression-only. Do not edit or reschedule. |
| Translation feedback | `TranslationsPanel.tsx:92-203` derives terminal success/warning/error from the command result; `:251-272` uses Agent Activity only while work runs; `:349-384` preserves durable terminal feedback after activity ends. | Regression-only. Do not reconnect translation to Save or add polling/status theater. |
| Copilot | `CopilotPane.tsx` keeps conversational pending/result feedback, confirmed apply, and undo. | Preserve. Do not add fake Agent Activity. |
| Bob error copy | `ToolDrawer.tsx:13-49` maps known Builder reasons and hides implementation prefixes behind surface fallback copy. | Preserve. Do not create a mega-map. |
| Living docs | UI interactions, Bob, Roma, and dialogs docs already contain the accepted D1/D3 law and no longer describe toast doctrine or Save-triggered translation. | Update only ownership/provenance if Step 9 changes behavior. |

## One Proven Remaining Product Gap

The pre-GA Upgrade action still performs the behavior the product owner rejected.

1. `roma/components/widgets-domain.tsx:591-621` renders the current plan-limit
   prompt. Its `Upgrade` action is a `Link` to `/billing`.
2. `roma/components/builder-domain.tsx:780-782` receives Bob's typed
   `bob:upsell` intent, invokes `confirmDiscardBuilderEdits()`, and routes to
   `/billing`.
3. `roma/tests/run-widget-command-gates.ts:68-89` explicitly requires that old
   discard-and-route behavior.
4. No Roma-owned upsell scaffold component exists.
5. `bob/components/UpsellPopup.tsx:57-68` already sends the typed Upgrade intent
   and closes its local plan-limit prompt. Its reason copy is mapped; Bob must
   not gain a duplicate scaffold.
6. Ordinary `Open billing` navigation in `settings-domain.tsx` is truthful
   current-plan navigation and remains.

Assets is not a third D3 entry point. Its current limit/failure surface has no
user-triggered `Upgrade` command. This audit therefore preserves its explicit
inline result and does not authorize an invented Assets command or scaffold
transition.

The target is one in-place Roma scaffold with no commercial operation. The
Widgets prompt transitions to it in the same dialog layer. Bob's intent opens
the same scaffold without discard confirmation or navigation. Route/policy 402
enforcement remains unchanged.

## Ownership And No-Overlap Map

| Concern | Owning execution slice | 126E role |
| --- | --- | --- |
| Interaction meaning: Upgrade opens one honest pre-GA destination and preserves work | 126E doctrine | Defines acceptance only. |
| Dialog lifecycle, Escape/backdrop, focus containment, return focus, and no modal stacking | 126K | 126E does not implement dialog mechanics. |
| `RomaUpsellScaffold`, Widgets prompt transition, Bob host-intent transition, and Roma tests | 126M | 126E supplies exact product assertions; 126M edits the screen files once. |
| Bob local plan-limit prompt and typed `bob:upsell` message | Preserve in Bob; 126K may adjust mechanics only if its final audit proves a gap | No duplicate scaffold and no change to command transport. |
| Route/policy enforcement and 402 payloads | Existing product routes | No route or policy edits. |

This assignment prevents 126E from building a temporary screen/modal that 126K
or 126M would immediately rewrite. The final integrated Step-9 plan must carry
the D3 assertions into 126M and leave the files below out of the 126E write set.

## Exact 126E Write And Delete Map

### 126E product-code write set

None.

126E is a behavioral authority layer. Current Save, translation, Copilot, bulk
upload, state, and reason-copy behavior already satisfy it. The one remaining
consumer gap is assigned once to 126M after 126K settles dialog mechanics.

### Later 126M write set required by this audit

- `roma/components/widgets-domain.tsx`
- `roma/components/builder-domain.tsx`
- one small Roma-owned upsell scaffold component
- `roma/tests/run-widget-command-gates.ts`
- Roma/UI service docs only if final component naming changes current doctrine

### Exact behavioral deletions in 126M

- Delete the Widgets `Upgrade` link to `/billing`.
- Delete `confirmDiscardBuilderEdits()` from the `bob:upsell` branch only.
- Delete `router.push('/billing')` from the `bob:upsell` branch only.
- Delete the test assertion that requires the old discard-and-route behavior.

### Explicit no-touch set for 126E and D3

- Bob Save/session persistence files.
- Bob translation generation and preview files.
- Copilot operation files.
- Asset upload implementation.
- Assets limit/failure copy and command surface; a future Assets Upgrade command
  requires separate product law.
- Roma account command routes, policy, entitlements, and 402 payloads.
- Tokyo, Berlin, San Francisco, R2, Supabase, widget source, and public runtime.
- `tokyo/product/widgets/shared/socialShare.js` local copy status.
- Ordinary Billing navigation and the read-only Billing screen.

## Current Reason-Key Finding

No direct raw `reasonKey` JSX output remains in the audited product surfaces.
Current user-facing boundaries map or suppress implementation keys:

- Roma account surfaces use `account-shell-copy.ts` or local bounded maps.
- Bob ToolDrawer hides `coreui.*`, `HTTP_*`, and internal session prefixes.
- Bob Upsell, Translations, and Copilot use bounded product copy.
- Unknown implementation keys fall back to surface-owned copy.

The old audit's broad “consolidate all reason-key copy” action is therefore
removed. Local maps remain because their product language differs by surface.
A shared mega-map would increase coupling without solving a current failure.

## V1-V8 Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | PASS | No invented success, usage value, progress, or upgrade destination is accepted. |
| V2 Silent healing | PASS | Interaction work does not rewrite invalid persisted state. |
| V3 Silent omission | PASS | Current domain states were classified; the one remaining D3 gap is explicit. |
| V4 Fail-open control | PASS | Product routes/policy retain enforcement; UI remains feedback, not control. |
| V5 Corruption-as-absence | PASS | Corrupt/invalid state remains error/validation truth, not empty state. |
| V6 Partial-success masquerade | PASS | Translation and bulk upload retain explicit partial/failure outcomes. |
| V7 Masquerade/redress | PASS | `/billing` routing is deleted, not renamed or wrapped; one scaffold is owned once. |
| V8 Runtime test dependency | PASS | Tests verify behavior; normal product work does not depend on them. |

## Step-6 Verdict

GREEN for Step 6. Current source proves that 126E does not need a broad
interaction refactor. It needs a narrow ownership correction in the final plan:
preserve already-correct interaction behavior, and execute the one D3 consumer
change once in 126M using 126K mechanics.
