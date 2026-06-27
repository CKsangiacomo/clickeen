# 124D Implementation Note - Locale Artifact Materialization

Status: EXECUTED
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

## Closed Contract

- Overlay key representation: current saved-content concrete paths.
- Repeated fields: concrete expanded paths are supported only when the overlay
  key set exactly matches saved source fields. Reorder-safe token cascade is not
  claimed by 124D.
- Overlay body: exact `{ "values": Record<string, string> }`.
- Generated locale package coordinate:
  `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/`.
- Generated locale package files: `index.html`, `styles.css`, `runtime.js`.
- 124D does not expose public locale serving. 124E owns stored-byte public
  serving and CDN behavior.

## Code Execution

1. Tokyo package storage stayed inside the existing account-instance package
   domain:
   - `tokyo-worker/src/domains/account-instances/package-files.ts`
   - `tokyo-worker/src/routes/internal-instance-routes.ts`
   - `tokyo-worker/src/domains/account-instances/keys.ts`

   Tokyo now accepts exact locale package bytes through
   `PUT /__internal/instances/{instanceId}/locales/{locale}/package` and deletes
   those bytes through `DELETE` on the same route. The route is internal and
   Roma-account-capsule authorized. It does not add public serving.

2. Roma locale package materialization stayed Roma-owned:
   - `roma/lib/account-instance-locale-package.ts`
   - `roma/lib/account-instance-public-package.ts`

   Roma loads the saved instance through Tokyo, compiles widget software through
   the existing Bob route, reads one exact overlay through Tokyo, materializes
   package bytes with `@clickeen/ck-runtime-materializer`, and writes the exact
   bytes back through Tokyo.

3. Translation generation integration stayed explicit:
   - `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`

   The route calls Translation Agent overlay generation first. If the overlay
   command succeeds, Roma materializes generated locale packages for the same
   accepted active non-base locales. A materialization failure returns the
   translation result plus `localePackages` completed/skipped/failed coordinate
   evidence and does not claim full success.

4. Account active-locale settings integration stayed in the existing
   `overlayUpdate` follow-up channel:
   - `roma/app/api/account/locales/route.ts`

   Removed locales delete exact overlays and generated locale package files.
   Added locales generate exact overlays and then generated locale package
   files. Follow-up failure after settings save remains explicit through
   `overlayUpdate.ok: false`. Locale package failures include a structured
   `localePackages.failed` coordinate.

5. The materializer now stamps locale package `index.html` with the requested
   locale. Base package output remains unchanged because base requested locale
   equals base locale.

6. Tokyo rejects attempts to write a base locale as a locale package, and Roma
   rejects success when the materializer-generated package fingerprint differs
   from the Tokyo-stored package fingerprint.

## Evidence And Metadata

Tokyo stores locale package R2 custom metadata:

- `publicPackageFingerprint`
- `localePackageAccountPublicId`
- `localePackageInstanceId`
- `localePackageBaseLocale`
- `localePackageLocale`
- `localePackageSourceUpdatedAt`
- `materializerContractVersion`

Tokyo does not store overlay values in package metadata. Source/schema/overlay
fingerprints remain materializer evidence and are not persisted as lifecycle or
status truth in 124D.

## Verification

Green local checks:

- `pnpm --filter @clickeen/roma test:instance-package`
- `pnpm --filter @clickeen/tokyo-worker test:locale-package`
- `pnpm --filter @clickeen/roma typecheck`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm --filter @clickeen/ck-runtime-materializer typecheck`
- `pnpm --filter @clickeen/ck-runtime-materializer test`

Focused proof:

- one non-base locale materializes from source plus overlay;
- base locale package materialization is rejected;
- inactive locale package materialization is rejected;
- route-source checks prove translation generation and settings routes call the
  locale materializer helper;
- Tokyo behavioral storage test proves locale package files land at the 124A
  coordinate, include required metadata/content types, delete all three files,
  and reject base-locale package writes;
- command payload tests prove later-locale package failure returns
  completed/skipped/failed coordinates and settings package-delete failure uses
  a structured failed coordinate;
- route-source checks prove `clk.live` serving does not read locale packages in
  124D;
- package test coverage continues to prove missing and unexpected overlay keys
  fail explicitly.

Initial 124D review gate found blockers in Tokyo storage behavior testing,
structured settings failure coordinates, base-locale write rejection, and
fingerprint equality. These are now fixed and covered by the focused checks
listed above.

No deploy/runtime/R2 claim has been made for 124D yet.

## V1-V8 Local Audit

- V1 silent substitution: clean; missing overlay values are rejected.
- V2 silent healing: clean; invalid overlay/source/package bodies are not
  repaired.
- V3 silent omission: clean; generation response names locale package
  completed/skipped/failed coordinates.
- V4 fail-open control: clean; package write failure returns failure.
- V5 corruption-as-absence: clean; malformed source/overlay/package payloads
  fail.
- V6 partial-success masquerade: clean; later-locale failure does not claim full
  success.
- V7 masquerade/redress: clean; same command path is extended, not wrapped in a
  renamed side path.
- V8 runtime test dependency: clean; tests verify behavior but runtime product
  work does not depend on probes/status files.
