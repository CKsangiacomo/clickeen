# Planned Agents

STATUS: PLANNED - NOT BUILT

This folder contains one planning spec per future Clickeen agent.

Root-level agent files are planned-agent specs. Supporting research lives under
`Research/` and is not itself a planned agent.

There is no separate generic future-agent umbrella PRD. A planned agent earns
its place by naming a concrete product job and the structured artifact it will
operate. If the job is not concrete enough for its own file, it is not ready to
be planned as an agent.

These agents are not current runtime authority until an execution PRD builds a
real agent home and the docs move to `documentation/ai/agents/`.

Rules:

- Planned agents do not appear in current authority tables.
- Planned agents do not own product/runtime behavior.
- Planned agents do not create model policy, storage, or service boundaries.
- Planned agents do not imply a generic workforce dashboard, registry UI,
  marketplace, memory layer, agent mesh, lifecycle platform, or placeholder
  runtime.
- Planned agents do not inherit Product Copilot contracts unless their own
  execution PRD proves that is the right shape.
- Before execution, each planned agent must be re-grounded in the current
  agent-operated product law.
- Before execution, each planned agent must explain why an existing agent or
  product workflow cannot own the job.

Each planned-agent file should answer:

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

Current planned agents:

- `devops-agent.md`
- `gtm.md`
- `ux-writer.md`
- `seo-geo-aeo.md`
- `sdr-copilot.md`

Supporting research:

- `Research/LLM_Provider_Landscape_June2026.md`
