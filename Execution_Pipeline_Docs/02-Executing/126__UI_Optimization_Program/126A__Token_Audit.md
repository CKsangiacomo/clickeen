# 126A — Dieter Token Audit (Core)

**Parent:** 126 MAMA. **Depends on:** nothing (first step). **Batch:** tokens.

## Scope
Audit every Dieter token file: `dieter-color-tokens.css`, `dieter-foundation-tokens.css`, `dieter-typography.css`, `tokens.css`.

## Check
1. **No ghosts** — every token referenced is defined. Run a full `var()` vs definition diff across all token files + all consumers. (`--radius-3/4` already confirmed real.)
2. **Correct layering** — primitives carry concrete values (hex only on `--color-system-*`); semantic/role/state tokens compose via `var()`/`color-mix`, not raw values.
3. **Completeness** — every scale the components need exists; no missing rung.
4. **No drift** — no raw hex/px outside the primitive/root layer.

## Done when
- Token diff clean (no real ghosts).
- Layering confirmed across all files.
- A written token inventory exists (each scale + what each token does) so 126B–G can reference it.

## Not in scope
Component internals (126B–G). Redesigning or renaming tokens.
