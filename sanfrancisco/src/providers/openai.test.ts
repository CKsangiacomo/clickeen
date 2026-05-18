import assert from 'node:assert/strict';
import test from 'node:test';
import { callOpenAiChat } from './openai';
import type { Env } from '../types';

test('OpenAI GPT-5 translation requests constrain reasoning and require JSON schema output', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = init?.body ? JSON.parse(String(init.body)) : null;
    return new Response(
      JSON.stringify({
        model: 'gpt-5-mini',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                items: [{ path: 'header.title', value: 'Domande frequenti' }],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 12,
          completion_tokens_details: { reasoning_tokens: 2 },
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const result = await callOpenAiChat({
      env: { OPENAI_API_KEY: 'test-key' } as Env,
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: 'Return JSON.' },
        { role: 'user', content: 'Translate.' },
      ],
      temperature: 0.2,
      maxTokens: 900,
      timeoutMs: 1000,
    });

    assert.equal(result.content, '{"items":[{"path":"header.title","value":"Domande frequenti"}]}');
    assert.equal(requestBody?.model, 'gpt-5-mini');
    assert.equal(requestBody?.reasoning_effort, 'minimal');
    assert.equal(requestBody?.max_completion_tokens, 900);
    assert.equal(requestBody?.temperature, undefined);
    assert.equal(requestBody?.response_format?.type, 'json_schema');
    assert.equal(requestBody?.response_format?.json_schema?.strict, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenAI empty responses include model, finish reason, and reasoning token detail', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        model: 'gpt-5-mini',
        choices: [{ finish_reason: 'length', message: { content: '' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 900,
          completion_tokens_details: { reasoning_tokens: 900 },
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        callOpenAiChat({
          env: { OPENAI_API_KEY: 'test-key' } as Env,
          model: 'gpt-5-mini',
          messages: [{ role: 'user', content: 'Translate.' }],
          temperature: 0.2,
          maxTokens: 900,
          timeoutMs: 1000,
        }),
      /Empty model response for gpt-5-mini; finish_reason=length; completion_tokens=900; reasoning_tokens=900/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
