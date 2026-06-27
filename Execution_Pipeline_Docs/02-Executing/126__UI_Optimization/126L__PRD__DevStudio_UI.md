# 126L — PRD: DevStudio UI

Parent: `126__PRD__UI_Optimization_Program.md` (MAMA) — **track 3 of 4.**
DevStudio is the doll that *reveals* the token + component dolls beneath it; it
must be splendid and structurally incapable of masquerading Dieter's state.

Status: **DIRECTIONAL.** The body below is the prior draft (2026-06-23), kept in
full as seed content; it is corrected and brought to the 124/125 bar during the
DevStudio audit + fill (`audits/126C__Audit__DevStudio_UI.md`).

**Known corrections to the body** (from `audits/DevStudio_Dieter_Sanity_Pass_Findings_June2026.md`):
- **Strike** "kill ghost token `--radius-4`" — `--radius-3`/`--radius-4` are
  intentional aliases; executing it is a visual regression.
- **Amend** `textrename` removal to also delete `admin/src/main.ts:23,258`, or the
  admin bundle breaks.

Prior title: *DevStudio as a Trustworthy Reveal Cockpit — Dieter Components*.
Prior status: EXECUTING · Owner: DevStudio + Dieter · 2026-06-23 · 02-Executing.
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
- `admin/scripts/generate-foundation-pages.mjs`, `generate-component-pages.ts`,
  `generate-typography-json.cjs`, `generate-static-registries.mjs` (the generation
  pipeline — already in place; verify + keep guarded)
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
| What is editable from DevStudio | Values-only (token values); contract changes are code |

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

## 2. Current state (audited 2026-06-23) — the loop is mostly built

An earlier draft of this PRD leaned on a 2026-06-09 audit that described a showcase
mostly hand-authored and lying. A direct re-audit against today's code shows that
masquerade is largely already gone — **the reveal loop is built.** What remains is
small and specific.

| Surface | Audited today | Status |
| --- | --- | --- |
| Colors | 132 declarations; **128 chips GENERATED** by `generate-foundation-pages.mjs` (not 216 hand-authored); 134 unique `var()` refs | Derived ✓ |
| Typography | **DERIVED** from `typography.generated.json`, **33 roles** (not hand-frozen, not 30) | Derived ✓ |
| Icons | **157, GENERATED, complete** (`data-governance-count="157"`) | Derived ✓ |
| Components | **21 specs / 21 pages** (textedit page now exists); generator **HAS guards** — throws on unresolved `{{...}}` and on a component that renders no page | Derived ✓ |
| Deploy chain | a `dieter/tokens/**` commit **DOES** trigger `pnpm build:dieter` + Tokyo R2 sync (via `cloud-dev-workers.yml`) | Real ✓ — token editor unblocked |
| Chrome CSS | 0 hex in `roma.css` + `bob_app.css` | Clean ✓ |

The real remainder — three gaps, each still a place DevStudio can lie or drift:

1. **One ghost token: `--radius-4`** — referenced on the colors page (chip
   `border-radius`, inline style) but **never defined** anywhere; the radius scale
   is `--control-radius-*`, not `--radius-*`. Chips render with no border-radius
   today. (The earlier "`--neutral-base`" ghost is not real — it is referenced
   nowhere.) A live bug, not doc drift.
2. **`textrename` is dead** — exported (`hydrateTextrename`) and registered, but
   **no consumer imports it**; it has no spec, so it is the one component the
   generator skips. Dead weight in the component set.
3. **~20 inline-px values** in components (Roma 16, Bob 4) — real tokenization
   drift a guard would catch (the CSS is clean; the inline TSX is not).

## 2.1 The real fix targets

| Area | Action |
| --- | --- |
| Ghost token `--radius-4` | Resolve at source: the chips want the real radius token (`--control-radius-md`); delete the `--radius-4` reference. |
| `textrename` component | Delete everywhere: `dieter/components/textrename/`, the `registry.json` entry, the `hydrateTextrename` export in `index.ts`, the built `tokyo/product/dieter/components/textrename/` + manifest entries, the `Overview.md` row. No consumer imports it. |
| Inline-px in components | Tokenize the ~20 sites (Roma 16, Bob 4) to `--space-*`. |
| Derived showcase | Already generated + guarded — keep; verify the guards stay green. |

## 3. The fix — close the real remainder (the loop is already built)

The earlier draft treated "derive every page from source" as the work. The audit
shows that is already done — colors/typography/icons are generated, the component
generator is guarded, the deploy chain is real. So the fix is small: close the three
gaps from §2.1 and verify the loop holds.

### 3.1 SEE — derived, and verified to stay derived
The showcase pages are already generated from source (`generate-foundation-pages.mjs`
for colors/icons; `generate-component-pages.ts` for components — which throws on
unresolved `{{...}}` and on a component that renders no page; typography from
`typography.generated.json`). Keep them derived; verify the guards stay green so the
window can only reveal.

### 3.2 STEER — the token editor is unblocked
The deploy chain is real: a `dieter/tokens/**` commit triggers `pnpm build:dieter`
and the Tokyo R2 sync (`cloud-dev-workers.yml`). So the values-only token editor
(reusing the Migration PRD §3.5 commit lane — Berlin-session → validate → commit →
propagate) is not blocked. Values-only (a color, a font size); add/remove/rename
tokens stays code work. (An earlier draft's "Step 0 dependency: R2 sync does not
trigger on `dieter/tokens/**`" is wrong — it does.)

### 3.3 TRUST — the look + judgment (guards as backstop)
Guards are a backstop, not the trust: a tokenization guard (no raw hex/font-size in
chrome CSS **or inline TSX**) catches the inline-px drift (§2.1 #3) before the
human's eye. Trust itself = the human looks at the derived result and judges. (An
earlier draft called this "TRUST via CI guards." That framing is rejected.)

## 4. Boundary

- DevStudio reveals + steers through named authorities. It is **not** a second
  Roma, a second account/auth model, or a raw superadmin panel. Reuse the Berlin
  session + `CLICKEEN` admin account + the existing commit lane.
- Cloudflare Access is not the DevStudio auth boundary.

## Coordination + execution rules (cross-PRD)

- **Ownership split.** This PRD owns Dieter itself (derived pages, `textrename`
  cleanup, ghost token, tokenization guard, token editor). The sibling
  `UI_PRD__Roma_UI_Refactor.md` consumes Dieter and makes Roma launch-grade — a
  different job; don't blur it.
- **Inline-px is owned here.** This PRD owns the tokenization guard *and* cleaning
  the ~20 inline-px sites in Roma/Bob (Step 3). The Roma PRD's matching step is
  **verification only** — it must not re-edit the same lines.
- **Sequence.** DevStudio goes first — its guard + Dieter cleanup are the foundation
  the Roma PRD leans on.
- **Start from clean git.** Commit in-flight doc/taxonomy cleanup before code work —
  don't mix doc churn into code commits.
- **Re-audit Step 0.** The §2 counts are a baseline; recount on the real code first.
- **Proof is visual.** UI changes need before/after browser screenshots — lint green
  is not sufficient.
- **Docs are part of done.** `devstudio.md` must match the executed behavior.
- **No new framework.** This is cleanup/convergence onto existing Dieter + current
  product law — not a build.

## 5. Steps

| Step | Action | Completion evidence | NOT_ALLOWED |
| --- | --- | --- | --- |
| 1 | **Kill the ghost token:** replace the `--radius-4` reference on the colors page (chip `border-radius`) with `--control-radius-md`; confirm no `--radius-4` anywhere; chips render the correct radius. | `grep --radius-4` → 0; chips render radius; visual parity. | Silently defining `--radius-4`; leaving the reference. |
| 2 | **Remove dead `textrename`:** delete `dieter/components/textrename/`; remove the `registry.json` entry and the `hydrateTextrename` export in `index.ts`; rebuild (`pnpm build:dieter`) so the manifest + `tokyo/product/dieter/components/textrename/` drop it; remove the `Overview.md` component-table row. | `grep textrename` → only the historical 112B record; `build:dieter` green; typecheck green (no consumer broke). | Keeping it "just in case"; breaking the export surface without confirming no consumer. |
| 3 | **Tokenize inline-px (this PRD owns it; Roma verifies):** replace the ~20 hardcoded px values in Roma (16) + Bob (4) components with `--space-*` tokens + stand up the tokenization guard. The Roma PRD's Step 6 is verification-only — it must not re-edit these lines. | 0 inline `style={{...px}}` bypassing tokens in Roma/Bob components; tokenization guard green. | Reinventing the guard; scoping it to pass dirty code. |
| 4 | **Verify the loop + editor:** confirm derived pages stay guarded (coverage/stencil/ghost guards green); confirm the values-only token editor round-trips on `devstudio.clickeen.com` (edit → commit → `build:dieter` → Tokyo R2 → product chrome reflects it). | Guards green; editor round-trip proven; invalid value → typed 422; conflict → typed 409. | Shipping the editor before Step 3 (tokenization) is clean. |
| 5 | **Docs sync:** confirm this PRD's §2 matches the audited numbers; `devstudio.md` already carries the reveal-cockpit tenet. | Docs match runtime. | Deferring docs. |

## 6. Acceptance criteria

- **Zero masquerade, verified:** colors/typography/icons/component pages are all
  generated from source and guarded; a missing/broken token or component shows as
  missing/broken — never patched to look right. (Audit: already true; keep it true.)
- **Ghost token gone:** no `--radius-4` anywhere; chips render the real radius.
- **Dead component gone:** `textrename` removed everywhere; no broken export.
- **Inline-px tokenized:** 0 hardcoded px in Roma/Bob component inline styles.
- **Steering works end-to-end:** a token-value edit → attributed commit → Dieter
  build → Tokyo R2 sync → product chrome reflects it (deploy chain is real).
- **Guards are a backstop** (green), not the trust. Trust = the derived look + human
  judgment.
- **Dieter components proven first**; the reveal/steer loop then extends to other
  DevStudio domains via their own series PRDs.

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
