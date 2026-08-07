# Widget Compliance Planning Entry Point

STATUS: CURRENT CHECKLIST IS AUTHORITATIVE

Run the current compliance sequence in:

```text
documentation/widgets/authoring/WidgetAuthoringChecklist.md
```

That checklist owns the source, control, state, DOM, runtime, package, and
verification gates. The exact built-widget manual owns widget-specific paths
and invariants. `documentation/widgets/shared/ShellCore.md` owns the current
frame/Shell/common-default distinction.

Legacy planning references to a “Step 8 battery” mean the Verification section
of the current checklist. Legacy references to Prague-page work mean only the
repo-authored marketing content governed by
`documentation/services/prague/PraguePageAgentGuide.md`; they do not authorize
Account Pages or Page Composer code.

Widget source must not own SEO schema or account-page composition. SEO/GEO/AEO
work remains with its named capability authority, and Prague content remains
with Prague.
