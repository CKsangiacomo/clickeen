# DevStudio Audit — Findings (June 2026)

**Scope:** DevStudio (the `admin/` cockpit) audited across 3 lenses via subagents. Evidence-cited. Backs sub-PRDs 126H1 / 126H2 / 126H3.

## Lens 1 — Visual modernity (dated)
- Verbatim Apple iOS color palette, **no dark mode** anywhere (zero `prefers-color-scheme`/`data-theme`) — `dieter-color-tokens.css:29-135`.
- Dense 2010-style HTML tables for cockpit screens — `entitlements.html:20-55`, `llm-management.html:89-115`.
- No motion/states — plain "Loading…" text, zero skeletons, instant page swaps, unanimated modals.
- Cramped 13px body; text-only nav with faint active state; flat surfaces (shadow tokens unused); raw `#f4f5f7` tile bg; browser-default focus ring; flat status badges.

## Lens 2 — Presentation-layer CSS code (messy underneath)
- Two pages bypass shared CSS — `entitlements` (245-line) + `llm-management` (114-line) embedded `<style>` blocks mixing tokens + raw px/hex/`!important`.
- Two dead CSS subsystems — unused `.stack-*`/`.grid-*`/`.visually-hidden` utilities + `.component-masonry`/`.compiler-*`/`.bob-*` grid (~70 lines, zero refs).
- Magic numbers (`#f4f5f7`, `280px` ×3, `32px`); inline-style boilerplate ×43 baked into the renderer (`componentRenderer.ts:153,227`); two parallel row abstractions; a `!important` hack.
- BEM naming mostly clean; 633 lines CSS + ~375 lines embedded `<style>`.

## Lens 3 — Ops / governance (far from world-class)
- **No actor attribution** — commits land as bot identity (`dieter-tokens.js`, `policy-github.js`).
- **Direct-to-main, no gate** — governance/lint runs on PRs only; DevStudio writes straight to `main`, verified post-hoc.
- Color validation regex-only (rejects `oklch`/`color-mix`/var/8-digit hex, accepts destructive values).
- Client token cache goes stale across operators → stale diffs / false "unchanged".
- R2 sync fire-and-forget — no rollback, no orphan cleanup (upload-only; removed files linger).
- Cell writes: no confirmation, raw error-key conflicts, no cost-preview for billing tiers.
- `build-dieter` silently overwrites committed source SVGs (`svg_new/` → `svg/`), swallows errors.
- Two near-duplicate read-modify-write implementations.

## Sub-PRD split (decision)
3 DevStudio sub-PRDs, replacing the thin 126H "rollup": **126H1** Visual modernity, **126H2** CSS cleanup, **126H3** Ops & governance. All run now (independent of the Dieter component batches 126B–G).
