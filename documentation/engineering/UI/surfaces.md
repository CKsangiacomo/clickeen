# Surfaces — how DevStudio, Roma, and Bob consume Dieter

**Living, canonical reference — consumption.**
Seeded 2026-06-27 from the as-built code; improved in place as UI program 126 executes. One comparative doc (not per-screen) because the design-system truth at this layer **is** the bar-vs-reveal-vs-converge comparison.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- Track PRDs: `126C__PRD__DevStudio_UI.md`, `126D__PRD__Roma_UI.md`.

## Bob — the editor, the bar

Bob consumes Dieter properly and sets the standard Roma converges to:
- **Runtime CSS** — loads `tokens.css` + per-component CSS from `/dieter` CDN.
- **Asset proxy** — `bob/app/dieter/[...path]/route.ts` is an edge route proxying
  Tokyo static Dieter artifacts.
- **Compile** — `bob/lib/compiler/*` reads `/dieter/manifest.json` + component
  stencils to compile widget packages.
- **Real components across panes** — ToolDrawer (object-manager, segmented,
  repeater, bulk-edit, dropdown-edit), Workspace (button, segmented), TopDrawer /
  CopilotPane (btn-txt), TranslationsPanel (agent-activity, textfield).

Bob is the reference standard, not a track being rebuilt — it lives here as the bar.

## DevStudio (admin/) — Dieter's reveal + governance cockpit

DevStudio consumes Dieter on two axes:
- **Render** — component-preview pages render real Dieter components from CDN at
  scale (`diet-icon` ~1256×, `diet-dropdown-fill` ~519×, `diet-btn-ic` ~269×,
  `diet-textfield` ~129×, `diet-popover` ~126×, `diet-toggle` ~84×). 23 component
  pages under `admin/src/html/components/`.
- **Generate** — foundation pages (colors/icons/typography) are generated *from*
  Dieter token source (`generate-foundation-pages.mjs`); component pages are
  generated with real guards (`generate-component-pages.ts` throws on unresolved
  `{{...}}` stencils and on no-page components).

DevStudio is the "reveal Dieter truth, never masquerade" surface — see
[`ops.md`](ops.md) for the governance loop. Its *own* chrome is flagged dated by
the audit; 126C's job is to keep the reveal trustworthy, not to redesign the chrome.

## Roma (roma/) — tokens adopted, components essentially absent (the convergence target)

- **Tokens — fully adopted.** Loads `tokens.css` (`roma/app/layout.tsx`); `roma.css`
  is healthy (0 hex literals, ~140 `var()` uses).
- **Components — almost none.** Only `diet-btn-txt` (~160×) plus a few strays
  (`diet-btn-ic`, `diet-textedit`, `diet-dropdown-edit`, `diet-dropdown-actions`,
  `diet-choice-tiles`). `diet-textfield`/`toggle`/`segmented`/`popover` are absent.
- **Parallel system — present.** ~48 unique `.roma-*`/`.rd-*` classes (126 total
  selectors) in `roma/app/roma.css`, across all 14 domain screens. (Earlier
  "31 classes" / "0 components" counts are stale — re-counted; the core finding
  holds: parallel system dominates, components essentially absent.)

126D's job is to converge Roma onto Dieter + a shared primitive set and retire the
parallel system — see `126D__PRD__Roma_UI.md`.

## Honest note

The consumption counts above are a 2026-06-27 snapshot. They drift as code moves;
re-verify at the start of each track's audit rather than trusting these numbers.
