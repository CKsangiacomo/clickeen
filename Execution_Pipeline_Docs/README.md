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
- **Never execute from here.**

### `01-Planning/` — Peer review + architecture alignment
- PRDs moved here **only when the team wants to make them real**.
- Peer review, corrections, scope adjustment, architecture alignment, and contract tightening happen here.
- Goal: make the plan executable without ambiguity.
- **First review must answer (explicitly):**
  1) Does the plan use elegant engineering and scale across 100s of widgets?
  2) Is it compliant with architecture and tenets?
  3) Does it avoid over‑architecture or unnecessary complexity?
  4) Does it move us toward the intended architecture and goals?

### `02-Executing/` — Execution‑ready spec
- Final pass to ensure **every detail required for AI execution is present**.
- AIs may execute only when the PRD is here and is consistent with current code/contracts.
- If gaps are found, fix the PRD here before coding.
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
