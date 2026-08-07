# Widget Architecture Planning Entry Point

STATUS: CURRENT MANUALS ARE AUTHORITATIVE

This planning entry point deliberately does not duplicate widget architecture.
Agents planning a widget must read the current operator manuals:

1. `documentation/widgets/README.md`
2. `documentation/widgets/shared/ShellCore.md`
3. `documentation/widgets/shared/ShellUtilities.md`
4. `documentation/widgets/authoring/WidgetFiles.md`
5. `documentation/widgets/authoring/ToolDrawerControls.md`
6. `documentation/widgets/authoring/WidgetAuthoringChecklist.md`
7. the exact built-widget manual under `documentation/widgets/widgets/`

The current structural model is:

```text
Stage
  Pod
    Shell
      Header
      Core
```

Shell means the Header/Core composition and nothing else. Stage and Pod are the
presentation frame. The Shell element carries widget/instance identity; there
is no separate Root product layer. Common account defaults, shared editor
controls, and reusable runtime modules are reuse/persistence concerns, not
Shell ownership.

The product runtime has widgets and account-owned widget instances. Account
Pages and Page Composer are not current or planned widget authorities. Prague
marketing pages remain repo-authored Prague content and do not change the
widget runtime contract.

Do not restore architecture from older PRDs or research notes. If a future
widget exposes a gap, update the current operator manual and owning runtime in
the same change.
