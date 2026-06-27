# 124F Implementation Note - Superseded Cascade Operations

Status: superseded by the PRD 126M Roma UI save/localization boundary correction.

This file is retained as historical context for the 124 runtime materializer
series. Its original save-time localization follow-up design is no longer current product
truth.

Current product law:

```text
Save = persist widget source truth and the base runtime package.
Generate/regenerate translations = explicit localization operation.
Locale packages = derivative runtime artifacts from current source + current overlays.
```

## Current Boundary

`PUT /api/account/instances/{instanceId}` saves the account instance source and
base package only. It does not generate translations, regenerate translations,
materialize locale packages, refresh locale public cache, or make authoring save
wait on localization follow-up.

`POST /api/account/instances/{instanceId}/translations/generate` owns explicit
translation generation from the Translations panel. After accepted overlay
generation, that same explicit localization command materializes matching locale
package bytes and reports exact package failure coordinates if package write or
public cache refresh fails.

`PUT /api/account/locales` remains the account locale settings command. It owns
its documented settings follow-up behavior.

## Verification

Current focused checks:

```bash
pnpm --filter @clickeen/roma test:instance-save-boundary
pnpm --filter @clickeen/roma test:instance-package
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/bob typecheck
pnpm typecheck
```

The boundary test protects the restored behavior:

- Roma source save does not run localization.
- Bob save has no partial localization branch.
- Explicit translation route and Translations panel action survive.
- Account instance persistence has no generic instance metadata contract.
- Account instance save has no invented request body-key whitelist.
