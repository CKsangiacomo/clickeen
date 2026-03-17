# Runtime Profiles

`bash scripts/dev-up.sh` supports exactly two local runtime profiles.

## product (default)

- Purpose: product parity workflows with one cloud-dev data plane.
- Runs locally: DevStudio UI shell (`:5173`) and Bob (`:3000`).
- Uses cloud-dev services by default:
  - Tokyo: `https://tokyo.dev.clickeen.com`
  - Berlin: `https://berlin-dev.clickeen.workers.dev`
  - Paris: `https://paris.dev.clickeen.com`
- Local Tokyo/Tokyo-worker are not part of this default workflow.
- DevStudio still boots from the local widget catalog in this profile; platform-owned instance discovery, boot, save, and localization all flow through the explicit local DevStudio route family against the cloud-dev Tokyo/Berlin plane.
- DevStudio product mode uses local Bob so the editor never crosses a cloud-iframe-to-localhost browser boundary.

## source

- Purpose: low-level service development and local worker debugging.
- Runs full local stack (Tokyo, Tokyo-worker, Berlin, Paris, Venice, Bob, DevStudio, Prague, Pitch, optional SanFrancisco).
- Uses local Tokyo default: `http://localhost:4000`.
- DevStudio should be opened with source params:
  - `/#/tools/dev-widget-workspace?profile=source&bob=http://localhost:3000&tokyo=http://localhost:4000`
- `bash scripts/dev-up.sh --source` is one-command local boot:
  - starts the full stack
  - seeds required DevStudio-visible local platform state
  - verifies the DevStudio/Bob localhost route lane before finishing
- Explicit rerun commands remain available:
  - `pnpm dev:seed:platform`
  - `pnpm dev:verify:platform`
- Source boot may seed deterministic local platform state, but it must do so through the canonical local seed scripts. Do not reintroduce ad hoc repair/sync logic into boot.
- Source-profile-only file mutation remains explicit:
  - `Update Theme` writes `tokyo/configs/themes.json`

## Rules

- The seeded platform-owned account in cloud-dev is `tier3` and is the unlimited profile for uploads/budgets.
- Product paths should use normal auth + account ownership checks.
- Any local trusted-token bypasses are source/internal tooling paths only, never browser product auth.
- DevStudio local theme mutation tools (`/api/themes/*`) are source-profile only.
