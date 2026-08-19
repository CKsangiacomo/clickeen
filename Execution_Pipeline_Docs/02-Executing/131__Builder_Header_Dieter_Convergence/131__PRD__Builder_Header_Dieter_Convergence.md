# PRD 131 — Builder Header Dieter Convergence

Status: **EXECUTING — S1/S2 IMPLEMENTED LOCALLY; DEPLOY AND LIVE VERIFICATION IN PROGRESS**

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
  replaced by `page__header` — `h1.heading-2` instance label, optional
  loading `p`, publication controls inside `page__actions`.
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
S1 page__header consumption: implemented locally
S2 receipt badge: implemented locally
S3 deploy/live verify/audit: in progress
commit: pending
push: pending
deploy: pending
live product: unchanged
```
