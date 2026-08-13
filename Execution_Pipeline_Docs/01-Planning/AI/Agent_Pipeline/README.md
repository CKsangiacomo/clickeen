# Agent Pipeline

STATUS: PLANNED — NOT BUILT

This subfolder contains one planning spec per future Clickeen agent being
considered.

The pipeline represents Clickeen's future AI workforce, not a list of AI
features to bolt onto existing screens. Each promoted agent must own a concrete
operational job over structured Clickeen truth through named authorities.

**This is a pipeline, not a runtime.** Nothing here is a current agent. These
are planned or considered agents. The exactly two current runtime agents —
Product Copilot and Translation Agent — are the real authorities. Pipeline
agents do not appear in authority tables, do not own product behavior, and do
not create model policy until an execution PRD builds them and they move to
documentation.

## Rules

- Pipeline agents do not appear in current authority tables.
- Pipeline agents do not own product/runtime behavior.
- Pipeline agents do not create model policy, storage, or service boundaries.
- Pipeline agents do not imply a generic workforce dashboard, registry UI,
  marketplace, memory layer, agent mesh, lifecycle platform, or placeholder
  runtime.
- Pipeline agents do not inherit Product Copilot contracts unless their own
  execution PRD proves that is the right shape.
- Before execution, each pipeline agent must be re-grounded in the current
  agent-operated product law.
- Before execution, each pipeline agent must explain why an existing agent or
  product workflow cannot own the job.

A pipeline agent earns its place by naming a concrete product job and the
structured artifact it will operate. If the job is not concrete enough for its
own file, it is not ready to be planned.

Each pipeline-agent file should answer:

- What agent is this?
- What product job does it own?
- What structured artifact does it operate?
- What content source authority applies?
- What can it read?
- What can it write?
- What can it never touch?
- What triggers it?
- What proves it worked?
- What future execution PRD is required before build?

## Current pipeline agents

- `devops-agent.md`
- `gtm.md`
- `sdr-copilot.md`
- `seo-geo-aeo.md`

## Relationship to Ombra

The Ombra model strategy (`../planning_PRD__Ombra_Model_Strategy_And_Self_Hosted_Readiness.md`)
is the foundation for every agent in this pipeline. It defines how agent homes
remain independent from model providers and why self-hosting is a step toward
Clickeen-owned intelligence rather than the end state itself.

When an agent is promoted from pipeline to execution, its execution PRD must
reference the Ombra model strategy for model selection, tooling, and cost
constraints.
