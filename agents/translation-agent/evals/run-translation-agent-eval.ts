import {
  buildStructuredTranslationPlan,
  buildSystemPrompt,
  chunkTranslationEntries,
  isLikelyNonTranslatableLiteral,
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

function expectEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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
  expectPass('prompt pins the requested locale and product copy rules', () => {
    const prompt = buildSystemPrompt({
      locale: 'it-IT',
      widgetType: 'BigBang',
      items: stringItems,
    });
    if (!prompt.includes('Translate into locale: it-IT.')) {
      throw new Error('locale instruction missing from system prompt');
    }
    if (!prompt.includes('Write in natural, native product/UI copy for the requested locale')) {
      throw new Error('product copy instruction missing from system prompt');
    }
  }),
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
  expectPass('preserves expected output order when provider order differs', () => {
    const result = parseTranslationResult(
      JSON.stringify([
        { path: 'content.cta', value: 'Reserve agora' },
        { path: 'content.title', value: 'Reserve sua estadia, {guestName}' },
      ]),
      stringItems,
      provider,
    );
    expectEqual(result[0]?.path, 'content.title', 'first path');
    expectEqual(result[1]?.path, 'content.cta', 'second path');
  }),
  expectPass('classifies urls emails and token-only values as non-translatable literals', () => {
    expectEqual(isLikelyNonTranslatableLiteral('https://www.clickeen.com'), true, 'url literal');
    expectEqual(isLikelyNonTranslatableLiteral('support@clickeen.com'), true, 'email literal');
    expectEqual(isLikelyNonTranslatableLiteral('{ctaUrl}'), true, 'placeholder literal');
    expectEqual(isLikelyNonTranslatableLiteral('Reserve now'), false, 'copy string');
  }),
  expectPass('chunks model entries without dropping paths', () => {
    const items = Array.from({ length: 85 }, (_, index): TranslationItem => ({
      path: `content.items.${index}.label`,
      type: 'string',
      value: `Label ${index}`,
    }));
    const chunks = chunkTranslationEntries(items);
    expectEqual(chunks.length, 2, 'chunk count');
    expectEqual(chunks.flat().length, 85, 'chunked item count');
    expectEqual(chunks[0]?.[0]?.path, 'content.items.0.label', 'first path preserved');
    expectEqual(chunks[1]?.[0]?.path, 'content.items.80.label', 'split path preserved');
  }),
  expectThrows('fails on invalid json', () => {
    parseTranslationResult('not json', stringItems, provider);
  }, 'Invalid JSON response'),
  expectThrows('fails on non-array json', () => {
    parseTranslationResult(JSON.stringify({ path: 'content.title', value: 'Titulo' }), stringItems, provider);
  }, 'Expected JSON array response'),
  expectThrows('fails on non-object item', () => {
    parseTranslationResult(JSON.stringify(['bad']), stringItems, provider);
  }, 'Item 0 is not an object'),
  expectThrows('fails on duplicate path', () => {
    parseTranslationResult(
      JSON.stringify([
        { path: 'content.title', value: 'Reserve sua estadia, {guestName}' },
        { path: 'content.title', value: 'Reserve sua estadia, {guestName}' },
      ]),
      stringItems,
      provider,
    );
  }, 'Duplicate path'),
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
  expectThrows('fails on missing path value shape', () => {
    parseTranslationResult(
      JSON.stringify([
        { path: 'content.title', value: 'Reserve sua estadia, {guestName}' },
        { path: 'content.cta', value: 123 },
      ]),
      stringItems,
      provider,
    );
  }, 'Item 1 missing path/value'),
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
  expectThrows('fails when translated richtext segment is missing', () => {
    const plan = buildStructuredTranslationPlan(richtextItems);
    restoreStructuredTranslationResults({
      entries: richtextItems,
      plan,
      translatedItems: [
        { path: 'content.body::__segment__:0', value: 'Veja ' },
        { path: 'content.body::__segment__:1', value: 'detalhes' },
      ],
      provider,
    });
  }, 'Missing translated richtext segment'),
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

console.log(`[translation-agent-eval] PASS ${cases.length} deterministic cases`);
