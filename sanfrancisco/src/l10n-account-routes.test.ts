import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleInstanceTranslationAgent,
  normalizeInstanceTranslationAgentRequest,
  produceCurrentLanguageValues,
  produceInstanceTranslationValues,
} from './l10n-account-routes.ts';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import { resolveAiRuntimePolicy } from '@clickeen/ck-policy';
import { buildUserPrompt } from './agents/l10nTranslationCore.ts';
import type { AIGrant, Env, InteractionEvent } from './types.ts';

const grant: AIGrant = {
  v: 1,
  iss: 'roma',
  sub: { kind: 'user', userId: 'usr_test', accountId: 'acc_test' },
  exp: Math.floor(Date.now() / 1000) + 60,
  caps: ['agent:widget.instance.translator'],
  budgets: { maxTokens: 1000 },
  mode: 'ops',
};

const env = {
  AI_GRANT_HMAC_SECRET: 'test-secret',
} as Env;

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return base64UrlEncodeBytes(new Uint8Array(sig));
}

async function mintGrant(payload: AIGrant, secret = 'test-secret'): Promise<string> {
  const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const sigB64 = await hmacSha256Base64Url(secret, `v1.${payloadB64}`);
  return `v1.${payloadB64}.${sigB64}`;
}

test('translator prompt carries field labels and roles from the editable-fields contract', () => {
  const prompt = buildUserPrompt([
    {
      path: 'sections.0.faqs.0.question',
      type: 'string',
      label: 'FAQ question',
      role: 'faq-question',
      value: 'What is Clickeen?',
    },
  ]);

  assert.match(prompt, /"label":"FAQ question"/);
  assert.match(prompt, /"role":"faq-question"/);
});

test('Instance Translation Agent rejects loose legacy value requests', () => {
  assert.equal(
    normalizeInstanceTranslationAgentRequest({
      v: 1,
      widgetType: 'faq',
      sourceLanguage: 'en',
      targetLanguage: 'it',
      items: [{ path: 'header.title', type: 'string', value: 'FAQ' }],
    }),
    null,
  );
});

test('Instance Translation Agent returns current language values for one saved instance', async () => {
  const request = normalizeInstanceTranslationAgentRequest({
    v: 1,
    operation: 'translate_saved_instance',
    accountId: 'acc_test',
    instanceId: 'INSTFAQ001',
    widgetType: 'faq',
    baseLocale: 'en',
    targetLocale: 'it',
    jobId: 'job-translate-1',
    currentSavedTextGraph: [
      {
        path: 'cta.label',
        type: 'string',
        label: 'CTA label',
        role: 'cta-label',
        value: '',
      },
      {
        path: 'sections.0.faqs.0.question',
        type: 'string',
        label: 'FAQ question',
        role: 'faq-question',
        value: 'https://example.com',
      },
    ],
  });
  assert(request);

  const produced = await produceInstanceTranslationValues({ env, grant, request });
  assert.deepEqual(produced.currentLanguageValues, {
    v: 1,
    values: {
      'cta.label': '',
      'sections.0.faqs.0.question': 'https://example.com',
    },
  });
  assert.equal(produced.operation, 'translate_saved_instance');
  assert.equal(produced.jobId, 'job-translate-1');
});

test('Instance Translation Agent rejects pattern and duplicate saved text paths', () => {
  assert.equal(
    normalizeInstanceTranslationAgentRequest({
      v: 1,
      operation: 'translate_saved_instance',
      accountId: 'acc_test',
      instanceId: 'INSTFAQ001',
      widgetType: 'faq',
      baseLocale: 'en',
      targetLocale: 'it',
      jobId: 'job-invalid',
      currentSavedTextGraph: [{ path: 'sections[].faqs[].question', type: 'string', value: 'Question?' }],
    }),
    null,
  );

  assert.equal(
    normalizeInstanceTranslationAgentRequest({
      v: 1,
      operation: 'translate_saved_instance',
      accountId: 'acc_test',
      instanceId: 'INSTFAQ001',
      widgetType: 'faq',
      baseLocale: 'en',
      targetLocale: 'it',
      jobId: 'job-invalid',
      currentSavedTextGraph: [
        { path: 'header.title', type: 'string', value: 'FAQ' },
        { path: 'header.title', type: 'string', value: 'FAQ again' },
      ],
    }),
    null,
  );
});

test('Instance Translation Agent audit event carries policy version and resolved model usage', async () => {
  const resolved = resolveAiAgent('widget.instance.translator');
  assert(resolved);
  const ai = resolveAiRuntimePolicy({ entry: resolved.entry, policyProfile: 'free' });
  const events: InteractionEvent[] = [];
  const auditEnv = {
    ...env,
    SF_EVENTS: {
      send: async (event: InteractionEvent) => {
        events.push(event);
      },
    },
  } as Env;
  const token = await mintGrant({
    v: 1,
    iss: 'roma',
    sub: { kind: 'user', userId: 'usr_test', accountId: 'acc_test' },
    exp: Math.floor(Date.now() / 1000) + 60,
    caps: ['agent:widget.instance.translator'],
    budgets: { maxTokens: ai.maxTokensPerCall, timeoutMs: ai.timeoutMs },
    mode: 'ops',
    ai,
    trace: {
      sessionId: 'sess_103h',
      instancePublicId: 'INSTFAQ001',
      envStage: 'test',
    },
  });

  const response = await handleInstanceTranslationAgent(
    new Request('https://sf.test/v1/agents/instance-translation/translate-saved-instance', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        v: 1,
        operation: 'translate_saved_instance',
        accountId: 'acc_test',
        instanceId: 'INSTFAQ001',
        widgetType: 'faq',
        baseLocale: 'en',
        targetLocale: 'it',
        jobId: 'job-103h',
        currentSavedTextGraph: [
          { path: 'cta.label', type: 'string', label: 'CTA label', role: 'cta-label', value: '' },
        ],
      }),
    }),
    auditEnv,
    undefined,
    'req_103h_translation',
  );

  assert.equal(response.status, 200);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.requestId, 'req_103h_translation');
  assert.equal(events[0]?.subject.kind, 'user');
  assert.equal(events[0]?.agentId, 'widget.instance.translator');
  assert.equal(events[0]?.ai?.policyProfile, 'free');
  assert.equal(events[0]?.ai?.policyVersion, ai.policyVersion);
  assert.equal(events[0]?.ai?.taskClass, 'l10n.instance');
  assert.equal(events[0]?.usage.provider, 'deepseek');
  assert.equal(events[0]?.usage.model, 'deepseek-chat');
  assert.equal(events[0]?.usage.promptTokens, 0);
  assert.equal(events[0]?.usage.completionTokens, 0);
});

test('Instance Translation Agent model calls use the policy grant budget', async () => {
  const resolved = resolveAiAgent('widget.instance.translator');
  assert(resolved);
  const ai = resolveAiRuntimePolicy({ entry: resolved.entry, policyProfile: 'tier3' });
  assert.equal(ai.defaultModel.provider, 'openai');
  assert.equal(ai.defaultModel.model, 'gpt-5-mini');

  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, any> | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = init?.body ? JSON.parse(String(init.body)) : null;
    return new Response(
      JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                items: [{ path: 'cta.label', value: 'Jetzt buchen' }],
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 11,
          completion_tokens: 20,
          completion_tokens_details: { reasoning_tokens: 4 },
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const result = await produceCurrentLanguageValues({
      env: { ...env, OPENAI_API_KEY: 'test-key' } as Env,
      grant: {
        v: 1,
        iss: 'roma',
        sub: { kind: 'user', userId: 'usr_test', accountId: 'acc_test' },
        exp: Math.floor(Date.now() / 1000) + 60,
        caps: ['agent:widget.instance.translator'],
        budgets: { maxTokens: ai.maxTokensPerCall, timeoutMs: ai.timeoutMs },
        mode: 'ops',
        ai,
      },
      request: {
        v: 1,
        widgetType: 'faq',
        sourceLanguage: 'en',
        targetLanguage: 'de',
        items: [{ path: 'cta.label', type: 'string', label: 'CTA label', role: 'cta-label', value: 'Book now' }],
      },
    });

    assert.equal(result.values['cta.label'], 'Jetzt buchen');
    assert.equal(requestBody?.model, 'gpt-5-mini');
    assert.equal(requestBody?.max_completion_tokens, ai.maxTokensPerCall);
    assert.equal(requestBody?.reasoning_effort, 'minimal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
