# System: Bob — Widget Builder (includes Studio)
## Identity
- Tier: Core
- Purpose: Configuration UI, live preview, inline editing
## Interfaces
- Builder UI; Studio scaffolding lives in `apps/app/app/builder-shell/` and serves Bob at `/studio` (iframe loads `/dieter/components.html`)
## Dependencies
- Depends on: Paris, Michael, Dieter, Copenhagen
## Deployment
- c-keen-app
## Rules
- Studio shell imports NO Dieter CSS directly; only the iframe does
- Bob’s panels/tooling run Dieter React components inside Studio; widgets previewed/output remain SSR HTML (no React shipped to customer sites).
- Preview harness CSS lives under `tests/styles/`; do not place preview/layout helpers inside `dieter/components` or any shipped workspace package.
## Links
- Back: ../../CONTEXT.md
