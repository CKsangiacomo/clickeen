# Widget Agent Planning Guide

STATUS: CURRENT MANUALS ARE AUTHORITATIVE

For any new or changed widget, follow this read order:

1. `documentation/architecture/CONTEXT.md`
2. `documentation/strategy/WhyClickeen.md`
3. `documentation/widgets/README.md`
4. `documentation/widgets/shared/ShellCore.md`
5. `documentation/widgets/shared/ShellUtilities.md`
6. `documentation/widgets/authoring/WidgetFiles.md`
7. `documentation/widgets/authoring/ToolDrawerControls.md`
8. `documentation/widgets/authoring/WidgetAuthoringChecklist.md`
9. the closest built-widget manual and source

Plan from product behavior, then name the state owner, editor control, runtime
binding, package effect, policy mapping, editable-field mapping, and focused
verification. Keep Stage/Pod, Shell/Header/Core, common defaults, and shared
implementation as distinct concepts.

Stop when the requested behavior lacks an existing product authority. Do not
invent a compatibility layer, a Page Composer branch, a second defaults scope,
or a widget-local copy of shared behavior.
