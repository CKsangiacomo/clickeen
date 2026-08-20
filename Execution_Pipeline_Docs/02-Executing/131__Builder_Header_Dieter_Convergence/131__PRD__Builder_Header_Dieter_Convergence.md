# PRD 131 — Builder Header Dieter Convergence

Status: **LOCAL VISIBLE-SURFACE RHYTHM CORRECTION COMPLETE — CLOUD-DEV DEPLOYMENT AND OWNER VISUAL ACCEPTANCE PENDING**

Owner: Clickeen product owner/architect

Date: 2026-08-19

## 1. Outcome

The Roma builder-page publication header stops being a consumer-authored
shell (bordered white strip, `heading-4` chrome, invented receipt chip with a
timestamp) and becomes the design system's own header: the frozen Dieter
`page__header` part over the full-canvas Builder, with the publication state
as one neutral `diet-badge` word. No new Dieter code, no taxonomy change, no
timestamp on any screen.

## 2. Settled Owner Decisions

- The header is a flat, attached, full-bleed band: no border, no shadow, no
  radius; `--role-surface` tone against the muted shell canvas.
- The receipt is the state word only — `Published`, `Unpublished`, and
  `changes not live` as the sole modifier — in a neutral `diet-badge`. The
  publish timestamp is an AI artifact and is not displayed anywhere; stored
  `publishedAt` remains the divergence engine only.
- The widgets inventory rows do not render the receipt (verified), so the
  badge change affects the builder header alone.

## 3. Changes

- `roma/components/builder-domain.tsx`: the `roma-builder-header` div is
  replaced by `page__header` — `h1` instance label in the standard domain
  register (`heading-6`, matching every settings/domain header in the
  product), optional loading `p`, publication controls inside
  `page__actions`. An initial `heading-2` page-title register was shipped
  briefly and corrected to the domain register after owner review.
- `roma/app/roma.css`: every `.roma-builder-header` rule is deleted; one
  composition override block (`.roma-builder-page .page__header`) sets band
  alignment/padding/surface beside the page's existing full-bleed overrides;
  `.roma-widget-publication__receipt` deleted.
- `roma/components/widget-publication-controls.tsx`: the receipt becomes
  `diet-badge` (`data-tone="neutral"`, `label-xs`) carrying the state word;
  `toLocaleTimeString` display removed (repo sweep confirms no remaining
  publish-time display in roma/ or bob/).
- `roma/tests/run-widget-command-gates.ts`: the header-shape assertion moves
  from the retired local class name to the frozen part
  (`className="page__header"`).
- `documentation/services/bob.md`: the header exception names the frozen
  Dieter part.

## 4. Verification

- `pnpm typecheck` (15/15), `pnpm lint`, Roma `run-widget-command-gates` and
  `run-instance-save-boundary` PASS, `pnpm dieter:governance:check` PASS
  (taxonomy untouched).
- Cloud-dev deploy + live builder verification recorded in §5.
- Independent V1–V8 audit recorded in §5.

## 5. Reconciliation

```text
S0 evidence freeze: done (bob.md line verified; page__header contract pulled)
S1 page__header consumption: done
S2 receipt badge (timestamp deleted): done
S3 deploy/live verify/audit: done
commit: f0a15585 (header) + e2e spec follow-up
push: performed (main)
deploy: cloud-dev roma app verify + surface reachability PASS on f0a15585
live product: deployed chunks contain page__header + diet-badge + 'changes not live';
  roma-builder-header and toLocaleTimeString absent from served code; live API
  returns publishedAt facts
independent V1-V8 audit: PASS on all eight; one blocker found and fixed —
  e2e/widgets/builder-open.spec.ts pinned the retired classes and the
  header-absent assertion; updated to the frozen part (count-1 page__header,
  h1.heading-2, copy-code scoped to header.page__header)
owner visual acceptance: pending
```

## 6. Grammar Correction (2026-08-19, owner-directed)

The owner ruled the band's styling and layout out of grammar and invented.
Correction (commit 64d7a15f): the local override block shrinks to the single
forced-geometry line (`padding: var(--space-2) var(--layout-page-padding)` —
the page rhythm the full-canvas page zeroed); the part's alignment, canvas
treatment, margin, and width law stand untouched. Title is `h1.heading-2` per
every page header. Actions are buttons only at `large` (Update/Republish
primary, Copy code tertiary); badge and toggle return to the Widgets
inventory; receipt/badge code is deleted (no surface renders it). The shared
component gains `showToggle`/`controlSize` props with list-preserving
defaults. Checks: typecheck 15/15, lint, widget-command-gates PASS,
dieter governance PASS.

## 7. State Restored Beside The Name (2026-08-19, owner-directed)

The §6 strip over-reached: deleting the badge and toggle as "row kit" was a
functional removal inside a styling pass. The Builder lost its publication
status display, unpublish, and the only publish affordance for an
unpublished instance. `widget-command-gates` also shipped red on main — the
strip removed the pinned `Loading publication status…` header line, so §6's
gates-PASS claim was mistaken.

Owner ruling: the toggle and badge return, placed directly after the widget
name — state labels the named thing; `page__actions` stays verbs only.
Correction: `widget-publication-controls.tsx` exposes the shared status
machine through one local hook and two exports — `WidgetPublicationState`
(`diet-badge` status word + `diet-toggle` publish switch at `md`, rendered
beside the `h1` inside the existing `roma-page-heading` group) and
`WidgetPublicationControls` (buttons only; Widgets rows keep the `sm` toggle
via `showToggle`). The header regains its loading line, so the pinned gate
assertion passes again; the two `checked={published}` component pins follow
the hook's exact new shape (`checked={status.published}`). Zero new CSS; the
frozen part and its single padding line are untouched.

Verification: typecheck, lint, widget-command-gates 6/6 PASS, dieter
governance PASS. Commit b158b6dd pushed to main (no PR); roma-dev Pages
deploy success on b158b6dd. Live proof: local `build:cf` chunk
`6151-ca77a7338f9cb225.js` served live with `Loading publication status` +
`roma-page-heading`; chunk `9578-bf98418e8a5f3b2e.js` served live with
`changes not live`, `Unpublished`, `diet-badge`, `diet-toggle`,
`roma-widget-publication`, `Republish` — hash-identical to local build.
Independent V1-V8 audit: PASS on all eight; `changeStatus` byte-identical
to the pre-strip logic; Widgets-row DOM identical. One latent non-violation
noted (two mounted hook instances each own `pendingStatus`; a rapid
toggle+Republish interleave double-POSTs and fails visibly through Tokyo's
409 coordinator) — no machinery added absent an owner request.
Owner visual acceptance: pending.

## 8. Header Width Geometry (2026-08-19, owner-directed)

The owner ruled the header must share the width geometry of Bob's canvas
below it. It did not: the frozen part caps `.page__header` at a centered
`80rem` column (ordinary page law) while the builder page stretches
`.page__content` full-bleed for Bob — two stacked geometries on any viewport
wider than 80rem, with the header title inset ~140px while Bob's ToolDrawer
starts at 8px. Correction: the builder-page header override now joins Bob's
own geometry — `max-inline-size: none; margin-inline: 0; padding:
var(--space-2)` (the exact inline inset `.builder-app` gives itself). Type
law, alignment, and vertical rhythm are untouched; ordinary pages keep the
80rem column.

## 9. Width-Only Canvas Alignment (2026-08-19, owner-directed)

Owner visual review refined §8: the Builder header follows Bob's outer width
only. It remains full width (`max-inline-size: none; margin-inline: 0`) so the
header and editor form one stacked surface, but the header is Roma application
chrome and keeps Dieter's standard horizontal page inset. Bob's editor retains
its independent tighter workspace inset.

Correction: `.roma-builder-page .page__header` now uses `padding:
var(--space-2) var(--layout-page-padding)`. No header markup, title, publication
state, toggle, action, borrowed Save slot, Bob canvas, or product behavior
changes. This supersedes only §8's claim that the header must copy Bob's
`space-2` inline inset; §8's full-width decision remains in force.

## 10. One Roma Header Grammar (2026-08-19, owner-directed)

Owner visual review established that the remaining defect was systemic rather
than Builder-specific: Dieter's `page__header` top-aligned a heading line box
against taller page-action Buttons, while ordinary Roma and Builder authored
the leading header group separately. The resulting vertical center and DOM
grammar could drift even when their outer width was correct.

The correction makes Dieter the one structural authority:

```text
page__header[data-width="contained|full"]
├── page__heading
└── page__actions
```

- Desktop centers the two direct children on one cross-axis. Compact stacks
  and leading-aligns them.
- `contained` retains the centered `80rem` ordinary Page maximum. `full`
  removes that maximum and owns only the standard inline Page inset; width
  mode does not own block rhythm.
- One stateless Roma `RomaPageHeader` always renders both named children and
  owns `h1.heading-2`. Callers supply only the title, existing navigation
  trigger, existing filter/state content, existing actions, and the bounded
  width choice.
- Every ordinary Roma domain consumes `contained`; saved and New Builder
  consume `full`. Home remains intentionally headerless, Builder landing
  remains ordinary, and the Widget-detail route remains a redirect.
- Roma right-side Page commands use large Dieter Button geometry. The three
  Assets commands now follow that role; their types, words, order, handlers,
  loading labels, and disabled conditions are unchanged.
- Builder publication state/actions and Bob's borrowed Save presentation keep
  their exact existing owners, order, handlers, messages, and command paths.
  Bob remains headerless.
- The local `.roma-page-heading` and Builder `page__header` overrides are
  deleted. Builder full-canvas content and Bob's independent workspace inset
  remain.

The affected Dieter, Roma, DevStudio, browser-evidence, governance, current
manual, and generated reveal files are one implementation set. The completed
implementation and runtime evidence are recorded in §11.

## 11. Unified-Header Reconciliation

```text
implementation commit: 250c3cd3 (Unify Roma page headers)
push: main -> github/main
Roma Pages: production deployment 2f87e5eb on 250c3cd3 — success
DevStudio Pages: production deployment f2de52f5 on 250c3cd3 — success
cloud-dev Roma app verify: GitHub Actions run 32307620698 — success
cloud-dev Worker/product-root path: GitHub Actions run 32307620772 — worker
  binaries correctly skipped; required Tokyo product-root sync succeeded
live authenticated evidence: e2e/widgets/builder-open.spec.ts — 2/2 PASS
  - Builder header is full width and matches the editor canvas width
  - Builder heading/actions share a center line within one CSS pixel
  - User Settings uses the contained width and the same center-line law
  - Roma Compact navigation retains open, focus, Escape, and close behavior
independent V1-V8 audit: PASS on all eight; no remaining blocker
product data: unchanged
owner visual acceptance: pending
```

## 12. Width-Only Header Rhythm Correction (2026-08-19, owner-directed)

The first unified-header deployment exposed one remaining geometry mistake:
the `full` width selector still carried `--space-2` block padding while the
Builder Page removed all outer padding. That made width mode change vertical
rhythm and produced a 24px visual separation above Bob instead of the same
16px header/content separation used by ordinary Roma pages.

The local correction restores the simple ownership law:

- `page__header[data-width='full']` owns only full outer width and the standard
  `--layout-page-padding` inline inset. It has no block padding.
- `.roma-builder-page` retains the standard Page top inset while keeping zero
  Page inline and bottom padding, so Bob remains full canvas.
- the shared `page__header` `margin-block-end: var(--space-4)` is the one and
  only gap between every Roma header and the surface below it.
- contained headers, title and action composition, publication controls,
  borrowed Save presentation, navigation, Bob iframe geometry, and all command
  handlers are unchanged.

Source, contract, governance, generated DevStudio reveal, Roma regression
tests, and browser geometry assertions were updated together in commit
`843ef14c` and pushed directly to `main`. Roma app verification run
`32316847567`, the Worker/product-root run `32316847881`, and the affected
Cloudflare Pages production checks completed successfully. The authenticated
Builder test passed 2/2, but owner visual review then exposed the distinct
visible-surface defect recorded in §13: that test proved only the iframe
boundary and therefore did not constitute visual acceptance.

## 13. Visible Bob Surface Gap Correction (2026-08-19, owner-directed)

Cloud-dev visual review of §12 proved that its browser assertion stopped at the
iframe boundary rather than the surface the owner actually sees. The deployed
geometry was: Roma header bottom at 56px, iframe top at 72px, and Bob's
ToolDrawer and Workspace top at 80px. Roma correctly supplied the standard
16px separation, but Bob then added its own 8px top workspace inset, producing
a visible 24px gap. Ordinary Roma content began at 72px and therefore exposed
the mismatch.

The correction removes only Bob's outer top inset. Bob retains its independent
inline and bottom `space-2` insets, Roma continues to own the Builder Page top
inset and shared header margin, and the iframe geometry remains unchanged. The
visible ToolDrawer and Workspace now begin at the iframe top, so both ordinary
Roma content and Builder's visible editor surface start exactly 16px below the
shared header.

The authenticated browser regression now measures the ToolDrawer and Workspace
against the Roma header, in addition to the iframe, so it cannot mistake a
correct host boundary for correct visible rhythm again. No header content,
publication behavior, Save behavior, editor state, route, storage, or command
path changes.
