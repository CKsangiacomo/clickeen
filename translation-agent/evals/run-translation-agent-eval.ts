import {
  buildStructuredTranslationPlan,
  parseTranslationResult,
  restoreStructuredTranslationResults,
  type TranslationItem,
} from '../src/index';

type CaseResult = {
  name: string;
  ok: boolean;
  message?: string;
};

const provider = 'eval-provider';

function expectThrows(name: string, fn: () => unknown, messageIncludes: string): CaseResult {
  try {
    fn();
    return { name, ok: false, message: 'expected failure but operation passed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return message.includes(messageIncludes)
      ? { name, ok: true }
      : { name, ok: false, message: `expected "${messageIncludes}", got "${message}"` };
  }
}

function expectPass(name: string, fn: () => unknown): CaseResult {
  try {
    fn();
    return { name, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, ok: false, message };
  }
}

const stringItems: TranslationItem[] = [
  {
    path: 'content.title',
    type: 'string',
    value: 'Book your stay, {guestName}',
  },
  {
    path: 'content.cta',
    type: 'string',
    value: 'Reserve now',
  },
];

const richtextItems: TranslationItem[] = [
  {
    path: 'content.body',
    type: 'richtext',
    value: '<p>See <a href="https://example.com">details</a> before booking.</p>',
  },
];

const cases: CaseResult[] = [
  expectPass('preserves exact string paths and placeholders', () => {
    const result = parseTranslationResult(
      JSON.stringify([
        { path: 'content.title', value: 'Reserve sua estadia, { guestName }' },
        { path: 'content.cta', value: 'Reserve agora' },
      ]),
      stringItems,
      provider,
    );
    const title = result.find((item) => item.path === 'content.title')?.value;
    if (title !== 'Reserve sua estadia, {guestName}') {
      throw new Error(`placeholder normalization failed: ${title ?? '<missing>'}`);
    }
  }),
  expectThrows('fails on unexpected path', () => {
    parseTranslationResult(
      JSON.stringify([
        { path: 'content.title', value: 'Reserve sua estadia, {guestName}' },
        { path: 'content.wrong', value: 'Reserve agora' },
      ]),
      stringItems,
      provider,
    );
  }, 'Unexpected path'),
  expectThrows('fails on output size mismatch', () => {
    parseTranslationResult(
      JSON.stringify([{ path: 'content.title', value: 'Reserve sua estadia, {guestName}' }]),
      stringItems,
      provider,
    );
  }, 'Translation output size mismatch'),
  expectThrows('fails on placeholder mismatch', () => {
    parseTranslationResult(
      JSON.stringify([
        { path: 'content.title', value: 'Reserve sua estadia' },
        { path: 'content.cta', value: 'Reserve agora' },
      ]),
      stringItems,
      provider,
    );
  }, 'Placeholder mismatch'),
  expectPass('restores richtext while preserving tags and anchors', () => {
    const plan = buildStructuredTranslationPlan(richtextItems);
    const translatedSegments = plan.modelEntries.map((item) => ({
      path: item.path,
      value: item.path.endsWith('__segment__:0')
        ? 'Veja '
        : item.path.endsWith('__segment__:1')
          ? 'detalhes'
          : ' antes de reservar.',
    }));
    const restored = restoreStructuredTranslationResults({
      entries: richtextItems,
      plan,
      translatedItems: translatedSegments,
      provider,
    });
    if (restored[0]?.value !== '<p>Veja <a href="https://example.com">detalhes</a> antes de reservar.</p>') {
      throw new Error(`unexpected richtext restore: ${restored[0]?.value ?? '<missing>'}`);
    }
  }),
  expectThrows('fails when translated richtext anchor is corrupted', () => {
    const plan = buildStructuredTranslationPlan(richtextItems);
    restoreStructuredTranslationResults({
      entries: richtextItems,
      plan,
      translatedItems: [
        { path: 'content.body::__segment__:0', value: 'Veja ' },
        { path: 'content.body::__segment__:1', value: '<a href="https://evil.example">detalhes</a>' },
        { path: 'content.body::__segment__:2', value: ' antes de reservar.' },
      ],
      provider,
    });
  }, 'Richtext tag mismatch'),
];

const failed = cases.filter((item) => !item.ok);
if (failed.length) {
  failed.forEach((item) => {
    console.error(`[translation-agent-eval] FAIL ${item.name}: ${item.message ?? 'unknown failure'}`);
  });
  process.exit(1);
}

console.log(`[translation-agent-eval] PASS ${cases.length} cases`);
