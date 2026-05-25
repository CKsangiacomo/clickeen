# PRD 103I - San Francisco Agent Runtime Cleanup

Status: Slice 103I.2 complete / Copilot package context carried
Owner: Product + Architecture
Date: 2026-05-17
Parent: PRD 103 - Instance Translation Agent Teardown And Rebuild
Depends on: PRD 103H

## 103J Course-Correction Note

103I remains valid as San Francisco cleanup history, but its active translation boundary is superseded where it says Roma save follow-up calls the agent directly. Current authority is `103J__PRD__Generic_Widget_Translation_System.md`: Bob explicitly starts Generate, Roma forwards the account request to Tokyo, Tokyo creates generic widget translation jobs, and San Francisco translates those jobs without FAQ-specific contracts.

## Purpose

Restart San Francisco cleanup as a teardown, not a new framework.

The product boundary is the Instance Translation Agent. The old text-value route is not an internal system, compatibility surface, or fallback. It must be removed from the active San Francisco API.

## Slice 103I.1 Contract

- Historical 103I path: Roma save follow-up calls only `/v1/agents/instance-translation/translate-saved-instance`.
- San Francisco exposes only the Instance Translation Agent route for account-widget translation.
- The old text-value route is removed.
- Local San Francisco account-widget translation code says `saved text graph` and `current language values`, not `Babel text producer` as the active concept.
- No new runtime framework.
- No static verifier layer.
- No provider-adapter rewrite.
- No Prague translation rewrite.

## Slice 103I.1 Acceptance

- San Francisco no longer imports, routes, or exposes `handleBabelTextValues`.
- The old text-value path is absent from active San Francisco source.
- The Instance Translation Agent still validates the saved-instance request and returns exact current-language values.
- Historical 103I path: Roma save follow-up still proves one changed FAQ field translates through the Instance Translation Agent and writes a complete Tokyo overlay.

## Slice 103I.1 Verification

- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/roma test`
- `pnpm --filter @clickeen/roma typecheck`
- Targeted source check: active San Francisco source has no old text-value route.

## Slice 103I.1 Result

- Removed the active San Francisco old text-value route.
- Removed `handleBabelTextValues` from San Francisco.
- Renamed active Roma save-follow-up files/functions away from Babel naming:
  - `roma/lib/account-instance-translation-jobs.ts`
  - `roma/lib/instance-translation-agent-client.ts`
  - `roma/lib/account-translation-policy.ts`
- Roma save still calls the Instance Translation Agent route.
- San Francisco account-widget translation code now uses `saved text graph` and `current language values` names.

## Slice 103I.2 Contract

Copilot must see the widget as a widget package, not as a list of compiled editor controls.

For this slice:

- Bob sends Copilot a `widgetPackage` for the active widget.
- The FAQ package includes package context for `content.json`, `spec.json`, `widget.html`, `widget.css`, and `widget.client.js` or their compiled safe equivalents.
- Roma forwards the package context to San Francisco for the Copilot request.
- San Francisco includes the package context in the Copilot prompt payload.
- Translation remains separate and uses only `content.json`-derived saved text graph/current language values.
- No new runtime framework.
- No static verifier layer.
- No generic package registry.
- No resurrection of per-field Copilot allowlists.

## Slice 103I.2 Acceptance

- The active Bob -> Roma -> San Francisco Copilot path carries `widgetPackage`.
- FAQ Copilot prompt payload includes package context for content, spec, markup, styles, and client behavior.
- Existing control/current-value context remains available as a compatibility input while Copilot gains package context.
- No active code reintroduces removed content-text naming, per-field Copilot allowlists, or the old text-value route.

## Slice 103I.2 Verification

- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/bob typecheck`
- `pnpm --filter @clickeen/roma typecheck`
- Targeted source check: active code has no removed content-text naming, per-field Copilot allowlists, or old text-value route.

## Slice 103I.2 Result

- Bob compiled widget payload now carries `widgetPackage`.
- For FAQ, the package contains `content.json`, `spec.json`, `widget.html`, `widget.css`, and `widget.client.js`.
- Bob sends `widgetPackage` with the Copilot request.
- Roma requires and forwards `widgetPackage` to San Francisco.
- San Francisco requires `widgetPackage` and includes package context in the Copilot prompt payload.
- San Francisco test proves FAQ Copilot prompt payload includes content, spec, markup, styles, and client behavior context.
- Translation remains separate: this slice did not change the Instance Translation Agent saved text graph/current language values flow.
- No runtime framework, static verifier layer, generic package registry, per-field Copilot allowlist, or old text-values route was added.
