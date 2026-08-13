# DevStudio - Human Cockpit For The AI-Operated Company

STATUS: CURRENT SYSTEM OPERATOR SPEC

DevStudio is the Cloudflare Pages cockpit where the one human governs the AI-operated company. It shows rendered/source-controlled truth and allows steering only through named Pages Functions that validate input and commit to `main`.

DevStudio is not Roma, not Bob, not a customer account shell, and not a general admin bypass. The signed-in human must resolve through Berlin to the normal Clickeen admin account:

```text
accountPublicId: CLICKEEN
```

## Runtime Authority

| Concern | Current authority |
| --- | --- |
| App source | `admin/` |
| Cloudflare Pages project | `devstudio` |
| Canonical host | `https://devstudio.clickeen.com` |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output | `admin/dist` |
| Auth/session | Berlin login + DevStudio Pages session finish route |
| Write path | Pages Functions under `admin/functions/**` |
| Commit branch | `DEVSTUDIO_GITHUB_REPOSITORY` + `DEVSTUDIO_GITHUB_BRANCH` |

Non-canonical Pages origins redirect or block through `admin/functions/_middleware.js` unless Cloudflare project health behavior requires otherwise.

## Workspace Capability

DevStudio follows the global operational-workspace tenet in
`documentation/engineering/UI/surfaces.md`: full desktop workspace on desktop
and tablets in either orientation, with the same compact drawer navigation on
narrow mobile landscape and portrait. Retina/4K density governs sharpness, not
layout class. DevStudio consumes Dieter's
`main-container > left-nav + page` source directly. Its four layout values are
source tokens rather than DevStudio shell constants. The shell uses the shared
`600px` usable-width-and-height capability boundary, dynamic viewport units,
and safe areas. The Full navigation is an 8px-inset foreground panel; Compact
uses that same panel as an 8px-inset overlay above the full-width page. Reveal
and policy pages are not rebuilt as mobile variants. The shared navigation is
`16rem` wide, uses the shared surface without a border, and has the Dieter
`3xl` radius and floating shadow. Page headers and route content align to the
same centered `80rem` maximum width. DevStudio uses the Dieter Page rhythm
directly. Its navigation rows use `--control-size-lg`; brand-to-navigation and
navigation-group separation use `--space-4` and `--space-3`. Source-derived
previews use one token-owned compact composition: generic preview height uses
`--control-size-md`, component rows have one CSS spacing owner, and generated
markup carries no inline vertical margin. DevStudio does not introduce a
density scale.

## Token Editor Dialog

The token editor follows accepted D1 dismissal law. Escape closes only when the
editor is unchanged. Dirty dismissal opens discard confirmation, backdrop
dismissal is disabled, Cancel follows the same dirty rule, and Confirm Commit
persists through the existing validated write lane. Native `beforeunload`, where
needed at the browser boundary, is not replaced by an in-product dialog helper.
The editor uses the shared native-dialog lifecycle while keeping token state and
source commit behavior in DevStudio. Token selection uses Dieter Dropdown
Actions and token value editing uses Dieter Textfield; every action uses the
Dieter button contract loaded by the DevStudio shell. The work body and dirty-discard
body are mutually exclusive states in the same native dialog; they never stack.
Token fields remain disabled until source truth loads, and every editor and
dismissal control remains disabled while a commit is in flight.

The editor has three source-file lanes: foundation, color, and typography.
Foundation edits are exposed from the generated Core styles and Layouts pages
and commit only recognized spacing, layout, control geometry, radius, shadow,
duration, and easing tokens in `dieter-foundation-tokens.css`. Each page scopes
the editor dropdown to the tokens visible on that page. The validation contract
used to generate editable rows is the same contract enforced by the Pages
Function. Samples are decorative. Core styles, Colors, and Layouts expose
token-owned row actions. Typography exposes one page-level token action because
its source tokens are shared by multiple visual classes; its class rows remain
reveal and preview truth rather than pretending each class owns a private token.
Typography values are submitted exactly as entered. Invalid values are rejected
without trimming, normalization, substitution, or a Git commit.

## Current Sections

| Section | Runtime source |
| --- | --- |
| Foundations: Core styles, Colors, Icons, Typography, Layouts | Generated from Dieter token, icon, and layout source through DevStudio static page generation. Core styles groups 53 non-layout foundation tokens. Layouts maps the three current layout families: the Roma/DevStudio application shell, Bob editor, and public Widget composition. It shows exact class taxonomy, owners, consumers, source paths, and the four editable application-layout properties. |
| Dieter Components | Generated/static component showcase pages from Dieter component specs and snippets. |
| Entitlements | Pages Functions read/write entitlement policy files through GitHub. The same tool also renders AI runtime policy editing backed by `/api/ai-runtime/*`. |
| LLM Management | Read-only generated visibility into managed model configuration. It is not a runtime API-backed editor. The existing per-agent, per-tier AI runtime matrix (`packages/ck-policy/ai-runtime.matrix.json`) remains the model/token/timeout/turn-policy authority. Product Copilot preserves the existing 8/16/30/50 `maxTurnsPerThread` tier values, now applied to model steps in Bob's open Copilot thread. Translation Agent preserves one governed model call per chunk (`maxTurnsPerThread: 1`). The tier turn value is enforced in Bob's CopilotPane, which refuses continuation past the limit and terminates visibly as incomplete. |

Foundation and Policy Editor tables use Dieter Table. DevStudio still owns
their columns, editable cells, data, and mutation behavior. The token editor
uses Dieter Popup while retaining DevStudio's source-write workflow and
dismissal state.

DevStudio operational text uses only the complete classes shown on its
Typography route. Page titles use `heading-2`, section titles use `heading-4`,
Table column headers use `label-s`, and all Table body cells use `body-s`.
Token names, source values, policy values, IDs, and model names do not receive a
separate monospace treatment. DevStudio does not restate Table typography,
header, row, cell, border, or overflow presentation locally.

Hash routes are generated from `admin/src/html/**` and route data in
`admin/src/data/routes.ts`. There is no separate design-system admin app. The
current generated inventory is 5 Foundation routes, 24 Dieter Component routes,
and 2 Policy routes. CSS-only Dieter contracts do not create empty showcase
routes.

The Agent Activity route is generated from its real Dieter spec, stencil, and
CSS. It reveals both supported sizes with the actual multi-row contract and
active presentation; it does not maintain a DevStudio-only imitation.

The generated Menuactions route reveals the one real unbound action-row
contract at `sm|md|lg`: caller label only, caller label with one trailing
Dieter Icon, and disabled. It does not expose the removed fake primary or
AI-specific variants and does not maintain DevStudio-only Menuactions styling.

The generated Popover and Dropdown Border, Edit, Fill, and Shadow routes expose
the same `row`, `wide`, and `extra-wide` Popover-width contract used by Dieter
source.
Their open examples show the unchanged left edge and the exact 40px/80px
rightward extensions; DevStudio does not reimplement that geometry. Border,
Fill, and Shadow reveal their global `wide` default and two-row palettes; Edit
reveals its `extra-wide` default.
Dropdown Fill exposes one real open editor where color, gradient, image, and
video can be exercised through its Enabled control and the existing icon-only
Segmented mode selector, in addition to its `sm|md|lg` closed rows.
Its open medium reveal uses the product-default `wide` Popover, compact color
canvas, full-width Slider tracks, trailing opacity value, one Hex row, and the
two-row palette. The page therefore reveals the exact system geometry and
caller-copy inputs without overlapping permanent Popovers, a DevStudio-only
imitation, or an account-specific branch.
Dropdown Upload reveals the real `sm|md|lg` empty property rows and one open
selected-file example. Its local showcase account-assets client resolves that
example and can preview a file selected during the local demonstration; it
does not call Roma, write account storage, or represent product data.
These routes retain Dieter's consumer-neutral `data-dieter-json` marker in
their generated examples. Before hash navigation replaces the reveal,
DevStudio destroys hydrated Dropdown Actions, Border, Edit, Fill, Shadow, and Upload roots
through the same exported component lifecycle used by product hosts.

## Pages Functions

| Route | Purpose |
| --- | --- |
| `GET /api/entitlements/matrix` | Read committed entitlement matrix. |
| `POST /api/entitlements/matrix/cell` | Validate and commit one entitlement matrix edit. |
| `GET /api/ai-runtime/matrix` | Read committed AI runtime policy matrix. |
| `POST /api/ai-runtime/matrix/cell` | Validate and commit one AI runtime policy edit. |
| `GET /api/session/login/google` | Start Berlin login for DevStudio. |
| `GET /api/session/finish` | Redeem Berlin finish transaction and set DevStudio session cookie. |
| `GET /api/dieter/tokens/colors` | Read source-controlled Dieter color tokens. |
| `POST /api/dieter/tokens/colors/value` | Validate and commit one Dieter color token edit. |
| `GET /api/dieter/tokens/foundation` | Read recognized source-controlled Dieter foundation tokens. |
| `POST /api/dieter/tokens/foundation/value` | Validate and commit one recognized Dieter foundation token edit. |
| `GET /api/dieter/tokens/typography` | Read source-controlled Dieter typography tokens. |
| `POST /api/dieter/tokens/typography/value` | Validate and commit one Dieter typography token edit. |

Every write uses GitHub SHA conflict checks. A stale write fails; it does not overwrite current `main`.

## Core Styles Reveal And Write Truth

The Core styles page is generated directly from
`dieter/tokens/dieter-foundation-tokens.css`. It exposes these existing source
families in one route:

- structural and vertical spacing;
- control sizes, inline padding, and inline gaps;
- control radii;
- shared shadows;
- motion durations and easing.

Layout properties are intentionally absent from Core styles. The Layouts page
owns their reveal and editing context. Neither page stores overrides or
introduces another token file. Editable rows, source parsing, and POST
validation share one token contract. Foundation writes reject duplicate live
declarations, negative geometry, unresolved, self-referential, or cyclic token
references, invalid easing bounds, unknown shadow color references, unsafe CSS
syntax, and unsupported value shapes. A rejected value never reaches the
GitHub commit operation.

## Color Reveal And Write Truth

DevStudio reveals Dieter color source truth. Current color writes are intentionally
narrow: only `--color-*` tokens with literal three- or six-digit hex values are
editable through the color token write lane.

The five shared role rows plus focus, state, and derived `color-mix(...)` rows
are displayed as read-only truth. They are not hidden, but they do not
masquerade as writable DevStudio controls.

## Icon Reveal Truth

DevStudio/Admin uses generated raw Dieter SVG imports for tooling and reveal.
The generator enumerates `dieter/icons/svg/**` directly. That path is not a
product runtime icon system, registry, approval gate, or second icon authority.

## Auth And Safety Gates

DevStudio APIs stop on:

- missing Berlin config or invalid Berlin session
- account not equal to `CLICKEEN`
- role not `owner` or `admin`
- invalid POST origin
- invalid persisted policy or token file
- GitHub read/write failure
- GitHub SHA conflict

Cloudflare Access is not the DevStudio auth boundary.

## Environment

Configured in `admin/wrangler.toml` and Cloudflare Pages:

| Name | Purpose |
| --- | --- |
| `BERLIN_BASE_URL` | Berlin session/finish verification. |
| `DEVSTUDIO_CANONICAL_ORIGIN` | Canonical host enforcement. |
| `DEVSTUDIO_GITHUB_BRANCH` | Commit branch, currently `main`. |
| `DEVSTUDIO_GITHUB_REPOSITORY` | Repository for source-controlled writes. |
| `ENV_STAGE` | Runtime stage label. |
| `DEVSTUDIO_GITHUB_TOKEN` | Pages secret for GitHub contents reads/writes. |

Cloudflare API commands require root `.env.local` values:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_REST_API_TOKEN
```

`DEVSTUDIO_GITHUB_TOKEN` is required when syncing DevStudio Pages env/secrets or
when DevStudio runtime Pages Functions read/write repository contents. General
Cloudflare project/domain reads do not require it.

Do not document secret values.

## Build And Verification

DevStudio generation:

```bash
pnpm --filter @clickeen/devstudio generate
```

Build/checks:

```bash
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/devstudio check:functions
```

Cloudflare Pages verification:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project devstudio
pnpm cf:pages:devstudio-env
```

Runtime evidence:

```text
https://devstudio.clickeen.com
```

Use Berlin-authenticated browser evidence for product truth.

## Hard Stops

Do not use DevStudio to:

- edit customer account data
- host widget authoring
- bypass Roma/Bob/Tokyo product paths
- mutate live worker runtime state directly
- store or display secret values
- create a parallel account, allowlist, model, or policy authority
