# Widget Build Contract Planning Entry Point

STATUS: CURRENT MANUALS ARE AUTHORITATIVE

The executable build contract lives in:

- `documentation/widgets/authoring/WidgetFiles.md`
- `documentation/widgets/authoring/ToolDrawerControls.md`
- `documentation/widgets/authoring/WidgetAuthoringChecklist.md`
- `documentation/widgets/shared/ShellCore.md`
- `documentation/widgets/shared/ShellUtilities.md`

Every built widget has the exact six-file source contract under
`tokyo/product/widgets/{widgetType}/`. Bob compiles structured controls. Roma
materializes the exact account instance package. Tokyo-worker stores and serves
those submitted bytes. Existing saved packages do not change merely because
source changes; a product-authorized instance save or migration must write new
bytes.

Account defaults use:

```text
common
widgets.{widgetType}.core
```

`common` is default reuse across widget types, not Shell ownership. Saved
instance state stays flat. The removed `shell` defaults bucket is not a
compatibility alias.

There is no Page Composer compatibility target. Do not add composition
branches, page package output, or page-specific runtime state to a widget.
