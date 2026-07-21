# 126M - Current-Source Pre-Execution Audit: Roma UI

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - Roma shell/navigation, current
fields, nine tables, Widget Defaults controls, Builder/dialog handoffs, and
deploy surfaces audited; exact PRD reviewed GREEN at `22a92ec9`; no Step-9
execution credit.

## Audit Result

Roma's account/product architecture is correct. Its remaining UI gaps are
bounded: replace the duplicate breakpoint-driven navigation path, adopt two
small Dieter visual contracts, and delete dead Widget Defaults controls. No
domain or backend rewrite is justified.

## Proven Current Inventory

- one persistent Roma navigation plus one duplicate inline `<details>` compact
  tree;
- a generic `980px` collapse that incorrectly includes tablets;
- nine `.roma-table` tables: Pages 4, Assets 2, Team 2, Widgets 1;
- ordinary text/select controls in Pages, Widgets, Team, Team Member, Profile,
  Settings, and Account Locale Settings;
- dead `.widget-defaults-fields`, `.widget-defaults-field*`,
  `.widget-defaults-input`, and `.widget-defaults-textarea` selectors;
- live `.widget-defaults-builder-fields` host composition;
- Bob workspace owned by 126J and all D1/D3 behavior owned by 126K.

## Deletion Map

- duplicate compact nav DOM/prop/CSS;
- dead `.roma-layout--focus`;
- generic `980px` branch;
- local field/table visual bases replaced by fixed 126I selectors;
- dead Widget Defaults hand-written control family;
- duplicated rename appearance only, preserving rename layout.

## Boundary

No API, account/session, policy, save, publish, translation, locale, storage,
public-runtime, Bob workspace, or DevStudio implementation changes. Large
domain files are not split for aesthetics.

## Evidence Needed At Step 9

- Roma lint/typecheck/Cloudflare build and widget-command gates;
- authenticated Roma shell/field/table tests;
- final Roma/Bob/DevStudio viewport matrix and D1/D3 regressions;
- final exact-SHA Pages reconciliation plus Dieter owning-commit ancestry,
  manifest, and artifact readback;
- living service/UI documentation reconciliation.
