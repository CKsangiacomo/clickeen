# 126G — PRD: Ops

Status: DIRECTIONAL — fill after the ops audit (`audits/126G__Audit__Ops.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/ops.md` (canonical reference; this PRD drives it).

## Role
The UI runbook — how Dieter is built, served, versioned, and governed. "How the system runs" (distinct from 126H Dieter, "what the system is").

## Precondition
Run the real ops audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Build (`build:dieter` → Tokyo R2), the generators + their guards, serve (`/dieter`, edge proxy).
- Governance — the DevStudio reveal/steer loop, values-only token editor, the commit lane (Migration §3.5).
- Design-freeze hash baseline (Migration §3.6 / Appendix A).
- Governance gaps from the audit: no actor attribution, regex-only validation, fire-and-forget R2 sync, SVG overwrite.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
