# Roma — Product Shell (Account App)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Runtime code + deploy config are truth. If this doc drifts from `roma/*` behavior, update it immediately.

For the canonical account-management model Roma must converge to, see `documentation/architecture/AccountManagement.md`.

## Purpose

Roma is the authenticated product shell for account users. It owns:

- Domain navigation (`/home`, `/profile`, `/widgets`, `/builder`, `/assets`, `/team`, `/billing`, `/usage`, `/ai`, `/settings`)
- Person-scoped User Settings UI over Berlin-owned profile contracts
- Active account context resolution
- Account-scoped Team list and member-detail UI over Berlin-owned membership contracts
- Lightweight catalog/list APIs for product UX
- Bob editor orchestration via explicit message boot

Roma is a host/orchestrator. Bob remains the editor kernel.

For the 075 authoring simplification track, Roma's governing authoring path is one boring account flow: resolve current account, open one saved widget document, host Bob editing in memory, and save that document back to Tokyo.

## Deploy plane (cloud-dev/prod)

- Roma is a Cloudflare Pages app with **one deploy plane**: Git-connected Cloudflare Pages build.
- Canonical cloud-dev host: `https://roma.dev.clickeen.com`
- Roma’s authenticated Builder host must be the custom `*.clickeen.com` domain shape. `*.pages.dev` is not a valid public runtime host for Builder flows.
- GitHub Actions may verify Roma’s build contract, but must not create Pages projects, sync Pages secrets, or deploy Roma artifacts.
- Roma’s Pages build contract is app-local:
  - root: `roma/`
  - build command: `pnpm build:cf`
  - output: `roma/.vercel/output/static`
- Roma’s build script still applies an **ephemeral repo-root `.vercel/project.json` shim** with `rootDirectory: 'roma'` because Vercel’s monorepo Next.js builder requires that metadata to resolve traces correctly. This is a builder prerequisite only; the final Pages artifact path stays app-local.
- Manual Cloudflare project/env alignment is documented in `documentation/architecture/CloudflarePagesCloudDevChecklist.md`.

## Runtime surface (current repo snapshot)

### App routes

- `/` → redirects to `/home` when a session is present, otherwise `/login`
- account-shell routes under `roma/app/(authed)/*`, including:
  - `/home`
  - `/profile`
  - `/widgets`
  - `/assets`
  - `/team`
  - `/billing`
  - `/usage`
  - `/ai`
  - `/settings`
- `/builder` and `/builder/:publicId`
- `/widgets/:publicId` (redirects back to `/widgets?selected=:publicId`; widgets list is the canonical status-owner surface)
- `/assets/:assetId` (detail placeholder)

### URL path isolation (Builder)

- Selected instance is path-driven: `/builder/:publicId`.
- Query `publicId` is a fallback input only.
- No auto-pick/random-first-instance behavior exists.
- Roma keeps URL and selected instance synchronized (`router.replace`) so state is deep-linkable.

## Auth + account bootstrap

Roma bootstraps from:

- `GET /api/bootstrap` (canonical)

`/api/bootstrap` proxies to Berlin `GET /v1/session/bootstrap` with the user bearer token.
When no valid session is present, it returns `401` with auth error payload (`coreui.errors.auth.required`).
Roma does not auto-bootstrap tool sessions; supported Roma runtimes always require real Berlin session tokens.
Roma does not bridge session tokens through browser JS. Builder relies on shared httpOnly cookies across Roma/Bob on a custom `*.clickeen.com` domain.
Roma exposes explicit session endpoints for product auth UX:

- `GET /api/session/login/google` (current customer-facing provider-auth start; Google is the enabled cloud-dev provider)
- `GET /api/session/finish` (redeems Berlin `finishId`, sets shared httpOnly session cookies, then redirects into Roma)
- `POST /api/session/logout` (best-effort Berlin logout + clears auth cookies)
- Roma renders a visible shell-level `Sign out` action in the domain nav and mobile drawer, backed by `POST /api/session/logout`, then hard-redirects to `/login`.

Non-local auth rule:

- Deployed Roma/Bob auth treats non-local hosts as HTTPS for redirect + cookie purposes, even if an upstream proxy presents `http` internally.
- This prevents cloud-dev auth completion from losing `Set-Cookie` on an accidental HTTP->HTTPS hop.

Bootstrap payload includes:

- User + account membership graph
- Active account (`activeAccount`)
- Signed account authz capsule (`authz.accountCapsule`, expiry metadata)
- Account entitlement snapshot (`authz.entitlements`) resolved once at bootstrap (`flags`, `caps`, `budgets{max}`)
- The signed capsule itself carries only stable authz truth. Mutable locale settings and live `used` counters are not part of the signed capsule.

Client behavior (`use-roma-me.ts`):

- Resolves account context from `activeAccount`.
- Caches a single bootstrap payload in a process-global in-memory store with TTL aligned to the authz capsule expiry (`authz.expiresAt`, with min floor + fallback TTL).
- Refreshes bootstrap/authz in the background before capsule expiry so the first user action after idle does not discover an expired account capsule.
- Does not store account preference in localStorage.
- Does not honor URL `accountId` overrides.
- Guards and re-initializes global store shape if corrupted.
- When bootstrap returns `coreui.errors.auth.required`, Roma redirects to `/login?next=...` for explicit sign-in.
- Account-affecting mutations explicitly refresh in-memory bootstrap state after success instead of waiting for passive expiry.
- Roma is a single-current-account customer shell. It does not expose customer account switching; internal account switching belongs to DevStudio, and future customer multi-account switching belongs to a separate Roma-for-agency product.
- Authed domain routes and Builder now mount explicit client-side error boundaries so one bad domain render degrades locally instead of taking down the whole workspace shell.

Current cloud-dev product rule:

- Cloud-dev still effectively behaves as one seeded platform-owned account today.
- Even if a user has multiple memberships upstream, current Roma still operates as a single-current-account shell and does not expose customer account switching.

## Upstream route model

Roma talks to upstream systems only through same-origin API routes:

- Browser code stays on `roma/app/api/**`.
- Normal customer product routes are explicit and owned in Roma (`/api/account/**`, `/api/session/**`).
- Those routes call the real owners directly: Berlin for auth/account truth, Tokyo/Tokyo-worker for saved/artifact truth, and San Francisco for AI execution.
- There is no generic Paris proxy in the active Roma product path.
- Account-scoped same-origin responses now stamp `x-request-id`, emit one structured completion log per request, and apply a first per-account KV-backed rate-limit floor on normal `/api/account/**` mutation routes (asset upload/delete included; AI copilot routes excluded from this floor).
- Roma emits structured server-side logs and failures for Cloudflare ingestion. Pages-specific observability toggles are dashboard-owned; Worker-only `wrangler.toml` observability blocks are not valid for the Roma Pages project.

Client fetch behavior:

- Browser code calls same-origin Roma routes only.
- `fetchSameOriginJson` in the browser is just a no-store fetch + timeout/reason wrapper.
- Server routes resolve the bearer from Roma’s httpOnly session cookies and forward upstream.
- Post-bootstrap product-path actions carry `x-ck-authz-capsule` on the active Roma path where Roma authorizes against the bootstrap capsule (`/api/account/widgets`, `/api/account/assets*`, `/api/account/team*`, `/api/account/locales`, Builder/account routes).
- Roma -> Tokyo/Tokyo-worker product control calls now execute through the private `TOKYO_PRODUCT_CONTROL` Cloudflare service binding plus the Roma account authz capsule.
- Roma -> San Francisco calls require explicit `SANFRANCISCO_BASE_URL` + `CK_INTERNAL_SERVICE_JWT`; Roma does not infer or probe internal service hosts.
- Roma no longer calls Berlin for a Michael/PostgREST token. Account registry reads/writes go through Berlin product endpoints with the current Berlin bearer, while Tokyo/Tokyo-worker remain the saved-document and serve-state owners.

## Bob orchestration contract (Roma Builder)

`BuilderDomain` flow:

1. Resolve active Roma workspace context + target `publicId`.
2. Load one Builder-open envelope from Roma same-origin (`GET /api/builder/:publicId/open`), which resolves the saved authoring revision server-side.
3. Load compiled payload (`/api/widgets/:widgetname/compiled`).
4. Wait for Bob `bob:session-ready` (`boot=message`).
5. Send `ck:open-editor` with `requestId`, `widgetname`, `compiled`, `instanceData`, `policy`, `publicId`, `label`, `source`, and `meta`.
6. Wait for terminal open result (`bob:open-editor-applied` or `bob:open-editor-failed`).

This is the governing product-path authoring flow for the 075 authoring simplification track.

Notes:

- Bob account mode is message-boot only. Bob does not recover host asset context from iframe URL params on the account Builder path. Explicit URL boot remains only for non-account surfaces.
- Builder-open is document-only. Roma does not pull publish/live-plane status into the Bob editor envelope.
- Roma no longer uses one mixed helper for both Builder-open document loading and publish/serve-state lookup. Builder-open loads the saved document only; widgets-domain/account routes that need serve-state ask the Tokyo live plane separately.
- Invalid saved-document failures now surface at the Tokyo saved-document control boundary. Roma forwards that boundary result to Builder instead of re-validating the same saved payload again on read.
- Roma now consumes the saved-document identity returned by Tokyo on that path instead of reconstructing `publicId` / `accountId` locally after Tokyo has already answered.
- The Builder host now trusts the successful Builder-open envelope for widget identity instead of running another local `widgetType` proof step before opening Bob.
- On save, Roma now forwards the already-opened saved-pointer metadata (`widgetType`, `displayName`, `source`, `meta`) back to Tokyo with the config write. Tokyo does not look backward at the previous saved pointer to recover sibling metadata during product-path save.
- Product-path save no longer computes localization base state inline. Tokyo-worker derives/ensures l10n base state later from explicit localization/live follow-up consumers.
- Product-path save must stay one user action with one owner in product language: the user saves the instance, and Tokyo-worker reconciles that instance and its derived artifacts. Any transport details behind that handoff are implementation residue, not product meaning, and must not turn into a second save mode or a second user-facing workflow.
- Roma no longer exposes a mixed `GET /api/account/instance/:publicId` reader that combines saved document truth with instance serve-state in one payload. Builder-open remains the document read boundary; widgets-domain serve-state flows ask the Tokyo live plane separately.
- Widgets-domain account instance identity now comes from Tokyo saved documents. Canonical publish/unpublish truth is Tokyo's per-instance serve flag. Any remaining Michael status usage in widgets routes is cutover residue only and must not be treated as surviving authority.
- Account-widget rename now reads the current Tokyo saved document and writes the renamed document back through the same Tokyo save boundary. It no longer patches Michael `display_name` as product identity truth.
- Account create/duplicate commit the Tokyo saved document before creating the Michael row. Widgets never sees a Michael-only placeholder row before the real saved document exists, and Michael row creation no longer copies the live widget document config; schema-required Michael config is inert residue only.
- Asset picker/upload/resolve behavior on the active Builder path now runs through the Roma current-account asset routes, delegated from Bob through one hosted account-command seam. Roma handles `list-assets`, `resolve-assets`, and `upload-asset` directly against those current-account routes and does not feed a hosted asset bridge into Bob for this path.
- In hosted account-editing flows, Bob sends account read/write intents back to Roma over postMessage. Roma executes the named same-origin account routes and returns the result payload to Bob. This keeps Bob as editor kernel and Roma as the product command boundary.
- Account language policy/settings are owned by Roma Settings, not Bob. Roma serves `/api/account/locales` as the same-origin route for that account-level surface, backed by Berlin for the mutation/read and Tokyo-worker-owned downstream locale/live work.
- Team is now a real account domain in Roma: `/team` lists account members from Berlin and `/team/:memberId` drills into Berlin-owned member detail. Role changes and non-owner member removal route through Roma same-origin APIs backed by Berlin (`/api/account/team/members/:memberId`), while person-scoped profile edits stay with the member in User Settings.
- Roma now exposes a dedicated person-scoped User Settings domain at `/profile`. It renders canonical person data from bootstrap, writes self-profile updates through `/api/me` -> Berlin `PUT /v1/me`, and runs phone/WhatsApp verification through same-origin relays to Berlin (`/api/me/contact-methods/:channel/start|verify`). Provider-managed email is display-only in Roma until a Berlin-owned contact-email product flow exists. Linked identities stay internal and are not part of the standard customer-facing surface.
- Roma Team now also exposes Berlin-backed invitation issue/list/revoke flows through `/api/account/team/invitations` and `/api/account/team/invitations/:invitationId`. Team does not expose raw accept tokens or shareable acceptance paths as normal invitation metadata.
- Roma exposes `/accept-invite/:token` as the explicit invitation-accept handoff. If the visitor is not signed in, the page routes them to `/login?next=...`; if signed in, it proxies acceptance to Berlin through `/api/invitations/:token/accept`.
- Roma Settings now exposes owner-only final account-holder actions through Berlin-backed same-origin routes: `/api/account/owner-transfer` and `DELETE /api/account`. Tier, locales, ownership, and delete-account controls now sit on the same Berlin-owned account boundary.

## Widgets domain ownership

Roma `widgets` is the product surface that brokers per-instance serve-state changes:

- `Publish` / `Unpublish` happen in `/widgets`
- `Rename` happens in `/widgets`
- Bob does not expose published/unpublished state changes
- Bob does not persist instance rename inline
- `/widgets` reads account-instance identity from Tokyo and must converge to Tokyo serve-state truth for publish/unpublish. Michael status residue is not the target architecture.
- `Publish` is the explicit serve-on boundary in Widgets: Roma tells Tokyo-worker to make the instance publicly servable, then returns success.
- `Unpublish` removes the Tokyo live surface so Venice stops serving the instance, without deleting saved or internal overlay state.
- Duplicate-from-widget and duplicate-from-listed-instance create account-owned instances through Roma same-origin routes that commit the canonical Tokyo-backed authoring state
- The old settings-level “unpublish all instances” product action is not part of the active product surface

## Data domains and caches (client-side)

- `useRomaWidgets`: account list cache + in-flight dedupe.
- `compiled-widget-cache`: per widget compiled payload cache.
- Widgets prefetch compiled payloads only; Builder open itself is one Roma route.

Usage, billing, and AI domain behavior:

- `UsageDomain` reads live storage usage through `/api/account/usage`, and that route reads the same Tokyo-worker asset authority used by Assets and storage-budget checks. Bootstrap provides only plan/maxima context.
- `BillingDomain` is a placeholder surface today; billing is not configured in current environments.
- `AiDomain` remains bootstrap-driven and renders plan/profile summaries from bootstrap authz context (no extra policy/entitlements fetches).

Assets domain behavior:

- `AssetsDomain` reads account inventory and `storageBytesUsed` from `/api/account/assets` and performs per-asset delete via `/api/account/assets/:assetId`.
- Roma exposes account-level asset routes (`/api/account/assets`, `/api/account/assets/resolve`, `/api/account/assets/:assetId`, `/api/account/assets/upload`) and forwards them to Tokyo-worker through the `TOKYO_ASSET_CONTROL` Cloudflare service binding plus the Roma account authz capsule.
- On the active Builder path, Bob delegates asset list/resolve/upload back to these same Roma routes through the normal host account-command seam. Bob owns the explicit asset transport; Roma owns the direct current-account route handling for those commands.
- `/api/account/usage` remains the Usage domain surface, but it now reads storage bytes from the same Tokyo-worker asset authority as `/api/account/assets`. Assets does not double-read storage truth from both routes on the same screen.
- Roma widget/assets list surfaces no longer rely on fixed client-side `200/500` caps; Michael pages account widget catalogs internally and Tokyo-worker asset inventory already returns the full account manifest.
- Account asset upload is same-origin Roma product traffic. The active product path no longer exposes wildcard CORS on `/api/account/assets/upload`.
- Roma exposes private non-asset product control routes to Tokyo-worker through the `TOKYO_PRODUCT_CONTROL` Cloudflare service binding plus the Roma account authz capsule. Public Tokyo HTTP is no longer the Builder open/save authoring seam.
- Asset inventory/upload payloads expose `assetId` and canonical `assetRef` only; delivery URL comes from `/api/account/assets/resolve`, and Roma delete uses `assetId` directly instead of reverse-parsing it from the ref.
- Builder save writes the instance through the Tokyo/Tokyo-worker boundary. Save success now requires Tokyo-worker to write the current saved widget `l10n` status on the saved pointer; LLM generation and R2/runtime artifact convergence still run after save. `published` / `unpublished` does not change the meaning of Save; it only changes whether Venice may publicly serve the instance.
- While Builder `Translations` is open, Bob reads one Roma same-origin route: `GET /api/account/instances/:publicId/translations`. Roma stays read-only on that path and relays Tokyo-worker's current `baseLocale`, `requestedLocales`, `readyLocales`, `status`, `failedLocales`, `baseFingerprint`, `generationId`, and `updatedAt` truth.
- When account locale settings change, Roma now fans that locale intent out across all account-owned saved instances, not just published ones:
  - published instances enqueue Tokyo-worker sync with `live: true`
  - unpublished instances enqueue Tokyo-worker sync with `live: false`
  - curated starter instances are not part of that account locale fanout
- Localization staleness is derived from Tokyo-owned localization artifacts/state after lazy base derivation; San Francisco remains generation-only.
- Roma-side non-storage account-budget reads now take `USAGE_KV` explicitly from the request boundary instead of reaching through ambient global context in the hot product path. Storage bytes are no longer read from `USAGE_KV`.
- Assets supports single upload, bulk upload (multi-file queue), list, resolve, and per-asset delete only.
- Assets are immutable. Upload creates a new asset identity, canonical delivery URLs stay aggressively cacheable, and there is no product workflow for refresh-in-place, recache, or replace-in-place mutation.
- Account is the ownership boundary.

## Local vs cloud-dev

### Cloud-dev

- Roma runtime target: `https://roma.dev.clickeen.com` (Pages `*.pages.dev` deploys are not supported for authenticated Builder because cookies cannot be shared to Bob).
- Uses cloud-dev Berlin/Tokyo/Bob/San Francisco URLs from env/config.
- Cloud product auth presents Berlin provider auth only in customer UI, with Google as the enabled cloud-dev provider. Roma no longer carries a hidden email/password session route for CI smoke.
- Cloud-dev currently runs as one effective product account: admin. Roma does not expose customer account switching there or in the normal Roma product shell.

## Operational notes

- Canonical startup script is `bash scripts/dev-up.sh`.
- Roma is **cloud-only** for supported product behavior. Local is for building blocks only (Bob/Berlin/Tokyo/Venice/DevStudio).
- If services appear down after a successful start, verify the parent shell/session that launched `dev-up` is still alive.
