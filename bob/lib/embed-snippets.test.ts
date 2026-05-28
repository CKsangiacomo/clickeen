import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmbedSnippets } from './embed-snippets';

test('copied embed snippets use clk.live static public URLs only', () => {
  const snippets = buildEmbedSnippets({
    accountPublicId: 'A1B2C3D4',
    instanceId: 'Z9Y8X7W6V5',
    published: true,
    baseUrl: 'https://clk.live',
  });

  assert.equal(snippets.publicUrl, 'https://clk.live/A1B2C3D4/Z9Y8X7W6V5');
  assert.match(snippets.iframeSnippet, /src="https:\/\/clk\.live\/A1B2C3D4\/Z9Y8X7W6V5"/);
  assert.match(snippets.scriptSnippet, /src="https:\/\/clk\.live\/A1B2C3D4\/Z9Y8X7W6V5\/runtime\.js"/);
  assert.doesNotMatch(`${snippets.iframeSnippet}\n${snippets.scriptSnippet}`, /venice|\/widget\/|\/renders\/|embed\.clickeen\.com|publicEmbedId/i);
});

test('copied embed snippets stay empty for unpublished instances', () => {
  const snippets = buildEmbedSnippets({
    accountPublicId: 'A1B2C3D4',
    instanceId: 'Z9Y8X7W6V5',
    published: false,
    baseUrl: 'https://clk.live',
  });

  assert.equal(snippets.canRender, false);
  assert.equal(snippets.iframeSnippet, '');
  assert.equal(snippets.scriptSnippet, '');
});
