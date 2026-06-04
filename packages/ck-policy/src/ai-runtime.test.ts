import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAiAgent } from '@clickeen/ck-contracts/ai';
import {
  deriveAiRuntimePolicyUi,
  resolveAiRuntimeBudget,
  resolveAiRuntimePolicy,
} from './ai-runtime';
import type { PolicyProfile } from './types';

function runtimePolicy(agentId: string, policyProfile: PolicyProfile, selectedModel?: unknown) {
  const resolved = resolveAiAgent(agentId);
  assert(resolved, `missing AI registry entry for ${agentId}`);
  return resolveAiRuntimePolicy({
    entry: resolved.entry,
    policyProfile,
    selectedModel,
  });
}

test('Instance Translation Agent resolves Free and Tier 3 through the shared runtime matrix', () => {
  const free = runtimePolicy('widget.instance.translator', 'free');
  const tier3 = runtimePolicy('widget.instance.translator', 'tier3');

  assert.equal(free.agentId, 'widget.instance.translator');
  assert.equal(tier3.agentId, 'widget.instance.translator');
  assert.equal(free.policyProfile, 'free');
  assert.equal(tier3.policyProfile, 'tier3');
  assert.deepEqual(free.defaultModel, { provider: 'deepseek', model: 'deepseek-chat' });
  assert.equal(tier3.defaultModel.provider, 'openai');
  assert.notDeepEqual(free.defaultModel, tier3.defaultModel);
  assert.equal(free.allowModelPicker, false);
  assert.equal(tier3.allowModelPicker, false);
  assert.match(free.policyVersion, /^ai-runtime-v1-/);
  assert.match(tier3.policyVersion, /^ai-runtime-v1-/);
  assert.notEqual(free.policyVersion, tier3.policyVersion);

  assert.deepEqual(resolveAiRuntimeBudget(free), { maxTokens: 900, timeoutMs: 20000 });
  assert.deepEqual(resolveAiRuntimeBudget(tier3), { maxTokens: 2200, timeoutMs: 60000 });
});

test('Widget Copilot resolves Free and Tier 3 through the same runtime matrix', () => {
  const free = runtimePolicy('cs.widget.copilot.v1', 'free');
  const tier3 = runtimePolicy('cs.widget.copilot.v1', 'tier3');

  assert.equal(free.agentId, 'cs.widget.copilot.v1');
  assert.equal(tier3.agentId, 'cs.widget.copilot.v1');
  assert.equal(free.policyProfile, 'free');
  assert.equal(tier3.policyProfile, 'tier3');
  assert.deepEqual(free.defaultModel, { provider: 'deepseek', model: 'deepseek-chat' });
  assert.equal(tier3.defaultModel.provider, 'openai');
  assert.notDeepEqual(free.defaultModel, tier3.defaultModel);
  assert.equal(free.allowModelPicker, false);
  assert.equal(tier3.allowModelPicker, true);
  assert.notEqual(free.policyVersion, tier3.policyVersion);

  const ui = deriveAiRuntimePolicyUi(tier3);
  assert.equal(ui.allowModelPicker, true);
  assert(ui.modelOptions.some((option) => option.provider === 'openai' && option.model === 'gpt-5.2'));
});

test('Copilot model picker is policy-approved: Tier 3 may select an allowed model, Free may not', () => {
  const selected = runtimePolicy('cs.widget.copilot.v1', 'tier3', {
    provider: 'openai',
    model: 'gpt-5',
  });
  assert.deepEqual(selected.selectedModel, { provider: 'openai', model: 'gpt-5' });

  assert.throws(
    () =>
      runtimePolicy('cs.widget.copilot.v1', 'free', {
        provider: 'openai',
        model: 'gpt-5',
      }),
    /Selected AI model is not allowed by account policy/,
  );
});

test('Tier 4 resolves through the AI runtime matrix', () => {
  const tier4 = runtimePolicy('cs.widget.copilot.v1', 'tier4', {
    provider: 'openai',
    model: 'gpt-5',
  });

  assert.equal(tier4.policyProfile, 'tier4');
  assert.equal(tier4.allowModelPicker, true);
  assert.deepEqual(tier4.selectedModel, { provider: 'openai', model: 'gpt-5' });
});
