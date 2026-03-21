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
4. If the user wants to inspect translations, they open a simple Translations panel.

Builder is still the editor.
Translation is still background system work.
The Translations panel is not a second editor.

---

## Product Scope

This PRD covers:

- the user-facing translation experience in Builder after the `75` cleanup
- the first simple reintroduction of the Translations panel
- how the widget's locale-behavior controls are exposed for the current widget
- how translation stays background system work instead of becoming a second authoring product
- how much localization machinery is allowed to live in the always-on editor core

This PRD does not cover:

- asset cleanup from `75B`
- Minibob cleanup from `75C`
- broad account locale-settings redesign outside Builder, except for the minimal removal of user-facing switcher/IP controls that no longer belong in Settings after this cutover
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
- one small set of widget-level locale behavior settings
- one locale switcher element treated like a normal widget element
- one deletion of dead Bob localization residue that could tempt the implementation back into the old model

If execution starts turning into “find old localization code and reshape it,” execution has already drifted.

---

## Product Truth

For the real product:

1. The user chooses account locales in Roma Settings.
2. Builder still edits one widget normally.
3. Save still means save this widget.
4. Translation happens asynchronously after save; it is not the same thing as editing.
5. The Translations panel is a simple inspection surface for the current widget.
6. That panel shows the account's active locales, lets the user switch which locale they are viewing, and shows the current translated output for that locale.
7. Base locale is not edited in the Translations panel.
8. The menu entry/icon for the Translations panel should use the globe icon from Dieter icons.
9. The panel can also hold simple **widget-level** locale-presentation controls:
   - `Show locale switcher`
   - `Show by IP`
   - if `Show by IP` is off, show `Always show: [locale]`
10. If `Show locale switcher` is on, the panel also exposes switcher placement controls:
   - `Attach to: Pod / Stage`
   - `Position: Top left / Top center / Top right / Right middle / Bottom right / Bottom center / Bottom left / Left middle`
11. These widget-level controls only decide how **this widget** behaves.
They do not change which locales the account has activated in Settings.
They are not account Settings controls.
The locale switcher belongs to the widget, not to Settings.
12. If the locale switcher is shown, it is a real visible widget element and should be managed the same way we manage CTA:
   - it has its own settings
   - it has its own appearance controls
   - it has its own typography role
   - it does not borrow or piggyback on CTA styling/typography
   - it must reuse Dieter utilities and existing widget/control patterns instead of inventing a new one-off UI system
13. The locale switcher shown to end visitors should be a simple text-first dropdown using the canonical locale labels. No flag-based switcher.
14. The editor must not be modeled as if it is fundamentally a multi-locale state machine.

These controls mean:

- `Show locale switcher` controls whether visitors can manually change locale in the live widget.
- `Show by IP` controls whether the live widget tries to choose the visitor's starting locale automatically from IP/location.
- If `Show by IP` is off, `Always show: [locale]` controls which locale the widget always opens in.
- If the switcher is visible, `Attach to` decides whether it is attached to the pod or the stage.
- `Pod` means the switcher sits outside the pod.
- `Stage` means the switcher sits inside the stage.
- `Position` decides which edge/corner position is used.
- If the chosen locale is unavailable, the widget falls back to the base locale.
- The locale switcher is treated like any other visible widget UI element:
  - users can decide whether it exists
  - users can style it
  - but it has its own design settings, just like CTA has its own design settings

This is not a translation-management product.
The user edits the widget.
The system translates it.
The user can inspect the translated result.

---

## One Owner Per Concern

This PRD must not create parallel owners.

- **Roma Settings** owns which locales the account has activated.
- **Roma Settings** does **not** own the locale switcher.
- **Builder Translations panel** owns only inspection plus widget-level locale behavior for the current widget.
- **Roma same-origin translations route** owns the panel read boundary.
- **Tokyo / Tokyo-worker** own translation truth, translation status, and published translation artifacts.
- **San Francisco** owns background translation generation.

This means:

- account locale settings and widget locale behavior are related, but they are **not the same thing**
- the widget can only use locales that the account has activated
- locale switcher visibility, IP behavior, fixed-locale behavior, placement, and styling are widget-level only
- any existing account-level switcher or IP enable/disable behavior is legacy residue and must stop being a public-widget owner in this slice
- if account-level `countryToLocale` mapping survives, it is support data only; it does not decide whether any widget uses IP
- Builder must not invent a second translation truth
- Builder must not reintroduce Bob-side overlay orchestration or panel-owned translation drafts

After `75E`, the runtime story must be boring:

- Settings decide which locales exist
- the widget decides how it presents those locales
- the public runtime renders that one widget decision

There must not be one switcher owner in widget config and another one still hiding in account policy or public-runtime injection code.

---

## Clean Build Rules

What gets built for this PRD must be aggressively simple.

The standard is not “it works.”
The standard is “it solves the user problem without creating a second hidden system.”

That means:

- Build the smallest thing that solves the real user need:
  - inspect translations
  - control simple locale behavior in the widget
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
- the locale switcher controls should stay limited to:
  - `Show locale switcher`
  - `Show by IP`
  - `Always show: [locale]` when `Show by IP` is off
- if the switcher is enabled, placement controls should stay limited to:
  - `Attach to: Pod / Stage`
  - `Position: Top left / Top center / Top right / Right middle / Bottom right / Bottom center / Bottom left / Left middle`
- the locale switcher should use the same clean product model as CTA:
  - settings
  - appearance
  - typography
  - but its own role, not CTA's role
- the locale switcher UI should reuse Dieter utilities and existing widget/control patterns
- do not invent a bespoke switcher component family when existing dropdown/control patterns already solve the problem
- dead Bob localization residue that encourages the old per-locale ops model should be deleted, not reused

If an implementation needs:

- a second editor model
- a second save meaning
- a second translation truth
- freeform manual overlay management
- hidden session-wide localization machinery
- Bob-side translation merge/apply logic for the panel

then it is the wrong implementation for `75E`.

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

- editing is one active locale
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
- Translations panel shows the result

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
- showing the locales the user activated in Settings
- using a locale dropdown
- showing the translated output for the current widget and selected locale
- showing translation status for each locale
- read-only
- not editable for the base locale
- not a second content editor
- not a repeater clone

The panel should load its data only when opened.
It should read through one Roma same-origin route:

- `GET /api/account/instances/:publicId/translations`

That route should return the complete panel truth the UI needs for the current widget:

- active locales
- translation status by locale
- translated output for the selected locale
- current widget locale behavior for:
  - `Show locale switcher`
  - `Show by IP`
  - `Always show: [locale]`
  - `Attach to`
  - `Position`

Roma assembles that response server-side from Tokyo/Tokyo-worker and widget truth.
Builder renders what it gets.
Builder must not reassemble this truth locally by merging sibling translation/status/settings sources.

### C. Widget locale-presentation controls live with translation inspection

The panel can also expose the widget-level locale behavior that users naturally expect to manage there:

- `Show locale switcher`
- `Show by IP`
- if `Show by IP` is off, reveal `Always show: [locale]`
- if `Show locale switcher` is on, reveal:
  - `Attach to: Pod / Stage`
  - `Position: Top left / Top center / Top right / Right middle / Bottom right / Bottom center / Bottom left / Left middle`

These are visitor-experience controls, not translation-management workflow.

The behavior is intentionally simple:

- `Show locale switcher` on = visitors can manually switch locale in the widget
- `Show locale switcher` off = visitors cannot manually switch locale
- `Show by IP` on = the widget tries to start in the visitor's locale if that locale is available
- `Show by IP` off = the widget does not auto-pick by IP and instead always starts in the locale chosen in `Always show`
- `Always show: [locale]` is only visible when `Show by IP` is off
- `Attach to: Pod` = the switcher is attached outside the pod
- `Attach to: Stage` = the switcher is attached inside the stage
- `Position` controls the chosen edge/corner placement
- if the requested locale is not available, the widget falls back to the base locale

The locale switcher is also a real display element inside the widget.
So it must be managed like CTA is managed:

- the switcher has its own behavior settings
- the switcher has its own appearance controls
- the switcher has its own typography role

This does **not** mean “reuse CTA styling.”
It means “reuse the same clean product model we already understand from CTA.”

In plain English:

- CTA and locale switcher are both visible widget controls
- both should be configurable in a familiar way
- each must still have its own settings and own design language

So the locale switcher should not be treated as:

- a hardcoded browser-like UI
- a one-off font picker hack
- an orphan element outside the normal widget styling system
- a bespoke custom control family when Dieter utilities or existing widget/control patterns already solve it

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
- Users can open a simple Translations panel to inspect translated output.
- That panel also exposes the widget's locale-behavior controls:
  - `Show locale switcher`
  - `Show by IP`
  - conditional `Always show: [locale]`
- If the switcher is shown, it is styled as a normal widget element with its own settings, appearance, and typography role.
- If the switcher is shown, it reuses Dieter utilities and existing widget/control patterns instead of introducing a brand-new UI invention.
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
- one small set of widget-level locale behavior fields persisted with the widget
- one locale switcher element in the widget definition/runtime
- one deletion of dead Bob localization residue:
  - `bob/lib/l10n/instance.ts`

### Real files/areas that should be touched

- new Builder panel component(s) for Translations inspection
- Builder panel wiring so the panel loads lazily only when opened
- Roma same-origin translations route for the panel
- Tokyo/Tokyo-worker read path behind that route if needed to expose the current translation truth cleanly
- widget `spec.json` / widget runtime / widget styles for:
  - `Show locale switcher`
  - `Show by IP`
  - `Always show: [locale]`
  - `Attach to: Pod / Stage`
  - switcher `Position`
  - switcher appearance
  - switcher typography role
- minimal Roma Settings cleanup so user-facing switcher/IP controls do not survive there after widget-level ownership moves into the Translations panel
- public runtime cutover so locale switcher behavior is read from widget truth, not a second account-policy owner
- deletion/replacement of any public-runtime injected switcher that survives outside the widget element model
- deletion of `bob/lib/l10n/instance.ts`

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
- translation inspection being confused with translation editing
- Builder reconstructing translation truth locally instead of reading it through one named route
- public runtime asking account policy whether the switcher exists after widget truth already decided it
- public runtime shipping one switcher from account policy and another from widget config

### Files or branches that should disappear if they only serve always-on localization tax

- core-session locale branches that do nothing for single-language product use
- default-save branches that exist only to preserve translation-management machinery in the hot path
- `bob/lib/l10n/instance.ts` if it remains unused and exists only as orphaned residue from the old per-locale ops model

---

## Done Means

- users activate locales in Settings
- users edit their widget normally in Builder
- translation remains background system work after save
- Builder can show a simple Translations panel for inspection
- the panel shows active locales and translated output for the current widget
- the panel shows translation status for each locale
- the panel loads only when the user opens it
- the panel reads through one Roma same-origin route:
  - `GET /api/account/instances/:publicId/translations`
- that route reads Tokyo/Tokyo-worker translation truth instead of recreating it in Bob
- that route returns the complete panel truth server-side so Bob does not merge translation text, translation status, and widget locale behavior from multiple sources
- the panel can control widget locale behavior with exactly these controls:
  - `Show locale switcher`
  - `Show by IP`
  - `Always show: [locale]` when `Show by IP` is off
- if the switcher is enabled, the panel also exposes exactly these placement controls:
  - `Attach to: Pod / Stage`
  - `Position: Top left / Top center / Top right / Right middle / Bottom right / Bottom center / Bottom left / Left middle`
- if the switcher is enabled, it is managed like CTA as a normal widget element:
  - own settings
  - own appearance controls
  - own typography role
- if the switcher is enabled, its UI is built from Dieter utilities and/or existing widget/control patterns rather than a bespoke new component family
- account locale settings and widget locale behavior do not fight each other:
  - Settings decide which locales exist
  - the widget decides how it presents those locales
- user-facing switcher/IP controls no longer survive in Settings after this cutover; Settings are reduced to locale activation plus optional `countryToLocale` support data
- account-level switcher/IP enablement is not a second runtime owner after this cutover
- if account-level `countryToLocale` mapping survives, it is support data only and never a second widget-level enable/disable owner
- the current public-runtime injected switcher is deleted/replaced so the only live switcher after `75E` is the widget element
- the panel is read-only and not a second editor
- Save remains one boring action even when localization exists
- the Builder session stays proportional to the real default product
- the implementation is small and boring enough that a human PM/dev can explain it in plain product terms without translating system abstractions
- there is no hidden parallel translation system fighting the main Builder flow
- dead Bob localization residue that would encourage the old model is removed
