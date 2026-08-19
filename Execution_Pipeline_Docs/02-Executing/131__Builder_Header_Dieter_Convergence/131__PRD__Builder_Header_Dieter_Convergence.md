# PRD 131 — Builder Header Dieter Convergence

Status: **DEPLOYED AND VERIFIED IN CLOUD-DEV — OWNER VISUAL ACCEPTANCE PENDING**

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
