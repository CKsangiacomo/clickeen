# New Dieter Lab

CSS-first sandbox to prototype Dieter component contracts and docs without touching the frozen `@ck/dieter` package.

## Getting started

```bash
pnpm install
pnpm dev      # start the vanilla docs shell
pnpm test     # run Vitest suite (jsdom)
pnpm build    # build production bundle
```

## Guardrails

- All work stays inside `lab/NewDieterLAB/`.
- Dieter assets under `dieter/` are read-only references; import via `@dieter/*` for parity only.
- Follow `documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md` and `documentation/systems/Dieter.md` before writing CSS. Mark anything undefined as `MISSING`.
- Commands should be one-shot and non-interactive; avoid actions that require approval when humans are away.
- Record assumptions or open questions in `DECISIONS.md` for later review.

## Legacy reference

Legacy Dieter demos remain available at `admin/dietercomponents.html` for parity checks (a quick link lives on the lab homepage).

