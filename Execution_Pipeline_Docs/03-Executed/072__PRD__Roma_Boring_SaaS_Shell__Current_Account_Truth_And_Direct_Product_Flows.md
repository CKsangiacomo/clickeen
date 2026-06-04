# PRD 072 - Roma Boring SaaS Shell: Current-Account Truth and Direct Product Flows

Status: EXECUTED
Created: 2026-03-17
Closed: 2026-04-30
Owner: Product Dev Team
Priority: P0
Depends on:
- `070A__PRD__Product_Boundary_Closure.md`
- `documentation/architecture/AccountManagement.md`

---

## Objective

Make Roma behave like a boring SaaS shell:

- user logs in once
- Berlin mints active-account and entitlement truth once
- Roma operates from that current-account truth
- normal product domains stop asking the browser which account is active
- internal systems stop re-checking truth they already minted

The product goal was single-account excellence for today's Roma, not speculative agency behavior.

---

## Final Product Truth

Roma is the account-scoped customer/member shell.

For normal customer use:

1. Berlin resolves the signed-in human and active account.
2. Roma bootstraps that account once.
3. Roma domains operate through `/api/account/*`.
4. Route handlers authorize with the signed account authz capsule and session.
5. Route handlers call the real owner systems.
6. The browser expresses intent; it does not supply account identity.

This is the surviving route rule:

- Use `/api/account/*` for Roma product flows.
- Do not use `/api/accounts/:accountId/*` for Roma product flows.
- Do not use `/api/roma/*` for Roma product flows.
- Do not build customer-facing account switching into today's Roma.

---

## Current Executed Route Shape

The current tracked Roma product API is the current-account route family:

- `GET /api/account`
- `DELETE /api/account`
- `GET /api/account/widgets`
- `POST /api/account/widgets/duplicate`
- `GET /api/account/assets`
- `POST /api/account/assets/upload`
- `POST /api/account/assets/resolve`
- `DELETE /api/account/assets/:assetId`
- `GET /api/account/team`
- `GET /api/account/team/invitations`
- `POST /api/account/team/invitations`
- `DELETE /api/account/team/invitations/:invitationId`
- `GET /api/account/team/members/:memberId`
- `PATCH /api/account/team/members/:memberId`
- `DELETE /api/account/team/members/:memberId`
- `GET /api/account/usage`
- `GET /api/account/locales`
- `PUT /api/account/locales`
- `POST /api/account/owner-transfer`
- `POST /api/account/lifecycle/tier-drop/dismiss`
- `GET /api/account/instance/:publicId`
- `PUT /api/account/instance/:publicId`
- `DELETE /api/account/instance/:publicId`
- `GET /api/account/instances/:publicId/translations`
- `POST /api/account/instances/:publicId/publish`
- `POST /api/account/instances/:publicId/unpublish`
- `POST /api/account/instances/:publicId/rename`
- `POST /api/account/instances/:publicId/copilot`
- `POST /api/account/instances/:publicId/copilot/outcome`

`/api/builder/:publicId/open` is the Builder-open envelope route. It is instance-first and uses the same signed current-account authz truth.

---

## Explicit Deletions And Superseded Concepts

The following are not part of the current Roma product contract:

- tracked `/api/accounts/:accountId/*` Roma routes
- tracked `/api/roma/*` Roma routes
- a standalone Roma Templates domain
- `templates-domain.tsx`
- `/api/account/templates`
- customer-facing Roma account switching
- browser-supplied raw `accountId` for normal product requests
- empty-string current-account sentinels as product state

Templates were intentionally superseded by listed/duplicable account-owned instances. Default examples are normal instances, usually authored by the admin account and marked as listed/duplicable metadata. Widgets is the surface that lists and duplicates them.

---

## What Remains By Design

`useRomaAccountApi` remains, but only as a small signed-capsule request helper.

It is not a current-account resolver and does not create a second account truth. Its job is to add the already-minted `x-ck-authz-capsule` to same-origin requests.

Server-to-owner-system calls may still carry `x-account-id` internally when crossing the Roma to Tokyo/Tokyo-worker boundary. That is internal service plumbing after Roma has resolved the current account. It is not browser-supplied product truth.

Michael and Tokyo helper functions may accept `accountId` as server-side parameters. That is not the old Roma route model; it is a backend call using the account already resolved by the current-account route.

---

## Domain Closure

Home:
- Reads current account/bootstrap data.
- Does not own account selection.

Widgets:
- Uses `/api/account/widgets`.
- Creates/duplicates/deletes/publishes/renames through current-account routes.
- Lists starter/listed instances as instances, not Templates.

Assets:
- Uses `/api/account/assets`, `/api/account/assets/upload`, `/api/account/assets/resolve`, and `/api/account/assets/:assetId`.
- Storage summary is current-account scoped.
- Builder uses the same current-account asset contract.

Team:
- Uses `/api/account/team` and `/api/account/team/*`.
- Mutates current-account membership/invitations only.

Usage:
- Uses `/api/account/usage`.
- Does not infer storage summary from an arbitrary asset-list response.

AI:
- Roma surfaces entitlement-derived AI availability.
- San Francisco owns AI execution and provider/model routing.

Settings:
- Uses current-account settings, locale, owner-transfer, lifecycle, and account-delete routes.

Builder:
- Opens one `publicId` in the current account.
- Bob receives one `ck:open-editor` payload from Roma.
- Bob delegates account actions back to the Roma host.
- Bob does not rediscover or replay current-account identity.

---

## Acceptance Evidence

Static checks from the executed codebase:

- `find roma/app/api -type f` shows current-account product route files under `roma/app/api/account/*`.
- `git ls-files 'roma/app/api/accounts/**' 'roma/app/api/roma/**' 'roma/app/api/account/templates/**'` returns no tracked files.
- `rg -n "(/api/accounts|/api/roma|api/accounts|api/roma)" . --glob '!Execution_Pipeline_Docs/**'` returns no active product callers except Bob's host-only guard that blocks direct account-route use inside hosted Bob.
- `resolveActiveRomaContext(...)` returns `null` fields, not empty strings.
- `GET /api/account/usage` exists as a dedicated current-account summary route.
- `TemplatesDomain` and `/api/account/templates` are absent from tracked code.

Verification gates run during the PRD 071/072 closure pass:

- `tsc -p roma/tsconfig.json --noEmit`
- `tsc -p bob/tsconfig.json --noEmit`
- `tsc -p tokyo-worker/tsconfig.json --noEmit`
- `pnpm --dir roma lint`
- `pnpm --dir bob lint`
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com pnpm --dir roma build`

---

## Final Decision

PRD 072 is closed.

The intended SaaS shell model is now the current architecture:

- one signed-in user
- one current account
- one `/api/account/*` product route family
- no browser account routing
- no standalone Templates architecture
- no Roma account switching
- no compatibility route family preserved for the old product shape

Future agency/multi-account behavior requires a separate product contract and must not be grafted onto today's Roma shell.
