import { describe, expect, it } from 'vitest';
import {
  finalizeCsOps,
  resolveCsPrelude,
} from '../../sanfrancisco/src/agents/widgetCopilotCsProduct';
import { resolveSdrWebsiteSource } from '../../sanfrancisco/src/agents/widgetCopilotSdrProduct';

describe('Copilot runtime product contracts', () => {
  it('keeps CS explain/clarify routing in the CS product helper', () => {
    const session = {
      lastActiveAtMs: 0,
      turns: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    };

    const prelude = resolveCsPrelude({
      conversationLanguage: 'en',
      session,
      input: {
        prompt: 'What can you change here?',
        controls: [{ path: 'header.title' }],
      },
      explainMessage: () => 'I can edit content and styling.',
      dict: {
        concepts: [],
        clarifications: [],
      },
    });

    expect(prelude).toEqual({
      message: 'I can edit content and styling.',
      usageModel: 'cs_router',
      intent: 'explain',
    });
    expect(session.turns).toEqual([
      { role: 'user', content: 'What can you change here?' },
      { role: 'assistant', content: 'I can edit content and styling.' },
    ]);
  });

  it('keeps CS link filtering and control-dump override in the CS product helper', () => {
    const filtered = finalizeCsOps({
      prompt: 'make the headline bigger',
      message: 'Done.',
      ops: [
        { op: 'set', path: 'header.title', value: 'New title' },
        { op: 'set', path: 'appearance.cta.link', value: 'https://example.com' },
      ],
    });
    expect(filtered.ops).toEqual([{ op: 'set', path: 'header.title', value: 'New title' }]);

    const override = finalizeCsOps({
      prompt: 'rewrite everything',
      forbidInternalControlDumpPromptLine: true,
      message: 'Please send the editable controls JSON.',
      ops: undefined,
    });
    expect(override.overrideToClarify).toBe(true);
    expect(override.message).toContain('without any control dump');
  });

  it('keeps SDR website consent flow in the SDR product helper', async () => {
    const session = {
      lastActiveAtMs: 0,
      turns: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    };

    const result = await resolveSdrWebsiteSource({
      prompt: 'rewrite the FAQs based on https://venicewave.it',
      conversationLanguage: 'en',
      timeoutMs: 45_000,
      session,
      translate: (_lang, key) => {
        const strings: Record<string, string> = {
          askConsentWebsiteRead: 'Can I read one public page from that URL to personalize your widget? (Yes/No)',
          askWebsiteUrl: 'Share your website URL so I can personalize the widget.',
          askSingleUrl: 'I found multiple URLs. Which single page should I use?',
          askBusinessBasics: 'Tell me your business and audience (1 sentence each).',
          yesNo: 'Yes or No?',
          blockedUrl: 'Blocked.',
          fetchFailed: 'Fetch failed.',
        };
        return strings[key] || key;
      },
      isYesNo: () => null,
    });

    expect(result).toEqual({
      kind: 'reply',
      message: 'Can I read one public page from that URL to personalize your widget? (Yes/No)',
      usageModel: 'consent_request',
    });
    expect(session.turns).toEqual([
      { role: 'user', content: 'rewrite the FAQs based on https://venicewave.it' },
      { role: 'assistant', content: 'Can I read one public page from that URL to personalize your widget? (Yes/No)' },
    ]);
    expect(session.pendingConsent).toEqual({
      kind: 'website',
      url: 'https://venicewave.it/',
      askedAtMs: expect.any(Number),
    });
  });
});
