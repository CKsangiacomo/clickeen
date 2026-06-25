# Cloudflare Operations

STATUS: CURRENT SYSTEM OPERATOR SPEC

Cloudflare work in this repo must use a repeatable repo command path. Do not
rediscover Cloudflare access during execution.

This is the operator manual for Cloudflare-managed state. It identifies the
Cloudflare plane, the allowed repo command, required env names, and evidence
needed to prove the operation. It does not replace product routes: normal
account product work still moves through Roma, Tokyo-worker, Berlin, San
Francisco, Product Copilot, or the Translation Agent as owned by the product
path.

## AI Operator Quick Start

Agents can operate Cloudflare from this repo when the required local env exists.
Do not say "I cannot read Cloudflare" until the relevant preflight has been run
and failed.

For Tokyo/R2 object reads and exceptional object repair:

```bash
pnpm cf:preflight
pnpm cf:r2:ls <prefix> [--limit 100]
pnpm cf:r2:get <key>
```

For Pages projects, Pages env/secrets, Pages domains, DNS, and Cloudflare REST
configuration:

```bash
pnpm cf:api:preflight
pnpm cf:pages:list
pnpm cf:pages:project <project-name>
pnpm cf:pages:domains <project-name>
pnpm cf:dns:records <zone-name> [record-name]
```

For DevStudio Pages env/config:

```bash
pnpm cf:api:preflight
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env
pnpm cf:pages:sync-devstudio-project
```

If preflight passes, proceed through the documented command path and verify the
owning surface afterward. If preflight fails, stop at that boundary and report:

- which preflight failed;
- which env var/token class is missing or rejected;
- which Cloudflare plane is blocked;
- which operation could not be performed.

Do not invent a dashboard-only workflow. Do not switch token names. Do not guess
object keys, zones, project names, or bindings.

## Command Decision Map

| Need | Command path | Evidence |
| --- | --- | --- |
| Read an R2 object | `pnpm cf:preflight`, then `pnpm cf:r2:get <key>` | object bytes from the exact key |
| List R2 keys | `pnpm cf:preflight`, then `pnpm cf:r2:ls <prefix>` | listed keys under the exact prefix |
| Repair an R2 object | `pnpm cf:preflight`, then `pnpm cf:r2:put <key> <file>` | read-back of the exact key |
| Delete an R2 object | `pnpm cf:preflight`, then `node scripts/cloudflare/r2.mjs delete <key>` | missing-key or list evidence |
| Inspect Pages project config | `pnpm cf:api:preflight`, then `pnpm cf:pages:project <project-name>` | returned project JSON |
| Inspect DevStudio Pages env/secrets | `pnpm cf:api:preflight`, then `pnpm cf:pages:devstudio-env` | env comparison output |
| Sync DevStudio Pages env/project | dry-run command, then same command with `--apply` | read-back command output |
| Write a Pages secret | `pnpm cf:api:preflight`, then `pnpm cf:pages:put-secret ... --apply` | Pages env verification shows secret present |
| Inspect/upsert DNS | `pnpm cf:api:preflight`, then `pnpm cf:dns:*` | read-back of the DNS record |
| Prove Pages deploy | Cloudflare Pages Git build state plus runtime response | owning app URL responds |
| Prove Worker deploy | GitHub Actions `cloud-dev workers deploy` plus runtime response | owning Worker URL/route responds |

If the need is not in this table, identify the owning Cloudflare plane before
running commands.

## Hard Stops

Never do these to "make Cloudflare work":

- do not use `CLOUDFLARE_API_TOKEN` for local repo helpers;
- do not skip `pnpm cf:preflight` for R2 object work;
- do not skip `pnpm cf:api:preflight` for Pages/DNS/config work;
- do not use dashboard screenshots as execution evidence;
- do not use random Wrangler commands when the repo has a command path;
- do not mutate `accounts/**` directly unless the task is explicitly product
  data repair;
- do not treat R2 preflight as Pages/DNS proof;
- do not treat REST preflight as R2 proof;
- do not claim deploy success without the owning deploy surface evidence.

## Control Planes

| Plane | Used for | Required preflight |
| --- | --- | --- |
| R2 object operations | Direct Tokyo/R2 reads and exceptional object writes/deletes | `pnpm cf:preflight` |
| Cloudflare REST Pages/DNS operations | Pages projects, Pages env/secrets, Pages domains, DNS records | `pnpm cf:api:preflight` |
| Cloudflare Pages Git deploys | Bob, Roma, Prague, DevStudio runtime deploy evidence | Cloudflare Pages build state |
| GitHub Actions Worker/R2 deploys | Berlin, San Francisco, Tokyo-worker, Product Copilot, Translation Agent, Tokyo product-root sync | GitHub Actions workflow run |

Passing one preflight proves only that plane. R2 preflight does not prove
Pages/DNS access. REST preflight does not prove R2 object access.

Normal account assets, instances, pages, and translations mutate through
Roma/Tokyo-worker product routes. Direct `accounts/**` R2 writes are exceptional
repair operations and must be named as product data repair, not normal product
flow.

## Required Local Environment

Values live in root `.env.local` and are not committed.

```text
CLOUDFLARE_ACCOUNT_ID=[Cloudflare account id]
TOKYO_R2_BUCKET=[Tokyo R2 bucket name]
CLOUDFLARE_R2_ACCESS_KEY_ID=[R2 signed access key id]
CLOUDFLARE_R2_SECRET_ACCESS_KEY=[R2 signed secret access key]
CLOUDFLARE_R2_ENDPOINT=[R2 endpoint URL]
CLOUDFLARE_R2_REST_API_TOKEN=[R2 REST token for read/list/get verification]
CLOUDFLARE_REST_API_TOKEN=[Cloudflare REST token for Pages/DNS/config]
```

Do not use `CLOUDFLARE_API_TOKEN` for local repo Cloudflare helpers. That name
is reserved for GitHub Actions/Wrangler workflows. Local repo helpers use typed
variables:

- `CLOUDFLARE_R2_ACCESS_KEY_ID` + `CLOUDFLARE_R2_SECRET_ACCESS_KEY` for signed
  R2 object work.
- `CLOUDFLARE_R2_REST_API_TOKEN` for explicit R2 REST read/list/get
  verification when signed R2 credentials are not present.
- `CLOUDFLARE_REST_API_TOKEN` for Pages projects, Pages env/secrets, Pages
  domains, and DNS records.

`pnpm cf:pages:put-secret` and DevStudio secret sync read the secret value from
root `.env.local` and write it to Cloudflare Pages. Output redacts secret
values.

## R2 Object Commands

```bash
pnpm cf:preflight
pnpm cf:r2:ls <prefix> [--limit 100]
pnpm cf:r2:get <key>
pnpm cf:r2:put <key> <local-file> [--content-type application/json]
node scripts/cloudflare/r2.mjs delete <key>
```

`pnpm cf:preflight`:

- loads root `.env.local`;
- verifies access to the configured Tokyo R2 bucket;
- lists a sample from `accounts/`;
- reads `product/widgets/faq/spec.json` from R2.

R2 preflight proves read/list access. Object write/delete still needs explicit
mutation evidence and follow-up read/list verification. The helper uses signed
R2 credentials when present. If signed write/delete is denied, it may perform
the requested put/delete through the repo's Tokyo-worker Wrangler command path.
Report that path in the execution evidence when it happens.

Direct R2 mutation is not normal product operation. Use it only for explicit
product-data repair or git-authored product-root sync. For account assets,
instances, pages, and translation overlays, prefer the product route or owning
agent path unless the task explicitly names remote data repair.

## Tokyo Product-Root R2 Sync

Git-authored Tokyo product roots sync to canonical R2 roots:

| Repo source | Canonical R2 root |
| --- | --- |
| `tokyo/product/widgets/**` | `product/widgets/**` |
| `tokyo/product/dieter/**` | `dieter/**` |
| `tokyo/product/fonts/**` | `fonts/**` |
| `tokyo/roma/**` | `product/roma/**` |
| `tokyo/prague/**` | `prague/**` |

Commands:

```bash
pnpm tokyo:r2:sync:check
pnpm tokyo:r2:sync:remote
```

The sync refuses account runtime keys and non-canonical roots such as
`widgets/**`, `l10n/**`, `public/**`, and `published/**`.

Worker/R2 deploy automation is evidenced by GitHub Actions
`cloud-dev workers deploy`. If a product-root sync is run manually, use
`pnpm cf:preflight` first and verify the exact R2 keys afterward.

Auth boundary: the GitHub Actions sync path may use the workflow
`CLOUDFLARE_API_TOKEN` because it is a CI/Wrangler deploy workflow. Local repo
helper commands must not use that ambiguous token name; local R2 commands use
the typed env names above.

Current workflow caveat: `cloud-dev workers deploy` triggers the R2 product-root
sync for `tokyo/product/widgets/**`, `tokyo/product/fonts/**`,
`tokyo/product/themes/**`, `tokyo/product/dieter/**`, `tokyo/roma/**`, and the
sync script itself. It does not currently trigger for `tokyo/prague/**` only.
If Prague R2 content changes and no other sync-triggering root changed, run the
manual sync path deliberately:

```bash
pnpm cf:preflight
pnpm tokyo:r2:sync:check
pnpm tokyo:r2:sync:remote
pnpm cf:r2:get prague/[exact-key]
```

Do not rely on implicit bucket defaults for manual sync. Record the
`TOKYO_R2_BUCKET` confirmed by preflight before writing.

## Pages/DNS REST Commands

```bash
pnpm cf:api:preflight
pnpm cf:pages:list
pnpm cf:pages:project <project-name>
pnpm cf:pages:devstudio-env
pnpm cf:pages:sync-devstudio-env [--apply]
pnpm cf:pages:sync-devstudio-project [--apply]
pnpm cf:pages:put-secret <project-name> <secret-name> [--env production|preview] [--apply]
pnpm cf:pages:domains <project-name>
pnpm cf:dns:records <zone-name> [record-name]
pnpm cf:dns:upsert-cname <zone-name> <record-name> <target>
```

`pnpm cf:api:preflight`:

- loads root `.env.local`;
- verifies the Cloudflare REST token;
- verifies account visibility;
- lists Pages projects;
- lists DevStudio custom domains when the project is visible;
- verifies the `clickeen.com` zone and the `devstudio.clickeen.com` DNS record.

Token permissions:

- Account: Cloudflare Pages Read/Edit as needed.
- Account: Account Settings Read.
- Zone: Zone Read.
- Zone: DNS Read/Edit as needed.

Pages Edit is required for Pages project config, env var sync, secret writes,
and custom-domain mutations. DNS Edit is required for DNS upsert.

The Cloudflare API helper currently owns generic Pages inspection and
DevStudio Pages sync. It does not sync Bob/Roma/Prague runtime env generally.
For Bob/Roma/Prague, inspect state with this document and compare it to the
expected live contract in `CloudflarePagesCloudDevChecklist.md`.

## Current Pages Projects

| Project | Source root | Canonical host |
| --- | --- | --- |
| `bob-dev` | `bob` | `https://bob.dev.clickeen.com` |
| `roma-dev` | `roma` | `https://roma.dev.clickeen.com` |
| `prague-dev` | `prague` | `https://prague.dev.clickeen.com` |
| `devstudio` | `admin` | `https://devstudio.clickeen.com` |

See [CloudflarePagesCloudDevChecklist.md](./CloudflarePagesCloudDevChecklist.md)
for the full Pages project/env/binding inventory.

## Mutation Evidence

| Mutation | Required evidence |
| --- | --- |
| R2 put | `pnpm cf:preflight`, put command output, then `pnpm cf:r2:get <key>` or list evidence |
| R2 delete | `pnpm cf:preflight`, delete command output, then missing-key/list evidence |
| Tokyo product-root sync | sync command or GitHub Actions evidence, then exact R2 key evidence |
| Pages env/project sync | `pnpm cf:api:preflight`, dry run, `--apply`, then read-back command |
| Pages secret write | `pnpm cf:api:preflight`, `pnpm cf:pages:put-secret ... --apply`, then Pages env verification |
| DNS CNAME upsert | `pnpm cf:api:preflight`, DNS upsert command, then `pnpm cf:dns:records <zone> <name>` |
| Pages runtime deploy | Cloudflare Pages Git build state and cloud-dev surface response |
| Worker deploy | GitHub Actions worker deploy run and owning Worker runtime response |

## Runtime Verification Commands

| Surface | Evidence command or URL |
| --- | --- |
| Bob Pages project | `pnpm cf:pages:project bob-dev` |
| Bob runtime | `https://bob.dev.clickeen.com/bob` |
| Roma Pages project | `pnpm cf:pages:project roma-dev` |
| Roma runtime | `https://roma.dev.clickeen.com/home` |
| Prague Pages project | `pnpm cf:pages:project prague-dev` |
| Prague runtime | `https://prague.dev.clickeen.com/us/en/` |
| DevStudio Pages project | `pnpm cf:pages:project devstudio` |
| DevStudio runtime | `https://devstudio.clickeen.com` |
| DevStudio env | `pnpm cf:pages:devstudio-env` |
| DevStudio domain | `pnpm cf:pages:domains devstudio` |
| DevStudio DNS | `pnpm cf:dns:records clickeen.com devstudio.clickeen.com` |
| Public embed runtime | `https://dev.clk.live/{accountPublicId}/{instanceId}` |
| R2 object | `pnpm cf:r2:get <exact-key>` |
| Worker deploys | GitHub Actions `cloud-dev workers deploy` run plus the owning service runtime check |

Worker runtime checks are service-specific. Use the owning service doc for the
route or smoke command: Berlin for auth/session, San Francisco for model
execution, Tokyo-worker for account storage/public serving, Product Copilot and
Translation Agent for their e2e smoke commands.

## Source Files

| Concern | File |
| --- | --- |
| R2 helper | `scripts/cloudflare/r2.mjs` |
| Cloudflare REST helper | `scripts/cloudflare/api.mjs` |
| Tokyo product-root sync | `scripts/tokyo-r2-deploy-sync.mjs` |
| Cloudflare scripts registry | root `package.json` |
| Worker deploy workflow | `.github/workflows/cloud-dev-workers.yml` |
| Pages cloud-dev contract | `documentation/engineering/CloudflarePagesCloudDevChecklist.md` |

## Hard Stop Rule

If the required Cloudflare preflight fails, stop Cloudflare-dependent work. Do
not switch to dashboard scraping, random Wrangler commands, guessed object paths,
or partial evidence. Fix the credentials/environment first, then rerun preflight.

- R2/Tokyo artifact work requires `pnpm cf:preflight`.
- Pages/DNS/custom-domain/project-env work requires `pnpm cf:api:preflight`.

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
the user-facing product URL. The product URL is
`https://devstudio.clickeen.com`.

## VS Code Cloudflare Extension

The VS Code Cloudflare extension is useful for human-visible project context,
bindings, and local Worker workflows. It is not execution evidence for agents.
Repo commands and owning deploy surfaces are the evidence path.
