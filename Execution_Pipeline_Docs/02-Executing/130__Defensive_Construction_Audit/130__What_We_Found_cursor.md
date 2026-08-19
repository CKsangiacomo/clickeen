# What we found (Cursor)

Cloud-dev, 2026-08-19. Account `CLICKEEN`. This file does not authorize code
changes. It is not
`130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md`.

Widget catalog and Prague are out of scope. Those domains have not been worked
yet. Home is intentionally blank for now. None of those are findings.

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

This is not a file-by-file census of the repo. Unwalked work stays unmarked.
The other 130 PRD’s “65 findings” are a different audit.

---

## Named services (in scope)

| Service | Did a user journey reach it? | What was felt |
| --- | --- | --- |
| Roma | Yes. Shell, widgets inventory, Builder host, assets, team, settings, profile, billing, usage, AI, widget defaults. | Page-wide **Loading page** on domain entry. Clicks intercepted. Pre-mounted dialogs. Extra Refresh controls. |
| Bob | Partially. Iframe at `https://bob.dev.clickeen.com/bob` painted ToolDrawer + preview. Iframe DOM was not inspectable from this walk tool. | Open wait is Roma host + handshake. Save, Copilot, translations **unmarked**. |
| Tokyo-worker public serve | Yes. `dev.clk.live/CLICKEEN/{instance}`. | Published FAQ and Big Bang HTTP 200, fast. `?locale=fr` partial overlay. Unpublished Countdown and Cards HTTP 404 `Not found`. |
| Tokyo-worker assets / account storage | Assets library listed 22 files, 2.2 MB. Upload opened a hidden file input (OS picker). Upload bytes **unmarked** (not completed). | Extra **Refresh list**. |
| Berlin | Session already existed. Login page HTTP 200. Fresh Google click **unmarked**. | Auth ingress **keep**. |
| Dieter | Roma consumes Dieter popups, toggles, nav, table. | Closed `diet-popup` dialogs still in the accessibility tree and intercepted hits. |
| San Francisco | Not reached. Copilot/translations not sent. | **Unmarked** |
| Product Copilot / Translation Agent | Not reached. | **Unmarked** |
| Michael / Supabase | Not a user surface. No customer click. | **Unmarked** |
| DevStudio (`admin/`) | Operator cockpit. Not opened. | **Unmarked** |
| Widget Core | Public FAQ HTML served. Builder preview seen. Core was not audited as software. | Public serve **keep**. Core internals **unmarked**. |
| Prague | Out of scope. | Not a finding. |
| Widget catalog | Out of scope. | Not a finding. |

---

## Roma routes (in scope)

| Route | Walked? | Immediate | Finished as | Extra weight |
| --- | --- | --- | --- | --- |
| `/login` | HTTP 200 only this pass | — | Google CTA is the product login (`roma/app/login/page.tsx`) | Fresh Google **unmarked**. |
| `/` | Not opened | — | — | **Unmarked** |
| `/home` | Intentionally blank for now | — | — | Not a finding. |
| `/widgets` | Yes | **Loading page**, then **Loading widgets…** | Table of 4 instances | Pre-mounted Upgrade / Copy / unavailable-code alerts. Published switches. Click intercept on Edit / Your widgets. |
| `/widgets/catalog` | Out of scope | — | — | Not a finding. |
| `/widgets/:id` | Not clicked; code is a redirect | — | Redirects to `/widgets?selected=` | **Unmarked** as a user click. |
| `/builder` | Not opened this pass | — | No instance selected; Open widgets | Landing **unmarked** as a click. |
| `/builder/:id` FAQ | Yes | **Loading page** then seconds | Chrome + Bob iframe | Open waits `/api/builder/:id/open` + compiled artifact + `ck:open-editor`. Pre-mounted Unsaved / Upgrade / Copy. Publish switch click intercepted. |
| `/builder/new/faq` | Yes | **Loading page** then ~8s | **Untitled widget / Save to create this widget** | Honest New. Save **unmarked**. |
| `/assets` | Yes | **Loading page** | 22 assets, Upload / bulk / Refresh list | Refresh is extra. Upload click → hidden file inputs, no Roma dialog. |
| `/settings` | Yes | **Loading page** | Plan, languages, locked base, ownership | **Refresh** next to **Save languages**. |
| `/settings/widget-defaults` | Yes | **Loading page** | Full Header/Stage/Pod + per-widget defaults, Discard/Save | Save **unmarked**. |
| `/profile` | Yes | **Loading page** | Person fields, Save settings | Save **unmarked**. No extra lock felt. |
| `/team` | Yes | **Loading page** | Owner row, invite form, no pending invites | Invite submit **unmarked**. |
| `/team/:memberId` | Not opened | — | — | **Unmarked** |
| `/billing` | Yes | **Loading page** | Honest “provider not connected”, Tier 4 | **Keep** honest empty. |
| `/usage` | Yes | **Loading page** | 2.2 MB / unlimited | **Keep** honest empty. |
| `/ai` | Yes | **Loading page** | Copilot lives in Builder, unlimited | **Keep** honest empty. Copilot send **unmarked**. |
| `/accept-invite/:token` | Not opened | — | — | **Unmarked** |

---

## Public widgets

| URL | Walked? | Result |
| --- | --- | --- |
| `dev.clk.live/CLICKEEN/VUWUJ7OQ0Y` | Yes | Fast, titled FAQ by Clickeen. |
| same `?locale=fr` | Yes | Header/CTA French; questions still English. Not swapped to another locale. |
| `dev.clk.live/CLICKEEN/LWZZR7JSG8` | HTTP 200 | Public Big Bang up. Full visual **unmarked**. |
| `dev.clk.live/CLICKEEN/8LGOEM8JGC` | HTTP 404 `Not found` | **Keep** unpublished ingress. |
| `dev.clk.live/CLICKEEN/M4YW8OAT5O` | HTTP 404 | **Keep** unpublished ingress. |

---

## Ranked stalls (what the user felt)

1. Roma replaces the asked page with **Loading page**.
2. Clicks miss (nav, Edit, Published switch).
3. Builder open waits host open + compile + iframe handshake; failure chrome is pre-armed.
4. Extra Refresh on assets and languages.

---

## Stall detail

### Roma **Loading page** on every domain

- Immediate: `role=status` **Loading page**; canvas empty.
- Finished: domain content appears.
- Extra: the asked route is hidden behind account bootstrap.

Owner: `roma/components/roma-account-context.tsx` (`RomaAccountBoundary`);
`roma/components/use-roma-me.ts` (hook starts `loading: true`; authz TTL can set
`data: null` and loading again); fetch is `/api/bootstrap`.
`roma/app/(authed)/layout.tsx` wraps all authed pages.

**Demote** the full-canvas gate so last-known shell/nav stay. **Keep** real
auth failure as a login redirect.

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

Billing / Usage / AI honest empty **Keep**.

Team / Profile / Widget Defaults: no extra lock on open. Mutations **unmarked**.

Login Google CTA **Keep** as ingress. Fresh click **unmarked**.

---

## Keep / demote / delete (rows)

| journey / click | extra weight | keep, demote, or delete |
| --- | --- | --- |
| Any Roma domain | Full-canvas Loading page waiting `/api/bootstrap` / authz TTL | **Demote** gate. **Keep** auth fail-visible. |
| Your widgets / Edit / Published switch | Overlapping chrome, closed dialogs | **Demote** hit targets / overlays |
| Widgets list | Pre-mounted Upgrade / Copy / unavailable alert | **Keep** fetch. **Demote** dialogs until open |
| Builder open | Compile + handshake wait; pre-armed dialogs | **Keep** one open. **Demote** extra wait and pre-mount |
| Builder Copy code (asked) | — | **Keep** |
| New FAQ | Save to create this widget | **Keep** |
| Public published | Fast 200 | **Keep** |
| Public `?locale=fr` | Partial overlay | **Keep** fail-visible |
| Unpublished public | 404 | **Keep** |
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
- Public Big Bang visual, other locales beyond fr
- DevStudio, San Francisco, Copilot worker, Translation Agent, Michael
- Widget Core source, Dieter as a system, tests
- Widget catalog, Prague, and Home (Home is intentionally blank; catalog and Prague are not worked yet)

Later remediation is a separate owner authorization: delete or demote extra
weight on the rows above. Do not add machinery.
