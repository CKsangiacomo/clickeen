# @clickeen/ck-runtime-materializer

Pure package materializer for PRD 124B.

## Purpose

This package turns explicit widget source state and, optionally, one selected
locale overlay into generated runtime package files:

```text
schema + source state + optional one locale overlay -> index.html + styles.css + runtime.js + evidence
```

It does not own account truth, storage, public serving, cache purge, policy, or
agent behavior.

## Contract

Inputs are fully resolved by callers. The package does not fetch from Roma,
Tokyo, Supabase, Cloudflare, Translation Agent, or any other service.

Outputs are generated files plus inert evidence. Evidence persistence belongs
to later Roma/Tokyo authority, not this package.

## Forbidden

Package source must not import or depend on:

- Roma, Bob, Tokyo-worker, San Francisco, or agents;
- Next, React, Wrangler, Cloudflare bindings, Supabase, or environment
  variables;
- request/response/session/auth objects;
- storage, purge, route, or lifecycle/status machinery.

## Commands

```bash
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
```

## 124B/124C Relationship

124B delivers this pure package only. Roma runtime integration belongs to 124C.
Until 124C, no runtime surface calls this package.
