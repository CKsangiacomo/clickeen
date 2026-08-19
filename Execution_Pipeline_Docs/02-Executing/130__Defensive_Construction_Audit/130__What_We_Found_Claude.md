# What we found — Claude

An independent second pass over the same ground as `130__What_We_Found.md`,
walked separately, by a different model, without reusing that file's rows.

Method: `130__How_To_Audit.md`.

This is evidence, not permission to change code.

Date: 2026-08-19

This file is not `130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md`.
It does not import that PRD's pattern catalog, matrix, or slices. It also does
not import `130__What_We_Found.md`'s rows — where this pass touches the same
click, that's noted explicitly as corroboration or divergence, not copied.

This audit does not authorize code changes.

## How this pass was walked

Deployed cloud-dev, `https://roma.dev.clickeen.com`, signed in as the same
account (`CLICKEEN`) using this repo's own `pnpm e2e:auth:roma-dev` dev-admin
login and the resulting Playwright storage state — a real authenticated
browser session, not a code read. The saved session in the repo was expired
when this pass started (`/api/bootstrap` returned 401, Roma correctly
redirected to `/login` rather than silently failing — that redirect is
correct behavior, not a finding); `pnpm e2e:auth:roma-dev` minted a fresh one
before walking anything. Driven with Playwright directly (`chromium.launch`),
screenshotting every step. No `chromium-cli` binary was available in this
environment; adapted the equivalent driver by hand.

Inventory at walk time: published Big Bang `LWZZR7JSG8` ("BigBang Test"),
published FAQ `VUWUJ7OQ0Y` ("FAQ example"), Countdown `8LGOEM8JGC`, Cards
`M4YW8OAT5O` (unpublished — confirmed by its public URL returning 404). No
Save, Publish, Unpublish, translation generate, or asset write was performed.
Where a click would have mutated shared account state (the Published toggle),
this pass inspected the DOM at that point instead of clicking it.

## How services were covered

The unit is a user click, not a service folder. Walked: Roma widgets list,
nav, Builder open on an existing published instance, Catalog → New, Team;
Tokyo-worker public serving (published FAQ base and `?locale=fr`, unpublished
Cards). Not reached this pass: Prague, Assets, Settings/Profile/Billing/
Usage/AI, actual Save/Publish/Unpublish/translate/upload, DevStudio. Those
stay unmarked — not inferred, not carried over from the sibling file.

## Ranked by what was felt

1. Builder open on an existing instance: the edit controls are usable several
   seconds before the visual preview is — a user can start changing settings
   before they can see what they're changing.
2. Widgets list shows nothing but "Loading widgets…" — no rows, no skeleton,
   no count — for a little over two seconds before the table appears.
3. One thing predicted from an earlier code-only read did not reproduce live
   (see row below) — recorded because the correction itself is evidence for
   how this audit should be run, not because it's a live problem.
4. Two things the sibling pass flagged as click-interception (Edit link,
   general nav) did not reproduce in this pass's clicks — recorded as
   non-reproduction, not as a refutation; the sibling file called it
   intermittent, and two independent misses on two separate days is
   consistent with "intermittent."

## Rows

| journey / click | what was felt | owning file | extra weight | keep, demote, or delete |
| --- | --- | --- | --- | --- |
| Widgets list load (`/widgets`) | Nav renders instantly. Content area shows only "Loading widgets…" — no rows, no skeleton — confirmed still showing that at the 2-second mark in a screenshot, with the real 4-row table appearing a moment after. | `roma/components/widgets-domain.tsx` (`refreshWidgets`, `domainLoading` gate) | The wait is the account-widgets fetch; nothing extra observed guarding it. The felt cost is that the placeholder is one static line, not a shape of the thing arriving. | **Demote** the placeholder to a skeleton that hints at rows, not a blank pill. Not a guard to delete — a felt-completion signal to improve. |
| Builder open, existing published instance (Edit → `/builder/LWZZR7JSG8`) | Roma's own shell shows "Loading widget… / Loading publication status…" against an otherwise empty page for the first stretch — honest text, but nothing else on screen. By ~1.8s the iframe's edit controls (Manual/Copilot tabs, full Content panel, all fields populated) are live and clickable. The visual preview pane, at that same 1.8s mark, still reads "Loading preview…" and does not resolve until sometime before 5.8s. | Roma outer shell: `roma/components/builder-domain.tsx`. Preview pane: Bob `Workspace.tsx` (iframe `srcdoc` build + widget-software fetch). | The controls and the preview are not on the same clock — a user can edit a field with no visual confirmation for several seconds. This is a felt gap, not a guard; nothing here looked like defensive machinery, just two independent loads finishing at different times. | **Demote/reorder**: no code to delete — the preview load path could start earlier or the controls could wait for it, so the two panes finish closer together. Not urgent; a few seconds, not a stall with no end. |
| Same journey — a specific prediction from an earlier code-only read | A prior session read `bob/components/ToolDrawer.tsx` and predicted every Builder open would show "No instance selected yet. Choose one from Widgets to begin editing." during this exact boot window. Live, right now, that text never appeared — Roma's own "Loading widget…" line is what's shown instead. | `bob/components/ToolDrawer.tsx`, `roma/components/builder-domain.tsx` | None — this is a correction, not a finding. The lifecycle-simplification commit that shipped since that earlier read (`a6678966`, "simplify widget lifecycle and trusted boundaries") evidently replaced the old boot copy along with moving publication chrome out of Bob. | **No action.** Recorded so the earlier prediction isn't carried forward as current fact. Code-only predictions need a live check before they're treated as findings — this is that check. |
| Publication chrome location, same journey | A slim bar above the iframe — not inside it — shows the instance name, "Published · [time]", the toggle, "Open public widget", "Copy code". Confirms the Roma-owned-header design reviewed earlier in this program actually shipped, not just planned. | `roma/components/builder-domain.tsx` | None — this is the intended shape: Bob has no publication awareness left in what's on screen. | **Keep.** Positive confirmation, recorded for the record. |
| Catalog → New (`/widgets/catalog` → Create instance → `/builder/new/big-bang`) | Header reads "Untitled widget / Save to create this widget" with one visible "Save" button. The visual preview renders immediately with real default content — no "Loading preview…" stall observed here, unlike opening an existing instance. | `roma/components/widgets-domain.tsx` (`handleCreateInstance` — confirmed in source it does `router.push` only, no request), `roma/components/builder-domain.tsx` | None found. Copy is honest, nothing is created by the click (verified: no instance appeared in the account after backing out), and the preview isn't behind the same lag as the existing-instance case. | **Keep.** |
| Nav "Widgets" entry + Edit link, widgets list | Hit-tested both before clicking (screen-point → `elementFromPoint`, not a real click) and both hit the correct element — the Edit `<a class="diet-button">` for the Edit link, and the labeled control for nav. Then clicked Edit for real, twice, on separate runs: both navigated cleanly to `/builder/LWZZR7JSG8` with no missed click. | `roma/components/widgets-domain.tsx`, `roma/components/roma-nav.tsx` | None observed in this pass. | **No action from this pass.** The sibling file reports intermittent interception on these same controls; this pass's two clean runs neither confirm nor refute that — consistent with "intermittent" rather than "always," which is how the sibling file already classified it. |
| Published toggle, widgets list | Not clicked (would flip real publish state on a shared account). Direct DOM read: `input[type=checkbox][role=switch]` reports `checked: true, disabled: false` — a normal, enabled control. The visible custom switch graphic is a `<span class="diet-toggle__switch">` layered over the real (visually hidden) checkbox, which is standard toggle markup, not obviously an intercepting overlay. | `roma/components/widgets-domain.tsx` | Unknown — this pass deliberately did not test whether a real click lands, to avoid mutating shared account data. | **Unmarked.** Neither confirms nor refutes the sibling file's interception claim for this control; flagged here so the gap in coverage is explicit rather than silently absent. |
| `beforeunload` console warning | First appeared once, only when this pass drove navigation with `page.goto()` (a raw browser navigation) rather than a real link click. Repeated the same navigation via an actual click chain afterward and the warning did not recur. | N/A — test-methodology artifact | None on the product. | **Not a finding.** Recorded so it isn't mistaken for a live bug by whoever reads this file next; it's a byproduct of how this pass drove the browser, not something a real user's click sequence produces. |
| Public FAQ (`dev.clk.live/CLICKEEN/VUWUJ7OQ0Y`), base and `?locale=fr` | Both returned 200 with real rendered content (title, working accordion cards) in ~1-1.8s. | Tokyo-worker public serving | None. | **Keep.** |
| Public Cards (`dev.clk.live/CLICKEEN/M4YW8OAT5O`), unpublished | 404 in ~0.6s. | Tokyo-worker public ingress | None — this is the owning boundary failing visibly, correctly. | **Keep.** |
| Team page (`/team`) | Loaded in ~1.5s with real member data (one owner row); no stall, no extra lock felt. | Team domain | None observed. | **No stall row.** |

## What was not found by walking

Prague, Assets, Settings/Profile/Billing/Usage/AI, DevStudio, and any actual
Save/Publish/Unpublish/translate/upload were not reached this pass. They stay
unmarked — not inferred from source, not assumed clean or broken.

## Later work

Remediation, if any, is a separate owner authorization. Each change is a
deletion or demotion of extra weight on a row above. Do not add machinery.
