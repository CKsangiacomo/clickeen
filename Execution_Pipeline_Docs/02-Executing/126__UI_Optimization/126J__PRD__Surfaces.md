# 126J - PRD: Surfaces And Bob Workspace

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree three-lens review GREEN at
`22a92ec9`; no Step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit: `audits/126J__Audit__Surfaces.md`.
Living doctrine: `documentation/engineering/UI/surfaces.md`.

## Purpose

Keep Clickeen's surface vocabulary simple and make Bob obey the accepted global
workspace-capability law. This PRD owns Bob because there is no later Bob screen
PRD. DevStudio and Roma retain their own shell execution in 126L and 126M.

126J does not build a surface component, shell framework, device registry, or
mobile product variant.

## Authority Map

| Concern | Authority |
| --- | --- |
| Surface vocabulary and workspace law | `documentation/engineering/UI/surfaces.md` |
| Reusable tokens and controls | Dieter |
| Bob editor composition | Bob |
| Roma account shell | 126M / Roma |
| DevStudio cockpit shell | 126L / DevStudio |
| Dialog lifecycle and viewport fit | 126K, then each owning consumer |
| Widget output inside Bob's iframe | Widget runtime, unchanged |

## Product Contract

Surface composition remains:

```text
surface primitives -> layouts -> screens/pages
```

The vocabulary is already settled: navigation plane, header/action band,
canvas/work area, module/section, item/card, table/list, inspector/tool,
preview, and overlay/dialog. The app background is a backdrop. Stacks, grids,
toolbars, and action rows are layout helpers rather than surfaces.

Operational workspace behavior is:

| Mode | Product behavior |
| --- | --- |
| Full | Persistent narrow navigation or ToolDrawer beside a flexible work area. |
| Compact | A menu/tool button opens the same navigation or ToolDrawer as an overlay drawer; the work area uses the viewport. |
| Unsupported portrait | A clear `Rotate your device or use a larger screen` boundary replaces the unusable editor/dashboard composition. |

Desktop and tablets in both orientations use Full mode when the usable
workspace fits. Mobile landscape uses Compact mode. Mobile portrait receives
the unsupported boundary. Routes, domains, actions, controls, tables, editing
operations, and information architecture do not change between supported
modes.

Resolution affects sharpness. CSS workspace geometry affects composition.
Form-factor signals are used only to distinguish the unsupported mobile
portrait boundary. No user-agent sniffing is allowed.

## Deterministic Workspace Classification

Each app implements the same law locally with CSS media features; no shared
runtime classifier is added.

The frozen geometry is:

- Full is the default when usable inline and block size are each at least
  `600px`.
- Compact applies when usable inline size or block size is below `600px`.
- Unsupported portrait overrides Compact only when the primary pointer is
  coarse, orientation is portrait, and usable inline size is below `600px`.
- `600px` is a workspace-fit boundary: it accommodates the narrow navigation or
  Bob ToolDrawer plus a viable work area. It is not a hardware-resolution or
  device-name breakpoint.
- Dynamic viewport units and safe-area insets are used so browser chrome and
  notches do not hide controls.
- Mode changes respond to resize/orientation without reload.

Representative acceptance viewports are `1440x900`, `768x1024`, `1024x768`,
`844x390`, and `390x844`. These are proof fixtures, not a device registry.

## Current Source Truth

- Bob renders a fixed `340px 1fr` ToolDrawer/workspace grid.
- `BuilderApp` always renders ToolDrawer and Workspace side by side.
- Bob has no compact ToolDrawer opener, drawer state, close command, or mobile
  portrait boundary.
- Bob uses `100vh` and has no safe-area handling.
- Roma's current `<980px` inline `<details>` path is owned and deleted by 126M.
- DevStudio's current unwired `<960px` sidebar path is owned and deleted by
  126L.
- The living surface doctrine is already correct. 126J does not rewrite it
  unless execution exposes a concrete mismatch.

## Execution Slices

### J1 - Bob Full, Compact, And Unsupported Modes

1. `BuilderApp` owns one boolean compact ToolDrawer state.
2. `TopDrawer` renders an icon button only in Compact mode. It carries an
   accessible name, `aria-expanded`, and `aria-controls` for the ToolDrawer.
3. `ToolDrawer` receives its stable id and compact open/close state. It renders
   one compact close command and preserves every current panel and field.
4. Opening moves focus into the ToolDrawer. Closing by its explicit command,
   Escape, or selecting the already-current work area returns focus to the
   opener. Backdrop click closes because no unsaved work is owned by the drawer
   itself; open component dialogs continue to follow 126K.
5. Full mode preserves the existing `340px | flexible workspace` composition.
6. Compact mode overlays the ToolDrawer and gives Workspace the full content
   area. It does not unmount or reset the current panel.
7. Unsupported mobile portrait shows only the orientation/size boundary; it
   does not silently omit or rearrange editor operations.
8. Replace `100vh` with dynamic viewport sizing and include safe-area padding.

Green gate:

- Full mode remains unchanged at desktop and both tablet fixtures.
- Compact mode exposes every ToolDrawer panel and keeps the preview nonblank.
- Orientation changes preserve the current widget session and panel.
- No save, preview-device, translation, account, or widget-runtime behavior is
  changed.

### J2 - Bob Proof And Documentation Reconciliation

1. Add focused Playwright coverage through authenticated Roma Builder so the
   real hosted Bob iframe is exercised.
2. Prove pointer and keyboard open/close, focus return, no overlap, no clipped
   primary actions, and a nonblank preview.
3. Capture screenshots at all five representative viewports plus portrait to
   landscape orientation change.
4. Update `documentation/services/bob.md` and only correct
   `documentation/engineering/UI/surfaces.md` if runtime execution exposes a
   mismatch.
5. Verify Git-connected `bob-dev` and Roma Pages deployments at the same source
   SHA before deployed-browser proof.

## Exact Blast Radius

### Edit

| File | Change |
| --- | --- |
| `bob/components/BuilderApp.tsx` | Own compact ToolDrawer state and render the unsupported boundary. |
| `bob/components/TopDrawer.tsx` | Add the compact ToolDrawer icon button. |
| `bob/components/ToolDrawer.tsx` | Add stable drawer id, compact close action, and focus contract. |
| `bob/app/bob_app.css` | Add Full/Compact/unsupported composition, dynamic viewport sizing, safe areas, and overlay drawer styling. |
| `bob/app/layout.tsx` | Declare viewport-fit support required by safe-area rendering. |
| `documentation/services/bob.md` | Record the delivered Bob workspace behavior. |

### Add

- `e2e/widgets/bob-workspace-capability.spec.ts`.

### Delete

- No Bob source file.
- Delete obsolete fixed-only CSS declarations only where the same selectors are
  replaced in `bob/app/bob_app.css`; do not retain parallel old/new branches.

### Do Not Touch

- `bob/components/Workspace.tsx` preview-device behavior;
- Bob save/session/translation contracts;
- Roma account routes, Tokyo, R2, Supabase, and widget runtime source;
- Roma and DevStudio shell code owned by 126M and 126L.

## Verification

```bash
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob build
E2E_BASE_URL=https://roma.dev.clickeen.com pnpm exec playwright test e2e/widgets/bob-workspace-capability.spec.ts
```

Browser evidence must cover:

| Viewport | Expected |
| --- | --- |
| `1440x900` | Full ToolDrawer and workspace. |
| `768x1024` | Full tablet portrait workspace, touch-operable. |
| `1024x768` | Full tablet landscape workspace. |
| `844x390` | Compact ToolDrawer drawer and full preview. |
| `390x844` | Unsupported portrait boundary. |

Deploy evidence: `bob-dev` and Roma Pages builds at the exact source SHA. No
Worker, R2, Supabase, or product-data operation belongs to 126J.

## Handoffs

- 126K makes dialogs fit the usable viewport and owns blocking-dialog
  lifecycle. A blocking dialog opened from the ToolDrawer outranks drawer
  dismissal.
- 126L applies the same classification to DevStudio and deletes its unwired
  `960px` path.
- 126M applies the same classification to Roma and deletes its inline
  `<details>`/`980px` path.
- Final cross-app D2 certification occurs after 126M; 126J closes only Bob's
  focused slice.

## Non-Scope

- Shared shell or responsive framework.
- Generic Surface component or renamed class taxonomy.
- User-agent/device registry.
- Separate tablet/mobile screens.
- Table-to-card rewrites.
- Product route, persistence, translation, or public-widget changes.

## V1-V8 Pre-Execution Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | No device or runtime truth is invented; classification uses explicit CSS geometry. |
| V2 | PASS | No persisted state is normalized or rewritten. |
| V3 | OPEN UNTIL STEP 9 | Full, Compact, portrait boundary, orientation change, focus, preview, docs, and both Pages surfaces require proof. |
| V4 | OPEN UNTIL STEP 9 | Compact navigation and unsupported portrait must remain explicit and operable. |
| V5 | PASS | No stored product data is read or mutated. |
| V6 | OPEN UNTIL STEP 9 | Local tests without Bob/ Roma deployed proof cannot claim completion. |
| V7 | OPEN UNTIL STEP 9 | Fixed-only behavior must be replaced, not wrapped by a second shell. |
| V8 | PASS | Runtime CSS and controls own behavior; tests only verify it. |
