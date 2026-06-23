# Ombra

STATUS: STRATEGY GUARDRAIL - NOT A RUNTIME SERVICE

Ombra is Clickeen's product AI layer and model strategy name.

Ombra is not:

- one provider;
- one model;
- San Francisco;
- an agent home;
- visitor runtime;
- a Cloudflare Worker in the current system.

## Meaning

Users experience Clickeen AI as product behavior: Builder help, translation,
optimization, future support, future DevOps operations, and future growth work.
Ombra is the product layer that keeps those experiences Clickeen-shaped while
models underneath can change.

San Francisco remains the governed model-execution engine. Agent homes remain
the operators. Models are execution dependencies.

## Current Runtime

There is no separate Ombra runtime service in the repo.

Current live AI runtime is:

```text
Product Copilot Worker -> San Francisco /v1/model/chat
Translation Agent Worker -> San Francisco /v1/model/chat
```

## Model Strategy

The model/provider layer must stay explicit and closed-system:

- no silent fallback;
- no model string guessing;
- no runtime provider probing on product requests;
- no visitor request path model calls;
- no docs JSON as runtime model truth.

Future model catalog monitoring, conformance checks, and model-file updates
belong to the planned DevOps Agent. San Francisco executes the configured model
route it receives under a signed policy.

## Public Runtime Boundary

Published widgets and pages serve generated files from the runtime plane. They
must not call Ombra, San Francisco, or live model routes during visitor
requests.
