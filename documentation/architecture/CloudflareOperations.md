# Cloudflare Operations

Cloudflare work in this repo must use a repeatable repo command path. Do not
rediscover Cloudflare access during PRD execution.

There are two different Cloudflare control planes in active use:

- **R2 object storage** for Tokyo/widget/account artifacts.
- **Cloudflare REST** for Pages projects, Pages custom domains, DNS records, and
  Worker/Page configuration.

Use the preflight for the surface being touched. Passing R2 preflight does not
prove Pages/DNS access.

## Required Local Environment

Values live in root `.env.local` and are not committed.

```text
CLOUDFLARE_ACCOUNT_ID=a8528ec394ae2da9e5521d2ddd3aeb87
TOKYO_R2_BUCKET=tokyo-assets-dev
CLOUDFLARE_R2_ACCESS_KEY_ID=<R2 S3 access key id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<R2 S3 secret access key>
CLOUDFLARE_R2_ENDPOINT=https://a8528ec394ae2da9e5521d2ddd3aeb87.r2.cloudflarestorage.com
CLOUDFLARE_REST_API_TOKEN=<Cloudflare REST token for Pages/DNS/config>
```

For R2 object operations, use the S3 credentials shown by Cloudflare's R2
Account Token flow. They are the right credentials for listing and reading
objects in the Tokyo bucket.

Do not use `CLOUDFLARE_API_TOKEN` for repo Cloudflare helpers. That name is too
ambiguous and has historically mixed R2 credentials, Wrangler credentials, and
REST API tokens. Repo helpers use typed variables:

- `CLOUDFLARE_R2_ACCESS_KEY_ID` + `CLOUDFLARE_R2_SECRET_ACCESS_KEY` for R2 object
  work through the S3 API.
- `CLOUDFLARE_REST_API_TOKEN` for Pages, custom domains, DNS records, and
  Worker/Page configuration.
- `CLOUDFLARE_R2_REST_API_TOKEN` only for the rare R2 REST fallback when S3
  credentials are unavailable.

For Pages/DNS operations, `CLOUDFLARE_REST_API_TOKEN` must be a Cloudflare REST API
token for account `a8528ec394ae2da9e5521d2ddd3aeb87` with the permissions needed
by the operation:

- Account Settings: Read
- Cloudflare Pages: Read, or Edit when adding/removing domains
- Zone: Read
- DNS: Read, or Edit when adding/updating records

## Commands

```bash
pnpm cf:preflight
pnpm cf:r2:ls accounts/CLICKEEN/instances/
pnpm cf:r2:get accounts/CLICKEEN/instances/SZBSB5HHFJ/instance.config.json
```

`pnpm cf:preflight` is mandatory before Cloudflare-dependent execution. It:

- loads root `.env.local`;
- verifies S3 access to the configured R2 bucket, or verifies the REST token
  when S3 credentials are not configured;
- lists a small sample from `accounts/`;
- reads `product/widgets/faq/spec.json` from R2.

For Pages/DNS work:

```bash
pnpm cf:api:preflight
pnpm cf:pages:list
pnpm cf:pages:project devstudio
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env
pnpm cf:pages:sync-devstudio-env --apply
pnpm cf:pages:sync-devstudio-project
pnpm cf:pages:sync-devstudio-project --apply
pnpm cf:pages:domains devstudio
pnpm cf:dns:records clickeen.com devstudio.clickeen.com
pnpm cf:dns:upsert-cname clickeen.com devstudio.clickeen.com devstudio-dev.pages.dev
```

`pnpm cf:api:preflight` is mandatory before Pages/DNS-dependent execution. It:

- loads root `.env.local`;
- verifies the Cloudflare REST token;
- verifies account visibility;
- lists Pages projects;
- lists DevStudio custom domains when the project is visible;
- verifies the `clickeen.com` zone and the `devstudio.clickeen.com` DNS record.

If this preflight fails, the local token does not have enough Cloudflare REST
permission for Pages/DNS work. Stop and fix the token instead of switching to
guessed dashboard steps or random Wrangler commands.

Passing `pnpm cf:api:preflight` proves read access to the Pages/DNS topology. It
does not prove write access to Pages project settings. For project config
mutation, use the specific dry-run/apply command:

```bash
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env
pnpm cf:pages:sync-devstudio-env --apply
pnpm cf:pages:sync-devstudio-project
pnpm cf:pages:sync-devstudio-project --apply
```

`pnpm cf:pages:devstudio-env` is read-only. It compares the live DevStudio Pages
env against `admin/wrangler.toml` and the required live-only
`DEVSTUDIO_GITHUB_TOKEN` secret.

`pnpm cf:pages:sync-devstudio-env --apply` writes the non-secret DevStudio Pages
production vars from `admin/wrangler.toml` and writes `DEVSTUDIO_GITHUB_TOKEN`
from root `.env.local` as a Cloudflare Pages secret. The command redacts secret
values in output.

If the dry-run passes and `--apply` returns Cloudflare `403`, the token is valid
but lacks Pages project edit authorization for that mutation. Do not rename the
credential or switch to R2 credentials; fix that token's Pages edit permission or
make the exact project-settings change in Cloudflare.

## Hard Stop Rule

If the required Cloudflare preflight fails, stop Cloudflare-dependent work. Do
not switch to dashboard scraping, random Wrangler commands, guessed object paths,
or partial evidence. Fix the credentials/environment first, then rerun preflight.

- R2/Tokyo artifact work requires `pnpm cf:preflight`.
- Pages/DNS/custom-domain work requires `pnpm cf:api:preflight`.

## Cloudflare Dashboard Labels

In this account, DNS records for `clickeen.com` are under:

```text
Domains -> clickeen.com -> DNS records
```

Do not refer to this path as "Websites" for this account.

For DevStudio canonical DNS, the expected record is:

```text
Type: CNAME
Name: devstudio
Target: devstudio-dev.pages.dev
Proxy status: Proxied
TTL: Auto
```

The `devstudio-dev.pages.dev` target is a Cloudflare Pages internal target, not
the user-facing product URL. The product URL is `https://devstudio.clickeen.com`.

## VS Code Cloudflare Extension

The VS Code Cloudflare extension is useful for human-visible project context,
bindings, and local Worker workflows. It is not execution evidence for agents.
Repo commands are the evidence path.
