# Runtime Profiles

`bash scripts/dev-up.sh` supports exactly two local runtime profiles.

## product (default)
- Purpose: product parity workflows with one cloud-dev data plane.
- Runs locally: DevStudio UI shell (`:5173`).
- Optional local process: Bob (`CK_PRODUCT_LOCAL_BOB=1`).
- Uses cloud-dev services by default:
  - Bob: `https://bob.dev.clickeen.com` (default from DevStudio)
  - Tokyo: `https://tokyo.dev.clickeen.com`
  - Berlin: `https://berlin.dev.clickeen.com`
  - Paris: `https://paris.dev.clickeen.com`
- Local Tokyo/Tokyo-worker are not part of this default workflow.
- DevStudio still boots from the local widget catalog in this profile; instance rows come from the admin account through the trusted local route, which resolves through local Paris in product profile.

## source
- Purpose: low-level service development and local worker debugging.
- Runs full local stack (Tokyo, Tokyo-worker, Berlin, Paris, Venice, Bob, DevStudio, Prague, Pitch, optional SanFrancisco).
- Uses local Tokyo default: `http://localhost:4000`.
- DevStudio should be opened with source params:
  - `/#/tools/dev-widget-workspace?profile=source&bob=http://localhost:3000&tokyo=http://localhost:4000`
- Source-profile-only file mutation remains explicit:
  - `Update Config` writes `tokyo/widgets/*/spec.json`
  - `Update Theme` writes `tokyo/configs/themes.json`

## Rules
- Admin account in cloud-dev is `tier3` and is the unlimited profile for uploads/budgets.
- Product paths should use normal auth + account ownership checks.
- Any local trusted-token bypasses are source/internal tooling paths only, never browser product auth.
- DevStudio local file mutation tools (`/api/widget-spec-defaults`, `/api/themes/*`) are source-profile only.
