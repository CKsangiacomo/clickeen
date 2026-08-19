# What we found (Cursor)

Cloud-dev, 2026-08-19. Account `CLICKEEN`. This file does not authorize code
changes. It is not
`130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md`.

The first Cursor write-up of this walk was a compressed table. That was not a
codebase audit. This file is the full Cursor findings: every customer surface
that was walked, every named service that walk did or did not reach, the stalls
with owning files, and what is still unmarked.

How the walk was done: use the live product. For each click, what happened
immediately, what said it finished, what locked or swallowed the request. Then
open only the code that owns a felt stall. No Save, Publish, Unpublish,
translation generate, or asset write.

Inventory at walk time:

- published Big Bang `LWZZR7JSG8` (“BigBang Test”)
- published FAQ `VUWUJ7OQ0Y` (“FAQ example”)
- unpublished Countdown `8LGOEM8JGC` (“Untitled widget”)
- unpublished Cards `M4YW8OAT5O` (“Untitled widget”)

---

## What this is not

This is not a file-by-file census of `berlin/`, `bob/`, `roma/`, `tokyo-worker/`,
`sanfrancisco/`, `admin/`, tests, or Widget Core. Unwalked work stays unmarked.
The other 130 PRD’s “65 findings” are a different audit.

---

## Named services

| Service | Did a user journey reach it? | What was felt |
| --- | --- | --- |
| Roma | Yes. Shell, every current account domain page listed below, Builder host chrome. | Page-wide **Loading page** on domain entry. Clicks intercepted. Pre-mounted dialogs. Empty Home. Catalog “Create instance”. Extra Refresh controls. |
| Bob | Partially. Iframe at `https://bob.dev.clickeen.com/bob` painted ToolDrawer + preview. Iframe DOM was not inspectable from this walk tool. | Open wait is Roma host + handshake. Save, Copilot, translations **unmarked**. |
| Tokyo-worker public serve | Yes. `dev.clk.live/CLICKEEN/{instance}`. | Published FAQ and Big Bang HTTP 200, fast. `?locale=fr` partial overlay. `?locale=de` HTTP 200. Unpublished Countdown and Cards HTTP 404 `Not found`. |
| Tokyo-worker assets / account storage | Assets library listed 22 files, 2.2 MB. Upload opened a hidden file input (OS picker). Upload bytes **unmarked** (not completed). | Extra **Refresh list**. |
| Prague | Yes. `/us/en/`, FAQ widget page, create CTA. HTTP 200 also for countdown, logoshowcase, privacy, FAQ examples (status only, not a full click walk). | Directory embed ate clicks. Create-while-signed-in dumped empty Home. 29-locale switcher is product. |
| Berlin | Session already existed. Login page HTTP 200. Fresh Google click **unmarked**. Prague create still stamps `signup_prague` onto Roma `/home`. | Auth ingress **keep**. Signed-in create path **demote**. |
| Dieter | Roma/Prague consume Dieter popups, toggles, nav, table. | Closed `diet-popup` dialogs still in the accessibility tree and intercepted hits. |
| San Francisco | Not reached. Copilot/translations not sent. | **Unmarked** |
| Product Copilot / Translation Agent | Not reached. | **Unmarked** |
| Michael / Supabase | Not a user surface. No customer click. | **Unmarked** |
| DevStudio (`admin/`) | Operator cockpit, not the customer product. Not opened. | **Unmarked** |
| Widget Core (FAQ, Big Bang, Cards, Countdown, Logo Showcase) | Public FAQ HTML served. Builder preview seen in screenshot. Core was not audited as software. | Public serve **keep**. Core internals **unmarked**. |

---

## Roma routes

| Route | Walked? | Immediate | Finished as | Extra weight |
| --- | --- | --- | --- | --- |
| `/login` | HTTP 200 only this pass | — | Google CTA is the product login (`roma/app/login/page.tsx`) | Fresh Google **unmarked**. Login page maps many `error=` reason keys into copy before a click. |
| `/` | Not opened | — | — | **Unmarked** |
| `/home` | Yes, including after Prague create | **Loading page** | Empty canvas. Query `intent=signup_prague&from=prague_create&market=us&locale=en` ignored. | `roma/app/(authed)/home/page.tsx` is shell + notice only. |
| `/widgets` | Yes | **Loading page**, then **Loading widgets…** | Table of 4 instances | Pre-mounted Upgrade / Copy / unavailable-code alerts. Published switches. Click intercept on Edit / Your widgets. |
| `/widgets/catalog` | Yes | **Loading page** | Five widget cards | Primary labeled **Create instance**. Click delayed then `/builder/new/faq`. |
| `/widgets/:id` | Not clicked; code is a redirect | — | `roma/app/(authed)/widgets/[instanceId]/page.tsx` redirects to `/widgets?selected=` | **Unmarked** as a user click. |
| `/builder` | Not opened this pass | — | `BuilderDomain` with no instance renders **No instance selected for Builder** and Open widgets (`builder-domain.tsx` ~1268) | Landing **unmarked** as a click. Code path is a dead-end page, not a silent substitute. |
| `/builder/:id` FAQ | Yes | **Loading page** then seconds | Chrome + Bob iframe | Open waits `/api/builder/:id/open` + compiled artifact + `ck:open-editor`. Pre-mounted Unsaved / Upgrade / Copy. Publish switch click intercepted. |
| `/builder/new/faq` | Yes | **Loading page** then ~8s | **Untitled widget / Save to create this widget** | Honest New. Save **unmarked**. |
| `/assets` | Yes | **Loading page** | 22 assets, Upload / bulk / Refresh list | Refresh is extra. Upload click → hidden file inputs, no Roma dialog. |
| `/settings` | Yes | **Loading page** | Plan, languages, locked base, ownership | **Refresh** next to **Save languages**. |
| `/settings/widget-defaults` | Yes | **Loading page** | Full Header/Stage/Pod + per-widget defaults, Discard/Save | Save **unmarked**. |
| `/profile` | Yes | **Loading page** | Person fields, Save settings | Save **unmarked**. No extra lock felt. |
| `/team` | Yes | **Loading page** | Owner row, invite form, no pending invites | Invite submit **unmarked**. |
| `/team/:memberId` | Not opened | — | `team-member-domain.tsx` | **Unmarked** |
| `/billing` | Yes | **Loading page** | Honest “provider not connected”, Tier 4 | **Keep** honest empty. |
| `/usage` | Yes | **Loading page** | 2.2 MB / unlimited | **Keep** honest empty. |
| `/ai` | Yes | **Loading page** | Copilot lives in Builder, unlimited | **Keep** honest empty. Copilot send **unmarked**. |
| `/accept-invite/:token` | Not opened | — | `accept-invite-domain.tsx` | **Unmarked** |

---

## Prague and public

| URL | Walked? | Result |
| --- | --- | --- |
| `prague.dev.clickeen.com/us/en/` | Yes | Loaded. 29-locale switcher. FAQ directory card `pointer-events: none`. Card click did not navigate. Direct FAQ URL worked. |
| `.../widgets/faq/` | Yes | Full marketing page. **Create a free FAQ widget** stayed on-page for seconds, then Roma empty Home with signup query. |
| `.../us/en/create` | Yes via CTA | Always 302 to Roma `/home` with `signup_prague` (`prague/src/pages/[market]/[locale]/create/index.astro`). |
| `.../widgets/countdown/` | HTTP 200 only | **Unmarked** as a click walk. |
| `.../widgets/logoshowcase/` | HTTP 200 only | **Unmarked** as a click walk. |
| `.../widgets/faq/examples/` | HTTP 200 only | **Unmarked** as a click walk. |
| `.../privacy/` | HTTP 200 only | **Unmarked** as a click walk. |
| `dev.clk.live/CLICKEEN/VUWUJ7OQ0Y` | Yes | Fast, titled FAQ by Clickeen. |
| same `?locale=fr` | Yes | Header/CTA French; questions still English. Not swapped to another locale. |
| same `?locale=de` | HTTP 200 | Body not re-read this pass. |
| `dev.clk.live/CLICKEEN/LWZZR7JSG8` | HTTP 200 | Public Big Bang up. Full visual **unmarked**. |
| `dev.clk.live/CLICKEEN/8LGOEM8JGC` | HTTP 404 `Not found` | **Keep** unpublished ingress. |
| `dev.clk.live/CLICKEEN/M4YW8OAT5O` | HTTP 404 | **Keep** unpublished ingress. |

---

## Ranked stalls (what the user felt)

1. Roma replaces the asked page with **Loading page**.
2. Clicks miss (nav, Edit, Prague cards, Published switch).
3. Prague create while signed in lands empty Home.
4. Catalog says Create instance; New is delayed.
5. Builder open waits host open + compile + iframe handshake; failure chrome is pre-armed.
6. Extra Refresh on assets and languages.

---

## Stall detail

### Roma **Loading page** on every domain

- Immediate: `role=status` **Loading page**; canvas empty.
- Finished: domain content appears (Home never does).
- Extra: the asked route is hidden behind account bootstrap.

Owner: `roma/components/roma-account-context.tsx` (`RomaAccountBoundary`);
`roma/components/use-roma-me.ts` (hook starts `loading: true`; authz TTL can set
`data: null` and loading again); fetch is `/api/bootstrap`.
`roma/app/(authed)/layout.tsx` wraps all authed pages.

**Demote** the full-canvas gate so last-known shell/nav stay. **Keep** real
auth failure as a login redirect.

### Empty Home

- Immediate: Loading page.
- Finished: blank main. Prague signup query still on the URL.
- Extra: no product work.

Owner: `roma/app/(authed)/home/page.tsx`.

Empty Home is a product hole, not a guard. Do not invent a dashboard without
owner intent. Signed-in Prague create must not target this page.

### Nav / Edit / Published switch intercepts

- Immediate: click intercepted or nothing.
- Finished: not the labeled control.
- Extra: another layer received the hit (Builder link, overlay span, closed
  dialog chrome).

Owner: `roma/components/roma-nav.tsx` (Widgets `details`/`summary`);
`roma/components/roma-shell.tsx`; `roma/components/widget-publication-controls.tsx`;
pre-mounted `RomaUpsellDialog` / `WidgetCopyCodeDialog` /
`RomaUnsavedChangesDialog` in `builder-domain.tsx` and per-row publication
controls; Dieter `diet-popup` stays in the tree when closed.

**Demote** hit targets and mount dialogs only when open.

### Widgets inventory

- Immediate: Loading page, then **Loading widgets…**
- Finished: four rows.
- Extra: unpublished rows already expose Upgrade Clickeen, Copy code, **Public
  widget code is unavailable.** without opening a dialog.

Owner: `roma/components/widgets-domain.tsx`;
`roma/components/widget-publication-controls.tsx`;
`roma/components/widget-copy-code-dialog.tsx` (`complete` false → alert);
`roma/components/roma-upsell-dialog.tsx`.

**Keep** the list fetch. **Demote** closed dialogs / unpublished-code alert
until the user asks.

### Catalog **Create instance**

- Immediate: **Loading page**, then cards.
- Finished: delayed navigation to `/builder/new/faq`.
- Extra: copy implies persistence. Product law: New writes nothing.

Owner: `roma/components/widgets-domain.tsx` (`handleCreateInstance` →
`router.push`); `roma/lib/domains.ts` catalog description.

**Demote** copy to New / open draft.

### Builder open

- Immediate: Loading page.
- Finished: after seconds, identity chrome + iframe. New draft: **Save to
  create this widget**.
- Extra: closed Unsaved / Upgrade / Copy in the tree. Open path waits
  `/api/builder/:id/open` or `/api/builder/new/:type/open`,
  `getWidgetEditorArtifact`, then `postOpenEditorAndWait`.

Owner: `roma/components/builder-domain.tsx`.

**Keep** one open to Bob. **Demote** extra sequencing if the iframe can paint
sooner. **Demote** dialogs to mount-on-need. **Keep** New copy.

Copy code, once clicked, opened Widget URL + Embed. **Keep** that path.

### Prague directory card

- Immediate: click did nothing.
- Finished: stayed on directory. Direct `/us/en/widgets/faq/` worked.
- Extra: live embed `pointer-events: none`.

Owner: `prague/src/components/InstanceEmbed.astro`; directory blocks that embed
it.

**Demote** so the card/CTA is the click target.

### Prague **Create a free FAQ widget** while signed in

- Immediate: stayed on FAQ for seconds (cross-origin hop).
- Finished: `https://roma.dev.clickeen.com/home?intent=signup_prague&from=prague_create&market=us&locale=en` empty.
- Extra: create became a signup handshake and was dropped.

Owner: `prague/src/pages/[market]/[locale]/create/index.astro`; Roma login/finish
parse `signup_prague` only on login (`roma/app/api/session/login/google/route.ts`,
`finish/route.ts`); Home ignores the query.

**Demote** signed-in path to New FAQ in Builder. **Keep** signup intent only
when there is no session.

### Assets **Refresh list**

- Immediate: list already there (22 assets).
- Extra: tertiary Refresh next to Upload.

Owner: `roma/components/assets-domain.tsx`.

**Delete** Refresh as a median control if the list is already live. **Keep**
upload at ingress (bytes not sent this walk).

### Settings language **Refresh**

- Immediate: languages already shown.
- Extra: Refresh beside Save languages. Loading state also has Refresh.

Owner: `roma/components/account-locale-settings-card.tsx`.

**Demote** Refresh if Save already writes. **Keep** locked base-language
honesty after first widget save.

### Public overlay and unpublished

`?locale=fr` is incomplete in place, not a silent other-locale. **Keep**.

Unpublished 404 **Keep**.

Published FAQ/Big Bang 200 **Keep**.

Prague 29 locales **Keep** (global-by-default).

Billing / Usage / AI honest empty **Keep**.

Team / Profile / Widget Defaults: no extra lock on open. Mutations **unmarked**.

Login Google CTA **Keep** as ingress. Fresh click **unmarked**.

---

## Keep / demote / delete (rows)

| journey / click | extra weight | keep, demote, or delete |
| --- | --- | --- |
| Any Roma domain | Full-canvas Loading page waiting `/api/bootstrap` / authz TTL | **Demote** gate. **Keep** auth fail-visible. |
| Home | Empty after wait; drops Prague create intent | Product hole + **demote** signed-in create target |
| Your widgets / Edit / Published switch | Overlapping chrome, closed dialogs | **Demote** hit targets / overlays |
| Widgets list | Pre-mounted Upgrade / Copy / unavailable alert | **Keep** fetch. **Demote** dialogs until open |
| Catalog Create instance | Persistence copy | **Demote** copy |
| Builder open | Compile + handshake wait; pre-armed dialogs | **Keep** one open. **Demote** extra wait and pre-mount |
| Builder Copy code (asked) | — | **Keep** |
| New FAQ | Save to create this widget | **Keep** |
| Public published | Fast 200 | **Keep** |
| Public `?locale=fr` | Partial overlay | **Keep** fail-visible |
| Unpublished public | 404 | **Keep** |
| Prague directory embed | Eats click | **Demote** |
| Prague create while signed in | Signup dump to Home | **Demote** |
| Prague locale switcher | 29 locales | **Keep** |
| Assets Refresh list | Second fetch | **Delete** as median control |
| Settings language Refresh | Second fetch | **Demote** |
| Billing / Usage / AI | Honest not-connected | **Keep** |

---

## Still unmarked (not pretended)

- Bob Save, undo, preview-only edits, Copilot send
- Generate translations
- Publish / Republish / Unpublish actually running
- Completing an asset upload or delete
- Invite members / accept invite / team member page
- Widget Defaults Save, Profile Save, Save languages
- Fresh Google login
- `/builder` landing click, `/widgets/:id` redirect click
- Prague countdown / logoshowcase / examples / privacy as full click walks
- Public Big Bang visual, other locales beyond fr
- DevStudio, San Francisco, Copilot worker, Translation Agent, Michael
- Widget Core source, Dieter as a system, tests

Later remediation is a separate owner authorization: delete or demote extra
weight on the rows above. Do not add machinery.
