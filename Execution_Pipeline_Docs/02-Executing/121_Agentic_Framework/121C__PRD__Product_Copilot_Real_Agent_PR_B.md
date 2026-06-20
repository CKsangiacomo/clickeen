# Peer Review B - 121C Product Copilot Real Agent

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121C__PRD__Product_Copilot_Real_Agent.md`, 121A, 121B, the 121 umbrella,
and current Bob/Roma/San Francisco reality (in-memory widget editor with op
validation/apply/undo; Roma account+grant authority; SF model-call gateway; a
control-matcher/regex Copilot brain to be removed).

## Verdict

Accept — this is the keystone PRD and it is pointed at the right target. 121C is
the only PRD in the series with a real forcing function: replace the
control-matcher brain with an agent that decides among answer / ask / suggest /
apply / tool / refuse. Everything in 121A and 121B is provisional until 121C
proves it, and 121C knows that.

The weakness is the opposite of over-architecture: 121C is **under-specified on
the two hardest engineering surfaces** — the context capsule's concrete shape
and size budget, and the streaming/apply protocol between the agent's reasoning
and Bob's validator. These are the places where this build actually succeeds or
fails, and the PRD currently describes them as bullet lists. Tighten those two
and this is buildable.

## 1. Elegant Engineering And Scalability

- **"Conversation first, routing never" (Section 4) is the correct inversion**
  and the whole point of the series. The first step is the model reasoning over
  the turn, not a pre-filter deciding what the user "meant." This is what kills
  the regex brain for real instead of renaming it.
- **The decision set {answer, ask, suggest, apply, tool, call-agent, refuse} is
  the right output taxonomy.** It is small, exhaustive enough for v1, and maps
  cleanly to UX. Making the agent *choose* among them (Acceptance criterion 3)
  is the single test that separates a real agent from an edit bot.
- **Reusing Bob's existing validate/apply/undo machinery (Section 7)** is the
  scalable, boring move. The agent proposes; Bob's existing op validator is the
  safety boundary; the user owns Save. No new mutation path. Correct.

## 2. Compliance To Architecture And Tenets

- **Product law: fully compliant.** Bob owns in-memory session, validates edits,
  applies reversible ops; user owns Save; Roma owns persistence; "the model
  never bypasses this" (Section 7). This is the cleanest statement of product
  law in the series.
- **No-legacy-inertia tenet: compliant and explicit.** Section 3 non-goals and
  Acceptance criterion 6 require the hardcoded control matcher *removed from the
  agent-brain path*, not wrapped or feature-flagged. Good — that is delete, not
  migrate.
- **One compliance gap to close:** Acceptance says "current hardcoded control
  matcher is removed from the agent-brain path" — but the umbrella notes the
  control machinery may contain *reusable validation mechanics*. The PRD must
  distinguish **removing the matcher as the brain** (required) from **deleting
  the op-validation code** (must be kept — it is Bob's safety boundary).
  As written, a literal reader could rip out the validator with the matcher.
  Name the line.

## 3. Over-Architecture / Unnecessary Complexity

Low risk here — 121C is appropriately narrow. Two small watch-items:

- **Capability list creep (Section 6).** The "later capabilities" (analytics
  call, translation-agent call, QA/recommendation call, account/page workflow
  tools) are correctly marked "later does not mean build now." Keep them in a
  clearly fenced subsection so the v1 build is unambiguously {answer, guidance,
  edit-suggestion, validated-draft-edit, clarification, undo-aware, refusal}.
  The danger is a builder treating the "later" list as scope.
- **Do not build the child-agent path in 121C.** Section 4 lists "call another
  agent when allowed" as a decision branch and Section 6 lists "translation
  agent call." Per 121B slice 8, child-agent routing comes after two agents
  exist. v1 Product Copilot should be able to *emit* the decision but the route
  should be a stub that returns "not available yet," not a built pathway.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

The risk in 121C is **under-specification masquerading as simplicity**, which is
the inverse failure but just as costly:

- **The context capsule (Section 5) is the hardest real engineering in the
  series and it is a bullet list.** "Current draft state summary, editable
  schema/control map, selected element, ... version metadata" — every one of
  those is a serialization decision with a token-budget consequence. The
  umbrella's whole thesis (closed AI-legible system → cheap orientation) lives
  or dies on this capsule being *compact and typed*. 121C must specify: a token
  or byte budget, what gets summarized vs sent raw, and what is explicitly
  marked unavailable. Without a budget this capsule will balloon into "full raw
  product state" (the umbrella's rejected Option B) by accident.
- **The reasoning→apply protocol is undefined.** When the agent decides
  "apply," what exactly crosses back to Bob? A typed op? The old
  `resolved_edit | multi_op_plan` envelope (which the umbrella says must not
  define the new architecture)? 121C must state the *new* draft-action contract
  Bob validates, or it inherits the legacy envelope by default. This is the most
  important undefined interface in the document.
- **No gold-plating, no jargon — good.** The PRD does not invent a planner
  abstraction or a memory subsystem. It stays at product-behavior altitude,
  which is correct.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

This is the PRD that makes the whole series real, and its core is simple and
boring in the right way: the user talks, the agent reasons, the agent decides
one of a small set of moves, Bob validates and applies, the user saves. No new
truth owner, no new mutation path, no generic framework. It moves Clickeen
directly to the intended end state — a real Product Copilot brain on top of
product-owned authority — and it explicitly deletes the masquerade instead of
preserving it.

It earns "Accept" rather than "Accept with edits" only if the two undefined
interfaces — **capsule shape+budget** and **draft-action contract** — are
specified before build. Those are not optional details; they are the engine.

## Required Edits Before Build

1. **Specify the context capsule concretely:** token/byte budget, summarized-vs-
   raw fields, and explicit "unavailable" markers. This is the umbrella's thesis
   made real or broken.
2. **Define the new draft-action contract** the agent emits and Bob validates.
   Do not inherit the legacy `resolved_edit | multi_op_plan` envelope by
   default.
3. **Distinguish "remove the control matcher as the brain" (required) from
   "delete Bob's op validator" (forbidden — it is the safety boundary).**
4. **Fence v1 capabilities** from the "later" list so analytics/translation/QA/
   child-agent calls are not pulled into scope.
5. **Stub the child-agent decision branch** — the agent may choose it; the route
   returns "not available yet" until a second agent exists (per 121B).
