# PRD - DevStudio as a Trustworthy Reveal Cockpit — Dieter Components

Status: EXECUTING
Owner: DevStudio + Dieter
Date: 2026-06-23
Stage: 02-Executing
Series: `Devstudio_as_a_trustworthy_Reveal_cockpit_<Domain>` — this is the
**DieterComponents** PRD. DevStudio governs many domains (Dieter, models, agents,
product state, content); each gets its own PRD in this series. Dieter components is
first because it is the safest: it is the showcase only — if the loop is wrong,
nothing customer-facing breaks.

DevStudio tenet (authoritative): `documentation/services/devstudio.md` —
*"DevStudio is the one human's cockpit for governing an AI-operated company."*

Related:

- `documentation/services/devstudio.md` (DevStudio tenet)
- `dieter/components/*` (stencil + spec + CSS — component truth)
- `dieter/tokens/*` (`dieter-color-tokens.css`, `dieter-typography.css`,
  `dieter-foundation-tokens.css`, `tokens.css` — token truth)
- `dieter/icons/icons.json` + `dieter/icons/svg/*` (icon source truth; Tokyo is
  build/deploy output)
- `tokyo/product/dieter/**` (Dieter build output synced to Tokyo R2 `dieter/**`)
- `admin/scripts/generate-component-pages.ts`, `generate-typography-json.cjs`,
  `generate-static-registries.mjs` (existing partial generation — harden, don't bypass)
- `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md`
  (§3.5 write path — reused here; §3.6 design freeze — binding here; Appendix A
  hash-frozen pages — the visual baseline)

## Tenets

- Execute one step at a time. Step N green before Step N+1.
- Green requires named completion evidence. A blocker report stops execution; it
  does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- If existing code contradicts this PRD, delete it, fence it, or stop; do not
  preserve it and work around it.
- **Design freeze applies (Migration PRD §3.6):** the showcase page layouts are
  the frozen templates. Generation changes *where content comes from*, never
  *how it looks*.

## Authority

| Concern | Authority |
| --- | --- |
| Page layout / visual design | Product owner; frozen templates from the migrated pages |
| Component truth | `dieter/components/*` (stencil + spec + CSS) |
| Token truth | `dieter/tokens/*` |
| Icon truth | `dieter/icons/icons.json` + `dieter/icons/svg/*`; Tokyo output is not source truth |
| Served page artifacts | Generated static HTML under `admin/src/html/**` (derived, guarded) |
| Token deployment | Source token commit → CI `pnpm build:dieter` → `tokyo-r2-deploy-sync --remote` |
| Write-path mechanics | Migration PRD §3.5 (Pages Functions + GitHub commits + validators) |
| What is editable from DevStudio | This PRD, Step 0 decision (values-only) |

---

## 0. What this PRD is really about

DevStudio **reveals** Dieter. It never masquerades.

Dieter is token-first atomic — tokens → semantic tokens → components, composing
upward. So a break at any level propagates through everything that consumes it,
and a fix at the root propagates everywhere downstream for free. That is why
DevStudio must show the real state — broken or not — and never dress it up.

- A break **revealed** is the system working: it rang the alarm; you fix it at
  the root (the token / semantic token / component source), and the atomic design
  makes that fix reach everything.
- A break **masqueraded** (the showcase patched to look right) is the system
  failing: it hides rot radiating through the whole system, fakes the one human's
  only reliable view, creates a second lying source of truth, and trains
  surface-patching over root-fixing.

So this PRD is not "make the Dieter showcase nice." It is: **make DevStudio
structurally incapable of masquerading** — by generating everything it shows from
the same Dieter source the product consumes. When the window can only derive, it
can only reveal.

This is the cockpit's core loop — **SEE derived truth, STEER through a validated
commit** — proven on Dieter components first, the safest domain.

## 1. Trust is the look, not a gate

Trust does **not** come from CI guards. That is the old-SaaS model ("the merge is
safe because CI was green" — a pre-merge rule-gate that assumes a controlled
PR→CI→merge flow). Two reasons it fails here:

1. Agents commit directly. The PR→CI→merge gate is leaky; it is not the trust layer.
2. CI checks **rules** (is it tokenized? does it conform?). It cannot check
   **outcome or taste** — *did the agent do the right thing? does this look right?*

Trust in the cockpit = the human **looks at derived truth and judges**. It rests
on the window being **derived** (it cannot lie) + the human's judgment. CI guards
are a **backstop** — catch a stray raw hex before the human's eye — not a pillar.
(An earlier draft of this PRD called this "TRUST via CI guards." That framing is
rejected.)

## 2. Current state — where DevStudio masquerades today

The showcase is partly hand-authored, not fully derived. Each gap is a place
DevStudio can lie:

| Surface | Truth | Derived today? | Drift |
| --- | --- | --- | --- |
| Components | spec-backed Dieter components | Partial — `generate-component-pages.ts` rewrites `admin/src/html/components/*.html`, but incomplete + unguarded | 21 specs / 20 DevStudio pages / 23 built; `textedit` has spec/stencil/CSS but no page; `textrename` has stencil/CSS/hydrator but no spec; output can contain unresolved stencil markers; does not prove full attribute coverage |
| Colors | `dieter/tokens/dieter-color-tokens.css` | No — hand-picked chips | 132 source declarations; page shows 216 hand-authored chips, only 36 unique `var()` refs, **2 ghost tokens (`--neutral-base`, `--radius-4`) that do not exist** — the showcase displays invented tokens |
| Typography | `dieter-typography.css` | Half — JSON generated, section lists hand-frozen | 33 generated roles; page renders 30 (missing `body`, `body-small`, `body-large`) |
| Icons | `dieter/icons/icons.json` + SVGs | Not generated into the served page | 157 symbols / 157 SVGs; page shows 143, missing 14 |

The ghost tokens are the sharpest masquerade: the human looks at color chips for
tokens that **do not exist in the system**. That is exactly the failure this PRD kills.

## 2.1 Surviving authorities and deletion targets

| Area | Survives | Delete / replace |
| --- | --- | --- |
| Showcase model | Generated static HTML under `admin/src/html/**` with generated headers + guards | Hand-authored ownership of generated pages; direct manual edits to generated HTML |
| Component pages | One hardened generator (spec + stencil + CSS → frozen layout template) | Parallel renderers, per-component generator forks, non-authoritative `registry.json` |
| Colors | Generated chip grid from governed color tokens | Hand-authored chip list; ghost tokens `--neutral-base`, `--radius-4` resolved at source (define or remove) |
| Typography | Section lists derived from generated JSON | Hand-frozen arrays; missing `body`, `body-small`, `body-large` |
| Icons | Generated from `dieter/icons/**` into the served page | Manual regeneration lanes |
| Token editor (Step 7) | Values-only edit → Migration PRD §3.5 commit lane | Local dev-server token mutation routes |

## 3. The fix — make masquerading structurally impossible

### 3.1 SEE: derive every page from source (the spine)

Hardened build-time generation becomes the only authority for showcase pages:

- **Inputs:** each component's `{c}.spec.json` + `{c}.html` (stencil) + `{c}.css`
  + shared Dieter CSS — the exact files the product consumes. Colors from
  `dieter-color-tokens.css`; typography from generated JSON; icons from
  `dieter/icons/**`.
- **Enumeration:** the generator walks spec attributes/placeholders and renders
  every meaningful variant/size/state through the stencil, with spec labels —
  the current page format.
- **Layout:** poured into the **frozen layout template** (Migration PRD §3.6;
  Appendix A hash-frozen pages are the visual regression baseline the output must
  match).
- **Coverage guard:** generation **fails** if a spec attribute/variant, a token, a
  typography role, or an icon is not rendered, or if output contains unresolved
  stencil markers (`{{...}}`). Staleness becomes a build error, not a silent lie.
- **Hand-authoring abolished:** files in `admin/src/html/**` remain only as
  generated artifacts with headers. The showcase can no longer be changed except
  by changing Dieter source or the generator template.
- The point is not accuracy — it is that **a derived page can only reveal**. A
  missing token shows as missing; a broken component shows as broken. That is the
  alarm working.

### 3.2 STEER: the commit path (reused, not reinvented)

The token editor extends the **Migration PRD §3.5 write path** — the same lane
the policy editor already proves (Berlin-session → read committed truth →
validate → commit → CI propagates):

- **Values-only:** edit the *value* of an existing token (a color, a font size).
  Adding/removing/renaming tokens changes the contract — that is code work in a
  reviewed diff, not a DevStudio edit.
- **Mechanics:** draft → validate (token exists, value valid for its kind) →
  old/new diff → confirm commit → commit SHA / build status. No auto-save.
- **Write semantics:** edit the exact declaration in `dieter/tokens/*.css`,
  preserve comments/order, commit to `main` (`dieter(devstudio): --fs-18
  1.125rem -> 1.25rem`).
- **Deploy:** the commit changes source tokens only; CI (`dieter/**`) runs
  `pnpm build:dieter`, produces `tokyo/product/dieter/**`, syncs to Tokyo R2.
  Product chrome rebuilds from the same commit.
- **Dependency (preflight, Step 0):** today Tokyo R2 sync triggers on
  `tokyo/product/dieter/**`, **not** `dieter/tokens/**`. The token editor must
  not ship until CI proves a `dieter/tokens/**` commit rebuilds + syncs.

### 3.3 TRUST: the look + judgment (guards demoted to backstop)

Guards are a **backstop**, not the trust:

- **Tokenization guard:** no raw hex/rgb/oklch color literals and no raw
  font-size literals in product chrome (`bob/**`, `roma/**`, `admin/**` CSS
  **and inline TSX**). Dieter token files are the only place governed color
  values may be literal. Explicit exemptions for generated demos/swatches/fixtures.
- **Coverage / ghost / no-hand-authoring guards:** generation fails on unrendered
  spec attributes/variants, missing tokens/roles/icons, `var(--x)` refs to
  undefined tokens, and edits to generated files without input changes.

These catch drift before the human's eye. They are **not** how the human trusts —
the human trusts by looking at the derived result.

## 4. Boundary

- DevStudio reveals + steers through named authorities. It is **not** a second
  Roma, a second account/auth model, or a raw superadmin panel. Reuse the Berlin
  session + `CLICKEEN` admin account + the existing commit lane.
- Cloudflare Access is not the DevStudio auth boundary.

## 5. Steps

| Step | Action | Completion evidence | NOT_ALLOWED |
| --- | --- | --- | --- |
| 0 | **Preflight:** record exact counts (specs/pages/components, color tokens, typography roles, icons); resolve the 2 ghost tokens at source (define or remove); confirm whether a `dieter/tokens/**` commit rebuilds + syncs Tokyo R2 today (the editor's dependency); lock the generator inventory + `textedit`/`textrename`/`icon`/`shared` treatment. | This PRD updated with the baseline + ghost-token decision + deploy-chain verdict. | Starting from stale counts; silently defining ghost tokens without the decision. |
| 1 | **Typography derived:** section lists from generated JSON; all roles render; hand-frozen arrays deleted. | All generated roles render; visual parity vs frozen baseline; arrays gone. | Hand-curating role lists; new layout/styles. |
| 2 | **Colors derived:** chip grid from token CSS, both themes; ghost tokens resolved per Step 0. | Page shows the governed color-token count exactly; ghost-guard green; visual parity. | Hand-picking tokens; inventing chip styles. |
| 3 | **Icons derived** into the served page from source each build. | Page shows all source icons; a test icon appears without manual steps. | Manual regeneration lanes. |
| 4 | **Component generator hardened:** spec+stencil enumeration through the frozen template for all governed components; hydration wired uniformly; generated files carry headers. | Coverage guard green per component; no unresolved `{{...}}`; visual parity; `textedit`/`textrename` treatment proven. | New visual language; per-component generator forks; keeping hand pages "as backup". |
| 5 | **Backstop guards live** (before any writes): tokenization (incl. inline TSX, with exemptions), coverage, ghost, no-hand-authoring, generated-output validity. Seeded violation of each class fails the build. | Guards in CI; current tree passes; `admin/**` covered. | Warn-only guards; enabling writes first. |
| 6 | **Reusable write path:** extract/reuse Migration PRD §3.5 commit mechanics for token routes; no local write lane. | Berlin session → server-side GitHub commit; path allowlist to token files; typed 401/403/409/422; conflict/rollback SOP. | New auth model; client secrets; local mutation APIs. |
| 7 | **Token editor (values-only)** — only after Step 0 confirms the deploy chain + Step 5 guards are live. | On `devstudio.clickeen.com`: edit `--fs-*` → source commit on `main` → CI `build:dieter` → Tokyo R2 updated → Bob/Roma/Admin computed styles reflect it; invalid value → typed 422; conflict → typed 409. | Add/remove/rename tokens; client secrets; auto-save. |
| 8 | **Docs sync:** `devstudio.md` gains the reveal-cockpit model for this domain. | Docs diff in the same PR as the final code step. | Deferring docs. |

## 6. Acceptance criteria

- **Zero masquerade:** every Foundations and Component page is generated from the
  same Dieter source the product consumes; every generated artifact is guarded
  against hand-edits. A missing/broken token or component shows as missing/broken
  — never patched to look right.
- **Coverage total and guarded:** all typography roles, all color tokens (ghosts
  resolved), all icons, every spec attribute/variant per component — CI fails on
  any gap.
- **The look is trustworthy:** derived from source, the human sees truth; ghost
  tokens are impossible.
- **Steering works end-to-end:** a token-value edit becomes an attributed commit
  that propagates through the Dieter build + Tokyo R2 sync to product chrome.
- **Guards are a backstop** (green), not the trust. Trust = the derived look +
  human judgment.
- **Visual parity:** every generated page matches its hash-frozen baseline.
- **Dieter components proven first**; the reveal/steer loop then extends to other
  DevStudio domains (models, agents, product state, content) via their own
  series PRDs.

## 7. Out of scope

- Other DevStudio domains (models / AI-plane, agents, product runtime, content) —
  each gets its own `Devstudio_as_a_trustworthy_Reveal_cockpit_<Domain>` PRD.
- Adding/removing/renaming tokens from the UI (values-only here).
- Editing component code (stencils/specs/CSS) from DevStudio — components are
  code; governance is reveal + enforce, not UI-edit.
- Any redesign of the showcase pages (freeze — the layout is the design).
- Widget-level token compliance (widget configs allow user HEX overrides by
  design — customer content, not chrome).
- Turning DevStudio into a generic platform. This is the reveal/steer loop proven
  on one domain.

## 8. Planning review

1. **Elegant, scales?** Yes — deriving pages abolishes masquerade; every future
   token/icon/component is revealed for free. O(1) per addition.
2. **Compliant with architecture / tenets?** Yes — kills a duplicate-truth
   violation (hand-authored showcase vs real source); reuses the ratified write
   lane; stays inside DevStudio's boundary.
3. **Avoids over-architecture?** Yes — values-only editor, no new visual language,
   guards as backstop (not trust), no generic platform.
4. **Moves toward intended architecture?** Directly — makes the cockpit's
   reveal/steer loop real, starting with the safest domain, so one human can govern
   by looking and steering instead of by reading code.
