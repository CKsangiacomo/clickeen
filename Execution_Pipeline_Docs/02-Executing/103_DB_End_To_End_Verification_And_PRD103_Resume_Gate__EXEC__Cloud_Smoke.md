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

- `cloud-dev workers deploy`: success for head `52b990ff4516924317cffc9b418122487d389e65` after rerunning a transient R2 bulk-sync HTTP 502 failure.
- `cloud-dev surface reachability`: success for head `52b990ff4516924317cffc9b418122487d389e65`.

Documentation head:

- `74bc5f87` updates this gate readout. It does not change runtime behavior.
- `f479d605` locks the public-serving environment split in architecture docs: cloud-dev uses `dev.clk.live`; production release stages use `clk.live`.

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

Cloud-dev public smoke now targets `https://dev.clk.live` by default. Use `--clk-base https://clk.live` only for production/UAT checks.

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
      "name": "Public serving instance read",
      "boundary": "clk.public",
      "ok": false,
      "detail": "fetch failed"
    }
  ]
}
```

Direct DNS check:

```bash
dig +short dev.clk.live
```

Current result before the cloud-dev custom-domain deploy: not green.

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
- Cloud-dev must use the `dev.clk.live` custom domain on the `tokyo-assets-dev` worker.

Direct A/CNAME checks:

```bash
dig +short A dev.clk.live
dig +short CNAME dev.clk.live
```

Current result before the cloud-dev custom-domain deploy: not green.

Forced Cloudflare edge check:

```bash
curl -I https://dev.clk.live/00000001/UZ3JEJSHII
```

Current target: HTTP 200 after the custom domain is deployed and the seeded public artifact is materialized.

Private source mirror check:

```bash
curl -I https://dev.clk.live/00000001/UZ3JEJSHII/instance.json
```

Required result: HTTP 404.

## Deterministic Readout

The gate is blocked for two separate reasons:

1. Cloud-dev public serving has not yet been proven on `dev.clk.live`.
2. The seeded FAQ instance still needs a materialized `index.html` public artifact at `accounts/00000001/instances/UZ3JEJSHII/index.html`, or a fresh Roma publish operation must prove that the artifact exists.

The private `instance.json` 404 is good. It proves the old source mirror is not accidentally exposed as a public artifact.

The current GitHub surface-reachability workflow does not check `dev.clk.live`; it checks Berlin, Tokyo, San Francisco, Roma, Bob, Venice, and unauthenticated Roma route boundaries. That workflow being green is necessary but not sufficient for the public serving gate.

## Product Interpretation

Deploy success does not mean PRD 103 can resume.

At this stage the DB pivot code is deployed, but the serving bridge still needs a real materialization proof for existing seeded instances. The publish/materialization operation exists in Tokyo, but the seeded public artifacts must be created through an approved product/system operation before the smoke gate can pass.

Latest deploy status:

- Commit `52b990ff` deployed after a retry of the Cloudflare workers deploy workflow.
- The rerun failure was an R2 bulk-sync Cloudflare HTTP 502, not a code failure.
- The cloud-dev surface-reachability workflow for `52b990ff` is green.
- That workflow still does not prove `dev.clk.live`, because it does not include the canonical cloud-dev public serving domain.

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

- the repair route is deployed and run for the seeded cloud-dev account, or the same result is produced by a real Roma publish operation;
- `dev.clk.live` resolves normally for cloud-dev public serving.
- FAQ, Countdown, and Logo Showcase seeded instances have materialized public artifacts under the new public artifact model.
- Public smoke succeeds without `--resolve`.
- Authenticated Roma smoke proves FAQ open, save, Generate, translated preview, and publish.
- A private source mirror request such as `/instance.json` still returns 404.

## Allowed Resolution Paths

Allowed paths:

- A human product-path publish from Roma for seeded instances, proving the real publish operation materializes artifacts.
- A documented, protected system repair operation that materializes all currently published rows. This must be scoped as a DB pivot repair path, not a new public product mode. If invoked from cloud-dev, it must be reached through an already-authorized internal service path, not by opening Tokyo internals broadly on the public custom domain.

Not allowed:

- Reintroducing `instance.json` or source payload public serving as a fallback.
- Marking PRD 103 resumable based only on deploy success.
- Adding compatibility code that reads old object state to make this smoke pass.
