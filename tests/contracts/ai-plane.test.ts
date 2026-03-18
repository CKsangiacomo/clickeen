import { afterEach, describe, expect, it } from 'vitest';
import {
  WIDGET_COPILOT_AGENT_ALIAS,
  resolvePolicy,
  type RomaAccountAuthzCapsulePayload,
} from '@clickeen/ck-policy';
import { issueAccountCopilotGrant } from '../../roma/lib/ai/account-copilot';
import { withInflightLimit } from '../../sanfrancisco/src/concurrency';
import { verifyGrant } from '../../sanfrancisco/src/grants';
import { resolveModelSelection } from '../../sanfrancisco/src/ai/modelRouter';

afterEach(() => {
  delete process.env.AI_GRANT_HMAC_SECRET;
});

describe('AI plane contract floor', () => {
  it('mints a Roma grant that San Francisco can verify and route to the selected provider', async () => {
    const policy = resolvePolicy({ profile: 'tier1', role: 'editor' });
    process.env.AI_GRANT_HMAC_SECRET = 'roma-secret';

    const issued = await issueAccountCopilotGrant({
      authz: {
        userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
        accountId: '11111111-1111-1111-1111-111111111111',
        role: 'editor',
        profile: 'tier1',
        entitlements: {
          flags: policy.flags,
          caps: policy.caps,
          budgets: policy.budgets,
        },
      } as RomaAccountAuthzCapsulePayload,
      agentId: WIDGET_COPILOT_AGENT_ALIAS,
      mode: 'ops',
      requestedProvider: 'openai',
      requestedModel: 'gpt-5.2',
      trace: { sessionId: 'sess_123', instancePublicId: 'wgt_ai_contract' },
      budgets: { maxTokens: 650, timeoutMs: 45_000, maxRequests: 2 },
      usageKv: {
        get: async () => '0',
      },
    });

    expect(issued.ok).toBe(true);
    if (!issued.ok) {
      throw new Error('expected grant issuance to succeed');
    }

    const grant = await verifyGrant(issued.grant, 'roma-secret');
    expect(grant.iss).toBe('roma');
    expect(grant.ai?.selectedProvider).toBe('openai');

    const selection = resolveModelSelection({
      env: {
        OPENAI_API_KEY: 'openai-key',
      } as any,
      grant,
      agentId: issued.agentId,
    });

    expect(selection.provider).toBe('openai');
    expect(selection.canonicalAgentId).toBe(issued.agentId);
    expect(typeof selection.model).toBe('string');
    expect(selection.model.length).toBeGreaterThan(0);
  });

  it('enforces budget ceilings before grant issuance', async () => {
    const policy = resolvePolicy({ profile: 'tier1', role: 'editor' });
    const maxTurns = policy.budgets['budget.copilot.turns']?.max ?? 0;
    process.env.AI_GRANT_HMAC_SECRET = 'roma-secret';

    const issued = await issueAccountCopilotGrant({
      authz: {
        userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
        accountId: '11111111-1111-1111-1111-111111111111',
        role: 'editor',
        profile: 'tier1',
        entitlements: {
          flags: policy.flags,
          caps: policy.caps,
          budgets: policy.budgets,
        },
      } as RomaAccountAuthzCapsulePayload,
      agentId: WIDGET_COPILOT_AGENT_ALIAS,
      usageKv: {
        get: async () => String(maxTurns),
      },
    });

    expect(issued).toEqual({
      ok: false,
      status: 403,
      reasonKey: 'coreui.upsell.reason.budgetExceeded',
      detail: `budget.copilot.turns budget exceeded (max=${maxTurns}).`,
    });
  });

  it('applies the per-isolate concurrency ceiling deterministically', async () => {
    let release: (() => void) | null = null;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });

    const inflight = Array.from({ length: 8 }, () =>
      withInflightLimit(async () => {
        await blocker;
        return 'ok';
      }),
    );

    await expect(
      withInflightLimit(async () => 'overflow'),
    ).rejects.toMatchObject({
      status: 429,
      error: { code: 'BUDGET_EXCEEDED' },
    });

    release?.();
    await Promise.all(inflight);
  });
});
