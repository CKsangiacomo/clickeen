# Cloudflare Operations

Cloudflare work in this repo must use a repeatable repo command path. Do not
rediscover Cloudflare access during PRD execution.

## Required Local Environment

Values live in root `.env.local` and are not committed.

```text
CLOUDFLARE_ACCOUNT_ID=a8528ec394ae2da9e5521d2ddd3aeb87
TOKYO_R2_BUCKET=tokyo-assets-dev
CLOUDFLARE_R2_ACCESS_KEY_ID=<R2 S3 access key id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<R2 S3 secret access key>
CLOUDFLARE_R2_ENDPOINT=https://a8528ec394ae2da9e5521d2ddd3aeb87.r2.cloudflarestorage.com
```

For R2 object operations, use the S3 credentials shown by Cloudflare's R2
Account Token flow. They are the right credentials for listing and reading
objects in the Tokyo bucket.

`CLOUDFLARE_API_TOKEN` is only a fallback for Cloudflare REST API tokens that
can pass `GET /user/tokens/verify` and R2 object endpoints. Do not assume an R2
Account Token value is accepted by Cloudflare REST.

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

## Hard Stop Rule

If `pnpm cf:preflight` fails, stop Cloudflare-dependent work. Do not switch to
dashboard scraping, random Wrangler commands, guessed object paths, or partial
evidence. Fix the R2 credentials/environment first, then rerun preflight.

## VS Code Cloudflare Extension

The VS Code Cloudflare extension is useful for human-visible project context,
bindings, and local Worker workflows. It is not execution evidence for agents.
Repo commands are the evidence path.
