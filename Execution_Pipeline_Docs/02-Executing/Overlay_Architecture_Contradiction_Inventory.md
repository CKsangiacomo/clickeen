# Overlay Architecture Contradiction Inventory

Status: UPDATED AFTER SERVE-STATE SLICE  
Date: 2026-03-24  
Owner: Product Dev Team

Canonical references:
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/capabilities/localization.md`

---

## What This Is

This is a bounded repo-wide contradiction inventory for overlay execution after the 2026-03-24 publish-semantics clarification.

Update 2026-03-24:

- The dedicated serve-state authority slice is now closed in code and canonical docs.
- Tokyo serve-state now owns widgets status, publish/unpublish, published-instance fanout, and save-aftermath live routing on the active product path.
- Save should now be described in product terms as one handoff to Tokyo-worker. Any transport details behind that handoff must not become new product concepts.
- The deletion pass that followed the serve-state slice is now closed:
  - public/product l10n control routes no longer admit legacy `layer='user'`
  - Michael core-row helpers no longer surface instance `status` as active product truth
- This document remains useful as residual audit context, but it is no longer the blocking gate for the next localization slice.

It is not a full repo cleanup.
It is not a historical rewrite.
It is an execution gate:

- scan wide
- block narrow
- close only the contradictions that can mislead the next implementation slice

The buckets are:

- `P0 now` = must be closed before overlay execution continues
- `cleanup after slice` = contradictory, but not worth blocking the next code slice
- `historical / do not use` = old material that must not be treated as current authority

---

## Execution Gate

Before the next overlay code slice, these things must be true:

1. Canonical docs and active plans must treat `published` / `unpublished` as Tokyo-owned per-instance serve state only.
2. Canonical docs must not teach Michael row status as the surviving publish/unpublish authority.
3. Overlay/localization docs must not treat unpublish as shorthand for purging saved/overlay authoring state.
4. Product-path code must converge from Michael row status residue to Tokyo serve-state authority.
5. Everything else may be inventoried and deferred.

---

## Closed In Serve-State Slice

| Area | Evidence | Contradiction | Why It Blocked Execution | Closure |
| --- | --- | --- | --- | --- |
| Canonical architecture docs | `documentation/architecture/CONTEXT.md`, `documentation/architecture/Overview.md`, `documentation/architecture/OverlayArchitecture.md` | The repo previously overloaded `published` / `unpublished` as broader lifecycle/status-shell truth instead of Tokyo-owned per-instance serve state | This caused every follow-up slice to preserve the wrong authority graph | Closed: canonical docs now define publish/unpublish as Tokyo serve-state only and demote Michael status to cutover residue |
| Product-path code | `roma/lib/michael-instance-rows.ts`, `roma/components/use-roma-widgets.ts`, `roma/components/widgets-domain.tsx` | Widgets-domain status flowed through Michael row status in product code | This preserved the wrong publish authority in the user-facing shell | Closed: widgets-domain status now derives from Tokyo serve-state via Roma/Tokyo control helpers |
| Product-path code | `roma/app/api/account/instances/[publicId]/publish/route.ts` and `roma/app/api/account/instances/[publicId]/unpublish/route.ts` | Publish/unpublish routes wrote Michael status rows as primary product action | This kept relational residue in the critical-path authority position | Closed: publish/unpublish now operate on Tokyo live truth and no longer write Michael status rows |
| Product-path code | `roma/lib/account-locales-sync.ts` | Localization fanout used Michael/widget-catalog publish residue and excluded unpublished account-owned widgets | Overlay convergence was still coupled to widget-management residue instead of the real account-owned instance set plus Tokyo serve-state | Closed: locale fanout now targets all account-owned saved instances, derives `live` per Tokyo serve-state, and excludes curated starter instances |
| Active execution plan | `Execution_Pipeline_Docs/02-Executing/075E__ExecutionPlan__Localization_Must_Not_Tax_Every_Builder_Session.md` | The plan was written before the serve-state clarification and assumed the next slice was pure localization execution | Implementers would keep stepping around the wrong surviving authority | Closed: the plan now records the serve-state reset as executed and points the next slice back to narrower localization work |
| Capability/service docs | `documentation/capabilities/localization.md` and `documentation/services/tokyo-worker.md` | Unpublish was described as deleting whole Tokyo l10n/runtime subtrees instead of turning public serving off | This overcoupled overlay/internal state to the serve flag | Closed: docs now distinguish serve-state off from hard delete |

| Product-path code | `roma/lib/account-locales-sync.ts` | One broken saved widget could still abort locale fanout for all healthy widgets | Account locale changes could remain stale across healthy widgets because the run failed closed on the first non-404 saved-document read error | Closed: locale fanout now fails open per instance, keeps healthy targets in the run, surfaces non-404 saved-document issues as per-instance warnings, and keeps 404 historical residue silent |

---

## Cleanup After Slice

| Area | Evidence | Contradiction | Why It Can Wait |
| --- | --- | --- | --- |
| Prague service docs | `documentation/services/prague/prague-overview.md:106-108` | Prague verification docs still advertise best-available/warn-first posture | Prague is not the current account authoring hot path |
| San Francisco service doc | `documentation/services/sanfrancisco.md:87-90` | Still says `layer=user` remains and is merged at publish time | Service doc drift is real, but not the first execution blocker once canonical capability docs are fixed |
| Strategy doc | `documentation/strategy/Clickeen-Babel.md:514-545` | Still teaches safe-stale runtime and older Paris/Michael framing | Strategy docs should not gate the next product slice once canonical architecture/capability docs are closed |

---

## Historical / Do Not Use

These files may still contain useful context, but they must not be treated as current authority for overlay execution:

| Area | Evidence | Why it is not a current authority |
| --- | --- | --- |
| Older overlay PRD | `Execution_Pipeline_Docs/02-Executing/070B__PRD__Tiered_Translation_Truth_And_Runtime_Closure.md:183-191` | It says every future overlay dimension must use one durable work item and one reconciliation loop; the current canonical architecture now narrows that default to system-generated layers |
| Older overlay PRD | `Execution_Pipeline_Docs/02-Executing/070B__PRD__Tiered_Translation_Truth_And_Runtime_Closure.md:938-944` | Useful as early overlay direction, but superseded by `OverlayArchitecture.md` for current execution |
| Executed / strategy long tail | `Execution_Pipeline_Docs/00-Strategy/**`, `Execution_Pipeline_Docs/03-Executed/**`, `documentation/strategy/**` | These files still contain mixed models (`layer=user`, best-available, safe-stale, Paris-owned residue). They are reference material, not execution authority |

---

## Explicit Non-Blockers

These came up in the scan but should not block the next slice:

- `documentation/services/venice.md:114-121`
  - Uses “effective locale” wording, but the logic is explicitly constrained to `readyLocales`. This is not the same as best-available fallback.
- `tokyo-worker/src/domains/render.ts`
  - `ensureSavedRenderL10nBase()` still exists, but that is not itself a contradiction. It is only a problem when used on a consumer read path.

---

## Recommended Next Order

1. Keep the serve-state authority closed:
   - do not reintroduce Michael row status into widgets, publish/unpublish, or fanout logic
2. Keep save ownership language closed:
   - `Save` = user saves the instance
   - Tokyo-worker reconciles the instance and derived artifacts
   - do not explain or rebuild the product around transport residue
3. Resume the narrower overlay/localization slice on top of the closed authority:
   - translations panel
   - durable work-item lifecycle/status truth
   - ready-only locale exposure
4. Continue treating strategy/historical docs as non-authoritative reference material

That is the bounded pre-execution sweep.
Anything broader becomes meta-work.
