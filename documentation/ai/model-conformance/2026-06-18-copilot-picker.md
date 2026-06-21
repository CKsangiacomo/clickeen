# AI Model Conformance - Copilot Picker

Date: 2026-06-18T21:42:52Z
Surface: San Francisco Builder Copilot provider-call proof
Scope: PRD 120A1 Slice 1 model request shapes

This is release evidence only. Normal product work does not call this proof and does not
depend on a runtime test, probe, or validation ritual.

## Result

| Provider | Model | Token parameter | Temperature sent | HTTP status | Content | Usage | Returned model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DeepSeek | `deepseek-chat` | `max_tokens` | yes | 200 | yes | yes | `deepseek-v4-flash` |
| OpenAI | `gpt-5-mini` | `max_completion_tokens` | no | 200 | yes | yes | `gpt-5-mini-2025-08-07` |
| OpenAI | `gpt-5` | `max_completion_tokens` | no | 200 | yes | yes | `gpt-5-2025-08-07` |
| OpenAI | `gpt-5.2` | `max_completion_tokens` | no | 200 | yes | yes | `gpt-5.2-2025-12-11` |

## Proof Command Shape

Each row was called through the provider chat-completions endpoint with one user message:
`Reply with exactly: ok`.

No provider response body, API key, or raw upstream error is stored in this report.
