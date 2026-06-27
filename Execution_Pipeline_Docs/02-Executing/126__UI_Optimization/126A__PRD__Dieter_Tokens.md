# 126A — Track PRD: Dieter Tokens

Status: DRAFT — DIRECTIONAL SKELETON (fill only after the Dieter audit)
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA)
Role: **Track 1 — the innermost doll.** Every layer above composes from these
tokens, so this track must be splendid and verified before any other track may
build on it.

## Precondition

Fill only after `audits/126A__Audit__Dieter_Tokens.md` exists: a complete
preserve-vs-fix read of **all token files and every consumer** (the interim
audit Phase 1 was a first pass, not the full reference).

## Seed findings (from the interim audit — to verify and recount on real code)

- **Preserve:** the token architecture — layering (primitive → semantic →
  state), scales, the `color-mix` ramp system.
- **Likely fix — undefined-token references at consumers (not token rewrites):**
  - `--color-surface` in `dieter/components/button/button.css` (→ `--role-surface`?)
  - `--color-bg` in `admin/src/css/layout.css` (→ `--role-surface-bg`?)
  - `--radius-2` in `dieter/components/bulk-edit/bulk-edit.css` (→ `--radius-3`?)
  - `--hspace-1/2/3/4` across ~8 components — leftover from an incomplete
    migration; migrate to the real `--space-*` scale.
- **NOT a fix:** `--radius-3` / `--radius-4` are **intentional aliases**
  (`dieter-foundation-tokens.css:60-62`, confirmed by the sanity-pass). Do not
  "kill" them — doing so is a visual regression (the ghost-token lesson).

## Sections to fill (from the audit)

- **Current state** — exact, recounted (token files, value counts, consumer map).
- **Target** — the splendid token system: complete, consistent, nothing
  undefined referenced, nothing dead, no duplicates.
- **Authority** — `dieter/tokens/*`; deployment via `build:dieter` → Tokyo R2.
- **Steps** — each with exact files, invariants, V1–V8, verification, Done.
- **SubPRDs** — e.g. `126A1 undefined-token sweep`, `126A2 hspace→space
  migration`, if the audit splits the work.
- **Verification** — commands + visual before/after (token changes reflect in
  product chrome).
- **Acceptance** — the splendid-bar for tokens (MAMA §10).

## Out of scope

- Redesigning the token system (preserve the architecture).
- Token authoring UI (DevStudio / 126C owns).
- Components (126B) and screens (126C/126D).
