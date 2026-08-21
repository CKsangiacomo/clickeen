# PRD 129–131 Execution Audit — GLM

Status: **EXECUTION AUDIT COMPLETE — READ-ONLY RECORD**

Owner: Clickeen product owner/architect

Date: 2026-08-21

Scope: the executed PRD 129 family (A–D), PRD 130 with the 130B remediation,
and PRD 131, from execution through cloud-dev deployment and archive
(`9f16320f`). This is GLM's execution audit of the wave; it lives with the
wave's other audit records in this folder. It is evidence, not authorization
to change code, mutate product data, deploy, or operate a managed service.

## 1. Method

- Documentation-first: `documentation/` router, Tenets, and the owning
  manuals before any code conclusion.
- Code-traced every PRD claim to the owning authority at the cited revision;
  product runtime evidence taken from cloud-dev through the owning surfaces
  (authenticated Berlin dev-admin session for account flows; served static
  chunks for deployed-code proof, with content-hash comparison against a
  local `build:cf` to prove deployment currency).
- Contract gates pinned to exact shapes; independent subagent V1–V8 audits
  after product-path changes.
- Deploy plane: direct pushes to `main` (no PRs); Cloudflare Pages
  Git-connected builds and Workers runs are the deployment, verified through
  the Cloudflare API and the live custom domains.

## 2. PRD 129 — Widget Software And Instance Lifecycle Architecture

**What.** Four separated boundaries per the parent PRD:

- 129A Create: Widget folders author reusable software; New writes nothing;
  first Save creates editable source.
- 129B Edit/Save: Bob edits in browser memory; Save is the editable-source
  persistence boundary; `updatedAt` flows back through the save chain so the
  UI can derive divergence without new storage.
- 129C Publish: Roma's one generic materializer generates the complete
  `index.html`/`styles.css`/`runtime.js`; a per-account Durable Object
  coordinator serializes publication (409 overlap, 402 capacity with the
  existing upsell); `publishedAt` lands in publication truth.
- 129D Serve: Tokyo-worker returns stored exact bytes; the Edge applies
  exact locale overlays through `HTMLRewriter` on stable identity
  coordinates (`data-ck-content-path`/`mode`/`attribute`); missing locale
  truth fails visibly (`404 Locale not available`), never falls back.

**How.** Stable-identity overlay coordinates replaced positional paths so
reorder follows identity, additions stay explicitly untranslated, and
deletions have no node. Publication divergence in the UI is computed as
`updatedAt > publishedAt` from facts already owned by Tokyo/Roma. The
publication UX was relocated out of Bob entirely per owner ruling: Bob Saves
only; publication state and commands live in Roma surfaces (Widgets rows and
the Builder header). Verification: live authenticated publish/unpublish and
selected-locale fetches, served-chunk greps, the save-boundary contract
test, and V1–V8 subagent audits. 129D product commit `e2ac3589`; Workers
run `32087699030`.

**Why.** One saved instance is one complete logical state; Publish is the
only materialization boundary; the public runtime serves complete
materialized truth so visitor requests are cheap, static-first, and
meaningful to search/answer engines before JavaScript. No visitor request
calls a model, reads Supabase, rebuilds, or substitutes an identity.

**Corrections during execution.** The save chain initially dropped
`updatedAt` at the Roma boundary (V6 inert fix — the UI could not see
divergence); fixed by threading it through the Tokyo client and PUT route.
The first publish-UX attempt put publish/republish machinery inside Bob;
owner rulings dismantled it to the final law (Bob Saves; publication lives
in Roma). Zone-API cache purges proved to be silent no-op against Workers
Caching after warm HITs; invalidation moved to the default entrypoint
`ctx.cache.purge({ tags: [accountInstanceCacheTag] })`.

## 3. PRD 130 — Defensive Construction Audit

**What.** An audit-only pass over the codebase and services for
AI-invented defensive machinery: guards, validators, fallbacks, and repair
paths for failures that do not exist in 90% of usage. 65 findings, each
classified observed / reachable / latent / theoretical with the inverted
proof-of-need rule (theoretical = deletion candidate, not a work item).

**How.** Five subagents swept the named authorities with a nine-pattern
lens; findings and evidence were recorded in the audit PRD with the GLM
appendix (now `130__AUDIT__Defensive_Construction_Audit.md` in this
folder). The team then shipped the 130B remediation (commit `34444e5e`,
44 files) closing the E1–E6 findings, followed by `2ec4ea87` (Product
Copilot continuations) and `72e75000` (Copilot and locale identity gaps)
and `96f19874` (closing the remaining audit findings). Claude's and
Cursor's post-execution audits of the remediation live in this folder;
Cursor's blockers were addressed by the follow-up commits above.

**Why.** The codebase is AI-built, and AI over-indexes on failure cases,
producing worse UX for the average user. In a closed, trusted system,
internal revalidation is itself a tenet violation (Tenets 3 and 5): guards
downstream of a named authority re-prove that authority's truth. The
headline finding made the case concrete: Product Copilot was dead inside
Builder — a duck-cast consumed the wrong context — while substring-grep
gates reported the wiring healthy.

## 4. PRD 131 — Builder Header Dieter Convergence

**What.** The Roma Builder page's publication header was converged onto the
Dieter design system's frozen `page__header` part, in the same grammar as
every Roma page header, sharing Bob's width geometry.

**How.** Final composition: `roma-page-heading` group with `h1.heading-2`
instance label, the publication state directly after the label
(`diet-badge` status word + `diet-toggle` publish switch at `md`), and
`page__actions` with large buttons only (Republish primary with in-place
spinner; Open public widget and Copy code tertiary). The status machine
lives in one hook shared by `WidgetPublicationState` and
`WidgetPublicationControls`, so the Widgets rows and the Builder header
render the same truth. Styling is the frozen part plus one surface-local
override block: full-bleed width with the `space-2` inset Bob's own
container uses — the ordinary 80rem centered column law does not apply on
the full-canvas surface. Commits: `f0a15585`, `03b78241`, `814aebf3`,
`64d7a15f`, `b158b6dd`, `a4a358de`; checks typecheck/lint/gates/Dieter
governance; live chunk proof on each deploy; V1–V8 subagent audit PASS
(`changeStatus` byte-identical through the refactor).

**Why.** Dieter tokens and primitives come first (Tenet 13). A Roma page
header is a header: identity and state on the left — state labels the named
thing, and the switch that changes that state lives beside it — verbs on
the right. The header sits on the same canvas geometry as the editor below
it because it is the top band of that canvas, not a separate page.

**Corrections during execution.** The first implementation precedent-hunted
a type register instead of mapping the element's role (`heading-6` for a
page title); the owner corrected it to `heading-2`. The grammar strip then
over-reached: it deleted the badge and toggle — a functional removal inside
a styling pass — and shipped with `widget-command-gates` red on main (the
pinned loading line was gone; the §6 record's PASS claim was mistaken).
`b158b6dd` restored the state beside the name and turned the gates green
again. The width-geometry mismatch (header still in the 80rem column while
Bob ran full-bleed) was caught from the owner's screenshot and fixed in
`a4a358de`. All three corrections are recorded in the PRD's §6–§8.

## 5. How The Three Interlock

129 wrote the lifecycle law: Save creates/updates editable source; Publish
alone materializes; Serve returns exact stored truth. 130 stripped invented
machinery from around that system and forced gates to prove wiring instead
of grepping for it. 131 made the editing surface's host chrome speak the
design system with zero Widget-specific styling. All three enforce one
principle: boring, explicit commands between named authorities, failing
visibly, with no AI-invented structure in between.

## 6. Open Items At Archive

- 129D: stored positional-overlay Generate/delete cutover and republish of
  affected pre-stable-slot packages; runtime proof of the Worker-owned
  cache-tag invalidation; owner QA of the serve boundary.
- 130: disposition of the remaining audit findings lives in the team's
  remediation record and the Claude/Cursor audits in this folder.
- 131: archived by `9f16320f`; final composition is the PRD §7–§8 state.

## 7. V1–V8

Independent subagent audits ran after the product-path changes in this
wave; all PASS. The one latent non-violation on record: the Builder header
mounts two hook instances (state island and actions), so a rapid
toggle+Republish interleave can double-POST and fail visibly through
Tokyo's 409 coordinator; no machinery was added absent an owner request.
