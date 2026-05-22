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

Cloud deployment is green for the current head:

- `cloud-dev workers deploy`: success for head `c9403a91ba3c8380c83da21454c9ad10da1a79f3`
- `cloud-dev roma app verify`: success for head `c9403a91ba3c8380c83da21454c9ad10da1a79f3`
- `cloud-dev surface reachability`: success for head `c9403a91ba3c8380c83da21454c9ad10da1a79f3`

Local targeted verification was already green before this gate:

- `pnpm --filter @clickeen/tokyo-worker test`
- `pnpm --filter @clickeen/tokyo-worker typecheck`
- `pnpm verify:prd103-db-pivot`
- `pnpm lint`
- `pnpm typecheck`

Current public smoke command:

```bash
pnpm health:product-path --public-only --account-public-id 00000001 --instance-id UZ3JEJSHII --json
```

Current result:

```json
{
  "ok": false,
  "results": [
    {
      "name": "Roma unauthenticated account API rejects",
      "boundary": "roma.auth",
      "ok": true,
      "detail": "HTTP 401"
    },
    {
      "name": "clk.live public instance read",
      "boundary": "clk.public",
      "ok": false,
      "detail": "fetch failed"
    }
  ]
}
```

Direct DNS check:

```bash
dig +short clk.live
```

Current result: no records returned from the verification environment.

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

Current result: success with an empty result set. The token/project visible from this repo can read `clickeen.com`, but it does not see a `clk.live` zone.

Direct A/CNAME checks:

```bash
dig +short A clk.live
dig +short CNAME clk.live
```

Current result: no records returned.

Forced Cloudflare edge check:

```bash
curl -I --resolve clk.live:443:188.114.96.7 https://clk.live/00000001/UZ3JEJSHII
```

Current result: HTTP 404 from Cloudflare/Tokyo worker.

Private source mirror check:

```bash
curl -I --resolve clk.live:443:188.114.96.7 https://clk.live/00000001/UZ3JEJSHII/instance.json
```

Current result: HTTP 404 from Cloudflare/Tokyo worker.

## Deterministic Readout

The gate is blocked for two separate reasons:

1. `clk.live` is not currently resolvable from the verification environment. The public canonical visitor URL cannot pass until DNS resolves.
2. When forced through a Cloudflare edge IP, the Tokyo worker is reachable but the seeded FAQ instance returns HTTP 404. That means the seeded published instance does not currently have a materialized `index.html` public artifact at `accounts/00000001/instances/UZ3JEJSHII/index.html`.

The private `instance.json` 404 is good. It proves the old source mirror is not accidentally exposed as a public artifact.

The current GitHub surface-reachability workflow does not check `clk.live`; it checks Berlin, Tokyo, San Francisco, Roma, Bob, Venice, and unauthenticated Roma route boundaries. That workflow being green is necessary but not sufficient for the public serving gate.

## Product Interpretation

Deploy success does not mean PRD 103 can resume.

At this stage the DB pivot code is deployed, but the serving bridge still needs a real materialization proof for existing seeded instances. The publish/materialization operation exists in Tokyo, but the seeded public artifacts must be created through an approved product/system operation before the smoke gate can pass.

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

## Required Fix Before Green

The gate can go green only after all of these are true:

- the repair route is deployed and run for the seeded cloud-dev account, or the same result is produced by a real Roma publish operation;
- `clk.live` resolves normally.
- FAQ, Countdown, and Logo Showcase seeded instances have materialized public artifacts under the new public artifact model.
- Public smoke succeeds without `--resolve`.
- Authenticated Roma smoke proves FAQ open, save, Generate, translated preview, and publish.
- A private source mirror request such as `/instance.json` still returns 404.

## Allowed Resolution Paths

Allowed paths:

- A human product-path publish from Roma for seeded instances, proving the real publish operation materializes artifacts.
- A documented, protected system repair operation that materializes all currently published rows. This must be scoped as a DB pivot repair path, not a new public product mode.

Not allowed:

- Reintroducing `instance.json` or source payload public serving as a fallback.
- Marking PRD 103 resumable based only on deploy success.
- Adding compatibility code that reads old object state to make this smoke pass.
