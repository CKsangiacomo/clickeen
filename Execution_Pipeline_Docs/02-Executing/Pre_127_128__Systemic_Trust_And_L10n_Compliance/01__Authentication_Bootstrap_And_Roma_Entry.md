# Pre-127/128 Slice 1 — Authentication, Bootstrap, And Roma Entry

Status: **IN PROGRESS — FINDINGS CLASSIFIED; SMALLEST OWNING CORRECTIONS READY FOR IMPLEMENTATION**

Owner: Clickeen product owner/architect

Date: 2026-08-21

## 1. Goal

Correct the included member journey from login or invitation entry through
Berlin authentication/bootstrap into Roma's authenticated shell. Apply the
established systemic UX, trust, and English-source laws without redesigning
authentication, adding a new authority, or entering a later product slice.

## 2. Exact Slice Boundary

Included:

- Roma login and invitation-recipient entry;
- Berlin login-time invitation acceptance;
- session bootstrap and exact current-account truth;
- Roma's initial authenticated shell;
- the loading, failure, recovery, session-expiry, visible-copy, and
  accessibility states reached by that journey;
- trust handoffs reached between Berlin, Roma, and Michael; and
- English Roma Chrome reached by these states, owned under `roma/l10n/` by the
  authentication or shell feature that renders it.

Excluded:

- every later Pre-127/128 slice;
- DevStudio and Prague;
- public/published Widget surfaces and copy;
- customer Widget content, locale overlays, public localization, translation
  generation, model execution, and non-English UI;
- product-data writes, commits, pushes, deployments, managed-service changes,
  and live-state mutation.

## 3. Authority Coordinates

| Coordinate | Authority |
| --- | --- |
| Product surface | Roma login, invitation entry, and authenticated shell |
| Session/current-account authority | Berlin |
| Relational user/account/invitation truth | Michael/Supabase, reached only through Berlin |
| Product route boundary | Roma public/authenticated routes and Berlin OAuth/bootstrap routes |
| Product storage coordinate | No storage mutation is authorized; reads use the current session/account truth |
| Runtime/deploy surface | Roma and Berlin cloud-dev are evidence surfaces only; no deployment is authorized |
| Verification surface | Focused Roma/Berlin producer checks, local journey replay, and independent V1–V8 audit |
| Copy authority | The exact Roma authentication or shell feature under `roma/l10n/` |

## 4. Context Reset And Baseline

Primary-agent read set completed before code inspection:

- `AGENTS.md`;
- `documentation/README.md`;
- `documentation/architecture/CONTEXT.md`;
- `documentation/architecture/Tenets.md`;
- `documentation/strategy/WhyClickeen.md`;
- the complete parent Pre-127/128 execution document;
- `documentation/architecture/Overview.md`;
- `documentation/architecture/AccountManagement.md`;
- `documentation/architecture/RuntimeProfiles.md`;
- `documentation/capabilities/multitenancy.md`;
- `documentation/capabilities/localization.md`;
- `documentation/services/berlin.md`;
- `documentation/services/roma.md`;
- `documentation/services/michael.md`;
- `documentation/services/dieter.md`;
- `documentation/engineering/UI/README.md`;
- `documentation/engineering/UI/dieter.md`;
- `documentation/engineering/UI/interactions.md`;
- `documentation/engineering/UI/accessibility.md`;
- `documentation/engineering/UI/dialogs-and-modals.md`;
- `documentation/engineering/UI/surfaces.md`;
- `documentation/engineering/UI/components.md`; and
- the PRD 127 product-law sections reached by English source ownership.

Participating agents perform and report their own complete reset; their work
does not replace the primary-agent read.

Baseline:

```text
branch: main
HEAD: 26a644b10d8168dc714e4e16636026c27849e006
github/main: 26a644b10d8168dc714e4e16636026c27849e006
worktree at slice start: clean
product-data mutation: none
commit/push/deploy authorization: none
```

## 5. PM/UX Journey And State Map

The independent PM/UX reconstruction and authority trace agree on this current
journey:

| State | Authoritative truth and current presentation | Reachability | Disposition |
| --- | --- | --- | --- |
| Protected route without a session | Roma redirects to Login with the exact requested path. `/profile` currently misses the same middleware boundary. | happening now / concretely reachable | keep the shared redirect; add the omitted current route |
| Login ready and submit | Roma presents Google login; the visible and accessible copy is local to the component and the exact operated control does not present redirect pending. | happening now / concretely reachable | move exact copy to Auth l10n; keep pending on the exact control |
| Invalid explicit continuation | Roma silently changes a supplied invalid `next` to `/home`. | concretely reachable | reject visibly at the browser ingress; only an absent continuation may mean `/home` |
| Invitation-recipient entry | The canonical path carries the invitation UUID through OAuth; Berlin accepts it transactionally during login and lands at `/home`. | concretely reachable | keep |
| Signed-in invitation page | Roma offers a second Accept command that Berlin always rejects; the page may display invented `unknown email`. | concretely reachable | remove the alternate command and fallback; always use login-time acceptance |
| OAuth denial or callback failure | Provider denial drops the invitation continuation; most other callback failures expose raw Berlin JSON instead of Roma-owned recovery. | concretely reachable | preserve exact continuation/reason and return the browser to Auth presentation |
| Finish and first-account setup | Berlin issues exact session/continuation truth. Roma re-proves/defaults it. Failed initial defaults setup redirects with an ignored recovery query and then appears successful. | concretely reachable | trust the exact Berlin success contract; make failed setup visible and recoverable without claiming normal entry |
| Initial bootstrap pending | Shell stays mounted and only page content shows the systemic accessible Spinner. | happening now | keep; put the accessible label in its feature source |
| Bootstrap transient failure | Page content shows the exact error and an exact-control Retry. | concretely reachable | keep mechanics; move copy to Shell l10n |
| Bootstrap forbidden | The same Retry is offered even though retry supplies no new authority. | concretely reachable | fail closed without a false recovery control |
| Access expiry with valid refresh | Roma rotates through Berlin and continues the shell. | concretely reachable | keep |
| Refresh invalid versus Berlin unavailable | Roma rewrites both conditions to `auth.required`, making an outage look like expiry. | concretely reachable | preserve distinct reason/status and recovery |
| Root entry with refresh only | `/` checks only the access cookie and sends a valid refresh session to Login. | concretely reachable | honor the existing refresh authority |
| Sign out | The operated control correctly shows pending, but Roma always claims success and leaves the authz capsule cookie. | concretely reachable | clear complete local authority; expose revocation failure truth without retaining a usable local session |
| Authz capsule at account-route ingress | Roma verifies the capsule but does not bind it to the active session principal. A stale capsule can survive an interrupted session replacement. | concretely reachable at untrusted browser ingress | bind the two authorities once at the route authorization boundary |

Long-copy review found no new layout system requirement. Auth and failure
messages remain complete units. Copy must not be stitched around absent member
truth, and Dieter receives resolved caller copy only.

## 6. Findings

### S1-F01 — Auth And Shell Copy Has No Feature Owner

- **Flow:** Login, invitation entry, bootstrap loading/failure, shell actions,
  and Sign out.
- **Reachability:** happening now.
- **Evidence:** copy is distributed through `roma/app/login/page.tsx`,
  `roma/components/accept-invite-domain.tsx`,
  `roma/components/roma-account-context.tsx`,
  `roma/lib/account-shell-copy.ts`, shell/navigation components, and the flat
  `roma/l10n/en.json`.
- **Disposition:** fix under D1/D10. Install proven Auth and Shell feature
  sources plus the systemic-state source under `roma/l10n/`; keep English a
  direct typed import with no loader, registry, fallback, or translation work.

### S1-F02 — Parallel Invitation Acceptance Masquerades As Product Work

- **Flow:** a signed-in member opens `/accept-invite/{uuid}`.
- **Reachability:** concretely reachable.
- **Evidence:** Roma presents and POSTs Accept while Berlin intentionally
  returns `invitation_accept_requires_login_flow`; login-time acceptance is the
  documented operation.
- **Disposition:** remove under D2/D9 and V1/V7. Retain one immediate invitation
  entry that starts login; remove the alternate command, proxy, pending/error
  machinery, and `unknown email` substitution.

### S1-F03 — Authentication Continuation And Failure Truth Is Lost

- **Flow:** invalid explicit `next`, provider denial, invalid callback,
  provider exchange/config failure, or invitation acceptance failure.
- **Reachability:** concretely reachable.
- **Evidence:** Roma substitutes `/home`; Berlin denial drops the consumed
  transaction continuation; other browser callbacks return service JSON.
- **Disposition:** fix under D9 and V1/V7. Validate untrusted continuation at
  ingress, then preserve the exact accepted transaction and exact failure
  reason into Roma's Auth surface.

### S1-F04 — Refresh Failure Masquerades As Expired Session

- **Flow:** access expires while the refresh credential exists and Berlin is
  unavailable or returns malformed success.
- **Reachability:** concretely reachable.
- **Evidence:** `refreshSession` records unavailable/producer failure but
  `resolveSessionBearer` emits `auth.required` for every failure.
- **Disposition:** fix under D9/V7. Keep credential validation at ingress;
  preserve invalid-session versus unavailable-producer truth.

### S1-F05 — Entry And Setup Can Claim The Wrong State

- **Flow:** root entry with only a valid refresh credential; or failure after
  session/account creation while first-account Widget Defaults are initialized.
- **Reachability:** concretely reachable.
- **Evidence:** `/` tests only the access cookie; finish recovery parameters
  are never consumed and ordinary Home can render after setup failed.
- **Disposition:** fix under D9 and V3/V6. Use the existing session authority
  for root entry and expose the exact failed setup operation with a real retry
  boundary rather than an ignored query protocol.

### S1-F06 — Roma Re-Proves Or Omits Berlin Success Truth

- **Flow:** finish redemption, refresh success, and bootstrap success.
- **Reachability:** every normal authenticated entry.
- **Evidence:** Roma normalizes/defaults continuation and reparses Berlin token,
  TTL, account, and capsule fields; bootstrap can omit a missing capsule while
  returning success.
- **Disposition:** fix under Tenets 3–5. Berlin remains the producer and must
  reject malformed provider/storage input. Roma consumes its exact successful
  contract and fails visibly if no success exists; it does not invent a
  continuation or partial bootstrap.

### S1-F07 — Recovery And Sign-Out Controls Misstate Authority

- **Flow:** terminal bootstrap forbidden and Sign out when Berlin revocation
  fails.
- **Reachability:** concretely reachable.
- **Evidence:** forbidden receives the generic Retry; logout ignores the
  revocation response, returns success, and leaves the authz capsule.
- **Disposition:** fix under D6/D9 and V6/V7. No Retry for terminal forbidden;
  Sign out clears all local session authority for safety while presenting the
  real revocation result on the exact control.

### S1-F08 — Account Capsule Is Not Bound To The Session At Browser Ingress

- **Flow:** direct account API call after sequential session replacement leaves
  a still-valid capsule beside another active session.
- **Reachability:** concretely reachable at the untrusted Roma route boundary.
- **Evidence:** capsule signature/role is verified, but its user/account
  authority is not bound to the active bearer principal; logout does not clear
  it today.
- **Disposition:** fix at the existing authorization ingress only. Do not add
  downstream semantic validation.

### Kept Boundaries

Keep Berlin provider/state/PKCE/session/invitation ingress validation, Michael's
transactional invitation rules, bearer/cookie admission, signatures, expiry,
role authorization, and producer assembly failures. These are not internal
distrust. Navigation labels reached only because the shell mounts are moved to
their Shell copy source here; full destination information architecture remains
Slice 2.

## 7. Smallest Owning Correction Plan

### Code

1. Create only the proven Roma English feature sources and direct typed
   composition required by Auth, Shell, and systemic states.
2. Correct Roma's login/invitation UI, protected/root entry, bootstrap recovery,
   forbidden, and Sign-out presentation using existing Dieter primitives.
3. Correct Berlin callback error routing and preserve the exact accepted OAuth
   continuation; retain every external/provider/security check.
4. Correct Roma session/finish/bootstrap/logout consumption so it trusts exact
   Berlin success, preserves producer failure truth, clears complete local
   authority, and binds session/capsule at the existing account-route ingress.
5. Delete the obsolete signed-in invitation acceptance proxy only after all
   current references are removed.
6. Add focused producer and member-journey tests for the concrete corrected
   states. Tests remain proof, never runtime dependencies.

### Product Data And Runtime

No product-data write, managed-service mutation, deployment, or cloud-dev
mutation is authorized or required. Live reads already recorded prove the
current baseline only; corrected behavior will remain local source truth.

### Documentation

Update only the current Berlin, Roma, Account Management, and multitenancy
manual statements exposed by the correction. Remove the obsolete signed-in
invitation path from operator truth and record exact corrected failure/trust
behavior.

### Parallel Ownership

- Roma presentation/l10n owns only application feature sources and reached UI.
- Berlin/Roma auth transport owns callback, finish, refresh, logout, bootstrap,
  and ingress authorization contracts.
- The primary agent owns integration, generator sequencing, documentation,
  broad verification, journey replay, and reconciliation.
- A fresh non-implementing agent owns the final V1–V8 audit.

## 8. Implementation Record

Not started.

## 9. Verification And Member-Journey Replay

Not started.

## 10. Independent V1–V8 Audit

Not started. A non-implementing agent will audit the settled correction after
implementation and producer verification.

## 11. Reconciliation

Slice remains open.
