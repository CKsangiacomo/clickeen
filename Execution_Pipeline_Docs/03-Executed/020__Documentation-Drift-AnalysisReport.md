Documentation Drift Analysis Report
Scope: local repo snapshot (see git status for exact commit).

Executive Summary
The core system docs under `documentation/` are aligned with the current layered l10n and Prague content pipeline. The remaining drift is concentrated in PRDs and legacy notes under `Execution_Pipeline_Docs/00-Strategy` that still reference prague-strings, global l10n manifests, or the old `widget_instance_locales` schema. This can mislead new work back toward deprecated patterns.

Current Architecture (ground truth)
1) Instance l10n (runtime)
- Canonical store: Supabase `widget_instance_overlays` (layer + layer_key) with `user_ops` merged at publish time.
- Publish: tokyo-worker writes `tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json` and `tokyo/l10n/instances/<publicId>/index.json` (hybrid).
- No global l10n manifest and no daily republish; publishing is dirty-set via `l10n_publish_state`.

2) Prague marketing copy
- Base content: `prague/content/base/v1/**`
- Allowlists: `prague/content/allowlists/v1/**`
- Overlays: `tokyo/l10n/prague/<pageId>/locale/<locale>/<baseFingerprint>.ops.json` plus `index.json`
- Pipeline: `scripts/prague-l10n/translate.mjs`, `scripts/prague-l10n/verify.mjs`, `scripts/[retired]/prague-l10n-watch`
- Runtime: `prague/src/lib/pragueL10n.ts`
- Translation source: San Francisco `POST /v1/l10n/translate` (local only).

3) Docs already aligned (no action)
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`
- `documentation/capabilities/localization.md`
- `documentation/services/tokyo.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/services/prague/blocks.md`
- `documentation/services/sanfrancisco.md`
- `documentation/ai/infrastructure.md`
- `documentation/services/paris.md`

Drift Findings (Priority)
Critical: Prague localization PRDs still reference prague-strings and manifest-based paths.
- `Execution_Pipeline_Docs/00-Strategy/026__Localization_PragueCopy_Base_Overlays_Manifest.md`
- `Execution_Pipeline_Docs/03-Executed/021__Localization_PraguePages_Extension.md`
- `Execution_Pipeline_Docs/00-Strategy/009__PRD_Prague_Blocks_Components_Refactor.md`
Update to: `prague/content/**` base + `scripts/prague-l10n/*` + `tokyo/l10n/prague/**` overlays with `index.json`. Remove prague-strings and manifest references.

Critical: Instance l10n PRDs still reference `widget_instance_locales` and global manifest or daily republish.
- `Execution_Pipeline_Docs/00-Strategy/010__PRD_Version_Limits_Assets_Localization.md`
- `Execution_Pipeline_Docs/00-Strategy/014__Localization_Architecture_Update.md`
- `Execution_Pipeline_Docs/00-Strategy/008__PRD_System_User_Instance_Split.md`
- `Execution_Pipeline_Docs/00-Strategy/016__Blueprint_Layers_Personalization_Playbooks_Execution.md`
Update to: `widget_instance_overlays`, `l10n_publish_state` dirty-set queue, `l10n_overlay_versions`, deterministic overlay paths, and per-instance `index.json`. Remove references to a global l10n manifest or scheduled full republish.

Major: Execution plan status still includes completed prague-strings removal tasks.
- `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`
Update to mark completed and remove obsolete steps.

Recommendations
1) Update the PRDs above to match current architecture and remove manifest-era assumptions.
2) If any outdated PRDs are kept for history, mark them as superseded and link to the canonical docs.
3) Keep `documentation/` as the authoritative source; PRDs should link to `documentation/capabilities/localization.md` and `documentation/architecture/CONTEXT.md`.

Drift Summary
- Severity: Medium overall (core docs aligned; PRDs lagging).
- Main risk: PRD-driven work reintroducing deprecated pipelines or legacy schema assumptions.
