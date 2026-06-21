STATUS: REFERENCE - MUST MATCH RUNTIME
This document describes the current Translation Agent brain home. Runtime code is operational truth.
Last synced to repository runtime: June 20, 2026.

# Translation Agent

## Identity

- Agent ID: `widget.instance.translator`
- Brain home: `agents/translation-agent/`
- Runtime type: structured-output workflow, not a conversational Copilot loop.
- Invoked by: existing San Francisco account-widget instance translation endpoints.

The Translation Agent is a focused internal product worker. It translates saved
widget-instance text into an enabled locale and returns exact path/value output
for the owning product workflow to accept and store.

## Ownership

Translation Agent owns:

- Translation prompt construction.
- Richtext visible-text segmentation and restoration.
- Non-translatable literal classification for empty values, URLs, emails,
  token-only placeholders, and structure-only values.
- Placeholder, HTML tag, and anchor integrity validation.
- Exact output path preservation.
- Structured translated-value production.

Translation Agent does not own:

- Account/session truth.
- Grant issuance.
- Provider keys.
- Product save/apply/review workflows.
- Tokyo storage.
- Public widget runtime bytes.

## Runtime Flow

1. Roma or an internal workflow invokes the existing account-widget translation endpoint.
2. San Francisco verifies the signed grant for `agent:widget.instance.translator`.
3. San Francisco adapts the request into Translation Agent brain functions.
4. Translation Agent builds model batches and validates the structured output.
5. San Francisco executes governed model calls through the shared policy router and records trace metadata.
6. The owning product workflow accepts and stores translated locale overlays through the existing product path.

Keeping the endpoint in San Francisco does not make San Francisco the
translation brain. San Francisco remains the grant/model-execution adapter;
`agents/translation-agent/` owns the translation-specific reasoning, structure, and
validation.

## Failure Rules

The workflow fails visibly for:

- Missing output path.
- Extra output path.
- Duplicate output path.
- Malformed JSON.
- Output size mismatch.
- Placeholder mismatch.
- Richtext tag mismatch.
- Richtext anchor mismatch.

It must not drop invalid values, invent missing paths, partially apply a
translation set, or treat corrupt output as absence.

## Eval Gate

The repository-owned eval harness lives in `agents/translation-agent/evals/` and runs:

```bash
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

It is a deterministic acceptance/regression gate for the V1 structured-output
contract. It does not call an LLM. The current gate covers locale/prompt
instruction, token-only literal protection, batch path preservation, malformed
provider JSON, exact path/schema preservation, placeholder parity, richtext tag
and anchor preservation, and missing richtext segment rejection.
