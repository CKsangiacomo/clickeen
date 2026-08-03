# 127 MAMA — Peer Review Synthesis

Date: 2026-08-03. Synthesizes four independent reviews of
`127__PRD__Global_Pages_Program.md` (locale/overlay redraft):

| Seat | File | Verdict |
| --- | --- | --- |
| Staff Engineer | `127__MAMA__StaffEng_PR.md` | **REJECT for G0** — fixable with additive edits, not a redesign |
| Senior PM | `127__MAMA__SeniorPM_PR.md` | Accept with changes |
| Principal TPM | `127__MAMA__PrincipalTPM_PR.md` | Accept with changes |
| Claude (session) | `127__MAMA__Claude_PR.md` | Accept with changes |

The seats were run independently; convergent findings below were arrived at
separately, which is weight, not duplication.

## Net verdict

**The Mama is not G0-ready as written, and every seat agrees the architecture
is sound.** The staff engineer's REJECT is procedural, by the Mama's own §15
standard: three decisions that every slice keys on are missing, and accepting
now would license the child rewrites to invent exactly the things the Mama
exists to pin. No seat asked for an architecture change. Every required fix is
an additive sentence, a decision row, or a list edit.

## Blockers (union across seats)

1. **The locale universe is undecided — and the Mama's own examples don't
   exist in the shipped system.** [StaffEng B3] `packages/l10n` lowercases
   every token and the canonical registry holds 29 language-only codes;
   `it-IT` is unrepresentable and `?locale=it-IT` returns `Locale not
   available` today. D1 must name the registry as the closed universe, its
   post-127 contents or extension procedure, the canonical casing for
   URLs/filenames/cache keys, and who authors a market overlay (customer edit
   vs Translation Agent — `en → en-US` is adaptation, not translation).
2. **No encoding/escaping law.** [StaffEng B1; Claude major] Overlay values
   land in four insertion contexts (HTML text, attribute, head metadata,
   JSON-LD). Today's safety is browser-side DOM application; the program moves
   application server-side into CDN-cached public HTML — a missed context
   becomes stored XSS served to every visitor. Fix in D3 plus an §15 hard
   stop: the completion function owns context-aware encoding; a value can
   never change document structure.
3. **Widget public URL taxonomy is absent.** [StaffEng B2; TPM blocker] §8
   defines Page routes only, while G1 — the first, riskiest slice — migrates
   live widget serving to URLs whose shape exists only in a stale child. Add
   the widget neutral/exact/support-file routes to §8.
4. **D5's privacy-contract clause is unbuildable.** [TPM blocker; StaffEng
   3.2] "Global privacy contract" names an authority that exists nowhere.
   Delete the remembered-choice clause or defer it to a named future program;
   resolver starts at browser language.
5. **No named customer use case.** [PM] Nine plain-words sentences describe
   mechanics; nothing says what job a page does. Scope fights cannot be
   arbitrated without one. Add named jobs to §1 and test the catalogue and
   widget contracts against them.
6. **Zero agent operations in the flagship program of an agent-operated
   product.** [PM] Per-locale page metadata (title, description, social,
   market values) has no producer; Translation Agent authority stops at
   instance text fields. Either extend it to Page-owned declared fields (a
   D-row with an owner) or write the agent-free first release into non-goals
   with rationale. Silence is the defect.
7. **Deleting an instance that a published page uses is unhandled.** [PM]
   Placement law forbids substitution, so the page can never recompile and
   last-good serves the deleted content indefinitely. Add the §14 row and
   require "used on N pages" at the delete surface (127D's scan already
   produces the evidence).

## Majors — program law (fix in the Mama text)

- **Amendment ledger.** [Claude; TPM; StaffEng M1 — three seats] The Mama has
  already been corrected once at vocabulary scale with no internal trace.
  Dated ledger section; an edit without a row is invalid.
- **G0 must evidence the child purge as re-derivation, not rename.** [Claude;
  TPM] Zero-count grep of the retired vocabulary across 127A–E plus reviewer
  attestation that contracts were re-derived from D1–D13; line counts down or
  explained.
- **§12 contradicts G2.** [StaffEng M3] §12 grants 127B product-data
  mutation; G2 says 127B stores nothing. Strike or scope it.
- **Envelope concurrency law.** [TPM] Single-PUT atomicity ≠ isolation of the
  replacement sequence under multi-agent operation. Etag-conditioned writes;
  lost condition = explicit failure.
- **Discovery-record storage root.** [TPM] Implied new runtime-managed R2
  root outside `accounts/` contradicts Tenet 8's root list. Name the
  coordinate in the Mama; add the Tenet 8 amendment to §19.
- **"Mixed files never serve" is unsatisfiable as written.** [StaffEng M8]
  Stable unfingerprinted `styles.css`/`runtime.js` under a shared CDN have a
  purge-propagation window. State the transition contract or scope the "never".
- **Widget-side invalidation missing from G1.** [StaffEng M7] Exact locale
  HTML becomes cacheable; instance saves and overlay writes become purge
  events. Add to G1's required truth.
- **Locale removal while published output serves it.** [StaffEng M6; PM 2.2,
  2.3] No §14 row; also no customer warning contract for the URL-killing act,
  and account-level locale removal cascades into pages invisibly.
- **Root behavior: redirect or render.** [StaffEng M12] Opposite SEO
  outcomes; pin redirect-only and make tenet 16's sentence `no-store`.
- **Widget-root inference overreach.** [StaffEng 3.1] No use case forces
  locale inference or a chooser on an *embedded* widget; the embedding page
  is the locale authority. Split tenet 15: Pages root gets D5; widget root
  gets its own explicit decision.
- **Unnamed load-bearing artifacts.** [StaffEng M4, M10, M13, M9, M5] The
  widget "saved contribution truth" has no filename; `out_of_date` + reason
  has no stored location; G1's migration coordinates are unlisted; "retained
  Widget" implies an undecided cull; locale-selection scope (account vs
  per-artifact) and the meter-counting rule are two-ways readable.
- **Observability on the new paid public surface.** [TPM; PM 2.4] No
  error/cache visibility requirement; a stuck `replacementPending` envelope
  serves `no-store` at full cost invisibly; customers learn of staleness only
  by opening Your pages. Require Roma surfacing of pending-age and incomplete
  operations; G8 names where serving errors are observable.
- **Fleet-wide rematerialization has no owner.** [PM; TPM] A compiler/widget/
  Dieter change invalidates everything; 127D excludes that fan-out and names
  no authority. Name it or declare the explicit non-goal with risk stated.
- **Program artifact conventions.** [TPM] Evidence homes, audit storage,
  owner-decision file — pre-agree names now (the 126 precedent shows they get
  invented ad hoc); ledger cells link to them.

## Decisions only the owner can make

- **`pages.max` at tier1 = 0 vs the program's own funnel research.** [PM 4.6]
  Draft-counting forecloses the sunk-cost conversion mechanic the Elfsight
  research documented, and D9 bans a publish entitlement. Keep it, split it,
  or write the rationale — but not by silence.
- **Page-level visual continuity.** [PM 4.4] Fixed vertical flow is
  defensible; zero page background and zero inter-section rhythm risks raw
  seams between independently-styled widgets on a design-led product. Two
  properties in scope, or a proven seam-quality fixture before G7.
- **Tier 5 initial values.** [StaffEng 3.3 verified: every cell currently
  equals Tier 4] State the row is nameability, not capability — and check the
  250-instance/100-published caps against the planned example inventory
  before they block proof work. [PM 5.4]
- **Acceptable-use/takedown authority for hosted content.** [PM] Pages makes
  Clickeen the publisher of arbitrary customer content on a shared domain; no
  abuse mechanism exists anywhere. Name the owning decision even if post-127.
- **Dead-canvas first run.** [PM 1.3] `blank` + no inferred locale + no
  preview until a locale exists = hostile first minute. Offering (not
  applying) origin-locale selection at creation preserves tenet 3.

## §19 doc-list additions (union of all seats)

`Overview.md` · `Tenets.md` root-list and Tenet 2/6/9/11 amendments ·
`BabelProtocol.md` · `services/tokyo.md` · `capabilities/seo-geo.md` · every
widget operator spec whose contribution contract changes ·
`services/devstudio.md` · AI plane docs (`ai/README.md`, `sanfrancisco.md`,
`product-copilot.md`) · `packages/l10n` + ck-contracts contract docs ·
`SupabaseOperations.md` (tier enum topology) · a new
`capabilities/pages.md` as the owning capability doc at G8 · strategy docs
(`Clickeen-Babel.md`, `GlobalReach.md`, `MarketPosition.md`) which go stale on
ship · plus the customer-facing set no PRD owns: pricing-page copy for the
tier2 gate, upgrade-path copy, help docs (which URL to share, how languages
work, why publish blocked), and the G1 note that existing `?locale=` links
break without redirect.

## Minor but telling

- Phase-speak inside the Mama ("first Page release", "deferred", "this
  release") violates the house no-phasing rule. [StaffEng]
- The no-machinery ban is restated in five places — one ID, referenced
  elsewhere, or amendments will miss copies. [StaffEng]
- `pages.max` count-then-create race; public namespace segments (`pages`,
  `sitemaps`, `robots.txt`) not reserved against account/instance ids; RTL
  direction unaddressed for `ar`/`he`; corruption folded into `out_of_date`
  at inventory surfaces; closed-set policy changes must land in one deploy or
  every importer bricks at module load. [StaffEng, TPM]

## What all seats agreed is strong — do not break in the redraft

The §14 failure/last-good law (called the strongest section by two seats, and
its purge-failure semantics map onto failure states already shipped in Tokyo
code). The §1 plain-words gate. D1's coordinate concreteness. The G1–G8 order
verified as forced by real dependencies. The evidence taxonomy and closure
ledger (above 124's practice). Tier 5 mechanics verified cell-by-cell against
ck-policy's actual validation. The compiled-`overlays.json` freeze, which
eliminates the current public-path read of authoring source — the single best
engineering consequence of the program, which the Mama should state out loud.
