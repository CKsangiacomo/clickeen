# Widget Shared Manuals

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents the shared presentation frame, Shell components, and
generic Widget services/capabilities used by each Widget's own `widget.html`.

Use these manuals when changing Stage, Pod, Shell, Header, Core, shared runtime
files under `tokyo/product/widgets/shared/`, Roma's Publish materialization, or
a Core that consumes a shared capability.

Every applicable Widget uses a shared capability through the same contract.
Shared code never branches on Widget identity or interprets Widget meaning.
Publish produces complete meaningful HTML/CSS before JavaScript runs.
Mandatory Core JavaScript owns Widget behavior. Bob preview is an editing
concern and does not create a
second public runtime or change that package law.

Account limits and upsell presentation are product/editor policy, not shared
public Widget utilities. A Widget declares its policy binding and localized
denial context outside Core; Bob and Roma consume the compiled exact contract,
and Roma composes the system Popup. Nothing in this shared public package
selects tiers, opens upsells, or supplies fallback copy.

This is the canonical shared-service law. Big Bang, Cards, Countdown, FAQ, and
Logo Showcase implement it locally: initial Core content is materialized in
HTML and selected-locale content is expressed at the Edge before JavaScript.
Their retired flat clients have no compatibility path.

Files:

| Manual | Purpose |
| --- | --- |
| `ShellCore.md` | Presentation frame and Shell/Header/Core state ownership and DOM shape. |
| `ShellUtilities.md` | Branding, social share, locale switcher, and preview localization. |
