# 124F Implementation Note - Current Cascade Operations

Status: implemented locally

## Command Inventory

| Command | Source truth changed | Affected artifact coordinates | Owner | Response truth |
| --- | --- | --- | --- | --- |
| Create instance | new instance source | base package at `accounts/{accountPublicId}/instances/{instanceId}/` | Roma `POST /api/account/instances` | `201` with new instance id; no locale cascade because no overlays exist for the new coordinate |
| Save existing instance | existing instance source/base package | base package plus active non-base locale packages for the same instance | Roma `PUT /api/account/instances/{instanceId}` | `ok: true` with `localeCascade`, or `sourceSaved: true`, `ok: false`, and exact `localeCascade` failure |
| Duplicate instance | new instance source copied from source config | base package at new instance coordinate | Roma `POST /api/account/instances/{instanceId}/duplicate` | `201` with new instance id; overlays and locale packages are not copied |
| Generate translations | locale overlay values for one instance | same-locale package files under `locales/{locale}/` | Roma `POST /api/account/instances/{instanceId}/translations/generate` | generation response includes `localePackages` completed/skipped/failed |
| Save active locales | account active locale setting | removed locale overlay/package deletes or added locale overlay/package generation across saved instances | Roma `PUT /api/account/locales` | settings are saved; `overlayUpdate` names completed/skipped/failed follow-up and cost |
| Policy values | current account policy gates | no standalone policy cascade command in 124F | existing Roma account routes | policy limits gate current commands; no new policy watcher or fan-out |

## Source Save Cascade

`PUT /api/account/instances/{instanceId}` keeps the existing source/base order:

1. Load current account locale state.
2. Compile widget package.
3. Run save policy gate.
4. Materialize base public package.
5. Materialize source artifacts.
6. Save source/base package through Tokyo-worker.
7. If primary save succeeds, run active non-base locale cascade for that one
   instance.

The locale cascade calls the current translation-generation helper and the
current locale package materialization helper one active non-base locale at a
time, in deterministic active-locale order. The first failure stops later
locales and the response names the exact failed locale plus later locales not
attempted after the failure. It does not create a dependency graph, queue,
watcher, status file, repair job, or visitor-time fallback.

The bounded cost surface is:

```text
instances = 1
activeNonBaseLocales = active locale count excluding base
coordinates = 1 * activeNonBaseLocales
configuredActiveLocaleCap = l10n.locales.max
hostCommandTimeoutMs = 120000
```

If locale follow-up fails after the primary source/base save, the response is
not full success:

```json
{
  "ok": false,
  "sourceSaved": true,
  "error": { "reasonKey": "[reason key]" },
  "localeCascade": {
    "ok": false,
    "localePackages": {
      "completed": [],
      "skipped": [],
      "failed": {
        "accountId": "[account public id]",
        "instanceId": "[instance id]",
        "locale": "[locale]",
        "phase": "[translation-generation|overlay-read|materializer|package-write|cache-refresh]",
        "reasonKey": "[reason key]"
      }
    }
  }
}
```

After the June 26 audit correction, package helper failures caused by
`tokyo.errors.publicCache.*` are reported as phase `cache-refresh`. This names
the real failed phase when Tokyo has changed locale package bytes but cannot
refresh Cloudflare cache for a published instance.

Bob handles this response as saved source plus translation follow-up attention:
the submitted source signature becomes the saved signature, and the error is
shown through the Builder translation error surface.

## Active Locale Add/Remove Cascade

`PUT /api/account/locales` remains the account setting command. Roma saves the
account locale setting first, then runs exact follow-up for existing saved
instances returned by the current account instance list helper.

When locales shrink, Roma deletes exact overlay files and generated locale
package files. The response does not imply removed locales stopped serving
unless generated package deletion and the required public cache refresh succeed.

When locales expand, Roma generates overlays through Translation Agent and then
materializes generated locale packages for those same added locales. Added
locales are processed one locale at a time for each saved instance so a failure
names the exact `{ accountId, instanceId, locale, phase }` coordinate instead
of assigning a batch failure to an inferred locale.

`overlayUpdate.cost` records:

```text
instances = saved instance count returned by Tokyo
changedLocales = added non-base locales + removed non-base locales
coordinates = instances * changedLocales
configuredActiveLocaleCap = l10n.locales.max
hostCommandTimeoutMs = 120000
```

This is response evidence only. It is not persisted as status, readiness, or a
ledger.

## Policy Cascade

124F does not add a policy cascade engine. Current policy values affect artifact
work only through named commands:

- `widgets.types.max` gates create;
- widget package limits gate save and duplicate;
- `instances.published.max` gates publish;
- `l10n.locales.max` gates active locale settings and is recorded in source-save
  and active-locale cascade cost.

No current standalone upgrade/downgrade command with an exact affected
coordinate list exists in this slice, so no policy fan-out is implemented.

## Verification

Focused local checks:

```bash
pnpm --filter @clickeen/roma test:instance-save-cascade
pnpm --filter @clickeen/roma test:instance-package
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
pnpm typecheck
```

The tests cover:

- empty active locale source save skips cascade work;
- source save calls current translation and locale package helpers per locale;
- translation failure names exact failed and skipped coordinates without batch
  inference;
- locale package materialization failure preserves completed/skipped/failed
  package coordinates;
- cache-refresh failure preserves the failed package coordinate and names the
  `cache-refresh` phase;
- no broad dependency machinery was added;
- active-locale settings expose the bounded cost surface;
- Bob treats `sourceSaved: true` cascade failure as translation follow-up, not
  lost source edits.
