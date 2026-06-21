STATUS: REFERENCE — MUST MATCH RUNTIME

# Product Copilot

Product Copilot is the Builder-facing Clickeen agent brain.

Code lives in:

```text
agents/product-copilot/
```

## Authority

Product Copilot owns:

- Product Copilot reasoning instructions.
- The `product-copilot.context.v1` capsule interpretation.
- The typed output union:
  `answer | clarification | suggestion | draft_edit | refusal | error`.
- Structural validation of its own `draft_edit` ops before returning.
- One bounded structural retry when model output is malformed.

Product Copilot does not own:

- account/session truth;
- grant issuance;
- provider keys;
- saved product data;
- Bob browser-memory draft state;
- Bob terminal draft validation/apply;
- Roma save/publish routes;
- Tokyo account storage.

## Runtime Flow

```text
Bob builds product-copilot.context.v1 from the open draft
-> Roma validates account/widget authority and mints the AI grant
-> San Francisco verifies the grant and calls the Product Copilot brain module
-> Product Copilot asks San Francisco's model executor for governed model calls
-> San Francisco records trace/usage and returns the typed result
-> Bob validates/applies draft_edit ops, if any
```

The browser never calls a model provider.

San Francisco does not store Product Copilot conversation/thread state.

## Eval Gate

The day-one Product Copilot eval harness lives in:

```text
agents/product-copilot/evals/
```

Run:

```bash
pnpm --filter @clickeen/product-copilot eval:product-copilot
```

This harness uses deterministic mocked model outputs to check the Product
Copilot output union, bounded structural retry, draft-edit shape, and wording
that must not claim Bob-applied product success before Bob validates/applies
the draft edit.

## Context Capsule

The capsule is bounded and product-owned. It includes only facts needed for the
current Builder turn:

- instance id;
- widget type/display name;
- active locale;
- draft signature;
- visible editable controls and current draft values;
- declared available actions;
- unavailable capabilities;
- bounded conversation history from Bob.

It does not include hidden Builder controls, unrelated account data,
cross-account data, SDR/prospect data, widget package source, or saved-product
mutation authority.

Malformed, missing, forbidden, stale, or oversized context fails visibly. It is
not silently substituted.
