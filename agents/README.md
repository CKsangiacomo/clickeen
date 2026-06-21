# Clickeen Agents

This directory is the home for Clickeen agent brains.

Each real agent gets one self-contained folder:

```text
agents/
  product-copilot/
  translation-agent/
```

Agent folders own agent-specific reasoning, prompt construction, output
contracts, self-validation, and evals.

Agent folders do not own product truth, account/session state, provider keys,
storage, or cross-agent shared utilities. Shared primitives belong in neutral
packages such as `packages/l10n` or `packages/ck-contracts`.

Product surfaces may keep thin invocation/adaptor code where the product
authority lives:

- Bob owns browser-memory Builder draft state.
- Roma owns account/session/grant routes.
- San Francisco owns governed model execution.
- Tokyo-worker owns account runtime storage.

If agent brain behavior starts appearing outside `agents/<agent-name>/`, that
is architecture drift and should be moved back into the agent home or into a
neutral shared package if it is genuinely shared.
