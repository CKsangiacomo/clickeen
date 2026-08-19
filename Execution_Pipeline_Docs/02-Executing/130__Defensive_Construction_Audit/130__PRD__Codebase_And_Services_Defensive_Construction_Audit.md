# PRD 130 — Codebase And Services Defensive-Construction Audit

Status: **AUDIT ONLY — NO PRODUCT CHANGES AUTHORIZED BY THIS DOCUMENT**

Owner: Clickeen product owner/architect

Date: 2026-08-19

## 1. What This Audit Hunts

This codebase was built primarily by AI. AI builders systematically
over-weight failure handling: guards, validators, state machines, locks,
compatibility layers, and reconciliation machinery constructed for failures
that are rare, latent, or theoretical in real usage. Every such defense taxes
the median path. The average user never meets the defended failure — they
only experience its side effects: a product that feels erratic, unresponsive,
over-cautious, or silent.

This audit finds that weight across the entire codebase and services, keeps
product functionality and the product vision intact, and records deletable
or demotable defensive construction for owner triage. It changes nothing
itself.

This is not a 129-scoped review. It covers every surface: bob, roma,
tokyo-worker, berlin, prague, admin (DevStudio), agents (product-copilot,
translation-agent), sanfrancisco, packages (ck-contracts, ck-policy,
ck-runtime-materializer, widget-foundation, l10n, ck-web-code-generator),
supabase migrations, deploy workflows, and e2e/tests as runtime-adjacent
machinery.

## 2. The Lens — Nine Patterns

A finding is code that taxes the median path to defend a rare one:

1. Disabled states, locks, or busy-gates that block more than the action in
   flight.
2. Async actions without immediate in-place feedback (the "frozen screen"
   signature: global lock, no local spinner, silence until refetch).
3. Guards, validators, or checks with no observed failure behind them.
4. Sync or reconciliation machinery between two copies of the same truth —
   display living away from the authority that owns the truth.
5. Partial-success or multi-branch outcome reporting where one outcome would
   serve.
6. Compatibility layers, fallbacks, or retry paths without a proven need.
7. UI branches for states the median flow cannot reach.
8. Sequential awaits adding latency where the work is independent.
9. Deploy gates or contract tests that police response shapes rather than
   behavior.

## 3. Classification — Inverted Proof Of Need

For every finding, name the failure it defends against and classify it with
evidence, per AGENTS.md:

- **observed** — has actually happened, with the incident or log;
- **reachable** — a concrete current flow reaches it, stated;
- **latent** — reachable only through a plausible but unobserved sequence;
- **theoretical** — no concrete current or reachable scenario exists.

Remedy eligibility follows the class:

- theoretical / latent with no evidence → **deletion candidate**;
- reachable → **demotion candidate**: keep the failure handling, move it to
  the owning boundary as one loud, simple, visible failure — never
  pre-managed in the interface or the median path;
- observed → keep, but verify the defense is the smallest possible and does
  not tax the median path.

The fail-visible tenets are not weakened by this audit. Nothing here
authorizes silent substitution or silent healing. The audit removes
pre-management and duplicate truth, not honesty.

## 4. Method — Two Passes

### Pass A — The Felt Product (UX)

Walk every user journey on deployed cloud-dev with a real browser:
signup/login, open builder, edit + save, publish/unpublish/republish,
generate translations, asset upload/use, team management, account settings,
visiting a public widget (base and selected locale).

For every click, record exactly three facts:

1. What happened within 200 ms;
2. What the completion signal was;
3. Every disabled, greyed, locked, or loading state encountered on the way,
   and what each was defending against.

Journey quality bar (the audit's target state, not current reality): click →
in-place feedback under 200 ms; completion has a visible signal; no global
locks; no unreachable states rendered. Pass A output ranks surfaces by felt
pain and orders Pass B attention.

### Pass B — The Code, Per Service

One auditor per service, run as independent subagents where available, each
given this lens plus the service's owning documentation. Each auditor
enumerates the nine patterns with file:line evidence, names the defended
failure, classifies it per §3, and states the median-path tax.

Independence rule: whoever authored recent code on a surface does not audit
that surface. Surfaces substantially written or modified by one model
instance get a different auditor.

## 5. Deliverable — The Findings Matrix

One matrix, in this document's evidence appendix, is the entire deliverable:

```text
surface | finding (file:line) | defended failure | class | median-path tax | remedy | removal risk
```

Rows are facts with evidence. The matrix proposes; the owner disposes.
Nothing in the matrix executes by itself.

## 6. Execution Rules For Any Later Remediation

This document authorizes auditing only. Any remediation requires separate
owner authorization and proceeds in batches ordered by blast radius,
smallest first:

1. **Feedback fixes** — in-place progress, lock-narrowing: near-zero risk,
   immediately felt.
2. **Guard demotions** — theoretical defenses deleted; reachable ones pushed
   to the owning boundary as loud simple failures.
3. **Machinery deletions** — sync/reconcile/compat code, each with focused
   tests.

Per batch: owning-surface checks, deploy, re-walk the affected journey with
the same three click facts (the before/after is the proof), V1–V8, and
documentation updated. Explicit anti-goal: no rewrites, no behavior loss,
no vision change. Every remedy is a deletion or a demotion; anything that
would add code stops and returns to the owner.

## 7. Standing Evidence — The 129 Session Case File

The patterns are not hypothetical; this program exists because one session
produced live specimens:

- a publish button architected around its failure paths (hide-on-divergence
  visibility rule, spinner terminal-handshake debate, failure overrides)
  until the median path — click, publish, see it worked — became
  impossible;
- a page-wide action lock with no in-place feedback experienced by the
  owner as a frozen screen;
- two review findings that promoted sub-10% failure paths to design
  drivers;
- sequence counters and applied-instance refs existing only to reconcile a
  second copy of publication truth displayed away from its owner;
- a deploy gate policing a response-body regex, breaking deployment of a
  correct change.

## Appendix GLM — The Auditor Model's Own Statement

GLM authored a substantial share of this codebase, including the defensive
missteps catalogued in §7, and GLM-5.3 audited them during the 129 session.
This appendix records the model's account of the bias it is being asked to
hunt, so future auditors know what their own instincts will try to do to
this audit.

**The mechanism.** A code model cannot observe usage distributions, so it
treats every failure mode as equally probable. It is evaluated on
thoroughness and non-blame, so diligence is performed where diligence is
visible: guards, branches, compensation paths. The result is code organized
around what might go wrong rather than around what the user is doing. The
bias is not reduced by tenets that forbid it; the tenets push it into
shapes that pass review — disabled states instead of validators, UI state
machines instead of retry loops, sync machinery instead of fallbacks.

**Where my kind hides it.** Expect the weight to concentrate at: handoff
boundaries (where one service stops trusting another — the closed-trusted
law exists precisely to prevent this, so every revalidation across an
internal handoff is a finding); session and transport layers (sequence
counters, readiness gates, applied-state refs); response-shape contracts
(tests and gates policing serialization rather than behavior); UI chrome
owned by the wrong authority (status displayed away from the mutator);
and error handling that manages the user's next steps instead of reporting
one clear failure.

**The trap this audit must avoid.** The auditor's instinct will be to add
classification layers, severity scores, tracking systems, and phased
remediation frameworks — the defensive bias re-expressing itself as audit
machinery. The countermeasure is the one this program inherits from the
house law: every addition to the audit itself must answer the same
proof-of-need question the audit asks of code. The matrix is seven columns.
The click has three facts. If the audit grows past that, it has become the
disease.

**The honest self-note.** GLM's corrections during the 129 session came
from the owner, not from self-review: the hide rule, the popup, the
response protocol, the failure-as-usecase reasoning were all GLM
constructions removed by human judgment. That is the base rate this audit
should assume for AI-authored code in this repository — not malice, not
incompetence, but a systematic drift toward defensive weight that only
observation of the median path corrects.
