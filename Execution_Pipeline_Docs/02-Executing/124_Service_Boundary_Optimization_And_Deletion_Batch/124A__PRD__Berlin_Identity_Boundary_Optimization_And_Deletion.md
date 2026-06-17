# PRD 124A - Berlin Identity Boundary Optimization And Deletion

Status: EXECUTING
Parent: PRD 124
Owner: Berlin auth/session boundary
Date: 2026-06-17

## Boundary

Berlin owns:

- OAuth/login provider flows.
- Provider identity to Clickeen user/account resolution.
- Session issuance, refresh, logout, JWKS.
- One-account bootstrap.
- Signed account authz capsule.
- Login-time invitation acceptance.

Berlin does not own:

- Widget, page, or asset state.
- Tokyo/R2 cleanup.
- Product publish/materialization state.
- Editor persistence.
- Connector authorization.
- Expanding account-management product workflows.

## Findings And Required Actions

| ID | Severity | Component | Category | Evidence | Required action | Blast radius | V-risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BER-01 | Critical | Invitations/login identity | Legacy workflow | `berlin/src/account-management/invitations.ts`, `berlin/src/identity/resolve-login-account.ts`, `supabase/migrations/20260609222000__fix_resolve_login_identity_pgcrypto_schema.sql` | Rewrite invitation acceptance so invited new users are created directly in the inviting account. Globally reject existing `users.primary_email` at invite acceptance. Add orphan-account audit/repair before enabling. | Berlin auth, invitations, Supabase RPC, Roma team invites | V2, V3, V6, V7 |
| BER-02 | High | Account deletion | Wrong-service authority | `berlin/src/account-management/governance.ts`, `roma/app/api/account/route.ts`, account-management docs | Move account deletion to Roma/system account operation with Tokyo/R2 cleanup and verification, or disable the route until that exists. Berlin must not return full deletion after DB-only work. | Roma settings, Berlin governance, Supabase, Tokyo account storage | V3, V6 |
| BER-03 | Medium | Account locale mutation | Account-management residue | `berlin/src/account-management/locales.ts`, `roma/components/settings-domain.tsx` | Extract mutable locale setting writes out of Berlin or explicitly name Berlin as account-settings owner in current docs. Current target is extraction: Berlin bootstrap remains read-only. | Settings, Builder locale behavior, `ck-contracts` | V3, V7 |
| BER-04 | Medium | Publish containment | Duplicate policy | `berlin/src/publish-containment/account-publish-containment.ts`, Roma publish routes, DB Pivot docs | Decide and execute one owner. Either fold containment into account status/tier policy used by Roma publish, or formally own it as account governance with current docs. No split policy flags. | Berlin route, Roma publish, Supabase containment table | V4, V7 |
| BER-05 | Medium | E2E auth route | Runtime test dependency | `berlin/src/e2e/routes.ts`, `berlin/wrangler.toml`, Roma e2e route, e2e setup | Move e2e session minting out of normal Berlin runtime or put it behind a dev-only harness with deploy gates. Remove `email` provider from product login contracts unless email login is a product feature. | Playwright, Berlin route dispatch, Supabase login enum/RPC | V8, V1 |
| BER-06 | Medium | Profile/member payload | Silent substitution | `berlin/src/bootstrap/types.ts`, `berlin/src/bootstrap/state.ts`, `berlin/src/identity/user-row-normalization.ts`, Roma profile UI | Remove `emailVerified` from bootstrap/member payload and Roma UI, or add a real verified-contact model with an owner. Do not default missing verification truth to false. | Bootstrap contract, Roma profile/team UI | V1 |
| BER-07 | Low | Bootstrap compatibility shape | Legacy compatibility | `berlin/src/bootstrap/state.ts`, `berlin/src/bootstrap/capsule.ts` | Remove `accounts[]` and multi-account/membership wording after consumer confirmation. Use one-account user context naming. | Berlin bootstrap payload, Roma account context | V7 |
| BER-08 | Low | Render queue binding | Dead binding | `berlin/src/types.ts`, `berlin/wrangler.toml` | Delete `RENDER_SNAPSHOT_QUEUE` binding/type after deploy-config confirmation. | Berlin Worker config | V3 |
| BER-09 | Low | OAuth link flow | Dead connector-looking path | `berlin/src/types.ts`, `berlin/src/auth/tickets.ts`, `berlin/src/auth/routes.ts` | Remove `flow: 'link'` from auth ticket schema unless a connector PRD owns a separate future path outside login. | Berlin auth tickets | V7 |
| BER-10 | Low | Berlin docs | Stale docs | `documentation/services/berlin.md`, route registration, auth config | Remove nonexistent contact-method/identity routes from docs and correct provider env contract. | Operators, Roma callers, deploy docs | V3 |
| BER-11 | Medium | Supabase admin list decoder | Corruption-as-absence | `berlin/src/supabase-admin.ts`, bootstrap reads | Successful non-array Supabase payloads must fail closed with structured integrity errors, not become `[]`. | Bootstrap, members, invitations | V5, V3 |
| BER-12 | Medium | Auth ticket store | Corruption-as-absence | `berlin/src/auth/ticket-store.ts` | Distinguish missing/expired tickets from corrupt Durable Object state. Log explicit integrity error and fail. | OAuth callback/finish | V5 |

## Execution Slices

1. Invitation/account binding hardening.
2. Account governance extraction: deletion, locales, lifecycle/owner routes.
3. Publish policy consolidation.
4. Auth cleanup: e2e route isolation, OAuth link flow deletion, dead binding deletion.
5. Bootstrap/profile contract cleanup.
6. Fail-fast decoder hardening.

## Execution Notes

2026-06-17 critical slice:

- BER-01: added `accept_login_invitation_identity` Supabase RPC so login-time invitation acceptance creates the invited user in the invited account and marks the invitation accepted in one transaction.
- BER-01: Berlin now calls the invitation RPC before normal login provisioning when an OAuth transaction carries an invitation id.
- BER-01: invite creation rejects any existing `users.primary_email`; signed-in invitation accept no longer patches an existing user into another account.
- BER-02: Berlin and Roma account deletion return explicit conflict with no DB/R2 mutation; Roma settings no longer offers the delete-account action.

2026-06-17 BER-03 code-complete blocked slice:

- BER-03: removed Berlin `PUT /v1/accounts/:id/locales` registration and deleted `berlin/src/account-management/locales.ts`.
- BER-03: moved account locale settings mutation into Roma `/api/account/locales`, preserving strict locale/policy validation, owner/admin authorization, `l10n.locales.max` entitlement enforcement, base-locale lock, and persisted-row verification.
- BER-03: updated active ownership docs and policy metadata so Roma account locale settings are the mutation owner and Berlin bootstrap remains read-only account context.
- Blocker: live Cloudflare Pages project `roma-dev` lacks `SUPABASE_SERVICE_ROLE_KEY`. `pnpm cf:api:preflight` passed and `pnpm cf:pages:put-secret roma-dev SUPABASE_SERVICE_ROLE_KEY` dry-run proved the secret is absent, but `--apply` failed with Cloudflare `403 Authentication error` using the configured `CLOUDFLARE_REST_API_TOKEN`.
- Closure rule: BER-03 must not be marked complete or pushed to autodeploy until the Pages secret is applied with a Pages-edit-capable token and verified on `roma-dev`.

## Completion Gates

- Berlin runtime still logs in and bootstraps a one-account session.
- No Berlin route claims account deletion without Tokyo/R2 cleanup authority.
- No Berlin product path uses test-auth helpers as normal runtime dependency.
- No missing/corrupt Supabase/ticket state becomes empty, false, or missing.
- Active Berlin docs match registered routes and env behavior.
- V1-V8 subagent audit is clean before moving to executed.
