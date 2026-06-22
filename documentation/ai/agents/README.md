### `documentation/ai/agents/`

This folder is for **agent specs**: the durable prompts + operating rules for specific AI agents we run (or simulate in dev).

Current contents: `gtm.md` and `ux-writer.md` are future, unbuilt PRDs (pre-thesis; see the note atop each). The two live agent homes are `agents/product-copilot/` and `agents/translation-agent/`.

What belongs here:
- **Role specs**: mission, inputs/outputs, invariants, success metrics
- **Tools + permissions**: what the agent can call, what it must never do
- **Protocols**: message schemas, event contracts, budgets/caps rules, escalation rules
- **Templates**: reusable checklists and response formats

What does *not* belong here:
- Product PRDs (those live under `documentation/widgets/` or `documentation/strategy/`)
- Architecture truth docs (those live under `documentation/architecture/` and `documentation/services/`)


