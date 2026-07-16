# 126C Step 6 - Current-Source Iconography Audit

Status: COMPLETE - exact current-source gap and deletion map recorded; Step 7
must schedule only the Prague rendering/size correction below.
Audited tree: `81b29a06`.
Audit date: 2026-07-15.

This is read-only pre-execution evidence. It gives no Step-9 implementation,
deploy, or product-data credit. The untracked `tokyo/product/fonts/` directory
was excluded from the audit and remains untouched.

## Product Truth

Clickeen has one approved human-originated Dieter icon set and several
runtime-appropriate delivery forms. Bob can render manifest geometry inline;
Admin can import raw SVGs for tooling; public widgets can use masks; Prague can
load Tokyo's public SVG URL. These are consumers of one authority, not separate
icon systems.

The current product defect is narrower: Prague loads a `currentColor` SVG through
an HTML `<img>`. An external image is its own document, so its `currentColor`
cannot inherit the surrounding Prague color. The source SVG is correct, but the
rendered icon does not obey the product color contract. Prague also renders one
Dieter glyph at `44px`, outside the approved `12, 16, 20, 24, 28, 32, 36, 40`
ladder.

## Proven Healthy Baseline

| Authority or consumer | Evidence | Result |
| --- | --- | --- |
| Source authority | `dieter/icons/icons.json`; `dieter/icons/svg/*` | 157 manifest names and 157 source SVGs; exact name parity. |
| Deploy output | `tokyo/product/dieter/icons/**` | 157 deployed SVGs; exact source/deploy name and byte parity. |
| Source color | `scripts/verify-svgs.js` | 157 SVGs pass explicit `currentColor`; no stroke warning. |
| Build | `scripts/build-dieter.js:255-303` | Verifies committed source, recreates generated Tokyo output, and does not mutate `dieter/icons/**`. Generated manifest provenance can change and is deploy output, not source mutation. |
| Bob | `bob/lib/icons.ts:8-19` | Missing names throw; emitted SVG uses `fill="currentColor"`, `aria-hidden`, and `focusable="false"`. |
| Admin/DevStudio | `admin/src/data/icons.ts:1-16`; `admin/src/main.ts:242-255` | Generated tooling lane; decorative semantics added; missing names remain visibly missing. |
| Prague names | `prague/src/lib/blockRegistry.ts:14-15,276-284,331-332,394-395` | Block icon names are validated against the Dieter manifest. |
| Static consumers | current-source scan across Bob, Dieter, Admin, Prague, and widgets | 1,826 static references; zero unknown approved-name references. |
| Legacy paths | repository scan | `scripts/process-svgs.js`, `dieter/scripts/build-icons.mjs`, and `dieter/icons/svg_new` are absent and have no active workflow/doc references. |

Commands run successfully during Step 6:

```text
pnpm build:dieter
node scripts/verify-svgs.js
pnpm --filter @clickeen/bob typecheck
```

The local build changed only generated `tokyo/product/dieter/manifest.json`
provenance. That test delta was removed after inspection; no source delta was
kept.

## Current Gaps

### C1 - Prague Cannot Inherit Dieter Color

- `prague/src/components/DieterIcon.astro:15-27` builds the approved Tokyo SVG
  URL and renders it as `<img style="... color: currentColor">`.
- CSS `color` on `<img>` does not enter the external SVG document.
- The surrounding Prague consumers set their intended color in
  `StepsPrimitive.astro:332-341`, `global-moat.astro:121-127`, and
  `subpage-cards.astro:155-161`, but the icon image cannot consume it.

Step-9 target: keep the same Tokyo URL and component boundary, but render the
URL through a CSS mask whose painted value is `currentColor`. Preserve width,
height, decorative behavior by default, and explicit accessible naming when a
title is supplied. Do not fetch SVGs, inline source geometry, create a registry,
or add a second Prague icon component.

### C2 - Unsupported 44px Glyph Size

- `prague/src/components/DieterIcon.astro:8` defaults to `44`.
- `prague/src/components/StepsPrimitive.astro:144` passes `44` explicitly.
- `global-moat.astro:61` and `subpage-cards.astro:75` already use approved `40`.

Step-9 target: make the Prague Dieter default `40` and change the one explicit
Steps use to `40`. This is glyph-size convergence, not a layout redesign.

## Ownership Routing

| Concern | Owner | 126C action |
| --- | --- | --- |
| Prague Dieter URL color delivery and the `44` size | 126C | Change in the one Prague slice. |
| Dieter component icon-slot semantics and component sizing | 126I | Audit there; no broad 126C component edits. |
| DevStudio screen adoption | 126L | No 126C UI refactor. |
| Roma operational-icon adoption | 126M | No Roma implementation in 126C. |
| Public widget icon behavior | Widget owners | Healthy baseline; no shared widget icon service. |
| Account/customer/admin SVG assets | Account asset authority | Explicit no-touch; never import them into Dieter. |

## Exact Change And Deletion Map

Step-9 candidate edits:

- `prague/src/components/DieterIcon.astro`
- `prague/src/components/StepsPrimitive.astro`
- `documentation/engineering/UI/iconography.md`

Regression-only reads, not candidate edits unless the exact-tree review proves a
new mismatch:

- `prague/src/blocks/global-moat/global-moat.astro`
- `prague/src/blocks/subpage-cards/subpage-cards.astro`
- `prague/src/lib/blockRegistry.ts`

No code-file deletion remains in 126C. The obsolete generators and mutation path
named by the historical audit are already deleted. Recreating them, adding
aliases, or adding a universal renderer would be legacy growth rather than
cleanup.

Explicit no-touch paths:

- `tooling/sf-symbols/**`
- `dieter/icons/**`
- `tokyo/product/dieter/icons/**`
- `bob/**`
- `admin/**`
- `roma/**`
- `tokyo/product/widgets/**`
- account product data, Cloudflare R2 objects, and Supabase

## Deploy And Verification Boundary

The code slice changes `prague/src/**`, so it triggers
`.github/workflows/cloud-dev-prague-app.yml` and the Git-connected Prague Pages
build. It does not change Tokyo product roots or Workers and requires no R2
mutation.

Green evidence for the eventual slice:

1. `pnpm -C prague typecheck` and `pnpm -C prague build` pass.
2. Static scan finds no Prague Dieter size `44`.
3. Prague build output still references the approved Tokyo Dieter SVG URL.
4. Desktop and mobile screenshots of the FAQ overview's icon cards show the
   intended inherited gray and no layout shift.
5. Keyboard/semantic inspection proves decorative instances stay hidden and a
   titled instance exposes its accessible name.
6. The `cloud-dev prague app verify` run and Cloudflare Pages deployment both
   report the exact slice commit SHA before public proof is accepted.

## V1-V8 Audit

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 | GREEN | No alternate icon or color is substituted; the approved URL remains the source. |
| V2 | GREEN | Source SVGs are neither rewritten nor normalized. |
| V3 | GREEN | All consumer lanes were inspected; later component/screen work is assigned explicitly. |
| V4 | GREEN | Unknown names continue to fail through their owning consumers. |
| V5 | GREEN | Invalid names do not become empty accepted product truth. |
| V6 | GREEN | Source parity is not presented as proof that Prague rendering is correct. |
| V7 | GREEN | No new wrapper, registry, or renamed parallel icon path is planned. |
| V8 | GREEN | Verification observes the product; normal icon rendering does not depend on a test or probe. |

## Step-6 Verdict

GREEN for Step 7. The exact current gap is proven and the executable scope is
finite. 126C is not Step-8 green until the exact Step-7 PRD tree receives three
independent reviews.
