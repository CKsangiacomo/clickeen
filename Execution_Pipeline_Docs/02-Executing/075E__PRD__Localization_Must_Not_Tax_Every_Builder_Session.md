# 075E - Localization Must Not Tax Every Builder Session

Status: READY FOR REVIEW
Date: 2026-03-19
Owner: Product Dev Team
Priority: P0
Source:
- `Execution_Pipeline_Docs/02-Executing/075__Audit__Authoring_System_Simplification_Findings_And_Slice_Map.md`
- `Execution_Pipeline_Docs/02-Executing/clickeen-selffight-analysis.md`
- `documentation/architecture/CONTEXT.md`

---

## What This PRD Is About

This PRD is about one simple product promise:

1. The user activates the locales they want in Settings.
2. The user edits their widget normally in Builder.
3. The system translates in the background after save.
4. If the user wants to check translations or see the widget in another language, they open a simple Translations panel.

Builder is still the editor.
Translation is still background system work.
The Translations panel is not a second editor.
Bob still has one preview surface.

---

## Non-Negotiable Tenet

The translation system owns translation health.
The user does not.

This is non-negotiable for both product and architecture.

There is exactly **one** translation workflow.
It is Tokyo/Tokyo-worker owned.
It keeps translations in Tokyo current for the current saved widget state.
It is incremental: when only some translatable text changed, the system updates only the affected translation ops/text packs instead of turning Builder into a whole-widget retranslation workflow.
That incremental behavior is not optional implementation polish.
It is part of the architecture:

- save/sync must carry forward enough previous-base identity for Tokyo/Tokyo-worker to compare the previous saved base against the current saved base
- Tokyo/Tokyo-worker must derive changed and removed translatable paths from those two saved bases
- locales that already have overlay ops must update only those changed/removed paths
- locales that do not yet have overlay ops may still need a full first generation
- unchanged locale ops/text packs must be reused instead of paying whole-widget translation cost again

The widget/instance identity is locale-free.
The translation base is **not**.

Translation overlays always start from one immutable **base-locale base** for the current saved widget state.
They do **not** start from a language-neutral content blob.
They do **not** treat translated locales as co-equal authored roots.
Overlay validity, readiness, and panel truth are always relative to that one base-locale base and its fingerprint.

The account base locale is the source language choice for translation bases.
It must be chosen explicitly before authoring starts.
After the first widget save in the account, it is locked.
Changing it later is a support/migration operation, not a normal product toggle.

The user-level contract is intentionally simple:

- answer `Are my translations ok?`
- let the user see what visitors will see

Everything else stays system-owned:

- translation generation
- translation convergence
- translation retry/repair
- artifact convergence/repair before locales are exposed to product consumers
- preventing internal translation states from becoming customer work

If the system is temporarily behind, the system must keep fixing that automatically.
Builder may communicate whether translations are ok, but Builder must not turn internal translation pipeline states into a debugging or repair workflow for the customer.

The Translations panel has exactly 2 visible jobs.
This is non-negotiable:

- say whether translations are ok
- let the user choose which locale to show in the main preview

The Translations panel does nothing else.
It does not exist to teach the user about locale failures, fallback mechanics, or pipeline internals.
It does not own any translation logic.
It only reads current translation status truth from Tokyo and lets the user choose a locale for the main preview.

For product language and human reasoning, Bob is always the editor.
The clean user-facing rule is:

- Translations panel closed => overlay preview is disabled and preview is locked to `baseLocale`
- Translations panel open => overlay preview is enabled on that same preview surface

If implementation uses `previewMode` internally, that is only an implementation detail.
It must not turn into product language that makes Bob sound like multiple products or multiple preview systems.

Bob has one preview surface.
That surface can be in exactly one of these states:

- **editing mode** — any Builder panel other than Translations; preview is locked to `baseLocale`
- **overlays preview mode** — Translations panel is open; preview is read-only for content and can show locale overlays

These are interaction states on the same preview surface.
They are not separate preview implementations, separate iframes, or separate locale renderers.

The panel locale dropdown and the preview locale-switcher do the same job only while the Translations panel is open.
In that state, they are two controls for one overlay preview locale choice.
They must therefore be bound to the same locale overlay display path.

Outside the Translations panel, translations are not available in preview.
The preview locale switcher may remain visible for consistency with the embed/runtime surface, but it is inactive in Bob editing mode.
If the user clicks it in Bob editing mode, Builder shows this message and does nothing else:

- `Translations not available while in editing mode. Preview translations in Translations panel.`

The only acceptable implementation is:

- read locale overlay output from Tokyo
- display locale overlay output from Tokyo
- do that the same way embed/runtime does it whenever overlays preview is enabled
- do not create a second Builder-only preview surface or locale renderer

There is no fallback mode that covers for missing translations.
There is no “best available” locale.
There is no “heal on locale change” behavior.
There is no supported product-path state where Builder or embed asks for a locale artifact that does not exist for the current base fingerprint.

Tokyo/Tokyo-worker own this invariant:

- any locale exposed to Builder overlays preview is current for the current base fingerprint
- any locale exposed to embed/runtime is current for the current base fingerprint
- incomplete locales stay internal system work until they are current
- Builder and embed do not branch on missing locale artifacts in normal operation
- Tokyo/Tokyo-worker read boundaries stay read-only; they do not create, backfill, or heal localization bases or artifacts during Builder/embed reads

If translation convergence is incomplete:

- the panel may say translations are not ok
- the preview locale-switcher and panel dropdown still expose only current/ready locales
- incomplete locales are not selectable in Builder and are not exposed for runtime switching

---

## Product Scope

This PRD covers:

- the user-facing translation experience in Builder after the `75` cleanup
- the first simple reintroduction of the Translations panel
- how translation stays background system work instead of becoming a second authoring product
- how much localization machinery is allowed to live in the always-on editor core
- Builder-side gating of preview locale-switcher interactivity so translations are not previewed while editing

This PRD does not cover:

- asset cleanup from `75B`
- Minibob cleanup from `75C`
- broad account locale-settings redesign outside Builder
- a general-purpose translation correction/override system
- per-locale translated-content editing inside Builder
- the future Agent Settings panel beyond acknowledging that it is the right later home for translator guidance

---

## Execution Posture

This is now a forward-build PRD on top of the cleaned editor.

The old always-on Builder localization system was already removed by the earlier `75` cleanup slices.
So this PRD should **not** be executed like a broad localization-teardown hunt.

It should be executed as a small, explicit build:

- one lazy Translations panel
- one Roma same-origin read route for that panel
- one deletion of dead Bob localization residue that could tempt the implementation back into the old model

If execution starts turning into “find old localization code and reshape it,” execution has already drifted.

---

## Implementation Guardrails

These guardrails exist to keep execution disciplined.

- Bob is always the editor.
- Overlay preview is enabled only when the Translations panel is open.
- Builder consumers use `readyLocales`, never `activeLocales`, for preview/runtime selection.
- Save writes base widget truth only.
- Translation, status, and runtime reads stay read-only.
- Consumer paths do not `ensure`, backfill, or heal localization state.
- The Translations panel owns no translation truth, no translated-content rendering, and no editing.
- Builder preview and embed consume the same Tokyo-backed locale display truth.
- If a locale is selectable in Builder or embed, its artifact exists and is current for the active base fingerprint.
- Missing base/artifact state is a Tokyo/Tokyo-worker boundary failure, not a Builder/Roma coping workflow.
- Product docs should describe this as “overlay preview disabled/enabled,” not “Bob has multiple modes.”
- Contradictory repo-level architecture docs are execution drift and must be closed before this slice is called done.

---

## Architecture Baseline That Must Be Understood Before Execution

This PRD must be executed from the real current architecture, not from guesses, not from old localization residue, and not from whatever types happen to be present in Bob.

Execution is blocked until the implementer can explain this chain plainly:

### 1. Where source-language truth is decided

- Roma Settings owns account locale activation.
- Roma Settings also owns initial account `baseLocale` setup.
- `baseLocale` is the source-language choice for translation bases.
- It must be chosen before authoring starts.
- After the first widget save in the account, it is locked in product UI.
- Later changes are support/migration work, not normal product behavior.

### 2. What Save actually means

- Builder edits one widget.
- Save means: save this one widget.
- Roma saves the widget document to Tokyo.
- Save does **not** mean: enter translation-management mode, reconcile locales in Bob, or create a second authoring truth.

### 3. Where translation actually happens

- There is one translation workflow.
- It lives in Tokyo/Tokyo-worker.
- Tokyo-worker starts from the saved widget state in Tokyo.
- It derives one immutable **base-locale base** and fingerprint for that saved widget state.
- It reads the account locale policy from Berlin.
- It reuses existing locale ops when possible.
- It asks San Francisco only for the changed translation work that is actually needed.
- It writes the resulting translation artifacts back into Tokyo.
- That changed work is derived from the previous saved base snapshot vs the current saved base snapshot at the Tokyo/Tokyo-worker boundary, not from Bob UI state and not from ad-hoc runtime guesses.

This is why the workflow is incremental instead of “retranslate the whole widget every time.”

### 4. Where translation truth lives

- Tokyo is the source of translation truth.
- A locale is customer-ready only when Tokyo has the translation artifact for the current base fingerprint.
- The base snapshot for that fingerprint must already exist before Builder or embed reads translation truth.
- The saved widget plane in Tokyo carries the current `baseFingerprint` and the last synced locale-summary truth for that widget (`baseLocale` + desired locale set).
- Builder and embed consume only customer-ready locales.
- Queue state, attempts, pipeline stages, and other internal mechanics are not customer truth.
- Bob does not own translation truth.
- Roma does not invent translation truth.
- Tokyo/Tokyo-worker read routes do not run `ensure` logic that silently writes missing base state on demand.
- Builder Translations reads do not live-recompute account locale truth from Berlin on panel open; explicit save/sync writes that desired-locale summary into the saved Tokyo widget plane, and the panel reads it there.
- If the base snapshot or current locale artifacts are missing, that is an invariant break at the Tokyo/Tokyo-worker boundary, not a Builder/runtime fallback case and not a read-path self-heal.

### 5. How the Translations panel fits cleanly

- Bob opens the Translations panel lazily.
- Opening the Translations panel puts the one preview surface into overlays preview mode.
- Bob must already know `baseLocale` through the existing Roma -> Bob open/bootstrap contract.
- The Translations panel must not become the way Bob learns `baseLocale`.
- Bob asks one Roma same-origin route for the panel data.
- Roma reads Tokyo/Tokyo-worker truth.
- The panel reflects that truth.
- The panel does not compute statuses itself.
- The panel does not rebuild translated output locally.
- The panel does not merge sibling sources into its own product model.
- The panel exists only to answer:
  - `Are my translations ok?`
  - `Show me the widget in this locale in the main preview`

### 6. Where translated output is actually seen

- The translated widget is seen in the main Builder preview while the Translations panel is open.
- The panel is not a second preview surface.
- Opening or closing the Translations panel changes whether locale overlay inspection is allowed on that same preview surface.
- It does not create a second preview engine.
- Outside the Translations panel, the main preview stays locked to `baseLocale`.
- The panel can change the overlay preview locale.
- The main preview then shows the widget in that locale on the same preview surface.

### 7. What is not part of `75E`

- Live/widget locale-switcher behavior is not part of the Translations panel in this slice.
- Locale-switcher appearance is not part of the Translations panel in this slice.
- Locale-switcher typography is not part of the Translations panel in this slice.
- `75E` must not turn the Translations panel into a home for switcher controls.
- Builder-side gating of whether the preview locale-switcher is active is part of this slice.

### 8. What must never happen

- Builder must not become a localization debugger.
- Builder must not expose pipeline internals as customer workflow.
- Builder/runtime must not silently substitute another locale when a requested translation is missing.
- Missing translation is system failure and system repair work.
- Tokyo/Tokyo-worker read paths must not write or heal localization base/artifact state during panel or runtime reads.
- No second translation workflow may be introduced in Bob, Roma, or the panel layer.

### 9. What `75E` actually is

`75E` is **not** a new localization platform build.

It is a thin Builder integration onto the architecture above:

- one lazy panel
- one Roma read boundary
- one Tokyo-backed truth source
- one preview surface
- one locale dropdown that changes the main preview only while overlays preview is active

If an implementation proposal cannot explain `75E` in exactly those terms, the proposal has already drifted.

---

## Product Truth

For the real product:

1. The user chooses account locales in Roma Settings.
The user also chooses the account base locale there before the first widget save.
2. Builder still edits one widget normally.
3. Save still means save this widget.
4. Translation happens asynchronously after save; it is not the same thing as editing.
It follows one Tokyo/Tokyo-worker-owned workflow that keeps Tokyo translations aligned with the saved widget state.
That workflow is anchored to one immutable **base-locale base** for the current saved widget state.
5. Bob has one preview surface, not two.
6. Any Builder panel other than Translations is editing mode.
7. In editing mode, preview is locked to `baseLocale`.
8. The Translations panel is a simple side panel with exactly 2 jobs and nothing else.
9. Opening the Translations panel enables overlays preview on that same preview surface.
10. That panel answers one simple question with one Translation card: `are my translations ok?`
11. That panel also lets the user switch which locale they want to see in the main preview.
12. When the user changes that locale selection in the Translations panel, Builder updates the **main preview** to that locale so the user sees the translated widget there.
13. The panel itself does **not** render a second translated-content surface.
14. No locale is edited in the Translations panel.
15. The menu entry/icon for the Translations panel should use the globe icon from Dieter icons.
16. Live/widget locale-switcher behavior is not owned by the Translations panel in this slice.
17. The panel does not own locale-switcher appearance or typography.
18. The editor must not be modeled as if it is fundamentally a multi-locale state machine.
19. Builder must not normalize accidental translation failures into a user workflow.
If translations are not ok, that is system-owned and the system must repair it.
20. The Translations panel does not compute, repair, merge, or infer translation truth.
It only reads what Tokyo already has.
It reads translation truth relative to the current immutable base-locale base in Tokyo.
21. There is no runtime or preview fallback that silently substitutes another locale when the requested translation is not there.
If the translation is not there in Tokyo, that is a system issue.
It is not a supported selectable/renderable product state.
22. While the Translations panel is open, the panel locale dropdown and the preview locale-switcher are two controls for the same overlay preview locale choice.
They must always stay bound to the same Tokyo-backed locale display path.
23. Outside the Translations panel, the preview locale-switcher must not change locale.
24. In Bob editing mode, clicking the preview locale-switcher shows:
`Translations not available while in editing mode. Preview translations in Translations panel.`
25. If translations are not ok yet, the panel and preview locale-switcher still expose only current/ready locales for the current base fingerprint.
Incomplete locales remain internal system work until they are current.
26. Leaving the Translations panel returns the preview to `baseLocale`.
27. The Translations panel therefore has exactly these 2 visible product responsibilities:
  - show whether translations are ok
  - let the user choose which locale to show in the main preview

This is not a translation-management product.
The user edits the widget.
The system keeps translations healthy.
The user checks whether translations are ok and can choose which locale to show in the main preview.

---

## One Owner Per Concern

This PRD must not create parallel owners.

- **Roma Settings** owns which locales the account has activated.
- **Roma Settings** owns initial account base-locale setup before authoring starts.
- **Roma current-account bootstrap** owns sending `baseLocale` into Bob once when Builder opens.
- **Builder Translations panel** owns only:
  - showing one Translation card with the global answer for whether translations are ok
  - letting the user choose which locale to show in the main preview
- **Bob local UI state** owns:
  - preview mode: `editing` or `overlays preview`
  - one overlay preview locale used only while the Translations panel is open
- **Editing-mode preview** always uses `baseLocale`.
- **Panel locale dropdown and preview locale-switcher** are two controls for that same overlay preview locale only while the Translations panel is open.
- **Roma same-origin translations route** owns the panel read boundary.
- **Tokyo / Tokyo-worker** own the one translation workflow, translation truth, translation status, and translation artifacts stored in Tokyo.
- **San Francisco** owns background translation generation.

This means:

- account base locale is the translation source-language decision for the account and is not a casual mutable preference after authoring starts
- widget/instance identity is locale-free, but translation overlays are always built from one immutable base-locale base
- the widget can only use locales that the account has activated
- the widget can preview or render only locales Tokyo/Tokyo-worker mark current/ready for the current base fingerprint
- Builder must not invent a second translation truth
- Builder must not reintroduce Bob-side overlay orchestration or panel-owned translation drafts
- Builder must not compensate for missing Tokyo translations with fallback or local reconstruction
- the Translations panel reads Tokyo truth; it does not derive parallel truth from sibling sources
- while the Translations panel is open, the panel locale dropdown and the preview locale-switcher must stay bound to the same overlay preview locale and the same Tokyo-backed display path
- outside the Translations panel, translations are not available in preview and the preview locale switcher is blocked with this message:
  - `Translations not available while in editing mode. Preview translations in Translations panel.`
- locale choice must never trigger local healing, fallback, or best-available substitution
- `75E` must not turn the Translations panel into a second styling surface for anything

After `75E`, the runtime story must be boring:

- Settings decide which locales exist
- the user edits base widget content in editing mode
- the main preview stays on `baseLocale` while editing
- opening the Translations panel enables overlays preview on the same preview surface
- the user picks a locale in the panel or from the preview locale-switcher there
- both controls change the same overlay preview locale
- the main preview shows only current/ready locale output from Tokyo
- leaving the Translations panel returns the preview to `baseLocale`

### Authority Map

| Concern | Surviving authority |
| --- | --- |
| Account locale activation | Roma Settings |
| Account `baseLocale` | Roma Settings |
| Base widget document | Tokyo |
| Base snapshot + `baseFingerprint` | Tokyo/Tokyo-worker |
| Current/ready locale truth | Tokyo/Tokyo-worker |
| Translations panel read boundary | Roma |
| Overlay preview enabled/disabled | Bob local UI state |
| Overlay preview locale while Translations is open | Bob local UI state |
| Translation generation | San Francisco via Tokyo/Tokyo-worker workflow |

---

## Clean Build Rules

What gets built for this PRD must be aggressively simple.

The standard is not “it works.”
The standard is “it solves the user problem without creating a second hidden system.”

That means:

- Build the smallest thing that solves the real user need:
  - check whether translations are ok
  - choose which locale to show in the main preview only from the Translations panel
- keep one preview surface
- keep the panel dropdown and preview locale-switcher bound to the same Tokyo-backed locale display path only while the Translations panel is open
- keep `baseLocale` bootstrap on the existing Roma -> Bob open path instead of adding a second fetch just to learn it
- Do not rebuild a translation-management shell inside Builder.
- Do not rebuild a second authoring surface for translated locales.
- Do not rebuild a hidden per-locale save workflow.
- Do not rebuild a parallel state machine that tries to track translation dirty state, translation drafts, translation sync state, and translation correction state inside every session.
- Do not make the panel look simple while hiding a second complex system underneath it.

In practical terms:

- the Translations panel should load only when the user opens it
- the panel should read translation truth, not invent its own truth
- the panel should read through one Roma same-origin route: `GET /api/account/instances/:publicId/translations`
- the panel should stay read-only in this PRD
- dead Bob localization residue that encourages the old per-locale ops model should be deleted, not reused

If an implementation needs:

- a second editor model
- a second save meaning
- a second translation truth
- a second preview surface
- freeform manual overlay management
- hidden session-wide localization machinery
- Bob-side translation merge/apply logic for the panel

then it is the wrong implementation for `75E`.

### Do Not Reintroduce These Shapes

- `activeLocales` in the Bob-facing Translations contract
- server-owned `inspectionLocale`
- per-locale status rows in the panel UI
- locale-switcher config controls in the Translations panel
- Bob-side localization stores or overlay orchestration
- preview fallback to base content for a selected translated locale
- read-path `ensure` logic that writes missing localization base/artifact state
- a second preview surface or second locale renderer

---

## Canonical User Journey

This is the journey implementation must preserve.

1. User writes FAQ content in `Content`.
   User sees editable base content only.
   System truth: Bob edits one widget draft; overlay preview is disabled.
   Must not happen: translated preview while authoring.

2. User clicks Save.
   User sees normal save behavior.
   System truth: Roma saves the widget to Tokyo; Tokyo/Tokyo-worker derive the base snapshot and `baseFingerprint`; translation convergence runs after save.
   Must not happen: Bob entering translation-management state.

3. User opens Settings and sees 2 locales selected out of 29.
   User sees account locale policy.
   System truth: Roma Settings owns active locales and account `baseLocale`.
   Must not happen: widget-local locale truth overriding account policy.

4. User selects 4 more locales and saves Settings.
   User now has 6 active locales.
   System truth: account locale policy changes; Tokyo/Tokyo-worker can converge those locales for saved widgets.
   Must not happen: Builder becoming a locale-management control plane.

5. User goes back to `Content`, changes text, and clicks Save.
   User still sees editable base content.
   System truth: a new saved widget state creates a new current base snapshot and `baseFingerprint`; only locales current for that fingerprint may be exposed.
   Must not happen: stale locale artifacts remaining preview-selectable.

6. User opens `Translations`.
   User sees one translation-health answer and one locale dropdown on the same preview surface.
   System truth: Bob enables overlay preview and makes one lazy Roma read for panel truth.
   Must not happen: a second preview surface or panel-owned translated rendering.

7. User chooses `DE`, then switches preview to `FR` from the in-widget locale switcher.
   User sees the main preview change from `DE` to `FR`.
   System truth: both controls mutate one Bob-local overlay preview locale and display only Tokyo-backed current/ready output.
   Must not happen: iframe self-navigation, fallback, or divergent locale truth.

8. User clicks back to `Content`.
   User sees editable base content and preview snaps back to `baseLocale`.
   System truth: overlay preview is disabled again; same preview surface remains.
   Must not happen: translated preview lingering while authoring continues.

---

## Boundary Failures

When something is wrong, it must fail at the named boundary.

- Missing base snapshot for the current `baseFingerprint` => fail at Tokyo/Tokyo-worker read boundary.
- Missing current locale artifact for a supposedly ready locale => fail at Tokyo/Tokyo-worker boundary.
- Invalid Translations payload => fail in Roma validation.
- Locale switcher click while Translations is closed => Bob blocks it with the exact product copy.
- Request for a non-ready locale in Builder/embed => unsupported by contract; do not add consumer-side handling for it.

---

## 1. Where We Fucked Up / How And Why

We turned a simple user need into a translation-management system inside Builder.

### A. Localization lives inside the always-on editor core

The customer just wants to:

- choose which languages they support
- edit their widget
- trust the system to translate it
- inspect what visitors will see

Instead, the old implementation made every Builder session carry extra localization machinery.

That happened because localization was implemented as part of the base session model, not as a subordinate lane activated when needed.

### B. Save semantics got more complex than the product

The user thinks Save means:

- save my widget

But the old approach pulled in extra translation concerns:

- overlay state
- dirty tracking
- fingerprints
- translation monitoring
- locale-only persistence

Those are real implementation needs, but they were allowed to reshape the mental model of Save.

The key mistake was conceptual:

- editing is base-locale authoring
- translation is async follow-up

The code blurred those together.

### C. Every session pays for cross-locale complexity

Even when the customer is just editing their widget normally, Builder still pays for cross-locale complexity that the customer is not actively using.

That happened because we optimized for one generalized multi-locale session instead of one boring one-locale editor with async translation behavior around it.

### D. Multi-language machinery leaked into the base widget contract

The user-facing translation experience should have been simple:

- Settings chooses locales
- Builder edits the widget
- System translates in the background
- Translations panel shows translation state and lets the user inspect the result in the main preview

Instead, the product shape drifted toward “Builder is also a translation-management shell.”

---

## 2. Why This Is Toxic And Why It Makes Roma/Clickeen Unusable

### A. The simple case becomes harder than it should be

If a customer is editing one widget, Builder should feel tiny and direct.

Instead, they pay hidden complexity for:

- overlay state
- status tracking
- translation aftermath
- cross-locale orchestration

### B. Save becomes harder to trust

The customer should not need to care whether Builder is doing:

- save
- translation follow-up
- status reconciliation

The more translation machinery is embedded into the main save path, the less boring Save becomes.

### C. The editor becomes harder to simplify

Once localization owns a large share of the session layer, every future cleanup has to tiptoe around it.

That makes one-active-locale editing harder to keep clean.

### D. Product understanding erodes

If the product is written like translation is part of editing instead of background aftermath, the editor stops matching what users think they are doing.

---

## 3. How We Are Fixing It

### A. The base Builder path stays simple again

The default Builder experience should stay:

- one widget
- one save

without carrying unnecessary translation-management machinery in the hot path.

### B. The Translations panel comes back only in a simple form

The first reintroduced Translations panel should be:

- a simple side panel in Builder
- using the globe icon from Dieter icons for its menu entry
- one simple Translation card showing whether translations are ok
- showing the current/ready locales for this widget in a locale dropdown
- through that locale dropdown, the user can see the current widget in the selected locale **in the main preview** while the Translations panel is open
- the preview locale-switcher and the panel locale dropdown are two controls for that same overlay preview locale only while the Translations panel is open
- read-only
- not editable for **any** locale
- not a second content editor
- not a repeater clone

How it works in the product:

- the panel loads translation truth from Tokyo through one Roma read route
- the panel renders one Translation card answering whether translations are ok
- opening the panel enables overlays preview on the same preview surface
- the locale dropdown chooses the overlay preview locale for the main preview
- changing the dropdown updates the **main Builder preview** to that locale
- the preview locale-switcher and the panel locale dropdown are bound to the same overlay preview locale
- both controls display the locale overlay from Tokyo through the same display path Builder uses for preview
- the user sees the translated widget only in the **main preview**, not inside the panel
- the panel never renders a second widget/content surface
- the panel does not ask the user to diagnose, reconcile, or repair locale failures
- the panel never computes translation state itself; it only reflects Tokyo truth
- the panel reads that truth relative to the current immutable base-locale base/fingerprint in Tokyo
- outside the panel, Builder is in editing mode and the preview stays locked to `baseLocale`
- in editing mode, clicking the preview locale-switcher shows:
  - `Translations not available while in editing mode. Preview translations in Translations panel.`
- if translations are not fully converged yet, that is system repair work, not customer work
- incomplete locales are not exposed in the panel dropdown or preview locale-switcher until Tokyo marks them current
- Builder does not try to fix, substitute, or hide locale truth at interaction time
- leaving the panel returns the main preview to `baseLocale`

The panel should load its data only when opened.
It should read through one Roma same-origin route:

- `GET /api/account/instances/:publicId/translations`

That route should return the complete panel truth the UI needs for the current widget:

- current/ready locales
- whether translations are ok
- the current base locale for the immutable translation base

Roma assembles that response server-side from Tokyo/Tokyo-worker truth.
Builder renders one global ok/not-ok Translation card from that response.
When the user changes the locale dropdown, Builder updates the **main preview** to that locale using Bob-local UI state while the Translations panel is open.
Builder must not reassemble this truth locally by merging sibling translation/status/settings sources.
Builder must not infer “best available” output or apply locale fallback.

### C. Panel Dropdown And Preview Locale-Switcher Must Be The Same Locale Action

`75E` must make this explicit in product behavior and in code:

- Bob still has one preview surface
- outside the Translations panel, that preview is editing mode and stays on `baseLocale`
- inside the Translations panel, that preview is overlays preview mode
- the panel locale dropdown and the preview locale-switcher do the same job only in overlays preview mode
- both change the same overlay preview locale there
- both must display locale overlays from Tokyo through the same preview path
- both must therefore behave the same way the embed/runtime locale path behaves

This means:

- there is no separate Bob-only translation display path for the panel
- there is no separate Builder-only translation display path for the switcher
- there is no second preview surface in Bob
- there is no supported selectable/renderable locale whose artifact is missing
- there is no consumer-side availability branch in overlays preview mode
- outside the Translations panel, the switcher is blocked and clicking it shows:
  - `Translations not available while in editing mode. Preview translations in Translations panel.`

If translations are not ok:

- the panel can still say translations are not ok
- the widget preview still exposes current/ready locales only
- incomplete locales stay out of the dropdown and the preview locale-switcher
- nothing in that moment tries to repair, recompute, or mask locale truth in the consumer

### D. Translation stays explicit background aftermath

Translation follow-up remains system work after save:

- it remains subordinate to the same Save action
- it does not redefine what Save means
- it does not turn Builder into a translation-management control plane

### E. This PRD does not reintroduce translation correction as editing

If a user sees a mistranslation, the answer is not to turn the Translations panel into a second authoring system.

This PRD does not reintroduce:

- per-locale translated-content editing
- freeform manual translation overrides
- manual overlay management
- translation dirty/save state in the main Builder flow

Future translator guidance belongs in a separate follow-up track and eventual Agent Settings surface, not in this PRD.

---

## 4. What The System Looks Like Before / After

### Before

- Every Builder session carries too much translation machinery.
- The product shape is harder to understand than the user workflow.
- Save and session state are harder to reason about because translation is embedded into the core editing path.
- The old translation experience is too close to a second editor.

### After

- Builder editing stays simple.
- The system translates in the background after save.
- Users can open a simple Translations panel to check whether translations are ok and choose which locale to show in the main preview.
- Outside the Translations panel, the same preview surface stays locked to `baseLocale`.
- The panel is not a second editor.
- Save remains one customer action with clear truth.
- The system behind the panel is also small and boring, not a disguised parallel localization product.

---

## 5. Real Execution Slice

This PRD is **not** primarily “touch old localization files.”
The old always-on Builder localization files are already gone.

The real execution slice is:

- one new lazy Builder Translations panel
- one Roma same-origin translations read route:
  - `GET /api/account/instances/:publicId/translations`
- one deletion of dead Bob localization residue

### Real files/areas that should be touched

- new Builder panel component(s) for translation-status display and locale dropdown control
- Builder panel wiring so the panel loads lazily only when opened
- Roma same-origin translations route for the panel
- Tokyo/Tokyo-worker read path behind that route if needed to expose the current translation truth cleanly
- Bob session cleanup so translation status loading is not treated as editor-core state

### Toxic LOCs and concepts that will be removed from the system

- always-on localization machinery in the default Builder session
- save-path complexity that exists only because translation was embedded into editing itself
- overlay/status/tracking state that taxes one-active-locale editing without improving active-locale UX
- product language that implies the editor is a translation-management product first
- any reintroduction of a repeater-based translation editor or per-locale override CMS in Builder
- dead Bob localization utility residue that can tempt the implementation back into local overlay/apply logic

### Toxic workflows that will be removed

- one-active-locale open/edit/save paying for cross-locale orchestration
- default Builder session carrying localization state it does not need
- translation aftermath behavior obscuring the main save contract
- translation checking being confused with translation editing
- Builder reconstructing translation truth locally instead of reading it through one named route

### Files or branches that should disappear if they only serve always-on localization tax

- core-session locale branches that do nothing for single-language product use
- default-save branches that exist only to preserve translation-management machinery in the hot path

---

## Done Means

- users activate locales in Settings
- users choose the account base locale explicitly before the first widget save
- after the first widget save, account base locale is locked in product UI
- later base-locale changes are treated as support/migration work, not a normal settings toggle
- users edit their widget normally in Builder
- translation remains background system work after save
- Builder can show a simple Translations panel
- Bob uses one preview surface, not a second panel preview
- any Builder panel other than Translations is editing mode
- editing mode preview is locked to `baseLocale`
- the panel shows one simple Translation card answering whether translations are ok
- the panel includes a locale dropdown for the main preview
- opening the Translations panel enables overlays preview on that same preview surface
- changing that locale dropdown updates the current widget in the main preview
- while the Translations panel is open, the panel locale dropdown and the preview locale-switcher are bound to the same overlay preview locale
- both show only current/ready locale output for the currently chosen locale in overlays preview mode
- outside the Translations panel, clicking the preview locale-switcher shows:
  - `Translations not available while in editing mode. Preview translations in Translations panel.`
- outside the Translations panel, the preview locale switcher does not change locale
- translated widget output is seen only in the main preview, not in the panel
- the panel does not turn stale/missing/repair states into customer work
- the panel loads only when the user opens it
- the panel reads through one Roma same-origin route:
  - `GET /api/account/instances/:publicId/translations`
- that route reads Tokyo/Tokyo-worker translation truth instead of recreating it in Bob
- that route returns only the translation status truth plus current/ready locale truth server-side so Bob does not merge locale state and translation state from multiple sources
- there is exactly one translation workflow and it is Tokyo/Tokyo-worker owned
- widget/instance identity stays locale-free while translation overlays stay anchored to one immutable base-locale base
- that workflow keeps translation artifacts in Tokyo aligned with the current saved widget state
- that workflow remains incremental instead of turning Builder into whole-widget retranslation management
- translation/status/runtime reads stay read-only and do not create or heal missing localization base/artifact state on demand
- the panel has exactly 2 visible jobs and owns no translation logic:
  - say whether translations are ok
  - let the user choose which locale to show in the main preview
- while the Translations panel is open, the preview locale-switcher and the panel locale dropdown are two controls for that same overlay preview locale
- both display raw Tokyo locale output through the same preview path
- there is no fallback mode that silently substitutes another locale when translations are missing
- incomplete locales are not selectable/renderable until Tokyo marks them current for the current base fingerprint
- leaving the Translations panel returns the preview to `baseLocale`
- the panel is read-only for all locales and not a second editor
- Save remains one boring action even when localization exists
- the Builder session stays proportional to the real default product
- the implementation is small and boring enough that a human PM/dev can explain it in plain product terms without translating system abstractions
- there is no hidden parallel translation system fighting the main Builder flow
- translation health remains system-owned and self-healing rather than becoming a customer workflow
- dead Bob localization residue that would encourage the old model is removed
- `documentation/architecture/CONTEXT.md` and `documentation/architecture/Tenets.md` no longer contradict `75E` on Builder locale behavior or no-fallback overlay truth
