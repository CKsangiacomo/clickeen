# PRD 124A - Berlin Identity Boundary Optimization And Deletion

Status: EXECUTED
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

2026-06-17 BER-03 code-complete slice:

- BER-03: removed Berlin `PUT /v1/accounts/:id/locales` registration and deleted `berlin/src/account-management/locales.ts`.
- BER-03: moved account locale settings mutation into Roma `/api/account/locales`, preserving strict locale/policy validation, owner/admin authorization, `l10n.locales.max` entitlement enforcement, base-locale lock, and persisted-row verification.
- BER-03: updated active ownership docs and policy metadata so Roma account locale settings are the mutation owner and Berlin bootstrap remains read-only account context.
- Cloudflare verification: `pnpm cf:api:preflight` passed and `pnpm cf:pages:project roma-dev` reports production `SUPABASE_SERVICE_ROLE_KEY` as present `secret_text`.
- Closure verification: independent BER-03 V1-V8 audit confirmed no active Berlin `PUT /v1/accounts/:id/locales`, no `berlin/src/account-management/locales.ts`, Roma `/api/account/locales` as the only account locale mutation owner, Berlin bootstrap read-only locale context, and no open BER-03 blocker.

2026-06-17 BER-04 deletion slice:

- BER-04: deleted Berlin `GET /v1/accounts/:id/publish-containment` route registration and implementation.
- BER-04: deleted Roma's Berlin publish-containment bridge and removed containment calls from widget-instance and page publish routes.
- BER-04: removed active Berlin service documentation for publish containment. Historical migrations remain historical records; the current core foundation migration drops `account_publish_containment`, so the active runtime no longer depends on that obsolete table.
- BER-04: deleted unused shared reason-key residue for the removed publish-containment path.
- Boundary rationale: Berlin supplies auth/session/bootstrap. Roma/Tokyo own account publish actions through the existing product publish routes. No replacement policy layer was added.
- Closure verification: independent BER-04 audit confirmed no active Berlin/Roma route, client, table, or docs dependency on publish containment and a clean V1-V8/product-law assessment.

2026-06-17 BER-05 deletion slice:

- BER-05: deleted Berlin `/internal/e2e/session` route registration and implementation.
- BER-05: deleted Roma `/api/e2e/session` and DevStudio `/api/e2e/session` because they only proxied the removed Berlin runtime test helper.
- BER-05: removed E2E runtime env/config requirements from Berlin, Roma, DevStudio, and Cloudflare helper docs.
- BER-05: changed Playwright setup to use an ignored storage-state file only; missing auth state skips authenticated specs instead of minting product runtime sessions.
- BER-05: added Supabase migration `20260617193000__prd124a_remove_e2e_email_provider.sql` to make login providers Google-only. The migration fails explicitly if existing rows still use a non-Google login provider; it does not delete or rewrite account data.
- Boundary rationale: Berlin owns product auth/session/bootstrap, not runtime test session minting. Product login remains Google-only. E2E state is external test material, not a product service.
- Closure verification: independent BER-05 audit confirmed no active runtime E2E session mint route/config, no active `email` provider runtime path, fail-closed migration behavior for existing non-Google rows, and a clean V1-V8/product-law assessment.

2026-06-17 BER-06 deletion slice:

- BER-06: removed `emailVerified` from Berlin profile/member/bootstrap payload types and user-row normalization.
- BER-06: removed Roma profile/team member UI display and client types for `emailVerified`.
- Boundary rationale: current user rows do not expose verified-contact truth. Berlin must not convert missing verification truth into `false`, and Roma must not display invented verification state.
- Closure verification: independent BER-06 audit confirmed no active bootstrap/profile/member/Roma payload leakage of `emailVerified`, allowed Google provider verification input remains isolated to login, and a clean V1-V8/product-law assessment.

2026-06-17 BER-07 deletion slice:

- BER-07: removed `accounts[]` from the Berlin bootstrap response type and payload.
- BER-07: removed Roma's `accounts[]` client type and changed the account notice modal to read `activeAccount.lifecycleNotice` directly.
- Boundary rationale: the active product resolves one current account per session. Berlin may use internal account rows to select that account, but the bootstrap API no longer exposes a multi-account compatibility shape.
- Closure verification: independent BER-07 audit confirmed no public bootstrap `accounts[]`, no Roma bootstrap consumer residue, internal Berlin account rows remain only for active-account resolution, and a clean V1-V8/product-law assessment.

2026-06-17 BER-08 deletion slice:

- BER-08: deleted unused Berlin `RENDER_SNAPSHOT_QUEUE` Env type field.
- BER-08: deleted unused Berlin `RENDER_SNAPSHOT_QUEUE` Wrangler queue producer binding.
- Boundary rationale: Berlin auth/session/bootstrap has no render snapshot producer responsibility. The binding had no active callers and was dead deploy configuration.

2026-06-17 BER-09 deletion slice:

- BER-09: removed OAuth transaction `flow: 'link'` from Berlin types and ticket decoding.
- Boundary rationale: active Berlin auth creates login transactions only. Connector/account-linking is not a current product auth path and must not remain as a dead alternate identity workflow.

2026-06-17 BER-10 doc-truth slice:

- BER-10: removed nonexistent contact-method and identity route claims from `documentation/services/berlin.md`.
- BER-10: aligned Berlin OAuth transaction wording to login-state metadata only.
- Boundary rationale: active service docs must match registered routes and deploy configuration. Docs must not advertise dead product surfaces or alternate auth workflows.

2026-06-17 BER-11 fail-fast decoder slice:

- BER-11: changed `readSupabaseAdminListAll` so a successful Supabase response with a non-array payload returns an internal failure instead of `[]`.
- BER-11: removed remaining direct Supabase response `[]` fallbacks from Berlin member, invitation, governance, bootstrap profile, and user-settings paths.
- Boundary rationale: Berlin bootstrap/account-management readers must not convert malformed storage truth into absence.

2026-06-17 BER-12 ticket-store integrity slice:

- BER-12: added an explicit `corrupt` ticket-consume outcome for malformed Durable Object state or malformed ticket payloads.
- BER-12: changed OAuth callback and finish routes to return internal failure for corrupt ticket state while preserving normal missing, expired, and already-consumed ticket outcomes.
- Boundary rationale: missing/expired OAuth tickets are auth state outcomes; malformed stored ticket state is Berlin storage corruption and must not masquerade as absence.

2026-06-17 closure verification:

- BER-01 and BER-02: independent closure audit confirmed invitation acceptance is login-time RPC flow, signed-in accept does not mutate account membership, and account deletion returns explicit conflict without DB/R2 deletion.
- BER-08 through BER-12: independent closure audit confirmed dead render queue binding removal, login-only OAuth transaction shape, Berlin doc/runtime route alignment, fail-closed Supabase array payload handling, and corrupt ticket-state failure.
- V5 residual closure: independent follow-up audit confirmed malformed present invitation rows fail explicitly instead of becoming missing or filtered, while genuinely absent rows remain not-found/null outcomes.
- Product-law result: clean V1-V8 for the Berlin slices in this PRD. Berlin remains auth/session/bootstrap plus residual explicitly named account-management routes; no deleted workflow was redressed under another route.

## Completion Gates

- Berlin runtime still logs in and bootstraps a one-account session.
- No Berlin route claims account deletion without Tokyo/R2 cleanup authority.
- No Berlin product path uses test-auth helpers as normal runtime dependency.
- No missing/corrupt Supabase/ticket state becomes empty, false, or missing.
- Active Berlin docs match registered routes and env behavior.
- V1-V8 subagent audit is clean before moving to executed.
