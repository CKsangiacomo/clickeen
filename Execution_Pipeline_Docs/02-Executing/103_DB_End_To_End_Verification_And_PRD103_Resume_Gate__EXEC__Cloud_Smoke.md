# EXEC 103_DB.9 End-To-End Verification And PRD 103 Resume Gate

Status: Blocked
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.9 - End-to-end verification and PRD 103 resume gate`

## Slice Intent

This slice is the final gate before product PRD 103 can resume.

The gate is not a code-build gate only. It must prove the product path works end to end:

- Roma opens the account widget list from Tokyo-backed product operations.
- Roma/Bob opens a real FAQ instance.
- Save persists authored state.
- Generate accepts work without hanging.
- Translation progress and translated preview render from Tokyo product operations.
- Publish materializes public serving artifacts.
- Public visitors read only generated R2/CDN artifacts.
- Private source payloads and old source mirrors are not public serving surfaces.

## Current Verification

Cloud deployment is green for the current code head:

- `cloud-dev workers deploy`: success for head `d44b3417ffcc67a01dbe7e476fc2583c6519bdbe`.
- `cloud-dev surface reachability`: success for head `d44b3417ffcc67a01dbe7e476fc2583c6519bdbe`.

Documentation head:

- `caf522f9` aligns account locale taxonomy across Berlin, Roma, Bob, Tokyo, contracts, and PRD docs. It introduces migration `20260523150000__prd103_account_locale_settings_taxonomy.sql`.
- `d44b3417` updates San Francisco to use the renamed translated-value contracts after public-serving cleanup.
- `6627dc1f` removes legacy public-serving paths, deletes the live `/renders/*` route from cloud-dev, and keeps only regression checks for forbidden public paths.
- `74bc5f87` updates this gate readout. It does not change runtime behavior.
- `f479d605` locks the public-serving environment split in architecture docs: cloud-dev uses `dev.clk.live`; production release stages use `clk.live`.

Local targeted verification is green:

- `pnpm --filter @clickeen/sanfrancisco test`
- `pnpm --filter @clickeen/sanfrancisco typecheck`
- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm verify:prd103-db-pivot`
- `pnpm lint`
- `TURBO_FORCE=true pnpm typecheck`

Current public smoke command:

```bash
pnpm health:product-path --public-only --account-public-id 00000001 --instance-id UZ3JEJSHII --json
```

Cloud-dev public smoke now targets `https://dev.clk.live` by default. Use `--clk-base https://clk.live` only for production/UAT checks.

Current result:

```json
{
  "ok": true,
  "results": [
    {
      "name": "Roma unauthenticated account API rejects",
      "boundary": "roma.auth",
      "ok": true,
      "detail": "HTTP 401"
    },
    {
      "name": "Public serving instance read and boundary",
      "boundary": "clk.public",
      "ok": true,
      "detail": "00000001/UZ3JEJSHII"
    }
  ]
}
```

Direct DNS check:

```bash
dig +short dev.clk.live
```

Current result after cloud-dev route/DNS setup: Cloudflare edge IPs are returned.

Nameserver check:

```bash
dig +short NS clk.live
```

Current result:

```text
maya.ns.cloudflare.com.
salvador.ns.cloudflare.com.
```

Cloudflare zone lookup with the configured local Cloudflare API token:

```bash
GET /client/v4/zones?name=clk.live
```

Current result after the operator updated the Cloudflare token: the token can read both `clickeen.com` and `clk.live`, and has DNS/Workers Routes permissions for both zones.

Operator confirmation:

- `clk.live` exists as an active Cloudflare zone and is reserved for production public serving.
- Cloud-dev must use the `dev.clk.live/*` Cloudflare route on the `tokyo-assets-dev` worker.

Direct A/CNAME checks:

```bash
dig +short A dev.clk.live
dig +short CNAME dev.clk.live
```

Current result after cloud-dev route/DNS setup: `A dev.clk.live` returns Cloudflare edge IPs.

Forced Cloudflare edge check:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://dev.clk.live/00000001/UZ3JEJSHII/
```

Current result after cloud-dev route/DNS setup and materialization repair: HTTP 200.

Seeded instance artifact checks:

```bash
for id in UZ3JEJSHII 8FMVZFFPJV H7IF9M2K9B; do
  curl -sS -o /dev/null -w "$id %{http_code}\n" "https://dev.clk.live/00000001/$id/"
done
```

Current result:

```text
UZ3JEJSHII 200
8FMVZFFPJV 200
H7IF9M2K9B 200
```

Private source mirror check:

```bash
curl -I https://dev.clk.live/00000001/UZ3JEJSHII/instance.json
```

Current result after cloud-dev route/DNS setup: HTTP 404 with Tokyo-worker headers.

## Deterministic Readout

The gate is blocked for two remaining reasons:

1. Supabase migration `20260523150000__prd103_account_locale_settings_taxonomy.sql` must be deployed to cloud-dev through the reviewed `supabase migrations deploy` workflow before cloud-dev Roma/Berlin smoke is valid.
2. Authenticated Roma human smoke still needs to prove open, save, Generate, translated preview, and publish after that migration is live.

The taxonomy migration creates account `selected_target_locales` and `locale_policy`, migrates/drops legacy `l10n_locales` and `l10n_policy`, and seeds the tier3 admin account selected target locales. Running the new app code before this migration is live can make Berlin fail when it selects the new columns.

Current agent limitation: the shell does not have `gh`, no GitHub token is available, and the available GitHub connector does not expose workflow dispatch. Therefore the migration workflow cannot be dispatched from this session.

The private `instance.json` 404 is good. It proves the old source mirror is not accidentally exposed as a public artifact.

The public-host operational route 404s are also required. `dev.clk.live` must not expose Tokyo `/healthz`, `/__internal/*`, `/widgets/*`, or other operational routes. It is a public artifact host only.

The current GitHub surface-reachability workflow does not check `dev.clk.live`; it checks Berlin, Tokyo, San Francisco, Roma, Bob, Venice, and unauthenticated Roma route boundaries. That workflow being green is necessary but not sufficient for the public serving gate.

## Product Interpretation

Deploy success does not mean PRD 103 can resume.

At this stage the DB pivot code is deployed and the public serving bridge has live materialization proof for the seeded cloud-dev instances. PRD 103 still cannot resume until the authenticated Roma product path is smoke-tested end to end.

Latest deploy status:

- Commit `d44b3417` deployed successfully.
- The cloud-dev surface-reachability workflow for `d44b3417` is green.
- `dev.clk.live` was verified separately because the standard surface-reachability workflow does not cover the canonical cloud-dev public serving domain.

## Repair Operation Added In This Slice

This slice adds a narrow Tokyo system repair route:

```text
POST /__internal/accounts/{accountId}/serving/restore-paid
```

Purpose:

- run the existing `restorePaidTierServing` operation for an account;
- materialize every DB row whose `instances.publish_status` is `published`;
- leave publish intent unchanged;
- avoid any `instance.json`, overlay inventory, pointer, or old source-object fallback.

Authorization:

- requires `Authorization: Bearer {TOKYO_DEV_JWT}`;
- requires `x-ck-internal-service: devstudio.local`;
- requires `x-account-id` to match the account in the path.

Test proof:

- unauthenticated repair requests are rejected;
- authenticated repair materializes `index.html` for a published row;
- repair does not create or expose `instance.json`.

Cloud invocation status:

- `https://tokyo.dev.clickeen.com/healthz` reaches the Tokyo worker and returns HTTP 200 with a worker `x-request-id`.
- `https://tokyo.dev.clickeen.com/__internal/accounts/00000001/serving/restore-paid` returns HTTP 404 without a worker `x-request-id`.
- This is because `tokyo.dev.clickeen.com/__internal/*` is not a public Cloudflare route for the Tokyo worker. Roma uses service binding for internal Tokyo calls.
- Therefore the repair route exists and is tested, but it has not been run against cloud-dev seeded data from the shell.
- Do not expose broad Tokyo `__internal/*` just to make this callable. If a manual cloud repair is needed, use a narrow Roma-owned account operation or the existing authenticated Roma publish path.

## Required Fix Before Green

The gate can go green only after all of these are true:

- Blocked: run GitHub Actions workflow `supabase migrations deploy` with `target=cloud-dev` and `confirm=APPLY_MIGRATIONS` for commit `caf522f9` or later.
- Green: `dev.clk.live` resolves normally for cloud-dev public serving.
- Green: FAQ, Countdown, and Logo Showcase seeded instances have materialized public artifacts under the new public artifact model.
- Green: public smoke succeeds without `--resolve`.
- Green: private source mirror and forbidden operational public paths return 404.
- Blocked: authenticated Roma smoke proves FAQ open, save, Generate, translated preview, and publish.

## Allowed Resolution Paths

Allowed paths:

- A human product-path publish from Roma for seeded instances, proving the real publish operation materializes artifacts.
- A documented, protected system repair operation that materializes all currently published rows. This must be scoped as a DB pivot repair path, not a new public product mode. If invoked from cloud-dev, it must be reached through an already-authorized internal service path, not by opening Tokyo internals broadly on the public custom domain.

Not allowed:

- Reintroducing `instance.json` or source payload public serving as a fallback.
- Marking PRD 103 resumable based only on deploy success.
- Adding compatibility code that reads old object state to make this smoke pass.
