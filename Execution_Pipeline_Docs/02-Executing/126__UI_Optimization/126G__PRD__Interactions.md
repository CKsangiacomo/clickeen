# 126G — PRD: Interactions

Status: DIRECTIONAL — fill after the interactions audit (`audits/126G__Audit__Interactions.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: `engineering/UI/` folder order; DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/interactions.md` (canonical reference; this PRD drives it).

## Role
Cross-cutting behavior — loading/empty/error states, command flows, and feedback. The patterns no single component owns.

## Precondition
Run the real interactions audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- States — loading / empty / error / success across screens (the audit found `home`/`ai`/`billing` have none today).
- Command flows — click-intent → result; the monetization pattern (click → HTTP 402 `UPGRADE_REQUIRED` → popup, per PRD 125).
- Feedback — toasts, inline validation, `agent-activity`, optimistic vs confirmed UI.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
