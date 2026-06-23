# DevOps Agent

STATUS: PLANNED - NOT BUILT

DevOps Agent will be Clickeen's internal operations agent. It will operate
structured operational artifacts on a schedule or through monitoring jobs.

It is not built in the current repo. It is not a current runtime authority.

## Product Role

DevOps Agent will handle operational maintenance that should not live in normal
product request paths.

Examples:

- provider/model catalog monitoring;
- model maintenance runs;
- updating San Francisco model config/artifacts after provider changes;
- Cloudflare config drift reports;
- deploy health reports;
- scheduled operational cleanup reports;
- action logs for work that needs human or agent follow-up.

## Run Shape

DevOps Agent may run:

- on a cron schedule every fixed interval;
- as a monitor when a specific operational surface needs continuous watching.

Each job must be explicit. DevOps Agent is not a generic superadmin and not a
hidden product service.

## Outcome Types

DevOps Agent outcomes have two shapes.

### Direct Update

For deterministic, authorized operations, DevOps Agent updates the owned
artifact directly.

Example:

```text
OpenAI publishes a new model
-> DevOps Agent detects it
-> checks Clickeen model policy
-> updates the model config/artifact San Francisco consumes
-> commits through the approved path
```

### Action Log

For ambiguous, risky, strategic, or authority-changing work, DevOps Agent writes
an action log for human or later agent action.

Example:

```text
Cloudflare live config differs from repo config
-> DevOps Agent records the mismatch
-> human/agent decides whether to change repo or live config
```

## Model Management

Future model conformance and provider catalog monitoring belong here. San
Francisco should not run per-request model conformance checks and should not
read runtime model truth from `documentation/`.

DevOps Agent keeps model artifacts current. San Francisco executes the
configured route and returns explicit provider errors when the route cannot run.
