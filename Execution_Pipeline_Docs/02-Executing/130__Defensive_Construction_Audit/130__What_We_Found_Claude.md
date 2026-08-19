# What we found — Claude

An independent pass over the same ground as `130__What_We_Found.md`, walked
separately, by a different model, without reusing that file's rows. Two
sessions: an initial walk, then a second pass the same day covering the
account-settings surfaces and a live Copilot turn after the first version of
this file was judged too thin for the program's stated scope ("every
surface").

Method: `130__How_To_Audit.md`.

This is evidence, not permission to change code.

Date: 2026-08-19

This file is not `130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md`.
It does not import that PRD's pattern catalog, matrix, or slices. It also does
not import `130__What_We_Found.md`'s rows — where this pass touches the same
click, that's noted explicitly as corroboration or divergence, not copied.

This audit does not authorize code changes.

## How this pass was walked

Deployed cloud-dev, `https://roma.dev.clickeen.com` (plus
`prague.dev.clickeen.com` and `dev.clk.live`), signed in as the same account
(`CLICKEEN`) using this repo's own `pnpm e2e:auth:roma-dev` dev-admin login
and the resulting Playwright storage state — a real authenticated browser
session, not a code read. The saved session in the repo was expired when
this pass started (`/api/bootstrap` returned 401, Roma correctly redirected
to `/login` rather than silently failing — that redirect is correct
behavior, not a finding); `pnpm e2e:auth:roma-dev` minted a fresh one before
walking anything, and again before the second session. Driven with
Playwright directly (`chromium.launch`), screenshotting every step. No
`chromium-cli` binary was available in this environment; adapted the
equivalent driver by hand.

Inventory at walk time: published Big Bang `LWZZR7JSG8` ("BigBang Test"),
published FAQ `VUWUJ7OQ0Y` ("FAQ example"), Countdown `8LGOEM8JGC`, Cards
`M4YW8OAT5O` (unpublished — confirmed by its public URL returning 404). No
Save, Publish, Unpublish, translation generate, delete, or asset write was
performed, in either session — that is a deliberate limit of this process
(`130__How_To_Audit.md`: "Do not change code, data, or deploys under this
process"), not a coverage gap. Where a click would have mutated shared
account state (the Published toggle), this pass inspected the DOM at that
point instead of clicking it. One exception, chosen because it mutates
nothing stored: a real Product Copilot turn (question-only, no applied edit)
to independently verify the P1 transport fix in a session unrelated to the
one that shipped or first verified it.

## How services were covered

The unit is a user click, not a service folder. Walked: Roma widgets list,
nav, Builder open on an existing published instance, Catalog → New, Home,
Team (view), Assets (view), Settings, Profile, Billing, Usage, AI, Widget
Defaults (view); Tokyo-worker public serving (published FAQ base and
`?locale=fr`, unpublished Cards → 404); Prague directory; a live Product
Copilot turn (Roma → Product Copilot → San Francisco → back). Not reached:
DevStudio (this account's saved e2e auth state for it was already expired —
`ck-access-token` about 4.5 days past expiry — and unlike Roma there is no
`pnpm e2e:auth:devstudio`-equivalent script in this repo to mint a fresh one
without more setup than this pass's time allowed); any Save, Publish,
Unpublish, Delete, translation generate, or asset upload (excluded by the
process's no-data-mutation rule, not skipped by oversight); Berlin and San
Francisco as isolated surfaces (Berlin's login itself wasn't re-walked since
the existing session already carried its cookies; San Francisco was
exercised only indirectly, inside the Copilot turn). Those stay unmarked —
not inferred, not carried over from the sibling file.

## Ranked by what was felt

1. `/home` — the page every session lands on after login — renders nothing
   but the nav sidebar. No content, no prompt, no summary, nothing.
2. Builder open on an existing instance: the edit controls are usable
   several seconds before the visual preview is — a user can start changing
   settings before they can see what they're changing.
3. Widgets list shows nothing but "Loading widgets…" — no rows, no
   skeleton, no count — for a little over two seconds before the table
   appears.
4. Widget Defaults' accordion has two different sections both labeled
   "LOCALE SWITCHER" with no visible distinction between them.
5. One thing predicted from an earlier code-only read did not reproduce
   live (see row below) — recorded because the correction itself is
   evidence for how this audit should be run, not because it's a live
   problem.
6. Two things the sibling pass flagged as click-interception (Edit link,
   general nav) did not reproduce in this pass's clicks — recorded as
   non-reproduction, not as a refutation.
7. Product Copilot: sent a real question, got a real, contextually correct,
   streamed answer in about three seconds, with a clean Send → Stop → Send
   button state. P1 confirmed fixed a second, independent way.

## Rows

| journey / click | what was felt | owning file | extra weight | keep, demote, or delete |
| --- | --- | --- | --- | --- |
| `/home` | Nav sidebar renders; the entire content area is blank — no heading, no summary, no call to action, nothing. Confirmed visually, not just by text extraction. | `roma/app/(authed)/home/page.tsx` | This is an absence, not a guard — nothing is loading, failing, or gated. There is simply no product content authored for this route yet. | **Not this audit's target.** Nothing to delete or demote; an empty landing page is a product decision (build a real Home, or route past it), not defensive weight. Recorded because it's the single most-felt gap in the whole walk — every session lands here. |
| Widgets list load (`/widgets`) | Nav renders instantly. Content area shows only "Loading widgets…" — no rows, no skeleton — confirmed still showing that at the 2-second mark in a screenshot, with the real 4-row table appearing a moment after. | `roma/components/widgets-domain.tsx` (`refreshWidgets`, `domainLoading` gate) | The wait is the account-widgets fetch; nothing extra observed guarding it. The felt cost is that the placeholder is one static line, not a shape of the thing arriving. | **Demote** the placeholder to a skeleton that hints at rows, not a blank pill. Not a guard to delete — a felt-completion signal to improve. |
| Builder open, existing published instance (Edit → `/builder/LWZZR7JSG8`) | Roma's own shell shows "Loading widget… / Loading publication status…" against an otherwise empty page for the first stretch — honest text, but nothing else on screen. By ~1.8s the iframe's edit controls (Manual/Copilot tabs, full Content panel, all fields populated) are live and clickable. The visual preview pane, at that same 1.8s mark, still reads "Loading preview…" and does not resolve until sometime before 5.8s. | Roma outer shell: `roma/components/builder-domain.tsx`. Preview pane: Bob `Workspace.tsx` (iframe `srcdoc` build + widget-software fetch). | The controls and the preview are not on the same clock — a user can edit a field with no visual confirmation for several seconds. This is a felt gap, not a guard; nothing here looked like defensive machinery, just two independent loads finishing at different times. | **Demote/reorder**: no code to delete — the preview load path could start earlier or the controls could wait for it, so the two panes finish closer together. Not urgent; a few seconds, not a stall with no end. |
| Same journey — a specific prediction from an earlier code-only read | A prior session read `bob/components/ToolDrawer.tsx` and predicted every Builder open would show "No instance selected yet. Choose one from Widgets to begin editing." during this exact boot window. Live, right now, that text never appeared — Roma's own "Loading widget…" line is what's shown instead. | `bob/components/ToolDrawer.tsx`, `roma/components/builder-domain.tsx` | None — this is a correction, not a finding. The lifecycle-simplification commit that shipped since that earlier read (`a6678966`, "simplify widget lifecycle and trusted boundaries") evidently replaced the old boot copy along with moving publication chrome out of Bob. | **No action.** Recorded so the earlier prediction isn't carried forward as current fact. |
| Publication chrome location, same journey | A slim bar above the iframe — not inside it — shows the instance name, "Published · [time]", the toggle, "Open public widget", "Copy code". Confirms the Roma-owned-header design reviewed earlier in this program actually shipped, not just planned. | `roma/components/builder-domain.tsx` | None — this is the intended shape: Bob has no publication awareness left in what's on screen. | **Keep.** Positive confirmation, recorded for the record. |
| Catalog → New (`/widgets/catalog` → Create instance → `/builder/new/big-bang`) | Header reads "Untitled widget / Save to create this widget" with one visible "Save" button. The visual preview renders immediately with real default content — no "Loading preview…" stall observed here, unlike opening an existing instance. | `roma/components/widgets-domain.tsx` (`handleCreateInstance` — confirmed in source it does `router.push` only, no request), `roma/components/builder-domain.tsx` | None found. Copy is honest, nothing is created by the click, and the preview isn't behind the same lag as the existing-instance case. | **Keep.** |
| Nav "Widgets" entry + Edit link, widgets list | Hit-tested both before clicking (screen-point → `elementFromPoint`, not a real click) and both hit the correct element. Then clicked Edit for real, twice, on separate runs: both navigated cleanly with no missed click. | `roma/components/widgets-domain.tsx`, `roma/components/roma-nav.tsx` | None observed in this pass. | **No action from this pass.** The sibling file reports intermittent interception on these same controls; two clean runs here neither confirm nor refute that. |
| Published toggle, widgets list | Not clicked (would flip real publish state on a shared account). Direct DOM read: `input[type=checkbox][role=switch]` reports `checked: true, disabled: false`. The visible custom switch graphic is a `<span class="diet-toggle__switch">` layered over the real (visually hidden) checkbox — standard toggle markup, not obviously an intercepting overlay from this evidence alone. | `roma/components/widgets-domain.tsx` | Unknown — deliberately not tested with a real click. | **Unmarked.** Neither confirms nor refutes the sibling file's interception claim for this control. |
| `beforeunload` console warning | Appeared once, only when this pass drove navigation with `page.goto()` (a raw browser navigation) rather than a real link click. Repeated the same navigation via an actual click chain afterward and the warning did not recur. | N/A — test-methodology artifact | None on the product. | **Not a finding.** Recorded so it isn't mistaken for a live bug. |
| Public FAQ (`dev.clk.live/CLICKEEN/VUWUJ7OQ0Y`), base and `?locale=fr` | Both returned 200 with real rendered content (title, working accordion cards) in ~1-1.8s. | Tokyo-worker public serving | None. | **Keep.** |
| Public Cards (`dev.clk.live/CLICKEEN/M4YW8OAT5O`), unpublished | 404 in ~0.6s. | Tokyo-worker public ingress | None — the owning boundary failing visibly, correctly. | **Keep.** |
| Team page (`/team`) | Loaded in ~1.5s with real member data (one owner row); "Invite people" present but its control isn't a plain `<button>`/`<a>` (this pass didn't identify and open the form — not tested). No stall felt on the view itself. | Team domain | None observed on the view. | **No stall row** for the view; invite-submit unwalked. |
| Assets (`/assets`) | Loaded in ~2.5s with 22 real assets, sizes, MIME types. "Refresh list" sits next to "Upload asset" / "Upload in bulk" on an already-loaded, presumably-live list. | `roma/components/assets-domain.tsx` | A second, manual way to re-fetch a list that already loaded once. Whether it's actually redundant (does the list update itself on upload without it?) wasn't tested — uploading would mutate stored data. | **Consistent with the sibling file's same finding** (delete Refresh as a median control if the list already stays current) — not independently re-verified here, since verifying it would require an upload. |
| Settings (`/settings`) | Loaded in ~2s. Plan/role shown plainly ("Tier 4 \| Owner"). "Plan changes are handled outside Roma until the billing provider integration is connected" — stated honestly, not hidden or faked. Base-language control present with an explicit note that it locks after first widget save. | Account settings domain | None found — this page is unusually candid about what it can't do yet. | **Keep.** |
| Profile (`/profile`) | Loaded in ~1.5s. Plain form: name fields, language, country, timezone, one Save. No stall felt. | Profile domain | None observed. | **No stall row.** |
| Billing (`/billing`) | Loaded in ~1.5s. "Billing provider integration is not connected in this environment. Roma shows the current plan only." Explicit "not connected" instead of a fake billing UI. | Billing domain | None — this is the honest-empty pattern done right. | **Keep.** |
| Usage (`/usage`) | Loaded in ~1.9s. "Storage usage is live. Broader usage reporting is not connected in Roma yet." Real live number shown (2.2 MB / unlimited), rest stated as not built. | Usage domain | None. | **Keep.** |
| AI (`/ai`) | Loaded in ~1.6s. "This page shows account AI entitlement context. Copilot execution happens inside Builder." Plan/turn-limit shown plainly, no fake controls for a capability that lives elsewhere. | AI settings domain | None. | **Keep.** |
| Widget Defaults (`/settings/widget-defaults`) | Loaded in ~2.3s: a long accordion (Header, Content Area, Pod Layout, Stage Layout, Header CTA, Stage Appearance, Pod Appearance, Title, Subtitle and supporting copy, Button text, Locale switcher, Locale switcher again, SEO/GEO, Clickeen branding, Social share) with Discard/Save. Confirmed visually: **two separate collapsible sections are both labeled "LOCALE SWITCHER"**, adjacent to each other, with nothing distinguishing which controls what without opening both. | `roma/components/widget-defaults-domain.tsx` (section list/labels) | Not a load-time stall — a labeling defect that costs the user a guess every time they need that specific section. | **Demote/fix the label**, not a deletion candidate — this is missing specificity (e.g. "Locale switcher — placement" vs "— appearance," or similar), not extra defensive machinery. Flagged because it's real and visually confirmed, even though it doesn't fit the audit's usual "guard taxing a click" shape. |
| Product Copilot, live turn (existing FAQ instance, question-only: "What is the header title of this widget right now?") | Selected the Copilot tab, typed, sent. Button read "Stop" while in flight; at ~3s it flipped back to "Send" with a real, correct, context-aware answer in the transcript: *"The header title is **'Build your widget in minutes'**."* No error, no dead-transport message. | `bob/components/CopilotPane.tsx` (now via `useWidgetSessionTransport`), `agents/product-copilot`, `sanfrancisco` | None found; this is the fixed path working as intended. | **Keep.** Independent, second confirmation that the P1 transport fix holds — this session never touched the commit that shipped it or the smoke test that first verified it. |
| Prague directory (`prague.dev.clickeen.com/us/en/`) | 200 in ~0.6s. Locale switcher (29 languages), a widgets list (Countdown, FAQ, Logo showcase) with descriptions, "View all widgets", "Create free". No stall felt. | Prague | None observed at this shallow a check. | **Keep**, at this depth. The sibling file's deeper findings on the same page (embedded-preview swallowing clicks, signed-in Create dead-ending on empty Home) were not independently re-tested here. |

## What was not found by walking

DevStudio (no working auth-refresh path found in this pass's time budget);
any Save, Publish, Unpublish, Delete, translation generate, or asset upload
(excluded by the process's own no-data-mutation rule); Berlin and San
Francisco as standalone surfaces beyond what the Copilot turn exercised;
Prague beyond the directory's first screen. Not inferred, not assumed clean.

## Later work

Remediation, if any, is a separate owner authorization. Each change is a
deletion or demotion of extra weight on a row above. Do not add machinery.
