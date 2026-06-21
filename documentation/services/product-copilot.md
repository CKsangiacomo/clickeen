STATUS: REFERENCE — MUST MATCH RUNTIME

# Product Copilot

Product Copilot is the Builder-facing Clickeen agent brain.

Code lives in:

```text
agents/product-copilot/
```

Runtime lives in the Cloudflare Worker configured by:

```text
agents/product-copilot/wrangler.toml
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
-> Roma calls the Product Copilot worker at PRODUCT_COPILOT_BASE_URL
-> Product Copilot asks San Francisco's /v1/model/chat endpoint for governed model calls
-> San Francisco records trace/usage and returns the typed result
-> Bob validates/applies draft_edit ops, if any
```

The browser never calls a model provider.

San Francisco does not execute the Product Copilot brain and does not store
Product Copilot conversation/thread state.

## Worker Contract

`POST /v1/execute` belongs to the Product Copilot worker, not San Francisco.

Request:

```json
{ "grant": "<signed AI grant>", "agentId": "cs.widget.copilot.v1", "input": {} }
```

Response:

```json
{ "requestId": "<id>", "agentId": "cs.widget.copilot.v1", "result": {}, "usage": {} }
```

The worker verifies the Product Copilot input shape, runs Product Copilot
reasoning, and calls San Francisco only for provider/model execution under the
same signed grant.

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
the draft edit. It also asserts visible terminal failure for malformed model
output, rejects non-edit responses that smuggle draft payloads, records expected
model-call counts, and prints pass@1, retryRecovered, passFinal, and total
model calls.

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

Conversational turns and draft-edit turns have different context requirements.
The widget/session orientation is required for every turn. The edit-control
catalog is required only for `draft_edit`. When the edit-control catalog is
missing, malformed, or invalid, Product Copilot treats draft editing as
unavailable for that turn and may still return `answer`, `clarification`,
`suggestion`, `refusal`, or `error`. It must not invent controls, silently drop
bad controls, or claim an edit succeeded.

Invalid required request context is different from degraded edit context. If
the required widget/session orientation is missing or malformed, the turn fails
visibly as an invalid Product Copilot request. If only edit controls are
invalid, the turn may continue but `draft_edit` is unavailable.
