# PRD 124F - Current Cascade Operations

Status: SUPERSEDED / HISTORICAL
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Owner: Roma account commands

## Supersession

This PRD is superseded by the current source-save/localization boundary.

The original 124F plan included save-time localization follow-up for active
non-base locales. That direction is no longer current product law.

Current product law:

- Bob save is source/base persistence only.
- Roma source save writes account instance source and the base package.
- Source save does not generate translations.
- Source save does not regenerate translations.
- Source save does not materialize locale packages.
- Source save does not refresh locale public cache.
- Source save does not return locale follow-up coordinates.

Current localization ownership:

- Bob Translations panel owns the explicit Generate translations action.
- Roma translation generation route owns the explicit translation command.
- Translation Agent owns overlay generation.
- Roma locale package helper materializes generated locale packages after
  accepted overlay generation.
- Account locale settings own their own active-locale add/remove follow-up.
- Tokyo-worker owns stored-byte public serving and public cache refresh for
  published locale package write/delete.

## Historical Value

The useful surviving part of 124F is the direct-command principle:

```text
the command that changes truth must name the affected coordinates it owns
```

That principle remains current, but not for save-time localization work.
Generate translations and account locale settings are the commands that own
locale overlay/package follow-up.

## Current Verification Surfaces

Current verification for the superseded boundary lives in focused runtime tests:

- `pnpm --filter @clickeen/roma test:instance-save-boundary`
- `pnpm --filter @clickeen/roma test:instance-package`
- `pnpm --filter @clickeen/tokyo-worker test:locale-package`
- `pnpm --filter @clickeen/tokyo-worker test:clk-live`
- `pnpm --filter @clickeen/ck-runtime-materializer test`

## Current Docs

Current-system truth is documented in:

- `documentation/services/bob.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/localization.md`
- `documentation/architecture/OverlayArchitecture.md`

This file is historical only. It must not be used as authority to reintroduce
save-time translation generation, save-time locale package materialization, or
save-time cache refresh.
