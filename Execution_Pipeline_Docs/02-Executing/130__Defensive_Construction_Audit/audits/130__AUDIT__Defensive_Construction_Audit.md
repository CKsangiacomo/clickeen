# PRD 130 — Defensive Construction Audit

Status: **AUDIT COMPLETE — AWAITING ARCHITECT DISPOSITION**

Owner: Clickeen product owner/architect

Date: 2026-08-19

> This is an audit record, not current system truth. Per pipeline rules,
> canonical behavior remains in `documentation/` + runtime code. Execution PRDs
> sliced from this document update `documentation/` when they ship.

## 1. What This Audit Is

A codebase-wide review of one systematic failure mode: **AI-built software
prices every failure case as equally real**, because the builder cannot feel
frequency. Each guard is locally defensible, so each survives review; the
compound effect is that the happy path becomes an emergent accident of guard
interactions instead of a designed experience. The user never sees the guards —
they see buttons that vanish, modals that interrupt, spinners without end, and
behavior that changes with state they cannot perceive. The product reads as
erratic and unresponsive precisely because it was engineered to never be wrong.

The triggering evidence: the Publish button did not survive its own guards in
the Builder. Reconciliation machinery for races a solo editor essentially never
creates grew so entangled (`openDispatchSeqRef`, `bobAppliedInstanceIdRef`,
session re-open after publish, dual meta copies) that the only survivable
decision was to remove Publish from the editor — leaving dead code in
`roma/components/builder-domain.tsx:972-1010` and a stale promise in
`documentation/services/bob.md`. The guards did not degrade the feature; they
ate it.

This audit generalizes that lesson from PRD 129 to the whole codebase.

## 2. Method

1. **Happy-path contracts.** Ten user journeys, each with a one-paragraph
   contract of what frictionless means. Friction = deviation from the contract.
2. **Machinery ledgers.** Four parallel evidence collectors (Roma shell/account
   surfaces, Bob editor, visitor/serving, Berlin auth + agents) inventoried
   every guard, validation, gate, disabled state, modal, banner, error branch,
   fallback, retry, race mechanism, and state mirror — with file:line, trigger,
   exact user-visible effect, and whether it sits ON or OFF the happy path.
   Collectors reported evidence only, no verdicts.
3. **Verification sampling.** Load-bearing collector claims were re-checked
   against the code. Three did not survive (Section 7). Assume a similar rate
   for unverified ledger minutiae.
4. **Pricing pass.** Every material finding dispositioned by
   *frequency × user harm*:
   - **Keep** — rare + unrecoverable harm; ceremony is correct here.
   - **Simplify** — real case, oversized machinery.
   - **Genericize** — ten bespoke error paths become one honest error + retry.
   - **Delete** — guards the unreachable, or duplicates a trusted authority.

## 3. What The Audit Clears

Named so execution PRDs do not "fix" what is already right:

- **Visitor serving** (`tokyo-worker/src/routes/clk-live-routes.ts`): every
  guard is ingress attack-surface protection (path traversal, encoding), all
  off the happy path, errors are `no-store`. Correctly lean.
- **Auth/session** (`berlin/`, `roma/lib/auth/session.ts`): silent token
  refresh, replay detection, rotation — invisible on the happy path. Correct.
- **Translation generation UX**: per-locale explicit status, partial success
  honestly reported, retry-failed available. This is the reference standard for
  proportionate failure UX; other surfaces should be brought to it.
- **Roma domain error pattern**: alert + working Retry, consistently applied
  across team/assets/usage. Correct.
- **Copilot Stop semantics**: caller-cancel treated as clean end, not an error.
- **Tier-gate edit machinery**: one decision at Bob's boundary, Widget-owned
  copy, honest maximum-capacity variant. The machinery is right; only the
  Upgrade CTA destination is missing (J6).

## 4. Cross-Cutting Patterns

### Pattern 1 — The confirmation budget is spent inversely to harm

Five destructive actions fire instantly with no confirmation:

| Action | Evidence | Blast radius |
| --- | --- | --- |
| Widget delete | `roma/components/widgets-domain.tsx:966-971` | Live public widget 404s, embeds break |
| Asset delete | `roma/components/assets-domain.tsx:291-311` | Referenced assets break in widgets |
| Member removal | `roma/components/team-member-domain.tsx:160-182` | Loses access immediately |
| Invite revoke | `roma/components/team-domain.tsx:146-170` | Invite link dies |
| Ownership transfer | `roma/components/settings-domain.tsx:95-118` (verified) | Irreversible; transfers the account and logs the user out |

The product's only confirmation modal protects an unsaved *draft*
(navigation guard in `builder-domain.tsx:591-598`).

**Disposition: Keep-and-invert.** Confirmation proportional to blast radius:
live published widget > draft widget > asset > invite. Cheapest
harm-prevention in the audit.

### Pattern 2 — Success is silent; failure is eloquent

- Save in Bob: the button simply disappears on success
  (`bob/components/TopDrawer.tsx:168-182`); no "Saved" state exists, while
  `useSessionSaving.ts:101-121` runs signature reconciliation for the
  edits-during-save race. The user cannot distinguish "saved" from "button
  vanished on network lag."
- Profile save has the correct pattern ("User settings saved.",
  `roma/components/profile-domain.tsx:271-275`) — it exists, just not where the
  user's daily work lives.
- Publish success is signaled by a full table refetch
  (`widgets-domain.tsx:508`); publish failure has a three-way taxonomy with
  bespoke copy (402 / 409 / committed-but-purge-failed).

**Disposition: Simplify both directions.** Visible success confirmation on
Save; rare failures get plain honest errors, not a taxonomy.

### Pattern 3 — Invisible state drives visible behavior

- `showIf` controls appear/disappear on conditions the user cannot see
  (`bob/components/CopilotPane.tsx:161-176`, `td-menu-content/showIf.ts`).
- Save's existence depends on a signature comparison.
- Disabled controls carry no reason text (team invite button, role save,
  ownership dropdown).
- The publish toggle's outcome depends on a capacity number the user has never
  been shown.

Each instance reads as "the product is glitchy."

**Disposition: standing rule — "disabled with visible reason, never vanish."**

### Pattern 4 — Spinners without timeouts

Save (`TopDrawer.tsx:176`), "Loading preview…" (`Workspace.tsx:542-543`),
Copilot send (`CopilotPane.tsx:834`). A hung request is an infinite spinner;
the user's only recourse is refresh, which risks the draft.

**Disposition: Genericize.** One timeout-with-retry behavior, everywhere.

### Pattern 5 — The list-wide action mutex

`disabled={Boolean(activeActionKey)}` (`widgets-domain.tsx:860, 903`): one
mutation in flight disables create, duplicate, rename, delete, and publish on
every row — guarding against concurrent-mutation races one user cannot
produce.

**Disposition: Simplify to per-row busy state.**

### Pattern 6 — Copilot narrates before it acts

See Appendix 130A (Copilot). The single most trust-destroying flow in the
product; requires an architect decision.

## 5. Journey Dispositions

### J1 — First-run

Login itself is clean (standard OAuth round-trips; silent refresh). Landing is
the problem: `/home` renders a shell with no content and no next action
(`roma/app/(authed)/home/page.tsx`); the nav carries stub destinations —
Billing "not connected" (`billing-domain.tsx:13`), broader Usage
(`usage-domain.tsx:64`), AI informational (`ai-domain.tsx:17`).

**Disposition: Simplify.** Home gets the one next action; stub nav items hide
until connected.

### J2 — Edit loop

Core loop is strong (live preview from draft, dirty-gated Save, unsaved
navigation guard). Taxes:

- Silent keystroke reverts when a bound is hit
  (`bob/components/td-menu-content/useTdMenuBindings.ts:121-147`) — typing is
  "undone" with no explanation.
- Vanishing controls (Pattern 3).
- No save confirmation (Pattern 2).
- No spinner timeouts (Pattern 4).

**Disposition: Simplify.**

### J3 — Publish loop

The triggering P0, fully ledgered:

- Publish exists only as a table-row toggle switch
  (`widgets-domain.tsx:787-816`) — a control whose weight implies a cheap
  reversible preference, for a capacity-consuming release action. The same
  switch unpublishes (takes a live widget offline) with no confirmation.
- The editor's publish path is dead code
  (`roma/components/builder-domain.tsx:972-1010`, defined and never invoked;
  `publicationError` banner at :1231 unreachable); `bob.md` documents a
  TopDrawer Publish that does not exist.
- The handler's failure taxonomy outweighs its success path
  (`widgets-domain.tsx:453-517`: ~35 of 60 lines are failure modes).
- The dead Upgrade CTA (J6) terminates the product's only monetization click.

**Disposition: the agreed redesign — Roma-owned editor header hosting the same
publish toggle/Republish control as the Widgets list; Bob's contract shrinks
to Save. One shared component, two surfaces.** This deletes the reconciliation
machinery by making the mutating side and the displaying side the same
runtime. Details: design discussion recorded in the audit session; Roma
already receives `publishStatus/publishedAt/sourceUpdatedAt` in the
builder-open envelope and already proxies Bob's Save (capturing `updatedAt`
from the response it relays), so no new cross-boundary protocol is needed.

### J4 — Iterate

"Published · changes not live" (`bob/components/TopDrawer.tsx:113`) and the
Republish row button are good signals attached to no action at the point of
editing. Same fix as J3.

### J5 — Destructive

Pattern 1. **Disposition: Keep-and-invert** (confirmation ladder by blast
radius).

### J6 — Capacity

Tier-gate machinery is well-built. The gap: the 402 upsell Popup's Upgrade CTA
is scaffolding that performs nothing (documented intentional scaffolding in
`documentation/services/roma.md`).

**Disposition: one honest sentence** ("Contact us to upgrade") until billing
lands. A dead button at the monetization moment is worse than no button.

### J7 — Delegated

Invite flow is genuinely good: email-match check, expired-link handling,
role gates, Go-to-login handoff.

**Verification item:** Berlin auto-accepts invitations during OAuth when the
invite is in the `next` path (`berlin/src/auth/routes.ts:35, 294-296, 467,
481`) AND Roma has an explicit accept page
(`roma/components/accept-invite-domain.tsx`). The two paths appear
complementary (logged-out vs logged-in invitee); execution must confirm no
invitee can hit "already a member" or a silently skipped accept.

### J8 — AI-assisted

Translation is the reference standard. Copilot carries Pattern 6 plus
otherwise-honest turn-limit copy. See Appendix 130A.

### J9 — Visitor

Serving path cleared (Section 3). One architect decision: the embed failure
face is the literal text `Not found` rendered inside a customer's marketing
page (`clk-live-routes.ts:18-26`), and after unpublish-with-failed-purge a
stale embed can persist up to 24h via `stale-while-revalidate=86400`
(`clk-live-routes.ts:81`). Tenet 4 forbids substituting content — but "render
an empty iframe" versus "render the words Not found" is a brand decision, not
a fallback.

### J10 — Recovery

Mostly good (Retry pattern; committed-truth responses). Gaps: infinite
spinners (Pattern 4) and session-loss-mid-edit — refresh failure redirects to
login with no acknowledgment that unsaved work existed
(`roma/lib/auth/session.ts:240-242`).

## 6. Execution Sequencing (payoff ÷ risk)

| Order | Work | Why first |
| --- | --- | --- |
| 1 | J3/J4: Roma-owned editor header with the shared publish control; delete the dead Bob publish path; correct `bob.md` | The moment of value; design agreed |
| 2 | J5: confirmation ladder on the five destructive actions | Cheapest harm-prevention |
| 3 | J2: save confirmation, keystroke-revert explanation, spinner timeouts | The daily loop every user feels |
| 4 | J6: honest upgrade sentence | One string |
| 5 | J1: Home next-action + nav honesty | First impression |
| 6 | J8/J9 architect decisions (Copilot narration, embed failure face) | Blocked on product call |

## 7. Corrections To Collector Claims (verification record)

- "Immutable 1-year cache on locale/data files" — **false**:
  `isPublicPackageFile` gates serving to exactly index/styles/runtime before
  `cacheControlForGeneratedFile`'s immutable branch can execute
  (`clk-live-routes.ts:71, 80-84`). Unreachable branch.
- "Bob edit limits fail open on null policy" — **false**: `setPolicy` runs in
  the same synchronous `loadInstance` block that sets `compiled`
  (`bob/lib/session/useSessionBoot.ts:78-83`), and `applyOps` guards on
  `!compiled` first (`useSessionEditing.ts:26-37`). Race unreachable.
- "Partial package write is a V6 masquerade" — **downgraded**: failure is
  correctly reported as failure; serving gates on `serve-state.json`, so
  orphan bytes are unreachable and overwritten by the next Publish.

## 8. Open Architect Decisions

1. **Copilot narration timing** (Appendix 130A, section 4).
2. **Embed failure face**: empty iframe vs. explicit text (J9).
3. **Two invite acceptance paths**: confirm intended (J7).
