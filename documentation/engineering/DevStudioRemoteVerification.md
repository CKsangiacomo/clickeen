# DevStudio Remote Verification

Status: Slice 0A verification scaffold

## Remote-Only Target

DevStudio's canonical internal URL is:

```text
https://devstudio.clickeen.com
```

DevStudio remote auth belongs to Berlin/Google. Do not add Cloudflare Access,
DevStudio-local users, local auth bypasses, or alternate account/session models.

Browser automation must not automate Google OAuth. When DevStudio e2e coverage is
added, it must use the same dev-only session bootstrap shape as the repo Playwright
harness:

```bash
E2E_BASE_URL=https://devstudio.clickeen.com \
E2E_AUTH_STATE=e2e/.auth/devstudio.json \
pnpm e2e
```

That points Playwright global setup at `POST /api/e2e/session` on the configured
base URL and stores a host-specific state file for DevStudio. Roma's default e2e
target remains `https://roma.dev.clickeen.com`.

## Package Commands

DevStudio verification is owned by `@clickeen/devstudio`:

```bash
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio test
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

The CI scaffold in `.github/workflows/devstudio-verify.yml` runs those commands for
DevStudio pull requests. It does not deploy DevStudio and does not touch Berlin auth
or Pages Functions.

## Current Notes

These notes are real as of Slice 0A and must stay visible until the next
DevStudio cleanup slice:

- `pnpm --filter @clickeen/devstudio lint` passes, with warnings from the existing
  Bob Native husk. That husk remains a migration deletion target.
- `pnpm --filter @clickeen/devstudio test` uses `admin/vitest.config.ts` so tests
  do not load the Vite dev-server mutation config.
- There are no committed DevStudio unit test files yet. `--passWithNoTests` is used
  only so an otherwise valid Vitest config can pass until real tests land.
