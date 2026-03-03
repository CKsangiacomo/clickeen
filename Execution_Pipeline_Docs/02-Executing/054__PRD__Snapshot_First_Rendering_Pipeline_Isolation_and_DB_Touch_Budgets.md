# PRD 54 — Live Pointers + Hashed Parts (Config/Text), Venice Dumb, Pipeline Isolation, and Fixed DB-Touch Budgets

Status: EXECUTING (spec)
Date: 2026-03-01
Owner: Product Dev Team
Priority: P0

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare) — Roma on the admin account
- Local is for building blocks only (DevStudio, Dieter, widgets), not for proving PRD 54 end-to-end
- Canonical startup (when local is used): `bash scripts/dev-up.sh`

Supersedes:
- PRD 50, 51, 52, 53 (see 03-Executed)

Pre-GA posture (locked):
- This is a MAJOR ARCHITECTURE PIVOT + REFACTOR.
- We are PRE-GA.
- NO backcompat is allowed.
- NO legacy support is allowed.
- There is only 1 acceptable system state: the intended state described in this PRD.
- No request-time fixes. No runtime tier branching. No “generate everything for everyone, then decide later”.

---

## One-line objective

Make embeds deterministic and cheap by making **Bob/Roma decide what is allowed + live**, mirroring **only what’s live** into Tokyo/R2 as **(1) immutable hashed parts** (`configFp`, `textFp`) plus **(2) tiny “live pointer” files**, and making Venice public routes **serve only Tokyo bytes** with **0 DB calls**.

---

## Core tenets (non-negotiable)

### T1) Decide first in Bob/Roma, mirror exactly that
- The system must never generate outputs the account is not entitled to.
- Tokyo-worker jobs must contain the **exact live plan** (`localePolicy` + whether SEO exists).

### T2) Venice public is dumb: serve Tokyo bytes only
For public traffic:
- `GET /e/:publicId` and `GET /r/:publicId` MUST serve only Tokyo/R2 bytes (the live mirror).
- They MUST NOT call Paris or Supabase.
- They MUST NOT mutate anything at request time (no healing, no fallbacks, no re-rendering).

### T3) Tokyo-worker is dumb: fingerprints + writes only
- Tokyo-worker computes fingerprints and writes files/indexes.
- Tokyo-worker MUST NOT “discover” what to do by reading DB.
- Tokyo-worker MUST NOT call Venice to render content.

### T4) Locale and asset pipelines are isolated
- Locale pipeline may write ONLY translatable string content (allowlisted paths).
- Asset pipeline may write ONLY asset blobs + asset metadata (and MAY delete them).
- Locale pipeline must never touch asset refs, media URLs, posters, etc.

### T5) Locales are incremental and entitlement-bounded
- Base changes trigger targeted locale updates only for changed allowlisted fields.
- Final locale set is capped by entitlement (`l10n.locales.max`) BEFORE generating anything.

### T6) Assets are user-managed (Roma), never system-healed
- No auto-repair, no auto-replace, no fallback asset values at runtime.
- Missing assets must be explicit and observable (not silently swapped).

### T7) DB touch budgets are fixed and few
Acceptable DB-touch moments:
1. **Editor session load:** 1 read to load workspace + instance.
2. **Save (draft):** 1 write per explicit save boundary (draft config/text + minimal metadata).
3. **Go live / go dark:** 1 write to flip the instance live flag (`published`) and enqueue Tokyo mirror jobs.
4. **Instance create:** 1 write (plus minimal metadata), not a cascade.

Non-acceptable:
- Any DB reads on Venice public embed hot path.
- Tokyo-worker reads of Supabase for “enforcement”, “rehydration”, “discovery”, or orchestration.

### T8) SEO/GEO optimized embed is tier-gated when making things live
Non-negotiable truth:
- SEO/GEO optimized embed (`/r` payload + `/r?meta=1` meta-only payload) is only available to entitled tiers.
- It MUST NOT be generated/stored for every user.
- Bob/Roma must not offer the SEO/GEO embed option to non-entitled tiers.

### T9) Tokyo is a mirror (not an archive)
Non-negotiable:
- Tokyo/R2 must not accumulate “dead” bytes.
- If Bob/Roma says something is not live / not entitled, it must not exist in Tokyo under Clickeen-managed namespaces:
  - instance render/config/meta files (`renders/...`)
  - locale text packs + pointers (`l10n/...`)
  - assets (`assets/...`)

Why:
- Prevents an R2 landfill that becomes impossible to reason about.
- Avoids accidental serving of stale/paid bytes due to pointer bugs.
- Keeps “Venice is dumb” true forever (no runtime cleanup/fallback logic).

Clarification:
- Assets are mirrored to what Roma Assets says exists for the account (within plan). Assets are not deleted just because an instance is unpublished; they are deleted when Roma/Bob policy deletes them (including forced deletes on downgrade/closure).

### T10) Downgrade/closure storage is a hard delete (assets included)
Non-negotiable:
- When an account downgrades (trial ends, cancels, drops tier), we do a forced storage cleanup:
  - Keep only what the new plan allows.
  - Delete everything else from Tokyo/R2 (including assets).

Plain English:
- We do not “pause” storage for non-paying users. We delete it.
- Draft config/text may still exist in DB, but it may reference missing assets after downgrade. That is expected and must be messaged in UI.

---

## PRD 54 parts (split for clarity)

This is a core architecture refactor PRD, so it is split into three “detail specs”:

- Read plane (Tokyo paths + caching + Venice contract): `Execution_Pipeline_Docs/02-Executing/054A__PRD__Read_Plane__Tokyo_Paths_Live_Pointers_Packs_Caching_Venice_Contract.md`
- Write plane (Bob/Roma → Paris → Tokyo-worker jobs + l10n contracts): `Execution_Pipeline_Docs/02-Executing/054B__PRD__Write_Plane__Bob_Roma_Paris_TokyoWorker_Mirror_Jobs_and_L10n.md`
- Lifecycle + execution (unpublish/downgrade cleanup + gates): `Execution_Pipeline_Docs/02-Executing/054C__PRD__Lifecycle_and_Execution__Unpublish_Downgrade_Cleanup_Gates.md`

This spine doc stays “human workflow first” and holds the pivot narrative.

---

## This is a pivot PRD (what changes)

We are pivoting from a backwards model:
- “Create everything for everyone, then do runtime checks/fallbacks and try to decide what to serve.”

To the only acceptable model:
- **Decide first in Bob/Roma** → **Write only what’s allowed into Tokyo** → **Venice serves bytes; no brains**

Two key simplifications:
1. **Split the world into parts:** config and text are separate hashed parts. Changing text does not change config.
2. **Tokyo is a mirror, not an archive:** if it’s not live/allowed, it must not exist in Tokyo.

---

## Scope (what this PRD covers)

In-scope:
- Public embed delivery (`/e`, `/r`, and SEO/GEO meta mode).
- Go-live rules: entitlements → what exists in Tokyo.
- Tokyo/R2 storage model for config/text/meta packs + live pointers.
- Tokyo-worker responsibilities: fingerprinting + writing to Tokyo only.
- Venice responsibilities: serving Tokyo bytes only (0 DB calls).
- Locale + asset pipeline isolation rules and where each writes.
- DB-touch budgets (when DB is allowed to be touched, and when it is forbidden).
- Cloud-dev execution posture: we validate PRD 54 in Cloudflare Roma (admin account), not in a fragile local full-stack.
- Auth V1 (Google login) so cloud-dev Roma/Bob is usable and access-controlled during the pivot.

Out-of-scope:
- New customer-facing features.
- Backwards compatibility for any pre-pivot published data (we are PRE-GA).
- Reworking Dieter design system or widget UI work unrelated to publish/serve determinism.
- Multi-provider auth/SSO, invites, org provisioning, and “perfect” auth UX (V1 is Google only).

Non-goals:
- Supporting “best-effort” public rendering when live pointers/packs are missing.
- Adding more services.
- Creating runtime tier fallbacks or alternate runtime code paths.
- Keeping a reliable “local Roma” as an integration environment during this pivot.

---

## Execution posture (Cloudflare Roma only) + why Auth must be built now

This is not about “preference”. It’s about making PRD 54 actually shippable.

### Why we stop relying on local Roma for PRD 54

PRD 54 correctness lives in Cloudflare reality:
- R2 object layout + prefix deletes (Tokyo mirror rules)
- CDN caching behavior (`no-store` pointers vs immutable packs)
- Venice running at the edge (and staying DB-free)
- Geo headers for IP-based locale selection (`localePolicy.ip.enabled`)

Local full-stack is too brittle here:
- It breaks often, drifts by machine, and produces false confidence (“works locally”).
- It tempts us to add local-only hacks/fallbacks, which violate the tenets.

So we do the boring, correct thing:
- **Cloud-dev (Cloudflare Roma, admin account) is the only supported integration environment for PRD 54 execution.**
- Local DevStudio stays for fast iteration on widgets + Dieter + “building blocks”.

### Directional effort: DevStudio becomes local Admin; Roma (cloud-dev) becomes the product surface

This PRD is also a tooling pivot:
- We will **deprecate** DevStudio “widget workspace” functionality that existed mainly to chase **local ↔ Cloudflare parity**.
- DevStudio stays local, but it evolves into an **admin + system builder** tool:
  - manage system data (entitlements, accounts, users)
  - build/curate base blocks (widgets, curated instances, Dieter components)
- Everything that is “real product behavior” (instances, locales, assets, going live/go dark, what exists in Tokyo) happens in **Roma on Cloudflare**.

Why this makes the system ~100× simpler:
- **One truth:** there is one place where “live” is decided and proven (cloud-dev Roma). No second UI that “almost” does the same thing.
- **No parity tax:** we stop building and maintaining parity shims for R2 layout, CDN caching, edge behavior, geo headers, and prefix deletes.
- **Less code + fewer bugs:** we delete duplicated flows, duplicated auth paths, and duplicated “publish” surfaces.
- **Less drift:** local machines no longer define “what works”. Cloudflare does.
- **Cleaner architecture:** Roma/Bob decides → Tokyo mirrors → Venice serves bytes. DevStudio is not in that hot path at all.

### Why Auth is required to make this workable (V1 = Google login)

If Roma lives in cloud-dev and becomes the integration truth:
- We must control who can access the admin workspace and mutate instances/locales/assets.
- We must have a trustworthy identity so Bob/Roma can apply entitlements server-side (the only brain).
- We must avoid “shared links / shared secrets” that become permanent accidental architecture.

V1 scope:
- Google login only (fast, secure enough, and unblocks the team).
- Consistent session across Bob/Roma → Paris write boundary.
- Public embed routes stay unauthenticated and DB-free (Venice is still dumb).

How Google login works in cloud-dev (Roma on Cloudflare):
1. Human clicks “Continue with Google” in Roma/Bob.
2. Roma asks Berlin (Auth boundary) to start Google login and returns the Google URL.
3. Browser redirects to Google, user signs in/consents.
4. Google redirects back to a Roma callback URL with `code` + `state`.
5. Roma exchanges `code` + `state` with Berlin (server-to-server).
6. Berlin returns a Clickeen session (access token + refresh token).
7. Roma sets httpOnly cookies (`ck-access-token`, `ck-refresh-token`) and redirects the user back into the app.

Non-negotiable:
- Session tokens must not be handled in browser JS (no “copy token into localStorage”).
- Venice public `/e` and `/r` remain unauthenticated and DB-free.
- Roma must run on a `*.dev.clickeen.com` custom domain (not `pages.dev`) so cookies can be shared to Bob.

We add more providers later, but we need V1 now so the team can work in one shared cloud environment without chaos.

## End-to-end flows (real world, step-by-step)

This section is intentionally “human workflow first”.

### Flow 1 — Editor load (1 DB read)

What the human does:
1. Opens a workspace + selects an instance in Bob/Roma.

What the system does:
1. Bob/Roma calls Paris once to load:
   - workspace + instance draft/config + minimal metadata
2. Bob/Roma keeps everything else in memory for the editor session.

DB budget:
- Exactly 1 DB read.

Forbidden:
- Background polling “just to keep it fresh”.
- Any Venice reads here.

### Flow 2 — Save (1 DB write) + two independent pipelines (config vs text)

What the human does:
1. Edits the instance.
2. Clicks save (or autosave triggers a save boundary).

What the system does:
1. Bob/Roma sends one write to Paris to persist:
   - draft config (structure/layout/style; includes asset refs)
   - draft text (human-visible strings)
   - minimal metadata

DB budget:
- Exactly 1 DB write per save boundary (not a cascade).

Then, **two independent pipelines** may run (depending on what changed):

Important:
- If the instance is not live (`published=false`), save stops at the DB write (no Tokyo storage writes).

#### A) Config pipeline (layout/style/config + asset refs)
If the save changed config (fonts, background, layout, settings, asset refs) **and the instance is live** (`published=true`):
1. Bob/Roma enqueues a Tokyo-worker job with:
   - the config bytes (`configPack`), and
   - the `configFp` (sha256 of those bytes, in stable JSON encoding).
2. Tokyo-worker verifies the fingerprint matches the bytes, then writes the immutable config pack to Tokyo/R2:
   - `renders/instances/<publicId>/config/<configFp>/config.json`
3. Bob/Roma enqueues a `sync-live-surface` job to:
   - move `renders/instances/<publicId>/live/r.json` to the new `configFp`, and
   - delete the previous config pack (Tokyo is a mirror, not an archive).

#### B) Text pipeline (strings + translations)
If the save changed text (anything human-readable) **and the instance is live** (`published=true`):
1. Bob/Roma enqueues a Tokyo-worker job with the **base text pack bytes** (for the instance’s `baseLocale`).
2. Tokyo-worker computes a `textFp` and writes the immutable base text pack:
   - `l10n/instances/<publicId>/packs/<baseLocale>/<textFp>.json`
3. Tokyo-worker updates the tiny live pointer:
   - `l10n/instances/<publicId>/live/<baseLocale>.json` → `{ textFp }`
4. Bob/Roma triggers San Francisco translation for the live locale set (`localePolicy.availableLocales`, entitlement-capped), excluding `baseLocale`.
5. As each locale pack is produced (or overridden by a human), Tokyo-worker:
   - writes `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
   - updates `l10n/instances/<publicId>/live/<locale>.json` → `{ textFp }`
   - deletes the prior pack for that locale

#### C) Locale policy (base locale + how viewers pick language)
If the save changed locale settings (base locale, enabled locales, “IP vs switcher”) **and the instance is live** (`published=true`):
1. Bob/Roma recomputes the **live localePolicy** server-side:
   - entitlement-capped
   - includes only locales that are actually ready to serve (no “pending locale” in the public embed)
2. Bob/Roma enqueues a `sync-live-surface` job so Tokyo stays a mirror:
   - updates `renders/instances/<publicId>/live/r.json` (`localePolicy`)
   - deletes any removed locale pointers/packs (and meta for those locales if entitled)

Assets are a separate system:
- Assets are created/updated/deleted only in Roma Assets.
- Config references asset IDs/URLs; there is no runtime “healing” or fallback asset swapping.

Forbidden:
- Cascading DB writes to multiple tables to “keep everything in sync”.
- Locale jobs writing anything other than allowlisted strings.
- Config jobs writing anything under `l10n/`.

### Flow 3 — Go live / Go dark (1 DB write, then Tokyo mirror updates)

What the human does:
1. Turns the instance “live” (UI may call this Publish).
2. Optionally opens the Publish modal to copy embed code (copying code is UI; it is not architecture).

What Bob/Roma does (the brain):
0. Important: the browser UI does not “choose what exists”. Bob/Roma (server-side) applies entitlements.
1. Computes entitlements for this account:
   - live locale set (`localePolicy.availableLocales`, cap applied here)
   - whether SEO/GEO optimization is allowed (tier-gated)
2. Sends a request to Paris to flip the instance live flag (`published=true`), plus the minimal “live plan” (including `localePolicy`) needed to mirror Tokyo.

What Paris does (the write boundary):
1. Validates auth + instance ownership + payload shape (no tier math here).
2. Performs exactly 1 DB write to commit the new live status.
3. Enqueues a Tokyo-worker job that is self-contained (no DB reads later).

What Tokyo-worker does (fingerprints + mirror writes):
1. Ensures the “live pointers” exist for this instance:
   - `renders/instances/<publicId>/live/r.json` (the render/runtime entrypoint; small, mutable)
   - `l10n/instances/<publicId>/live/<locale>.json` for each live locale in `localePolicy.availableLocales` (points to `textFp`)
2. Ensures the referenced immutable bytes exist:
   - config pack(s) under `renders/instances/<publicId>/config/<configFp>/...`
   - text packs under `l10n/instances/<publicId>/packs/<locale>/<textFp>.json`
3. If SEO/GEO is entitled:
   - writes the SEO meta bytes (or pointer) **only** for live locales under `renders/instances/<publicId>/...`
   - if not entitled, deletes any SEO meta bytes/pointers for this instance
4. Deletes anything that is no longer allowed (Tokyo is a mirror, not an archive).

DB budget:
- Exactly 1 DB write in Paris.
- 0 DB reads in workers.

Forbidden:
- Tokyo-worker calling Venice to render.
- Tokyo-worker reading Supabase to “rehydrate”, “enforce”, “discover”, or “orchestrate”.

### Flow 4 — Public embed view (0 DB calls; Venice serves Tokyo bytes)

What the human does:
1. Places the embed code on a host site.
2. Visitors load the page.

What happens on the hot path:
1. The host loads either:
   - an iframe to `/e/:publicId` (scriptless), or
   - the loader script (recommended) which iframes `/e/:publicId` by default.
2. The runtime fetches the tiny live pointers (from Tokyo, via Venice):
   - `GET /r/:publicId` → `renders/instances/<publicId>/live/r.json`
   - Picks an **effective locale** using `r.json.localePolicy`:
     - If `/e/:publicId?locale=<token>` is present and `<token>` is in `availableLocales`, use it (fixed locale embed).
     - Else if `localePolicy.ip.enabled=true`: use `X-Ck-Geo-Country` (from the `/r` response header) + `localePolicy.ip.countryToLocale` to pick a locale; fallback to `baseLocale`.
     - Start locale is always `baseLocale` when nothing else applies.
     - If `localePolicy.switcher.enabled=true` and there is more than one `availableLocale`, the widget can show an in-widget language switcher (which sets `?locale=` and reloads).
   - `GET <TOKYO_BASE>/l10n/instances/<publicId>/live/<effectiveLocale>.json` → `{ textFp }`
3. The runtime fetches immutable bytes by hash and renders in the browser:
   - config pack by `configFp`
   - text pack by `textFp`
   - widget package files from Tokyo (`/widgets/<widgetType>/...`)
   - assets via Venice proxy (`/assets/v/...`)
4. SEO/GEO only when entitled:
   - the SEO/GEO embed option is only shown to entitled tiers in Bob
   - when used, the loader fetches:
     - `/r/:publicId?meta=1&locale=<locale>` (meta pointer), then
     - the immutable meta pack by `metaFp`, then injects schema + excerpt

Venice behavior on the hot path:
- Serve bytes only. No DB calls. No healing. No fallback.

DB budget:
- 0 DB calls.

Important reality:
- `SEO_NOT_AVAILABLE` should almost never happen for real customers because Bob/Roma will not distribute the SEO/GEO snippet to non-entitled tiers.
- If a malicious host forces `/r?meta=1` anyway, it gets an explicit 404 (that is not a “fallback”; it is the correct answer).

### Flow 5 — Trial ends / downgrade (turn off everything over plan)

What the human does:
1. Trial expires (or the user cancels / downgrades).
2. Bob/Roma tells the user: “Pick the 1 instance you want to keep live.”
3. User picks the keep-live instance.

What the system does:
1. Bob/Roma computes the new entitlements and the allowed live set (v1: exactly 1 instance).
2. Bob/Roma applies that decision:
   - Marks all other instances as `published=false` in DB (drafts remain).
   - Enqueues Tokyo cleanup for anything that is no longer allowed to exist in storage under the new plan.
3. Tokyo-worker deletes:
   - The public bytes for all instances that must go dark, and
   - Any asset blobs that are no longer entitled under the new plan (force delete).
4. Venice immediately starts returning `404 NOT_PUBLISHED` for those instances (because Tokyo has no live pointers/bytes).

Why we do it this way:
- We preserve the user’s draft state (config + text) in Bob/Roma.
- We do not preserve paid storage for non-paying users: assets and derived/public bytes are deleted on downgrade.
- We enforce plan limits by deleting the live surface in Tokyo (not by adding runtime checks in Venice).

---

## Roles (boring responsibilities; no overlap)

### Bob + Roma (product brain)
- Source of simplicity: account entitlements are applied here.
- Bob/Roma decide what the account is allowed to have live:
  - which instances can be live
  - which locales can be live
  - whether SEO/GEO mode exists for this account
- Bob/Roma never offer SEO/GEO to tiers that are not entitled.
- Bob/Roma trigger the two independent pipelines on save:
  - config pipeline (writes config packs)
  - text pipeline (writes text packs + triggers translation)

### Paris (write boundary)
- Accepts draft writes + “go live / go dark” writes (minimal DB writes).
- Validates auth + instance ownership + request shape.
- It does not re-decide entitlements; it trusts Bob/Roma’s live plan.
- Enqueues self-contained Tokyo-worker jobs (no “rehydration” reads required later).

### Tokyo-worker (fingerprint + storage writer)
- Only real job: compute fingerprints (`configFp`, `textFp`) and write/delete files in Tokyo/R2.
- It must not read Supabase.
- It must not call Venice to render.
- It must not decide entitlements or “what exists”.
- It keeps Tokyo clean by deleting anything no longer referenced/allowed.

### Tokyo (raw storage + CDN)
- Dumbest service: store bytes, serve bytes.
- No business logic.

### Venice (public embed runtime)
- Dumb file server: for public routes it only reads Tokyo/R2 and returns bytes.
- No DB calls. No healing. No fallback. No “deciding”.

### San Francisco (translation)
- Produces translated text packs from base text packs.
- Must only touch allowlisted string keys (never assets, never URLs, never media).

---

## Vocabulary (one screen; no jargon)

- **Config**: everything that is not “words” (layout, styling, settings, behavior, asset refs, widget type).
- **Text**: the human-visible strings (titles, labels, paragraphs). Text changes across locales.
- **Config pack**: an immutable config file (stored in Tokyo) that contains no localized strings.
- **Text pack**: an immutable text file (stored in Tokyo) that contains only allowlisted strings for one locale (and optionally A/B copy variants).
- **Fingerprint**: a hash ID of some bytes. If bytes are identical, the fingerprint is identical. If bytes change, the fingerprint changes.
  - `configFp` = fingerprint of a config pack.
  - `textFp` = fingerprint of a text pack.
- **Live pointer**: a tiny mutable JSON file in Tokyo that points to the current live fingerprints.
  - Example: `renders/.../live/r.json` contains the current `configFp`.
  - Example: `l10n/.../live/<locale>.json` points to the current `textFp` for that locale.

---

## The decision model (where entitlements live)

Non-negotiable:
- Account entitlements are owned and applied in Bob/Roma.
- “Live” is a simple state in Bob/Roma (a DB flag) plus a Tokyo mirror of what’s live.
- Venice is entitlement-blind and DB-blind.

Concrete consequence:
- If an account is not entitled to SEO/GEO, the SEO/GEO bytes simply do not exist in Tokyo/R2 for that instance. Venice returns 404.

---

Details:
- The “detail specs” are in PRD 54A / 54B / 54C (linked near the top of this doc).
