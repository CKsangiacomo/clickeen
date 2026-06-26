# 126I — Roma Refactor

**Parent:** 126 MAMA. **Depends on:** 126H (Dieter healthy + showcased). **Supersedes:** `UI_PRD__Roma_UI_Refactor.md`.

## Scope
Roma consumes the now-healthy Dieter. Verified baseline: Roma uses 0 Dieter form components; built a parallel 762-line `.roma-*` system in `roma.css`; 5 monolith domain files (pages 1106, builder 976, widget-defaults 718, widgets 527, assets 488); ~18 hardcoded inline-px values; leaked dev/stub copy ("Page publishing is unavailable…", etc.).

## Work
1. Build one small shared primitive layer on Dieter (`DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, `Toast`).
2. Replace the `.roma-*` parallel system with Dieter components + the primitives; delete the replaced CSS.
3. Break the 5 monoliths into subcomponents.
4. Map leaked dev/stub copy to real user copy; add loading/empty/error states on every screen.
5. Verify inline-px tokenized (guard owned by 126A/126H).

## Done when
Zero parallel `.roma-*` system; Dieter components + shared primitives used everywhere; monoliths split; no dev copy; every screen has the three states; visual parity (no redesign); Roma routes/save unchanged.

## Not in scope
Redesign. Token authoring. Backend / route changes.
