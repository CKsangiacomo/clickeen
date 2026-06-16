# DevStudio Local Emulation Teardown Ledger

Status: Executed.
Date: 2026-06-10.
Source: follow-up to `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md` Step 7.

## Surviving Authority

- DevStudio evidence is the Berlin-authenticated Cloudflare Pages surface at
  `https://devstudio.clickeen.com`.
- Product authoring truth remains Roma -> Bob -> Tokyo.
- Cloud-dev runtime evidence comes from deployed Cloudflare services, not local
  Bob/Berlin/Tokyo emulation.
- Root `.env.local` remains operator secret/config material for Cloudflare
  helpers, preflights, and E2E utilities. It is not deleted or printed.
- The `tokyo/` tree remains product/deploy source for Dieter, widgets, Prague
  assets, fonts, themes, and R2 sync inputs.

## Executed Deletions

| Target                                         | Result                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/dev-up.sh`                            | Deleted. The one-command local Bob/Berlin/Tokyo support stack is retired.                                 |
| `tokyo/dev-server.mjs`                         | Deleted. The local Tokyo CDN stub and its local mutable upload route are retired.                         |
| `scripts/dev/generate-berlin-keys.mjs`         | Deleted. Local Berlin `.dev.vars` generation is retired.                                                  |
| `berlin/wrangler.toml` `[env.local]`           | Deleted. Cloud Berlin top-level config remains.                                                           |
| `tokyo-worker/wrangler.toml` `[env.local]`     | Deleted. Cloud Tokyo-worker top-level config remains.                                                     |
| `sanfrancisco/wrangler.toml` `[env.local]`     | Deleted. Cloud San Francisco top-level config remains.                                                    |
| Root `tokyo:*:local` scripts                   | Deleted. Tokyo sync scripts keep check/remote paths only.                                                 |
| Local R2 `--local`/`--persist-to` sync support | Deleted from Tokyo font/R2 sync helpers.                                                                  |
| `TOKYO_DEV_JWT` / `devstudio.local` bypass     | Deleted from Tokyo-worker account/asset authorization. Roma `roma.edge` account capsules remain required. |
| Ignored local state                            | Removed from the working tree: `Logs/`, `.wrangler/`, service `.wrangler/`, and `berlin/.dev.vars`.       |

## Vite Removal

DevStudio no longer uses Vite or Vitest:

- `admin/vite.config.ts` and `admin/vitest.config.ts` were deleted.
- `admin/src/jsdom-shim.d.ts` was deleted.
- `import.meta.glob` usage was replaced with generated registries.
- `admin/scripts/generate-static-registries.mjs` now creates static source
  registries for showcase HTML, icons, and component sources.
- `admin/scripts/build-static.mjs` bundles the Cloudflare Pages static app with
  esbuild into `admin/dist`.

## Docs And Guards

- Runtime docs now state that local Bob/Berlin/Tokyo emulation is retired.
- DevStudio docs now describe the static Pages bundle and generated registries
  instead of Vite.
- PR architecture gates now fail if the retired local emulation files are
  reintroduced.

## Deferred

- PRD 106D remains deferred by product decision.
- PRD 120 remains the next major policy-authority work; DevStudio Policy UI
  extensions happen after 120 defines schema authority.
