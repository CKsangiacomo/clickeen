# Peer Review B - 121 Clickeen Agentic Framework Umbrella

Reviewer: Staff Engineering
Date: 2026-06-20
Basis: `121__PRD__Clickeen_Agentic_Framework_Umbrella.md`, all eight sub-PRDs
(121A–H), and Clickeen product law / current runtime reality (Bob in-memory
editor, Roma account+grant authority, San Francisco model-call gateway, a
control-matcher Copilot brain to be replaced).

## Verdict

Accept as the build charter. The umbrella's central act is honesty: it refuses
to call the current grant/router/validator plumbing "an agent," and it names the
hard part correctly — a brain that understands intent and chooses among answer /
ask / suggest / apply / tool / call-agent / refuse. That single reframing is
worth the whole document, and it is on-tenet (pre-GA, no legacy inertia; delete
the masquerade, don't harden it).

The umbrella's risk is its own length. At ~1,000 lines with ten open questions,
nine build stages, and three sub-planes (runtime / outcome / learning), it is
close to the over-documentation it warns against. It earns the length only
because the sub-PRDs stay short — but the umbrella should be read as a *charter
to be trimmed by reality*, not a spec to implement line by line.

## 1. Elegant Engineering And Scalability

- **The closed-system thesis (Section 1) is the real moat and it is correctly
  identified:** Clickeen can hand the agent the product map, allowed tools, and
  valid action space, so the model spends reasoning on the user and task, not on
  orientation. This is genuinely elegant and it is what makes Clickeen agents
  cheaper/safer than generic SaaS agents. It is the right center of gravity.
- **The two-planes scalability argument (Sections 1, 3.5) is the most important
  engineering insight in the series:** widget runtime scale = edge-serving scale;
  Ombra inference scale = authoring/background scale; learning scale = structured
  logs, not live LLM calls. Keeping live inference out of the visitor path is
  what lets the economics work. This is correct and should never be compromised.
- **"Product surfaces own truth and side effects; San Francisco orchestrates
  execution" is the durable boundary** and it propagates cleanly through every
  sub-PRD.

## 2. Compliance To Architecture And Tenets

- **Product law (Section 2): faithfully preserved.** Agents act through
  product-owned validated actions; they do not become truth owners. Every
  sub-PRD inherits this.
- **No-fake-framework tenet (OQ10, Section 10 anti-goals): this is the
  document's spine.** "Build Product Copilot first; extract shared framework only
  from real repeated needs; delete masquerade paths." This is the correct
  discipline and the sub-PRDs mostly hold to it.
- **Reconciliation gap with prior executed work.** The umbrella references 085
  and 120 as related/superseded but does not state, decision by decision, what
  121 *keeps from* vs *replaces in* those executed PRDs (085A learning loop,
  085C/D customer-vs-internal boundary, 120 platform architecture decision). The
  series re-opens topics those PRDs already touched. The umbrella must add a
  short **"what 121 supersedes in 085/120" ledger**, or the team cannot tell
  whether 121 is net-new architecture or a re-litigation of settled ground. This
  is the single most important edit; it is the same reconciliation debt that
  121D owes 103 and 121G owes 085A, but at series scope.

## 3. Over-Architecture / Unnecessary Complexity

- **The ten open questions (OQ1–OQ10) are the right questions, but presenting
  them as an options matrix risks implying all options get built.** They do not.
  The umbrella already states leanings for each — good — but it should explicitly
  say the **rejected options are deleted, not preserved as toggles.** A future
  reader should not be able to resurrect "Option A: product surface owns the
  brain" as a configurable path.
- **Nine San Francisco build stages (Section 8) is too many to be a plan.**
  Stages 1–5 (gateway → envelope → brain → tools → child-agent) are a real
  sequence; stages 6–9 (internal-agent guardrails, SDR guardrails, learning
  substrate, model strategy) are *guardrails*, not build stages, and the document
  says so ("Stages 6 through 9 exist now as architecture guardrails... not
  build-now commitments"). Then they should not be numbered as stages — numbering
  implies a build order. Re-label 6–9 as standing constraints to stop them
  reading as a roadmap.
- **The umbrella is the one place in the series with real over-documentation
  risk.** Sections 3.1–3.5, 4, and 6 repeat the same theses (Ombra-is-a-layer-
  not-a-model; provider independence; learning-is-governed) several times. The
  repetition is rhetorically deliberate but it inflates the charter. None of it
  is wrong; it is just longer than it needs to be to govern the eight tight
  sub-PRDs.

## 3b. Academic / Theoretical / Pre-Work / Gold-Plating

- **The prose discipline is good — concrete, declarative, story-driven** ("free
  user clicks the button → what happens"), no invented jargon. This matches the
  house tenet against academic framing.
- **The one theoretical over-reach is OQ8 (learning).** It sketches five learning
  options up to "global widget-network learning moat" and "Clickeen-tuned model
  path." These are correctly fenced as future/north-star, but the umbrella spends
  significant length on a capability that 121G reduces (correctly) to "add one
  outcome field and forbid silent mutation." The umbrella should compress its
  learning section to match 121G's restraint, so the charter does not read as
  more learning ambition than the build PRD authorizes.
- **No pre-work is authorized by the umbrella itself — good.** It explicitly
  defers self-hosting, child-agent calls, internal agents, and learning systems.
  The charter builds nothing; it constrains. That is the correct role.

## 4. Is This Simple, Boring, And Aimed At The Target Architecture?

The *spine* is simple and exactly right: admit the current thing is not an agent;
build one real Product Copilot brain on top of product-owned authority; keep
product truth and side effects with product surfaces; keep the visitor path
AI-independent; reserve everything else as a labeled seam. That spine moves
Clickeen directly toward the intended end state and refuses every shortcut that
would fake it.

It is *not* boring in form — it is a long, repetitive, ten-question charter. That
is tolerable because the sub-PRDs are short and the umbrella's job is to set
direction, not to be implemented. But the document would be stronger at half the
length with: a supersession ledger against 085/120, rejected options marked
deleted, stages 6–9 relabeled as constraints, and the learning section
compressed to 121G's altitude.

## Required Edits Before Treating As Final Charter

1. **Add a supersession ledger:** decision-by-decision, what 121 keeps from vs
   replaces in 085 (esp. 085A/085C/085D) and 120. Highest priority — without it
   the series may re-litigate settled architecture.
2. **Mark rejected OQ options as deleted, not preserved as configurable paths.**
3. **Relabel Section 8 stages 6–9 as standing constraints,** not numbered build
   stages, to stop them reading as a roadmap.
4. **Compress the learning material (OQ8, Section 3.5)** to match 121G's day-one
   restraint, so the charter does not imply more learning build than authorized.
5. Trim the repeated Ombra/provider/two-planes theses to a single authoritative
   statement each.

## Series-Level Note

Across all nine PRDs the consistent strength is product-law fidelity and the
refusal to fake agents; the consistent weakness is **reconciliation debt** — 121
vs 085/120, 121D vs 103, 121G vs 085A — and **front-loaded surfaces** (registries,
tool routing, child-agent routing, provider classes) listed before their callers
exist. Fixing reconciliation at the umbrella level and adding day-one-vs-deferred
labels in 121A/121B resolves most of the series' risk. The keystone build (121C)
is sound but must specify its two real interfaces — context capsule shape/budget
and the draft-action contract — before implementation.
