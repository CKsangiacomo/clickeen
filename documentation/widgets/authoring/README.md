# Widget Authoring Manuals

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents how widget source is authored, compiled, edited, and
verified.

Use these manuals for:

- the structured Widget contract and required English ToolDrawer-label folder;
- the Widget-owned, localized `upsell/en.json` message contract referenced by
  `limits.json`;
- the internal `discovery.json` declaration consumed only by Publish
  materialization;
- mandatory unique Core HTML/CSS/JavaScript;
- per-Widget document composition, shared capabilities, and Publish-time
  package materialization;
- Bob editor panel and ToolDrawer control authoring;
- Dieter control artifact mapping;
- widget execution checklists and verification gates.

Files:

| Manual | Purpose |
| --- | --- |
| `WidgetFiles.md` | Source files, compiled payloads, and saved package boundaries. |
| `ToolDrawerControls.md` | Structured `spec.json.editor.panels[]` authoring and Bob compiler behavior. |
| `WidgetAuthoringChecklist.md` | Required read order, authority gate, edit boundaries, and checks. |

The Core structure is the canonical authoring model for every built Widget.
Big Bang, Cards, Countdown, FAQ, and Logo Showcase all implement it in the
deployed cloud-dev product and compile through the same all-Widget generator.
Technical deployment, all-Widget artifact checks, and agent-executed shared
lifecycle/materialization/live-package verification pass. Owner acceptance is
not an architecture-closure gate. There is no flat-source compatibility
architecture.
