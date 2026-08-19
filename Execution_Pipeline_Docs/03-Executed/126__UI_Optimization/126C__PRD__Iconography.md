# 126C - PRD: Iconography

Status: STEP 9 COMPLETE - C1 GREEN.

Post-126G delivery note: icon authoring remains the manual
`tooling/sf-symbols/**` lane. References below to `scripts/build-dieter.js` or
`tokyo/product/dieter/**` describe the historical execution environment. The
committed SVG source is now deployed directly to R2.
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
3. The Tokyo product-root sync deploys committed
   `dieter/icons/svg/**` directly to R2 `dieter/icons/svg/**`. The registry
   remains source/compile-time data and is not deployed.
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

The Step-6 audit found these two mismatches:

- `prague/src/components/DieterIcon.astro` renders the Tokyo SVG as an external
  `<img>`, which cannot inherit its parent's `currentColor`.
- the same component defaults to `44`, and `StepsPrimitive.astro` explicitly
  requests `44`, outside the approved ladder.

Slice C1 corrected both mismatches. The execution record below owns the proof.

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
   - delete the unused `title` prop and branch. No current Prague call site
     supplies it, and every current use is decorative inside an already-named
     card, link, or section;
   - keep every current icon decorative with `aria-hidden="true"` and
     `role="presentation"`. A meaningful standalone icon requires a real
     product use and an explicit future consumer contract, not scaffolding here;
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

### Proof artifacts

Add `e2e/prague/126c-iconography.spec.ts` as the focused source and public
runtime proof. It must:

- statically prove `DieterIcon` has no `44` default and no Prague call site
  passes `size={44}`;
- load `https://prague.dev.clickeen.com/us/en/widgets/faq/` without auth;
- prove the three FAQ subpage-card glyphs remain 40 by 40, use the existing
  Tokyo Dieter SVG URLs as centered/contained/non-repeating CSS masks, inherit
  `rgb(112, 112, 117)` through `currentColor`, and remain decorative outside
  the accessibility tree;
- allow only read requests and assert zero non-read requests.

Preserve visual evidence under `evidence/126C.1/`:

- `before-desktop.png` and `after-desktop.png` at 1440 by 1100;
- `before-mobile.png` and `after-mobile.png` at 390 by 844;
- `before-geometry.json` and `after-geometry.json` recording the three card and
  icon bounding boxes at both viewports.

Before/after geometry must match. The intended paint change is external-image
black to inherited Dieter gray; card layout and icon dimensions do not move.

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
3. decorative output is hidden from accessibility APIs and the component has
   no speculative meaningful-icon branch;
4. desktop and mobile screenshots of the FAQ overview icon cards show inherited
   gray icons, and before/after geometry evidence proves no layout shift;
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

## Step-9 Execution Record

Status on 2026-07-26: **C1 GREEN; 126C complete.**

- The product implementation landed in `2a71da65`. Prague now paints the
  existing Tokyo Dieter SVG coordinate through one `currentColor` CSS mask,
  uses the approved `40px` size, and keeps the three current uses decorative.
  The focused test, Prague workflow typecheck, and living iconography doctrine
  landed with the same change.
- `pnpm -C prague typecheck` completed with zero errors, `pnpm -C prague build`
  passed, and `cloud-dev prague app verify` run `30074306448` passed for the
  implementation SHA. The current focused Playwright proof passes 2/2 against
  public Prague.
- Cloudflare initially skipped the implementation deployment with
  `skip_reason: path_config`; live Prague correctly remained red and no
  completion credit was claimed. Empty Git commit `475c829d` retriggered the
  existing Git-connected Pages build without changing product source or
  Cloudflare configuration.
- Cloudflare Pages production deployment
  `66502f7e-b78a-4061-b413-f414b08620d4` completed every stage successfully at
  exact SHA `475c829d1cf167be1a88631d949f964487238078`. The four 126C
  implementation/proof source files remained unchanged from `2a71da65`.
- Live evidence is preserved under `evidence/126C.1/`. Desktop `1440x1100` and
  mobile `390x844` captures show the inherited gray Dieter masks. Every
  before/after tile, icon-container, and glyph `x`, `y`, `width`, and `height`
  delta is exactly zero. Both captures observed zero non-read requests.
- The independent post-deploy audit found no product, code, architecture, or
  no-touch-boundary drift. V1-V8 all pass. No Dieter icon source, Bob, Roma,
  DevStudio, widget, account data, R2, Supabase, or translation behavior
  changed.

## Done

126C Step 9 is done only when the Prague correction, workflow check, living-doc
update, and focused proof are committed, locally green, deployed from that
exact commit, visually and semantically verified on Prague, and independently
audited against V1-V8.

No icon-source, Bob, Admin, Roma, widget, product-data, R2, or Supabase change is
part of this PRD.
