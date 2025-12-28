STATUS: HISTORICAL — SUPERSEDED
This file is a historical review note and is NOT execution guidance.
The execution PRD for the AI system is: `documentation/systems/sanfrancisco.md`.

# San Francisco Review Notes (2024‑12‑25)

## What was true at the time
- Phase‑1 AI lived inside Bob as a local route: `bob/app/api/ai/faq-answer/route.ts`.
- The editor was moving toward strict AI edits via `ops[]` + a controls allowlist.

## Why this review is obsolete now
- We are executing a GA-shaped separation:
  - Paris = product policy + DB authority (issues AI Grants)
  - San Francisco = AI execution service (orchestration + provider calls)
- The detailed plan, contracts, and milestones now live in `documentation/systems/sanfrancisco.md`.
