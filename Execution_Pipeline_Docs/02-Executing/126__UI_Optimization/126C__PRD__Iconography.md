# 126C - PRD: Iconography

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree review green at
`b5efaefc`; no Step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md`.
Series order: 126C of 126A-126M.
Step-6 authority: `audits/126C__Audit__Iconography.md`.
Living doc: `documentation/engineering/UI/iconography.md`.

## Purpose

Keep Clickeen's one approved human-originated Dieter icon language and correct
the only proven current rendering drift: Prague cannot inherit Dieter
`currentColor` through an external `<img>`, and one Prague use sits outside the
approved numeric size ladder.

This PRD does not redesign icons, add icons, create a renderer platform, or
replay icon cleanup that is already in current source.

## Product Contract

1. `dieter/icons/icons.json` and `dieter/icons/svg/*` are the committed icon
   source pair.
2. New icons are human-originated through `tooling/sf-symbols`; agents consume
   the approved set and do not add, rename, reshape, or reinterpret it.
3. `scripts/build-dieter.js` verifies and propagates committed source to
   `tokyo/product/dieter/icons/**`; generated output is not source authority.
4. Runtime-specific delivery forms are valid when they preserve the one Dieter
   name/geometry authority: Bob inline geometry, Admin tooling imports, widget
   masks, and Prague public Tokyo URLs.
5. Dieter glyph sizes are `12`, `16`, `20`, `24`, `28`, `32`, `36`, and `40`.
6. Operational icons paint with `currentColor`; parent/control state owns hover,
   selected, pressed, and disabled appearance.
7. Decorative icons are hidden. Icon-only controls are named on the control.
   Meaningful standalone icons expose an explicit accessible name.
8. Account SVGs remain account assets and never become Dieter icons.

## Current Truth

The source, generated Tokyo artifacts, Bob adapter, Admin tooling adapter,
Prague name validation, widget static references, and living build path are
healthy. The Step-6 audit proves exact 157/157/157 parity and zero unknown
static references. Obsolete icon scripts and fake size aliases are already
gone.

Only these two mismatches remain:

- `prague/src/components/DieterIcon.astro` renders the Tokyo SVG as an external
  `<img>`, which cannot inherit its parent's `currentColor`.
- the same component defaults to `44`, and `StepsPrimitive.astro` explicitly
  requests `44`, outside the approved ladder.

## Step-9 Execution Slice C1 - Prague Dieter Rendering

This slice may begin only after every 126A-126M PRD is Step-8 green.

### Code changes

1. Edit `prague/src/components/DieterIcon.astro`:
   - keep `PUBLIC_TOKYO_URL` and the existing
     `/dieter/icons/svg/{name}.svg` coordinate;
   - replace the external `<img>` paint path with one CSS-mask element using
     that URL and `background-color: currentColor`;
   - set both `mask` and `-webkit-mask` to `center / contain no-repeat` so the
     approved glyph neither repeats nor changes its fit or alignment;
   - change the default glyph size from `44` to `40`;
   - preserve inline-block display plus explicit width and height;
   - keep untitled icons decorative with `aria-hidden="true"` and
     `role="presentation"`;
   - when `title` exists, expose `role="img"` and `aria-label={title}`; do not
     assume the former `<img alt>` semantics survive the element change;
   - do not fetch or inline SVG source and do not create another component.
2. Edit `prague/src/components/StepsPrimitive.astro`:
   - change the explicit Dieter size from `44` to `40`;
   - do not change the card layout, spacing, color, content, or interaction.
3. Edit `.github/workflows/cloud-dev-prague-app.yml`:
   - add `pnpm -C prague typecheck` before the existing Prague build;
   - do not add a new workflow, deploy command, or SHA helper. The GitHub Actions
     run already owns `head_sha`, and the existing Cloudflare Pages project read
     already returns `latest_deployment.commit_hash`.

### Documentation change

Update `documentation/engineering/UI/iconography.md` so the Prague lane states
that the public Tokyo SVG URL is painted through a CSS mask to preserve
`currentColor`, with numeric Dieter sizes only.

### No-touch boundary

Do not edit:

- the Dieter icon source pair or human origination tooling;
- generated Tokyo icon artifacts by hand;
- Bob, Admin/DevStudio, Roma, or widget code;
- Prague block content or account instance references;
- Cloudflare R2 objects, Supabase, account product data, or public widget data.

### Deletion rule

No 126C code deletion remains. The obsolete source-healing/generator paths are
already absent. Do not reintroduce them, preserve aliases for them, or add a
universal icon component/registry in their place.

## Ownership Boundaries

| Concern | Later owner |
| --- | --- |
| Dieter component slots, icon-only controls, and component semantics | 126I |
| DevStudio screen adoption | 126L |
| Roma operational-icon adoption | 126M |
| Public widget icon behavior | Each widget owner; no shared widget icon service |
| Account/customer SVGs | Account asset authority |

This routing prevents 126C from becoming a broad component or screen refactor
while ensuring no current lane is omitted.

## Verification

Local gates:

```text
pnpm -C prague typecheck
pnpm -C prague build
```

Then prove:

1. no Prague Dieter default or call site uses `44`;
2. the built component still uses the Tokyo Dieter SVG coordinate;
3. decorative output is hidden from accessibility APIs and titled output has
   the supplied accessible name;
4. desktop and mobile screenshots of the FAQ overview icon cards show inherited
   gray icons with no layout shift;
5. after commit and push, the successful `cloud-dev prague app verify` run has
   `head_sha` equal to the slice commit;
6. `pnpm cf:api:preflight` passes and
   `pnpm cf:pages:project prague-dev` reports
   `latest_deployment.commit_hash` equal to that same slice commit with a
   successful latest stage before public runtime evidence is accepted.

The slice does not touch Workers or R2 product roots, so Worker/R2 deploy proof
is neither required nor allowed as substitute evidence.

## V1-V8 Controls

| ID | Control |
| --- | --- |
| V1 | Keep the approved icon URL; do not substitute geometry or fallback icons. |
| V2 | Do not rewrite committed SVG source. |
| V3 | Change the exact Prague consumer and route component/screen adoption to its named owners. |
| V4 | Preserve existing manifest/name validation; do not fail open. |
| V5 | Invalid icon truth remains an error, never an empty accepted value. |
| V6 | Require rendered color, semantics, and exact-SHA deploy proof, not source parity alone. |
| V7 | Add no renderer service, registry, compatibility wrapper, or second icon language. |
| V8 | Tests observe output; runtime rendering does not depend on tests or probes. |

## Done

126C Step 9 is done only when the two-file Prague correction and living-doc
update are committed, locally green, deployed from that exact commit, visually
and semantically verified on Prague, and independently audited against V1-V8.

No icon-source, Bob, Admin, Roma, widget, product-data, R2, or Supabase change is
part of this PRD.
