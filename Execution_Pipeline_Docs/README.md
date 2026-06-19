# Execution Pipeline Docs (Non-Canonical, Process Only)

This folder is the **process log** for how work moves from idea → plan → execution → history.  
It is **not** the source of truth for runtime behavior.

**Authority rule (non-negotiable):**
- **System truth lives in `documentation/` + runtime code + DB schema + deployed config.**
- If anything here conflicts with `documentation/`, **assume this folder is stale**.

## Who owns which stage
- **Human (strategy)**: drafts direction with AIs; scope and decisions may change.
- **AI teams (planning/executing)**: tighten contracts, execute end‑to‑end, then update canonical docs.

## Pipeline stages (what each folder means)

### `00-Strategy/` — Human + AI brainstorming
- Raw ideas, explorations, and rough drafts.
- May be reviewed or ignored.
- Strategy PRDs are **unnumbered** and use the filename prefix `strategy_PRD`.
- Do not reserve execution numbers in Strategy.
- **Never execute from here.**

### `01-Planning/` — Peer review + architecture alignment
- PRDs moved here **only when the team wants to make them real**.
- Peer review, corrections, scope adjustment, architecture alignment, and contract tightening happen here.
- Goal: make the plan executable without ambiguity.
- Planning PRDs are **unnumbered** and use the filename prefix `planning_PRD`.
- Do not reserve execution numbers in Planning.
- **First review must answer (explicitly):**
  1) Does the plan use elegant engineering and scale across 100s of widgets?
  2) Is it compliant with architecture and tenets?
  3) Does it avoid over‑architecture or unnecessary complexity?
  4) Does it move us toward the intended architecture and goals?

### `02-Executing/` — Execution‑ready spec
- Final pass to ensure **every detail required for AI execution is present**.
- AIs may execute only when the PRD is here and is consistent with current code/contracts.
- If gaps are found, fix the PRD here before coding.
- PRDs receive execution numbers **only when moved into this folder**.
- **End-of-execution requirement:** update `documentation/` to match what shipped **before** moving the PRD to `03-Executed/`.

### `03-Executed/` — Historical record (after completion)
- Used only for history and audit.
- **Before moving here, you must update `documentation/`** to reflect what actually shipped.

## Movement rules (hard gates)

1) **Strategy → Planning** only when intent is real and we want it built.  
2) **Planning → Executing** only after peer review and architecture alignment.  
3) **Executing → Executed** only after:
   - code changes are done, and
   - **`documentation/` is updated to match the executed PRD**.

If any step is skipped, the pipeline is broken and docs will drift.

## Numbering rule

PRD numbers are execution identifiers, not idea identifiers.

- `00-Strategy/`: use `strategy_PRD__Descriptive_Title.md`.
- `01-Planning/`: use `planning_PRD__Descriptive_Title.md`.
- `02-Executing/`: assign the next execution number when the PRD becomes the
  active execution spec.
- `03-Executed/`: preserve the execution number assigned in `02-Executing/`.

This keeps the taxonomy clean. Strategy and Planning can change, merge, split,
or be withdrawn without consuming numbers. The number becomes meaningful only
when the work is ready to execute, because that is when sequence, audit trail,
commit evidence, and executed history need a stable identifier.
